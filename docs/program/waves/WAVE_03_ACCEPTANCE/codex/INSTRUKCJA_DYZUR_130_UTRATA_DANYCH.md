# INSTRUKCJA DYŻURU nr 130 — Codex — „Interfejs potwierdza zapis, ktorego nie wykonal — 35 miejsc, jedna przyczyna w 28"

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
> **wyłącznie** `/private/tmp/cx-day130-utrata-danych`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `522d49b148b8e035060bf7baeda5897967938f69`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-08-29.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **My Work (Zadanie, Decyzja, Mind Map) · Inicjatywy (dokument inicjatywy) · Megatrendy — trwalosc zapisu zalacznikow, komentarzy, powiazan, interesariuszy i pozycji RAID**.
Trasy front: ``/my-work`, `/initiatives`, `/tools` (Megatrendy)`. Trasy tył: ``server/src/routes/pmo/initiatives.routes.ts`, `server/src/routes/my-work.routes.ts`, `server/src/routes/actionDecisions.routes.ts`, `server/src/routes/tasks.routes.ts` — komplet ustalasz sam greptem w `server/src/Gateway.ts``.

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
WT=/private/tmp/cx-day130-utrata-danych
MARKER=522d49b148b8e035060bf7baeda5897967938f69

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day130-utrata-danych-20260829 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day130-utrata-danych/config.worktree"
cat "$VAULT/worktrees/cx-day130-utrata-danych/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day130-utrata-danych-scratch
mkdir -p /private/tmp/cx-day130-utrata-danych-artefakty

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
git -C "$VAULT" log --oneline 522d49b148b8e035060bf7baeda5897967938f69..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 522d49b148b8e035060bf7baeda5897967938f69..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day130-utrata-danych-20260829
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 522d49b148b8e035060bf7baeda5897967938f69..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `piec` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day130-utrata-danych

# (W1) POTWIERDZ DEFEKT WLASNYM POMIAREM, zanim cokolwiek zmienisz.
#      Liczba 35 pochodzi z pomiaru nadzorcy. Twoja liczba jest wiazaca (Z24).
#      Jej obalenie w KTORAKOLWIEK strone jest SUKCESEM dyzuru.
grep -n "await onUpload" src/components/MyWork/shared/AttachmentsSection.tsx
#   oczekiwane: trafienie ok. :117, a bezposrednio pod nim bezwarunkowy toast.success

# (W2) czy widzet potwierdza sukces SAM, niezaleznie od tego, co zrobil host
grep -n "toast.success" src/components/MyWork/shared/AttachmentsSection.tsx src/components/MyWork/shared/CommentsSection.tsx src/components/MyWork/shared/LinkedItemsSection.tsx
#   oczekiwane: po kilka trafien w kazdym pliku

# (W3) czy ISTNIEJE backend zalacznikow dla inicjatywy/zadania/decyzji
#      NIE zakladaj odpowiedzi — zmierz. Obalenie tezy nadzorcy jest sukcesem.
grep -rn "upload\.\(single\|array\)" server/src/routes/ | grep -icE "initiativ|task|decision"
#   oczekiwane wg pomiaru nadzorcy: 0. Jesli wyjdzie inaczej — wpisz swoja liczbe.
ls server/migrations/ | grep -icE "(initiative|task|decision)_attachment"
#   oczekiwane wg pomiaru nadzorcy: 0

# (W4) wzorzec POPRAWNY, ktory masz powielic (org-scoping, blad, rollback)
sed -n '1,100p' server/src/services/initiative/initiativeLinkedItemsService.ts
#   oczekiwane: organizationId jako PIERWSZY argument kazdej funkcji

# (W5) wzorzec UCZCIWY dla pozycji, ktorych nie da sie dokonczyc (A.5)
grep -n "read-only until persistence" src/components/settings/NotificationRulesBuilder.tsx
#   oczekiwane: trafienie ok. :161 — ekran, ktory NIE UDAJE

