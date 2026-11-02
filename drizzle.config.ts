import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile();
} catch {
  // .env may not exist (e.g. CI)
}

export default defineConfig({
  out: "./drizzle",
  schema: "./lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
