# INSTRUKCJA DYŻURU nr 246 — Codex — „★★ DOMIAR AUDYTU UPRAWNIEŃ — 168 KANDYDATÓW NIGDY NIE PRZECZYTANYCH DO SQL, TEN DYŻUR CZYTA KOLEJNYCH 60-80 I TYLKO MIERZY. Audyt źródłowy (`docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md`, sekcja „Czego NIE dało się sprawdzić”) stwierdza wprost: z 291 plików tras nie dotkniętych wcześniejszą historią napraw cross-org/IDOR, przesianych heurystycznie do 198 kandydatów, **indywidualnie odczytano kod ok. 30**, **pozostałe ~168 NIE zostały jeszcze odczytane**. Dyżur 242 (wydany tego samego dnia) doczytał już 19 z nich imiennie wymienionych w audycie jako wysokiego ryzyka — zweryfikowane bezpośrednio: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_242_UPRAWNIENIA.md §3 R3` wylicza dokładnie te 19 ścieżek. **Moja własna, świeża rekonstrukcja tej samej trójstopniowej metody audytu (na SHA `818e9cec0b`, `§R1` tej instrukcji) daje 154 kandydatów heurystycznych i 140 pozostających do przeczytania po odjęciu 19 z dyżuru 242 i rodzin już opisanych w audycie jako bezpieczne/dziurawe — rząd wielkości zgodny z audytem (198→154), liczby DOKŁADNE różnią się, bo repo się przesunęło i moja rekonstrukcja skryptu nie jest bajt-w-bajt kopią oryginalnego** (to NIE jest sprzeczność — to jest świeży pomiar, `Z24`). Ten dyżur bierze **konkretną, imiennie wypisaną listę 70** z tej puli (`§3 R2`) jako przydział — jeżeli Twoja WŁASNA świeża regeneracja różni się, Twój pomiar jest wiążący, ale masz przeczytać PODOBNĄ LICZBĘ (60-80) plików, nie mniej."

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
> **wyłącznie** `/private/tmp/cx-day246-domiar-audytu`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `df7f13056f`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-01.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****PRZEKROJOWE — POMIAR, BEZ NAPRAWY. Domiar audytu izolacji organizacji (`server/src/routes/**`): audyt z 2026-09-01 przesiał statycznie 6221 deklaracji tras → 198 kandydatów (heurystyka obecności `organization_id`/`organizationId`/`orgId`) → przeczytał do samego zapytania SQL tylko ok. 30. Ten dyżur czyta KOLEJNYCH 60-80 z pozostałych ~168 nieprzeczytanych i zgłasza dziury z dowodem — nie naprawia niczego.****.
Trasy front: `brak w zakresie tego dyżuru — nie zmieniasz frontu, nie sprawdzasz konsumentów, to dyżur wyłącznie pomiarowy po stronie `server/src/routes/**``. Trasy tył: `70 plików wymienionych imiennie w `§3 R2` (podzbiór puli 140 z `§3 R1`) — WYŁĄCZNIE ODCZYT, zero zmian w jakimkolwiek z nich`.

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
WT=/private/tmp/cx-day246-domiar-audytu
MARKER=df7f13056f

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day246-domiar-audytu-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day246-domiar-audytu/config.worktree"
cat "$VAULT/worktrees/cx-day246-domiar-audytu/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day246-domiar-audytu-scratch
mkdir -p /private/tmp/cx-day246-domiar-audytu-artefakty

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
git -C "$VAULT" log --oneline df7f13056f..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only df7f13056f..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day246-domiar-audytu-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only df7f13056f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: populacja kandydatow da sie odtworzyc metoda audytu (live route files
#     importowane bezposrednio przez Gateway.ts jako './routes/NAZWA.js')
grep -oE "from '\./routes/[^']+\.js'" server/src/Gateway.ts | sed "s#from '\./routes/##; s#\.js'##" | sort -u | wc -l
#   oczekiwane: liczba bliska 346 (Twoja moze sie nieco roznic, repo sie przesuwa —
#   to jest WYNIK, nie sprzecznosc, zapisz swoja liczbe)

# (2) TEZA: pozycje Twojej listy odczytania (R2) NIE pokrywaja sie z 19 plikami
#     juz przeczytanymi w R3 dyzuru 242 — sprawdz recznie, przyklad dwoch pozycji z R3(242):
grep -n "server/src/routes/access-control.routes.ts\|server/src/routes/admin-bulk.routes.ts" docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_242_UPRAWNIENIA.md
#   oczekiwane: zero trafien — lista przydzielona w R2 tej instrukcji jest juz oczyszczona
#   z pokrywania sie z dyzurem 242, ale przeczytaj obie listy recznie i porownaj w calosci

# (3) TEZA: przynajmniej czesc z 70 przydzielonych plikow istnieje na Twoim SHA
for f in server/src/routes/access-control.routes.ts server/src/routes/admin-bulk.routes.ts server/src/routes/help.routes.ts server/src/routes/interviewCandidateHandoff.routes.ts; do [ -f "$f" ] && echo "OK $f" || echo "BRAK $f"; done
#   oczekiwane: wszystkie OK — jesli ktorys BRAK, zanotuj w Korektach i zastap
#   kolejnym nieprzeczytanym plikiem z puli 140 (patrz R1)

# (4) TEZA: pozycja 'audits/index.ts' MOZE byc plikiem-barrelem, nie realna trasa
grep -c "router\.\(get\|post\|put\|patch\|delete\)(" server/src/routes/audits/index.ts
#   oczekiwane: sprawdz sam — jesli 0, to nie jest trasa z handlerami, zastap ja

# (5) TEZA: audyt zrodlowy mial dokladnie te liczby (6221 tras, 198 kandydatow, ~30 przeczytanych)
grep -n "6221\|198 kandydat\|ok\. 30" docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md
#   oczekiwane: trafienia potwierdzajace te liczby w tekscie audytu

# (6) TEZA: dyzur 242 R3 wymienia dokladnie 19 plikow jako juz przeczytane
grep -c "\.routes\.ts$" docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_242_UPRAWNIENIA.md
#   oczekiwane: rzad wielkosci 19 w bloku R3 — policz recznie w tekscie, grep powyzej
#   moze zlapac tez wzmianki poza blokiem R3, wiec traktuj to jako pomoc, nie finalny wynik

# (7) TEZA: 'server/src/routes/pmo/stakeholders.routes.ts' (przyklad bezpiecznej rodziny
#     z audytu) faktycznie przekazuje organizationId do serwisu
grep -n "organizationId\|organization_id" server/src/routes/pmo/stakeholders.routes.ts | head -5
#   oczekiwane: co najmniej jedno trafienie — potwierdza wzorzec bezpiecznej delegacji

# (8) TEZA: miejsce na dysku wystarcza (ten dyzur i tak nie startuje kontenera —
#     patrz Z9a nizej, ale sprawdz i tak, bo klonujesz worktree)
df -h /
#   oczekiwane: powyzej 5 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day246-domiar-audytu-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6232`. Twój JEDYNY port harnessu to `5212 i 5213`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day246-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6229, 5010-5209, 6404-6411, 6600-6830 (obejmuje też dyżury 242-244). Twoje własne: baza 6232, harness 5212 i 5213. Cudze — siostrzane dyżury TEJ SAMEJ paczki (245-249, wydane 2026-09-01), nie dotykasz: baza 6230/harness 5210-11 (dyżur 245 Uprawnienia Flaga), baza 6234/harness 5214-15 (dyżur 247 Próbka Naprawione), baza 6236/harness 5216-17 (dyżur 248 Martwe Bliźniaki), baza 6238/harness 5218-19 (dyżur 249 Sygnatura Bez Zabezpieczenia). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi. `Z10` obowiązuje bez wyjątku — ten dyżur nic nie naprawia, więc pytanie o flagi w zasadzie nie powinno się pojawić; jeśli się pojawi, to znak, że wyszedłeś poza zakres pomiaru.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/admin.middleware.ts` · `server/src/middleware/rbac.middleware.ts` · `server/src/middleware/effectiveCapability.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY246_DOMIAR_AUDYTU_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć, to jeden nowy wpis (nie edycja istniejących wierszy) w rejestrze dowodowym `docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` — WYŁĄCZNIE nowa sekcja na końcu pliku „## Dzień 246 — domiar: kolejne 60-80 kandydatów przeczytane” z tabelą klasyfikacji (bezpieczny / dziurawy-niepoprawiony / globalny-poza-zakresem) i dowodem `plik:linia` dla każdej pozycji. Zakaz kasowania, nadpisywania lub przepisywania istniejącej treści tego pliku. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day246-domiar-audytu-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day246-domiar-audytu-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ NAPRAWY CZEGOKOLWIEK.** Ten dyżur mierzy i zgłasza — nawet jeśli znajdziesz dziurę identyczną do trzech już naprawionych dziś, NIE dotykasz kodu produkcyjnego. Produktem jest wpis w tabeli klasyfikacji z pełnym dowodem `plik:linia` i cytatem zapytania SQL, ewentualnie gotowy diff naprawy W BLOKU KODU, NIENAŁOŻONY, jako rekomendacja dla kolejnej paczki. **ZAKAZ czytania plików spoza przydzielonej listy 70** bez zanotowania podmiany (patrz pułapka wyżej) — jeśli podmieniasz pozycję, zapisz starą i nową ścieżkę w raporcie. **ZAKAZ liczenia wystąpień `organization_id` jako miary kontroli** — czytasz zapytanie, nie grepujesz obecność identyfikatora w pliku (kształt 23). | Audyt sam siebie ostrzega: przesiał 198 kandydatów i przeczytał tylko ok. 30 — czyli 85% populacji kandydatów pozostaje niezweryfikowane w chwili wydania audytu. Trzy z sześciu przeczytanych dziś dziur (Permission Requests, Videos, Context) okazały się realne mimo że nie były na liście „bezpiecznych” — czyli baza kandydatów rzeczywiście zawiera dziury, nie tylko szum. Skoro 85% nie zostało przeczytane, matematycznie prawdopodobne jest, że kolejne dziury tej klasy czekają w nieprzeczytanej części. Ten dyżur nie może przeczytać wszystkich 168 na raz (zbyt duży zakres na jeden dyżur, ryzyko płytkiego czytania pod presją czasu) — czyta kolejny, konkretny wycinek i **zgłasza**, zostawiając naprawę kolejnej paczce, dokładnie jak zaleca metoda audytu źródłowego. |

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
cd /private/tmp/cx-day246-domiar-audytu

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day246-pg psql -U postgres -d cx246 \
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
cd /private/tmp/cx-day246-domiar-audytu

docker run -d --name cx-day246-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx246 \
  -p 127.0.0.1:6232:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day246-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6232/cx246 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6232/cx246 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day246-domiar-audytu && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6232/cx246 \
JWT_SECRET=cx246-test-secret-do-not-reuse \
npx vitest run brak — ten dyżur nie tworzy testów, jest wyłącznie pomiarowy (statyczne czytanie kodu) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day246-domiar-audytu-artefakty/day246-pomiar.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day246-domiar-audytu && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run brak — ten dyżur nie tworzy testów, jest wyłącznie pomiarowy (statyczne czytanie kodu) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day246-domiar-audytu-artefakty/day246-pomiar.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day246-domiar-audytu/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day246-pg psql -U postgres -d cx246 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day246-pg`.
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
> **(e) ★★ DUŻA CZĘŚĆ KODU DELEGUJE KONTROLĘ ORGANIZACJI DO WARSTWY SERWISU — BRAK `organization_id` W SAMEJ TRASIE NIE JEST JESZCZE DOWODEM DZIURY.** Audyt źródłowy złapał na tym własne fałszywe alarmy (`interview-enterprise.routes.ts`, `pmo/stakeholders.routes.ts`, `pmo/execution.routes.ts` — wszystkie POPRAWNIE scope'ują przez `organizationId` przekazywany w dół do serwisu). **Musisz dojść do faktycznego zapytania SQL** (trasa → kontroler/serwis → `WHERE`), nie zatrzymywać się na trasie. Druga pułapka, imienna: pozycja #29 na Twojej liście (`server/src/routes/audits/index.ts`) MOŻE być plikiem-barrelem (re-export), nie realną trasą z handlerami — sprawdź `grep -c "router\.\(get\|post\|put\|patch\|delete\)" <plik>` PRZED czytaniem jego SQL; jeśli `0`, zanotuj to i zastąp go KOLEJNYM nieprzeczytanym plikiem z puli `§3 R1` (140 pozycji), żeby dotrzymać liczby 60-80 rzeczywiście przeczytanych tras. Trzecia pułapka: tabele globalne dla platformy (`verifySuperAdmin`, brak kolumny `organization_id` z definicji) są POZA zakresem tej klasy dziury — nie zgłaszaj ich jako „dziurawe", zanotuj jako „nie dotyczy" z uzasadnieniem.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day246-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day246-domiar-audytu-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (świeża regeneracja puli kandydatów, warunek wejścia) · R2 (przeczytanie 60-80 plików do SQL, klasyfikacja) · R3 (raport)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6232` albo `5212 i 5213` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6232` albo `5212 i 5213`** (`Z7`).

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

# 1. PO CO TEN DYŻUR ISTNIEJE

Audyt z 2026-09-01 (`docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md`) opisuje wprost
własne granice w sekcji „Czego NIE dało się sprawdzić": statyczny przesiew objął **6221**
deklaracji tras, z czego **923** przyjmowały identyfikator obiektu wprost w operacjach
GET-jeden/PUT/PATCH/DELETE/POST-na-obiekcie. Po odjęciu **290 plików** już dotkniętych
wcześniejszą historią napraw cross-org/IDOR/tenant zostało **291 plików nie dotkniętych żadną
znaną naprawą tej klasy**. Filtr heurystyczny (obecność `organization_id`/`organizationId`/
`orgId`/`requireOrgAccess` w pliku trasy lub wywoływanym kontrolerze/serwisie) zawęził to do
**198 kandydatów**. **Indywidualnie odczytano kod aż do zapytania SQL tylko dla ok. 30 z nich.**
**Pozostałe ~168 kandydatów nigdy nie zostały odczytane.**

Trzy z sześciu dziur znalezionych DZIŚ (Permission Requests, Videos, AI Context) pochodzą z tej
samej metody przesiewu — czyli baza kandydatów naprawdę zawiera dziury, nie tylko szum
heurystyki. Skoro 85% populacji kandydatów (168 z 198) nigdy nie zostało przeczytane, jest
matematycznie prawdopodobne, że w nieprzeczytanej części czekają kolejne.

Dyżur 242 (wydany tego samego dnia) doczytał już **19** plików z imiennie wymienionej,
wysokiego ryzyka podlisty audytu (`ai/*`, `assessment-ai`, `billing/*`, `revenue`, `knowledgeBase`,
`scenarios`, `baselines`, `assessmentEvidence`, `core-docs`, `caseWorkspace/intake`,
`v8/admin/partner-review`, `organization/rbac` warianty `/roles/:roleId/permissions`) —
zweryfikowane bezpośrednio w treści `docs/program/waves/WAVE_03_ACCEPTANCE/codex/
INSTRUKCJA_DYZUR_242_UPRAWNIENIA.md §3 R3`.

**Ten dyżur czyta KOLEJNYCH 60-80 z pozostałych, jeszcze nieprzeczytanych kandydatów. Nie
naprawia niczego — mierzy i zgłasza.**

## Metoda regeneracji populacji — MUSISZ ją powtórzyć na własnym SHA (`R1`)

Audyt nie zostawił skryptu ani finalnej listy plików — tylko opis trzystopniowej metody. Poniżej
jest **moja własna, świeża rekonstrukcja** tej metody wykonana na SHA `818e9cec0b` (świeższym niż
marker `df7f13056f`, marker jest jego przodkiem), z pełnymi komendami. **Liczby, które dostaniesz
Ty, mogą się różnić od moich — to NIE jest sprzeczność, to świeży pomiar (`Z24`). Wiążący jest
Twój wynik.**

1. **Trasy żywe** — pliki tras faktycznie importowane przez `Gateway.ts` jako `./routes/NAZWA.js`
   (bezpośredni import, nie przez martwy barrel `routes/index.ts` — sprawdzone osobno: ten barrel
   nie jest importowany NIGDZIE w `server/src`, żadna z jego reeksportowanych nazw nie jest przez
   to „żywa" tylko dzięki niemu). Dało to **346** plików na moim SHA.
2. **Odjęcie „dotkniętych historią"** — pliki wymienione w `--name-only` commitów pasujących do
   `git log -i -E --grep="IDOR|cross-org|cross organization|tenant isolation|org(anization)?
   isolation"`, ograniczone do `server/src/routes/**/*.routes.ts` bez `__tests__`. Dało to **117**
   plików na moim SHA (audyt źródłowy podał 290 — rozjazd wynika z innej metody grep audytu,
   niekoniecznie identycznej z powyższą, i z tego że repo urosło od 2026-09-01 rano). Odjęcie od
   346 dało **229** „nietkniętych”.
3. **Filtr heurystyczny** — obecność `organization_id`/`organizationId`/`orgId`/`requireOrgAccess`
   gdziekolwiek w treści pliku. Dało to **154 kandydatów** z 229 „nietkniętych” na moim SHA (rząd
   wielkości zgodny z audytowym 198, dokładna liczba różna z tych samych powodów co w punkcie 2).

**Komendy do powtórzenia (wklej dosłownie, zastępując wynikami swoje dalsze kroki):**

```bash
cd "$WT"

