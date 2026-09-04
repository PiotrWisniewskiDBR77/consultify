# INSTRUKCJA DYŻURU nr 318 — Codex — „Skaner 309 mierzy sygnał sieci/bazy i dziś stoi na 21 kandydatach (5399 plików, 0 pominiętych) — 5 z 21 już rozstrzygnięto mutacją (2 PUSTE), ale skaner ma ślepą plamę: 267 plików i 1766 bloków bez ŻADNEGO wiązania z produktem, w tym 13, które definiują WŁASNY podmiot testu (przykład zmierzony: `tests/components/AIChat/MessageBubble.test.tsx` renderuje lokalny stub, nigdy prawdziwy `src/components/AIChat/Messages/MessageBubble.tsx`) — ten dyżur rozszerza wykrywanie, rozstrzyga resztę kandydatów i usuwa test bez produktu"

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
> **wyłącznie** `/private/tmp/cx-day318-testy-puste`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`**
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
Zakres: **PRZEKROJOWE — TESTY: dokończenie dyżuru 309. Rozszerzenie skanera pustych testów o wykrywanie podmiotu zdefiniowanego wewnątrz pliku testu, rozstrzygnięcie mutacją pozostałych kandydatów rodziny sieć/baza, usunięcie testu bez odpowiadającego mu modułu produkcyjnego**.
Trasy front: `brak tras HTTP — to jest praca na WARSTWIE TESTÓW: `scripts/dev/testy-puste-skan.mjs`, `tests/unit/config/noEmptyAssertions.test.ts` (bezpiecznik podłogowy), pliki testowe wymienione w tabeli mianowników `B.3` (21 kandydatów E0001-E0021) i `tests/unit/services/api-extensions.test.ts``. Trasy tył: `brak tras HTTP — mutacje dowodowe celują w konkretne funkcje PRODUKCYJNE wskazane przy każdym kandydacie w `B.2` (np. `server/src/cron/BillingCron.ts`, `server/src/services/siemService.ts`, `server/src/services/ai/chatPolicyGateway.ts` — WYŁĄCZNIE jako cel mutacji dowodowej, nie do zmiany trwałej)`.

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
WT=/private/tmp/cx-day318-testy-puste
MARKER=bc18bc7acac2ec825ebb3db2f1309738ab034d58

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day318-testy-puste-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day318-testy-puste/config.worktree"
cat "$VAULT/worktrees/cx-day318-testy-puste/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day318-testy-puste-scratch
mkdir -p /private/tmp/cx-day318-testy-puste-artefakty

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
git -C "$VAULT" log --oneline bc18bc7acac2ec825ebb3db2f1309738ab034d58..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day318-testy-puste-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `7` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
# (1) TEZA: skaner dziś liczy 21 kandydatów, zero pominiętych, pliki >= 5399
node scripts/dev/testy-puste-skan.mjs
#   oczekiwane: JSON z "candidates": 21, "skipped": 0, "files" >= 5399 (mój pomiar 04.09: files=5404) — Twój wynik może się różnić, zapisz go

# (2) TEZA: bezpiecznik podłogowy istnieje z dokładnie tymi progami
grep -n 'files: 5399\|candidates: 21\|skipped: 0' tests/unit/config/noEmptyAssertions.test.ts
#   oczekiwane: trzy trafienia — to jest PODŁOGA (>=/<=), nie równość dokładna

# (3) TEZA: rejestr ręczny z 5 już rozstrzygniętymi kandydatami istnieje
cat docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md | head -30
#   oczekiwane: tabela z scimService/contentService=PUSTY, billingCron/siemService/chatPolicyGateway=NIE PUSTY

# (4) TEZA: przykład ślepej plamy jest realny — test definiuje WŁASNY podmiot, produkt ma inny plik
grep -n '^const MessageBubble' tests/components/AIChat/MessageBubble.test.tsx
ls src/components/AIChat/Messages/MessageBubble.tsx
grep -n "^import" tests/components/AIChat/MessageBubble.test.tsx
#   oczekiwane: test DEFINIUJE `const MessageBubble = () => …` lokalnie; prawdziwy komponent ISTNIEJE w src/; import w teście NIE wymienia MessageBubble z src/

# (5) TEZA: api-extensions.test.ts testuje moduł, którego w repo nie ma
grep -rli 'api.extensions\|apiExtensions' src server --include='*.ts' --include='*.tsx' | grep -v node_modules
#   oczekiwane: pusty wynik — zero plików produkcyjnych o tej nazwie; test istnieje mimo to

# (6) TEZA: dwie pozycje billingCron w rejestrze to DWA różne bloki `it`, mutacja odbiorcy dotyczyła co najwyżej jednego
grep -n 'should handle database errors\|should continue processing even if one org fails' tests/unit/backend/cron/billingCron.test.ts
#   oczekiwane: dwie różne linie — ustal, którą dokładnie zmutował odbiorca (raport dowodów tego nie precyzuje), druga zostaje Twoim zadaniem niezależnie

# (7) zasoby wolne
df -h /
lsof -nP -iTCP:5474 -sTCP:LISTEN; lsof -nP -iTCP:6334 -sTCP:LISTEN; docker ps --format '{{.Names}}' | grep -c cx-day318 || true
#   oczekiwane: powyżej 5 GB wolnego dysku; oba porty puste; 0 kontenerów
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day318-testy-puste-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6334`. Twój JEDYNY port harnessu to `5474`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day318-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5449 oraz 6311-6313 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-316 oraz rodzeństwo tej samej paczki wydanej 04.09: 317 (baza 6333, harness 5473), 322 (baza 6338, harness 5478), 323 (baza 6339, harness 5479); paczka 313-316 i 319-321 ma własny przydział spoza tej instrukcji — sprawdź `docker ps`/`lsof` sam. Twoje własne: baza 6334, harness 5474. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `vitest` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `Brak — ten dyżur nie tworzy ani nie przełącza żadnej flagi funkcyjnej produktu. Nie dotyczy testów`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` (`Z18`, patrz też licencja `B.1`) · `server/src/cron/BillingCron.ts`, `server/src/services/siemService.ts`, `server/src/services/ai/chatPolicyGateway.ts` — WOLNO mutować DOWODOWO i cofnąć (nie zostawiasz mutacji w kodzie), NIE wolno zmieniać na trwałe bez jawnej licencji w tabeli `B.1``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY318_TESTY_PUSTE_REPORT.md`. Dozwolone nowe/zmieniane pliki dokumentacyjne: raport pod `SCIEZKA_RAPORTU`, `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_20260903.md` (generowany przez skaner — regenerujesz uruchamiając rozbudowany skrypt, NIE edytujesz ręcznie, bo każdy przebieg bezpiecznika i tak go nadpisze) i `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md` (plik PISANY RĘCZNIE — DOPISUJESZ swoje 14-16 nowych wierszy rozstrzygnięć pod istniejącą tabelą pięciu już zrobionych, nie kasujesz cudzych wierszy). Kod: `scripts/dev/testy-puste-skan.mjs` (rozbudowa detekcji), `tests/unit/config/noEmptyAssertions.test.ts` (WYŁĄCZNIE aktualizacja progu `candidates`, w dół, nigdy w górę), naprawy/usunięcia w plikach testowych z tabeli `B.2`. **ZAKAZ edycji `MODULE_ACCEPTANCE.md`**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day318-testy-puste-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day318-testy-puste-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ nadawania klasy `PUSTY` z samego tekstu** — wymagany dowód mutacyjny funkcji PRODUKCYJNEJ w obie strony (czerwony po mutacji, zielony po cofnięciu), dokładnie jak w `REJESTR_TESTY_PUSTE_DOWODY_20260904.md`. **ZAKAZ ekstrapolacji** — „rzędu 8 pustych z 21” to szacunek odbiorcy, nie wynik; rozstrzygasz KAŻDY kandydat osobno. **ZAKAZ podnoszenia progu `candidates` w `noEmptyAssertions.test.ts` w GÓRĘ** — wolno go tylko obniżyć, gdy realnie zmniejszysz liczbę kandydatów (np. usuwając `api-extensions.test.ts`). **ZAKAZ mylenia „PUSTY” z „ślepą plamą”** — plik bez sygnału sieci/bazy w ogóle (np. `MessageBubble.test.tsx`) nie jest dzisiejszym kandydatem skanera i nie dostaje klasy PUSTY automatycznie po samej rozbudowie detekcji — nowa detekcja produkuje OSOBNĄ listę do przeglądu, nie automatyczne wyroki | Ekstrapolacja `~8 z 21` bez pomiaru każdego kandydatu z osobna powtórzyłaby dokładnie ten błąd, za który program krytykuje inne dyżury (`hipoteza nadzorcy staje się faktem`) — teza staje się faktem w rejestrze bez dowodu. Podniesienie progu `candidates` w górę otwiera drogę do cichego wzrostu długu bez czerwonego testu, który by to złapał |

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
cd /private/tmp/cx-day318-testy-puste

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day318-pg psql -U postgres -d cx318 \
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
cd /private/tmp/cx-day318-testy-puste

docker run -d --name cx-day318-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx318 \
  -p 127.0.0.1:6334:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day318-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6334/cx318 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6334/cx318 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day318-testy-puste && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6334/cx318 \
JWT_SECRET=cx318-test-secret-do-not-reuse \
npx vitest run `node scripts/dev/testy-puste-skan.mjs` (czysto plikowy, bez DB) · `npx vitest run tests/unit/config/noEmptyAssertions.test.ts --retry=0` · punktowo każdy plik z kandydatów E0001-E0021 osobno, z cwd zależnym od tego, czy plik jest w `server/` czy w root (sprawdź properly `--config`) · `npx vitest run tests/components/AIChat/MessageBubble.test.tsx --retry=0` jako dowód przykładu ślepej plamy. Ten dyżur w praktyce NIE dotyka realnej bazy Postgres — bloki `§0.2c` (B)/(C) NIE MAJĄ zastosowania, mutacje dowodowe są jednostkowe (mock) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day318-testy-puste-artefakty/day318-testy-puste.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day318-testy-puste && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run `node scripts/dev/testy-puste-skan.mjs` (czysto plikowy, bez DB) · `npx vitest run tests/unit/config/noEmptyAssertions.test.ts --retry=0` · punktowo każdy plik z kandydatów E0001-E0021 osobno, z cwd zależnym od tego, czy plik jest w `server/` czy w root (sprawdź properly `--config`) · `npx vitest run tests/components/AIChat/MessageBubble.test.tsx --retry=0` jako dowód przykładu ślepej plamy. Ten dyżur w praktyce NIE dotyka realnej bazy Postgres — bloki `§0.2c` (B)/(C) NIE MAJĄ zastosowania, mutacje dowodowe są jednostkowe (mock) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day318-testy-puste-artefakty/day318-testy-puste.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day318-testy-puste/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day318-pg psql -U postgres -d cx318 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day318-pg`.
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
> **(e) Skaner `testy-puste-skan.mjs` wymaga sygnału `fetch|axios|request|supertest|db(?:Get|All|Run)|DbPromise|database|query|execute` W TREŚCI bloku `it`, żeby w ogóle rozważyć go jako kandydata (`§ funkcja visit`, warunek `signal`). Test bez ŻADNEGO z tych słów — nawet jeśli asercje są równie słabe — NIE trafia na listę 21 kandydatów. To jest dokładnie 267-plikowa/1766-blokowa ślepa plama: brak sygnału ≠ brak problemu, tylko brak POMIARU**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day318-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day318-testy-puste-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (przeczytaj REJESTR_TESTY_PUSTE_DOWODY_20260904.md i REJESTR_TESTY_PUSTE_20260903.md w całości) · R1 (rozbuduj skaner o detekcję podmiotu-zdefiniowanego-w-pliku, z dowodem na MessageBubble.test.tsx) · R2 (mutacją rozstrzygnij pozostałych kandydatów z rodziny sieć/baza, jeden po drugim, z dopiskiem do REJESTR_..._DOWODY) · R3 (usuń albo napraw api-extensions.test.ts) · R4 (zaktualizuj próg `candidates` w dół, jeśli spadł) · R5 (raport)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6334` albo `5474` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6334` albo `5474`** (`Z7`).

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

