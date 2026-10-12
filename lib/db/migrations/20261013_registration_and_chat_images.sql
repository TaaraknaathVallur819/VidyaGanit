-- Additive statements generated from Drizzle and tested on a Neon branch.
ALTER TABLE "chat_messages" ADD COLUMN "image_url" text;
ALTER TABLE "chat_messages" ADD COLUMN "image_alt" text;
ALTER TABLE "users" ADD CONSTRAINT "users_name_unique" UNIQUE("name");
