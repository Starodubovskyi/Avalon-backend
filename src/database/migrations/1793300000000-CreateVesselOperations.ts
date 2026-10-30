import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVesselOperations1793300000000 implements MigrationInterface {
  name = 'CreateVesselOperations1793300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "role" ("id", "name") VALUES (3, 'Staff') ON CONFLICT ("id") DO NOTHING`,
    );

    await queryRunner.query(
      `CREATE TABLE "vessel" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "imo" character varying(7),
        "mmsi" character varying(9),
        "type" character varying(32) NOT NULL,
        "destination" character varying(32) NOT NULL,
        "condition" character varying(16),
        "masterName" character varying(120),
        "masterPhone" character varying(50),
        "masterEmail" character varying(255),
        "officeName" character varying(120),
        "officePhone" character varying(50),
        "officeEmail" character varying(255),
        "portAgent" character varying(255),
        "etaSulina" TIMESTAMP WITH TIME ZONE,
        "arrivedAt" TIMESTAMP WITH TIME ZONE,
        "inPortAt" TIMESTAMP WITH TIME ZONE,
        "departedAt" TIMESTAMP WITH TIME ZONE,
        "prearrivalsIn" character varying(8) NOT NULL DEFAULT 'not_ok',
        "prearrivalsOut" character varying(8) NOT NULL DEFAULT 'not_ok',
        "mswIn" boolean NOT NULL DEFAULT false,
        "mswOut" boolean NOT NULL DEFAULT false,
        "pdaSent" boolean NOT NULL DEFAULT false,
        "paid" boolean NOT NULL DEFAULT false,
        "t1" character varying(16),
        "pilotageArranged" boolean NOT NULL DEFAULT false,
        "pilot" character varying(255),
        "notes" text,
        "lat" double precision,
        "lng" double precision,
        "sog" double precision,
        "cog" double precision,
        "positionSource" character varying(8),
        "positionAt" TIMESTAMP WITH TIME ZONE,
        "createdById" integer,
        "updatedById" integer,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_vessel_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_vessel_imo_active" ON "vessel" ("imo") WHERE "imo" IS NOT NULL AND "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vessel_departedAt" ON "vessel" ("departedAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "vessel" ADD CONSTRAINT "FK_vessel_createdById" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vessel" ADD CONSTRAINT "FK_vessel_updatedById" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "vessel_event" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vesselId" uuid NOT NULL,
        "vesselName" character varying(120) NOT NULL,
        "userId" integer,
        "action" character varying(16) NOT NULL,
        "changes" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vessel_event_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vessel_event_vessel_createdAt" ON "vessel_event" ("vesselId", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vessel_event_createdAt" ON "vessel_event" ("createdAt" DESC)`,
    );
    await queryRunner.query(
      `ALTER TABLE "vessel_event" ADD CONSTRAINT "FK_vessel_event_vesselId" FOREIGN KEY ("vesselId") REFERENCES "vessel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vessel_event" ADD CONSTRAINT "FK_vessel_event_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "document" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255) NOT NULL,
        "category" character varying(32) NOT NULL,
        "vesselId" uuid,
        "storageKey" character varying(255) NOT NULL,
        "originalName" character varying(255) NOT NULL,
        "mimeType" character varying(127) NOT NULL,
        "size" integer NOT NULL,
        "notes" text,
        "uploadedById" integer,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_document_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_document_vesselId" ON "document" ("vesselId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_document_category" ON "document" ("category")`,
    );
    await queryRunner.query(
      `ALTER TABLE "document" ADD CONSTRAINT "FK_document_vesselId" FOREIGN KEY ("vesselId") REFERENCES "vessel"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document" ADD CONSTRAINT "FK_document_uploadedById" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document" DROP CONSTRAINT "FK_document_uploadedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document" DROP CONSTRAINT "FK_document_vesselId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_document_category"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_document_vesselId"`);
    await queryRunner.query(`DROP TABLE "document"`);

    await queryRunner.query(
      `ALTER TABLE "vessel_event" DROP CONSTRAINT "FK_vessel_event_userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vessel_event" DROP CONSTRAINT "FK_vessel_event_vesselId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_vessel_event_createdAt"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_vessel_event_vessel_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE "vessel_event"`);

    await queryRunner.query(
      `ALTER TABLE "vessel" DROP CONSTRAINT "FK_vessel_updatedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vessel" DROP CONSTRAINT "FK_vessel_createdById"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_vessel_departedAt"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_vessel_imo_active"`);
    await queryRunner.query(`DROP TABLE "vessel"`);

    // Keep the Staff role while any user still references it (FK on user.roleId).
    await queryRunner.query(
      `DELETE FROM "role" WHERE "id" = 3 AND NOT EXISTS (SELECT 1 FROM "user" WHERE "roleId" = 3)`,
    );
  }
}
