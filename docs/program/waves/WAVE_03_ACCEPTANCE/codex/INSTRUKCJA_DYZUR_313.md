# INSTRUKCJA DYŻURU nr 313 — Codex — „★★★ DOMKNIĘCIA 2 — bezpieczeństwo odpowiedzi HTTP i błędy 500 na świeżej bazie: dyżur 296 zameldowałby „wycieki zamknięte”, gdyby nie szerszy pomiar odbioru — **35 realnych wycieków treści błędu w odpowiedziach HTTP zostało** (`table-platform.routes.ts` 28, `data-collection.routes.ts` 7; warianty `(e as Error)` i pole `details`, których ani codemod, ani pierwotny guard nie widziały), **klasy błędów domenowych nie dziedziczą `AppError`**, więc mapper zamienia komunikat biznesowy („cykl nie jest aktywny”, „szablon już zatwierdzony”) na angielski generyk i wystawia `errorCode: INTERNAL` przy HTTP 404, **`req` jest przekazywany do mappera jako `undefined` w każdym wywołaniu**, więc polski słownik komunikatów nigdy się nie uruchamia — a niezależnie od tego żywy przelot odbiorcy 04.09 na bazie zmigrowanej OD ZERA pokazał **osiem tras oddających 500 zwykłemu zalogowanemu użytkownikowi, w tym trzy z surowym SQL, stosem i ścieżką dyskową**; ten dyżur MIERZY własnym mianownikiem (w programie krążą trzy różne liczby tej rodziny: 305, 341, 294 — żadna nie uzgodniona), sprowadza ratchet 35 do zera przez mapper, sprawia że klasy domenowe niosą `isOperational` i `statusCode`, przekazuje `req` drugim codemodem zapisanym w repo, i naprawia osiem tras 500 tam, gdzie przyczyną jest dialekt SQLite na Postgresie (`group_concat` → `string_agg`), brak kolumny w łańcuchu migracji (migracja addytywna) albo brak walidacji identyfikatora przed zapytaniem (400 zamiast 500). ★ Kody HTTP zostają jak były — JEDYNY dozwolony wyjątek to 500 → 400 dla nieprawidłowego identyfikatora, i tylko wtedy, gdy wpiszesz go imiennie do tabeli w raporcie."

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
poprzednich dyżurów. Wszystko, czego potrzebujesz, jest poniżej albo pod
wskazanymi ścieżkami w repo.

> ### ★★ ZAKAZ NR 1 — KATALOG WŁAŚCICIELA. CZYTASZ TO, ZANIM URUCHOMISZ COKOLWIEK.
>
> **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani
> do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`,
> ani `git fetch`, ani `git worktree add`.
> To brudny checkout właściciela produktu i jest **NIETYKALNY**.
> Jedyny dozwolony kontakt z tą ścieżką to **symlink `node_modules` (odczyt)**
> wg `DEC-2026-08-26-86`.
>
> **★★ TO JEST NAJCZĘSTSZA PRZYCZYNA STRACONEJ GODZINY W TYM PROGRAMIE.**
> Instrukcja dyżuru 53 kazała wykonać `git fetch --all` i `git worktree add`
> „w root-repo" — wykonawca zrobił to w katalogu właściciela, `Z5` zablokowało
> pracę i dyżur stanął na STOP-ie, który nie miał prawa powstać.
> **Dlatego w `§0.1` masz PEŁNĄ, DOSŁOWNĄ procedurę worktree Z VAULTA.**
> Nie improwizuj jej i nie zastępuj „swoim sposobem". Twoje miejsce pracy to
> **wyłącznie** `/private/tmp/cx-day313-domkniecia2`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `b305261454`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-04.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****PRZEKROJOWE — SERWER: co zostało po dyżurze 296 i co odsłonił żywy przelot 04.09.** Dyżur 296 został scalony do `m03` (marker tego dyżuru `b305261454` JEST tym scaleniem) z werdyktem SCALIĆ Z ZASTRZEŻENIEM i pięcioma zastrzeżeniami — `docs/program/waves/WAVE_03_ACCEPTANCE/codex/ODBIOR_DYZURU_296_WIP_20260904.md`, wiersz `D14` w `docs/program/REJESTR_ZNALEZISK_20260903.md`. Trzy z tych zastrzeżeń są zadaniami tego dyżuru: **(Z1)** rodzina wycieków niedomknięta — wariant `(e as Error)` i pole `details` nigdy nie weszły ani w codemod, ani w pierwotny guard; dług spięty ratchetem **35** w `tests/unit/backend/security/noRawErrorMessage.test.ts` i siedzi w DWÓCH plikach: `table-platform.routes.ts` (28) i `data-collection.routes.ts` (7); **(Z2 + Z4)** komunikaty domenowe zamienione na angielski generyk, bo klasy błędów nie dziedziczą `AppError` — potwierdzone imiennie na `OkrCycleProgramNotActiveError`, `FinanceSettingsCommandError`, `TemplateNotFoundError`, `CommandCapabilityDeniedError`, przy czym `TemplateNotFoundError` daje HTTP 404 z ciałem `errorCode: INTERNAL`; **(Z3)** codemod przekazał `req` jako `undefined` we wszystkich wywołaniach (mój pomiar: 335 wystąpień `, undefined,` w 406 wołaniach mappera w 71 plikach), więc `Accept-Language` nie jest czytany i polski słownik mappera nigdy się nie uruchamia. **Czwarty temat pochodzi z odbioru dyżuru 312** (`ODBIOR_DYZUROW_307_311_312_20260904.md`, sekcja „Dyżur 312”): w żywym przelocie odbiorcy na bazie zmigrowanej OD ZERA **osiem tras zwróciło 500 zwykłemu zalogowanemu użytkownikowi**, a trzy z nich oddały surowy komunikat SQL wraz ze stosem i bezwzględną ścieżką dyskową — `invalid input syntax for type uuid`, `function group_concat(text) does not exist` (dialekt SQLite wywołany na Postgresie) oraz `column „coverage_percent” does not exist` (kolumna żyje wyłącznie w runtime DDL `DatabaseInitializer.ts`, w łańcuchu migracji jej NIE MA — rodzina „schemat mieszka poza migracjami”).**.
Trasy front: `**Brak zmian w `src/`** — ale `R1` MIERZY, kto na froncie czyta pole `details` i pole `error`, bo od tego zależy kształt naprawy 28 miejsc z `details`. ★ Mój pomiar 04.09 i pułapka, w którą sam wpadłem: `git grep -nE "\.details\b" -- src` zwraca **0**, a `git grep -nE "\.details" -- src` zwraca **125** — `\b` w `git grep -E` oddaje pustkę zamiast błędu. Realny konsument istnieje: `src/utils/apiError.ts` (linie 73, 92, 110, 120, 145) normalizuje `details` i składa z niego komunikat użytkownika przez `flattenValidationDetails`. Zmierz, co ta funkcja robi ze STRINGIEM (a wszystkie 35 miejsc podaje string z `.message`), a co z obiektem/tablicą błędów pól — i dopiero wtedy zdecyduj, czy `details` znika, czy zostaje. Pole `error` czyta `src/services`/`src/api`/`src/hooks` w 91 miejscach (mój pomiar) — kształt `error` NIE ZMIENIA SIĘ.`. Trasy tył: ``server/src/middleware/appErrorMapper.ts` (113 linii; `classify()` czyta wyłącznie `statusCode`/`status`/`code` z obiektu błędu, `MESSAGES.pl` jest martwy bez `req`) · `server/src/utils/ErrorHandler.ts` (klasa `AppError`: `statusCode`, `code`, `details`, `status`, `isOperational = true`) · `server/src/routes/table-platform.routes.ts` (28 wycieków) i `server/src/routes/data-collection.routes.ts` (7 wycieków) · `tests/unit/backend/security/noRawErrorMessage.test.ts` (guard: `day296Pattern` i `fullFamilyPattern` + ratchet `REMAINING_LEAK_BASELINE = 35`) · `scripts/dev/codemod-error-mapper.mjs` (codemod nr 1 — wzorzec dla codemodu nr 2) · klasy domenowe: `server/src/services/resultsVnext/okr/okrCycleCommands.ts:61`, `server/src/services/finance/canonical/financeSettingsCommandService.ts:21`, `server/src/services/deliverableTemplateService.ts:585`, `server/src/services/resultsVnext/platform/commandCapabilityGuard.ts:95` · trasy 500: `server/src/routes/billing.routes.ts:1355` i `:1373`, `server/src/routes/knowledge-graph.routes.ts:359`, `server/src/routes/report-builder.routes.ts:327` i `:1008`, `server/src/routes/table-platform.routes.ts:4408/4430/4533/4557` · dialekt SQLite: `server/src/services/knowledgeGraph/unifiedKGService.ts:763`, `server/src/jobs/aiLearningJob.ts:224`, `server/src/routes/ai/ai-feedback.routes.ts:363`, `server/src/services/ai/proactiveSuggestionsService.ts:222` (+ `server/scripts/backfill-role-migration.ts:155` poza runtime) oraz `adaptQuery()` w `server/src/database/PostgresDatabase.ts:880` (tłumaczy funkcje dat, o `GROUP_CONCAT` nie wie) · schemat: `server/src/database/DatabaseInitializer.ts:1703` i `:1745` (`coverage_percent`) kontra `server/migrations/507_imported_reports.sql:9` (tabela `imported_reports` JEST w migracjach, kolumny NIE MA).`.

---

### 0.1. ★★ BAZA PRACY, MARKER I GAŁĄŹ — PROCEDURA DOSŁOWNA, Z VAULTA

**Repozytorium, z którego pracujesz, to BARE-vault, a nie checkout właściciela:**

```
/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
```

Vault ma `extensions.worktreeConfig=true`. **To ma konsekwencję operacyjną,
którą MUSISZ obsłużyć — krok (4).**

**PIERWSZE KOMENDY DYŻURU — wklej dokładnie tak, po kolei:**

```bash
VAULT=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
WT=/private/tmp/cx-day313-domkniecia2
MARKER=b305261454

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day313-domkniecia2-bezpieczenstwo-odpowiedzi-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day313-domkniecia2/config.worktree"
cat "$VAULT/worktrees/cx-day313-domkniecia2/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day313-domkniecia2-scratch
mkdir -p /private/tmp/cx-day313-domkniecia2-artefakty

