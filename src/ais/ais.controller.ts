import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { AisService } from './ais.service';
import { AisStatus } from './domain/ais-status';

@ApiTags('AIS')
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.staff)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'ais',
  version: '1',
})
export class AisController {
  constructor(private readonly aisService: AisService) {}

  @Get('status')
  @ApiOkResponse({ type: AisStatus })
  @HttpCode(HttpStatus.OK)
  getStatus(): AisStatus {
    return this.aisService.getStatus();
  }
}
