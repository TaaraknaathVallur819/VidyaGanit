import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Fixed-window rate-limit buckets, shared across server instances. The `key`
 * encodes the limiter prefix, the identity, and the window start so each window
 * is a distinct row that can be atomically upserted/incremented.
 */
export const rateLimitBucketsTable = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});
