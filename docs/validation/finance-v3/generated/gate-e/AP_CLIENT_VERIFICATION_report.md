# AP-CLIENT (Gate J) — niezależna weryfikacja

Weryfikator: sesja `fv3p-j-security` (worktree `/Users/piotrwisniewski/consultify-wt/fv3p-j-security`),
NIE autor pakietu. Gałąź `codex/fv3p-ap-client` @ `fc8bcbf39e`, baza `ee5736a5a6` (candidate).
Zero zmian w kodzie produkcyjnym — wyłącznie pomiar, mutanty odtworzone i przywrócone.

## Tabela wyników

| # | Twierdzenie | Mój niezależny pomiar | Wynik |
|---|---|---|---|
| 1 | 35/35 endpointów ma metody klienta, poprawnie odwzorowane | Policzone `router.(get\|post\|patch\|delete)` w 5 plikach tras: compare 6, comments+review-checklist 17, saved-views 6, export-import 4, lineage-navigator 2 = **35**. Policzone eksportowane funkcje klienta w AP-CLIENT blokach `financeV2.api.ts`: 6+17+6+4+2 = **35**. Każda funkcja porównana ręcznie ze swoją trasą (ścieżka, metoda HTTP, pola ciała) — zgodne 1:1, włącznie z query-param kodowaniem i `encodeURIComponent` na parametrach ścieżki. | **POTWIERDZONE** |
| 2 | Kształt odpowiedzi zweryfikowany endpoint-po-endpoincie (koperta `{data}` vs płaskie ciało; kod błędu pod `.data.code`) | Przeczytałem KAŻDĄ z 35 tras. 34/35 zwraca `res.status(...).json({data, meta})` na sukces i `sendError()` → `{error, code, ...extra}` na błąd (top-level `code`, NIE `{data:{code}}` — ale `baseClient.ts:267-270` opakowuje całe sparsowane ciało w `err.data`, więc dla WOŁAJĄCEGO kod faktycznie ląduje pod `err.data.code`, zgodnie z ostrzeżeniem). Jeden endpoint (`GET /export/statement-pack/:id/:id`) zwraca surowy `.xlsx` binarnie + manifest w nagłówku `X-Finance-Export-Manifest` — klient (`exportFinanceStatementPackXlsx`) POPRAWNIE omija `v8Get`/`{data}` i woła `fetchWithRetry` bezpośrednio, czyta `res.blob()` + nagłówek, NIE próbuje parsować JSON na sukcesie. Jeden endpoint (`DELETE /saved-views/:id`) zwraca goły `res.status(204).send()` — patrz punkt 7. Pole-po-polu porównałem `FinanceExcelManifestDto` (klient) z `FinanceExcelManifest` (`financeExcelShared.ts`) — identyczne. | **POTWIERDZONE** |
| 3 | Flaga OFF = zero wywołań API, dla wszystkich 5 komponentów | Playwright, świeży `browser.newContext()` per komponent (bez współdzielenia localStorage), `scene=off`, licznik `page.on('request')` filtrowany do `/api/v8/finance-v2/`. Wynik dla WSZYSTKICH pięciu: **0 wywołań finance-v2**. Jedyne 10 zarejestrowanych żądań `/api/` per ekran to transformacje modułów Vite dev-server (`@fs/.../*.ts`), nie realny fetch. Zobacz tabelę niżej. | **POTWIERDZONE** |
| 4 | Zrzut „flaga OFF" mówi prawdę (nie jest reliktem przeciekającego localStorage) | Uruchomiłem `scripts/dev/ap-client-screenshots.mjs` SAM (własny serwer dev-render na :58045) — wygenerował 14 zrzutów bit-identycznych z zacommitowanymi (`git diff --stat` na katalogu `visual/ap-client/` puste PRZED i PO). Otworzyłem regenerowany `lineage-navigator-flag-off-light.png` — puste (tylko symulowane Menu 1 + harness `PanelUwag`). Dodatkowo, NIEZALEŻNIE od skryptu autora, wygenerowałem własne zrzuty `scene=off` dla WSZYSTKICH PIĘCIU komponentów (świeży kontekst przeglądarki każdy) — wszystkie renderują `null` (body = tylko pasek Menu 1, ~329-330 znaków HTML, zero treści komponentu). Mechanizm-źródło bugu (localStorage `consultify_feature_flags` przeżywa `page.goto()`) zweryfikowany w kodzie: wszystkie 5 harnessów `dev-render/screens/finance-*.tsx` NADPISUJE override na KAŻDEJ nawigacji (`overrides[FLAG_ID] = scene !== 'off'`), nie tylko warunkowo ustawia `true` — to poprawny fix, nie tylko deklaracja. | **POTWIERDZONE** (z zastrzeżeniem — patrz notatka) |
| 5 | 151/151 testów, `tsc --noEmit` czysty | `tsc --noEmit -p tsconfig.json` (`NODE_OPTIONS=--max-old-space-size=12288`, exit code capturowany `cmd > plik 2>&1; code=$?`, BEZ potoku): **EXIT=0, 88s**. Vitest dokładną komendą z raportu autora (`src/services/api/__tests__/ + useFinance*Flag.test.ts + src/components/Finance/{5 dirs} + rawEnumLeakScanner`): **21 plików / 147 testów, wszystkie PASS, EXIT=0, 15s** — NIE 22/151 jak twierdzi raport. Rozbieżność to błąd liczenia w raporcie (suma podana jako „28+18+…=66" nie zgadza się z rzeczywistymi 5 plikami pre-existing financeV2 = 58 testów), NIE fabrykacja czy fałszywa zieleń — sam przebieg jest realny i w 100% zielony, tylko podana liczba jest zawyżona o 4 testy / 1 plik. | **CZĘŚCIOWO** (testy realne i zielone, ale zgłoszona liczba niepoprawna) |
| 6 | 6 kontroli negatywnych, wszystkie RED→restored→GREEN | Powtórzyłem 3, INNYMI mutacjami niż autor (patrz sekcja niżej) — wszystkie RED, przywrócone `git checkout HEAD -- <plik>`, potwierdzone pustym `git diff`, ponownie GREEN. | **POTWIERDZONE** (dla powtórzonych 3; oryginalnych 6 nie kwestionuję, mechanizm ten sam) |
| 7 | Bug w `v8Delete` na 204, lokalne obejście bezpieczne | (a) Odtworzony IZOLOWANYM testem wołającym `v8Delete` bezpośrednio z mockiem `fetch` zwracającym `{ok:true, status:204}` bez treści — rzuca (test usunięty po przebiegu). (b) Odtworzony DRUGI RAZ przez podmianę `deleteFinanceSavedView` na wołanie `v8Delete` zamiast `v8DeleteExpectNoContent` — test `deleteFinanceSavedView → 204 → null` poszedł RED (`ReferenceError`/crash), przywrócone, GREEN. Policzeni WSZYSCY pozostali konsumenci `v8Delete` w `src/`: **13 call-site'ów w 7 plikach** (`NotebookTopicChips.tsx` ×1, `v8/results.ts` ×3, `v8/partner.ts` ×1, `v8/finance.ts` ×3, `v8/my-work.ts` ×2, `v8/assessment.ts` ×1, `v8/interview.ts` ×2). Sprawdziłem serwerowe trasy dla wszystkich sprawdzalnych bez DB (finance events/models/analyses, results kpis/kpi-mappings/scorecard-kpi, notebook topics unpin) — WSZYSTKIE zwracają `res.json({data:...})`, ŻADNA nie jest gołym 204 — bug jest DZIŚ nieaktywny dla tych 13 miejsc. `v8/client.ts` NIE był dotykany w tym diffie (`git diff --stat` puste) — obejście jest lokalne do `financeV2.api.ts`, nie maskuje niczego dla innych konsumentów DZIŚ, ale zostawia funkcję współdzieloną złamaną dla KAŻDEGO przyszłego wywołania, które faktycznie dostanie 204 (nie zgłoszone jako naprawione, tylko obejście — poprawnie opisane przez autora jako „out of scope"). | **POTWIERDZONE** (bug realny, obejście bezpieczne DZIŚ, ale to dług, nie naprawa — 13 innych konsumentów pozostają narażeni na identyczny crash, jeśli którakolwiek z ich tras kiedyś zacznie zwracać goły 204) |
| 8 | Allowlist: tylko dodawanie w `financeV2.api.ts`/`.types.ts`, brak dotknięcia `FinanceHub.tsx`/workspace'ów | `git diff ee5736a5a6..fc8bcbf39e -- financeV2.api.ts \| grep '^-'` → JEDNA usunięta linia (import, żeby dodać `v8PostMultipart`), reszta czysto addytywna, w oznaczonych blokach `--- AP-CLIENT ... ---`. `financeV2.types.ts` diff: ZERO usuniętych linii. `git diff --name-only` całego zakresu: 47 plików, ŻADEN nie pasuje do `FinanceHub\|workspace\|Manager.tsx`. `dev-render/main.tsx` diff: czysto addytywny (5 nowych lazy-importów + 5 wpisów w `SCREENS`), żaden istniejący ekran nietknięty. | **POTWIERDZONE** |
| 9 | Brak osłabionych testów (`.skip`/`.only`, usunięte asercje) | `grep -rn '\.skip(\|\.only(\|it\.todo\|xit(\|xdescribe('` na wszystkich 15 nowych plików testowych → **0 trafień**. | **POTWIERDZONE** |
| 10 | Ocena wizualna (crimson, fokus, PL, status nigdy tylko kolorem, 5 stanów, brak jako zero) | `grep -n "primary" na 5 komponentach → tylko `text-c-text-primary` (token tekstu, NIE crimson `primary-*`). Zero `bg-red-`/`text-red-`/`#85182F`/literalnego crimson. `c-focus` na WSZYSTKICH interaktywnych elementach (22 wystąpienia `focus-visible:ring-c-focus`). Wszystkie enumy (status/freshness/scope/comparisonType/diffKind/artifactType) przechodzą przez `*Label()` mappery — ręczna inspekcja nie znalazła gołego SCREAMING_SNAKE_CASE w JSX. Kolumna „Stan" w Compare pokazuje tekst („Obie strony mają wartość"), nie tylko kolor. Otworzyłem WSZYSTKIE 14 zrzutów — polski spójny, skróty REVENUE/COGS/EBITDA zgodne z dozwoloną listą, brak crimsona na CTA/aktywnych stanach. | **POTWIERDZONE** (z zastrzeżeniem skanera — patrz niżej) |

### Punkt 3 — szczegóły per komponent (flaga OFF, świeży kontekst przeglądarki)

| Komponent | Wywołania `/api/v8/finance-v2/*` | Body HTML po renderze | Wynik |
|---|---|---|---|
| `FinanceLineageNavigator` | 0 | tylko pasek Menu 1 (329 znaków) | zero-render potwierdzony |
| `FinanceComparePanel` | 0 | tylko pasek Menu 1 (330 znaków) | zero-render potwierdzony |
| `FinanceCommentsPanel` | 0 | tylko pasek Menu 1 (329 znaków) | zero-render potwierdzony |
| `FinanceSavedViewsPanel` | 0 | tylko pasek Menu 1 (329 znaków) | zero-render potwierdzony |
| `FinanceExportImportPanel` | 0 | tylko pasek Menu 1 (329 znaków) | zero-render potwierdzony |

Mechanizm gatingu w kodzie źródłowym (nie tylko test): 4/5 komponentów (`lineage`, `compare`, `comments`, `savedViews`) mają `if (!enabled) return;` WEWNĄTRZ `useEffect`/`load()` — efekt sam się wywołuje na każdym renderze, ale funkcja wewnątrz krótko spina się przed jakimkolwiek `fetch`. `FinanceExportImportPanel` w ogóle nie ma auto-fetch effectu (import startuje tylko z akcji użytkownika — kliknięcie/upload), więc jedyna bramka to `if (!enabled) return null` przed renderem formularza. Oba wzorce poprawnie uniemożliwiają wywołanie sieciowe przy fladze OFF.

### Punkt 4 — zastrzeżenie

Skrypt `ap-client-screenshots.mjs` generuje **TYLKO JEDEN** zrzut `*-flag-off-*`
(`lineage-navigator-flag-off-light.png`) — dla pozostałych czterech komponentów (`compare`,
`comments`, `savedViews`, `exportImport`) nie istnieje zacommitowany dowód wizualny stanu OFF,
mimo że kod naprawy (nadpisywanie `localStorage` na każdej nawigacji) jest obecny we WSZYSTKICH
pięciu plikach `dev-render/screens/finance-*.tsx`. Dowód dla tych czterech opiera się wyłącznie na
testach jednostkowych (realnych, przeze mnie uruchomionych, zielonych) i na moich własnych,
niezacommitowanych zrzutach wygenerowanych w tej sesji (patrz `verify-shots/*-flag-off.png` w
scratchpadzie weryfikatora — nie część tego repo). Nie jest to fałszywy dowód, ale zakres
zacommitowanego dowodu wizualnego jest węższy niż podpis „naprawiłem to we wszystkich pięciu
ekranach i wygenerowałem zrzuty ponownie" sugeruje — zrzuty zostały wygenerowane ponownie tylko
dla scen faktycznie na liście skryptu (14, nie 5×flag-off).

### Punkt 10 — zastrzeżenie (skaner)

`tests/unit/finance/rawEnumLeakScanner.test.ts` uruchomiony (4/4 PASS, 2s) — ale skaner jest
NA SZTYWNO ograniczony do `src/components/Finance/Analysis/` i `src/components/Finance/Valuation/`
(`SCAN_DIRS` w pliku testowym). **NIE skanuje żadnego z pięciu katalogów AP-CLIENT**
(`compare/`, `comments/`, `savedViews/`, `exportImport/`, `lineage/`) — zielony wynik tego testu
nie mówi nic o tym pakiecie. Zastąpione ręczną inspekcją (patrz wiersz 10 w tabeli) — nie znalazłem
gołych enumów, ale to inspekcja wzrokowa/grep, nie automatyczna bramka.

## Negatywne kontrole — 3 powtórzone, INNE mutacje niż autora

| # | Plik | Mutacja | Test | Wynik |
|---|---|---|---|---|
| 1 | `financeV2.api.ts` — `compareFinancePeriods` | zmieniono nazwę pola ciała `periodIdA` → `periodA` (literówka w kluczu JSON, nie w logice bramkowania) | `financeV2.compare.api.test.ts` „z periodIdA/periodIdB" | RED (`expected periodIdA in body, got periodA`) → `git checkout HEAD --` → puste `git diff` → GREEN (7/7) |
| 2 | `useFinanceCompareFlag.ts` | `defaultValue: false` → `true` (flaga włączona domyślnie) | `useFinanceCompareFlag.test.ts` + `FinanceComparePanel.test.tsx` | RED (4 testy, w tym „flaga domyślnie OFF") → `git checkout HEAD --` → puste `git diff` → GREEN (9/9) |
| 3 | `financeV2.api.ts` — `deleteFinanceSavedView` | podmieniono wołanie `v8DeleteExpectNoContent` (obejście) na bezpośrednie `v8Delete` (oryginalny, zepsuty kod) | `financeV2.savedViews.api.test.ts` „204 → null" | RED (crash na mockowanym 204) → `git checkout HEAD --` → puste `git diff` → GREEN (7/7) — ta mutacja jest jednocześnie NIEZALEŻNYM odtworzeniem realnego buga z punktu 7 |

Po każdym mutancie: `git diff --stat <plik>` → puste, potwierdzone przed przejściem dalej.
Końcowy `git status --short` całego worktree: puste.

## Ocena końcowa

**PASS** — z dwoma zastrzeżeniami do odnotowania w rejestrze, żadne nie blokujące:

1. Raport autora podaje 151/151 testów w 22 plikach; realny, przeze mnie zweryfikowany wynik
   dokładnie tą samą komendą to **147/147 w 21 plikach**, wszystkie zielone. Sam przebieg testów
   jest prawdziwy i kompletny — błąd jest w podsumowującej liczbie w dokumentacji, nie w kodzie
   ani w pokryciu testowym. Do poprawienia w `AP_CLIENT_report.md`, nie wymaga cofania kodu.
2. Wizualny dowód „flaga OFF" istnieje jako zacommitowany zrzut tylko dla 1 z 5 komponentów
   (lineage navigator) — dla pozostałych czterech dowód jest testowy + mój niezależny, ale
   niezacommitowany, przebieg Playwrighta w tej sesji. Zalecenie: jeśli Gate J wymaga zrzutu
   flag-off per komponent jako część DoD, rozszerzyć `ap-client-screenshots.mjs` o brakujące 4
   sceny `scene=off` przed formalnym zamknięciem bramki.

Wszystkie dziesięć twierdzeń zweryfikowanych niezależnie; 7/10 POTWIERDZONE bez zastrzeżeń,
3/10 POTWIERDZONE/CZĘŚCIOWO z odnotowanymi, nieblokującymi zastrzeżeniami. Zero nowych defektów
w kodzie produkcyjnym ponad to, co autor już sam zgłosił (bug `v8Delete`). Zero regresji
wprowadzonych przez tę weryfikację — worktree czysty, `git status --short` puste.