Dyżur 309 zbudował `scripts/dev/testy-puste-skan.mjs` i uczciwie odmówił zgadywania: skaner
**nigdy** nadaje klasę `PUSTY` z samego tekstu, tylko z dowodu mutacyjnego, którego sam wykonać
nie może. Postawił też bezpiecznik podłogowy (`tests/unit/config/noEmptyAssertions.test.ts`),
który dziś trzyma: pliki testowe ≥ 5399, kandydaci ≤ 21, pominięte = 0.

Odbiorca adwersaryjny (04.09) wykonał 5 mutacji funkcji produkcyjnych i rozstrzygnął **2 z 21**
jako `PUSTY` (`scimService.test.ts` — 12/12 PASS nawet po `SCIMService.ts → export default {}`;
`contentService.test.ts` „should return dashboard data" — PASS nawet gdy funkcja zwraca
`{-999,-999}`). Trzy pozostałe zmutowane kandydaci (rodziny `billingCron`, `siemService`,
`chatPolicyGateway`) **zaczerwieniły się** po mutacji — NIE są puste, choć `chatPolicyGateway`
broni wyłącznie literału (produkcja bezwarunkowo dopisuje dwa napisy do listy, nie ma tam
egzekucji do zmutowania — słaby, ale nie pusty). **Ekstrapolacja odbiorcy: rzędu 8 pustych
z 21 — to jest SZACUNEK, nie wynik.** Twoim zadaniem jest zmierzyć resztę, nie potwierdzić tę
liczbę.

