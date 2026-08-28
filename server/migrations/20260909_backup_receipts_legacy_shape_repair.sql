-- DATA-DR-001 forward repair: dostosuj ZASTANE backup_source_change_clock /
-- backup_run_receipts / backup_restore_receipts do kontraktu, ktorego wymaga
-- 20260909_data_dr_backup_health.sql (biegnie zaraz po tej migracji —
-- klucz sortowania 20260909_20260909_backup_... < 20260909_20260909_data_dr_...).
--
-- POWÓD (ta sama klasa awarii co 957/partner_referral_clicks):
-- te trzy tabele maja DWOCH producentow o roznym ksztalcie —
--   kanon: 20260909_data_dr_backup_health.sql (BIGINT, TIMESTAMPTZ, nazwane CHECK-i),
--   leniwe DDL runtime: server/src/services/backupService.ts:249/262/273
--   (INTEGER, TIMESTAMP bez strefy, zero CHECK-ow, wlasny UNIQUE zamiast indeksu).
-- Gdy runtime byl pierwszy, 20260909 odmawia:
--   "backup_source_change_clock column contract is incompatible"
-- i blokuje release dokladnie tak samo jak 957.
--
-- GWARANCJE: idempotentna · zero DELETE/DROP TABLE/DROP COLUMN · na swiezej
-- bazie i na bazie juz kanonicznej = no-op · przypadki wymagajace zgadywania
-- (nieznane dodatkowe kolumny/CHECK-i, wiersze lamiace kontrakt) przerywaja
-- z konkretnym komunikatem zamiast po cichu przerabiac dane.
--
-- KONWERSJA CZASU: kolumny TIMESTAMP (bez strefy) czytamy jako UTC
-- (AT TIME ZONE 'UTC'), bo runtime pisal do nich CURRENT_TIMESTAMP na
-- kontenerze Postgresa dzialajacym w UTC. Jawnie, zeby konwersja nie zalezala
-- od TimeZone sesji, ktora akurat uruchomi migracje.

DO $$
DECLARE col_count INTEGER; check_count INTEGER; pk_name TEXT; row_count BIGINT;
BEGIN
  IF to_regclass('public.backup_source_change_clock') IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO col_count FROM information_schema.columns
   WHERE table_schema='public' AND table_name='backup_source_change_clock';
  IF col_count <> 3 THEN
    RAISE EXCEPTION 'backup_source_change_clock ma % kolumn zamiast 3 — ksztalt nieznany, nie naprawiam automatem.', col_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='backup_source_change_clock' AND column_name='version' AND data_type <> 'bigint') THEN
    ALTER TABLE public.backup_source_change_clock ALTER COLUMN version TYPE BIGINT;
  END IF;
  ALTER TABLE public.backup_source_change_clock ALTER COLUMN version SET DEFAULT 0;
  ALTER TABLE public.backup_source_change_clock ALTER COLUMN version SET NOT NULL;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='backup_source_change_clock' AND column_name='changed_at'
      AND data_type = 'timestamp without time zone') THEN
    ALTER TABLE public.backup_source_change_clock
      ALTER COLUMN changed_at TYPE TIMESTAMPTZ USING changed_at AT TIME ZONE 'UTC';
  END IF;
  ALTER TABLE public.backup_source_change_clock ALTER COLUMN changed_at SET DEFAULT now();
  ALTER TABLE public.backup_source_change_clock ALTER COLUMN changed_at SET NOT NULL;

  SELECT c.conname INTO pk_name FROM pg_constraint c
   WHERE c.conrelid='public.backup_source_change_clock'::regclass AND c.contype='p';
  IF pk_name IS NULL THEN
    ALTER TABLE public.backup_source_change_clock
      ADD CONSTRAINT backup_source_change_clock_pkey PRIMARY KEY (id);
  ELSIF pk_name <> 'backup_source_change_clock_pkey' THEN
    EXECUTE format('ALTER TABLE public.backup_source_change_clock RENAME CONSTRAINT %I TO %I',
      pk_name, 'backup_source_change_clock_pkey');
  END IF;

  SELECT count(*) INTO check_count FROM pg_constraint
   WHERE conrelid='public.backup_source_change_clock'::regclass AND contype='c';
  IF check_count = 0 THEN
    ALTER TABLE public.backup_source_change_clock
      ADD CONSTRAINT backup_source_change_clock_version_nonnegative CHECK (version >= 0);
  ELSIF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid='public.backup_source_change_clock'::regclass AND contype='c'
        AND conname='backup_source_change_clock_version_nonnegative') THEN
    RAISE EXCEPTION 'backup_source_change_clock ma CHECK-i spoza kanonu — nie usuwam ich automatem.';
  END IF;

  SELECT count(*) INTO row_count FROM public.backup_source_change_clock WHERE id <> 'canonical-owner-graph';
  IF row_count > 0 THEN
    RAISE EXCEPTION 'backup_source_change_clock: % wierszy spoza singletona canonical-owner-graph. '
      'Kanon dopuszcza dokladnie jeden wiersz; NIE USUWAM zadnego — decyzja wlasciciela danych.', row_count;
  END IF;
