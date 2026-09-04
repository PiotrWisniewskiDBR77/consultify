# INSTRUKCJA DYŻURU nr 343 — Codex — „DEC-388 domknięcie — zabezpieczenie, które NIE ISTNIEJE: test ma renderować widok i czerwienić się od przywrócenia filtru szablonu ORAZ od wypatroszenia resolvera flagi; do tego dziewięć brakujących deskryptorów kontraktu i rozstrzygnięcie, czy flaga ma być runtime"

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
> **wyłącznie** `/private/tmp/cx-day343-dec388-domkniecie`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `6a4919f72d`**
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
Zakres: **Inicjatywy — kompletność karty (24 sekcje) · kontrakt sekcji boardu · rozstrzygnięcie warstwy flagi**.
Trasy front: `/initiatives (lista) → karta inicjatywy (`src/components/Initiatives/InitiativeDocumentView.tsx`), nawigacja Menu 3 (`src/components/shared/NModeLayout/NModeLeftNav.tsx`), kontrakt (`src/components/Initiatives/sections/initiativeCardContract.ts`), harness `dev-render/screens/karta-initiative.tsx``. Trasy tył: `brak — dyżur jest frontowy; PostgreSQL służy wyłącznie migracjom, dowodowi `Z30` i ewentualnemu uruchomieniu runtime'u do zrzutów`.

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
WT=/private/tmp/cx-day343-dec388-domkniecie
MARKER=6a4919f72d

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day343-dec388-domkniecie-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day343-dec388-domkniecie/config.worktree"
cat "$VAULT/worktrees/cx-day343-dec388-domkniecie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day343-dec388-domkniecie-scratch
mkdir -p /private/tmp/cx-day343-dec388-domkniecie-artefakty

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
git -C "$VAULT" log --oneline 6a4919f72d..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 6a4919f72d..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day343-dec388-domkniecie-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 6a4919f72d..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziesięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day343-dec388-domkniecie

# (1) TEZA: kanon boardu ma 24 pozycje
awk 'NR>795 && /^\];/{exit} NR>795' src/components/Initiatives/sections/initiativeCardContract.ts | grep -c "'"
#   oczekiwane: 24. Deklaracja stalej ok. linii 795.

# (2) TEZA: selektor DEC-388 istnieje i jest wolany z widoku
grep -n 'wybierzDostepneSekcjeBoarduInicjatywy' \
  src/components/Initiatives/sections/initiativeCardContract.ts \
  src/components/Initiatives/InitiativeDocumentView.tsx
#   oczekiwane: definicja ok. 857 w kontrakcie; import ok. 223 i wolanie ok. 5557-5560 w widoku

# (3) ★ TEZA: flaga jest BUILD-TIME i ma DOKLADNIE JEDEN odczyt w calym src/
grep -rn 'VITE_VF1_INITIATIVE_SECTIONS_COMPLETE' src/ tests/ dev-render/
#   oczekiwane: DOKLADNIE JEDNO trafienie — InitiativeDocumentView.tsx ok. 5296,
#   `import.meta.env.VITE_VF1_INITIATIVE_SECTIONS_COMPLETE`. Zero query, zero localStorage.

# (4) ★ TEZA: czwarty przypadek testu broni NAPISU w pliku widoku, nie zachowania
grep -n 'readFileSync\|toMatch\|not.toMatch' \
  tests/unit/initiatives/initiativeTemplateNavigationCompleteness.test.ts
#   oczekiwane: `fs.readFileSync(WIDOK…)` + `expect(src).toMatch(...)` + `expect(src).not.toMatch(...)`.
#   To jest ten sam ksztalt, co test dyzuru 324, przeniesiony o poziom wyzej.

# (5) ★ TEZA-SPROSTOWANIE: pozycja R4 dyzuru 338 NIE dotknela kodu
git show --stat 98d86e3c7e
#   oczekiwane: tytul „dopisz brakujace kontrakty sekcji karty (338 R4)",
#   1 plik zmieniony, 42 wstawienia, ZERO plikow z `src/`. To jest dokumentacja braku, nie naprawa.

# (6) TEZA: katalog deskryptorow ma 27 kart
awk 'NR>604 && /^\];/{exit} NR>604' src/components/Initiatives/sections/initiativeCardContract.ts \
  | grep -cE '^  [A-Z_]+,$'
#   oczekiwane: 27. Policz sam — jezeli wyjdzie inna liczba, obowiazuje Twoja.

# (7) TEZA: rodzina flag rozstrzyganych trojwarstwowo (wzor do naslad. w R4)
sed -n '1,40p' src/utils/exceleRightRailFlag.ts
#   oczekiwane: kolejnosc query -> localStorage -> import.meta.env -> default.
#   To jest wzorzec pliku, a nie zrodlo do skopiowania bez zrozumienia.

# (8) ★ TEZA: statyczny dostep do env jest warunkiem dzialania w bundlu Vite
sed -n '1,20p' src/utils/dynamicSwotSevenStagesFlag.ts
#   oczekiwane: komentarz „Keep the access static" + `import.meta.env.VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES`.
#   Dyzur 341 zmierzyl, ze obliczony `import.meta.env[KLUCZ]` NIE jest podstawiany przez Vite.

# (9) TEZA: liscie i18n
node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'
#   oczekiwane: 35198 33065 — te liczby NIE MOGA zmalec

