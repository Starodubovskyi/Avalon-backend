import { ApiProperty } from '@nestjs/swagger';

/** Compact author reference used by vessels, vessel events and documents. */
export class UserRef {
  @ApiProperty({ type: Number, example: 1 })
  id: number;

  @ApiProperty({ type: String, nullable: true, example: 'John' })
  firstName: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Doe' })
  lastName: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'john@example.com' })
  email: string | null;
}

export function toUserRef(
  raw:
    | {
        id: number;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
      }
    | null
    | undefined,
): UserRef | null {
  if (!raw) {
    return null;
  }
  const ref = new UserRef();
  ref.id = raw.id;
  ref.firstName = raw.firstName ?? null;
  ref.lastName = raw.lastName ?? null;
  ref.email = raw.email ?? null;
  return ref;
}
