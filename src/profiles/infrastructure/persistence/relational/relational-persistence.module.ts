import { Module } from '@nestjs/common';
import { ProfileRepository } from '../profile.repository';
import { ProfileRelationalRepository } from './repositories/profile.repository';

@Module({
  providers: [
    {
      provide: ProfileRepository,
      useClass: ProfileRelationalRepository,
    },
  ],
  exports: [ProfileRepository],
})
export class RelationalProfilePersistenceModule {}
