import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agency requests sent by clients (viewers) and handled by the team.
 * Timestamps are timestamptz(3), like the network tables: the API returns
 * millisecond ISO strings. The CHECK lists are frozen copies of
 * VESSEL_TYPES / DESTINATIONS / AGENCY_REQUEST_STATUSES at this point in time.
 */
export class CreateAgencyRequest1793900000000 implements MigrationInterface {
  name = 'CreateAgencyRequest1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agency_request" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdById" integer,
        "company" character varying(120) NOT NULL,
        "contactName" character varying(120) NOT NULL,
        "email" character varying(160) NOT NULL,
        "phone" character varying(40),
        "vesselName" character varying(80) NOT NULL,
        "imo" character varying(7),
        "vesselType" character varying(20) NOT NULL,
        "destination" character varying(20) NOT NULL,
        "eta" TIMESTAMP(3) WITH TIME ZONE,
        "cargo" character varying(160),
        "notes" text,
        "status" character varying(12) NOT NULL DEFAULT 'new',
        "staffNote" text,
        "vesselId" uuid,
        "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_agency_request_vesselType" CHECK ("vesselType" IN ('general_cargo', 'tanker', 'livestock')),
        CONSTRAINT "CHK_agency_request_destination" CHECK ("destination" IN ('IZMAIL', 'RENI', 'ORLIVKA', 'GIURGIULESTI', 'GALATI', 'BRAILA', 'TULCEA')),
        CONSTRAINT "CHK_agency_request_status" CHECK ("status" IN ('new', 'quoted', 'accepted', 'declined')),
        CONSTRAINT "PK_agency_request_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agency_request_status_createdAt" ON "agency_request" ("status", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agency_request_createdById_createdAt" ON "agency_request" ("createdById", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `ALTER TABLE "agency_request" ADD CONSTRAINT "FK_agency_request_createdById" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agency_request" ADD CONSTRAINT "FK_agency_request_vesselId" FOREIGN KEY ("vesselId") REFERENCES "vessel"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // DROP TABLE also drops the table's indexes, checks and foreign keys.
    await queryRunner.query(`DROP TABLE "agency_request"`);
  }
}
