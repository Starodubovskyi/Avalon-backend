import { MigrationInterface, QueryRunner } from 'typeorm';

/** More map point types for the agency map: agencies, terminals/berths and authorities */
export class ExtendMapPointKinds1793800000000 implements MigrationInterface {
  name = 'ExtendMapPointKinds1793800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "CHK_map_point_kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "CHK_map_point_kind" CHECK ("kind" IN ('company', 'agency', 'terminal', 'authority', 'person', 'employee'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "map_point" SET "kind" = 'company' WHERE "kind" IN ('agency', 'terminal', 'authority')`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "CHK_map_point_kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "CHK_map_point_kind" CHECK ("kind" IN ('company', 'person', 'employee'))`,
    );
  }
}
