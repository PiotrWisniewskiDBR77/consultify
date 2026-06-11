# M20 — Tabele Studio — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `f5bb1f3f8c`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M20 · inwentarz `Harvard/podzial/inventory/INV_E_outputs_studia_meeting.md` (sekcja TABELE STUDIO, poz.1-16) · poprzednia karta `docs/audit/2026-06-02/MODULE_11_tabele.md` (44/100)
**Evidence:** `Harvard/modules/M20-tabele-studio/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests*.log, f56_kanon_sec.md)

## OCENA: 43/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 19 | Rdzeń realny (records/CRUD/widoki/formuły/AI-editor/automatyzacje na realnych `tp_*`, bez fasady M18), ale governed sync-to-results/finance = STUB (pisze tylko wiersz-log) + rozjazd 4 flag komentarz↔runtime. |
| B. Wiring i dane | 15 | 9 | Realny Postgres `tp_*` (8 migracji), ale **kolizja numerów migracji 725×2/726×2** (realny bug danych) + governed-sync fake + flagi mylące. |
| C. Testy automatyczne | 15 | 7 | 894 PASS/9 FAIL, ale **fundament Records API w 100% zmockowany** (żaden test nie dotyka realnej `tp_records`), E2E fałszywa zieleń (`test.skip` na 404/no-token); nic w PR-gate. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 6 | MELS zgodny, `TabeleView` i18n czyste (37× `t()`, najlepsze), ale §27 N/D (data-grid bez własnego kanonu), PublicViewPage EN-only, cicha degradacja flag-OFF (`catch→null`), 322 hardkody hex. |
| F. Bezpieczeństwo/dostęp | 10 | 2 | Rdzeń (base/table/record) szczelny przez `PermissionsService`, ale **cross-org IDOR read+write na endpointach „dosadzonych"** (record-templates, form submissions, row-policies, cross-module writes) + SSO plaintext + share_password nigdy nieweryfikowane. |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **TAK — cross-org WRITE `POST /tables/:tableId/record-templates` (`:4823` INSERT do `tp_records` po tableId z URL, bez org/permission) → max 50 + P0.** Zweryfikowane osobiście. Suma surowa 43 < 50, wiąże suma. Dodatkowo Faza 4 niewykonana → max 70 + „NIEPEŁNY". |

**Werdykt jednym akapitem:** Najpotężniejszy funkcjonalnie moduł beta (platforma tabel Airtable-like, 193 endpointy) i **pierwszy moduł beta, który łamie podwzorzec „beta = czysta"** — ale w sposób zniuansowany. Rdzeń (bazy/tabele/rekordy/widoki/pola) jest realny i **dobrze zabezpieczony**: persystencja na realnym Postgresie `tp_*` (8 migracji 700-726, BEZ fasady in-memory z M18 — records/proposals/automatyzacje przeżywają restart), a `PermissionsService` daje spójny org-guard (każda encja → base → `tp_bases.organization_id === token.org`, pokrycie ~115/193 tras; AI Editor budżet tokenów egzekwowany serwerowo `AiBudgetExhaustedError`→429). **Ale cluster endpointów „dosadzonych później" omija `PermissionsService` i uderza w DB raw** — to realny, systemowy cross-org IDOR read+write, zweryfikowany osobiście: `GET/POST/PATCH /tables/:tableId/record-templates` (`table-platform.routes.ts:4802,4823,4840`) robi `import('../database/Database.js')` i `INSERT INTO tp_records (..., table_id, data) VALUES (..., $1, $2)` z `tableId` prosto z URL — **bez org, bez base-access** → atakujący wstawia/czyta/modyfikuje rekordy w dowolnej tabeli dowolnej org po UUID; `GET /forms/:formId/submissions` (`:2804`) przekazuje `formId` do `FormService.getSubmissions` bez scope'u → **cross-org wyciek PII zgłoszeń formularzy**; analogicznie `row-policies` (`:4407`), `governed-models` cross-module writes `publish-to-results`/`sync-to-finance` (`:3413,3440` keyed tylko `:modelId`). To uruchamia hard-cap (cross-org write → P0, max 50). Dodatkowo: **rozjazd 4 flag** (`ENABLE_TABLE_AI_EDITOR`/`QA_ENGINE`/`SOURCE_PACK`/`ARTIFACT_CONVERSION` — komentarz „Disabled by default", runtime `!== 'false'` = **default ON**; `FeatureFlags.ts:85-103`) — funkcje „niegotowe wg komentarza" są realnie osiągalne przez API; **governed sync-to-results/finance to STUB** (`ModuleSyncService.syncToModule:57-110` zapisuje wiersz-log do `tp_module_sync_results`, zwraca `success:true`, ale NIE pisze do Results/Finance — „real call fake feature"); **SSO config plaintext at rest** (`SSOService:47-63` `clientSecret`/SAML cert bez szyfrowania — P1, wzorzec M25); **share_password zapisywane ale NIGDY nieweryfikowane** (`MetadataService:1279` — widoki „chronione hasłem" są otwarte, P2); **kolizja numerów migracji** 725×2/726×2 (P1, realny dług). Sufit oceny: cross-org write (hard cap 50) + niewykonane Fazy 3+4.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_E sekcja TABELE STUDIO, poz.1-16 (193 endpointy — audyt na PRÓBCE+WZORCU, nie 1:1).
**Scenariusze krytyczne (8):**
1. **S1** — Records API CRUD (fundament).
2. **S2** — Generacja tabeli z czatu (pipeline V8 → `tp_*`).
3. **S3** — Widoki Grid/Kanban/Calendar/Matrix + share + PublicViewPage.
4. **S4** — Formuły FormulaEngineV2 + linked records/rollupy.
5. **S5** — AI Editor (8 poziomów) applyProposal/reject + budżet.
6. **S6** — Konwersja Table→Doc/Deck (materializer).
7. **S7** — Automatyzacje run-now/cron.
8. **S8** — Formularze publiczny slug + submissions.
**Obowiązujące kanony:** §27 — **częściowo** (data-grid to inny wzorzec; klasyczne listy baz/automatyzacji/konektorów) · CARD_CONTENT_FORMULA: **N/D** · wzorzec: **MELS** (default OFF, fallback KimiWorkspaceShell) · gating: beta-closed + wiele flag funkcyjnych.

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Werdykty: **REALNE 11 · za flagami 4 (realne BE) · STUB 1 (governed sync).**

### 1a. REALNE (zweryfikowane)
- Records API (default ON, schema-check 503), workspaces/bazy/tabele CRUD+CSV+attachments, widoki Grid/Kanban/Calendar/Matrix+share, edytor komórek/formuły/linked/rollup/undo/realtime, **AI Editor applyProposal (realnie modyfikuje rekordy, nie stub)**, automatyzacje (DB + ScheduledAutomationExecutor), eksporty CSV/XLSX/JSON, konwersja Table→Doc/Deck (BE), formularze slug. Wszystko na realnym `tp_*` (Postgres).

### 1b. MOCK / STUB / fabrykowane
- **[P1] Governed sync-to-results/finance/execution STUB** — `ModuleSyncService.syncToModule:57-110` pisze wiersz-log do `tp_module_sync_results`, zwraca `success:true`, **NIE pisze do modułu docelowego**. „Real call fake feature".

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- **[P2] Rozjazd 4 flag komentarz↔runtime** — `ENABLE_TABLE_AI_EDITOR`/`QA_ENGINE`/`SOURCE_PACK`/`ARTIFACT_CONVERSION` (`FeatureFlags.ts:85-103`): komentarz „Disabled by default", runtime `!== 'false'` = **default ON**. FE chowa UI (QA/SourcePack/Conversions default OFF), ale BE żywe → osiągalne API.
- **[P2] Cicha degradacja flag-OFF** — FE nie obsługuje 503 `SCHEMA_NOT_READY`/404 `AI_EDITOR_DISABLED` (`TabeleView.tsx:122,171,361`→`.catch(()=>null)`) → niema pustka.

### 1d. UKRYTE / MARTWY KOD
- Record provenance (poz.16), MELS shell (poz.15), templateLifecycle (poz.1) — za flagami OFF (świadome).

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Records CRUD | `table-platform.routes.ts` (records) | tp_records | 700+ | DZIAŁA (real, org-scoped przez PermissionsService) |
| AI Editor | `tableAiEditorService.applyProposal` | tp_* + proposals | tak | DZIAŁA (budżet serwerowy) |
| Automatyzacje | ScheduledAutomationExecutor | tp_automations/runs | tak | DZIAŁA (real) |
| Konwersja Table→Doc/Deck | materializer | artifact_registry | tak | DZIAŁA (BE; FE flaga OFF) |
| Record-templates | raw DB (`:4802-4849`) | tp_records | — | **cross-org IDOR (P0/P1)** |
| Governed sync | `ModuleSyncService:57` | tp_module_sync_results | 725 | **STUB (nie pisze do celu)** |

### 1f. Flagi (realne defaulty RUNTIME — KLUCZOWE)
| Flaga | Komentarz | Runtime default | Wpływ |
|---|---|---|---|
| `ENABLE_TABLE_PLATFORM_RECORDS_API` | — | **ON** (`:75`) | fundament; 503 przed migracjami |
| `ENABLE_TABLE_AI_EDITOR` | „OFF" | **ON** (`:85` `!=='false'`) | **rozjazd** — BE żywe |
| `ENABLE_TABLE_QA_ENGINE` | „OFF" | **ON** (`:91`) | **rozjazd** — FE chowa, BE żywe |
| `ENABLE_TABLE_SOURCE_PACK` | „OFF" | **ON** (`:97`) | **rozjazd** |
| `ENABLE_TABLE_ARTIFACT_CONVERSION` | „OFF" | **ON** (`:103`) | **rozjazd** |
| `ENABLE_RECORD_PROVENANCE` | OFF | **OFF** (`:80`) | zgodne |
| `ENABLE_TABLE_FORM_INTAKE_JWT` | OFF | **OFF** (`:110`) | zgodne |
| `ENABLE_V8_GLOBAL` | OFF | **OFF** (`:113`) | generacja z czatu martwa bez flagi |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Status |
|---|---|---|---|
| WEJŚCIE ← | M01 Czat | generacja tabeli z czatu (pipeline V8) | DZIAŁA (za flagą) |
| WYJŚCIE → | M18/M19 | konwersja Table→Doc/Deck (materializer) | DZIAŁA (BE) |
| WYJŚCIE → | M15 Rezultaty / M16 Finanse | governed sync (publish-to-results/sync-to-finance) | **STUB + cross-org (P1)** |
| WYJŚCIE → | public | PublicViewPage (share widoku), slug formularzy | DZIAŁA (izolacja danych OK; share_password fikcyjne) |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · logi: `f2_tests_be.log`, `f2_tests_be_rootcwd.log`, `f2_tests_fe.log`.
**Uruchomienie (lokalnie @ `f5bb1f3f8c`):** **894 PASS / 9 realnych FAIL** (+9 fałszywych awarii cwd-coupling — znikają przy cwd=repo-root).
**Root-cause realnych FAIL:** 8 mock-drift; **1 = kolizja numerów migracji** `ModuleSyncService › 725` (DWA pliki `725_*` + DWA `726_*`, `readdirSync` krucha kolejność — **realny bug danych, nie testu**); 1 FE flag-drift.
**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | PR-gate | Luka |
|---|---|---|---|---|---|
| S1 Records CRUD | mock API | RecordsService (11) | false-green | ✗ | **DB 100% zmockowane — żaden test nie dotyka `tp_records`** |
| S2 generacja V8 | częśc. | smoke (FAIL) | false-green | ✗ | brak dedykowanego testu pipeline |
| S3 widoki+share | częśc. | częśc. | false-green | ✗ | viewer/token |
| S4 formuły | ✓ | FormulaEngineV2 | — | ✗ | — |
| S5 AI Editor | flag ON | budżet | — | ✗ | default-OFF nietestowany |
| S6 konwersja | — | częśc. | — | ✗ | — |
| S7 automatyzacje | — | ✓ | — | ✗ | — |
| S8 formularze | — | częśc. | — | ✗ | submissions org-scope |

**Pułapki:** **S1 fundament — DB w 100% zmockowany** (żaden test nie uderza w realną `tp_records`); **E2E false-green** — `crud/views/chat-to-schema.spec.ts` mają `test.skip()` na braku tokena/404 + asercje `<500` → strukturalnie nie potrafią oblać (wzorzec M19); **ścieżka flag-OFF nietestowana** (testy `forceEnableForTesting:true`). **CI:** `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate M20 ≈ 0.
**Backlog testowy:** [P0] integracja na realnej `tp_records` (S1 fundament); [P1] B4 usunąć kolizję migracji 725×2/726×2; [P1] testy org-guard na record-templates/form-submissions/row-policies (cross-org 403); [P2] B9 refactor E2E anty-false-green (twardy `beforeAll` seed zamiast `test.skip`).

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Smoke: records CRUD (ON), generacja (V8), widoki+share, AI Editor, automatyzacje, **próba cross-org na record-templates/form-submissions** (potwierdzić IDOR na żywo — ostrożnie, read-only!). **Kluczowe:** czy migracje `tp_*` (700-726) zastosowane mimo kolizji numerów 725/726; wartości flag (zwł. rozjazd AI_EDITOR/QA/SourcePack/Conversion default ON na prod?). **Uwaga DB:** dev `.env` może wskazywać Railway PROD.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 8 scenariuszy; szczególnie: S1 records po reload (trwałość — oczekiwane TAK, real DB), cross-org IDOR record-templates/form-submissions (read-only proof), flag-OFF degradacja (czy niema pustka), share_password (czy „chroniony" widok otwiera się bez hasła — P2).
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S8 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27:** moduł NIE ma klasycznych tabel-list pod §27 A-S; główny grid (`GridView`/`CellEditor`/`CellRenderer`) to świadomie inny wzorzec (edytowalny data-grid Airtable-like, brak Menu 1/2/3/preview-pane). Listy baz/automatyzacji/konektorów = panele/buildery. **§27 nie aplikuje — brakuje osobnego grid-canon (luka standardu).**
**MELS:** **ZGODNY** (mocny pozytyw) — `melsTabeleFlag` default OFF, fallback `KimiWorkspaceShell`, adapter na tym samym pipeline.
**i18n:** `TabeleView` **czysty** (37× `t()`, 0× `isPolish` — najlepszy w audycie); `PublicViewPage` EN-only (`'Failed to load shared view'` hardkod) — **P3**.
**Stany:** `EmptyStateView`/`ViewErrorBoundary` obecne, ale **P2 cicha degradacja** — FE nie obsługuje 503/404 (`catch→null`) → niema pustka przy flagach OFF.
**UI:** **P3** 322 hardkody hex.
**CARD_CONTENT_FORMULA:** N/D.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`. **Rdzeń szczelny; dziury w endpointach „dosadzonych" + sekrety.**
| Warstwa | Stan | Dowód |
|---|---|---|
| Org-scope rdzeń (base/table/record/view/field) | SZCZELNY | `PermissionsService.ts:180` (`base.organization_id === orgId`), ~115/193 tras |
| Endpointy wtórne (record-templates, submissions, row-policies, governed) | **DZIURAWE** | raw DB bez org |
| AI Editor budżet | egzekwowany | `AiBudgetExhaustedError`→429 |
| Public view share | izolacja danych OK | token `randomUUID`, revoke+expiry; payload nie `{...row}` |

**Findingi:**
- **[P0/P1] cross-org IDOR read+write — record-templates** — `GET/POST/PATCH /tables/:tableId/record-templates` (`table-platform.routes.ts:4802,4823,4840`) raw DB, `INSERT INTO tp_records ... VALUES (..., $1=tableId-z-URL, $2)` bez org/permission. **Zweryfikowane osobiście.** Cross-org write → hard cap. Fix: przepuścić przez `PermissionsService.canAccessBase`.
- **[P1] cross-org read PII — form submissions** — `GET /forms/:formId/submissions` (`:2804`) → `FormService.getSubmissions(formId)` bez scope'u. **Zweryfikowane osobiście** (route nie przekazuje org/user). Wyciek zgłoszeń formularzy cross-org.
- **[P1] cross-org — row-policies** (`:4407/4434`), **cross-module write governed-models** `publish-to-results`/`sync-to-finance`/`sync-to-execution` (`:3413,3440,3469` keyed tylko `:modelId`).
- **[P1] SSO config plaintext at rest** — `SSOService:47-63` `tp_sso_configs.config=JSON.stringify` z `clientSecret`/SAML cert bez encrypt (wzorzec M25).
- **[P2] share_password zapisywane, NIGDY nieweryfikowane** — `MetadataService:1279` → widoki „chronione hasłem" otwarte.
- **[P2] webhook `hmac_secret` plaintext**; **[P2] beta-lock tylko nawigacyjny** (direct URL omija); **[P3] slug-router formularzy bez rate-limit**.

**OK/pozytywy:** rdzeń org-scoped (PermissionsService — wzorzec referencyjny); AI budżet serwerowy; service-account+SCIM tokeny hashowane; persistencja realna (bez fasady M18); view-share token nieenumerowalny.

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P0/P1)
1. **Org-guard na endpointy wtórne** — record-templates (`:4802-4849`), form submissions (`:2804`), row-policies (`:4407`), governed-models cross-module (`:3413-3469`) przez `PermissionsService.canAccessBase`/scope org — Weryfikacja: cross-org read/write/sync → 403/404; testy IDOR.
2. **Szyfrowanie SSO config + webhook secret** at rest — Weryfikacja: brak plaintext `clientSecret`/SAML/hmac w `tp_sso_configs`/webhooks.
3. **Weryfikacja `share_password`** przy konsumpcji widoku (lub usunąć obietnicę hasła) — Weryfikacja: „chroniony" widok wymaga hasła.
4. **Usunąć kolizję migracji** 725×2/726×2 + test ModuleSync — Weryfikacja: unikalne numery, test deterministyczny.

### Fala 2 — Domknięcie wartości (P1/P2)
1. **Governed sync realny** — `syncToModule` faktycznie pisze do Results/Finance/Execution (nie tylko log) lub jawnie oznaczyć „preview" — Weryfikacja: rekord pojawia się w module docelowym.
2. **Uspójnić 4 flagi** (komentarz vs runtime ON) + obsłużyć 503/404 na FE (baner zamiast `catch→null`) — Weryfikacja: komentarz=runtime; flaga OFF → komunikat.
3. **Test fundamentu na realnej `tp_records`** (S1) + anty-false-green E2E — Weryfikacja: testy dotykają DB, potrafią oblać.

### Fala 3 — Jakość i kanony (P2/P3)
1. **Grid-canon** dla data-grida (osobny standard) + §27 dla list baz/automatyzacji — Weryfikacja: spisany kanon, zgodność.
2. **i18n PublicViewPage** + tokeny kolorów (322 hex) — Weryfikacja: PL/EN, lint czysty.
3. **Beta-guard na route** + rate-limit slug formularzy — Weryfikacja: direct URL → plate; limit działa.
4. **CI** — testy server/ + `pull_request:[Londyn]` (systemowe) — Weryfikacja: biegnie na PR.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. S1 realny DB, IDOR wtórne) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracje (bez kolizji 725/726) + flagi udokumentowane + smoke 200 + czyste logi
- [ ] 4. Kanony: grid-canon, i18n PublicViewPage, tokeny kolorów
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (governed sync, share_password, rozjazd flag)
- [ ] 6. Zero cichych degradacji bez komunikatu (503/404 flag-OFF)

---
**Pozostałe do domknięcia audytu M20:** Faza 3 (Railway) + Faza 4 (żywe 8 scenariuszy). **Blocker P0: cross-org write record-templates** (hard cap 50). Ważny niuans systemowy: M20 to NIE jednolicie czysta beta — rdzeń (PermissionsService) szczelny, ale endpointy „dosadzone później" (raw DB) wprowadzają IDOR szerszy niż w niektórych modułach core. Inwentarz w 1 punkcie STALE (governed sync „DZIAŁA" = STUB) — zaktualizować INV_E.
