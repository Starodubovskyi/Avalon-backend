import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMapPointDto } from './create-map-point.dto';
import { UpdateMapPointDto } from './update-map-point.dto';

async function errorsOf<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<Record<string, string>> {
  // Same options as the global ValidationPipe (whitelist).
  const errors = await validate(plainToInstance(cls, plain), {
    whitelist: true,
  });
  return Object.fromEntries(
    errors.map((error) => [
      error.property,
      Object.values(error.constraints ?? {}).join(', '),
    ]),
  );
}

const PNG_LOGO = `data:image/png;base64,${Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24, 1),
]).toString('base64')}`;

const base = { lat: 45.42, lng: 28.2, firstName: 'Avalon Shipping SRL' };

describe('CreateMapPointDto', () => {
  it('should accept the new point kinds and reject the old ones', async () => {
    for (const kind of [
      'head_office',
      'branch',
      'self_employed',
      'for_sale',
      'authority',
      'private_person',
    ]) {
      await expect(
        errorsOf(CreateMapPointDto, { ...base, kind }),
      ).resolves.toEqual({});
    }
    for (const kind of ['company', 'agency', 'terminal', 'person']) {
      const errors = await errorsOf(CreateMapPointDto, { ...base, kind });
      expect(Object.keys(errors)).toEqual(['kind']);
    }
  });

  it('should accept zero or more known activity codes (the limit is checked by the service)', async () => {
    await expect(
      errorsOf(CreateMapPointDto, { ...base, activities: [] }),
    ).resolves.toEqual({});
    await expect(
      errorsOf(CreateMapPointDto, {
        ...base,
        activities: ['ship_agency', 'crewing'],
      }),
    ).resolves.toEqual({});
  });

  it('should report an unknown activity code, a non-array or null as invalid', async () => {
    await expect(
      errorsOf(CreateMapPointDto, {
        ...base,
        activities: ['ship_agency', 'x'],
      }),
    ).resolves.toEqual({ activities: 'invalid' });
    await expect(
      errorsOf(CreateMapPointDto, { ...base, activities: 'ship_agency' }),
    ).resolves.toEqual({ activities: 'invalid' });
    await expect(
      errorsOf(CreateMapPointDto, { ...base, activities: [42] }),
    ).resolves.toEqual({ activities: 'invalid' });
    await expect(
      errorsOf(CreateMapPointDto, { ...base, activities: null }),
    ).resolves.toEqual({ activities: 'invalid' });
  });

  it('should drop repeated activity codes', () => {
    const dto = plainToInstance(CreateMapPointDto, {
      ...base,
      activities: ['ship_agency', 'ship_agency'],
    });
    expect(dto.activities).toEqual(['ship_agency']);
  });

  it('should accept a png logo, and null or "" as "no logo"', async () => {
    await expect(
      errorsOf(CreateMapPointDto, { ...base, logo: PNG_LOGO }),
    ).resolves.toEqual({});
    await expect(
      errorsOf(CreateMapPointDto, { ...base, logo: null }),
    ).resolves.toEqual({});
    expect(
      plainToInstance(CreateMapPointDto, { ...base, logo: '  ' }).logo,
    ).toBeNull();
  });

  it('should report a bad or too long logo with one error code', async () => {
    await expect(
      errorsOf(CreateMapPointDto, {
        ...base,
        logo: 'https://example.com/logo.png',
      }),
    ).resolves.toEqual({ logo: 'invalid' });
    await expect(
      errorsOf(CreateMapPointDto, {
        ...base,
        logo: `${PNG_LOGO}${'A'.repeat(150_000)}`,
      }),
    ).resolves.toEqual({ logo: 'tooLong' });
  });

  it('should limit the title to 1..120 characters', async () => {
    await expect(
      errorsOf(CreateMapPointDto, { ...base, firstName: 'x'.repeat(120) }),
    ).resolves.toEqual({});
    const tooLong = await errorsOf(CreateMapPointDto, {
      ...base,
      firstName: 'x'.repeat(121),
    });
    expect(Object.keys(tooLong)).toEqual(['firstName']);
    const blank = await errorsOf(CreateMapPointDto, {
      ...base,
      firstName: '   ',
    });
    expect(Object.keys(blank)).toEqual(['firstName']);
  });

  it('should still accept the legacy lastName, activity and notes fields', async () => {
    const plain = {
      ...base,
      lastName: 'Popescu',
      activity: 'Port agent',
      notes: 'Main office',
    };
    await expect(errorsOf(CreateMapPointDto, plain)).resolves.toEqual({});
    expect(plainToInstance(CreateMapPointDto, plain)).toMatchObject({
      lastName: 'Popescu',
      activity: 'Port agent',
      notes: 'Main office',
    });
  });
});

describe('UpdateMapPointDto', () => {
  it('should accept a partial body', async () => {
    await expect(
      errorsOf(UpdateMapPointDto, { activities: ['shipowners'] }),
    ).resolves.toEqual({});
    await expect(errorsOf(UpdateMapPointDto, {})).resolves.toEqual({});
  });

  it('should keep lastName "" and activity "" (trimmed) so an update clears them', async () => {
    const plain = { firstName: 'Ion Popescu', lastName: '', activity: '   ' };
    await expect(errorsOf(UpdateMapPointDto, plain)).resolves.toEqual({});
    const dto = plainToInstance(UpdateMapPointDto, plain);
    expect(dto.lastName).toBe('');
    expect(dto.activity).toBe('');
    expect(
      plainToInstance(UpdateMapPointDto, { lastName: '  Popescu ' }).lastName,
    ).toBe('Popescu');
  });

  it('should still treat a blank phone/email/address as "not sent"', () => {
    const dto = plainToInstance(UpdateMapPointDto, {
      phone: ' ',
      email: '',
      address: '  ',
    });
    expect(dto.phone).toBeUndefined();
    expect(dto.email).toBeUndefined();
    expect(dto.address).toBeUndefined();
  });

  it('should accept null for nullable fields (logo clears) and reject it for the others', async () => {
    await expect(
      errorsOf(UpdateMapPointDto, { logo: null, notes: null }),
    ).resolves.toEqual({});
    const errors = await errorsOf(UpdateMapPointDto, {
      activities: null,
      firstName: null,
    });
    expect(errors.activities).toBe('invalid');
    expect(Object.keys(errors).sort()).toEqual(['activities', 'firstName']);
  });

  it('should strip the legacy shared isFavorite flag (favorites are per user)', async () => {
    const dto = plainToInstance(UpdateMapPointDto, { isFavorite: true });
    await expect(validate(dto, { whitelist: true })).resolves.toEqual([]);
    expect(dto).not.toHaveProperty('isFavorite');
  });
});
