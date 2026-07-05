# ★★★ ROLLOUT TRIADY — INWENTARZ + PLAN (2026-07-04)
> ⇒ **WEJŚCIE DLA NASTĘPNEGO AGENTA: `_HANDOFF_TRIADA_2026-07-04.md`** (pełna procedura wznowienia, stan gałęzi, pułapki). Czytaj JEGO najpierw.
> Gdzie w aplikacji wchodzą komponenty standardu (StandardModuleBar/StandardTable/StandardPreview). Każda pozycja odbierana **40-punktową listą czekowania** (TRIADA_KANON.md część B). Kolejność = golden path najpierw.

## ⚠ OTWARTE PYTANIE PIOTRA (2026-07-04 wieczór) — DO ROZSTRZYGNIĘCIA
Piotr: „wiersze powinny mieć po prawej stronie kwadracik do oznaczenia wielu wierszy". STAN: checkbox selekcji jest po LEWEJ (zgodnie z rannym dyktowaniem „po lewej każdej linii" + wzorzec My Work) we wszystkich 4 zrobionych tabelach. ROZBIEŻNOŚĆ: teraz „po prawej". Do wyjaśnienia gdy Piotr wróci: (a) zostaje lewa (uwaga dotyczy tabel NIEruszonych bez checkboxa — Results/Execution/Materiały/Admin), czy (b) zmiana kanonu na prawą (poprawka StandardTable = app-wide). NIE zmieniać bez decyzji.

## ZAKRES — co JEST tabelą-listą (triada), a co NIE
- **W ZAKRESIE:** tabele-listy = główna powierzchnia modułu (wiersze = encje, filtry, preview, kebab, checkbox).
- **POZA ZAKRESEM (inny spec — tabela-treść w dokumencie):** renderery DeckBuilder/DocumentStudio/ReportBuilder/blocks, AIChat/Artifacts/renderers, InitiativeDocumentView tabele treści (~12 plików). NIE dotykamy triadą.

## STAN WYJŚCIOWY (grep repo)
- ~70 plików już konsumuje FilterableTable/TableWithPreviewLayout (częściowo kanon — do domknięcia 40-pkt).
- 262 pliki z surowym `<table>` — z tego większość w admin/superadmin (32+21+15+8...) = FALA 3; reszta to tabele-treści (poza zakresem).

