import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VesselEventsService } from '../vessel-events/vessel-events.service';
import { AisTrackedVessel } from '../vessels/domain/vessel';
import { VesselRepository } from '../vessels/infrastructure/persistence/vessel.repository';
import {
  AisPositionMessage,
  AisStaticMessage,
  decodeAisFrame,
  parseAisMessage,
} from './ais-messages';
import { MmsiBindingConfirmer } from './ais-mmsi-binding';
import {
  GeoFix,
  isPlausibleFix,
  PositionThrottle,
} from './ais-position-filter';
import {
  AIS_MMSI_CONFIRM_MS,
  AIS_POSITION_MIN_INTERVAL_MS,
  AIS_STALE_CONNECTION_MS,
  AIS_VESSEL_RELOAD_INTERVAL_MS,
  AISSTREAM_URL,
  buildSubscriptionMessage,
  reconnectDelayMs,
} from './ais.constants';
import { AisStatus } from './domain/ais-status';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Optional AISStream.io client (enabled by AISSTREAM_API_KEY). Exactly one
 * socket per process (the account allows few connections); reconnects with
 * exponential backoff and never throws into the app. Position writes are
 * not audited and do not change updatedAt/updatedBy; an MMSI binding is
 * confirmed twice and audited as a system event (userId null).
 */