# (7) sanity
git -C "$WT" rev-parse HEAD
git -C "$WT" status --short | head -3
```

**Wynik komend (2) i (7) wklejasz do raportu dosłownie.**

> **★★ PUŁAPKA — REMOTE `icloud-source` JEST MARTWY.**
> Vault ma trzy remote'y: `github-backup` (żywy, jedyny Twój),
> `origin` (**zakazany do pushu**, `Z1`) i `icloud-source`, wskazujący na
> nieistniejący katalog `/private/tmp/consultify-staging-deploy-e6ca`.
> **Dlatego NIE WOLNO Ci wołać `git fetch --all`.**
> **Błąd `icloud-source` przy jakimkolwiek fetchu NIE JEST negatywnym wynikiem
> markera i NIE JEST powodem do STOP-u.** Jedynym negatywnym wynikiem markera
> jest napis `MARKER BRAK` z komendy `merge-base` powyżej.

**★★ REGUŁA ROZEJŚCIA (`DEC-2026-08-26-95`).**
Jeżeli marker **nie jest** przodkiem tipa albo gałąź nie istnieje — **STOP
całego dyżuru**. Nie improwizujesz bazy: nie startujesz z `origin/demo`,
`main`, `Londyn`, `codex/preserve-*`, `codex/day*-instrukcja-*` ani z żadnej
gałęzi cudzych dyżurów.

Jeżeli marker **JEST** przodkiem, ale **tip uciekł do przodu — to NIE jest
STOP**. Startujesz **dokładnie z markera**, a do raportu wpisujesz:

```bash
git -C "$VAULT" log --oneline b305261454..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only b305261454..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day313-domkniecia2-bezpieczenstwo-odpowiedzi-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only b305261454..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `7` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: dlug wyciekow HTTP = 35 (table-platform 28, data-collection 7) wg DEFINICJI GUARDU,
#     ale szerszy grep daje inna liczbe. Mianownik ustalasz KOMENDA, nie przepisaniem.
npx vitest run tests/unit/backend/security/noRawErrorMessage.test.ts --retry=0 2>&1 | tail -12
git grep -nE "(error|message|details): \(?[a-zA-Z_]+( as Error)?\)?\.message" -- server/src/routes | wc -l
git grep -nE "(error|message|details): \(?[a-zA-Z_]+( as Error)?\)?\.message" -- server/src/routes | grep -v "logger\." | cut -d: -f1 | sort | uniq -c | sort -nr | head -6
#   moje liczby: guard 35 (28 + 7); szeroki grep 106 razem, 53 poza logger, z tego
#   table-platform 31 i data-collection 7. TRZY roznice, zaden nie jest bledem — to inne definicje.
#   ★ Odbior 296 §2 sam sobie przeczy arytmetycznie: pisze 55 razem, 48 logger, 35 realnych (55-48=7).
#   Zapisz SWOJ mianownik z komenda; on obowiazuje.

# (2) TEZA: mapper istnieje, ma 406 wolan w 71 plikach tras, i ZADNE nie przekazuje `req`
git grep -c "mapAppErrorResponse" -- server/src/routes | awk -F: '{s+=$2} END {print s" wywolan w "NR" plikach"}'
grep -rn ", undefined," server/src/routes | grep -c mapAppErrorResponse
git grep -nE "mapAppErrorResponse\([^,)]*, req" -- server/src/routes | wc -l
#   moje liczby: 406 wolan / 71 plikow; 335 z `, undefined,`; 0 przekazuje `req`.
#   ★ W programie kraza TRZY inne liczby tej rodziny: 305 (nadzorca), 341 (rejestr 296), 294 (odbiorca).
#   Zadna nie jest uzgodniona i zadnej NIE PRZEPISUJESZ.

# (3) TEZA: klasy domenowe nie dziedzicza AppError — cztery imienne i cala rodzina
for c in OkrCycleProgramNotActiveError FinanceSettingsCommandError TemplateNotFoundError CommandCapabilityDeniedError; do git grep -n "class $c extends" -- server/src | grep -v __tests__; done
git grep -n "extends Error" -- server/src | grep -v AppError | grep -v __tests__ | grep -v "\.test\.ts" | wc -l
git grep -h "export class [A-Za-z]*Error extends Error" -- server/src | grep -v __tests__ | sed -E "s/.*export class ([A-Za-z]+Error) extends Error.*/\1/" | sort -u | wc -l
#   moje liczby: cztery klasy potwierdzone (okrCycleCommands.ts:61, financeSettingsCommandService.ts:21,
#   deliverableTemplateService.ts:585, commandCapabilityGuard.ts:95); 267 linii `extends Error` poza testami;
#   255 UNIKALNYCH klas `*Error`, z czego 204 pada w `server/src/routes`.
#   ★ 255 klas to NIE jest zakres tego dyzuru — zakres ustalasz w R1 pomiarem osiagalnosci.

# (4) TEZA: trzy przyczyny 500 z zywego przelotu 04.09 — kazda innej rodziny
git grep -in "GROUP_CONCAT" -- server src scripts | grep -v __tests__
git grep -n "coverage_percent" -- server/migrations | wc -l
git grep -n "coverage_percent" -- server/src/database/DatabaseInitializer.ts | head -2
grep -n "GROUP_CONCAT\|string_agg" server/src/database/PostgresDatabase.ts | wc -l
#   moje liczby: 4 wywolania GROUP_CONCAT w server/src poza testami (+1 w server/scripts);
#   coverage_percent ZERO razy w migracjach, dwa razy w runtime DDL DatabaseInitializer.ts (1703, 1745);
#   adaptQuery() w PostgresDatabase.ts NIE zna GROUP_CONCAT (0 trafien) — tlumaczy tylko funkcje dat.

# (5) TEZA: pole `details` MA konsumenta na froncie — i pomiar tego latwo sfalszowac
git grep -nE "\.details\b" -- src | wc -l
git grep -nE "\.details" -- src | wc -l
grep -rn "\.details" src | grep -v "__tests__\|\.test\." | head -5
#   ★ PULAPKA ZMIERZONA PRZEZE MNIE 04.09: pierwsza komenda (z `\b`) zwraca 0, druga 125.
#   `\b` w `git grep -E` nie dziala i oddaje PUSTKE zamiast bledu. Pustka nie jest wynikiem.
#   Realny konsument: `src/utils/apiError.ts` (linie 73, 92, 110, 120, 145) sklada `details`
#   w komunikat uzytkownika przez `flattenValidationDetails`. Zmierz, co robi ze STRINGIEM.

# (6) TEZA: osiem tras oddalo 500 zwyklemu uzytkownikowi — pliki i linie do reprodukcji
grep -n "'/webhook-events'" server/src/routes/billing.routes.ts
grep -n "'/freshness/duplicates'" server/src/routes/knowledge-graph.routes.ts
grep -n "sources/upload_bundle'" server/src/routes/report-builder.routes.ts
grep -n "'/admin/service-accounts'\|'/admin/sso/" server/src/routes/table-platform.routes.ts | head -4
#   oczekiwane: billing.routes.ts:1355, knowledge-graph.routes.ts:359,
#   report-builder.routes.ts:1008, table-platform.routes.ts:4408/4430/4533/4557.
#   Przyczyny piatki bez zdiagnozowanej przyczyny MIERZYSZ SAM w R1 na wlasnym kontenerze.

