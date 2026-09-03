# Martwe komponenty — runda 2 (rodzina) — 03.09.2026

Robotnik: Sonnet 5, worktree `/private/tmp/ag-martwe-2`, gałąź `agent/martwe-komponenty-2-20260903`
z bazy `HEAD` worktree `/private/tmp/m03` (17dfbc0c8a).

## Zlecenie i metoda bezpiecznika rundy 1

Bezpiecznik rundy 1 (commit `ee4594b393` / `c8b94973cf`, 03.09 popołudnie): usunięto
`InitiativesTable.tsx`, `ReportsTable.tsx`, `AuditsHub.tsx` + testy + 90 kluczy i18n
(`assessment.initiativesBoard.*` 25, `assessment.reportsTable.*` 47 głównych + zagnieżdżone
liście — zweryfikowano niezależnie: 32304→32214 liści en = -90, zgodne z commitem). Metoda: `fs.existsSync() === false` w
`tests/unit/initiatives/initiativeRecordCanon.test.ts`, describe
„martwe komponenty odbioru 2026-09-03 nie wracają”.

Rejestr `docs/program/REJESTR_ZNALEZISK_20260903.md`, D11: `OrganizationV8CanonPanel.tsx`
martwy (zero importerów, 10 wystąpień crimson) → „Usunąć osobno”.

## KROK 0 — pomiar całej rodziny (nie pojedynczego pliku)

Metoda: dla każdego `*.tsx` w `src/components` (poza `__tests__`, `.test.*`, `.stories.*`,
`index.tsx`) — **2222 plików** — zbudowano jednoprzebiegowy indeks wszystkich specyfikatorów
importu (`from '...'` i `import('...')`) w `src/`, `dev-render/`, `server/`, `tests/`, po czym
sprawdzono, czy nazwa bazowa pliku (bez rozszerzenia) występuje w tym indeksie. Kandydatów
(zero trafień) potwierdzono **indywidualnie** przez `git grep -lE` per plik (238/238 sprawdzeń
wykonanych) — jeden fałszywy trop na 238 (`StatusPill.tsx`, jedyne trafienie to przykład kodu
w `StatusPill.README.md`, nie realny importer).

**Wynik: 238 kandydatów z zerem importerów** (potwierdzone git grep, nie tylko heurystyką).

### ⚠️ Rozbieżność z oczekiwaniem instrukcji

Instrukcja: „Spodziewam się kilkudziesięciu kandydatów; NIE usuwaj hurtem.”
Pomiar: **238 kandydatów**, nie kilkadziesiąt — rząd wielkości większy niż oczekiwano.
Zgodnie z regułą „jeśli Twój pomiar przeczy mojej liczbie, obowiązuje Twój” — raportuję
238 jako liczbę wiążącą i traktuję to jako sygnał, że hurtowe usuwanie całej rodziny w
jednym dyżurze byłoby nieodpowiedzialne, niezależnie od zakazu w instrukcji.

### Odkrycie po drodze: część „sierot” to już znany, udokumentowany dług decyzyjny

Głęboka weryfikacja (`git grep` całego repo po samej nazwie, nie tylko wzorcu importu) ujawniła,
że duża część kandydatów **nie jest anonimową martwotą** — jest już opisana w istniejących
dokumentach z otwartymi decyzjami właściciela:

- **`src/components/settings/*` (45 kandydatów)** — w całości pokryte przez
  `docs/program/waves/WAVE_03_ACCEPTANCE/SETTINGS_DAY55_REPORT_20260828.md` (dyżur 55,
  27/28.08): „46 LIVE, 113 ORPHAN”. Przykład: `AIAutomationSettings.tsx` ma w tym raporcie
  wprost zapisane „**DO DECYZJI WŁAŚCICIELA** — zabrakło decyzji, czy funkcja ma wejść do
  wymaganej przez DEC-227 powierzchni stagingowej, czy zostać usunięta”. Usunięcie tych
  plików w tym dyżurze nadpisałoby nierozstrzygniętą decyzję właściciela.