# (10) zasoby wolne
df -h /
lsof -nP -iTCP:6390 -sTCP:LISTEN; lsof -nP -iTCP:5530 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep cx-day343 || echo 'brak kontenera'
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day343-dec388-domkniecie-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6390`. Twój JEDYNY port harnessu to `5530`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day343-pg`**. **ZAKAZANE:** `5531, 5532, 5533 (runtime dyżurów 344, 345 i 346), 6391, 6392, 6393 (bazy dyżurów 344, 345 i 346), 5432 (cudzy nasłuch na hoście), a także wszystkie porty dyżurów 347-350, które inny autor wydaje równolegle w tej samej serii`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `R4 — dyżur NIE zakłada ani jednej NOWEJ flagi. Pracuje na zastanej `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` (dodanej przez dyżur 338), zmieniając wyłącznie SPOSÓB jej odczytu na trójwarstwowy (query → localStorage → env statyczny). WARTOŚĆ DOMYŚLNA POZOSTAJE OFF I NIE WOLNO JEJ ZMIENIĆ`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/resultsInternalBetaVisibility.middleware.ts`, `server/src/middleware/appErrorMapper.ts`, `src/services/api.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY343_DEC388_DOMKNIECIE_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMPLETNOSCI_KART_20260904.md` (istnieje na markerze; dopisujesz nową sekcję „Dyżur 343", niczego nie kasujesz i niczego nie przeredagowujesz). **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day343-dec388-domkniecie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day343-dec388-domkniecie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **★★ ZAKAZ OSŁABIENIA ALBO SKASOWANIA KTÓREGOKOLWIEK Z CZTERECH ZASTANYCH PRZYPADKÓW `it(...)` W `tests/unit/initiatives/initiativeTemplateNavigationCompleteness.test.ts`.** Wolno wyłącznie DOPISAĆ nowe przypadki i nowy plik testowy obok. **ZAKAZ USUWANIA CZEGOKOLWIEK Z `INITIATIVE_BOARD_CANONICAL_ORDER` I Z `INITIATIVE_CANONICAL_CARDS`** — wolno wyłącznie DOPISAĆ deskryptor. **ZAKAZ zmiany wartości domyślnej flagi `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` na ON** — dyżur kończy się flagą OFF. **ZAKAZ „naprawy" przez skasowanie mechanizmu szablonów**: szablon zostaje funkcją produktu, zmienia się wyłącznie jego SKUTEK dla nawigacji. | DEC-388, dosłowne słowa właściciela: „NIE. NIE MA ZGODY NA TO!! Inicjatywa ma mieć w opcje 24 kart tak jak to było wcześniej przygotowane — trzeba do tego napisać kontrakty" (`docs/program/REJESTR_ZNALEZISK_20260903.md`, sekcja N). Dyżur 338 dał realny efekt produktowy, ale odbiór adwersaryjny 04.09 pokazał, że dwie mutacje wypatroszające chronioną funkcję zostawiają wszystkie cztery testy ZIELONE. Osłabienie zastanych asercji albo skasowanie pozycji katalogu załatwiłoby pomiar i zniszczyłoby produkt. |

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
cd /private/tmp/cx-day343-dec388-domkniecie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day343-pg psql -U postgres -d cx343 \
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
cd /private/tmp/cx-day343-dec388-domkniecie

docker run -d --name cx-day343-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx343 \
  -p 127.0.0.1:6390:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day343-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6390/cx343 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6390/cx343 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day343-dec388-domkniecie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6390/cx343 \
JWT_SECRET=cx343-test-secret-do-not-reuse \
npx vitest run tests/unit/initiatives tests/unit/cards --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day343-dec388-domkniecie-artefakty/day343-initiatives.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day343-dec388-domkniecie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit/initiatives tests/unit/cards --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day343-dec388-domkniecie-artefakty/day343-initiatives.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day343-dec388-domkniecie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day343-pg psql -U postgres -d cx343 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day343-pg`.
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
> **(e) ZASTANY `localStorage` PRZEŻYWA NAPRAWĘ, A PO TYM DYŻURZE BĘDZIE JESZCZE CZYTANY PRZEZ SAMĄ FLAGĘ. Klucz układu kart ma osobną przestrzeń nazw dla kontraktu (`task:nmode:card-layout:v2-contract:<id>`, `decision:…`, `notification:…`), a pozycja `R4` dokłada odczyt `localStorage` dla samej flagi kompletności. Profil, w którym ktokolwiek kiedykolwiek ruszał menedżer kart albo ustawiał flagę, pokazuje CUDZY stan — i pomiar mierzy wtedy nie produkt. Każdy pomiar `R1` i `R5` robisz w świeżym profilu albo po jawnym wyczyszczeniu tych kluczy i ZAPISUJESZ w raporcie, którą drogą. Druga pułapka: uchwyty `data-nmode-section-item` / `data-nmode-section-group` liczysz z DOM, nigdy ze zrzutu — lewy panel ma własne przewijanie (`NModeLeftNav.tsx`) i kadr obcina listę; poprzedni pomiar „11 z 15" okazał się pojemnością kadru, nie liczbą sekcji**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day343-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day343-dec388-domkniecie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1, R2, R3`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6390` albo `5530` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6390` albo `5530`** (`Z7`).

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
aplikacji”** (`DEC-387`). **To jest decyzja właściciela wykonana w połowie i najwyższy priorytet
całej serii.**

### Co dyżur 338 zrobił naprawdę — i co z tego zostało otwarte

Dyżur 338 jest scalony (`e25eb19b64`) i dał **prawdziwy efekt produktowy**. Odbierający zmierzył
uchwytem DOM na realnym rekordzie: szablon `quick_win` + flaga ON → **24 pozycje / 5 grup**,
flaga OFF → **6 / 3**. Mechanizm istnieje: widok woła
`wybierzDostepneSekcjeBoarduInicjatywy(allSections, enabledNModeSectionIds, initiativeSectionsCompleteEnabled)`
zamiast ciąć listę przed kontraktem.

**Merge nosi adnotację „SCALIC Z ZASTRZEZENIEM — ★ ZAKAZ WLACZANIA FLAGI”.** Trzy zastrzeżenia
odbioru są przedmiotem tego dyżuru.

### Zastrzeżenie 1 (rdzeń) — ★ ZABEZPIECZENIE NIE ISTNIEJE

Odbierający wykonał cztery mutacje na `tests/unit/initiatives/initiativeTemplateNavigationCompleteness.test.ts`
(cztery przypadki `it(...)`):

| # | Mutacja | Wynik testu | Wynik produktu |
| --- | --- | --- | --- |
| 1 | usunięcie sekcji z `INITIATIVE_BOARD_CANONICAL_ORDER` | **RED** — dobrze | karta uboższa |
| 2 | **przywrócenie filtru szablonu ZA wywołaniem selektora** | **GREEN 4/4** | ★ powrót do 6/3, zrzut **bajtowo identyczny** z „PRZED” (`38781015e65430dc`) |
| 3 | **`void raw; return false` w resolverze flagi** | **GREEN 4/4** | ★ flaga przestaje działać, karta na stałe 6/3 |
| 4 | `void stored` w Decyzjach | RED — dobrze | — |

**Przyczyna jest w kształcie testu, nie w liczbie testów.** Trzy pierwsze przypadki wołają czystą
funkcję `wybierzDostepneSekcjeBoarduInicjatywy(...)` i **same podają jej flagę jako argument** —
więc wypatroszenie resolvera flagi w widoku jest dla nich niewidzialne. Czwarty przypadek czyta
plik widoku przez `fs.readFileSync` i asertuje **dwa literały**:

```
expect(src).toMatch(/wybierzDostepneSekcjeBoarduInicjatywy\(\s*allSections,\s*enabledNModeSectionIds,\s*initiativeSectionsCompleteEnabled\s*\)/)
expect(src).not.toMatch(/allSections\.filter\(\(section\) => enabledNModeSectionIds\.has\(section\.id\)\)/)
```

Wystarczy zapisać filtr **innym zapisem** (inna nazwa parametru, `.filter((s) => …)`, filtr
przeniesiony do zmiennej pomocniczej albo postawiony **za** wywołaniem selektora) i drugi literał
przestaje pasować, a test świeci na zielono przy zepsutym produkcie. **To jest dokładnie ten sam
kształt, co test dyżuru 324 — przeniesiony o jeden poziom wyżej, nie naprawiony.**

**Zadanie rdzenia: test, który RENDERUJE WIDOK i czerwieni się od mutacji 2 ORAZ od mutacji 3.**