# (7) TEZA: zasoby wolne
lsof -nP -iTCP:5304 -sTCP:LISTEN; lsof -nP -iTCP:5305 -sTCP:LISTEN; lsof -nP -iTCP:6323 -sTCP:LISTEN
docker ps --format "{{.Names}}" | grep -c cx-day313 || true
df -h /
#   oczekiwane: puste lsof, 0 kontenerow. ★ DYSK: moj pomiar 04.09 to 11 GiB dostepne —
#   powyzej progu 5 GB, ale ciasno. Ponizej 5 GB = STOP calosci (§0.5).
```

---

### §0.4a — pomiar zasięgu testów (warunek oddania raportu, patrz `Z24`)

Zanim ogłosisz jakikolwiek wynik testów, zmierz zasięg PEŁNYMI NAZWAMI, nie liczbami:

1. PRZED zmianami produktu: uruchom pakiet(y) testów wskazane w licencji z
   `--reporter=json` (albo zapisz listę `describe/it` z wyjścia) i zapisz do
   artefaktów plik `przed-nazwy.txt` — po jednej PEŁNEJ nazwie testu na wiersz.
2. PO zmianach: to samo do `po-nazwy.txt`.
3. Do raportu wchodzi: `diff przed-nazwy.txt po-nazwy.txt` — nazwy DODANE (twoje
   nowe testy) i nazwy ZNIKNIĘTE (każda zniknięta = wyjaśnienie albo STOP).
   `N passed` bez nazw NIE jest pomiarem. „Ta sama liczba" przy innym składzie
   nazw to fałszywa zieleń (Z37).
4. Przepisanie liczby z instrukcji, cudzego raportu albo rejestru = zawyżenie
   i podstawa odrzucenia raportu. Liczysz sam, u siebie, na swojej bazie.

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day313-domkniecia2-bezpieczenstwo-odpowiedzi-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6323`. Twój JEDYNY port harnessu to `5304 i 5305`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day313-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5458 oraz 6311-6322 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-312 (bazy 6290-6322, harness 5250-5303). Twoje własne: baza 6323, harness 5304 i 5305. ★ Mój pomiar 04.09 pokazał ŻYWE kontenery `cx-day296-pg` (6300), `cx-day292-pg` (6296), `cx-day293-pg` (6297), `cx-day282-pg` (6260), `cx307-scal-pg` (6322) — do żadnego z nich się nie łączysz, nawet do odczytu. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright`, `grafika-zrzuty` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i żadnej zmiany wartości domyślnej istniejącej. Mapper i naprawy tras działają zawsze. Jedyna zależność od środowiska, która ZOSTAJE bez zmian: pole `debug` w odpowiedzi mappera dokładane wyłącznie przy `NODE_ENV === 'development'` (`appErrorMapper.ts:109`) — masz to POKRYĆ testem (w `production` pola `debug` nie ma), a nie rozszerzać.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``tests/unit/backend/security/noRawErrorMessage.test.ts` (dziś 2/2 zielone z ratchetem 35 — sprowadzasz do zera, NIE osłabiasz) · `server/src/middleware/__tests__/appErrorMapper.test.ts` (dziś 5/5 — nie zepsuj) · `server/src/routes/__tests__/deliverableTemplates.provenance.test.ts` (kontrakt przeniesiony w odbiorze na `errorCode` + `correlationId`) · `server/src/routes/__tests__/presentations.error-disclosure.test.ts` · testy tras, które zmieniasz (`cd server && npx vitest run src/routes/__tests__/<plik>`) · nowe `.pg.test.ts` dla ośmiu tras · `scripts/check-list-canon.sh` i `scripts/check-artefakt.sh` (hooki; nie dotyczą, nie omijaj) · wszystkie przebiegi z `--retry=0``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY313_DOMKNIECIA2_BEZPIECZENSTWO_ODPOWIEDZI_REPORT.md`. Dozwolone nowe pliki dokumentacyjne: raport pod `SCIEZKA_RAPORTU` oraz `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_DOMKNIECIA2_20260904.md` (tabela 35 wycieków; tabela klas błędów domenowych z kolumną osiągalności; tabela ośmiu tras 500; sekcje „zmienione kody”, „kody do decyzji”, „front czyta details”). Dozwolona AKTUALIZACJA istniejącego wiersza `D14` w `docs/program/REJESTR_ZNALEZISK_20260903.md` — dopisujesz stan, nie kasujesz historii. Kod: `server/src/routes/table-platform.routes.ts`, `server/src/routes/data-collection.routes.ts`, cztery pliki klas domenowych z `TRASY_TYL`, `server/src/middleware/appErrorMapper.ts` (jeśli pomiar tego wymaga), `server/src/database/PostgresDatabase.ts` (WYŁĄCZNIE `adaptQuery()` i wyłącznie `GROUP_CONCAT` → `string_agg`, jeśli wybierzesz wariant centralny), pliki z wywołaniami `GROUP_CONCAT` z `TRASY_TYL`, pliki ośmiu tras 500, JEDNA nowa migracja addytywna w `server/migrations/`, `scripts/dev/codemod-error-mapper-req.mjs`, testy. Nowe pliki w `tests/` i `scripts/` wymagają `git add -f`. **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day313-domkniecia2-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz decyzji w kodzie. Uważasz, że decyzja się myli → **errata w raporcie** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego w tym dyżurze.** Żaden pomiar, strażnik ani ekran nie woła `llmService`, `/api/ai/**` ani `GoogleGenerativeAI` | `DEC-51` — zakaz atrapy AI; bezpieczeństwo nie ma prawa zależeć od sieci |
| `Z16` | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych, `503 not_configured`, `null`, `UNKNOWN` ani nagrobków `410`** | „Zero placebo i atrap"; uczciwy `503` jest wzorcem POPRAWNYM |
| `Z17` | **Zakaz wszystkiego poza zakresem tego dyżuru** — z imiennymi licencjami z tabeli licencji | Podział front/tył i rozłączność z dyżurami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej:** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdy `vitest.*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | Jedna zmiana globalnego mocka fałszuje wynik całego korpusu |
| `Z19` | **Nie odmontowujesz i nie kasujesz żadnego routera, middleware ani joba CI zamontowanego dziś** | Odmontowanie trasy potrafi zabić ekran, którego nie mierzysz; bramki znikają łatwiej, niż wracają |
| `Z20` | **★★ ZAKAZ uruchamiania testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, W TEJ SAMEJ LINII komendy.** Kolejność BLOKU 0 jest wiążąca: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar** | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`). Pełna ścieżka: realne wejście HTTP → realny `ApiGateway` → `verifyToken` → trasa → handler → zapytanie → **wiersz w Twojej bazie** → odczyt, który ten wiersz podnosi → konsument w `src/` **albo jawne zdanie „brak konsumenta"** | Istnienie kodu ≠ działanie |
| `Z22` | **★★ Test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). Dowodem jest `ApiGateway.getInstance().initializeRoutes(app)` | Replika rozjeżdża się z produkcją i nikt tego nie zauważa |
| `Z23` | **★★ ZERO ATRAP.** `200` z pustą kopertą tam, gdzie zapytanie padło, jest atrapą. `0` tam, gdzie wartość jest nieznana, jest atrapą. Ekran, który zapisuje do magazynu, którego nikt nie czyta, jest atrapą. Przycisk bez trasy jest atrapą | `DEC-2026-08-25-21/22`, `DEC-51` |
| `Z24` | **Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Zawężony wybór albo **przepisanie cudzej liczby** = zawyżenie i podstawa odrzucenia | Liczby autora instrukcji i nadzorcy krążą po dokumentach i utrwalają się jako „fakt" |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener.** `tests/setup.ts` ma bezpiecznik i rzuca błędem zamiast fallbacku | **Port `5432` NASŁUCHUJE i nie jest Twój** — fallback = zapis do cudzych danych |
| `Z26` | **★★ Komplet env w tej samej linii — patrz `§0.2c`.** Bez `MOCK_DB=false` odczyty idą cicho na atrapę bazy; bez `ENABLE_V8_GLOBAL=true` część tras daje `404` **przed uwierzytelnieniem**; bez `ENABLE_TEST_AUTH_BYPASS=false` `verifyToken` **jest omijany** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day313-domkniecia2-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | `vitest.config.ts` ustawia `retry: CI ? 3 : 1`. Przy otwartej dziurze pierwszy przebieg realnie zmienia stan, asercja pada, Vitest ponawia — i test **raportuje `PASS` mimo otwartej dziury**. Udowodnione na module Partner |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI E-MAILI, ZAPROSZEŃ KALENDARZOWYCH I POWIADOMIEŃ.** Przed pierwszym przebiegiem zapisującym **udowodnij w raporcie**, że dostawca poczty jest atrapą — protokół `§0.2b` | Wysłany e-mail i zaproszenie kalendarzowe są **nieodwracalne** i trafiają do skrzynek osób trzecich |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA TESTU REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**, w szczególności bez `expectedDatabase` | Dyżur 43 przypiął strażnik do swojej bazy: po usunięciu kontenera **30 przypadków dowodowych stało się trwałym `SKIP`**, pakiet raportuje `exit 0` i wygląda jak sukces |
| `Z32` | **★★ ZAKAZ WPISU `FIXED` / `VERIFIED` / `ZROBIONE_WG_DoD` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** Psujesz kod produkcyjny → test **CZERWONY**; cofasz → test **ZIELONY**; `git diff` po cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie. Mutację cofasz przez `cp` (`Z27`), nigdy `git stash` | Dyżur 44 wpisał `FIXED` dla podatności, **która nigdy nie istniała** — test przechodził także przed zmianą, bo asercja była tautologią |
| `Z33` | **★★ PRZED KAŻDYM POMIAREM SPRAWDZASZ, CZY STRAŻNIK, KTÓRY MIERZYSZ, NIE WYŁĄCZA SIĘ SAM W TRYBIE TESTOWYM** — ramka `§0.2d` | Na `resultsInternalBetaVisibility.middleware.ts` zmierzono **416 fałszywych twierdzeń** o uprawnieniach jednego modułu |
| `Z34` | **★★ GREP DOWODZI, ŻE ŁAŃCUCH ISTNIEJE, NIE ŻE DZIAŁA.** Zdanie „działa" wolno Ci napisać wyłącznie po realnym żądaniu HTTP przez realny `ApiGateway`, z podpisanym JWT, na realnym Postgresie po pełnych migracjach — **i po zapisaniu KODU ODPOWIEDZI** | 28.08 w module kalendarza zmierzono kompletny łańcuch komponent → `fetch` → trasa → handler → `INSERT`. **Każdy realny `POST` zwracał `500`**, bo `req.db` nigdy nie było ustawiane w tej gałęzi montażu |
| `Z34a` | **★★ PO PIERWSZYM COMMICIE ROBISZ PUSH NA `github-backup`**, a potem po każdej pozycji | 28.08 trzy dyżury pracowały cały dzień bez kopii zapasowej |
| `Z35` | **Zakaz „naprawiania" przez wyciszanie:** `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip`, `.todo`, poszerzanie `exclude`/`testIgnore`, obniżanie progów pokrycia, `--max-warnings`, `continue-on-error: true` na jobie testowym. Uznajesz to za jedyne wyjście → **STOP z uzasadnieniem**, nie cichy commit | To jest choroba, którą program leczy, a nie narzędzie do jej leczenia |
| `Z36` | **Zakaz `eslint --fix` i `prettier --write` na czymkolwiek szerszym niż plik, który i tak zmieniasz z innego powodu.** Zakaz `--fix` na katalogu, na `.`, na globie | Autofix dotknąłby tysięcy plików i skasował pracę **wszystkich** równoległych dyżurów |
| `Z37` | **Porównania testów po NAZWACH przypadków (`fullName`), NIGDY po liczbach.** „Było 300 PASS, jest 300 PASS" nie jest dowodem — jeden test mógł zgasnąć, a drugi się zapalić | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania i odmontowywania jakiegokolwiek joba CI.** Wolno dodać, wolno poprawić warunek. Usunięcie = STOP z rekomendacją | Bramki znikają łatwiej, niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** — `gh workflow run`, `gh run rerun`, `act` z realnymi sekretami, push wyzwalający CI na `main`/`develop`/`Londyn`/`demo`. Dowód robisz **statycznie** | Realny przebieg CI dotyka sekretów i środowisk poza Twoją kontrolą |
| `Z40` | ★★★ **ZAKAZ zmiany kodów HTTP** — z JEDNYM imiennym wyjątkiem: 500 → 400 dla nieprawidłowego identyfikatora wykrytego walidacją PRZED zapytaniem, i tylko dla tras, które wpiszesz imiennie do tabeli „zmienione kody” w raporcie (trasa · plik:linia · było · jest · dlaczego). Każda inna zmiana kodu, w tym „naprawa” 200 z polem `error`, jest zakazana i idzie do tabeli „kody do decyzji”. **ZAKAZ zmiany kształtu odpowiedzi poza polem błędu** — `error` zostaje bezpiecznym komunikatem, `errorCode` i `correlationId` dochodzą, reszta koperty bez zmian. **ZAKAZ zmian w `src/`** (front — dyżur 300, warunkowany scaleniem 296). **ZAKAZ ręcznej edycji więcej niż dziesięciu miejsc bez codemodu zapisanego w repo.** **ZAKAZ obniżania ratchetu bez naprawy** — `REMAINING_LEAK_BASELINE` wolno zmienić WYŁĄCZNIE w dół i wyłącznie razem z commitem, który usuwa policzone wycieki; podniesienie progu albo `toBeLessThanOrEqual` na większej liczbie = odrzucenie pozycji. **ZAKAZ dowodu mutacyjnego kopiującego własny wzorzec** — mutacja celuje w inny zapis wycieku niż ten, który naprawiłeś. **ZAKAZ osłabiania istniejących testów**: jeśli test żąda, żeby identyfikator zasobu wyciekł w treści błędu, przenosisz kontrakt na `errorCode` z cytatem tego dyżuru, a nie usuwasz asercji. **ZAKAZ dopisywania tabel do łańcucha migracji** — wolno dodać BRAKUJĄCĄ KOLUMNĘ migracją addytywną; brak całej tabeli to STOP MERYTORYCZNY. **ZAKAZ rozszerzania zakresu na rodzinę `DATETIME`** — ją prowadzi osobny dyżur (`SCHEMAT_DATETIME_RESZTA_20260903.md`). **ZAKAZ `git stash`, `pkill`, `killall`, `--no-verify`.** **ZAKAZ dotykania demo/stagingu/produkcji.** **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.** | Bramka wejściowa G20 wymaga zera otwartych P0/P1 i przelotu bezpieczeństwa. Dyżur 296 usunął 341 z 396 wystąpień i to jest realna praca — ale zdanie „wycieki naprawione” jest dziś nieprawdziwe w obie strony: w odpowiedziach HTTP siedzi 35 wycieków, a jednocześnie setki poprawnych komunikatów biznesowych zamieniono na angielski generyk, czyli naprawa bezpieczeństwa kupiła regresję produktu. Do tego żywy przelot 04.09 pokazał, że osiem tras w ogóle nie działa na bazie zmigrowanej od zera i trzy z nich oddają zwykłemu użytkownikowi surowy SQL ze ścieżką dyskową — czyli dokładnie ten kształt, który 296 miał zamknąć, tyle że wchodzący inną drogą. Bez tego dyżuru rejestr będzie niósł „scalone”, produkt będzie niósł wyciek, a właściciel dostanie angielski generyk zamiast komunikatu po polsku. |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ★ **UWAGA — SPROSTOWANIE 2026-08-30.** Ten szkielet wymieniał tu wcześniej
  przełącznik `ENABLE_LIVE_EMAIL`. **Taka flaga NIE ISTNIEJE w kodzie** — `grep`
  po całym `server/src` i `src` daje zero trafień. Był to fantom, powielany
  w każdej wydanej instrukcji. **Nie szukaj go i nie raportuj, że jest wyłączony.**
  Realny warunek wysyłki jest inny i opisany w punkcie (2) poniżej: poczta wychodzi
  wyłącznie wtedy, gdy `emailService.ts:202` zobaczy **jednocześnie** `smtpConfig.host`
  i `smtpConfig.auth.user`, sklejone **najpierw z tabeli `settings`**, dopiero potem
  ze zmiennych środowiskowych. Bez tych dwóch wartości serwis pisze na konsolę;
