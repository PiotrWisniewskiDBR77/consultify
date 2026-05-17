# Organization Context Engine — Railway Staging Cutover Plan

**Wersja:** v1 (draft, do akceptacji CTO)
**Środowisko docelowe:** Railway `heartfelt-blessing` / env `staging` / service `consultify`
**Cel:** Włączyć Organization Context Engine GA (Stage 0–8) w sposób bezpieczny i odwracalny na realnej staging DB.
**Status kodu:** GA-ready (51/51 unit tests + 41/41 smoke + 6/6 cross-app audit). Kod NIE jest jeszcze wdrożony na staging.

---

## 1. Read-only Audit — co realnie jest na Railway staging (2026-05-04)

### 1.1 Środowisko / Service

| Pozycja | Wartość |
|---|---|
| Project | `heartfelt-blessing` |
| Environment | `staging` |
| Service | `consultify` |
| DB host (private) | `pgvector.railway.internal:5432` |
| DB host (public proxy) | `caboose.proxy.rlwy.net:15646` |
| DB engine | PostgreSQL 18.1 (Debian) |
| DB size | **521 MB** |
| Redis | `trolley.proxy.rlwy.net:44182` (public), `redis.railway.internal` (private) |
| Frontend | `https://stage.consultinity.ai` |

### 1.2 Krytyczne ENV obecne na service

| Klucz | Wartość | Konsekwencja |
|---|---|---|
| `APP_ENV` | `staging` | OK |
| `DISABLE_SCHEDULER` | **`true`** | **BLOCKER**: cały `Scheduler.init()` nie startuje, więc `job29` (worker tick), `job30` (external queue), `job31` (retention purge) NIE wystartują |
| `AI_PROVIDER_MODE` | `mock` | OCR/Whisper będą działać "naonibyło" (mock); jeśli chcemy realne wyniki na staging trzeba przełączyć na `real` |
| `MOCK_REDIS` | (brak) | Domyślnie real Redis — OK dla cache |
| `ORG_CONTEXT_*` | **0 zmiennych** | Brak dosłownie wszystkich nowych vars (worker, queue, OCR, audio, retention, cache) |

### 1.3 Schema — co jest, czego brakuje

**Istnieje (legacy, z danymi):**
- `knowledge_docs` — 214 wierszy, schema bardzo różny od oczekiwanego przez `ensureSchema()`
- `knowledge_documents` — 1 wiersz testowy (demo-org), pełna tabela master z wieloma kolumnami
- `knowledge_chunks` — 3347 wierszy, 1964 z embeddings (~30 KB każdy = ~60 MB), 33 MB tabela
- `organization_context` (2), `organization_context_items` (163), `organization_context_claims` (163), `organization_context_snapshots` (3), `organization_context_versions` (0) — stare tabele z legacy struktury
- `audit_log` — istnieje (nowy `ensureSchema()` zrobi tylko ALTER ADD COLUMN, idempotent)

**Brakuje (musi powstać przez `ensureSchema()` przy pierwszym requeście):**
- `organization_context_storage_events`
- `organization_context_processing_jobs`
- `organization_context_lineage_events`
- `organization_context_processing_attention_receipts`

### 1.4 Realne ryzyka schemy (P0 / P1)

#### P0-A. FK constraint blokuje wstawianie chunków przez nowy `ContextDocumentService`

`knowledge_chunks` ma:
```
"knowledge_chunks_document_id_fkey" FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
```

Wszystkie 3347 istniejących chunków mają `document_id IS NULL` i `doc_id` set — czyli FK nigdy nie był używany.

**Mój nowy kod wstawia OBA pola tym samym UUID-em z `knowledge_docs`:**

```ts
// ContextDocumentService.ts:2817
INSERT INTO knowledge_chunks (id, doc_id, document_id, content, chunk_index, embedding, metadata)
VALUES (?, ?, ?, ?, ?, ?, ?)
[uuidv4(), params.documentId, params.documentId, ...]
```

