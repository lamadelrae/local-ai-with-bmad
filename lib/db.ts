import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";

// AD-3: persistence is a single local SQLite file, owned directly by the
// Next.js server process. Migrations auto-apply on first access (module-level
// side effect) so `npm run dev` stays a one-command start — no separate
// `db:migrate` step (Consistency Conventions, NFR2).
const DB_PATH = path.join(process.cwd(), "data", "local-gemma-chat.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
// SQLite ignores FK constraints (incl. ON DELETE CASCADE) unless enabled per-connection.
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: path.join(process.cwd(), "db", "migrations") });
