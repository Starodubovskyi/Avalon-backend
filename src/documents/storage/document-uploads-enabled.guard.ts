import {
  CanActivate,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DocumentStorage } from './document-storage';

/**
 * Runs before multer, so a disabled storage answers 503 without reading
 * (or buffering) the request body.
 */
@Injectable()
export class DocumentUploadsEnabledGuard implements CanActivate {
  constructor(private readonly storage: DocumentStorage) {}

  canActivate(): boolean {
    if (!this.storage.uploadsEnabled) {
      throw new ServiceUnavailableException({
        status: HttpStatus.SERVICE_UNAVAILABLE,
        errors: { file: 'documentsStorageNotConfigured' },
      });
    }
    return true;
  }
}
