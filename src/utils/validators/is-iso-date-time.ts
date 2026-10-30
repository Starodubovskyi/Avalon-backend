import { ValidateBy, ValidationOptions } from 'class-validator';

/**
 * Full date-time with an explicit offset (what Date#toISOString produces).
 * IsISO8601 also accepts week/ordinal/basic forms (2026-W44, 2026-303,
 * 20261030) that `new Date()` cannot parse.
 */
const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;

export function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = ISO_DATE_TIME_PATTERN.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) {
    return false;
  }
  // Date.parse rolls 2026-02-30 over to March; reject impossible calendar days.
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth;
}

export function IsIsoDateTime(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isIsoDateTime',
      validator: {
        validate: (value: unknown) => isIsoDateTime(value),
        defaultMessage: () => 'invalidDateTime',
      },
    },
    validationOptions,
  );
}