# krok 1 — trasy zywe
grep -oE "from '\./routes/[^']+\.js'" server/src/Gateway.ts \
  | sed "s#from '\./routes/##; s#\.js'##" | sort -u > /tmp/live_specs_246.txt
wc -l /tmp/live_specs_246.txt

# krok 2 — pliki dotkniete historia IDOR/cross-org (nazwy commitow, nie tresc diffu)
git log -i -E --grep="IDOR|cross-org|cross organization|tenant isolation|org(anization)? isolation" \
  --name-only --pretty=format: | grep '^server/src/routes/' | grep -v '__tests__' \
  | grep -E '\.routes\.ts$' | sort -u > /tmp/touched_246.txt
wc -l /tmp/touched_246.txt

# krok 3 — kandydaci: zywe MINUS dotkniete, potem filtr organizacyjny.
# NIE wklejaj tego skryptu przez heredoc w linii komendy — zapisz go najpierw
# jako plik przez swoje narzedzie edycji plikow (Write/Edit), dopiero
# potem uruchom ponizsza komende:
python3 /tmp/regen_candidates_246.py
```

Treść pliku `/tmp/regen_candidates_246.py`, który zapisujesz PRZED uruchomieniem powyższej
komendy:

```python
import re, os
live = set()
for spec in open('/tmp/live_specs_246.txt'):
    spec = spec.strip()
    f = f"server/src/routes/{spec}.ts"
    if os.path.isfile(f):
        live.add(f)
