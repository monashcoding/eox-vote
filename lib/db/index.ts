import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

function getPool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure it."
    );
  }
  return new pg.Pool({
    connectionString: url,
    max: poolMax(),
    // A request waiting for a free connection fails instead of hanging forever.
    connectionTimeoutMillis: 5000,
    // Postgres ends sessions that sit idle inside an open transaction (leaked locks).
    idle_in_transaction_session_timeout: 10_000,
  });
}

const DEFAULT_POOL_MAX = 10;

function poolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX;
  if (raw === undefined || raw === "") {
    return DEFAULT_POOL_MAX;
  }
  const max = Number(raw);
  if (!Number.isInteger(max) || max < 1) {
    throw new Error("DATABASE_POOL_MAX must be a positive integer.");
  }
  return max;
}

// Reuse the pool across dev HMR reloads
const globalForDb = globalThis as unknown as { __pgPool?: pg.Pool };

function pool(): pg.Pool {
  if (!globalForDb.__pgPool) {
    globalForDb.__pgPool = getPool();
  }
  return globalForDb.__pgPool;
}

type Db = NodePgDatabase<typeof schema> & { $client: pg.Pool };

let instance: Db | undefined;

/**
 * Created on first use, so importing this module (as `next build` does when
 * it collects route config) needs no DATABASE_URL and opens no connection.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    instance ??= drizzle({ client: pool(), schema });
    const value: unknown = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export type DbTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/** Runs reads on `db` or, inside a transaction, on its `tx` (never a second pool connection). */
export type DbReader = Pick<DbTransaction, "select">;
