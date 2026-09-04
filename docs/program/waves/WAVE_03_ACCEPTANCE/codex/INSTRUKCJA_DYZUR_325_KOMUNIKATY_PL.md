# INSTRUKCJA DYŻURU nr 325 — Codex — „Komunikaty biznesowe po polsku — JEDNO zrodlo prawdy zamiast latania dwoch stron osobno: odbior realnymi zadaniami HTTP wykazal, ze uzytkownik z polskim jezykiem dostaje angielski komunikat (dwa z czterech kodow zlokalizowanych przez dyzur 321 sa strukturalnie nieosiagalne, bo mapper wolany bez `req` nie ma skad wziac jezyka), a front sprowadza kazdy kod spoza siedmiu kanonicznych do `INTERNAL` — przez co 403 „brak uprawnien" pokazuje sie uzytkownikowi jako AWARIA SYSTEMU"

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
> **wyłącznie** `/private/tmp/cx-day325-komunikaty-pl`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `1c3d3da844ae03c87985a8f5dc74846a073c0220`**
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
Zakres: **KOMUNIKATY BLEDOW — pelna sciezka od `AppError` w serwisie, przez mapper i naglowek jezyka, po tekst, ktory uzytkownik czyta na ekranie. Rdzen: uzgodnienie i wykonanie JEDNEGO zrodla prawdy komunikatu (serwer albo front), a nie latanie obu stron osobno**.
Trasy front: ``src/services/errors/appErrorCopy.ts` (RDZEN frontu — `readAppErrorCode` ok. 92-97 sprowadza kazdy kod spoza siedmiu do `INTERNAL`), `src/services/errors/__tests__/appErrorCopy.test.ts`, `src/services/api.ts` (ok. 792-795 naglowki `Accept-Language` + `X-App-Language`; ok. 1128 `createApiError(data, defaultError, res.status)`), `public/locales/{pl,en}/translation.json` (galaz `errors.app.*`)`. Trasy tył: ``server/src/middleware/appErrorMapper.ts` (RDZEN tylu — `MESSAGES` 7 kodow, `OPERATIONAL_MESSAGES` 4 kody, wybor jezyka z `req?.get?.('Accept-Language')`), `server/src/utils/ErrorHandler.ts` (konstruktor `AppError` ok. 34: `isOperational = true` ZAWSZE), `server/src/routes/resultsVnext/okr.routes.ts` (ok. 369, `handleOkrRouteError`), `server/src/routes/resultsVnext/kpiScorecard.routes.ts` (ok. 213/217/221/229/233), `server/src/routes/demo.routes.ts` ok. 52 i `server/src/routes/auth.routes.ts` ok. 1352 — TYLKO ODCZYT, jako WZORZEC poprawnego odczytu jezyka, `server/src/index.ts` ok. 1135-1136 (naglowek `X-App-Language` jest w liscie dozwolonych CORS)`.

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
WT=/private/tmp/cx-day325-komunikaty-pl
MARKER=1c3d3da844ae03c87985a8f5dc74846a073c0220

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day325-komunikaty-pl-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day325-komunikaty-pl/config.worktree"
cat "$VAULT/worktrees/cx-day325-komunikaty-pl/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day325-komunikaty-pl-scratch
mkdir -p /private/tmp/cx-day325-komunikaty-pl-artefakty

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
git -C "$VAULT" log --oneline 1c3d3da844ae03c87985a8f5dc74846a073c0220..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day325-komunikaty-pl-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day325-komunikaty-pl

# ★ WSZYSTKIE grepy uruchamiasz w BASHU (`bash -lc '...'` albo skrypt `.sh`).
#   W `zsh` `grep --include=*.ts` zwraca `no matches found` ZAMIAST wynikow.

# (1) TEZA: mapper wybiera jezyk WYLACZNIE z `Accept-Language` i tylko gdy dostal `req`
grep -n "Accept-Language" server/src/middleware/appErrorMapper.ts
grep -n "OPERATIONAL_MESSAGES\|const MESSAGES" server/src/middleware/appErrorMapper.ts
#   oczekiwane: jedno trafienie `Accept-Language`; `MESSAGES` ma 7 kodow, `OPERATIONAL_MESSAGES` 4

# (2) ★ TEZA GLOWNA: czesc wywolan mappera przekazuje `undefined` zamiast `req`
grep -rn "mapAppErrorResponse(" server/src --include="*.ts" | wc -l
grep -rnE "mapAppErrorResponse\([^,)]*, *undefined" server/src --include="*.ts" | wc -l
#   oczekiwane (MOJA liczba, zmierz swoja): 378 wywolan lacznie, 106 z `undefined`.
#   Zlecenie mowilo 115 z 370 — jesli Twoj pomiar da jeszcze inna liczbe, obowiazuje TWOJ.

# (3) TEZA: dwie wskazane trasy wolaja mapper bez `req`
sed -n '366,372p' server/src/routes/resultsVnext/okr.routes.ts
grep -n "mapAppErrorResponse(err, undefined" server/src/routes/resultsVnext/kpiScorecard.routes.ts
#   oczekiwane: okr ok. 369 (`handleOkrRouteError`, galaz 403 `CommandCapabilityDeniedError`);
#   kpiScorecard — piec trafien (ok. 213, 217, 221, 229, 233)

# (4) TEZA: `AppError` ustawia `isOperational = true` ZAWSZE
sed -n '30,36p' server/src/utils/ErrorHandler.ts
grep -rn "new AppError(" server/src --include="*.ts" | grep -v "__tests__" | wc -l
#   oczekiwane: `this.isOperational = true;` bez zadnego warunku; MOJA liczba wywolan: 203

# (5) ★ TEZA: front sprowadza kazdy kod spoza siedmiu do `INTERNAL`
sed -n '92,98p' src/services/errors/appErrorCopy.ts
grep -n "COMMAND_CAPABILITY_DENIED\|PROGRAM_NOT_ACTIVE\|FINANCE_SETTINGS_INVALID" src/services/errors/appErrorCopy.ts
#   oczekiwane: `readAppErrorCode` konczy sie `CODES.has(raw) ? raw : 'INTERNAL'`;
#   ZERO trafien trzech kodow — to jest wynik, nie brak pomiaru

