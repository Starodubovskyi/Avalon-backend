import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { IsPresent } from '../../utils/validators/is-present';
import { JoinCompanyDto } from './join-company.dto';

export class UpdateCompanyMemberDto extends JoinCompanyDto {
  @ApiPropertyOptional({
    enum: ['active'],
    description: 'Approves a pending request. 422 { status: "invalid" }',
  })
  @IsPresent()
  @IsIn(['active'], { message: 'invalid' })
  status?: 'active';
}
