import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { pipeline } from 'stream/promises';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { CleanupUploadOnErrorInterceptor } from './cleanup-upload-on-error.interceptor';
import { DOCUMENT_CATEGORIES } from './document.constants';
import { DocumentView } from './domain/document';
import { CreateDocumentDto } from './dto/create-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { DocumentsService } from './documents.service';
import { DocumentUploadsEnabledGuard } from './storage/document-uploads-enabled.guard';

@ApiTags('Documents')
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.staff)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'documents',
  version: '1',
})
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOkResponse({ type: [DocumentView] })
  @HttpCode(HttpStatus.OK)
  findAll(@Query() query: QueryDocumentDto): Promise<DocumentView[]> {
    return this.documentsService.findAll(query);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title', 'category'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string', maxLength: 255 },
        category: { type: 'string', enum: [...DOCUMENT_CATEGORIES] },
        vesselId: { type: 'string', format: 'uuid' },
        notes: { type: 'string', maxLength: 4000 },
      },
    },
  })
  @ApiCreatedResponse({ type: DocumentView })
  @ApiServiceUnavailableResponse({
    description: '{ errors: { file: "documentsStorageNotConfigured" } }',
  })
  // 503 before multer reads the body when storage is not configured
  @UseGuards(DocumentUploadsEnabledGuard)
  // order matters: the cleanup interceptor must wrap FileInterceptor (multer)
  @UseInterceptors(CleanupUploadOnErrorInterceptor, FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  upload(
    @Request() request: { user: JwtPayloadType },
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() createDocumentDto: CreateDocumentDto,
  ): Promise<DocumentView> {
    return this.documentsService.upload(
      file,
      createDocumentDto,
      Number(request.user.id),
    );
  }

  @Get(':id/download')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    description: 'File stream (Content-Disposition: attachment)',
  })
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.documentsService.openDownload(id);
    response.status(HttpStatus.OK);
    response.setHeader('Content-Type', file.mimeType);
    if (file.size !== null) {
      response.setHeader('Content-Length', String(file.size));
    }
    response.setHeader('Content-Disposition', file.contentDisposition);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    try {
      await pipeline(file.stream, response);
    } catch (error) {
      // Headers are already sent; the client sees a truncated download.
      this.logger.warn(
        `Document ${id} download aborted: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.documentsService.remove(id);
  }
}