`params.documentId` pochodzi z `knowledge_docs.id` — który NIE istnieje w `knowledge_documents`. **FK violation** na każdym pierwszym uploadzie po cutover.

#### P0-B. `embedding` column type mismatch (bytea vs TEXT)

`knowledge_chunks.embedding` jest typu **`bytea`** (wszystkie 1964 istniejących embeddings to JSON-string zapisane jako bytea — Postgres robi escape silently). Nowy kod też zapisuje `JSON.stringify(embedding)` — więc będzie działać, ALE:
- Niespójne z deklaracją w `ensureSchema()` (która deklaruje `embedding TEXT`)
- Search/embedding compare po polu typu bytea jest NIE TRYWIALNE (Postgres widzi binary blob)
- Każdy rebuild embeddings musi zachować ten sam wzorzec — fragile

#### P0-C. `DISABLE_SCHEDULER=true` blokuje wszystkie 3 nowe joby

`server/src/index.ts:392`:
```ts
if (!isTest && process.env.DISABLE_SCHEDULER !== 'true') {
  await Scheduler.init();
}
```

Jeśli zostawimy `true` → uploads pójdą inline (bo `ORG_CONTEXT_UPLOAD_PROCESSING_MODE=inline` jest defaultem), ale:
- Nie ma worker ticka dla async cutover
- Nie ma retention purge
- Nie ma external queue consumer

#### P1-D. Worker process nie jest deploy'owany

`Procfile.organization-context-worker` istnieje w repo, ale `railway.json` deploy'uje TYLKO web service (Dockerfile.api). Brak osobnego service `worker` w Railway.

#### P1-E. Brak ORG_CONTEXT_* env vars

ZERO 16 zmiennych: `ORG_CONTEXT_WORKER_SCHEDULER_ENABLED`, `ORG_CONTEXT_WORKER_LIMIT`, `ORG_CONTEXT_UPLOAD_PROCESSING_MODE`, `ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED`, `ORG_CONTEXT_QUEUE_BACKEND`, `ORG_CONTEXT_RETENTION_TTL_DAYS`, `ORG_CONTEXT_RETENTION_HARD_DELETE_GRACE_DAYS`, `ORG_CONTEXT_AUDIO_MINUTES_QUOTA_PER_ORG`, `ORG_CONTEXT_IMAGE_OCR_PROVIDER`, `ORG_CONTEXT_AUDIO_TRANSCRIPTION_PROVIDER`, `ORG_CONTEXT_MAX_UPLOAD_BYTES`, `ORG_CONTEXT_CACHE_BACKEND`, `ORG_CONTEXT_CACHE_TTL_SECONDS`, `ORG_CONTEXT_RETRIEVAL_P95_BUDGET_MS`, `ORG_CONTEXT_EXTERNAL_QUEUE_*`.

Bez nich kod używa "safe defaults" (inline mode, db_ledger queue, no OCR, no transcription, no retention) — więc fail-closed, ale też zero nowych feature'ów dostępnych dla testerów.

#### P2-F. `AI_PROVIDER_MODE=mock`

Smoke test e2e dla OCR/Whisper na staging zwróci wyniki mock. Realne walidacje multimodalne wymagają przełączenia w `real` przed canary 48h.

---

## 2. Macierz ryzyk

