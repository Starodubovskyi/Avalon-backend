import { ValidateBy, ValidationOptions } from 'class-validator';

/** class-transformer helper: trims strings, leaves other values untouched. */
export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
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
