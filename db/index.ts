import { env } from "cloudflare:workers";

export interface AppBindings {
  DB: D1Database;
  ACCESS_PEPPER?: string;
  LINE_CHANNEL_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  REMINDER_CRON_SECRET?: string;
  PUBLIC_BASE_URL?: string;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    memo TEXT NOT NULL DEFAULT '',
    deadline_date TEXT NOT NULL,
    admin_token_hash TEXT NOT NULL UNIQUE,
    line_group_id TEXT,
    line_group_name TEXT,
    line_link_code_hash TEXT,
    line_link_expires_at TEXT,
    reminder_enabled INTEGER NOT NULL DEFAULT 1,
    reminder_sent_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS candidate_dates (
    id TEXT PRIMARY KEY NOT NULL,
    event_id TEXT NOT NULL,
    date TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE(event_id, date)
  )`,
  `CREATE TABLE IF NOT EXISTS time_options (
    id TEXT PRIMARY KEY NOT NULL,
    event_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE(event_id, start_time, end_time)
  )`,
  `CREATE TABLE IF NOT EXISTS slots (
    id TEXT PRIMARY KEY NOT NULL,
    event_id TEXT NOT NULL,
    candidate_date_id TEXT NOT NULL,
    time_option_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_date_id) REFERENCES candidate_dates(id) ON DELETE CASCADE,
    FOREIGN KEY (time_option_id) REFERENCES time_options(id) ON DELETE CASCADE,
    UNIQUE(event_id, candidate_date_id, time_option_id)
  )`,
  `CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY NOT NULL,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    edit_token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS availability (
    response_id TEXT NOT NULL,
    slot_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('yes', 'maybe', 'no')),
    FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
    FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE,
    UNIQUE(response_id, slot_id)
  )`,
  "CREATE INDEX IF NOT EXISTS events_deadline_idx ON events(deadline_date)",
  "CREATE INDEX IF NOT EXISTS candidate_dates_event_idx ON candidate_dates(event_id)",
  "CREATE INDEX IF NOT EXISTS time_options_event_idx ON time_options(event_id)",
  "CREATE INDEX IF NOT EXISTS slots_event_idx ON slots(event_id)",
  "CREATE INDEX IF NOT EXISTS responses_event_idx ON responses(event_id)",
  "CREATE INDEX IF NOT EXISTS availability_slot_idx ON availability(slot_id)",
];

let schemaReady: Promise<void> | null = null;

export function getBindings(): AppBindings {
  return env as unknown as AppBindings;
}

export async function getDb(): Promise<D1Database> {
  const bindings = getBindings();
  if (!bindings.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  if (!schemaReady) {
    schemaReady = bindings.DB
      .batch(schemaStatements.map((statement) => bindings.DB.prepare(statement)))
      .then(() => undefined)
      .catch((error: unknown) => {
        schemaReady = null;
        throw error;
      });
  }
  await schemaReady;
  return bindings.DB;
}
