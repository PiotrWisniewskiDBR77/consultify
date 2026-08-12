# FIX-D — regresja surowego enuma w PredictionWorkspace + błędna kwalifikacja w KNOWN_UNFIXED_LEAKS

Data: 2026-08-12. Baza: `57fe0543cc` (worktree `/Users/piotrwisniewski/consultify-wt/fv3p-l-goldco`,
gałąź `codex/fv3p-fixd-regression`).

## ★ ZMIANA ZAKRESU W TRAKCIE PRACY (ważne dla scalania)

Zadanie 1 zostało **cofnięte przez orkiestratora w trakcie sesji**: agent FIX-C
(`codex/fv3p-fixc-layout` @ `45fbf9c808`) naprawił dokładnie tę samą linię
(`{mountCheck.version.status}` w `PredictionWorkspace.tsx`) niezależnie, przez ten sam helper
`businessVersionStatusLabel()`, z własną kontrolą negatywną (patrz `FIXC_LAYOUT_report.md` na tamtej
gałęzi). Orkiestrator polecił mi **nie dotykać `PredictionWorkspace.tsx`** i skupić się wyłącznie na
Zadaniu 2 (mechanizm `KNOWN_UNFIXED_LEAKS`).

Sekwencja zdarzeń w tej sesji:
1. Wykonałem Zadanie 1 (import `businessVersionStatusLabel`, zamiana `{mountCheck.version.status}`
   na `{businessVersionStatusLabel(mountCheck.version.status)}` w linii 250) i potwierdziłem, że to
   jedyna surowa interpolacja enuma w pliku (`grep -n "\.status\|\.kind\b\|Status}"` — tylko linia 250
   trafiała na tekst renderowany; pozostałe wystąpienia `.kind` to porównania stanu maszyny stanów,
   nie render).
2. Otrzymałem wiadomość o zmianie zakresu i **przywróciłem plik do stanu `57fe0543cc`** poleceniem
   `git show 57fe0543cc:src/components/Finance/Prediction/PredictionWorkspace.tsx >
   src/components/Finance/Prediction/PredictionWorkspace.tsx` (bez `git checkout`/`stash`/`reset`).
   Potwierdzone pustym `git diff -- src/components/Finance/Prediction/PredictionWorkspace.tsx`.
3. Reszta tego raportu dotyczy WYŁĄCZNIE Zadania 2.

**Skutek dla stanu testów na TEJ gałęzi w izolacji**: `PredictionWorkspace.tsx` na tej gałęzi nadal
zawiera surowy enum (naprawa istnieje tylko na gałęzi FIX-C, `45fbf9c808`) i **nie jest** wpisany do
`KNOWN_UNFIXED_LEAKS` w mojej wersji pliku (patrz niżej — ten wpis nigdy tu nie istniał). Efekt: test
`no .tsx file under Finance/** bare-interpolates a known enum property...` jest **czerwony na tej
gałęzi w izolacji** — to oczekiwane i udokumentowane, nie defekt mojej poprawki. Po scaleniu z gałęzią
FIX-C (która usuwa surową interpolację) ten test wróci do zielonego stanu, bo offender fizycznie
zniknie z zeskanowanych plików.

## Zadanie 1 — status: PRZEKAZANE do FIX-C, nie dostarczone przeze mnie

Nie dostarczone z tego worktree — zrobione niezależnie na `codex/fv3p-fixc-layout` @ `45fbf9c808`.
Diff mój na `PredictionWorkspace.tsx`: **pusty** (plik wraca do stanu `57fe0543cc`).

## Zadanie 2 — mechanizm KNOWN_UNFIXED_LEAKS (mój pełny zakres)

### 1. Kolizja zgłoszona, nie zgadywana

Instrukcja zlecała usunięcie wpisu `PredictionWorkspace.tsx` z `KNOWN_UNFIXED_LEAKS`. **Ten wpis nie
istnieje w mojej wersji pliku** (bazie `57fe0543cc`) — potwierdzone: jedyny wpis w
`KNOWN_UNFIXED_LEAKS` na mojej bazie to

