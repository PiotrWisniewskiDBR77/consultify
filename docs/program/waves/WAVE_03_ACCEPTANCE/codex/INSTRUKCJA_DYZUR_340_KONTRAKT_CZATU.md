# INSTRUKCJA DYŻURU nr 340 — Codex — „DEC-391 — wymóg „przycisk zamykania nad lepkim nagłówkiem głosu" ma obowiązywać na ŻYWYM panelu czatu: ustalić pomiarem, jak wygląda w `UnifiedChatPanel`, napisać asercję na realnym ekranie zamiast na napisie w pliku, i dostarczyć parę zrzutów PRZED/PO do akceptu właściciela"

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
> **wyłącznie** `/private/tmp/cx-day340-kontrakt-czatu`.

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
Zakres: **Czat (Teresa) — powłoka panelu bocznego: przycisk zamykania wobec górnej strefy żywego panelu**.
Trasy front: ``src/layouts/MainLayout.tsx` (przycisk zamykania ok. linii 476-486, `React.lazy` panelu ok. 43-46, montaż ok. 485), `src/components/AIChat/UnifiedChatPanel.tsx` (żywy panel), `src/components/AIChat/MessageRenderer.tsx``. Trasy tył: `brak — dyżur jest wyłącznie frontowy; PostgreSQL służy migracjom, dowodowi `Z30` i ewentualnemu uruchomieniu runtime'u do zrzutów`.

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
WT=/private/tmp/cx-day340-kontrakt-czatu
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
git -C "$VAULT" worktree add "$WT" -b codex/day340-kontrakt-czatu-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day340-kontrakt-czatu/config.worktree"
cat "$VAULT/worktrees/cx-day340-kontrakt-czatu/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day340-kontrakt-czatu-scratch
mkdir -p /private/tmp/cx-day340-kontrakt-czatu-artefakty

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
git -C "$WT" push github-backup codex/day340-kontrakt-czatu-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 74c07919ce..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `osiem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

★ WSZYSTKIE grepy uruchamiasz w BASHU (`bash -lc '...'` albo skrypt `.sh`).
W `zsh` `grep --include=*.tsx` zwraca `no matches found` ZAMIAST wyników — pustka
nie jest wynikiem, dopóki nie sprawdzisz, że polecenie w ogóle się wykonało.

```bash
# (1) TEZA: martwy ChatPanel.tsx zostal USUNIETY 04.09
find src -name 'ChatPanel*'
git log --oneline -12
#   oczekiwane: ZERO plikow; w logu commit „chore(chat): usun martwe poddrzewo czatu"

# (2) ★ TEZA-SPROSTOWANIE: straznik kontraktu zostal JUZ PRZEPISANY
cat src/layouts/__tests__/MainLayoutTeresaClose.contract.test.ts
#   oczekiwane: test czyta `../MainLayout.tsx` (NIE ChatPanel), ma przypadek
#   „keeps the close control above the sticky voice header" z wyrazeniem regularnym na
#   `absolute top-2 right-2 z-30` + `aria-label={t('layout.aiPanel.close'`, oraz przypadek
#   „mounts the live chat surface (UnifiedChatPanel), not a dead panel file".
#   ★ Zlecenie nadzorcy opisywalo STAN SPRZED tej naprawy (klasy `pl-4 pr-14 py-3`,
#   `sticky top-0 z-10`, odczyt ChatPanel.tsx) — to jest NIEAKTUALNE. Zapisz to.
#   Co ZOSTAJE defektem: test dalej asertuje NAPIS w zrodle, nie ulozenie w DOM.

