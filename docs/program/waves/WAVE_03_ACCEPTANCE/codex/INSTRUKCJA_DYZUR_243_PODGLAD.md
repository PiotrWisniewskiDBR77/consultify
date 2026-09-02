# INSTRUKCJA DYŻURU nr 243 — Codex — „★★ PODGLĄD — TRZECI ELEMENT KANONU LIST NIGDY NIE SFOTOGRAFOWANY, REGUŁA PRZYJĘTA ALE NIEWPISANA DO KANONU. `docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md` (2026-09-01): 12 z 12 obejrzanych zrzutów z 12 różnych modułów pokazuje tabelę bez podglądu, 0 z 20 zrzutów dowodowych dyżurów wspomina o stanie podglądu, a `docs/ui-standards/TRIADA_KANON.md` §CZĘŚĆ B (pozycje 24-32, blok PREVIEW) wymaga oceny podglądu w liście czekowania, ale nigdzie nie mówi wprost, że towarzyszące jej zrzuty („Wynik listy dołączany do raportu odbioru razem ze zrzutami”, linia otwierająca CZĘŚĆ B) muszą pokazywać podgląd OTWARTY — stąd luka. Rekomendacja WSPÓLNA obu torów (przyjęta, koszt zero dodatkowych zrzutów): dwa zrzuty PO KLIKNIĘCIU w wiersz (bo `StandardPreview.tsx` nie ma żadnego pozycjonowania nakładkowego — `fixed`/`absolute`/`inset-0` zero wystąpień — więc jeden kadr pokazuje tabelę i podgląd naraz), cztery TYLKO tam, gdzie podgląd jest nakładką zasłaniającą tabelę (rozstrzygać mechanicznie, nie z pamięci) — ale ta reguła istnieje dziś WYŁĄCZNIE jako proza w `docs/program/funkcje/`, nie jako wpis w kanonicznej liście czekowania, którą realnie czytają wykonawcy."

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
> **wyłącznie** `/private/tmp/cx-day243-podglad`.

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
Zakres: ****PRZEKROJOWE — KANON DOWODU WIZUALNEGO (`docs/ui-standards/TRIADA_KANON.md`, CZĘŚĆ B).** Trzeci element kanonu list (PODGLĄD, pozycje 24-32 listy czekowania) nigdy nie był fotografowany w dowodzie odbioru — zmierzone dziś: 12 z 12 obejrzanych zrzutów z 12 różnych modułów pokazuje samą tabelę, ZERO z otwartym podglądem; 0 z 20 własnych ekranów dowodowych dyżurów wspomina o stanie podglądu. Ten dyżur (a) mechanicznie potwierdza, które ekrany mają podgląd jako panel boczny a które jako nakładkę, (b) dopisuje przyjętą regułę fotografowania do kanonu, (c) dostarcza jeden gotowy, wielokrotnego użytku skrypt „klik→zrzut” i jeden realny, zgodny z regułą komplet zrzutów jako dowód, że działa.**.
Trasy front: ``src/components/standard/StandardPreview.tsx` (kanoniczny panel boczny) · `src/components/shared/PreviewPane/**` (`PreviewPaneAside.tsx`, `previewStyles.ts`, `previewContract.ts`) · `src/components/standard/ArtifactRightPanel.tsx` · reprezentatywna próbka hubów z `R3`: `src/components/Materials/**` albo odpowiednik biblioteki materiałów (StandardTable+StandardPreview, wzór poprawny wg `CLAUDE.md` §9) — DOKŁADNĄ ścieżkę wskazujesz sam w `R1` po zlokalizowaniu żywego route'u`. Trasy tył: `brak w zakresie zapisu — ten dyżur nie zmienia backendu; jeśli `R1` wymaga danych do zrzutu, używasz istniejącego seedera/fixture'a dev-render (odczyt), nie piszesz nowego endpointu`.

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
WT=/private/tmp/cx-day243-podglad
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
git -C "$VAULT" worktree add "$WT" -b codex/day243-podglad-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day243-podglad/config.worktree"
cat "$VAULT/worktrees/cx-day243-podglad/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day243-podglad-scratch
mkdir -p /private/tmp/cx-day243-podglad-artefakty

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
git -C "$WT" push github-backup codex/day243-podglad-20260901
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

# (1) TEZA: StandardPreview.tsx nie ma zadnego pozycjonowania nakladkowego (panel boczny z definicji)
grep -n "fixed\|absolute\|inset-0\|z-50\|z-\[" src/components/standard/StandardPreview.tsx
#   oczekiwane: zero trafien pozycjonowania nakladkowego — potwierdza panel boczny

# (2) TEZA (KONTROLA DODATNIA — narzedzie musi umiec zlapac nakladke, inaczej "zero
#     trafien" nic nie dowodzi): istnieje przynajmniej JEDEN znany w produkcie panel
#     detali/podgladu zbudowany jako nakladka (fixed/absolute/inset-0), nie boczny
grep -rln "fixed inset-0\|absolute inset-0" src/components/*/  2>/dev/null | grep -iv "__tests__\|modal\|dialog" | head -10
#   oczekiwane: co najmniej jedno trafienie spoza modali/dialogow ogolnych — jesli
#   ZERO, metoda grepu jest podejrzana i wymaga innego sprawdzenia przed R1

