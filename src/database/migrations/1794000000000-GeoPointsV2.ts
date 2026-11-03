import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Frozen copies of MAP_POINT_KINDS / ACTIVITY_CODES / ACTIVITY_LABELS at this
 * point in time (docs/designs/2026-11-03-geopoints-v2-and-brand.md).
 */
const NEW_KINDS = `'head_office', 'branch', 'self_employed', 'for_sale', 'authority', 'private_person'`;
const OLD_KINDS = `'company', 'agency', 'terminal', 'authority', 'person', 'employee'`;

const ACTIVITIES: ReadonlyArray<readonly [code: string, label: string]> = [
  ['ship_agency', 'Ship agency'],
  ['ship_supply', 'Ship supply, ship chandler'],
  ['ship_operation', 'Ship operation'],
  ['ship_management', 'Ship management'],
  ['crewing', 'Crew management / crewing'],
  ['ship_repair', 'Ship repair'],
  ['shipowners', 'Shipowners'],
  ['bunker_supply', 'Bunker and oil supply'],
  ['ship_charterers', 'Ship charterers'],
  ['ship_brokers', 'Ship brokers'],
  ['cargo_brokers', 'Cargo brokers'],
  ['cargo_charterers', 'Cargo charterers'],
  ['cargo_shippers', 'Cargo shippers'],
  ['commodity_trading', 'Commodity trading'],
];
const ACTIVITY_CODES_SQL = ACTIVITIES.map(([code]) => `'${code}'`).join(', ');
const LOGO_MAX_LENGTH = 150000;

/**
 * Geo points v2: six point kinds (old kinds mapped), Business Activity codes
 * (`activities`, seeded from the legacy free-text `activity` when it equals a
 * label, case-insensitive), a logo data URL, per-user favorites and an index
 * for the per-author comment count of the user Rank. The legacy `activity`, `notes` and `isFavorite` columns are left as they are.
 */
export class GeoPointsV21794000000000 implements MigrationInterface {
  name = 'GeoPointsV21794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "CHK_map_point_kind"`,
    );
    await queryRunner.query(
      `UPDATE "map_point" SET "kind" = CASE "kind"
         WHEN 'company' THEN 'head_office'
         WHEN 'agency' THEN 'head_office'
         WHEN 'terminal' THEN 'branch'
         WHEN 'person' THEN 'private_person'
         WHEN 'employee' THEN 'private_person'
         ELSE "kind" END`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ALTER COLUMN "kind" SET DEFAULT 'private_person'`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "CHK_map_point_kind" CHECK ("kind" IN (${NEW_KINDS}))`,
    );

    await queryRunner.query(
      `ALTER TABLE "map_point" ADD "activities" text[] NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `UPDATE "map_point" mp SET "activities" = ARRAY[a."code"]
       FROM unnest($1::text[], $2::text[]) AS a("code", "label")
       WHERE lower(btrim(mp."activity")) = lower(a."label")`,
      [ACTIVITIES.map(([code]) => code), ACTIVITIES.map(([, label]) => label)],
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "CHK_map_point_activities" CHECK ("activities" <@ ARRAY[${ACTIVITY_CODES_SQL}]::text[])`,
    );

    await queryRunner.query(`ALTER TABLE "map_point" ADD "logo" text`);
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "CHK_map_point_logo" CHECK ("logo" IS NULL OR ("logo" LIKE 'data:image/%' AND char_length("logo") <= ${LOGO_MAX_LENGTH}))`,
    );

    await queryRunner.query(
      `CREATE TABLE "map_point_favorite" (
        "userId" integer NOT NULL,
        "pointId" uuid NOT NULL,
        "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_map_point_favorite" PRIMARY KEY ("userId", "pointId")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_map_point_favorite_pointId" ON "map_point_favorite" ("pointId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point_favorite" ADD CONSTRAINT "FK_map_point_favorite_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point_favorite" ADD CONSTRAINT "FK_map_point_favorite_pointId" FOREIGN KEY ("pointId") REFERENCES "map_point"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // The user Rank counts comments per author.
    await queryRunner.query(
      `CREATE INDEX "IDX_post_comment_authorId" ON "post_comment" ("authorId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_post_comment_authorId"`);

    // DROP TABLE also drops the table's index and foreign keys.
    await queryRunner.query(`DROP TABLE "map_point_favorite"`);

    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "CHK_map_point_logo"`,
    );
    await queryRunner.query(`ALTER TABLE "map_point" DROP COLUMN "logo"`);

    // Points created after up() only have codes: keep a readable legacy text.
    await queryRunner.query(
      `UPDATE "map_point" mp SET "activity" = a."label"
       FROM unnest($1::text[], $2::text[]) AS a("code", "label")
       WHERE mp."activity" = '' AND mp."activities"[1] = a."code"`,
      [ACTIVITIES.map(([code]) => code), ACTIVITIES.map(([, label]) => label)],
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "CHK_map_point_activities"`,
    );
    await queryRunner.query(`ALTER TABLE "map_point" DROP COLUMN "activities"`);

    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "CHK_map_point_kind"`,
    );
    await queryRunner.query(
      `UPDATE "map_point" SET "kind" = CASE "kind"
         WHEN 'head_office' THEN 'company'
         WHEN 'branch' THEN 'terminal'
         WHEN 'self_employed' THEN 'company'
         WHEN 'for_sale' THEN 'company'
         WHEN 'private_person' THEN 'person'
         ELSE "kind" END`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ALTER COLUMN "kind" SET DEFAULT 'person'`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "CHK_map_point_kind" CHECK ("kind" IN (${OLD_KINDS}))`,
    );
  }
}
