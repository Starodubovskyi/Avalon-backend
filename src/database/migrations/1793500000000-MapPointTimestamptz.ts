import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * map_point dates were `timestamp` (no zone): values are written in UTC by now(),
 * but node-postgres reads them in the process zone, shifting them by the UTC offset.
 */
export class MapPointTimestamptz1793500000000 implements MigrationInterface {
  name = 'MapPointTimestamptz1793500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['createdAt', 'updatedAt', 'deletedAt']) {
      await queryRunner.query(
        `ALTER TABLE "map_point" ALTER COLUMN "${column}" TYPE TIMESTAMP WITH TIME ZONE USING "${column}" AT TIME ZONE 'UTC'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['createdAt', 'updatedAt', 'deletedAt']) {
      await queryRunner.query(
        `ALTER TABLE "map_point" ALTER COLUMN "${column}" TYPE TIMESTAMP WITHOUT TIME ZONE USING "${column}" AT TIME ZONE 'UTC'`,
      );
    }
  }
}
