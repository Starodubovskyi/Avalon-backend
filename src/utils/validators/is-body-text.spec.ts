import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMessageDto } from '../../chat/dto/create-message.dto';
import { CreateCommentDto } from '../../social/dto/create-comment.dto';

async function errorsOf<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<Record<string, string>> {
  const errors = await validate(plainToInstance(cls, plain));
  return Object.fromEntries(
    errors.map((error) => [
      error.property,
      Object.values(error.constraints ?? {}).join(', '),
    ]),
  );
}

describe('IsBodyText', () => {
  it('should trim the body before storing it', () => {
    expect(
      plainToInstance(CreateMessageDto, { body: '  Pilot at 14:00 \n' }).body,
    ).toBe('Pilot at 14:00');
  });

  it('should report a blank body as empty', async () => {
    await expect(
      errorsOf(CreateMessageDto, { body: '   \n\t ' }),
    ).resolves.toEqual({ body: 'empty' });
  });

  it('should report a missing or non-string body as empty', async () => {
    await expect(errorsOf(CreateMessageDto, {})).resolves.toEqual({
      body: 'empty',
    });
    await expect(errorsOf(CreateMessageDto, { body: 42 })).resolves.toEqual({
      body: 'empty',
    });
  });

  it('should enforce the max length after trimming', async () => {
    await expect(
      errorsOf(CreateCommentDto, { body: ` ${'a'.repeat(2000)} ` }),
    ).resolves.toEqual({});
    await expect(
      errorsOf(CreateCommentDto, { body: 'a'.repeat(2001) }),
    ).resolves.toEqual({ body: 'tooLong' });
  });
});
