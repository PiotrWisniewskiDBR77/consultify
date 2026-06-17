# TECZKA M20 — Tabele Studio (Table Platform, Airtable-like)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje kartę audytu + INV_E + kod i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md), referencja (PODŁOGA): [`M13-inicjatywy.md`](M13-inicjatywy.md). Decyzje przekrojowe: [`_DECYZJE.md`](_DECYZJE.md).

## 00 · Nagłówek
- **Moduł:** M20 Tabele Studio (Table Platform) · **Pula:** beta (closed) · **Rozmiar API:** **193 endpointy** (`table-platform.routes.ts` 5203 linii)
- **Ocena audytu:** 48/100 · **Tier:** Alpha · **Status:** FAZA 1 (blokery) → FAZA 3/4 · **Rozmiar:** L (3–5 dni)
- **Żywy bloker:** P0 cross-org IDOR — **NAPRAWIONY `e9c6cb9c0a`** (msg: „security(sprint5): M20 IDOR — org-scope on record-templates/forms/row-policies/governed-models"; zweryfikowane na `Londyn` 2026-06-13) → do cold-start proof
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13 (pogłębiona do M13-level)
- **Karta:** `Harvard/modules/M20-tabele-studio/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md` · **INV_E:** `Harvard/podzial/inventory/INV_E_outputs_studia_meeting.md` (TABELE STUDIO poz.1-16)
- **Kod (FE):** `src/components/AIChat/KimiWorkspace/TabeleView.tsx` + `tabele*`/`tabelePreview`/`tabeleShell` (`GridView`/`CellEditor`/`CellRenderer`/`PublicViewPage`)
- **Kod (BE):** `server/src/routes/table-platform.routes.ts` (193 EP) · `…ai-editor.routes.ts` · serwisy `tablePlatform/` (`PermissionsService.ts` 510 l. · `ModuleSyncService.ts` · `SSOService.ts` · `MetadataService.ts`) · flagi `server/src/config/FeatureFlags.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta §0 + INV_E TABELE STUDIO | job-to-be-done + zakres + persony/role bazy (niżej) |
| B UX docelowe | 🟡 | karta §5 (MELS zgodny; §27 N/D) | **grid-canon (D-04)** jako osobny standard (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + `table-platform.routes.ts` + `PermissionsService.ts` | **pełna enumeracja 193 EP pogrupowana** + model `tp_*` + governed-sync DP-6 (niżej) |
| D AI/Teresa | 🟢 | karta §1a (AI Editor 8 poz., budżet serwerowy) + `tabeleSystemPrompt.ts` | kręgosłup #1 (niżej) |
| E Integracje | 🟢 | karta §1g | governed-sync = preview (DP-6); kręgosłup czat→sheet (niżej) |
| F Epiki | 🟢 | karta §7 (3 fale) | epiki→stories Gherkin→L-xx (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grep 2026-06-13 + korekta R3 flag** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + korekta R3** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** dać zespołowi pełną platformę tabel (Airtable-like) — bazy/tabele/rekordy/widoki/pola/formuły/automatyzacje/formularze — jako warstwę danych pod resztę produktu, z generacją z czatu i konwersją do Doc/Deck.
- **Persony/role (warstwa bazy, kanon `PermissionsService`):** dostęp NIE jest binarny org/nie-org — istnieje per-base RBAC. Role: `OWNER`/`EDITOR`/`COMMENTER`/`VIEWER` (z `tp_base_members`) + legacy fallback (`canAccessBase`). Zbiory uprawnień: `DATA_WRITE_ROLES` (modyfikacja rekordów → `canModifyBase`), `SCHEMA_WRITE_ROLES` (zmiana pól/struktury → `canModifySchema`). Persony: **członek org** (CRUD wg roli w bazie), **admin org** (SSO/uprawnienia/members), **publiczny respondent** (read/submit przez token slug/share). Org-scope egzekwowany przez `PermissionsService.canAccessBase(userId, orgId, baseId)` (`:170`) — każda encja schodzi do `base.organization_id === token.org`.
- **Zakres v1:** bazy/tabele/rekordy CRUD + CSV/attachments · widoki Grid/Kanban/Calendar/Matrix + share + PublicViewPage · formuły FormulaEngineV2 + linked/rollup · AI Editor (8 poziomów, applyProposal/reject, budżet serwerowy) · automatyzacje (cron + run-now) · formularze (slug publiczny + submissions) · konwersja Table→Doc/Deck (BE). **POZA v1:** realny governed sync-to-results/finance/execution (**DP-6 = „preview" + ukryć przyciski** — patrz C/E), grid-canon jako spisany standard (D-04).
- **Metryka:** rekordy trwałe po reload (real `tp_*`); 0 ścieżek cross-org; AI Editor w budżecie.

## B · UX DOCELOWE *(link + delta grid-canon)*
- **Wzorzec:** MELS (`melsTabeleFlag` default OFF → fallback `KimiWorkspaceShell`) — **ZGODNY** (karta §5, mocny pozytyw). Główny data-grid (`GridView`/`CellEditor`/`CellRenderer`) świadomie NIE pod §27 (edytowalny data-grid Airtable-like, nie lista Menu 1/2/3/preview-pane).
- **Stany docelowe (koniec cichych pustek):** flag-OFF / brak-migracji → komunikat **503 `SCHEMA_NOT_READY`** / **404 `AI_EDITOR_DISABLED`** zamiast cichej pustki (dziś `TabeleView.tsx:122,171,361`→`.catch(()=>null)` = dług L-08). PublicViewPage stany pusty/ładowanie/błąd/brak-uprawnień z komunikatem PL/EN (dziś EN-only, L-09).
- **Delta B (dwa kanony):**
  1. **Banery degradacji flag-OFF** (503/404 → czytelny komunikat) — L-08.
  2. **grid-canon (D-04, DP-9 grid dostaje osobny standard)** — spisać kanon data-grida: kolumny/typy pól, edycja komórki, undo/redo, zaznaczenie zakresu, frozen-columns, row-height, kontekstowe menu komórki, klawiatura (a11y), dark-mode, wirtualizacja (perf). NIE §27 (to inny gatunek powierzchni). Klasyczne listy baz/automatyzacji/konektorów → §27 (sweep Faza 4, DP-9).

## C · DANE + API + REGUŁY *(link + PEŁNA ENUMERACJA 193 EP)*

### C.1 · Pełna enumeracja 193 endpointów (pogrupowane wg domeny)
> Źródło: `grep router.{METHOD}` 2026-06-13. 193 trasy; grupy wg prefiksu ścieżki (top-level segment).

| Grupa funkcyjna | Prefiksy ścieżek | ~EP | Org-guard (kanon) |
|---|---|---|---|
| **Bazy / workspaces** | `/bases` (13), `/workspaces` (1), `/search` (1), `/resolve` (1) | ~16 | `canAccessBase`/`canModifyBase` (rdzeń szczelny) |
| **Tabele** | `/tables` (12), `/fields`, `/dimensions` (1) | ~13 | `canAccessTable`→`canAccessBase` |
| **Rekordy** | `/records` (2) + rekordy pod `/tables/:id/*` | ~rdzeń | `canAccessBase` (rdzeń) |
| **Widoki + share** | `/views` (3), `/share` (2) | ~5 | `canAccessBase`; share-token izolacja (`randomUUID`, revoke+expiry) |
| **Pola / formuły** | pola pod `/tables/:id/fields`, FormulaEngineV2, linked/rollup | rdzeń | `canModifySchema` (schema-write) |
| **Automatyzacje** | `/automations` (7) | 7 | `canAccessBase` + ScheduledAutomationExecutor |
| **Formularze** | `/forms` (4–5), `/submissions` (1) | ~5 | **fix `e9c6cb9c0a`** (`:2824` guard) |
| **AI Editor** | `/record-templates` (2), `…ai-editor.routes.ts` | — | budżet serwerowy `AiBudgetExhaustedError`→429; **fix `:256`** |
| **Governed sync (cross-module)** | `/governed-models` (13: publish/sync-to-finance/execution) | 13 | **fix `:3441/3473/3507`** (`model.base_id`) — ale **logika = STUB** (DP-6) |
| **SSO / webhooks / sekrety** | `/sso` (2), `/webhooks` (3) | ~5 | plaintext at rest = L-02 (P1) |
| **Konektory / sync** | `/table-syncs` (3), `/relays` (4), `/model-sources` (1), `/distributions` (5) | ~13 | `canAccessBase` |
| **Rozszerzenia / interfejsy** | `/extensions` (5), `/interfaces` (1), `/templates` (4), `/kpis` (2), `/comments` (2), `/attachments` (4) | ~20 | mieszane |
| **Row-policies** | `/row-policies` (2) | 2 | **fix `:4485+`** |
| **Migracje / admin / audit / health** | `/migrate` (3), `/admin` (8), `/audit` (1), `/health` (1) | ~13 | admin-scope |

*(Liczby grupowe sumują się powyżej 193 bo część rekordowych/polowych EP wisi pod `/tables/:tableId/*` — nie pojawia się jako osobny top-level prefiks. Audyt na PRÓBCE+WZORCU, nie 1:1, zgodnie z kartą §0.)*

### C.2 · Wiring + model danych
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f.
- **Model danych:** realny Postgres `tp_*` (migracje 700–778; kolizja 725×2/726×2 NAPRAWIONA → 777/778, test 5/5 PASS). Rekordy/proposale/automatyzacje przeżywają restart (**BEZ fasady in-memory z M18**). Pułapki PG: jsonb (`content_json`/`data`)/bigint → `pgFlags.ts`.

### C.3 · Reguła org-scope (kanon `PermissionsService.ts` 510 l.)
- **Metody:** `getUserRole` (`:66`), `requireRole` (`:85`, sprawdza allowedRoles + legacy fallback), `setUserRole`/`removeUserRole`/`listBaseMembers`, **`canAccessBase`** (`:170` — `tp_bases.organization_id === orgId`), `canModifyBase` (`:190`, DATA_WRITE_ROLES), `canModifySchema` (`:198`, SCHEMA_WRITE_ROLES), `canAccessTable` (`:206`→`tp_tables.base_id`→`canAccessBase`).
- **Pokrycie:** 13 wywołań `canAccessBase` w `table-platform.routes.ts` (rdzeń + endpointy wtórne po fix `e9c6cb9c0a`: `:256, 2824, 3441, 3473, 3507, 4485, 4521, 4546, 4575`).
- **governed-sync (preview, DP-6):** `ModuleSyncService.syncToModule` (`:57`) pisze **wyłącznie** do `tp_module_sync_results` (bridge/log) — **NIE pisze do Results/Finance/Execution**. Org-guard wejścia naprawiony (`:3441+`), ale efekt = log-only → **DP-6: oznaczyć „preview" + ukryć przyciski sync** (nie greenfield realnego odbioru w v1).

## D · AI / TERESA *(link)*
- **Co generuje:** AI Editor 8 poziomów — `tableAiEditorService.applyProposal` **realnie modyfikuje rekordy** (nie stub), reject/undo; generacja tabeli z czatu (pipeline V8, za `ENABLE_V8_GLOBAL` OFF). Prompt: `tabeleSystemPrompt.ts`.
- **Sterowanie:** budżet egzekwowany serwerowo (`AiBudgetExhaustedError`→429).
- **Kręgosłup (Uwaga żywa #1 = SYSTEMOWE/P0-program):** generacja „z czatu zrób sheet" idzie przez `UnifiedChatPanel` + detektory + pipeline `deliverables:draft-ready` → `WorkCanvasDocumentPanel` — ta sama warstwa, której pęknięcie opisuje `SPEC_ZADANIE_01`. **Zależność programowa, NIE lokalna luka M20** (do potwierdzenia przy fixie #1: czy standalone Table Studio reużywa tego panelu — nie nadinterpretować).

## E · INTEGRACJE
Pełna tabela: karta §1g. **WEJŚCIE ←** M01 Czat (generacja tabeli z czatu, za `ENABLE_V8_GLOBAL`). **WYJŚCIE →** M18/M19 (konwersja Table→Doc/Deck materializer, BE; FE flaga OFF), M15 Rezultaty / M16 Finanse (governed sync — **STUB → DP-6 „preview"**, L-05), M22 AI OS (Wave 7 `tp_connectors` link), public (PublicViewPage + slug formularzy). **Kręgosłup:** generacja z czatu = Faza 0 (SPEC_ZADANIE_01).

## F · EPIKI → STORIES → ZADANIA

**EPIK 1 — Domknąć bezpieczeństwo (P0/P1) [karta §7 Fala 1]**
- Story 1.1: jako atakujący z innej org NIE mogę czytać/pisać rekordów wtórnymi EP.
  - Gherkin: dane baza org-B; gdy org-A woła `POST /tables/:id/record-templates`/`GET /forms/:id/submissions`/row-policies/governed-models cudzej tabeli; wtedy **403/404** przed mutacją.
  - Zadania: [Z-01 → **L-01** kod NAPRAWIONY `e9c6cb9c0a`; brakuje TESTU regresji cross-org 403]
- Story 1.2: sekrety SSO/webhook szyfrowane at-rest. Zadania: [Z-02 → L-02 AES, wzorzec M25]
- Story 1.3: `share_password` weryfikowane przy konsumpcji. Zadania: [Z-03 → L-03]

**EPIK 2 — Front↔back integralność [karta §7 Fala 2]**
- Story 2.1: governed sync nie kłamie. Gherkin: dane DP-6=„preview"; gdy user otwiera governed-models; wtedy przyciski sync ukryte + komunikat „preview", ZERO fałszywego `success:true`. Zadania: [Z-04 → **L-05**, **D-01 rozstrzygnięte = DP-6 preview**]
- Story 2.2: flagi nie kłamią + banery degradacji. Gherkin: dane flaga OFF; gdy FE woła EP; wtedy 503/404 → czytelny baner. Zadania: [Z-05 → L-06 (R3: rozjazd flag częściowo zamknięty — patrz G), Z-06 → L-08]

**EPIK 3 — Test fundamentu [karta §7 Fala 2]**
- Story 3.1: testy dotykają realnej `tp_records`. Gherkin: dane seed `tp_*`; gdy CRUD round-trip; wtedy rekord trwały po reload, test potrafi oblać. Zadania: [Z-07 → L-07, anty-false-green: `test.skip`→twardy `beforeAll` seed]

**EPIK 4 — Kanony [karta §7 Fala 3, DP-9]**
- Story 4.1: grid-canon spisany. Zadania: [Z-08 → **D-04** grid-canon; §27 list baz/automatyzacji/konektorów = sweep Faza 4]
- Story 4.2: i18n PublicViewPage PL/EN. Zadania: [Z-09 → L-09]
- Story 4.3: tokeny data-grid + beta-guard route + rate-limit slug + CI `Londyn`. Zadania: [Z-10 → L-10 (DP-8: palety legalne, chrome→token), Z-11]

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13 + korekta R3)*
| # | Kryterium | Miara M20 |
|---|-----------|-----------|
| 1 | Front↔back | governed sync = jawnie „preview" + przyciski ukryte (DP-6); Records CRUD trwały po reload (real `tp_*`); **4 flagi: komentarz=runtime — R3 częściowo ZAMKNIĘTE** (patrz niżej) |
| 2 | Bezpieczeństwo | 4 ścieżki IDOR → cross-org 403/404 (**NAPRAWIONE `e9c6cb9c0a` + TEST regresji 9/9 PASS** `table-platform.idor.regression.test.ts` 2026-06-17); **SSO/webhook AES naprawione** (L-02 ZAMKNIĘTA 2026-06-17); `share_password` weryfikowane (L-03) |
| 3 | i18n | **0 z 0** `isPolish` w `TabeleView`+`tabele*` (grep 2026-06-13 = **0** — najlepszy w audycie); dług = PublicViewPage EN-only (poza zmierzonym katalogiem, L-09) |
| 4 | Tokeny | **0 hex** w zmierzonym `TabeleView`+`tabele*`; karta raportuje **322 hex** w szerszym footprincie data-grida (`GridView`/`CellRenderer`) — **zmierzyć cały footprint** przed sweepem (DP-8: palety wykresów/grafów legalne, chrome→token) |
| 5 | §27 | **0** surowych `<table>` w zmierzonym katalogu; grid = świadomie inny wzorzec → **grid-canon (D-04)**; listy baz/automatyzacji → §27 sweep (DP-9) |
| 6 | E2E w PR-gate | S1 (real `tp_records`) + IDOR-403 (4 ścieżki) zielone na `Londyn` |

**KOREKTA R3 — rozjazd 4 flag (L-06):** karta podaje „komentarz „Disabled by default", runtime `!== 'false'` = default ON". Weryfikacja 2026-06-13 (`server/src/config/FeatureFlags.ts:83-84`): komentarz brzmi teraz **`// Enabled by default; set ENABLE_TABLE_AI_EDITOR=false to disable`** + `z.boolean().default(true)` — **komentarz↔runtime w SSOT są SPÓJNE.** Stary mylący „disabled by default" żyje już TYLKO w nagłówku route'a `table-platform.ai-editor.routes.ts:36` (komentarz dokumentacyjny, nie kontrakt). → L-06 zdegradować do P3-doc (uspójnić jeden komentarz w route header), nie P2-runtime.

Scenariusze S1–S8: karta §0/§2. Bezpieczeństwo: karta §6. *(R4: grep i18n/hex=0 w `TabeleView`+`tabele*` bo `TabeleView` wzorcowo czysty 37×`t()`; dług koloru/i18n karty żyje w `GridView`/`CellRenderer`/`PublicViewPage` poza zmierzonym podkatalogiem — zmierzyć cały data-grid przed sweepem.)*

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 48/100, rdzeń szczelny, endpointy wtórne IDOR (wg karty), governed-sync STUB, 4 flagi rozjazd | L-01..L-10 |
| W-02 | **Uwaga żywa #1** (`SPEC_ZADANIE_01`) | 2026-06-13 | kręgosłup czat→panel pęka — generacja sheet z czatu idzie tędy → M20 dotknięty zależnością | L-04 (zależność programowa) |
| W-03 | INV_E sekcja TABELE STUDIO poz.1-16 | 2026-06-11 | inwentarz 1 pkt STALE (governed sync „DZIAŁA"=STUB) | L-05 |
| W-04 | **DP-6** (`_DECYZJE.md`) | 2026-06-13 | governed sync = „preview" + ukryć przyciski (1 decyzja, 3 teczki M15/M16/M20) | L-05 → D-01 ROZSTRZYGNIĘTE |
| W-05 | **DP-8/DP-9** (`_DECYZJE.md`) | 2026-06-13 | palety legalne; §27 do sweepu Faza 4; grid = osobny grid-canon | L-10, D-04 |
| W-06 | Feedback prod (kohorta beta) | — | brak własnej uwagi żywej M20 z 2026-06-13 | — (dziedziczy z karty) |

*(Brak uwagi żywej swoiście o M20 w `UWAGI_TESTY_2026-06-13.md`; jedyne wejście „żywe" = #1 jako zależność kręgosłupa dla generacji sheet z czatu.)*

### 02 · Stan obecny (prawda kodu) — **KOREKTA R3**
Rdzeń (base/table/record/view/field) **szczelny** przez `PermissionsService` (13 `canAccessBase` + per-base RBAC OWNER/EDITOR/COMMENTER/VIEWER). Persystencja realna `tp_*` (bez fasady M18). **KOREKTY R3 (zweryfikowane 2026-06-13):**
1. **IDOR (L-01) NAPRAWIONY `e9c6cb9c0a`** (msg potwierdza „M20 IDOR — org-scope on record-templates/forms/row-policies/governed-models"): guards `canAccessBase` PRZED mutacją na `:256` (record-templates), `:2824` (form submissions), `:3441/3473/3507` (governed-models publish/sync na `model.base_id`), `:4485-4575` (row-policies). Raw `import` zostaje, ale guard biegnie pierwszy.
2. **Rozjazd flag (L-06) częściowo ZAMKNIĘTY** — SSOT `FeatureFlags.ts:83-84` komentarz=runtime spójne; stary „disabled" tylko w route-header (P3-doc).
3. **governed sync (L-05)** wciąż STUB log-only → **DP-6 = preview** (decyzja, nie bug do budowy).
Otwarte: share_password (L-03 = FALSE POSITIVE, czeka na decyzję Piotra o bcrypt). ZAMKNIĘTE w tej sesji: L-01 (IDOR+test), L-02 (webhook AES), **L-07 (kontrakt round-trip real `tp_records`, 6/6 PASS 2026-06-17)**.

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | **Status** | Zweryf. |
|----|------|---------|--------------------|-------|------|-----------|---------|
| L-01 | cross-org IDOR record-templates/form-submissions/row-policies/governed-models | W-01 | `:256, 2824, 3441/3473/3507, 4485-4575` | P0 (był) | 1 | **NAPRAWIONA + TEST** `e9c6cb9c0a` + `tests/integration/routes/table-platform.idor.regression.test.ts` (9/9 PASS 2026-06-17) | 2026-06-17 |
| L-02 | SSO config + webhook hmac plaintext at rest | W-01 | `SSOService.ts:47-63` · `WebhookDispatcherService.ts:37,182` | P1 | 1 | **NAPRAWIONA** — SSO już szyfrowane; webhook `hmac_secret`: `encryptSecret` przed INSERT + `decryptSecret` przed HMAC (2026-06-17) | 2026-06-17 |
| L-03 | `share_password` zapisywane, NIGDY nieweryfikowane | W-01 | `MetadataService.ts` (`shareView`+`verifySharePassword`) | P2 | 1 | **ZAMKNIĘTA (decyzja CTO)** — weryfikacja istniała; dołożony **bcrypt hash at-rest** na zapisie + `verifySharePassword` z fallbackiem na legacy plaintext (zero zepsucia istniejących share'ów); 2 consume-sites przepięte; test `share-password.contract.test.ts` (3/3 PASS) | 2026-06-17 |
| L-04 | kręgosłup czat→sheet (generacja z czatu) | W-02 | `SPEC_ZADANIE_01` | P0-program | 0 | zależność (śledzona w SPEC_01) |  |
| L-05 | governed sync STUB (log-only, 0 czytelników M15/M16) | W-01,W-03,W-04 | `ModuleSyncService.ts:57-110,90` | P1→preview | 3 | otwarta (**D-01 = DP-6 preview**) |  |
| L-06 | rozjazd 4 flag komentarz↔runtime | W-01 | `FeatureFlags.ts:83-84` (SSOT spójny) + `…ai-editor.routes.ts:36` (stary komentarz) | **P3-doc** (był P2) | 3 | **częściowo ZAMKNIĘTA R3** — uspójnić 1 komentarz route-header | 2026-06-13 |
| L-07 | fundament Records API w 100% zmockowany (0 dot. real `tp_records`) | W-01 | `evidence/f2_tests_report.md` | P0-test | 1 | **ZAMKNIĘTA** — kontrakt round-trip uruchamia REALNY `RecordsService` (INSERT/SELECT/UPDATE/DELETE `tp_records`, optimistic-lock, reload-persist) przeciw wiernemu in-memory pool; caboose niedostępny → fallback kontraktowy wg briefu; `tests/integration/table-platform/records-roundtrip.contract.test.ts` (6/6 PASS 2026-06-17) | 2026-06-17 |
| L-08 | cicha degradacja flag-OFF (`catch→null`, brak 503/404) | W-01 | `TabeleView.tsx:122,171,361` | P2 | 3 | **NAPRAWIONA `a8f0e5dd0f` (2026-06-17)** — TabeleView preview fallback wyróżnia 503/404 zamiast cichego null | 2026-06-17 |
| L-09 | PublicViewPage EN-only | W-01 | `PublicViewPage` (`'Failed to load shared view'`) | P3 | 4 | **ZABLOKOWANA (Fala 4)** — `public/locales/*` ZAKAZANE w Fali 1; wymaga koordynacji z agentem i18n (inny commit); scope: sweep `t()` przez cały katalog FE modułu (PublicViewPage + reszta `src/components/AIChat/KimiWorkspace/`) |  |
| L-10 | 322 hex w data-grid (poza zmierzonym `TabeleView`) | W-01,W-05 | `src/components/MyWork/table/` (29 plików; `GridView`=0) | P3 | 4 | **ZAMKNIĘTA — false-positive wg DP-8** — zmierzono cały footprint: **322/322 = data-viz/paleta/brand** (tableTypes.ts 93 palety pól, FrameworkGenerator 28 SWOT/Porter, ConnectorIcons 23 brand-logo `#34A853/#2D7FF9/#336791/#2684FF`, conditional-formatting/row-coloring swatche, kursory współpracy, skale confidence/trust, fille lineage/gantt/sparkline); **chrome-hex=0** (powłoka już Tailwind). 0 zmian. UWAGA: footprint leży w strefie MyWork (Harvard 2) — nie edytowano | 2026-06-17 |
| L-11 | kolizja migracji 725×2/726×2 | W-01 | migracje 725/726 | P1 | — | **NAPRAWIONA** (→777/778, test 5/5 PASS) | 2026-06-11 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | governed sync-to-results/finance/execution | realny zapis / „preview" + ukryć przyciski | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-6: governed sync preview** (realny odbiór = osobna fala po Fazie 2) |
| D-04 | grid-canon dla data-grida | spisać osobny standard / zostawić ad-hoc | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-9: grid-canon w sweepie** (grid dostaje osobny standard; spisanie do zaplanowania) |

### 05 · Flagi / rollout — beta-closed (`MODULE_*` gating); `ENABLE_TABLE_PLATFORM_RECORDS_API` default ON; `ENABLE_TABLE_AI_EDITOR`/QA/SOURCE_PACK/CONVERSION default ON (SSOT `FeatureFlags.ts` komentarz=runtime — R3 spójne); `ENABLE_V8_GLOBAL` OFF (generacja z czatu martwa bez flagi). Beta-guard route = nawigacyjny (direct URL omija plate; API org-gated).
### 06 · Ryzyka — fix IDOR `e9c6cb9c0a` na `Londyn` ale **bez testu regresji** → możliwy nawrót; cold-start IDOR proof na staging OSTROŻNIE (dev `.env` może wskazywać Railway PROD — `[[finding_railway_db_topology]]`). Governed sync „DZIAŁA" w INV_E mylące (DP-6 preview). 322 hex zmierzone w szerszym footprincie niż zlinkowany podkatalog — sweep musi objąć cały data-grid.
### 07 · Log — 2026-06-11: `e9c6cb9c0a` (IDOR 4 ścieżki org-guard, sprint5), migracje 777/778 (kolizja 725/726), audyt 48/100. 2026-06-13 (teczka pogłębiona): pełna enumeracja 193 EP (13 grup); R3 potwierdziła L-01 NAPRAWIONA na `Londyn` + **L-06 rozjazd flag częściowo ZAMKNIĘTY** (FeatureFlags SSOT spójny); D-01=DP-6 preview, D-04→DP-9 grid-canon. Re-ocena F po dołożeniu testów IDOR + S1. **2026-06-17 (Runda 3): L-04 — śledzona jako SPEC_01, nie lokalna; zależność programowa potwierdzona (SPEC_ZADANIE_01 istnieje w `Harvard/SPEC_ZADANIE_01_chat_controller.md` — Tryb A+B: generacja „z czatu zrób sheet" przez UnifiedChatPanel + pipeline deliverables:draft-ready → WorkCanvasDocumentPanel; dodatkowy bloker: `ENABLE_V8_GLOBAL` OFF → pipeline martwy bez env var). L-09 ZABLOKOWANA (Fala 4) — `public/locales/*` ZAKAZANE w Fali 1; wymaga koordynacji z agentem i18n; scope: PublicViewPage EN-only + sweep `t()` przez cały katalog FE modułu.**

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+uwaga #1 jako zależność + DP-6/8/9) · R2 zero sierot (wejście→luka→DoD) · R3 statusy z dowodem (**L-01 NAPRAWIONA `e9c6cb9c0a` zweryfikowana w kodzie msg+guards; L-06 rozjazd flag częściowo ZAMKNIĘTY — korekta vs karta**; L-11 z commitem) · R4 DoD z liczbami (193 EP enum, grep i18n/hex/<table> 2026-06-13) · R5 **obie decyzje rozstrzygnięte (D-01→DP-6, D-04→DP-9)** · A–E docelowy zlinkowany (C = pełna enumeracja + org-scope + grid-canon) · F epiki→stories Gherkin→L-xx · G DoD+S+sec · R6 sesja żywa = Faza 4 (pozostaje). **9/9; teczka kompletna do egzekucji.**