- **`src/components/SuperAdmin/*` (20 kandydatów)** — 11/20 wymienionych wprost w
  `Harvard/wdrozenie-100/M27-superadmin.md` (moduł M27, lista named paneli:
  FeatureFlagsPanel, SecurityPanel, ApiManagementPanel, ConfigurationPanel, AnalyticsPanel,
  BackupPanel, BulkActions, SuperadminRootClosurePanel, ContentAnalyticsDashboard/…,
  PlaybookTemplate{Analytics,Comments,Reviews,VersionHistory} — wszystkie w mojej liście 238).
  `Harvard/modules/M27-superadmin/evidence/f2_tests_report.md` odnotowuje nawet
  „**stale import**” w teście `SuperadminRootClosurePanel.test.tsx` — dowód, że ten
  konkretny plik był kiedyś aktywnie testowany/rozwijany, nie porzucony od zawsze.
- **17 kandydatów ma testy w równoległym drzewie `tests/components/**`**, których naiwne
  sprawdzenie współlokowanego `__tests__/` (użyte w pierwszym przebiegu metadanych) nie
  wykryło — m.in. `MyWork/TodayDashboard.tsx`, `MyWork/WorkloadView.tsx`,
  `analytics/TokenUsageAnalytics.tsx`, `SuperAdmin/EmailConfigurationPanel.tsx`.
  Bez tej korekty te 17 plików trafiłoby do R1 jako rzekomo „zero testów”.

Wniosek: przy tej skali (238) nie da się bezpiecznie odróżnić „prawdziwej martwoty” od
„udokumentowanego długu decyzyjnego czekającego na Piotra” bez indywidualnego sprawdzenia
KAŻDEGO kandydata wobec istniejących audytów (SETTINGS_DAY55, M27-superadmin i — być może —
innych, których w czasie tego dyżuru nie zdążyłem przeszukać dla pozostałych 173 kandydatów
spoza settings/SuperAdmin). Usuwanie na ślepo złamałoby „NIE usuwaj hurtem” w duchu, nawet
przy oddzielnym commicie na plik.


## R1 — usunięte w tym dyżurze

**1 plik**: `src/components/Organization/OrganizationV8CanonPanel.tsx` (147 linii, 10× `primary`,
zero importerów, zero testów, brak w dev-render, brak w status.json/g06). Commit `95505e3426`.

- i18n: komponent nie używał `t()`/`useTranslation` (hardkodowany angielski tekst w JSX) —
  **0 kluczy do usunięcia**. Liście i18n PRZED = PO w obu plikach (en 32256, pl 34245) —
  różnica 0, zgodna z 0 usuniętymi kluczami.
- esbuild sąsiada (`OrgContextSummaryBanner.tsx`, plik z komentarzem odnoszącym się do
  zastąpionego panelu) po usunięciu: OK, 0 błędów.

## R2 — bezpiecznik rozszerzony

`tests/unit/initiatives/initiativeRecordCanon.test.ts`, nowy `describe`
„martwe komponenty odbioru 2026-09-03 runda 2 nie wracają” z `fs.existsSync() === false` dla
`OrganizationV8CanonPanel.tsx`. `npx vitest run tests/unit/initiatives/initiativeRecordCanon.test.ts`:
**6/6 PASS** (3 z rundy 1 + 2 istniejące testy kanonu inicjatyw + 1 nowy z rundy 2).

## R3 — kandydaci NIEUSUNIĘCI w tym dyżurze (237 z 238)

Tabela pełna poniżej. Skrót powodów:

