import { Module } from '@nestjs/common';
import { RelationalWalletPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { WalletController } from './wallet.controller';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletService } from './wallet.service';

/** Virtual credits. WalletLedgerService is the only writer of the ledger. */
@Module({
  imports: [RelationalWalletPersistenceModule],
  controllers: [WalletController],
  providers: [WalletService, WalletLedgerService],
  exports: [WalletLedgerService],
})
export class WalletModule {}
