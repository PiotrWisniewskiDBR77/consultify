-- MW-10 — Vault canonical versioning.
--
-- STAN PRZED: `knowledge_docs.version INTEGER DEFAULT 1` istniał w schemacie od
-- 20260303_schema_alignment.sql, ale NIE MIAŁ ANI JEDNEGO WRITERA ANI READERA w
-- `server/src/` — kolumna-fantom (dokładnie ten wzorzec, przed którym ostrzega
-- CLAUDE.md §ZŁOTE REGUŁY 1). Tak samo `parent_doc_id`. Historii wersji,
-- restore'u ani niezmiennego snapshotu treści dla Vault nie było w ogóle.
--
-- Ta migracja dokłada JEDNĄ tabelę historii dla dokumentów Vault
-- (`knowledge_docs`). Świadomie NIE reużywa `document_version_snapshots`
-- (776_document_studio_wave5_persistence.sql) — tamta tabela trzyma
-- `schema_json` artefaktów Document Studio kluczowanych po `artifact_id`, to
-- inna encja i inny cykl życia (MW-10 nie duplikuje i nie przejmuje tamtego
-- lineage'u).
--
-- Snapshot treści = plik na dysku (`filepath`) + `content_hash`. Storage jest
-- TEN SAM, którego upload Vault używa dzisiaj (`utils/storagePaths.uploadsDir`),
-- więc wersjonowanie nie wprowadza nowej platformy storage.

CREATE TABLE IF NOT EXISTS knowledge_doc_versions (
  version_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  filename TEXT NOT NULL,
  filepath TEXT,
  file_size_bytes BIGINT,
  content_hash TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  -- 'upload' = wersja 1 z pierwszego uploadu, 'edit' = nowa treść wgrana na
  -- istniejący dokument, 'restore' = wersja odtworzona z wcześniejszej.
  origin TEXT NOT NULL DEFAULT 'upload',
  -- Provenance restore'u: numer wersji, Z KTÓREJ odtworzono treść. Historia
  -- NIGDY nie jest nadpisywana — restore dokłada kolejną wersję.
  restored_from_version INTEGER,
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Stabilny, unikalny numer wersji w obrębie dokumentu. To jest jednocześnie
-- bezpiecznik współbieżności: dwa równoległe „edit" próbujące zapisać ten sam
-- `version_number` skończą się naruszeniem unikalności zamiast last-write-wins.
CREATE UNIQUE INDEX IF NOT EXISTS idx_kdv_document_version
  ON knowledge_doc_versions (document_id, version_number);
CREATE INDEX IF NOT EXISTS idx_kdv_document_created
  ON knowledge_doc_versions (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kdv_org
  ON knowledge_doc_versions (organization_id);

-- `version` = numer AKTUALNEJ wersji dokumentu i zarazem token CAS dla edycji.
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ★ Naprawa po recenzji CTO 2026-08-02 (pkt 5): `file_size_bytes` jest
-- wymagana przez `KnowledgeService.addDocument`'s INSERT (istniejący kod
-- sprzed MW-10), ale żadna migracja jej nie dodaje — jedynym miejscem był
-- runtime ALTER w `PostgresDatabase.ts` `initDb()` (którego `ensureKnowledgeDocColumn`
-- allowlist tej kolumny NIE zawiera) i pojedynczy wpis w
-- `20260719_baseline_gap.sql`, wielkim pliku z udokumentowanym dryfem
-- (potrafi paść/zostać pominięty w całości na części środowisk — patrz
-- nagłówki testów realdb w tym repo). Skutek: na środowisku, które trafiło na
-- ten dryf, KAŻDY upload do Vault pada z „column file_size_bytes does not
-- exist" — luka sprzed MW-10, ale bezpośrednio blokująca upload/edit, czyli
-- warunek wstępny wersjonowania.
--
-- Pierwsza wersja tego zadania łatała to RUNTIME ALTEREM w
-- `KnowledgeService.ensureKnowledgeSchema()` (ten sam wzorzec co
-- `owner_id`/`scope`/`folder_id` tamże) — recenzja słusznie to odrzuciła:
-- dwóch właścicieli schematu dla tej samej kolumny (migracja + runtime) to
-- dokładnie ten wzorzec dryfu, który już raz spowodował powyższy problem.
-- Kolumna ma teraz JEDNEGO właściciela: TĘ migrację, bezwarunkowo (nie
-- zależy od istnienia `organization_id`, więc działa identycznie na
-- zupełnie świeżej bazie i na bazie po wcześniejszym boocie serwera).
-- `KnowledgeService.ts` jest po tej poprawce bit-identyczny ze stanem
-- sprzed MW-10 (zero runtime ALTER dopisanych przez to zadanie).
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

-- ★ WAŻNE (znana luka repo, patrz `server/src/database/PostgresDatabase.ts`
-- ok. :1707-1742 `ensureKnowledgeDocColumn`): `organization_id`, `owner_id`,
-- `scope`, `chunk_count`, `deleted_at` na `knowledge_docs` NIE pochodzą z
-- plików migracji — dokłada je RUNTIME przy starcie aplikacji (i osobno
-- `KnowledgeService.ensureKnowledgeSchema` dla `owner_id`/`scope`/`folder_id`).
-- Te DWIE ścieżki bootstrapują NIEZALEŻNIE od siebie (`initDb()` uruchamia się
-- raz przy starcie procesu; `KnowledgeService.ensureKnowledgeSchema` dopiero
-- przy PIERWSZYM wywołaniu metody KnowledgeService — np. pierwszym uploadzie
-- do Vault), więc mogą być rozjechane w czasie: środowisko może mieć
-- `organization_id` (z `initDb()`) a JESZCZE NIE mieć `owner_id`/`deleted_at`
-- (z `KnowledgeService`, jeśli Vault nigdy nie był użyty). Zaobserwowane
-- realnie: pierwsze uruchomienie tej migracji na Railway DEV padło z
-- „column d.owner_id does not exist" — świeża baza `knowledge_docs` miała już
-- `organization_id`/`chunk_count`, ale NIE `owner_id`/`deleted_at`. Backfill
-- niżej musi więc sprawdzić WSZYSTKIE kolumny, których faktycznie używa
-- (nie tylko `organization_id`) — inaczej bramka daje fałszywe poczucie
-- bezpieczeństwa i migracja pada na dokładnie tej samej klasie luki, przed
-- którą sama ostrzega. Brak KTÓREJKOLWIEK z nich = backfill jest bezpiecznym
-- no-opem (te kolumny nie istnieją same z siebie, migracja ich nie tworzy —
-- to świadomie poza zakresem tego pliku, patrz akapit wyżej), ale DDL POWYŻEJ
-- (CREATE TABLE knowledge_doc_versions, ALTER version/deleted_at/file_size_bytes)
-- i tak przechodzi bezwarunkowo.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_docs' AND column_name = 'organization_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_docs' AND column_name = 'owner_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_docs' AND column_name = 'chunk_count'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_docs' AND column_name = 'deleted_at'
  ) THEN
    -- Dokumenty sprzed MW-10 nie mają wiersza wersji. Backfill nadaje im
    -- wersję 1 z ich własnych kolumn (origin='upload'), żeby „lista wersji"
    -- nigdy nie była pusta dla istniejącego dokumentu, a `version` wskazywał
    -- realny wiersz.
    UPDATE knowledge_docs SET version = 1 WHERE version IS NULL OR version < 1;

    INSERT INTO knowledge_doc_versions (
      version_id, document_id, organization_id, version_number, filename, filepath,
      file_size_bytes, chunk_count, origin, created_by, created_at
    )
    SELECT
      'kdv-backfill-' || d.id,
      d.id,
      COALESCE(d.organization_id, ''),
      1,
      COALESCE(d.filename, 'document'),
      d.filepath,
      d.file_size_bytes,
      COALESCE(d.chunk_count, 0),
      'upload',
      d.owner_id,
      COALESCE(d.created_at, CURRENT_TIMESTAMP)
    FROM knowledge_docs d
    WHERE NOT EXISTS (
      SELECT 1 FROM knowledge_doc_versions v WHERE v.document_id = d.id
    );

    -- Dokument skasowany miękko nie może zostawić dostępnych „osieroconych" wersji.
    UPDATE knowledge_doc_versions v
    SET deleted_at = d.deleted_at
    FROM knowledge_docs d
    WHERE v.document_id = d.id AND d.deleted_at IS NOT NULL AND v.deleted_at IS NULL;
  END IF;
END $$;