| Rodzina | Liczba | Powód nieusunięcia |
|---|---|---|
| `settings/*` | 45 | Pokryte `SETTINGS_DAY55_REPORT_20260828.md` — decyzje per-plik w toku, część ma otwarte „DO DECYZJI WŁAŚCICIELA” |
| `SuperAdmin/*` | 20 | Moduł M27-superadmin udokumentowany (`Harvard/wdrozenie-100/M27-superadmin.md`), 11/20 wymienionych wprost, jeden ze śladem „stale import” w teście |
| 17 plików z innych rodzin | 17 | Mają test w równoległym drzewie `tests/components/**` (odkryte dopiero głębszą weryfikacją — nie były widoczne przy naiwnym sprawdzeniu współlokowanego `__tests__/`) |
| Pozostałe (AIChat, MyWork, ReportBuilder, DiscoveryTools, Reports, Benefits, billing, ui, workspaces, Help, Onboarding, Partner, Presentations, layout, shared, ai, i in.) | 155 | Nie zweryfikowane indywidualnie wobec istniejących audytów w tym dyżurze — skala (238) uniemożliwiła bezpieczne pokrycie całości bez ryzyka nadpisania nieznanego mi kontekstu decyzyjnego (analogicznego do settings/SuperAdmin) |

**Rekomendacja**: podzielić pozostałe 237 kandydatów na osobne dyżury per rodzina katalogowa
(tabela grupowania niżej), każdy z własnym przeglądem wobec `docs/`/`Harvard/` przed usunięciem —
zgodnie z „NIE usuwaj hurtem” i wzorcem z `_SIEROTY_DECYZJA_2026-07-15.md` (3 podobne sieroty
zatwierdzone do usunięcia dopiero po indywidualnym opisie + rekomendacji dla Piotra).

### Grupowanie wg katalogu (do podziału na przyszłe dyżury)

| Rodzina | Liczba kandydatów |
|---|---|
| settings | 45 |
| MyWork | 26 |
| SuperAdmin | 20 |
| AIChat | 15 |
| ReportBuilder | 10 |
| shared | 9 |
| DiscoveryTools | 7 |
| Reports | 7 |
| ai | 6 |
| billing | 6 |
| ui | 6 |
| workspaces | 6 |
| Benefits | 5 |
| Help | 5 |
| Onboarding | 5 |
| Partner | 4 |
| Presentations | 4 |
| layout | 4 |
| pozostałe pojedyncze/2-osobowe rodziny | ~38 |

## Pełna tabela 238 kandydatów (zero importerów potwierdzone git grep, jeden po jednym)

