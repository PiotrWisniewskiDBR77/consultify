# F2-2 Realizacja E2 Praca — niezależny przegląd 2026-09-14

**Werdykt: REQUEST_CHANGES — dostarczona część poprawnie pokazuje trzy okna czasu za domyślnie wyłączoną flagą, ale nie jest jeszcze generatorem analizy z §R.2 i nie pozwala przełożonemu wykonać wymaganych działań.**

## Tożsamość odbioru

- kandydat: `a0c6770b352d7a22cf477b547cd31dfca80dadbb`
- baza i merge-base: `88f1a1994dffa8b1f3b706476078844cbb43441f`
- gałąź autora: `codex/realizacja-cztery-przyciski-20260913`
- status wejściowy: czysty
- migracje: brak

## Blokery

### P1 — brak tygodniowego generatora i trwałego wyniku analizy

`SPEC_FALA2_20260912.md` §R.2 wymaga, aby analiza generowała się sama na początku tygodnia albo na żądanie dla wskazanego tygodnia. Kandydat implementuje wyłącznie klientowe `buildExecutionWorkAnalysis(...)`, lokalny stan daty i natychmiastowe przeliczenie `useMemo`. Nie ma definicji kadencji, wywołania planisty, uruchomienia `reportRun`, zapisu wyniku ani przycisku generowania na żądanie. Wybranie daty filtruje bieżąco pobrane rekordy, ale nie tworzy raportu, który może powstać automatycznie i zostać później odczytany.

Dowód źródłowy: `src/components/Execution/reports-intelligence/WorkIntelligenceReport.tsx` — `selectedWeek` i `useMemo` analizy; `src/components/Execution/reports-intelligence/workAnalysisModel.ts` — czysta funkcja modelu. W całym produkcyjnym torze E2 brak wywołania scheduler/reportDefinition/reportRun.

### P1 — wymagane akcje przełożonego nie są osiągalne z analizy

§R.2 wymaga eskalacji, delegacji i zmiany przypisanych zasobów przez przełożonego z istniejącego `managerActionExecutionService`. `WorkIntelligenceReport` nie importuje klienta tej usługi ani nie renderuje żadnej z tych akcji. Widoczna sekcja „What management should do” kończy się komunikatem, że rekomendacja nie jest wydawana. Istniejący serwis i jego trasy pozostały w repo, lecz kandydat nie łączy ich z wierszem zadania/decyzji ani z analizą.

Dowód zachowania: oba zrzuty produkcyjnego bundle pokazują raport do końca rejestru bez akcji; `WorkIntelligenceReport.tsx` nie ma wywołania manager action. To jest zachowanie użytkowe, nie brak opisu.

### P1 — „wymaga uwagi” jest tylko liczbą, bez wskazania czego i dlaczego

Model poprawnie wylicza `BLOCKED`, `OVERDUE`, `UNASSIGNED` i `NO_DUE_DATE`, ale UI pokazuje wyłącznie `Requires management attention: N`. Nie renderuje listy rekordów ani powodów, więc użytkownik nie może ustalić, na co ma zwrócić uwagę. To nie spełnia zdania §R.2 „Raport pokazuje, na co warto zwrócić szczególną uwagę”.

Dowód: `workAnalysisModel.ts` zwraca `attention`, lecz `WorkIntelligenceReport.tsx` odczytuje tylko `analysis.attention.length`.

### P1 — przy prawdziwym API nazwa projektu degraduje się do identyfikatora

Warstwa UI obsługuje `projectTitle`, a zrzut pokazuje przyjazną nazwę „North plant transformation”, lecz fixture przeglądarkowy dostarczył tę nazwę ręcznie. Zmieniona trasa `GET /execution-cases` zwraca tylko `projectId`; test Gateway/JWT/PostgreSQL także asertuje tylko `projectId`. UI w takim przypadku ustawia `projectTitle = projectId`, więc rzeczywisty raport pokaże UUID zamiast nazwy projektu. Dowód przeglądarkowy nie odtwarza zachowania prawdziwej trasy.

Dowód źródłowy: `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` mapuje `initiativeTitle` i `projectId`, bez `projectTitle`; `WorkIntelligenceReport.tsx` ma fallback `projectTitle: executionCase.projectTitle ? ... : executionCase.projectId`.

## Elementy odebrane pozytywnie

- Trzy półotwarte okna istnieją: poprzedni tydzień, następny tydzień i następne 30 dni; poprzedni tydzień używa `completedAt` dla rekordów domkniętych.
- Zadania, decyzje i kamienie milowe niosą tytuł, priorytet oraz projekt; grupowanie po projekcie i priorytecie jest deterministyczne.
- `executionCaseVersion:null` renderuje opis „version not reported”, bez `v—`.
- `VITE_EXECUTION_WORK_ANALYSIS` jest domyślnie OFF, jawny opt-in działa; przy OFF nowy raport nie pojawia się w Menu 3. Wspólne flagi fali B `execRiskSignal` i `execHandoffTrace` zachowano i pozostają domyślnie OFF.
- Testy fali B: 15/15 PASS (`ExecutionBankViews.falaB.behavior` 6/6, `executionBankHandoff` 9/9). Jeden sąsiedni test K5 podglądu pozostaje czerwony (`licznik słów znika...`); diff E2 nie zmienia testu ani prozy liczonej w tym przypadku, ale pełna kwalifikacja linii tego testu pozostaje poza dowodem tej paczki.
- EN/PL: 10/10 kluczy `execution.workAnalysis`, z identycznym mianownikiem. Nowe klasy: zero `primary-*`, zero `crimson`, zero nieistniejącego `bg-c-surface-muted`; wszystkie wykryte tokeny `c-*` istnieją w `src/index.css`.
- Nowy rejestr używa `StandardTable`; ekran pozostaje we wspólnym `ExecutionHub`/`StandardModuleBar`.

## Odtworzone dowody

- focused E2 + bank: 6 plików / 34 testy PASS, `--retry=0`;
- dodatkowy wariant focused: 6 plików / 31 testów PASS;
- CTO risk/handoff: 15/15 PASS;
- Real PostgreSQL `consultify_s4` przez `ApiGateway` + JWT na `cx-s4-e2-pg:5290`: 2/2 PASS, `DB_TYPE=postgres`, `RUN_DB_TESTS=1`, `MOCK_DB=false`;
- serwer: `npx tsc -p server/tsconfig.json --noEmit` — exit 0;
- zrzuty light/dark: obejrzane, różne sumy SHA-256, tabela zwęża się do poprzedniego tygodnia, wizualnie czytelne; oba potwierdzają brak akcji przełożonego;
- freeze manifest: lista 40/40 plików zgodna z diffem po wyłączeniu samego manifestu, 0 błędnych rozmiarów/SHA-256, `candidateContentSha` jest przodkiem HEAD;
- evidence: 1 182 394 B razem z manifestem przed tym review; po dodaniu review nadal poniżej 2 MiB;
- `git diff --check`: PASS.

## Warunek ponownego odbioru

Dodać realny tor tygodniowy i on-demand z trwałym wynikiem, osiągalne akcje eskalacji/delegacji/zmiany zasobów z kontrolą uprawnień, widoczną listę przyczyn wymagających uwagi oraz prawdziwą nazwę projektu z Gateway/PostgreSQL. Test przeglądarkowy ma użyć kształtu odpowiedzi identycznego z realną trasą. Następnie odtworzyć focused, Gateway/JWT/PG i light/dark.