- ustawić `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM`
  w środowisku, w `.env*`, w `docker-compose*` ani nigdzie indziej;
- wstawić wiersza konfiguracji SMTP do tabeli ustawień w swojej bazie;
- uruchomić serwera pełnym `server/src/index.ts` **na potrzeby testów** — tam
  startują drenaże outboxów; testy montują `ApiGateway`, nie cały serwer
  (`Z22`);
- uruchomić `server/src/index.ts` na potrzeby zrzutów inaczej niż przez
  kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs` i bez spełnienia
  wszystkich warunków z punktu (4) poniżej;
- wywołać ręcznie żadnej funkcji `drain*` / `startNotificationOutboxDrainCron`
  / `outboxWorker`.

**(2) Trzy dowody, które wklejasz do raportu ZANIM uruchomisz cokolwiek
zapisującego:**

```bash
cd /private/tmp/cx-day313-domkniecia2

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day313-pg psql -U postgres -d cx313 \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy. Jezeli tabela `settings` nie istnieje — wklej TEN blad,
#   to tez jest dowod (nie ma skad wziac konfiguracji poczty).

# (c) dla TESTOW: zaden drenaz outboxu nie dziala w procesie testowym
grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
#   oczekiwane: 0 trafien — drenaze startuja w server/src/index.ts, ktorego NIE uruchamiasz
```

**(3) Deklaracja obowiązkowa dla TESTÓW w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane."**

**(4) Wyjątek wyłącznie dla ZRZUTÓW ODBIOROWYCH — pełny produkt, nie replika.**
Pełny `server/src/index.ts` wolno uruchomić wyłącznie przez kanoniczny
`scripts/dev/start-wave3-owner-runtime.mjs`, po wykonaniu dowodów (a) i (b),
oraz tylko gdy wszystkie poniższe warunki są spełnione imiennie:

- runtime pracuje wyłącznie na efemerycznej lokalnej bazie dyżuru pod
  `127.0.0.1`, na zasobach przydzielonych w instrukcji; nie wolno adoptować
  bazy zawierającej jakikolwiek klucz `smtp%`;
- środowisko procesu serwera pochodzi z `childEnv(...)`, ma
  `DOTENV_DISABLED='1'` i nie zawiera `SMTP_*`, `RESEND`, `SENDGRID` ani
  `MAIL*`; trzeba to potwierdzić dla uruchomionego procesu, nie tylko dla
  powłoki wywołującej;
- zapytanie z dowodu (b), wykonane po wszystkich migracjach i seedach, zwraca
  `0` wierszy bezpośrednio przed startem runtime'u;
- nie ustawiasz flag drenaży na `true`, nie wywołujesz żadnego drenażu ręcznie
  i nie wykonujesz żadnej operacji, która tworzy wiadomość, zaproszenie lub
  powiadomienie; runtime służy wyłącznie do odczytu i wykonania zrzutów;
- po starcie ponownie sprawdzasz środowisko należącego do Ciebie procesu oraz
  log serwera. Trafienie konfiguracji poczty, próby realnego transportu albo
  niejednoznaczność dowodu oznacza natychmiastowe zatrzymanie runtime'u i STOP
  całego dyżuru (`Z30`).

Brak konfiguracji nie wyłącza samych drenaży: w runtime z realną bazą startują
one domyślnie. Ochroną jest fail-closed protokół powyżej — `emailService`
tworzy realny transporter dopiero przy jednoczesnej obecności hosta i
użytkownika SMTP; bez nich pozostaje atrapą konsolową. Dowody (a) i (b)
obowiązują zatem zarówno testy, jak i zrzuty odbiorowe.

**Deklaracja obowiązkowa dla ZRZUTÓW ODBIOROWYCH w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane."**

**Ostrzeżenie wsteczne (`DEC-2026-08-29-314`):** dyżury `70`, `72`, `73`,
`76`, `81` i `85` uruchomiły kanoniczny runtime do zrzutów, przez co
sześciokrotnie naruszyły wcześniejsze bezwarunkowe brzmienie `§0.2b`. Do szkody
nie doszło, ponieważ niezależny protokół `Z30` wymagał wykazania, że dostawca
poczty jest atrapą. To ostrzeżenie nie znosi zakazu ani nie zastępuje dowodów.

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts`
przybija część wartości (`DB_TYPE='sqlite'`), więc komplet musi stać
**w tej samej linii komendy** — i masz **udowodnić, że nadpisał**, a nie założyć.

