# M20 — Tabele Studio · FAZA 1 · Code Truth

Repo: `consultify` @ `feat/deliverables-light`. Audyt KOD-runtime. Dokumenty = hipotezy; werdykty oparte na czytaniu kodu runtime.

Skala: 193 endpointów w `table-platform.routes.ts` (5058 linii) + 9 routerów satelickich. NIE katalogowano wszystkich — skupienie na fundamentach, flagach i persistencji.

---

## TABELA WERDYKTÓW (16 pozycji)

| # | Pozycja | Werdykt | Dowód (plik:linia) |
|---|---------|---------|--------------------|
| 1 | Home modułu / szablony lifecycle | **CZĘŚĆ ZA FLAGĄ** (OFF) | `src/components/AIChat/KimiWorkspace/ArtifactModuleHome.tsx:90` `isTemplateLifecycleEnabled()`; flaga default **OFF** `src/utils/templateLifecycleFlag.ts:36-43` (env null ⇒ false) |
| 2 | Generacja tabeli z czatu (V8 → tp_*) | **ZA FLAGĄ** (OFF) | `server/src/config/FeatureFlags.ts:113` `ENABLE_V8_GLOBAL === 'true'` ⇒ default **OFF**; gate `services/v8/featureFlagService.ts:75` |
| 3 | Records API (fundament) | **REALNE / DZIAŁA** | `FeatureFlags.ts:75` `!== 'false'` ⇒ default **ON**; runtime schema-check `table-platform.routes.ts:61-104` (503 SCHEMA_NOT_READY na braku `tp_bases`) |
| 4 | Workspaces/bazy/tabele CRUD, duplicate, CSV, audit, attachments | **REALNE / DZIAŁA** | `table-platform.routes.ts:355,400,468,1503,1924`; org-guard middleware |
| 5 | Widoki Grid/Kanban/Calendar/Matrix + share + PublicViewPage | **REALNE / DZIAŁA** | `table-platform.routes.ts:2372,3863,3875`; `requireViewAccess` |
| 6 | Edytor komórek/pól, formuły, linked, rollup, undo/redo, realtime | **REALNE / DZIAŁA** | usługi `RecordsService`, `FormulaEngineV2`, `RelationService` — DB-backed (`tp_records`, `tp_fields`) |
| 7 | AI Editor (8 poziomów) applyProposal | **REALNE / DZIAŁA** (ROZJAZD flag) | `TableAiEditorService.ts:336` realne `executeProposalOperations` + audit `:436`; BE flaga `ENABLE_TABLE_AI_EDITOR` komentarz mówi "Disabled by default" `FeatureFlags.ts:82-85` ale `!== 'false'` ⇒ **runtime ON**; FE też ON `tabeleAiEditorFlag.ts:31` |
| 8 | QA Engine (5 osi) | **DZIAŁA BE / ZA FLAGĄ FE** | BE `ENABLE_TABLE_QA_ENGINE` komentarz "Disabled" ale runtime **ON** `FeatureFlags.ts:91`; FE `tabeleQaFlag.ts:30` default **OFF** |
| 9 | Source Pack | **DZIAŁA BE / ZA FLAGĄ FE** | BE runtime **ON** `FeatureFlags.ts:97`; FE `tabeleSourcePackFlag.ts:33` default **OFF**; routy gate `requirePackEnabled` `source-pack.routes.ts:183` |
| 10 | Materializer Table→Doc/Deck | **DZIAŁA BE / ZA FLAGĄ FE** | BE `ENABLE_TABLE_ARTIFACT_CONVERSION` runtime **ON** `FeatureFlags.ts:103`; FE `tabeleConversionsFlag.ts:33` default **OFF** |
| 11 | Formularze/intake (slug) + JWT wariant | **DZIAŁA slug / ZA FLAGĄ JWT** | slug router live zawsze; JWT `ENABLE_TABLE_FORM_INTAKE_JWT === 'true'` ⇒ default **OFF** `FeatureFlags.ts:110` |
| 12 | Automatyzacje (toggle/run/cron) | **REALNE / DZIAŁA** | `AutomationService.ts:73,101,136,144,236` (tp_automations/_actions/_runs); executor `ScheduledAutomationExecutor.ts:186` realny `setInterval` + DB |
| 13 | Konektory/integracje — **governed models publish/sync** | **MIESZANE: szerokość REALNA, ale sync-to-* = STUB-FASADA** | webhooks/relays/interfaces DB-backed; ALE `ModuleSyncService.syncToModule` `ModuleSyncService.ts:57-110` **tylko loguje** do `tp_module_sync_results`, NIE pisze do Results/Finance/Execution — patrz niżej |
| 14 | Eksporty + intenty czatowe | **REALNE / DZIAŁA** | CSV/XLSX/JSON + propose-schema/explain-relation w routerach satelickich |
| 15 | MELS shell Tabele | **ZA FLAGĄ** (OFF) | `TabeleView.tsx:407` `isMelsTabeleEnabled()`; default **OFF** `melsTabeleFlag.ts:38`; fallback KimiWorkspaceShell |
| 16 | Record provenance/confidence | **ZA FLAGĄ** (OFF) | `ConfidenceScoringService.ts:187` gate; `FeatureFlags.ts:80` `=== 'true'` ⇒ default **OFF**; `RecordsService.ts:367` honoruje OFF |

