import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ConfirmPointEmailDto {
  @ApiProperty({
    type: String,
    description: 'The `token` query parameter of the /verify-email link',
  })
  @IsString({ message: 'invalid' })
  @IsNotEmpty({ message: 'invalid' })
  @MaxLength(2000, { message: 'invalid' })
  token: string;
}
