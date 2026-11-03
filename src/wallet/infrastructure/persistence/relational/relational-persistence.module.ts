import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletRepository } from '../wallet.repository';
import { RankBoostEntity } from './entities/rank-boost.entity';
import { TopUpRequestEntity } from './entities/top-up-request.entity';
import { WalletTransactionEntity } from './entities/wallet-transaction.entity';
import { WalletRelationalRepository } from './repositories/wallet.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WalletTransactionEntity,
      TopUpRequestEntity,
      RankBoostEntity,
    ]),
  ],
  providers: [
    {
      provide: WalletRepository,
      useClass: WalletRelationalRepository,
    },
  ],
  exports: [WalletRepository],
})
export class RelationalWalletPersistenceModule {}
