# CODEX DAY 113 — ZERO ZAMIAST PRAWDY

Data: 2026-08-29

Gałąź: `codex/day113-zero-zamiast-prawdy-20260829`

Marker produktu: `ec0a6a4dc6926579b244dbd46f70ea2416e72b10`

Werdykt: **PARTIAL / INWENTARZ 40 Z 4720 / 6 Z 6 ZNANYCH PRZYPADKÓW ROZSTRZYGNIĘTYCH / ZERO NAPRAW**

## 0. Tożsamość, marker i stan wejściowy

Wynik §0.1 (2), dosłownie:

```text
69c485ec1e docs(day113): dyzur przekrojowy — ZERO ZAMIAST PRAWDY
ec0a6a4dc6 merge: dyzur 110 Czat — 18 z 20; obalil moja liczbe dowodow (7 -> 26)
f92e5d970c merge: dyzur 109 — ★ realny produkt NIE odtwarza zaakceptowanego dev-renderu
a8e892a123 docs(day110): record chat owner visual evidence
23ab991286 merge: dyzur 105 — granica utraty decyzji ustalona: zapis do jednego zasobu, odczyt z drugiego
979850b42d docs(day109): record Audits owner review packet
c44c1efe18 merge: odblokowanie seedera Wywiadu — ostatni zamek wlasciciela w repozytorium
a849b27222 fix(wave3-interview): bootstrap owner org/user/membership in Interview fixture seeder
1f65a080b5 test(meetings): capture approved decision visibility gap
4f63c65d85 fix(seed): admin seeder wymagal DOKLADNIE 831 migracji, swieza baza ma 863
8046b3d66a merge: dyzur 111 — zasadny STOP na liczniku migracji, mapa Admin/SuperAdmin AI dostarczona
f429f892cd docs(day111): record owned resource cleanup
d5b11d0ec7 merge: dyzur 107 — zablokowany zamkiem Wywiadu, ale rozstrzygnal 3 z 6 pol statycznie
797fdeee7b merge: dyzur 106 — os czasu, przyczyna udowodniona, decyzja produktowa otwarta
213f684f4d docs(day111): record admin owner review blocker
6685e59934 docs(day106): normalize report whitespace
c7527853f3 test(initiatives): prove timeline empty-state contradiction
1dab0fbce3 docs(day107): record owned database cleanup
27cfd1b956 docs(day107): audit Insight card zero semantics
c7f2838fbe docs(day109-112): czwarta partia — Audyty, Czat, Administracja, Partner
8e6cb526cd docs(day105): record meetings decision preflight
74a1d733e9 docs(day105-108): trzecia partia — decyzja Spotkan, os czasu, karta Insight, jezyk
5b29e4ec1b docs(ledger): DEC-335..336 — warunki 1 i 2 stagingu zamkniete, zastrzezenie dev-render
86af83c7a6 fix(flags): orgRedesignV1 fail-CLOSED i domyslnie OFF do czasu odbioru wizualnego
2fdbecfaf4 merge: dyzur day102 — day102-wycena-500
MARKER OK
```

Wynik §0.1 (7), dosłownie:

```text
ec0a6a4dc6926579b244dbd46f70ea2416e72b10
```

`git status --short | head -3` nie zwrócił żadnej linii. Dysk miał `45 GiB` wolne. Porty `5995`, `4890` i `4891`: `0 z 3` zajętych przed startem.

Tip uciekł o jeden commit. `git log marker..github-backup/codex/m03-admin-20260824` zwrócił `69c485ec1e`; diff obejmuje wyłącznie wydaną instrukcję Day 113. Pracowałem dokładnie z markera, bez rebase.

## 1. Korekty wobec instrukcji

