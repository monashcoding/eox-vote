import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

function getPool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure it."
    );
  }
  return new pg.Pool({ connectionString: url });
}

// Reuse the pool across dev HMR reloads
const globalForDb = globalThis as unknown as { __pgPool?: pg.Pool };

function pool(): pg.Pool {
  if (!globalForDb.__pgPool) {
    globalForDb.__pgPool = getPool();
  }
  return globalForDb.__pgPool;
}

export const db = drizzle({ client: pool(), schema });
