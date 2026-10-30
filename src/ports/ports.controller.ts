import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { PortsService } from './ports.service';
import { CreatePortDto } from './dto/create-port.dto';
import { QueryPortDto } from './dto/query-port.dto';
import { UpdatePortDto } from './dto/update-port.dto';
import { Port } from './domain/port';

@ApiTags('Ports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'ports',
  version: '1',
})
export class PortsController {
  constructor(private readonly portsService: PortsService) {}

  @Post()
  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @ApiCreatedResponse({
    type: Port,
  })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPortDto: CreatePortDto): Promise<Port> {
    return this.portsService.create(createPortDto);
  }

  @Get()
  @ApiOkResponse({
    type: [Port],
  })
  @HttpCode(HttpStatus.OK)
  findAll(@Query() query: QueryPortDto): Promise<Port[]> {
    return this.portsService.findAll(query);
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: Port,
  })
  @HttpCode(HttpStatus.OK)
  findById(@Param('id', new ParseUUIDPipe()) id: string): Promise<Port> {
    return this.portsService.findById(id);
  }

  @Patch(':id')
  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: Port,
  })
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updatePortDto: UpdatePortDto,
  ): Promise<Port> {
    return this.portsService.update(id, updatePortDto);
  }

  @Delete(':id')
  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.portsService.remove(id);
  }
}
