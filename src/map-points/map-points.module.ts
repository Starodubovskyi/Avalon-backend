import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MapPointsService } from './map-points.service';
import { MapPointsController } from './map-points.controller';
import { RelationalMapPointPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { FilesModule } from '../files/files.module';
import { MailModule } from '../mail/mail.module';
import { UserRankModule } from '../user-rank/user-rank.module';
import { WalletModule } from '../wallet/wallet.module';
import { MapPointPresenter } from './map-point.presenter';
import { MapPointActivitySlotsService } from './map-point-activity-slots.service';
import { MapPointEmailVerificationService } from './map-point-email-verification.service';
import { MapPointEmailVerificationController } from './map-point-email-verification.controller';

@Module({
  imports: [
    RelationalMapPointPersistenceModule,
    FilesModule,
    UserRankModule,
    WalletModule,
    MailModule,
    JwtModule.register({}),
  ],
  controllers: [MapPointsController, MapPointEmailVerificationController],
  providers: [
    MapPointsService,
    MapPointPresenter,
    MapPointActivitySlotsService,
    MapPointEmailVerificationService,
  ],
  exports: [
    MapPointsService,
    MapPointPresenter,
    RelationalMapPointPersistenceModule,
  ],
})
export class MapPointsModule {}
