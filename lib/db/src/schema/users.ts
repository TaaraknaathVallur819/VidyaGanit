import { pgTable, text, serial, timestamp, integer, real, date } from "drizzle-orm/pg-core";
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
  batch: text("batch"),
  // Tutors can teach several batches. `batch` (above) is kept for back-compat and
  // mirrors the first entry of this list; `batches` is the authoritative list.
  batches: text("batches").array(),
  academyName: text("academy_name"),
  // The academy branch / centre location a tutor belongs to (e.g. "Andheri West").
  // Captured at tutor registration; null for parents/students.
  branch: text("branch"),
  // Free-text "About me" personal context the user shares so the AI (tutor for
  // students, Strategy/Coach AI for parents/tutors) can personalise its replies.
  aboutMe: text("about_me"),
  language: text("language"),
  // Read-aloud voice preferences for the AI tutor/counselor speech synthesis.
  // rate = speaking pace, pitch = tone, voiceName = the chosen system voice
  // (accent/gender) the browser should prefer for this user's language.
  voiceRate: real("voice_rate").notNull().default(1),
  voicePitch: real("voice_pitch").notNull().default(1),
  voiceName: text("voice_name"),
  xp: integer("xp").notNull().default(0),
  // Spendable currency earned alongside XP; spent in the reward shop on
  // avatars/themes. Mirrors XP gains 1:1 but is decremented on purchase.
  coins: integer("coins").notNull().default(0),
  // Currently equipped cosmetic item ids from the shop catalog (null = default).
  equippedAvatar: text("equipped_avatar"),
  equippedTheme: text("equipped_theme"),
  badges: text("badges").array().notNull().default(sql`ARRAY[]::text[]`),
  // Daily practice streak: consecutive calendar days with at least one tutoring
  // interaction. `lastActiveDate` is the last calendar day the student practised
  // (YYYY-MM-DD); `dailyGoal` is the student's target questions-per-day.
  streakCurrent: integer("streak_current").notNull().default(0),
  streakLongest: integer("streak_longest").notNull().default(0),
  lastActiveDate: date("last_active_date", { mode: "string" }),
  dailyGoal: integer("daily_goal").notNull().default(3),
  resetTokenHash: text("reset_token_hash"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
