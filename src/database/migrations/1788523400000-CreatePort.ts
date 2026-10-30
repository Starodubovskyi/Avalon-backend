import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePort1788523400000 implements MigrationInterface {
  name = 'CreatePort1788523400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "port" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "unlocode" character varying(5) NOT NULL, "country" character varying(8), "status" character varying(16) NOT NULL DEFAULT 'OPEN', "timezone" character varying(64) NOT NULL DEFAULT 'UTC', "lat" double precision, "lng" double precision, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_port_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_port_unlocode" ON "port" ("unlocode") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_port_country" ON "port" ("country") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_port_status" ON "port" ("status") `,
    );
    await queryRunner.query(`
      INSERT INTO "port" ("name", "unlocode", "country", "status", "timezone", "lat", "lng")
      VALUES
        ('Constanța', 'ROCND', 'RO', 'OPEN', 'Europe/Bucharest', 44.1598, 28.6348),
        ('Odesa', 'UAODS', 'UA', 'OPEN', 'Europe/Kyiv', 46.4825, 30.7233),
        ('Istanbul', 'TRIST', 'TR', 'OPEN', 'Europe/Istanbul', 41.0082, 28.9784),
        ('Rotterdam', 'NLRTM', 'NL', 'OPEN', 'Europe/Amsterdam', 51.9244, 4.4777),
        ('Singapore', 'SGSIN', 'SG', 'OPEN', 'Asia/Singapore', 1.3521, 103.8198),
        ('New York', 'USNYC', 'US', 'OPEN', 'America/New_York', 40.7128, -74.006),
        ('Galați', 'ROGAL', 'RO', 'OPEN', 'Europe/Bucharest', 45.4233, 28.0425),
        ('Izmail', 'UAIZM', 'UA', 'OPEN', 'Europe/Kyiv', 45.351, 28.836)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_port_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_port_country"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_port_unlocode"`);
    await queryRunner.query(`DROP TABLE "port"`);
  }
}
