import { isEmail, ValidateBy, ValidationOptions } from 'class-validator';

/**
 * Characters that RFC 5322 allows in a local part but that change the meaning
 * of a `mailto:` link (`?cc=`, `&bcc=`, percent-encoding, fragments, paths)
 * or break it (whitespace).
 */
const MAILTO_UNSAFE_PATTERN = /[?&%#/\\\s]/;

export function isMailtoSafeEmail(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    !MAILTO_UNSAFE_PATTERN.test(value) &&
    isEmail(value)
  );
}

/**
 * An email address that can be put into a `mailto:` link as is. One
 * constraint → one error code: `invalidEmail`.
 */
export function IsMailtoSafeEmail(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isMailtoSafeEmail',
      validator: {
        validate: (value: unknown) => isMailtoSafeEmail(value),
        defaultMessage: () => 'invalidEmail',
      },
    },
    validationOptions,
  );
}