# (3) ★ TEZA GLOWNA: w zywym panelu NIE MA ani jednego elementu `sticky`
grep -rn "sticky" src/components/AIChat/*.tsx
#   oczekiwane: ZERO trafien. Jezeli potwierdzisz — „lepki naglowek glosu" NIE MA
#   ODPOWIEDNIKA w zywym panelu i to jest wynik do zapisania jako PYTANIE, nie do wymyslenia.

# (4) TEZA: przycisk zamykania mieszka w MainLayout, nie w panelu
sed -n '472,492p' src/layouts/MainLayout.tsx
grep -n "UnifiedChatPanel" src/layouts/MainLayout.tsx
#   oczekiwane: przycisk `absolute top-2 right-2 z-30` ok. 476-486; `React.lazy` ok. 43-46;
#   montaz `<UnifiedChatPanel` ok. 485

# (5) TEZA: oba pliki czatu sa ZYWE i duze
wc -l src/components/AIChat/UnifiedChatPanel.tsx src/components/AIChat/MessageRenderer.tsx
#   oczekiwane: ok. 7582 i ok. 2615 linii — ostroznie z kazda zmiana

# (6) ★ TEZA: pakiet czatu ma ZASTANA czerwien — zmierz JA PRZED zmianami
npx vitest run tests/components/AIChat/UnifiedChatPanel.test.tsx --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day340-kontrakt-czatu-artefakty/przed.json
#   oczekiwane wg zlecenia: 4 czerwone przypadki SPRZED tego dyzuru (dlug, nie regresja).
#   ★ To jest LICZBA NADZORCY, nie moj pomiar — policz sam i zapisz SWOJA.
#   Nazwy czerwonych zapisz do `przed-nazwy.txt`. „No test files found" = BLAD KOMENDY, nie PASS.

# (7) TEZA: liscie i18n
node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'
#   oczekiwane: 35198 33065 — te liczby NIE MOGA zmalec

# (8) zasoby wolne
df -h /
lsof -nP -iTCP:6376 -sTCP:LISTEN; lsof -nP -iTCP:5516 -sTCP:LISTEN
docker ps --format '{{.Names}}' | grep cx-day340 || echo "brak kontenera 340"
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day340-kontrakt-czatu-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6376`. Twój JEDYNY port harnessu to `5516`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day340-pg`**. **ZAKAZANE:** `6374, 6375 (bazy dyżurów 338 i 339), 5514, 5515 (runtime dyżurów 338 i 339), 5432 (cudzy nasłuch na hoście), a także wszystkie porty dyżurów 334-337, które biegną równolegle w tej serii`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNA — ten dyżur nie zakłada flagi i nie zmienia wartości domyślnej żadnej zastanej. Zmiana układu przycisku zamykania, jeżeli w ogóle będzie potrzebna, jest naprawą zastanego elementu, a nie nowym ekranem; do repo wchodzi dopiero po akcepcie właściciela na parze zrzutów`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/resultsInternalBetaVisibility.middleware.ts`, `server/src/middleware/appErrorMapper.ts`, `src/services/api.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY340_KONTRAKT_CZATU_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md`, bo ten dyżur jest przekrojowy wobec modułów — dotyczy powłoki układu, nie jednego modułu. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day340-kontrakt-czatu-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day340-kontrakt-czatu-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **★★ ZAKAZ „NAPRAWIANIA" ZASTANEJ CZERWIENI W `tests/components/AIChat/UnifiedChatPanel.test.tsx` PRZEZ WYCISZENIE.** Ten pakiet ma czerwone przypadki SPRZED tego dyżuru; `.skip`, `.todo`, poszerzenie `exclude` i zmiana asercji są zakazem (`Z35`). Mierzysz je PRZED i PO, po NAZWACH, i nie przypisujesz sobie ani cudzej czerwieni, ani cudzej zieleni. **ZAKAZ `pkill` i `killall` w każdej postaci** — inne dyżury tej serii mają żywe procesy. **ZAKAZ zgadywania klas CSS**: każda asercja układu ma stać na zmierzonym DOM, nie na nazwie klasy przepisanej z nieistniejącego już pliku. | Zastany strażnik `src/layouts/__tests__/MainLayoutTeresaClose.contract.test.ts` przechodził 4/4 na pliku, którego użytkownik nigdy nie widział — `src/components/layout/ChatPanel.tsx` był martwy i został usunięty 04.09. Wyciszenie zastanej czerwieni w pakiecie czatu powtórzyłoby dokładnie ten kształt: zielony wynik bez pokrycia produktu |

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
cd /private/tmp/cx-day340-kontrakt-czatu

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day340-pg psql -U postgres -d cx340 \
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
cd /private/tmp/cx-day340-kontrakt-czatu

docker run -d --name cx-day340-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx340 \
  -p 127.0.0.1:6376:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day340-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6376/cx340 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6376/cx340 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day340-kontrakt-czatu && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6376/cx340 \
JWT_SECRET=cx340-test-secret-do-not-reuse \
npx vitest run src/layouts/__tests__ tests/components/AIChat --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day340-kontrakt-czatu-artefakty/day340-czat.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day340-kontrakt-czatu && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/layouts/__tests__ tests/components/AIChat --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day340-kontrakt-czatu-artefakty/day340-czat.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day340-kontrakt-czatu/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day340-pg psql -U postgres -d cx340 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day340-pg`.
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
> **(e) PRZYCISK ZAMYKANIA NIE MIESZKA W PANELU. Jest w `src/layouts/MainLayout.tsx` (ok. 476-486) jako element `absolute top-2 right-2 z-30` **nad** kontenerem panelu, a `UnifiedChatPanel` montowany jest pod nim przez `React.Suspense`. Znaczy to, że sprzeczka o warstwy rozgrywa się między DWOMA plikami i żaden pomiar patrzący na jeden z nich osobno jej nie zobaczy. Druga pułapka: `UnifiedChatPanel.tsx` ma 7582 linie, a `MessageRenderer.tsx` 2615 — oba są ŻYWE i szeroko konsumowane; jakakolwiek zmiana w nich ma promień rażenia daleko poza ten dyżur. Trzecia: harness zrzutowy potrafi zamknąć podgląd przed skanem i policzyć kontrast w trakcie animacji wejścia — zrzut robisz po ustabilizowaniu widoku i porównujesz DŁUGOŚĆ TEKSTU z opcją i bez, zanim ogłosisz cokolwiek o wyglądzie**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day340-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day340-kontrakt-czatu-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1, R2, R3`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6376` albo `5516` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6376` albo `5516`** (`Z7`).

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

Właściciel potwierdził, że wymóg **„przycisk zamykania ma być dostępny nad lepkim nagłówkiem
głosu”** dalej obowiązuje: **„Tak — dopisać do żywego panelu”** (`DEC-391`, zapis
w `docs/program/REJESTR_ZNALEZISK_20260903.md`, sekcja N).

Pytanie brzmi: **jak ten wymóg wygląda na ekranie, który użytkownik naprawdę widzi.**

### Skąd się wzięła wątpliwość

Wymogu pilnował `src/layouts/__tests__/MainLayoutTeresaClose.contract.test.ts`. W wersji sprzed
04.09 czytał on plik `src/components/layout/ChatPanel.tsx` i sprawdzał w nim obecność klas
`pl-4 pr-14 py-3` oraz `sticky top-0 z-10`. Test przechodził **4/4**.

**`ChatPanel.tsx` był martwy.** Nieosiągalny od korzenia produktu, zero importerów; żywy czat
montuje `UnifiedChatPanel` przez `React.lazy` w `src/layouts/MainLayout.tsx` (ok. linii 43-46).
Plik został usunięty 04.09 wraz z całym martwym poddrzewem czatu. Strażnik świecił na zielono
**na pliku, którego użytkownik nigdy nie widział** — to jest jeden z najdroższych kształtów
fałszywego „gotowe” w tym programie.

### ★ Sprostowanie zlecenia — dwie rzeczy, które zmierzyłem inaczej niż nadzorca

**Zapisuję je wprost, żebyś nie naprawiał czegoś, co jest już naprawione:**

1. **Zlecenie mówi, że strażnik dalej czyta `ChatPanel.tsx` i klasy `pl-4 pr-14 py-3` /
   `sticky top-0 z-10`. To jest STAN SPRZED NAPRAWY.** Na markerze `74c07919ce` test został **już
   przepisany** (commit `chore(chat): usun martwe poddrzewo czatu … i napraw test kontraktowy
   MainLayout`): czyta `../MainLayout.tsx`, ma przypadek *„keeps the close control above the sticky
   voice header”* z wyrażeniem regularnym na `absolute top-2 right-2 z-30` +
   `aria-label={t('layout.aiPanel.close'`, oraz przypadek *„mounts the live chat surface
   (UnifiedChatPanel), not a dead panel file”*. **Zweryfikuj to sam** i zapisz wynik.
2. **Co ZOSTAJE defektem:** ten test dalej **czyta plik jako TEKST** (`fs.readFileSync` +
   `toContain` / `toMatch`) i asertuje **obecność napisu w źródle**, a nie **ułożenie elementów
   w DOM**. To jest dokładnie ten sam kształt, który dał 4/4 na martwym pliku — tylko przesunięty
   o jeden plik dalej. **To jest przedmiot tego dyżuru.**

### ★ Teza główna, którą musisz rozstrzygnąć jako pierwszą

**W żywym panelu prawdopodobnie NIE MA „lepkiego nagłówka głosu”.**

Mój pomiar na markerze: `grep -rn "sticky" src/components/AIChat/*.tsx` → **ZERO trafień.**
`UnifiedChatPanel.tsx` nie ma ani jednej z klas, których pilnował stary test. Sterowanie głosem
istnieje (`useUniversalVoice`, `useTeresaVoiceContext`, przełączniki ok. linii 6861-6985), ale nie
jako **przyklejony nagłówek na górze panelu**.

**Jeżeli to potwierdzisz — napisz to WPROST jako pytanie do właściciela, zamiast wymyślać
odpowiednik.** Wymóg, który nie ma referentu, jest wynikiem pomiaru, nie luką do zapełnienia
domysłem. Zdanie „w żywym panelu nie ma lepkiego nagłówka głosu; oto co jest zamiast niego” jest
**pełnowartościowym produktem tego dyżuru**.

### Co REALNIE jest do zmierzenia

Przycisk zamykania **nie mieszka w panelu**. Jest w `src/layouts/MainLayout.tsx` (ok. linii
476-486):

```
absolute top-2 right-2 z-30  ·  aria-label={t('layout.aiPanel.close', 'Close AI panel')}
```

Leży **nad** kontenerem panelu, a `UnifiedChatPanel` montuje się pod nim przez `React.Suspense`
(ok. linii 485). Realne pytanie brzmi więc:

> **Czy w górnym prawym rogu żywego panelu, w prostokącie zajmowanym przez przycisk zamykania,
> znajduje się jakikolwiek interaktywny element panelu — i czy przycisk go zasłania albo sam jest
> przez niego zasłonięty?**

To pytanie rozstrzyga się **pomiarem ułożenia w DOM** (prostokąty elementów, warstwy, kolejność
w drzewie dostępności), nigdy zgadywaniem klasy CSS przepisanej z nieistniejącego pliku (`Z40`).

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

## ★ Zmierz moje liczby sam

Twierdzę: `src/components/layout/ChatPanel.tsx` **nie istnieje**; `grep -rn "sticky"
src/components/AIChat/*.tsx` daje **0** trafień; przycisk zamykania stoi w `MainLayout.tsx`
ok. linii 476-486 z klasami `absolute top-2 right-2 z-30`; `React.lazy` panelu jest ok. 43-46,
a montaż ok. 485; `UnifiedChatPanel.tsx` ma ok. **7582** linii, `MessageRenderer.tsx` ok. **2615**;
zastany strażnik ma **4** przypadki (`it.each` z trzema wierszami + dwa `it`); liście
`public/locales/pl/translation.json` = **35198**, `en` = **33065**.

★ **Liczba „4 czerwone przypadki w `tests/components/AIChat/UnifiedChatPanel.test.tsx`” pochodzi
ze zlecenia nadzorcy, NIE z mojego pomiaru.** Nie uruchomiłem tego pakietu. **Policz sam i zapisz
swoją liczbę wraz z NAZWAMI** — to jest jedyny sposób, żeby nie przypisać sobie cudzego długu ani
cudzej zieleni (`Z37`).

---

## B.1. TABELA LICENCJI PLIKOWYCH — CAŁA ŚCIEŻKA

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA” — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **powłoka (rdzeń dyżuru)** | `src/layouts/MainLayout.tsx` | **★ WĄSKA LICENCJA — WYŁĄCZNIE blok przycisku zamykania panelu czatu** (ok. 472-492): klasy warstwy i pozycji, `aria-label`, `title`, kolejność w drzewie. **ZAKAZ zmiany logiki montażu panelu, `React.lazy`, kontekstów i czegokolwiek poza tym blokiem** | Gotowy diff w bloku kodu, **nienałożony**, + brief z promieniem rażenia |
| **żywy panel** | `src/components/AIChat/UnifiedChatPanel.tsx` | **TYLKO ODCZYT — 7582 linie, plik ŻYWY i szeroko konsumowany.** Zmiana w nim ma promień rażenia daleko poza ten dyżur | **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT DLA DYŻURU 340 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`, + brief: plik:linia · promień rażenia · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **żywy panel** | `src/components/AIChat/MessageRenderer.tsx` | **TYLKO ODCZYT — 2615 linii, plik ŻYWY** | jak wyżej |
| **pozostały czat** | `src/components/AIChat/**` (reszta), `src/contexts/TeresaVoiceContext*`, `src/hooks/useUniversalVoice*` | **TYLKO ODCZYT** | Opis w raporcie z dowodem plik:linia + gotowy diff nienałożony |
| **walidator (rdzeń)** | `src/layouts/__tests__/MainLayoutTeresaClose.contract.test.ts` | **★ PEŁNA LICENCJA** — to jest strażnik do naprawy. **ZAKAZ USUNIĘCIA któregokolwiek z zastanych przypadków**; wolno je zostawić obok nowych, wolno wzmocnić, nie wolno osłabić ani skasować (`Z35`) | — |
| **walidator (NOWE pliki)** | `src/layouts/__tests__/**` (NOWE), `tests/components/AIChat/**` (NOWE) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31`. Nowe pliki w `tests/` wymagają `git add -f` | — |
| **walidator (ZASTANY, z długiem)** | `tests/components/AIChat/UnifiedChatPanel.test.tsx` | **TYLKO ODCZYT.** Ma **zastaną czerwień sprzed tego dyżuru**. **ZAKAZ `.skip`, `.todo`, zmiany asercji, poszerzenia `exclude`** (`Z35`, `Z40`) | Pomiar PRZED i PO **po nazwach** (`§0.4a`), opis w raporcie: które przypadki były czerwone przed Twoją zmianą i są czerwone po niej. **To jest dług, nie Twoja regresja — i nie Twoja zasługa** |
| **narzędzie zrzutów** | `scripts/dev/grafika-zrzuty.mjs` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zmiany ADDYTYWNE i OPT-IN** (nowy parametr, domyślnie wyłączony). **ZAKAZ zmiany zachowania domyślnego** i **ZAKAZ pisania własnego skryptu zrzutowego obok kanonicznego** | Opis brakującej zdolności w raporcie + gotowy diff |
| **przyrząd** | `dev-render/screens/**` (NOWY ekran dla panelu czatu, jeśli potrzebny) | **★ PEŁNA LICENCJA** — to jest harness, nie produkt. **Kontrolki harnessu nie mogą wejść w kadr**; host harnessu nie jest produktem | — |
| **i18n** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości. **Liczba liści nie może zmaleć** (35198 / 33065). ★ Klucz w `pl` trzymający angielskie słowo NIE jest przetłumaczony | — |
| **dowody** | `evidence/kontrakt-czatu-20260904/**` (**NOWY**) | **★ PEŁNA LICENCJA**, `git add -f`. Tu ląduje para PRZED/PO | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY340_KONTRAKT_CZATU_REPORT.md` (**NOWY**) | `§R.2` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| **kanon (dokumentacja)** | `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`, `docs/ui-standards/TRIADA_KANON.md` | **TYLKO ODCZYT** | Errata w raporcie |
| **decyzje** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`, `docs/program/REJESTR_ZNALEZISK_20260903.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest **ZROBIONA** z takim opisem |
| **migracje** | `server/migrations/**` | **BEZ LICENCJI — ten dyżur nie dodaje ani nie zmienia żadnej migracji.** Przedział nie jest mu przydzielony | Uznasz migrację za potrzebną → **STOP MERYTORYCZNY z briefem**, przechodzisz do następnej pozycji |
| **cudzy teren** | `src/components/Initiatives/**`, `src/components/Initiatives/sections/initiativeCardContract.ts` — **teren dyżuru 338**; `server/src/services/report/**`, `server/src/routes/method-core.routes.ts`, `server/src/routes/assessment-reports.routes.ts` — **teren dyżuru 339**; wszystko dotknięte przez dyżury 334-337 tej serii | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, treść problemu, **gotowa rekomendacja jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit robisz PO KAŻDEJ pozycji,
push na `github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | **RDZEŃ:** czy „lepki nagłówek głosu” w ogóle istnieje w żywym panelu | TAK | NIE — dowód: `grep -rn "sticky" src/components/AIChat/*.tsx` jest odczytem | bazowe | Werdykt TAK/NIE z komendą i wynikiem; jeśli NIE — **opis, co JEST w górnej strefie panelu**, wypisany imiennie (element, plik:linia, rola w drzewie dostępności), oraz **pytanie do właściciela**, nie wymyślony odpowiednik | `grep -rn "sticky\|top-0" src/components/AIChat/*.tsx` (w `bash`, **bez `\| head`**) + odczyt DOM z harnessu | `docs(day340): pomiar gornej strefy zywego panelu czatu (340 R1)` |
| R2 | **RDZEŃ:** asercja na REALNYM ekranie zamiast na napisie w pliku | TAK | NIE — dowód: `B.1` daje pełną licencję na `MainLayoutTeresaClose.contract.test.ts` | +1 test | Nowy przypadek, który **renderuje** układ z zamontowanym `UnifiedChatPanel` i sprawdza **ułożenie** (przycisk zamykania osiągalny, nie zasłonięty, nie zasłania interaktywnego elementu panelu). Zastane przypadki **zostają**, niezmienione | `npx vitest run src/layouts/__tests__ --retry=0 --reporter=json --outputFile=…` | `test(layout): kontrakt przycisku zamykania na realnym ekranie, nie na napisie (340 R2)` |
| R3 | **RDZEŃ:** dowód mutacyjny wycelowany w ZABEZPIECZENIE + kontrola sensu | TAK | NIE | n/d | Mutacja psująca **układ** (np. usunięcie warstwy przycisku albo podniesienie warstwy elementu panelu) → nowy test **CZERWONY**; cofnięcie przez `cp` → **ZIELONY**; `git diff` po cofnięciu **pusty**. ★ **Ta sama mutacja przy ZASTANYM teście** — zapisz, czy zastany ją łapie | `npx vitest run src/layouts/__tests__ --retry=0` ×4 (mutacja/cofnięcie × nowy/zastany) | `test(layout): dowod mutacyjny ulozenia przycisku zamykania (340 R3)` |
| R4 | Para zrzutów PRZED/PO do akceptu właściciela | NIE | NIE | n/d | Kadry kanonicznym harnessem, light+dark, panel czatu **otwarty i ustabilizowany**; `shasum -a 256` i średnia jasność każdego kadru; **para bajtowo identyczna = ZERO dowodu**; każdy kadr obejrzany i opisany z nazwy | `node scripts/dev/grafika-zrzuty.mjs … --porownaj-z=…` | `docs(day340): para zrzutow PRZED/PO panelu czatu (340 R4)` |
| R5 | Rozliczenie zastanej czerwieni pakietu czatu | NIE | NIE | n/d | `przed-nazwy.txt` i `po-nazwy.txt` dla `tests/components/AIChat/UnifiedChatPanel.test.tsx`, `diff` między nimi w raporcie. **Twoja liczba, nie moja.** Zero wyciszeń | `npx vitest run tests/components/AIChat/UnifiedChatPanel.test.tsx --retry=0 --reporter=json --outputFile=…` ×2 | `docs(day340): rozliczenie zastanej czerwieni pakietu czatu (340 R5)` |
| R6 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE” **niepusta** | — | `docs(day340): raport` |

> **Kolumna „Wymaga plików przekrojowych?” jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Pliki przekrojowe w promieniu tego dyżuru to `UnifiedChatPanel.tsx`
> i `MessageRenderer.tsx` — **żadna pozycja ich nie zmienia**. Jeśli uznasz, że musi, produktem
> jest czerwony kontrakt + brief, a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą z tych liczb mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz
w `bash`, nigdy w `zsh`.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Pliki `ChatPanel*` w `src/` | 0 | `find src -name 'ChatPanel*'` | TAK — **zero jest wynikiem**, plik usunięto 04.09 |
| 2 | Elementy `sticky` w żywym panelu czatu | 0 | `grep -rn "sticky" src/components/AIChat/*.tsx` | TAK — **to jest teza główna `R1`** |
| 3 | Przypadki w zastanym strażniku | 4 (`it.each` ×3 + 2 `it`) | `cat src/layouts/__tests__/MainLayoutTeresaClose.contract.test.ts` | TAK — uruchomione na markerze |
| 4 | Linie `UnifiedChatPanel.tsx` / `MessageRenderer.tsx` | 7582 / 2615 | `wc -l src/components/AIChat/UnifiedChatPanel.tsx src/components/AIChat/MessageRenderer.tsx` | TAK — miara promienia rażenia |
| 5 | Czerwone przypadki w `tests/components/AIChat/UnifiedChatPanel.test.tsx` PRZED zmianami | **4 wg zlecenia nadzorcy — NIE MÓJ POMIAR** | `npx vitest run tests/components/AIChat/UnifiedChatPanel.test.tsx --retry=0 --reporter=json --outputFile=…` | TAK — **policz sam i podaj SWOJĄ liczbę z nazwami**; przepisanie mojej jest zawyżeniem (`Z24`) |
| 6 | Linia przycisku zamykania w `MainLayout.tsx` | ok. 476-486 | `sed -n '472,492p' src/layouts/MainLayout.tsx` | TAK |
| 7 | Liście `translation.json` | pl 35198 / en 33065 | `node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'` | TAK — **liczba nie może zmaleć** |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY340_KONTRAKT_CZATU_REPORT.md` | NOWY | R6 | ZEROWE |
| 2 | `evidence/kontrakt-czatu-20260904/**` | NOWY | R4 | ZEROWE |
| 3 | `src/layouts/__tests__/MainLayoutTeresaClose.contract.test.ts` | ZASTANY — dopisanie przypadków | R2/R3 | **★★ WYSOKIE** — plik ruszany 04.09 przy usuwaniu martwego poddrzewa czatu; **dopisujesz przypadki, nie przepisujesz pliku** |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `src/layouts/MainLayout.tsx` | R2/R3 | Wyłącznie blok przycisku zamykania (ok. 472-492) i wyłącznie wtedy, gdy pomiar z `R1` wykaże realny defekt układu; z dowodem mutacyjnym w obie strony; do repo wchodzi razem z parą zrzutów |
| `dev-render/screens/**` (NOWY) | R1/R4 | Tylko jeśli bez własnego ekranu harnessu nie da się zamontować panelu; kontrolki harnessu poza kadrem |
| `scripts/dev/grafika-zrzuty.mjs` | R4 | Tylko addytywnie i opt-in; zachowanie domyślne bit w bit jak dziś |
| `public/locales/{pl,en}/translation.json` | R2 | Tylko dopisanie kluczy, parytet w tym samym commicie, liczba liści nie maleje |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
src/components/AIChat/UnifiedChatPanel.tsx          — ZYWY, 7582 linie, przekrojowy
src/components/AIChat/MessageRenderer.tsx           — ZYWY, 2615 linii, przekrojowy
tests/components/AIChat/UnifiedChatPanel.test.tsx   — zastana czerwien; ZAKAZ wyciszenia
src/contexts/TeresaVoiceContext*                    — poza zakresem
src/hooks/useUniversalVoice*                        — poza zakresem
src/components/Initiatives/**                       — teren dyzuru 338
server/src/services/report/**                       — teren dyzuru 339
server/src/routes/method-core.routes.ts             — teren dyzuru 339
server/src/routes/assessment-reports.routes.ts      — teren dyzuru 339
server/migrations/**                                — przedzial nieprzydzielony
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6376 | `lsof -nP -iTCP:6376 -sTCP:LISTEN` → puste (sprawdzone przy pisaniu instrukcji) |
| Port harnessu | 5516 | `lsof -nP -iTCP:5516 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day340-pg` | `docker ps --format '{{.Names}}' \| grep cx-day340` → brak |
| Nazwa bazy | `cx340` | n/d |
| **Przedział migracji** | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | n/d |
| Gałąź | `codex/day340-kontrakt-czatu-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day340-kontrakt-czatu` | nie istnieje |
| Flagi funkcyjne | **ŻADNE** — dyżur nie zakłada flagi i nie zmienia żadnej domyślnej | `git diff --name-only` nie może zawierać `.env*`, `docker-compose*`, `railway*` |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day340-kontrakt-czatu
git diff --name-only --cached | tee /private/tmp/cx-day340-kontrakt-czatu-artefakty/staged.txt
grep -iE 'AIChat/UnifiedChatPanel\.tsx|AIChat/MessageRenderer\.tsx|tests/components/AIChat/UnifiedChatPanel\.test\.tsx|TeresaVoiceContext|useUniversalVoice|components/Initiatives/|services/report/|method-core\.routes|assessment-reports\.routes|server/migrations/|\.env|docker-compose|railway' \
  /private/tmp/cx-day340-kontrakt-czatu-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"
```

---

## R1 — CZY „LEPKI NAGŁÓWEK GŁOSU” W OGÓLE ISTNIEJE W ŻYWYM PANELU

**To jest pierwsza pozycja, bo od jej wyniku zależy sens pozostałych.**

Krok po kroku:

1. `grep -rn "sticky" src/components/AIChat/*.tsx` w `bash`. **Moja liczba: 0 trafień.**
   Pustka z `grep` nie jest wynikiem, dopóki nie sprawdzisz, że polecenie się wykonało — `--include`
   w `zsh` zwraca `no matches found` zamiast wyniku.
2. Zamontuj żywy panel w harnessie i **odczytaj DOM** górnej strefy: jakie elementy leżą
   w prostokącie `top-2 right-2` o boku ~32 px, jakie mają warstwy, jaka jest ich kolejność
   w drzewie dostępności.
3. Wypisz **imiennie**, co jest w górnej strefie panelu: element · plik:linia · rola · czy
   interaktywny.

**Trzy możliwe werdykty, wszystkie pełnowartościowe:**

- **(A) Lepki nagłówek głosu istnieje** — wtedy `R2` asertuje wymóg dosłownie: przycisk zamykania
  nad nim, bez nachodzenia.
- **(B) Nie istnieje, ale istnieje jego funkcjonalny odpowiednik** (np. pasek sterowania głosem
  w górnej strefie) — wtedy `R2` asertuje wymóg wobec tego odpowiednika, a Ty **nazywasz go
  wprost** i zaznaczasz, że to Twoja interpretacja.
- **(C) Nie istnieje nic takiego** — wtedy **piszesz to wprost jako pytanie do właściciela**,
  z opisem, co jest zamiast, i **nie wymyślasz odpowiednika**. `R2` asertuje wtedy węższy,
  ale prawdziwy wymóg: **przycisk zamykania jest osiągalny i niczego nie zasłania**.

Werdykt wpisujesz jako **DO DECYZJI WŁAŚCICIELA** ze zdaniem **„czego konkretnie mi zabrakło, żeby
rozstrzygnąć samodzielnie”**. Wpis bez tego zdania liczy się jako nierozstrzygnięty.

Prawo zatrzymania po tej pozycji.

## R2 — ASERCJA NA REALNYM EKRANIE, NIE NA NAPISIE W PLIKU

**Zastany strażnik czyta plik jako TEKST i sprawdza obecność napisu.** Taki test przechodził 4/4
na pliku, którego użytkownik nigdy nie widział. Twój ma **renderować** i **mierzyć ułożenie**.

Wymagania:

1. Nowy przypadek **renderuje** układ z zamontowanym `UnifiedChatPanel` (albo jego realnym
   zastępnikiem w środowisku testowym, jeśli leniwe ładowanie tego wymaga — i wtedy **zapisujesz
   w raporcie, czym dokładnie jest zamontowany komponent**, żeby nikt nie wziął atrapy za produkt).
2. Asercja dotyczy **ułożenia**, nie napisu: przycisk zamykania jest w drzewie dostępności,
   ma etykietę, jest osiągalny klawiaturą, i **nie leży pod** ani **nie nachodzi na** interaktywny
   element panelu wskazany w `R1`.
3. **Zastane cztery przypadki zostają, niezmienione.** Wolno je zostawić obok nowych, wolno
   wzmocnić; **nie wolno osłabić ani skasować** (`Z35`, `Z40`).
4. **Nie zgadujesz klas.** Każda liczba w asercji pochodzi ze zmierzonego DOM, nie z nazwy klasy
   przepisanej z nieistniejącego pliku.

Prawo zatrzymania po tej pozycji.

## R3 — DOWÓD MUTACYJNY WYCELOWANY W ZABEZPIECZENIE + KONTROLA SENSU

**Mutacja celuje w ZABEZPIECZENIE, nie w mechanizm** (`Z32`), w obie strony:

1. Zepsuj **układ** — usuń warstwę przycisku zamykania albo podnieś warstwę elementu panelu tak,
   żeby przycisk został zasłonięty. Nowy test → **CZERWONY**, ze wskazaniem, co zasłania co.
2. Cofnij przez `cp` z kopii w katalogu scratch (`Z27`, **nigdy `git stash`**) → **ZIELONY**.
   `git diff` po cofnięciu **pusty**.
3. **★ KONTROLA SENSU — obowiązkowa.** Uruchom **tę samą mutację** przy **ZASTANYM** teście
   `MainLayoutTeresaClose.contract.test.ts` w wersji z markera. Zapisz wynik.
   Moja przewidywana odpowiedź: **zastany test jej NIE ŁAPIE**, bo broni napisu w źródle,
   a napis po mutacji zostaje. **Jeżeli jednak ją złapie — to jest obalenie mojej tezy i SUKCES
   dyżuru**; zapisz to w „Korektach wobec instrukcji” z dowodem i idź dalej.

Obie komendy i wszystkie cztery wyniki **dosłownie** w raporcie.

Prawo zatrzymania po tej pozycji.

## R4 — PARA ZRZUTÓW PRZED/PO DO AKCEPTU WŁAŚCICIELA

Kanonicznym `scripts/dev/grafika-zrzuty.mjs`. **Zakaz pisania własnego skryptu zrzutowego obok
kanonicznego** — brakującą zdolność dokładasz do niego addytywnie i opt-in.

Wymagania:

- panel czatu **otwarty**, widok **ustabilizowany** przed zrzutem (harness potrafi zrobić skan
  w trakcie animacji wejścia i oddać fałszywy kontrast);
- light **i** dark; `shasum -a 256` oraz średnia jasność każdego kadru w raporcie;
- **para bajtowo identyczna = ZERO dowodu** — chyba że identyczność jest właśnie tezą (np. „przy
  fladze OFF nic się nie zmienia”), i wtedy dowodem są **liczby z DOM**, nie obraz;
- para light/dark, w której średnia jasność obu kadrów jest podobna, jest **defektem kadru**,
  nie parą motywów;
- **każdy kadr obejrzany przez `Read` i opisany z nazwy**: co widać, gdzie stoi przycisk zamykania,
  co jest pod nim.

Uruchomienie pełnego runtime'u do zrzutów jest dozwolone **wyłącznie** przez kanoniczny
`scripts/dev/start-wave3-owner-runtime.mjs`, po wykonaniu dowodów (a) i (b) z `§0.2b` i po
spełnieniu wszystkich warunków punktu (4).

Prawo zatrzymania po tej pozycji.

## R5 — ROZLICZENIE ZASTANEJ CZERWIENI PAKIETU CZATU

`tests/components/AIChat/UnifiedChatPanel.test.tsx` ma **czerwone przypadki sprzed tego dyżuru**.
Zlecenie nadzorcy mówi o czterech; **to nie jest mój pomiar** — nie uruchomiłem tego pakietu.

Procedura (`§0.4a`, `Z37`):

1. **PRZED** jakąkolwiek zmianą produktu: uruchom pakiet i zapisz **pełne nazwy** wszystkich
   przypadków do `przed-nazwy.txt`, a nazwy czerwonych osobno.
2. **PO** zmianach: to samo do `po-nazwy.txt`.
3. Do raportu wchodzi `diff przed-nazwy.txt po-nazwy.txt`: nazwy **dodane** (Twoje) i nazwy
   **zniknięte** (każda zniknięta = wyjaśnienie albo STOP).
4. **Zero wyciszeń.** `.skip`, `.todo`, `@ts-expect-error`, poszerzenie `exclude` — zakaz (`Z35`).
   Uznasz to za jedyne wyjście → **STOP z uzasadnieniem**, nie cichy commit.
5. **Nie przypisujesz sobie ani cudzej czerwieni, ani cudzej zieleni.** `N passed` bez nazw nie
   jest pomiarem; „ta sama liczba” przy innym składzie nazw to fałszywa zieleń.

★ **`No test files found` i `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** Sprawdź, czy pakiet
w ogóle się uruchomił, zanim zapiszesz jakąkolwiek liczbę.

Prawo zatrzymania po tej pozycji.

## R6 — RAPORT

Struktura `§R.2`. Obowiązkowo: werdykt `R1` (A / B / C) z komendą i wynikiem oraz wpisem
`DO DECYZJI WŁAŚCICIELA`; opis, czym dokładnie jest komponent zamontowany w teście `R2`; cztery
wyniki dowodu mutacyjnego z `R3` dosłownie, wraz z odpowiedzią, czy zastany test mutację łapie;
ścieżki i sumy kontrolne kadrów z `R4` z opisem każdego; `diff` nazw z `R5` z **własną** liczbą
zastanej czerwieni; sekcja **TWIERDZENIA NIEZWERYFIKOWANE** niepusta.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione, R2 zrobione, R3 zrobione, R4 rozpoczęte,
R5 nietknięte” jest pełnowartościowym wynikiem — o ile `R1` stoi na zmierzonym DOM, a `R3`
na **obu** przebiegach mutacyjnych, także tym kontrolnym na zastanym teście.

**Odwrotna kolejność — `R5` rozliczone, rdzeń (`R1`/`R2`/`R3`) „częściowo” — jest podstawą
odrzucenia.**

**Zmiana układu, jeśli w ogóle będzie potrzebna, idzie do właściciela na parze zrzutów, którą
robisz Ty. Właściciel nie jest pierwszym testerem wizualnym** (`Z11`).

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela niżej | TAK |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na worktree z markera; `src/components/layout/ChatPanel.tsx` jawnie oznaczony jako **NIE ISTNIEJE** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK dla wierszy 1-4, 6-7 `B.3`; **wiersz 5 jawnie oznaczony jako liczba nadzorcy, nie mój pomiar** |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — każdy wiersz „tylko odczyt” ma rzeczownik-produkt (kontrakt · diff · brief · pomiar · wpis) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4 |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (334-339) | TAK — `B.4.4`; porty 5516/6376 zmierzone jako wolne, kontener nie istnieje |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK |
| 8 | Pułapki środowiska w całości + trzy pułapki właściwe temu modułowi | TAK |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru” bez ścieżki | TAK |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK |

### AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| „Napisz asercję na żywym panelu” **vs** `UnifiedChatPanel.tsx` tylko do odczytu | `B.1` i `R2` — asercja mieszka w teście i w `MainLayout.tsx`; sam panel jest **mierzony**, nie zmieniany |
| „Wymóg dotyczy lepkiego nagłówka głosu” **vs** mój pomiar: w panelu nie ma ani jednego `sticky` | `R1` — trzy dopuszczalne werdykty; przy (C) piszesz pytanie, **nie wymyślasz odpowiednika** |
| Zakaz `Z35` „zakaz wyciszania” **vs** zastana czerwień w pakiecie czatu psuje odczyt wyniku | `R5` — czerwień **zostaje** i jest rozliczona po nazwach; wyciszenie jest zakazem, a nie sposobem na czysty raport |
| Zakaz `Z11` „nie odsłaniasz nowego ekranu bez akceptu” **vs** `R2`/`R3` mogą zmienić `MainLayout.tsx` | `B.4.2` i `R6` — to naprawa zastanego elementu, nie nowy ekran; do repo wchodzi razem z parą zrzutów, a decyzję o pokazaniu właścicielowi podejmuje nadzorca |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument” **vs** `R4` produkuje kadry | `Z13` (pole `ARTEFAKTY`) — zrzuty i pliki wynikowe **nie wchodzą do repo jako dokumenty**; kadry lądują w `evidence/` z sumami kontrolnymi, a jedynym nowym dokumentem jest raport |
| Zakaz `Z15` „zero modelu językowego” **vs** panel czatu jest interfejsem do modelu | `Z15` bez wyjątku — mierzysz **układ powłoki**, nie rozmowę; żaden pomiar nie woła `llmService` ani `/api/ai/**`; jeśli montaż panelu próbuje wołać model, blokujesz to w harnessie i zapisujesz jak |
| Zakaz `Z30` „zero wysyłki” **vs** `R4` może uruchomić pełny runtime do zrzutów | `§0.2b` punkt (4) — wyjątek wyłącznie dla zrzutów, po dowodach (a) i (b), z deklaracją dosłowną w raporcie |
| Zlecenie: „test czyta `ChatPanel.tsx` i klasy `pl-4 pr-14 py-3`” **vs** mój odczyt: test już przepisany | Sekcja „★ Sprostowanie zlecenia” punkt 1 i komenda (2) w `§0.1` |
