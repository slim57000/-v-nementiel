import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";

export const DATA_DIR = process.env.DATA_DIR || "./data";
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(`${DATA_DIR}/app.db`);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS organizers (
    id          INTEGER PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    login_code  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY,
    organizer_id  INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    slug          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    type          TEXT NOT NULL,
    date          TEXT NOT NULL,
    time          TEXT NOT NULL,
    location      TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    cover         TEXT,
    visibility    TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    access_code   TEXT NOT NULL,
    invite_style  TEXT NOT NULL DEFAULT 'classique',
    invite_json   TEXT NOT NULL DEFAULT '{}',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