# (6) TEZA: front WYSYLA `X-App-Language`, a serwer ma go w dozwolonych CORS
sed -n '790,797p' src/services/api.ts
sed -n '1133,1138p' server/src/index.ts
grep -n "X-App-Language" server/src/routes/demo.routes.ts server/src/routes/auth.routes.ts
#   oczekiwane: komentarz „Browsers treat `Accept-Language` as a forbidden header",
#   oba naglowki wysylane, `X-App-Language` w liscie CORS, wzorzec odczytu w dwoch trasach

# (7) TEZA: ogon frontu przepisuje `err.message` na twardy angielski `defaultError`
sed -n '1126,1130p' src/services/api.ts
grep -c "handleResponse(res, " src/services/api.ts
#   oczekiwane: `createApiError(data, defaultError, res.status)`; MOJA liczba miejsc wolajacych
#   `handleResponse(res, <angielski literal>)`: 1003. Zlecenie mowilo 308 i samo oznaczylo
#   te liczbe jako NIEUDOWODNIONA — zmierz i podaj SWOJA, z definicja tego, co liczysz.

# (8) zasoby wolne
df -h /
lsof -nP -iTCP:5491 -sTCP:LISTEN; lsof -nP -iTCP:6351 -sTCP:LISTEN
docker ps --format '{{.Names}}' | grep -c cx-day325 || true
#   oczekiwane: powyzej 5 GB wolnego; oba porty puste; 0 kontenerow
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day325-komunikaty-pl-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6351`. Twój JEDYNY port harnessu to `5491`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day325-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000, 5037, 5060-5061, 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez inne prace: 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5449 oraz 6311-6313 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-323 oraz rodzeństwo tej paczki 04.09: 324 (6350/5490), 326 (6352/5492); dyżury 313-323 poza tą instrukcją, sprawdź sam przed startem. Twoje własne: baza 6351, harness 5491. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y, po numerze PID, nigdy po nazwie procesu`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `żadnej pozycji — ten dyżur nie zamawia ani jednej flagi funkcyjnej i nie zmienia wartości domyślnej żadnej istniejącej. Lokalizacja komunikatu błędu nie jest zmianą wizualną wymagającą akceptu na zrzutach: to naprawa treści, którą użytkownik i tak już widzi, tyle że po angielsku. Gdybyś uznał, że potrzebujesz flagi, jest to STOP MERYTORYCZNY z briefem, a nie cichy commit`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `server/src/middleware/auth.middleware.ts` · `server/src/Gateway.ts` · `server/src/middleware/v8FeatureGate.middleware.ts` · `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` · `server/src/services/resultsVnext/platform/commandCapabilityGuard.ts` · `server/src/middleware/admin.middleware.ts` · `server/src/middleware/requireAudit.middleware.ts`. ★ Nietykalny także `tests/unit/backend/security/noRawErrorMessage.test.ts` — strażnik wycieków, teren dyżuru 326, nie ruszasz go w tym dyżurze ani jednym znakiem: `tests/unit/backend/security/noRawErrorMessage.test.ts`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY325_KOMUNIKATY_PL_REPORT.md`. Dozwolone nowe/zmieniane pliki dokumentacyjne: raport pod `SCIEZKA_RAPORTU` oraz NOWY `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMUNIKATOW_PL_20260904.md` (tabela: kod błędu · trasa · żądanie z językiem polskim → tekst i kod odpowiedzi · żądanie bez nagłówka → tekst i kod odpowiedzi · `errorCode` przed/po · commit). **ZAKAZ edycji `MODULE_ACCEPTANCE.md`** — ten dyżur jest przekrojowy przez cały serwer i cały front. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day325-komunikaty-pl-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day325-komunikaty-pl-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ ZMIANY `errorCode` W ODPOWIEDZI.** Naprawiasz TEKST, nigdy kod — `errorCode` jest kontraktem dla frontu i dla logów; zmiana kodu przy okazji tłumaczenia to cicha zmiana API. Każda para dowodowa ma pokazywać **ten sam `errorCode` przed i po**. **ZAKAZ „naprawiania" przez dopisanie polskiego napisu w dwóch miejscach naraz** — najpierw rozstrzygasz `R1` (serwer czy front jest źródłem prawdy), potem wykonujesz JEDNO; łatanie obu stron produkuje trzecie źródło prawdy i wraca za osiem tygodni. **ZAKAZ opierania lokalizacji wyłącznie na `Accept-Language`** — przeglądarka traktuje go jako nagłówek zabroniony (komentarz w `src/services/api.ts` ok. 792 mówi wprost „best-effort"), więc rozwiązanie stojące tylko na nim jest z definicji zawodne. **ZAKAZ zmniejszania liczby liści w `public/locales/{pl,en}/translation.json`** (baza: pl 35198 / en 33065). **ZAKAZ usuwania uczciwych stanów pustych i `503 not_configured`** (`Z16`) | Dyżur 321 zlokalizował cztery kody, a odbiór realnymi żądaniami HTTP pokazał, że dwa z nich są **strukturalnie nieosiągalne** — nie dlatego, że tłumaczenie jest złe, tylko dlatego, że mapper wołany bez `req` nie ma skąd wziąć języka. Powtórzenie tej pracy „per kod" da trzeci raport „zlokalizowane" przy niezmienionym ekranie użytkownika |

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
cd /private/tmp/cx-day325-komunikaty-pl

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day325-pg psql -U postgres -d cx325 \
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
cd /private/tmp/cx-day325-komunikaty-pl

docker run -d --name cx-day325-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx325 \
  -p 127.0.0.1:6351:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day325-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6351/cx325 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6351/cx325 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day325-komunikaty-pl && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6351/cx325 \
JWT_SECRET=cx325-test-secret-do-not-reuse \
npx vitest run `npx vitest run server/src/routes/resultsVnext/__tests__/okr.routes.test.ts server/src/routes/resultsVnext/__tests__/kpiScorecard.routes.test.ts --config server/vitest.config.ts --retry=0` · `npx vitest run src/services/errors/__tests__/appErrorCopy.test.ts --retry=0` · Twoje NOWE testy realnych żądań HTTP. **Testy serwerowe wymagają `--config server/vitest.config.ts`** — uruchomienie z roota bez configu daje `No test files found`, a to **NIE jest `PASS`**, tylko brak pomiaru --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day325-komunikaty-pl-artefakty/day325-komunikaty-pl.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day325-komunikaty-pl && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run `npx vitest run server/src/routes/resultsVnext/__tests__/okr.routes.test.ts server/src/routes/resultsVnext/__tests__/kpiScorecard.routes.test.ts --config server/vitest.config.ts --retry=0` · `npx vitest run src/services/errors/__tests__/appErrorCopy.test.ts --retry=0` · Twoje NOWE testy realnych żądań HTTP. **Testy serwerowe wymagają `--config server/vitest.config.ts`** — uruchomienie z roota bez configu daje `No test files found`, a to **NIE jest `PASS`**, tylko brak pomiaru --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day325-komunikaty-pl-artefakty/day325-komunikaty-pl.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day325-komunikaty-pl/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day325-pg psql -U postgres -d cx325 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day325-pg`.
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
> **(e) ★★★ **SZEŚĆ PUŁAPEK TEGO DYŻURU.** (1) **`isOperational = true` ZAWSZE.** Konstruktor `AppError` (`server/src/utils/ErrorHandler.ts` ok. 34) ustawia tę flagę bezwarunkowo, a mapper liczy `message = operational ? OPERATIONAL_MESSAGES[language][publicCode] ?? raw : MESSAGES[language][mappedCode]`. Skutek: dla każdego `new AppError(...)` z kodem, którego **nie ma** w czteroelementowym `OPERATIONAL_MESSAGES`, mapper zwraca **surowy angielski `raw`** i polski słownik nigdy się nie odpala. Moja liczba wywołań `new AppError(` w `server/src` poza testami: **203** — policz sam. (2) **`Accept-Language` jest w przeglądarce nagłówkiem ZABRONIONYM.** Front ustawia go „best-effort" i **równolegle wysyła `X-App-Language`** (`src/services/api.ts` ok. 792-795), który jest w liście dozwolonych CORS (`server/src/index.ts` ok. 1135-1136). Wzorzec poprawnego odczytu już istnieje w repo: `req.get('X-App-Language') || req.get('Accept-Language')` (`server/src/routes/demo.routes.ts` ok. 52, `server/src/routes/auth.routes.ts` ok. 1352). Rozwiązanie stojące tylko na `Accept-Language` przejdzie w `supertest` i **padnie w przeglądarce** — to jest dokładnie kształt „test scenariusza nie broni zabezpieczenia". (3) **Front kasuje pracę serwera.** `readAppErrorCode` (`src/services/errors/appErrorCopy.ts` ok. 92-97) sprowadza każdy kod spoza siedmiu kanonicznych do `INTERNAL`, a `getAppErrorCopy` bierze wtedy tekst z `errors.app.internal.*`, **ignorując `message` z serwera**. `COMMAND_CAPABILITY_DENIED`, `PROGRAM_NOT_ACTIVE` i `FINANCE_SETTINGS_INVALID` trafiają tą drogą na „Coś poszło nie tak po naszej stronie…" — czyli **403 »brak uprawnień« wygląda jak awaria systemu**. (4) **`tests/setup.ts` podmienia CAŁY `react-i18next` atrapą**, w której `t(klucz, 'domyślne')` zwraca wartość domyślną **zapisaną w kodzie**. Test „polskich napisów" bez `vi.mock('react-i18next', importActual)` przechodzi przy **PUSTYM** `pl/translation.json`. Każdy Twój test frontu o treści komunikatu musi to obejść i **udowodnić, że obszedł**. (5) **`NODE_ENV=production` w teście serwera zmienia zachowanie mappera i strażników** — jeżeli mierzysz w tym trybie, wpisz to do raportu przy każdym pomiarze; jeżeli w `test`, sprawdź ramkę `§0.2e` (a)-(d), bo `ENABLE_TEST_AUTH_BYPASS` potrafi ominąć `verifyToken` i Twój „403" powstanie z całkiem innego powodu. (6) **`grep --include` w `zsh` zwraca `no matches found` zamiast wyników** — każdy pomiar grepem uruchamiasz w `bash`**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day325-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day325-komunikaty-pl-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (rozstrzygnięcie JEDNEGO źródła prawdy komunikatu — serwer czy front — z uzasadnieniem i wykonaniem, nie łatanie obu stron) · R2 (przekazanie języka: `req` do mappera + odczyt `X-App-Language` z fallbackiem na `Accept-Language`, wzorzec już w repo) · R3 (front przestaje sprowadzać kod spoza siedmiu do `INTERNAL` — 403 nie wygląda jak awaria)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6351` albo `5491` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6351` albo `5491`** (`Z7`).

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

