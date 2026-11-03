import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyMemberRepository } from '../company-member.repository';
import { CompanyMemberEntity } from './entities/company-member.entity';
import { CompanyMemberRelationalRepository } from './repositories/company-member.repository';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyMemberEntity])],
  providers: [
    {
      provide: CompanyMemberRepository,
      useClass: CompanyMemberRelationalRepository,
    },
  ],
  exports: [CompanyMemberRepository],
})
export class RelationalCompanyMemberPersistenceModule {}
