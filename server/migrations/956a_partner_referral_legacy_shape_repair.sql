-- PRT-W17 forward repair: dostosuj ZASTANE partner_referral_clicks /
-- partner_campaign_links do kształtu, którego wymaga 957.
--
-- POWÓD (zmierzony, nie założony):
-- Tabele te powstają w DWÓCH miejscach o różnym kształcie:
--   (1) łańcuch migracji — 957_partner_public_referral_click_receipts.sql,
--       kolumny NOT NULL + FK -> partner_organizations(id) ON DELETE CASCADE;
--   (2) leniwe DDL runtime — server/src/services/partnerReferralService.ts
--       (ensurePartnerReferralSchema), gdzie clicked_at/converted i liczniki
--       kampanii są NULLOWALNE, a FK nie ma wcale.
-- Na bazie, gdzie runtime zdążył pierwszy, 957 słusznie ODMAWIAŁA:
--   "partner_referral_clicks has incompatible nullable columns: clicked_at,converted"
-- i blokowała cały release. 957 zostaje bez zmian (nie ruszamy jej bajtów, żeby
-- nie wywołać HistoricalMutationError na bazach, które ją już zastosowały).
-- Ta migracja biegnie TUŻ PRZED nią (klucz sortowania 000956.0_956a_ < 000957.0_)
-- i doprowadza zastany kształt do kanonu.
--
-- GWARANCJE:
--  * IDEMPOTENTNA — każdy krok jest strażowany katalogiem albo z natury powtarzalny.
--  * BEZ USUWANIA DANYCH — ani jednego DELETE/DROP TABLE/DROP COLUMN.
--    Jedyne DROP-y dotyczą OBIEKTÓW POCHODNYCH (niezgodny FK, niezgodny indeks),
--    które są od razu odtwarzane w kanonicznym kształcie.
--  * NA ŚWIEŻEJ BAZIE — no-op (tabel jeszcze nie ma; tworzy je 957).
--  * Sytuacji, których nie da się naprawić bez zgadywania (NULL w kolumnach
--    tożsamości, wiersze-sieroty bez partnera), NIE zamiata pod dywan —
--    przerywa z komunikatem mówiącym CO dokładnie stoi na przeszkodzie.

DO $$
DECLARE
  null_count BIGINT;
  orphan_count BIGINT;
  pk_columns TEXT;
  fk_name TEXT;
  fk_def TEXT;
