import postgres, { type Sql } from "postgres";
import { DATABASE_URL } from "../config";

let sqlInstance: Sql | null = null;

/**
 * Returns the singleton PostgreSQL client instance.
 * Initializes connection lazily on first access with SSL support.
 */
export function getDb(): Sql {
  if (!sqlInstance) {
    if (!DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set. Please configure Supabase PostgreSQL connection string."
      );
    }

    sqlInstance = postgres(DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: { rejectUnauthorized: false },
    });
  }

  return sqlInstance;
}

/**
 * Closes active database pool connections.
 */
export async function closeDb(): Promise<void> {
  if (sqlInstance) {
    await sqlInstance.end();
    sqlInstance = null;
  }
}
