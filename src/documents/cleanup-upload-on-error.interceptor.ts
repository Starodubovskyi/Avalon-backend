import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { Observable, catchError, throwError } from 'rxjs';

/**
 * Must be listed BEFORE FileInterceptor so it wraps multer, the pipes and
 * the handler:
 * - multer's LIMIT_FILE_SIZE (413 from FileInterceptor) -> 422 fileTooLarge;
 * - when validation or the handler fail after multer stored the file,
 *   the orphaned file is removed.
 */
@Injectable()
export class CleanupUploadOnErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CleanupUploadOnErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        const request = context
          .switchToHttp()
          .getRequest<{ file?: Express.Multer.File }>();
        const filePath = request.file?.path;
        if (filePath) {
          void unlink(filePath).catch((unlinkError: unknown) => {
            this.logger.warn(
              `Failed to remove rejected upload ${request.file?.filename}: ${
                unlinkError instanceof Error
                  ? unlinkError.message
                  : String(unlinkError)
              }`,
            );
          });
        }
        if (error instanceof PayloadTooLargeException) {
          return throwError(
            () =>
              new UnprocessableEntityException({
                status: HttpStatus.UNPROCESSABLE_ENTITY,
                errors: { file: 'fileTooLarge' },
              }),
          );
        }
        return throwError(() => error);
      }),
    );
  }
}
