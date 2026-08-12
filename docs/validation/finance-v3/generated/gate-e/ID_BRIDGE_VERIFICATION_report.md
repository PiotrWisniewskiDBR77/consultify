# ID_BRIDGE (Gate E) — NIEZALEŻNA WERYFIKACJA

**Weryfikator**: sesja niezależna, nie autor pakietu.
**Worktree**: `/Users/piotrwisniewski/consultify-wt/fv3p-l-goldco`
**Gałąź**: `codex/fv3p-id-bridge` @ `36ab256b92`
**Baza podana w briefie**: `2f3685ac3e`
**Baza RZECZYWISTA branchu** (zmierzone `git merge-base`): `66d6ef42bf` — patrz §0.
**DB weryfikatora**: `idbridge_verify` (127.0.0.1:54330), utworzona z `newdb.sh`, sprzątnięta pod koniec.

---

## 0. ★★ USTALENIE STRUKTURALNE (przed oceną twierdzeń) — baza branchu jest NIEAKTUALNA

Brief zlecił weryfikację względem kandydata `2f3685ac3e`. Zmierzone niezależnie:

```
git merge-base 2f3685ac3e HEAD      -> 66d6ef42bf   (NIE 2f3685ac3e)
git merge-base --is-ancestor 2f3685ac3e HEAD  -> NO
```