END $$;

DO $$
DECLARE col_count INTEGER; uq_name TEXT; pk_name TEXT; bad_rows BIGINT;
BEGIN
  IF to_regclass('public.backup_run_receipts') IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO col_count FROM information_schema.columns
   WHERE table_schema='public' AND table_name='backup_run_receipts';
  IF col_count <> 19 THEN
    RAISE EXCEPTION 'backup_run_receipts ma % kolumn zamiast 19 — ksztalt nieznany, nie naprawiam automatem.', col_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='backup_run_receipts' AND column_name='fence' AND data_type <> 'bigint') THEN
    ALTER TABLE public.backup_run_receipts ALTER COLUMN fence TYPE BIGINT;
  END IF;

  -- TIMESTAMP -> TIMESTAMPTZ (patrz nota o UTC w naglowku).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='backup_run_receipts' AND column_name='scheduled_for' AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.backup_run_receipts ALTER COLUMN scheduled_for TYPE TIMESTAMPTZ USING scheduled_for AT TIME ZONE 'UTC';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='backup_run_receipts' AND column_name='lease_expires_at' AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.backup_run_receipts ALTER COLUMN lease_expires_at TYPE TIMESTAMPTZ USING lease_expires_at AT TIME ZONE 'UTC';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='backup_run_receipts' AND column_name='source_watermark' AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.backup_run_receipts ALTER COLUMN source_watermark TYPE TIMESTAMPTZ USING source_watermark AT TIME ZONE 'UTC';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='backup_run_receipts' AND column_name='source_observed_at' AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.backup_run_receipts ALTER COLUMN source_observed_at TYPE TIMESTAMPTZ USING source_observed_at AT TIME ZONE 'UTC';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='backup_run_receipts' AND column_name='claimed_at' AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.backup_run_receipts ALTER COLUMN claimed_at TYPE TIMESTAMPTZ USING claimed_at AT TIME ZONE 'UTC';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='backup_run_receipts' AND column_name='completed_at' AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.backup_run_receipts ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC';
  END IF;

  ALTER TABLE public.backup_run_receipts ALTER COLUMN fence                 SET DEFAULT 1;
  ALTER TABLE public.backup_run_receipts ALTER COLUMN rpo_threshold_seconds SET DEFAULT 900;
  ALTER TABLE public.backup_run_receipts ALTER COLUMN lease_expires_at      SET DEFAULT (now() + INTERVAL '20 minutes');
  ALTER TABLE public.backup_run_receipts ALTER COLUMN id               SET NOT NULL;
  ALTER TABLE public.backup_run_receipts ALTER COLUMN schedule_name    SET NOT NULL;
  ALTER TABLE public.backup_run_receipts ALTER COLUMN scheduled_for    SET NOT NULL;
  ALTER TABLE public.backup_run_receipts ALTER COLUMN lease_token      SET NOT NULL;
  ALTER TABLE public.backup_run_receipts ALTER COLUMN fence            SET NOT NULL;
  ALTER TABLE public.backup_run_receipts ALTER COLUMN lease_expires_at SET NOT NULL;
  ALTER TABLE public.backup_run_receipts ALTER COLUMN status           SET NOT NULL;
  ALTER TABLE public.backup_run_receipts ALTER COLUMN rpo_threshold_seconds SET NOT NULL;
  ALTER TABLE public.backup_run_receipts ALTER COLUMN key_id           SET NOT NULL;
  ALTER TABLE public.backup_run_receipts ALTER COLUMN claimed_at       SET NOT NULL;

  SELECT c.conname INTO pk_name FROM pg_constraint c
   WHERE c.conrelid='public.backup_run_receipts'::regclass AND c.contype='p';
  IF pk_name IS NULL THEN
    ALTER TABLE public.backup_run_receipts ADD CONSTRAINT backup_run_receipts_pkey PRIMARY KEY (id);
  ELSIF pk_name <> 'backup_run_receipts_pkey' THEN
    EXECUTE format('ALTER TABLE public.backup_run_receipts RENAME CONSTRAINT %I TO %I', pk_name, 'backup_run_receipts_pkey');
  END IF;

  -- Runtime deklarowal UNIQUE(schedule_name,scheduled_for) jako CONSTRAINT; kanon
  -- realizuje te sama unikalnosc INDEKSEM backup_run_receipts_schedule_slot_uidx,
  -- ktory zaklada 20260909 zaraz po tej migracji. Zostawienie obu dalo 4 indeksy
  -- przy wymaganych 3. Zamiana obiektu pochodnego — zero danych.
  SELECT c.conname INTO uq_name FROM pg_constraint c
   WHERE c.conrelid='public.backup_run_receipts'::regclass AND c.contype='u';
  IF uq_name IS NOT NULL AND uq_name <> 'backup_run_receipts_schedule_slot_uidx' THEN
    EXECUTE format('ALTER TABLE public.backup_run_receipts DROP CONSTRAINT %I', uq_name);
  END IF;

  -- Zanim dolozymy kontrakt terminalny: policz wiersze, ktore go lamia.
  SELECT count(*) INTO bad_rows FROM public.backup_run_receipts
   WHERE NOT (
     (status='CLAIMED' AND completed_at IS NULL AND backup_id IS NULL) OR
     (status IN ('COMPLETED','MISSED') AND completed_at IS NOT NULL AND backup_id IS NOT NULL AND source_watermark IS NOT NULL
       AND source_observed_at IS NOT NULL AND rpo_seconds IS NOT NULL AND artifact_sha256 IS NOT NULL
       AND plaintext_sha256 IS NOT NULL AND source_sha256 IS NOT NULL) OR
     (status='FAILED' AND completed_at IS NOT NULL)
   );
  IF bad_rows > 0 THEN
    RAISE EXCEPTION 'backup_run_receipts: % pokwitowan nie spelnia kontraktu terminalnego kanonu. '
      'NIE USUWAM ich ani nie zmieniam statusow — to dowody operacyjne, decyzja wlasciciela danych.', bad_rows;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_run_receipts'::regclass AND conname='backup_run_receipts_fence_positive') THEN
    ALTER TABLE public.backup_run_receipts ADD CONSTRAINT backup_run_receipts_fence_positive CHECK (fence > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_run_receipts'::regclass AND conname='backup_run_receipts_status_check') THEN
    ALTER TABLE public.backup_run_receipts ADD CONSTRAINT backup_run_receipts_status_check CHECK (status IN ('CLAIMED','COMPLETED','FAILED','MISSED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_run_receipts'::regclass AND conname='backup_run_receipts_rpo_nonnegative') THEN
    ALTER TABLE public.backup_run_receipts ADD CONSTRAINT backup_run_receipts_rpo_nonnegative CHECK (rpo_seconds IS NULL OR rpo_seconds >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_run_receipts'::regclass AND conname='backup_run_receipts_threshold_positive') THEN
    ALTER TABLE public.backup_run_receipts ADD CONSTRAINT backup_run_receipts_threshold_positive CHECK (rpo_threshold_seconds > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_run_receipts'::regclass AND conname='backup_run_receipts_sha_check') THEN
    ALTER TABLE public.backup_run_receipts ADD CONSTRAINT backup_run_receipts_sha_check CHECK (artifact_sha256 IS NULL OR artifact_sha256 ~ '^[0-9a-f]{64}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_run_receipts'::regclass AND conname='backup_run_receipts_plaintext_sha_check') THEN
    ALTER TABLE public.backup_run_receipts ADD CONSTRAINT backup_run_receipts_plaintext_sha_check CHECK (plaintext_sha256 IS NULL OR plaintext_sha256 ~ '^[0-9a-f]{64}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_run_receipts'::regclass AND conname='backup_run_receipts_source_sha_check') THEN
    ALTER TABLE public.backup_run_receipts ADD CONSTRAINT backup_run_receipts_source_sha_check CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_run_receipts'::regclass AND conname='backup_run_receipts_key_id_check') THEN
    ALTER TABLE public.backup_run_receipts ADD CONSTRAINT backup_run_receipts_key_id_check CHECK (length(trim(key_id)) BETWEEN 1 AND 128);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_run_receipts'::regclass AND conname='backup_run_receipts_terminal_shape_check') THEN
    ALTER TABLE public.backup_run_receipts ADD CONSTRAINT backup_run_receipts_terminal_shape_check CHECK (
      (status='CLAIMED' AND completed_at IS NULL AND backup_id IS NULL) OR
      (status IN ('COMPLETED','MISSED') AND completed_at IS NOT NULL AND backup_id IS NOT NULL AND source_watermark IS NOT NULL
        AND source_observed_at IS NOT NULL AND rpo_seconds IS NOT NULL AND artifact_sha256 IS NOT NULL
        AND plaintext_sha256 IS NOT NULL AND source_sha256 IS NOT NULL) OR
      (status='FAILED' AND completed_at IS NOT NULL)
    );
  END IF;
END $$;

DO $$
DECLARE col_count INTEGER; pk_name TEXT; bad_rows BIGINT;
BEGIN
  IF to_regclass('public.backup_restore_receipts') IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO col_count FROM information_schema.columns
   WHERE table_schema='public' AND table_name='backup_restore_receipts';
  IF col_count <> 14 THEN
    RAISE EXCEPTION 'backup_restore_receipts ma % kolumn zamiast 14 — ksztalt nieznany, nie naprawiam automatem.', col_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='backup_restore_receipts' AND column_name='started_at' AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.backup_restore_receipts ALTER COLUMN started_at TYPE TIMESTAMPTZ USING started_at AT TIME ZONE 'UTC';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='backup_restore_receipts' AND column_name='completed_at' AND data_type='timestamp without time zone') THEN
    ALTER TABLE public.backup_restore_receipts ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC';
  END IF;

  ALTER TABLE public.backup_restore_receipts ALTER COLUMN rto_threshold_seconds SET DEFAULT 3600;
  ALTER TABLE public.backup_restore_receipts ALTER COLUMN id                    SET NOT NULL;
  ALTER TABLE public.backup_restore_receipts ALTER COLUMN backup_id             SET NOT NULL;
  ALTER TABLE public.backup_restore_receipts ALTER COLUMN actor_id              SET NOT NULL;
  ALTER TABLE public.backup_restore_receipts ALTER COLUMN source_database       SET NOT NULL;
  ALTER TABLE public.backup_restore_receipts ALTER COLUMN target_database       SET NOT NULL;
  ALTER TABLE public.backup_restore_receipts ALTER COLUMN status                SET NOT NULL;
  ALTER TABLE public.backup_restore_receipts ALTER COLUMN started_at            SET NOT NULL;
  ALTER TABLE public.backup_restore_receipts ALTER COLUMN rto_threshold_seconds SET NOT NULL;

  SELECT c.conname INTO pk_name FROM pg_constraint c
   WHERE c.conrelid='public.backup_restore_receipts'::regclass AND c.contype='p';
  IF pk_name IS NULL THEN
    ALTER TABLE public.backup_restore_receipts ADD CONSTRAINT backup_restore_receipts_pkey PRIMARY KEY (id);
  ELSIF pk_name <> 'backup_restore_receipts_pkey' THEN
    EXECUTE format('ALTER TABLE public.backup_restore_receipts RENAME CONSTRAINT %I TO %I', pk_name, 'backup_restore_receipts_pkey');
  END IF;

  SELECT count(*) INTO bad_rows FROM public.backup_restore_receipts
   WHERE NOT (
     (status='STARTED' AND completed_at IS NULL) OR
     (status='COMPLETED' AND completed_at IS NOT NULL AND rto_seconds IS NOT NULL AND rto_met IS NOT NULL
       AND restored_rows IS NOT NULL AND source_sha256 IS NOT NULL) OR
     (status IN ('FAILED','COMMITTED_UNVERIFIED') AND completed_at IS NOT NULL)
   );
  IF bad_rows > 0 THEN
    RAISE EXCEPTION 'backup_restore_receipts: % pokwitowan nie spelnia kontraktu terminalnego kanonu. '
      'NIE USUWAM ich ani nie zmieniam statusow — decyzja wlasciciela danych.', bad_rows;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_restore_receipts'::regclass AND conname='backup_restore_receipts_status_check') THEN
    ALTER TABLE public.backup_restore_receipts ADD CONSTRAINT backup_restore_receipts_status_check CHECK (status IN ('STARTED','COMPLETED','FAILED','COMMITTED_UNVERIFIED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_restore_receipts'::regclass AND conname='backup_restore_receipts_rto_nonnegative') THEN
    ALTER TABLE public.backup_restore_receipts ADD CONSTRAINT backup_restore_receipts_rto_nonnegative CHECK (rto_seconds IS NULL OR rto_seconds >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_restore_receipts'::regclass AND conname='backup_restore_receipts_threshold_positive') THEN
    ALTER TABLE public.backup_restore_receipts ADD CONSTRAINT backup_restore_receipts_threshold_positive CHECK (rto_threshold_seconds > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_restore_receipts'::regclass AND conname='backup_restore_receipts_rows_nonnegative') THEN
    ALTER TABLE public.backup_restore_receipts ADD CONSTRAINT backup_restore_receipts_rows_nonnegative CHECK (restored_rows IS NULL OR restored_rows >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_restore_receipts'::regclass AND conname='backup_restore_receipts_source_sha_check') THEN
    ALTER TABLE public.backup_restore_receipts ADD CONSTRAINT backup_restore_receipts_source_sha_check CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.backup_restore_receipts'::regclass AND conname='backup_restore_receipts_terminal_shape_check') THEN
    ALTER TABLE public.backup_restore_receipts ADD CONSTRAINT backup_restore_receipts_terminal_shape_check CHECK (
      (status='STARTED' AND completed_at IS NULL) OR
      (status='COMPLETED' AND completed_at IS NOT NULL AND rto_seconds IS NOT NULL AND rto_met IS NOT NULL
        AND restored_rows IS NOT NULL AND source_sha256 IS NOT NULL) OR
      (status IN ('FAILED','COMMITTED_UNVERIFIED') AND completed_at IS NOT NULL)
    );
  END IF;
END $$;
