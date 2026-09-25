import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dbLogger } from "../utils/logger";
import { closeDb, getDb } from "./client";

/**
 * Runs SQL migration to create database tables in Supabase PostgreSQL.
 */
async function runMigration(): Promise<void> {
  dbLogger.info("Running database migration on Supabase PostgreSQL...");

  const sql = getDb();
  const schemaPath = join(import.meta.dir, "schema.sql");
  const schemaSql = readFileSync(schemaPath, "utf-8");

  try {
    await sql.unsafe(schemaSql);
    dbLogger.info("Database tables and indexes successfully created");
  } catch (err) {
    dbLogger.error({ err }, "Database migration failed");
    process.exit(1);
  } finally {
    await closeDb();
  }
}

runMigration();
