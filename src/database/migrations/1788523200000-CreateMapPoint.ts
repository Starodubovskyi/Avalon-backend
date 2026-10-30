import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMapPoint1788523200000 implements MigrationInterface {
  name = 'CreateMapPoint1788523200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "map_point" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" integer NOT NULL, "lat" double precision NOT NULL, "lng" double precision NOT NULL, "firstName" character varying(255) NOT NULL, "lastName" character varying(255) NOT NULL DEFAULT '', "activity" character varying(255) NOT NULL DEFAULT '', "phone" character varying(50), "email" character varying(255), "address" character varying(500), "photoId" uuid, "isFavorite" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_map_point_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_map_point_userId" ON "map_point" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_map_point_userId_createdAt" ON "map_point" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "FK_map_point_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" ADD CONSTRAINT "FK_map_point_photoId" FOREIGN KEY ("photoId") REFERENCES "file"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "FK_map_point_photoId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_point" DROP CONSTRAINT "FK_map_point_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_map_point_userId_createdAt"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_map_point_userId"`);
    await queryRunner.query(`DROP TABLE "map_point"`);
  }
}