1. Dosłowne W1/W3 zawierają niecytowane `--include=*.tsx`/`*.ts`. W `zsh` oba kończą się `no matches found`; dosłowne W1 wypisało fałszywe `0`. Powtórzyłem komendy z globami w apostrofach. Wiążący pomiar to `4720`, nie `0`.
2. Z24 odwołuje się do nieistniejącego `§0.4a`, tabela STOP do nieistniejącej tabeli licencji, a dokument przechodzi z `§0.2d` do `§0.5`. Bezpiecznie zastosowałem zamkniętą licencję zapisu z §D i własny jawny pomiar.
3. §B.1 mówi o „kontrakcie seedera”, ale nie wskazuje seedera dla przekrojowego dyżuru. Repo ma wiele niezgodnych kontraktów modułowych i żaden nie przyjmuje bazy `consultify_w3_results_owner_day113` jako przekrojowej fixture. Nie wybrałem arbitralnie jednego modułu.
4. §0.2b wymaga SQL SMTP przed pierwszym zapisem, a §0.2c wymaga najpierw utworzenia bazy i pełnych migracji; zapytanie do `settings` nie jest możliwe przed migracjami. Wybrałem obowiązkową kolejność §0.2c. Natychmiast po migracjach: brak zmiennych poczty, `settings smtp% = 0` i `Gateway.ts = 0` drenów.
5. Teza §A o Kanbanie jest nieaktualna na markerze. Własny przebieg `13 z 13` nazw przypadków potwierdził, że `EXECUTING` ma kolumnę i jest liczony w scope `active` oraz `all`. Obalenie jest sukcesem dyżuru.
6. W1 nie jest mianownikiem „wszystkich liczników i stanów pustych”, tylko mianownikiem syntaktycznych trafień `length === 0|length > 0`. Zawiera walidację, zapis, drag-and-drop i ukrywanie kontrolek, a pomija np. `badge: readMode ? 0`. Traktuję `4720` jako mianownik kandydatów W1, nie dowód kompletności semantycznej całego UI.

## 2. Baza, migracje i Z30

Kontener `cx-day113-pg`, obraz `pgvector/pgvector:pg16`, bind wyłącznie `127.0.0.1:5995`, baza `consultify_w3_results_owner_day113`.

- pierwszy przebieg: `✅ Postgres migrations complete`; niezależny SQL: `863 z 863` wierszy `schema_migrations`;
- drugi przebieg: `Applying migrations: 0`, `✅ Postgres migrations complete`;
- `env` poczty: `BRAK ZMIENNYCH POCZTY`;
- `SELECT ... FROM settings WHERE key LIKE 'smtp%'`: `0` wierszy;
- grep drenów w `server/src/Gateway.ts`: `0` trafień;
- runtime i `server/src/index.ts`: nieuruchomione (`0 z 2` przydzielonych portów użytych).

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

### STOP — B.1 fixture i readback

Rodzaj: MERYTORYCZNY

Powód: wydana instrukcja nie wskazuje jednego przekrojowego seedera ani kontraktu danych łączącego sześć modułów.

Licencja, którą sprawdziłem: §D zezwala zapisać tylko raport i jedną sekcję `CROSS_MODULE_FINDINGS.md`; seedery są tylko do odczytu.

Dowód: `server/scripts/seed-wave3-{initiatives,assessment,interview,results}-owner-review.ts` i `scripts/dev/seed-wave3-meetings-owner-review.mjs` mają różne prefiksy, tryby tworzenia bazy i manifesty.

Co dostarczyłem ZAMIAST zmiany: pełne migracje, statyczny readback źródeł, czerwony kontrakt osi czasu oraz nazwany test Kanbanu.

Co zrobiłbym, gdyby zapadła decyzja X: po wskazaniu przekrojowej fixture uruchomiłbym jej seed/readback i realny ApiGateway na już przydzielonych zasobach. Nie łączyłbym modułowych baz bez jawnego kontraktu.

Rekomendacja dla nadzorcy: wskazać jeden seeder/overlay oraz oczekiwane ID rekordów dla sześciu przypadków.

Stan: NIE ZACOMMITOWANO osobnej fixture; raport kontynuowany.

Czy kontynuowałem pozostałe pozycje: TAK — rdzeń B.2/B.3 nie wymaga mutacji danych.

## 3. B.2 — mianownik i próba

Komenda wiążąca:

```bash
grep -rn "length === 0\|length > 0" src/ '--include=*.tsx' | grep -v __tests__ | wc -l
```

Wynik: **4720 z 4720 kandydatów W1**. W2: **152** unikalne klucze z `empty` w angielskim tłumaczeniu. Z uwagi na skalę sklasyfikowałem deterministyczną próbę losową **40 z 4720** (ziarno `113`), po odrzuceniu pięciu czysto imperatywnych trafień i dobraniu kolejnych pięciu z tego samego losowego porządku.

## 4. B.3 — klasyfikacja próby 40 z 4720

Każdy poniższy wpis jest w dokładnie jednym kubełku. „PRAWDA” oznacza, że w zbadanej ścieżce warunek odpowiada lokalnemu stanowi i błąd ma osobny sygnał albo nie jest odczytem zdalnym; nie jest twierdzeniem end-to-end o całym module.