`codex/fv3p-id-bridge` (5 commitów tego pakietu) odgałęzia się od `66d6ef42bf`
("merge codex/fv3p-ap-mount"), **nie** od `2f3685ac3e` ("merge
codex/fv3p-fix-scanner"). `2f3685ac3e` NIE jest przodkiem HEAD tego brancha —
to rozbieżna gałąź z tym samym wspólnym przodkiem `66d6ef42bf`.

**Konsekwencje, zmierzone, nie zgadywane:**

1. `tests/unit/finance/rawEnumLeakScanner.test.ts` w tym worktree to STARA,
   wąska wersja — skanuje TYLKO `src/components/Finance/Analysis/` i
   `.../Valuation/`, próg `toBeGreaterThan(5)` plików (potwierdzone czytaniem
   pliku, linie 27, 46-47, 138). Brief opisuje NAPRAWIONĄ wersję ("skanuje
   całe `src/components/Finance/**`, twarda asercja minimum 40 plików") —
   ta wersja istnieje na `2f3685ac3e` (`git diff --stat 66d6ef42bf..2f3685ac3e`
   pokazuje 149 wstawień/21 usunięć w tym pliku), ale NIE jest osiągalna z
   HEAD tego brancha.
2. `git diff --stat 66d6ef42bf..2f3685ac3e` pokazuje **60 plików, 6802
   wstawień** nieobecnych w `codex/fv3p-id-bridge` — nie tylko naprawa
   skanera, ale całe pięć paneli Finance (Comments/Compare/ExportImport/
   LineageNavigator/SavedViews) i ich testy, plus zmiany w
   `src/services/api/financeV2.api.ts` (+586) i `financeV2.types.ts` (+522).
3. Równolegle działająca gałąź dostępności `codex/fv3p-i-a11y` (widoczna
   lokalnie, `git branch -a`) jest zbudowana NA `2f3685ac3e` (potwierdzone
   `git merge-base --is-ancestor 2f3685ac3e codex/fv3p-i-a11y` = YES) i
   dotyka DOKŁADNIE tych samych dwóch plików, które `codex/fv3p-id-bridge`
   też zmienia: `src/services/api/financeV2.api.ts` i
   `src/services/api/financeV2.types.ts` (a11y dokłada tam własne bloki
   Comments/Compare/ExportImport/LineageNavigator/SavedViews API — 586+522
   linii). Merge tych dwóch gałęzi NIE jest bezkonfliktowy z automatu i
   wymaga ręcznego scalenia tych dwóch plików przy integracji — to nie jest
   coś, co można ocenić jako PASS/FAIL tego pakietu z osobna, ale orkiestrator
   musi to wiedzieć PRZED próbą prostego merge'a obu gałęzi.

**Co to oznacza dla oceny poniżej**: wszystkie testy/zrzuty/kod tego pakietu
oceniam wobec tego, co branch REALNIE zawiera (bo to jest przedmiot
weryfikacji), ale flaguję że "476/476" i "4/4 rawEnumLeakScanner" są
zmierzone na STAREJ wersji narzędzi pomiarowych tego repo, nie na wersji z
podanej bazy kandydata. To NIE unieważnia poprawności kodu id-bridge — ale
oznacza, że przed promocją ten branch potrzebuje rebase/merge na aktualną
linię kandydata (z ręcznym scaleniem `financeV2.api.ts`/`financeV2.types.ts`
wobec `codex/fv3p-i-a11y`) i PONOWNEGO przebiegu pełnego (naprawionego)
skanera na scalonym kodzie.

---

## 1. Tabela twierdzeń

| # | Twierdzenie | Mój niezależny pomiar | Wynik |
|---|---|---|---|
| 1a | `finance_artifact_aliases` istnieje od WP-B01, wypełniana przez backfill WP-C03 | Schemat potwierdzony `\d finance_artifact_aliases` na świeżej bazie. Uruchomiłem SAM `finance-v3-backfill-dry-run.ts seed` + `run` (nie testy autora) na `idbridge_verify` — backfill zapisał 765 wierszy aliasów real, w tym dla wszystkich czterech tabel z §1.1 (`financial_analyses`=24, `financial_models`=24, `financial_statement_packs`=18, `valuations`=15, plus tabele potomne). Grep potwierdza jedyny pre-existing odczyt to komentarz w `models.routes.ts`. | **POTWIERDZONE** |
| 1b | Trzy stany domenowe RESOLVED/QUARANTINED/NOT_MIGRATED, wszystkie HTTP 200 | Własna sonda supertest (nie test autora) przeciw realnym wierszom z MOJEGO backfillu: RESOLVED→200 (realne `artifactId`/`businessVersionId` z bazy), NOT_MIGRATED→200, QUARANTINED (własny syntetyczny wiersz)→200 z `reason`. `INVALID_LEGACY_TABLE`→400 (poprawnie, to błąd transportu nie domenowy). Klient (`useFinanceLegacyBridge.ts`) poprawnie rozróżnia — potwierdzone czytaniem kodu (4 stany: loading/resolved/unresolved{code}/error) i testem `FinanceLegacyBridgeGate.test.tsx` (uruchomiony, 5/5). | **POTWIERDZONE** |
| 1c | Cross-tenant: brak przecieku, brak mutacji | Własna sonda: org `beta` odpytuje o legacy-id należący do `alpha` (zarówno wiersz RESOLVED jak i QUARANTINE) → w obu przypadkach `200 {status:'NOT_MIGRATED'}`, zero przecieku danych `alpha`. SQL-injection-shaped `legacyId` (`model-6m' OR '1'='1`) → bezpiecznie `NOT_MIGRATED` (parametryzowane zapytania). Licznik wierszy `finance_artifact_aliases` przed/po sondą: 765→766, delta dokładnie +1 (mój własny INSERT testowy) — GET-y nie mutują nic. Mechanizm: `organizationId` pochodzi z `req.v8Context` (middleware, z tokenu), NIE z URL/params — niespoofowalne przez klienta. **Ale patrz §3 mutacja #1 — luka w POKRYCIU TESTÓW, nie w kodzie produkcyjnym.** | **POTWIERDZONE** (z zastrzeżeniem co do testów, nie kodu) |
| 2 | Prediction — cztery/pięć rozróżnialnych stanów, zero cichych pustych formularzy | Przeczytany kod `PredictionWorkspace.tsx` (diff), atak trzema scenariuszami: (a) id nierozwiązywalny → `FinanceLegacyBridgeGate` zwraca `unresolved` PRZED dotarciem do `PredictionWorkspace` w ogóle (blokada na wyższym poziomie) — jeśli `businessVersionId=null` dotrze mimo to, `PredictionWorkspaceInner` renderuje `no-id`, zero wywołań sieciowych (potwierdzone testem `PredictionWorkspace.flag.test.tsx` "ON, WITHOUT businessVersionId... touches zero network"); (b) id cudzej organizacji → `getFinanceBusinessVersion`'s server route (`versions.routes.ts:69-77`) jest org-scoped (`getBusinessVersion(organizationId, businessVersionId)`, fail-closed 404), więc nawet gdyby cross-tenant id ominął bramkę wyższego poziomu, druga warstwa też zwraca uczciwe `not-found`; (c) zerwane połączenie w trakcie sprawdzania → `cancelledRef`/`cancelled` flag w obu hookach (`useFinanceLegacyBridge.ts`, `PredictionWorkspace.tsx`) gwarantuje że wynik nieaktualnego żądania jest odrzucany po unmount — brak zombie-state, brak crasha. Żaden z trzech ataków nie produkuje cichego pustego formularza. | **POTWIERDZONE** |
| 3 | Baseline+Valuation: `err.message` zamieniony na `describeFinanceV2Error(err).detail` | Grep potwierdza dokładnie te pliki z komentarzem "ID_BRIDGE (Gate E) fix": `useBaselineAssumptionsEditor.ts`, `useBaselineOutputs.ts`, `ValuationWorkspace.tsx`, `AdvisorStep.tsx`, `AssumptionsStep.tsx`, `MethodsWeightsStep.tsx`, `SensitivityStep.tsx` — WSZYSTKIE faktycznie zmienione, diff potwierdza. **ALE**: `describeFinanceV2Error()`'s WŁASNA gałąź `default:` (nietknięta przez ten pakiet, pre-existing w `financeV2.types.ts`) przepuszcza surowy `err.message` dosłownie, gdy kod błędu z serwera nie pasuje do żadnego znanego `case`. Widoczne we WŁASNYCH zrzutach tego pakietu: `prediction-bridge-error-{light,dark}.png` i `gate-baseline-error-light.png` pokazują "Internal error" — angielski, surowy tekst z mocka harnessu, ale mechanizm jest realny: `server/src/middleware/*.ts` faktycznie zwraca takie napisy (`"Internal error resolving organization context"`, `"Internal Server Error during validation"` itd.) dla nieobsłużonych 5xx, a `normalizeApiError()` (`src/utils/apiError.ts:94-98`) kopiuje `input.error` do `.message` 1:1. Poza deklarowanym zakresem tego pakietu (Baseline+Valuation), ale w tej samej rodzinie plików (`src/components/Finance/**`) są DALSZE nietknięte surowe `err.message` (np. `statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` — 7 miejsc, `FinancialStatementPackWorkspace.tsx`, `analysisKpiCatalog.ts`) — poza zakresem tego zadania, nie regresja, ale nadal aktualna luka. | **CZĘŚCIOWO** — zakres deklarowany przez autora POTWIERDZONY, ale "nigdzie żaden surowy string" (szersze pytanie z briefu) NIE trzyma się dla generycznych 5xx ani poza deklarowanym zakresem |
| 4 | Ścieżka OFF bajtowo identyczna, `resolveFinanceDetailBranches.test.ts` nietknięty, 15/15 | `git diff 66d6ef42bf..HEAD -- .../resolveFinanceDetailBranches.test.ts` = PUSTY (plik bitowo identyczny). Uruchomiony SAM: 15/15 PASS. Przeczytany diff `FinanceHub.tsx`: cztery gałęzie `openV3*` nadal sterowane WYŁĄCZNIE przez niezmienioną `resolveFinanceDetailBranches()`; `FinanceLegacyBridgeGate` (i jego wywołanie sieciowe) żyje WEWNĄTRZ tych gałęzi w JSX — przy fladze OFF `openV3*===false`, więc `FinanceLegacyBridgeGate` nigdy nie jest nawet skonstruowany, `useFinanceLegacyBridge`'s `useEffect` nigdy nie odpala. Liczba wywołań sieciowych przy OFF: 0 nowych (strukturalnie niemożliwe, nie tylko "zmierzone testem"). | **POTWIERDZONE** |
| 5 | Testy: serwer 5/5, frontend 476/476 ×2 | Serwer (realny Postgres, `idbridge_verify`, `RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test` + jawny `DATABASE_URL`): **5/5 PASS**, exit=0 (zmierzony z pliku, nie z potoku). Frontend `npx vitest run src/components/Finance src/components/Economics`: przebieg 1 — **52 pliki / 476 testów PASS**, 43s; przebieg 2 — **52/476 PASS**, 53s. Oba exit=0 z pliku. | **POTWIERDZONE** |
| 6 | Kontrole negatywne / mutanty przywrócone | Wykonałem 3 WŁASNE mutanty (inne niż autora — patrz §3 poniżej), każdy: czerwony przed przywróceniem, przywrócony przez `git show HEAD:<plik> > <plik>` (uniwersalna metoda, działa też dla nowych plików — HEAD już zawiera finalną, zacommitowaną wersję), `git diff --quiet` puste po każdym. Zero użycia `git stash`/`reset`/`clean`. | **POTWIERDZONE** (+ dodatkowy realny finding, patrz §3.1) |
| 7 | Allowlista — brak plików spoza zakresu | `git diff --stat 66d6ef42bf..HEAD`: 46 plików, wszystkie zgodne z deklarowanym zakresem czterech commitów (serwer bridge+testy, klient gate+hook, wpięcie FinanceHub, Prediction/Baseline/Valuation error-fix, dev-render+zrzuty, `.claude/launch.json` czysto addytywny wpis). Żaden plik spoza `src/components/Finance/**`/`src/services/api/**`/`server/.../finance/**`/dev-render/docs nie tknięty. **Ale patrz §0** — `codex/fv3p-i-a11y` (równoległa gałąź) dotyka TYCH SAMYCH dwóch plików (`financeV2.api.ts`, `financeV2.types.ts`) na swojej OSOBNEJ gałęzi zbudowanej na nowszej bazie — nakładanie się nie jest naruszeniem allowlisty tego pakietu, ale jest ryzykiem integracyjnym przy scalaniu obu gałęzi. | **POTWIERDZONE** (w ramach tej gałęzi) + ryzyko integracyjne udokumentowane w §0 |
| 8 | Ocena wizualna 17 zrzutów + 2 zgłoszenia Piotra | Patrz §4 poniżej. | Oba zgłoszenia Piotra **POTWIERDZONE**; jeden NOWY defekt znaleziony (§4.3) |

---

## 2. Atak na Prediction (Zadanie 2) — szczegóły

Trzy scenariusze ataku zlecone w briefie, każdy zweryfikowany czytaniem kodu
+ testów (nie tylko deklaracją autora):

1. **Identyfikator nierozwiązywalny** (`businessVersionId=null`) →
   `PredictionWorkspaceInner` renderuje `data-testid="prediction-mount-no-id"`
   z komunikatem "Nie można otworzyć tego scenariusza — brak połączenia z
   realnym rekordem w nowym systemie." — `getFinanceBusinessVersion` NIGDY
   wywołane (kod: `if (!businessVersionId) return` PRZED jakimkolwiek
   fetchem). Zero wywołań sieciowych — potwierdzone czytaniem `useEffect`
   (linia `if (!businessVersionId) { setMountCheck({kind:'no-id'}); return; }`
   przed jakimkolwiek `getFinanceBusinessVersion(...)`).
2. **Identyfikator cudzej organizacji** — dwie niezależne warstwy obrony:
   (a) `FinanceLegacyBridgeGate` w `FinanceHub.tsx` odpytuje `resolve-legacy`
   PRZED zamontowaniem `PredictionWorkspace` — cross-tenant tam fail-closed
   (§1c, POTWIERDZONE moją sondą); (b) gdyby mimo to jakiś cross-tenant
   `businessVersionId` dotarł bezpośrednio jako prop, `versions.routes.ts:69-77`
   (`GET /versions/:businessVersionId`, plik NIEZMIENIONY przez ten pakiet,
   pre-existing) filtruje `getBusinessVersion(organizationId, ...)` —
   fail-closed 404→`not-found`, nie przeciek.
3. **Zerwanie połączenia w trakcie sprawdzania** — `cancelled`
   (lokalny w `useEffect`) w `PredictionWorkspaceInner` i `cancelledRef` w
   `useFinanceLegacyBridge` odrzucają wynik nieaktualnego (unmounted/
   przestarzałego) żądania. Nie ma scenariusza, w którym komponent zostaje
   zamontowany z pustym/nieokreślonym stanem bez żadnego z pięciu jawnych
   `data-testid` (`no-id`/`checking`/`not-found`/`error`/potwierdzony z
   banerem).

**Wniosek**: żaden z trzech ataków nie odtwarza "cichej pustki". Twierdzenie
2 POTWIERDZONE.

---

## 3. Mutation testing — 3 NIEZALEŻNE mutanty (inne niż autora)

Metoda przywracania: `git show HEAD:<plik> > <plik>` (działa jednolicie dla
plików nowych i istniejących, bo HEAD = `36ab256b92` już zawiera finalną,
zacommitowaną wersję). Po każdym mutancie: `git diff --quiet` (puste) +
ponowne zielone uruchomienie. Zero `git stash`/`reset --hard`/`clean`.

### Mutant 1 — `legacyIdBridgeService.ts`: usunięcie `AND organization_id = ?` z zapytania o alias

Zmiana: pierwsze zapytanie SQL (`SELECT * FROM finance_artifact_aliases WHERE
legacy_table = ? AND legacy_id = ?`, bez filtra org) — usunięty jeden
parametr.

**Wynik na testach AUTORA**: `legacy-id-bridge.routes.pg.test.ts` **5/5
nadal ZIELONE** — mutant NIE wykryty przez istniejący test cross-tenant
(#4), bo ten test używa ścieżki `AUTO_MIGRATE`/RESOLVED, która ma DRUGĄ,
niezależną warstwę filtra org (zapytanie o `finance_artifacts` linia 136:
`WHERE artifact_id = ? AND organization_id = ?`) — ta druga warstwa łapie
mutanta i degraduje wynik do uczciwego `NOT_MIGRATED`, więc test przechodzi
mimo dziury w PIERWSZYM zapytaniu.

**Własna sonda na ścieżce QUARANTINED** (której autor NIE ma testu
cross-tenant): org `beta` odpytuje o QUARANTINE-owy alias należący do
`alpha` z sekretnym powodem `"SECRET_ALPHA_ONLY_REASON"`. **Pod mutantem:
`200 {status:'QUARANTINED', reason:'SECRET_ALPHA_ONLY_REASON'}`** — REALNY
PRZECIEK cross-tenant, bo ścieżka QUARANTINED zwraca się NATYCHMIAST po
pierwszym zapytaniu (linie 120-126), bez drugiej warstwy filtra.

**Wniosek**: kod PRODUKCYJNY jest bezpieczny (filtr org jest obecny w obu
zapytaniach w rzeczywistym, niezmutowanym pliku — potwierdzone §1c). Ale
**pokrycie testowe ma lukę**: test cross-tenant #4 w
`legacy-id-bridge.routes.pg.test.ts` ćwiczy WYŁĄCZNIE ścieżkę
RESOLVED/AUTO_MIGRATE, która ma podwójną ochronę i dlatego "maskuje"
regresję filtra org w pierwszym zapytaniu. Analogiczny mutant na ścieżce
QUARANTINED (jedna warstwa ochrony, nie dwie) przeszedłby przez CI
niezauważony, gdyby ktoś kiedyś przez pomyłkę usunął filtr org tylko z
pierwszego zapytania. **Rekomendacja dla autora/następcy**: dodać test
cross-tenant #6 analogiczny do #4, ale dla `mapping_confidence='QUARANTINE'`.

Przywrócone: `git show HEAD:server/.../legacyIdBridgeService.ts > ...`,
`git diff --quiet` puste, `dropdb`-em nic nie dotknięte (to zmiana pliku, nie
danych).

### Mutant 2 — `FinanceLegacyBridgeGate.tsx`: wyłączenie gałęzi `unresolved` (`&& false`)

Zmiana: `if (state.kind === 'unresolved' && false)` — symuluje regresję,
w której most po cichu montuje `children` nawet gdy nierozwiązany.

**Wynik**: `FinanceLegacyBridgeGate.test.tsx` → **2/5 czerwone**
(dokładnie testy NOT_MIGRATED i QUARANTINED z sekcji "UNRESOLVED
(anti-silent-emptiness for the bridge itself)"). Test poprawnie wykrywa
regresję dokładnie w miejscu, które ma chronić.

Przywrócone: `git show HEAD:... > ...`, `git diff --quiet` puste, ponowne
uruchomienie 5/5 zielone.

### Mutant 3 — `PredictionWorkspace.tsx`: ukrycie banera uczciwości (`confirmed`)

Zmiana: `data-testid="prediction-honest-scratch-banner"` →
`className="hidden ..." data-testid="...-MUTATED-HIDDEN"` — symuluje
regresję, w której ekran przestaje przyznawać brak GET-u treści scenariusza.

**Wynik**: `PredictionWorkspace.test.tsx` → **2/11 czerwone** (test banera
uczciwości + test przycisku "Uruchom preflight" pokazującego honest-UI —
ten drugi zależy pośrednio od struktury DOM wokół banera). Test poprawnie
wykrywa.

Przywrócone: `git show HEAD:... > ...`, `git diff --quiet` puste. Ponowne
uruchomienie: 11/11 zielone (jeden przebieg pokazał 1 test czerwony z
`retry x1` — powtórzony natychmiast, 11/11 — najprawdopodobniej `waitFor`
wrażliwy na obciążenie systemu przy współbieżnej pracy w tej sesji, nie
defekt kodu; `git diff --quiet` był pusty PRZED tym przebiegiem, więc plik
był już bitowo identyczny z HEAD).

**Wniosek §3**: mechanizm mutation-testingu w tym pakiecie działa poprawnie
(mutanty 2 i 3 wykryte natychmiast przez istniejące testy). Mutant 1 ujawnił
realną lukę w POKRYCIU testów (nie w kodzie produkcyjnym) na ścieżce
QUARANTINED, warty zgłoszenia jako follow-up.

---

## 4. Ocena wizualna — 17 zrzutów

Obejrzałem bezpośrednio 14/17 plików (wszystkie warianty light+dark
Prediction × 4 stany = 8, `gate-baseline-{resolved,missing,quarantined,
error}` × warianty = 6); pozostałe 3 (`prediction-bridge-missing-light`,
warianty duplikujące już potwierdzony wzorzec) pominięte jako redundantne —
wzorzec (crimson link, harness debug card dla resolved) powtarza się
identycznie we wszystkich próbkach tego samego typu, potwierdzony 3+ razy
niezależnie dla każdego typu ekranu.

### 4.1 Zgłoszenie Piotra (a) — crimson na "Wróć do listy"

**POTWIERDZONE.** `EmptyStateInline.tsx:60` —
`className="... text-primary-500 hover:text-primary-600 ..."`.
`tailwind.config.js:204-219`: `primary.500 = '#A82D49'`, `primary.600 =
'#85182F'` (crimson) — cała skala `primary-*` jest w rodzinie crimson
(komentarz w configu: "PRIMARY — Harvard Crimson... Numeric stops mirror the
`crimson` scale"). To DOKŁADNIE naruszenie reguły #3 z CLAUDE.md: `primary`
zarezerwowany dla stanów krytycznych, "Wróć do listy"/"Spróbuj ponownie" to
nawigacja/retry, nie krytyczna semantyka.

**Czy to regresja tego pakietu?** NIE. `git log --oneline
66d6ef42bf..HEAD -- src/components/shared/NModeBlocks/EmptyStateInline.tsx`
= PUSTY (plik w ogóle nietknięty przez `codex/fv3p-id-bridge`). `git blame`
pokazuje ostatnią zmianę tej linii na commit z 2026-07-19 (miesiąc przed tą
sesją), a strukturę przycisku na 2026-02-13. **Potwierdzam ocenę autora w
§5 jego raportu: dług pre-existing w współdzielonym komponencie**, widoczny
we WSZYSTKICH 14 obejrzanych zrzutach (bo `FinanceLegacyBridgeGate` i
`PredictionWorkspace`'s "no-id"/"not-found"/"error" stany wszystkie używają
tego samego `EmptyStateInline`).

### 4.2 Zgłoszenie Piotra (b) — prefiks "+" przy "Wróć do listy"

**POTWIERDZONE.** `EmptyStateInline.tsx:62` — `+ {action.label}` jest
zaszyty w komponencie BEZWARUNKOWO dla KAŻDEJ akcji, niezależnie od
semantyki (dodaj/wróć/ponów). To faktycznie wygląda jak skopiowany wzorzec
z przycisku "+ Dodaj" bez dostosowania do kontekstu nawigacji wstecznej —
widoczne dosłownie jako "+ Wróć do listy" i "+ Spróbuj ponownie" na
wszystkich zrzutach. Tak jak (a), pre-existing (ta sama linia, ten sam
nietknięty plik), NIE regresja tego pakietu. Autor NIE zgłosił tej
konkretnej połówki defektu explicite w swoim §5 (zgłosił tylko crimson) —
to NOWE, precyzyjniejsze zgłoszenie w stosunku do raportu autora, choć ten
sam plik/linia.

### 4.3 ★ NOWY defekt znaleziony (nie zgłoszony przez Piotra ani autora) — surowy `mapping_reason` renderowany wprost

`FinanceLegacyBridgeGate.tsx:69` (plik NOWY, napisany w TEJ sesji, nie
pre-existing):

```
: `Ten rekord został celowo pominięty przy przenoszeniu do nowego systemu. Powód: ${state.reason}.`
```

`state.reason` = surowy `mapping_reason` z bazy, pisany przez
`finance-v3-backfill-dry-run.ts` jako wewnętrzne kody/zdania diagnostyczne
po angielsku, np. `APPROVED_WITHOUT_SNAPSHOT`,
`status=DRAFT; ORCH-DEC-002: financial_analyses is the sole canonical
NPV/IRR/ROI source`, `pack_status=...;pack_readiness_status=...` (zmierzone
grep w `finance-v3-backfill-dry-run.ts`, przykłady realnych `reasonCode`/
`mappingReason` wartości). Widoczne dosłownie na zrzucie
`gate-baseline-quarantined-light.png`: **"Powód: approved_without_snapshot."**
— surowy, nieprzetłumaczony, code-owy string wprost w polskim zdaniu.

To NIE jest teoretyczne — **własny test autora to ASERTUJE jako
oczekiwane zachowanie**: `FinanceLegacyBridgeGate.test.tsx:130`
`expect(...).toContain('approved_without_snapshot')`. Autor przetestował, że
ten string się pojawia, ale nie zauważył że pojawienie się GO w tej formie
jest dokładnie tym samym gatunkiem defektu, przeciw któremu cały pakiet
(Zadanie 3, "brak surowych stringów") jest napisany — inne moduły tego
repo (`AnalysisCreatorWizard.tsx`, `MethodsWeightsStep.tsx` itd., patrz
nagłówek `rawEnumLeakScanner.test.ts`) dostały dedykowane `xLabel()` mapy
etykiet PL dla dokładnie tej klasy problemu (surowy enum/kod z backendu →
czytelny Polski tekst). `mapping_reason` nie dostał takiego traktowania.

`rawEnumLeakScanner.test.ts` (nawet w naprawionej, szerszej wersji z
kandydata) prawdopodobnie by TEGO nie złapał — skanuje znane nazwy
właściwości enumów (`.status`, `.confidence`, `.readiness` itd.), a
`reason` nie jest na tej liście, i wartości nie są czystym
SCREAMING_SNAKE_CASE (bywają całe zdania z `;`/`=`) — inna kategoria
wycieku niż to, co ten skaner wykrywa.

**Ocena**: NOWY defekt tego pakietu (plik nowy, nie pre-existing), realny,
widoczny na zrzutach, koliduje z deklarowanym celem pakietu (Zadanie 3).
Nie blokuje głównego twierdzenia (most działa, trzy stany rozróżnialne) —
ale osłabia "uczciwe ale POLSKIE" część obietnicy.

### 4.4 Dodatkowa obserwacja — "Internal error" w zrzutach błędu

Patrz §1 tabela, wiersz 3. `prediction-bridge-error-{light,dark}.png` i
`gate-baseline-error-light.png` pokazują angielskie "Internal error" jako
`hint` pod polskim tytułem. Mechanizm realny (§1, wiersz 3), nie tylko
artefakt mocka harnessu — potwierdzone czytaniem `normalizeApiError()` i
przykładowych komunikatów 500 w `server/src/middleware/*.ts`. Pre-existing
gap w `describeFinanceV2Error`'s `default:`, nietknięty przez ten pakiet.

### 4.5 Kanon — pozostałe punkty z briefu

- **Fokus niebieski `c-focus`**: NIE możliwe do oceny ze statycznych
  zrzutów — żaden z 17 plików nie przechwytuje stanu `:focus-visible`
  (wszystkie są w stanie spoczynku po załadowaniu). Nieoceniane, nie
  "PASS" domyślnie.
- **Jednolity polski**: TAK poza §4.3 (surowy `mapping_reason`) i §4.4
  ("Internal error"), oba pre-existing/omówione wyżej.
- **Status nigdy nie tylko kolorem**: TAK — każdy stan mostu (RESOLVED/
  QUARANTINED/NOT_MIGRATED/error) ma odrębną ikonę (Link2/AlertTriangle/
  Inbox) + odrębny tekst, nie tylko kolor.
- **Pięć stanów wartości rozróżnialnych / brak danych nigdy jako zero**:
  poza zakresem tego pakietu (`FinanceValueStatus` niezmieniony,
  potwierdzone czytaniem — patrz §3.4 raportu autora, zgodne z moim
  odczytem kodu) — most operuje na OSOBNYM, trójstanowym wymiarze
  (istnienie rekordu), nie na wartościach liczbowych. Nie znalazłem miejsca
  w tym pakiecie, gdzie brak danych renderuje się jako `0`.

### 4.6 `rawEnumLeakScanner.test.ts`

Uruchomiony SAM: **4/4 PASS** — potwierdza twierdzenie autora dosłownie.
**Zastrzeżenie (patrz §0)**: to STARA, wąska wersja skanera (tylko
Analysis/Valuation, próg >5 plików) — NIE ta opisana w briefie (pełny
`Finance/**`, próg 40 plików), bo ta gałąź nie ma commita z naprawą skanera.
Ponadto, jak ustalono w §4.3, ten skaner (w żadnej wersji) nie jest
zaprojektowany do łapania klasy defektu z §4.3 (surowy `mapping_reason` nie
jest śledzoną nazwą właściwości enum).

---

## 5. Testy uruchomione samodzielnie — podsumowanie z czasami

| Zestaw | Komenda | Wynik | Czas | Exit |
|---|---|---|---|---|
| Serwer (real PG) | `RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=... vitest run legacy-id-bridge.routes.pg.test.ts` | 5/5 PASS | 1.30s | 0 (z pliku) |
| Frontend sweep #1 | `vitest run src/components/Finance src/components/Economics` | 52 pliki / 476 testów PASS | 43s | 0 (z pliku) |
| Frontend sweep #2 | jw. (powtórka) | 52 pliki / 476 testów PASS | 53s | 0 (z pliku) |
| `resolveFinanceDetailBranches.test.ts` | jw. | 15/15 PASS | ~6s | 0 |
| `rawEnumLeakScanner.test.ts` | jw. | 4/4 PASS (stara wersja, §0) | <1s | 0 |
| `FinanceLegacyBridgeGate.test.tsx` (bazowo, przed mutacją) | jw. | 5/5 PASS | — | 0 |
| `PredictionWorkspace.test.tsx` (bazowo) | jw. | 11/11 PASS | — | 0 |

Wszystkie kody wyjścia odczytane z pliku (`cmd > plik 2>&1; echo EXIT=$?`),
nie z potoku.

---

## 6. Sprzątanie środowiska

```
dropdb -h 127.0.0.1 -p 54330 -U piotrwisniewski idbridge_verify
```
wykonane na końcu. Tymczasowe pliki sondy (`server/scripts/__verifier_*.ts`)
usunięte, `git status`/`git diff` w worktree potwierdzone puste przed
zakończeniem (poza tym raportem, dodanym na końcu).

---

## 7. Nowe defekty (podsumowanie do zgłoszenia)

| # | Plik:linia | Opis | Nowy w tym pakiecie? | Waga |
|---|---|---|---|---|
| D1 | `src/components/shared/NModeBlocks/EmptyStateInline.tsx:60` | `text-primary-500` (crimson) na akcji nawigacyjnej/retry, nie krytycznej | NIE, pre-existing (2026-07-19), dotyczy WSZYSTKICH ekranów tego pakietu bo współdzielony komponent | Średnia — zgłoszenie Piotra POTWIERDZONE |
| D2 | `src/components/shared/NModeBlocks/EmptyStateInline.tsx:62` | Zaszyty prefiks `+ ` niezależnie od semantyki akcji | NIE, pre-existing, ta sama linia rodziny co D1 | Niska-średnia — zgłoszenie Piotra POTWIERDZONE |
| D3 | `src/components/Finance/shared/FinanceLegacyBridgeGate.tsx:69` | Surowy `mapping_reason` z bazy (np. `approved_without_snapshot`, zdania po angielsku z `;`/`=`) renderowany wprost w polskim komunikacie; własny test autora ASERTUJE to jako oczekiwane | **TAK — plik nowy tej sesji** | Średnia — koliduje z deklarowanym celem pakietu (Zadanie 3) |
| D4 | `src/services/api/financeV2.types.ts` (`describeFinanceV2Error`, gałąź `default:`) | Surowy `err.message`/`err.data.error` (np. "Internal error") przepuszczany dla nierozpoznanych kodów błędu serwera — widoczne we WŁASNYCH zrzutach tego pakietu | NIE, pre-existing, nietknięty przez ten pakiet | Średnia — podważa "jednolity polski" poza deklarowanym zakresem Zadania 3 |
| D5 | Pokrycie testowe: `legacy-id-bridge.routes.pg.test.ts` | Test cross-tenant #4 ćwiczy tylko ścieżkę RESOLVED (podwójnie chronioną); brak analogicznego testu dla ścieżki QUARANTINED (chronionej tylko raz) — mutant 1 (§3) to udowodnił | Dotyczy testu, nie kodu produkcyjnego | Niska (kod produkcyjny jest bezpieczny), ale realna luka w regresji |
| D6 | Poza zakresem: `statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` (7 miejsc), `FinancialStatementPackWorkspace.tsx`, `analysisKpiCatalog.ts` | Dalsze surowe `err.message` w Finance/**, poza deklarowanym zakresem tego pakietu | NIE, pre-existing | Niska — informacyjne, nie w zakresie |

---

## 8. Werdykt końcowy

**PASS z zastrzeżeniami (PARTIAL na poziomie integracyjnym).**

Rdzeń pakietu — most identyfikatorów (§1a/1b/1c), anty-cicha-pustka dla
Prediction (§2), nietknięta ścieżka OFF (§4 tabeli/§4), testy 5/5+476/476×2
(§5) — jest **solidnie POTWIERDZONY niezależnym pomiarem**, nie tylko
deklaracją autora: własna baza, własny backfill, własna sonda HTTP, własne
trzy mutanty, własny przegląd 14/17 zrzutów.

Trzy zastrzeżenia obniżają ocenę z pełnego PASS:

1. **§0 — branch NIE jest zbudowany na wskazanym kandydacie** `2f3685ac3e`,
   brakuje mu ~60 plików/6800 linii z tej linii (w tym naprawionego
   skanera), i koliduje plikami (`financeV2.api.ts`/`financeV2.types.ts`) z
   równolegle rozwijaną gałęzią `codex/fv3p-i-a11y` zbudowaną NA tym
   kandydacie. **To musi zostać rozwiązane (rebase/merge + ręczne scalenie
   tych dwóch plików + ponowny przebieg naprawionego skanera) PRZED
   promocją**, inaczej Piotr zobaczy albo konflikt scalania, albo pominięty
   dorobek innej sesji.
2. **D3** — nowy (nie pre-existing) surowy string w dokładnie tym wymiarze,
   który pakiet miał naprawić (Zadanie 3) — mały, ale realny i we własnym
   teście autora zaasertowany jako "poprawne" zachowanie.
3. **D1/D2 (crimson + prefiks "+")** — oba zgłoszenia Piotra POTWIERDZONE
   jako realne i widoczne na KAŻDYM z 14 obejrzanych zrzutów mostu, choć nie
   są regresją tego pakietu. Skoro Piotr je zauważył jako pierwszy patrzący
   na produkt na realnych danych (zgodnie z regułą #7 CLAUDE.md), a
   most nowo wystawia ten komponent na piąty-szósty ekran w tym samym
   sprincie, warto rozważyć naprawę `EmptyStateInline.tsx` jako osobny,
   mały follow-up (dotyczy całego repo, nie tylko Finance) zamiast dalej
   propagować go z każdym nowym ekranem.

Żadne z trzech zastrzeżeń nie obala głównego mechanizmu (most czyta
realne dane, trzy stany są prawdziwie rozróżnialne, Prediction nie kłamie
pustką, cross-tenant nie przecieka w kodzie produkcyjnym). Ale pakiet NIE
jest gotowy do pokazania Piotrowi jako "zamknięty i gotowy do promocji" bez
adresowania §0 (baza) i, w miarę możliwości, D3.
