import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reference rows the app relies on (RoleEnum, StatusEnum). Production never
 * runs the seed script, so registration on an empty DB needs them here.
 * Idempotent: rows created earlier by the seed script are left untouched.
 */
export class SeedRolesAndStatuses1793600000000 implements MigrationInterface {
  name = 'SeedRolesAndStatuses1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "role" ("id", "name") VALUES (1, 'Admin'), (2, 'User'), (3, 'Staff') ON CONFLICT ("id") DO NOTHING`,
    );
    await queryRunner.query(
      `INSERT INTO "status" ("id", "name") VALUES (1, 'Active'), (2, 'Inactive') ON CONFLICT ("id") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Role 3 belongs to CreateVesselOperations; rows still referenced by users stay.
    await queryRunner.query(
      `DELETE FROM "role" WHERE "id" IN (1, 2) AND NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."roleId" = "role"."id")`,
    );
    await queryRunner.query(
      `DELETE FROM "status" WHERE "id" IN (1, 2) AND NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."statusId" = "status"."id")`,
    );
  }
}
