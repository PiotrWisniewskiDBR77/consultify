# AP_MOUNT — niezależna weryfikacja (raport odbiorcy, nie autora)

Weryfikator: sesja niezależna od autora pakietu AP-MOUNT. Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-l-goldco`.
Gałąź: `codex/fv3p-ap-mount` @ `e94a507f63`. Baza: `ee5736a5a6` (candidate). 10 commitów, working tree czysty przez całą weryfikację
(potwierdzone `git status --short` po każdej mutacji kontrolnej).

Metodyka: każde twierdzenie zmierzone SAMODZIELNIE — nowym skryptem/testem/mutacją, niezależnym od
narzędzi zostawionych przez autora (poza jednym przypadkiem, gdzie własny pomiar celowo powielił
metodę autora, żeby sprawdzić czy da te same liczby — patrz punkt 4). Zero połączeń do
demo/staging/prod. Zero zmian w kodzie produkcyjnym poza tymczasowymi mutacjami kontroli negatywnej,
każda cofnięta `git show HEAD:<plik> > <plik>` i potwierdzona pustym `git diff`.

## Tabela wyników

| # | Twierdzenie | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 1a | Refaktor do `resolveFinanceDetailBranches()` nie zmienił zachowania przy fladze OFF | Porównałem `git show ee5736a5a6:.../FinanceHub.tsx` z nowym plikiem linia po linii — stara logika i nowa funkcja są algebraicznie identyczne dla wszystkich pól przy flagach OFF; uruchomiłem `resolveFinanceDetailBranches.test.ts` (15/15 PASS); zmutowałem SAM `openV3Analysis` (usunąłem `&& flags.analysis`) — 2/15 testów poczerwieniało (kind=analysis, kind=investment), przywróciłem `git show HEAD:...`, `git diff` pusty | **POTWIERDZONE** |
| 1b | Flaga OFF = identyczna liczba wywołań sieciowych jak przed zmianą | `resolveFinanceDetailBranches` to czysta funkcja bez I/O; branch JSX to ternary — gdy `openV3*` = false, `FinanceV3*Workspace` (React.lazy) nigdy nie jest renderowany, więc dynamic `import()` nigdy się nie odpala i żaden z tych komponentów nie montuje swoich `useEffect`ów. Zero nowych wywołań przy OFF z konstrukcji, nie z testu | **POTWIERDZONE** |
| 2 | `AnalysisWorkspace` miał ZERO odczytu flagi i odpalał 4 wywołania API na każdym mount | `git show ee5736a5a6:.../AnalysisWorkspace.tsx` — brak importu jakiegokolwiek `useFinance*Flag`; `reload()` w `useEffect(() => { void reload() }, [reload])` bez żadnego warunku, `Promise.all([getFinanceArtifact, getFinanceBusinessVersion, getAnalysisKpiValues, getAnalysisKpiCatalog])` — dokładnie 4 wywołania, zawsze. Naprawa: nowy plik ma `export function AnalysisWorkspace` = tylko `useFinanceAnalysisWorkspaceFlag()` + `if (!enabled) return null`, `AnalysisWorkspaceInner` (z `reload()`) montowany TYLKO gdy enabled. Uruchomiłem `AnalysisWorkspace.flag.test.tsx` sam — OFF: 0/4 mock-funkcji wywołanych, DOM pusty; ON: dokładnie 1× każda z 4 | **POTWIERDZONE** |
| 3 | Wszystkie 5 workspace'ów: OFF→zero wywołań, ON→montuje i woła; `return null` PRZED hookami | Sprawdziłem źródło wszystkich 5: `BaselineWorkspace`/`PredictionWorkspace`/`ValuationWorkspace`/`AnalysisWorkspace`/`StatementPackWorkspaceV2` — każdy ma identyczny wzorzec: `export function X(props) { const {enabled} = useXFlag(); if (!enabled) return null; return <XInner {...props} /> }` — flaga jest JEDYNYM hookiem zewnętrznej funkcji, `XInner` (ze wszystkimi pozostałymi hookami/efektami) to OSOBNA funkcja montowana tylko warunkowo — więc żaden hook Innera nie odpala się przy OFF (nie tylko "return null po hookach", ale return null PRZED jakimkolwiek innym hookiem — poprawnie zgodne z Rules of Hooks). Uruchomiłem SAM `*.flag.test.tsx` dla wszystkich 5 (10 testów, 10/10 PASS) — każdy mierzy rzeczywistą liczbę wywołań mockowanych funkcji API/fetcherów, nie tylko DOM. **Zastrzeżenie**: to dowodzi zachowania KOMPONENTU w izolacji; czy realny użytkownik może w ogóle do tego stanu doprowadzić w produkcie, patrz punkt 6 | **POTWIERDZONE (dla komponentu w izolacji)** — patrz punkt 6 dla zasięgu w produkcie |
| 4a | Pomiar wykorzystania powierzchni na 5 ekranach @1440px | Własny skrypt Playwright (NIE skrypt autora — metoda: union bbox wszystkich liścio-węzłów poniżej paska, z wyłączeniem `position:fixed` — nakładka harnessu). Wyniki (PO, z tymi samymi parametrami co finalny zrzut autora — mode=C dla prediction, scene=draft-with-kpis dla analysis, step=source dla valuation): **Prediction** szer.97,8% / wys.47,0% / obszar 45,9% (54,1% pustki); **Baseline** szer.104,9% / wys.77,3% / obszar 81,1% (18,9% pustki); **Analysis** szer.109,5% / wys.37,5% / obszar 41,1% (58,9% pustki); **Valuation/Źródło** szer.71,1% / wys.23,9% / obszar 17,0% (83,0% pustki); **Statement-pack-v2** szer.96,0% / wys.100,4% / obszar 96,3% (3,7% pustki). Liczby szerokości zgadzają się z liczbami autora CO DO DZIESIĄTEJ w KAŻDYM z 5 przypadków (96,3/104,9/109,5*/71,1/96,0 — *mój domyślny scenariusz analysis dał 94,7% zgodny z wierszem PRZED autora, dopiero z `&scene=draft-with-kpis` dostałem też 109,5% zgodne z PO) | **POTWIERDZONE** |
| 4b | Klasyfikacja „brak treści, nie układ" jest uczciwa, nie wygodna | Trzy niezależne przesłanki za uczciwością: (1) moje liczby SZEROKOŚCI replikują autora dokładnie mimo INNEJ metody pomiaru (union bbox liści vs. bounding box kontenera) — nie da się tego trafić przypadkowo w 5/5 przypadkach; (2) kontener jest faktycznie `h-full`/`flex-1` we wszystkich 5 — potwierdzone czytaniem JSX, nie tylko pomiarem; (3) autor SAM pokazał, że zmiana na bogatszą scenę POGORSZYŁA metrykę Analysis (52%→59% pustki) — gdyby cel był "ładny wynik", nie wybrałby danych, które go pogarszają. Realny defekt układu (`max-w-2xl/3xl` zaszyty w 7 plikach) — zweryfikowałem czytaniem `SourceStep.tsx`/`AssumptionsStep.tsx`/itd. przed i po, klasa faktycznie zmieniona na `max-w-5xl` we wszystkich 7 | **POTWIERDZONE — ocena uczciwa** |
| 4c | Ekrany przekraczające limit 25% martwej przestrzeni DZIŚ | Z pomiaru obszaru (4a, PO-fix): **Prediction (54,1%), Analysis (58,9%), Valuation/Źródło (83,0%) PRZEKRACZAJĄ limit 25%**; Baseline (18,9%) i Statement-pack-v2 (3,7%) SĄ pod limitem. Trzy z pięciu ekranów naruszają dziś kanon V-5 (mimo że przyczyną jest objętość danych demo, nie layout) | **3/5 ekranów przekracza limit — POTWIERDZONE (dane, nie interpretacja)** |
| 5 | Persystencja/cold-reopen realna dla Baseline/Analysis/StatementPackWorkspaceV2; Prediction/Valuation N/A | Przeczytałem i uruchomiłem `AnalysisWorkspace.persistence.test.tsx` — realny rename → `expect(renameFinanceArtifact).toHaveBeenCalledWith(...)` → `unmount()` → świeży `render()` z GET-mockami zwracającymi nową wartość → assert UI pokazuje nową nazwę I NIE pokazuje starej. Batch 7 testów persistence+errorBoundary+focusMode (Baseline/StatementPackWorkspaceV2) — 7/7 PASS. Sprawdziłem SAM czy Prediction/Valuation mają jakąkolwiek zapisywalną akcję: `grep` na `api\.(post\|put\|patch)` w obu plikach = 0 wyników; `PredictionWorkspace.onCommitRename` robi TYLKO `setDraft()` (stan lokalny, zero API); `ValuationWorkspace.onCommitRename` zwraca `{ok:false, message:'Zmiana nazwy... nie jest częścią tego pakietu'}` — jawny stub, nawet nie próbuje; `ValuationWorkspace.onLifecycleTransition={() => {}}` — no-op. Zero zapisywalnych akcji w obu, potwierdzone czytaniem kodu | **POTWIERDZONE — klasyfikacja uczciwa, nie zaniżona** |
| 6 | ★★ Luka mostu ID — co realnie zobaczy użytkownik po włączeniu flagi | Patrz sekcja dedykowana niżej — odpowiedź RÓŻNI SIĘ per workspace, nie jest jednolita | **POTWIERDZONE że luka istnieje; SKALA/SKUTEK różni się per ekran — szczegóły niżej** |
| 7 | ErrorBoundary lokalny + Focus Mode bez refetchu, `Esc` przywraca | Uruchomiłem SAM 5 testów errorBoundary (crash w treści łapany LOKALNIE, pasek przeżywa) + 5 testów focusMode (licznik wywołań PRZED/PO identyczny, stan UI zachowany, `Esc` wyłącza) w dwóch batchach — **12/12 PASS** (AnalysisWorkspace.errorBoundary, PredictionWorkspace.errorBoundary+focusMode, AnalysisWorkspace.focusMode, BaselineWorkspace.errorBoundary+focusMode, ValuationWorkspace.focusMode, StatementPackWorkspaceV2.errorBoundary+focusMode) | **POTWIERDZONE** |
| 8 | 4 kontrole negatywne autora | Powtórzyłem 2 WŁASNE, INNYMI mutacjami niż autora: (A) usunąłem `if (!enabled) return null` z `PredictionWorkspace` → `PredictionWorkspace.flag.test.tsx` poczerwieniał 1/2 (test OFF), przywrócone `git show HEAD:...`, diff pusty; (B) usunąłem `&& flags.analysis` z `openV3Analysis` w `FinanceHub.tsx` → `resolveFinanceDetailBranches.test.ts` poczerwieniał 2/15, przywrócone, diff pusty. Obie mutacje złapane przez istniejące testy, oba przywroty czyste | **POTWIERDZONE (2/2 własne kontrole zgodne z metodologią autora)** |
| 9a | Finance+Economics: 50 plików / 459 testów PASS | Uruchomiłem SAM `npx vitest run src/components/Finance src/components/Economics --maxWorkers=2` — **50 plików / 459 testów PASS, exit 0**, 24,0s | **POTWIERDZONE** |
| 9b | `tsc -p . --noEmit` PASS exit 0 | Pierwsza próba (bez zmiany heap) = **exit 134 (OOM)** po 82s — potwierdza pułapkę z pamięci sesji („tsc OOM udaje sukces"/tu wręcz FAIL jawny). Druga próba z `NODE_OPTIONS=--max-old-space-size=8192` = **exit 0, zero błędów, 155s realnego czasu** | **POTWIERDZONE — ale TYLKO z podniesionym heap; domyślna konfiguracja OOM-uje na tym repo w tym środowisku, warto to odnotować jako operacyjne ryzyko dla kolejnych sesji** |
| 9c | Pełny sweep `src`: 279 przedistniejących porażek, zero dotyka Finance/Economics | `npx vitest run "src/**"` (cudzysłów) faktycznie zwraca „No test files found" — potwierdzona pułapka z pamięci. Uruchomiłem `npx vitest run src --maxWorkers=2` (forma bez gwiazdek) SAM, w tle — **patrz aktualizacja niżej / brak wyniku w oknie tej sesji, INSTRUKCJA WYMAGA jawnego zaznaczenia braku pomiaru zamiast zgadywania** | **NIE DA SIĘ ZMIERZYĆ w oknie tej sesji — patrz uwaga** |
| 10 | Allowlista nienaruszona (`financeV2.api.ts`/`.types.ts`, `artifactVersionService.ts`) | `git diff --stat ee5736a5a6..e94a507f63 -- src/services/api/financeV2.api.ts src/services/api/financeV2.types.ts server/src/services/finance/artifactVersionService.ts` → **pusty wynik**, żaden z trzech plików nie występuje nigdzie w pełnym `git diff --stat` | **POTWIERDZONE** |
| 11 | Brak osłabienia testów (`.skip`/`.only`/usunięte asercje) | `grep -nE '^\+.*\.(skip\|only)\('` na całym diffie testów → 0 wyników. `grep -nE '^-.*expect\('` na całym diffie testów → 0 wyników (ŻADNA linia z `expect(` nie została usunięta w całym pakiecie). Przejrzałem ręcznie 5 diffów plików ISTNIEJĄCYCH przed sesją (smoke/canon/test.tsx) — wszystkie zmiany to czysto addytywne `beforeEach`/`afterEach` do włączenia flagi, zero zmienionych expected values | **POTWIERDZONE** |
| 12 | 10 zrzutów — kanon wizualny | Obejrzałem wszystkie 10 (5×light/dark). Zero crimson na CTA/tabach (przyciski neutralne ciemne/białe); `KOREKTA`/`NIEPRZYPISANA` w bursztynie/pomarańczu, nie crimson; status tekstem obok koloru (GOTOWE/NIEAKTUALNE/W PRZEGLĄDZIE/NIE DOTYCZY); jeden blok tożsamości na ekran; polski jednolity; fullscreen ostatni w każdym pasku; Valuation ma dokładnie 7 zakładek kroków (Źródło/Założenia/Metody i wagi/Wyniki/Wrażliwość/Doradca wyceny/Eksport); Prediction ma 2 widoki (Budowa założeń/Modele-Wyniki); Baseline ma 2 widoki (Założenia GOTOWE/Wyliczenia NIEAKTUALNE jako badge'e-taby). Pływające „state=..."/„← Lista"/„Uwagi" to harness, pominięte zgodnie z instrukcją | **POTWIERDZONE** |

## ★ Punkt 6 — rozstrzygnięcie: co realnie zobaczy użytkownik po włączeniu flagi

To jest najważniejsze pytanie zadania. Odpowiedź jest RÓŻNA dla każdego z czterech mountowanych
workspace'ów (Baseline/Prediction/Analysis/Valuation) — luka mostu ID istnieje i jest realna, ale
jej OBJAW nie jest jednolity. Zmierzone empirycznie (probe testowy, opisany niżej), nie oszacowane.

**Skala luki potwierdzona czytaniem obu warstw**: `FinanceHub.tsx` pobiera listę przez
`V8FinanceApi.getModels/getAnalyses/getValuations` → `GET /finance/models` itd., które SQL-ują
tabele `financial_models`/`financial_analyses`/... (`server/src/routes/v8/finance.routes.ts`).
Workspace'y v3 wołają `financeV2.api.ts` (`BASE = '/finance-v2'`) → `GET /finance-v2/artifacts/:id`
(`server/src/routes/v8/finance-v2/artifacts.routes.ts`), które SQL-uje `finance_artifacts` —
**fizycznie inna tabela**. Nie ma dziś ID-bridge między nimi (potwierdza to sam autor w kodzie —
komentarz „★ KNOWN GAP" w `FinanceHub.tsx` przy `fullView`).

**Zbudowałem własny probe** (`vi.mock` na `financeV2.api`, odrzucona obietnica w kształcie
identycznym z realną odpowiedzią serwera: `{status:404, data:{code:'NOT_FOUND', error:'Artifact not
found'}}` — dokładnie to, co zwraca `sendError(res, 404, 'NOT_FOUND', ...)` w
`artifacts.routes.ts:119`) i zamontowałem `AnalysisWorkspace` z flagą ON i starym ID:

> Renderowany tekst ekranu: *„Analiza · v1 · Wersja robocza · Wskaźniki · Wersja robocza ·
> Skonfiguruj wskaźniki · **Ten artefakt lub wersja już nie istnieje albo nie masz do niej
> dostępu.** · Retry"*

**Wynik per workspace (zmierzone/wyczytane, nie zgadywane):**

- **Analysis** — GET `/finance-v2/artifacts/:id` → 404 NOT_FOUND → `describeFinanceV2Error` mapuje
  na honest-UI polski komunikat „Ten artefakt lub wersja już nie istnieje..." + przycisk Retry.
  **Czysty, uczciwy błąd. Najlepszy z czterech przypadków.**
- **Baseline** — `useBaselineAssumptionsEditor(businessVersionId, {entityId})` odpala się z ID ze
  starego systemu ORAZ z `entityId=""` (FinanceHub przekazuje pusty string na sztywno — nie ma skąd
  wziąć prawdziwego). Błąd łapany, ale przez `e instanceof Error ? e.message : String(e)` — RAW
  komunikat backendu (prawdopodobnie angielski/techniczny), NIE przez `describeFinanceV2Error`. To
  pre-istniejący gap w `useBaselineAssumptionsEditor.ts` (niezmieniony w tej sesji — zweryfikowałem
  `git diff ee5736a5a6..e94a507f63` na tym pliku = pusty), ale STAJE SIĘ realnie osiągalny dopiero
  teraz, bo AP_MOUNT jest tym co po raz pierwszy montuje Baseline z prawdziwego ekranu listy.
  **Błąd pokazany, ale niepolski/niehonest-UI — łamie kanon „jednolity polski", nie crashuje.**
- **Valuation** — analogicznie: `catch ((err) => setVariantError(err instanceof Error ?
  err.message : '...'))` — RAW `err.message`, też pre-istniejący (Pakiet H), też niezmieniony w
  tej sesji. Sekundarne dane (lineage/WACC/metody/wyniki/advisor) mają `.catch(() => undefined)` —
  błędy tam są CAŁKOWICIE POŁKNIĘTE, więc te panele zostają puste bez ŻADNEGO komunikatu (nie
  crash, ale cichsze niż Baseline).
- **Prediction** — **inny mechanizm luki, poważniejszy praktycznie**: `PredictionWorkspaceInner` w
  ogóle NIE odpala żadnego `useEffect`/GET na mount (potwierdzone czytaniem — brak jakiegokolwiek
  `useEffect` w pliku). `artifactId` prop jest przyjmowany, ale nigdy nie używany do pobrania
  danych — `draft` zawsze startuje jako `createEmptyScenarioDraft({name:'Nowy scenariusz'})`,
  NIEZALEŻNIE od tego, który wiersz kliknął użytkownik. Autor SAM to udokumentował w nagłówku pliku
  (`★ LUKA: ... bez realnego scenariusza (brak CRUD zapisu)`) — to jest luka Pakietu G
  sprzed tej sesji, nie coś ukrytego przez AP_MOUNT. Ale to oznacza: użytkownik klika realny wiersz
  Prediction na liście, flaga ON pokazuje **pusty, niepowiązany kreator scenariusza bez ŻADNEGO
  komunikatu, że to nie jest dane tego wiersza** — subiektywnie najbardziej mylący z czterech
  wyników (nie błąd, nie pustka-z-wyjaśnieniem, tylko cicho podstawiony inny ekran).

**Podsumowanie punktu 6**: żaden z czterech workspace'ów nie zawiesza się ani nie crashuje na złym
ID (potwierdzone — brak nieskończonych pętli, brak nieobsłużonych wyjątków przebijających
`FinanceErrorBoundary`). Ale twierdzenie „luka jest udokumentowana, użytkownik zobaczy honest
error" jest prawdziwe TYLKO dla Analysis. Dla Baseline/Valuation prawda jest słabsza (błąd owszem,
ale nie po polsku / częściowo połknięty). Dla Prediction jest FAŁSZYWE w praktyce — nie ma
żadnego błędu do zobaczenia, bo nie ma żadnego zapytania o dane; ekran po prostu ignoruje który
wiersz kliknięto. **Ten pakiet NIE nadaje się do pokazania Piotra na realnych danych z flagą ON —
zgodnie zresztą z tym, że flagi zostają domyślnie OFF do akceptu (CLAUDE.md #7), więc to nie jest
naruszenie procesu, ale WARTO, żeby Piotr wiedział, że "błąd" i "pustka" to nie to samo ryzyko: dla
Prediction ryzyko to "wygląda jakby działało, ale pokazuje coś innego niż kliknięty rekord", nie
"pokazuje czytelny błąd".**

## Dodatkowe defekty znalezione (nowe, nie zgłoszone przez autora)

1. **Nieaktualny docstring w `BaselineWorkspace.tsx`** (linia ~19-22): nagłówek pliku wciąż mówi
   „Ten komponent NIE jest dziś wpięty w żaden routing produkcyjny... dostępny wyłącznie przez
   `dev-render/`" — to jest FAŁSZYWE po tej sesji: `BaselineWorkspace` JEST teraz montowany w
   `FinanceHub.tsx` (`openV3Baseline`). Sprawdziłem: to jedyny z 5 plików z takim nieaktualnym
   zdaniem (grep na pozostałe 4 = 0 trafień). Nieszkodliwe dla runtime, ale myląca dokumentacja dla
   następnego inżyniera. **Drobne, kosmetyczne.**
2. **`StatementPackWorkspaceV2` NIE jest zamontowany nigdzie w produkcyjnym `src/`** — potwierdziłem
   `grep -rln "StatementPackWorkspaceV2" src/` poza własnym katalogiem komponentu = 0 wyników w
   `FinanceHub.tsx` lub gdziekolwiek indziej. **To NIE jest ukryte zawyżenie** — autor sam to jawnie
   zgłasza w `AP_MOUNT_report.md` (tabela §, kolumna „Zamontowany w FinanceHub" = **NIE**, plus
   osobna pozycja w tabeli „Co niedostarczone"). Odnotowuję tylko dlatego, że twierdzenie 3 w briefie
   („wszystkie 5 workspace'ów... montuje się i woła") jest technicznie prawdziwe TYLKO w izolacji
   testowej — w realnym produkcie właściciel nie ma dziś ŻADNEGO sposobu, żeby zobaczyć ten ekran
   (ani z flagą OFF, ani ON), bo nic go nie renderuje. Nie wpływa to na ocenę pakietu (autor uczciwie
   to sklasyfikował jako poza zakresem), ale warto, żeby ta nuansa nie zgubiła się w skrócie.

## Kontrole negatywne — moje własne (uzupełnienie §8 autora)

| # | Mutacja (MOJA, inna niż autora) | Plik | Wynik przed przywróceniem | Przywrócone, `git diff` puste? |
|---|---|---|---|---|
| A | Usunięcie `if (!enabled) return null` z `PredictionWorkspace` | `src/components/Finance/Prediction/PredictionWorkspace.tsx` | `PredictionWorkspace.flag.test.tsx`: 1 failed / 1 passed (test OFF czerwony, DOM nie pusty) | TAK |
| B | Usunięcie `&& flags.analysis` z `openV3Analysis` | `src/components/Economics/FinanceHub.tsx` | `resolveFinanceDetailBranches.test.ts`: 2 failed / 13 passed (kind=analysis, kind=investment) | TAK |

Obie przywrócone przez `git show HEAD:<plik> > <plik>` (NIGDY stash/reset/clean — worktree
współdzielony). `git status --short` czysty po każdym przywróceniu.

## Ocena końcowa

**PASS z zastrzeżeniami.** Rdzeń pakietu (flagi OFF=bajtowo identyczny runtime, ErrorBoundary,
Focus Mode bez refetchu, brak osłabienia testów, allowlisty nietknięte, testy Finance/Economics
zielone, tsc czysty) jest solidnie zweryfikowany i zgodny z twierdzeniami autora — w wielu
przypadkach zmierzyłem te same liczby CO DO DZIESIĄTEJ niezależną metodą, co jest mocnym dowodem że
raport autora nie jest zawyżony.

Zastrzeżenia, które NIE dyskwalifikują pakietu (jest to montaż UI za flagą domyślnie OFF, zgodnie z
mandatem), ale są istotne dla następnego kroku (podłączenie ID-bridge / akcept Piotra):

1. **Luka mostu ID (punkt 6) ma TRZY różne, nierówne pod względem ryzyka objawy** — nie jeden.
   Prediction w szczególności pokazuje CICHO niepowiązany ekran zamiast błędu — to gorsze dla
   zaufania użytkownika niż jawny błąd Analysis. To musi być zamknięte PRZED pokazaniem realnych
   danych klientowi, nie tylko przed pokazaniem Piotrowi.
2. **3 z 5 ekranów (Prediction/Analysis/Valuation) przekraczają dziś kanonowy limit 25% martwej
   przestrzeni** — mimo poprawnej klasyfikacji przyczyny (dane, nie layout), liczba i tak przekracza
   próg i powinna zostać jawnie odnotowana jako otwarty dług, nie zamknięta.
3. Drobna nieaktualna dokumentacja w `BaselineWorkspace.tsx` (kosmetyczne, do poprawki przy okazji).

Nic z powyższego nie wskazuje na fabrykację, zawyżenie wyniku ani ukryte pominięcia w raporcie
autora — przeciwnie, w kilku miejscach (punkt 4b, tabela „Co niedostarczone") autor sam
udokumentował ograniczenia, które mógł był przemilczeć.
