import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db, pool } from "./src/index";

// Generate the narrow migration from the maintained Drizzle schema. Refuse
// unrelated or destructive statements rather than forcing a full schema push.
try {
  const source = readFileSync(
    new URL(
      "./migrations/20261013_registration_and_chat_images.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const statements = source
    .replace(/^--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  const allowed = [
    /^ALTER TABLE "chat_messages" ADD COLUMN "image_url" text$/,
    /^ALTER TABLE "chat_messages" ADD COLUMN "image_alt" text$/,
    /^ALTER TABLE "users" ADD CONSTRAINT "users_name_unique" UNIQUE\("name"\)$/,
  ];
  if (
    statements.length !== 3 ||
    statements.some(
      (statement) => !allowed.some((pattern) => pattern.test(statement)),
    )
  ) {
    throw new Error("Unexpected migration statement; no changes applied");
  }
  const columns = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_messages' AND column_name IN ('image_url','image_alt')`,
  );
  const constraint = await db.execute(
    sql`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='users_name_unique' AND conrelid='public.users'::regclass`,
  );
  if (
    constraint.rows.length &&
    constraint.rows[0].definition !== "UNIQUE (name)"
  )
    throw new Error("Unexpected username constraint definition");
  const pending = statements.filter((statement) => {
    if (statement.includes('"image_url"'))
      return !columns.rows.some((column) => column.column_name === "image_url");
    if (statement.includes('"image_alt"'))
      return !columns.rows.some((column) => column.column_name === "image_alt");
    return !constraint.rows.length;
  });
  console.log(
    pending.length
      ? pending.map((statement) => statement + ";").join("\n")
      : "Schema already up to date.",
  );
  if (process.argv.includes("--apply") && pending.length) {
    await db.transaction(async (transaction) => {
      await transaction.execute(sql`SET LOCAL lock_timeout = '5s'`);
      await transaction.execute(sql`SET LOCAL statement_timeout = '30s'`);
      for (const statement of pending)
        await transaction.execute(sql.raw(statement));
    });
    console.log("Additive migration applied without modifying existing rows.");
  }
} finally {
  await pool.end();
}
