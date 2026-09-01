# INSTRUKCJA DYŻURU nr 251 — Codex — „★★ ZGŁOSZONY DEFEKT JUŻ NAPRAWIONY (zweryfikuj, nie zakładaj) — CZTERY KANONICZNE DOKUMENTY TEGO NIE WIEDZĄ: `docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md` (commit `eb9732e513`, 14:37:44, NIE jest przodkiem naprawy `8510fcb01d` z 14:38:54 — równoległa gałąź, zmergowana później), `docs/program/funkcje/ZNALEZISKO_POSTEP_SESJI_AUDYTOW.md` (10:16), `docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` (commit `bacbf4081c`, 14:39:19 — TAKŻE równoległa gałąź, `git merge-base --is-ancestor 8510fcb01d bacbf4081c` = NIE) oraz `docs/program/grafika/ROZJAZD_NAZW_POL_20260901.md` (commit `5c17eaed6e`, 14:25:17, przed naprawą) wszystkie opisują kolumnę „Postęp”/„Ustalenia otwarte” jako `ZMIERZONE`/aktywny defekt bez żadnej wzmianki o naprawie — mimo że `mapProgramSummaryRow()` (`src/components/Audit/method/auditsMethodApi.ts:484-500`) dziś rzuca `AUDITS_API_CONTRACT_ERROR` zamiast ciszej podstawić `undefined`, `dev-render/screens/audyty-piec-powierzchni.tsx` ma mock w kształcie SERWERA (naprawiony w tym samym commicie), `auditsMethodApi.contract.test.ts` ma test negatywny ("rejects a programs list row missing the service counters", linia 71) i `docs/program/grafika/status.json` już notuje, że ocena `A` ekranu `audyty-piec-powierzchni` dotyczyła WYŁĄCZNIE zakładki „Biblioteka” — zakładka „Sesje” (gdzie żył defekt) nigdy nie była fotografowana i wraca do odbioru. To jest TRZECI dziś przypadek (po dyżurach 250/253), gdzie zgłoszenie napisane wcześniej 2026-09-01 opisuje stan, który równoległy tor już naprawił, zanim ta instrukcja została wydana."

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
> **wyłącznie** `/private/tmp/cx-day251-audyty-postep`.

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
Zakres: ****Kolumna „Postęp” w Audytach → Metoda → Sesje (`AuditProcessesTab.tsx`) — ZGŁOSZONY DEFEKT JEST JUŻ NAPRAWIONY na Twoim markerze.** Commit `8510fcb01d` ("fix(audyty): mapuj criteriaTotal/criteriaConcluded/findingsOpen na liście Sesje", 2026-09-01 14:38, przodek `df7f13056f`) dodał `mapProgramSummaryRow()` w `auditsMethodApi.ts`, naprawił atrapę harnessu na kształt serwera, dodał test negatywny i zostawił dowód mutacyjny (`evidence/grafika/190-audyty-sesje/*PRZED*`/`*PO*`). **Ten dyżur NIE naprawia kodu** — mierzy, że naprawa trzyma, i koryguje CZTERY kanoniczne dokumenty, które wciąż opisują to jako otwarty, niezałatany defekt.**.
Trasy front: ``src/components/Audit/method/auditsMethodApi.ts:472-500` (`mapProgramSummaryRow`, `listPrograms`) — TYLKO ODCZYT, już naprawione · `src/components/Audit/method/tabs/AuditProcessesTab.tsx:242-260` (odczyt, konsument) · `src/components/Audit/method/__tests__/auditsMethodApi.contract.test.ts` (TYLKO ODCZYT — dowód naprawy) · `dev-render/screens/audyty-piec-powierzchni.tsx` (TYLKO ODCZYT — atrapa już w kształcie serwera)`. Trasy tył: ``server/src/routes/audits/programs.routes.ts:27-41` (`GET /programs`, TYLKO ODCZYT) · `server/src/services/audits/programService.ts:194,264-275` (`ProgramListItem`, `listPrograms`, TYLKO ODCZYT — kontrakt serwera, źródło prawdy dla nazw)`.

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
WT=/private/tmp/cx-day251-audyty-postep
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
git -C "$VAULT" worktree add "$WT" -b codex/day251-audyty-postep-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day251-audyty-postep/config.worktree"
cat "$VAULT/worktrees/cx-day251-audyty-postep/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day251-audyty-postep-scratch
mkdir -p /private/tmp/cx-day251-audyty-postep-artefakty

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
git -C "$WT" push github-backup codex/day251-audyty-postep-20260901
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

