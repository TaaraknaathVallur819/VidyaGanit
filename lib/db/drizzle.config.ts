import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// drizzle-kit ignores dbCredentials.ssl when a connection URL is supplied, so
// the SSL requirement has to travel in the URL itself. Render's managed
// Postgres presents a self-signed cert, hence no-verify rather than require.
const databaseUrl = process.env.DATABASE_URL + (process.env.DATABASE_URL.includes("?") ? "&" : "?") + "sslmode=no-verify";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    // Render Postgres requires SSL on external connections; without this
    // drizzle-kit dies at "Pulling schema from database..." with no message.
    ssl: { rejectUnauthorized: false },
  },
});
