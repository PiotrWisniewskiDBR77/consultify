-- P0 schemat-od-zera (dyżur agent/schemat-datetime): ai_user_tiers musi być
-- odtwarzalny z łańcucha migracji, nie tylko z runtime DDL w
-- aiSettingsService.ts (ensureUserTiersTable). Kolumny/PK odzwierciedlają
-- dokładnie kształt runtime; DATETIME -> TIMESTAMPTZ (patrz commit 5b5c0e3849,
-- email_verification_tokens — ten sam wzorzec).
CREATE TABLE IF NOT EXISTS ai_user_tiers (
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, user_id)
);