# (1) TEZA: naprawa 8510fcb01d jest przodkiem Twojego markera
git merge-base --is-ancestor 8510fcb01d HEAD && echo "naprawa OBECNA" || echo "naprawa NIEOBECNA"
git log --oneline -1 8510fcb01d
#   oczekiwane: "naprawa OBECNA"

# (2) TEZA: mapProgramSummaryRow istnieje i rzuca blad kontraktu zamiast cicho podstawiac undefined
sed -n '472,500p' src/components/Audit/method/auditsMethodApi.ts
#   oczekiwane: funkcja mapProgramSummaryRow z requiredCount(), rzuca AUDITS_API_CONTRACT_ERROR

# (3) TEZA: test negatywny istnieje
grep -n "rejects a programs list row missing" src/components/Audit/method/__tests__/auditsMethodApi.contract.test.ts
#   oczekiwane: 1 trafienie

# (4) TEZA: atrapa harnessu jest w ksztalcie serwera (criteriaTotal), NIE klienta (applicableCriteria)
grep -n "criteriaTotal\|applicableCriteria" dev-render/screens/audyty-piec-powierzchni.tsx | head -10
#   oczekiwane: mock listy programow uzywa criteriaTotal/criteriaConcluded/findingsOpen

# (5) TEZA: dowod mutacyjny (4 zrzuty PRZED/PO) istnieje
ls -la evidence/grafika/190-audyty-sesje/
shasum -a 256 evidence/grafika/190-audyty-sesje/*.png
#   oczekiwane: 4 pliki PNG, PRZED i PO, light i dark

# (6) TEZA: status.json juz cofnal ocene do odbioru dla zakladki Sesje
grep -n "audyty-piec-powierzchni" -A 10 docs/program/grafika/status.json | head -20
#   oczekiwane: adnotacja ze ocena A dotyczyla wylacznie Biblioteki, Sesje wraca do odbioru

# (7) TEZA: cztery dokumenty NIE wspominaja naprawy 8510fcb01d
grep -l "8510fcb01d" docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md docs/program/funkcje/ZNALEZISKO_POSTEP_SESJI_AUDYTOW.md docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md docs/program/grafika/ROZJAZD_NAZW_POL_20260901.md 2>&1
#   oczekiwane: pusto (grep -l nic nie zwraca, bo zaden z czterech nie cytuje SHA naprawy)

# (8) miejsce na dysku
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day251-audyty-postep-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6242`. Twój JEDYNY port harnessu to `5222 i 5223`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day251-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6239, 5010-5219, 6404-6411, 6600-6830. Twoje własne: baza 6242, harness 5222 i 5223. Cudze — siostrzane dyżury TEJ SAMEJ paczki, nie dotykasz: baza 6240 i harness 5220-5221 (dyżur 250 Ustawienia AI), baza 6244 i harness 5224-5225 (dyżur 252 Przemiatanie), baza 6246 i harness 5226-5227 (dyżur 253 Fałszywe zapisy), baza 6248 i harness 5228-5229 (dyżur 254 Sprzeczności rejestru). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY251_AUDYTY_POSTEP_REPORT.md`. Jedyne inne dokumenty, które wolno Ci dotknąć: `docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md` · `docs/program/funkcje/ZNALEZISKO_POSTEP_SESJI_AUDYTOW.md` · `docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` · `docs/program/grafika/ROZJAZD_NAZW_POL_20260901.md` — WYŁĄCZNIE nowa sekcja „Sprostowanie” na końcu każdego (`R2`), zakaz kasowania/przepisywania istniejącej treści. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day251-audyty-postep-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day251-audyty-postep-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ zmiany `auditsMethodApi.ts`, `programService.ts`, `programs.routes.ts`, `AuditProcessesTab.tsx`, `auditsMethodApi.contract.test.ts`, `dev-render/screens/audyty-piec-powierzchni.tsx`** — wszystkie już naprawione i chronione testem negatywnym; dotykasz WYŁĄCZNIE do odczytu jako dowodu. **ZAKAZ kasowania/przepisywania istniejącej treści czterech korygowanych dokumentów** — WYŁĄCZNIE nowa sekcja „Sprostowanie” na końcu każdego, zakaz zmiany ich nagłówkowego werdyktu/statusu frontmatter. **ZAKAZ edycji `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`** (`Z14`) — jeśli `R3` uzna, że DEC-2026-08-26-81 wymaga adnotacji, zapisujesz to WYŁĄCZNIE jako erratę w raporcie, nie w samym rejestrze. | ★ Reguła z `docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` (kształt 21): atrapa zgodna z frontem nie ukrywa defektu — UWIARYGODNIA go, bo zrzut wygląda przekonująco. Ten sam dokument formułuje regułę odbioru: „przy każdej wadzie nazw pól sprawdź, czy istnieje zrzut, który ją uwiarygodnił — i jeśli tak, odwołaj tamten akcept jawnie”. Naprawa `8510fcb01d` już to zrobiła (dowód PRZED/PO, `status.json` cofnięty do odbioru dla zakładki Sesje) — ale CZTERY dokumenty, które opisały problem i sformułowały tę regułę, same nie zostały zaktualizowane o fakt, że regułę już zastosowano. Nieskorygowany dokument kanoniczny, który twierdzi „ZMIERZONE — defekt istnieje” o czymś, co już naprawiono, jest dokładnie tym ryzykiem, które opisuje dyżur 254 (dokumentacja sprzeczna z kodem) — ten dyżur zamyka pętlę dla JEDNEJ konkretnej, dobrze udokumentowanej rodziny, zanim ktoś zmarnuje dyżur na ponowną naprawę tego, co już działa. |

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
cd /private/tmp/cx-day251-audyty-postep

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day251-pg psql -U postgres -d cx251 \
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
cd /private/tmp/cx-day251-audyty-postep

docker run -d --name cx-day251-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx251 \
  -p 127.0.0.1:6242:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day251-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6242/cx251 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6242/cx251 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day251-audyty-postep && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6242/cx251 \
JWT_SECRET=cx251-test-secret-do-not-reuse \
npx vitest run src/components/Audit/method/__tests__/auditsMethodApi.contract.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day251-audyty-postep-artefakty/day251-audyty-postep.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day251-audyty-postep && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/Audit/method/__tests__/auditsMethodApi.contract.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day251-audyty-postep-artefakty/day251-audyty-postep.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day251-audyty-postep/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day251-pg psql -U postgres -d cx251 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day251-pg`.
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
> **(e) ★★ NIE PRÓBUJ PONOWNIE NAPRAWIAĆ TEGO, CO JUŻ DZIAŁA. Jeśli Twój `R1` (KROK 0) potwierdzi obecność `mapProgramSummaryRow()`, testu negatywnego i dowodu mutacyjnego — Twoja praca w tym dyżurze to WYŁĄCZNIE korekta czterech dokumentów (`R2`) i domknięcie pętli odbioru (`R3`), NIE zmiana `auditsMethodApi.ts`/`programService.ts`/`AuditProcessesTab.tsx`. Druga pułapka: `KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` i `AUDYT_ROZJAZDY_NAZW_POL.md` mają commity NOWSZE (wg znacznika czasu) niż naprawa `8510fcb01d`, ale `git merge-base --is-ancestor` pokazuje, że to gałęzie RÓWNOLEGŁE, nie potomne — **nie ufaj kolejności czasowej `git log`, sprawdź faktyczne pokrewieństwo commitów** (`git merge-base --is-ancestor A B`), bo w tym repo w jednym dniu działało wiele niezależnych worktree scalanych asynchronicznie.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day251-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day251-audyty-postep-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (KROK 0 — potwierdź, że naprawa `8510fcb01d` trzyma: `mapProgramSummaryRow`, test negatywny, atrapa serwera, dowód mutacyjny; jeśli KTÓRYKOLWIEK element brakuje lub regresuje, przełącz się na jego odtworzenie wzorcem tego samego commitu i zapisz jako Korektę wobec instrukcji) · R2 (sprostowanie czterech dokumentów: `AUDYT_ROZJAZDY_NAZW_POL.md`, `ZNALEZISKO_POSTEP_SESJI_AUDYTOW.md`, `KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md`, `ROZJAZD_NAZW_POL_20260901.md` — każdy dostaje nową sekcję z dowodem naprawy i wyjaśnieniem pokrewieństwa gałęzi) · R3 (domknięcie pętli odbioru — potwierdź `status.json`, policz i zweryfikuj `shasum` czterech plików dowodowych w `evidence/grafika/190-audyty-sesje/`, errata dla `OWNER_DECISION_LEDGER` WYŁĄCZNIE w raporcie) · R4 (raport dyżuru)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6242` albo `5222 i 5223` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6242` albo `5222 i 5223`** (`Z7`).

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

Zgłoszenie źródłowe (`docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md`,
`ZNALEZISKO_POSTEP_SESJI_AUDYTOW.md`, `KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md`)
opisuje: `AuditProcessesTab.tsx:249` czyta `row.concludedCriteria`/`row.
applicableCriteria`/`row.openFindings`, trasa zwraca `criteriaConcluded`/`criteriaTotal`/
`findingsOpen` — trzy pola, trzy rozjazdy, zero przemapowania. Kolumna „Postęp" pokazuje
literalny ukośnik, „Ustalenia otwarte" jest pusta. Test jednostkowy i atrapa dev-render
miały KSZTAŁT FRONTU (fabrykowały dokładnie te same błędne nazwy, które ekran czyta) —
dlatego zielony test i zatwierdzony przez właściciela zrzut **nic nie znaczyły**:
`docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` nazwał to „atrapa nie
ukryła defektu — ona go UWIARYGODNIŁA" i nakazał: **najpierw popraw atrapę na kształt
serwera, pokaż że ekran psuje się widocznie, dopiero potem kod.**

## ★★ Ta naprawa już istnieje — potwierdź, zanim napiszesz jedną linię kodu

**Na Twoim markerze (`df7f13056f`) ta naprawa JEST wykonana, dokładnie tą metodą.**
Commit `8510fcb01d` ("fix(audyty): mapuj criteriaTotal/criteriaConcluded/findingsOpen na
liście Sesje", 2026-09-01 14:38:54) zrobił WSZYSTKO, co ta instrukcja by nakazała:

1. **Atrapa najpierw** — `dev-render/screens/audyty-piec-powierzchni.tsx` dostała mock
   `/audits/programs` w kształcie SERWERA (`criteriaTotal`/`criteriaConcluded`/
   `findingsOpen`), zamiast wcześniejszego kształtu klienta.
2. **Dowód psucia się i naprawy, na żywo** — `evidence/grafika/190-audyty-sesje/
   audyty-piec-powierzchni__PRZED__{light,dark}.png` (bare „/", pusta kolumna) i
   `__PO__{light,dark}.png` (liczby `0/42`…`40/42`, realne ustalenia).
3. **Kod** — `mapProgramSummaryRow()` w `auditsMethodApi.ts:484-500`, wzorem już
   istniejącego `getProgramCoverage()`, rzuca `AUDITS_API_CONTRACT_ERROR` zamiast cicho
   podstawiać `undefined` — **silniejsze niż zwykłe mapowanie**: przyszły rozjazd tego
   samego pola PADNIE głośno, nie wyrenderuje się cicho jako pustka.
4. **Test negatywny** — `auditsMethodApi.contract.test.ts:71` ("rejects a programs list
   row missing the service counters instead of rendering \"/\" and blank cells") —
   dokładnie dowód mutacyjny wymagany przez `Z32`.
5. **Korekta rejestru odbioru** — `docs/program/grafika/status.json` już notuje, że
   ocena `A` ekranu `audyty-piec-powierzchni` dotyczyła WYŁĄCZNIE zakładki „Biblioteka" —
   zakładka „Sesje" (gdzie żył defekt) nigdy nie była fotografowana i **wraca do
   odbioru**. To jest dokładnie reguła 4 z `KSZTALT_21`: „przy każdej wadzie nazw pól
   sprawdź, czy istnieje zrzut, który ją uwiarygodnił — i jeśli tak, odwołaj tamten
   akcept jawnie".

**To, czego naprawa NIE zrobiła:** zaktualizować cztery dokumenty, które opisały problem
i sformułowały regułę naprawy — same nie wiedzą, że regułę już zastosowano. To jest
rdzeń TEGO dyżuru.

## ★ Dlaczego cztery dokumenty nie wiedzą o naprawie mimo bliskich znaczników czasu

`KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` ma commit o 14:39:19 — **25 sekund PO**
naprawie (14:38:54). Mimo to `git merge-base --is-ancestor 8510fcb01d
bacbf4081c25af73aac735ad0a9027840f6a3f19` zwraca **NIE** — to są RÓWNOLEGŁE gałęzie,
scalone do wspólnej historii później, nie potomek i przodek. **Kolejność zegara ścienna
nie mówi nic o pokrewieństwie commitów w repozytorium z wieloma jednoczesnymi
worktree** — to jest pułapka, na którą musisz uważać w `R1`/`R2`: użyj `git merge-base
--is-ancestor`, nigdy dat.

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Naprawa `8510fcb01d` jest przodkiem Twojego markera | komenda (1) |
| T2 | `mapProgramSummaryRow()` istnieje i rzuca błąd kontraktu zamiast cicho podstawiać `undefined` | komenda (2) |
| T3 | Test negatywny istnieje | komenda (3) |
| T4 | Atrapa harnessu jest w kształcie serwera | komenda (4) |
| T5 | Dowód mutacyjny (4 zrzuty PRZED/PO) istnieje | komenda (5) |
| T6 | `status.json` już cofnął ocenę do odbioru dla zakładki Sesje | komenda (6) |
| T7 | Cztery kanoniczne dokumenty NIE wspominają naprawy `8510fcb01d` | komenda (7) |
| T8 | Miejsce na dysku wystarcza | komenda (8) |

---

# 3. POZYCJE DYŻURU

## R1 — KROK 0: POTWIERDŹ, ŻE NAPRAWA TRZYMA (rdzeń, warunek wejścia)

Wykonaj wszystkie 8 komend `§0.1`. **Jeśli WSZYSTKIE osiem potwierdzają tezy T1-T7** —
zapisz w raporcie „naprawa POTWIERDZONA na markerze, dowód: [wklej wyniki]" i przejdź do
`R2`. **Jeśli KTÓRAKOLWIEK z T2-T6 nie potwierdza się** (np. test negatywny usunięto,
atrapa wróciła do kształtu frontu, plik dowodowy zniknął) — zatrzymaj się, zapisz jako
„★★ Korekta wobec instrukcji" z pełnym dowodem, i **odtwórz brakujący element wzorcem
dokładnie z commitu `8510fcb01d`** (`git show 8510fcb01d` na dowolnym repo z dostępem do
pełnej historii) PRZED przejściem dalej — to staje się rdzeniem dyżuru zamiast `R2`/`R3`.

Dodatkowo w `R1`: uruchom pakiet testów `auditsMethodApi.contract.test.ts` realnie
(`§0.2c`, pakiet C — czysto jednostkowy, mockuje `Api.get`, nie otwiera połączenia z
bazą) i wklej pełny wynik do raportu — **to jest inny rodzaj dowodu niż grep obecności
kodu**: potwierdza, że test faktycznie PRZECHODZI dziś, nie tylko że istnieje.

## R2 — SPROSTOWANIE CZTERECH DOKUMENTÓW (rdzeń, dokumentacyjny)

Dla każdego z czterech dokumentów dopisz na końcu nową sekcję (NIE kasujesz istniejącej
treści, `J`):

```
## Sprostowanie 2026-09-01 (dyżur 251) — defekt naprawiony

Zgłoszony w tym dokumencie rozjazd nazw pól (`concludedCriteria`/`criteriaConcluded`,
`applicableCriteria`/`criteriaTotal`, `openFindings`/`findingsOpen`,
`AuditProcessesTab.tsx`/`auditsMethodApi.ts`/`programService.ts`) jest NAPRAWIONY na SHA
`8510fcb01d` ("fix(audyty): mapuj criteriaTotal/criteriaConcluded/findingsOpen na liście
Sesje", 2026-09-01 14:38:54), przodku SHA `df7f13056f`. Naprawa zastosowała DOKŁADNIE
regułę „atrapa najpierw, potem kod" sformułowaną w tym dokumencie: kształt serwera w
`dev-render/screens/audyty-piec-powierzchni.tsx`, dowód mutacyjny PRZED/PO
(`evidence/grafika/190-audyty-sesje/`), `mapProgramSummaryRow()` rzucający
`AUDITS_API_CONTRACT_ERROR` zamiast cicho podstawiać `undefined`
(`auditsMethodApi.ts:484-500`), test negatywny (`auditsMethodApi.contract.test.ts:71`).
`docs/program/grafika/status.json` cofnął ocenę zakładki „Sesje" do odbioru (dotychczasowa
ocena `A` dotyczyła wyłącznie zakładki „Biblioteka"). Werdykt tego dokumentu ("ZMIERZONE"/
opis defektu) pozostaje HISTORYCZNIE PRAWDZIWY co do stanu w chwili napisania — nie jest
już prawdziwy co do stanu dzisiejszego kodu.
```

Dostosuj treść pod KAŻDY dokument osobno (np. `ZNALEZISKO_POSTEP_SESJI_AUDYTOW.md" ma
inny akcent — potwierdziło żywym Postgresem; `ROZJAZD_NAZW_POL_20260901.md` ma osobną
tabelę „ZMIERZONE" z dwoma wierszami do adnotowania) — powyższe jest szkicem wspólnego
rdzenia, nie tekstem do wklejenia bez dostosowania.

## R3 — DOMKNIĘCIE PĘTLI ODBIORU (rdzeń)

1. Policz i zweryfikuj `shasum -a 256` czterech plików w
   `evidence/grafika/190-audyty-sesje/` — porównaj z tym, co commit `8510fcb01d` dodał
   (`git show 8510fcb01d --stat`). Zapisz skróty w raporcie.
2. Odczytaj (narzędziem, które faktycznie otwiera obraz, nie tylko nazwę pliku) OBA
   zrzuty `__PO__` i potwierdź wzrokiem: kolumna „Postęp" pokazuje realne liczby (np.
   `0/42`), NIE literalny ukośnik; „Ustalenia otwarte" ma liczby, nie pustkę. To jest
   TWÓJ własny dowód wzrokowy, niezależny od tego, co mówi commit message.
3. Sprawdź, czy `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`
   (DEC-2026-08-26-81, „Audits r2 — odbiór partii K") wymaga adnotacji o tym, że jego
   materiał dowodowy (zrzuty z `evidence/grafika/144-runda-pelna-b/audyty-piec-
   powierzchni__PO__light.png` i podobne) pokazywał zakładkę „Biblioteka", nie „Sesje", i
   że osobna naprawa (`8510fcb01d`) domknęła zakładkę „Sesje" niezależnie. **Nie
   edytujesz rejestru** (`Z14`) — zapisujesz to jako erratę WYŁĄCZNIE w Twoim raporcie,
   gotową do wklejenia przez nadzorcę, jeśli uzna to za potrzebne.

## R4 — RAPORT DYŻURU (rdzeń)

Sekcje: streszczenie, `R1`-`R3` z pełnymi dowodami, sekcja „TWIERDZENIA
NIEZWERYFIKOWANE" (obowiązkowa nawet pusta), sekcja „Korekty wobec instrukcji"
(obowiązkowa nawet pusta), errata dla `OWNER_DECISION_LEDGER` z `R3` punkt 3.

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (WĄSKO, `R2`/`J`) | `docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md` · `docs/program/funkcje/ZNALEZISKO_POSTEP_SESJI_AUDYTOW.md` · `docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` · `docs/program/grafika/ROZJAZD_NAZW_POL_20260901.md` — WYŁĄCZNIE nowa sekcja „Sprostowanie" na końcu każdego |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY251_AUDYTY_POSTEP_REPORT.md` |
| Zapis (WARUNKOWO, `R1`, tylko jeśli jakiś element naprawy brakuje) | `src/components/Audit/method/auditsMethodApi.ts` · `dev-render/screens/audyty-piec-powierzchni.tsx` · `src/components/Audit/method/__tests__/auditsMethodApi.contract.test.ts` — wzorcem commitu `8510fcb01d` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/Audit/method/tabs/AuditProcessesTab.tsx` · `server/src/routes/audits/programs.routes.ts` · `server/src/services/audits/programService.ts` · `docs/program/grafika/status.json` · `evidence/grafika/190-audyty-sesje/**` |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (`Z14`) |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **KROK 0 (`R1`) ROZSTRZYGA CAŁY DALSZY KSZTAŁT DYŻURU.** Jeśli naprawa trzyma —
  reszta jest dokumentacyjna. Jeśli nie trzyma — odtwarzasz ją wzorcem `8510fcb01d`
  PRZED czymkolwiek innym.
- ★★ **UŻYWAJ `git merge-base --is-ancestor`, NIGDY DAT, DO OCENY POKREWIEŃSTWA
  COMMITÓW.** Bliskość znaczników czasu nic nie mówi o tym, czy jeden commit widział
  drugi — ten dzień miał wiele jednoczesnych, niezależnych worktree.
- ★ **Sprostowanie dokumentu DOPISUJESZ, nie nadpisujesz.** Historyczna treść ma wartość
  dowodową — pokazuje, jak defekt wyglądał i jak został znaleziony.
- ★ **Dowód wzrokowy jest Twój własny**, nie przepisany z commit message — otwórz oba
  zrzuty `__PO__` i potwierdź, co widzisz.
- ★ **`Z14`:** `OWNER_DECISION_LEDGER` — errata WYŁĄCZNIE w raporcie.
- ★ **`Z10`/`Z11`:** zero nowych flag.
- ★ **Pułapki środowiska — sprawdź każdą u siebie:** `Database.ts:80-88` atrapa bazy ·
  `vitest.config.ts:210` przypina `DB_TYPE='sqlite'` · `tests/setup.ts:896` podmienia
  `global.fetch`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej
  sekcji jest podstawą odrzucenia dyżuru.