★ **Główna pozycja tego dyżuru jest inna: ślepa plama skanera.** Skaner wymaga sygnału
sieci/bazy w treści bloku `it` (regex `fetch|axios|request|supertest|db...|query|execute`), więc
**nie widzi w ogóle** testów, które z produktem nie rozmawiają. Zmierzone: **267 plików / 1766
bloków** bez żadnego wiązania z produktem, w tym **13 plików definiujących PODMIOT TESTU
wewnątrz pliku testu**. Sprawdzony na tym markerze przykład:
`tests/components/AIChat/MessageBubble.test.tsx` deklaruje
`const MessageBubble = () => <div data-testid="message-bubble">Message Bubble</div>;` i renderuje
TĘ atrapę — plik nigdy nie importuje prawdziwego
`src/components/AIChat/Messages/MessageBubble.tsx`. Test przechodzi niezależnie od tego, co robi
produkt: to jest kształt „biblioteka bez wywołania" przeniesiony do samych testów.

Osobno: `tests/unit/services/api-extensions.test.ts` testuje moduł, którego w repo **nie ma**
(`grep -rli 'apiExtensions\|api.extensions' src server` zwraca pustkę) — trzy bloki `it` mockują
`global.fetch` i asertują wyłącznie `expect(fetch).toBeDefined()`, z komentarzem w kodzie „This
would be tested with actual API extension implementation. For now, we verify the pattern
exists." Nie ma tu nic do naprawienia mutacją — nie ma produktu pod tym testem.