touched = set(l.strip() for l in open('/tmp/touched_246.txt') if l.strip())
untouched = sorted(live - touched)
candidates = []
for f in untouched:
    try:
        content = open(f, encoding='utf-8', errors='ignore').read()
    except Exception:
        continue
    if re.search(r'organization_id|organizationId|orgId|requireOrgAccess', content):
        candidates.append(f)
print("live:", len(live), "untouched:", len(untouched), "candidates:", len(candidates))
open('/tmp/candidates_246.txt', 'w').write('\n'.join(sorted(candidates)) + '\n')
```

**Zapisz swoje trzy liczby (żywe / nietknięte / kandydaci) do raportu z pełnym wyjściem powyższych
komend — to jest Twój mianownik, nie mój.**

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Audyt źródłowy podaje 6221 deklaracji tras, 198 kandydatów, ok. 30 przeczytanych do SQL | komenda (5) |
| T2 | Populacja kandydatów da się odtworzyć trzystopniową metodą audytu, choć dokładne liczby dryfują | `§1` metoda + Twoje własne wykonanie w `R1` |
| T3 | Dyżur 242 doczytał już 19 imiennie wymienionych plików z wysokiego ryzyka | komenda (6) |
| T4 | Duża część kodu deleguje kontrolę do warstwy serwisu — sam brak w trasie nie jest jeszcze dowodem dziury | komenda (7) |
| T5 | Pozycja „audits/index.ts" na przydzielonej liście może być barrelem, nie realną trasą | komenda (4) |
| T6 | Przydzielone 70 plików istnieją na Twoim SHA (przynajmniej próbka) | komenda (3) |
| T7 | Miejsce na dysku wystarcza | komenda (8) |

---

# 3. POZYCJE DYŻURU

## R1 — ŚWIEŻA REGENERACJA PULI KANDYDATÓW (rdzeń, warunek wejścia)

Wykonaj dosłownie trzy komendy z `§1` powyżej NA WŁASNYM SHA. Porównaj swoją liczbę kandydatów
z moją (154). Jeżeli różnica jest duża (poniżej 100 albo powyżej 250) — zanotuj to w „Korektach
wobec instrukcji" z pełnym wyjściem komend, ale **kontynuuj z WŁASNĄ listą**, nie z moją poniżej —
Twój pomiar wygrywa (`Z24`).

## R2 — PRZECZYTANIE 60-80 PLIKÓW DO SQL, KLASYFIKACJA (rdzeń)

**Przydzielona lista 70 plików** (podzbiór mojej puli 140 = 154 kandydatów minus 19 już
przeczytanych przez dyżur 242 minus rodziny nazwane w audycie jako już bezpieczne/dziurawe).
Jeżeli Twoja `R1` dała podobną populację — użyj tej listy. Jeżeli Twoja populacja różni się
istotnie — wybierz WŁASNYCH 60-80 z Twojej listy, priorytetyzując pliki NIE wymienione w
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_242_UPRAWNIENIA.md §3 R3` ani w
tabeli „bezpieczne"/„dziurawe" audytu źródłowego:

