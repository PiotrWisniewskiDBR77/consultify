# INSTRUKCJA DYŻURU nr 252 — Codex — „★★ 21 KANDYDATÓW PODEJRZENIE Z `docs/program/grafika/ROZJAZD_NAZW_POL_20260901.md` (sekcja „Pozostałe kandydaty — PODEJRZENIE”) CZEKA NA PRZEŚLEDZENIE DO KOŃCA — mechaniczny skrypt (`extract_field_names.mjs`, 4833 pliki `src/` + 4158 `server/src/`) znalazł znormalizowane pary camelCase żyjące PO RÓŻNYCH stronach (front-only vs server-only), ale **NIE prześledził trasy front→endpoint→serwer dla żadnej z 21** — `validationEvidence`/`evidenceValidation` · `completedRuns`/`runsCompleted` · `changePercent`/`percentChange` · `dataExport`/`exportData` · `textNeutral`/`neutralText` · `pageTitle`/`titlePage` · `projectMemberIds`/`memberProjectIds` · `resultsSearch`/`searchResults` · `statusDistribution`/`distributionStatus` · `dataRecord`/`recordData` · `criticalMissing`/`missingCritical` · `targetFill`/`fillTarget` · `stateContent`/`contentState` · `planVerification`/`verificationPlan` · `rawSeverity`/`severityRaw` (★ JUŻ ODRZUCONE jako SZUM w `AUDYT_ROZJAZDY_NAZW_POL.md` — celowy lokalny rename w `ExecutionControlSurface.tsx:299`, sprawdź `R1` KROK 0 zanim marnujesz czas na ponowne śledzenie) · `coverageRatio`/`ratioCoverage` · `modulesCompleted`/`completedModules` · `readyBlocks`/`blocksReady` · `codeRaw`/`rawCode` · `mapStatement`/`statementMap` · `rawMetadata`/`metadataRaw`. ★ Trzecia klasa defektu (pole serwera, którego front NIGDY nie czyta) jest niewidoczna zarówno dla metody objawowej (pusta komórka — bo front o polu nie wie, więc nic nie renderuje pusto), jak i dla metody nazwowej (para nazw musi się różnić, a tu front w ogóle nie ma odpowiednika) — wymaga PEŁNEGO porównania kształtu pole-po-polu (interfejs TS frontu vs `res.json(...)` serwera) na ekranach z oceną właściciela."

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
> **wyłącznie** `/private/tmp/cx-day252-rozjazdy-przemiatanie`.

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
Zakres: ****Przemiatanie rozjazdów nazw pól front↔serwer — reszta produktu.** Dwa niezależne audyty tego samego dnia (`docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md` — 2 ZMIERZONE + 90 nieprześledzone z 112 kandydatów; `docs/program/grafika/ROZJAZD_NAZW_POL_20260901.md` — 2 ZMIERZONE [OBA już naprawione, dyżur 251] + **21 kandydatów PODEJRZENIE, wzorzec pasuje, relacja NIE prześledzona**) razem prześledziły ~25 z ~157 unikalnych kandydatów. Ten dyżur przemieszcza **kolejny duży kawałek**: 21 kandydatów PODEJRZENIE do końca, PLUS trzecia, niewidoczna dla obu dotychczasowych metod klasa defektu (pole wysyłane przez serwer, którego front w ogóle nie czyta) na imiennie wybranych ekranach z oceną właściciela.**.
Trasy front: `zależnie od trafionego kandydata w `R1` (21 par, różne moduły) · `docs/program/grafika/status.json` (odczyt — źródło ekranów z oceną właściciela dla `R2`)`. Trasy tył: `zależnie od trafionego kandydata w `R1` · `server/src/routes/**` dla ekranów wybranych w `R2``.

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
WT=/private/tmp/cx-day252-rozjazdy-przemiatanie
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
git -C "$VAULT" worktree add "$WT" -b codex/day252-rozjazdy-przemiatanie-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day252-rozjazdy-przemiatanie/config.worktree"
cat "$VAULT/worktrees/cx-day252-rozjazdy-przemiatanie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day252-rozjazdy-przemiatanie-scratch
mkdir -p /private/tmp/cx-day252-rozjazdy-przemiatanie-artefakty

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
git -C "$WT" push github-backup codex/day252-rozjazdy-przemiatanie-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only df7f13056f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `7` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: ROZJAZD_NAZW_POL_20260901.md ma sekcje z 21 kandydatami PODEJRZENIE
grep -n "PODEJRZENIE" docs/program/grafika/ROZJAZD_NAZW_POL_20260901.md | tail -5
sed -n '/Pozostałe kandydaci/,/^$/p' docs/program/grafika/ROZJAZD_NAZW_POL_20260901.md | head -20
#   oczekiwane: lista 21 par widoczna

# (2) TEZA: rawSeverity/severityRaw juz rozstrzygniete jako SZUM w innym audycie
grep -n "rawSeverity" docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md
#   oczekiwane: 1+ trafien, "celowy lokalny rename"

# (3) TEZA: dwa ZMIERZONE z ROZJAZD_NAZW_POL sa juz naprawione (dyzur 251)
git merge-base --is-ancestor 8510fcb01d HEAD && echo "naprawa 251 OBECNA"

# (4) TEZA: status.json istnieje i ma ekrany z ocena A/B poza Audytami/Ustawieniami AI
python3 -c "import json; d=json.load(open('docs/program/grafika/status.json')); print(list(d.keys()))"
#   oczekiwane: klucz 'moduly' obecny, mozesz przejrzec strukture

# (5) TEZA: przyklad z listy 21 ma realne pliki po obu stronach (nie martwy typ)
grep -rln "validationEvidence" src --include='*.ts' --include='*.tsx' | grep -v __tests__ | head -3
grep -rln "evidenceValidation" server/src --include='*.ts' | grep -v __tests__ | head -3
#   oczekiwane: obie komendy zwracaja pliki (nie pustka)

# (6) TEZA: skrypt mechaniczny z poprzedniego audytu NIE jest juz dostepny (byl w efemerycznym worktree)
ls /private/tmp/przemiatanie-nazw/scan.py 2>&1
#   oczekiwane: prawdopodobnie 'No such file or directory' — potwierdza ze musisz
#   sledzic recznie albo napisac wlasny skrypt roboczy w /private/tmp/cx-day252-rozjazdy-przemiatanie-scratch

# (7) miejsce na dysku
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day252-rozjazdy-przemiatanie-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6244`. Twój JEDYNY port harnessu to `5224 i 5225`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day252-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6239, 5010-5219, 6404-6411, 6600-6830. Twoje własne: baza 6244, harness 5224 i 5225. Cudze — siostrzane dyżury TEJ SAMEJ paczki, nie dotykasz: baza 6240 i harness 5220-5221 (dyżur 250 Ustawienia AI), baza 6242 i harness 5222-5223 (dyżur 251 Audyty), baza 6246 i harness 5226-5227 (dyżur 253 Fałszywe zapisy), baza 6248 i harness 5228-5229 (dyżur 254 Sprzeczności rejestru). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi. Ten dyżur jest wyłącznie pomiarem — nie naprawia znalezionych rozjazdów (to praca dla przyszłego, imiennie zaadresowanego dyżuru), chyba że naprawa mieści się w resztkowym czasie i jest trywialna (jedno pole, jeden plik) — wtedy naprawiasz i dokumentujesz jako bonus, nie jako wymóg.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY252_ROZJAZDY_PRZEMIATANIE_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć: `docs/program/grafika/ROZJAZD_NAZW_POL_20260901.md` — WYŁĄCZNIE nowa sekcja na końcu z wynikiem śledzenia 21 kandydatów (przenosisz każdego z „PODEJRZENIE” do „ZMIERZONE” albo „SZUM” z dowodem), zakaz kasowania/przepisywania istniejącej treści. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day252-rozjazdy-przemiatanie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day252-rozjazdy-przemiatanie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ klasyfikowania kandydata jako PODEJRZENIE/ZMIERZONE bez czterowarstwowego śledzenia** (pole istnieje w trasie → komponent renderowany → dociera do przeglądarki → zaplecze faktycznie je zwraca) — hipoteza bez śledzenia to dokładnie błąd, przed którym ostrzega `AUDYT_ROZJAZDY_NAZW_POL.md` („hipoteza jako fakt”). **ZAKAZ generowania nowej listy `candidates_reorder.json`-podobnej jako pliku w repo** — wynik `R1`/`R2` wchodzi WYŁĄCZNIE do raportu tego dyżuru (`Z13`), robocze pliki skryptu (jeśli piszesz własny) zostają w `/private/tmp/cx-day252-rozjazdy-przemiatanie-scratch`, nie w repo. **ZAKAZ naprawy jakiegokolwiek ZMIERZONEGO rozjazdu, który wymaga więcej niż jednego pliku/jednej funkcji** — zgłaszasz z pełnym dowodem, nie naprawiasz w biegu (poszerzenie zakresu = ryzyko niedokończonej pracy, `Z17`). | `docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md` stwierdza wprost: „Metoda nie objęła całego produktu. 3202 plików front-end, 2288 plików zaplecza... Reszta to obszar nieopisany tym audytem — brak sygnału ZMIERZONE ani PODEJRZENIE, bo nie był badany, nie dlatego że jest czysty.” Ten sam dokument i `docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` ostrzegają, że punktowe zgłoszenie regularnie okazuje się szersze — trzy razy dziś zmierzono „poprawne obok zepsutego w tym samym pliku”. Zasada z uzupełnienia audytu: **gdzie ktoś raz mapował poprawnie, tam prawdopodobnie są miejsca, gdzie zapomniał** — dlatego przemiatanie kontynuuje się, nie kończy na dwóch zmierzonych przypadkach. |

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
cd /private/tmp/cx-day252-rozjazdy-przemiatanie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day252-pg psql -U postgres -d cx252 \
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
cd /private/tmp/cx-day252-rozjazdy-przemiatanie

docker run -d --name cx-day252-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx252 \
  -p 127.0.0.1:6244:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day252-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6244/cx252 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6244/cx252 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day252-rozjazdy-przemiatanie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6244/cx252 \
JWT_SECRET=cx252-test-secret-do-not-reuse \
npx vitest run brak nowych plików testowych obowiązkowych w tym dyżurze — dowody R1/R2 są statyczne (grep+odczyt) i/lub realdb GET tam, gdzie potrzebny zrzut HTTP --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day252-rozjazdy-przemiatanie-artefakty/day252-przemiatanie.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day252-rozjazdy-przemiatanie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run brak nowych plików testowych obowiązkowych w tym dyżurze — dowody R1/R2 są statyczne (grep+odczyt) i/lub realdb GET tam, gdzie potrzebny zrzut HTTP --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day252-rozjazdy-przemiatanie-artefakty/day252-przemiatanie.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day252-rozjazdy-przemiatanie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day252-pg psql -U postgres -d cx252 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day252-pg`.
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
> **(e) ★★ DWIE DROGI WYKRYWANIA MAJĄ DOPEŁNIAJĄCE SIĘ ŚLEPE PLAMY — NIE MYL JEDNEJ Z DRUGĄ. Droga OD OBJAWU (pusta komórka/sam separator w zrzucie) łapie KAŻDY rodzaj rozjazdu, ALE tylko gdy brak wartości coś WIDOCZNIE psuje — i zawodzi dokładnie wtedy, gdy atrapa/mock ma kształt frontu (liczby wyglądają dobrze, np. `12/42`, tak jak w dyżurze 251 przed naprawą). Droga OD NAZWY (grep par camelCase) łapie ciche podstawienia, ALE gubi SYNONIMY — `applicableCriteria`↔`criteriaTotal` to INNE SŁOWO, nie przestawienie członów, więc żaden automatyczny skrypt oparty na normalizacji członów tego nie znajdzie (dokładnie dlatego pierwszy przebieg skryptu `extract_field_names.mjs` PRZEGAPIŁ `concludedCriteria`/`criteriaConcluded` — ta sama fraza po obu stronach w innych miejscach kodu odrzuciła ją twardym filtrem front-only/server-only). **Trzecia klasa — pole wysyłane przez serwer, którego front w ogóle nie czyta — jest niewidoczna dla OBU.** Zanim ocenisz kandydata jako SZUM, sprawdź, czy `rawSeverity`/`severityRaw` już nie jest odrzucone w `AUDYT_ROZJAZDY_NAZW_POL.md` (jest) — **nie trać czasu na powtórne śledzenie już rozstrzygniętego kandydata.****
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day252-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day252-rozjazdy-przemiatanie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (prześledź 21 kandydatów PODEJRZENIE z `ROZJAZD_NAZW_POL_20260901.md` do końca, czterowarstwowo, z dedupem wobec już rozstrzygniętych w `AUDYT_ROZJAZDY_NAZW_POL.md`) · R2 (trzecia klasa — pełne porównanie kształtu pole-po-polu na 3 imiennie wybranych ekranach z oceną `A`/`B` w `status.json`, spoza modułów już objętych tym rodzajem sprawdzenia — Audyty/Ustawienia AI) · R3 (dla każdego nowego ZMIERZONEGO — trywialna naprawa jeśli mieści się w czasie, inaczej pełny brief zgłoszeniowy) · R4 (raport dyżuru, zaktualizowane liczby zasięgu: ile kandydatów prześledzono łącznie od początku programu)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6244` albo `5224 i 5225` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6244` albo `5224 i 5225`** (`Z7`).

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

Dwa niezależne audyty jednego dnia (2026-09-01) przemiatały ten sam typ defektu
(rozjazd nazw pól front↔serwer) różnymi metodami:

- `docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md` — przesiew ręczny + skrypt
  sygnatur, **2 ZMIERZONE**, ~25 kandydatów prześledzonych do końca z ~112
  automatycznych, **~90 nieprześledzonych**, jawnie: „obszar nieopisany tym audytem —
  brak sygnału ZMIERZONE ani PODEJRZENIE, bo nie był badany, nie dlatego że jest
  czysty".
- `docs/program/grafika/ROZJAZD_NAZW_POL_20260901.md` — mechaniczny skrypt
  (`extract_field_names.mjs`, 4833 plików `src/` + 4158 `server/src/`), **2 ZMIERZONE**
  (oba już naprawione — dyżur 251), **17 odsianych jako SZUM ze sprawdzeniem**, **21
  PODEJRZENIE — wzorzec pasuje, relacja pisze/czyta NIE zweryfikowana**.

Razem: **4 ZMIERZONE** (2 naprawione, 2 pozostałe do sprawdzenia na Twoim markerze — nie,
czekaj: oba ZMIERZONE z `AUDYT_ROZJAZDY_NAZW_POL.md` to Ustawienia AI [dyżur 250] i
Audyty [dyżur 251], oba ZMIERZONE z `ROZJAZD_NAZW_POL_20260901.md` to DOKŁADNIE TE SAME
dwa pola Audytów opisane niezależnie — więc łącznie to wciąż **2 unikalne ZMIERZONE
przypadki**, nie 4), **21 PODEJRZENIE nieprześledzone**, **~90 kandydatów w ogóle
niesklasyfikowanych**. Ten dyżur bierze **kolejny duży, policzony kawałek**: 21
kandydatów PODEJRZENIE do końca, plus trzecią klasę defektu, której żadna z dwóch
dotychczasowych metod nie widzi.

## ★★ Dwie drogi wykrywania, dwie dopełniające się ślepe plamy

**Droga OD OBJAWU** (szukanie pustej komórki/samego separatora w zrzucie dowodowym) —
łapie KAŻDY rodzaj rozjazdu nazw, ale TYLKO gdy brak wartości coś WIDOCZNIE psuje na
ekranie. Zawodzi dokładnie wtedy, gdy atrapa/mock ma kształt frontu — wtedy liczby
wyglądają dobrze (`12/42`), zrzut jest PRZEKONUJĄCY (dokładnie mechanizm z dyżuru 251,
kształt 21: „zrzut nie był pusty, zrzut był PRZEKONUJĄCY — to jest gorsze niż brak
zrzutu").

**Droga OD NAZWY** (grep par camelCase, znormalizowanych do posortowanych alfabetycznie
członów) — łapie ciche podstawienia niewidoczne wzrokowo, ale GUBI SYNONIMY.
`applicableCriteria`↔`criteriaTotal` to INNE SŁOWO, nie przestawienie tych samych
członów — żaden skrypt oparty na normalizacji członów tego nie znajdzie. Dowód: pierwszy
przebieg `extract_field_names.mjs` PRZEGAPIŁ `concludedCriteria`/`criteriaConcluded`
(dokładnie ten sam string występuje po OBU stronach w innych, niepowiązanych miejscach
kodu, więc twardy filtr front-only/server-only go odrzucił) — znaleziono ręcznie, przez
bezpośredni grep obu nazw z treści zlecenia.

**Trzecia klasa — pole wysyłane przez serwer, którego front W OGÓLE NIE CZYTA — jest
niewidoczna dla obu.** Droga od objawu nic nie widzi (front nie renderuje pola, którego
nie zna — nie ma pustej komórki, bo nie ma komórki w ogóle). Droga od nazwy nic nie
widzi (nie ma PARY nazw do porównania — front nie ma ŻADNEGO odpowiednika, poprawnego
czy błędnego). Ta klasa wymaga TRZECIEJ metody: **pełne porównanie kształtu pole-po-polu**
— wypisanie WSZYSTKICH pól, które trasa realnie zwraca (`res.json(...)`, nie deklaracja
typu), zestawione z WSZYSTKIMI polami, które front-endowy typ TS deklaruje i faktycznie
czyta.

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | `ROZJAZD_NAZW_POL_20260901.md` ma sekcję z 21 kandydatami PODEJRZENIE | komenda (1) |
| T2 | `rawSeverity`/`severityRaw` już rozstrzygnięte jako SZUM w innym audycie | komenda (2) |
| T3 | Oba ZMIERZONE z `ROZJAZD_NAZW_POL_20260901.md` są już naprawione (dyżur 251) | komenda (3) |
| T4 | `status.json` istnieje i ma ekrany z oceną A/B poza Audytami/Ustawieniami AI | komenda (4) |
| T5 | Przykładowy kandydat z listy 21 ma realne pliki po obu stronach | komenda (5) |
| T6 | Roboczy skrypt poprzedniego audytu nie jest już dostępny (efemeryczny worktree) | komenda (6) |
| T7 | Miejsce na dysku wystarcza | komenda (7) |

---

# 3. POZYCJE DYŻURU

## R1 — PRZEŚLEDŹ 21 KANDYDATÓW PODEJRZENIE DO KOŃCA (rdzeń)

Lista (z `ROZJAZD_NAZW_POL_20260901.md`, sekcja „Pozostałe kandydaci — PODEJRZENIE"):

```
validationEvidence/evidenceValidation · completedRuns/runsCompleted ·
changePercent/percentChange · dataExport/exportData · textNeutral/neutralText ·
pageTitle/titlePage · projectMemberIds/memberProjectIds · resultsSearch/searchResults ·
statusDistribution/distributionStatus · dataRecord/recordData ·
criticalMissing/missingCritical · targetFill/fillTarget · stateContent/contentState ·
planVerification/verificationPlan · rawSeverity/severityRaw · coverageRatio/ratioCoverage ·
modulesCompleted/completedModules · readyBlocks/blocksReady · codeRaw/rawCode ·
mapStatement/statementMap · rawMetadata/metadataRaw
```

**Zanim zaczniesz: `rawSeverity`/`severityRaw` jest JUŻ rozstrzygnięte** w
`AUDYT_ROZJAZDY_NAZW_POL.md` (tabela „Kandydaci sprawdzeni i ODRZUCENI") jako SZUM —
front jawnie mapuje lokalnie `rawSeverity: x.severity` w `ExecutionControlSurface.tsx`
(linia ok. 299), to celowy lokalny rename, nie odczyt cudzego pola; `severityRaw` z
`signalReadModel.ts` to inny, niepowiązany read-model. **Nie śledź go od zera** —
przepisz gotowy werdykt do swojej tabeli z odniesieniem do źródła.

Dla pozostałych **20** kandydatów, prześledź każdego **czterowarstwowo** (pole istnieje
w trasie → komponent renderowany → dociera do przeglądarki → zaplecze faktycznie je
zwraca w `res.json`) i sklasyfikuj:

| Kandydat | Ekran/moduł | ZMIERZONE / SZUM / PODEJRZENIE-nieustalone | Dowód (plik:linia obu stron) |
|---|---|---|---|
| … | … | … | … |

**Reguła klasyfikacji:** ZMIERZONE wymaga dowodu na WSZYSTKIE cztery warstwy. SZUM
wymaga dowodu, DLACZEGO strony się nie spotykają (martwy kod, i18n-klucz, lokalna
zmienna, nazwa metody/RPC nie pole danych, kolizja przypadkowa — wzorem tabeli
odrzuceń w `AUDYT_ROZJAZDY_NAZW_POL.md`). Jeśli po realnym wysiłku nie da się
rozstrzygnąć w rozsądnym czasie (np. wymaga uruchomienia rzadko używanej ścieżki) —
zostaje PODEJRZENIE-nieustalone z jawnym opisem, CZEGO zabrakło do rozstrzygnięcia — nie
zgadujesz.

**Dla każdego ZMIERZONEGO** zdecyduj: czy naprawa mieści się w jednym pliku/jednej
funkcji i w resztkowym czasie dyżuru → naprawiasz z dowodem mutacyjnym (`Z32`); jeśli
większa → pełny brief zgłoszeniowy (plik:linia, dlaczego nie w module, promień rażenia,
jak wyglądałby dowód mutacyjny) — **pozycja z takim briefem jest ZROBIONA, nie STOP.**

## R2 — TRZECIA KLASA: PEŁNE PORÓWNANIE KSZTAŁTU NA EKRANACH Z OCENĄ WŁAŚCICIELA (rdzeń)

Wybierz **3 ekrany** z `docs/program/grafika/status.json` (ocena `A` lub `B`, **poza**
modułami Audyty i Ustawienia AI — te już dostały tę klasę sprawdzenia w dyżurach
250/251) — jeden z Execution/Results, jeden z Finance/Materiały, jeden z Meetings/
Documents (wybierz konkretne nazwy sam, sprawdzając realną strukturę `status.json`;
zapisz w raporcie, DLACZEGO wybrałeś akurat te trzy — np. gęstość obliczeń, świeżość
ostatniego audytu, brak wcześniejszego sprawdzenia tego rodzaju).

Dla każdego z trzech: znajdź trasę HTTP, która karmi ten ekran danymi, wypisz WSZYSTKIE
pola z realnej odpowiedzi (`res.json(...)` w handlerze trasy — czytaj kod, nie
dokumentację), zestaw z WSZYSTKIMI polami czytanymi przez front (grep `row.`/`data.`/
destrukturyzacja na obiekcie odpowiedzi). **Szukaj pól po stronie SERWERA, które NIE
MAJĄ ŻADNEGO odpowiednika po stronie frontu** — to jest trzecia klasa. Dla każdego
znalezionego: ustal, czy brak odczytu jest ZAMIERZONY (pole dodane na zapas, jeszcze
nieużywane — sprawdź `git log`/PR opisujący pole) czy jest ZAGUBIONĄ FUNKCJONALNOŚCIĄ
(np. pole istniało w starszej wersji frontu, usunięte przy refaktorze, serwer dalej je
liczy i wysyła — martwy koszt obliczeniowy, zero wartości dla użytkownika).

## R3 — RAPORT DYŻURU (rdzeń)

Sekcje: streszczenie, `R1` (tabela 21 wierszy w całości), `R2` (3 ekrany, pełne
zestawienie pól, lista „pól-sierot" serwera), zaktualizowane **liczby zasięgu całego
programu** (ile kandydatów łącznie prześledzono od początku: 25 + 21 = 46, ile
zostaje: ~90 - dopasuj do realnych liczb, które sam potwierdzisz), sekcja „TWIERDZENIA
NIEZWERYFIKOWANE" (obowiązkowa nawet pusta), sekcja „Korekty wobec instrukcji"
(obowiązkowa nawet pusta).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (WĄSKO, `R1`/`J`) | `docs/program/grafika/ROZJAZD_NAZW_POL_20260901.md` — WYŁĄCZNIE nowa sekcja na końcu z wynikiem śledzenia 21 kandydatów |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY252_ROZJAZDY_PRZEMIATANIE_REPORT.md` |
| Zapis (WARUNKOWO, `R1`) | pliki naprawiane dla trywialnych ZMIERZONYCH — jeden plik = jeden commit, zakres WYŁĄCZNIE pole nazwane w `R1` |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md` (`Z14`-sąsiedztwo, źródło werdyktów do dedupu) · `docs/program/grafika/status.json` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **CZTEROWARSTWOWE ŚLEDZENIE OBOWIĄZKOWE DLA KAŻDEGO Z 21.** Klasyfikacja bez
  dowodu na wszystkie cztery warstwy nie wchodzi do tabeli jako ZMIERZONE ani SZUM —
  zostaje PODEJRZENIE-nieustalone z opisem braku.
- ★★ **NIE ŚLEDŹ PONOWNIE JUŻ ROZSTRZYGNIĘTEGO KANDYDATA** (`rawSeverity`/`severityRaw`)
  — przepisz gotowy werdykt z odniesieniem.
- ★ **Trzecia klasa wymaga PEŁNEGO wypisania pól obu stron**, nie próbkowania — jeśli
  trasa zwraca 20 pól, wypisujesz 20, nie pięć „najważniejszych".
- ★ **Rozdziel ZMIERZONE od PODEJRZENIA-nieustalonego** — hipoteza bez dowodu nie
  wchodzi do tabeli jako fakt.
- ★ **Zero nowego pliku rejestru w `docs/` poza dopisaniem do istniejącego
  `ROZJAZD_NAZW_POL_20260901.md`** — `Z13`.
- ★ **`Z10`/`Z11`:** zero nowych flag.
- ★ **Pułapki środowiska — sprawdź każdą u siebie:** `Database.ts:80-88` atrapa bazy ·
  `vitest.config.ts:210` przypina `DB_TYPE='sqlite'` · `tests/setup.ts:896` podmienia
  `global.fetch`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej
  sekcji jest podstawą odrzucenia dyżuru.
