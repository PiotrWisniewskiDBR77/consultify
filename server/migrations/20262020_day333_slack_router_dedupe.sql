-- Day 333: make durable Slack deduplication part of fresh-database recovery.
-- Runtime keeps CREATE TABLE IF NOT EXISTS as a compatibility guard until a
-- separately licensed change can remove it after rollout across environments.
CREATE TABLE IF NOT EXISTS slack_router_dedupe (
  dedupe_key TEXT PRIMARY KEY,
  last_sent_at TIMESTAMPTZ
);

