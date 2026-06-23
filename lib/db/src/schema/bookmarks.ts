import {
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A student-saved item to revisit. `kind` is "concept" (a Concept Library entry
// id) or "question" (a saved practice question). `payload` holds a small JSON
// snapshot so the saved item renders without re-deriving it.
export const bookmarksTable = pgTable(
  "bookmarks",
  {
    id: serial("id").primaryKey(),
    vidyaId: text("vidya_id").notNull(),
    kind: text("kind").notNull(),
    refId: text("ref_id").notNull(),
    label: text("label").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("bookmark_unique").on(t.vidyaId, t.kind, t.refId),
    index("bookmarks_vidya_idx").on(t.vidyaId),
  ],
);

export const insertBookmarkSchema = createInsertSchema(bookmarksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
export type Bookmark = typeof bookmarksTable.$inferSelect;
