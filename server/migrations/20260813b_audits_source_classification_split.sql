-- Audits — rozdzielenie TYPU źródła od STATUSU jego weryfikacji.
--
-- DLACZEGO:
-- Pierwsza wersja modelu miała jedną oś: `verification_status` z wartościami
-- VERIFIED_NORMATIVE / INTERNAL_FRAMEWORK / DEMONSTRATION / LEGACY /
-- EVIDENCE_MISSING. To był błąd kategorii. Mieszał dwa niezależne pytania:
--
--   „CZYM jest to źródło?"        → norma, procedura klienta, regulacja, demo
--   „CZY zostało zweryfikowane?"  → tak, w przeglądzie, nie, brak dowodu
--
-- Skutek był widoczny na zrzucie: pakiet zbudowany na procedurze QMS klienta,
-- zweryfikowany przez eksperta, renderował się jako „Zweryfikowana norma".
-- Procedura klienta nie jest normą i nigdy nią nie będzie, niezależnie od tego,
-- jak dokładnie ją sprawdzono. Odwrotnie: rzeczywista norma pozostaje normą,
-- nawet gdy jej mapowanie czeka na przegląd.
--
-- Po tej migracji:
--   source_type          — CZYM jest źródło. Zmienia się tylko przez jawną
--                          decyzję o naturze dokumentu.
--   verification_status  — CZY sprawdzone. Nie ma prawa zmienić source_type.
--
-- „Norma" (LICENSED_STANDARD / REGULATION) wymaga zidentyfikowanego standardu
-- z wersją, provenance i statusem praw. Walidator w `packValidator.ts`
-- egzekwuje to niezależnie od tej migracji.
--
-- FORWARD-ONLY I ADDYTYWNA. Kolumny stare zostają nietknięte; backfill jest
-- deterministyczny i nie kasuje danych.

-- ---------------------------------------------------------------------------
-- 1. Źródła — dwie osie zamiast jednej
-- ---------------------------------------------------------------------------

ALTER TABLE audit_norm_sources ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE audit_norm_sources ADD COLUMN IF NOT EXISTS verification_state TEXT;

-- Backfill z dotychczasowego, zlanego modelu. Mapowanie jest zachowawcze:
-- nic nie awansuje na normę, bo stary model nie niósł informacji o tym, czy
-- dokument JEST normą — tylko o tym, czy komuś ufano.
UPDATE audit_norm_sources
   SET source_type = COALESCE(source_type, CASE
         WHEN source_kind = 'normative_standard' THEN 'LICENSED_STANDARD'
         WHEN source_kind = 'regulation'         THEN 'REGULATION'
         WHEN source_kind = 'checklist'          THEN 'INTERNAL_FRAMEWORK'
         WHEN source_kind = 'demonstration'      THEN 'DEMONSTRATION'
         ELSE 'INTERNAL_PROCEDURE'
       END)
 WHERE source_type IS NULL;

UPDATE audit_norm_sources
   SET verification_state = COALESCE(verification_state, CASE
         WHEN verification_status = 'VERIFIED_NORMATIVE'  THEN 'VERIFIED'
         WHEN verification_status = 'INTERNAL_FRAMEWORK'  THEN 'VERIFIED'
         WHEN verification_status = 'DEMONSTRATION'       THEN 'UNVERIFIED'
         WHEN verification_status = 'LEGACY'              THEN 'UNVERIFIED'
         ELSE 'EVIDENCE_MISSING'
       END)
 WHERE verification_state IS NULL;

-- LEGACY jest cechą źródła (wycofane z użycia), nie stanem weryfikacji.
UPDATE audit_norm_sources
   SET source_type = 'LEGACY'
 WHERE verification_status = 'LEGACY' AND source_type IN ('INTERNAL_PROCEDURE', 'INTERNAL_FRAMEWORK');

CREATE INDEX IF NOT EXISTS idx_audit_norm_sources_type
  ON audit_norm_sources (source_type);
CREATE INDEX IF NOT EXISTS idx_audit_norm_sources_verification
  ON audit_norm_sources (verification_state);

-- ---------------------------------------------------------------------------
-- 2. Pakiety — dziedziczą obie osie ze źródła, ale trzymają własną kopię
-- ---------------------------------------------------------------------------
-- Kopia, nie join: pakiet jest wersjonowany i nie może zmienić swojej natury
-- dlatego, że ktoś później przekwalifikował źródło. Zmiana źródła tworzy nową
-- wersję pakietu — tak samo jak zmiana kryteriów.

ALTER TABLE audit_packs ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE audit_packs ADD COLUMN IF NOT EXISTS verification_state TEXT;