# (W6) wolny przedzial migracji — komenda MUSI obejmowac Twoj przedzial
ls server/migrations/ | grep -cE "^202617"
#   oczekiwane: 0
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day130-utrata-danych-20260829` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6013`. Twój JEDYNY port harnessu to `4926 i 4927 (PARA — runtime wymaga obu)`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day130-pg`**. **ZAKAZANE:** ``6008`–`6011` (dyzury 125-128, zwolnione ale zarezerwowane) · `6012` (obcy proces `ssh`, NIE Twoj) · `5432` (systemowy Postgres, NIE Twoj)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — naprawa prostuje istniejace zachowanie i nie odslania zadnego nowego wizualium`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts`, `server/src/middleware/permission.middleware.ts`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/middleware/orgContext.middleware.ts`, `server/src/Gateway.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY130_UTRATA_DANYCH_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_MY_WORK/MODULE_ACCEPTANCE.md`, z zastrzezeniem `Z32`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day130-utrata-danych-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day130-utrata-danych-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **NIE DOTYKASZ KONTRAKTOW KART N** (`taskCardContract.ts`, `decisionCardContract.ts`, `initiativeCardContract.ts`, `insightCardContract.ts`, `notificationCardContract.ts`, `toolCards.contract.ts`, `cardSets.ts`, `cardContract.types.ts`) ani zadnej flagi `cardContract` — trwa osobna praca nad kartami i jej wynik jest u wlasciciela do akceptu. **NIE ZMIENIASZ WYGLADU** zadnego ekranu: nie ruszasz klas Tailwind, ukladu, kolorow ani tekstow widocznych, poza jednym wyjatkiem opisanym w `A.5`. Ten dyzur naprawia TRWALOSC ZAPISU, nie szate. | Naprawa punktowa per ekran bylaby trzydziestopiecio-krotnym powtorzeniem tej samej zmiany; 28 z 35 miejsc ma jedna przyczyne w kontrakcie trzech wspoldzielonych widzetow |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ustawić `EMAIL_LIVE_SEND` na `true`;
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
cd /private/tmp/cx-day130-utrata-danych

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|EMAIL_LIVE_SEND)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day130-pg psql -U postgres -d consultify_w3_mywork_owner_day130 \
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
cd /private/tmp/cx-day130-utrata-danych

docker run -d --name cx-day130-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=consultify_w3_mywork_owner_day130 \
  -p 127.0.0.1:6013:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day130-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6013/consultify_w3_mywork_owner_day130 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6013/consultify_w3_mywork_owner_day130 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day130-utrata-danych && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6013/consultify_w3_mywork_owner_day130 \
JWT_SECRET=cx-day130-jwt-secret-local-only \
npx vitest run tests/unit --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day130-utrata-danych-artefakty/day130-baseline.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day130-utrata-danych && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day130-utrata-danych-artefakty/day130-baseline.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day130-utrata-danych/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day130-pg psql -U postgres -d consultify_w3_mywork_owner_day130 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day130-pg`.
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
> **(e) **POTWIERDZENIE SUKCESU NIE SIEDZI W HANDLERZE, TYLKO WE WSPOLNYM WIDZECIE, KTORY GO WOLA.** `src/components/MyWork/shared/AttachmentsSection.tsx:117-118` robi `await onUpload(files); toast.success(...)` — bezwarunkowo. Handler moze milczec, a uzytkownik i tak widzi „dodano". Mierzac osiagalnosc komunikatu, sprawdzasz WOLAJACEGO, nie handler. To samo dotyczy `CommentsSection` i `LinkedItemsSection` w tym samym katalogu.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day130-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day130-utrata-danych-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`A.1 (pomiar czterowarstwowy), A.2 (kontrakt widzetow) oraz A.3 (podpiecie tam, gdzie endpoint juz istnieje)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6013` albo `4926 i 4927 (PARA — runtime wymaga obu)` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6013` albo `4926 i 4927 (PARA — runtime wymaga obu)`** (`Z7`).

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

---

## ★★ O CO CHODZI W TYM DYŻURZE — jedno zdanie

Doradca dodaje załącznik, komentarz albo pozycję do rejestru ryzyk, **produkt odpowiada „dodano", a po odświeżeniu strony nie ma tego wpisu**. Interfejs potwierdza zapis, którego nigdy nie wykonał.

To nie jest brak funkcji. To jest **kłamstwo interfejsu** — groźniejsze od braku, bo doradca buduje na tym raport dla klienta.

---

## TEZY ZLECENIA — ROZKAZY POMIAROWE, NIE FAKTY

Każde zdanie poniżej pochodzi z pomiaru nadzorcy i **jest do zweryfikowania, nie do przyjęcia na wiarę**.
**Obalenie którejkolwiek tezy jest SUKCESEM dyżuru i wpisujesz je do „Korekt wobec instrukcji" z dowodem.**

