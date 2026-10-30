import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from './entities/document.entity';
import { DocumentRepository } from '../document.repository';
import { DocumentRelationalRepository } from './repositories/document.repository';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentEntity])],
  providers: [
    {
      provide: DocumentRepository,
      useClass: DocumentRelationalRepository,
    },
  ],
  exports: [DocumentRepository],
})
export class RelationalDocumentPersistenceModule {}
