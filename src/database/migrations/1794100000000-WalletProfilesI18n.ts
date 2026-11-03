import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Frozen copies of LOCALES / MAP_POINT_VISIBILITIES / WALLET_TRANSACTION_KINDS
 * / TOP_UP_REQUEST_STATUSES / COMPANY_MEMBER_STATUSES at this point in time
 * (docs/designs/2026-11-03-phase2-3-wallet-profiles-i18n.md).
 */
const LOCALES = `'en', 'ru', 'ro'`;
const VISIBILITIES = `'public', 'team'`;
const TRANSACTION_KINDS = `'top_up', 'activity_slot', 'rank_boost', 'refund', 'adjustment'`;
const TOP_UP_STATUSES = `'pending', 'approved', 'declined'`;
const MEMBER_STATUSES = `'pending', 'active'`;
const MAX_ACTIVITY_SLOTS = 14;

/**
 * Stage 2–3: profile fields and language of a user, client points
 * (visibility, description, website, parent company, paid Business Activity
 * slots, email verification), company members, the credits ledger, top-up
 * requests and RANK boosts. Timestamps are timestamptz(3) like the network
 * tables. Existing private persons become team-only points.
 */
export class WalletProfilesI18n1794100000000 implements MigrationInterface {
  name = 'WalletProfilesI18n1794100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user"
         ADD "headline" character varying(120),
         ADD "bio" text,
         ADD "phone" character varying(40),
         ADD "locale" character varying(5) NOT NULL DEFAULT 'en'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "CHK_user_bio" CHECK (char_length("bio") <= 1000)`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "CHK_user_locale" CHECK ("locale" IN (${LOCALES}))`,
    );

    await queryRunner.query(
      `ALTER TABLE "map_point"
         ADD "visibility" character varying(10) NOT NULL DEFAULT 'public',
         ADD "description" text,
         ADD "website" character varying(255),
         ADD "parentId" uuid,
         ADD "activitySlots" smallint NOT NULL DEFAULT 1,
         ADD "emailVerifiedAt" TIMESTAMP WITH TIME ZONE,
         ADD "emailVerificationSentAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "map_point" SET "visibility" = 'team' WHERE "kind" = 'private_person'`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "CHK_map_point_visibility" CHECK ("visibility" IN (${VISIBILITIES}))`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "CHK_map_point_description" CHECK (char_length("description") <= 2000)`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "CHK_map_point_parent_not_self" CHECK ("parentId" <> "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_map_point_parentId" ON "map_point" ("parentId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "FK_map_point_parentId" FOREIGN KEY ("parentId") REFERENCES "map_point"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    // Points that already have activities keep them: one slot per activity.
    await queryRunner.query(
      `UPDATE "map_point" SET "activitySlots" = LEAST(${MAX_ACTIVITY_SLOTS}, GREATEST(1, cardinality("activities")))`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "CHK_map_point_activitySlots" CHECK ("activitySlots" BETWEEN 1 AND ${MAX_ACTIVITY_SLOTS})`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "CHK_map_point_activities_slots" CHECK (cardinality("activities") <= "activitySlots")`,
    );

    await queryRunner.query(
      `CREATE TABLE "company_member" (
        "pointId" uuid NOT NULL,
        "userId" integer NOT NULL,
        "position" character varying(120),
        "status" character varying(10) NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_company_member_status" CHECK ("status" IN (${MEMBER_STATUSES})),
        CONSTRAINT "PK_company_member" PRIMARY KEY ("pointId", "userId")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_company_member_userId" ON "company_member" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_member" ADD CONSTRAINT "FK_company_member_pointId" FOREIGN KEY ("pointId") REFERENCES "map_point"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_member" ADD CONSTRAINT "FK_company_member_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "wallet_transaction" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" integer NOT NULL,
        "amount" integer NOT NULL,
        "kind" character varying(20) NOT NULL,
        "note" character varying(200),
        "pointId" uuid,
        "createdById" integer,
        "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        "seq" bigint GENERATED ALWAYS AS IDENTITY,
        CONSTRAINT "CHK_wallet_transaction_amount" CHECK ("amount" <> 0),
        CONSTRAINT "CHK_wallet_transaction_kind" CHECK ("kind" IN (${TRANSACTION_KINDS})),
        CONSTRAINT "PK_wallet_transaction_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_transaction_userId_createdAt" ON "wallet_transaction" ("userId", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transaction" ADD CONSTRAINT "FK_wallet_transaction_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transaction" ADD CONSTRAINT "FK_wallet_transaction_pointId" FOREIGN KEY ("pointId") REFERENCES "map_point"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transaction" ADD CONSTRAINT "FK_wallet_transaction_createdById" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "top_up_request" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" integer NOT NULL,
        "amount" integer NOT NULL,
        "note" character varying(300),
        "status" character varying(10) NOT NULL DEFAULT 'pending',
        "handledById" integer,
        "handledAt" TIMESTAMP(3) WITH TIME ZONE,
        "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_top_up_request_amount" CHECK ("amount" BETWEEN 1 AND 100000),
        CONSTRAINT "CHK_top_up_request_status" CHECK ("status" IN (${TOP_UP_STATUSES})),
        CONSTRAINT "PK_top_up_request_id" PRIMARY KEY ("id")
      )`,
    );
    // At most one pending request per user (422 pendingExists).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_top_up_request_pending" ON "top_up_request" ("userId") WHERE "status" = 'pending'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_top_up_request_status_createdAt" ON "top_up_request" ("status", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `ALTER TABLE "top_up_request" ADD CONSTRAINT "FK_top_up_request_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "top_up_request" ADD CONSTRAINT "FK_top_up_request_handledById" FOREIGN KEY ("handledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "rank_boost" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" integer NOT NULL,
        "points" integer NOT NULL,
        "expiresAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_rank_boost_points" CHECK ("points" > 0),
        CONSTRAINT "PK_rank_boost_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rank_boost_userId_expiresAt" ON "rank_boost" ("userId", "expiresAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "rank_boost" ADD CONSTRAINT "FK_rank_boost_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // DROP TABLE also drops the table's indexes, checks and foreign keys.
    await queryRunner.query(`DROP TABLE "rank_boost"`);
    await queryRunner.query(`DROP TABLE "top_up_request"`);
    await queryRunner.query(`DROP TABLE "wallet_transaction"`);
    await queryRunner.query(`DROP TABLE "company_member"`);

    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "CHK_map_point_activities_slots"`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "CHK_map_point_activitySlots"`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "FK_map_point_parentId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_map_point_parentId"`);
    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "CHK_map_point_parent_not_self"`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "CHK_map_point_description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "CHK_map_point_visibility"`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point"
         DROP COLUMN "emailVerificationSentAt",
         DROP COLUMN "emailVerifiedAt",
         DROP COLUMN "activitySlots",
         DROP COLUMN "parentId",
         DROP COLUMN "website",
         DROP COLUMN "description",
         DROP COLUMN "visibility"`,
    );

    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "CHK_user_locale"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "CHK_user_bio"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user"
         DROP COLUMN "locale",
         DROP COLUMN "phone",
         DROP COLUMN "bio",
         DROP COLUMN "headline"`,
    );
  }
}
