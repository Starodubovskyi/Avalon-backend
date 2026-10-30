import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortEntity } from './entities/port.entity';
import { PortRepository } from '../port.repository';
import { PortRelationalRepository } from './repositories/port.repository';

@Module({
  imports: [TypeOrmModule.forFeature([PortEntity])],
  providers: [
    {
      provide: PortRepository,
      useClass: PortRelationalRepository,
    },
  ],
  exports: [PortRepository],
})
export class RelationalPortPersistenceModule {}