# (3) TEZA: kanon TRIADA_KANON.md wymaga oceny podgladu (poz. 24-32) i zaleca zrzuty
#     w raporcie, ale nie mowi wprost ze maja pokazywac podglad OTWARTY
sed -n '90,122p' docs/ui-standards/TRIADA_KANON.md
grep -n "otwart\|klikni\|po kliknieciu" docs/ui-standards/TRIADA_KANON.md
#   oczekiwane: linia otwierajaca CZESC B wspomina zrzuty w raporcie odbioru, ale
#   sekcja PREVIEW (poz. 24-30) nie zawiera slowa o tym, ze zrzut ma byc PO kliknieciu

# (4) TEZA: 0 z 20 wlasnych ekranow dowodowych dzisiejszych dyzurow wspomina o stanie
#     podgladu (cudzy pomiar, cytujesz, nie odtwarzasz — Z28-analogiczne, brak dostepu
#     do cudzych artefaktow spoza repo)
grep -n "0 z 20\|Zaden z naszych ekranow dowodowych" docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md
#   oczekiwane: dokladnie ten cytat obecny w zrodle — jesli nie, zglos w Korektach

# (5) TEZA: rekomendacja WSPOLNA (2 zrzuty po kliknieciu, 4 tylko przy nakladce) jest
#     JUZ przyjeta w zrodle, ale NIGDZIE nie jest wpisana do TRIADA_KANON.md
grep -n "Dwa zrzuty po klikni\|WSPOLNA" docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md
grep -n "po klikni\|nakladk" docs/ui-standards/TRIADA_KANON.md
#   oczekiwane: pierwszy grep trafia (rekomendacja istnieje w zrodle), drugi NIE
#   trafia w TRIADA_KANON.md (potwierdza luke, ktora ten dyzur zamyka)

