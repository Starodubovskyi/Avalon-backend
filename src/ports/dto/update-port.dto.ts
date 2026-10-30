import { PartialType } from '@nestjs/swagger';
import { CreatePortDto } from './create-port.dto';

export class UpdatePortDto extends PartialType(CreatePortDto) {}