| ID | Ryzyko | Prawd. | Wpływ | Severity | Mitigacja |
|---|---|---|---|---|---|
| R1 | FK violation `knowledge_chunks.document_id` blokuje wszystkie nowe uploady kontekstu | Pewne | Krytyczne (zero dokumentów GA wgrać się nie da) | **P0** | Faza 1.1: stworzyć migration która ALBO usuwa FK ALBO patchuje kod żeby wstawiał `document_id=NULL` (jak legacy) |
| R2 | `embedding` bytea vs TEXT — wyszukiwanie similarity może zwrócić śmieci | Średnia | Wysoki (P95 latency degradacja, zła odpowiedź AI) | **P0** | Faza 1.2: zachować bytea jako de-facto "TEXT bagged in bytea" (robi się i działa), dodać explicit cast w SELECT-ach + test similarity na 5 dokumentach po cutover |
| R3 | Włączenie `DISABLE_SCHEDULER=false` aktywuje WSZYSTKIE cron joby (nie tylko org-context) — w tym potencjalnie destrukcyjne na staging | Pewne | Średni (niektóre joby mogą wysyłać emaile, escalować decyzje) | **P1** | Faza 2: dodać granularne flagi `ORG_CONTEXT_FORCE_SCHEDULER_INIT=true` w Schedulerze ALBO uruchomić worker:loop jako osobny service (preferowane) |
| R4 | Pierwszy upload po cutover wywoła `ensureSchema()` → tworzenie 4 brakujących tabel + ALTER na live `knowledge_chunks`/`knowledge_docs` z 3347+214 wierszami | Pewne | Średni (możliwe locki, wolny pierwszy upload) | **P1** | Faza 1.3: wymusić `ensureSchema()` raz, off-band, przed włączeniem feature flag — przez script `bootstrap-organization-context-engine.ts` |
| R5 | Worker `worker:loop` nie ma deploymentu na Railway → async mode niedostępny | Pewne | Wysoki (nie da się włączyć `ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED=true`) | **P1** | Faza 3: dodać drugi service `consultify-worker` w Railway z `Dockerfile.worker` lub override start command |
| R6 | Cache w Redis nie ma prefiksu tenant — istnieją inne klucze z innych usług | Niska | Wysoki (cross-tenant data leak) | **P0** | `ContextCacheService.ts` już używa `tenant:{org_id}:` — verify smoke test po enable |
| R7 | Frontend wciąż próbuje upload do legacy `knowledge_documents`/legacy endpointów | Średnia | Średni (UI broken pomimo bckend OK) | **P1** | Faza 4: smoke E2E z UI + skontrolować że `documents.routes.ts` jest jedynym entrypointem |
| R8 | `AI_PROVIDER_MODE=mock` spowoduje że OCR/Whisper zwrócą mock-y w canary | Pewne | Średni (false positive dla GA) | **P2** | Faza 5: przełączyć na `real` PRZED canary 48h, monitorować koszty |
| R9 | Hard delete po retention TTL (90 dni default) skasuje legacy dokumenty których wiek > 90 dni | Wysoka | Krytyczny (data loss) | **P0** | Faza 6: ustawić `ORG_CONTEXT_RETENTION_TTL_DAYS=99999` na staging dopóki nie zwerifikujemy że purge tylko bierze dokumenty Z `source_upload='documents.library'` (a nie legacy) |
| R10 | Migracja schemy bez transakcji + bez backupu → niemożliwy rollback | Średnia | Krytyczny | **P0** | Faza 0: pg_dump przed start, wszystkie migracje schemy w explicit transaction |

---

## 3. Plan cutover — 7 faz, każda z gate'em decyzyjnym

### Faza 0 — Backup i baseline (obowiązkowy GATE)
**Cel:** Mieć możliwość rollbacku bez utraty danych.

Akcje:
1. `pg_dump` całej staging DB (521 MB) → archiwum `.sql.gz` z timestampem do `consultify/backups/staging-pre-oce-cutover-{ts}.sql.gz`.
2. Zrobić snapshot Railway volume jeżeli dostępne.
3. Zapisać aktualną wartość `DISABLE_SCHEDULER` i wszystkich `AI_PROVIDER_MODE` w pliku `pre-cutover-env-snapshot.json`.
4. Zrzucić aktualne row counts wszystkich tabel `organization_context_*`, `knowledge_*`, `interview_*` (audit baseline).

**GATE 0 PASS / NO-GO:** dump > 0 bytes; baseline counts zapisane; snapshot env zapisany.

