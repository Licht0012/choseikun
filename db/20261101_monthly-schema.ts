export const monthlySchemaStatements: string[] = [
  "CREATE TABLE IF NOT EXISTS monthly_events (\n event_id TEXT PRIMARY KEY REFERENCES events(id), target_month TEXT NOT NULL UNIQUE,\n created_month TEXT NOT NULL, holiday_csv TEXT NOT NULL, created_at TEXT NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS monthly_notifications (\n id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES monthly_events(event_id),\n kind TEXT NOT NULL CHECK(kind IN ('created','reminder','final','provisional')),\n payload TEXT NOT NULL, retry_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,\n first_attempt_at TEXT, lease_until TEXT, lease_owner TEXT, sent_at TEXT,\n attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT, blocked INTEGER NOT NULL DEFAULT 0,\n UNIQUE(event_id, kind)\n)",
  "CREATE TABLE IF NOT EXISTS monthly_errors (\n id TEXT PRIMARY KEY, event_id TEXT, kind TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS monthly_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS monthly_notifications_pending ON monthly_notifications(sent_at, blocked, next_attempt_at)"
];
