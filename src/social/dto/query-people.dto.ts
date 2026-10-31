import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PEOPLE_FILTERS, PeopleFilter } from '../social.constants';

export class QueryPeopleDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Matches first name, last name or email (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: PEOPLE_FILTERS,
    default: 'all',
    description: 'friends = mutual follow',
  })
  @IsOptional()
  @IsIn(PEOPLE_FILTERS)
  filter?: PeopleFilter = 'all';
}
