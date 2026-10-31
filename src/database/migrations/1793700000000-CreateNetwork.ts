import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chat (conversation, conversation_member, message) and social feed (post,
 * post_like, post_comment, follow). Timestamps are timestamptz(3): the API
 * returns millisecond ISO strings, so polling cursors (`after`/`before`)
 * compare exactly against stored values.
 */
export class CreateNetwork1793700000000 implements MigrationInterface {
  name = 'CreateNetwork1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "conversation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kind" character varying(8) NOT NULL,
        "title" character varying(80),
        "createdById" integer,
        "directKey" character varying(32),
        "lastMessageAt" TIMESTAMP(3) WITH TIME ZONE,
        "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_conversation_kind" CHECK ("kind" IN ('direct', 'group')),
        CONSTRAINT "PK_conversation_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_conversation_directKey" ON "conversation" ("directKey") WHERE "directKey" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" ADD CONSTRAINT "FK_conversation_createdById" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "conversation_member" (
        "conversationId" uuid NOT NULL,
        "userId" integer NOT NULL,
        "lastReadAt" TIMESTAMP(3) WITH TIME ZONE,
        "joinedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation_member" PRIMARY KEY ("conversationId", "userId")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversation_member_userId" ON "conversation_member" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_member" ADD CONSTRAINT "FK_conversation_member_conversationId" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_member" ADD CONSTRAINT "FK_conversation_member_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "message" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "senderId" integer NOT NULL,
        "body" text NOT NULL,
        "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP(3) WITH TIME ZONE,
        CONSTRAINT "PK_message_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_message_conversation_createdAt" ON "message" ("conversationId", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "message" ADD CONSTRAINT "FK_message_conversationId" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "message" ADD CONSTRAINT "FK_message_senderId" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "post" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "authorId" integer NOT NULL,
        "body" text NOT NULL,
        "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP(3) WITH TIME ZONE,
        CONSTRAINT "PK_post_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_createdAt" ON "post" ("createdAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_author_createdAt" ON "post" ("authorId", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD CONSTRAINT "FK_post_authorId" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "post_like" (
        "postId" uuid NOT NULL,
        "userId" integer NOT NULL,
        "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_like" PRIMARY KEY ("postId", "userId")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_like" ADD CONSTRAINT "FK_post_like_postId" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_like" ADD CONSTRAINT "FK_post_like_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "post_comment" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "postId" uuid NOT NULL,
        "authorId" integer NOT NULL,
        "body" text NOT NULL,
        "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP(3) WITH TIME ZONE,
        CONSTRAINT "PK_post_comment_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_comment_post_createdAt" ON "post_comment" ("postId", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_comment" ADD CONSTRAINT "FK_post_comment_postId" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_comment" ADD CONSTRAINT "FK_post_comment_authorId" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "follow" (
        "followerId" integer NOT NULL,
        "followeeId" integer NOT NULL,
        "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_follow_not_self" CHECK ("followerId" <> "followeeId"),
        CONSTRAINT "PK_follow" PRIMARY KEY ("followerId", "followeeId")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_follow_followeeId" ON "follow" ("followeeId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "follow" ADD CONSTRAINT "FK_follow_followerId" FOREIGN KEY ("followerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "follow" ADD CONSTRAINT "FK_follow_followeeId" FOREIGN KEY ("followeeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // DROP TABLE also drops the table's indexes, checks and foreign keys.
    await queryRunner.query(`DROP TABLE "follow"`);
    await queryRunner.query(`DROP TABLE "post_comment"`);
    await queryRunner.query(`DROP TABLE "post_like"`);
    await queryRunner.query(`DROP TABLE "post"`);
    await queryRunner.query(`DROP TABLE "message"`);
    await queryRunner.query(`DROP TABLE "conversation_member"`);
    await queryRunner.query(`DROP TABLE "conversation"`);
  }
}