Odbiór adwersaryjny 04.09 nie czytał kodu — wysłał **realne żądania HTTP** przez realny
`ApiGateway`, z podpisanym JWT, przy `NODE_ENV=production`, i przeczytał, co dostaje użytkownik:

| Trasa | Nagłówek | Co dostaje użytkownik |
| --- | --- | --- |
| `/okr-capability` | `Accept-Language: pl` | `"You are not authorized to perform this action."` — **angielski** |
| `/okr-program` | `Accept-Language: pl` | **angielski** |
| `/template` | `Accept-Language: pl` | `"Nie znaleziono szablonu."` — **działa** |

Przyczyna jest strukturalna, nie językowa. `server/src/routes/resultsVnext/okr.routes.ts` (ok. 369)
i `server/src/routes/resultsVnext/kpiScorecard.routes.ts` (ok. 213 i cztery dalsze) wołają:

```ts
mapAppErrorResponse(err, undefined, 'error')
```

**Bez `req` nie ma `Accept-Language`.** Mapper liczy język jako
`/^pl(?:-|,|$)/i.test(req?.get?.('Accept-Language') ?? '') ? 'pl' : 'en'`, więc przy `undefined`
zawsze wychodzi `en`. **Dwa z czterech kodów zlokalizowanych przez dyżur 321 są w ten sposób
strukturalnie nieosiągalne** — tłumaczenie istnieje i nigdy się nie odpala.