## FALA 1 — GOLDEN PATH (priorytet; 8 przystanków StoryRail)
| Moduł | Powierzchnie-listy | Stan |
|---|---|---|
| **My Work** | MyTasksListContent · DecisionsPanelContent · InboxContent · IdeasTableContent · table/GridView | ✅ WZORZEC (to jest kanon — nie zmieniamy, z niego czerpiemy) |
| **Assessment** | AssessmentTable · InitiativesTable · ReportsTable · manage/* | 🔨 ADOPTER TRIADY (zbudowany na `triada-standard`, do weryfikacji) |
| **Interview** | InterviewHub · QuestionsList · InsightViewer | 🟡 FilterableTable, 40-pkt niedomknięte |
| **Initiatives** | InitiativesHub · Portfolio/PortfolioListView · Analysis/PortfolioAnalysisView | 🟡 FilterableTable + kanban do KANON A9 |
| **Execution** | ExecutionHub · Manager/ProblemTable · RolloutTab | 🟡 FilterableTable, białe karty EVM do naprawy |
| **Results/KPI** | ResultsKPITable · ResultsKpisTableV3 · ROIAnalysisView · KpiQueueView · Reconciliation · Scorecards | 🟡 dużo tabel, niejednolite |
| **Finance** | FinanceHub · EconomicsHub | 🟡 FilterableTable |
| **Materiały (R&P)** | ReportsTabContent · PresentationsTabContent · TemplatesTabContent · OutputsAggregate | 🟡 FilterableTable |

## FALA 2 — POZA GOLDEN PATH, ale żywe moduły
Audit/AuditsHub · Benefits/BenefitsHub · Meeting/MeetingHub · Discovery/DiscoveryToolsHub · ReportBuilder (Templates/BlockTypes) · Organization (CompetencyCatalog/AdminPanel) · Subscriber/SubscriberDispatchTable.

## FALA 3 — ADMIN / SUPERADMIN (surowe <table>, najniższy priorytet demo)
Admin/* (~36 plików) · superadmin/* (~49 plików: iam, security, revenue, AIPlatform) · settings · billing · workspaces. Wiele osiągalnych tylko dla superadmina — reachability-driven (nie malujemy martwego).

## METODA WDROŻENIA (per powierzchnia, bez wyjątków)
1. Podepnij StandardTable/ModuleBar/Preview (moduł deklaruje treść; wygląd narzucony).
2. **AUDYT 40 PUNKTÓW** (TRIADA_KANON część B) — literalnie, klikając: pstryczek, kebab, preview, bulk, sort/resize/filtr, dark+light.
3. Zrzuty: ekran + otwarty kebab + otwarty pstryczek + preview → obok wzoru My Work.
4. Odbiór Piotra na zrzutach → deploy. Odrzut → poprawka w tym kroku.
5. Log wyniku listy (X/40) dopięty do raportu.

## ★ WYNIK K1 — AUDYT ADOPTERA ASSESSMENT (2026-07-04, nadzorca oczami, ~16/34)
Powłoka OK, interaktywne elementy NIE podpięte (build over-claimed):
- ✅ Menu 1/2/3 (pigułki z ramką, aktywna neutralna, CTA prawy, chipy z licznikami) · tabela (nagłówek uppercase, sort, hairline, cichy status, „—").
- ❌ **Pstryczek** = wariant „EDIT COLUMNS" (wyszukiwarka+oczy), NIE kanoniczny „VISIBLE COLUMNS + Show row description".
- ❌ **Kebab** = Open/Preview/Duplicate/Edit/Delete — brak bloku uniwersalnego z Archive, luźna struktura.
- ❌ **Preview** = podwójny nagłówek, brak chipów meta/AI/Relations/siatki akcji; czerwony „Open detail" (crimson leak). Legacy body renderuje się w slocie StandardPreview.
- ❌ **Checkbox selekcji** niewidoczny na wierszach.
**WNIOSEK: triada NIE gotowa jako dowód. Potrzebny FIXING PASS przed rolloutem** (podpiąć realne StandardPreview body + kanoniczny pstryczek TableSettingsPopover + kanoniczny kebab 5 bloków + zabić czerwony przycisk + checkbox). Dopiero po ponownym audycie ≥ komplet → zrzuty do Piotra → rollout.

## ★★ FIXING PASS ZWERYFIKOWANY (2026-07-04, nadzorca oczami — worktree /tmp/triada)
Odkrycie robotnika: żywa trasa /assessment = `AssessmentHub.tsx` (2300 linii legacy), NIE `AssessmentTable.tsx` (decoy). Robotnik przepiął zakładkę 'list' AssessmentHub na Standard* (commity 6fb79511fe + 4092aa40f1 StandardKanban). AUDYT OCZAMI POTWIERDZIŁ:
- ✅ Pstryczek = kanoniczny „VISIBLE COLUMNS" (Name/Actions LOCKED + „Show row description" + Reset).
- ✅ Kebab = 5 bloków z separatorami (Open/Duplicate │ Open preview/Edit/Archive-disabled-z-notą │ Delete czerwony ostatni).
- ✅ Preview = 6 bloków kanoniczny, PreviewActionButton, ZERO crimson, pojedynczy nagłówek.
- ✅ Checkbox + tryb bulk („1 selected/Select all/Clear/Delete").
- ✅ StandardKanban zbudowany (test 7/7) — wizualna weryfikacja przy 1. module z kanbanem (Initiatives).
OTWARTE (poza 4 bugami): Menu1/2 AssessmentHub na własnym chrome; zakładki reports/initiatives legacy; light-mode. Galeria PRZED/PO → Piotr (artifact triada-fix). CZEKA NA „TAK" przed rolloutem + przed deployem (worktree, nie demo).

## KOLEJNOŚĆ WYKONANIA
K1. ✅ Audyt adoptera. K2. ✅ FIXING PASS zweryfikowany. K3. ✅ **DEPLOY: triada ŻYWA na demo `2bbb9de734`** (merge deploy-triada z origin/demo + focus-fixy; sanity: My Work wzorzec nietknięty, Finance/Initiatives bez regresji, 0 błędów; Assessment kanoniczny na żywym demo — zweryfikowane oczami). K4. ✅ **Interview Inbox** — zaudytowany oczami (pstryczek/kebab/preview/bulk kanoniczne, Start/Open/Delay przyciski 4-wariantowe, zero crimson w nowym kodzie; 5 crimson w pliku = zastany dług w innych zakładkach, nie tknięte). Commit 290c78ea33 w triada-standard (jeszcze NIE na demo). Żywy plik: InterviewHub.tsx branch assignmentsViewMode==='list'. Otwarte: numerki ①②③ w zakładkach, tryb 'cards', pozostałe zakładki legacy.
K5. ✅ **FALA 1 BATCH DEPLOY na demo `de684aa8d8`**: Interview Inbox + Finance Statements + Initiatives Portfolio — WSZYSTKIE 3 zaudytowane oczami (kanoniczne: pstryczek/kebab/preview/bulk, zero crimson w nowym kodzie; zastany dług crimson w niedotkniętych częściach = osobny sweep). Golden path na triadzie: **Assessment ✅ · Interview ✅ · Finance ✅ · Initiatives ✅ (4/8 na żywym demo)**. StandardKanban zbudowany (do adopcji na kanbanach).
K6. ✅ **Results/KPI catalog — DEPLOY na demo `240102eada`** (2026-07-05): robotnik Sonnet podpiął StandardTable+StandardPreview do `ResultsHub.tsx` zakładka `results_kpi`+catalog (żywy plik, `ResultsKpisTableV3`/`ResultsKPITable` nietknięte — poza zakresem). Robotnik SAM zgłosił brak weryfikacji wzrokowej (brak env/DB) — nadzorca zrobił pełny audyt oczami przed deployem: **znaleziony i naprawiony bug** — kolumny miały `width: '18%'` itd., ale `parsePx()` w FilterableTable oczekuje px (string z `%` ignorowany, liczba brana dosłownie jako px) → nagłówki nachodziły na siebie; fix = piksele (wzorem Assessment/Interview). Po fixie: pstryczek/kebab (5 bloków, Archive disabled-z-notą)/preview (6 bloków)/bulk — kanoniczne, zero nowego crimson. Znane, NIE-blokujące long-tail: Relations renderuje się jako zwykły tekst nie klikalna pigułka (ale wzorzec Assessment na demo wysyła `relations={[]}` czyli tak samo nieklikalne — brak regresji); `MENU_3_ACTION_DANGER` (bulk Delete) ma zdefiniowany `dark:` wariant ale w testowanym buildzie renderował się jako light-mode różowy — dzieli ten sam współdzielony styl co MyWork/Assessment/Finance/Initiatives, więc to PRZEDISTNIEJĄCY dług tokenów koloru, nie regresja Results. **Golden path: Assessment ✅ · Interview ✅ · Finance ✅ · Initiatives ✅ · Results ✅ (5/7 na żywym demo).**
**ZOSTAJE:** Execution · Materiały. + osobne zadania w tle: crimson-leak initiativeLifecycle STATUS_METADATA (task_c336deaa), usunięcie AssessmentItemPreview martwego (task_7dce153a), sweep zastałego crimson w niedotkniętych częściach hubów, MENU_3_ACTION_DANGER dark-mode token (danger-500 nie generuje reguły — sweep osobny, dotyczy 4+ modułów).
⚠ LEKCJA: nie zabijaj robotników w panice na load — [[feedback_nie_zabijaj_robotnikow_w_panice]]. Finance uratowany po błędnym zabiciu.
⚠ LEKCJA (05.07): `width` w kolumnach StandardTable/FilterableTable MUSI być pikselowy string (`'160px'`), NIGDY procentowy (`'16%'`) — `parsePx()` po prostu wyciąga cyfry, więc `'16%'` → `16px`. Sprawdzić przy każdym nowym adopterze.
⚠ LEKCJA (05.07): worktree pod `/tmp/<nazwa>` może dawać puste/nietransformowane odpowiedzi Vite (fs.allow kontra symlink `/tmp`→`/private/tmp`) — twórz worktree bezpośrednio pod `/private/tmp/<nazwa>` albo wskazuj w launch.json realpath.

## K7. FALA 1 BATCH 2 — DEPLOY na demo `91ece5e907` (2026-07-05, popołudnie)
7 równoległych robotników (Sonnet, worktree `/private/tmp/tr-*`) + 1 naprawa nadzorcy:
- **Audit** (programy audytowe, AuditsHub.tsx) ✅ — kebab/preview/checkbox/bulk kanoniczne. Znany koszt: istniejący test `AuditsHub.test.tsx` prawdopodobnie czerwony (asercja na usunięty `ProgramDashboard` tekst "Completion") — DO NAPRAWY w oddzielnym kroku.
- **Meeting** (lista spotkań, MeetingHub.tsx) ✅ — zaudytowane oczami, kebab/preview kanoniczne.
- **Materiały** (4 komponenty): OutputsAggregateTabContent (All/Mine/Review — Sheets współdzieli persistKey), ReportsTabContent (Documents), PresentationsTabContent, TemplatesTabContent — wszystkie ✅ zaudytowane oczami. Znany dług: Presentations **brak checkboxa selekcji** (robotnik świadomie zgłosił, nie ukrył); Templates/Outputs — checkbox jest ale BRAK paska bulk-akcji w Menu3 (bo te taby nie są właścicielem Menu3 — architektura `ReportsAndPresentationsHub`, osobna sprawa do rozwiązania jeśli chcemy bulk).
- **Results** — druga zakładka KPI (`results_reports`+`tracked`, wcześniej `ResultsKpisTableV3`) ✅ scalona z catalog przez wspólną funkcję `renderKpiStandardTable()` (robotnik bezpiecznie zrefaktoryzował zamiast duplikować 1:1, po potwierdzeniu że `ResultsKpisTableV3` nie ma innych konsumentów). Stary plik `ResultsKpisTableV3.tsx` osierocony, zostawiony nietknięty.
- **★ NAPRAWA NADZORCY — crimson-leak we WSPÓŁDZIELONYCH komponentach preview** (`PreviewAIBrief.tsx`, `PreviewAIHintStrip.tsx`, `PreviewBatchPanel.tsx`, `PreviewDetailsSection.tsx`, `PreviewMetaCard.tsx`): `primary-50` do `primary-950` w tailwind.config.js to WSZYSTKIE odcienie crimson #85182F (nie neutralna paleta) — sekcja "AI" i pill tone='info' w preview u WSZYSTKICH już żywych modułów (Assessment/Interview/Finance/Initiatives/Results) miały subtelny czerwony poblask, niewidoczny na pierwszy rzut oka. Naprawione na `c-info` (niebiesko-fioletowy token, ten sam co "Watched KPI"/info tony gdzie indziej). To była PIERWSZA rzecz do sprawdzenia przy audycie kolejnych fal — [[finding_crimson_leak_shared_preview_components]].
- Deploy: merge triada-standard→deploy-triada, wykryto równoległy push innej sesji (`f80b660024` — feedback loop/superadmin/security alerts/observability/Document Studio, 5 commitów) — scalone bez konfliktów (`git merge origin/demo`, NIE force-push), zsynchronizowano też triada-standard.
**Golden path + Fala 2: Assessment ✅ · Interview ✅ · Finance ✅ · Initiatives ✅ · Results (2/8 zakładek) ✅ · Meeting ✅ · Audit ✅ · Materiały (4/8 komponentów) ✅ na żywym demo.**

## K8. ZOSTAJE (kolejne fale, w kolejności rosnącego ryzyka)
- **Execution** (2 realne kandydaty: List ~ExecutionHub.tsx:5201, Reports ~4366 — OBA w jednym pliku, dispatch sekwencyjny nie równoległy żeby uniknąć konfliktu na tym samym pliku).
- **Finance** (6 zakładek: Statements ✅już-zrobione-Fala1-wcześniej/Models/Analysis/Prediction/Valuation/Investment — WSZYSTKIE w jednym FinanceHub.tsx, dispatch sekwencyjny).
- **Interview** (5 realnych kandydatów, WSZYSTKIE w jednym InterviewHub.tsx, funkcje BARDZO DUŻE 400-1000+ linii: renderSessionsTable/renderAssignmentsTable(×3 taby)/renderTemplatesTable/renderInsightsTable + zakładka Initiatives niezweryfikowana — najwyższe ryzyko, dispatch pojedynczo, jeden na raz, nie równolegle).
- Osobne zadanie w tle: naprawić `AuditsHub.test.tsx` (asercja "Completion" po usunięciu ProgramDashboard).
K2. Golden path Fala 1 pozycja po pozycji (Interview → Initiatives → Execution → Results → Finance → Materiały).
K3. Fala 2. K4. Fala 3 (reachability-driven).
