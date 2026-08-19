-- SET-MVP-MFA: tenant-bound, hash-at-rest login challenges and trusted devices.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION settings_try_timestamptz(value text)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF NULLIF(BTRIM(value), '') IS NULL THEN RETURN NULL; END IF;
  RETURN value::timestamptz;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

ALTER TABLE user_mfa
  ADD COLUMN IF NOT EXISTS factor_generation integer NOT NULL DEFAULT 1;

ALTER TABLE trusted_devices
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS credential_hash text,
  ADD COLUMN IF NOT EXISTS factor_generation integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT NOW();

ALTER TABLE trusted_devices
  ALTER COLUMN expires_at TYPE timestamptz USING settings_try_timestamptz(expires_at::text),
  ALTER COLUMN last_used_at TYPE timestamptz USING settings_try_timestamptz(last_used_at::text),
  ALTER COLUMN created_at TYPE timestamptz USING settings_try_timestamptz(created_at::text);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'trusted_devices'
       AND column_name = 'last_used'
  ) THEN
    EXECUTE 'UPDATE trusted_devices SET last_used_at = COALESCE(last_used_at, settings_try_timestamptz(last_used::text)) WHERE last_used IS NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'trusted_devices'
       AND column_name = 'trusted_at'
  ) THEN
    EXECUTE 'UPDATE trusted_devices SET created_at = COALESCE(created_at, settings_try_timestamptz(trusted_at::text)) WHERE trusted_at IS NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'trusted_devices'
       AND column_name = 'device_fingerprint'
  ) THEN
    EXECUTE $sql$UPDATE trusted_devices
                SET credential_hash = COALESCE(credential_hash, encode(digest(device_fingerprint, 'sha256'), 'hex'))
              WHERE device_fingerprint IS NOT NULL AND device_fingerprint <> ''$sql$;
    ALTER TABLE trusted_devices ALTER COLUMN device_fingerprint DROP NOT NULL;
    EXECUTE 'UPDATE trusted_devices SET device_fingerprint = NULL WHERE credential_hash IS NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'trusted_devices'
       AND column_name = 'fingerprint'
  ) THEN
    EXECUTE $sql$UPDATE trusted_devices
                SET credential_hash = COALESCE(credential_hash, encode(digest(fingerprint, 'sha256'), 'hex'))
              WHERE fingerprint IS NOT NULL AND fingerprint <> ''$sql$;
    ALTER TABLE trusted_devices ALTER COLUMN fingerprint DROP NOT NULL;
    EXECUTE 'UPDATE trusted_devices SET fingerprint = NULL WHERE credential_hash IS NOT NULL';
  END IF;
END $$;

UPDATE trusted_devices td
   SET organization_id = u.organization_id,
       factor_generation = COALESCE(m.factor_generation, 1),
       last_used_at = COALESCE(td.last_used_at, NOW()),
       expires_at = COALESCE(td.expires_at, NOW() + INTERVAL '30 days')
  FROM users u
  LEFT JOIN user_mfa m ON m.user_id = u.id
 WHERE td.user_id = u.id
   AND td.organization_id IS NULL;

UPDATE trusted_devices
   SET last_used_at = COALESCE(last_used_at, NOW()),
       expires_at = COALESCE(expires_at, NOW() + INTERVAL '30 days'),
       created_at = COALESCE(created_at, NOW())
 WHERE last_used_at IS NULL OR expires_at IS NULL OR created_at IS NULL;

DELETE FROM trusted_devices WHERE organization_id IS NULL OR credential_hash IS NULL;
DELETE FROM trusted_devices td
 WHERE NOT EXISTS (
   SELECT 1 FROM user_mfa m
   JOIN users u ON u.id = m.user_id
    WHERE m.user_id = td.user_id AND u.organization_id = td.organization_id
      AND m.enabled = true
      AND m.factor_generation = td.factor_generation
 );
ALTER TABLE trusted_devices ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE trusted_devices ALTER COLUMN credential_hash SET NOT NULL;
ALTER TABLE trusted_devices ALTER COLUMN expires_at SET NOT NULL;

DELETE FROM trusted_devices stale
 USING trusted_devices keep
 WHERE stale.organization_id = keep.organization_id
   AND stale.user_id = keep.user_id
   AND stale.credential_hash = keep.credential_hash
   AND (stale.expires_at, stale.created_at, stale.id) <
       (keep.expires_at, keep.created_at, keep.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trusted_devices_org_user_credential
  ON trusted_devices(organization_id, user_id, credential_hash);

CREATE TABLE IF NOT EXISTS mfa_login_challenges (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  challenge_hash text NOT NULL UNIQUE,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  factor_generation integer NOT NULL,
  client_digest text NOT NULL,
  attempts_remaining integer NOT NULL DEFAULT 5 CHECK (attempts_remaining >= 0),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_login_challenges_user_active
  ON mfa_login_challenges(organization_id, user_id, expires_at)
  WHERE consumed_at IS NULL;

CREATE OR REPLACE FUNCTION revoke_mfa_credentials_on_generation_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.factor_generation IS DISTINCT FROM OLD.factor_generation THEN
    DELETE FROM trusted_devices WHERE user_id = NEW.user_id;
    DELETE FROM mfa_login_challenges WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_user_mfa_revoke_generation ON user_mfa;
CREATE TRIGGER trg_user_mfa_revoke_generation
AFTER INSERT OR UPDATE OF factor_generation ON user_mfa
FOR EACH ROW EXECUTE FUNCTION revoke_mfa_credentials_on_generation_change();
