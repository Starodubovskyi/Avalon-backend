import { ValidateBy, ValidationOptions } from 'class-validator';

/** class-transformer helper: trims strings, leaves other values untouched. */
export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * class-transformer helper for nullable text: trims strings; a blank string
 * means "clear the value" (null). Other values are left untouched.
 */
export function trimToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function isBodyText(value: unknown, maxLength: number): boolean {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= maxLength
  );
}

/**
 * Required free text (message, post, comment) of 1..maxLength characters,
 * checked after `@Transform(trimString)`. One constraint → one error code:
 * `empty` (missing, blank or not a string) or `tooLong`.
 */
export function IsBodyText(
  maxLength: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isBodyText',
      constraints: [maxLength],
      validator: {
        validate: (value: unknown) => isBodyText(value, maxLength),
        defaultMessage: (args) =>
          typeof args?.value === 'string' && args.value.length > 0
            ? 'tooLong'
            : 'empty',
      },
    },
    validationOptions,
  );
}