**`T1`.** W `src/` jest **35** miejsc o kształcie: handler zapisu zmienia wyłącznie stan lokalny Reacta, użytkownik dostaje potwierdzenie, żadne `Api.post/put/patch/delete` nie leci.
Rozkład wg pomiaru nadzorcy: My Work — Zadanie `11` · Inicjatywy `9` · My Work — Decyzja `9` · Megatrendy `4` · Mind Map `2`. Pozostałe moduły: `0`.
**ZMIERZ SAM. Twoja liczba jest wiążąca (`Z24`).**

**`T2`.** **28 z 35** ma jedną wspólną przyczynę: trzy współdzielone widżety w `src/components/MyWork/shared/` (`AttachmentsSection`, `CommentsSection`, `LinkedItemsSection`) przyjmują od gospodarza funkcję typu `(…) => Promise<void>` i **same, bezwarunkowo, wypisują potwierdzenie sukcesu po `await`**. Kontrakt nie wymaga od gospodarza niczego — `async () => setState(...)` spełnia go idealnie i zwraca spełnioną obietnicę. Każdy ekran, który podłączył goły setter, dostał ciche kłamstwo za darmo.
**ZMIERZ, czy to prawda i czy liczba wynosi 28.**

**`T3`.** Dla załączników plikowych Inicjatywy, Zadania i Decyzji **nie istnieje żaden backend**: ani tabela, ani trasa przyjmująca plik, ani serwis. W repo są wyłącznie załączniki czatu, spotkań, notatnika i platformy tabel.
**ZMIERZ (`W3`). Jeżeli backend istnieje — obalasz tezę, pomijasz `A.4` i piszesz o tym w Korektach.**

**`T4`.** Wzorzec POPRAWNY istnieje w tym samym produkcie i masz go powielić, nie wymyślać: `src/components/Initiatives/sections/LinkedItemsSection.tsx` + `server/src/services/initiative/initiativeLinkedItemsService.ts` + trasy `server/src/routes/pmo/initiatives.routes.ts:3960-3970` + migracja `server/migrations/20260621_1000_initiative_linked_items.sql`.
Kolejność, która jest istotą wzorca: **`await Api.*` → sukces → `setState` → komunikat**; przy błędzie **cofnięcie stanu i komunikat o błędzie**.

**`T5`.** Istnieje też wzorzec UCZCIWY dla funkcji niegotowej: `src/components/settings/NotificationRulesBuilder.tsx:161` mówi użytkownikowi wprost, że rzecz jest tylko do odczytu, dopóki zapis nie zostanie podłączony. **Ekran nie udaje.** To jest właściwa odpowiedź tam, gdzie zapisu nie da się dokończyć w tym dyżurze.

---

## SEKCJA D — POZYCJE DYŻURU

### `A.1` — POMIAR CZTEROWARSTWOWY (rdzeń, produkt: tabela)

Dla **każdego** znalezionego miejsca podaj **cztery warstwy**, nie jedną:

1. **TYP** — czy istnieje typ/pole dla tego obiektu.
2. **BAZA** — czy istnieje tabela albo kolumna, która to przechowa.
3. **ENDPOINT** — czy istnieje trasa zapisu **oraz** trasa odczytu.
4. **★ KONSUMENT RENDEROWANY** — czy ekran, w którym siedzi handler, jest **faktycznie renderowany**.

> **★★ CZWARTA WARSTWA JEST OBOWIĄZKOWA I NAJCZĘŚCIEJ POMIJANA.**
> W tym repozytorium `grep` systematycznie kłamie w stronę „działa". Udowodniony przykład: katalog `src/components/Initiatives/sections/` ma 29 komponentów w rejestrze, a `InitiativeDocumentView.tsx` — **jedyny konsument rejestru w całym repo** — instancjonuje **7** z nich po twardych kluczach. Nie ma generycznej pętli renderującej. Pozostałe 22 to kod martwy, mimo że mają importy, wpisy w rejestrze i wpisy w mapie widoczności.
> **Dowodem osiągalności jest wskazanie miejsca, które instancjonuje komponent w JSX albo pętli, która go renderuje. `import` nie jest dowodem. Wpis w rejestrze nie jest dowodem.**

Werdykt per miejsce: **ŻYWE** (4/4) · **NIEDOKOŃCZONE** (podaj, której warstwy brak) · **MARTWE** (nie renderuje się — wtedy NIE naprawiasz, tylko zgłaszasz).

