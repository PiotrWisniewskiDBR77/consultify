# INSTRUKCJA DYŻURU nr 244 — Codex — „★★ ORGANIZACJA + USTAWIENIA — DWA „ZAMKNIĘCIA OSTATECZNE” BEZ ODBIORU REALNEGO EKRANU, DOWÓD JUŻ ISTNIAŁ ALE WYPAROWAŁ. `docs/FUNCTIONAL_DOCUMENTATION.md:55` twierdzi `Organization | ... CLOSED_FINAL 2026-08-25, tag final-01-organization`, a karta modułu (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md`) i dzisiejszy pomiar (`docs/functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md` §1) pokazują `OWNER_NOT_REVIEWED`, flagę `orgRedesignV1Enabled()` (`src/utils/orgRedesignFlag.ts:86-93`) z realnym default OFF i 11 z 11 przeprojektowanych ekranów nieosiągalnych bez ręcznego przełączenia; `docs/FUNCTIONAL_DOCUMENTATION.md:57` twierdzi `Settings | aktywny ... CLOSED_FINAL 2026-08-25, tag final-02-settings`, a karta `15_SETTINGS/MODULE_ACCEPTANCE.md` ma `G08`/`G09` (pierwszy przegląd wizualny właściciela) w stanie `NOT_STARTED`. Dyżury 236/238 (dziś rano) już wyprodukowały 22 i 25+ zrzutów realnego builda obu modułów, ale zapisały je pod `/private/tmp/cx-day236-organizacja-artefakty/` i `/private/tmp/cx-day238-*-artefakty/` — poza repo, efemeryczne, prawdopodobnie już nieistniejące na dowolnej maszynie innej niż ta, która je wygenerowała; seeder (`server/scripts/seed-wave3-organization-owner-review.ts`) i harness (`dev-render/screens/day236-organizacja.tsx`, `dev-render/screens/day238-ustawienia.tsx`) SĄ zacommitowane i trwałe — ten dyżur je URUCHAMIA PONOWNIE, nie pisze od zera."

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
> **wyłącznie** `/private/tmp/cx-day244-organizacja-ustawienia`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `0724ae1fae`**
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
Zakres: ****13 ORGANIZATION (`/organization`) + 15 SETTINGS (`/settings`) — dwa moduły z zakwestionowanym „ZAMKNIĘTE OSTATECZNIE 2026-08-25”, oba wracają do odbioru wizualnego.** `docs/program/funkcje/CO_ZNACZYLO_ZAMKNIETE_OSTATECZNIE.md` (2026-09-01): Organizacja zamknięto na akcepcie PROTOTYPU, nie realnego builda (realny stan: 11/11 przeprojektowanych ekranów nieosiągalnych domyślnie, `OWNER_NOT_REVIEWED`); Ustawienia zamknięto, choć pierwszy przegląd wizualny (G08/G09) nigdy się nie zaczął. Ten dyżur (a) koryguje `docs/FUNCTIONAL_DOCUMENTATION.md` żeby nie twierdziło czegoś, czego karty modułów nie potwierdzają, (b) odtwarza — istniejącymi, już zbudowanymi seederem/harnessem, nie nowym kodem — gotowy do prezentacji właścicielowi pakiet dowodowy dla obu modułów, bo poprzednie zrzuty (dyżury 236/238) leżały w efemerycznych `/private/tmp/cx-day236-*`/`cx-day238-*` i najpewniej już nie istnieją.**.
Trasy front: ``src/utils/orgRedesignFlag.ts` · `src/components/Organization/redesign/**` (`OrganizationScreenShell`, `OrganizationCardPrimitives.tsx`, `OrganizationStatePanel.tsx`) · `dev-render/screens/day236-organizacja.tsx` · `src/components/settings/SettingsSidebar.tsx` · `src/utils/pilotAccess.ts` · `src/components/RouterSync.tsx` · `dev-render/screens/day238-ustawienia.tsx``. Trasy tył: ``server/scripts/seed-wave3-organization-owner-review.ts` (istniejący seeder, URUCHAMIASZ, nie zmieniasz) · `server/src/services/organizationContext/OrganizationContextService.ts` (odczyt, wzorzec z dyżuru 241) · brak nowego backendu dla Ustawień — panel czyta konfigurację statyczną + istniejące trasy `ai-settings`/`billing` itd., nie dotykane w tym dyżurze`.

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
WT=/private/tmp/cx-day244-organizacja-ustawienia
MARKER=0724ae1fae

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day244-organizacja-ustawienia-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day244-organizacja-ustawienia/config.worktree"
cat "$VAULT/worktrees/cx-day244-organizacja-ustawienia/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day244-organizacja-ustawienia-scratch
mkdir -p /private/tmp/cx-day244-organizacja-ustawienia-artefakty

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
git -C "$VAULT" log --oneline 0724ae1fae..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 0724ae1fae..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day244-organizacja-ustawienia-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 0724ae1fae..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: docs/FUNCTIONAL_DOCUMENTATION.md linie 55 i 57 twierdza CLOSED_FINAL dla obu modulow
sed -n '55p;57p' docs/FUNCTIONAL_DOCUMENTATION.md
#   oczekiwane: obie linie zawieraja doslownie "CLOSED_FINAL 2026-08-25"

# (2) TEZA: karta modulu Organizacji NIE potwierdza odbioru realnego ekranu — G08/G09
#     wskazuja stan czesciowy/niezakonczony, nie PASS pelnego odbioru
grep -n "G08\|G09" docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md
#   oczekiwane: zaden wiersz nie mowi wprost "owner accepted real build"

# (3) TEZA: karta modulu Ustawien ma G08/G09 dosłownie NOT_STARTED
grep -n "G08\|G09" docs/program/waves/WAVE_03_ACCEPTANCE/modules/15_SETTINGS/MODULE_ACCEPTANCE.md
#   oczekiwane: NOT_STARTED w obu wierszach

# (4) TEZA: orgRedesignV1Enabled() ma realny default OFF mimo naglowka pliku mowiacego
#     inaczej — wyjasnienie jest W TYM SAMYM pliku
sed -n '1,95p' src/utils/orgRedesignFlag.ts
#   oczekiwane: linia ok. 19 wspomina "DEC-2026-08-26-78" i "DEFAULT ON"; linie ok.
#   54-59 wyjasniaja swiadome cofniecie do OFF 29.08 do czasu odbioru; readEnvFlag()
#   zwraca dzis false bez jawnej zmiennej srodowiskowej

# (5) TEZA: dwa zastale testy oczekuja STAREJ wartosci (ON) i realnie NIE przechodza
#     wobec dzisiejszego OFF
sed -n '1,60p' src/utils/__tests__/orgRedesignFlag.test.ts
#   oczekiwane: test w okolicy linii 36 nazwany 'domyslnie ON (DEC-2026-08-26-78)'
#   oczekujacy true — potwierdz ze pada dzis (uruchom pakietem C nizej)

# (6) TEZA: seeder i harness Organizacji sa juz zbudowane i zacommitowane, gotowe do
#     ponownego uruchomienia bez pisania nowego kodu
ls -la server/scripts/seed-wave3-organization-owner-review.ts
ls -la dev-render/screens/day236-organizacja.tsx
grep -n "goals\|challenges\|synthesis" server/scripts/seed-wave3-organization-owner-review.ts | head -6
#   oczekiwane: oba pliki istnieja; seeder NIE zawiera danych dla goals/challenges/
#   synthesis (potwierdzone "uczciwie puste" w POMIAR z dzisiaj — R3 to odziedziczy)

# (7) TEZA: harness Ustawien tez jest gotowy, Settings ma 37 lisci / 10 grup w kodzie
#     (nie 47 jak stary pomiar)
ls -la dev-render/screens/day238-ustawienia.tsx
grep -c "id: '" src/components/settings/SettingsSidebar.tsx
#   oczekiwane: plik harnessu istnieje; grep zwraca 47 LACZNIE (grupy+liscie razem) —
#   Ty w R4 rozdzielasz je jak w POMIAR (37 liste, 10 grup)

# (8) TEZA: artefakty z dzisiejszych dyzurow 236/238 sa POZA repo, w /private/tmp,
#     i prawdopodobnie juz nie istnieja na Twojej maszynie
ls -la /private/tmp/cx-day236-organizacja-artefakty 2>&1
ls -la /private/tmp/cx-day238-ustawienia-artefakty 2>&1
#   oczekiwane: 'No such file or directory' dla obu (potwierdza przeslanke DLACZEGO) —
#   jesli KTORYS istnieje, zglos to w Korektach, mozesz go uzyc zamiast R3/R4

# (9) TEZA: miejsce na dysku wystarcza na dyzur
df -h /
#   oczekiwane: powyzej 5 GB wolnego — ponizej tego STOP calego dyzuru
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day244-organizacja-ustawienia-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6225`. Twój JEDYNY port harnessu to `5200 i 5201`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day244-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6220, 5010-5195, 6404-6411, 6600-6830. Twoje własne: baza 6225, harness 5200 i 5201. Cudze — siostrzane dyżury TEJ SAMEJ ostatniej paczki, nie dotykasz: baza 6221 i harness 5196-5197 (dyżur 242 Uprawnienia), baza 6223 i harness 5198-5199 (dyżur 243 Podgląd). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi. `orgRedesignV1Enabled()` WOLNO Ci przełączyć na `ON` WYŁĄCZNIE lokalnie, wewnątrz Twojego własnego procesu dev-render/harness (query param albo `localStorage` Twojej przeglądarki testowej), NIGDY jako zmianę `readEnvFlag()`/wartości domyślnej w kodzie, `.env*`, `docker-compose*` ani `railway*`. Po zakończeniu dyżuru globalny default pozostaje `OFF` — potwierdzasz to w raporcie ostatnią komendą (`grep` na wartość domyślną w pliku źródłowym, niezmienioną względem `R1`).`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `src/utils/orgRedesignFlag.ts` (odczyt WYŁĄCZNIE, patrz `PULAPKA`) · `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY244_ORGANIZACJA_USTAWIENIA_REPORT.md`. Jedyne inne dokumenty, które wolno Ci dotknąć: (1) `docs/FUNCTIONAL_DOCUMENTATION.md` — WYŁĄCZNIE linie 55 i 57, metodą opisaną w `R2`; (2) `docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md` i `.../15_SETTINGS/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowa sekcja na końcu każdego pliku ze zmierzonym stanem `R3`/`R4`, zakaz kasowania/przepisywania istniejących wierszy, zakaz wpisu `FIXED`/`VERIFIED`/`CLOSED_FINAL` — ten dyżur nie zamyka modułów, dostarcza materiał do decyzji. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day244-organizacja-ustawienia-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day244-organizacja-ustawienia-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ zmiany wartości domyślnej `orgRedesignV1Enabled()`.** **ZAKAZ decydowania, czy Organizacja/Ustawienia SĄ zamknięte** — to decyzja właściciela, nie wykonawcy; dostarczasz materiał do decyzji, nie werdykt. **ZAKAZ kasowania albo przepisywania istniejącego tekstu `docs/FUNCTIONAL_DOCUMENTATION.md`** poza dwiema imiennie wskazanymi liniami (55, 57) — zmieniasz WYŁĄCZNIE te dwie, metodą z `CO_ZNACZYLO_ZAMKNIETE_OSTATECZNIE.md` (zapisać CO było zaakceptowane, nie skasować oznaczenia bez wyjaśnienia). **ZAKAZ naprawy dwóch zastałych testów** `orgRedesignFlag.test.ts` — cytujesz jako znany, opisany defekt (poza licencją zapisu tego dyżuru). **ZAKAZ pełnego przeglądu wszystkich 37 sekcji Ustawień** — `R4` wyznacza bounded, imiennie wybraną próbkę reprezentatywną (nie cały zestaw), reszta zostaje jako policzony, opisany dług dla kolejnego dyżuru. | Dwa moduły niosą najsilniejsze oznaczenie tego programu — „ZAMKNIĘTE OSTATECZNIE” — mimo że żaden z nich nie przeszedł faktycznego odbioru realnie zbudowanego ekranu przez właściciela. `docs/program/funkcje/CO_ZNACZYLO_ZAMKNIETE_OSTATECZNIE.md` nazywa to wprost: „zamknięto akcept rysunku, a nie akcept działającego ekranu” (Organizacja) i „pierwszy przegląd wizualny NIGDY SIĘ NIE ZACZĄŁ” (Ustawienia) — i ostrzega, że jeśli to oznaczenie mogło znaczyć tak mało, żadne inne `CLOSED_FINAL` w programie nie jest już pewne bez sprawdzenia. Dowód na odbiór już raz powstał (dyżury 236/238, dziś rano) i prawdopodobnie zniknął z dysku, bo trafił do efemerycznego katalogu poza repo — ten dyżur nie zaczyna od zera: seeder i harness są gotowe, wystarczy je uruchomić i tym razem dostarczyć wynik w formie, którą nadzorca może faktycznie pokazać właścicielowi. |

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
cd /private/tmp/cx-day244-organizacja-ustawienia

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day244-pg psql -U postgres -d cx244 \
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
cd /private/tmp/cx-day244-organizacja-ustawienia

docker run -d --name cx-day244-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx244 \
  -p 127.0.0.1:6225:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day244-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6225/cx244 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6225/cx244 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day244-organizacja-ustawienia && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6225/cx244 \
JWT_SECRET=cx244-test-secret-do-not-reuse \
npx vitest run src/utils/__tests__/orgRedesignFlag.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day244-organizacja-ustawienia-artefakty/day244-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day244-organizacja-ustawienia && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/utils/__tests__/orgRedesignFlag.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day244-organizacja-ustawienia-artefakty/day244-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day244-organizacja-ustawienia/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day244-pg psql -U postgres -d cx244 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day244-pg`.
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
> **(e) ★★ FLAGA ZOSTAJE OFF NA ZAWSZE W TYM DYŻURZE — WŁĄCZASZ JĄ TYLKO W SWOIM WŁASNYM, ODIZOLOWANYM PROCESIE HARNESSU, NIGDY JAKO ZMIANĘ WARTOŚCI DOMYŚLNEJ. `orgRedesignFlag.ts:19,54-59` dokumentuje wprost, że flaga została świadomie cofnięta do OFF 29.08 „do czasu odbioru wizualnego” — Twoim zadaniem jest DOSTARCZYĆ materiał do tego odbioru, nie wykonać go za właściciela ani nie odwrócić decyzji cofnięcia. `Z10`/`Z11` (`CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym) obowiązują dosłownie — Twoje zrzuty idą do RAPORTU i do `/private/tmp/cx-day244-organizacja-ustawienia-artefakty`, nie na żadne środowisko, które właściciel mógłby zobaczyć przypadkiem. Druga pułapka: dwa zastałe testy (`src/utils/__tests__/orgRedesignFlag.test.ts:36` i sąsiedni) oczekują STAREJ wartości (`ON`) i realnie NIE PRZECHODZĄ wobec dzisiejszego realnego `OFF` — to jest ZNANY, opisany defekt testu (nie Twojego kodu), NIE naprawiasz go (poza licencją), tylko potwierdzasz i cytujesz w raporcie, żeby nikt nie próbował „naprawić” przez zmianę produkcyjnego defaultu.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day244-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day244-organizacja-ustawienia-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (weryfikacja stanu na własnym SHA — flaga, gate'y, zastałe testy) · R2 (korekta dwóch linii `FUNCTIONAL_DOCUMENTATION.md` wg 3 zasad `CO_ZNACZYLO`) · R3 (odtworzenie pakietu dowodowego Organizacji — 11 ekranów, istniejący seeder+harness) · R4 (pierwszy, bounded pakiet dowodowy Ustawień — reprezentatywna próbka grup) · R5 (raport dyżuru + karta gotowa do `GUIDED_OWNER_REPLAY`)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6225` albo `5200 i 5201` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6225` albo `5200 i 5201`** (`Z7`).

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

`docs/program/funkcje/CO_ZNACZYLO_ZAMKNIETE_OSTATECZNIE.md` (2026-09-01) sprawdziło, na
czym stały dwa jedyne oznaczenia `CLOSED_FINAL` w tym programie — Organizacja i
Ustawienia — i znalazło, że żadne z nich nie stało na odbiorze realnie zbudowanego
ekranu przez właściciela:

- **Organizacja**: zamknięcie 25.08 opierało się na akcepcie **PROTOTYPU** HTML
  (`DEC-2026-08-26-78`), nie na odbiorze realnego builda. Flaga
  `orgRedesignV1Enabled()` została świadomie cofnięta do `OFF` 29.08 „do czasu odbioru
  wizualnego" — dziś realny default to `OFF`, 11 z 11 przeprojektowanych ekranów jest
  nieosiągalnych bez ręcznego przełączenia, a karta modułu notuje `OWNER_NOT_REVIEWED`.
- **Ustawienia**: karta modułu ma `G08`/`G09` (pierwszy przegląd wizualny właściciela)
  w stanie `NOT_STARTED` — pierwszy przegląd **nigdy się nie zaczął** — mimo że spis
  funkcjonalny nosi `CLOSED_FINAL 2026-08-25`.

Dwa dokumenty kanoniczne tego samego produktu mówią o tych samych modułach rzeczy, które
się wykluczają. `CO_ZNACZYLO_ZAMKNIETE_OSTATECZNIE.md` formułuje to jako ostrzeżenie o
całym rejestrze: *„Oznaczenie w rejestrze jest warte tyle, ile warty jest najsłabszy
powód, dla którego ktoś je kiedyś postawił."* Rekomendacja tego samego dokumentu: **oba
moduły wracają do odbioru wizualnego.**

## Dowód już raz powstał i prawdopodobnie zniknął

Dwa dyżury z dzisiejszego rana (236 — Organizacja, 238 — Ustawienia) już wyprodukowały
realny materiał dowodowy: 22 zrzuty light/dark dla 11 ekranów Organizacji (różnica
jasności 211,8–228,4, powyżej progu 150) i 20 zrzutów paneli (10 grup × 2 motywy) + 5
dodatkowych dla Ustawień (najmniejsza różnica jasności: 210,1). **Ale oba zapisały
artefakty pod `/private/tmp/cx-day236-organizacja-artefakty/` i
`/private/tmp/cx-day238-ustawienia-artefakty/`** — zgodnie z `Z13` tego programu
(„zrzuty, logi i pliki wynikowe NIE wchodzą do repo"), co jest poprawną higieną dla
UNIKANIA rozdęcia repozytorium, ale ma efekt uboczny: **te konkretne pliki żyją
WYŁĄCZNIE na efemerycznej maszynie, która je wygenerowała**, i z bardzo dużym
prawdopodobieństwem już nie istnieją nigdzie, skąd nadzorca mógłby je pokazać
właścicielowi. Sprawdzasz to sam, pierwszą czynnością (`R1`, komenda 8) — jeśli JEDNAK
któryś katalog przetrwał na Twojej maszynie, używasz go zamiast ponownego generowania i
zapisujesz to jako oszczędność w raporcie.

**Dobra wiadomość: narzędzia, które te zrzuty wyprodukowały, SĄ trwałe.**
`server/scripts/seed-wave3-organization-owner-review.ts` i
`dev-render/screens/day236-organizacja.tsx` (Organizacja),
`dev-render/screens/day238-ustawienia.tsx` (Ustawienia) są zacommitowane w repo. Ten
dyżur **URUCHAMIA JE PONOWNIE** — nie pisze nowego harnessu ani seedera.

## Czego ten dyżur świadomie NIE robi

- **Nie decyduje, czy moduły SĄ zamknięte.** To decyzja właściciela
  (`CO_ZNACZYLO_ZAMKNIETE_OSTATECZNIE.md`, sekcja „Do rozstrzygnięcia przez
  właściciela"). Dostarcza materiał gotowy do tej decyzji.
- **Nie zmienia wartości domyślnej `orgRedesignV1Enabled()`.** Flaga zostaje `OFF` w
  kodzie po zakończeniu dyżuru — włączasz ją WYŁĄCZNIE lokalnie, w swoim procesie
  harnessu.
- **Nie naprawia dwóch zastałych testów** `orgRedesignFlag.test.ts` oczekujących starej
  wartości `ON` — to jest znany defekt testu, cytujesz go, nie naprawiasz (poza
  licencją tego dyżuru).
- **Nie robi pełnego przeglądu 37 sekcji Ustawień.** `R4` bierze bounded,
  reprezentatywną próbkę — reszta zostaje policzonym, opisanym długiem.
- **Nie przepisuje żadnej istniejącej treści `MODULE_ACCEPTANCE.md` ani
  `FUNCTIONAL_DOCUMENTATION.md`** poza dwiema imiennie wskazanymi liniami i nowymi
  sekcjami na końcu kart modułów.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | `docs/FUNCTIONAL_DOCUMENTATION.md` linie 55 i 57 twierdzą `CLOSED_FINAL 2026-08-25` dla obu modułów | komenda (1) |
| T2 | Karta modułu Organizacji nie potwierdza odbioru realnego builda przez właściciela | komenda (2) |
| T3 | Karta modułu Ustawień ma `G08`/`G09` dosłownie `NOT_STARTED` | komenda (3) |
| T4 | `orgRedesignV1Enabled()` ma realny default `OFF` mimo nagłówka pliku sugerującego inaczej — wyjaśnienie jest w tym samym pliku | komenda (4) |
| T5 | Dwa zastałe testy `orgRedesignFlag.test.ts` oczekują starej wartości `ON` i realnie nie przechodzą dziś | komenda (5) |
| T6 | Seeder i harness Organizacji są gotowe do ponownego uruchomienia bez nowego kodu | komenda (6) |
| T7 | Harness Ustawień jest gotowy; Settings ma 37 liści / 10 grup w kodzie (nie 47) | komenda (7) |
| T8 | Artefakty dyżurów 236/238 są poza repo i prawdopodobnie już nie istnieją | komenda (8) |
| T9 | Miejsce na dysku wystarcza | komenda (9) |

---

# 3. POZYCJE DYŻURU

## R1 — WERYFIKACJA STANU NA WŁASNYM SHA (rdzeń, warunek wejścia)

Wykonaj wszystkie 9 komend `§0.1`. Jeśli komenda (8) pokaże, że KTÓRYŚ katalog
artefaktów jednak przetrwał — użyj go bezpośrednio jako materiału dla `R3`/`R4` zamiast
ponownego generowania, zapisz to jako oszczędność czasu w raporcie, i przejdź do `R2`.
Jeśli komenda (4)/(5) pokaże inny stan flagi/testów niż opisany (np. ktoś już naprawił
testy albo zmienił default) — zapisz jako „Korektę wobec instrukcji" z pełnym dowodem
PRZED kontynuacją.

## R2 — KOREKTA DWÓCH LINII `FUNCTIONAL_DOCUMENTATION.md` (rdzeń, dokumentacyjny)

Stosując **dosłownie trzy zasady** z `CO_ZNACZYLO_ZAMKNIETE_OSTATECZNIE.md`:

1. *„Zamknięcie modułu wymaga zapisania, CO dokładnie zaakceptowano... bez tego zapisu
   zamknięcie nie obowiązuje."*
2. *„Akcept prototypu NIE zamyka modułu... zamknięcie modułu wymaga zrzutu realnie
   zbudowanego ekranu."*
3. *„Sprzeczność między dwoma dokumentami kanonicznymi rozstrzyga właściciel albo
   nadzorca z pomiarem — nigdy wykonawca w biegu."*

Zmień **wyłącznie linie 55 i 57** `docs/FUNCTIONAL_DOCUMENTATION.md`. Nie usuwasz
wzmianki o `CLOSED_FINAL 2026-08-25` (to jest historyczny fakt — coś zostało wtedy
zaakceptowane), ale **dopisujesz uczciwą adnotację** wprost przy niej, np. w kształcie:
„`CLOSED_FINAL 2026-08-25` (akcept PROTOTYPU, NIE realnego builda — zamknięcie
ZAKWESTIONOWANE 2026-09-01, `docs/program/funkcje/CO_ZNACZYLO_ZAMKNIETE_OSTATECZNIE.md`;
realny stan: `OWNER_NOT_REVIEWED`, 11/11 ekranów redesignu nieosiągalnych domyślnie)" dla
Organizacji, i analogicznie dla Ustawień z odniesieniem do `G08`/`G09` `NOT_STARTED`.
**Nie rozstrzygasz sam, czy moduł zostaje zamknięty czy nie** — zapisujesz FAKT
sprzeczności i jej źródło, decyzję zostawiasz właścicielowi/nadzorcy.

## R3 — ODTWORZENIE PAKIETU DOWODOWEGO ORGANIZACJI (rdzeń, dowodowy)

1. Uruchom istniejący seeder `server/scripts/seed-wave3-organization-owner-review.ts`
   na swojej lokalnej bazie dyżuru (pełny komplet zmiennych z `§0.2c`).
2. Zamontuj `dev-render/screens/day236-organizacja.tsx` z flagą
   `orgRedesignV1Enabled` włączoną **wyłącznie w Twoim własnym procesie/przeglądarce
   testowej** (query param albo `localStorage` Twojej sesji, nigdy zmiana w kodzie).
3. Wykonaj zrzuty wszystkich 11 przeprojektowanych ekranów, light+dark, z bezpiecznikiem
   jasności (próg >150, wzorem dyżuru 236). **Jeśli duty 243 z tej samej paczki już
   scaliło regułę fotografowania podglądu do `TRIADA_KANON.md`, zastosuj ją** (zrzut PO
   kliknięciu w wiersz, tam gdzie ekran ma podgląd) — jeśli 243 nie jest jeszcze
   scalone (praca równoległa), zastosuj tę samą zasadę bezpośrednio: dwa zrzuty po
   kliknięciu w pierwszy wiersz, gdziekolwiek ekran ma tabelę+podgląd.
4. Potwierdź ponownie stan trzech rodzin danych (Cele/Wyzwania/Ryzyka-Strategia)
   renderujących się „uczciwie pusto" (seeder nie zawiera tych danych — to NIE jest
   defekt tego dyżuru, dziedziczysz ograniczenie seedera, opisujesz je wprost w
   raporcie, nie naprawiasz).
5. Zapisz zrzuty do `/private/tmp/cx-day244-organizacja-ustawienia-artefakty` z `shasum -a 256`, i dopisz nową sekcję na końcu
   `docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md`
   (np. „## Dzień 244 — pakiet dowodowy odtworzony, gotowy do `GUIDED_OWNER_REPLAY`")
   ze ścieżkami, skrótami i jednozdaniowym opisem KAŻDEGO z 11 ekranów — to jest
   materiał, z którego nadzorca złoży kartę odbioru dla właściciela, nie werdykt.

## R4 — PIERWSZY, BOUNDED PAKIET DOWODOWY USTAWIEŃ (rdzeń, dowodowy)

Ustawienia mają **37 sekcji w 10 grupach** — pełny przegląd to praca dla osobnego,
większego dyżuru (patrz `STAN_DOMKNIECIA_2026-09-01.md`). Ten dyżur dostarcza
**pierwszą, imiennie wybraną próbkę reprezentatywną**, wystarczającą, żeby właściciel
mógł zobaczyć CHARAKTER problemu (nie każdą sekcję z osobna):

1. Zamontuj `dev-render/screens/day238-ustawienia.tsx`.
2. Wykonaj zrzuty (light+dark, bezpiecznik jasności) dla **siedmiu** sekcji: cztery
   dozwolone dla zwykłego użytkownika (`profile`, `auth-access`, `language`, `theme` —
   `PILOT_ALLOWED_SETTINGS_SECTIONS`, `src/utils/pilotAccess.ts:15-19`) + trzy
   niedozwolone, wybrane tak, żeby pokazać RÓŻNE grupy niż te cztery (np.
   `data-controls`, `billing`, jedna dowolna trzecia z pozostałych grup) — dla każdej z
   trzech potwierdź na żywo w harnessie, że MEMBER wpisujący jej trasę bezpośrednio
   zostaje po cichu przekierowany (`RouterSync.tsx:330-344`), a OWNER/ADMIN nie.
3. Zapisz zrzuty do `/private/tmp/cx-day244-organizacja-ustawienia-artefakty` z `shasum -a 256`. Dopisz nową sekcję na końcu
   `docs/program/waves/WAVE_03_ACCEPTANCE/modules/15_SETTINGS/MODULE_ACCEPTANCE.md`
   z tabelą siedmiu sekcji × dostępność × dowód przekierowania, oraz jawnym zdaniem:
   **„Pozostałe 30 z 37 sekcji NIE zostały objęte tym dyżurem — to jest policzony,
   opisany dług, nie ukryty."**

## R5 — RAPORT DYŻURU + MATERIAŁ DLA KARTY ODBIORU (rdzeń)

Sekcje: streszczenie, `R1`-`R4` z pełnymi dowodami, sekcja „TWIERDZENIA
NIEZWERYFIKOWANE" (obowiązkowa nawet pusta), sekcja „Korekty wobec instrukcji"
(obowiązkowa nawet pusta). Dołącz **jedno zdanie podsumowujące dla nadzorcy**, gotowe
do wklejenia do wspólnej karty `GUIDED_OWNER_REPLAY.md` (jeśli plik istnieje w Twoim
repo — sprawdź, nie zakładaj) albo do bezpośredniej wiadomości: „Organizacja: 11
ekranów gotowych do pokazania, ścieżka `/private/tmp/cx-day244-organizacja-ustawienia-artefakty`. Ustawienia: 7 z 37 sekcji
gotowych jako pierwsza próbka, ścieżka `/private/tmp/cx-day244-organizacja-ustawienia-artefakty`. Oba moduły czekają na decyzję
właściciela: wracają do odbioru czy zostają zamknięte mimo luki w dowodzie."

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (WĄSKO, `R2`) | `docs/FUNCTIONAL_DOCUMENTATION.md` — WYŁĄCZNIE linie 55 i 57, zakaz zmiany reszty pliku |
| Zapis (WĄSKO, `R3`/`R4`/`J`) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md` · `.../15_SETTINGS/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowa sekcja na końcu każdego, zakaz kasowania/przepisywania istniejących wierszy, zakaz `FIXED`/`VERIFIED`/`CLOSED_FINAL` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY244_ORGANIZACJA_USTAWIENIA_REPORT.md` |
| Odczyt (URUCHOMIENIE, ZAKAZ ZMIANY KODU) | `server/scripts/seed-wave3-organization-owner-review.ts` · `dev-render/screens/day236-organizacja.tsx` · `dev-render/screens/day238-ustawienia.tsx` |
| Odczyt (ZAKAZ ZAPISU) | `src/utils/orgRedesignFlag.ts` · `src/utils/__tests__/orgRedesignFlag.test.ts` · `src/utils/pilotAccess.ts` · `src/components/RouterSync.tsx` · `src/components/settings/SettingsSidebar.tsx` · `src/components/Organization/redesign/**` |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/funkcje/CO_ZNACZYLO_ZAMKNIETE_OSTATECZNIE.md` · `docs/functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md` · `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (`Z14`) |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` · każdy inny `MODULE_ACCEPTANCE.md` poza dwoma wskazanymi |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **FLAGA WRACA DO `OFF` NA KONIEC DYŻURU — SAM TO POTWIERDZASZ.** Ostatnia komenda
  `R3` to `grep` wartości domyślnej w `orgRedesignFlag.ts`, porównany 1:1 z wynikiem
  komendy (4) z `R1`. Różnica = STOP i cofnięcie zmiany.
- ★★ **NIE ROZSTRZYGASZ, CZY MODUŁY SĄ ZAMKNIĘTE.** Twoja robota kończy się na
  materiale dowodowym i uczciwej adnotacji sprzeczności. Werdykt to `Z14`-chroniony
  teren właściciela/nadzorcy.
- ★★ **ARTEFAKTY EFEMERYCZNE ZNIKAJĄ — NIE OBIECUJ TRWAŁOŚCI, KTÓREJ NIE MASZ.** Jeśli
  Twoje własne `/private/tmp/cx-day244-organizacja-ustawienia-artefakty` mają zniknąć po zakończeniu sesji (tak jak zniknęły
  dyżurów 236/238), zapisz to WPROST w raporcie jako ograniczenie, żeby nadzorca
  wiedział, że musi je skopiować/zarchiwizować PRZED zamknięciem Twojej sesji.
- ★ **BEZPIECZNIK JASNOŚCI (`mean_luma`, próg >150) NA KAŻDEJ PARZE ZRZUTÓW** — wzorem
  dyżurów 236/238, wykryty wcześniej defekt metody (kształt 19) nie ma prawa się
  powtórzyć.
- ★ **PUŁAPKI ŚRODOWISKA — SPRAWDŹ KAŻDĄ U SIEBIE:** `Database.ts:80-88` cicho
  podstawia atrapę bazy bez `RUN_DB_TESTS=1`; `vitest.config.ts:210` przypina
  `DB_TYPE='sqlite'`; `tests/setup.ts:896` podmienia `global.fetch`; `Z30` (poczta jest
  atrapą) obowiązuje, jeśli harness w ogóle dotyka warstwy powiadomień — udowodnij wg
  `§0.2b` PRZED pierwszym zapisującym przebiegiem.
- ★ **`Z13`/`J`:** logi i pliki wynikowe NIE wchodzą do repo — leżą w
  `/private/tmp/cx-day244-organizacja-ustawienia-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej
  sekcji jest podstawą odrzucenia dyżuru.
