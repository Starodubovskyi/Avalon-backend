import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBodyText, trimString } from '../../utils/validators/is-body-text';
import { POST_BODY_MAX_LENGTH } from '../social.constants';

export class CreatePostDto {
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: POST_BODY_MAX_LENGTH,
    description: 'Trimmed; blank → 422 { body: "empty" }',
  })
  @Transform(trimString)
  @IsBodyText(POST_BODY_MAX_LENGTH)
  body: string;
}