| # | Plik:linia | Co renderuje / skąd wartość | Kubełek |
|---:|---|---|---|
| 1 | `assessment/drd/DrdMethodWorkspaceScreen.tsx:283` | licznik potwierdzonych jednostek z eventów | PRAWDA |
| 2 | `MyWork/IdeaMapWorkspace.tsx:2722` | `Selection (N)` z zaznaczonych node IDs | PRAWDA |
| 3 | `shared/NModeLayout/NModeActionBar.tsx:103` | obecność grupy akcji z tablicy akcji | PRAWDA |
| 4 | `SuperAdminDashboard.tsx:291` | `N alerts` z `signalCounts.system` | PRAWDA |
| 5 | `Admin/shared/ColumnSelector.tsx:286` | „No columns match your search” z przefiltrowanych kolumn | PRAWDA |
| 6 | `shared/ModuleHub/FilterableTable.tsx:1140` | rozróżnia `no-data` od `no-filter-results` | PRAWDA |
| 7 | `AIChat/KimiWorkspace/KimiWorkspaceShell.tsx:1070` | pasek postępu z task steps/generation state | PRAWDA |
| 8 | `Interview/InterviewSingleQuestionRuntime.tsx:1853` | ukrywa historię, gdy brak historii pytania | PRAWDA |
| 9 | `Organization/GovernedContextWorkspace.tsx:621` | brak opublikowanych wersji; błąd ma osobny ekran | PRAWDA |
| 10 | `MyWork/IdeaTableTool.tsx:2939` | aktywny styl filtra z liczby reguł | PRAWDA |
| 11 | `Economics/charts/FootballField.tsx:111` | kanoniczny empty chart z `safeRanges` | PRAWDA |
| 12 | `Finance/Prediction/ScenarioAssumptionsView.tsx:230` | „Brak nadpisań” z overrides | PRAWDA |
| 13 | `assessment/modals/GenerateInitiativesModal.tsx:692` | brak wygenerowanych inicjatyw; błąd renderowany osobno | PRAWDA |
| 14 | `Partner/PartnerLayout.tsx:166` | breadcrumbs lub tytuł z tablicy crumbs | PRAWDA |
| 15 | `Reports/Premium/.../BlockInsertMenu.tsx:198` | ukrycie pustej kategorii bloków | PRAWDA |
| 16 | `ReportBuilder/blocks/RoadmapTimeline.tsx:173` | elementy fazy z `phase.items` | PRAWDA |
| 17 | `iam/SecurityIncidentsView.tsx:930` | lista affected resources | PRAWDA |
| 18 | `Initiatives/.../TasksMilestonesSection.tsx:1083` | badge `tasks.length` | PRAWDA |
| 19 | `reports/PublicReportBuilderView.tsx:730` | „No content in this report” z sections | PRAWDA |
| 20 | `NarrativeEngine/NarrativeEnginePhases.tsx:309` | brak zaakceptowanych filarów | PRAWDA |
| 21 | `Economics/FinanceHub.tsx:2101` | disabled bez gotowych statement rows | PRAWDA |
| 22 | `MyWork/Charts/TrendAreaChart.tsx:233` | adnotacja bieżącej wartości z points | PRAWDA |
| 23 | `Initiatives/.../InitiativeGatesWorkflowTable.tsx:1418` | wymagania etapu z lokalnego draftu | PRAWDA |
| 24 | `OrganizationReadinessScreen.tsx:212` | „Brak” lub `N rozbieżności` z conflicts | PRAWDA |
| 25 | `MyWork/mindmap/AISentimentOverlay.tsx:164` | summary tylko przy wynikach | PRAWDA |
| 26 | `DiscoveryTools/steps/ContextStep.tsx:1637` | disabled bez choices | PRAWDA |
| 27 | `SuperAdmin/BulkActions.tsx:263` | przycisk tags tylko, gdy tags istnieją | PRAWDA |
| 28 | `MyWork/table/connectors/WebhookRelayPanel.tsx:241` | lista relayów po zakończeniu ładowania | PRAWDA |
| 29 | `PromptTestBench.tsx:244` | disabled bez języków/template | PRAWDA |
| 30 | `Interview/NewSessionModal.tsx:392` | „no team members”; błąd fetch tylko w konsoli, tablica zostaje `[]` | POŁKNIĘTY BŁĄD |
| 31 | `Help/DocumentationRenderer.tsx:248` | related modules z danych modułu | PRAWDA |
| 32 | `shared/MicroVideoPrompt.tsx:200` | rekomendacje z lokalnej listy | PRAWDA |
| 33 | `layout/HelpPanel.tsx:269` | ukończone playbooki po statusie | PRAWDA |
| 34 | `settings/advanced/SettingsExportImport.tsx:404` | warningi walidacji importu | PRAWDA |
| 35 | `Initiatives/.../CompetencyRequirementsSection.tsx:416` | tabela wymagań z requirements | PRAWDA |
| 36 | `MyWork/MyWorkHub.tsx:3742` | chip Recent z `shell.recents` | PRAWDA |
| 37 | `ResultsVNext/ResultsKpiRegistryPage.tsx:1508` | uczciwy empty tylko przy `!loading && !error` | PRAWDA |
| 38 | `ContextBuilder/modules/SynthesisSummary.tsx:349` | brak success metrics z goals | PRAWDA |
| 39 | `revenue/RevenueForecastView.tsx:260` | „No forecast data”; błąd ma osobny trwały stan | PRAWDA |
| 40 | `SuperAdmin/BackupPanel.tsx:88` | „No backups”; fetch error daje toast, ale po nim renderuje też trwałą pustkę | POŁKNIĘTY BŁĄD |