---

## 1f — TABELA FLAG (NAJWAŻNIEJSZE: realny default RUNTIME vs komentarz)

| Flaga | Warstwa | Plik:linia | Wyrażenie runtime | REALNY default | Komentarz w kodzie | ROZJAZD? | Kto włącza | Wpływ OFF |
|-------|---------|-----------|-------------------|----------------|--------------------|---------|-----------|-----------|
| `ENABLE_TABLE_PLATFORM_RECORDS_API` | BE | FeatureFlags.ts:75 | `!== 'false'` | **ON** | "Default ON" | NIE | env ops | 404 całego modułu |
| `ENABLE_RECORD_PROVENANCE` | BE | FeatureFlags.ts:80 | `=== 'true'` | **OFF** | "Block B... gate inside service" | NIE | env ops | brak confidence/validation_status |
| `ENABLE_TABLE_AI_EDITOR` | BE | FeatureFlags.ts:85 | `!== 'false'` | **ON** | **"Disabled by default until C-S2"** | **TAK** (komentarz mówi OFF, runtime ON) | env ops | AI editor 404 |
| `ENABLE_TABLE_QA_ENGINE` | BE | FeatureFlags.ts:91 | `!== 'false'` | **ON** | **"Disabled by default until C-S5"** | **TAK** | env ops | QA routes 404 |
| `ENABLE_TABLE_SOURCE_PACK` | BE | FeatureFlags.ts:97 | `!== 'false'` | **ON** | **"Disabled by default until C-S6"** | **TAK** | env ops | source-pack 404 |
| `ENABLE_TABLE_ARTIFACT_CONVERSION` | BE | FeatureFlags.ts:103 | `!== 'false'` | **ON** | **"Disabled by default until D-S3"** | **TAK** | env ops | konwersja 404 |
| `ENABLE_TABLE_FORM_INTAKE_JWT` | BE | FeatureFlags.ts:110 | `=== 'true'` | **OFF** | "Disabled by default until D-S4" | NIE | env ops | tylko slug forms (slug zawsze live) |
| `ENABLE_V8_GLOBAL` | BE | FeatureFlags.ts:113 | `=== 'true'` | **OFF** | kill switch | NIE | env ops | generacja tabel z czatu 404 |
| `tabeleAiEditor` (ff) | FE | tabeleAiEditorFlag.ts:31 | env null ⇒ true | **ON** | "Default ON — server also ON" | NIE | URL/LS/env | panel AI ukryty |
| `tabeleQa` (ff) | FE | tabeleQaFlag.ts:30 | env null ⇒ false | **OFF** | "Default OFF" | NIE | URL/LS/env | panel QA ukryty |
| `tabeleSourcePack` (ff) | FE | tabeleSourcePackFlag.ts:33 | env null ⇒ false | **OFF** | — | NIE | URL/LS/env | panel source-pack ukryty |
| `tabeleConversions` (ff) | FE | tabeleConversionsFlag.ts:33 | env null ⇒ false | **OFF** | — | NIE | URL/LS/env | konwersja ukryta |
| `melsTabele` (ff) | FE | melsTabeleFlag.ts:38 | env null ⇒ false | **OFF** | kill-switch | NIE | URL/LS/env | fallback KimiWorkspaceShell |
| `templateLifecycle` (ff) | FE | templateLifecycleFlag.ts:36 | env null ⇒ false | **OFF** | — | NIE | URL/LS/env | stary grid szablonów |