```
server/src/routes/access-control.routes.ts
server/src/routes/admin-bulk.routes.ts
server/src/routes/admin/ai-observability.routes.ts
server/src/routes/admin/audit-export-history.routes.ts
server/src/routes/admin/backup.routes.ts
server/src/routes/admin/billing-history.routes.ts
server/src/routes/admin/domains.routes.ts
server/src/routes/admin/enterprise-compliance.routes.ts
server/src/routes/admin/guests.routes.ts
server/src/routes/admin/health-panel.routes.ts
server/src/routes/admin/legal-hold.routes.ts
server/src/routes/admin/organization-profile.routes.ts
server/src/routes/admin/seats.routes.ts
server/src/routes/admin/security-alerts.routes.ts
server/src/routes/admin/sessions.routes.ts
server/src/routes/adminIntegrations.routes.ts
server/src/routes/agents.routes.ts
server/src/routes/ai-operator.routes.ts
server/src/routes/ai-prompts.routes.ts
server/src/routes/ai/ai-feedback.routes.ts
server/src/routes/analytics.routes.ts
server/src/routes/artifact-runs.routes.ts
server/src/routes/artifactApprovals.routes.ts
server/src/routes/artifactLineage.routes.ts
server/src/routes/assessment-enterprise.routes.ts
server/src/routes/assessment/assessment-workflow.routes.ts
server/src/routes/audit-events.routes.ts
server/src/routes/audit.routes.ts
server/src/routes/audits/index.ts
server/src/routes/benchmark.routes.ts
server/src/routes/benefitsRegister.routes.ts
server/src/routes/billing/billingAdmin.routes.ts
server/src/routes/budget.routes.ts
server/src/routes/budgets.routes.ts
server/src/routes/capability.routes.ts
server/src/routes/capabilityEffective.routes.ts
server/src/routes/caseWorkspace/eventInbox.routes.ts
server/src/routes/change-sentiment.routes.ts
server/src/routes/cloud.routes.ts
server/src/routes/compliance.routes.ts
server/src/routes/cv-matching.routes.ts
server/src/routes/deliverablesGenerations.routes.ts
server/src/routes/demo.routes.ts
server/src/routes/discovery.routes.ts
server/src/routes/enterprise-platform.routes.ts
server/src/routes/executionAnalytics.routes.ts
server/src/routes/executiveAggregate.routes.ts
server/src/routes/external-assessments.routes.ts
server/src/routes/featureFlags.routes.ts
server/src/routes/featureUpdates.routes.ts
server/src/routes/final-batch.routes.ts
server/src/routes/finance-statements.routes.ts
server/src/routes/financeCandidateHandoffDigitizationAnalysis.routes.ts
server/src/routes/help.routes.ts
server/src/routes/helpChat.routes.ts
server/src/routes/helpFeedback.routes.ts
server/src/routes/ideaBusinessCase.routes.ts
server/src/routes/ideaFinancialCase.routes.ts
server/src/routes/initiativeBackbone.routes.ts
server/src/routes/initiativeCandidates.routes.ts
server/src/routes/initiativeGeneratorBrain.routes.ts
server/src/routes/initiativeMaterialize.routes.ts
server/src/routes/insightSourceBaskets.routes.ts
server/src/routes/integrations/automation.routes.ts
server/src/routes/integrations/calendarIntegrations.routes.ts
server/src/routes/integrations/sso.routes.ts
server/src/routes/integrations/webhookSubscriptions.routes.ts
server/src/routes/integrations/webhooks.routes.ts
server/src/routes/intelligence.routes.ts
server/src/routes/interviewCandidateHandoff.routes.ts
```