```
'src/components/Finance/FinancialStatementPackWorkspace.tsx: {file.status}'
```

Powód: commit `21cd47fd1b` ("test(gate-e/fix-b): close rawEnumLeakScanner directory-slack gap"),
który dodał wpis dla `PredictionWorkspace.tsx` do `KNOWN_UNFIXED_LEAKS`, żyje na gałęzi FIX-B i **nie
jest przodkiem mojego HEAD** (`git merge-base --is-ancestor 21cd47fd1b HEAD` → `no`). To dokładnie
kolizja, przed którą ostrzegał brief — zgłaszam, nie zgaduję. Nic do usunięcia po mojej stronie; przy
scalaniu trzech gałęzi (moja / FIX-B / FIX-C) integrator zobaczy, że wpis FIX-B dla
`PredictionWorkspace.tsx` stanie się zbędny, bo FIX-C usuwa leżącą pod nim linię kodu.

### 2. Pochodzenie WSZYSTKICH wpisów w mojej wersji `KNOWN_UNFIXED_LEAKS` (jest ich jeden)

`src/components/Finance/FinancialStatementPackWorkspace.tsx: {file.status}`

- `git log -S'{file.status}' -- src/components/Finance/FinancialStatementPackWorkspace.tsx` →
  `050ef26962` (2026-03-15 14:35:50, autor Piotr, "fix(finance): statement import improvements and
  audit updates") jako ostatnia zmiana wprowadzająca/dotykająca ten literał — **pięć miesięcy przed
  tą sesją** (sesja: 2026-08-12).
- Wpis do `KNOWN_UNFIXED_LEAKS` dodał commit `bd6e9f2ad5` ("fix(finance-v3/gate-j): widen
  rawEnumLeakScanner to all of Finance/**", 2026-08-12 17:06:45) — TEJ sesji, ale to moment
  **odkrycia** (poszerzenie `SCANNED_ROOTS`), nie moment wprowadzenia wycieku.
- Weryfikacja: `050ef26962` jest przodkiem mojego HEAD (`yes`), `bd6e9f2ad5` też (`yes`).
- **Wniosek: ten wpis jest poprawnie zakwalifikowany jako dług przedistniejący, NIE regresja tej
  sesji.** Nie ruszam go poza dodaniem wymaganego pola `origin`/`reason` (patrz niżej).

Dodatkowo sprawdziłem (poza moim plikiem, bo to jedyny sposób ustalenia, czy metoda uogólnia się
poprawnie) pochodzenie wpisu, którego szukałem: `PredictionWorkspace.tsx: {mountCheck.version.status}`
— `git log -S'{mountCheck.version.status}' -- src/components/Finance/Prediction/PredictionWorkspace.tsx`
wskazuje `2e61d2eeff` z tej sesji ("feat(finance-v3/id-bridge): wire FinanceHub through the bridge,
fix Prediction silent-emptiness, kill raw error strings") — **regresja tej sesji**, dokładnie zgodnie
z ustaleniem niezależnej baterii weryfikacyjnej cytowanym w brief. To potwierdza, że metoda
(`git log -S` po dokładnym fragmencie tekstu) poprawnie rozróżnia oba przypadki.

### 3. Zabezpieczenie strukturalne — zaimplementowane

Zaimplementowałem wymóg pochodzenia w `tests/unit/finance/rawEnumLeakScanner.test.ts` (jedyny plik z
mojej allowlisty poza `PredictionWorkspace.tsx`, którego finalnie nie dotknąłem). Zmiana:

- `KNOWN_UNFIXED_LEAKS` z `Set<string>` → `readonly KnownUnfixedLeak[]`, gdzie
  `interface KnownUnfixedLeak { key: string; origin: string; reason: string }`.
  `origin` = commit SHA (7–40 hex) lub data ISO `YYYY-MM-DD`; `reason` = niepuste uzasadnienie.
- Nowy `KNOWN_UNFIXED_LEAK_KEYS = new Set(KNOWN_UNFIXED_LEAKS.map(l => l.key))` zastępuje bezpośrednie
  użycie starego `Set` w dwóch miejscach (`newOffenders` filter, staleness test).
- Dwa nowe testy:
  1. **`declares a checkable origin...`** — twardy fail, jeśli `origin` nie pasuje do kształtu SHA/ISO
     albo `reason` jest pusty.
  2. **`points at a real commit in this repo (best-effort)`** — jeśli `origin` wygląda jak SHA,
     woła `git cat-file -e <sha>^{commit}` (cwd = korzeń repo). Trzy wyniki: `true` (istnieje) →
     PASS; `false` (git uruchomił się i potwierdził brak obiektu) → **twardy FAIL**, łapie
     sfabrykowany/błędny SHA; `null` (git w ogóle się nie uruchomił — brak na PATH, nie-repo) →
     test pomija tę pozycję (nie chcemy flaky CI przy płytkim/niepełnym klonie). Sprawdziłem, że
     repo NIE jest płytkie (`git rev-parse --is-shallow-repository` → `false`), więc w tym
     środowisku check jest w pełni egzekwowany, nie tylko best-effort.

To bezpośrednio uniemożliwia powtórkę incydentu: wpis bez `origin`/`reason` nie skompiluje się (TS)
ani nie przejdzie testu; wpis z sfabrykowanym SHA-em (np. skopiowanym z niczego, albo błędnie
przepisanym) jest łapany przez test #2. Test #1 wymusza AUTORA wpisu do faktycznego ustalenia i
zapisania pochodzenia — nie eliminuje ryzyka złej kwalifikacji (ktoś może wpisać prawdziwy, ale
niewłaściwy SHA), ale usuwa dokładnie tę wadę, która pozwoliła FIX-B wpisać regresję jako dług: żadne
pole nie wymagało w ogóle podania pochodzenia, więc nikt go nie sprawdzał.

### 4. Kontrole negatywne zabezpieczenia (nie kontrola negatywna Zadania 1 — to jest inny mechanizm)

Wykonane na moim WŁASNYM nowym kodzie (nie na `57fe0543cc:<plik>`, bo to nowa logika, nie
istniała w bazowym commicie) — mutacja ręczna przez Edit, przywrócenie przez Edit, bez
`stash`/`reset`/`checkout`:

1. `origin: 'not-a-valid-origin'` → test `declares a checkable origin...` poszedł **CZERWONY**,
   poprawnie nazywając wpis (`src/components/Finance/FinancialStatementPackWorkspace.tsx:
   {file.status}: origin must be a git commit SHA...`).
2. `origin: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'` (poprawny kształt SHA, fałszywy commit) →
   test `points at a real commit...` poszedł **CZERWONY**, poprawnie nazywając wpis i cytując SHA.
3. Przywrócone do `origin: '050ef26962'` → pełny plik z powrotem na **6/7 PASS** (jedyny fail to
   opisany wyżej, oczekiwany brak fixu Zadania 1 na tej gałęzi).

### 5. Inne listy tego typu w repo?

`grep -rln "KNOWN_UNFIXED\|KNOWN_ISSUES\|ALLOWLIST\|KNOWN_OFFENDERS\|KNOWN_EXCEPTIONS"` po
`tests/`, `src/`, `server/` zwrócił wyłącznie niepowiązane wzorce (demo-write allowlist, security
migration, feature-flag test, migration-identity guard) — żaden nie jest listą "znany, nienaprawiony
wyciek" analogiczną do `KNOWN_UNFIXED_LEAKS`. Nie znalazłem drugiego miejsca wymagającego tej samej
poprawki.

## Diff — pełny (`git diff --stat`)

```
tests/unit/finance/rawEnumLeakScanner.test.ts | 113 +++++++++++++++++++++++---
1 file changed, 102 insertions(+), 11 deletions(-)
```

`src/components/Finance/Prediction/PredictionWorkspace.tsx`: **brak zmian** (przywrócony do
`57fe0543cc`, potwierdzone pustym `git diff`).

Pełny diff testu — patrz commit tej gałęzi (`git show <SHA> -- tests/unit/finance/rawEnumLeakScanner.test.ts`).
Kluczowe linie zmienione (dla integratora rozstrzygającego 3-gałęziowy merge):
- linia importu: dodany `import { execSync } from 'child_process';`
- blok `KNOWN_UNFIXED_LEAKS` (był: `const KNOWN_UNFIXED_LEAKS = new Set<string>([...])`) →
  zastąpiony `interface KnownUnfixedLeak`, `const KNOWN_UNFIXED_LEAKS: readonly KnownUnfixedLeak[]`,
  `const KNOWN_UNFIXED_LEAK_KEYS = new Set(...)`, `COMMIT_SHA_RE`/`ISO_DATE_RE`,
  `function commitExistsInHistory(...)`.
- `newOffenders = offenders.filter((o) => !KNOWN_UNFIXED_LEAKS.has(o))` →
  `!KNOWN_UNFIXED_LEAK_KEYS.has(o)`.
- pętla stale-check: `currentOffenders.has(known)` → `currentOffenders.has(known.key)`, komunikat
  `${known}` → `${known.key}`.
- dodane na końcu `describe(...)`: dwa nowe `it(...)` bloki (provenance shape + git-existence).

★ **KOLIZJA DO ROZSTRZYGNIĘCIA PRZY SCALANIU**: FIX-B (`21cd47fd1b`) zmienił próg liczbowy sanity-checku
na asercję nazwanych katalogów w TYM SAMYM pliku i dodał wpis `PredictionWorkspace.tsx` do
`KNOWN_UNFIXED_LEAKS` (stary format `Set<string>`). FIX-C usunął wpis
`FinancialStatementPackWorkspace` (bo naprawił leżący pod nim kod) w tym samym pliku. Moja zmiana
przebudowuje CAŁY typ `KNOWN_UNFIXED_LEAKS` z `Set<string>` na strukturę obiektową — to **na pewno
skoliduje** tekstowo z obiema tamtymi gałęziami przy `git merge`/`rebase`. Nie próbowałem tego
pogodzić (zgodnie z poleceniem). Propozycja dla integratora: scal ręcznie, biorąc:
  - nowy typ `KnownUnfixedLeak`/`KNOWN_UNFIXED_LEAK_KEYS`/testy provenance z mojej gałęzi jako bazę,
  - per-katalog asercję sanity-checku z FIX-B,
  - usunięcie wpisu `FinancialStatementPackWorkspace` (FIX-C, bo naprawiony) i wpisu
    `PredictionWorkspace` (bo naprawiony przez FIX-C) — jeśli oba faktycznie naprawione po scaleniu,
    finalny `KNOWN_UNFIXED_LEAKS` powinien być **pusty**, każdy wpis przepisany na nowy obiektowy
    format z `origin`/`reason` uzupełnionym retroaktywnie.

## Wyniki testów

### `tests/unit/finance/rawEnumLeakScanner.test.ts` (mój plik)
`npx vitest run tests/unit/finance/rawEnumLeakScanner.test.ts --maxWorkers=2`
6/7 PASS, exit 1 (jeden oczekiwany fail — patrz "ZMIANA ZAKRESU" wyżej). ~2s.

### `tests/unit/finance/**` (pełny katalog)
`npx vitest run tests/unit/finance --maxWorkers=2` → exit 1, duration 46s.
Test Files: 2 failed | 60 passed (62). Tests: 3 failed | 789 passed (792).
- 1 fail = mój oczekiwany `rawEnumLeakScanner` offender (patrz wyżej).
- 2 faile w `tests/unit/finance/financeFallbackGating.test.ts`
  (`MODULE_ECONOMICS is registered as an open beta...`, `locks MODULE_MEETING for a regular USER...`)
  — **niezwiązane z moją zmianą**: dotyczą `BETA_MENU_STATUS`/`lockClosedBetaModules`, plik nie jest
  w mojej allowliście, nie dotykałem go, mój diff to wyłącznie `rawEnumLeakScanner.test.ts`. Wygląda
  na przedistniejący stan tej bazy (`57fe0543cc`) niezwiązany z żadnym z zadań FIX-D. Nie badałem
  dalej — poza zakresem tego zlecenia.

### `src/components/Finance/**` (komponenty)
`npx vitest run src/components/Finance --maxWorkers=2` → exit 0, duration 37s (36.08s reported).
Test Files: 62 passed (62). Tests: 504 passed (504).

### `npx tsc --noEmit -p tsconfig.json` z korzenia
[UZUPEŁNIONE PO ZAKOŃCZENIU — patrz sekcja niżej]

## Rzeczy niedostarczone i powody

1. **Naprawa `PredictionWorkspace.tsx` (Zadanie 1)** — cofnięta poleceniem orkiestratora, dostarczona
   niezależnie przez FIX-C na `codex/fv3p-fixc-layout` @ `45fbf9c808`. Mój diff na ten plik: pusty.
2. **Usunięcie wpisu `PredictionWorkspace.tsx` z `KNOWN_UNFIXED_LEAKS`** — nie dostarczone, bo wpis
   nie istnieje w mojej bazie (`57fe0543cc`). Zgłoszone jako kolizja z gałęzią FIX-B (`21cd47fd1b`),
   nie zgadywane.
3. **Ujednolicenie trzech gałęzi dotykających `rawEnumLeakScanner.test.ts`** — celowo NIE wykonane
   (polecenie: "NIE próbuj tego pogodzić"). Propozycja scalenia opisana wyżej, do decyzji
   integratora.
4. **Pełny przebieg testów Finance obejmujący `server/**`** — nie wykonany: mój diff nie dotyka
   żadnego pliku server/, `server/**` testy wymagają bazy (`RUN_DB_TESTS=1`+`MOCK_DB=false`+
   `NODE_ENV=test`+`DATABASE_URL`) i osobnego sprzątania, a zakres zadania po zmianie orkiestracji
   to wyłącznie `tests/unit/finance/rawEnumLeakScanner.test.ts` (frontend/testowy plik). Uznałem
   uruchomienie DB-testów za nieproporcjonalne do zerowej zmiany w `server/**`.

---

## `tsc --noEmit` — pomiar domknięty przez orkiestratora

Agent zatrzymał się dwukrotnie, czekając na ten przebieg z niezapisaną pracą. Pomiar wykonał
orkiestrator, żeby go odblokować.

| | |
|---|---|
| Komenda | `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit > /tmp/tsc_fixd.txt 2>&1; code=$?` |
| Gałąź | `codex/fv3p-fixd-regression` |
| **Kod wyjścia** | **0** |
| **Czas trwania** | **269 s** |
| Linii wyjścia | 0 |

★ Czas 269 s jest częścią dowodu: `exit 134` (OOM) przy zerze błędów wygląda identycznie jak
sukces, a przebieg kończący się w kilka sekund oznaczałby, że `tsc` nie objął drzewa.
Kod wyjścia przechwycony bezpośrednio, bez potoku.

## Korekta zakresu w trakcie pracy

Zadanie 1 (naprawa surowego enuma w `PredictionWorkspace.tsx`) zostało **wycofane przez
orkiestratora**, ponieważ agent FIX-C naprawił dokładnie tę samą linię wcześniej, na gałęzi
`codex/fv3p-fixc-layout` @ `45fbf9c808`. Był to błąd orkiestracji — uruchomienie dwóch agentów
na tym samym pliku bez przewidzenia, że skaner doprowadzi FIX-C do tego samego miejsca.
Potwierdzone: `git diff --name-only 57fe0543cc..HEAD | grep -c PredictionWorkspace` = **0**,
czyli polecenie stop zostało uszanowane i nie powstał konflikt.

Zakresem FIX-D pozostaje wyłącznie **mechanizm pochodzenia wpisów** — wartościowszy od pojedynczej
naprawy, bo dotyczy sposobu, w jaki lista wyjątków przyjmuje twierdzenia.