## ★ Zmierz moje liczby sam

Twierdzę: dziś skaner liczy 5404 pliki (podłoga bezpiecznika: 5399), 42477 bloków, 21
kandydatów, 0 pominiętych. 5 z 21 już rozstrzygniętych (2 PUSTE, 3 NIE). Ślepa plama: 267/1766,
w tym 13 plików z podmiotem zdefiniowanym lokalnie. **Jeśli Twój pomiar przeczy liczbie podanej
w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**,
> a Twoim produktem jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `scripts/dev/testy-puste-skan.mjs` | **★ PEŁNA LICENCJA** — rozbudowa o detekcję podmiotu zdefiniowanego w pliku testu. Zachowujesz istniejące pola wyjścia JSON (`files`,`blocks`,`candidates`,`classes`,`skipped`,`gatedFiles`) i dodajesz nowe, nie usuwasz starych | — |
| `tests/unit/config/noEmptyAssertions.test.ts` | **★ WĄSKA LICENCJA:** wyłącznie stała `BASELINE` — wolno obniżyć `candidates`/podnieść `files`, **ZAKAZ** obniżania `files` albo podnoszenia `candidates`/`skipped` | Czerwony kontrakt + brief w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_20260903.md` | **PEŁNA LICENCJA, ale WYŁĄCZNIE jako wyjście generatora** — regenerujesz uruchamiając skaner, nie edytujesz ręcznie (i tak zniknie przy następnym przebiegu) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md` | **★ PEŁNA LICENCJA na DOPISYWANIE** pod istniejącą tabelą pięciu rozstrzygnięć. **ZAKAZ kasowania cudzych wierszy** | — |
| `tests/components/AIChat/MessageBubble.test.tsx`, `tests/unit/services/scimService.test.ts`, `tests/backend/contentService.test.ts`, `server/src/routes/__tests__/table-platform.routes.test.ts`, `server/src/routes/v8/__tests__/help.routes.test.ts`, `server/src/services/ai/__tests__/chatPolicyGateway.retrieval.test.ts`, `server/src/services/v8/__tests__/governedRetrievalService.test.ts`, `tests/components/Initiatives/CandidatesTable.t28.test.tsx`, `tests/integration/ai/ollama.integration.test.ts`, `tests/integration/mywork/my-work.convert.contract.test.ts`, `tests/integration/pmo-project-members.integration.test.ts`, `tests/integration/services/workbook.p23ext.test.ts`, `tests/unit/backend/aiContextBuilder.test.ts`, `tests/unit/backend/cron/billingCron.test.ts`, `tests/unit/backend/siemService.test.ts` | **★ WĄSKA LICENCJA:** wyłącznie wzmocnienie/naprawa bloku `it` wymienionego w tabeli `B.2` per plik, z dowodem mutacyjnym. **ZAKAZ przepisywania innych bloków w tym samym pliku** | — |
| `tests/unit/services/api-extensions.test.ts` | **★ PEŁNA LICENCJA — WŁĄCZNIE Z USUNIĘCIEM CAŁEGO PLIKU** (R3), bo nie testuje żadnego istniejącego modułu | — |
| `server/src/cron/BillingCron.ts`, `server/src/services/siemService.ts`, `server/src/services/ai/chatPolicyGateway.ts` i inne pliki produkcyjne pod kandydatami z `B.2` | **★ WYŁĄCZNIE JAKO CEL MUTACJI DOWODOWEJ, ZAWSZE COFNIĘTEJ** (`Z32`, `Z27` — kopia przez `cp`, nigdy `git stash`). **ZAKAZ pozostawienia mutacji w kodzie po zakończeniu dowodu** | Jeśli produkt wymaga NAPRAWY (nie tylko dowodu), wpisz `DO DECYZJI WŁAŚCICIELA` z opisem i promieniem, nie zmieniaj bez jawnej zgody |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie, co blokuje pomiar i jak obszedłeś to zmiennymi w linii komendy |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY318_TESTY_PUSTE_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI Z DEFINICJĄ UKOŃCZENIA PER POZYCJA

