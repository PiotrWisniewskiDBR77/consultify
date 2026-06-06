# Consultify — Master Readiness Report (Audyt całego systemu)

**Data:** 2026-06-02
**Zakres:** 19 modułów (warstwa kontraktowa `docs/modules/NN_*`) + 2 audyty przekrojowe (UI/design, build/test/CI)
**Metoda:** 1 agent na moduł — każdy czytał `STATUS/CODEMAP/SSOT`, a następnie **weryfikował realny kod** (mock vs real, wiring backendu, testy, spójność UI). Werdykty oparte na dowodach `plik:linia`. Dokumenty traktowane jako podejrzane (ostatnia aktualizacja ~10–12 maja, dziś 2 czerwca).
**Pełne karty per moduł:** `docs/audit/2026-06-02/MODULE_NN_*.md`

---

## 1. Werdykt jednym zdaniem

System jest **architektonicznie bogaty i ma mocny, przetestowany backend, ale warstwa produktowa (frontend) jest niegotowa na rynek**: dużo gotowego UI jest schowane, dużo widocznego UI to mocki/placeholdery, dane demo wyciekają do ścieżek produkcyjnych, UI jest niejednorodny (5 konkurencyjnych shelli), a pokrycie testami frontu to ~2,75%. **Średnia gotowość: ~51/100.** To nie jest „prawie gotowe MVP" — to „silny silnik bez spójnego nadwozia".

---

## 2. Tablica gotowości (posortowana)

| # | Moduł | Wynik | Tier | Najważniejszy problem |
|---|-------|:----:|------|----------------------|
| 18 | Ustawienia | 72 | Beta | Calendar OAuth udawany; usuwanie konta bez hasła; AI-settings 503 przy starcie |
| 03 | Wywiad | 72 | Beta | 8 akcji „coming soon"; brak frontowego wywołania bramki jakości; 0 testów frontu |
| 01 | Czat | 68 | Beta | Canvas startup `NO_GO`; `AIChatWelcomeView` (~2400 lin.) to martwy kod |
| 16 | Organizacja | 68 | Beta | Zaproszenia wyłączone w prod (`mountStub`); panel „canon" to statyczny marketing |
| 09 | Outputs | 62 | Beta | Demo-data fallback w prod; brak bramki approval-before-export; brak ścieżki Teresa→Outputs |
| 12 | Prezentacje | 62 | Beta | `/prezentacje` za bramką kontaktową; kolaboracja wyłączona; historia wersji tylko w pamięci |
| 05 | Inicjatywy | 58 | Alpha | `/roi` to literalny „Under Construction"; `/roadmap` deprecated z TODO; generator inicjatyw `mountStub` |
| 02 | Moja Praca | 57 | Alpha | Brak migracji `v8_process_flow_*`; migracja notatnika niezacommitowana; Radar z hardkodem |
| 04 | Narzędzia | 52 | Alpha | 20 z 31 narzędzi renderuje „Step content not implemented yet"; Megatrends bez danych |
| 06 | Realizacja | 52 | Alpha | `/rollout` (legacy SplitLayout) bez persystencji i bez nawigacji; duplikat panelu AI |
| 07 | Rezultaty | 52 | Alpha | Brak bramki finalizacji raportów na HTTP; brak lock/approval w ROI UI |
| 10 | Dokumenty | 52 | Alpha | Edycje giną po restarcie (in-memory Map); rozjazd `/wordy` vs `/document-studio`; ukryte w prod |
| 19 | Portal Partnerski | 48 | Alpha | 12 endpointów 503; `/payouts` zepsuty auth; `PerformanceSection` z hardkodem; `@ts-nocheck` |
| 08 | Finanse | 42 | Alpha | **Płatność kartą jest fałszywa** (`pm_..._mock`); 35 endpointów billingu zwraca 503 |
| 11 | Tabele | 42 | Alpha | Records API za flagą domyślnie OFF; `applyProposal` to no-op stub; materializer to stub |
| 17 | Panel Administratora | 38 | Alpha | **P0: SUPERADMIN wchodzi na `/admin`**; 65 paneli zbudowanych, niezamontowanych |
| 13 | Meeting | 28 | Alpha | `MeetingHub` gotowy, ale route renderuje „coming soon"; brak transkrypcji |
| 14 | MCP IRIS | 22 | Alpha | Tylko placeholder marketingowy; brak panelu runtime IRIS |
| 15 | MCP Marketplace | 14 | Alpha | Tylko landing „coming soon"; brak jakiegokolwiek UI katalogu |

