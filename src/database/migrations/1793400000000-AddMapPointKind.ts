import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMapPointKind1793400000000 implements MigrationInterface {
  name = 'AddMapPointKind1793400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD "kind" character varying(16) NOT NULL DEFAULT 'person'`,
    );
    await queryRunner.query(`ALTER TABLE "map_point" ADD "notes" text`);
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "CHK_map_point_kind" CHECK ("kind" IN ('company', 'person', 'employee'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_map_point_kind" ON "map_point" ("kind")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_map_point_kind"`);
    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "CHK_map_point_kind"`,
    );
    await queryRunner.query(`ALTER TABLE "map_point" DROP COLUMN "notes"`);
    await queryRunner.query(`ALTER TABLE "map_point" DROP COLUMN "kind"`);
  }
}