| Plik | Linie | crimson(primary) | Test (dowolny) | Decyzja / powod |
|---|---|---|---|---|
| `src/components/AIAnalyticsDashboard.tsx` | 573 | 4 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/ActiveModeStrip.tsx` | 88 | 6 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/ChatExportModal.tsx` | 129 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/ChatLanguageSelector.tsx` | 116 | 1 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/ChatOverlay.tsx` | 228 | 6 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/ChatToggleButton.tsx` | 89 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/CoThinkerModeSelector.tsx` | 191 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/DiagramArtifact.tsx` | 217 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/ImageAttachment.tsx` | 364 | 8 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/KimiWorkspace/WorkbookVersionHistoryModal.tsx` | 250 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleActions.tsx` | 201 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/OrganizationMemoryPanel.tsx` | 376 | 28 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/ResearchClarification.tsx` | 241 | 4 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/ResponseQualityIndicator.tsx` | 345 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/TTSIndicator.tsx` | 63 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIChat/WorkModeMenu.tsx` | 273 | 9 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AIInsightFeed.tsx` | 120 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AdvancedAnalytics.tsx` | 131 | 1 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/AiInsightModal.tsx` | 154 | 1 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Audit/AuditHistoryView.tsx` | 240 | 8 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Benefits/FinancialMappingPanel.tsx` | 568 | 3 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Benefits/KPIAttributionPanel.tsx` | 431 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Benefits/LessonsLearnedPanel.tsx` | 542 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Benefits/ROIAnalysisView.tsx` | 508 | 3 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Benefits/ROITrackingPanel.tsx` | 347 | 2 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/CV/CandidateProfileView.tsx` | 800 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/CaseWorkspace/podglad/main.tsx` | 243 | 0 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/Charts/RechartsWrapper.tsx` | 140 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ConversionModal.tsx` | 109 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/CookieConsentBanner.tsx` | 296 | 8 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Discovery/InsightDetailView.tsx` | 605 | 5 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/DiscoveryTools/AmbitionDecomposerLibraryGraphic.tsx` | 210 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/DiscoveryTools/CapabilityMapperLibraryGraphic.tsx` | 202 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/DiscoveryTools/FocusTradeoffLibraryGraphic.tsx` | 216 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/DiscoveryTools/NarrativeEngineLibraryGraphic.tsx` | 196 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/DiscoveryTools/ValueChainLibraryGraphic.tsx` | 200 | 10 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/DiscoveryTools/tools/RiskUncertainty/RisksStep.tsx` | 184 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/DiscoveryTools/tools/RiskUncertainty/ScenariosStep.tsx` | 149 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Economics/FinanceModelDocumentView.tsx` | 294 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/EmptyStates/AxisEmptyState.tsx` | 116 | 1 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/EmptyStates/TeamEmptyState.tsx` | 103 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Feedback/FeedbackFloatingButton.tsx` | 87 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/FullPilotWorkspace.tsx` | 321 | 2 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/FullReportDocument.tsx` | 242 | 9 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Gamification/AchievementsList.tsx` | 94 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Gamification/UserLevelBadge.tsx` | 93 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Help/FloatingHelpWidget.tsx` | 54 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Help/GlobalHelpSearch.tsx` | 454 | 20 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Help/OnboardingPlaybooksPanel.tsx` | 424 | 22 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Help/VideoPlayer.tsx` | 625 | 10 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Help/WhatsNewModal.tsx` | 355 | 13 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/InAppNudges/SmartNudge.tsx` | 105 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/InitiativeDetailModal.tsx` | 3020 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Interview/NewSessionModal.tsx` | 595 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Interview/SummaryView.tsx` | 281 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Journey/JourneyProgressBar.tsx` | 180 | 12 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Journey/MilestoneBadge.tsx` | 152 | 1 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Knowledge/MediaUploader.tsx` | 576 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Landing/DemoButton.tsx` | 208 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Landing/HeroSection.tsx` | 333 | 4 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/MyWork/Dashboard/BottleneckAlerts.tsx` | 203 | 3 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/MyWork/Dashboard/ExecutionScoreCard.tsx` | 222 | 3 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/Dashboard/VelocityChart.tsx` | 194 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/Dashboard/WorkloadHeatmap.tsx` | 249 | 1 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/MyWork/DecisionReviewNext.tsx` | 238 | 4 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/Focus/AICoachPanel.tsx` | 116 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/Focus/NudgeStrip.tsx` | 90 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/FocusCockpit.tsx` | 388 | 4 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/Home/RadarTriageCard.tsx` | 247 | 4 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/LocationFilter.tsx` | 151 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/Notifications/NotificationCenter.tsx` | 548 | 3 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/MyWork/Notifications/NotificationPreferences.tsx` | 378 | 0 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/MyWork/NotificationsContent.tsx` | 1426 | 1 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/NotificationsKanbanBoard.tsx` | 823 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/ProgressView.tsx` | 449 | 2 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/MyWork/TodayDashboard.tsx` | 185 | 0 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/MyWork/WorkloadView.tsx` | 331 | 1 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/MyWork/mindmap/SmartGuidesOverlay.tsx` | 168 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/notebook/AITopicsPanel.tsx` | 340 | 2 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/shared/KeyboardShortcutsModal.tsx` | 144 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/shared/ReadEditToggle.tsx` | 128 | 1 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/table/PublicFormView.tsx` | 566 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/table/connectors/ProvenanceBadge.tsx` | 292 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/table/extensions/ExtensionHost.tsx` | 232 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/table/extensions/ExtensionMarketplace.tsx` | 339 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/MyWork/table/offline/OfflineIndicator.tsx` | 119 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Onboarding/FeatureSpotlight.tsx` | 295 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Onboarding/GoalSelector.tsx` | 286 | 1 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Onboarding/QuestionExplanation.tsx` | 156 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Onboarding/SnapshotLabel.tsx` | 125 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Onboarding/TourTrigger.tsx` | 101 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/OnboardingTour.tsx` | 186 | 1 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Organization/OrganizationV8CanonPanel.tsx` |  | 0 | nie | **USUNIETY R1** (D11, commit 95505e3426) |
| `src/components/PMO/PMOStatusBar.tsx` | 249 | 1 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Partner/AcademyProgress.tsx` | 376 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Partner/CommissionIntelligence.tsx` | 404 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Partner/PartnerLifecycleCanonPanel.tsx` | 213 | 0 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/Partner/TrustProgressionIndicator.tsx` | 221 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Presentations/BrandKitSettings.tsx` | 341 | 8 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Presentations/DeckBuilder/AgentPanel.tsx` | 24 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Presentations/DeckBuilder/EditCardPopup.tsx` | 218 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Presentations/PresentationWizard.tsx` | 335 | 6 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Projects/ProjectTeamBoard.tsx` | 555 | 4 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ReportBuilder/BlockRenderer.tsx` | 107 | 0 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/ReportBuilder/ReportEditor/BlockAIActions.tsx` | 382 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ReportBuilder/ReportEditor/BrandVoicePanel.tsx` | 447 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ReportBuilder/ReportEditor/CreateInitiativeModal.tsx` | 191 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ReportBuilder/ReportEditor/EntityLinksPanel.tsx` | 243 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ReportBuilder/ReportEditor/SourceTraceabilityPanel.tsx` | 258 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ReportBuilder/ScheduleReportModal.tsx` | 333 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ReportBuilder/steps/IntentStep.tsx` | 764 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ReportBuilder/steps/OutlineProposalStep.tsx` | 295 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ReportBuilder/steps/UploadChaosStep.tsx` | 432 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Reports/ExecutiveReport.tsx` | 329 | 6 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/Reports/ImportReportModal.tsx` | 468 | 15 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Reports/Management/ReportComments.tsx` | 395 | 12 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/Reports/Management/shared/TrendIndicator.tsx` | 219 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Reports/ReportCommentPanel.tsx` | 498 | 30 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Reports/ReportsEntryRouter.tsx` | 32 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Reports/SponsorReportView.tsx` | 638 | 5 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/RoadmapCapacityHeatmap.tsx` | 280 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/RolloutStrategyTab.tsx` | 228 | 3 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/RolloutTeamsTab.tsx` | 192 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/SidebarUsage.tsx` | 50 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/SuperAdmin/AnalyticsPanel.tsx` | 93 | 1 | tak | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/ApiManagementPanel.tsx` | 131 | 0 | nie | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/BackupPanel.tsx` | 155 | 0 | tak | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/BulkActions.tsx` | 697 | 6 | nie | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/ConfigurationPanel.tsx` | 145 | 0 | tak | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/ContentAnalyticsDashboard.tsx` | 414 | 14 | nie | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/ContentCategoriesManager.tsx` | 454 | 12 | nie | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/ContentFilters.tsx` | 465 | 15 | nie | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/ContentSearch.tsx` | 494 | 12 | nie | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/ContentTagsManager.tsx` | 401 | 0 | nie | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/EmailConfigurationPanel.tsx` | 589 | 19 | tak | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/EmailTemplatesPanel.tsx` | 15 | 0 | nie | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/FeatureFlagsPanel.tsx` | 508 | 2 | tak | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/IntegrationsPanel.tsx` | 302 | 9 | nie | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/PlaybookTemplateAnalytics.tsx` | 303 | 4 | nie | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/PlaybookTemplateComments.tsx` | 412 | 15 | tak | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/PlaybookTemplateReviews.tsx` | 597 | 18 | nie | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/PlaybookTemplateVersionHistory.tsx` | 304 | 10 | nie | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/SecurityPanel.tsx` | 216 | 0 | tak | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/SuperAdmin/SuperadminRootClosurePanel.tsx` | 20 | 0 | tak | R3 - modul M27-superadmin (Harvard/wdrozenie-100/M27-superadmin.md), czesciowo dokumentowany |
| `src/components/Team/MultiPerspectiveView.tsx` | 280 | 6 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/Trial/TrialTransitionConfirmation.tsx` | 264 | 1 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ai/DiffView.tsx` | 243 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ai/DraftReviewPanel.tsx` | 379 | 6 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ai/FeedbackButtons.tsx` | 223 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ai/MAXModeToggle.tsx` | 180 | 12 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ai/PlaybookStepEvidence.tsx` | 232 | 12 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ai/ProactiveNudgeDisplay.tsx` | 357 | 7 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/analytics/TokenUsageAnalytics.tsx` | 362 | 13 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/assessment/modals/InitiativeDetailsModal.tsx` | 525 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/assessment/modals/TransferToRoadmapModal.tsx` | 303 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/auth/EmailVerificationBanner.tsx` | 165 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/banners/LowBalanceBanner.tsx` | 99 | 3 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/banners/UpgradePromptBanner.tsx` | 226 | 3 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/billing/PaymentMethodsPanel.tsx` | 287 | 16 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/billing/PlanCard.tsx` | 169 | 1 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/billing/QuotaWarningBanner.tsx` | 99 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/billing/SubscriptionManager.tsx` | 515 | 14 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/billing/TaxSettingsForm.tsx` | 416 | 14 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/billing/UsageAlertsConfig.tsx` | 375 | 5 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/dashboard/LiveDashboard.tsx` | 472 | 7 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/dashboard/OnboardingDashboard.tsx` | 178 | 19 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/documents/ContextAssetSelector.tsx` | 252 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/layout/ChatPanel.tsx` | 832 | 45 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/layout/DemoBanner.tsx` | 131 | 1 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/layout/DemoTopbarStatus.tsx` | 150 | 3 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/layout/HelpPanel.tsx` | 356 | 4 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/legal/LegalAcceptanceModal.tsx` | 350 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/settings/AIAutomationSettings.tsx` | 237 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/AIInstructionsSettings.tsx` | 307 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/AIParametersSettings.tsx` | 248 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/AIPersonalitySettings.tsx` | 140 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/AISecuritySettings.tsx` | 456 | 2 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/AccountManagementSettings.tsx` | 145 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/AccountRecoverySettings.tsx` | 258 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/ActivityLog.tsx` | 23 | 0 | tak | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/AdvancedSettings.tsx` | 880 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/AppearanceSettings.tsx` | 579 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/ApprovalPatternManager.tsx` | 484 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/AvatarUploader.tsx` | 74 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/BillingSettings.tsx` | 84 | 0 | tak | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/BioAboutSection.tsx` | 354 | 0 | tak | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/BrandKitGovernanceSettings.tsx` | 553 | 8 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/CloudDataSettings.tsx` | 319 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/DNDModeSettings.tsx` | 223 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/EmailCommunicationSettings.tsx` | 435 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/EmailNotificationsSettings.tsx` | 76 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/EmailSignatureSettings.tsx` | 396 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/FeatureFlagsDevToolsToggleButton.tsx` | 67 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/IntegrationAnalyticsSettings.tsx` | 597 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/IntegrationHealthSettings.tsx` | 448 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/IntegrationSettings.tsx` | 2054 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/LegalSettings.tsx` | 257 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/LoginHistorySettings.tsx` | 126 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/NotificationDigestSettings.tsx` | 262 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/NotificationScheduleSettings.tsx` | 93 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/OrganizationProfileForm.tsx` | 1043 | 4 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/OrganizationSettings.tsx` | 641 | 0 | tak | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/PermissionRequestSection.tsx` | 523 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/PrivacyDataSettings.tsx` | 712 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/ProfileBioSettings.tsx` | 288 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/ProfileCompletenessIndicator.tsx` | 135 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/ProfileSocialSettings.tsx` | 259 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/ProfileStatusSettings.tsx` | 209 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/ProfileSurveyNudge.tsx` | 395 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/ProfileVisibilitySettings.tsx` | 377 | 0 | tak | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/ProfileWorkHoursSettings.tsx` | 319 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/PushNotificationsSettings.tsx` | 219 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/ResponseStyleSettings.tsx` | 91 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/SessionsActivitySettings.tsx` | 406 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/SocialLinksSection.tsx` | 88 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/SoundNotificationsSettings.tsx` | 286 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/settings/security/WebAuthnSettings.tsx` | 429 | 0 | nie | R3 - pokryty SETTINGS_DAY55_REPORT_20260828.md (46 LIVE/113 ORPHAN, decyzje per-plik w toku, przyklad: AIAutomationSettings ma otwarte 'DO DECYZJI WLASCICIELA') |
| `src/components/shared/AICardDraftModal.tsx` | 269 | 7 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/shared/AIConfigCore.tsx` | 447 | 15 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/shared/AppIcon.tsx` | 58 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/shared/MicroVideoPrompt.tsx` | 280 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/shared/NModeBlocks/ArtifactLinkIndicator.tsx` | 142 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/shared/NModeBlocks/ArtifactPreviewCard.tsx` | 299 | 5 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/shared/StatusChangeToast.tsx` | 120 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/shared/StatusPill.tsx` | 169 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/shared/TablePresentationToggle.tsx` | 91 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ui/HelpButton.tsx` | 77 | 2 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ui/composed/DataTable.tsx` | 321 | 2 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/ui/radio-group.tsx` | 78 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/ui/slider.tsx` | 67 | 2 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/ui/toast.tsx` | 95 | 0 | tak | R3 - ma test (wspolulokowany lub w tests/), niepewny bez przegladu tresci testu |
| `src/components/ui/toaster.tsx` | 17 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/workspaces/AIInsightFeed.tsx` | 27 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/workspaces/FullROIWorkspace.tsx` | 318 | 2 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/workspaces/FullStep1Workspace.tsx` | 280 | 4 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/workspaces/FullStep2Workspace.tsx` | 301 | 1 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/workspaces/FullStep5Workspace.tsx` | 243 | 0 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |
| `src/components/workspaces/FullStep6Workspace.tsx` | 249 | 4 | nie | R3 - rodzina nie zweryfikowana indywidualnie w tym dyzurze (skala 238 > oczekiwane dziesiatki) |