# (6) TEZA: istnieje dziala dev-render harness do montowania realnych komponentow z
#     mock-danymi (Menu 1 CLAUDE.md, uzywany w innych dyzurach fali 18/PODMIAR 1.09)
ls dev-render/screens/ | head -10
grep -rln "mean_luma\|mean-luma" scripts/dev/*.mjs 2>/dev/null | head -5
#   oczekiwane: katalog dev-render/screens istnieje z wieloma plikami; co najmniej
#   jeden istniejacy skrypt dev/*.mjs uzywa bezpiecznika jasnosci (wzor do naslad.)

# (7) TEZA: Materials/Tools sa realnym, poprawnym osadzeniem StandardTable+StandardPreview
#     (CLAUDE.md SS9: "Materials/Tools = wzor poprawny")
grep -rln "StandardPreview" src/components/Audit/ src/components/assessment/ 2>/dev/null | head -5
#   oczekiwane: co najmniej jeden plik w kazdym katalogu — wybierasz w R3 KONKRETNY,
#   dzialajacy dzis ekran do przykladu (nie musi to byc dokladnie Materials/Tools,
#   jesli inny jest latwiej montowalny w harnessie bez klucza LLM)

# (8) TEZA: miejsce na dysku wystarcza na dyzur
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day243-podglad-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6223`. Twój JEDYNY port harnessu to `5198 i 5199`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day243-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6220, 5010-5195, 6404-6411, 6600-6830. Twoje własne: baza 6223, harness 5198 i 5199. Cudze — siostrzane dyżury TEJ SAMEJ ostatniej paczki, nie dotykasz: baza 6221 i harness 5196-5197 (dyżur 242 Uprawnienia), baza 6225 i harness 5200-5201 (dyżur 244 Organizacja/Ustawienia). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. `Z10` obowiązuje bez wyjątku — ten dyżur nie dotyka żadnej flagi funkcyjnej.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY243_PODGLAD_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć, to `docs/ui-standards/TRIADA_KANON.md` — WYŁĄCZNIE nowa, jawnie oznaczona podsekcja na końcu CZĘŚCI B (np. „B.11 — PROTOKÓŁ FOTOGRAFOWANIA PODGLĄDU”), zero zmiany istniejącej treści i numeracji pozycji 1-43. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day243-podglad-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day243-podglad-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ przepisywania istniejącej treści `TRIADA_KANON.md`** poza dopisaniem nowej, jawnie oznaczonej podsekcji do CZĘŚCI B — zero zmiany numeracji pozycji 1-43, zero zmiany istniejących zdań. **ZAKAZ próby ponownego sfotografowania wszystkich 253 ekranów** albo nawet całej listy 12 modułów z `ZNALEZISKO_PODGLAD` — ten dyżur dostarcza REGUŁĘ + NARZĘDZIE + JEDEN działający przykład, nie pełny backfill (backfill to praca kolejnych, osobnych dyżurów listowych, każdy w swoim module). **ZAKAZ tworzenia nowego, konkurencyjnego dokumentu kanonu** — jedyne miejsce na regułę to `TRIADA_KANON.md`, nie nowy plik w `docs/program/funkcje/`. **ZAKAZ oceniania SAMEJ treści podglądu** (czy dane na zrzucie są poprawne) — to jest zakres list-canon dyżurów per moduł, nie tego dyżuru, który mierzy WYŁĄCZNIE protokół fotografowania. | Właściciel ocenia ekrany listowe od miesięcy i, jak pokazuje dzisiejszy pomiar, nigdy nie widział trzeciej części kanonu, który sam ustanowił jako obowiązkową (`docs/ui-standards/TRIADA_KANON.md` §A7/§CZĘŚĆ B, pozycje 24-32). Autor znaleziska ostrzega wprost: „Bez świadomej decyzji powtórzymy dokładnie ten sam błąd na dużo większą skalę” — kolejna duża tura zrzutów (253 ekranów wg toru grafiki) zacznie się, zanim reguła trafi do dokumentu, który wykonawcy faktycznie czytają. Reguła WSPÓLNA już istnieje i jest tania (zero dodatkowych zrzutów w większości przypadków) — brakuje wyłącznie jej wpisania do kanonu i jednego działającego przykładu, który przyszli wykonawcy mogą skopiować zamiast wymyślać własny sposób. |

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
cd /private/tmp/cx-day243-podglad

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day243-pg psql -U postgres -d cx243 \
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
cd /private/tmp/cx-day243-podglad

docker run -d --name cx-day243-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx243 \
  -p 127.0.0.1:6223:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day243-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6223/cx243 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6223/cx243 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day243-podglad && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6223/cx243 \
JWT_SECRET=cx243-test-secret-do-not-reuse \
npx vitest run scripts/dev/__tests__/click-then-shoot.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day243-podglad-artefakty/day243-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day243-podglad && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run scripts/dev/__tests__/click-then-shoot.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day243-podglad-artefakty/day243-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day243-podglad/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day243-pg psql -U postgres -d cx243 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day243-pg`.
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
> **(e) ★★ NIE SUMUJ DWÓCH RÓŻNYCH POMIARÓW W JEDNO ZDANIE. `docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md` opisuje DWA niezależne pomiary tego samego kierunku, które mierzą CO INNEGO: (a) czy dowody dyżurów WSPOMINAJĄ o stanie podglądu (0 z 20, nasz pomiar) i (b) czy podgląd JEST W KADRZE (12 z 12 nie jest, pomiar toru grafiki). Nie łącz ich w jedno mocniejsze zdanie w raporcie — to jest dokładnie kształt, przed którym ten sam dokument ostrzega w ostatniej sekcji („nie sumujmy tych liczb... inaczej sami zrobimy to, co dziś ścigaliśmy”). Druga pułapka: dokument mówi, że `StandardPreview.tsx` ma zero pozycjonowania nakładkowego — **to jest prawda o JEDNYM komponencie**, nie o wszystkich implementacjach podglądu w produkcie (86 plików importuje coś z rodziny `StandardPreview`/`PreviewPane`, część to legacy/bespoke panele spoza kanonu). Zanim napiszesz „ekran X ma podgląd boczny”, sprawdź, KTÓRY komponent renderuje ten konkretny ekran — nie zakładaj z nazwy modułu.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day243-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day243-podglad-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (mechaniczna klasyfikacja panel boczny vs nakładka, z kontrolą dodatnią i ujemną) · R2 (wpisanie reguły do `TRIADA_KANON.md` CZĘŚĆ B) · R3 (skrypt „klik→zrzut” wielokrotnego użytku + jeden realny, zgodny komplet zrzutów jako dowód) · R4 (raport dyżuru)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6223` albo `5198 i 5199` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6223` albo `5198 i 5199`** (`Z7`).

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

`docs/ui-standards/TRIADA_KANON.md` jest SSOT wyglądu każdego ekranu listowego
Consultify (`CLAUDE.md`, prawo nadrzędne UI, punkt 2). Jego CZĘŚĆ B — „LISTA
CZEKOWANIA" — jest tym, co każdy dyżur odbioru ekranu musi przejść **literalnie, ZA
KAŻDYM RAZEM** (`CLAUDE.md` punkt 4). Blok PREVIEW tej listy (pozycje 24-32) ocenia
nagłówek, kartę meta, ramkę AI, relacje i akcje panelu podglądu — czyli WYMAGA, żeby
ktoś PATRZYŁ na otwarty podgląd podczas odbioru.

**Dzisiejszy pomiar (`docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md`)
znalazł, że to patrzenie nigdy nie zostało udokumentowane zrzutem:**

- Dwanaście obejrzanych zrzutów, z dwunastu różnych modułów — **dwanaście pokazuje samą
  tabelę. ZERO z otwartym podglądem** (pomiar toru grafiki, 253-ekranowy przelot).
- **Zero z dwudziestu** własnych ekranów dowodowych dzisiejszych dyżurów wspomina o
  stanie podglądu (nasz niezależny pomiar, inna metoda: czy DOWÓD dyżuru w ogóle
  mówi cokolwiek o podglądzie, nie czy zrzut go pokazuje).

**Właściciel ocenia ekrany listowe od miesięcy i nigdy nie widział trzeciej części
kanonu, który sam ustanowił jako obowiązkową.** To NIE jest kształt „obraz kłamał"
(jak wcześniejszy kształt 19, atrapa uwiarygodniająca defekt) — obraz jest prawdziwy,
tylko niepełny, i nikt nie zauważył, czego na nim nie ma, bo nikt nie pytał „czy ten
zrzut pokazuje CAŁY ekran", tylko „czy pokazuje produkt".

## Dlaczego to jest pilne (cytat z autora znaleziska)

> „Bez świadomej decyzji powtórzymy dokładnie ten sam błąd na dużo większą skalę."

Program wchodzi w kolejną dużą turę zrzutów (253 ekrany wg toru grafiki). Jeśli reguła
fotografowania nie trafi do kanonu PRZED tą turą, każdy z tych 253 ekranów dostanie
dokładnie ten sam, niepełny dowód co dotychczasowe.

## Reguła WSPÓLNA — już PRZYJĘTA w źródle, ale nigdzie nie WPISANA do kanonu

Oba tory (nasz i tor grafiki) uzgodniły jedną rekomendację, tanią (zero dodatkowych
zrzutów w większości przypadków):

> **Dwa zrzuty po kliknięciu w wiersz** (jasny i ciemny motyw — nadal DWA, tylko
> poprzedzone kliknięciem). **Cztery TYLKO tam, gdzie podgląd jest nakładką
> zasłaniającą tabelę** — rozstrzygać MECHANICZNIE (czy komponent ma pozycjonowanie
> nakładkowe), nigdy z pamięci. **Archiwum bez przefotografowania wstecz, ale z
> adnotacją WYMIENIAJĄCĄ Z NAZWY**, czego w istniejącym kadrze nie było (np. „brak:
> blok AI, relacje, akcje, co dalej" — nie samo „niepełny").

Podstawa techniczna: `StandardPreview.tsx` (kanoniczny panel podglądu) **nie ma
żadnego pozycjonowania nakładkowego** (`fixed`/`absolute`/`inset-0` — zero wystąpień w
tym pliku) — jest elementem w przepływie strony, obok tabeli. Jeden kadr desktopowy
pokazuje więc tabelę i podgląd naraz, bez dodatkowego kosztu.

**Ta reguła istnieje dziś WYŁĄCZNIE jako proza w `docs/program/funkcje/` — pliku, którego
wykonawca kolejnego dyżuru listowego nie ma obowiązku czytać.** `TRIADA_KANON.md`, plik
który KAŻDY dyżur listowy faktycznie otwiera (`CLAUDE.md` nakazuje użycie skilla
`consultify-triada` przy każdej pracy nad ekranem listowym), o tej regule milczy.

## Czego ten dyżur świadomie NIE robi

- **Nie fotografuje ponownie 253 ekranów** ani nawet całej listy 12 modułów z
  `ZNALEZISKO_PODGLAD` — to praca wielu przyszłych, osobnych dyżurów listowych, każdy
  w swoim module, z tą regułą już wpisaną do kanonu, który będą czytać.
- **Nie ocenia treści** żadnego konkretnego podglądu (czy dane są poprawne, czy blok AI
  ma sens) — to zakres list-canon dyżurów per moduł.
- **Nie tworzy nowego dokumentu kanonu.** Jedyne miejsce na regułę to istniejący
  `TRIADA_KANON.md`.
- **Nie zmienia numeracji ani treści pozycji 1-43** listy czekowania — dopisuje nową,
  osobną podsekcję.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | `StandardPreview.tsx` nie ma żadnego pozycjonowania nakładkowego — jest panelem bocznym z definicji | komenda (1) |
| T2 | Metoda grepu użyta do T1 potrafi w ogóle złapać nakładkę, gdyby istniała (kontrola dodatnia) | komenda (2) |
| T3 | `TRIADA_KANON.md` wymaga oceny podglądu (poz. 24-32) i zrzutów w raporcie odbioru, ale nie mówi wprost, że zrzut ma pokazywać podgląd OTWARTY | komenda (3) |
| T4 | Zero z 20 własnych ekranów dowodowych dzisiejszych dyżurów wspomina o stanie podglądu (cudzy pomiar, cytowany) | komenda (4) |
| T5 | Rekomendacja WSPÓLNA istnieje w źródle, ale nigdzie nie jest wpisana do `TRIADA_KANON.md` | komenda (5) |
| T6 | Istnieje działający dev-render harness do montowania realnych komponentów z mock-danymi, z precedensem bezpiecznika jasności | komenda (6) |
| T7 | Da się znaleźć konkretny, dziś działający ekran kanoniczny (StandardTable+StandardPreview) do przykładu | komenda (7) |
| T8 | Miejsce na dysku wystarcza | komenda (8) |

---

# 3. POZYCJE DYŻURU

## R1 — KLASYFIKACJA PANEL BOCZNY vs NAKŁADKA (rdzeń, dowodowy, z kontrolą dodatnią)

**Metoda, nie liczba z pamięci.** Nie przepisuj „5 panel boczny / 3 nakładka" z
`ZNALEZISKO_PODGLAD` bez własnej weryfikacji — to jest cytat cudzego pomiaru w tamtym
dokumencie, bez podanej metody odtwarzalnej tutaj.

1. Sprawdź `StandardPreview.tsx` (komenda 1) — potwierdź brak pozycjonowania
   nakładkowego.
2. **Kontrola dodatnia, obowiązkowa przed ogłoszeniem wyniku ujemnego** (`CLAUDE.md`:
   „zero trafień” jest ważne tylko z dowodem, że narzędzie działało): znajdź w
   produkcie przynajmniej jeden PRAWDZIWY przykład panelu/podglądu zbudowanego jako
   nakładka (komenda 2), np. wśród paneli szczegółów spoza `src/components/standard/`
   (legacy, bespoke, przed migracją do kanonu). Jeśli nie znajdziesz ŻADNEGO — zmień
   metodę (np. poszukaj `z-index` wysokiego + `position` inline w stylach, nie tylko
   klas Tailwind) i dopiero wtedy, z DWIEMA niezależnymi metodami dającymi zero,
   zapisz wynik jako wiarygodny.
3. Dla komponentów z rodziny `StandardPreview`/`PreviewPane` (86 plików importujących
   coś z tej rodziny — policz sam, `grep -rl` bez `--include`, `CLAUDE.md` pułapka
   zsh) wybierz reprezentatywną próbkę **co najmniej 15** różnych modułów (nie tylko
   te już zbadane przez tor grafiki) i dla każdego ustal: (a) czy renderowany ekran
   faktycznie montuje `<StandardPreview>` czy inny, bespoke komponent podglądu, (b)
   jeśli inny — sprawdź TEN komponent pod kątem pozycjonowania nakładkowego, tym samym
   sposobem co w (1)-(2). Wynik: tabela moduł × komponent podglądu × panel boczny/
   nakładka/nie dotyczy (ekran bez podglądu w ogóle), z `plik:linia` dla każdego
   wiersza.

## R2 — WPISANIE REGUŁY DO `TRIADA_KANON.md` (rdzeń, dokumentacyjny)

Dopisz na końcu CZĘŚCI B nową podsekcję (proponowany nagłówek: „B.11 — PROTOKÓŁ
FOTOGRAFOWANIA PODGLĄDU"), zawierającą — językiem kanonu, nie prozą znaleziska:

1. **Zasadę**: zrzut ekranu listowego dołączany do listy czekowania MUSI być wykonany
   PO kliknięciu w wiersz (podgląd otwarty), nie przed. Dwa zrzuty (jasny/ciemny) w
   standardowym przypadku panelu bocznego; cztery (dwa z zamkniętym, dwa z otwartym
   podglądem) TYLKO gdy podgląd jest nakładką zasłaniającą tabelę.
2. **Metodę rozstrzygania** panel boczny vs nakładka — mechaniczną (sprawdzenie
   pozycjonowania komponentu, wynik `R1`), nie z pamięci ani „to chyba panel boczny
   jak wszędzie".
3. **Zasadę dla istniejącego, niekompletnego archiwum**: nie wymaga się
   przefotografowania wstecz, ale KAŻDY wpis w rejestrze odbioru, który powstał przed
   tą regułą i nie pokazuje podglądu, dostaje adnotację wymieniającą Z NAZWY, czego w
   kadrze nie ma (np. „brak w kadrze: blok AI, relacje, akcje"), nie samo „niepełny".
4. **Odniesienie do źródła**: link do
   `docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md` jako
   uzasadnienie i historia decyzji — kanon dostaje regułę, znalezisko zostaje
   uzasadnieniem, nie duplikujesz treści.

**Zero zmiany numeracji ani treści pozycji 1-43.** Nowa podsekcja jest addytywna.

## R3 — SKRYPT „KLIK→ZRZUT" + JEDEN REALNY, ZGODNY KOMPLET (rdzeń, dowodowy)

1. Zlokalizuj (komenda 6-7) istniejący dev-render/harness wzorzec z bezpiecznikiem
   jasności (`mean_luma`, próg >150 — wzorowany na dyżurach fali 18/PODMIAR 1.09, np.
   `scripts/dev/day233-finanse-panele-zrzuty-jasne.mjs` jeśli dostępny w Twoim
   worktree, albo najbliższy odpowiednik) i jeden dziś działający ekran kanoniczny
   (StandardTable+StandardPreview — Materials/Tools są wzorem poprawnym wg
   `CLAUDE.md` §9, ale wybierz cokolwiek, co realnie montuje się w harnessie BEZ
   klucza LLM i bez pełnego backendu, żeby dyżur był odtwarzalny bez zależności
   zewnętrznych).
2. Napisz **jeden, nazwany, wielokrotnego użytku** skrypt
   `scripts/dev/click-then-shoot.mjs` (albo lokalizacja zgodna z konwencją Twojego
   worktree — uzasadnij wybór w raporcie), który: otwiera ekran listowy w harnessie,
   klika w PIERWSZY wiersz tabeli, czeka na wyrenderowanie podglądu (selektor DOM
   wyniku, nie stały `sleep` — wzorem naprawy kształtu 19,
   `docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md`), robi DWA zrzuty
   (jasny/ciemny) z bezpiecznikiem jasności, i **mechanicznie** sprawdza pozycjonowanie
   komponentu podglądu, decydując 2 czy 4 zrzuty wg reguły `R2`.
3. **Dowód mutacyjny narzędzia, nie tylko kodu produktu**: uruchom skrypt na starym,
   naiwnym wariancie (zrzut PRZED kliknięciem) — pokaż, że wynikowy kadr NIE zawiera
   podglądu; uruchom nowy skrypt — pokaż, że kadr GO zawiera. To jest dowód czerwono→
   zielono dla NARZĘDZIA (nie dla produktu — produkt się nie zmienia w tym dyżurze).
4. Zapisz oba zestawy zrzutów (przed/po) do `/private/tmp/cx-day243-podglad-artefakty` z `shasum -a 256`, i
   dołącz jeden kompletny, zgodny z nową regułą zestaw jako **załącznik dowodowy
   `R2`** w raporcie — konkretny przykład, który przyszły wykonawca może otworzyć i
   skopiować.

## R4 — RAPORT DYŻURU (rdzeń)

Sekcje: streszczenie, `R1`-`R3` z pełnymi dowodami i tabelą klasyfikacji z `R1`,
sekcja „TWIERDZENIA NIEZWERYFIKOWANE" (obowiązkowa nawet pusta), sekcja „Korekty
wobec instrukcji" (obowiązkowa nawet pusta). Dołącz ścieżkę do zmodyfikowanego
`TRIADA_KANON.md` z `git diff` ograniczonym do nowej podsekcji (dowód, że nic
istniejącego nie zostało zmienione).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (WĄSKO, `R2`/`J`) | `docs/ui-standards/TRIADA_KANON.md` — WYŁĄCZNIE nowa podsekcja na końcu CZĘŚCI B, zakaz zmiany istniejącej treści/numeracji |
| Zapis (NOWE, `R3`) | `scripts/dev/click-then-shoot.mjs` (nowy plik) · `scripts/dev/__tests__/click-then-shoot.test.mjs` (nowy plik testowy dowodzący mutacyjnie, że skrypt faktycznie czeka na podgląd) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY243_PODGLAD_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/standard/StandardPreview.tsx` · `src/components/shared/PreviewPane/**` · `src/components/standard/ArtifactRightPanel.tsx` · wszystkie moduły próbkowane w `R1`/`R3` |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md` · `docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md` · istniejące skrypty dev-render użyte jako wzorzec |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` · każdy `MODULE_ACCEPTANCE.md` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **CEL TEGO DYŻURU JEST NARZĘDZIE + REGUŁA + JEDEN PRZYKŁAD, NIE BACKFILL.** Nie
  próbuj sfotografować na nowo istniejących ekranów spoza jednego przykładu z `R3` —
  to eksplodowałoby zakres poza jeden dyżur i byłoby dokładnie tym „daj wszystko na
  raz", którego zakazuje `CLAUDE.md` §9.
- ★★ **NIE SUMUJ DWÓCH POMIARÓW ŹRÓDŁOWYCH W JEDNO ZDANIE.** „0 z 20" (czy dowody
  WSPOMINAJĄ o podglądzie) i „12 z 12" (czy podgląd JEST w kadrze) mierzą co innego —
  cytuj oba osobno, z podpisem który jest który, nigdy jako sumę czy jedno mocniejsze
  twierdzenie.
- ★★ **KONTROLA DODATNIA PRZED KAŻDYM WYNIKIEM „ZERO TRAFIEŃ".** `R1` wymaga
  znalezienia PRAWDZIWEGO przykładu nakładki, zanim ogłosisz, że żaden kanoniczny
  komponent jej nie ma — „nie znalazłem” i „nie szukałem” wyglądają identycznie bez
  tego dowodu.
- ★ **DOWÓD MUTACYJNY DLA NARZĘDZIA (`R3`), NIE DLA PRODUKTU.** Ten dyżur nie zmienia
  kodu produktowego — mutacja dotyczy Twojego nowego skryptu (naiwny wariant vs
  wariant z czekaniem na selektor), nie żadnego pliku `src/`.
- ★ **PUŁAPKI ŚRODOWISKA — SPRAWDŹ KAŻDĄ U SIEBIE:** `Database.ts:80-88` cicho
  podstawia atrapę bazy bez `RUN_DB_TESTS=1`; `vitest.config.ts:210` przypina
  `DB_TYPE='sqlite'`; `tests/setup.ts:896` podmienia `global.fetch`; jeżeli harness
  z `R3` wymaga bazy, stosujesz pełny komplet zmiennych z `§0.2c`, nie skróty.
- ★ **`Z13`/`J`:** logi, zrzuty i pliki wynikowe NIE wchodzą do repo poza JEDNYM
  załącznikiem dowodowym z `R3` — leżą w `/private/tmp/cx-day243-podglad-artefakty`, raport podaje ścieżki i
  `shasum -a 256`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej
  sekcji jest podstawą odrzucenia dyżuru.