### Wniosek 1f — ROZJAZD POTWIERDZONY
Inwentarz miał rację: **4 flagi BE (AI Editor, QA, Source Pack, Conversion)** mają komentarz "Disabled by default until C-S*/D-S*" ale wyrażenie runtime to `process.env.X !== 'false'` = **default ON**. Czyli backend tych funkcji jest **żywy w produkcji bez ustawiania env-vara**, mimo że komentarz sugeruje, że są wyłączone. Wpływ asymetryczny: FE bramki (QA/SourcePack/Conversion default OFF) chowają UI, więc użytkownik ich nie widzi — ale **endpointy są wystawione i wykonywalne** (np. przez bezpośrednie API / operatora z `?ff_*=1`). To rozjazd dokumentacja↔runtime; ryzyko = funkcje "niegotowe wg komentarza" są realnie osiągalne przez API.

---

## 1e — WIRING / PERSISTENCJA (czy dane przeżywają restart)

| Komponent | Tabela DB / mechanizm | Werdykt |
|-----------|----------------------|---------|
| Records / bases / tables / fields / views | `tp_bases`, `tp_tables`, `tp_records`, `tp_fields`, `tp_views` (migracje `server/migrations/700_table_platform_foundation.sql` + 702/707/708/715/716/718/721/723…) | **REALNA DB** — żyje po restarcie. Schema-check `routes:68` `SELECT 1 FROM tp_bases`. |
| AI Editor history / proposals | `tp_schema_proposals` (status pending/applied/rejected, resolved_by/at) `TableAiEditorService.ts:348,427` | **REALNA DB** |
| Automatyzacje | `tp_automations`, `tp_automation_actions`, `tp_automation_runs`, `tp_automation_run_counts` `AutomationService.ts:73-236`, `ScheduledAutomationExecutor.ts:262-294` | **REALNA DB** — executor `setInterval`, runy logowane |
| Governed model sync | `tp_module_sync_results` `ModuleSyncService.ts:89` | **DB log istnieje, ale to FASADA** — patrz 1g |

**Brak persistencji-fasady typu `new Map()` (jak M18).** Wszystkie persist/load przechodzą przez Postgres `tp_*`. Records API 503 SCHEMA_NOT_READY potwierdza realny schemat.

---

## 1g — POŁĄCZENIA

| Połączenie | Status | Dowód |
|-----------|--------|-------|
| czat → generacja tabeli | ZA FLAGĄ `ENABLE_V8_GLOBAL` (OFF); pipeline materializuje `tp_*` gdy ON | FeatureFlags.ts:113 |
| Table → Doc/Deck konwersja | REALNA (idempotentna, deep-link), BE ON / FE OFF | `ENABLE_TABLE_ARTIFACT_CONVERSION` runtime ON FeatureFlags.ts:103 |
| AI Editor applyProposal → mutacja rekordów | **REALNA** — `executeProposalOperations` z MutationExecutor, status flip po sukcesie, audit | TableAiEditorService.ts:402-451 |
| **governed models → Results / Finance / Execution** | **STUB-FASADA** — endpoint zwraca `success:true` + `syncedRecords>0`, ale do modułu docelowego NIE trafia ani jeden rekord | patrz niżej |

### ⚠️ KLUCZOWE: governed models sync = STUB udający DZIAŁA
`POST /governed-models/:modelId/publish-to-results` (`routes:3413`) i `sync-to-finance` (`routes:3440`) wołają `syncToModule(modelId, 'results'|'finance', …)`.
`ModuleSyncService.syncToModule` (`ModuleSyncService.ts:57-110`):
1. `countSourceRecords(modelId)` — liczy rekordy źródłowe
2. `INSERT INTO tp_module_sync_results (…)` — zapisuje **wiersz-log** ("sync się odbył")
3. `return { syncStatus: 'success', syncedRecords }`