---

## 3. Dziewięć systemowych wzorców (to jest sedno „bałaganu")

Te problemy powtarzają się w niemal każdym module — naprawa ich **raz, systemowo** podnosi wszystkie moduły naraz. To są dźwignie o najwyższym zwrocie.

### S1. Backend mocny, front słaby (rozjazd warstw)
Niemal każdy moduł ma realny, obszerny, **przetestowany** backend (np. `pmo/initiatives.routes.ts` 2195 lin., `presentations.routes.ts` 6121 lin., `document-studio.routes.ts` 4300 lin., 83 handlery interview). Problem prawie zawsze leży na froncie: niewpięte, zamockowane, albo schowane. **Wniosek: brakuje głównie warstwy wykończeniowej UI + wpięcia, nie fundamentów.**

### S2. Dane demo/mock wyciekają do ścieżek produkcyjnych ⚠️ (landmina rynkowa)
Pokrycie: 02, 03, 04, 07, 08, 09, 16, 19. Wzorce groźne:
- `shouldUseResultsShowcaseData()` / `shouldAllowDemoData()` aktywują się na `localhost`/`DEV` **lub przy 404/503 z API** → przy źle skonfigurowanym endpoincie produkcyjny tenant **po cichu widzi fałszywe dane** (`useRapData.ts`, `resultsShowcaseData.ts:85`).
- `partnerDemoSeedService` zasiewa fałszywe prowizje/atrybucje **każdej** nowej organizacji partnerskiej.
- Migracje typu `223_billing_mock_seed.sql`, `228_partner_referral_mock_seed.sql` sieją mocki do schematu prod.
**To jest pierwsza rzecz, którą zobaczy płacący klient — i będzie to fikcja.**

### S3. „Zbudowane, ale niezamontowane" (ogromny ukryty zapas wartości)
Bardzo dużo skończonego UI jest niedostępne dla użytkownika:
- `MeetingHub` — kompletny, route renderuje `V4ComingSoonView` (13).
- **65 paneli Admin** zaimplementowanych, zero mountów; sidebar pokazuje 1 pozycję (17).
- `DocumentStudioView` — pełny, bez pozycji w sidebarze, ukryty w prod (10).
- Records API Tabel za flagą `ENABLE_TABLE_PLATFORM_RECORDS_API` = OFF (11).
- DeckBuilder MELS, Tabele MELS — gotowe adaptery shella, flagi OFF (11, 12).
- `/prezentacje` za bramką kontaktową (12).
**Część „brakujących funkcji" to w rzeczywistości jeden PR z odmontowaniem zaślepki.**

### S4. Zero testów frontu
~53 pliki testów komponentów na ~1924 komponenty (**~2,75%**). Backend i E2E są dobrze pokryte (375 plików testów serwera, 169 spec E2E). Każda karta modułu kończy się „brak testów frontu". To ryzyko regresji przy każdej zmianie UI.

### S5. Fragmentacja UI — pięć konkurencyjnych shelli (Twoje „grafiki nie są jednorodne") — ocena D
- **5 wzorców shella** aktywnych: `ModuleHub` (14 hubów, standard), `SplitLayout` (17 plików, legacy, niezatwierdzony), `KimiWorkspaceShell` (4), `ExecutiveModuleShell`/MELS (3), brak shella (5 hubów).
- **1458 zahardkodowanych hex `#rrggbb`** w 209 plikach; **36 366** użyć `slate-*` zamiast tokenów `navy-*`/`primary`; 1288 inline `style={{}}`.
- **3 implementacje Buttona**, 2 Card (forki w `Admin/shared/`).
- **Brak jakiegokolwiek egzekwowania** freeze-registry w kodzie (żadnej reguły ESLint).

### S6. Śmieci po niechlujnych merge'ach
**183 pliki-duplikaty `" 2.tsx/.ts"`** (156 w `src/`, 27 w `server/src/`) — kopie kolizyjne Findera, nigdy nie importowane, ale zaśmiecają ESLint/coverage/IDE. Plus `_backup/`, `_quarantine/`, 4 `.codex-worktrees/`, dziesiątki plików `Foo 2/3/4.tsx` w `DiscoveryTools/`. `src/services/api 2.ts` istnieje obok `api.ts`.

