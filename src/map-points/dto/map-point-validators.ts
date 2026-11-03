import { ValidateBy, ValidationOptions } from 'class-validator';
import { ACTIVITY_CODES } from '../map-point.constants';

const ACTIVITY_CODE_SET: ReadonlySet<string> = new Set(ACTIVITY_CODES);

/** class-transformer helper: drops repeated array items, keeps the order. */
export function uniqueItems({ value }: { value: unknown }): unknown {
  return Array.isArray(value) ? [...new Set<unknown>(value)] : value;
}

export function isActivityCodeList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (code) => typeof code === 'string' && ACTIVITY_CODE_SET.has(code),
    )
  );
}

/**
 * Array of Business Activity codes (any length: the free-plan limit is a
 * business rule checked by the service). One constraint → one error code:
 * `invalid` (not an array, or an unknown code).
 */
export function IsActivityCodes(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isActivityCodes',
      validator: {
        validate: (value: unknown) => isActivityCodeList(value),
        defaultMessage: () => 'invalid',
      },
    },
    validationOptions,
  );
}