Dla KAŻDEGO pliku: policz endpointy GET-jeden/PUT/PATCH/DELETE/POST-na-obiekcie przyjmujące
identyfikator wprost. Dla każdego prześledź trasa → kontroler/serwis → zapytanie SQL — **nie
zatrzymuj się na trasie**, duża część poprawnie deleguje kontrolę do warstwy serwisu (`§1`
pułapka). Klasyfikuj każdy plik:

- **BEZPIECZNY** — kontrola istnieje, cytat `plik:linia` zapytania z `WHERE organization_id`
  (albo równoważnym).
- **DZIURAWY (potwierdzony statycznie, NIE naprawiaj)** — brak kontroli aż do SQL, opisz jaki
  kod odpowiedzi dałby live-proof, zgłoś jako nową pozycję dla kolejnej paczki dyżurów.
- **GLOBALNY/PLATFORMOWY (poza zakresem)** — brak kolumny `organization_id` z definicji (np.
  konfiguracja SuperAdmin), gate `verifySuperAdmin` — nie jest tej klasy dziurą.
- **BARREL/NIE-TRASA** — plik nie ma handlerów `router.METHOD`, tylko reeksportuje inne moduły
  (dotyczy prawdopodobnie `audits/index.ts` — zweryfikuj, zanotuj, zastąp kolejnym plikiem
  z pełnej puli 140, żeby dotrzymać liczby 60-80 rzeczywiście przeczytanych tras).

