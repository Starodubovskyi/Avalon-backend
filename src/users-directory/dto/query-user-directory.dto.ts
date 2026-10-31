import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class QueryUserDirectoryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Matches first name, last name or email (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