### Zastrzeżenie 2 — ★ POZYCJA R4 DYŻURU 338 JEST NIEWYKONANA

Commit `98d86e3c7e` nosi tytuł **„feat(initiatives): dopisz brakujace kontrakty sekcji karty
(338 R4)”**, a zmienia **jeden plik dokumentacji, 42 wstawienia, ZERO linii kodu**. Wykonawca
zamknął pozycję STOP-em merytorycznym z uczciwie opisanym powodem:

> nie było rozstrzygnięte, czy identyfikator boardu ma być **nową kartą** w katalogu registry,
> czy **dodatkową przynależnością** istniejącego deskryptora.

**To był dobry STOP i tę decyzję podejmuję w tej instrukcji — patrz `R3`, punkt „Decyzja
projektowa, którą rozstrzygam za Ciebie”.** Dziewięć sekcji boardu nadal nie ma deskryptora i to
jest **druga połowa decyzji właściciela** — słowa „trzeba do tego napisać kontrakty” dotyczą
właśnie tego.

Dziewięć braków wg inwentarza 338 (**TEZA — odtwórz różnicę zbiorów sam**):
`deliverables-milestones` · `suggested-changes` · `change-log` · `okr` · `hypothesis` ·
`workstream-owners` · `used-in` · `artifacts` · `lessons-learned`.

### Zastrzeżenie 3 — ★ FLAGA JEST BUILD-TIME, WIĘC W PRODUKCIE NIC SIĘ NIE ZMIENIŁO

Flaga `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` ma w całym `src/` **dokładnie jeden odczyt**
(`InitiativeDocumentView.tsx` ok. 5296) i jest to `import.meta.env.…`, czyli **wartość wstrzykiwana
przy budowaniu bundla**. Nie ma `?query`, nie ma `localStorage`. Praktyczny skutek:

> **W produkcie każda inicjatywa z niepustym szablonem nadal pokazuje 6 z 24 sekcji, a właściciel
> nie ma żadnego sposobu, żeby zobaczyć naprawę bez przebudowania bundla.**

Cała reszta rodziny flag wizualnych w tym repo rozstrzyga się trójwarstwowo
(query → `localStorage` → env → default), np. `src/utils/exceleRightRailFlag.ts`. **Ta jedna
stoi obok rodziny.** `R4` to porządkuje — **bez zmiany wartości domyślnej**.

## ★ Sprostowanie zlecenia — liczby i tezy, które mój własny pomiar na markerze skorygował

**Zapisuję je wprost, żebyś nie szukał nieistniejącego defektu ani nie powtarzał cudzego skrótu.**

1. **„Flaga ma być runtime — `?query`/`localStorage`, jak reszta rodziny”.**
   Kierunek jest słuszny, ale **wzorzec podany w zleceniu był nieprecyzyjny**. Dyżur 341 (SWOT)
   **nie dodał** `?query` ani `localStorage` — on zmienił **obliczony** dostęp
   `import.meta.env[KLUCZ]` na **statyczny** `import.meta.env.VITE_…`, bo Vite podstawia wartość
   tylko przy dostępie statycznym (`src/utils/dynamicSwotSevenStagesFlag.ts`, komentarz „Keep the
   access static”). Twoje `R4` robi **oba**: warstwy query/`localStorage` **plus** statyczny odczyt
   env. Wzorcem pliku jest `src/utils/exceleRightRailFlag.ts`.
2. **„9 z 24 sekcji bez deskryptora”.** Mój pomiar to potwierdza jako **liczbę autora dyżuru 338**,
   ale liczba pochodzi z **oceny semantycznej** (np. `raci` policzone jako „ma deskryptor”, bo
   `GOVERNANCE` + `STAKEHOLDERS` niosą tę treść), a nie z prostego przecięcia zbiorów. Przecięcie
   po samych identyfikatorach daje **17** braków, nie 9. **Policz OBIE liczby i podaj obie**, razem
   z regułą, którą przyjąłeś. Jeżeli Twoja różni się od mojej — wiążąca jest Twoja.
3. **Katalog deskryptorów ma 27 kart, board ma 24 identyfikatory.** To są **dwie różne
   przestrzenie nazw**, nie jedna rozjechana lista. Nie „naprawiaj” tego przez zrównanie liczb.
4. **Ścieżka `/private/tmp/odbior-…`, cytowana w odbiorach tej rodziny, leży POZA repozytorium**
   i może zniknąć razem z katalogiem tymczasowym. Wszystko, czego potrzebujesz, jest w tym
   dokumencie albo w `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMPLETNOSCI_KART_20260904.md`.
   **Nie odsyłaj w raporcie do ścieżek spoza repo.**

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

## ★ Zmierz moje liczby sam

