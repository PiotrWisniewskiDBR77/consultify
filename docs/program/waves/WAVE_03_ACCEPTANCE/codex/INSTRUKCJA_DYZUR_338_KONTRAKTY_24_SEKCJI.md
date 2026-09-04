# INSTRUKCJA DYŻURU nr 338 — Codex — „DEC-388 — wszystkie 24 sekcje karty inicjatywy mają być DOSTĘPNE: szablon wolno mu porządkować i domyślnie zwijać, NIGDY usuwać pozycji z nawigacji; do tego uzupełnienie brakujących kontraktów sekcji i inwentarz 7 typów archetypu REKORD bez własnego kontraktu"

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
> **wyłącznie** `/private/tmp/cx-day338-kontrakty-24-sekcji`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `74c07919ce`**
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
Zakres: **Inicjatywy — kompletność karty (24 sekcje) · kontrakty kart archetypu REKORD**.
Trasy front: `/initiatives (lista) → karta inicjatywy (`src/components/Initiatives/InitiativeDocumentView.tsx`), nawigacja Menu 3 (`src/components/shared/NModeLayout/NModeLeftNav.tsx`), harness `dev-render/screens/karta-initiative.tsx``. Trasy tył: `brak — dyżur jest frontowy; PostgreSQL służy wyłącznie migracjom, dowodowi `Z30` i ewentualnemu uruchomieniu runtime'u do zrzutów`.

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
WT=/private/tmp/cx-day338-kontrakty-24-sekcji
MARKER=74c07919ce

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day338-kontrakty-24-sekcji-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day338-kontrakty-24-sekcji/config.worktree"
cat "$VAULT/worktrees/cx-day338-kontrakty-24-sekcji/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day338-kontrakty-24-sekcji-scratch
mkdir -p /private/tmp/cx-day338-kontrakty-24-sekcji-artefakty

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
git -C "$VAULT" log --oneline 74c07919ce..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 74c07919ce..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day338-kontrakty-24-sekcji-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 74c07919ce..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziewięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

★ WSZYSTKIE grepy uruchamiasz w BASHU (`bash -lc '...'` albo skrypt `.sh`).
W `zsh` `grep --include=*.ts` zwraca `no matches found` ZAMIAST wyników — pustka
nie jest wynikiem, dopóki nie sprawdzisz, że polecenie w ogóle się wykonało.

