import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBodyText, trimString } from '../../utils/validators/is-body-text';
import { MESSAGE_BODY_MAX_LENGTH } from '../chat.constants';

export class CreateMessageDto {
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: MESSAGE_BODY_MAX_LENGTH,
    description: 'Trimmed; blank → 422 { body: "empty" }',
  })
  @Transform(trimString)
  @IsBodyText(MESSAGE_BODY_MAX_LENGTH)
  body: string;
}
