import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ServiceUnavailableException } from '@nestjs/common';
import path from 'path';
import { Readable } from 'stream';
import { DocumentStorage } from './document-storage';
import { createDocumentStorage } from './document-storage.factory';
import { resolveDocumentStorageSettings } from './document-storage-settings';
import { DocumentUploadsEnabledGuard } from './document-uploads-enabled.guard';
import { LocalDocumentStorage } from './local-document-storage';
import { S3DocumentStorage } from './s3-document-storage';

const S3_ENV = {
  DOCUMENTS_DRIVER: 's3',
  DOCUMENTS_S3_BUCKET: 'avalon-docs',
  DOCUMENTS_S3_ACCESS_KEY_ID: 'test-access-key',
  DOCUMENTS_S3_SECRET_ACCESS_KEY: 'test-secret-key',
};

describe('resolveDocumentStorageSettings', () => {
  it('should default to local disk with uploads enabled', () => {
    const settings = resolveDocumentStorageSettings({});
    expect(settings).toMatchObject({
      driver: 'local',
      uploadsEnabled: true,
      disabledReason: null,
      s3: null,
    });
    expect(settings.localDirectory).toBe(path.resolve('./storage/documents'));
  });

  it('should disable local uploads on Vercel (read-only FS)', () => {
    for (const env of [
      { VERCEL: '1' },
      { VERCEL: '1', DOCUMENTS_DRIVER: 'local' },
    ]) {
      const settings = resolveDocumentStorageSettings(env);
      expect(settings.driver).toBe('local');
      expect(settings.uploadsEnabled).toBe(false);
      expect(settings.disabledReason).toMatch(/Vercel/);
    }
  });

  it('should select s3 with region auto and an optional endpoint', () => {
    expect(resolveDocumentStorageSettings(S3_ENV)).toMatchObject({
      driver: 's3',
      uploadsEnabled: true,
      s3: {
        bucket: 'avalon-docs',
        region: 'auto',
        endpoint: undefined,
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      },
    });
    expect(
      resolveDocumentStorageSettings({
        ...S3_ENV,
        VERCEL: '1',
        DOCUMENTS_S3_REGION: 'eu-central-1',
        DOCUMENTS_S3_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
      }).s3,
    ).toMatchObject({
      region: 'eu-central-1',
      endpoint: 'https://example.r2.cloudflarestorage.com',
    });
  });

  it('should disable uploads when s3 is not fully configured', () => {
    const settings = resolveDocumentStorageSettings({
      ...S3_ENV,
      DOCUMENTS_S3_SECRET_ACCESS_KEY: '  ',
      VERCEL: '1',
    });
    expect(settings).toMatchObject({
      driver: 's3',
      uploadsEnabled: false,
      s3: null,
    });
    expect(settings.disabledReason).toMatch(/DOCUMENTS_S3_BUCKET/);
  });

  it('should disable uploads for an unknown driver instead of crashing', () => {
    const settings = resolveDocumentStorageSettings({
      DOCUMENTS_DRIVER: 'ftp',
    });
    expect(settings.uploadsEnabled).toBe(false);
    expect(settings.disabledReason).toMatch(/ftp/);
  });
});

describe('createDocumentStorage', () => {
  it('should build S3 storage only for a configured s3 driver', () => {
    expect(
      createDocumentStorage(resolveDocumentStorageSettings(S3_ENV)),
    ).toBeInstanceOf(S3DocumentStorage);

    const fallback = createDocumentStorage(
      resolveDocumentStorageSettings({ DOCUMENTS_DRIVER: 's3' }),
    );
    expect(fallback).toBeInstanceOf(LocalDocumentStorage);
    expect(fallback.uploadsEnabled).toBe(false);

    const local = createDocumentStorage(resolveDocumentStorageSettings({}));
    expect(local).toBeInstanceOf(LocalDocumentStorage);
    expect(local.uploadsEnabled).toBe(true);
  });
});

describe('DocumentUploadsEnabledGuard', () => {
  it('should answer 503 documentsStorageNotConfigured when uploads are off', () => {
    const guard = new DocumentUploadsEnabledGuard(
      createDocumentStorage(resolveDocumentStorageSettings({ VERCEL: '1' })),
    );
    let caught: unknown;
    try {
      guard.canActivate();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ServiceUnavailableException);
    expect((caught as ServiceUnavailableException).getResponse()).toEqual({
      status: 503,
      errors: { file: 'documentsStorageNotConfigured' },
    });
  });

  it('should let uploads through when storage is available', () => {
    const storage = { uploadsEnabled: true } as DocumentStorage;
    expect(new DocumentUploadsEnabledGuard(storage).canActivate()).toBe(true);
  });
});

describe('S3DocumentStorage', () => {
  const settings = resolveDocumentStorageSettings(S3_ENV).s3!;
  let send: jest.Mock;
  let storage: S3DocumentStorage;

  beforeEach(() => {
    send = jest.fn();
    storage = new S3DocumentStorage(settings, {
      send,
    } as unknown as S3Client);
  });

  it('should put the upload under a random key with the derived content type', async () => {
    send.mockResolvedValue({});
    const file = {
      buffer: Buffer.from('%PDF-1.4'),
      size: 8,
      originalname: 'NOR.pdf',
    } as Express.Multer.File;

    const key = await storage.save(file, 'pdf');

    expect(key).toMatch(/^[a-f0-9-]{36}\.pdf$/);
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'avalon-docs',
      Key: `documents/${key}`,
      ContentType: 'application/pdf',
      ContentLength: 8,
    });
  });

  it('should stream an existing object and return null for a missing one', async () => {
    const body = Readable.from(['hello']);
    send.mockResolvedValueOnce({ Body: body, ContentLength: 5 });
    await expect(storage.open('a.pdf')).resolves.toEqual({
      stream: body,
      size: 5,
    });
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);

    send.mockRejectedValueOnce(
      Object.assign(new Error('missing'), { name: 'NoSuchKey' }),
    );
    await expect(storage.open('b.pdf')).resolves.toBeNull();
  });

  it('should discard best-effort without throwing', async () => {
    send.mockRejectedValue(new Error('network'));
    await expect(storage.discard('a.pdf')).resolves.toBeUndefined();
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
  });
});