| Pozycja | Nazwa jednym zdaniem | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R0 | Odczyt obu rejestrów | TAK | NIE | bazowe | Przeczytane, mianowniki zmierzone | `node scripts/dev/testy-puste-skan.mjs` | brak |
| R1 | Detekcja podmiotu-w-pliku-testu | TAK | NIE — dowód: `git grep -n 'function visit' scripts/dev/testy-puste-skan.mjs` | 1 nowy test skryptu | Skaner ma nową funkcję/pole wykrywające deklarację `const/function/class <Pascal>` w pliku testu, użytą jako JSX/wywołanie, bez importu tego identyfikatora z `src`/`server`. `MessageBubble.test.tsx` trafia na tę listę | `node scripts/dev/testy-puste-skan.mjs` → nowe pole np. `selfDefinedSubjects` zawiera ten plik | `feat(testy-puste): detekcja podmiotu zdefiniowanego w pliku testu (318 R1)` |
| R2 | Mutacja pozostałych 14 kandydatów sieć/baza | TAK | NIE, poza wyjątkiem wiersza `Z12` na pliki produkcyjne (mutacja dowodowa, zawsze cofnięta) | 14 dowodów mutacyjnych | Każdy kandydat E0001-E0021 poza już rozstrzygniętymi (E0021,E0007,E0005,E0018 i jedną z dwóch pozycji billingCron) ma wpis w `REJESTR_..._DOWODY` z klasą `PUSTY`/`NIE PUSTY` i komendami obu kierunków | per plik: `npx vitest run <plik> --retry=0` przed/po mutacji | commit per kandydat albo per plik, np. `test(day318): rozstrzyga E0003 table-platform.routes (NIE PUSTY)` |
| R3 | `api-extensions.test.ts` | NIE | NIE | n/d | Plik usunięty (preferowane, bo brak modułu) ALBO przepisany na test realnego modułu, jeśli taki się znajdzie w R0-R2 | `ls tests/unit/services/api-extensions.test.ts` → brak (po usunięciu) | `chore(day318): usuwa test bez produktu — api-extensions.test.ts (318 R3)` |
| R4 | Aktualizacja progu bezpiecznika | NIE | NIE — dowód: wiersz `B.1` | n/d | `BASELINE.candidates` w `noEmptyAssertions.test.ts` odzwierciedla nową, NIŻSZĄ liczbę kandydatów (po R3 spadnie co najmniej o 2) | `npx vitest run tests/unit/config/noEmptyAssertions.test.ts --retry=0` | `chore(day318): obniża podłogę candidates po usunięciu api-extensions (318 R4)` |
| R5 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" niepusta | — | `docs(day318): raport` |