**(A) MIGRACJE — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /private/tmp/cx-day313-domkniecia2

docker run -d --name cx-day313-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx313 \
  -p 127.0.0.1:6323:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day313-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6323/cx313 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6323/cx313 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day313-domkniecia2 && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6323/cx313 \
JWT_SECRET=cx313-test-secret-do-not-reuse \
npx vitest run tests/unit/backend/security/noRawErrorMessage.test.ts server/src/middleware/__tests__/appErrorMapper.test.ts — to są DWIE ścieżki wariantu C, wklejane wprost do komendy powyżej. Testy tras uruchamiasz OSOBNO, z cwd `server/`: `cd server && npx vitest run src/routes/__tests__/<plik> --retry=0` (z roota `No test files found` = błąd komendy, NIE `PASS`). Testy `.pg.test.ts` wyłącznie wariantem B, z kompletem zmiennych w JEDNEJ linii i `DATABASE_URL` wskazującym 6323/cx313. Dowody mutacyjne OBOWIĄZKOWE dla czterech rzeczy: guardu wycieków (mutacja w INNYM zapisie niż naprawiany), dziedziczenia `AppError` (usuń `statusCode` z klasy → test czerwony), doboru języka (cofnij przekazanie `req` → komunikat wraca po angielsku), walidacji identyfikatora (usuń walidację → wraca 500 z surowym SQL). Dowód główny = tabela 35 → 0 z wyjściem guardu przed i po oraz przelot PRZED/PO ośmiu tras na kontenerze 6323 po pełnym łańcuchu migracji od zera --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day313-domkniecia2-artefakty/day313-domkniecia2.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day313-domkniecia2 && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit/backend/security/noRawErrorMessage.test.ts server/src/middleware/__tests__/appErrorMapper.test.ts — to są DWIE ścieżki wariantu C, wklejane wprost do komendy powyżej. Testy tras uruchamiasz OSOBNO, z cwd `server/`: `cd server && npx vitest run src/routes/__tests__/<plik> --retry=0` (z roota `No test files found` = błąd komendy, NIE `PASS`). Testy `.pg.test.ts` wyłącznie wariantem B, z kompletem zmiennych w JEDNEJ linii i `DATABASE_URL` wskazującym 6323/cx313. Dowody mutacyjne OBOWIĄZKOWE dla czterech rzeczy: guardu wycieków (mutacja w INNYM zapisie niż naprawiany), dziedziczenia `AppError` (usuń `statusCode` z klasy → test czerwony), doboru języka (cofnij przekazanie `req` → komunikat wraca po angielsku), walidacji identyfikatora (usuń walidację → wraca 500 z surowym SQL). Dowód główny = tabela 35 → 0 z wyjściem guardu przed i po oraz przelot PRZED/PO ośmiu tras na kontenerze 6323 po pełnym łańcuchu migracji od zera --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day313-domkniecia2-artefakty/day313-domkniecia2.json
```

**To NIE jest naruszenie `Z26`, tylko warunek `Z25`:** bez `DATABASE_URL`
`tests/setup.ts` rzuciłby błędem przy `RUN_DB_TESTS=1`.
**Nigdy nie mieszasz: pakiet jednostkowy NIE jest dowodem egzekucji.**

**Znaczenie każdej zmiennej — musisz je znać, zanim ją wpiszesz:**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | `tests/setup.ts` pomija testy bazodanowe; pakiet raportuje `exit 0` |
| `MOCK_DB=false` | odczyty idą **cicho** na atrapę bazy, zapisy nigdzie nie lądują |
| `DB_TYPE=postgres` | `vitest.config.ts` przybija `sqlite` — mierzysz inny silnik, niż myślisz |
| `NODE_ENV=test` | runner migracji odmawia albo zwraca MOCK przy bazie lokalnej |
| `ENABLE_V8_GLOBAL=true` | część tras daje **fałszywe `404` PRZED uwierzytelnieniem** |
| `ENABLE_TEST_AUTH_BYPASS=false` | **`verifyToken` JEST OMIJANY** — każdy test uwierzytelniania przechodzi z fałszywego powodu |
| `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` | strażnik przepuszcza wszystko przy `NODE_ENV=test` (416 fałszywych twierdzeń) |
| `DATABASE_URL` | fallback na `localhost:5432`, który **nasłuchuje i nie jest Twój** |
| `JWT_SECRET` | podpisany JWT nie przejdzie przez `verifyToken`; dostaniesz `401` z niewłaściwego powodu |
| `--retry=0` | test „atak odrzucony" **leczy się skutkiem własnego ataku** i raportuje `PASS` |

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE, KAŻDA KOSZTOWAŁA GODZINY

**Czytaj to, ZANIM uznasz cokolwiek za zepsute.**

1. **Vault jest BARE + `extensions.worktreeConfig=true`.** Po `git worktree add`
   **musisz** utworzyć `<vault>/worktrees/cx-day313-domkniecia2/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day313-pg psql -U postgres -d cx313 -c '…'`.
4. **Runner migracji wymaga `NODE_ENV=test` przy bazie lokalnej.** Bez tego
   strażnik localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
   (`server/scripts/migrate.postgres.ts:640-650`).
5. **`vitest.config.ts` (ok. `:209-210`) twardo ustawia `test.env.DB_TYPE='sqlite'`.**
   Zmienna z powłoki bywa nadpisywana — `DB_TYPE=postgres` musi stać
   **w tej samej linii komendy**, a Ty **udowadniasz w raporcie, że nadpisało**
   (asercja `expect(process.env.DB_TYPE).toBe('postgres')` w pierwszym `it`
   każdego nowego pakietu). Pliku **nie zmieniasz** (`Z18`).
6. **`JSON.parse` na kolumnie typu `json` działa na SQLite i wywala `500` na
   PostgreSQL** — sterownik `pg` zwraca już zdeserializowany obiekt. Jeżeli
   kolumny są `TEXT`, kształt `500` nie występuje, ale występuje kształt
   **cichej utraty danych**. Każdy `500` widoczny na PG a nie na SQLite sprawdź
   najpierw pod tym kątem (`DEC-2026-08-28-245`).
7. **CI NIE URUCHAMIA TESTÓW dla naszych gałęzi.** Joby `test-suite.yml` są
   warunkowane na `main`/`develop`, a my jesteśmy na `Londyn`/`demo`;
   `lint-typecheck` pada na zastanych błędach `tsc`, a `pr-gate` czyta wynik
   pominiętego joba jako sukces (`DEC-2026-08-28-246`). **„CI zielone" nie jest
   w tym repo żadnym dowodem.** Dowodem jest wyłącznie Twój przebieg z `--retry=0`.
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day313-pg`.
9. **Reporter `basic` NIE ISTNIEJE w tej wersji vitest** (`--reporter=basic` →
   `Failed to load custom Reporter from basic`). Do porównania nazw używasz
   `--reporter=json --outputFile=<plik poza repo>`.
