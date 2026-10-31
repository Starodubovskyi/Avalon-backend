import { ValidateIf } from 'class-validator';

/**
 * Optional but not nullable: validate when the key is present, so null is
 * rejected by the field's other validators. Counterpart of `@IsOptional()`,
 * which also skips null (nullable optional field).
 */
export const IsPresent = (): PropertyDecorator =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);