**Nigdzie nie ma zapisu do tabel modułu Results ani Finance.** To księgowość fasadowa: UI dostanie zielony "success: N rekordów zsynchronizowano", ale dane docelowo nie istnieją. Klasyczny stub-udający-DZIAŁA. Werdykt poz.13 governed-models-sync = **MOCK-STUB**.

---

## SEC — Cross-org / IDOR (wzorzec org-guard)

### Wzorzec: SYSTEMOWY, CZYSTY org-guard (przeciwieństwo core IDOR)
`PermissionsService` (`server/src/services/tablePlatform/PermissionsService.ts`) dostarcza spójne middleware:
- `requireBaseAccess` (:223) → `canAccessBase` (:170) → **`base.organization_id === orgId`** (:180) + creator override.
- `requireTableAccess` (:252) → `canAccessTable` → resolve table→base→org.
- `requireRecordAccess`/`requireFieldAccess`/`requireViewAccess` (:415/391/439) → resolve encja→table→base→org.
- `requireRoles(...)` (:282) → uniwersalny resolver baseId z `tableId/fieldId/viewId/recordId/interfaceId/proposalId` (:299-358), potem `requireRole` z fallbackiem org-level.

**Pokrycie: 115/193 tras** w `table-platform.routes.ts` ma jawne org-guard middleware. Trasy z `:baseId/:tableId/:recordId/:viewId` konsekwentnie noszą odpowiednią bramkę (sample: routes:400,416,434,453,468,601,918,1002,1503,1924,2372,3863). **M20 NIE dzieli systemowego cross-org IDOR core'u** (zgodnie z notatką, M02/M25/M17/M18/M19 też czyste).

### ⚠️ 2 LUKI org-guard (real, węższe niż core)
1. **`POST /records/display-names` (`routes:2534`)** — brak guard. Przyjmuje dowolne `recordIds[]` (do 200) i woła `RelationService.getLinkedRecordDisplayNames` (`RelationService.ts:522`), które robi `SELECT … FROM tp_records WHERE r.id = ANY($1)` **BEZ filtra organization_id**. → dowolny zalogowany user może odczytać wartości primary-field (nazwy wyświetlane) rekordów z innych organizacji przez enumerację UUID. **Cross-org over-disclosure.**
2. **`POST|GET /tables/:tableId/row-policies` (`routes:4407,4434`)** — brak `requireTableAccess`/`requireRoles`. `RowPolicyService` filtruje tylko po `table_id` (`RowPolicyService.ts:89,162,178`), brak org-checku. → cross-org odczyt/zapis polityk wierszy po znajomości tableId.

### Public surface
- `PublicViewPage` / share widoku: `POST /views/:viewId/share` ma `requireViewAccess` (:3863) — tworzenie linku chronione. (Konsumpcja publicznego linku — do weryfikacji FAZA live, ale tworzenie OK.)
- Public slug formularzy: slug router żyje niezależnie od flag (backward-compat) — over-disclosure publicznego submita do osobnej weryfikacji live.

---

## PODSUMOWANIE SYGNAŁÓW
- **Rozjazd flag (4×):** AI Editor / QA / Source Pack / Conversion — komentarz "OFF until C-S*/D-S*", runtime `!== 'false'` = **ON**. Backend żywy bez env-vara.
- **Persistencja:** brak fasady `new Map()`. Wszystko na `tp_*` w Postgres, przeżywa restart.
- **Stub-fasada:** `ModuleSyncService.syncToModule` (publish-to-results / sync-to-finance) — zwraca success, ale nie pisze do modułu docelowego = MOCK-STUB (poz.13).
- **AI Editor applyProposal:** REALNY, nie stub.
- **Cross-org:** wzorzec org-guard SYSTEMOWY i czysty (115/193 tras, encja→base→org). 2 wąskie luki: `/records/display-names` (brak filtra org w `getLinkedRecordDisplayNames`) i `/tables/:tableId/row-policies` (brak guard + brak org-filtra w `RowPolicyService`).
