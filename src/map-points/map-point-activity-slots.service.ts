import { Injectable, NotFoundException } from '@nestjs/common';
import { NetworkActor } from '../users-directory/user-visibility';
import { unprocessable } from '../utils/unprocessable';
import { WalletLedgerService } from '../wallet/wallet-ledger.service';
import {
  WALLET_NOTE_MAX_LENGTH,
  WALLET_PRICES,
} from '../wallet/wallet.constants';
import { MapPoint } from './domain/map-point';
import { MapPointView } from './domain/map-point-view';
import { MapPointRepository } from './infrastructure/persistence/map-point.repository';
import { MAX_ACTIVITY_SLOTS } from './map-point.constants';
import { MapPointPresenter } from './map-point.presenter';
import { MapPointsService } from './map-points.service';

/**
 * Buys one more Business Activity slot for a point (owner or team), paid
 * from the balance of whoever clicks. The debit and the +1 commit together.
 */
@Injectable()
export class MapPointActivitySlotsService {
  constructor(
    private readonly mapPointsService: MapPointsService,
    private readonly mapPointRepository: MapPointRepository,
    private readonly ledger: WalletLedgerService,
    private readonly presenter: MapPointPresenter,
  ) {}

  /** 422 { activitySlots: "max" } at 14 slots; { balance: "insufficient" }. */
  async purchase(
    actor: NetworkActor,
    id: MapPoint['id'],
  ): Promise<MapPointView> {
    const point = await this.mapPointsService.getEditablePoint(actor, id);
    if (point.activitySlots >= MAX_ACTIVITY_SLOTS) {
      throw unprocessable('activitySlots', 'max');
    }
    await this.ledger.spend(
      {
        userId: actor.userId,
        price: WALLET_PRICES.activitySlot,
        kind: 'activity_slot',
        pointId: id,
        note: `Business Activity slot: ${point.firstName}`.slice(
          0,
          WALLET_NOTE_MAX_LENGTH,
        ),
      },
      async (manager) => {
        // Re-checked atomically: a parallel purchase may have taken the last
        // slot, or the point may have been deleted meanwhile (nothing charged).
        const result = await this.mapPointRepository.addActivitySlot(
          id,
          MAX_ACTIVITY_SLOTS,
          manager,
        );
        if (result === 'notFound') {
          throw new NotFoundException('Map point not found');
        }
        if (result === 'max') {
          throw unprocessable('activitySlots', 'max');
        }
      },
    );
    return this.presenter.presentOne(
      actor,
      await this.mapPointsService.getVisiblePoint(actor, id),
    );
  }
}
