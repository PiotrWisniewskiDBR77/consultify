# TABELA (Ideas) — Audyt stanu i plan dokończenia

**Data:** 2026-07-04 · **Autor:** Fable 5 (nadzorca obszaru w programie „7 narzędzi") · **Obszar:** narzędzie Tabela w funkcjonalności Ideas/My Work
**Metoda:** 4 równoległych zwiadowców (dokumentacja / backend / frontend / testy) + weryfikacja gałęzi git.

---

## 0. Streszczenie wykonawcze

Tabela to **największe i najdojrzalsze** z 7 narzędzi — to nie szkielet, tylko ~93k linii kodu (~41k backend + ~52k frontend) z 28 dokumentami. **Nie budujemy — domykamy.** Stan: **~75% pełnej funkcjonalności**.

Kluczowe fakty:
1. Istnieją **dwa stosy**: (a) `IdeaTableTool` — narzędzie w kanwie Ideas (M08, audyt 62/100), (b) `tablePlatform` (tp_*) — backend klasy Airtable (M20). Połączone mostem `useTablePlatformBridge` z fallbackiem na legacy graph (Decyzja #5: dual-stack zostaje za flagą).
2. Fale naprawcze **P1–P6 są już WYKONANE** na `integration/harvard-noc` (+2276 linii z testami): cross-record recompute, symetryczne linki, DateDependency auto-trigger, SAML fail-closed + run_script sandbox, zagnieżdżone filtry AND/OR, uprawnienia userRole, PAT REST API, filterByFormula→SQL.
3. **Nic z P1–P6 nie jest na `demo` ani `canon-kit`** — `origin/demo` jest 12 commitów tablePlatform za `harvard-noc`. Na demo/canon-kit wciąż żyją: RCE w run_script i SAML bez podpisu (audyt backendu potwierdził na canon-kit).
4. Główne otwarte braki: realtime nie synchronizuje mutacji w UI, automatyzacje bez wykonania z UI, P7 inbox powiadomień, załączniki na dysku efemerycznym, 4 zepsute przyciski M08, luki testowe (27 serwisów backendu 0% pokrycia, w tym uprawnienia i audyt).

---

## 1. CO MAMY (inwentarz potwierdzony w kodzie)

### 1.1 Backend — `server/src/services/tablePlatform/` (43 pliki, ~41 199 linii, 44 tabele tp_*)

Airtable-grade, działające:
- **24+ typów pól** z walidacją (`SchemaValidationService`, +currency/duration po Fali 2 na harvard-noc)
- **Formuły** (`formulaEngine.ts` 999 l.): parser/AST ~50 funkcji, graf zależności, topo-sort, cykle
- **Relacje** (`RelationService`): junction `tp_record_links`, FK CASCADE, rollup/lookup/count
- **ViewQueryEngine** (1074 l.): filtry/sort/group/paginacja; na harvard-noc + zagnieżdżone grupy AND/OR (P3) + filterByFormula→SQL (P6)
- **Realtime** Socket.IO (`RealtimeService`, namespace `/table-platform`): presence, kursory komórek
- **Automatyzacje** (`AutomationService` + `ScheduledAutomationExecutor`): triggery record_created/updated wpięte w write-path, cron, webhook — działa
- **Import/export**: CSV/XLSX/Sheets/Airtable/Jira, eksport wielu formatów
- **Role bazy** (7 poziomów), publiczne widoki (hasło+TTL), formularze publiczne + JWT
- **Cell-history, optimistic locking, undo, audit events, provenance/confidence, AI editor (8 poziomów mutacji), QA engine, SCIM/SSO, service accounts, governed models (KPI), dystrybucje (email/Slack/Teams)**

Na `integration/harvard-noc` DODATKOWO zamknięte (commity ef56f420…8fbe59e4):
| Fala | Zakres | Commit |
|---|---|---|
| P1 | cross-record recompute rollup/lookup przy edycji źródła | `8fbe59e430` |
| P1b | auto-tworzenie symetrycznego pola wstecznego linku | `6af75b4a1c` |
| P1c | DateDependencyEngine auto-cascade przy zapisie | `ca7cccd699` |
| P2 | SAML podpis fail-closed + run_script sandbox/flaga | `6e9657f562`, `0f403f9beb` |
| P3 | zagnieżdżone grupy filtrów AND/OR | `8ec6db37d5` |
| P4 | userRole przewleczony do tras rekordów (per-pole/per-wiersz) | `bac3049883` |
| P5 | PAT auth + scope enforcement dla Records REST API | `875c7216b8` |
| P6 | filterByFormula funkcje→SQL (koniec no-op TRUE) | `0b79ddff6a` |
| Fala2 | szlif currency/duration | `66ecf6b27b` |

### 1.2 Frontend — `src/components/MyWork/table/` (146 plików, ~52k linii)

- **Wejście:** `IdeaTableTool.tsx` (1130 l.) w `IdeaMapWorkspace` (ikona Table w pasku narzędzi kanwy); dual-stack: platform-first z fallbackiem na legacy graph (`usePlatform = platformActive && !(empty && legacyPopulated)`)
- **Widoki (9):** Grid ✅ (33k, multi-sort/grupy/inline-edit/conditional formatting), Kanban ✅ (drag-drop), Kalendarz ✅, Timeline ✅, Gantt ✅ (zależności SVG, zoom), Galeria ✅ (V1), Form ✅ (conditional visibility), Matrix ⚠️ szkielet, StickyNote ⚠️ stub
- **Edytor formuł** (28k: highlight, autocomplete, preview), rollupy w UI, conditional formatting ✅, cross-table relations, szablony rekordów, AI (assistant/copilot/categorize/chat-to-schema), publiczne formularze+widoki (hasło, JWT), konektory (CSV/Sheets/Airtable/Jira/Webhook), provenance/confidence, offline-indicator
- **API klient:** `src/services/api/tablePlatform.api.ts` (1279 l., 50+ endpointów, ~95% pokrycia backendu)

### 1.3 Dokumentacja (28 dokumentów — pełna lista w raporcie zwiadowcy)

SSOT-y: `Harvard/_TRACKER.md` (M08 62/100), `Harvard/modules/M08-ideas-table/KARTA_AUDYTU.md`, `Harvard/DECYZJE_BRIEFY.md` (Decyzja #5), `Harvard/Testy manualne/TESTY_M08_IDEAS_TABLE.md` (+CASES_30), `Harvard/INTEGRACJE.md` (M08→M19 pełny eksport do prezentacji), `docs/strategy/TABLE_PLATFORM_*` (7 dok. architektury), `docs/product/TABLE_MISSING_CAPABILITIES_MATRIX_V8.md`.

### 1.4 Testy

- Backend: 46 plików testów kolokowanych (formulaEngine, ViewQueryEngine, Records, Automation, AI editor 9 plików, migracje) + 3 testy tras + na harvard-noc nowe (nestedFilters 277 l., filterByFormula 597 l., currency/duration 201 l.)
- FE: 15 testów komponentowych (cells/provenance/forms) + 9 unit (hooki, formuły) — **w CI** (`test-suite.yml`: unit/components/integration/colocated)
- Integracyjne: 15 (roundtrip, share-password, IDOR-regression, formula parity, realtime org-scope)
- E2E: `tests/e2e/smoke/m08-table-acceptance.spec.ts` S01–S20 (w git) + 4 suity table-platform

### 1.5 Stan gałęzi (KRYTYCZNE dla planu)

```
integration/harvard-noc  = PEŁNY stan narzędzia (P1–P6 + testy)   ← baza robocza
canon-kit (bieżąca)      = podzbiór (0 commitów w przód)          ← brak P1–P6
origin/demo (de37ea03e2) = 12 commitów tablePlatform ZA harvard-noc ← baza święta Piotra
```

---

## 2. CZEGO BRAKUJE (droga do stanu idealnego)

### 🔴 KRYTYCZNE (poprawność/bezpieczeństwo/dane)
| # | Luka | Dowód | Uwagi |
|---|------|-------|-------|
| B1 | **P1–P6 niezdeployowane** — demo/canon-kit mają nadal RCE (`AutomationService.ts:394` `new Function`), SAML bez podpisu (`SSOService.ts:117`), martwe uprawnienia, brak cross-record recompute | audyt backendu na canon-kit | fix = promocja harvard-noc, nie nowy kod |
| B2 | **Realtime nie synchronizuje mutacji w UI** — socket odbiera `record:updated`, stan lokalny bez aktualizacji, wymagany refresh | `useTableRealtime.ts:124–136`, `IdeaTableTool.tsx:273–277` | multiplayer de facto tylko presence |
| B3 | **Załączniki: dysk lokalny** (Railway efemeryczny = utrata plików przy redeploy), update nieistniejącej kolumny `metadata`, `sharp` poza package.json (graceful fallback jest) | `AttachmentService.ts:19,213–244` | wymaga S3/R2 |
| B4 | **P7: powiadomienia write-only** — `notifyWatchers()` pisze do tp_audit_events, zero endpointu inbox/odczytu, zero UI | `RecordWatchService.ts:119–164` | @mention/watch bez efektu dla użytkownika |
| B5 | **Testy bezpieczeństwa 0%**: PermissionsService, FieldPermissionService, RowPolicyService, AuditService, RelationService — zero pokrycia | raport testów | P4 (uprawnienia) bez siatki regresji |

### 🟠 WYSOKIE (funkcje obiecane w UI, martwe)
| # | Luka | Dowód |
|---|------|-------|
| B6 | Automatyzacje: builder UI kompletny, ale wykonanie nigdy nie wywoływane z UI; brak historii uruchomień | `automations/AutomationsManager.tsx` |
| B7 | 4 zepsute przyciski M08: Import 404, ActivityFeed 401, AuditTrail 404, Snapshot 404 | KARTA_AUDYTU Faza 1c |
| B8 | Komentarze: API pełne (mentions), zero komponentu UI | raport FE §6 |
| B9 | Serwer nie zna typu widoku (kanban/kalendarz tylko FE); `buildGroupQuery` niewywoływana z tras | `ViewQueryEngine.ts` |
| B10 | Undo/redo dla rekordów platformowych: hook istnieje, niepodpięty | raport FE §7.15 |

### 🟡 ŚREDNIE (dokończenia widoków/formularzy)
- B11 Matrix view nieinteraktywny (`MatrixView.tsx:8–90`); B12 Chart nie w ViewRouter; B13 StickyNote bez persystencji; B14 Galeria bez filtrów/sortowania
- B15 Formularze: redirect po submit ignorowany (`PublicFormView.tsx:75`), styling parsowany a niestosowany, e-mail notyfikacja bez UI konfiguracji
- B16 Publiczny widok współdzielony: zawsze płaska lista (ignoruje filtry/sorty/grupy widoku)
- B17 `ConsultifyLinkPanel` — sync do modułów tylko loguje do konsoli (`integration/ConsultifyLinkPanel.tsx:120`)
- B18 Lookup: typ pola jest, brak UI konfiguracji; B19 podgląd załączników inline brak
- B20 7 tras bez testów HTTP (ai-editor, conversion, form-intake, form-public, qa, record-sources, source-pack); 27 serwisów 0% pokrycia
- B21 E2E: 20 scenariuszy vs 105 manualnych; zero E2E automatyzacji/realtime/relacji

### 🔵 DECYZYJNE (Piotr)
- D-A: **Re-decyzja Decyzji #5** — most Ideas↔tablePlatform (`ENABLE_TABLE_PLATFORM_METADATA_FIRST`): włączyć platform-first dla nowych tabel Ideas? (warunek z briefu: „po Fazie C, gdy tp_* żywe na Railway" — spełniony)
- D-B: Zakres SaaS-enterprise (SCIM/SSO/service accounts/governed models) — rozwijać czy zamrozić jako „latent"?
- D-C: Promocja harvard-noc→demo (deploy wymaga zgody; zmiany są backendowe, bez wpływu na wygląd)

---

## 3. PLAN DOKOŃCZENIA (fale F0–F5)

**Baza robocza:** `integration/harvard-noc` (pin po SHA `ef56f42092`). Gałęzie robocze `feat/tp-*` od tej bazy, workerzy w `isolation: worktree`. Nowe pliki testów: **zawsze `git add -f`** (`/tests/` w .gitignore). CI zbiera tylko `tests/unit|integration|components` + kolokowane `__tests__`.

### F0 — Konsolidacja i weryfikacja bazy (nadzorca, ~0.5 dnia)
- F0.1 Self-audit fal P1–P6 na harvard-noc na **realnych rekordach** (anty-false-green: edycja pola źródłowego → rollup w tabeli docelowej faktycznie się zmienia; PAT faktycznie autoryzuje request; SAML odrzuca niepodpisany response).
- F0.2 Sanity: `vitest run server/src/services/tablePlatform` zielone na bazie.
- **Agent:** Fable 5 (nadzorca) + 1× Opus (weryfikator adwersaryjny).

### F1 — Krytyczne dziury backendu (2 robotników równolegle, ~1 dzień)
- F1.1 **P7 Inbox powiadomień**: tabela `tp_notifications` (lub odczyt z tp_audit_events), `GET /notifications` + mark-read, konsument @mention/watch; badge w UI tabeli. → **Opus**
- F1.2 **Załączniki trwałe**: storage S3-compatible (Railway bucket/R2) za flagą z fallbackiem na dysk; fix kolumny `metadata`; `sharp` do package.json. → **Opus**
- Bramka: testy jednostkowe + ręczny dowód (upload → redeploy-symulacja → plik żyje).

### F2 — Ożywienie martwych funkcji UI (3–4 robotników, ~1–1.5 dnia)
- F2.1 **Realtime mutacje → stan**: `record:created/updated/deleted` → aktualizacja rows w `IdeaTableTool`/`TableDataProvider` (z ochroną przed echo własnych zmian). Najtrudniejsze — konflikt z optimistic updates. → **Opus**
- F2.2 **Automatyzacje E2E**: wywołanie execute z UI, historia uruchomień (tp_automation_runs już istnieje), status/logi w `AutomationsManager`. → **Sonnet**
- F2.3 **4 zepsute przyciski M08** (Import 404 / ActivityFeed 401 / AuditTrail 404 / Snapshot 404) — diagnoza per przycisk: podpiąć trasę albo ukryć przycisk. → **Sonnet**
- F2.4 **Komentarze UI** w RowDetailPanel (API gotowe, mentions → zasila F1.1). → **Sonnet**
- F2.5 Undo/redo podpięcie do mutacji platformowych. → **Sonnet**

### F3 — Dokończenie widoków i formularzy (2–3 robotników, ~1 dzień)
- F3.1 Matrix: edycja komórek + agregacja pivot. → **Sonnet**
- F3.2 Chart do ViewRouter (komponenty istnieją). → **Sonnet**
- F3.3 Formularze: redirect po submit, aplikowanie stylingu, UI konfiguracji e-mail notyfikacji. → **Haiku** (proste, dobrze opisane)
- F3.4 Publiczny widok: honorowanie filtrów/sortów/grup widoku (serwer ma ViewQueryEngine — przewlec view config). → **Sonnet**
- F3.5 StickyNote: decyzja usuń/dokończ (rekomendacja: **usunąć z przełącznika widoków** — nie broni wartości); Galeria filtry/sort. → **Haiku**
- F3.6 ConsultifyLinkPanel: realny sync albo ukrycie panelu (rekomendacja: ukryć do decyzji D-A). → **Haiku**
- F3.7 Lookup UI konfiguracja + podgląd załączników inline. → **Sonnet**

### F4 — Siatka testowa (2 robotników, ~1 dzień, równolegle z F2/F3)
- F4.1 Testy bezpieczeństwa: PermissionsService, FieldPermissionService, RowPolicyService, AuditService, RelationService. → **Sonnet**
- F4.2 Testy HTTP 7 nienakrytych tras + CsvImportService + ChatToSchemaService. → **Haiku** (wzorce istnieją w 46 plikach obok)
- F4.3 E2E: +10–15 scenariuszy (automatyzacje, relacje, realtime smoke). → **Sonnet**

### F5 — Odbiór, decyzje, promocja (nadzorca + Piotr)
- F5.1 Pełny przebieg manualny wg `TESTY_M08_IDEAS_TABLE.md` + `CASES_M08_TABLE_30.md` w cichym oknie.
- F5.2 Screenshoty każdego ekranu → raport obrazkami → **akceptacja Piotra** (protokół po nocy 3/4.07 — zero deployu wyglądu bez jego „tak").
- F5.3 Decyzje D-A/D-B/D-C z Piotrem; po zgodzie promocja na `demo` (`deploy-demo.sh`).

### Macierz przydziału agentów

| Model | Rola | Zadania |
|---|---|---|
| **Fable 5** (ja) | Orkiestrator: baza, bramki, merge, weryfikacja adwersaryjna, raporty dla Piotra | F0, odbiory każdej fali, F5 |
| **Opus** ×2–3 | Poprawność i współbieżność | F1.1, F1.2, F2.1 + weryfikator F0.1 |
| **Sonnet** ×3–4 | Wiring UI, widoki, testy integracyjne | F2.2–F2.5, F3.1/3.2/3.4/3.7, F4.1/4.3 |
| **Haiku** ×2 | Mechaniczne, dobrze wyspecyfikowane | F3.3/3.5/3.6, F4.2 |

**Zasady twarde (z protokołu `_WSPOLPRACA_MASTER_2026-07-04.md`):** demo święte — promocja tylko po akceptacji Piotra; workerzy bez pełnego `tsc` (bramka: procesy tsc/vitest <3, cap 5 agentów, zero wnuków); merge-base audyt każdego workera vs baza; zmiany wyglądu wyłącznie przez `src/components/shared/canon/`; `git add -f` dla `tests/`.

**Szacunek całości:** ~3–4 dni robocze przy 5–7 równoległych robotnikach, fale F1/F4 mogą iść równolegle z F2/F3.

---

## 3bis. POSTĘP WYKONANIA (aktualizacja 2026-07-04, orkiestrator Fable 5)

Baza robocza: `feat/tp-fala1` (worktree), pin startowy `ef56f42092`. Model przydziału trzymany: Opus=trudne/bezpieczeństwo/współbieżność, Sonnet=wiring/testy, Haiku=mechaniczne, Fable=nadzór (zero kodowania).

**Fala 1 (backend/bezpieczeństwo) — ZAMKNIĘTA, scalona, 1571/1571 testów zielonych:**
- F0.1 weryfikacja adwersaryjna P1–P6 (Opus): potwierdziła solidność P2/P1b/P3/P5, wykryła 5 realnych luk (2× wyciek danych P0).
- F1.1 inbox powiadomień `tp_notifications` + dzwonek (Opus) — 21/21.
- F1.2 trwały storage załączników S3-za-flagą + fix cichego buga miniatur (Opus) — 24/24.
- F4.1 testy bezpieczeństwa 5 serwisów (Sonnet) — 145.
- F4.2 testy HTTP 7 tras (Sonnet) — 88.
- FIX-A 2× wyciek P0 w ViewQueryEngine (Opus), FIX-B userRole na wszystkich mutacjach + kaskada dat create/delete (Sonnet), FIX-C tranzytywna kaskada rollup A→B→C (Opus).

**Fala 2 (ożywienie UI) — ZAMKNIĘTA, scalona:**
- F2.1 realtime→stan UI z ochroną przed echem (Opus).
- F2.2 automatyzacje: bug „Uruchom teraz" działał tylko dla cron → naprawiony dla wszystkich typów (Sonnet).
- F2.3 przyciski: Import naprawiony (zły mount API), AuditTrail/ActivityFeed UKRYTE w trybie legacy (decyzja nadzorcy: idea-tabela nie ma wiersza tp_tables → panele audytu zawsze 403), Snapshot potwierdzony martwy (Sonnet).
- F2.4 UI komentarzy + weryfikacja: bug `author_id` = fałszywy alarm (Sonnet).

**Fala 3 (widoki/formularze) — 4/5 scalone:**
- F3-A Matrix crosstab + Chart podpięty + StickyNote odpięty + Galeria filtr/sort (Sonnet) — 24/24.
- F3-C publiczny widok honoruje config + serwerowe cięcie ukrytych pól (Sonnet) — 11/11.
- F3-D lookup UI + podgląd załączników/lightbox (Sonnet) — 12/12.
- F3-E naprawa 4 „czerwonych" testów (root cause: fixture bez formatRules, nie regresja a11y) + undo/redo platform (Sonnet) — 106/106.
- F3-B (Haiku) ODRZUCONY — false-green (5/9 testów czerwonych, timery realne) + naruszenie zakresu; przepisywany przez Sonneta (`feat/tp-forms-polish-v2`).

**Backlog wykryty po drodze (Fala 4):**
- 🔴 `ViewQueryEngine.buildGroupQuery` ~1088: surowe `r.data` obok aliasów → wyciek pól przy grupowaniu nawet z rolą.
- 🟠 `useTablePlatformBridge` ~192: brak `useMemo` nodes/columns → możliwy freeze w platform mode (`task_b364dbaa`).
- 🟡 test-pollution: `useTablePlatformIntegration.undoRedo.test.tsx` zielony izolowany (15/15), pada 1 test w pełnym suite (współdzielony mock) — izolacja mocków.
- 🟡 dług: dwa równoległe systemy ViewRouter (`views/` vs top-level); PAT scope method-based; osierocony reverse-field przy deleteField; niespójny ownership-guard w trasach.

## 4. Ryzyka
1. **Rozjazd gałęzi**: praca na harvard-noc, a demo żyje własnym życiem (StoryRail, canon fixes) — przy promocji możliwe konflikty; mitygacja: cherry-pick zakresowy `server/src/services/tablePlatform` + `src/components/MyWork/table`.
2. **F2.1 realtime vs optimistic updates** — najwyższe ryzyko regresji (dubel/echo); wymaga Opusa i testu wielosesyjnego.
3. **Decyzja #5 nierozstrzygnięta** — jeśli Piotr wybierze platform-first, część legacy-ścieżek IdeaTableTool do wycięcia (~40% narzędzia wg D-01); plan F2/F3 celuje w kod wspólny dla obu ścieżek, żeby nie palić pracy.
4. Dane-śmieci z testów E2E na wspólnych środowiskach (lekcja nocy 3/4.07) — E2E tylko na dedykowanej organizacji testowej.