> Żadna pozycja nie wymaga zmiany pliku przekrojowego poza mutacją dowodową (zawsze cofniętą)
> produkcyjnych plików wskazanych w `B.1` — co jest jawnie dozwolone tym samym wierszem.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Pliki testowe | 5404 (mój pomiar 04.09) | `node scripts/dev/testy-puste-skan.mjs` → `files` | TAK |
| 2 | Bloki `it/test` | 42477 | jw. → `blocks` | TAK |
| 3 | Kandydaci sieć/baza | 21 | jw. → `candidates` | TAK |
| 4 | Już rozstrzygnięci (PUSTY) | 2 (`scimService`, `contentService`) | `cat REJESTR_TESTY_PUSTE_DOWODY_20260904.md` | TAK — ręcznie potwierdzone mutacją |
| 5 | Już rozstrzygnięci (NIE PUSTY) | 3 (`billingCron`\*, `siemService`, `chatPolicyGateway`) — \*jedna z dwóch pozycji billingCron | jw. | TAK, z zastrzeżeniem — sprawdź KTÓRA pozycja billingCron |
| 6 | Pozostali do rozstrzygnięcia | 16 (14 mutacją + 2 przez usunięcie `api-extensions`) | 21 − 5 | TAK |
| 7 | Pliki bez sygnału produktu (ślepa plama) | 267 / 1766 bloków | do zbudowania w R1 — dziś brak komendy, bo detekcja nie istnieje | NIE jeszcze — to jest właśnie luka, którą R1 zamyka |
| 8 | Pliki z podmiotem zdefiniowanym lokalnie | 13 | do zbudowania w R1; przykład potwierdzony ręcznie: `tests/components/AIChat/MessageBubble.test.tsx` | Częściowo — jeden przykład potwierdzony, reszta wymaga R1 |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `scripts/dev/testy-puste-skan.mjs` | istniejący | R1 | ZEROWE — plik własny 309 |
| 2 | `tests/unit/config/noEmptyAssertions.test.ts` | istniejący | R4 | ZEROWE |
| 3 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md` | istniejący | R2 | ŚREDNIE — plik ręczny, mógł go dotknąć inny dyżur równolegle; dopisujesz, nie nadpisujesz |
| 4 | 14 plików testowych z tabeli `B.2` | istniejące | R2 | NISKIE |
| 5 | `tests/unit/services/api-extensions.test.ts` | istniejący (usuwany) | R3 | ZEROWE |
| 6 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY318_TESTY_PUSTE_REPORT.md` | NOWY | R5 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/cron/BillingCron.ts`, `server/src/services/siemService.ts`, itd. | R2 | WYŁĄCZNIE tymczasowo, w trakcie mutacji dowodowej; `git diff` po cofnięciu MUSI być pusty przed commitem |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
public/locales/*/translation.json — dyżur 317
scripts/dev/reachability-from-root.mjs, worktree cx-day292/293/297 — dyżur 322
src/components/Interview/**, src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx — dyżur 323
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6334 | `lsof -nP -iTCP:6334 -sTCP:LISTEN` → puste (nieużywany w praktyce) |
| Port harnessu | 5474 | `lsof -nP -iTCP:5474 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day318-pg` | `docker ps` → brak |
| Nazwa bazy | `cx318` | n/d |
| Gałąź | `codex/day318-testy-puste-20260904` | nie istnieje |
| Worktree | `/private/tmp/cx-day318-testy-puste` | nie istnieje |
| Flagi | brak | n/d |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day318-testy-puste
git diff --name-only --cached | tee /private/tmp/cx-day318-testy-puste-artefakty/staged.txt
grep -iE 'public/locales/|reachability-from-root|InsightCreatorModal' /private/tmp/cx-day318-testy-puste-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
git diff --cached -- server/src/cron/BillingCron.ts server/src/services/siemService.ts server/src/services/ai/chatPolicyGateway.ts \
  && echo "★★ SPRAWDZ: czy to mutacja niecofnieta? Jesli TAK — cofnij przed commitem" \
  || echo "produkcja nietknieta OK"
```

---