```bash
# (1) TEZA: filtr szablonu dziala PRZED kontraktem i kontrakt go NIE WIDZI
grep -n "enabledNModeSectionIds" src/components/Initiatives/InitiativeDocumentView.tsx
grep -n "uporzadkujSekcjeBoarduInicjatywy" src/components/Initiatives/InitiativeDocumentView.tsx
#   oczekiwane: `enabledNModeSectionIds` liczone ok. 5274 i STOSOWANE ok. 5544-5548
#   (`allSections.filter(...)`); `uporzadkujSekcjeBoarduInicjatywy` wolane dopiero ok. 9028,
#   na juz OKROJONEJ liscie. To jest przyczyna „6 z 24 niezaleznie od flagi".

# (2) TEZA: kanoniczna kolejnosc boardu ma 24 pozycje
grep -n "INITIATIVE_BOARD_CANONICAL_ORDER" src/components/Initiatives/sections/initiativeCardContract.ts
awk 'NR>795 && /^\];/{exit} NR>795' src/components/Initiatives/sections/initiativeCardContract.ts | grep -c "'"
#   oczekiwane: deklaracja ok. 795; 24 identyfikatory

# (3) TEZA: szablon `quick_win` deklaruje 5 sekcji — stad 6 na karcie (5 + zawsze-obecna definicja)
sed -n '36,48p' src/components/Initiatives/templates/initiativeLevelTemplates.ts
#   oczekiwane: `level: 'quick_win'` i `visibleSections: [overview, scope, tasks, kpis, attachments]`

# (4) ★ TEZA-SPROSTOWANIE: Decyzja JUZ czyta `ff.cardContract` — dyzur 324 zostal SCALONY
grep -n "ff.cardContract" src/components/MyWork/DecisionDetailView.tsx
git log --oneline -40 | grep -i "day324\|324"
#   oczekiwane: TRAFIENIA w DecisionDetailView (ok. linii 509 i 519) oraz merge `0f8713d5fa`.
#   Zlecenie nadzorcy mowilo, ze Decyzja czyta „tylko env+URL" — to jest STAN SPRZED SCALENIA.
#   Jezeli potwierdzisz naprawe, zapisz to jako obalona teze i przejdz do R6.

# (5) TEZA: rodzina wolaczy `ff.cardContract` ma 7 plikow
grep -rn "ff.cardContract" src/ | sed 's/:.*//' | sort -u
#   oczekiwane: 7 sciezek (Task, Notification, Decision, Tool, Insight, Interview + kontrakt inicjatywy)

# (6) TEZA: §13.1 ma 11 wierszy archetypu REKORD; 4 z nich maja kontrakt
grep -n "### 13.1" Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md
sed -n '1041,1051p' Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md | grep -c '^| '
#   oczekiwane: naglowek w linii 1037; 11 wierszy. Kontrakt maja Initiative, Task, Decision, Insight
#   → 7 typow BEZ kontraktu. Zlecenie mowilo „8" — moja liczba to 7, policz sam.

# (7) TEZA: `find` po wzorcu kontraktow daje 9 sciezek, nie 7 — dwie sa falszywie dodatnie
find src -name '*ardContract*.ts' -o -name '*ards.contract.ts' | sort
#   oczekiwane: 9 sciezek. Siedem to kontrakty kart; `cardContract.types.ts` to typ wiazacy,
#   a `whiteboard/whiteboardContracts.ts` wpada w wzorzec przypadkiem. Wypisz to w raporcie.

# (8) TEZA: liscie i18n
node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'
#   oczekiwane: 35198 33065 — te liczby NIE MOGA zmalec

# (9) zasoby wolne
df -h /
lsof -nP -iTCP:6374 -sTCP:LISTEN; lsof -nP -iTCP:5514 -sTCP:LISTEN
docker ps --format '{{.Names}}' | grep cx-day338 || echo "brak kontenera 338"
#   oczekiwane: powyzej 5 GB wolnego; oba porty puste; brak kontenera
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day338-kontrakty-24-sekcji-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6374`. Twój JEDYNY port harnessu to `5514`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day338-pg`**. **ZAKAZANE:** `6375, 6376 (bazy dyżurów 339 i 340), 5515, 5516 (runtime dyżurów 339 i 340), 5432 (cudzy nasłuch na hoście), a także wszystkie porty dyżurów 334-337, które biegną równolegle w tej serii`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `R2 — dokładnie JEDNA nowa flaga `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE`, wartość domyślna OFF, bez wpisu do `.env*`, `docker-compose*` i `railway*`; żadnej innej flagi nie zakładasz i żadnej zastanej domyślnej nie zmieniasz`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/resultsInternalBetaVisibility.middleware.ts`, `server/src/middleware/appErrorMapper.ts`, `src/services/api.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY338_KONTRAKTY_24_SEKCJI_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMPLETNOSCI_KART_20260904.md` (istnieje na markerze; dopisujesz nową sekcję „Dyżur 338", niczego nie kasujesz). **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day338-kontrakty-24-sekcji-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day338-kontrakty-24-sekcji-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **★★ ZAKAZ USUWANIA CZEGOKOLWIEK Z `INITIATIVE_BOARD_CANONICAL_ORDER` I Z `INITIATIVE_CANONICAL_CARDS`.** Wolno wyłącznie DOPISAĆ brakujący deskryptor. **ZAKAZ „naprawy" sufitu przez skasowanie mechanizmu szablonów** — szablon zostaje funkcją produktu, zmienia się wyłącznie jego SKUTEK dla nawigacji. **ZAKAZ zmiany wartości domyślnej nowej flagi na ON.** | DEC-388, dosłowne słowa właściciela: „NIE. NIE MA ZGODY NA TO!! Inicjatywa ma mieć w opcje 24 kart tak jak to było wcześniej przygotowane — trzeba do tego napisać kontrakty". Skasowanie szablonów albo pozycji katalogu załatwiłoby pomiar i zniszczyłoby produkt |

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
cd /private/tmp/cx-day338-kontrakty-24-sekcji

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day338-pg psql -U postgres -d cx338 \
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
cd /private/tmp/cx-day338-kontrakty-24-sekcji

docker run -d --name cx-day338-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx338 \
  -p 127.0.0.1:6374:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day338-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6374/cx338 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6374/cx338 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day338-kontrakty-24-sekcji && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6374/cx338 \
JWT_SECRET=cx338-test-secret-do-not-reuse \
npx vitest run tests/unit/initiatives tests/unit/cards --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day338-kontrakty-24-sekcji-artefakty/day338-initiatives.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day338-kontrakty-24-sekcji && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit/initiatives tests/unit/cards --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day338-kontrakty-24-sekcji-artefakty/day338-initiatives.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day338-kontrakty-24-sekcji/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day338-pg psql -U postgres -d cx338 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day338-pg`.
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
> **(e) ZASTANY `localStorage` PRZEŻYWA NAPRAWĘ. Klucz układu kart ma osobną przestrzeń nazw dla kontraktu (`task:nmode:card-layout:v2-contract:<id>`, `decision:…`, `notification:…`). Profil, w którym ktoś kiedykolwiek ruszał menedżer kart przy fladze ON, pokazuje ZASTANY, węższy układ — i pomiar mierzy wtedy cudzy stan, nie produkt. Każdy z czterech pomiarów `R1` robisz w świeżym profilu albo po jawnym wyczyszczeniu tych kluczy i ZAPISUJESZ w raporcie, którą drogą. Druga pułapka: uchwyty `data-nmode-section-item` / `data-nmode-section-group` liczysz z DOM, a nie ze zrzutu — lewy panel ma własne przewijanie (`NModeLeftNav.tsx:438-450`) i kadr obcina listę; poprzedni pomiar „11 z 15" okazał się pojemnością kadru**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day338-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day338-kontrakty-24-sekcji-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1, R2, R3`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6374` albo `5514` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6374` albo `5514`** (`Z7`).

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

Właściciel zobaczył kartę inicjatywy z sześcioma sekcjami zamiast dwudziestu czterech i odpowiedział
dosłownie tak (`DEC-388`, zapis w `docs/program/REJESTR_ZNALEZISK_20260903.md`, sekcja N):

> **„NIE. NIE MA ZGODY NA TO!! Inicjatywa ma mieć w opcje 24 kart tak jak to było wcześniej
> przygotowane — trzeba do tego napisać kontrakty”**

Dzień wcześniej powiedział też: **„Musimy mieć kompletne karty inicjatyw — to jest sens naszej
aplikacji”** (`DEC-387`). To jest **najwyższy priorytet całej serii**.

### Co już zostało zrobione i czego to NIE załatwiło

Dyżury 305, 314 i 324 są na markerze tego dyżuru. Zrobiły rzecz prawdziwą: **kontrakt kart
przestał kasować sekcje.** Zmierzono to uchwytem DOM dla wszystkich siedmiu typów kart i
potwierdzono mutacją — `ON = OFF`:

| Typ | pozycji ON/OFF | grup ON/OFF |
| --- | --- | --- |
| Initiative | 24 / 24 | 5 / 5 |
| Insight | 22 / 22 | 5 / 5 |
| Task | 8 / 8 | — |
| Interview | 8 / 8 | 3 / 3 |
| Decision | 6 / 6 | — |
| Tool | 4 / 4 | 3 / 3 |
| Notification | 3 / 3 | — |

**I mimo to właściciel dalej widzi sześć sekcji.** Odbiór adwersaryjny 04.09 zmierzył sufit,
którego żaden z tych dyżurów nie ruszył:

> **Przy NIEPUSTYM szablonie inicjatywy karta ma 6 pozycji z 24 i 3 grupy z 5 — NIEZALEŻNIE od
> flagi kontraktu.** Zmierzone z uchwytu DOM: OFF 6/3, ON 6/3. Przy pustym szablonie: OFF 24/5,
> ON 24/5.

### Przyczyna, zmierzona i nazwana

Kolejność dwóch filtrów w `src/components/Initiatives/InitiativeDocumentView.tsx`:

1. **NAJPIERW** `enabledNModeSectionIds` (ok. linii 5274) buduje zbiór dozwolonych identyfikatorów
   z `initiativeTemplate.visibleSections`, a ok. linii 5544-5548 zawęża nim `allSections`:
   `withGroup(allSections.filter((section) => enabledNModeSectionIds.has(section.id)))`.
2. **DOPIERO POTEM**, ok. linii 9028, kontrakt dostaje **już okrojoną** listę i wykonuje na niej
   `uporzadkujSekcjeBoarduInicjatywy(...)` — funkcję, która zgodnie z własnym komentarzem
   i asercją zwraca **PERMUTACJĘ wejścia**. Cały wkład kontraktu w wygląd to **PORZĄDEK, nie
   cięcie**.

Kontrakt fizycznie nie może przywrócić sekcji, której mu nie podano. Dlatego raport „kontrakt
niczego nie ucina” jest **prawdziwy**, a karta jest **mimo to niekompletna**.

Szablon `quick_win` (`src/components/Initiatives/templates/initiativeLevelTemplates.ts`, ok. linii
36-48) deklaruje pięć sekcji: `overview`, `scope`, `tasks`, `kpis`, `attachments`. Sześć na karcie
= te pięć plus zawsze-obecna `initiative-definition`. **To nie jest przypadek — to arytmetyka
szablonu.**

### Osiemnaście sekcji, których właściciel nie widzi — imiennie

Sześć widocznych przy szablonie `quick_win`: `Zakres inicjatywy` · `Zadania` · `Kryteria sukcesu` ·
`KPI i korzyści` · `Załączniki i powiązania` · `Artefakty`.

**Osiemnaście brakujących** (odczyt z uchwytu DOM, odbiór adwersaryjny 04.09):

| # | Sekcja | # | Sekcja |
| --- | --- | --- | --- |
| 1 | Harmonogram | 10 | RACI |
| 2 | Zależności | 11 | Właściciele strumieni |
| 3 | Produkty i kamienie milowe | 12 | Analiza finansowa |
| 4 | Decyzje | 13 | Wpływ finansowy |
| 5 | Ryzyko i RAID | 14 | OKR |
| 6 | Bramy | 15 | Hipoteza |
| 7 | Sugerowane zmiany | 16 | Zasoby |
| 8 | Dziennik zmian | 17 | Użyte w (powiązania) |
| 9 | Zespół | 18 | Wnioski i lekcje |

**Ta lista pochodzi z cudzego pomiaru i wchodzi tu jako TEZA, nie jako prawda.** Kanonicznym
źródłem jest `INITIATIVE_BOARD_CANONICAL_ORDER` w
`src/components/Initiatives/sections/initiativeCardContract.ts` (ok. linii 795). **Odtwórz listę
brakujących sam** — różnicą zbiorów między tą stałą a tym, co realnie widać w DOM przy szablonie
`quick_win` — i **wpisz do raportu SWOJĄ listę**. Jeżeli moja i Twoja różnią się choćby jedną
pozycją, wiążąca jest Twoja.

### Czego żąda decyzja właściciela — trzy zdania, nie więcej

1. **Wszystkie 24 sekcje mają być DOSTĘPNE na karcie inicjatywy.** Użytkownik musi widzieć,
   że sekcja istnieje.
2. **Szablon może co najwyżej porządkować, podpowiadać kolejność albo domyślnie zwijać.**
   **NIGDY nie usuwa pozycji z nawigacji.**
3. **Brakujące kontrakty trzeba dopisać** — dla sekcji karty inicjatywy i, w miarę licencji,
   dla typów archetypu REKORD, które własnego kontraktu nie mają w ogóle.

**Czego decyzja NIE żąda i czego robić NIE WOLNO:** skasowania mechanizmu szablonów. Szablon jest
funkcją produktu, nie defektem. Zmienia się jego **skutek dla nawigacji**, nie jego istnienie
(`Z40`).

## ★ Sprostowanie zlecenia — dwie liczby nadzorcy, które mój własny pomiar obalił

**Zlecenie nadzorcy zawierało dwa twierdzenia, które zmierzyłem i które są NIEAKTUALNE na tym
markerze. Zapisuję je wprost, żebyś nie szukał nieistniejącego defektu:**

1. **„`DecisionDetailView.tsx:504` czyta tylko env + URL, nie `ff.cardContract`”.**
   **NIEPRAWDA na markerze `74c07919ce`.** Dyżur 324 został scalony (`0f8713d5fa`), a jego pozycja
   R2 (`23759660b6`) dopisała odczyt `localStorage`. Na markerze `DecisionDetailView.tsx` czyta
   `ff.cardContract` w liniach ok. 509 (zapis z query) i ok. 519 (odczyt). Pułapka jest **zamknięta**.
   Co z niej zostało — patrz `R6`: **test, który jej pilnuje, broni NAPISU w pliku, nie zachowania.**
2. **„18 brakujących sekcji jest wypisanych w pliku `/private/tmp/odbior-324-325-326-20260904.md`”.**
   Ten plik leży **poza repozytorium** i może zniknąć razem z katalogiem tymczasowym. Dlatego jego
   treść jest przepisana wyżej, w tym dokumencie. **Nie odsyłam Cię do ścieżki spoza repo i Ty też
   nie odsyłaj do niej w raporcie.**

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

## ★ Zmierz moje liczby sam

Twierdzę: `INITIATIVE_BOARD_CANONICAL_ORDER` ma **24** pozycje; szablon `quick_win` deklaruje **5**
sekcji; filtr szablonu stosowany jest ok. 5544-5548, a kontrakt wołany ok. 9028; wołaczy
`ff.cardContract` jest **7** plików; §13.1 ma **11** wierszy, z czego **4** mają kontrakt, więc
**7** typów kontraktu nie ma (zlecenie mówiło „8” — to moja korekta, sprawdź ją); `find` po wzorcu
kontraktów daje **9** ścieżek, z czego dwie są fałszywie dodatnie; liście
`public/locales/pl/translation.json` = **35198**, `en` = **33065**.

**Każdą z tych liczb policz sam, u siebie, na swojej bazie. Przepisanie mojej liczby jest
zawyżeniem i podstawą odrzucenia raportu (`Z24`).**

---

## B.1. TABELA LICENCJI PLIKOWYCH — CAŁA ŚCIEŻKA

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA” — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **powłoka (rdzeń dyżuru)** | `src/components/Initiatives/InitiativeDocumentView.tsx` | **★ PEŁNA LICENCJA — WYŁĄCZNIE w zakresie roli i kolejności filtru `enabledNModeSectionIds`** (ok. 5274 i 5544-5548) oraz przekazania pełnej listy do kontraktu (ok. 9028), **za nową flagą `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE`, wartość domyślna OFF**. Zakaz jakiejkolwiek innej zmiany w tym pliku. **★ To jest zmiana licencji wobec dyżuru 324, gdzie plik był tylko do odczytu — powodem jest decyzja właściciela `DEC-388`, nie inicjatywa wykonawcy** | Gotowy diff w bloku kodu, **nienałożony**, + brief: promień rażenia, ile typów kart dotyka, co widzi właściciel przed i po |
| **kontrakt (rdzeń dyżuru)** | `src/components/Initiatives/sections/initiativeCardContract.ts` | **★ PEŁNA LICENCJA — WYŁĄCZNIE DOPISYWANIE** brakujących deskryptorów sekcji i funkcji pomocniczych. **ZAKAZ USUWANIA i ZAKAZ zmiany kolejności istniejących wpisów `INITIATIVE_BOARD_CANONICAL_ORDER`** (`Z40`) | — |
| **kontrakty pozostałych typów** | `src/components/MyWork/taskCardContract.ts`, `decisionCardContract.ts`, `notificationCardContract.ts`, `src/components/Interview/insightCardContract.ts`, `interviewCardContract.ts`, `src/components/DiscoveryTools/toolCards.contract.ts` | **TYLKO ODCZYT** — te sześć deskryptorów niesie kompozycję kart, którą właściciel zaakceptował na zrzutach; ten dyżur ich nie przesuwa | Pomiar + wpis do rejestru + gotowy diff nienałożony |
| **typ wiążący** | `src/components/standard/cardContract.types.ts` | **TYLKO ODCZYT — PLIK PRZEKROJOWY.** Typ przepływa przez wszystkie siedem kontraktów; jego zmiana psuje kompilację każdego z nich | **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT DLA DYŻURU 338 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`, + brief: plik:linia · promień rażenia · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **powłoka (przyrząd pomiarowy)** | `src/components/shared/NModeLayout/NModeLeftNav.tsx` | **TYLKO ODCZYT** — nosi uchwyty `data-nmode-section-item` i `data-nmode-section-group`, którymi mierzysz. Zmiana uchwytu unieważnia pomiar | Opis w raporcie + gotowy diff nienałożony |
| **szablony** | `src/components/Initiatives/templates/initiativeLevelTemplates.ts`, `templates/types.ts`, `templates/InitiativeLevelSelector.tsx`, `src/hooks/useInitiativeTemplate.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zmiany ADDYTYWNE opisujące ROLĘ szablonu** (np. dodanie pola „domyślnie zwinięte” obok `visibleSections`). **ZAKAZ usuwania `visibleSections` i zakaz zmiany zawartości któregokolwiek z czterech szablonów** | Gotowy diff nienałożony + wpis `DO DECYZJI WŁAŚCICIELA` ze zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie” |
| **flaga** | miejsce odczytu nowej flagi `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` | **★ PEŁNA LICENCJA** na sam odczyt, **wartość domyślna OFF**, wyłącznie w kodzie. **ZAKAZ wpisu do `.env*`, `docker-compose*`, `railway*`** (`Z10`) | — |
| **walidator (NOWE pliki)** | `tests/unit/initiatives/**`, `tests/unit/cards/**`, `src/components/Initiatives/__tests__/**` | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31`. Nowe pliki w `tests/` wymagają `git add -f` | — |
| **walidator (ZASTANE)** | `tests/unit/initiatives/initiativeCardContractCompleteness.test.ts`, `initiativeRecordCanon.test.ts`, `initiativeCardValidators.test.ts`, `tests/unit/cards/**` z dyżuru 324 | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisywanie NOWYCH przypadków `it(...)`.** Zakaz zmiany i osłabiania istniejących asercji, zakaz obniżania progów | Nowy plik testowy obok, z nagłówkiem `// KONTRAKT DYŻURU 338` |
| **przyrząd** | `dev-render/screens/karta-initiative.tsx` i pozostałe `dev-render/screens/karta-*.tsx` | **★ PEŁNA LICENCJA** — to jest harness, nie produkt. Pamiętaj: **host harnessu nie jest produktem**; kontrolki harnessu nie mogą wejść w kadr | — |
| **narzędzie zrzutów** | `scripts/dev/grafika-zrzuty.mjs` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zmiany ADDYTYWNE i OPT-IN** (nowy parametr, domyślnie wyłączony). **ZAKAZ zmiany zachowania domyślnego** — dziesiątki zastanych wywołań w `scripts/dev/*.sh` muszą działać bit w bit jak dziś. **ZAKAZ pisania własnego skryptu zrzutowego obok kanonicznego** | Opis brakującej zdolności w raporcie + gotowy diff |
| **i18n** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości. **Liczba liści nie może zmaleć** (35198 / 33065). ★ Klucz w `pl` trzymający angielskie słowo NIE jest przetłumaczony | — |
| **rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMPLETNOSCI_KART_20260904.md` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie sekcji „Dyżur 338”.** Zakaz kasowania i przeredagowywania zastanych sekcji | — |
| **dowody** | `evidence/kompletnosc-24-sekcji-20260904/**` (**NOWY**) | **★ PEŁNA LICENCJA**, `git add -f` | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY338_KONTRAKTY_24_SEKCJI_REPORT.md` (**NOWY**) | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **migracje** | `server/migrations/**` | **BEZ LICENCJI — ten dyżur nie dodaje ani nie zmienia żadnej migracji.** Przedział nie jest mu przydzielony | Uznasz migrację za potrzebną → **STOP MERYTORYCZNY z briefem**, przechodzisz do następnej pozycji |
| **kanon (dokumentacja)** | `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`, `docs/ui-standards/TRIADA_KANON.md` | **TYLKO ODCZYT** | Errata w raporcie |
| **decyzje** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`, `docs/program/REJESTR_ZNALEZISK_20260903.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest **ZROBIONA** z takim opisem |
| **cudzy teren** | `server/src/services/report/**`, `server/src/routes/method-core.routes.ts`, `server/src/routes/assessment-reports.routes.ts` — **teren dyżuru 339**; `src/layouts/MainLayout.tsx`, `src/components/AIChat/**`, `src/layouts/__tests__/**` — **teren dyżuru 340**; wszystko dotknięte przez dyżury 334-337 tej serii | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, treść problemu, **gotowa rekomendacja jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit robisz PO KAŻDEJ pozycji,
push na `github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Pomiar wejściowy sufitu — CZTERY liczby z DOM + własna lista 18 brakujących | TAK | NIE — dowód: `grep -n 'enabledNModeSectionIds' src/components/Initiatives/InitiativeDocumentView.tsx` pokazuje, że pomiar jest odczytem | bazowe | Cztery liczby (OFF/ON × szablon pusty/niepusty), każda z identyfikatorem rekordu, nazwą szablonu i **zapisanym stanem `localStorage`**; własna, odtworzona lista brakujących sekcji | `node scripts/dev/grafika-zrzuty.mjs --zlicz='pozycje:[data-nmode-section-item];grupy:[data-nmode-section-group]' --wynik-json=…` ×4 | `docs(day338): pomiar wejsciowy sufitu i lista brakujacych sekcji (338 R1)` |
| R2 | **RDZEŃ — DEC-388:** 24 sekcje dostępne przy niepustym szablonie, za flagą OFF | TAK | NIE — dowód: `B.1` daje pełną licencję na `InitiativeDocumentView.tsx` w wąskim zakresie | +1 test kompletności broniący ZACHOWANIA | Przy fladze ON i niepustym szablonie: **24 pozycje i 5 grup** z uchwytu DOM; przy fladze OFF zachowanie **bit w bit zastane** (6/3); szablon nadal działa — porządkuje lub domyślnie zwija, nie usuwa | `--zlicz=…` ×2 (ON/OFF na tym samym rekordzie) + `npx vitest run tests/unit/initiatives --retry=0` | `feat(initiatives): 24 sekcje dostepne mimo szablonu — flaga domyslnie OFF (338 R2)` |
| R3 | Test kompletności wycelowany w ZABEZPIECZENIE + dowód mutacyjny | TAK | NIE | +1 test | Usuń jedną sekcję z `INITIATIVE_BOARD_CANONICAL_ORDER` → test **CZERWONY**; cofnij przez `cp` → **ZIELONY**; `git diff` po cofnięciu **pusty**. ★ Test musi czerwienić się także wtedy, gdy sekcja **zostaje w pliku**, a znika z nawigacji | `npx vitest run tests/unit/initiatives tests/unit/cards --retry=0 --reporter=json --outputFile=…` | `test(initiatives): kompletnosc 24 sekcji broniona zachowaniem, nie literalem (338 R3)` |
| R4 | Inwentarz kontraktów 24 sekcji + uzupełnienie braków | NIE | NIE | +1 test | Tabela: sekcja boardu · ma deskryptor kontraktu? · plik:linia · dopisany w tym dyżurze? Braki uzupełnione **dopisaniem**, nigdy przestawieniem | `npx vitest run tests/unit/initiatives --retry=0` | `feat(initiatives): dopisz brakujace kontrakty sekcji karty (338 R4)` |
| R5 | Siedem typów §13.1 bez własnego kontraktu — inwentarz i plan | NIE | NIE | n/d | Tabela: artefakt z §13.1 · ma kontrakt (plik) · jeśli nie — czy ekran w ogóle istnieje w `src/` · szacunek pracy. **Twoja liczba.** Jeśli licencja nie starcza na napisanie kontraktów — **STOP z listą**, to jest pełnowartościowy wynik | `sed -n '1041,1051p' Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` + `find src -name '*ardContract*.ts'` (w `bash`, **bez `| head`**) | `docs(day338): inwentarz 7 typow REKORD bez kontraktu (338 R5)` |
| R6 | Dwie zastane pułapki wdrożeniowe | NIE | NIE | +1 test | (a) Decyzja: potwierdź, że `ff.cardContract` jest czytane, i **dopisz test broniący ZACHOWANIA** (zastany broni napisu); (b) zastany `localStorage` `…:v2-contract:` — mechanizm jako **gotowy diff NIENAŁOŻONY** + brief z promieniem rażenia | `grep -rn "ff.cardContract" src/` + nowy test z dowodem mutacyjnym | `test(mywork): kontrakt flagi Decyzji broniony zachowaniem (338 R6)` |
| R7 | Pytanie do właściciela — nazwy Menu 3 | NIE | NIE | n/d | Wpis `DO DECYZJI WŁAŚCICIELA` z **OBIEMA listami obok siebie**, kadrem obecnego stanu i zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie” | — | `docs(day338): pytanie o nazwy Menu 3 Initiative (338 R7)` |
| R8 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE” **niepusta** | — | `docs(day338): raport` |

> **Kolumna „Wymaga plików przekrojowych?” jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Jedyny plik przekrojowy w promieniu tego dyżuru to
> `src/components/standard/cardContract.types.ts` i **żadna pozycja go nie zmienia**. Jeśli uznasz,
> że musi — produktem jest czerwony kontrakt + brief, a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą z tych liczb mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz
w `bash`, nigdy w `zsh`.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Pozycje `INITIATIVE_BOARD_CANONICAL_ORDER` | 24 | `awk 'NR>795 && /^\];/{exit} NR>795' src/components/Initiatives/sections/initiativeCardContract.ts \| grep -c "'"` | TAK — uruchomione na markerze |
| 2 | Sekcje deklarowane przez szablon `quick_win` | 5 | `sed -n '36,48p' src/components/Initiatives/templates/initiativeLevelTemplates.ts` | TAK — to jest arytmetyka „6 z 24” |
| 3 | Pozycje widoczne w DOM przy szablonie `quick_win` | 6 (i 3 grupy) | `--zlicz='pozycje:[data-nmode-section-item];grupy:[data-nmode-section-group]'` | TAK — **jedyny dopuszczalny przyrząd**; nigdy liczenie ze zrzutu |
| 4 | Pozycje widoczne w DOM bez szablonu | 24 (i 5 grup) | jw. | TAK |
| 5 | Pliki czytające `ff.cardContract` | 7 | `grep -rn "ff.cardContract" src/ \| sed 's/:.*//' \| sort -u` | TAK — Decyzja JEST wśród nich na tym markerze |
| 6 | Wiersze §13.1 (archetyp REKORD) | 11 | `sed -n '1041,1051p' Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md \| grep -c '^| '` | TAK |
| 7 | Typy §13.1 bez własnego kontraktu | 7 | wiersz 6 minus `find src -name '*ardContract*.ts'` przefiltrowany ręcznie | TAK — **zlecenie mówiło „8”, moja liczba to 7** |
| 8 | Ścieżki pasujące do wzorca kontraktów | 9 (7 realnych + typ + fałszywie dodatni `whiteboardContracts.ts`) | `find src -name '*ardContract*.ts' -o -name '*ards.contract.ts' \| sort` | TAK — nazwij oba fałszywie dodatnie w raporcie |
| 9 | Liście `translation.json` | pl 35198 / en 33065 | `node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'` | TAK — **liczba nie może zmaleć**; tablice liczone element po elemencie |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY338_KONTRAKTY_24_SEKCJI_REPORT.md` | NOWY | R8 | ZEROWE |
| 2 | `evidence/kompletnosc-24-sekcji-20260904/**` | NOWY | R1/R2 | ZEROWE |
| 3 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMPLETNOSCI_KART_20260904.md` | ZASTANY — dopisanie sekcji | R1/R4/R5/R7 | ŚREDNIE — plik zastany z dyżuru 324; **dopisujesz sekcję, nie przepisujesz dokumentu** |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `src/components/Initiatives/InitiativeDocumentView.tsx` | R2 | Wyłącznie rola i kolejność filtru `enabledNModeSectionIds` + przekazanie pełnej listy do kontraktu, **za flagą domyślnie OFF**, z dowodem mutacyjnym w obie strony |
| `src/components/Initiatives/sections/initiativeCardContract.ts` | R2/R4 | Wyłącznie DOPISYWANIE deskryptorów; zakaz usuwania i przestawiania |
| `src/components/Initiatives/templates/**`, `src/hooks/useInitiativeTemplate.ts` | R2 | Tylko addytywnie, tylko jeśli „domyślnie zwinięte” wymaga nowego pola; zawartość czterech szablonów bez zmian |
| `tests/unit/initiatives/**`, `tests/unit/cards/**` (NOWE) | R3/R4/R6 | `git add -f`; test musi czerwienić się od mutacji ZABEZPIECZENIA, nie mechanizmu |
| `dev-render/screens/karta-*.tsx` | R1/R2 | Tylko jeśli przyrząd nie pozwala zamontować rekordu z niepustym szablonem; kontrolki harnessu poza kadrem |
| `scripts/dev/grafika-zrzuty.mjs` | R1 | Tylko addytywnie i opt-in; zachowanie domyślne bit w bit jak dziś |
| `public/locales/{pl,en}/translation.json` | R2 | Tylko dopisanie kluczy, parytet w tym samym commicie, liczba liści nie maleje |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
src/components/standard/cardContract.types.ts            — przekrojowy przez 7 kontraktow
src/components/MyWork/taskCardContract.ts                — kompozycja zaakceptowana na zrzutach
src/components/MyWork/decisionCardContract.ts            — jw.
src/components/MyWork/notificationCardContract.ts        — jw.
src/components/Interview/insightCardContract.ts          — jw.
src/components/Interview/interviewCardContract.ts        — jw.
src/components/DiscoveryTools/toolCards.contract.ts      — jw.
src/components/shared/NModeLayout/NModeLeftNav.tsx       — przyrzad pomiarowy
server/src/services/report/**                            — teren dyzuru 339
server/src/routes/method-core.routes.ts                  — teren dyzuru 339
server/src/routes/assessment-reports.routes.ts           — teren dyzuru 339
src/layouts/MainLayout.tsx                               — teren dyzuru 340
src/components/AIChat/**                                 — teren dyzuru 340
server/migrations/**                                     — przedzial nieprzydzielony
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6374 | `lsof -nP -iTCP:6374 -sTCP:LISTEN` → puste (sprawdzone przy pisaniu instrukcji) |
| Port harnessu | 5514 | `lsof -nP -iTCP:5514 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day338-pg` | `docker ps --format '{{.Names}}' \| grep cx-day338` → brak |
| Nazwa bazy | `cx338` | n/d |
| **Przedział migracji** | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | n/d |
| Gałąź | `codex/day338-kontrakty-24-sekcji-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day338-kontrakty-24-sekcji` | nie istnieje |
| Flagi funkcyjne | `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` — **NOWA, domyślnie OFF, tylko w kodzie** | `grep -rn 'VITE_VF1_INITIATIVE_SECTIONS_COMPLETE' src .env* docker-compose* railway* 2>/dev/null` → 0 trafień na markerze |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day338-kontrakty-24-sekcji
git diff --name-only --cached | tee /private/tmp/cx-day338-kontrakty-24-sekcji-artefakty/staged.txt
grep -iE 'cardContract\.types\.ts|taskCardContract|decisionCardContract|notificationCardContract|insightCardContract|interviewCardContract|toolCards\.contract|NModeLeftNav|services/report/|method-core\.routes|assessment-reports\.routes|layouts/MainLayout|components/AIChat/|server/migrations/' \
  /private/tmp/cx-day338-kontrakty-24-sekcji-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"
```

---

## R1 — POMIAR WEJŚCIOWY: CZTERY LICZBY I WŁASNA LISTA BRAKÓW

Powtarzasz pomiar z odbioru 04.09 **na swoim markerze**, żeby mieć własną bazę odniesienia przed
naprawą. Cztery stany:

| # | Rekord | Flaga kontraktu | Co zapisujesz |
| --- | --- | --- | --- |
| 1 | z **NIEPUSTYM** `initiativeTemplate` (`quick_win`) | OFF | pozycji · grup · identyfikator rekordu · nazwa szablonu · stan `localStorage` |
| 2 | ten sam | ON | jw. |
| 3 | z **PUSTYM** szablonem (albo bez szablonu) | OFF | jw. |
| 4 | ten sam | ON | jw. |

**Liczbę bierzesz WYŁĄCZNIE z uchwytu DOM**, nigdy ze zrzutu:

```bash
cd /private/tmp/cx-day338-kontrakty-24-sekcji
node scripts/dev/grafika-zrzuty.mjs \
  --zlicz='pozycje:[data-nmode-section-item];grupy:[data-nmode-section-group]' \
  --wynik-json=/private/tmp/cx-day338-kontrakty-24-sekcji-artefakty/r1-off-niepusty.json \
  <pozostałe parametry przelotu wg pomocy narzędzia>
#   oczekiwane dla stanu (1) i (2): pozycje 6, grupy 3 — IDENTYCZNIE, bo tnie szablon, nie flaga
#   oczekiwane dla stanu (3) i (4): pozycje 24, grupy 5 — IDENTYCZNIE
```

**`0` trafień jest wynikiem `0`, nigdy „pomiar się nie udał”** — brak pomiaru nie jest wynikiem.
Jeżeli selektor daje `0` w obu stanach, mierzysz nie ten ekran: sprawdź, czy komponent w ogóle się
zamontował, zanim cokolwiek ogłosisz.

Drugi produkt tej pozycji: **własna lista brakujących sekcji**, wyliczona jako różnica zbiorów
między `INITIATIVE_BOARD_CANONICAL_ORDER` a tym, co zwrócił uchwyt DOM przy szablonie `quick_win`.
Porównaj ją z listą osiemnastu z sekcji „Po co ten dyżur istnieje” i **zapisz rozbieżność wprost**.

Prawo zatrzymania po tej pozycji.

## R2 — RDZEŃ: 24 SEKCJE DOSTĘPNE MIMO SZABLONU (DEC-388)

**To jest powód, dla którego ten dyżur ma najwyższy priorytet.**

Wymaganie właściciela, w kolejności rozstrzygającej:

1. **Nawigacja karty pokazuje wszystkie 24 pozycje w 5 grupach**, niezależnie od szablonu.
2. **Szablon dalej działa** — wolno mu ustawiać kolejność, podpowiadać, co jest istotne, i
   **domyślnie zwijać** sekcje spoza swojego zbioru. **Nie wolno mu usunąć pozycji z nawigacji.**
3. Zmiana idzie **za nową flagą `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE`, wartość domyślna OFF**
   (`Z10`, `Z11`). Przy fladze OFF zachowanie jest **bit w bit zastane** — to też mierzysz.

**Dowód wymagany dla tej pozycji, w tej kolejności:**

- para z uchwytu DOM na **tym samym realnym rekordzie z niepustym szablonem**: flaga OFF → 6/3
  (stan zastany), flaga ON → **24/5**;
- para z uchwytu DOM na rekordzie bez szablonu: OFF 24/5, ON 24/5 — **brak regresji**;
- lista nazw pozycji z obu przebiegów ON — musi zawierać **wszystkie osiemnaście** wcześniej
  brakujących nazw, wypisanych imiennie w raporcie;
- zapisany stan `localStorage` przy każdym z pomiarów.

**Czego NIE robisz:** nie kasujesz `visibleSections`, nie zerujesz szablonów, nie wypisujesz
sekcji na sztywno w widoku. Naprawa polega na tym, że **kontrakt dostaje pełną listę**, a szablon
przestaje być filtrem nawigacji i staje się co najwyżej porządkiem albo domyślnym zwinięciem.

Prawo zatrzymania po tej pozycji.

## R3 — TEST, KTÓRY BRONI ZACHOWANIA, NIE NAPISU

**★ To jest najważniejsza lekcja poprzedniego dyżuru w tej rodzinie.** Test kompletności z dyżuru
324 asertował **obecność literału w pliku** (`expect(source).toContain(...)`). Odbierający zamienił
ciało funkcji tak, że literał został, a skutek zniknął — **test dalej świecił na zielono**.
Twój test nie ma prawa dać się tak oszukać.

Wymagania:

1. Test sprawdza **liczebność i skład zbioru sekcji oddanych do renderu**, przy niepustym szablonie
   i włączonej fladze. Nie sprawdza, czy w pliku stoi jakieś zdanie.
2. **Dowód mutacyjny wycelowany w ZABEZPIECZENIE, nie w mechanizm** (`Z32`), w obie strony:
   - usuń **jedną** pozycję z `INITIATIVE_BOARD_CANONICAL_ORDER` → test **CZERWONY**, ze wskazaniem
     nazwy tej pozycji;
   - cofnij przez `cp` z kopii w katalogu scratch (`Z27`, **nigdy `git stash`**) → **ZIELONY**;
   - `git diff` po cofnięciu **pusty**.
   Obie komendy i oba wyniki **dosłownie** w raporcie.
3. **Druga mutacja, kontrolna:** zostaw wszystkie 24 pozycje w pliku, ale przywróć filtr szablonu
   w nawigacji (czyli zepsuj dokładnie to, co naprawiłeś w `R2`). Test ma **CZERWIENIĆ**. Jeżeli
   przechodzi — Twój test broni napisu, nie zachowania, i pozycja jest **NIEZROBIONA**.

Prawo zatrzymania po tej pozycji.

## R4 — INWENTARZ I UZUPEŁNIENIE KONTRAKTÓW 24 SEKCJI

Tabela w rejestrze: **sekcja boardu · ma deskryptor w `INITIATIVE_CANONICAL_CARDS`? · plik:linia ·
dopisany w tym dyżurze?**

Braki uzupełniasz **dopisaniem deskryptora**. **Zakaz usuwania i zakaz przestawiania** istniejących
wpisów (`Z40`) — kompozycja kart została zaakceptowana przez właściciela na zrzutach.

Jeżeli któraś sekcja nie ma deskryptora **i nie da się go napisać bez decyzji produktowej** (bo nie
wiadomo, co ma być w prawym panelu albo jaka jest akcja główna) — wpisujesz `DO DECYZJI
WŁAŚCICIELA` ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie”**. Wiersz
bez tego zdania liczy się jako nierozstrzygnięty.

Prawo zatrzymania po tej pozycji.

## R5 — SIEDEM TYPÓW ARCHETYPU REKORD BEZ WŁASNEGO KONTRAKTU

`ARTIFACT_ANATOMY_STANDARD.md` §13.1 wymienia jedenaście artefaktów archetypu REKORD. Kontrakt mają
cztery: **Initiative, Task, Decision, Insight**. **Moja liczba: siedem bez kontraktu** — KPI, Idea,
RAID, Milestone, Change Request, Stage Gate, Action Proposal. Zlecenie nadzorcy mówiło „8 typów”
i wymieniało siedem nazw; **policz sam i zapisz swoją liczbę**.

Tabela: **artefakt · ma kontrakt (plik) · jeśli nie — czy ekran w ogóle istnieje w `src/`
(`grep` w `bash`, bez `| head` — obcięcie produkuje fałszywe sieroty) · szacunek pracy**.

**Nie próbujesz napisać wszystkich siedmiu w tym dyżurze.** Jeżeli licencja albo czas nie starczą —
**STOP z listą**, i to jest pełnowartościowy wynik pozycji, nie porażka. Wpisz w raporcie, ile
z nich dałoby się zrobić w jednym dyżurze i w jakiej kolejności.

Prawo zatrzymania po tej pozycji.

## R6 — DWIE ZASTANE PUŁAPKI WDROŻENIOWE

**(a) Flaga Decyzji.** Zlecenie mówiło, że `DecisionDetailView.tsx` nie czyta `ff.cardContract`.
**Mój pomiar na markerze mówi, że czyta** (dyżur 324 scalony jako `0f8713d5fa`). Zweryfikuj to sam
i zapisz wynik. Co z pułapki zostaje: **test, który jej pilnuje, sprawdza obecność napisu
w źródle**, a nie skutek. Twoim produktem jest **nowy test broniący ZACHOWANIA** — dla wartości
`ff.cardContract` równej `'1'`, `'0'` i braku klucza — z dowodem mutacyjnym w obie strony.
**Wartość domyślna flagi zostaje OFF.**

**(b) Zastany `localStorage`.** Klucze `task:nmode:card-layout:v2-contract:<id>`,
`decision:…`, `notification:…` przeżyją naprawę. Kto ruszał menedżer kart przy fladze ON, po
naprawie **zobaczy stary, węższy układ**. Zaproponuj mechanizm — migracja klucza przy zmianie
wersji kontraktu albo jednorazowe czyszczenie — jako **gotowy diff NIENAŁOŻONY** plus brief
z promieniem rażenia. **Nie nakładasz**: to dotyka danych w przeglądarkach ludzi.

Prawo zatrzymania po tej pozycji.

## R7 — PYTANIE DO WŁAŚCICIELA: NAZWY MENU 3

`ARTIFACT_ANATOMY_STANDARD.md` (nagłówek §13.1 ok. linii 1037, wiersz `Initiative (L)` ok. 1041)
podaje **sześć** nazw Menu 3: *Zadania · Definicja · Wdrożenie · Ekonomia · Governance · Zespół*.
Produkt ma **pięć** grup: *Zakres i plan · Decyzje i ryzyko · Rezultaty · Ludzie · Zapisy*.

**Nie rozstrzygasz tego sam.** Wpis `DO DECYZJI WŁAŚCICIELA` z **obiema listami obok siebie**,
kadrem obecnego stanu i jednym zdaniem: **„czego konkretnie mi zabrakło, żeby rozstrzygnąć
samodzielnie”**. Wpis bez tego zdania liczy się jako nierozstrzygnięty.

## R8 — RAPORT

Struktura `§R.2`. Obowiązkowo: cztery liczby z `R1` ze stanem `localStorage` przy każdej; własna
lista brakujących sekcji i jej rozbieżność wobec mojej; para OFF/ON po naprawie z `R2` z listą nazw;
oba dowody mutacyjne z `R3` dosłownie, z komendami i wynikami; tabela kontraktów z `R4`; własna
liczba typów bez kontraktu z `R5`; werdykt obu pułapek z `R6`; wpis `DO DECYZJI WŁAŚCICIELA`
z `R7`; sekcja **TWIERDZENIA NIEZWERYFIKOWANE** niepusta.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione, R2 zrobione, R3 zrobione, R4 rozpoczęte,
R5-R7 nietknięte” jest pełnowartościowym wynikiem — o ile R1 stoi na uchwycie DOM, a nie na
oglądaniu obrazka, a R3 stoi na **obu** dowodach mutacyjnych.

**Odwrotna kolejność — inwentarze (R4/R5) zrobione, rdzeń (R1/R2/R3) „częściowo” — jest podstawą
odrzucenia.**

**Flaga kończy dyżur OFF.** Włączenie następuje dopiero po akcepcie właściciela na parach zrzutów,
osobną decyzją nadzorcy (`Z11`).

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela niżej | TAK |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na worktree z markera; zero `BRAK` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, dziewięć wierszy |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — każdy wiersz „tylko odczyt” ma rzeczownik-produkt (diff · brief · kontrakt · pomiar · wpis) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4 |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (334-337, 339, 340) | TAK — `B.4.4`; porty 5514/6374 zmierzone jako wolne, kontener nie istnieje |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu modułowi | TAK |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru” bez ścieżki | TAK; treść pliku spoza repo przepisana do dokumentu |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK |

### AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| Zakaz `Z10` „zero nowych flag” **vs** `R2` zakłada nową flagę | `Z10` (pole wyjątku) — dokładnie JEDNA flaga, jawnie zamówiona, wartość domyślna OFF, wyłącznie w kodzie |
| Zakaz `Z11` „nie odsłaniasz nowego ekranu bez akceptu” **vs** `R2` wymaga zrzutów przy fladze ON | `R2` + `Z11` — flagę włączasz **wyłącznie w swoim harnessie**, do pomiaru i zrzutu; do repo nie wchodzi żadna zmiana wartości domyślnej |
| Dyżur 324 miał `InitiativeDocumentView.tsx` **tylko do odczytu** **vs** `R2` go zmienia | `B.1`, wiersz 1 — licencja została świadomie poszerzona przez decyzję właściciela `DEC-388`; zakres jest wąski i wymieniony imiennie |
| „Napraw sufit” **vs** `Z40` „zakaz kasowania mechanizmu szablonów” | `R2` — szablon zostaje, zmienia się jego skutek dla nawigacji; sekcje spoza szablonu wolno **domyślnie zwinąć**, nie usunąć |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument” **vs** `R1`/`R4`/`R5`/`R7` piszą do rejestru | `Z13` (pole „jedyny inny dokument”) — raport + jeden imiennie wskazany, **zastany** rejestr, do którego wyłącznie dopisujesz sekcję |
| Zakaz `Z15` „zero modelu językowego” **vs** karta inicjatywy potrafi wołać podpowiedzi AI | `Z15` bez wyjątku — żaden pomiar tego dyżuru nie przechodzi przez `llmService` ani `/api/ai/**`; jeśli sekcja wymaga modelu do renderu, mierzysz jej **obecność w nawigacji**, nie treść |
| Zakaz `Z30` „zero wysyłki” **vs** `R1`/`R2` mogą uruchomić pełny runtime do zrzutów | `§0.2b` punkt (4) — wyjątek wyłącznie dla zrzutów, po dowodach (a) i (b), z deklaracją dosłowną w raporcie |
| Zlecenie: „Decyzja nie czyta `ff.cardContract`” **vs** mój pomiar: czyta | Sekcja „★ Sprostowanie zlecenia” i `R6` (a) — pułapka zamknięta, zostaje wyłącznie słabość testu |
