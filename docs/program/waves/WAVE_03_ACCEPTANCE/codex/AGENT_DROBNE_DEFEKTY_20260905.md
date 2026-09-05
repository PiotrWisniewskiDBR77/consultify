---
doc_id: agent-drobne-defekty-20260905
status: ZAMKNIETY
---

# Agent „drobne defekty 6 modułów" — 05.09.2026

Gałąź: `agent/drobne-defekty-6-modulow-20260905` (worktree `/private/tmp/ag-drobne`,
z linii `m03`). Zlecenie: `docs/program/PLAN_NAPRAW_MVP_20260905.md` (7 pozycji,
pozycja 8 — `execution-tab-rollout` — pominięta, inny agent).

Metoda weryfikacji: dev-render (realne komponenty produkcyjne, mock dane), własny
`vite` na porcie 4777 (nie kolidował z portami innych agentów), zrzuty Playwright
JASNY motyw 1440px → `evidence/drobne-20260905/*-PO.png`. Zero zapisu do baz
stagingu/demo. Test + dowód mutacyjny dla każdej naprawy (cofnięcie fixu → test
czerwony → przywrócenie → test zielony), zweryfikowane ręcznie przed każdym
commitem.

## Tabela: pozycja → przyczyna → naprawa → test

| # | Pozycja | Przyczyna | Naprawa | Test | SHA |
|---|---|---|---|---|---|
| 1 | Czat `whiteboard-canvas` (A02) — pasek funkcji po zaznaczeniu wystaje poza okno | **JUŻ NAPRAWIONE** wcześniej (SHA `08f8194ce5`, 2026-09-02, "1100 px -> 564 px"). Plan z 05.09 przeniósł starą pozycję z korpusu bez retestu na żywym ekranie z zaznaczonym elementem (jego zrzut pokazywał pusty stan). Zmierzone na żywo: pasek 564 px w kanwie 1064 px — brak przepełnienia. | Brak zmiany kodu — dodany tylko test regresyjny, bo dotąd żaden nie istniał. | `WhiteboardSelectionBar.width.test.tsx` (3 przypadki: max-w+overflow-x-auto na kontenerze, iconOnly na wszystkich przyciskach, brak renderu przy braku zaznaczenia) | `f9aded30ef` |
| 2 | Narzędzia `karta-tool` (A10) — sekcja PRZYKŁAD z 1 pozycją jako wąska kolumna | **JUŻ NAPRAWIONE** wcześniej (SHA `05c32fc417`, 2026-08-30). Siatka `caseGrid` dopasowuje liczbę kolumn do liczby przypadków od tamtej naprawy. | Brak zmiany zachowania — wyodrębniona czysta funkcja `exampleCaseGridCols` (eksportowana) z inline logiki, żeby dało się ją testować bez montowania całego `KnownToolDetailView` (ciężkie providery). | `KnownToolDetailView.exampleGrid.test.ts` (1/2/3/5 pozycji) | `b37a8ff6f4` |
| 3a | Narzędzia `tools-outputs-insights-tab` — 3 identyczne duplikaty „Sekcja finansowa — 2025" | `DiscoveryToolsHub.fetchData` merguje 4 niezależne listy (assessment reports/report-builder/decks/tool_outputs) bez deduplikacji — pojedyncze źródło mogło zwrócić ten sam rekord wielokrotnie. | Dodana czysta, wyeksportowana `dedupeById()`, owinięte nią mapowanie KAŻDEGO z 4 źródeł osobno (pierwsze wystąpienie wygrywa) — dedupe u mappera, nie w UI, zgodnie z zleceniem. | `DiscoveryToolsHub.outputsInsightsDedupeAndI18n.test.ts` (dedupe: duplikaty/bez duplikatów/pusta lista) | `2383247a0f` |
| 3b | Narzędzia `tools-outputs-insights-tab` — kolumna TYP miesza PL/EN | Literał `isPolish ? 'Raport assessment' : ...` ORAZ i18n `tools.hub.outputs.type.assessmentReport` dosłownie trzymały angielskie słowo "assessment" w polskiej etykiecie. | Poprawione na "Raport oceny" (zgodnie z ustalonym w apce tłumaczeniem "Ocena" dla modułu Assessment) w obu miejscach (pl.json + literał w komponencie). | (ten sam plik co 3a) — asercje na brak "assessment" w pl.json i w komponencie | `2383247a0f` |
| 4 | Admin `admin-command-attention-queue` — „Ryzyka wymagające przeglądu" zawsze 0 (fala 174) | `GET /api/admin/risk/summary` zwraca `{ organizationId, summary: { audit: { highRiskCount } } }` — komponent czytał `risk?.highRiskCount` PROSTO ze szczytu obiektu (zawsze `undefined` → `?? 0` → zawsze 0). | `risk?.summary?.audit?.highRiskCount ?? risk?.highRiskCount ?? 0` (ten sam wzorzec podwójnej ścieżki co sąsiedni sygnał `health`). Naprawiony też mock w istniejącym teście, który miał PŁASKI (błędny) kształt i dlatego nie łapał defektu. | `AdminCommandCenterAttentionQueue.test.tsx` (4 testy, w tym nowy: liczba 2 nie 0) | `08d16b3a44` |
| 5a | Ustawienia `ustawienia-powiadomienia` — 1× błąd konsoli 501 | `NotificationSettings.tsx` woła `Api.getIntegrations()` → `GET /api/integrations`, w pełni zaimplementowany router, ale Gateway.ts mountuje go jako "honest 501" na środowiskach z `enableStubRoutes=false` (staging) — świadoma decyzja platformowa obejmująca 3+ innych ekranów. | Usunięty MARTWY (w tym środowisku zawsze kończy się w `catch` → pusta lista, zero widocznej zmiany) fetch z TEGO ekranu. Bramka platformowa nietknięta (poza zakresem, dotyka innych ekranów). | `NotificationSettings.integrationsCall.test.tsx` (Api.getIntegrations nigdy wołane + brak zmiany UI) | `490cd3074d` |
| 5b | Ustawienia `ustawienia-zaawansowane` — brak „Funkcje beta" w sidebarze | **NIE ODTWORZONE.** `SettingsSidebar.tsx` ma pozycję `beta-features` bezwarunkowo w grupie „advanced", bez żadnej bramki dla zwykłego użytkownika (`allowedSections` dotyczy TYLKO roli pilotażowej, ograniczonej do 4 zupełnie innych sekcji). Zrzut na żywo (dev-render, realny `SettingsView`+`SettingsSidebar`) pokazuje „Funkcje beta" z plakietką „Beta" oraz „Historia" — obie obecne. Istniejący test `SettingsSidebar.pilotSectionFilter.test.tsx` już to asercjonuje i jest zielony. | Brak zmiany kodu — zgłoszenie wygląda na nieaktualny stan przyrządu/korpusu. | (istniejący test, niezmieniony) | `490cd3074d` (evidence) |
| 6a | Organizacja `org-knowledge-graph` — chip „risk" nieprzetłumaczony | `entityTypeLabel()` zwraca surowy angielski `type`, gdy brakuje klucza w `organization.knowledgeGraph.entityTypes`. pl.json/en.json miały TYLKO 7 z 15 kanonicznych `KGEntityType` (server `unifiedKGService.ts`) — brakowało project/initiative/vendor/**risk**/decision/goal/department/skill/regulation (cała rodzina, nie tylko "risk"), plus "system" spoza kanonu, ale widoczne w danych demo. | Dodane wszystkie brakujące klucze w obu językach. `entityTypeLabel` wyeksportowana do testu. | `KnowledgeGraphExplorer.entityTypeLabel.test.ts` (17 przypadków) | `9d8203b49d` |
| 6b | Organizacja `org-scenarios` — angielskie nazwy scenariuszy | Karty scenariuszy w DOMYŚLNYM ekranie (redesign v1, `OrganizationScenariosBriefScreen.tsx`, DEC-2026-08-26-78) czytały `scenario.name`/`.description` wprost z surowych danych (`transformationScenarios.ts`). Kompletne polskie tłumaczenia JUŻ ISTNIAŁY pod `transformationScenarios.scenarios.<id>.{name,description}` — używał ich tylko stary, dziś wyłączony ekran (`ScenarioCard.tsx`). | Przeniesiony 1:1 wzorzec tłumaczenia do redesignu (4 miejsca: nagłówek rekomendacji, nazwa+opis 6 kart, „Wybrany scenariusz"). Zero nowej treści tłumaczeń. | `OrganizationScenariosBriefScreen.i18n.test.tsx` (3 testy, realne PL z translation.json) | `9d8203b49d` |
| 7 | Finanse `finance-valuation-workspace` (A32) — przyciski nagłówka są słowami | `FinanceWorkspaceBar` renderuje `actions.primary` zawsze jako pigułkę tekstową; kontrakt (`financeWorkspaceBar.contract.ts`) nie ma pola `icon` (celowo bit-identyczny z portem backendowym — rozszerzenie rozjechałoby mirror). | Lokalna, opt-in mapa `ICON_ONLY_ACTION_IDS` w SAMYM rendererze, kluczowana po `action.id` — tylko `primary.refresh-step` (jedyny id używany przez `ValuationWorkspace.tsx`) przełącza się na okrągły przycisk ikonowy. Pozostałe 4 warsztaty (Baseline/StatementPack/Prediction) bit-w-bit bez zmian. Bramka mostu (scalona dziś) nietknięta. | `FinanceWorkspaceBar.iconOnlyPrimary.test.tsx` (4 testy: Valuation ikonowy + 3 inne niezmienione) | `11e5e36359` |
| 8 | Wyniki `execution-tab-rollout` | POMINIĘTE — inny agent. | — | — | — |

## Dowody wzrokowe

Wszystkie w `evidence/drobne-20260905/` (dev-render, port 4777, jasny motyw, 1440px):
`whiteboard-canvas-selection-PO.png` · `karta-tool-przyklad-PO.png` ·
`tools-outputs-insights-tab-PO.png` · `admin-command-attention-queue-PO.png` ·
`ustawienia-powiadomienia-PO.png` · `ustawienia-zaawansowane-funkcje-beta-PO.png` ·
`org-knowledge-graph-PO.png` · `org-scenarios-PO.png` ·
`finance-valuation-workspace-header-PO.png`.

## Pozycje NIENAPRAWIONE (z powodem)

- **5b (`ustawienia-zaawansowane` — Funkcje beta)**: nie odtworzone na realnym
  kodzie; zostawione bez zmiany, żeby nie robić spekulacyjnej naprawy czegoś, co
  runtime pokazuje jako działające. Jeśli Piotr nadal nie widzi tej pozycji na
  demo/staging, potrzebny nowy zrzut z TEGO konkretnego środowiska (możliwa
  przyczyna: stan zapamiętany w `localStorage`/cache przeglądarki, albo
  rzeczywiście inny build niż ten checkout).

## Uwaga poboczna (nie naprawiona, poza zakresem 7 pozycji)

`FinanceWorkspaceBar.test.tsx` ma 1 pre-istniejący, niezwiązany z tym zleceniem
fail: `„Nieaktualne · Przelicz"` oczekiwane, otrzymane `„Outdated·Przelicz"` —
i18n rozpoznaje język inaczej niż zakłada test. Potwierdzone identyczne PRZED
i PO wszystkich 7 naprawach (`git stash` + retest). Nie naprawiane w tym
dyżurze — kandydat do osobnego zgłoszenia.

## Higiena wykonania

- Worktree `/private/tmp/ag-drobne` z `m03`, `node_modules` symlink do `m03`
  (bez pełnego `npm install`).
- Commit per pozycja (autor Piotr <piotr.wisniewski@dbr77.com>), 7 commitów.
- Zero `git push`, zero zapisu do baz stagingu/demo (GET z tokenem
  `ODBIOR_AUTH_STATE` nie był potrzebny — cała weryfikacja przez dev-render
  z mock danymi).
- Własny `vite --config dev-render/vite.config.ts --port 4777` — zatrzymany po
  PID (20509+20352) na koniec, bez `pkill`.
- Nie ruszane: DocumentStudio*/report-builder, ExecutionHub, AssessmentHub/
  panel Zarządzania/macierz DRD, idea-table/DecisionDetailView/Notebook,
  Inicjatywy, karty standardowe, UnifiedCreateLauncher/InterviewHub/canvas
  toolbar (Wywiad/Czat), bramka mostu Finansów (`FinanceLegacyBridgeGate`).