BEGIN
  IF to_regclass('public.partner_referral_clicks') IS NULL THEN
    RETURN; -- świeża baza: kanoniczną tabelę zakłada 957
  END IF;

  -- 1) Uzupełnij brakujące kolumny w kanonicznym kształcie (nic nie nadpisuje).
  ALTER TABLE partner_referral_clicks
    ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS referer VARCHAR(500),
    ADD COLUMN IF NOT EXISTS landing_page VARCHAR(500),
    ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100),
    ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100),
    ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100),
    ADD COLUMN IF NOT EXISTS utm_content VARCHAR(100),
    ADD COLUMN IF NOT EXISTS utm_term VARCHAR(100),
    ADD COLUMN IF NOT EXISTS converted BOOLEAN,
    ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS converted_organization_id UUID,
    ADD COLUMN IF NOT EXISTS conversion_type VARCHAR(30),
    ADD COLUMN IF NOT EXISTS session_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cookie_id VARCHAR(100);

  -- 2) Kanoniczne DEFAULT-y (957 sprawdza je osobno).
  ALTER TABLE partner_referral_clicks ALTER COLUMN clicked_at SET DEFAULT CURRENT_TIMESTAMP;
  ALTER TABLE partner_referral_clicks ALTER COLUMN converted   SET DEFAULT false;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='partner_referral_clicks' AND column_name='id'
       AND COALESCE(column_default,'') = ''
  ) THEN
    ALTER TABLE partner_referral_clicks ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- 3) Wypełnij realne NULL-e (kolumny nie-tożsamościowe) JAWNĄ wartością.
  --    clicked_at: wiersz kliknięcia bez znacznika czasu. Najbliższa prawdzie
  --    dostępna wartość to moment konwersji tego samego wiersza (kliknięcie
  --    musiało nastąpić nie później); dopiero gdy jej nie ma — czas migracji.
  --    NIE bierzemy „teraz" dla wierszy skonwertowanych, bo cofnęłoby to
  --    kolejność zdarzeń (clicked_at > converted_at) w raportach atrybucji.
  UPDATE partner_referral_clicks
     SET clicked_at = COALESCE(converted_at, CURRENT_TIMESTAMP)
   WHERE clicked_at IS NULL;

  --    converted: NULL znaczy „runtime nigdy tego nie ustawił". Traktujemy
  --    wiersz jako skonwertowany WYŁĄCZNIE gdy istnieje twardy ślad konwersji
  --    (converted_at albo converted_organization_id) — inaczej false, zgodnie
  --    z DEFAULT-em kanonicznym. Zero zgadywania w drugą stronę.
  UPDATE partner_referral_clicks
     SET converted = (converted_at IS NOT NULL OR converted_organization_id IS NOT NULL)
   WHERE converted IS NULL;

  -- 4) Kolumny tożsamości — tu zgadywać NIE WOLNO.
  SELECT count(*) INTO null_count FROM partner_referral_clicks
   WHERE id IS NULL OR partner_org_id IS NULL OR referral_code IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION
      'partner_referral_clicks: % wierszy ma NULL w id/partner_org_id/referral_code. '
      'Tych wartosci nie da sie odtworzyc automatycznie — wymagana decyzja wlasciciela danych.',
      null_count;
  END IF;

  -- 5) NOT NULL (ALTER ... SET NOT NULL jest idempotentne).
  ALTER TABLE partner_referral_clicks ALTER COLUMN id             SET NOT NULL;
  ALTER TABLE partner_referral_clicks ALTER COLUMN partner_org_id SET NOT NULL;
  ALTER TABLE partner_referral_clicks ALTER COLUMN referral_code  SET NOT NULL;
  ALTER TABLE partner_referral_clicks ALTER COLUMN clicked_at     SET NOT NULL;
  ALTER TABLE partner_referral_clicks ALTER COLUMN converted      SET NOT NULL;

  -- 6) PRIMARY KEY(id).
  SELECT lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g'))
    INTO pk_columns FROM pg_constraint c
   WHERE c.conrelid='public.partner_referral_clicks'::regclass AND c.contype='p';
  IF pk_columns IS NULL THEN
    ALTER TABLE partner_referral_clicks ADD CONSTRAINT partner_referral_clicks_pkey PRIMARY KEY (id);
  ELSIF pk_columns <> 'primarykeyid' THEN
    RAISE EXCEPTION
      'partner_referral_clicks ma PRIMARY KEY o innym ksztalcie (%). Zmiana PK na zywej bazie '
      'to decyzja wlasciciela danych, nie automat.', pk_columns;
  END IF;

  -- 7) FK partner_org_id -> partner_organizations(id) ON DELETE CASCADE.
  IF to_regclass('public.partner_organizations') IS NOT NULL THEN
    SELECT c.conname, lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g'))
      INTO fk_name, fk_def
      FROM pg_constraint c
     WHERE c.conrelid='public.partner_referral_clicks'::regclass AND c.contype='f'
       AND pg_get_constraintdef(c.oid) ILIKE 'FOREIGN KEY (partner_org_id)%'
     LIMIT 1;

    IF fk_def IS DISTINCT FROM 'foreignkeypartner_org_idreferencespartner_organizationsidondeletecascade' THEN
      SELECT count(*) INTO orphan_count
        FROM partner_referral_clicks c
        LEFT JOIN partner_organizations p ON p.id = c.partner_org_id
       WHERE p.id IS NULL;
      IF orphan_count > 0 THEN
        RAISE EXCEPTION
          'partner_referral_clicks: % wierszy wskazuje na nieistniejacego partnera. FK nie zostanie '
          'dodany, a wierszy NIE USUWAMY — najpierw decyzja wlasciciela danych co z sierotami.',
          orphan_count;
      END IF;
      IF fk_name IS NOT NULL THEN
        -- FK to obiekt pochodny: podmiana definicji nie rusza ani jednego wiersza.
        EXECUTE format('ALTER TABLE partner_referral_clicks DROP CONSTRAINT %I', fk_name);
      END IF;
      ALTER TABLE partner_referral_clicks
        ADD CONSTRAINT partner_referral_clicks_partner_org_id_fkey
        FOREIGN KEY (partner_org_id) REFERENCES partner_organizations(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  null_count BIGINT;
  orphan_count BIGINT;
  pk_columns TEXT;
  fk_name TEXT;
  fk_def TEXT;
BEGIN
  IF to_regclass('public.partner_campaign_links') IS NULL THEN
    RETURN; -- świeża baza: kanoniczną tabelę zakłada 957
  END IF;

  ALTER TABLE partner_campaign_links
    ADD COLUMN IF NOT EXISTS name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS slug VARCHAR(100),
    ADD COLUMN IF NOT EXISTS destination_url VARCHAR(500) DEFAULT '/',
    ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100),
    ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100),
    ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100),
    ADD COLUMN IF NOT EXISTS utm_content VARCHAR(100),
    ADD COLUMN IF NOT EXISTS click_count INTEGER,
    ADD COLUMN IF NOT EXISTS signup_count INTEGER,
    ADD COLUMN IF NOT EXISTS conversion_count INTEGER,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

  ALTER TABLE partner_campaign_links ALTER COLUMN click_count      SET DEFAULT 0;
  ALTER TABLE partner_campaign_links ALTER COLUMN signup_count     SET DEFAULT 0;
  ALTER TABLE partner_campaign_links ALTER COLUMN conversion_count SET DEFAULT 0;
  ALTER TABLE partner_campaign_links ALTER COLUMN is_active        SET DEFAULT true;
  ALTER TABLE partner_campaign_links ALTER COLUMN created_at       SET DEFAULT CURRENT_TIMESTAMP;
  ALTER TABLE partner_campaign_links ALTER COLUMN updated_at       SET DEFAULT CURRENT_TIMESTAMP;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='partner_campaign_links' AND column_name='id'
       AND COALESCE(column_default,'') = ''
  ) THEN
    ALTER TABLE partner_campaign_links ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- Liczniki: NULL znaczy „nikt nie zliczyl", a nie „nieznana liczba" — 0 jest
  -- jedyną wartością, która nie zmyśla ruchu, którego nie widzieliśmy.
  UPDATE partner_campaign_links SET click_count      = 0 WHERE click_count      IS NULL;
  UPDATE partner_campaign_links SET signup_count     = 0 WHERE signup_count     IS NULL;
  UPDATE partner_campaign_links SET conversion_count = 0 WHERE conversion_count IS NULL;
  -- is_active: kanoniczny DEFAULT to true; link bez flagi byl uzywany jako aktywny.
  UPDATE partner_campaign_links SET is_active = true WHERE is_active IS NULL;
  -- created_at/updated_at: bierzemy tę z dwóch, która istnieje; dopiero gdy obu
  -- brak — czas migracji.
  UPDATE partner_campaign_links
     SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP),
         updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
   WHERE created_at IS NULL OR updated_at IS NULL;

  SELECT count(*) INTO null_count FROM partner_campaign_links
   WHERE id IS NULL OR partner_org_id IS NULL OR name IS NULL OR slug IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION
      'partner_campaign_links: % wierszy ma NULL w id/partner_org_id/name/slug. '
      'Tych wartosci nie da sie odtworzyc automatycznie — wymagana decyzja wlasciciela danych.',
      null_count;
  END IF;

  ALTER TABLE partner_campaign_links ALTER COLUMN id               SET NOT NULL;
  ALTER TABLE partner_campaign_links ALTER COLUMN partner_org_id   SET NOT NULL;
  ALTER TABLE partner_campaign_links ALTER COLUMN name             SET NOT NULL;
  ALTER TABLE partner_campaign_links ALTER COLUMN slug             SET NOT NULL;
  ALTER TABLE partner_campaign_links ALTER COLUMN click_count      SET NOT NULL;
  ALTER TABLE partner_campaign_links ALTER COLUMN signup_count     SET NOT NULL;
  ALTER TABLE partner_campaign_links ALTER COLUMN conversion_count SET NOT NULL;
  ALTER TABLE partner_campaign_links ALTER COLUMN is_active        SET NOT NULL;
  ALTER TABLE partner_campaign_links ALTER COLUMN created_at       SET NOT NULL;
  ALTER TABLE partner_campaign_links ALTER COLUMN updated_at       SET NOT NULL;

  SELECT lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g'))
    INTO pk_columns FROM pg_constraint c
   WHERE c.conrelid='public.partner_campaign_links'::regclass AND c.contype='p';
  IF pk_columns IS NULL THEN
    ALTER TABLE partner_campaign_links ADD CONSTRAINT partner_campaign_links_pkey PRIMARY KEY (id);
  ELSIF pk_columns <> 'primarykeyid' THEN
    RAISE EXCEPTION
      'partner_campaign_links ma PRIMARY KEY o innym ksztalcie (%). Zmiana PK na zywej bazie '
      'to decyzja wlasciciela danych, nie automat.', pk_columns;
  END IF;

  IF to_regclass('public.partner_organizations') IS NOT NULL THEN
    SELECT c.conname, lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]()]','','g'))
      INTO fk_name, fk_def
      FROM pg_constraint c
     WHERE c.conrelid='public.partner_campaign_links'::regclass AND c.contype='f'
       AND pg_get_constraintdef(c.oid) ILIKE 'FOREIGN KEY (partner_org_id)%'
     LIMIT 1;

    IF fk_def IS DISTINCT FROM 'foreignkeypartner_org_idreferencespartner_organizationsidondeletecascade' THEN
      SELECT count(*) INTO orphan_count
        FROM partner_campaign_links l
        LEFT JOIN partner_organizations p ON p.id = l.partner_org_id
       WHERE p.id IS NULL;
      IF orphan_count > 0 THEN
        RAISE EXCEPTION
          'partner_campaign_links: % wierszy wskazuje na nieistniejacego partnera. FK nie zostanie '
          'dodany, a wierszy NIE USUWAMY — najpierw decyzja wlasciciela danych co z sierotami.',
          orphan_count;
      END IF;
      IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE partner_campaign_links DROP CONSTRAINT %I', fk_name);
      END IF;
      ALTER TABLE partner_campaign_links
        ADD CONSTRAINT partner_campaign_links_partner_org_id_fkey
        FOREIGN KEY (partner_org_id) REFERENCES partner_organizations(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Indeks abuse-window: 957 odmawia, jeśli zastanie go w innym kształcie.
-- Indeks jest obiektem POCHODNYM (zero danych własnych), więc niezgodny
-- kasujemy, a 957 (biegnie zaraz po tej migracji) zaklada go w kanonicznym
-- ksztalcie swoim CREATE INDEX IF NOT EXISTS. Zadne dane nie znikaja.
DO $$
DECLARE index_definition TEXT;
BEGIN
  IF to_regclass('public.idx_partner_clicks_abuse_window') IS NULL THEN
    RETURN;
  END IF;
  SELECT lower(regexp_replace(pg_get_indexdef(indexrelid),'[[:space:]()]','','g')) INTO index_definition
    FROM pg_index WHERE indexrelid='public.idx_partner_clicks_abuse_window'::regclass;
  IF index_definition NOT LIKE 'createindexidx_partner_clicks_abuse_windowonpublic.partner_referral_clicksusingbtreepartner_org_id,ip_hash,clicked_atdesc%' THEN
    DROP INDEX public.idx_partner_clicks_abuse_window;
  END IF;
END $$;
