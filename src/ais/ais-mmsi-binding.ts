/**
 * AIS is an unauthenticated broadcast: one ShipStaticData frame is not
 * enough to bind an MMSI to our vessel. A binding is confirmed only by a
 * second, consistent observation (same IMO -> same MMSI) at least
 * `minConfirmMs` after the first one. A conflicting MMSI restarts the wait.
 */
export class MmsiBindingConfirmer {
  private readonly pending = new Map<
    string,
    { mmsi: string; firstSeenAt: number }
  >();

  constructor(private readonly minConfirmMs: number) {}

  /** Returns true when this observation confirms the pending binding. */
  observe(vesselId: string, mmsi: string, nowMs: number): boolean {
    const pending = this.pending.get(vesselId);
    if (!pending || pending.mmsi !== mmsi) {
      this.pending.set(vesselId, { mmsi, firstSeenAt: nowMs });
      return false;
    }
    return nowMs - pending.firstSeenAt >= this.minConfirmMs;
  }

  forget(vesselId: string): void {
    this.pending.delete(vesselId);
  }

  /** Drops state for vessels no longer tracked. */
  retain(vesselIds: ReadonlySet<string>): void {
    for (const vesselId of this.pending.keys()) {
      if (!vesselIds.has(vesselId)) {
        this.pending.delete(vesselId);
      }
    }
  }
}