**Nie naprawiasz kodu martwego.** Naprawa niewidocznego ekranu to zmarnowany dyżur — dokładnie ten błąd popełniono w dyżurze 128.

---

### `A.2` — KONTRAKT WIDŻETÓW (rdzeń, największa dźwignia)

Trzy widżety w `src/components/MyWork/shared/` mają przestać potwierdzać sukces na własną rękę.

**Co ma być prawdą po zmianie:**

- funkcja przekazywana przez gospodarza **zwraca wynik zapisu**, nie `void` — tak, żeby typ wymuszał odpowiedź na pytanie „czy się udało";
- widżet wypisuje potwierdzenie **wyłącznie wtedy, gdy gospodarz potwierdził zapis**;
- gdy gospodarz zgłasza porażkę — widżet pokazuje **błąd**, a stan wraca do poprzedniego;
- **gospodarz, który nie zapisuje, nie ma jak udać sukcesu** — to jest właściwy cel tej pozycji.

**Bez tego kroku regresja wróci.** Kontrakt, który da się spełnić gołym setterem, zostanie spełniony gołym setterem — dziś albo za miesiąc.

---

### `A.3` — PODPIĘCIE TAM, GDZIE ENDPOINT JUŻ ISTNIEJE (rdzeń)

Dla każdego miejsca z `A.1` o werdykcie **NIEDOKOŃCZONE**, gdzie brakuje wyłącznie warstwy czwartej — podepnij front do istniejącego endpointu, dokładnie wg wzorca z `T4`.

**Kolejność jest wiążąca:** `await Api.*` → sukces → `setState` → komunikat. Przy błędzie: cofnięcie stanu i komunikat o błędzie.
**Zakaz optymistycznego `setState` przed odpowiedzią serwera bez cofania przy błędzie** — to produkuje tę samą wadę w łagodniejszej postaci.

Znane kandydatury do sprawdzenia (**nie przyjmuj na wiarę, zmierz**):
- pozycje rejestru RAID w kanwie Inicjatywy — działający `Api.post('/initiatives/:id/raid')` i `Api.delete` leżą **w tym samym pliku**, kilka tysięcy linii wyżej, i kanwa ich nie używa;
- komentarze Zadania i Decyzji — w Inicjatywie identyczny komentarz **jest** persystowany przez `Api.post('/initiatives/:id/comments')`.

---

### `A.4` — BACKEND ZAŁĄCZNIKÓW, JEŻELI `T3` SIĘ POTWIERDZI

Wykonujesz **tylko wtedy**, gdy `W3` potwierdzi brak backendu.

Budujesz wg wzorca, który w tym produkcie **już działa i jest sprawdzony**:

- **warstwa danych i org-scoping** — 1:1 z `initiativeLinkedItemsService.ts`: `organizationId` jako **pierwszy argument każdej funkcji** i w `WHERE` **każdego** zapytania, także `DELETE`; walidacja wejścia przed SQL; obsługa błędu, która **nigdy nie udaje sukcesu**;
- **warstwa bajtów** — wzorzec `server/src/routes/assessment/assessment-level-attachments.routes.ts`: `multer.diskStorage`, katalog per organizacja, w bazie **wyłącznie metadana i ścieżka**, limit rozmiaru, sanityzacja nazwy;
- **migracja** — addytywna i idempotentna, `IF NOT EXISTS`, `organization_id` jako kolumna pierwszej klasy, indeks na kształcie zapytania, nagłówek mówiący **dlaczego** powstała. Przedział `20261700`–`20261719`, **wyłącznie Twój**.

> **★ OSTRZEŻENIE OPERACYJNE, KTÓRE MASZ WPISAĆ DO RAPORTU.**
> Wzorzec `assessment-level-attachments` trzyma pliki na dysku pod `process.cwd()/uploads`. Na Railway **to wymaga wolumenu, inaczej pliki znikają przy redeployu**. Komentarz w kodzie tego wzorca sam to sygnalizuje. Nie rozwiązujesz tego w tym dyżurze — **masz to jawnie zgłosić jako ryzyko wdrożeniowe z rekomendacją**.

---

### `A.5` — UCZCIWY STAN TAM, GDZIE ZAPISU NIE DA SIĘ DOKOŃCZYĆ

Dla miejsc, których nie domykasz w tym dyżurze — **ekran ma przestać kłamać**.