Skala: **378** wywołań `mapAppErrorResponse(` w `server/src`, z czego **106** z `undefined`
(moje liczby — zmierz swoje; zlecenie mówiło 115 z 370).

### Trzy warunki, przez które łatanie „per kod" nie zadziała

**(1) `isOperational = true` ZAWSZE.** Konstruktor `AppError`
(`server/src/utils/ErrorHandler.ts` ok. 34) ustawia tę flagę bezwarunkowo. Mapper liczy:

```ts
const operational = error instanceof AppError && error.isOperational;
const publicCode  = operational && codeOf(error) ? codeOf(error) : mappedCode;
const message     = operational
  ? OPERATIONAL_MESSAGES[language][publicCode] ?? raw
  : MESSAGES[language][mappedCode];
```

`OPERATIONAL_MESSAGES` ma **cztery** kody (`PROGRAM_NOT_ACTIVE`, `FINANCE_SETTINGS_INVALID`,
`NOT_FOUND`, `COMMAND_CAPABILITY_DENIED`). Dla każdego `new AppError(...)` z kodem spoza tej
czwórki gałąź `?? raw` zwraca **surowy komunikat z kodu, po angielsku** — a siedmioelementowy
słownik `MESSAGES` nigdy się nie odpala, bo `operational` jest prawdą. Wywołań `new AppError(`
w `server/src` poza testami: **203** (moja liczba).

> **Sprostowanie wobec treści zlecenia.** Zlecenie opisało mapper jako
> `operational ? raw : MESSAGES[language][code]`. Realny kod ma pośredni krok
> `OPERATIONAL_MESSAGES[language][publicCode] ?? raw`, więc cztery kody DZIAŁAJĄ, a `raw` jest
> dopiero fallbackiem. Wniosek zlecenia zostaje w mocy, mechanizm jest o jeden krok bogatszy.
> **Zweryfikuj to sam** — komenda (1) i (4) w `§0.1`.

**(2) `Accept-Language` jest w przeglądarce nagłówkiem ZABRONIONYM.** Front to wie i już to
obsłużył — `src/services/api.ts` ok. 792-795:

```ts
// NOTE: Browsers treat `Accept-Language` as a forbidden header, so setting it here is best-effort.
// Use `X-App-Language` as the reliable signal for backend localization.
'Accept-Language': userLanguage,
'X-App-Language': userLanguage,
```

`X-App-Language` jest w liście dozwolonych nagłówków CORS (`server/src/index.ts` ok. 1135-1136),
a **wzorzec poprawnego odczytu już istnieje w repo**:
`req.get('X-App-Language') || req.get('Accept-Language')` — `server/src/routes/demo.routes.ts`
ok. 52 oraz `server/src/routes/auth.routes.ts` ok. 1352.

**Rozwiązanie oparte wyłącznie na `Accept-Language` przejdzie w `supertest` i padnie w
przeglądarce.** To jest dokładnie kształt „test scenariusza nie broni zabezpieczenia".

**(3) Front kasuje pracę serwera.** `readAppErrorCode`
(`src/services/errors/appErrorCopy.ts` ok. 92-97) kończy się:

```ts
return CODES.has(raw as AppErrorCode) ? (raw as AppErrorCode) : 'INTERNAL';
```

Każdy kod spoza siedmiu kanonicznych staje się `INTERNAL`, a `getAppErrorCopy` bierze wtedy tekst
z `errors.app.internal.*` i **ignoruje `message` z serwera**. Zmierzone na realnym pliku:
`COMMAND_CAPABILITY_DENIED`, `PROGRAM_NOT_ACTIVE`, `FINANCE_SETTINGS_INVALID` → wszystkie
**„Coś poszło nie tak po naszej stronie…"**.

> **★ To jest najgorszy pojedynczy skutek w tym dyżurze: `403 „brak uprawnień"` pokazuje się
> użytkownikowi jako AWARIA SYSTEMU.** Użytkownik nie dowiaduje się, że czegoś mu nie wolno —
> dowiaduje się, że produkt jest zepsuty.

Do tego `src/services/api.ts` ok. 1128 (`createApiError(data, defaultError, res.status)`) podstawia
twardy angielski `defaultError` w ogonie wywołań. Moja liczba miejsc wołających
`handleResponse(res, <angielski literał>)`: **1003**. Zlecenie mówiło o 308 i samo oznaczyło tę
liczbę jako **NIEUDOWODNIONĄ**. Mechanizm jest dowiedziony, **wolumen mierzysz Ty** — i podajesz
razem z definicją tego, co liczysz.

### Dlatego rdzeniem tego dyżuru jest R1, a nie R2