Wynik: JEDNA tabela, N plików × klasyfikacja × dowód `plik:linia` × cytat zapytania SQL.

## R3 — RAPORT DYŻURU (rdzeń)

Streszczenie, `R1`-`R2` z pełnymi dowodami, tabela klasyfikacji w całości, sekcja „TWIERDZENIA
NIEZWERYFIKOWANE" (obowiązkowa nawet pusta), sekcja „Korekty wobec instrukcji" (obowiązkowa nawet
pusta — zwłaszcza rozjazd liczb populacji, jeśli wystąpił). Jeżeli znalazłeś DZIURAWY plik —
osobna, wyróżniona sekcja „NOWE DZIURY ZNALEZIONE, NIE NAPRAWIONE" z pełnym dowodem dla każdej,
gotowa do podjęcia przez kolejny dyżur.

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (WĄSKO, `J`) | `docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` — WYŁĄCZNIE nowa sekcja na końcu pliku |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY246_DOMIAR_AUDYTU_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | wszystkie 70 plików z `§3 R2` (i cała pula 140, jeśli podmieniasz pozycje) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/Gateway.ts` — WYŁĄCZNIE odczyt montowania, zero zmian |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_242_UPRAWNIENIA.md` — referencja listy 19 już przeczytanych |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` · każdy `MODULE_ACCEPTANCE.md` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **TEN DYŻUR NIE URUCHAMIA KONTENERA BAZY DANYCH.** Jest wyłącznie pomiarowy (statyczne
  czytanie kodu) — `§0.2c` (blok migracji/env) tej instrukcji NIE MA ZASTOSOWANIA, pomijasz go
  w całości. Jeżeli w trakcie pracy odkryjesz, że jednak potrzebujesz uruchomić coś na żywo (np.
  do potwierdzenia niejednoznacznego zapytania) — to jest STOP MERYTORYCZNY tej jednej pozycji,
  nie powód do uruchamiania bazy bez ustalonego portu (`Z7`/`Z20`).
- ★★ **CZYTAJ ZAPYTANIE, NIE LICZ WYSTĄPIEŃ.** Nieużyty parametr wygląda na obecność kontroli
  (kształt 23, `docs/program/funkcje/KSZTALT_23_SYGNATURA_BEZ_ZABEZPIECZENIA.md`). Grep po
  `organization_id` w pliku daje Ci KANDYDATA do przeczytania, nigdy wynik klasyfikacji.
- ★★ **NIE ZATRZYMUJ SIĘ NA TRASIE.** Duża część kodu w tym repo poprawnie deleguje kontrolę do
  serwisu — musisz dojść do faktycznego `WHERE`.
- ★ **ZANIM ZACYTUJESZ `plik:linia`, SPRAWDŹ CZY PLIK JEST IMPORTOWANY.** 41 plików tras w tym
  repo to martwe bliźniaki tej samej nazwy (`docs/program/funkcje/
  ZNALEZISKO_41_MARTWYCH_BLIZNIAKOW.md`) — Twoja przydzielona lista pochodzi z filtra „żywe przez
  bezpośredni import Gateway.ts", więc powinna być czysta, ale jeśli trafisz na coś podejrzanego
  (dwa pliki tej samej nazwy), zweryfikuj przed cytowaniem.
- ★ **ZAKAZ NAPRAWY.** Nawet jednoznaczna, jednolinijkowa naprawa zostaje jako rekomendowany,
  nienałożony diff w raporcie.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.**
