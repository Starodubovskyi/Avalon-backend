import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterPortUnlocodeAndCountry1788523500000
  implements MigrationInterface
{
  name = 'AlterPortUnlocodeAndCountry1788523500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_port_unlocode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "port" ALTER COLUMN "country" TYPE character varying(64)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_port_unlocode" ON "port" ("unlocode") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_port_unlocode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "port" ALTER COLUMN "country" TYPE character varying(8)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_port_unlocode" ON "port" ("unlocode") `,
    );
  }
}
