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

    const isLocalhost =
      DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1");

    sqlInstance = postgres(DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
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