10. **`npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów** przy
    przekierowaniu wyjścia. **Nie ufaj kodowi wyjścia** — liczby i nazwy czytasz
    z JSON-a.
11. **Nowe pliki w `tests/` wymagają `git add -f`** (katalog bywa ignorowany
    częściowo). Sprawdzasz `git status --short` po każdym commicie.
12. **`| head` na grepie sierot produkuje FAŁSZYWE SIEROTY.** Werdykt „martwy
    komponent" wymaga grepu **bez obcięcia**, z wykluczeniem `__tests__`
    i komentarzy.
13. **ESM nie honoruje `NODE_PATH`.** Skrypt `.mjs` uruchamiany spoza repo nie
    znajdzie pakietów — rozwiązuj je przez `createRequire(REPO + '/package.json')`.
14. **Na remote `github-backup` NIE MA gałęzi `main`, `develop`, `Londyn` ani
    `demo`** — są na `origin` (`origin/develop` **stoi od 2026-06-02**).
    Pracujemy na linii `Londyn`/`demo`.
15. **`postgres:15` NIE PRZECHODZI migracji** — brak rozszerzenia `vector`.
    Obraz obowiązkowy: `pgvector/pgvector:pg16`.
16. **`prettier` na wielkich plikach potrafi przepisać cały plik.** W repo
    **nie ma** skryptu `format` — wołasz `npx prettier --write <pliki>` wprost.
    Jeżeli wynik reformatu przekracza ~3× liczbę Twoich linii merytorycznych —
    **cofasz reformat** (`cp` z kopii wg `Z27`, nigdy `git stash`), zostawiasz
    styl zastany i wpisujesz to do raportu.
17. **Istnieją testy tekstowe przez `readFileSync` + `toContain`,** które
    asertują **dosłowne linie kodu**. Reformat takiej linii wywala test.
    Jeżeli test zapali się od Twojego reformatu — **to jest regresja Twojego
    reformatu, nie „test do poprawienia"**: cofasz reformat.
18. **`npx vitest` z roota bez właściwego configu daje `No test files found`.**
    To **nie jest `PASS`** — to jest brak pomiaru.

---

> **★★ RAMKA DO `Z33` — PUŁAPKI, KTÓRE FAŁSZUJĄ ZIELONY PRZEBIEG.**
> **Zielona suita w tym repozytorium NIE JEST DOWODEM, dopóki nie wiesz, którą
> pułapkę omija.**
>
> **(a) `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404` PRZED uwierzytelnieniem.**
> `server/src/middleware/v8FeatureGate.middleware.ts:15` czyta
> `process.env.ENABLE_V8_GLOBAL === 'true'`; przy braku zmiennej bramka odcina
> trasę **zanim** cokolwiek sprawdzi tożsamość. Twój test „obcy tenant dostaje
> `404`" przechodzi wtedy z całkiem innego powodu, niż myślisz.
>
> **(b) `resultsInternalBetaVisibility.middleware.ts` przepuszcza wszystko przy
> `NODE_ENV=test`,** dopóki nie ustawisz
> `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. **Na tym strażniku
> zmierzono 416 fałszywych twierdzeń o uprawnieniach.**
>
> **(c) `vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.** Część
> „testów bazodanowych" idzie na atrapę. `MOCK_DB=false DB_TYPE=postgres`
> w tej samej linii to jedyne wyjście; pliku nie zmieniasz (`Z18`).
>
> **(d) `ENABLE_TEST_AUTH_BYPASS`.** `server/src/middleware/auth.middleware.ts`
> zawiera gałąź: `if (NODE_ENV === 'test' && ENABLE_TEST_AUTH_BYPASS === 'true')`
> — czyli **`verifyToken` potrafi wyłączyć się sam w trybie testowym**.
>
> **(e) ★★★ DZIEWIĘĆ PUŁAPEK. **(1) Mianownik komendą, nie liczbą.** W programie krążą TRZY liczby tej samej rodziny — 305 (nadzorca), 341 (rejestr dyżuru 296), 294 (odbiorca) — i żadna nie jest uzgodniona. Co gorsza, sam odbiór 296 §2 przeczy sobie arytmetycznie (55 razem, 48 logger, „35 realnych”; 55 − 48 = 7). Zaczynasz od USTALENIA WŁASNEGO mianownika komendą i pracujesz na nim; przepisanie cudzej liczby to zawyżenie (`Z24`). **(2) Bezpiecznik zbudowany pod własną naprawę.** Pierwotny guard 312 używał DOSŁOWNIE tego samego regexu co codemod, więc nie mógł złapać niczego, czego codemod nie umiał naprawić — przepuszczał wariant, w którym siedzą wszystkie 35 wycieków. Twój dowód mutacyjny MUSI celować w ZAPIS INNY niż ten, który naprawiasz (np. `res.json({ error: String(e) })`, `res.send(err.stack)`, `details: e?.message`), a nie w kopię własnego wzorca. **(3) `\b` w `git grep -E` oddaje PUSTKĘ.** Zmierzone 04.09: `\.details\b` → 0 trafień, `\.details` → 125. Pustka nie jest wynikiem, dopóki nie sprawdzisz drugą komendą, że polecenie w ogóle mierzy. To samo dotyczy `grep --include` w `zsh`. **(4) Log MA prawo do surowej treści.** Wyciek liczy się WYŁĄCZNIE w odpowiedzi HTTP. Codemod 296 wstawił mapper do pięciu wywołań `logger.error` w SCIM i zabrał logowi treść, a mapper i tak loguje sam — podwójny wpis na każdy błąd. Nie powtórz tego. **(5) `res.status(200).json({error})` istnieje i NIE zmieniasz kodu.** Trasy oddające 200 z polem `error` idą do tabeli „kody do decyzji”, nie pod nóż. **(6) Klasa domenowa bez `AppError` to nie jest błąd „obcy”.** Mapper przepuszcza komunikat tylko dla `AppError` z `isOperational`; klasa `extends Error` z poprawnym komunikatem biznesowym wygląda dla mappera jak awaria bazy. Ale 255 unikalnych klas `*Error` (204 wymienionych w trasach) to NIE jest zakres jednego dyżuru — zakres wyznaczasz OSIĄGALNOŚCIĄ, a resztę spinasz ratchetem, tak jak odbiór spiął 35. **(7) Dowód 500 wymaga bazy zmigrowanej OD ZERA.** `tests/setup.ts:858-896` podmienia `global.fetch` na `ok:true`, `NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia atrapę bazy pod `DbPromise`, a `Database.ts:686` zwraca `changes:1` dla każdego `UPDATE`. Trzy z ośmiu tras padają WYŁĄCZNIE dlatego, że baza jest świeża — na cudzej, zastanej bazie z rekordami zobaczysz zieleń i uznasz temat za nieistniejący. **(8) `group_concat` to rodzina, nie jedno miejsce.** Mój pomiar: cztery wywołania w `server/src` poza testami (i piąte w `server/scripts`). Naprawa jednego wywołania odrasta — rozstrzygnij pomiarem, czy tłumaczysz centralnie w `adaptQuery()` (i wtedy test per KSZTAŁT wywołania: goły, z separatorem, z `DISTINCT`), czy per wywołanie plus bezpiecznik blokujący nowe. **(9) Brakująca kolumna: sprawdź, czego dokładnie brakuje.** `imported_reports` JEST w `server/migrations/507_imported_reports.sql`, brakuje samej kolumny `coverage_percent`, która żyje tylko w runtime DDL `DatabaseInitializer.ts`. Migracja addytywna jest wtedy naprawą właściwą. Gdyby jednak zabrakło CAŁEJ tabeli — to jest inne, większe znalezisko i wpisujesz je jako STOP MERYTORYCZNY, a nie dopisujesz tabeli w tym dyżurze.**
>
> **Obowiązek dowodowy.** Dla **każdego** pakietu uruchomionego jako dowód
> czegokolwiek raport zawiera akapit: *która z pułapek (a)–(e) dotyczy tego
> pakietu, jak ją wyłączyłem, i co konkretnie dowodzi, że wyłączyłem*.
> Akapit „nie dotyczy" jest dopuszczalny **tylko** z komendą pokazującą, że dany
> strażnik nie leży na ścieżce. **Pomiar bez tego akapitu nie liczy się jako dowód.**

