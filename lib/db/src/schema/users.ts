import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  vidyaId: text("vidya_id").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  gender: text("gender").notNull(),
  studentClass: text("student_class"),
  board: text("board"),
  parentType: text("parent_type"),
  contact: text("contact"),
  language: text("language"),
  xp: integer("xp").notNull().default(0),
  badges: text("badges").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