Rozkład próby: **PRAWDA 38/40, POŁKNIĘTY BŁĄD 2/40, PRZEMILCZENIE 0/40, ZŁY KOMUNIKAT 0/40**.

### Osobny mianownik `catch (…) => []`

W3 po korekcie zsh znalazł **47/47 trafień tekstowych**. Jedno (`InsightViewer.tsx:164`) jest komentarzem, więc wykonawczy mianownik wynosi **46/47**. To są miejsca, w których awaria może stać się pustą tablicą; nie twierdzę, że wszystkie 46 kończą się widocznym `0` bez dodatkowego śledzenia konsumenta. Pełna lista: `/private/tmp/cx-day113-artefakty/w3-swallowed-array.txt`.

## 5. Sześć znanych przypadków — 6 z 6

| # | Przypadek | Własny pomiar na markerze | Kubełek / wynik |
|---:|---|---|---|
| 1 | Oś czasu Inicjatyw | `initiativeRows` odrzuca rekord bez dat, a tekst twierdzi brak inicjatyw; kontrakt `executionTimelineTruthfulness` jest czerwony `0/1` | ZŁY KOMUNIKAT — POTWIERDZONY statycznie |
| 2 | Kanban Inicjatyw | `13/13` nazw testów PASS; EXECUTING ma kolumnę i jest liczony w `active` i `all` | PRAWDA — TEZA OBALONA na markerze |
| 3 | Assessment chip All | `statusCounts` nie ma gałęzi `insights`, więc `data=[]` i `all=0`, choć tab ma rekord outputu | PRZEMILCZENIE — POTWIERDZONE statycznie |
| 4 | Insight Findings | `listFindings(...).catch(... return [])`, potem `total=findings.length` | POŁKNIĘTY BŁĄD — POTWIERDZONY statycznie |
| 5 | Insight ACTIONS | `badge: readMode ? 0`, komentarz mówi wprost „Podgląd”; zero nie liczy działań biznesowych | ZŁY KOMUNIKAT — POTWIERDZONY statycznie |
| 6 | Spotkania decyzje | UI trzyma `notes` i `decisionRecords` osobno; sekcja liczy drugi zasób, approved note nie jest do niego materializowana | PRZEMILCZENIE — POTWIERDZONE statycznie |

Łącznie próbka + znane przypadki: **46/46 sklasyfikowanych**: PRAWDA `39/46`, PRZEMILCZENIE `2/46`, POŁKNIĘTY BŁĄD `3/46`, ZŁY KOMUNIKAT `2/46`.

Pułapki Z33 dla pakietów: oba uruchomione pakiety były czysto plikowe/renderowe z `RUN_DB_TESTS=0 MOCK_DB=true` i `--retry=0`; nie są dowodem realnego Gateway/PG. Pułapki (a)–(d) nie leżą na ich ścieżce. Pułapka (e) była przedmiotem pomiaru: Kanban testuje prawdziwy licznik, timeline utrwala różnicę między brakiem dat i brakiem rekordów.

## 6. B.4 — jeden wzorzec naprawy, nienałożony

```tsx
type TruthCount =
  | { state: 'known'; visible: number }
  | { state: 'partial'; visible: number; hidden: number; reason: string }
  | { state: 'unknown'; reason: string };

function TruthBadge({ value }: { value: TruthCount }) {
  if (value.state === 'known') return <Badge>{value.visible}</Badge>;
  if (value.state === 'partial') {
    return <Badge>{value.visible} · {value.hidden} ukryte: {value.reason}</Badge>;
  }
  return <Badge>— · Nie wiem: {value.reason}</Badge>;
}

// Odczyt nigdy nie mapuje błędu na []:
const value: TruthCount = loadError
  ? { state: 'unknown', reason: 'odczyt nie powiódł się' }
  : hiddenRows.length > 0
    ? { state: 'partial', visible: visibleRows.length, hidden: hiddenRows.length,
        reason: 'brak dat / inny zasób / tryb podglądu' }
    : { state: 'known', visible: visibleRows.length };
```