Wzorzec do powielenia: `NotificationRulesBuilder.tsx:161`. Użytkownik dowiaduje się wprost, że rzecz jest tylko do odczytu, dopóki zapis nie zostanie podłączony.

**Wymagania:**
- komunikat **po polsku**, pełnym zdaniem, mówiący **co jest niedostępne i dlaczego**;
- klucz dopisany do `pl` **i** `en` w tym samym commicie — **parytet obowiązkowy** (brak klucza `en` powoduje, że anglojęzyczny użytkownik zobaczy surowy tekst z kodu; dokładnie na tym poległ dyżur 128);
- **zakaz** cichego wyłączania przycisku bez wyjaśnienia — to zamienia jedną wadę na drugą;
- **zakaz** kasowania funkcji. Uczciwy stan „jeszcze nie zapisuje" jest wzorcem **poprawnym** (`Z16`), pusty ekran nie jest.

---

### `A.6` — DOWÓD MUTACYJNY W OBIE STRONY (`Z32`)

Dla **każdej** naprawionej pozycji:

1. psujesz naprawę → test **CZERWONY**;
2. przywracasz → test **ZIELONY**;
3. `git diff` po przywróceniu **pusty**.

Obie komendy i oba wyniki **dosłownie w raporcie**. Mutację cofasz przez `cp` (`Z27`), nigdy `git stash`.

> **★ Test, który przechodzi także przed naprawą, jest TAUTOLOGIĄ i nie dowodzi niczego.**
> Sprawdź to jawnie dla każdego nowego testu. Dyżur 128 dostał asercję dopasowującą jeden kształt zapisu i był ślepy na ten sam defekt zapisany inaczej — **asercja ma łapać KLASĘ wady, nie jeden jej kształt**.

---

## SEKCJA E — CZEGO KANON NIE OPISUJE

Poniższe reguły **nie istnieją** w dokumentacji produktu. Proponuję je i **oznaczam jako nowe**, żeby nie weszły przemycone jako „przecież tak zawsze było". Stosujesz je w tym dyżurze; rozstrzygnięcie ostateczne należy do właściciela.

1. **Potwierdzenie sukcesu wolno pokazać wyłącznie po potwierdzonym zapisie.** Dziś żaden dokument tego nie mówi, a trzy widżety robią odwrotnie.
2. **Komponent współdzielony nie może potwierdzać sukcesu za gospodarza.** Jeżeli widżet nie wie, czy zapis się udał, nie ma prawa twierdzić, że się udał.
3. **Stan „jeszcze nie zapisuje" jest stanem legalnym i musi być nazwany.** Lepszy uczciwy komunikat niż fałszywe potwierdzenie.

Jeżeli którakolwiek z tych reguł koliduje z czymś, co znajdziesz w repo — **zgłoś kolizję w raporcie**, nie rozstrzygaj sam.

---

## SEKCJA F — CO ODDAJESZ

1. **Tabela pomiaru `A.1`** — wszystkie znalezione miejsca, cztery warstwy, werdykt per miejsce.
2. **Kontrakt widżetów** (`A.2`) z dowodem mutacyjnym.
3. **Lista podpiętych miejsc** (`A.3`), każde z dowodem mutacyjnym.
4. **Backend załączników** (`A.4`), jeżeli `T3` się potwierdziła — z ostrzeżeniem o wolumenie.
5. **Lista miejsc doprowadzonych do uczciwego stanu** (`A.5`).
6. **Lista miejsc NIENAPRAWIONYCH** z powodem — to jest pełnoprawny produkt dyżuru, nie porażka.
7. **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE"** — niepusta.

**Uczciwe „zrobiłem 20 z 35 i oto dlaczego" jest warte więcej niż „35 z 35" bez dowodu mutacyjnego.**

---

## SEKCJA G — CZEGO NIE ROBISZ

- **nie ruszasz kart N ani flag `cardContract`** — trwa osobna praca i jej wynik czeka u właściciela;
- **nie zmieniasz wyglądu** — bez zmian klas, układu i kolorów; jedyny wyjątek to komunikat z `A.5`;
- **nie dotykasz katalogów tłumaczeń poza dopisaniem kluczy `A.5`** — teren dyżuru 127;
- **nie naprawiasz kodu martwego** — zgłaszasz go w tabeli `A.1`;
- **nie poszerzasz zakresu.** Defekt obok: zgłaszasz z `plik:linia`, nie naprawiasz.
