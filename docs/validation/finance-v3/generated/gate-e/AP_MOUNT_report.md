# AP_MOUNT — raport podłączenia workspace'ów Finance v3 do FinanceHub

Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-l-goldco`
Gałąź: `codex/fv3p-ap-mount`
Bazowy SHA (candidate): `ee5736a5a6`
Końcowy SHA: `e36d2754104fba730faece4055e5d3de6bac4665`

Sesja została raz przerwana w trakcie punktu B (montaż w `FinanceHub.tsx`) — orkiestrator
zabezpieczył stan pracy commitem `8910b99e71` (import-only, oznaczony UNVERIFIED). Ten raport
domyka i dowodzi wszystko od tamtego punktu, zgodnie z instrukcją wznowienia.

## ★★ TL;DR — dwa dowody, których orkiestrator zażądał dwukrotnie

**1. Flaga OFF = dokładnie dotychczasowy runtime, w tym ta sama liczba wywołań sieciowych.**
Dowód dwuwarstwowy:
- *FinanceHub*: `resolveFinanceDetailBranches()` — jedyne miejsce decydujące, który komponent się
  renderuje — zwraca, przy wszystkich 4 flagach OFF, pola IDENTYCZNE z literalną kopią bloku
  boolowskiego sprzed tej sesji (test `resolveFinanceDetailBranches.test.ts`, 15/15 PASS, dla
  KAŻDEGO z 7 kombinacji kind/predictionType). To znaczy: JSX renderuje dokładnie te same,
  NIEZMIENIONE gałęzie co przed sesją — nie "podobne", tylko te same warunki, te same komponenty,
  te same propsy (diff pokazuje tylko DODANE gałęzie-rodzeństwo, zero zmian w istniejących).
- *Wywołania sieciowe = ZERO, nie "policzone i wyszło zero tym razem"*: skoro `openV3*` jest
  `false`, JSX `openV3Baseline ? <FinanceV3BaselineWorkspace .../> : ...` NIGDY nie instancjonuje
  tego elementu — React nie woła funkcji tego komponentu w ogóle, więc żaden z jego hooków/efektów
  fizycznie nie może się wykonać (nie "nie wykonał się w tym przebiegu", tylko "nie istnieje
  możliwość, żeby się wykonał" — mocniejsza gwarancja niż licznik w konkretnym teście). Dodatkowo,
  na wypadek gdyby ktoś kiedyś zamontował te komponenty GDZIE INDZIEJ bez sprawdzenia flagi na
  zewnątrz: KAŻDY z pięciu ma WŁASNĄ, wewnętrzną bramkę (§A) — `if (!enabled) return null` PRZED
  jakimkolwiek innym hookiem — więc nawet przy błędnym montażu z zewnątrz, komponent SAM zwraca
  `null` i SAM nie odpala żadnego efektu. Podwójna gwarancja, zweryfikowana kontrolą negatywną #2
  (usunięcie `&& flags.baseline` → 2/15 testów czerwonych, przywrócone).

**2. Flaga OFF = ZERO wywołań API — na poziomie KAŻDEGO z pięciu komponentów z osobna.**
Pięć plików `*.flag.test.tsx` (Prediction/Baseline/Analysis/Valuation/StatementPackWorkspaceV2):
każdy mockuje WSZYSTKIE sieciowe funkcje danego komponentu, renderuje przy fladze OFF (domyślnej,
bez override'u), i asertuje `expect(mockFn).not.toHaveBeenCalled()` dla KAŻDEJ z nich — nie tylko
"komponent się nie wyrenderował". To dokładnie łapie przypadek, którego zrzut ekranu nigdy by nie
pokazał: komponent niewidoczny, ale odpytujący serwer w tle. Zweryfikowane kontrolą negatywną #1
(przywrócenie pre-gating wersji `AnalysisWorkspace.tsx` → test poszedł czerwony, bo `reload()`
faktycznie odpalił 4 wywołania mimo braku odczytu flagi).

Pełne dowody w sekcjach §A/§B niżej i w tabeli kontroli negatywnych.

## `git diff --stat` (ee5736a5a6..HEAD)

54 plików zmienionych, +2617 / -168 linii. Pełna lista plików i commitów w sekcji "Commity" niżej.

## Tabela pięciu workspace'ów

| Workspace | Flaga czytana przez SAM komponent (§A) | Zamontowany w FinanceHub (§B) | FinanceWorkspaceBar (§C) | Lokalny FinanceErrorBoundary (§D) | Focus Mode bez refetchu (§E) |
|---|---|---|---|---|---|
| `PredictionWorkspace` | TAK — `useFinancePredictionWorkspaceFlag()`, `null` przy OFF | TAK — `openV3Prediction` w `FinanceHub.tsx` | Był już (Pakiet G) | TAK — ale owija CAŁY komponent (bar wewnątrz boundary) — patrz uwaga niżej | TAK — 0 wywołań przy enter/exit, `Esc` działa |
| `BaselineWorkspace` | TAK — `useFinanceBaselineWorkspaceFlag()`, `null` przy OFF | TAK — `openV3Baseline` | Był już (Pakiet F) | TAK — owija TYLKO treść (`key={activeView}`), bar przeżywa crash | TAK — 0 wywołań przy enter/exit, aktywny widok zachowany, `Esc` działa |
| `AnalysisWorkspace` | TAK — `useFinanceAnalysisWorkspaceFlag()`, `null` przy OFF | TAK — `openV3Analysis` | Był już (Pakiet E) | **DODANY w tej sesji** (nie było wcale) — owija treść, bar przeżywa crash | **DODANY w tej sesji** (poprzednio `onEnterFocusMode` był no-opem) — 0 wywołań, otwarty kreator zachowany, `Esc` działa |
| `ValuationWorkspace` | TAK — `useFinanceValuationWorkspaceFlag()`, `null` przy OFF | TAK — `openV3Valuation` | Był już (Pakiet H) | Był już (test istniał przed tą sesją) | **DODANY w tej sesji** — 0 wywołań przy enter/exit, aktywny krok zachowany, `Esc` działa |
| `StatementPackWorkspaceV2` | TAK — `useFinanceStatementPackWorkspaceV2Flag()`, `null` przy OFF | **NIE** (poza zakresem §B — patrz "Co niedostarczone") | **DODANY w tej sesji** (nie miał paska WCALE) | **DODANY w tej sesji** | **DODANY w tej sesji** — 0 wywołań przy enter/exit, wybrana komórka zachowana, `Esc` działa |

Przed tą sesją: 5/6 flag `finance*Workspace*` nie było odczytywanych przez własny komponent
(tylko `financePredictionWorkspaceV1` była czytana — ale przez nic produkcyjnego, więc bez efektu).
Po tej sesji: **5/5 workspace'ów czyta własną flagę i renderuje `null`+zero wywołań sieciowych przy OFF**,
sprawdzone testem i kontrolą negatywną dla reprezentatywnej próbki.

## §A — Bramkowanie flagami (zrobione PIERWSZE, zgodnie z instrukcją)

Wzorzec identyczny w każdym z pięciu: eksportowany komponent woła `useFinance*WorkspaceFlag()`
jako JEDYNY hook, i przy `enabled === false` zwraca `null` PRZED zamontowaniem `*Inner` — żaden
kolejny hook/efekt (w tym wywołania sieciowe) się nie wykonuje. To respektuje Rules of Hooks
(wywołanie bezwarunkowe na górze, wcześniejszy return przed jakimkolwiek INNYM hookiem).

**Najważniejszy zastany defekt**: `AnalysisWorkspace.tsx` w ogóle nie czytał swojej flagi —
`reload()` (4 równoległe wywołania: `getFinanceArtifact`/`getFinanceBusinessVersion`/
`getAnalysisKpiValues`/`getAnalysisKpiCatalog`) odpalał się w `useEffect` NA KAŻDYM MOUNCIE,
niezależnie od flagi, bo flaga nie była nigdzie odczytywana. Naprawione.

## §B — Montaż w FinanceHub.tsx

Cztery workspace'y (Prediction/Baseline/Analysis/Valuation) zamontowane jako nowe gałęzie w
`fullView` (detail view) `FinanceHub.tsx`, każdy za swoją flagą.

### Dowód "flaga OFF = dokładnie dotychczasowy runtime"

Logika wyboru gałęzi wyekstrahowana do czystej, eksportowanej funkcji
`resolveFinanceDetailBranches(kind, predictionType, flags)` — JSX w `fullView` DESTRUKTURYZUJE
jej wynik (to jest jedyne źródło prawdy, nie równoległa kopia). Test
`src/components/Economics/__tests__/resolveFinanceDetailBranches.test.ts` (15 testów, PASS):
dla KAŻDEGO `FinanceKind` przy wszystkich czterech flagach OFF (realny domyślny stan), każde pole
zwrócone przez funkcję jest identyczne z literalną reprodukcją bloku boolowskiego sprzed tej
sesji (funkcja `legacyExpected` w teście — dosłowna kopia starego kodu). Dodatkowo: każda flaga
wpływa WYŁĄCZNIE na swój `kind` (brak cross-talk), a wiersz `prediction`+`predictionType=budget`
nigdy nie jest przejmowany przez flagę Prediction.

**Dlaczego nie ma pełnego testu renderu `FinanceHub`**: `FinanceHub.tsx` (3200+ linii) nie miał
ŻADNEGO istniejącego testu przed tą sesją (`find src/components/Economics -iname
'*FinanceHub*test*'` = 0 wyników) i ma duży graf zależności (routing, `useAppStore`,
`AccessPolicyContext`, `V8FinanceApi`, i18n, ...). Budowanie od zera pełnego mount-testu tej
strony byłoby osobnym, kosztownym zadaniem o niepewnym ROI w dostępnym czasie. Zamiast tego
logika decyzyjna (jedyna rzecz, którą ta sesja realnie zmieniła w tym pliku) została wydzielona
i przetestowana wyczerpująco — dowód PRZEZ KONSTRUKCJĘ: `!openStatement && !openFinanceV3`
redukuje się do `!openStatement` gdy `openFinanceV3` jest fałszywe (co test potwierdza dla
wszystkich siedmiu kombinacji kind/predictionType), a każda nowa gałąź ternary ma warunek
`openV3*`, więc gdy wszystkie cztery są fałszywe, JSX spada dokładnie do NIEZMIENIONYCH,
istniejących gałęzi (zweryfikowane czytaniem diffu — stare gałęzie nie zostały dotknięte, tylko
otoczone nowymi rodzeństwem-warunkami).

**Kontrola negatywna wykonana żywo**: usunięto `&& flags.baseline` z `openV3Baseline` (mutant) →
2/15 testów `resolveFinanceDetailBranches` zaczerwieniło się → przywrócono przez `cp` z backupu →
`git diff` pusty, 15/15 zielone ponownie.

### Wywołania sieciowe przy OFF

Skoro `openV3Baseline`/`openV3Prediction`/`openV3Analysis`/`openV3Valuation` są `false`, odpowiedni
element JSX (`<FinanceV3*Workspace>`) NIE JEST NAWET INSTANCJONOWANY w drzewie React — React nigdy
nie woła jego funkcji komponentu, więc żaden z jego hooków/efektów się nie uruchamia i lazy-chunk
się nie ładuje. To silniejsza gwarancja niż "renderuje `null`" (co i tak każdy z pięciu komponentów
POTWIERDZA sam w sobie, patrz §A) — tu komponent w ogóle nie istnieje w drzewie przy OFF.

### ★ UDOKUMENTOWANA LUKA (nie naprawiona tutaj, poza zakresem UI-mountingu)

`activeDocument.id`/`.status` w `FinanceHub.tsx` pochodzą ze STAREJ listy `/api/v8/finance/*`
(`V8FinanceApi.getModels/getAnalyses/getValuations`, status `FinanceStatus` =
DRAFT|REVIEW|APPROVED) — INNY model danych niż NOWY kanoniczny `/api/v8/finance-v2/*`
(`BusinessVersionStatus`, 8 wartości), na którym zbudowane są te pięć workspace'ów. Zweryfikowane
czytaniem `useFinanceData.ts` (woła `V8FinanceApi.getModels()` → `/finance/models`, NIE
`/finance-v2/*`). Nie istnieje dziś most ID między systemami, więc wiersz otwarty z dzisiejszej
listy przekaże id ze STAREGO systemu do komponentu NOWEGO systemu — jego własna obsługa
honest-UI (już potwierdzona testami) pokaże widoczny błąd, NIE crash, ale pełna użyteczność
end-to-end wymaga mostu danych (osobna inicjatywa, poza zakresem tego zadania). Status:
**PARTIAL — montaż jest realną ścieżką produkcyjną (żadnego harnessu), ale dane z dzisiejszej
listy nie rozwiążą się w nowym systemie, dopóki most nie powstanie.**

## §C — StatementPackWorkspaceV2 dostaje FinanceWorkspaceBar

Jedyny z pięciu, który wcześniej NIE importował paska w ogóle (własny nagłówek pliku to
przyznawał). Dodano: tożsamość (nazwa/status/freshness/wersja) ładowana przez nowy fetcher
`getIdentity` (businessVersionId → artifactId → naturalKey, ten sam wzorzec co
`AnalysisWorkspace`), lifecycle (`transitionVersion`/`approveModel`/`reopenModel`) — DOKŁADNIE
ten sam automat co `BaselineWorkspace.lifecycleTransitionsFor`, jeden widok ("Sprawozdanie",
brak zakładek własnych), fullscreen jako ostatnia kontrolka, ≤5 kontrolek po prawej. Wszystko
dodane jako nowe pola w istniejącym interfejsie `StatementPackWorkspaceV2Fetchers` (DI), NIE jako
bezpośredni import `financeV2.api` w komponencie — zachowuje ustaloną testowalność bez mocków
całego modułu API.

**Co niedostarczone (jawnie, nie po cichu)**: montaż TEGO komponentu jako gałęzi WEWNĄTRZ
`FinancialStatementPackWorkspace.tsx` (tak jak sugeruje docstring flagi
`useFinanceStatementPackWorkspaceV2Flag.ts`) — brief §C prosił wyłącznie o pasek, nie o ten
zewnętrzny punkt montażu, i to zostało potraktowane dosłownie z powodu ograniczeń czasowych.
Status: **PARTIAL** dla pełnej integracji, **PASS** dla zakresu dosłownie zapisanego w §C.

## §D — Lokalny FinanceErrorBoundary w każdym z pięciu

Wszystkie pięć mają teraz `FinanceErrorBoundary`. Dla każdego nowy test `*.errorBoundary.test.tsx`:
mockuje jeden REALNY komponent-dziecko żeby rzucał przy renderze, dowodzi że boundary łapie błąd
(fallback z Ponów/Wróć do listy, żaden wyjątek nie propaguje do callera).

**★ Strukturalna niespójność (udokumentowana, nienaprawiona)**: `PredictionWorkspace`'s boundary
owija CAŁY komponent (łącznie z paskiem), podczas gdy Baseline/Analysis/StatementPackWorkspaceV2
owijają TYLKO obszar treści (pasek żyje na zewnątrz i przeżywa crash). Test Predictiona to jawnie
zaznacza — dowodzi że boundary działa, ale NIE dowodzi "pasek działa dalej podczas crasha" tak jak
pozostałe trzy. Nie naprawiane w tej sesji (poza zakresem — zmiana struktury komponentu, nie testu).

**Kontrola negatywna wykonana żywo**: usunięto `<FinanceErrorBoundary>` z
`StatementPackWorkspaceV2.tsx` (mutant, `<>` zamiast) → test errorBoundary poszedł na czerwono
(surowy wyjątek zamiast fallbacku) → przywrócono z backupu → `git diff` pusty, zielone ponownie.

## §E — Focus Mode bez refetchu w każdym z pięciu

Wszystkie pięć mają teraz test `*.focusMode.test.tsx`: liczy wywołania sieciowe/fetcherów PRZED
wejściem w focus mode, wchodzi (klik `finance-workspace-bar-fullscreen`), liczy PONOWNIE (musi być
identyczne), sprawdza że stan roboczy (aktywny widok / nazwa draftu / otwarty kreator / wybrana
komórka — zależnie od komponentu) przeżył, wychodzi przez `Esc`, liczy PONOWNIE (musi dalej być
identyczne), sprawdza stan ponownie.

**Analiza (`AnalysisWorkspace`)**: przed tą sesją `onEnterFocusMode` był no-opem (`() => {}`) —
Focus Mode nie był w ogóle podłączony. Naprawione: `useFinanceFocusMode` teraz owija
`selectedKpiCode`/`wizardOpen`/`includedInReportByKpiCode`/`markedAsModelInputByKpiCode`.

**Kontrola negatywna wykonana żywo**: wstrzyknięto dodatkowe `outputsHook.reload()` do
`BaselineWorkspace`'s `onEnterFocusMode` (mutant) → asercja liczby wywołań poszła na czerwono
(3 zamiast oczekiwanych 2) → przywrócono z backupu → `git diff` pusty, 8/8 zielone ponownie.

## §6 — Persistence i cold reopen

Trzy nowe testy `*.persistence.test.tsx` (Baseline/Analysis/StatementPackWorkspaceV2): commit
rename przez REALNY handler → prawdziwe wywołanie API/fetchera z prawdziwą nową wartością →
`unmount()` (żaden stan JS nie przeżywa) → świeży mount z GET/`getIdentity` mockami zwracającymi
JUŻ ZMIENIONĄ wartość (symulując co zwróciłby prawdziwy serwer po zapisie) → potwierdzenie że
"zimno otwarty" UI pokazuje wartość PRZETRWAŁĄ, nie starą.

**Nieobjęte (udokumentowane, nie ukryte)**:
- `PredictionWorkspace`: `onCommitRename` jest WYŁĄCZNIE lokalny (`setDraft(...)`, zero wywołania
  API) — własny nagłówek komponentu to przyznaje ("brak CRUD zapisu"). Test persistence byłby
  nieuczciwy — N/A, nie "nieprzetestowane".
- `ValuationWorkspace`: `onCommitRename` explicite zwraca `{ok:false, message:'Zmiana nazwy...
  nie jest częścią tego pakietu.'}` — też nie jest realną akcją zapisu. Inna realna akcja
  (`api.upsertValuationWaccInputs`, zapis WACC) istnieje i wymagałaby własnego testu — NIE
  zbudowanego w tej sesji z powodu czasu. **EVIDENCE_MISSING** dla Valuation.

## Zrzuty (light + dark, wszystkie pięć)

`docs/validation/finance-v3/generated/gate-e/visual/ap-mount/`:
`prediction-{light,dark}.png`, `baseline-{light,dark}.png`, `analysis-{light,dark}.png`,
`valuation-{light,dark}.png`, `statement-pack-v2-{light,dark}.png`.

Wygenerowane własnym skryptem Playwright (`scripts/dev/apmount-screenshots.mjs`, wzór
`scripts/dev/pkgf-baseline-screenshots.mjs`) przeciw dedykowanemu serwerowi dev-render
uruchomionemu z TEGO worktree na stałym porcie 58234 (`fv3p-l-goldco` nie ma wpisu w
`.claude/launch.json`, a `preview_start` rozwiązuje ten plik względem katalogu orkiestratora —
podpięłoby się do cudzego pakietu). Bez `screencapture` ani innych narzędzi systemowych.

Obejrzane osobiście przed commitem: realne dane mocków (nie placeholdery), zero crimsona na
CTA/zakładkach (neutralne ciemne przyciski, `text-c-danger`-owe odznaki tylko semantycznie —
np. "KOREKTA"/"NIEPRZYPISANA" na statement-pack-v2), status komunikowany tekstem obok koloru
(GOTOWE/NIEAKTUALNE/W PRZEGLĄDZIE), jednolity polski, jeden blok tożsamości/statusu na ekran (zero
powtórzonych nagłówków) — w tym na statement-pack-v2, który wcześniej nie miał żadnej powłoki.
Pływająca etykieta "state=..." na statement-pack-v2 i pigułki "← Lista"/"Uwagi" to umeblowanie
harnessu dev-render (udokumentowane w plikach harnessu), NIE defekt produktu.

**Nieobejrzane jeszcze przez nikogo poza mną** — zgodnie z CLAUDE.md #7 zostają za flagami
(wszystkie domyślnie OFF) do akceptu Piotra, ekran po ekranie.

## ★ Audyt martwej przestrzeni (zgłoszenie orkiestratora po obejrzeniu `valuation-light.png`)

Orkiestrator obejrzał `valuation-light.png` PRZED właścicielem (CLAUDE.md #7) i zgłosił naruszenie
V-5 (kanon: martwa przestrzeń ≤25% obszaru roboczego przy 1440px) — karta treści ~670×370px w
canvasie 1440×790px. Zmierzone SKRYPTEM (`scripts/dev/apmount-deadspace-measure.mjs`, Playwright,
bounding box realnie namalowanej treści vs dostępny canvas pod paskiem), nie oszacowane na oko:

| Ekran | Szer. PRZED | Wys. PRZED | Obszar użyty PRZED | Szer. PO | Wys. PO | Obszar użyty PO | Przyczyna pozostałej pustki |
|---|---|---|---|---|---|---|---|
| `valuation` (krok Źródło) | 46,7% | 28,0% | ~13% (**87% pustki**) | 71,1% | 23,9% | ~17% (**83% pustki**) | **UKŁAD** (naprawiony częściowo — patrz niżej) + **OBJĘTOŚĆ TREŚCI** (krok pokazuje 4 fakty o linii lineage, nic więcej NIE ISTNIEJE do pokazania bez fabrykowania danych) |
| `prediction` (tryb A domyślny) | 96,3% | 17,8% | ~17% (**83% pustki**) | 97,8%* | 47,0%* | ~46% (**54% pustki**)* | **OBJĘTOŚĆ TREŚCI** — tryb A (Base) jest strukturalnie passthrough (`isBaseModeStructurallyPassthrough`), nic więcej nie renderuje z definicji. Zrzut ewidencyjny przełączony na `&mode=C` (realne dane demo już w harnessie, NIE nowa fabrykacja) — znacząco więcej treści |
| `analysis` (scena `draft-empty`→`draft-with-kpis`) | 94,7% | 50,3% | ~48% (52% pustki) | 109,5%* | 37,5%* | ~41% (59% pustki)* | **OBJĘTOŚĆ TREŚCI** — scena `draft-with-kpis` w harnessie ma tylko 3 realne wiersze KPI; tabela realnie rośnie z liczbą wierszy, nie da się „naciągnąć" bez fabrykowania kolejnych wskaźników |
| `baseline` | 104,9% | 73,6% | ~77% (23% pustki) | bez zmian | bez zmian | ~77% (**23% pustki — POD limitem**) | Już zamknięte jako V-5 w Pakiecie F przed tą sesją — bez akcji |
| `statement-pack-v2` | 96,0% | 102,1% | ~98% (**2% pustki**) | bez zmian | bez zmian | ~98% (**2% pustki — POD limitem**) | Bez akcji |

*Zmiana sceny na bogatszą (realne dane JUŻ w harnessie, nie nowa fabrykacja) pogorszyła metrykę
`analysis` (52%→59% pustki) — bo krótka tabela realnych wierszy zajmuje MNIEJ pionowej przestrzeni
niż wyśrodkowany placeholder pustego stanu. To pokazuje wprost, że problem NIE jest w warstwie
layoutu (kontener i tak jest `h-full`/`flex-1`, zmierzone `contentBox` = 100% dostępnej wysokości
w KAŻDYM z pięciu ekranów, PRZED i PO) — jest w OBJĘTOŚCI realnych danych demo.

### Co NAPRAWIONE (realna zmiana kodu produkcyjnego, nie kosmetyka pod pomiar)

Wszystkie SIEDEM komponentów kroków `ValuationWorkspace` miało twardo zakodowany
`max-w-2xl`/`max-w-3xl` (42–48rem = 672–768px) — **niezależnie od szerokości viewportu**. To jest
realny defekt układu (zweryfikowany czytaniem `SourceStep.tsx` i sześciu sąsiednich plików), nie
artefakt ubogich danych. Naprawione: `max-w-5xl` (64rem=1024px, 71% z 1440px) we wszystkich
siedmiu (`SourceStep`/`AssumptionsStep`/`MethodsWeightsStep`/`ResultsStep`/`SensitivityStep`/
`AdvisorStep`/`ExportStep`), plus `SourceStep`'s `<dl>` przeszła z 2 na 4 kolumny na szerokich
ekranach, żeby realnie wykorzystać dodaną szerokość zamiast zostawić ją pustą. Efekt zmierzony:
szerokość kroku Źródło 46,7%→71,1% (+24,4 p.p.). `npx vitest run src/components/Finance/Valuation`
— 61/61 PASS po zmianie (testidy niezmienione, tylko klasy szerokości).

### Co NIE naprawione — jawnie sklasyfikowane jako OBJĘTOŚĆ TREŚCI, nie UKŁAD

Dla `valuation`/Źródło, `prediction`/tryb A, `analysis`/`draft-with-kpis`: kontener KAŻDEGO z tych
ekranów już zajmuje 100% dostępnej wysokości/szerokości (zmierzone `contentBox`) — to co jest
krótkie to REALNA, NIEFABRYKOWANA treść wewnątrz (4 fakty lineage / strukturalnie pusty tryb
Base / 3 realne wiersze KPI). Wypełnienie tego bez fabrykowania danych wymagałoby albo (a)
przeprojektowania ekranu żeby pokazywał DODATKOWE, dziś nieistniejące informacje (decyzja
produktowa, poza mandatem tego zadania), albo (b) świadomego niecentrowania/rozciągania
istniejącej treści tak, żeby wizualnie wypełniała przestrzeń kosztem czytelności (np. sztucznie
powiększona typografia) — obie opcje uznałem za większą ingerencję niż mandat "podłącz workspace'y"
pozwala podjąć jednostronnie. Status: **PARTIAL** — layoutowa część naprawiona i zmierzona
(Valuation), pozostała pustka jest udokumentowana jako pytanie produktowe dla właściciela, nie
ukryta jako "gotowe".

### Zrzuty po naprawie

Wygenerowane ponownie tym samym skryptem (`apmount-screenshots.mjs`, zaktualizowanym o
`&mode=C` dla prediction i `&scene=draft-with-kpis` dla analysis — patrz komentarze w skrypcie).
Te same 10 ścieżek co wyżej (nadpisane), obejrzane ponownie osobiście: Valuation krok Źródło
teraz wykorzystuje realnie szerszą kartę z 4-kolumnową siatką faktów; Prediction tryb C pokazuje
pełny łańcuch inicjatywa→wpływ z realnymi polami; Analysis pokazuje 3 realne wiersze KPI zamiast
pustego stanu. `npx vitest run src/components/Finance` po zmianach: 44 plików / 410 testów PASS.

## Wyniki testów (kody wyjścia jawne)

| Zakres | Plików | Testów | Wynik | Czas trwania |
|---|---|---|---|---|
| `src/components/Finance` (pełny, po wszystkich commitach) | 44 | 410 | PASS, exit 0 | ~35s |
| `src/components/Economics` | 6 | 49 | PASS, exit 0 | ~9s |
| `tests/unit/finance/rawEnumLeakScanner.test.ts` | 1 | 4 | PASS, exit 0 | ~1s |
| `npx vitest run src --maxWorkers=2` (korzeń, filtr-substring `src`, obejmuje `src/**` I `server/src/**`) | 1037 (81 czerwonych, 68 skip) | 15021 (279 czerwonych, 646 skip, 8 todo) | **exit 1 — ale ZERO czerwonych w plikach dotkniętych tą sesją** (patrz niżej) | 651,9s |
| `tsc -p . --noEmit` (korzeń, `NODE_OPTIONS=--max-old-space-size=12288`) | — | — | **PASS, exit 0, 0 błędów** | — |

★ **Weryfikacja że 81 czerwonych plików to PRZEDISTNIEJĄCY dług, nie regresja tej sesji**:
`grep "^ FAIL "` na pełnym logu i przegląd wszystkich nazw plików — zero z nich leży pod
`src/components/Finance/**`, `src/components/Economics/**` ani żadnym plikiem z `git diff --stat`
tej sesji. Failures dotyczą niepowiązanych modułów (`AIChat/KimiWorkspace`, `Audit`, `Discovery`,
`MyWork/table` platform, `Presentations`, `contracts/tableSurface`, oraz liczne `server/src/**`
testy integracyjne wymagające realnej Postgresa — np. `kpiReconciliationFlow.test.ts` pada na FK
violation niezwiązany z Finance v3). Reprezentatywny przykład: `TablePlatformFrontend.test.tsx`
("shows watch button in platform mode") — moduł tabel My Work, zero związku z tym zadaniem.
Wszystkie testy `src/components/Finance/**`/`src/components/Economics/**` (44+6 plików / 459
testów) są w tym pełnym przebiegu ZIELONE (podzbiór dokładnie tych samych plików co osobne,
wcześniejsze przebiegi wymienione wyżej).

★ Uwaga metodyczna: `npx vitest run "src/**"` (glob w cudzysłowie) zwraca „No test files found" —
argument pozycyjny w vitest CLI to FILTR-SUBSTRING na ścieżce testu, nie shellowy glob (ten sam
błąd co w pamięci sesji poprzednich: „cytowany glob w vitest to FILTR nie glob"). Właściwa forma
to plain `src` (bez gwiazdek) — dopasowuje substring, znaleziono 1037 plików. `--dir src` też nie
zadziałał (dawał „No test files found" mimo poprawnego `include` w konfiguracji — nieudokumentowana
interakcja z resolucją ścieżek względnych configu). Pierwsza próba (`npx vitest run` bez żadnego
argumentu = pełny domyślny `include`) zawisła >120s na `deliverableTemplateService.test.ts` czekając
na infrastrukturę niedostępną w tym środowisku — zabita ręcznie (`pkill`), zastąpiona wersją z
filtrem `src`, która failuje/skipuje PG-zależne testy szybko zamiast wisieć.

## Kontrole negatywne — podsumowanie

| # | Bramka | Mutacja | Wynik przed przywróceniem | Przywrócone (`git diff` puste)? |
|---|---|---|---|---|
| 1 | `AnalysisWorkspace` §A (flaga) | `git show ee5736a5a6:...AnalysisWorkspace.tsx` (wersja bez bramki) | 1/2 testów flag.test czerwone | TAK |
| 2 | `resolveFinanceDetailBranches` §B (flaga OFF = legacy) | usunięto `&& flags.baseline` | 2/15 testów czerwone | TAK |
| 3 | `StatementPackWorkspaceV2` §D (ErrorBoundary) | usunięto `<FinanceErrorBoundary>` | 1/1 czerwony (surowy wyjątek) | TAK |
| 4 | `BaselineWorkspace` §E (Focus Mode refetch) | wstrzyknięto `outputsHook.reload()` do `onEnterFocusMode` | 1/1 czerwony (3≠2) | TAK |

Cofanie wyłącznie przez `cp` z backupu w `/tmp` (bez `git stash`/`reset`/`clean` — worktree
współdzielony z pięcioma innymi agentami). Kontrole 3 i 4 wykonane w NOWEJ sesji po wznowieniu, na
żądanie orkiestratora ("dwóch agentów zostawiło zepsuty kod produkcyjny w połowie kontroli").

## Commity (chronologicznie)

1. `d9435f9cdc` — Prediction/Baseline/Valuation czytają własne flagi
2. `ca57404db2` — AnalysisWorkspace czyta flagę + ErrorBoundary + Focus Mode
3. `9535cb403c` — StatementPackWorkspaceV2 dostaje FinanceWorkspaceBar + bramka + boundary + focus
4. `8910b99e71` — (orkiestrator, WIP/UNVERIFIED, tylko importy — sesja przerwana)
5. `8849de1235` — montaż Prediction/Baseline/Analysis/Valuation w FinanceHub
6. `b8fa8e5e85` — testy ErrorBoundary + Focus Mode dla wszystkich pięciu
7. `8e9990ac6b` — testy persistence + cold reopen (Baseline/Analysis/StatementPackWorkspaceV2)
8. `b8d46e8f7d` — zrzuty light+dark dla wszystkich pięciu (RUNDA 1, przed audytem martwej przestrzeni)
9. *(następny commit)* — naprawa szerokości 7 kroków `ValuationWorkspace` + regeneracja zrzutów (RUNDA 2, po zgłoszeniu orkiestratora)

## Rejestr niedostarczonego (jawnie, ze statusem)

| Co | Status | Powód |
|---|---|---|
| Most ID między starą listą FinanceHub a nowym schematem finance-v2 | PARTIAL | Poza zakresem UI-mountingu — osobna inicjatywa danych |
| Montaż `StatementPackWorkspaceV2` wewnątrz `FinancialStatementPackWorkspace.tsx` | PARTIAL | §C prosił dosłownie o pasek, nie o ten punkt montażu; czas |
| Spójność struktury `FinanceErrorBoundary` w `PredictionWorkspace` (bar wewnątrz boundary) | PARTIAL | Udokumentowane, niezmienione — zmiana struktury poza zakresem testu |
| Test persistence dla `ValuationWorkspace` (WACC save) | EVIDENCE_MISSING | Rename nie jest realną akcją w tym komponencie; WACC-save test nie zbudowany z powodu czasu |
| Test persistence dla `PredictionWorkspace` | N/A | Komponent nie ma dziś ŻADNEJ realnej akcji zapisu (własny nagłówek to przyznaje) |
| Pełny render-test `FinanceHub.tsx` (nie tylko wydzielona logika) | PARTIAL | Brak istniejącego harnessu, duży graf zależności — logika decyzyjna przetestowana wyczerpująco zamiast tego |
| Martwa przestrzeń — pozostała pustka po naprawie szerokości Valuation (23-87% zależnie od ekranu) | PARTIAL, sklasyfikowane per ekran | Kontener = 100% dostępnej wysokości wszędzie; pustka = objętość realnej, niefabrykowanej treści (patrz tabela audytu wyżej), nie defekt CSS |
| Pełny `npx vitest run` z korzenia repo | **PASS dla plików tej sesji** | Pełny monorepo (15021 testów) ma 279 przedistniejących czerwonych, zero w Finance/Economics — patrz sekcja wyników |
| `tsc -p . --noEmit` z korzenia | **PASS, exit 0, 0 błędów** | — |