Gdybyś dopisał polski tekst po stronie serwera **i** po stronie frontu, powstanie **trzecie**
źródło prawdy i za osiem tygodni wróci ten sam defekt w dwunastu plikach (udokumentowany kształt
„naprawa per-wywołanie odrasta"). **Najpierw rozstrzygasz, kto jest źródłem prawdy komunikatu —
serwer czy front — potem wykonujesz JEDNO.**

## ★ Zmierz moje liczby sam

Twierdzę: 378 wywołań mappera, 106 z `undefined`; `MESSAGES` ma 7 kodów, `OPERATIONAL_MESSAGES` 4;
`isOperational = true` bezwarunkowo; 203 wywołania `new AppError(`; `readAppErrorCode` sprowadza
resztę do `INTERNAL`; 1003 miejsca z `handleResponse(res, <literał>)`; liście
`translation.json` = pl 35198 / en 33065.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH — CAŁA ŚCIEŻKA

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **walidator** | `server/src/validators/**` | **TYLKO ODCZYT** — ten dyżur nie zmienia walidacji wejścia, tylko tekst wyjścia | Opis w raporcie z dowodem plik:linia |
| **trasa (tył)** | `server/src/routes/resultsVnext/okr.routes.ts`, `server/src/routes/resultsVnext/kpiScorecard.routes.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zamiana `undefined` na `req` w wywołaniach `mapAppErrorResponse(...)`.** Zakaz zmiany kodów statusu, zakaz zmiany `err.code`, zakaz zmiany kolejności gałęzi `if (err instanceof …)`, zakaz dotykania logiki biznesowej | Gotowy diff w bloku kodu + brief |
| **trasa (tył)** | Pozostałe `server/src/routes/**` z wywołaniem `mapAppErrorResponse(..., undefined, ...)` | **★ WĄSKA LICENCJA — ta sama, co wyżej**, ale **wyłącznie dla tras, dla których dostarczysz PARĘ DOWODOWĄ** (żądanie z językiem polskim → polski; bez nagłówka → angielski). Trasa bez pary dowodowej **zostaje niezmieniona** i idzie do rejestru jako dług policzony | Wpis do rejestru: trasa · plik:linia · dlaczego nie zmierzona |
| **trasa (tył) — WZORZEC** | `server/src/routes/demo.routes.ts` ok. 52, `server/src/routes/auth.routes.ts` ok. 1352 | **TYLKO ODCZYT — to jest wzorzec, nie cel.** Pokazują poprawny odczyt: `req.get('X-App-Language') \|\| req.get('Accept-Language')` | — |
| **kontroler / mapper (tył)** | `server/src/middleware/appErrorMapper.ts` | **★ PEŁNA LICENCJA** w zakresie `R2` i `R4`: odczyt języka (`X-App-Language` z fallbackiem), rozszerzenie `OPERATIONAL_MESSAGES`, kolejność wyboru komunikatu. **ZAKAZ zmiany kształtu koperty** — pola `errorCode` i `correlationId` muszą zostać w każdej odpowiedzi błędu, z tymi samymi nazwami | — |
| **serwis / utils (tył)** | `server/src/utils/ErrorHandler.ts` | **TYLKO ODCZYT — PLIK PRZEKROJOWY.** `AppError` jest bazą 203 wywołań i globalnego handlera (ok. 246); zmiana `isOperational` przestawia zachowanie całego serwera | **CZERWONY KONTRAKT TESTOWY** (`it('KONTRAKT DLA DYŻURU 325 — …')`, nagłówek `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`) + brief: plik:linia · promień rażenia (ile wywołań, ile tras) · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **repozytorium (tył)** | `server/src/services/**`, `server/src/repositories/**` | **TYLKO ODCZYT** — komunikaty rodzą się tu, ale ten dyżur naprawia je w jednym miejscu, nie w 203 | Wpis do rejestru + gotowy diff nienałożony dla najbardziej reprezentatywnego przypadku |
| **migracje** | `server/migrations/**` | **BEZ LICENCJI — ten dyżur nie dodaje ani nie zmienia żadnej migracji.** Przedział nieprzydzielony | Uznanie, że migracja jest potrzebna = STOP MERYTORYCZNY z briefem, idziesz dalej |
| **serwer — montaż** | `server/src/index.ts`, `server/src/Gateway.ts` | **TYLKO ODCZYT** (`Z19`) — lista CORS już zawiera `X-App-Language`, nie musisz jej ruszać | Brief + gotowy diff nienałożony |
| **front — rdzeń** | `src/services/errors/appErrorCopy.ts` | **★ PEŁNA LICENCJA** w zakresie `R3`: przestań sprowadzać kod spoza siedmiu do `INTERNAL` w sposób, który gubi `message` z serwera. **ZAKAZ usuwania fallbacku angielskiego** — ma zostać jako ostatnia deska ratunku, gdy serwer nie przyśle nic | — |
| **front — ogon** | `src/services/api.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE funkcja `handleResponse` i `createApiError` w zakresie „nie nadpisuj `message` z serwera twardym `defaultError`"**. Zakaz zmiany 1003 wywołań po kolei, zakaz zmiany nagłówków, zakaz zmiany logiki `429`/`403 access-blocked`/odświeżania tokenu | Gotowy diff + brief z promieniem rażenia |
| **front — testy** | `src/services/errors/__tests__/appErrorCopy.test.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie NOWYCH przypadków `it(...)`.** Zakaz zmiany i osłabiania istniejących | Nowy plik testowy obok |
| **testy (NOWE)** | `server/src/routes/**/__tests__/**` (NOWE pliki), `tests/**` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18`, `Z29` (`--retry=0`) i `Z31`. **Nowe pliki w `tests/` wymagają `git add -f`** | — |
| **i18n** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości. **Liczba liści nie może zmaleć** (baza: pl 35198 / en 33065 — komenda w `B.3`) | — |
| **rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMUNIKATOW_PL_20260904.md` (**NOWY**) | **★ PEŁNA LICENCJA** | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY325_KOMUNIKATY_PL_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **bramki** | `server/src/middleware/auth.middleware.ts`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/middleware/resultsInternalBetaVisibility.middleware.ts`, `server/src/services/resultsVnext/platform/commandCapabilityGuard.ts`, `server/src/middleware/admin.middleware.ts`, `server/src/middleware/requireAudit.middleware.ts` | **TYLKO ODCZYT — `Z12`, BEZWZGLĘDNIE** | **CZERWONY KONTRAKT TESTOWY** + brief. Pozycja jest wtedy **ZROBIONA**, nie STOP |
| **infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar (patrz pułapka 4 o atrapie `react-i18next`), jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest zrobiona z takim opisem |
| **decyzje** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **cudzy teren** | `tests/unit/backend/security/noRawErrorMessage.test.ts`, `server/src/routes/admin/service-accounts.routes.ts`, `server/src/services/tablePlatform/**` — **teren dyżuru 326**; `src/components/Initiatives/InitiativeDocumentView.tsx`, `src/components/**/**CardContract*.ts`, `src/components/standard/cardContract.types.ts` — **teren dyżuru 324** | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, treść problemu, gotowa rekomendacja jako diff w bloku kodu, **nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit po KAŻDEJ pozycji, push na
`github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | **Rozstrzygnięcie JEDNEGO źródła prawdy komunikatu** | TAK | NIE — dowód: rozstrzygnięcie jest zapisem w raporcie, nie zmianą pliku | bazowe | Wpis w raporcie: **serwer albo front**, z uzasadnieniem opartym na trzech zmierzonych warunkach (`isOperational`, nagłówek zabroniony, `readAppErrorCode`), z jawnym zdaniem, co w związku z tym **przestaje** być robione po drugiej stronie. Bez tego wpisu R2 i R3 są zabronione | 7 komend `§0.1` + tabela mianowników | `docs(day325): rozstrzygniecie zrodla prawdy komunikatu (325 R1)` |
| R2 | Przekazanie języka: `req` do mappera + `X-App-Language` | TAK | NIE — dowód: `B.1` daje wąską licencję na obie trasy i pełną na mapper | +2 nowe testy realnych żądań | Dla KAŻDEJ zmienionej trasy **para żądań**: z językiem polskim → polski tekst; bez nagłówka → angielski; **`errorCode` niezmieniony w obu**. Kody odpowiedzi zapisane dosłownie | `npx vitest run <Twoje nowe testy> --config server/vitest.config.ts --retry=0` | `fix(errors): mapper dostaje req i czyta X-App-Language (325 R2)` |
| R3 | Front przestaje robić z 403 awarię systemu | TAK | NIE — dowód: `appErrorCopy.ts` ma pełną licencję w `B.1` | +2 testy | `COMMAND_CAPABILITY_DENIED` → tekst o braku uprawnień, nie „Coś poszło nie tak po naszej stronie…"; fallback angielski zachowany; **`errorCode` nadal odczytywalny z koperty** | `npx vitest run src/services/errors/__tests__ --retry=0` | `fix(errors): kod spoza siedmiu nie udaje awarii systemu (325 R3)` |
| R4 | Rozliczenie 203 `new AppError` z angielskim tekstem | NIE | NIE | +1 test | Rejestr: ile wywołań ma kod obecny w `OPERATIONAL_MESSAGES`, ile nie; werdykt dla najliczniejszej rodziny; gotowy diff **nienałożony** dla reprezentanta | `grep -rn "new AppError(" server/src \| grep -v __tests__ \| wc -l` (w `bash`) | `docs(day325): rejestr AppError bez polskiego slownika (325 R4)` |
| R5 | Wolumen ogona frontu | NIE | NIE | n/d | **Twoja** liczba miejsc, w których `defaultError` zastępuje `message` z serwera, z podaną definicją tego, co liczysz; werdykt: czy `R3` je pokrywa, czy zostaje dług | `grep -c "handleResponse(res, " src/services/api.ts` | `docs(day325): wolumen ogona defaultError (325 R5)` |
| R6 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" **niepusta** | — | `docs(day325): raport` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Żadna pozycja nie wymaga zmiany `ErrorHandler.ts` ani żadnej bramki z `Z12`:
> jeśli uznasz, że musi, produktem jest czerwony kontrakt + brief, a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą liczbę mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz w `bash`.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Wywołania `mapAppErrorResponse(` w `server/src` | 378 | `grep -rn "mapAppErrorResponse(" server/src --include="*.ts" \| wc -l` | TAK — uruchomione na markerze |
| 2 | Wywołania z `undefined` zamiast `req` | 106 | `grep -rnE "mapAppErrorResponse\([^,)]*, *undefined" server/src --include="*.ts" \| wc -l` | TAK — **zlecenie mówiło 115 z 370; zmierz i zapisz swoją** |
| 3 | Kody w `MESSAGES` / `OPERATIONAL_MESSAGES` | 7 / 4 | `sed -n '25,60p' server/src/middleware/appErrorMapper.ts` | TAK |
| 4 | Wywołania `new AppError(` poza testami | 203 | `grep -rn "new AppError(" server/src --include="*.ts" \| grep -v "__tests__" \| wc -l` | TAK |
| 5 | Miejsca `handleResponse(res, <literał>)` w `api.ts` | 1003 | `grep -c "handleResponse(res, " src/services/api.ts` | TAK — **zlecenie mówiło 308 i samo oznaczyło to `NOT_PROVEN`** |
| 6 | Kody kanoniczne frontu | 7 | `sed -n '84,92p' src/services/errors/appErrorCopy.ts` | TAK |
| 7 | Liście `translation.json` | pl 35198 / en 33065 | `node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'` | TAK — **liczba nie może zmaleć**; tablice liczone element po elemencie |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `server/src/middleware/appErrorMapper.ts` | istniejący | R2 | ZEROWE — 324 i 326 mają go jawnie jako cudzy teren |
| 2 | `src/services/errors/appErrorCopy.ts` | istniejący | R3 | ZEROWE |
| 3 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMUNIKATOW_PL_20260904.md` | NOWY | R2/R4/R5 | ZEROWE |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY325_KOMUNIKATY_PL_REPORT.md` | NOWY | R6 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/routes/resultsVnext/okr.routes.ts`, `kpiScorecard.routes.ts` | R2 | Tylko zamiana `undefined` → `req`, i tylko dla wywołań, dla których masz **parę dowodową** |
| Pozostałe `server/src/routes/**` z `undefined` | R2 | Jak wyżej — trasa bez pary dowodowej zostaje niezmieniona i idzie do rejestru |
| `src/services/api.ts` | R3/R5 | Tylko `handleResponse`/`createApiError`, tylko jeśli `R1` rozstrzygnął, że front nie ma nadpisywać `message` z serwera |
| `src/services/errors/__tests__/appErrorCopy.test.ts` | R3 | Tylko dopisanie nowych `it(...)` |
| `public/locales/{pl,en}/translation.json` | R3 | Tylko dopisanie kluczy, parytet w tym samym commicie, liczba liści nie maleje |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/src/utils/ErrorHandler.ts                        — przekrojowy (203 wywołania + globalny handler)
server/src/middleware/auth.middleware.ts                — Z12
server/src/services/resultsVnext/platform/commandCapabilityGuard.ts — Z12
server/src/middleware/v8FeatureGate.middleware.ts       — Z12
server/src/middleware/resultsInternalBetaVisibility.middleware.ts — Z12
server/src/index.ts, server/src/Gateway.ts              — Z19 (lista CORS już ma X-App-Language)
tests/unit/backend/security/noRawErrorMessage.test.ts   — teren dyżuru 326
server/src/routes/admin/service-accounts.routes.ts      — teren dyżuru 326
server/src/services/tablePlatform/**                    — teren dyżuru 326
src/components/Initiatives/**, src/components/**/*ardContract*.ts — teren dyżuru 324
server/migrations/**                                    — przedział nieprzydzielony
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6351 | `lsof -nP -iTCP:6351 -sTCP:LISTEN` → puste (sprawdzone przy pisaniu instrukcji) |
| Port harnessu | 5491 | `lsof -nP -iTCP:5491 -sTCP:LISTEN` → puste |
| Kontener | `cx-day325-pg` | `docker ps --format '{{.Names}}' \| grep cx-day325` → brak |
| Baza | `cx325` | n/d |
| Gałąź | `codex/day325-komunikaty-pl-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day325-komunikaty-pl` | nie istnieje |
| Przedział migracji | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | n/d |
| Flagi | **żadnych nowych, żadnych zmian domyślnych** | `git diff <marker>..HEAD -- '.env*' 'docker-compose*' 'railway*'` → pusto |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day325-komunikaty-pl
git diff --name-only --cached | tee /private/tmp/cx-day325-komunikaty-pl-artefakty/staged.txt
grep -iE 'utils/ErrorHandler\.ts|auth\.middleware|commandCapabilityGuard|v8FeatureGate|resultsInternalBetaVisibility|server/src/index\.ts|Gateway\.ts|noRawErrorMessage|service-accounts\.routes|tablePlatform/|components/Initiatives/|ardContract|server/migrations/' \
  /private/tmp/cx-day325-komunikaty-pl-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"
```

---

## R1 — JEDNO ŹRÓDŁO PRAWDY KOMUNIKATU (rdzeń, wykonaj PIERWSZE)

**Nie zaczynasz kodować, dopóki tego nie zapiszesz.** Wpis w raporcie ma odpowiedzieć na jedno
pytanie: **kto jest źródłem prawdy tekstu, który czyta użytkownik — serwer czy front?** — i
uzasadnić to trzema zmierzonymi warunkami:

| Warunek | Za serwerem | Za frontem |
| --- | --- | --- |
| `isOperational = true` zawsze, `OPERATIONAL_MESSAGES` ma 4 kody, 203 wywołania `new AppError` | serwer musi urosnąć o słownik | front i tak zignoruje `message` przy kodzie spoza siedmiu |
| `Accept-Language` zabroniony w przeglądarce; `X-App-Language` już wysyłany i w CORS | serwer da radę, jeśli czyta oba | front zna język bez żadnego nagłówka |
| `readAppErrorCode` sprowadza kod spoza siedmiu do `INTERNAL` | serwer nie ma nad tym władzy | front ma pełną kontrolę i katalog `errors.app.*` |

Wpis musi zawierać jawne zdanie: **„W związku z tym po drugiej stronie PRZESTAJEMY robić X"** —
bez niego rozstrzygnięcie nie jest rozstrzygnięciem, tylko dopisaniem trzeciego źródła prawdy.

Prawo zatrzymania po tej pozycji. **R1 zrobione, R2-R6 nietknięte jest pełnowartościowym wynikiem.**

## R2 — PRZEKAZANIE JĘZYKA

Wykonujesz **wyłącznie stronę wskazaną przez `R1`**. Jeżeli `R1` wskazał serwer:

1. Mapper czyta język wzorcem, który już jest w repo:
   `req.get('X-App-Language') || req.get('Accept-Language')` (`demo.routes.ts` ok. 52).
2. `undefined` → `req` w wywołaniach — **tylko tam, gdzie dostarczysz parę dowodową**.

**Para dowodowa dla każdego naprawionego kodu** — realne żądanie HTTP przez realny
`ApiGateway.getInstance().initializeRoutes(app)` (`Z22`), z podpisanym JWT, z zapisanym **kodem
odpowiedzi** (`Z34`):

```
(a) z językiem polskim  → tekst POLSKI,  errorCode = <X>
(b) bez nagłówka języka → tekst ANGIELSKI, errorCode = <X>   ← ten sam X
```

**`errorCode` musi być identyczny w obu.** Para, w której kod się zmienił, jest dowodem cichej
zmiany API, nie dowodem lokalizacji.

**Dowód mutacyjny obowiązkowy, wycelowany w ZABEZPIECZENIE, nie w mechanizm** (`Z32`): usuń odczyt
`X-App-Language` z mappera → **para (a) staje się angielska, test CZERWONY**; przywróć przez `cp`
z kopii w `SCRATCH` (`Z27`, nigdy `git stash`) → **ZIELONY**; `git diff` po cofnięciu **pusty**.
Obie komendy i oba wyniki dosłownie w raporcie.

★ **Pułapka do udowodnienia, że ją obszedłeś:** test w `supertest` może ustawić `Accept-Language`
bez przeszkód. Przeglądarka nie może. Dlatego para dowodowa musi być wykonana **także dla
`X-App-Language`** — inaczej udowodniłeś działanie ścieżki, której realny użytkownik nie ma.

Prawo zatrzymania po tej pozycji.

## R3 — 403 PRZESTAJE WYGLĄDAĆ JAK AWARIA

`readAppErrorCode` ma nadal zwracać `INTERNAL` jako **ostateczny** fallback, ale `getAppErrorCopy`
nie może z tego powodu **wyrzucać `message` przysłanego przez serwer**. Dowód wprost:

```
Kod COMMAND_CAPABILITY_DENIED + message z serwera
  → PRZED: „Coś poszło nie tak po naszej stronie…"
  → PO:    tekst o braku uprawnień
  → errorCode w kopercie: NIEZMIENIONY
```

Fallback angielski zostaje na wypadek, gdy serwer nie przyśle nic — **nie usuwasz go** (`Z16`:
uczciwy stan „nie wiem" jest wzorcem poprawnym, nie defektem).

★ **Pułapka 4 obowiązkowo rozliczona w raporcie:** `tests/setup.ts` podmienia cały `react-i18next`
atrapą, w której `t(klucz, 'domyślne')` zwraca wartość **z kodu**. Test „polskich napisów" bez
`vi.mock('react-i18next', importActual)` przechodzi przy **pustym** `pl/translation.json`. Napisz,
jak to obszedłeś i **czym to udowodniłeś**. Pomiar bez tego akapitu nie liczy się jako dowód.

Prawo zatrzymania po tej pozycji.

## R4 — ROZLICZENIE 203 WYWOŁAŃ `new AppError`

Rejestr: ile wywołań niesie kod obecny w `OPERATIONAL_MESSAGES`, ile nie. Dla najliczniejszej
rodziny — werdykt i **gotowy diff nienałożony** dla jednego reprezentanta. Nie naprawiasz 203
miejsc; pokazujesz, że naprawa w jednym miejscu (mapper) je pokrywa, albo że nie pokrywa i
dlaczego.

Prawo zatrzymania po tej pozycji.

## R5 — WOLUMEN OGONA FRONTU

**Twoja** liczba, z podaną definicją tego, co liczysz („miejsca wołające `handleResponse(res, X)`,
gdzie `X` jest literałem angielskim" to inna liczba niż „miejsca, w których użytkownik realnie
zobaczy `X`"). Werdykt: czy `R3` je pokrywa, czy zostaje dług policzony.

Prawo zatrzymania po tej pozycji.

## R6 — RAPORT

Struktura `§R.2`. Obowiązkowo: rozstrzygnięcie `R1` ze zdaniem „przestajemy robić X", tabela par
dowodowych (kod · trasa · z pl → tekst+status · bez nagłówka → tekst+status · `errorCode`
przed/po), dowód mutacyjny w obie strony, akapit o pułapce atrapy `react-i18next`, akapit
`§0.2e` dla każdego uruchomionego pakietu, sekcja **TWIERDZENIA NIEZWERYFIKOWANE** niepusta.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 rozstrzygnięte, R2 zrobione dla dwóch tras z parami
dowodowymi, R3-R6 nietknięte" jest pełnowartościowym wynikiem — o ile każda zmieniona trasa ma
parę dowodową i o ile `errorCode` nigdzie się nie zmienił.

**Odwrotna kolejność — rejestry (R4/R5) zrobione, rdzeń (R1/R2/R3) „częściowo" — jest podstawą
odrzucenia.** Tak samo: naprawa obu stron naraz bez rozstrzygnięcia `R1`.

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela niżej | TAK |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone pętlą `[ -e "$p" ]` na worktree z markera; zero `BRAK` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, siedem wierszy; dwie liczby ze zlecenia **skorygowane własnym pomiarem** i oznaczone wprost |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4 |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (324, 326) | TAK — `B.4.4`; porty 5491/6351 zmierzone jako wolne |
| 7 | Komendy paste-ready, z `#   oczekiwane: …` | TAK |
| 8 | Pułapki środowiska w całości + sześć pułapek modułu | TAK |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru" bez ścieżki | TAK |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu w dokumencie: `0`; wierszy `Z`: `41` | TAK |

### AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| „Napraw komunikat po polsku" **vs** `Z12` zakaz zmian bramek platformowych | `B.1` — bramki tylko do odczytu; naprawa idzie przez mapper i front, obydwa z licencją |
| „Napraw serwer" **vs** „napraw front" | `R1` — rdzeniem jest ROZSTRZYGNIĘCIE jednego źródła prawdy; wykonujesz **jedno**, drugie strony jawnie **przestaje** to robić |
| Zakaz `Z16` „nie usuwasz uczciwych stanów pustych" **vs** `R3` zmienia tekst fallbacku | `R3` — fallback angielski **zostaje**, zmienia się tylko to, że `message` z serwera przestaje być wyrzucany |
| Zakaz `Z18` „infra testowa nietykalna" **vs** atrapa `react-i18next` fałszuje test napisów | `B.1` (wiersz infry) + pułapka (4) + `R3` — obchodzisz w SWOIM teście przez `importActual`, `tests/setup.ts` zostaje nietknięty; pozycja jest zrobiona z opisem |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument" **vs** `R2`/`R4`/`R5` piszą do rejestru | `Z13` (pole „jedyny inny dokument") — raport + jeden imiennie wskazany rejestr |
| „Napraw 106 wywołań z `undefined`" **vs** „każda zmiana ma parę dowodową" | `B.1` (wiersz „pozostałe trasy") — trasa bez pary dowodowej **zostaje niezmieniona** i idzie do rejestru jako dług policzony |
| Zakaz `Z30` „zero wysyłki" **vs** testy uderzają w realne trasy | `§0.2b` — montujesz `ApiGateway`, nie `server/src/index.ts`; drenaże outboxu nie startują; deklaracja dosłowna w raporcie |