---

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości MERYTORYCZNEJ: STOP tej POZYCJI i wpis
w raporcie — nigdy improwizacja. W tym programie zasadny STOP jest NAGRADZANY,
a zgadywanie karane** (dzień 23 dostał `SUPERVISOR_ACCEPT` za STOP,
`DEC-2026-08-26-130`).

**Rozróżnij dwa rodzaje:**

- **STOP MERYTORYCZNY** (mile widziany): zmierzyłeś i wyszło inaczej, niż mówi
  ta instrukcja; brakuje informacji, której nikt poza właścicielem nie
  dostarczy; naprawa wymaga decyzji produktowej. **Wpisujesz do raportu
  i IDZIESZ DALEJ do następnej pozycji.**
- **STOP PROCEDURALNY** (zakazany): „instrukcja jest sprzeczna", „ścieżka nie
  istnieje", „nie mam licencji na plik". **Ten rodzaj NIE zatrzymuje niczego** —
  patrz tabela niżej i sekcja końcowa.

### ★★ TABELA: STOP PROCEDURALNY ZAKAZANY — DZIAŁANIE ZASTĘPCZE

| Powód, dla którego chciałbyś stanąć | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy (`auth.middleware.ts` / `Gateway.ts` / bramkę platformową)" | **Czerwony kontrakt testowy + brief wynikowy** (tabela licencji, wiersz 1). Pozycja jest wtedy **ZROBIONA**, nie STOP |
| „Plik, którego potrzebuję, nie jest w tabeli licencji" | Traktujesz go jako **tylko do odczytu** i dajesz czerwony kontrakt + brief. Pozycja **ZROBIONA** |
| „Instrukcja jest wewnętrznie sprzeczna" | Sekcja **„JEŚLI COŚ JEST SPRZECZNE"** na końcu dokumentu. Wybierasz interpretację **bezpieczniejszą**, opisujesz w „Korektach", **kontynuujesz pozostałe pozycje** |
| „Ścieżka podana w instrukcji nie istnieje" | Sprawdzasz `ls`, wpisujesz **swój wynik** do „Korekt", szukasz realnego odpowiednika i **idziesz dalej**. Rozbieżność pomiaru z instrukcją **nie jest sprzecznością — jest WYNIKIEM** |
| „Instrukcja podaje dwie różne liczby" | Mierzysz sam, podajesz **swoją** liczbę z komendą (`Z24`). To **nie jest** powód do STOP-u |
| „`git fetch` zwrócił błąd `icloud-source`" | To **nie jest** błąd. `§0.2d` pkt 2. Idziesz dalej |
| „`psql` nie istnieje na hoście" | `docker exec cx-day313-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day313-domkniecia2-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`**R1 (pomiar — rdzeń)**: własny mianownik trzema komendami i tabela 35 wycieków (plik · linia · wariant `(e as Error)` / `details` · co konkretnie może wyciec: SQL, ścieżka, URL, klucz, stos, nic); pełna lista klas `extends Error` bez `AppError` (`git grep -n "extends Error" -- server/src | grep -v AppError`) z kolumną „czy osiągalna z trasy wołającej mapper”; osiem tras 500 z przyczyną zmierzoną na WŁASNYM kontenerze 6323 po pełnym łańcuchu migracji od zera (kod, ciało, czy ciało niesie SQL/stos/ścieżkę); kto na froncie czyta `details` i `error`. Commit po R1. · **R2 (35 → 0 — rdzeń)**: 28 + 7 miejsc przez mapper, `details` rozstrzygnięte pomiarem z R1, logi nietknięte; ratchet guardu 35 → 0 i test negatywny mutacją celującą w INNY zapis wycieku niż naprawiany. Commit po R2. · **R3 (klasy domenowe — rdzeń)**: cztery klasy imienne z odbioru (`OkrCycleProgramNotActiveError`, `FinanceSettingsCommandError`, `TemplateNotFoundError`, `CommandCapabilityDeniedError`) dziedziczą `AppError` z `isOperational` i `statusCode`, komunikat biznesowy przechodzi, `errorCode` zgodny ze statusem (dowód: `TemplateNotFoundError` → HTTP 404 ORAZ `errorCode` niebędący `INTERNAL`); test per klasa; reszta zmierzonej rodziny wpisana do tabeli i spięta ratchetem z jawną liczbą. Commit po R3. · **R4 (`req` do mappera — rdzeń)**: codemod nr 2 w repo (`scripts/dev/codemod-error-mapper-req.mjs`), zastosowany grupami po 10 plików z commitem per grupa i esbuildem każdego pliku, wyłącznie tam, gdzie `req` jest w zasięgu; test: żądanie z `Accept-Language: pl` dostaje komunikat po polsku, bez nagłówka — po angielsku; miejsca bez `req` w zasięgu wypisane z plik:linia. Commit per grupa. · **R5 (osiem tras 500 — rdzeń)**: `group_concat` → `string_agg` (rozstrzygnięcie centralnie w `adaptQuery()` albo per wywołanie — z uzasadnieniem pomiarowym i testem per kształt wywołania), brakująca kolumna → migracja addytywna idempotentna (dwa przebiegi łańcucha od zera bez różnicy), nieprawidłowy identyfikator → 400 przed zapytaniem; test `.pg.test.ts` per trasa na kontenerze 6323, przelot PRZED/PO dla ośmiu tras z kodem i ciałem. Commit po R5. · **R6 (raport)**: tabela 35 → 0, tabela klas (przerobione / w ratchecie), tabela ośmiu tras (było 500 → jest X, przyczyna, naprawa), tabela „zmienione kody” i „kody do decyzji”, wyjście guardu przed i po, dowody mutacyjne dosłownie, TWIERDZENIA NIEZWERYFIKOWANE; wiersz `D14` w `docs/program/REJESTR_ZNALEZISK_20260903.md` zaktualizowany o stan faktyczny.`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6323` albo `5304 i 5305` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6323` albo `5304 i 5305`** (`Z7`).

Format wpisu STOP:

```
### STOP — <pozycja>
Rodzaj: MERYTORYCZNY / PROCEDURALNY
Powód: <jedno zdanie>
Licencja, którą sprawdziłem: <cytat wiersza z tabeli licencji + wynik>
Dowód: <plik:linia albo komenda + wynik>
Co dostarczyłem ZAMIAST zmiany: <czerwony kontrakt / pomiar / gotowy diff / brief>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Rekomendacja dla nadzorcy: <co zmienić, gdzie, jaki promień rażenia>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
Czy kontynuowałem pozostałe pozycje: TAK / NIE + dlaczego
```

**★★ STOP bez wypełnionego pola „Licencja, którą sprawdziłem" jest NIEZASADNY
z definicji. STOP bez wypełnionego pola „Co dostarczyłem ZAMIAST zmiany" jest
NIEZASADNY z definicji.**

---

## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć
błędy. Nie zatrzymuj przez nie dyżuru.**

**Procedura, dosłownie:**

1. **Opisz sprzeczność w raporcie**, w sekcji „Korekty wobec instrukcji":
   **cytat obu wykluczających się zdań z numerami paragrafów**, na czym polega
   konflikt, jaki masz dowód i co zrobiłeś.
2. **Wybierz interpretację BEZPIECZNIEJSZĄ.** Reguły rozstrzygające,
   w tej kolejności:
   - **nie ruszaj cudzego pliku** — gdy nie wiesz, czy masz licencję, **nie
     masz**; traktuj plik jako tylko do odczytu i dostarcz czerwony kontrakt
     + brief;
   - **nie osłabiaj asercji** — gdy test przeszkadza, opisujesz go, nie
     zmieniasz;
   - **nie kasuj** — gdy werdykt jest niepewny, wpisz `DO DECYZJI WŁAŚCICIELA`
     ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć
     samodzielnie"** (wiersz bez tego zdania liczy się jako nierozstrzygnięty);
   - **nie włączaj** — gdy nie wiesz, czy flaga ma być `ON`, zostaje `OFF`
     (`Z10`/`Z11`);
   - **nie wysyłaj niczego na zewnątrz** — gdy nie masz pewności co do `Z30`,
     nie klikasz;
   - **nie poszerzaj dostępu** — gdy bramka jest niejednoznaczna, **odmawiasz
     zamiast przepuszczać**;
   - **mierz zamiast zgadywać** — gdy instrukcja podaje liczbę, a Twój pomiar
     daje inną, **wiążący jest Twój pomiar z komendą** (`Z24`).
3. **KONTYNUUJESZ POZOSTAŁE POZYCJE.** Sprzeczność w jednym paragrafie nie
   zwalnia z pozostałych ani z raportu.
