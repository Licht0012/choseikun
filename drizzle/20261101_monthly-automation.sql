-- Additive migration; existing events and responses are preserved.
CREATE TABLE IF NOT EXISTS monthly_events (
 event_id TEXT PRIMARY KEY REFERENCES events(id), target_month TEXT NOT NULL UNIQUE,
 created_month TEXT NOT NULL, holiday_csv TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS monthly_notifications (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES monthly_events(event_id),
 kind TEXT NOT NULL CHECK(kind IN ('created','reminder','final','provisional')),
 payload TEXT NOT NULL, retry_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,
 first_attempt_at TEXT, lease_until TEXT, lease_owner TEXT, sent_at TEXT,
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT, blocked INTEGER NOT NULL DEFAULT 0,
 UNIQUE(event_id, kind)
);
CREATE TABLE IF NOT EXISTS monthly_errors (
 id TEXT PRIMARY KEY, event_id TEXT, kind TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS monthly_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS monthly_notifications_pending ON monthly_notifications(sent_at, blocked, next_attempt_at);