UPDATE audit_packs
   SET source_type = COALESCE(source_type, CASE
         WHEN classification = 'VERIFIED_NORMATIVE' THEN 'LICENSED_STANDARD'
         WHEN classification = 'INTERNAL_FRAMEWORK' THEN 'INTERNAL_FRAMEWORK'
         WHEN classification = 'DEMONSTRATION'      THEN 'DEMONSTRATION'
         WHEN classification = 'LEGACY'             THEN 'LEGACY'
         ELSE 'INTERNAL_PROCEDURE'
       END)
 WHERE source_type IS NULL;

UPDATE audit_packs
   SET verification_state = COALESCE(verification_state, CASE
         WHEN classification = 'VERIFIED_NORMATIVE' THEN 'VERIFIED'
         WHEN classification = 'INTERNAL_FRAMEWORK' THEN 'VERIFIED'
         WHEN classification = 'EVIDENCE_MISSING'   THEN 'EVIDENCE_MISSING'
         ELSE 'UNVERIFIED'
       END)
 WHERE verification_state IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_packs_source_type
  ON audit_packs (organization_id, source_type);
CREATE INDEX IF NOT EXISTS idx_audit_packs_verification
  ON audit_packs (organization_id, verification_state);

-- ---------------------------------------------------------------------------
-- 3. Sesje — etykieta domenowa nad stanem kernela
-- ---------------------------------------------------------------------------
-- Wspólny kernel metodyczny (contract SHA e3b8be6cd7) ma zamknięty zbiór
-- siedmiu stanów sesji. Jedenaście etapów audytu NIE rozszerza tego zbioru —
-- mapuje się na niego, a własna nazwa etapu żyje w `domain_stage`.
--
-- Odwzorowanie:
--   planning                    → draft
--   preparation                 → prepared
--   fieldwork, evidence_review  → active
--   findings_review,
--   management_response,
--   approval                    → in_review
--   remediation,
--   effectiveness_verification,
--   closure                     → frozen   (wynik audytu jest już zamrożony;
--                                           zmienia się status działań, nie
--                                           ustalenia)
--   closed                      → closed

ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS kernel_session_state TEXT;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS kernel_session_id TEXT;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS session_revision_of TEXT;
ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

UPDATE audit_programs
   SET kernel_session_state = COALESCE(kernel_session_state, CASE lifecycle_state
         WHEN 'planning'                   THEN 'draft'
         WHEN 'preparation'                THEN 'prepared'
         WHEN 'fieldwork'                  THEN 'active'
         WHEN 'evidence_review'            THEN 'active'
         WHEN 'findings_review'            THEN 'in_review'
         WHEN 'management_response'        THEN 'in_review'
         WHEN 'approval'                   THEN 'in_review'
         WHEN 'remediation'                THEN 'frozen'
         WHEN 'effectiveness_verification' THEN 'frozen'
         WHEN 'closure'                    THEN 'frozen'
         WHEN 'closed'                     THEN 'closed'
         ELSE 'draft'
       END)
 WHERE kernel_session_state IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_programs_kernel_state
  ON audit_programs (organization_id, kernel_session_state);

-- ---------------------------------------------------------------------------
-- 4. Zdarzenia domenowe — pola wymagane przez kontrakt kernela
-- ---------------------------------------------------------------------------
-- Kontrakt wymaga od KAŻDEGO zdarzenia: organizationId (już jest),
-- methodPackVersion, idempotencyKey oraz rozdzielenia actorKind od actorUserId.
-- Bez wersji packa historia przestaje być odtwarzalna po podbiciu metody.

ALTER TABLE audit_domain_events ADD COLUMN IF NOT EXISTS method_pack_id TEXT;
ALTER TABLE audit_domain_events ADD COLUMN IF NOT EXISTS method_pack_version TEXT;
ALTER TABLE audit_domain_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE audit_domain_events ADD COLUMN IF NOT EXISTS actor_kind TEXT;
ALTER TABLE audit_domain_events ADD COLUMN IF NOT EXISTS kernel_event_type TEXT;
ALTER TABLE audit_domain_events ADD COLUMN IF NOT EXISTS supersedes TEXT;

-- Zdarzenia zapisane przed tą migracją pochodzą wyłącznie od ludzi —
-- Teresa nie miała jeszcze ścieżki commitu do dziennika domenowego.
UPDATE audit_domain_events SET actor_kind = 'human' WHERE actor_kind IS NULL;

-- Idempotencja jest kontraktem, nie optymalizacją: ten sam klucz w tej samej
-- sesji musi dać ten sam wynik i zero drugiego wiersza. Indeks częściowy, bo
-- zdarzenia sprzed migracji klucza nie mają.
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_domain_events_idempotency
  ON audit_domain_events (organization_id, program_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_domain_events_kernel_type
  ON audit_domain_events (kernel_event_type);