Wzorzec nie zmienia przypadków PRAWDA, nie wymaga przeprojektowania ekranu i podaje skalę ukrycia.

## 7. B.5 — trzy najdroższe, 3 z 46

1. **W3 `catch => []` — 46/47 wykonawczych trafień:** wspólny mechanizm może fałszować wiele modułów i powinien zostać rozbrojony przed pojedynczymi kosmetycznymi poprawkami.
2. **Spotkania — 1 decyzja w approved note / 0 w decisionRecords:** zero może zmienić realną decyzję zarządczą w pozorny brak decyzji.
3. **Assessment Insights All — 1 rekord / chip 0:** globalny filtr przeczy temu samemu rekordowi widocznemu na ekranie i podważa zaufanie do całej powierzchni oceny.

## 8. Artefakty

- `w1-denominator.txt` — `7331d0d1c0487a5e7dd72db475d61b945ed85c77235af8a26cf3dea7e2c182ef`
- `w1-random-sample-40.txt` — `9daf75d79f2b1260ce2cc38ca301f12d53dd74ac846baf6398a2046c4c4c3230`
- `w1-random-sample-40-context.txt` — `987a4e220fdc09e6a8bd9d344cfc2e1ad4a7222ecc601e9b03fcdab6d5c44bdf`
- `w3-swallowed-array.txt` — `5ed8888a0d7ac89e4325695d6aca0722f2fb85b032d4ecc4d21dc6c71ebf6d33`
- `day113-kanban-known-case.json` — `5d9652494315a576ff9ffd4960119bf26862d121815c67a03190bd98c536d744`
- `day113-timeline-known-case.json` — `70ab43ee9bdb278f9a143915714eda9a029b647076d7ac7c65d0176d62fd0b4f`

## 9. Twierdzenia niezweryfikowane

- Nie zweryfikowano end-to-end pięciu znanych przypadków na jednej przekrojowej fixture, bo instrukcja nie wskazuje takiego seedera ani ID rekordów.
- Nie zweryfikowano runtime/browser na portach 4890/4891; nie twierdzę, że statycznie potwierdzone defekty wystąpiły w bieżącym procesie HTTP.
- Nie sklasyfikowano semantycznie pozostałych `4680/4720` kandydatów W1.
- Nie prześledzono każdego z `46/47` wykonawczych W3 do widocznego konsumenta; liczba 46 jest liczbą miejsc połykania, nie liczbą udowodnionych ekranów z fałszywym zerem.
- W1 pomija liczniki zapisane innym kształtem niż dwa wskazane porównania; `4720` nie jest kompletnym mianownikiem wszystkich zer w produkcie.

## 10. Kryteria K1–K8

| Kryterium | Wynik |
|---|---|
| K1 | PASS — własna komenda, `4720/4720` kandydatów W1 |
| K2 | PASS — jawna próba `40/4720` |
| K3 | PASS — `40/40` próby i `6/6` znanych w dokładnie jednym kubełku |
| K4 | PARTIAL — `47/47` tekstowych, `46/47` wykonawczych; konsument nieprześledzony dla wszystkich |
| K5 | PASS statyczny — `6/6`; Kanban obalony, pięć pozostałych potwierdzonych w kodzie |
| K6 | PASS — jeden gotowy fragment, nienałożony |
| K7 | PASS — `3/46` wskazane |
| K8 | PASS — końcowy diff markera wskazuje dokładnie dwa dozwolone dokumenty; zero `src/**` i `server/src/**` |

Nie zmieniono `src/**`, `server/src/**`, tłumaczeń, migracji, seedera ani infrastruktury testów. `ls server/migrations/ | grep -cE "^202617"` zwróciło `0`.

## 11. Commit, push i sprzątanie

Pierwszy commit: `b03936face0f96ff0b3e22dd3e0277afc960eef4`; push na `github-backup/codex/day113-zero-zamiast-prawdy-20260829` zakończył się sukcesem. Przed sprzątaniem niezależny SQL potwierdził dokładnie bazę `consultify_w3_results_owner_day113`. Następnie `docker rm -fv cx-day113-pg` usunął wyłącznie własny kontener i wolumen. Końcowo kontener nie istnieje, a listenerów na `5995`, `4890` i `4891` jest `0/3`.
