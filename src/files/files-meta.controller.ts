import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FilesService } from './files.service';
import { FileType } from './domain/file';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'files',
  version: '1',
})
export class FilesMetaController {
  constructor(private readonly filesService: FilesService) {}

  @Get('meta/:id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: FileType,
  })
  @HttpCode(HttpStatus.OK)
  async findById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<FileType> {
    const file = await this.filesService.findById(id);
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }
}
