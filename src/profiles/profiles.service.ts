import { Injectable, NotFoundException } from '@nestjs/common';
import { pointListScope } from '../map-points/map-point-access';
import { UserRankService } from '../user-rank/user-rank.service';
import {
  isTeamRole,
  NetworkActor,
  redactUserCard,
} from '../users-directory/user-visibility';
import { UsersDirectoryService } from '../users-directory/users-directory.service';
import { PersonProfile } from './domain/person-profile';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileRepository } from './infrastructure/persistence/profile.repository';
import { PERSON_COMPANIES_LIMIT } from './profiles.constants';

/**
 * Personal pages. Visible like the people directory: the team sees
 * everyone, a viewer sees the team and public profiles (owners and active
 * members of public points); anyone else is 404. The phone is shown only to
 * the person and the team; viewers do not get other clients' emails.
 */
@Injectable()
export class ProfilesService {
  constructor(
    private readonly profileRepository: ProfileRepository,
    private readonly directoryService: UsersDirectoryService,
    private readonly userRankService: UserRankService,
  ) {}

  async findOne(actor: NetworkActor, userId: number): Promise<PersonProfile> {
    const isMe = userId === actor.userId;
    if (!isMe && !(await this.directoryService.isVisible(actor, userId))) {
      throw this.notFound();
    }
    const scope = pointListScope(actor);
    const [record, companies, ranks] = await Promise.all([
      this.profileRepository.findProfile(userId, actor.userId, scope),
      this.profileRepository.findCompanies(
        userId,
        scope,
        PERSON_COMPANIES_LIMIT,
      ),
      this.userRankService.getRanks([userId]),
    ]);
    if (!record) {
      throw this.notFound();
    }

    const profile = new PersonProfile();
    profile.user = redactUserCard(record.user, actor);
    profile.headline = record.headline;
    profile.bio = record.bio;
    profile.phone = isMe || isTeamRole(actor.roleId) ? record.phone : null;
    profile.locale = record.locale;
    profile.rank = ranks.get(userId) ?? 0;
    profile.companies = companies;
    profile.stats = record.stats;
    profile.isFollowing = !isMe && record.isFollowing;
    // A visible person is reachable in chat (same rule as POST /conversations).
    profile.canMessage = !isMe;
    profile.isMe = isMe;
    profile.memberSince = record.createdAt;
    return profile;
  }

  async updateMe(
    actor: NetworkActor,
    dto: UpdateProfileDto,
  ): Promise<PersonProfile> {
    await this.profileRepository.update(actor.userId, {
      headline: dto.headline,
      bio: dto.bio,
      phone: dto.phone,
      locale: dto.locale,
    });
    return this.findOne(actor, actor.userId);
  }

  private notFound(): NotFoundException {
    return new NotFoundException('Person not found');
  }
}