**Rollback:** `pg_restore` + przywrócenie env.

**Czas:** ~10 min.

---

### Faza 1 — Schema migration (kontrolowana, transakcyjna)
**Cel:** Doprowadzić DB do stanu który nowy kod może bezpiecznie używać, BEZ włączania nowych feature'ów.

Sub-fazy:

**1.1 — Drop FK `knowledge_chunks_document_id_fkey`** (P0-A mitigation)
```sql
BEGIN;
ALTER TABLE knowledge_chunks DROP CONSTRAINT IF EXISTS knowledge_chunks_document_id_fkey;
COMMIT;
```
Decyzja: usunąć FK (nigdy nie był używany przez 3347 chunków) — bezpieczniejsze niż patchowanie kodu, bo dwie usługi (rag, indexer, contextDocument) wstawiają to różnie.

**1.2 — Decyzja embedding column type** (P0-B)
- **Opcja A (zalecana, bezpieczna):** zostawić bytea, zaakceptować że to jest de facto TEXT-w-bytea; dodać `ContextDocumentService.ts` patch który robi `embedding::text` w SELECT-ach (już tak robi rag service).
- **Opcja B (rzykowna):** zmienić typ kolumny na TEXT — wymaga `ALTER TABLE … ALTER COLUMN embedding TYPE text USING embedding::text` na 33 MB tabeli z lockiem ekskluzywnym.

→ rekomendacja: **Opcja A** dla staging, Opcja B dopiero po stable na staging przed prod.

**1.3 — Off-band ensureSchema() bootstrap**
Stworzyć nowy script `consultify/server/scripts/bootstrap-organization-context-engine-schema.ts` który:
- Łączy się do staging DB jak server
- Wywołuje `ensureSchema()` raz i kończy
- Loguje które tabele zostały stworzone
- Nie touch'uje danych

Uruchomić ten script via Railway one-off job ALBO lokalnie z `.env.staging.local`.

Po tym kroku w DB powstaną:
- `organization_context_storage_events`
- `organization_context_processing_jobs` (+ alter)
- `organization_context_lineage_events`
- `organization_context_processing_attention_receipts`
- ALTER ADD COLUMN dla `knowledge_docs`, `knowledge_chunks`, `audit_log` (idempotent, fallback=true)

**GATE 1 PASS / NO-GO:**
- Zerowy spadek `count(*)` na `knowledge_docs`, `knowledge_chunks`, `knowledge_documents`
- Wszystkie 4 nowe tabele istnieją
- Smoke test — dummy INSERT/SELECT/DELETE na każdej z 4 tabel (z rollback w transakcji)

**Rollback:** `DROP TABLE IF EXISTS organization_context_storage_events, organization_context_processing_jobs, organization_context_lineage_events, organization_context_processing_attention_receipts;` + przywrócić FK jeżeli usunięte.

**Czas:** ~20 min.

---

### Faza 2 — ENV vars & feature flags (defaults safe)
**Cel:** Wgrać 16 `ORG_CONTEXT_*` vars w stanie "OFF" / safe-mode.

Akcje:
1. W Railway UI → service `consultify` → environment `staging` → Variables → dodać:

```
ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=false
ORG_CONTEXT_WORKER_LIMIT=5
ORG_CONTEXT_UPLOAD_PROCESSING_MODE=inline
ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED=false
ORG_CONTEXT_QUEUE_BACKEND=db_ledger
ORG_CONTEXT_EXTERNAL_QUEUE_BASE_URL=
ORG_CONTEXT_EXTERNAL_QUEUE_AUTH_TOKEN=
ORG_CONTEXT_RETENTION_TTL_DAYS=99999
ORG_CONTEXT_RETENTION_HARD_DELETE_GRACE_DAYS=30
ORG_CONTEXT_AUDIO_MINUTES_QUOTA_PER_ORG=600
ORG_CONTEXT_IMAGE_OCR_PROVIDER=tesseract
ORG_CONTEXT_AUDIO_TRANSCRIPTION_PROVIDER=disabled
ORG_CONTEXT_MAX_UPLOAD_BYTES=104857600
ORG_CONTEXT_CACHE_BACKEND=memory
ORG_CONTEXT_CACHE_TTL_SECONDS=120
ORG_CONTEXT_RETRIEVAL_P95_BUDGET_MS=1500
```