@Injectable()
export class AisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AisService.name);
  private readonly apiKey = (process.env.AISSTREAM_API_KEY ?? '').trim();
  private readonly throttle = new PositionThrottle(
    AIS_POSITION_MIN_INTERVAL_MS,
  );
  private readonly mmsiBinding = new MmsiBindingConfirmer(AIS_MMSI_CONFIRM_MS);

  private socket: WebSocket | null = null;
  private connected = false;
  private stopped = false;
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reloadTimer: NodeJS.Timeout | null = null;
  private lastMessageAt: Date | null = null;
  /** Connect time or last frame time; drives the stale-socket watchdog. */
  private lastActivityAt = 0;

  private vesselIdByImo = new Map<string, string>();
  private vesselIdByMmsi = new Map<string, string>();
  private mmsiByVesselId = new Map<string, string | null>();
  private nameByVesselId = new Map<string, string>();
  /** Last stored AIS fix per vessel (speed-jump filter). */
  private lastFixByVessel = new Map<string, GeoFix>();
  private trackedVessels = 0;

  constructor(
    private readonly vesselRepository: VesselRepository,
    private readonly vesselEventsService: VesselEventsService,
    private readonly dataSource: DataSource,
  ) {}

  /** Serverless functions cannot hold a long-lived WebSocket. */
  private readonly serverless = Boolean(process.env.VERCEL);

  get enabled(): boolean {
    return this.apiKey.length > 0 && !this.serverless;
  }

  onModuleInit(): void {
    if (this.serverless) {
      this.logger.log('AIS disabled on serverless');
      return;
    }
    if (!this.enabled) {
      this.logger.log('AIS disabled: AISSTREAM_API_KEY is empty');
      return;
    }
    void this.reloadVessels();
    this.reloadTimer = setInterval(() => {
      this.closeIfStale();
      void this.reloadVessels();
    }, AIS_VESSEL_RELOAD_INTERVAL_MS);
    this.reloadTimer.unref();
    this.connect();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.reloadTimer) clearInterval(this.reloadTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reloadTimer = null;
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    this.connected = false;
    socket?.close(1000, 'shutdown');
  }

  getStatus(): AisStatus {
    const status = new AisStatus();
    status.enabled = this.enabled;
    status.connected = this.enabled && this.connected;
    status.lastMessageAt = this.lastMessageAt?.toISOString() ?? null;
    status.trackedVessels = this.enabled ? this.trackedVessels : 0;
    return status;
  }

  /** Rebuilds IMO/MMSI maps from active vessels. Never throws. */
  async reloadVessels(): Promise<void> {
    try {
      this.applyTrackedVessels(await this.vesselRepository.findActiveForAis());
    } catch (error) {
      this.logger.warn(`AIS vessel reload failed: ${errorMessage(error)}`);
    }
  }

  /** Handles one decoded frame. Public for unit tests. Never throws. */
  async handleFrame(text: string, receivedAt: Date): Promise<void> {
    const message = parseAisMessage(text);
    if (message.kind === 'error') {
      this.logger.warn(`AISStream error: ${message.error}`);
      return;
    }
    this.lastMessageAt = receivedAt;
    if (message.kind === 'ignored') {
      return;
    }
    // Real data flows: the subscription works, reset the backoff.
    this.reconnectAttempt = 0;
    try {
      if (message.kind === 'static') {
        await this.handleStaticData(message, receivedAt);
      } else {
        await this.handlePosition(message, receivedAt);
      }
    } catch (error) {
      this.logger.warn(`AIS update failed: ${errorMessage(error)}`);
    }
  }

  private applyTrackedVessels(vessels: AisTrackedVessel[]): void {
    const byImo = new Map<string, string>();
    const byMmsi = new Map<string, string>();
    const mmsiById = new Map<string, string | null>();
    const names = new Map<string, string>();
    const fixes = new Map<string, GeoFix>();

    for (const vessel of vessels) {
      mmsiById.set(vessel.id, vessel.mmsi);
      names.set(vessel.id, vessel.name);
      if (vessel.imo) byImo.set(vessel.imo, vessel.id);
      if (vessel.mmsi) byMmsi.set(vessel.mmsi, vessel.id);

      const known = this.lastFixByVessel.get(vessel.id);
      const stored =
        vessel.positionSource === 'ais' &&
        vessel.lat !== null &&
        vessel.lng !== null &&
        vessel.positionAt
          ? { lat: vessel.lat, lng: vessel.lng, at: vessel.positionAt }
          : null;
      const latest =
        known && (!stored || known.at.getTime() >= stored.at.getTime())
          ? known
          : stored;
      if (latest) fixes.set(vessel.id, latest);
    }

    this.vesselIdByImo = byImo;
    this.vesselIdByMmsi = byMmsi;
    this.mmsiByVesselId = mmsiById;
    this.nameByVesselId = names;
    this.lastFixByVessel = fixes;
    const trackedIds = new Set(mmsiById.keys());
    this.throttle.retain(trackedIds);
    this.mmsiBinding.retain(trackedIds);
    this.trackedVessels = vessels.filter((v) => v.imo || v.mmsi).length;
  }

  private async handleStaticData(
    message: AisStaticMessage,
    receivedAt: Date,
  ): Promise<void> {
    const vesselId = this.vesselIdByImo.get(message.imo);
    // Only fill an empty MMSI; never overwrite one set by staff or earlier AIS.
    if (!vesselId || this.mmsiByVesselId.get(vesselId)) {
      return;
    }
    if (
      !this.mmsiBinding.observe(vesselId, message.mmsi, receivedAt.getTime())
    ) {
      return; // wait for a second consistent ShipStaticData
    }

    const assigned = await this.dataSource.transaction(async (manager) => {
      const updated = await this.vesselRepository.assignMmsiIfEmpty(
        vesselId,
        message.mmsi,
        manager,
      );
      if (updated) {
        await this.vesselEventsService.record(manager, {
          vesselId,
          vesselName: this.nameByVesselId.get(vesselId) ?? '',
          userId: null,
          action: 'updated',
          changes: { mmsi: { from: null, to: message.mmsi } },
        });
      }
      return updated;
    });

    this.mmsiBinding.forget(vesselId);
    if (assigned) {
      this.mmsiByVesselId.set(vesselId, message.mmsi);
      this.vesselIdByMmsi.set(message.mmsi, vesselId);
      this.logger.log(
        `AIS linked IMO ${message.imo} to MMSI ${message.mmsi} (vessel ${vesselId})`,
      );
    }
  }

  private async handlePosition(
    message: AisPositionMessage,
    receivedAt: Date,
  ): Promise<void> {
    const vesselId = this.vesselIdByMmsi.get(message.mmsi);
    const nowMs = receivedAt.getTime();
    if (!vesselId || !this.throttle.canWrite(vesselId, nowMs)) {
      return;
    }
    // MetaData time is undocumented: server receive time is the fix time.
    const fix: GeoFix = { lat: message.lat, lng: message.lng, at: receivedAt };
    if (!isPlausibleFix(this.lastFixByVessel.get(vesselId), fix)) {
      this.logger.debug(
        `AIS fix for MMSI ${message.mmsi} dropped: implausible jump`,
      );
      return;
    }

    this.throttle.markWritten(vesselId, nowMs);
    await this.vesselRepository.updateAisPosition(vesselId, {
      lat: message.lat,
      lng: message.lng,
      sog: message.sog,
      cog: message.cog,
      positionAt: receivedAt,
    });
    this.lastFixByVessel.set(vesselId, fix);
  }

  private connect(): void {
    // One socket per process: never open a parallel connection.
    if (this.stopped || this.socket) {
      return;
    }

    let socket: WebSocket;
    try {
      socket = new WebSocket(AISSTREAM_URL);
    } catch (error) {
      this.logger.warn(`AIS connect failed: ${errorMessage(error)}`);
      this.scheduleReconnect();
      return;
    }
    socket.binaryType = 'arraybuffer';
    this.socket = socket;

    socket.onopen = () => {
      this.connected = true;
      this.lastActivityAt = Date.now();
      // AISStream closes the socket if the subscription is not sent within 3 s.
      socket.send(JSON.stringify(buildSubscriptionMessage(this.apiKey)));
      this.logger.log('AIS stream connected, subscription sent');
    };
    socket.onmessage = (event: MessageEvent) => {
      void this.onFrame(event.data);
    };
    socket.onerror = () => {
      this.logger.warn('AIS socket error');
    };
    socket.onclose = (event: CloseEvent) => {
      if (this.socket !== socket) {
        return; // superseded (stale watchdog or shutdown)
      }
      this.socket = null;
      this.connected = false;
      if (!this.stopped) {
        this.logger.warn(
          `AIS stream closed (code ${event.code}${event.reason ? `, ${event.reason}` : ''})`,
        );
        this.scheduleReconnect();
      }
    };
  }

  private async onFrame(data: unknown): Promise<void> {
    this.lastActivityAt = Date.now();
    try {
      const text = await decodeAisFrame(data);
      if (text !== null) {
        await this.handleFrame(text, new Date());
      }
    } catch (error) {
      this.logger.warn(`AIS frame skipped: ${errorMessage(error)}`);
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) {
      return;
    }
    const delay = reconnectDelayMs(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.logger.log(`AIS reconnect in ${Math.round(delay / 1000)} s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
    this.reconnectTimer.unref();
  }

  /** A connected but silent socket is likely dead; closing triggers reconnect. */
  private closeIfStale(): void {
    const socket = this.socket;
    if (
      !socket ||
      !this.connected ||
      Date.now() - this.lastActivityAt <= AIS_STALE_CONNECTION_MS
    ) {
      return;
    }
    this.logger.warn('AIS stream silent for too long, reconnecting');
    // Detach first: a dead TCP connection may never deliver onclose.
    this.socket = null;
    this.connected = false;
    socket.close(4000, 'stale');
    this.scheduleReconnect();
  }
}
