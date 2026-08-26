-- =====================================================================
-- 20261121_async_jobs_table.sql
-- =====================================================================
-- POWOD POWSTANIA
--   DEC-116 (fresh-DB schema gap audit) sklasyfikowal `async_jobs` jako
--   NO_MIGRATION — obiekt uzywany przez kod (server/src/ai/asyncJobService.ts),
--   ktorego ZADEN plik migracji nie tworzy. Rozstrzygniecie per-obiekt:
--   zlecono ustalic czy funkcja jest ZYWA (dopisac schemat) czy MARTWA
--   (usunac kod).
--
-- WERDYKT: ZYWA.
--   Reachable z realnego wejscia: Gateway.ts:610 montuje
--   `app.use('/api/ai', aiDomainRoutes)` (import z './routes/ai/index.js');
--   routes/ai/index.ts:71 montuje `router.use('/playbooks', aiPlaybooksRoutes)`
--   -> server/src/routes/ai/aiPlaybooks.routes.ts rejestruje m.in.
--   POST /instances, /instances/:id/pause|resume|cancel|retry, ktore w
--   AIPlaybooksController.ts (linie 917-918, 1067-1068, 1118-1119) wolaja
--   `asyncJobService.enqueuePlaybookAdvance(...)`. Frontend: realny konsument
--   src/views/superadmin/PlaybookTemplatesListView.tsx + src/services/api.ts
--   (`/ai/playbooks/...`). Druga sciezka producencka, actionDecisions.routes.ts
--   (enqueueActionExecution), jest w praktyce MARTWA — eksportowana wylacznie
--   przez server/src/routes/index.ts, ktorego nikt nie importuje (zero
--   `app.use` w Gateway.ts) — to osobne, juz istniejace niezalezne finding,
--   nieusuwane tutaj (poza zakresem tego pliku: nie dotyka tabeli).
--
--   Zachowanie DZIS (przed ta migracja), na swiezej bazie: brak fallbacku.
--   asyncJobService.ts korzysta z surowego IDatabase (getDatabase()), NIE z
--   DbPromise.get/all (ktore maja fallback:true domyslnie). Zweryfikowano
--   empirycznie na jednorazowym Postgresie (migracje zaaplikowane, tabeli
--   brak): `AsyncJobService.findActiveJob(...)` RZUCA
--   `relation "async_jobs" does not exist` (PostgresDatabase.get propaguje
--   blad przez callback, bez proby/catch tlumiacej). To sam sposob zawiedzie
--   enqueuePlaybookAdvance/enqueueActionExecution (INSERT poprzedzony tym
--   samym SELECT-em dedupikacyjnym) -> 500 dla kazdego wywolania playbook
--   advance/retry/pause/resume/cancel na swiezej bazie.
--
--   PRZY OKAZJI ZNALEZIONY I NAPRAWIONY SPRZEZONY BLAD (osobny od schematu,
--   ale blokujacy weryfikacje "sciezka po migracji dziala"): asyncJobService.ts
--   ladowal aiQueue.js przez `require(...)`, mimo ze cale repo jest ESM
--   ("type":"module" + tsconfig NodeNext) — `require` nie istnieje w tym
--   zasiegu modulu, ani w dev (tsx), ani w skompilowanym dist/ produkcyjnym.
--   Kazde wywolanie enqueue*/getAsyncJobService() rzucalo
--   "require is not defined in ES module scope" NIEZALEZNIE od tej tabeli.
--   Naprawione w server/src/ai/asyncJobService.ts na wzor juz dzialajacego
--   `await import(...)` z server/src/queues/aiQueue.ts (ten sam plik uzywa
--   dokladnie tego wzorca dla QueueConfig). Po obu naprawach (schemat +
--   import) sciezka dziala end-to-end — patrz dowod runtime w komentarzu na
--   koncu pliku / raporcie.
--
-- SCHEMAT WYPROWADZONY Z UZYCIA W KODZIE
--   Wszystkie kolumny czytane/pisane przez server/src/ai/asyncJobService.ts
--   (SELECT *, INSERT, UPDATE) — zero kolumn nieuzywanych dopisanych na
--   zapas (poza `result`, ktorego kod NIE zapisuje ani nie odczytuje mimo
--   deklaracji w interfejsie AsyncJob — swiadomie POMINIETY, zgodnie z
--   zasada "kolumny ktore kod realnie czyta/pisze").
--
-- BEZPIECZENSTWO: wylacznie CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT
--   EXISTS. Zero DROP/ALTER TYPE, zero INSERT/seed.
-- =====================================================================

CREATE TABLE IF NOT EXISTS async_jobs (
    id                  TEXT PRIMARY KEY,
    type                TEXT NOT NULL,
    organization_id     TEXT NOT NULL REFERENCES organizations(id),
    correlation_id      TEXT,
    entity_id           TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'QUEUED',
    priority            TEXT NOT NULL DEFAULT 'normal',
    max_attempts        INTEGER NOT NULL DEFAULT 3,
    attempts            INTEGER NOT NULL DEFAULT 0,
    created_by          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ,
    error_code          TEXT,
    error_message       TEXT,
    last_error_code     TEXT,
    last_error_message  TEXT
);

-- findActiveJob: WHERE type = ? AND entity_id = ? AND status IN (...) ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_async_jobs_type_entity_status ON async_jobs(type, entity_id, status);
-- getJob/listJobs/getDeadLetterStats: WHERE organization_id = ? [AND status = ?] [AND type = ?]
CREATE INDEX IF NOT EXISTS idx_async_jobs_org ON async_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_async_jobs_org_status ON async_jobs(organization_id, status);
-- listJobs: ORDER BY created_at DESC LIMIT ? OFFSET ?
CREATE INDEX IF NOT EXISTS idx_async_jobs_created_at ON async_jobs(created_at DESC);
