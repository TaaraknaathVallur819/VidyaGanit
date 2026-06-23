import {
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per shop item a student has bought. The catalog (ids, prices, kind)
// lives in code on both client and server; this table only records ownership.
// Equipped selections live on the users row (equippedAvatar/equippedTheme).
export const purchasesTable = pgTable(
  "purchases",
  {
    id: serial("id").primaryKey(),
    vidyaId: text("vidya_id").notNull(),
    itemId: text("item_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("purchase_unique").on(t.vidyaId, t.itemId)],
);

export const insertPurchaseSchema = createInsertSchema(purchasesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchasesTable.$inferSelect;