## Metoda weryfikacji (powtarzalna)

1. `scripts/dev/find-dead-components2.py` — jeden przebieg buduje zbiór wszystkich
   specyfikatorów importu w `src/`, `dev-render/`, `server/`, `tests/`, dopasowuje wg nazwy
   bazowej pliku. Kandydat = nazwa bazowa nieobecna w zbiorze. (2222 plików → 238 kandydatów,
   2.7s.)
2. Każdy z 238 zweryfikowany osobno: `git grep -lE "from ['QUOTE][^'QUOTE]*/NAZWA['QUOTE]|import\(['QUOTE][^'QUOTE]*/NAZWA['QUOTE]\)" -- src dev-render server tests`
   (QUOTE = pojedynczy lub podwójny cudzysłów, NAZWA = nazwa pliku bez rozszerzenia),
   wynik minus sam plik. 237/238 = 0 trafień; 1 (`StatusPill.tsx`) = 1 trafienie, ale w pliku
   `.README.md` (przykład kodu w dokumentacji, nie realny importer).
3. Dla `OrganizationV8CanonPanel.tsx` dodatkowo: `git grep -n "OrganizationV8Canon"` (bez
   rozszerzenia, żeby złapać częściowe/dynamiczne odwołania) — 0 trafień poza samym plikiem
   i jednym komentarzem.
4. `docs/program/grafika/status.json` i `scripts/dev/g06-macierz-ekrany.json` nie zawierają
   ŻADNYCH odwołań do nazw plików `.tsx` (operują na id ekranów, nie nazwach komponentów) —
   sprawdzenie „czy w status.json” jest więc strukturalnie zawsze „nie” dla tych plików;
   właściwym substytutem jest sprawdzenie czy komponent jest montowany w `dev-render/`
   (co i tak jest już zawarte w kroku 1 — harness importuje przez tę samą ścieżkę).

## Pliki robocze (nie commitowane, w /tmp)

`scripts/dev/find-dead-components2.py` i `scripts/dev/dead-candidates-meta.py` w repo
(commitowane, przydatne dla przyszłych dyżurów). Surowe listy pośrednie
(`/tmp/dead-candidates2.txt`, `/tmp/dead-verify-final.tsv`, `/tmp/dead-mirror-tests.tsv`)
NIE są częścią repo (poza scratchpadem).
