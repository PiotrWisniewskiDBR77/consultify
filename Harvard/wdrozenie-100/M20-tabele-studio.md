# TECZKA M20 — Tabele Studio (Table Platform, Airtable-like)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje kartę audytu + INV_E + kod i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md), referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M20 Tabele Studio (Table Platform, 193 endpointy) · **Pula:** beta (closed)
- **Ocena audytu:** 48/100 · **Tier:** Alpha · **Status:** FAZA 1 (blokery) → FAZA 3/4 · **Rozmiar:** L (3–5 dni)
- **Żywy bloker:** P0 cross-org IDOR — **NAPRAWIONY `e9c6cb9c0a` (zweryfikowane na Londyn 2026-06-13)**, do cold-start proof
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M20-tabele-studio/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md` · **INV_E:** `Harvard/podzial/inventory/INV_E_outputs_studia_meeting.md` (TABELE STUDIO poz.1-16)
- **Kod:** `src/components/AIChat/KimiWorkspace/TabeleView.tsx` + `tabele*`/`tabelePreview`/`tabeleShell` · `server/src/routes/table-platform.routes.ts` · `server/src/services/table-platform/PermissionsService.ts` · `…/ModuleSyncService.ts` · `…/SSOService.ts` · `…/MetadataService.ts` · `…/FeatureFlags.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta §0 + INV_E sekcja TABELE STUDIO | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟡 | karta §5 (MELS zgodny; §27 N/D — grid to inny wzorzec) | luka „grid-canon" (D-04) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + `table-platform.routes.ts` + `PermissionsService.ts` | model org-guard (niżej) |
| D AI/Teresa | 🟢 | karta §1a (AI Editor 8 poz., budżet serwerowy) + `tabeleSystemPrompt.ts` | link |
| E Integracje | 🟢 | karta §1g | governed-sync STUB (L-05) |
| F Epiki | 🟢 | karta §7 (3 fale) | przeformułowane na epiki (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grep 2026-06-13** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + korekta R3** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** dać zespołowi pełną platformę tabel (Airtable-like) — bazy/tabele/rekordy/widoki/pola/formuły/automatyzacje/formularze — jako warstwę danych pod resztę produktu, z generacją z czatu i konwersją do Doc/Deck.
- **Persony/role:** członek org (CRUD na bazach, do których ma dostęp), admin org (SSO/uprawnienia), publiczny respondent formularza/widoku (read/submit przez token). Org-scope egzekwowany przez `PermissionsService.canAccessBase`.
- **Zakres v1:** bazy/tabele/rekordy CRUD + CSV/attachments · widoki Grid/Kanban/Calendar/Matrix + share + PublicViewPage · formuły FormulaEngineV2 + linked/rollup · AI Editor (8 poziomów, applyProposal/reject, budżet serwerowy) · automatyzacje (cron + run-now) · formularze (slug publiczny + submissions) · konwersja Table→Doc/Deck (BE). **POZA v1:** realny governed sync-to-results/finance/execution (obecnie STUB — decyzja D-01), grid-canon jako spisany standard.
- **Metryka:** rekordy trwałe po reload (real `tp_*`); 0 ścieżek cross-org; AI Editor w budżecie.

## B · UX DOCELOWE *(link + delta)*
- **Wzorzec:** MELS (`melsTabeleFlag` default OFF → fallback `KimiWorkspaceShell`) — **ZGODNY** (karta §5, mocny pozytyw). Grid główny (`GridView`/`CellEditor`/`CellRenderer`) świadomie NIE pod §27 (edytowalny data-grid, nie lista Menu 1/2/3).
- **Stany docelowe:** flag-OFF → komunikat (503 `SCHEMA_NOT_READY` / 404 `AI_EDITOR_DISABLED`) zamiast cichej pustki (`TabeleView.tsx:122,171,361`→`.catch(()=>null)` = obecny dług, L-08). PublicViewPage komunikaty PL/EN (obecnie EN-only, L-09).
- **Delta:** (1) banery degradacji flag-OFF; (2) **grid-canon** — osobny spisany standard dla data-grida (D-04) + §27 dla list baz/automatyzacji/konektorów.

## C · DANE + API + REGUŁY *(link + model org-guard)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi (KLUCZOWE — rozjazd komentarz↔runtime):** karta §1f — `ENABLE_TABLE_AI_EDITOR`/`QA_ENGINE`/`SOURCE_PACK`/`ARTIFACT_CONVERSION` mają komentarz „Disabled by default", ale runtime `!== 'false'` = **default ON** (`FeatureFlags.ts:85-103`) → BE żywe mimo że FE chowa UI (L-06).
- **Model danych:** realny Postgres `tp_*` (migracje 700–778; kolizja 725×2/726×2 NAPRAWIONA → 777/778). Rekordy/proposale/automatyzacje przeżywają restart (BEZ fasady in-memory z M18).
- **Reguła org-scope (kanon):** każda encja → base → `tp_bases.organization_id === token.org` przez `PermissionsService.canAccessBase(userId, orgId, baseId)` (`PermissionsService.ts:180`, pokrycie ~115/193 tras + endpointy wtórne po fix `e9c6cb9c0a`). AI Editor: budżet tokenów serwerowo (`AiBudgetExhaustedError`→429).

## D · AI / TERESA *(link)*
- **Co generuje:** AI Editor 8 poziomów — `tableAiEditorService.applyProposal` **realnie modyfikuje rekordy** (nie stub), reject/undo; generacja tabeli z czatu (pipeline V8, za `ENABLE_V8_GLOBAL`). Prompt: `tabeleSystemPrompt.ts`.
- **Sterowanie:** budżet egzekwowany serwerowo. **Kręgosłup (Uwaga żywa #1):** generacja „z czatu zrób sheet" idzie przez `UnifiedChatPanel`+pipeline `deliverables:draft-ready`→`WorkCanvasDocumentPanel` — to ta sama warstwa, której pęknięcie opisuje `SPEC_ZADANIE_01` (więź czat→panel). Zależność programowa, nie lokalna luka M20.

## E · INTEGRACJE
Pełna tabela: karta §1g. **WEJŚCIE ←** M01 Czat (generacja tabeli z czatu, za flagą). **WYJŚCIE →** M18/M19 (konwersja Table→Doc/Deck materializer, BE), M15 Rezultaty / M16 Finanse (governed sync — **STUB**, L-05), public (PublicViewPage + slug formularzy). **Kręgosłup:** generacja z czatu = Faza 0 (SPEC_ZADANIE_01).

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — Domknąć bezpieczeństwo (P0/P1):** 4 ścieżki IDOR (NAPRAWIONE `e9c6cb9c0a` — dołożyć TESTY cross-org 403, L-01); SSO/webhook AES at-rest (L-02); weryfikacja `share_password` (L-03). [karta §7 Fala 1]
- **EPIK 2 — Front↔back integralność (#klaster fasad):** governed sync realny zapis ALBO „preview"+ukrycie przycisków (L-05, D-01); uspójnić 4 flagi komentarz↔runtime + banery 503/404 (L-06/L-08). [karta §7 Fala 2]
- **EPIK 3 — Test fundamentu:** real `tp_records` round-trip (S1, L-07) + anty-false-green E2E (`test.skip`→twardy `beforeAll` seed). [karta §7 Fala 2]
- **EPIK 4 — Kanony:** grid-canon (D-04) + §27 list baz/automatyzacji; i18n PublicViewPage (L-09); tokeny (L-10); beta-guard route + rate-limit slug; CI `Londyn`. [karta §7 Fala 3]

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M20 |
|---|-----------|-----------|
| 1 | Front↔back | governed sync realnie pisze do celu LUB jawnie „preview" + przyciski ukryte; Records CRUD trwały po reload (real `tp_*`); 4 flagi: komentarz=runtime |
| 2 | Bezpieczeństwo | 4 ścieżki IDOR → cross-org 403/404 (**kod NAPRAWIONY `e9c6cb9c0a`** — brak testu regresji = jedyna luka); SSO/webhook AES; `share_password` weryfikowane |
| 3 | i18n | **0 z 0** `isPolish` w `TabeleView`+`tabele*` (grep 2026-06-13 = **0** — najlepszy w audycie); dług = PublicViewPage EN-only (poza zmierzonym katalogiem) |
| 4 | Tokeny | **0 hex** w zmierzonym `TabeleView`+`tabele*` (grep = 0); karta raportuje 322 hex w szerszym footprincie data-grida (`GridView`/`CellRenderer` — potwierdzić zakres przy sweepie) |
| 5 | §27 | **0** surowych `<table>` w zmierzonym katalogu; grid = świadomie inny wzorzec → potrzebny **grid-canon** (D-04) |
| 6 | E2E w PR-gate | S1 (real `tp_records`) + IDOR-403 (4 ścieżki) zielone na `Londyn` |

Scenariusze S1–S8: karta §0/§2. Bezpieczeństwo: karta §6. *(Uwaga R4: grep i18n/hex=0 w `TabeleView`+`tabele*` bo `TabeleView` jest wzorcowo czysty 37×`t()`; dług koloru/i18n karty żyje w `GridView`/`CellRenderer`/`PublicViewPage` poza zmierzonym podkatalogiem — zmierzyć cały data-grid przed sweepem.)*

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 48/100, rdzeń szczelny, endpointy wtórne IDOR (wg karty), governed-sync STUB, 4 flagi rozjazd | L-01..L-10 |
| W-02 | **Uwaga żywa #1** (`SPEC_ZADANIE_01`) | 2026-06-13 | kręgosłup czat→panel pęka — generacja sheet z czatu idzie tędy → M20 dotknięty zależnością | L-04 (zależność programowa) |
| W-03 | INV_E sekcja TABELE STUDIO poz.1-16 | 2026-06-11 | inwentarz 1 pkt STALE (governed sync „DZIAŁA"=STUB) | L-05 |
| W-04 | Feedback prod (kohorta beta) | — | brak własnej uwagi żywej M20 z 2026-06-13 | — (dziedziczy z karty) |

*(Brak uwagi żywej swoiście o M20 w `UWAGI_TESTY_2026-06-13.md`; jedyne wejście „żywe" = #1 jako zależność kręgosłupa dla generacji sheet z czatu.)*

### 02 · Stan obecny (prawda kodu)
Rdzeń (base/table/record/view/field) **szczelny** przez `PermissionsService` (~115/193 tras + wtórne po fix). Persystencja realna `tp_*` (bez fasady M18). **KOREKTA R3 (zweryfikowane 2026-06-13):** 4 ścieżki rzekomo-IDOR z karty/WP (`:4802,2804,4407,3413`) mają **stare numery linii** (plik urósł) i **są już org-guarded** commitem `e9c6cb9c0a` (sprint5, na `Londyn`): record-templates POST `:4940`→`canAccessBase :4950` przed `INSERT INTO tp_records`; form submissions `:2824`→guard przed `getSubmissions :2827`; row-policies `:4474+` guarded; governed-models publish/sync `:3430/3462/3496`→`canAccessBase` na `model.base_id`. Raw `import('../database/Database.js')` zostaje, ale guard biegnie PRZED mutacją. Inne długi otwarte: governed sync STUB (`ModuleSyncService.ts:89`), 4 flagi rozjazd, SSO plaintext, share_password nieweryfikowane.

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | **Status** | Zweryf. |
|----|------|---------|--------------------|-------|------|-----------|---------|
| L-01 | cross-org IDOR record-templates/form-submissions/row-policies/governed-models | W-01 | `table-platform.routes.ts:4940/4950, 2824/2827, 4474+, 3430/3462/3496` | P0 (był) | 1 | **NAPRAWIONA `e9c6cb9c0a`** (R3: brak testu regresji cross-org → dodać) | 2026-06-13 |
| L-02 | SSO config + webhook hmac plaintext at rest | W-01 | `SSOService.ts:47-63` | P1 | 1 | otwarta (AES, wzorzec M25) |  |
| L-03 | `share_password` zapisywane, NIGDY nieweryfikowane | W-01 | `MetadataService.ts:1279` | P2 | 1 | otwarta |  |
| L-04 | kręgosłup czat→sheet (generacja z czatu) | W-02 | `SPEC_ZADANIE_01` | P0-program | 0 | zależność (śledzona w SPEC_01) |  |
| L-05 | governed sync STUB (log-only, 0 czytelników M15/M16) | W-01,W-03 | `ModuleSyncService.ts:57-110,89` | P1 | 3 | otwarta (**D-01**) |  |
| L-06 | rozjazd 4 flag komentarz↔runtime (default ON) | W-01 | `FeatureFlags.ts:85-103` | P2 | 3 | otwarta |  |
| L-07 | fundament Records API w 100% zmockowany (0 dot. real `tp_records`) | W-01 | `evidence/f2_tests_report.md` | P0-test | 1 | otwarta |  |
| L-08 | cicha degradacja flag-OFF (`catch→null`, brak 503/404) | W-01 | `TabeleView.tsx:122,171,361` | P2 | 3 | otwarta |  |
| L-09 | PublicViewPage EN-only | W-01 | `PublicViewPage` (`'Failed to load shared view'`) | P3 | 4 | otwarta |  |
| L-10 | 322 hex w data-grid (poza zmierzonym `TabeleView`) | W-01 | `GridView`/`CellRenderer` | P3 | 4 | otwarta (zmierzyć cały footprint) |  |
| L-11 | kolizja migracji 725×2/726×2 | W-01 | migracje 725/726 | P1 | — | **NAPRAWIONA** (→777/778, test 5/5 PASS) | 2026-06-11 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | governed sync-to-results/finance/execution | realny zapis do modułu docelowego / oznaczyć „preview" + ukryć przyciski | Piotr | TBD | otwarta |
| D-04 | grid-canon dla data-grida | spisać osobny standard / zostawić ad-hoc | Piotr | TBD | otwarta |

### 05 · Flagi / rollout — beta-closed (`MODULE_*` gating); `ENABLE_TABLE_PLATFORM_RECORDS_API` default ON; AI_EDITOR/QA/SOURCE_PACK/CONVERSION default ON mimo komentarza „OFF" (L-06); `ENABLE_V8_GLOBAL` OFF (generacja z czatu martwa bez flagi). Beta-guard route = nawigacyjny (direct URL omija plate; API org-gated).
### 06 · Ryzyka — fix IDOR `e9c6cb9c0a` na `Londyn` ale **bez testu regresji** → możliwy nawrót; cold-start IDOR proof na staging OSTROŻNIE (dev `.env` może wskazywać Railway PROD). Governed sync „DZIAŁA" w INV_E mylące. 322 hex zmierzone w szerszym footprincie niż zlinkowany podkatalog — sweep musi objąć cały data-grid.
### 07 · Log — 2026-06-11: `e9c6cb9c0a` (IDOR 4 ścieżki org-guard, sprint5), migracje 777/778 (kolizja 725/726), audyt 48/100. 2026-06-13 (teczka): R3 potwierdziła L-01 NAPRAWIONA na `Londyn` (HEAD ancestor) — P0 NIE jest już żywy w kodzie; pozostaje test regresji. Re-ocena F po dołożeniu testów IDOR.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+uwaga #1 jako zależność) · R2 zero sierot (wejście→luka→DoD) · R3 statusy z dowodem (**L-01 NAPRAWIONA `e9c6cb9c0a` zweryfikowana w kodzie i na branchu — korekta vs „P0 otwarty" w starej karcie**; L-11 z commitem) · R4 DoD z liczbami (grep i18n/hex/<table> 2026-06-13) · R5 decyzje z właścicielem · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4. **Teczka kompletna do egzekucji.**
