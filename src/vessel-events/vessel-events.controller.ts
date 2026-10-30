import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { VesselEvent } from './domain/vessel-event';
import { QueryVesselEventDto } from './dto/query-vessel-event.dto';
import { VesselEventsService } from './vessel-events.service';

@ApiTags('Vessel events')
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.staff)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  version: '1',
})
export class VesselEventsController {
  constructor(private readonly vesselEventsService: VesselEventsService) {}

  @Get('vessels/:id/events')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: [VesselEvent] })
  @HttpCode(HttpStatus.OK)
  findByVessel(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<VesselEvent[]> {
    return this.vesselEventsService.findByVessel(id);
  }

  @Get('vessel-events')
  @ApiOkResponse({ type: [VesselEvent] })
  @HttpCode(HttpStatus.OK)
  findRecent(@Query() query: QueryVesselEventDto): Promise<VesselEvent[]> {
    return this.vesselEventsService.findRecent(query);
  }
}