### S7. Rozjazd doc-vs-kod
STATUS.md/CODEMAP.md przestarzałe w wielu modułach (10, 11, 12, 14, 17, 18 — niektóre opisują stan z maja jako „V4ComingSoonView", gdy kod już renderuje realne widoki, albo odwrotnie chwalą się gotowością, której nie ma). Dokumentacja nie jest wiarygodnym źródłem statusu — **ten audyt nim jest**.

### S8. Luki bezpieczeństwa (P0/P1)
- **P0:** `SUPERADMIN (3) >= ADMIN (2)` w `ProtectedRoute.tsx:24` → superadmin wchodzi na `/admin/*` bez audytu (`ADM-RAW-P0-001`).
- **P0:** Płatność kartą fałszywa — `AddCardModal.tsx:95` wysyła `pm_${Date.now()}_mock` zamiast Stripe Elements.
- **P1:** Usuwanie konta bez weryfikacji hasła (`settings.routes.ts:3010`, jest TODO).
- **P1:** `/api/partners/payouts` czyta `req.user?.partnerOrgId`, którego middleware nie ustawia → trasa zepsuta.

### S9. „Ciche degradacje" (503 / try-catch / TABLE_MISSING)
Wiele tras po cichu zwraca 503 lub pusty wynik, gdy brakuje tabeli/serwisu — zamiast jawnego błędu. Finanse (35 endpointów), Tabele (`requireTablePlatform`), Process Flow (`TABLE_MISSING`), Megatrends (silent try/catch), MCP (`tryGetColumns` → `[]`). Skutek: funkcja „wygląda, że działa", a nie robi nic — najgorszy rodzaj długu, bo niewidoczny.

---

## 4. Krytyczne blokery (P0 — naprawić zanim ktokolwiek zapłaci)

1. **Stripe/płatności** — `AddCardModal` to mock; nie da się przyjąć realnej karty. (08)
2. **Superadmin → /admin bez audytu** — decyzja właścicielska + guard. (17)
3. **Dane demo w produkcji** — twarda bramka: demo tylko na jawny flag tenanta, nigdy na 404/503. (S2)
4. **Usuwanie konta bez hasła** — dodać weryfikację. (18)
5. **Migracje niezacommitowane / brakujące** — `20260602_notebook_containers.sql` (uncommitted), `v8_process_flow_*` (brak pliku). Bez nich funkcje 503-ują. (02)

---

## 5. Co dalej — plan w falach (rekomendacja)

> Filozofia: **najpierw systemowe dźwignie (podnoszą wszystkie moduły naraz), potem dokończenie modułów wg wartości rynkowej.** Nie ścigaj się modułami w izolacji — większość bólu jest wspólna.

### Fala 0 — Higiena i blokery (1–2 tygodnie, najwyższy ROI)
- [ ] Usuń 183 pliki `" 2"` + `_backup`/`_quarantine`/martwe `Foo 2/3.tsx` (zero ryzyka, natychmiastowa czystość). *(można puścić jako osobny task)*
- [ ] Napraw 5 padających testów `api.test.ts` (brak eksportu `clearGlobalTransportFailure` w mocku).
- [ ] Usuń `--noCheck` z `server build` (błędy typów lecą cicho na Railway).
- [ ] **Twarda bramka demo-data**: jeden helper `isDemoTenant()` na jawnym flagu; wytnij aktywację na 404/503 i na `localhost`/`DEV` w ścieżkach prod.
- [ ] Domknij 5 blokerów P0 z §4.

### Fala 1 — Standaryzacja UI (atakuje Twój główny ból „bałagan")
- [ ] Migracja `SplitLayout → ModuleHub` (16 widoków nie-assessment; zacznij od `MyWorkView`, `ExecutiveView`, `LeadershipDashboardView`).
- [ ] Zastąp `Admin/shared/Button|Card` importami z `ui/primitives/`.
- [ ] Sweep tokenów: `slate-* → navy-*`/`primary` w komponentach nawigacji i topach modułów.
- [ ] Reguła ESLint: zakaz `style={{}}` poza `ui/`, zakaz nowych shelli bez RFC (egzekwowanie freeze-registry).
- [ ] Ujednolić ścieżki „coming soon": jedna decyzja per route — odmontuj zaślepkę albo schowaj z nawigacji.

### Fala 2 — „Odmontuj zaślepki" (szybkie odblokowanie gotowej wartości)
- [ ] Zamontuj `MeetingHub` na `/meeting` (+ napraw bug `operatorBrief.meetingId`). (13)
- [ ] Włącz Records API Tabel + gwarancja migracji; podłącz `applyProposal` do realnych mutacji. (11)
- [ ] Podłącz sidebar + routing dla paneli Admin (billing/AI/security) zamiast aliasów do „people". (17)
- [ ] Rozwiąż tożsamość `/wordy` vs `/document-studio`; dodaj pozycję w sidebarze; persystuj edycje do DB. (10)
- [ ] Zdejmij bramkę kontaktową z `/prezentacje`; włącz flagi MELS (adaptery gotowe). (12, 11)

### Fala 3 — Dokończenie modułów wg wartości (równolegle, per owner)
Priorytet wg „blisko gotowe + wysoka wartość rynkowa":
- **Wykończ do Beta→GA:** 18 Ustawienia, 03 Wywiad, 01 Czat (Canvas P0), 16 Organizacja, 09 Outputs, 12 Prezentacje.
- **Podnieś z Alpha:** 05 (ROI view), 02 (Process Flow + Radar), 04 (realne kroki 20 narzędzi), 06 (rollout persistence), 07 (bramki KPI/ROI).
- **Decyzja strategiczna:** 08 Finanse (Stripe + 35 endpointów — duży nakład), 14 IRIS, 15 Marketplace (praktycznie nie istnieją na froncie — zdecyduj: budować teraz czy ukryć z mapy do czasu).

### Fala 4 — Sieć bezpieczeństwa (równolegle, ciągłe)
- [ ] Pokrycie testami frontu — zacznij od smoke-render każdego huba (19 plików) i ścieżek krytycznych (płatność, GDPR, zapis profilu).
- [ ] Zamień „ciche 503" na jawne stany błędu/empty-state w UI (S9).
- [ ] Zredukuj `@ts-nocheck` (207 plików) — zacznij od wave-services serwera i `@ts-nocheck` w Portalu Partnerskim.

---

## 6. Decyzje, których potrzebuję od Ciebie (właścicielskie)

1. **MCP IRIS (14) i Marketplace (15)** — budujemy teraz, czy chowamy z sidebara do osobnej fazy? (Dziś to puste landingi z badge „soon".)
2. **Finanse/Billing (08)** — czy płatności Stripe są w zakresie najbliższego release? To duży, samodzielny strumień.
3. **Superadmin↔Admin granica (17, P0)** — czy superadmin ma mieć dostęp do `/admin` (z audytem), czy całkowicie odciąć?
4. **Demo data** — czy zgoda na twardą bramkę (ryzyko: środowiska demo/sprzedażowe stracą „ładne" dane, dopóki nie ustawimy flagi tenanta)?
5. **„Coming soon"** — które moduły mają zniknąć z nawigacji do czasu gotowości (lepsze pierwsze wrażenie), a które zostawić z badge?

---

## 7. Załączniki (karty per moduł)

`MODULE_01_czat.md` · `MODULE_02_moja-praca.md` · `MODULE_03_wywiad.md` · `MODULE_04_narzedzia.md` · `MODULE_05_inicjatywy.md` · `MODULE_06_realizacja.md` · `MODULE_07_rezultaty.md` · `MODULE_08_finanse.md` · `MODULE_09_outputs.md` · `MODULE_10_dokumenty.md` · `MODULE_11_tabele.md` · `MODULE_12_prezentacje.md` · `MODULE_13_meeting.md` · `MODULE_14_mcp-iris.md` · `MODULE_15_mcp-marketplace.md` · `MODULE_16_organizacja.md` · `MODULE_17_panel-administratora.md` · `MODULE_18_ustawienia.md` · `MODULE_19_portal-partnerski.md`
Przekrojowe: `CROSS_UI_CONSISTENCY.md` · `CROSS_BUILD_TEST_HEALTH.md`