## R0 — ODCZYT

Przeczytaj `REJESTR_TESTY_PUSTE_DOWODY_20260904.md` i `REJESTR_TESTY_PUSTE_20260903.md`
w całości. Uruchom skaner na swoim markerze i zapisz JSON do artefaktów jako `przed.json`.

Prawo zatrzymania po tej pozycji.

## R1 — DETEKCJA PODMIOTU ZDEFINIOWANEGO W PLIKU TESTU

Rozbuduj `scripts/dev/testy-puste-skan.mjs`: dla każdego pliku testowego znajdź identyfikatory
zaczynające się wielką literą zadeklarowane na najwyższym poziomie modułu (`const X = (...) =>`,
`function X(...)`, `class X`) i sprawdź dwa warunki: (a) identyfikator jest użyty jako JSX
(`<X` lub `<X />`) albo wywołany bezpośrednio gdzieś dalej w pliku, (b) identyfikator o tej samej
nazwie NIE jest importowany z `@/` ani ze ścieżki względnej wskazującej na `src/` lub
`server/src/`. Plik spełniający oba warunki trafia na nową listę (np. pole `selfDefinedSubjects`
w JSON-ie wyjściowym, osobna sekcja w wygenerowanym rejestrze). Zweryfikuj na
`tests/components/AIChat/MessageBubble.test.tsx` — musi się pojawić na liście. Napisz test
jednostkowy skryptu z tym przykładem jako fixture.

★ To jest NOWA lista do przeglądu, nie automatyczny wyrok `PUSTY` — 13 (albo ile realnie wyjdzie)
plików wymaga ręcznego przejrzenia w kolejnym dyżurze (poza zakresem R2-R4 tego dyżuru, chyba że
starczy czasu po rdzeniu).

Prawo zatrzymania po tej pozycji.

## R2 — MUTACJA POZOSTAŁYCH KANDYDATÓW

Dla każdego z 14 kandydatów spoza już rozstrzygniętych pięciu (patrz `B.3` wiersz 6, lista
plików w `B.1`): znajdź funkcję produkcyjną, którą blok `it` rzekomo sprawdza, zmutuj ją tak,
żeby zwracała ewidentnie złą wartość, uruchom test — jeśli **czerwienieje**, kandydat NIE jest
pusty (dopisz do rejestru z komendami obu kierunków); jeśli **zostaje zielony**, kandydat jest
`PUSTY` (napraw asercję albo usuń blok, z dowodem). Zawsze cofnij mutację przez `cp` (`Z27`)
i potwierdź `git diff --check` pusty na pliku produkcyjnym przed commitem. Ustal też, którą
z dwóch pozycji `billingCron` (linia 111 czy 119) zmutował odbiorca — druga zostaje w całości
Twoim zadaniem niezależnie od wyniku pierwszej.

Commit per kandydat albo grupami max 3-4 pokrewnych (np. cała rodzina `ollama.integration.test.ts`
jednym commitem).

Prawo zatrzymania po tej pozycji.

## R3 — `api-extensions.test.ts`

Potwierdź brak modułu produkcyjnego (komenda weryfikacyjna (5) w `§0.1`). Usuń plik. Jeśli
w trakcie R0-R2 znajdziesz realny moduł, do którego te trzy bloki powinny się odnosić — napraw
zamiast usuwać, z realnymi importami i asercjami efektu. Domyślnie: usunięcie.

Prawo zatrzymania po tej pozycji.

## R4 — AKTUALIZACJA PROGU

Po R2-R3 policz nową liczbę kandydatów. Jeśli spadła (powinna spaść co najmniej o 2 z powodu
R3), obniż `BASELINE.candidates` w `tests/unit/config/noEmptyAssertions.test.ts` do nowej
wartości. **Nigdy nie podnosisz** tego progu.

Prawo zatrzymania po tej pozycji.

## R5 — RAPORT

Tabela: kandydat · plik:linia · klasa (PUSTY/NIE PUSTY) · dowód (komenda + wynik obu kierunków)
· commit. Stan detekcji podmiotu-w-pliku (ile plików realnie wyszło, nie tylko przykład).
Stan `api-extensions.test.ts`. Nowa wartość progu. TWIERDZENIA NIEZWERYFIKOWANE — w szczególności
267/1766 ślepej plamy, jeśli R1 nie doprowadzi do pełnego pomiaru tej liczby.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna.
