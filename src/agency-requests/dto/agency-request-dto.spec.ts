import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAgencyRequestDto } from './create-agency-request.dto';
import { QueryAgencyRequestDto } from './query-agency-request.dto';
import { UpdateAgencyRequestDto } from './update-agency-request.dto';

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

const VALID = {
  company: 'Test Agency Dto Ltd',
  contactName: 'Test Contact',
  email: 'test.agency.dto@example.com',
  vesselName: 'MV Test Dto',
  vesselType: 'general_cargo',
  destination: 'RENI',
};

describe('CreateAgencyRequestDto', () => {
  it('should accept a minimal valid request', async () => {
    await expect(errorsOf(CreateAgencyRequestDto, VALID)).resolves.toEqual({});
  });

  it('should trim strings and turn blank optional strings into null', () => {
    const dto = plainToInstance(CreateAgencyRequestDto, {
      ...VALID,
      company: '  Test Agency Dto Ltd  ',
      phone: '   ',
      imo: ' 9123456 ',
      cargo: '',
      notes: ' Draft 7.2 m ',
    });

    expect(dto).toEqual(
      expect.objectContaining({
        company: 'Test Agency Dto Ltd',
        phone: null,
        imo: '9123456',
        cargo: null,
        notes: 'Draft 7.2 m',
      }),
    );
  });

  it('should report field codes for an invalid email, a 6-digit IMO and an unknown port', async () => {
    await expect(
      errorsOf(CreateAgencyRequestDto, {
        ...VALID,
        email: 'not-an-email',
        imo: '912345',
        destination: 'ODESA',
        vesselType: 'container',
        eta: '2026-11-05',
      }),
    ).resolves.toEqual({
      email: 'invalidEmail',
      imo: 'imoInvalid',
      destination: 'invalid',
      vesselType: 'invalid',
      eta: 'invalidDateTime',
    });
  });

  it('should report blank and too long required text', async () => {
    await expect(
      errorsOf(CreateAgencyRequestDto, {
        ...VALID,
        company: '   ',
        contactName: undefined,
        vesselName: 'X'.repeat(81),
        notes: 'n'.repeat(2001),
      }),
    ).resolves.toEqual({
      company: 'empty',
      contactName: 'empty',
      vesselName: 'tooLong',
      notes: 'tooLong',
    });
  });

  it('should upper-case the vessel name before the length check', async () => {
    // "ß" upper-cases to "SS": 80 characters typed, 160 stored.
    await expect(
      errorsOf(CreateAgencyRequestDto, {
        ...VALID,
        vesselName: 'ß'.repeat(80),
      }),
    ).resolves.toEqual({ vesselName: 'tooLong' });
    await expect(
      errorsOf(CreateAgencyRequestDto, {
        ...VALID,
        vesselName: 'ß'.repeat(41),
      }),
    ).resolves.toEqual({ vesselName: 'tooLong' });

    const dto = plainToInstance(CreateAgencyRequestDto, {
      ...VALID,
      vesselName: `  ${'ß'.repeat(40)}  `,
    });
    expect(dto.vesselName).toBe('SS'.repeat(40));
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('should reject emails that would inject into a mailto: link', async () => {
    for (const email of [
      'ops?cc=x%40evil.com@example.com',
      'ops&bcc=x@example.com',
      'ops#x@example.com',
      'ops/x@example.com',
      '"ops x"@example.com',
    ]) {
      await expect(
        errorsOf(CreateAgencyRequestDto, { ...VALID, email }),
      ).resolves.toEqual({ email: 'invalidEmail' });
    }
  });
});

describe('UpdateAgencyRequestDto', () => {
  it('should accept null to clear staffNote and vesselId', async () => {
    await expect(
      errorsOf(UpdateAgencyRequestDto, { staffNote: null, vesselId: null }),
    ).resolves.toEqual({});
  });

  it('should reject a null or unknown status and a malformed vesselId', async () => {
    await expect(
      errorsOf(UpdateAgencyRequestDto, { status: null, vesselId: 'abc' }),
    ).resolves.toEqual({ status: 'invalid', vesselId: 'invalid' });
    await expect(
      errorsOf(UpdateAgencyRequestDto, { status: 'closed' }),
    ).resolves.toEqual({ status: 'invalid' });
  });
});

describe('QueryAgencyRequestDto', () => {
  it('should only accept known statuses', async () => {
    await expect(
      errorsOf(QueryAgencyRequestDto, { status: 'quoted' }),
    ).resolves.toEqual({});
    await expect(
      errorsOf(QueryAgencyRequestDto, { status: 'all' }),
    ).resolves.toEqual({ status: 'invalid' });
  });
});
