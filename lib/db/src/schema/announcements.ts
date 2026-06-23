import {
  pgTable,
  serial,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A broadcast message a tutor sends to a batch. On creation the server fans the
// message out into one notification per student in the batch; this table keeps
// the canonical record for the tutor's own history view.
export const announcementsTable = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    tutorVidyaId: text("tutor_vidya_id").notNull(),
    batch: text("batch").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("announcements_tutor_idx").on(t.tutorVidyaId)],
);

export const insertAnnouncementSchema = createInsertSchema(
  announcementsTable,
).omit({ id: true, createdAt: true });
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcementsTable.$inferSelect;