Twierdzę: `INITIATIVE_BOARD_CANONICAL_ORDER` ma **24** pozycje; `INITIATIVE_CANONICAL_CARDS` ma
**27** kart; flaga `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` ma **1** odczyt w całym `src/`; zastany
test ma **4** przypadki `it(...)`, z czego **1** czyta plik widoku przez `readFileSync`; commit
`98d86e3c7e` zmienia **1** plik i **0** linii kodu; braków deskryptora jest **9** wg reguły
semantycznej i **17** wg przecięcia identyfikatorów; liście `public/locales/pl/translation.json`
= **35198**, `en` = **33065**.

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
| **kontrakt (rdzeń dyżuru)** | `src/components/Initiatives/sections/initiativeCardContract.ts` | **★ PEŁNA LICENCJA — WYŁĄCZNIE DOPISYWANIE** deskryptorów sekcji boardu, mapy board-id → deskryptor i funkcji pomocniczych. **ZAKAZ USUWANIA i ZAKAZ zmiany kolejności `INITIATIVE_BOARD_CANONICAL_ORDER` oraz `INITIATIVE_CANONICAL_CARDS`** (`Z40`) | — |
| **powłoka (rdzeń dyżuru)** | `src/components/Initiatives/InitiativeDocumentView.tsx` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zamiana ciała resolvera flagi** (ok. 5294-5302) na wywołanie nowego modułu flagi z `R4`. **ZAKAZ zmiany wartości domyślnej (OFF), zakaz dotykania `enabledNModeSectionIds` i wywołania selektora ok. 5557-5560** — one są już poprawne | Gotowy diff w bloku kodu, **nienałożony**, + brief: promień rażenia, co widzi właściciel przed i po |
| **flaga (NOWY plik)** | `src/utils/initiativeSectionsCompleteFlag.ts` (**NOWY**) | **★ PEŁNA LICENCJA.** Trójwarstwowe rozstrzyganie query → `localStorage` → **statyczny** `import.meta.env.VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` → **default `false`**. Eksportuje też stałą kluczy, wzorem `ARTIFACT_RIGHT_RAIL_FLAG_KEYS`. **ZAKAZ wpisu do `.env*`, `docker-compose*`, `railway*`** (`Z10`) | — |
| **wzorzec flagi** | `src/utils/exceleRightRailFlag.ts`, `src/utils/dynamicSwotSevenStagesFlag.ts` | **TYLKO ODCZYT — to są wzorce, nie materiał do edycji** | Errata w raporcie |
| **kontrakty pozostałych typów** | `src/components/MyWork/taskCardContract.ts`, `decisionCardContract.ts`, `notificationCardContract.ts`, `src/components/Interview/insightCardContract.ts`, `interviewCardContract.ts`, `src/components/DiscoveryTools/toolCards.contract.ts` | **TYLKO ODCZYT** — te sześć deskryptorów niesie kompozycję kart zaakceptowaną przez właściciela na zrzutach | Pomiar + wpis do rejestru + gotowy diff nienałożony |
| **typ wiążący** | `src/components/standard/cardContract.types.ts` | **TYLKO ODCZYT — PLIK PRZEKROJOWY.** Typ przepływa przez wszystkie siedem kontraktów; jego zmiana psuje kompilację każdego z nich | **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT DLA DYŻURU 343 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`, + brief: plik:linia · promień rażenia · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **powłoka (przyrząd pomiarowy)** | `src/components/shared/NModeLayout/NModeLeftNav.tsx` | **TYLKO ODCZYT** — nosi uchwyty `data-nmode-section-item` i `data-nmode-section-group`, którymi mierzysz. Zmiana uchwytu unieważnia pomiar | Opis w raporcie + gotowy diff nienałożony |
| **szablony** | `src/components/Initiatives/templates/**`, `src/hooks/useInitiativeTemplate.ts` | **TYLKO ODCZYT w tym dyżurze.** Naprawa nie polega na zmianie szablonów — polega na tym, że kontrakt dostaje pełną listę | Wpis `DO DECYZJI WŁAŚCICIELA` ze zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie” |
| **walidator (NOWE pliki)** | `tests/unit/initiatives/**`, `tests/unit/cards/**`, `tests/unit/flags/**` | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31`. **★ NOWE PLIKI TESTOWE KŁADZIESZ W `tests/`, NIGDY POD `src/`** — plik testowy pod `src/` czerwieni bezpiecznik osiągalności (zdarzyło się 04.09 trzy razy, naprawiane osobnym commitem `6a4919f72d`). `git add -f` obowiązkowo | — |
| **walidator (ZASTANE)** | `tests/unit/initiatives/initiativeTemplateNavigationCompleteness.test.ts`, `tests/unit/cards/decisionCardContractFlagBehavior.day338.test.ts`, pozostałe `tests/unit/initiatives/**` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisywanie NOWYCH przypadków `it(...)`.** Zakaz zmiany i osłabiania istniejących asercji, zakaz obniżania progów (`Z40`) | Nowy plik testowy obok, z nagłówkiem `// KONTRAKT DYŻURU 343` |
| **przyrząd** | `dev-render/screens/karta-initiative.tsx` i pozostałe `dev-render/screens/karta-*.tsx`, `dev-render/main.tsx` | **★ PEŁNA LICENCJA** — to jest harness, nie produkt. Pamiętaj: **host harnessu nie jest produktem**; kontrolki harnessu nie mogą wejść w kadr | — |
| **narzędzie zrzutów** | `scripts/dev/grafika-zrzuty.mjs` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zmiany ADDYTYWNE i OPT-IN** (nowy parametr, domyślnie wyłączony). **ZAKAZ zmiany zachowania domyślnego** — dziesiątki zastanych wywołań w `scripts/dev/*.sh` muszą działać bit w bit jak dziś. **ZAKAZ pisania własnego skryptu zrzutowego obok kanonicznego** | Opis brakującej zdolności w raporcie + gotowy diff |
| **i18n** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości. **Liczba liści nie może zmaleć** (35198 / 33065). ★ Klucz w `pl` trzymający angielskie słowo NIE jest przetłumaczony | — |
| **rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMPLETNOSCI_KART_20260904.md` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie sekcji „Dyżur 343”.** Zakaz kasowania i przeredagowywania zastanych sekcji (w tym sekcji dyżuru 338) | — |
| **dowody** | `evidence/dec388-domkniecie-20260904/**` (**NOWY**) | **★ PEŁNA LICENCJA**, `git add -f` | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY343_DEC388_DOMKNIECIE_REPORT.md` (**NOWY**) | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **migracje** | `server/migrations/**` | **BEZ LICENCJI — ten dyżur nie dodaje ani nie zmienia żadnej migracji.** Przedział nie jest mu przydzielony | Uznasz migrację za potrzebną → **STOP MERYTORYCZNY z briefem**, przechodzisz do następnej pozycji |
| **kanon (dokumentacja)** | `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`, `docs/ui-standards/TRIADA_KANON.md` | **TYLKO ODCZYT** | Errata w raporcie |
| **decyzje** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`, `docs/program/REJESTR_ZNALEZISK_20260903.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest **ZROBIONA** z takim opisem |
| **cudzy teren** | `src/components/DiscoveryTools/**` — **teren dyżuru 344**; `src/components/MyWork/notebook/**`, `src/components/MyWork/prototypes/**`, `src/components/standard/IdeaRightPanel.tsx`, `src/utils/artifactRightRailFlag.ts` — **teren dyżuru 345**; `server/src/services/report/**`, `server/src/routes/assessment-reports.routes.ts` — **teren dyżuru 346**; wszystko dotknięte przez dyżury 347-350 tej serii | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, treść problemu, **gotowa rekomendacja jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit robisz PO KAŻDEJ pozycji,
push na `github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Pomiar wejściowy + **odtworzenie OBU mutacji odbioru na zastanym teście** | TAK | NIE — dowód: `grep -n 'readFileSync' tests/unit/initiatives/initiativeTemplateNavigationCompleteness.test.ts` pokazuje, że pomiar jest odczytem | bazowe | Cztery liczby z DOM (OFF/ON × szablon pusty/niepusty) ze stanem `localStorage` przy każdej; **oraz udowodnione GREEN 4/4 po mutacji filtru i po mutacji resolvera** — z komendami i wynikami dosłownie | `node scripts/dev/grafika-zrzuty.mjs --zlicz='pozycje:[data-nmode-section-item];grupy:[data-nmode-section-group]' --wynik-json=…` ×4 + `npx vitest run tests/unit/initiatives --retry=0 --reporter=json` ×3 | `docs(day343): pomiar wejsciowy i odtworzenie dwoch mutacji obchodzacych test (343 R1)` |
| R2 | **RDZEŃ — test RENDERUJĄCY WIDOK, czerwony od obu mutacji** | TAK | NIE — dowód: `B.1` daje pełną licencję na nowe pliki w `tests/` | +1 test broniący ZACHOWANIA | Nowy plik testowy montuje realny komponent karty i liczy pozycje nawigacji z **wyrenderowanego drzewa**, nie z pliku źródłowego. Mutacja 2 → **RED**. Mutacja 3 → **RED**. Cofnięcie przez `cp` → GREEN, `git diff` pusty | `npx vitest run tests/unit/initiatives tests/unit/cards --retry=0 --reporter=json --outputFile=…` ×5 (baza + 2 RED + 2 GREEN po cofnięciu) | `test(initiatives): kompletnosc 24 sekcji broniona renderem widoku, nie literalem (343 R2)` |
| R3 | Dziewięć brakujących deskryptorów sekcji boardu | TAK | NIE | +1 test | Dziewięć deskryptorów **dopisanych** wg decyzji z `R3`; test kompletności przechodzi po **każdym** board-id z `INITIATIVE_BOARD_CANONICAL_ORDER` i wymaga deskryptora; usunięcie jednego z nowych → **RED** | `npx vitest run tests/unit/initiatives --retry=0 --reporter=json --outputFile=…` | `feat(initiatives): dopisz dziewiec brakujacych deskryptorow sekcji boardu (343 R3)` |
| R4 | Flaga rozstrzygana trójwarstwowo, **domyślnie nadal OFF** | NIE | NIE | +1 test | Nowy moduł flagi; kolejność query → `localStorage` → statyczny env → `false`; widok woła moduł. **Test defaultu: brak wszystkich trzech wejść → `false`.** Mutacja `return true` w defaultcie → **RED** | `npx vitest run tests/unit/flags --retry=0 --reporter=json --outputFile=…` + `grep -rn 'VITE_VF1_INITIATIVE_SECTIONS_COMPLETE' .env* docker-compose* railway* 2>/dev/null` → 0 trafień | `feat(initiatives): flaga kompletnosci sekcji rozstrzygana trojwarstwowo, default OFF (343 R4)` |
| R5 | Para zrzutów OFF/ON gotowa do pokazania właścicielowi | NIE | NIE | n/d | Para na **tym samym realnym rekordzie z niepustym szablonem**, sekcje ROZWINIĘTE, **różne sumy `shasum -a 256`**, podana średnia jasność obu, zero kontrolek harnessu w kadrze, zero błędów konsoli | `node scripts/dev/grafika-zrzuty.mjs …` + `shasum -a 256 evidence/dec388-domkniecie-20260904/*.png` | `docs(day343): para zrzutow OFF/ON karty inicjatywy (343 R5)` |
| R6 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE” **niepusta** | — | `docs(day343): raport` |

> **Kolumna „Wymaga plików przekrojowych?” jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Jedyny plik przekrojowy w promieniu tego dyżuru to
> `src/components/standard/cardContract.types.ts` i **żadna pozycja go nie zmienia**. Jeśli uznasz,
> że musi — produktem jest czerwony kontrakt + brief, a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą z tych liczb mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz
w `bash`, nigdy w `zsh` — `grep --include` w `zsh` zwraca pustkę zamiast wyniku, a pustka nie jest
wynikiem, dopóki nie sprawdzisz, że polecenie się wykonało.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Pozycje `INITIATIVE_BOARD_CANONICAL_ORDER` | 24 | `awk 'NR>795 && /^\];/{exit} NR>795' src/components/Initiatives/sections/initiativeCardContract.ts \| grep -c "'"` | TAK — uruchomione na markerze |
| 2 | Karty `INITIATIVE_CANONICAL_CARDS` | 27 | `awk 'NR>604 && /^\];/{exit} NR>604' src/components/Initiatives/sections/initiativeCardContract.ts \| grep -cE '^  [A-Z_]+,$'` | TAK — to jest DRUGA przestrzeń nazw, nie ta sama lista |
| 3 | Odczyty flagi `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` w `src/` | 1 | `grep -rn 'VITE_VF1_INITIATIVE_SECTIONS_COMPLETE' src/` | TAK — jedyny odczyt to `InitiativeDocumentView.tsx` ok. 5296 |
| 4 | Przypadki `it(...)` w zastanym teście 338 | 4 | `grep -c "  it(" tests/unit/initiatives/initiativeTemplateNavigationCompleteness.test.ts` | TAK — z tego 1 czyta plik widoku |
| 5 | Linie kodu zmienione przez commit „338 R4” | 0 | `git show --stat 98d86e3c7e` | TAK — 1 plik, 42 wstawienia, wszystkie w `docs/` |
| 6 | Pozycje widoczne w DOM przy szablonie `quick_win`, flaga OFF | 6 (i 3 grupy) | `--zlicz='pozycje:[data-nmode-section-item];grupy:[data-nmode-section-group]'` | TAK — **jedyny dopuszczalny przyrząd**; nigdy liczenie ze zrzutu |
| 7 | Pozycje widoczne w DOM przy szablonie `quick_win`, flaga ON | 24 (i 5 grup) | jw. | TAK |
| 8 | Braki deskryptora — reguła semantyczna | 9 | różnica zbiorów wg tabeli w `REJESTR_KOMPLETNOSCI_KART_20260904.md`, sekcja „Dyżur 338 — R4” | TAK — **liczba autora dyżuru 338, nie moja**; przelicz |
| 9 | Braki deskryptora — przecięcie identyfikatorów | 17 | `INITIATIVE_BOARD_CANONICAL_ORDER` minus render-idy z `INITIATIVE_CARD_RENDER_IDS` | TAK — podaj OBIE liczby i regułę, którą przyjąłeś |
| 10 | Liście `translation.json` | pl 35198 / en 33065 | `node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'` | TAK — **liczba nie może zmaleć**; tablice liczone element po elemencie |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY343_DEC388_DOMKNIECIE_REPORT.md` | NOWY | R6 | ZEROWE |
| 2 | `evidence/dec388-domkniecie-20260904/**` | NOWY | R1/R5 | ZEROWE |
| 3 | `src/utils/initiativeSectionsCompleteFlag.ts` | NOWY | R4 | ZEROWE — nazwa nie istnieje na markerze |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMPLETNOSCI_KART_20260904.md` | ZASTANY — dopisanie sekcji | R1/R3 | ŚREDNIE — plik zastany z dyżurów 324 i 338; **dopisujesz sekcję, nie przepisujesz dokumentu** |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `src/components/Initiatives/sections/initiativeCardContract.ts` | R3 | Wyłącznie DOPISYWANIE deskryptorów i mapy board-id → deskryptor; zakaz usuwania i przestawiania |
| `src/components/Initiatives/InitiativeDocumentView.tsx` | R4 | Wyłącznie ciało resolvera flagi (ok. 5294-5302) → wywołanie nowego modułu; default OFF bez zmian |
| `tests/unit/initiatives/**`, `tests/unit/cards/**`, `tests/unit/flags/**` (NOWE) | R2/R3/R4 | `git add -f`; test musi czerwienić się od mutacji ZABEZPIECZENIA, nie mechanizmu |
| `dev-render/screens/karta-*.tsx`, `dev-render/main.tsx` | R1/R5 | Tylko jeśli przyrząd nie pozwala zamontować rekordu z niepustym szablonem; kontrolki harnessu poza kadrem |
| `scripts/dev/grafika-zrzuty.mjs` | R1/R5 | Tylko addytywnie i opt-in; zachowanie domyślne bit w bit jak dziś |
| `public/locales/{pl,en}/translation.json` | R3 | Tylko dopisanie kluczy, parytet w tym samym commicie, liczba liści nie maleje |

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
src/components/Initiatives/templates/**                  — szablon zostaje bez zmian
src/hooks/useInitiativeTemplate.ts                       — jw.
src/components/DiscoveryTools/**                         — teren dyzuru 344
src/components/MyWork/notebook/**                        — teren dyzuru 345
src/components/MyWork/prototypes/**                      — teren dyzuru 345
src/components/standard/IdeaRightPanel.tsx               — teren dyzuru 345
src/utils/artifactRightRailFlag.ts                       — teren dyzuru 345
server/src/services/report/**                            — teren dyzuru 346
server/src/routes/assessment-reports.routes.ts           — teren dyzuru 346
server/migrations/**                                     — przedzial nieprzydzielony
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6390 | `lsof -nP -iTCP:6390 -sTCP:LISTEN` → puste (sprawdzone przy pisaniu instrukcji, marker `6a4919f72d`) |
| Port harnessu | 5530 | `lsof -nP -iTCP:5530 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day343-pg` | `docker ps -a --format '{{.Names}}' \| grep cx-day343` → brak |
| Nazwa bazy | `cx343` | n/d |
| **Przedział migracji** | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | n/d |
| Gałąź | `codex/day343-dec388-domkniecie-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day343-dec388-domkniecie` | nie istnieje |
| Flagi funkcyjne | `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` — **ZASTANA (dyżur 338), domyślnie OFF, tylko w kodzie; dyżur zmienia sposób odczytu, nie wartość** | `grep -rn 'VITE_VF1_INITIATIVE_SECTIONS_COMPLETE' .env* docker-compose* railway* 2>/dev/null` → 0 trafień na markerze |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day343-dec388-domkniecie
git diff --name-only --cached | tee /private/tmp/cx-day343-dec388-domkniecie-artefakty/staged.txt
grep -iE 'cardContract\.types\.ts|taskCardContract|decisionCardContract|notificationCardContract|insightCardContract|interviewCardContract|toolCards\.contract|NModeLeftNav|Initiatives/templates/|useInitiativeTemplate|components/DiscoveryTools/|MyWork/notebook/|MyWork/prototypes/|standard/IdeaRightPanel|utils/artifactRightRailFlag|services/report/|assessment-reports\.routes|server/migrations/' \
  /private/tmp/cx-day343-dec388-domkniecie-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"

# ★ Plik testowy pod src/ czerwieni bezpiecznik osiagalnosci — sprawdz PRZED commitem:
grep -E '^src/.*\.(test|spec)\.(ts|tsx)$' /private/tmp/cx-day343-dec388-domkniecie-artefakty/staged.txt \
  && echo "★★ TEST POD src/ — PRZENIES DO tests/" || echo "testy we wlasciwym miejscu"
```

---

## R1 — POMIAR WEJŚCIOWY I ODTWORZENIE OBU MUTACJI, KTÓRE OBCHODZĄ ZASTANY TEST

**Ta pozycja nie naprawia niczego. Ma udowodnić Twoimi rękami, że zabezpieczenia nie ma** — bez
tego dowodu `R2` nie ma punktu odniesienia i nie da się odróżnić testu, który broni, od testu,
który świeci.

**(a) Cztery liczby z uchwytu DOM.**

| # | Rekord | Flaga | Co zapisujesz |
| --- | --- | --- | --- |
| 1 | z **NIEPUSTYM** `initiativeTemplate` (`quick_win`) | OFF | pozycji · grup · identyfikator rekordu · nazwa szablonu · stan `localStorage` |
| 2 | ten sam | ON | jw. |
| 3 | z **PUSTYM** szablonem (albo bez szablonu) | OFF | jw. |
| 4 | ten sam | ON | jw. |

```bash
cd /private/tmp/cx-day343-dec388-domkniecie
node scripts/dev/grafika-zrzuty.mjs \
  --zlicz='pozycje:[data-nmode-section-item];grupy:[data-nmode-section-group]' \
  --wynik-json=/private/tmp/cx-day343-dec388-domkniecie-artefakty/r1-off-niepusty.json \
  <pozostałe parametry przelotu wg pomocy narzędzia>
#   oczekiwane (1): 6 pozycji, 3 grupy   ·   oczekiwane (2): 24 pozycje, 5 grup
#   oczekiwane (3) i (4): 24 pozycje, 5 grup — IDENTYCZNIE
```

**`0` trafień jest wynikiem `0`, nigdy „pomiar się nie udał”** — brak pomiaru nie jest wynikiem.
Jeżeli selektor daje `0` w obu stanach, mierzysz nie ten ekran: sprawdź, czy komponent w ogóle się
zamontował, zanim cokolwiek ogłosisz.

**(b) Mutacja A — filtr szablonu przywrócony ZA wywołaniem selektora.** Zachowaj wszystkie 24
pozycje w kanonie i zostaw wywołanie selektora dokładnie takie, jakie jest — a wynik selektora
zawęź ponownie zbiorem `enabledNModeSectionIds`, **zapisując to innym wyrażeniem niż zastany
literał** (np. przez zmienną pomocniczą albo inną nazwę parametru strzałki). Uruchom zastany
pakiet. **Oczekiwany wynik: 4/4 GREEN.** Zapisz w raporcie dosłownie: komendę, wynik i pomiar DOM
(oczekiwane: powrót do 6/3 przy fladze ON).

**(c) Mutacja B — resolver flagi wypatroszony.** W `InitiativeDocumentView.tsx` ok. 5294-5302
zastąp ciało `useMemo` przez `void raw; return false;` (albo równoważne). Uruchom zastany pakiet.
**Oczekiwany wynik: 4/4 GREEN** przy fladze, która przestała działać.

**Cofasz OBIE mutacje przez `cp` z kopii w katalogu scratch (`Z27`, NIGDY `git stash`) i pokazujesz
`git diff` — pusty.** Kopie robisz PRZED mutacją.

Prawo zatrzymania po tej pozycji.

## R2 — RDZEŃ: TEST, KTÓRY RENDERUJE WIDOK I CZERWIENI SIĘ OD OBU MUTACJI

**★ To jest powód, dla którego ten dyżur ma najwyższy priorytet.** Dwa poprzednie dyżury tej
rodziny (324 i 338) napisały test, który dał się oszukać w ten sam sposób: **asercja o TREŚCI
PLIKU zamiast asercji o SKUTKU**. Trzeci raz tego nie robimy.

Wymagania, w kolejności rozstrzygającej:

1. **Test montuje realny komponent karty inicjatywy** (albo najwęższą realną powłokę, która
   renderuje nawigację Menu 3) i liczy pozycje **z wyrenderowanego drzewa** — po uchwytach
   `data-nmode-section-item` i `data-nmode-section-group`. **Zakaz `readFileSync` na pliku widoku
   jako jedynego dowodu.** Wolno go zostawić jako dodatkowy przypadek, ale nie liczy się jako
   zabezpieczenie.
2. **Test steruje flagą przez to samo wejście, którego używa produkt** — czyli przez moduł flagi
   z `R4` (albo, dopóki `R4` nie jest zrobione, przez to wejście, które faktycznie czyta widok).
   **Nie wolno podawać wartości flagi bezpośrednio jako argumentu czystej funkcji** — to jest
   dokładnie luka, przez którą przeszła mutacja B.
3. **Dowód mutacyjny wycelowany w ZABEZPIECZENIE, nie w mechanizm** (`Z32`), dla OBU mutacji
   z `R1`, w obie strony:
   - mutacja A (filtr szablonu za selektorem, zapisany innym wyrażeniem) → **RED**;
   - mutacja B (`void raw; return false` w resolverze flagi) → **RED**;
   - cofnięcie każdej przez `cp` (`Z27`) → **GREEN**, `git diff` po cofnięciu **pusty**.
   Wszystkie cztery komendy i cztery wyniki **dosłownie** w raporcie.
4. **Jeżeli którakolwiek z dwóch mutacji nie czerwieni — pozycja jest NIEZROBIONA.** Nie „prawie”,
   nie „test przechodzi, ale to inny aspekt”. Zabezpieczenia wtedy nie ma.

**Trzecia mutacja, kontrolna (obowiązkowa):** usuń **jedną** pozycję z
`INITIATIVE_BOARD_CANONICAL_ORDER` → test ma **CZERWIENIĆ ze wskazaniem nazwy tej pozycji**.
To pilnuje, żeby nowy test nie stał się testem „liczby 24” oderwanym od zawartości.

Plik testowy kładziesz w `tests/`, nigdy pod `src/` (`B.1`, wiersz „walidator (NOWE pliki)”).

Prawo zatrzymania po tej pozycji.

## R3 — DZIEWIĘĆ BRAKUJĄCYCH DESKRYPTORÓW (DRUGA POŁOWA `DEC-388`)

**Decyzja projektowa, którą rozstrzygam za Ciebie — żebyś nie musiał powtarzać STOP-u dyżuru 338:**

> **Identyfikator boardu bez deskryptora dostaje WŁASNY, NOWY deskryptor dopisany na końcu
> katalogu — nie jest doklejany jako „dodatkowa przynależność” istniejącej karty.**
> Powód: `INITIATIVE_BOARD_CANONICAL_ORDER` (24 identyfikatory nawigacji) i
> `INITIATIVE_CANONICAL_CARDS` (27 kart registry) to **dwie różne przestrzenie nazw**, a nie jedna
> rozjechana lista. Rozszerzanie istniejących kart o drugie znaczenie sklei je ze sobą i przy
> najbliższej zmianie któregokolwiek boardu wywróci adapter DB→kanon. Nowy deskryptor niczego nie
> zabiera i nie zmienia kompozycji zaakceptowanej przez właściciela na zrzutach.
>
> **Skutek uboczny, którego masz pilnować:** liczba kart w katalogu rośnie z 27 do 36. Ta liczba
> jest asertowana w komentarzu `buildInitiativeCanonicalCards` („Zwraca 27 kart”) i **może być
> asertowana w zastanych testach**. Jeżeli tak jest — **NIE osłabiasz zastanej asercji** (`Z40`).
> Sprawdzasz komendą, gdzie liczba jest zapisana, i albo aktualizujesz komentarz i asercję razem
> z dopisaniem (bo obie mierzą to samo, a wartość faktycznie się zmieniła), albo — jeżeli asercja
> broni czegoś innego niż liczebność — zostawiasz ją i opisujesz konflikt w raporcie.
> **Rozstrzygnięcie tego wyboru z komendą i cytatem asercji idzie do raportu.**

Produkty pozycji:

1. **Tabela w rejestrze**: sekcja boardu · ma deskryptor? · plik:linia · **dopisany w tym dyżurze?**
   — dla wszystkich **24** identyfikatorów, nie tylko dla braków.
2. **Dziewięć deskryptorów dopisanych** (albo Twoja liczba, jeżeli pomiar dał inną) — z etykietą
   PL+EN, rolą kompozycyjną i wpisem w mapie board-id → deskryptor.
3. **Klucze i18n** dla nowych etykiet, parytet PL+EN w **tym samym commicie**. ★ Klucz w `pl`
   trzymający angielskie słowo **nie jest** przetłumaczony i nie liczy się jako zrobiony.
4. **Test kompletności deskryptorów**: dla każdego board-id istnieje deskryptor. Usunięcie
   jednego z nowych → **RED**.

Jeżeli któraś sekcja nie da się opisać bez decyzji produktowej (bo nie wiadomo, co ma być w prawym
panelu ani jaka jest akcja główna) — wpisujesz `DO DECYZJI WŁAŚCICIELA` ze zdaniem **„czego
konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie”**. Wiersz bez tego zdania liczy się jako
nierozstrzygnięty.

Prawo zatrzymania po tej pozycji.

## R4 — FLAGA ROZSTRZYGANA TRÓJWARSTWOWO, WARTOŚĆ DOMYŚLNA NADAL OFF

**Problem, nie do pomylenia z żądaniem włączenia:** flaga jest dziś czytana wyłącznie z
`import.meta.env`, czyli z wartości wstrzykiwanej **przy budowaniu bundla**. Właściciel nie ma
sposobu, żeby zobaczyć naprawę bez przebudowania aplikacji, a odbiór nie ma sposobu, żeby
przełączyć stan na jednym ekranie. Cała reszta rodziny flag w tym repo rozstrzyga się
trójwarstwowo.

Wymagania:

1. **Nowy moduł** `src/utils/initiativeSectionsCompleteFlag.ts` z kolejnością:
   `?ff_initiative_sections_complete=0|1` → `localStorage["ff.initiative.sections_complete"]` →
   **statyczny** `import.meta.env.VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` → **`false`**.
   ★ Dostęp do `env` musi być **statyczny**: zapis obliczany (`meta.env?.[KLUCZ]`) **nie jest
   podstawiany przez Vite** i cicho zwraca OFF — dyżur 341 zmierzył to na żywym bundlu i naprawił
   u siebie tym samym ruchem.
2. **Widok woła moduł**, nie czyta `import.meta.env` wprost.
3. **Wartość domyślna zostaje `false`.** Zmiana defaultu na ON jest zakazem `Z40` tego dyżuru.
4. **Zero wpisów** do `.env*`, `docker-compose*`, `railway*` (`Z10`) — sprawdzasz komendą i
   wklejasz wynik.
5. **Test defaultu z dowodem mutacyjnym**: brak query, brak `localStorage`, brak zmiennej → `false`;
   mutacja `return true` w gałęzi domyślnej → **RED**.
6. **Środowisko bez `window`** (SSR, test node) → `false`, bez wyjątku.

**Nie włączasz flagi nigdzie poza swoim harnessem**, wyłącznie do pomiaru i zrzutów z `R5`.

Prawo zatrzymania po tej pozycji.

## R5 — PARA ZRZUTÓW OFF/ON GOTOWA DO POKAZANIA WŁAŚCICIELOWI

**★ Właściciel NIGDY nie jest pierwszym testerem wizualnym.** Zanim zobaczy cokolwiek: Ty
renderujesz realny ekran, Ty robisz zrzut, zrzut ma być **czysty** — tokeny `c-*`, zero ozdób,
zero kontrolek harnessu w kadrze.

Wymagania:

- **Ten sam realny rekord z niepustym szablonem** w obu stanach; identyfikator rekordu w raporcie.
- **Sekcje ROZWINIĘTE** — zwinięta sekcja nie jest dowodem; rozwijanie rób tak, żeby nie zamykało
  podglądu, a skan rób po zakończeniu animacji, nie w trakcie.
- **Suma `shasum -a 256` obu plików + średnia jasność obu.**
  **★ Para bajtowo identyczna = ZERO dowodu** — to jest dokładnie ten kształt, który odbiór
  wychwycił przy mutacji A (`38781015e65430dc` po obu stronach).
- **Liczebność bierzesz z uchwytu DOM, nigdy ze zrzutu.**
- **Zero błędów konsoli** w obu stanach; jeżeli są — wypisujesz je co do sztuki i mówisz wprost,
  że para nie nadaje się do pokazania.
- Harness kanoniczny `scripts/dev/grafika-zrzuty.mjs`. **Zakaz pisania własnego skryptu
  zrzutowego obok kanonicznego** — brakującą zdolność dokłada się narzędziu, opt-in.

**Flaga kończy dyżur OFF.** Włączenie następuje dopiero po akcepcie właściciela na tej parze,
osobną decyzją nadzorcy (`Z11`).

Prawo zatrzymania po tej pozycji.

## R6 — RAPORT

Struktura `§R.2`. Obowiązkowo: cztery liczby z `R1` ze stanem `localStorage` przy każdej; **oba
dowody GREEN przy zepsutym produkcie z `R1` dosłownie**; **cztery dowody mutacyjne z `R2`
dosłownie, z komendami i wynikami**; tabela 24 deskryptorów z `R3` i rozstrzygnięcie sprawy liczby
kart w katalogu; wynik komendy „zero wpisów do `.env*`” z `R4`; sumy i jasności pary z `R5`;
sekcja **TWIERDZENIA NIEZWERYFIKOWANE** niepusta.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione, R2 zrobione, R3 rozpoczęte, R4-R5 nietknięte”
jest pełnowartościowym wynikiem — o ile R1 stoi na uchwycie DOM, a R2 na **obu** dowodach
mutacyjnych.

**Odwrotna kolejność — deskryptory (R3) i flaga (R4) zrobione, a rdzeń (R1/R2) „częściowo” — jest
podstawą odrzucenia.** Bez testu, który czerwieni się od mutacji, każda kolejna naprawa w tej
rodzinie będzie się cofać niezauważona.

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela niżej | TAK |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na worktree z markera `6a4919f72d`; zero `BRAK` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, dziesięć wierszy |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — każdy wiersz „tylko odczyt” ma rzeczownik-produkt (diff · brief · kontrakt · pomiar · wpis · errata) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4 |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (344, 345, 346 oraz 347-350) | TAK — `B.4.4`; porty 5530/6390 zmierzone jako wolne, kontener i gałąź nie istnieją |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK |
| 8 | Pułapki środowiska w całości + pułapka właściwa temu modułowi | TAK — `§0.2e` punkt (e) |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru” bez ścieżki | TAK; treść plików spoza repo przepisana do dokumentu |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK |

### AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| Zakaz `Z10` „zero nowych flag” **vs** `R4` tworzy nowy moduł flagi | `Z10` (pole wyjątku) — **żadnej nowej flagi nie ma**; zmienia się wyłącznie sposób odczytu flagi zastanej z dyżuru 338, wartość domyślna bez zmian |
| Zakaz `Z11` „nie odsłaniasz nowego ekranu bez akceptu” **vs** `R5` wymaga zrzutu przy fladze ON | `R5` + `Z11` — flagę włączasz **wyłącznie w swoim harnessie**, do pomiaru i zrzutu; do repo nie wchodzi żadna zmiana wartości domyślnej |
| Zakaz `Z40` „zakaz osłabiania zastanych asercji” **vs** `R3` może zmienić asertowaną liczbę 27 kart | `R3`, ramka „Decyzja projektowa” — rozstrzygnięcie z komendą i cytatem asercji idzie do raportu; osłabienie asercji broniącej czegoś INNEGO niż liczebność pozostaje zakazane |
| Zakaz `Z40` „zakaz kasowania mechanizmu szablonów” **vs** „napraw sufit” | `R2`/`R3` — szablon zostaje funkcją produktu; zmienia się wyłącznie jego SKUTEK dla nawigacji, a `templates/**` jest w tym dyżurze TYLKO DO ODCZYTU |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument” **vs** `R1`/`R3` piszą do rejestru | `Z13` (pole „jedyny inny dokument”) — raport + jeden imiennie wskazany, **zastany** rejestr, do którego wyłącznie dopisujesz sekcję |
| Zakaz `Z15` „zero modelu językowego” **vs** karta inicjatywy potrafi wołać podpowiedzi AI | `Z15` bez wyjątku — żaden pomiar tego dyżuru nie przechodzi przez `llmService` ani `/api/ai/**`; jeżeli sekcja wymaga modelu do renderu, mierzysz jej **obecność w nawigacji**, nie treść |
| Zakaz `Z30` „zero wysyłki” **vs** `R1`/`R5` mogą uruchomić pełny runtime do zrzutów | `§0.2b` punkt (4) — wyjątek wyłącznie dla zrzutów, po dowodach (a) i (b), z deklaracją dosłowną w raporcie |
| Zakaz `Z18` „infra testowa tylko do odczytu” **vs** `R2` potrzebuje montażu komponentu React | `B.1`, wiersz „infra testowa” — środowisko `jsdom` i potrzebne zmienne stawiasz **w linii komendy**, nie w `vitest*.config.ts`; opis w raporcie czyni pozycję ZROBIONĄ |
| „Odtwórz mutacje odbioru” (`R1`) **vs** `Z27` zakaz `git stash` | `R1` punkt (c) — kopie robisz przez `cp` do katalogu scratch PRZED mutacją i wracasz przez `cp`; schowek jest współdzielony między worktree tego repozytorium |