4. **Zatrzymanie CAŁEGO dyżuru** — wyłącznie z pięciu powodów wymienionych
   w `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
   Sprzeczność w dokumencie rozwiązuje się **wpisem w raporcie**, nie zmianą
   w produkcie.
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.** Każda liczba, linia i teza w tym dokumencie to **rozkaz
   pomiarowy**, nie prawda objawiona.

**★ Trzy najcenniejsze rzeczy, jakie możesz oddać:** dowód, że coś, co uchodziło
za działające, nie działa; dowód, że coś, co uchodziło za zepsute, jest sprawne;
i uczciwe zdanie „tego nie zmierzyłem, bo…".

**★ Ostatnie zdanie tej instrukcji i najważniejsze: obalenie którejkolwiek tezy
z sekcji „TEZY ZLECENIA…" jest SUKCESEM dyżuru, a nie porażką. Zapisz to
w „Korektach wobec instrukcji" z dowodem i idź dalej.**

---


## Po co ten dyżur istnieje

Dyżur 296 zamknął jedną gałąź rodziny wycieków i zameldowałby zero, gdyby odbiór nie zmierzył
szerzej. W odpowiedziach HTTP siedzi dziś 35 wycieków, których ani codemod, ani pierwotny
bezpiecznik nie widziały — bo bezpiecznik używał tego samego wzorca co naprawa. Przy okazji
naprawa bezpieczeństwa kupiła regresję produktu: klasy błędów domenowych nie dziedziczą
`AppError`, więc komunikat biznesowy zamienia się w angielski generyk, a `req` przekazany jako
`undefined` w każdym wywołaniu wyłączył polski słownik mappera. Niezależnie od tego żywy przelot
04.09 na bazie zmigrowanej od zera pokazał osiem tras oddających 500 zwykłemu zalogowanemu
użytkownikowi, a trzy z nich oddały surowy SQL ze stosem i ścieżką dyskową. To jest dokładnie ten
kształt, który 296 miał zamknąć — wchodzący inną drogą.

## ★ Zmierz moje liczby sam

Twierdzę: ratchet guardu stoi na 35 (28 w `table-platform.routes.ts`, 7 w
`data-collection.routes.ts`); mapper ma 406 wywołań w 71 plikach tras i ani jedno nie przekazuje
`req` (335 z nich pisze wprost `, undefined,`); klas `*Error` bez `AppError` jest 255 unikalnych,
z czego 204 pada w `server/src/routes`; `coverage_percent` nie występuje w łańcuchu migracji ani
razu, a w runtime DDL dwa razy; `GROUP_CONCAT` ma cztery wywołania w `server/src` poza testami;
`adaptQuery()` nie zna `GROUP_CONCAT`. Komendy z §0.3 to sprawdzają.

**Jeśli Twój pomiar przeczy mojej liczbie, obowiązuje Twój — i to jest sukces dyżuru, nie kłopot.**

Trzy ostrzeżenia do samego mierzenia. Po pierwsze: w programie krążą trzy różne mianowniki tej
rodziny (305, 341, 294) i żaden nie jest uzgodniony; sam odbiór 296 przeczy sobie arytmetycznie
w §2. Po drugie: `\b` w `git grep -E` oddaje pustkę zamiast błędu — sprawdziłem to na własnej
skórze 04.09 na polu `details`. Po trzecie: pustka nie jest wynikiem, dopóki nie potwierdzisz
drugą komendą, że polecenie w ogóle mierzy.

## R1 — POMIAR (rdzeń)

Cztery tabele i jedna lista.

Tabela A — 35 wycieków: plik · linia · wariant (`(e as Error)` czy pole `details`) · co konkretnie
może wyciec (SQL, ścieżka dyskowa, URL, klucz, stos, nic) · czy to odpowiedź HTTP czy log.

Tabela B — klasy błędów domenowych: nazwa · plik:linia · czy dziedziczy `AppError` · czy niesie
`statusCode` i `code` · czy jest osiągalna z trasy wołającej mapper (kolumna rozstrzygająca zakres
`R3`; osiągalność mierzysz, nie zgadujesz).

Tabela C — osiem tras 500 z żywego przelotu odbiorcy: trasa · plik:linia · kod, jaki dostałeś na
WŁASNYM kontenerze po pełnym łańcuchu migracji od zera · czy ciało niesie SQL, stos albo ścieżkę ·
przyczyna. Trzy przyczyny są już nazwane (nieprawidłowy identyfikator, dialekt SQLite na
Postgresie, brakująca kolumna); pięć pozostałych mierzysz sam.

Tabela D — kody do decyzji: trasy oddające 200 z polem błędu. Wypisujesz, nie ruszasz.

Lista — kto na froncie czyta `details` i `error`, z rozstrzygnięciem, co `flattenValidationDetails`
w `src/utils/apiError.ts` robi ze stringiem. Od tego zależy kształt naprawy 28 miejsc.

Commit po `R1`.

## R2 — 35 DO ZERA (rdzeń)

Dwa pliki, 35 miejsc, mapper. Logi zostają nietknięte — surowa treść w logu to nie wyciek, tylko
obowiązek. Ratchet `REMAINING_LEAK_BASELINE` schodzi z 35 na 0 tym samym commitem, który usuwa
policzone wycieki.

Dowód mutacyjny ma warunek dodatkowy: mutacja celuje w ZAPIS INNY niż ten, który naprawiłeś.
Bezpiecznik odbijający zakres własnej naprawy przeszedł już raz i przepuścił wszystkie 35 —
drugi raz nie przejdzie. Trzy mutacje, każda innym kształtem, wyjście dosłownie w raporcie.

Commit po `R2`.

## R3 — KLASY DOMENOWE (rdzeń)

Cztery klasy imienne dziedziczą `AppError` z `isOperational` i własnym `statusCode`, więc komunikat
biznesowy przechodzi do klienta, a `errorCode` przestaje kłamać. Dowodem jest para: HTTP 404 ORAZ
`errorCode` inny niż `INTERNAL` dla `TemplateNotFoundError`. Test per klasa.

Reszta zmierzonej rodziny idzie do tabeli i pod ratchet z jawną liczbą. **Nie przerabiasz 255 klas
w jednym dyżurze** — uczciwa granica jest wynikiem, udawana kompletność nie jest warta nic.

Commit po `R3`.

## R4 — `req` DO MAPPERA (rdzeń)

Codemod nr 2 w repo, grupami po dziesięć plików, esbuild każdego pliku, commit per grupa, wyłącznie
tam, gdzie `req` jest w zasięgu. Miejsca bez `req` w zasięgu wypisujesz z plik:linia — to jest
wynik, nie porażka.

Test: żądanie z nagłówkiem języka polskiego dostaje komunikat po polsku, bez nagłówka — po
angielsku. Mutacja: cofnij przekazanie `req` w jednym miejscu, komunikat wraca po angielsku.

Commit per grupa.

## R5 — OSIEM TRAS 500 (rdzeń)

Kontener 6323, pełny łańcuch migracji od zera, dwa przebiegi (drugi bez zmian — idempotencja).
Trzy rodziny napraw i ani jednej poza nimi: dialekt SQLite na Postgresie, brakująca kolumna
w łańcuchu migracji, brak walidacji identyfikatora przed zapytaniem.

Przy pierwszej rodzinie rozstrzygasz pomiarem, czy tłumaczysz centralnie w `adaptQuery()`, czy per
wywołanie — i jeśli centralnie, masz test na każdy kształt wywołania, jaki znalazłeś w `R1`
(goły, z separatorem, z `DISTINCT`). Naprawa jednego wywołania z rodziny odrasta.

Przy drugiej rodzinie sprawdzasz, czego dokładnie brakuje. Brak kolumny w istniejącej tabeli
naprawia migracja addytywna. Brak całej tabeli to STOP merytoryczny i wpis, nie improwizacja.

Przy trzeciej rodzinie i tylko przy niej wolno zmienić kod z 500 na 400 — imiennie, z wierszem
w tabeli zmienionych kodów.

Test `.pg.test.ts` per trasa. Przelot PRZED/PO dla wszystkich ośmiu, z kodem i ciałem.

Commit po `R5`.

## R6 — RAPORT

Tabela 35 do zera z wyjściem guardu przed i po. Tabela klas: przerobione i te w ratchecie. Tabela
ośmiu tras: było, jest, przyczyna, naprawa. Tabela zmienionych kodów i tabela kodów do decyzji.
Dowody mutacyjne dosłownie, wszystkie cztery. Sekcja TWIERDZENIA NIEZWERYFIKOWANE. Wiersz `D14`
w rejestrze znalezisk zaktualizowany o stan faktyczny — dopisany, nie nadpisany.

## Prawo zatrzymania

Zatrzymujesz się PO KAŻDEJ pozycji `R`, z commitem i pushem. Zdanie „R1 i R2 wykonane, ratchet
zszedł z 35 na 0, R3 objął cztery klasy imienne, pozostałe 200 spięte ratchetem, R5 naprawił trzy
z ośmiu tras, pięć opisanych z przyczyną” jest pełnowartościowym wynikiem.

Zdanie „wycieki zamknięte” postawione na bezpieczniku, który nie umie ich zobaczyć, nie jest warte
nic — i dokładnie to już raz przeszło.
