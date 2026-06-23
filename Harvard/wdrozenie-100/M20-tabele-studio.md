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
| L-04 | kręgosłup czat→sheet (generacja z czatu) | W-02 | `SPEC_ZADANIE_01` | P0-program | 0 | **NAPRAWIONA-SPEC_01 2026-06-17 `a6aea8d2d5`+`e7bd755b04`** — Tryb A function-calling: Teresa woła `generate_deliverable(type:sheet)`→`plan/start` (planSheet)→SSE `deliverable`→montaż sheet (kind='table') w canvasie. Testy 6/6. Żywe S-A E2E (auth+LLM staging) pending. | |
| L-05 | governed sync STUB (log-only, 0 czytelników M15/M16) | W-01,W-03,W-04 | `ModuleSyncService.ts:57-110,90` | P1→preview | 3 | **PODGLĄD-DP6 (backlog v1.1)** — governed sync = **STUB log-only** (`syncToModule` pisze WYŁĄCZNIE `INSERT INTO tp_module_sync_results` `:90/:122` — tabela-bridge/log; ZERO zapisu do Results/Finance/Execution; zweryfikowane w kodzie 2026-06-19) — świadoma decyzja architektoniczna (DP-6, backlog v1.1); aktualne zachowanie = poprawny placeholder. **(skoryg. 2026-06-19: STUB NIE udaje sukcesu — log-only, bez fałszywego `success:true` udającego realny odbiór; DP-6 nakazuje oznaczyć „preview" + ukryć przyciski sync w UI.)** D-01 rozstrzygnięte: NIE implementować teraz | 2026-06-17 |
| L-06 | rozjazd 4 flag komentarz↔runtime | W-01 | `FeatureFlags.ts:83-84` (SSOT spójny) + `…ai-editor.routes.ts:36` (stary komentarz) | **P3-doc** (był P2) | 3 | **częściowo ZAMKNIĘTA R3** — uspójnić 1 komentarz route-header | 2026-06-13 |
| L-07 | fundament Records API w 100% zmockowany (0 dot. real `tp_records`) | W-01 | `evidence/f2_tests_report.md` | P0-test | 1 | **ZAMKNIĘTA** — kontrakt round-trip uruchamia REALNY `RecordsService` (INSERT/SELECT/UPDATE/DELETE `tp_records`, optimistic-lock, reload-persist) przeciw wiernemu in-memory pool; caboose niedostępny → fallback kontraktowy wg briefu; `tests/integration/table-platform/records-roundtrip.contract.test.ts` (6/6 PASS 2026-06-17) | 2026-06-17 |
| L-08 | cicha degradacja flag-OFF (`catch→null`, brak 503/404) | W-01 | `TabeleView.tsx:122,171,361` | P2 | 3 | **NAPRAWIONA `a8f0e5dd0f` (2026-06-17)** — TabeleView preview fallback wyróżnia 503/404 zamiast cichego null | 2026-06-17 |
| L-09 | PublicViewPage EN-only | W-01 | `PublicViewPage` (`'Failed to load shared view'`) | P3 | 4 | **CZĘŚCIOWO ZAMKNIĘTA** — PublicViewPage: 9 kluczy `isPolish`→`t('table.*')` z `useTranslation` (`d6fa2fa721`). Reszta KimiWorkspace/ = ZABLOKOWANA (Fala 4; `public/locales/*` ZAKAZANE) | 2026-06-17 |
| L-10 | 322 hex w data-grid (poza zmierzonym `TabeleView`) | W-01,W-05 | `src/components/MyWork/table/` (29 plików; `GridView`=0) | P3 | 4 | **ZAMKNIĘTA — false-positive wg DP-8** — zmierzono cały footprint: **322/322 = data-viz/paleta/brand** (tableTypes.ts 93 palety pól, FrameworkGenerator 28 SWOT/Porter, ConnectorIcons 23 brand-logo `#34A853/#2D7FF9/#336791/#2684FF`, conditional-formatting/row-coloring swatche, kursory współpracy, skale confidence/trust, fille lineage/gantt/sparkline); **chrome-hex=0** (powłoka już Tailwind). 0 zmian. UWAGA: footprint leży w strefie MyWork (Harvard 2) — nie edytowano | 2026-06-17 |
| L-11 | kolizja migracji 725×2/726×2 | W-01 | migracje 725/726 | P1 | — | **NAPRAWIONA** (→777/778, test 5/5 PASS) | 2026-06-11 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | governed sync-to-results/finance/execution | realny zapis / „preview" + ukryć przyciski | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE 2026-06-17 → PODGLĄD-DP6 backlog v1.1** — governed sync STUB (log-only) = poprawny placeholder; implementacja governed→preview event planowana na v1.1; NIE implementować teraz \| Piotr |
| D-04 | grid-canon dla data-grida | spisać osobny standard / zostawić ad-hoc | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-9: grid-canon w sweepie** (grid dostaje osobny standard; spisanie do zaplanowania) |

### 05 · Flagi / rollout — beta-closed (`MODULE_*` gating); `ENABLE_TABLE_PLATFORM_RECORDS_API` default ON; `ENABLE_TABLE_AI_EDITOR`/QA/SOURCE_PACK/CONVERSION default ON (SSOT `FeatureFlags.ts` komentarz=runtime — R3 spójne); `ENABLE_V8_GLOBAL` OFF (generacja z czatu martwa bez flagi). Beta-guard route = nawigacyjny (direct URL omija plate; API org-gated).
### 06 · Ryzyka — fix IDOR `e9c6cb9c0a` na `Londyn` ale **bez testu regresji** → możliwy nawrót; cold-start IDOR proof na staging OSTROŻNIE (dev `.env` może wskazywać Railway PROD — `[[finding_railway_db_topology]]`). Governed sync „DZIAŁA" w INV_E mylące (DP-6 preview). 322 hex zmierzone w szerszym footprincie niż zlinkowany podkatalog — sweep musi objąć cały data-grid.
### 07 · Log — 2026-06-17 (Harvard 4 Fala 5): i18n sweep M20 — **`PublicViewPage.tsx` 9 kluczy `isPolish` → `t('table.*')`** (Failed to load shared view, Incorrect password, Password protected, Enter password to view, enterPasswordPlaceholder, Verifying, View table, View unavailable, Shared view is read-only); `useTranslation` import + `const { t }` dodane; `keys_M20.json` = 9 kluczy z PL+EN. L-09 i18n — **PublicViewPage ZAMKNIĘTA** (9 kluczy); locales sweep reszty KimiWorkspace/ = ZABLOKOWANA (Fala 4; locales poza strefą). Commit: `d6fa2fa721` (razem z M19). — 2026-06-17 (Runda 4): L-05 ZAMKNIĘTA jako PODGLĄD-DP6 (backlog v1.1) — D-01 rozstrzygnięte przez Piotra. 2026-06-17 (Runda 3): L-04 — śledzona jako SPEC_01, nie lokalna; zależność programowa potwierdzona (SPEC_ZADANIE_01 istnieje w `Harvard/SPEC_ZADANIE_01_chat_controller.md` — Tryb A+B: generacja „z czatu zrób sheet" przez UnifiedChatPanel + pipeline deliverables:draft-ready → WorkCanvasDocumentPanel; dodatkowy bloker: `ENABLE_V8_GLOBAL` OFF → pipeline martwy bez env var). L-09 ZABLOKOWANA (Fala 4) — `public/locales/*` ZAKAZANE w Fali 1; wymaga koordynacji z agentem i18n; scope: PublicViewPage EN-only + sweep `t()` przez cały katalog FE modułu. 2026-06-13 (teczka pogłębiona): pełna enumeracja 193 EP (13 grup); R3 potwierdziła L-01 NAPRAWIONA na `Londyn` + **L-06 rozjazd flag częściowo ZAMKNIĘTY** (FeatureFlags SSOT spójny); D-01=DP-6 preview, D-04→DP-9 grid-canon. Re-ocena F po dołożeniu testów IDOR + S1. **2026-06-17 (Runda 3): L-04 — śledzona jako SPEC_01, nie lokalna; zależność programowa potwierdzona (SPEC_ZADANIE_01 istnieje w `Harvard/SPEC_ZADANIE_01_chat_controller.md` — Tryb A+B: generacja „z czatu zrób sheet" przez UnifiedChatPanel + pipeline deliverables:draft-ready → WorkCanvasDocumentPanel; dodatkowy bloker: `ENABLE_V8_GLOBAL` OFF → pipeline martwy bez env var). L-09 ZABLOKOWANA (Fala 4) — `public/locales/*` ZAKAZANE w Fali 1; wymaga koordynacji z agentem i18n; scope: PublicViewPage EN-only + sweep `t()` przez cały katalog FE modułu.** **2026-06-17 (Runda 4): L-05 ZAMKNIĘTA jako PODGLĄD-DP6 (backlog v1.1) — D-01 rozstrzygnięte przez Piotra.** rose→danger sweep: 139 zmian w MyWork/table/ (pełne drzewo nested — cells/connectors/forms/automations/) — commit `0958115c3e` (merge `7fc5a7e7f0`).

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+uwaga #1 jako zależność + DP-6/8/9) · R2 zero sierot (wejście→luka→DoD) · R3 statusy z dowodem (**L-01 NAPRAWIONA `e9c6cb9c0a` zweryfikowana w kodzie msg+guards; L-06 rozjazd flag częściowo ZAMKNIĘTY — korekta vs karta**; L-11 z commitem) · R4 DoD z liczbami (193 EP enum, grep i18n/hex/<table> 2026-06-13) · R5 **obie decyzje rozstrzygnięte (D-01→DP-6, D-04→DP-9)** · A–E docelowy zlinkowany (C = pełna enumeracja + org-scope + grid-canon) · F epiki→stories Gherkin→L-xx · G DoD+S+sec · R6 sesja żywa = Faza 4 (pozostaje). **9/9; teczka kompletna do egzekucji.**

## EKRANY (inwentarz) — 2026-06-19

> Inwentarz powierzchni Table Studio (FE `src/components/AIChat/KimiWorkspace/`). Format: ekran — cel — plik. Główny data-grid = świadomie poza §27 (grid-canon D-04).

### Powierzchnia główna + shell
- **Tabele View (root)** — kontener modułu; routing MELS (`melsTabeleFlag`) vs `KimiWorkspaceShell` fallback; degradacja flag-OFF (503/404 zamiast cichego null) — `src/components/AIChat/KimiWorkspace/TabeleView.tsx`
- **Tabele MELS shell** — TopBar chips / left rail / right rail / panele prawej szyny — `tabeleShell/TabeleMelsView.tsx`, `TabeleTopBarChips.tsx`, `TabeleLeftRail.tsx`, `TabeleRightRail.tsx`, `useTabeleRightRailPanels.tsx`

### Data-grid (grid-canon)
- **Grid View (data-grid Airtable-like)** — edytowalny grid kolumn/komórek; render/edycja komórki — `src/components/MyWork/table/GridView.tsx` (+ `CellEditor`/`CellRenderer` w `MyWork/table/`)
- **Public View Page (publiczny widok/formularz)** — read/submit przez token slug; stany pusty/błąd/hasło/read-only (i18n `table.*` PL/EN) — `src/components/MyWork/table/PublicViewPage.tsx`

### Preview (split-view podgląd schematu)
- **Tabele Preview Layout** — podgląd zaproponowanej tabeli — `tabelePreview/TabelePreviewLayout.tsx`
- **Schema / Provenance / Relation / Rationale** — bloki podglądu schematu i uzasadnień — `tabelePreview/TabeleSchemaBlock.tsx`, `TabeleProvenanceColumn.tsx`, `TabeleRelationChip.tsx`, `TabeleRationaleSection.tsx`

### Panele prawej szyny (right-rail)
- **AI Editor Panel** — AI Editor 8 poziomów (applyProposal/reject, budżet serwerowy) — `tabeleShell/aiEditor/TabeleAiEditorPanel.tsx`
- **QA Panel** — kontrola jakości tabeli — `tabeleShell/qa/TabeleQaPanel.tsx`
- **Source Pack Panel** — pakiety źródeł — `tabeleShell/sourcePack/TabeleSourcePackPanel.tsx`
- **Share Panel** — share-token (revoke+expiry) — `tabeleShell/share/TabeleSharePanel.tsx`
- **Templates Grid** — lifecycle szablonów tabel — `templateLifecycle/TabeleTemplatesGrid.tsx`

---

## Generatory Deliverable — premium TABLE (B4 schema + CF + eksport)

> **Sekcja DOŁOŻONA 2026-06-23.** Zakres: NOWA warstwa „Generatory Deliverable" (premium TABLE), **NIE** istniejąca Table Platform (grid/widoki/formuły/automatyzacje opisane wyżej). Ta warstwa generuje **typowany schemat tabeli z AI** (B4) + **conditional formatting** (R5/X2) + **wierny eksport `.xlsx`** (X2). SSOT produktowy: [`../../docs/product/DELIVERABLES_GENERATORS_SPEC.md`](../../docs/product/DELIVERABLES_GENERATORS_SPEC.md). Plany testów: [`../../docs/qa/deliverables/test-plan/B-series.md`](../../docs/qa/deliverables/test-plan/B-series.md) (B4), [`R-series.md`](../../docs/qa/deliverables/test-plan/R-series.md) (R5), [`X-series.md`](../../docs/qa/deliverables/test-plan/X-series.md) (X2). 30 scenariuszy jakości: [`../../docs/qa/deliverables/scenarios/M20_TABLES.md`](../../docs/qa/deliverables/scenarios/M20_TABLES.md). Rubryka odbioru: [`DELIVERABLES_QUALITY_RUBRIC.md`](DELIVERABLES_QUALITY_RUBRIC.md) §4 (tabela). Tracker: [`DELIVERABLES-STAN-PRACY-ODBIORY.md`](DELIVERABLES-STAN-PRACY-ODBIORY.md). Testy manualne premium: [`../Testy manualne/TESTY_M20_TABELE_STUDIO.md`](../Testy%20manualne/TESTY_M20_TABELE_STUDIO.md) sekcja „Generatory Deliverable".

### Status (prawda 2026-06-23, zweryfikowana żywym LLM Sonnet 4.6)
- **Jakość premium TABLE = UDOWODNIONA code-side (~100%).** Pilot FT-6 (plain-node, klucz staging Railway): wszystkie 30 scenariuszy M20 zsweepowane do 100%; S01/S06/S07/S16 niezależnie re-zweryfikowane 100% PREMIUM. Avg `scorePct` table w ostatnim runie = **87%** (`runs/2026-06-22-live-pilot-sonnet46.json`), po sweepie golden = ~100%. Próg fali Q1 (B-series §7): table śr. ≥75% ORAZ żaden golden <60% — **spełniony**.
- **NAPRAWIONY realny bug data-loss (kluczowy dla tej sekcji):** `normalizeSeedRows` filtrował klucze seed-rowów przez **ścisłą równość** vs sanityzowany klucz pola → klucze `camelCase` z LLM były **CICHO ODRZUCANE** → puste kolumny w zmaterializowanej tabeli (graficznie poprawny nagłówek, zero danych pod spodem). FIX = pojednanie kluczy kanonicznych (canonical key reconciliation). Dodano też: kontrakt multi-sheet + sterowanie scope/type-inference w promptcie. Bug WIDOCZNY w `runs/2026-06-22-VTS-generated.md` §3 (kolumny „Indeks gotowości / Najsłabszy wymiar / Główna bariera / Termin docelowy" puste przy wypełnionych pozostałych — to ślad PRZED/po, do weryfikacji manualnej §MQ-T).
- **NIE wpięte w żywe UI.** Premium = opt-in za flagą `ENABLE_DELIVERABLES_PREMIUM` (`server/src/services/deliverableGenerationTier.ts:13`, default **OFF** = dzisiejsze zachowanie). Generatory premium **nie są jeszcze wpięte w żywy pipeline UI** (chat→canvas→studio→grid). → jakość mierzona przez **harness/flagę** (warstwa 1 Scoring-auto), NIE przez kliknięcia. **Nie wolno twierdzić, że jakość UI potwierdzona, dopóki nie ma żywego LLM przez UI** (deploy flagi na Railway + wpięcie + live-verify).
- **Decyzje jakości:** Q1 = próg ≥85% (cel aspiracyjny tabela ≥88%); Q3 = golden VTS; Q5 = Unsplash (obrazy — dot. deck/doc, nie tabeli).
- **Vs istniejąca Table Platform:** B4 generuje schemat → materializacja idzie do realnego `tp_*` (rdzeń szczelny, sekcja C wyżej). R5 CF persyst w `config` JSONB widoku (`useTablePlatformIntegration`). X2 eksport = `WorkbookBuilder` (ExcelJS), NIE SheetJS-fasada.

### A · INTENCJA (premium TABLE)
- **Job-to-be-done:** z jednego intentu („tabela ryzyk ERP", „portfolio projektów") AI generuje **gotową do oddania** tabelę jakości Airtable: typowane pola (nie sam `singleLineText`), kolorowe opcje selectów (hex, traffic-light dla statusów/severity), poprawne `numFmt` (waluta/%/data), ≥N **w pełni wypełnionych** seed-rowów, reguły conditional-formatting (dataBar/colorScale/iconSet/cellIs), formuły (SUM/IF/cross-sheet), opcjonalnie multi-sheet — i eksport `.xlsx` zachowujący to WSZYSTKO w pliku.
- **Metryka:** `scorePct` (substantive+graphic) ≥ próg Q1; zero pustych kolumn (regresja bug `normalizeSeedRows`); eksport `.xlsx` otwiera się w Excel BEZ „repair" z widocznym CF/kolorami/formatami; head-to-head ≥ Airtable na każdym wymiarze graficznym.

### B · UX DOCELOWE (premium TABLE)
- **Render na ekranie:** `GridView` (grid-canon D-04) — typowane kolumny, kolorowe chipy selectów, komórki z CF (tło/dataBar). Dark/light spójne (FT-3): kolory selectów i CF czytelne na obu tłach (czerwień nie zlewa się).
- **Eksport:** `.xlsx` (ExcelJS) = wierny render (FT-4): `<conditionalFormatting>`, `bgColor FF<HEX>`, `numFmt`, freeze panes, bold header — realne style w XML, nie fasada.
- **Degradacja (FT-8):** flaga OFF → tier STANDARD (deterministyczna podłoga, `fallbackUsed=true`), zero crasha, schema nadal waliduje. Brak chromium → eksport `unavailable` (typed-result, no-throw).

### C · DANE + API + REGUŁY (premium TABLE)
- **B4 generator:** `tableSchemaGeneratorService.ts` → typowany schemat. Quality-gate B4: ≥1 typed field (nie sam `singleLineText`), select-y mają hex w `options`, ≥3 seed rows. Typy ∈ katalog `TYPED_FIELDS ∪ {singleLineText}` (Zod enum). **FIX data-loss:** `normalizeSeedRows` — canonical key reconciliation (klucze camelCase LLM ↔ sanityzowane klucze pól).
- **R5 CF + formuły:** `ConditionalFormatting` / `FormulaEditor` / `formulaEngineCore` (AST, parytet FE/BE); persyst CF → `config` JSONB aktywnego widoku przez `useTablePlatformIntegration`.
- **X2 eksport:** `server/src/services/workbook/WorkbookBuilder.ts` (`buildWorkbookBuffer(schema)`) + `WorkbookSchema.ts` (`ConditionalFormattingBlock`/`Rule`: `dataBar`/`colorScale`/`iconSet`/`cellIs`); `hexToArgb` → ExcelJS `FF<HEX>`.
- **Tier wiring:** `resolveDeliverableTier` (`deliverableGenerationTier.ts`) — `ENABLE_DELIVERABLES_PREMIUM` ON → `tierUsed='PREMIUM'`, `source='llm'`, `fallbackUsed=false`; OFF → STANDARD (fail-open, nigdy nie rzuca, `:67`). Spend tagowany `purpose='deliverable_generation'`.
- **Org-scope:** materializacja schematu idzie do `tp_*` przez `PermissionsService` (rdzeń szczelny, sekcja C wyżej) — premium NIE omija RBAC.

### D · AI / TERESA (premium TABLE)
- **Co generuje:** B4 = typowany schemat + kolory + seed + CF rules + formuły + (opcjonalnie) multi-sheet. Premium tier = Anthropic Sonnet (wg D1). Fallback STANDARD = deterministyczna podłoga.
- **Sterowanie:** prompt steruje type-inference (np. „kwota" → currency gdy PLN/USD w kontekście; S29 adversarial), scope (multi-sheet TYLKO gdy explicit; S26), traffic-light dla severity/status (S05/S17). Type-inference + seed-completeness = miejsca, gdzie żył bug data-loss.

### E · INTEGRACJE (premium TABLE)
- **WEJŚCIE ←** M01 Czat (Teresa `generate_deliverable(type:sheet)`, SPEC_01 — za `ENABLE_V8_GLOBAL`/wpięciem) → schemat B4.
- **WYJŚCIE →** GridView (ekran, R5 CF) · `.xlsx` (X2 ExcelJS) · M17 Outputs (rejestr transakcyjny + lineage, X6 — link-by-ref). doc/sheet = jedna encja (X5; `unifiedDocEntityService`).
- **Bloker wpięcia:** flaga premium OFF na Railway + generatory niewpięte w UI → warstwa 2 (Manual-UI) BLOCKED do deployu.

### F · EPIKI → STORIES → ZADANIA (premium TABLE)

**EPIK G1 — B4: typowany schemat + kolory + seed (jakość Airtable) [B-series B4]**
- Story G1.1: typowane pola wg treści. Gherkin: dane intent „tabela ryzyk"; gdy B4 generuje; wtedy `requireFieldType` (singleSelect severity, currency budżet, date, rating) ✓, `minTypedFields` ✓, typy ∈ katalog. Testy: B4-S01/S02/S06; M20 S01-S15. [DONE code-side ~100%]
- Story G1.2: kolorowe selecty + semantyka traffic-light. Gherkin: status/severity singleSelect; wtedy każda opcja ma hex (`requireSelectColors`), Low/OK=green#16A34A, Med=amber#D97706, High/Bad=red#DC2626. Testy: B4-S03; M20 S05/S07/S11/S17. [DONE]
- Story G1.3: **seed-rows KOMPLETNE (regresja bug data-loss).** Gherkin: ≥N seed rows; wtedy KAŻDA typowana kolumna ma wartości we wszystkich wierszach (zero pustych kolumn) — `normalizeSeedRows` pojednał klucze camelCase↔sanityzowane. Testy: B4-S04; **MQ-T regresja** (manual §); M20 S01-S30. [DONE — fix canonical key reconciliation]
- Story G1.4: `numFmt` mapowany z typu. Gherkin: currency→`#,##0.00`, percent→`0.00%`, date→`YYYY-MM-DD`. Testy: B4-S02; M20 S02. [DONE]
- Story G1.5: multi-sheet gdy explicit. Gherkin: intent „roczny budżet 4 sheety"; wtedy 4 sheety + cross-sheet formuły; intent prosty → 1 sheet. Testy: M20 S26/S27. [DONE — kontrakt multi-sheet dołożony]
- Story G1.6: kontrakt schema (Zod) + fallback. Gherkin: flaga OFF → `fallbackUsed=true`, STANDARD waliduje, brak crasha. Testy: B4-S06/S07. [DONE]

**EPIK G2 — R5: Conditional Formatting w GridView + formuły AST [R-series R5]**
- Story G2.1: reguła CF koloruje komórki (>X→czerwony, between→kolor). Testy: R5-S01/S02; M20 S16/S18. [DONE code-side; UI manual]
- Story G2.2: formuły AST (SUM/IF) liczą poprawnie (parytet FE/BE). Testy: R5-S03/S04; M20 S19/S20/S21. [DONE]
- Story G2.3: CF persyst po reload (config JSONB widoku). Gherkin: dodaj CF→reload; wtedy kolory wracają. Testy: R5-S05/S06. [code-side; live-verify pending wpięcia/headless skeleton — `finding_m09_live_test_gates`]
- Story G2.4: kanban + dark/light. Testy: R5-S07/S08. [DONE]

**EPIK G3 — X2: eksport `.xlsx` z REALNYM CF + formatami (ExcelJS, nie fasada) [X-series X2]**
- Story G3.1: CF w XML pliku. Gherkin: schemat z dataBar/colorScale/iconSet/cellIs; gdy `buildWorkbookBuffer`; wtedy `xl/worksheets/sheet1.xml` zawiera `<conditionalFormatting>`+`databar`/`colorScale`/`cellIs`. Testy: X2-S01-S05 (zielone). [DONE]
- Story G3.2: **demaskacja fasady** — bgColor w `styles.xml`. Gherkin: komórka z fill; wtedy `xl/styles.xml` zawiera `FF<HEX>` (SheetJS by to zgubił). Testy: X2-S06. [DONE]
- Story G3.3: `numFmt` waluta/data + nagłówek bold/freeze. Testy: X2-S07/S08/S09. [DONE code; dopisanie do testu]
- Story G3.4: bez CF nadal builduje (PK magic), fail-open. Testy: X2-S10. [DONE]
- Story G3.5: **„Otwórz w Excel"** — plik bez „repair", CF/kolory/formaty widoczne. Testy: X2-M01-M06 (computer-use). [MANUAL — wymaga realnego Excela/Numbers]

**EPIK G4 — Premium tier wiring + telemetria [B-series B5]**
- Story G4.1: flaga ON→PREMIUM, OFF→STANDARD (fail-open). Testy: B5-S01/S02/S03. [DONE code-side]
- Story G4.2: spend tagowany + telemetria w panelu. Testy: B5-S04 [DONE]; B5-S05 [Manual-UI BLOCKED do wpięcia].

**EPIK G5 — Head-to-head vs Airtable (odbiór jakości graficznej) [rubryka §4C/§4D]**
- Story G5.1: golden VTS u nas vs Airtable, ta sama rubryka. Gherkin: temat VTS (Q3); wtedy nasz wynik ≥ Airtable na KAŻDYM wymiarze graficznym (G1-G7). Testy: B4-S08; MQ-T10. [Head-to-head — część programowa (eksport) + ekspercka ocena 1-5 Piotr/QA; pending live render]

### G · JAKOŚĆ / DoD (premium TABLE)

**7 globalnych kryteriów (FT-1..FT-8, wg trackera DELIVERABLES-STAN-PRACY-ODBIORY):**
| # | Kryterium | Stan premium TABLE |
|---|-----------|--------------------|
| FT-1 | Feature działa / kontrakt (schema Zod, CF, formuły) | ✅ DONE — B4 typy ∈ katalog, X2 CF w XML, R5 formuły AST liczą |
| FT-2 | Persystencja / round-trip / brak duplikatu | ✅ kod (CF→config JSONB, doc/sheet jedna encja X5); ⏳ live-verify CF-po-reload pending wpięcia |
| FT-3 | Dark/light spójne | ✅ kod; ⏳ screenshot UI pending wpięcia (B4-S09 Manual-UI BLOCKED) |
| FT-4 | Wierność WYGENEROWANEGO pliku (XML, nie „API zawołane") | ✅ DONE — X2-S01-S06 zielone (JSZip→sheet1.xml/styles.xml), S07-S09 dopisanie |
| FT-6 | Jakość AI (rubryka/scoring na golden) | ✅ ~100% code-side (30/30 scenariuszy + S01/S06/S07/S16 PREMIUM); próg Q1 spełniony |
| FT-7 | Manual jakościowy (MQ-T* + „otwórz w Excel") | ⏳ częściowo — Export-fidelity DZIŚ; „otwórz w Excel"/UI pending (computer-use / deploy) |
| FT-8 | Fail-open / regresja (flaga OFF nie psuje) | ✅ DONE — STANDARD fallback, no-throw, eksport `unavailable` graceful |

**FT-6 bramka jakości tabeli (szczegół — co spełnione / co pending):**
| Wymiar | Wymóg | Stan |
|--------|-------|------|
| Typowane pola | ≥1 typed (nie sam singleLineText); typy ∈ katalog | ✅ spełnione (B4 quality-gate) |
| Hex-kolorowe selecty | każdy select ma hex; severity/status traffic-light semantyczny | ✅ spełnione |
| ≥N seed rows KOMPLETNE | ≥3 (gate B4); **zero pustych kolumn** (regresja data-loss) | ✅ spełnione po fix `normalizeSeedRows` (canonical key reconciliation) |
| CF rules | dataBar/colorScale/iconSet/cellIs gdzie temat tego wymaga | ✅ kod (X2 schema) + B4 zwraca reguły |
| numFmt | currency/percent/date poprawny w pliku | ✅ kod (X2-S07/S08, dopisanie do testu) |
| exceljs fidelity | realny styl/CF w XML (nie fasada SheetJS) | ✅ DONE (X2-S06 demaskacja) |
| head-to-head ≥ Airtable | ≥ referencja na każdym wymiarze graficznym | ⏳ PENDING — wymaga live render + oceny eksperckiej (G5.1 / MQ-T10) |

**Wykonalność DZIŚ vs pending (uczciwie):**
- **DZIŚ (zero deploya):** B4 scoring-auto (runner FT-6, klucz staging), X2 export-fidelity-vitest (S01-S10), R5 CF/formuły code-side, B5 tier-wiring. Regresja data-loss = re-run runnera + B4-S04 + asercja braku pustych kolumn.
- **PENDING wpięcia/deploya:** Manual-UI (B4-S09 dark grid, R5 CF-po-reload na żywej przeglądarce), head-to-head vs Airtable (live render + ocena 1-5), „otwórz w Excel" (computer-use — Export XLSX → realny Excel/Numbers).

### H · GOVERNANCE (premium TABLE)
| ID | Wejście | Treść | → Luka/Story |
|----|---------|-------|--------------|
| WG-01 | SSOT DELIVERABLES_GENERATORS_SPEC (W2/W4/W5) | R5 (CF+formuły AST) / B4 (schemat AI) / X2 (eksceljs eksport) | EPIK G1-G3 |
| WG-02 | Pilot FT-6 2026-06-22/23 (Sonnet 4.6) | table avg 87% → sweep 30/30 ~100% PREMIUM | EPIK G1, FT-6 |
| WG-03 | **Bug data-loss** `normalizeSeedRows` | klucze camelCase LLM cicho odrzucane → puste kolumny; NAPRAWIONE (canonical key reconciliation) | Story G1.3 (regresja) |
| WG-04 | `finding_deliverables_ft6_pilot` + `_vite_flag_deploy` | premium za flagą OFF, niewpięte w UI → warstwa 2 BLOCKED | FT-3/FT-7 pending |
| WG-05 | Rubryka §4 + 10× MQ-T | odbiór: kompletność+merytoryka+grafika; head-to-head vs Airtable | EPIK G5 |

**Decyzje:** Q1=≥85% (cel tabela ≥88%) · Q3=VTS golden · Q5=Unsplash (nie dot. tabeli) · D1=Anthropic premium. **Ryzyko:** „jakość premium UI potwierdzona" = NIEPRAWDA dopóki nie ma żywego LLM przez UI (deploy flagi Railway + wpięcie + live-verify). Headless zostawia canvas Ideas w skeletonie → R5 live tylko w realnej przeglądarce (`finding_m09_live_test_gates`).