2. Restart service.
3. Verify: `railway logs --service consultify --environment staging` zawiera `[OrganizationContext] Engine initialized in inline mode`.

**GATE 2 PASS:** Wszystkie 16 vars present; service zdrowy (`/ping` OK); logi nie pokazują błędów schemy.

**Rollback:** usunąć nowe vars przez Railway CLI (`railway variables --remove KEY`).

**Czas:** ~10 min.

---

### Faza 3 — Walidacja inline mode (smoke E2E na staging)
**Cel:** Sprawdzić że uploads działają przez nowy `ContextDocumentService` w trybie inline (bez worker'a).

Akcje:
1. Zalogować się na `https://stage.consultinity.ai` jako test user.
2. Upload sekwencyjnie 6 plików (1 typ na test):
   - PDF (z page locators)
   - DOCX (z paragraph + table locators)
   - PPTX (z slide locators)
   - XLSX (z sheet_range locators — istniejące)
   - TXT
   - PNG (image OCR przez tesseract)
3. Po każdym upload — sprawdzić w UI Document Library:
   - Status `ready` lub `processing` (nie `failed`/`unreadable`)
   - Liczba chunków > 0
   - Locator badge (page/paragraph/slide) widoczny
4. Otworzyć Work Canvas, zadać AI Chat z attachment dla każdego z 6 dokumentów. Sprawdzić:
   - Lineage event powstał (`SELECT * FROM organization_context_lineage_events ORDER BY created_at DESC LIMIT 6`)
   - Citacje w odpowiedzi mają poprawne locators
5. Stworzyć Interview Insight z 1 z dokumentów. Sprawdzić lineage entry.
6. SQL audit: `SELECT count(*) FROM organization_context_processing_jobs WHERE status='completed'` powinno być >= 6.

**GATE 3 PASS:**
- 6/6 plików `ready`
- 6/6 lineage events dla AI Chat + 1 dla Insight
- 0 błędów w `railway logs` poziomu `error`
- p95 latency retrieval < 1500 ms (ze smoke testu)

**NO-GO criteria:**
- Jakikolwiek upload `failed` z `error_code` innym niż znane safe codes (`pdf_encrypted_or_protected`, `pptx_archive_unreadable`)
- FK violation w logach
- Lineage event nie powstał

**Rollback:** wyłączyć Document Library w UI feature flag (jeżeli istnieje) ALBO ustawić `ORG_CONTEXT_UPLOAD_PROCESSING_MODE=disabled` (wymaga dodania flagi w kodzie — TODO).

**Czas:** ~45 min (test manualny).

---

### Faza 4 — Worker deployment (osobny Railway service)
**Cel:** Włączyć tryb async dla dużych dokumentów / OCR / audio.

Akcje:
1. Dodać do repo `Dockerfile.worker` (kopia `Dockerfile.api` z innym CMD = `npm run worker:organization-context:loop`).
2. W Railway UI → New Service → from GitHub repo → wybrać monorepo path `consultify` → set Dockerfile = `Dockerfile.worker` → name = `consultify-worker`.
3. Skopiować WSZYSTKIE env vars z `consultify` do `consultify-worker` (Railway support template lub `railway variables --copy`).
4. Override `consultify-worker`:
   - `DISABLE_SCHEDULER=true` (worker NIE potrzebuje cron'a, robi swoje w pętli)
   - `ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=true` (już domyślnie używane przez worker:loop)
5. Deploy. Sprawdzić logi: `[OrgContextWorker] tick=1 processed=0 elapsed_ms=xx`.
6. Włączyć async mode na main service: `ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED=true`.
7. Upload pliku 50 MB (PDF skan). Sprawdzić:
   - Job pojawia się w `organization_context_processing_jobs` ze statusem `queued`
   - W ciągu 30 s worker łapie job (`status='processing'`), potem `completed`
   - Document w UI po refresh ma `ready`

**GATE 4 PASS:**
- Worker service `RUNNING` w Railway dashboard
- 1 job przeszedł przez ledger
- Web service nadal serwuje requesty (worker działa niezależnie)

**Rollback:** `ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED=false`, `ORG_CONTEXT_UPLOAD_PROCESSING_MODE=inline`. Worker service pozostaje (idle).

**Czas:** ~30 min.

---

### Faza 5 — Włączenie OCR realnego + Whisper (P2 features)
**Cel:** Walidacja multimodalna na realnych providerach.

Akcje:
1. `ORG_CONTEXT_AUDIO_TRANSCRIPTION_PROVIDER=openai_whisper`
2. (opcjonalnie) `ORG_CONTEXT_IMAGE_OCR_PROVIDER=openai_vision` jeżeli tesseract daje słabe wyniki dla skanów.
3. `AI_PROVIDER_MODE=real` (UWAGA — globalne, włącza realne OpenAI calls dla całego stagingu).
4. Upload 1 audio MP3 (~5 min).
5. Sprawdzić:
   - Job ledger: pipeline_type='audio', status='completed'
   - Lineage events z timestamp_range locators
   - Cost tracking (jeżeli włączone): koszt > 0

**GATE 5 PASS:**
- Audio przeszedł
- Image OCR (jeżeli włączone openai_vision) returns text z confidence > 0.5
- Brak skoku 5xx w `railway logs`

**Rollback:** `ORG_CONTEXT_AUDIO_TRANSCRIPTION_PROVIDER=disabled`; `ORG_CONTEXT_IMAGE_OCR_PROVIDER=tesseract`; `AI_PROVIDER_MODE=mock` jeżeli ktoś chce wrócić.

**Czas:** ~20 min + monitoring 1h.

---

### Faza 6 — Retention purge (włączyć ostrożnie)
**Cel:** Włączyć cron purge ze sensownym TTL.

Akcje:
1. Najpierw test dry-run: stworzyć script `consultify/server/scripts/dryrun-organization-context-retention-purge.ts` który robi `SELECT` na tych samych warunkach co `purgeExpiredContextDocuments` ale bez `UPDATE/DELETE`. Zalogować ile dokumentów byłoby skasowanych przy TTL = 90.
2. Jeżeli dry-run pokazuje rozsądną liczbę (np. < 10 staging dokumentów) → zmienić `ORG_CONTEXT_RETENTION_TTL_DAYS=90`, `ORG_CONTEXT_RETENTION_HARD_DELETE_GRACE_DAYS=30`.
3. Włączyć scheduler dla worker service: `ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=true` (już zrobione w Fazie 4).
4. Po pierwszym tick'u (3:30 AM next day) sprawdzić:
   - `SELECT count(*) FROM knowledge_docs WHERE deleted_at IS NOT NULL` — wzrost zgodny z dry-run
   - Lineage events zachowane (`organization_context_lineage_events` count NIE spadł)

**GATE 6 PASS:**
- Soft-delete liczba == dry-run prediction
- Brak hard-delete starszych niż grace period
- Lineage events count stable

**Rollback:** `ORG_CONTEXT_RETENTION_TTL_DAYS=99999`. Soft-deleted dokumenty można odzyskać `UPDATE knowledge_docs SET deleted_at=NULL WHERE deleted_at > NOW() - INTERVAL '7 days'`.

**Czas:** ~24h (cron dziala raz dziennie).

---

### Faza 7 — Canary 48h + sign-off
**Cel:** Zostawić staging w pełnej GA konfiguracji na 48h, monitorować, raport.

Akcje:
1. Włączyć WSZYSTKIE features:
   - `ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED=true`
   - `ORG_CONTEXT_QUEUE_BACKEND=db_ledger` (Redis później)
   - `ORG_CONTEXT_CACHE_BACKEND=redis` + `REDIS_URL` (już jest)
   - OCR + Whisper enabled
2. Codziennie zbierać:
   - p95 latency retrieval
   - error rate (`organization_context_processing_jobs` gdzie `status='failed'` / total)
   - lineage events count delta
   - cost OpenAI delta
3. Po 48h: raport "PASS" / "PASS_WITH_P2" / "BLOCKED_P1" zgodnie z `UI_UX_SOURCE_OF_TRUTH.md`.
4. Jeżeli PASS → przygotować plan analogiczny dla production (osobny dokument).

**GATE 7 (release gate, finalna decyzja):**
- 0 P0/P1 incidents w 48h
- p95 latency < 1500 ms
- error rate < 1%
- CTO sign-off

**Rollback (nuclear option):** `pg_restore` z Fazy 0 + revert wszystkich env vars do pre-cutover snapshot.

**Czas:** 48h calendar time, ~2h aktywnego monitorowania.

---

## 4. Pre-cutover checklist (przed Faza 0)

- [ ] CTO zatwierdza ten plan i deklaruje okno (najlepiej weekend)
- [ ] Wszyscy testerzy na stage'u zostali poinformowani że uploads mogą być chwilowo wolniejsze
- [ ] Slack channel `#oce-cutover-staging` dla incydentów
- [ ] Załączony `pg_dump` weryfikowany lokalnie (restore na lokalną Postgres test)
- [ ] Aktualna `main` branch ma cały kod z 8 faz GA + jest greena w CI

## 5. Post-cutover validation (na zamknięcie GATE 7)

- [ ] `npm run smoke:organization-context-engine` pass (41/41)
- [ ] `npm run audit:organization-context-cross-app` pass (6/6)
- [ ] Manual smoke 6 file types pass (Faza 3)
- [ ] Worker uptime 48h > 99%
- [ ] No FK violations w logach
- [ ] No `embedding` parsing errors w logach
- [ ] CTO accepts UI/UX standardów per `UI_UX_SOURCE_OF_TRUTH.md`

## 6. Production cutover (na osobny dokument, po PASS na stagingu)

Plan będzie analogiczny ale z dodatkowymi wymaganiami:
- Pełny pg_dump + replikacja do staging snapshot
- Maintenance window (1h) ogłoszone customers 7 dni wcześniej
- Canary 5% traffic dla pierwszych 24h
- On-call rotation 24/7 przez 7 dni post-deploy

---

## 7. Pytania otwarte do CTO (decyzje do podjęcia PRZED rozpoczęciem)

1. **Czy ma sens rozdzielić `knowledge_docs` od `knowledge_documents`?** Obecnie są to dwie tabele master, używane przez różne usługi. Ujednolicić w przyszłości czy zostawić?
2. **Worker service na osobnym Railway service czy w tym samym container?** Osobny = bezpieczniej (failure isolation), drożej (~ +$5/mo), wymaga config copy.
3. **`ORG_CONTEXT_RETENTION_TTL_DAYS` = 90 ok dla staging?** Czy zostawić infinite na staging dopóki nie chcemy testować retention?
4. **`AI_PROVIDER_MODE=real` na staging — kto płaci za testy?** Czy masz limit miesięczny OpenAI dla staging projektu?
5. **Czy włączać `EFFECTIVE_ACCESS_ENFORCE=true` w ramach cutover?** Obecnie jest `false` (shadow mode), więc ACL nie blokuje, tylko loguje.

---

**Koniec dokumentu — wymaga sign-off CTO przed start Fazy 0.**
