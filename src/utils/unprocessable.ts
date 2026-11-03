import { HttpStatus, UnprocessableEntityException } from '@nestjs/common';

/** 422 in the boilerplate format: `{ status: 422, errors: { [field]: code } }`. */
export function unprocessable(
  field: string,
  code: string,
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    errors: { [field]: code },
  });
}
