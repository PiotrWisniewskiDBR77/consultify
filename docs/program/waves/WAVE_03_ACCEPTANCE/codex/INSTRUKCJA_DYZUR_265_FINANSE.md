# INSTRUKCJA DYŻURU nr 265 — Codex — „★★ KOMPLET ZRZUTÓW FINANSÓW POD WERDYKT WŁAŚCICIELA — z otwartym podglądem, którego dotąd nikt nie fotografował. `docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md` (2026-09-01): 12 z 12 zrzutów z 12 modułów pokazuje samą tabelę, ZERO z otwartym podglądem — rekomendacja WSPÓLNA (przyjęta, koszt zero): dwa zrzuty PO KLIKNIĘCIU w wiersz, bo `StandardPreview.tsx` nie ma pozycjonowania nakładkowego (panel boczny), cztery TYLKO gdy podgląd jest nakładką. Finanse mają WŁASNY precedens tego samego rodzaju usterki: `docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md` (dyżur 233, 1.09) — para jasny/ciemny Monte Carlo i Scenariuszy przeszła bezpiecznik różnicy jasności (próg 150, różnica >200), a mimo to jasny pokazywał sam formularz, ciemny policzony wynik: bezpiecznik jednowymiarowy nagradzał defekt tym łatwiej, im był większy. Naprawiono `scripts/dev/day233-finanse-panele-zrzuty-jasne.mjs` (czeka na selektor DOM wyniku) + `scripts/dev/lib/checkScreenshotPairState.mjs` (dwuwymiarowy: jasność ORAZ obecność wyniku w DOM w obu wariantach) — ten dyżur MUSI użyć TEGO SAMEGO wzorca dla całego huba, nie tylko pięciu paneli objętych dyżurem 233."

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
> **wyłącznie** `/private/tmp/cx-day265-finanse-zrzuty`.

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
Zakres: ****MODUŁ FINANSE (`FinanceHub.tsx`, route `/finance`, menu pozycja `MODULE_ECONOMICS`).** Bramka „moduł zaakceptowany i zaczekpointowany” ma status NIEROZPOCZĘTY we wszystkich 16 kartach modułów (pomiar 1.09) — formalnie żaden moduł nigdy nie przeszedł ostatniej bramki. Ten dyżur produkuje MATERIAŁ DO WERDYKTU: komplet zrzutów Finansów (5 zakładek huba, jasny/ciemny, stan pusty/pełny, menu, kebab, **podgląd otwarty PO kliknięciu w wiersz** — trzeci element kanonu list, który wg `docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md` nie był sfotografowany ANI RAZU w 12 z 12 obejrzanych zrzutów z 12 modułów). Zero naprawiania — dyżur dowodowy.**.
Trasy front: ``src/components/Economics/FinanceHub.tsx` (hub, 5 zakładek: `statements`/`analysis`/`models`/`prediction`/`valuation`, route `/finance`) · `dev-render/screens/finance-hub.tsx` (jedyny dziś istniejący pełny harness huba w `dev-render/main.tsx`, klucz `finance-hub`, obsługuje `&tab=statements|analysis|models|prediction|valuation`) · `src/components/standard/StandardPreview.tsx` (kanoniczny panel boczny) · panele wyceny pod `src/components/Finance/**` (21 paneli, `Analysis/`, `BaselineWorkspace.tsx` i pokrewne) — DOKŁADNY spis w `R1``. Trasy tył: `brak w zakresie zapisu — dyżur nie zmienia backendu; do zasilenia ekranów danymi używasz istniejącej atrapy `dev-render/screens/finance-hub.tsx` (odczyt, ewentualna rozbudowa wg `R2`) albo istniejącego seedera dev-render, nigdy nowego endpointu`.

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
WT=/private/tmp/cx-day265-finanse-zrzuty
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
git -C "$VAULT" worktree add "$WT" -b codex/day265-finanse-zrzuty-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day265-finanse-zrzuty/config.worktree"
cat "$VAULT/worktrees/cx-day265-finanse-zrzuty/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day265-finanse-zrzuty-scratch
mkdir -p /private/tmp/cx-day265-finanse-zrzuty-artefakty

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
git -C "$WT" push github-backup codex/day265-finanse-zrzuty-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only df7f13056f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: FinanceHub ma dokladnie 5 zakladek: statements/analysis/models/prediction/valuation
grep -n "id: 'statements'\|id: 'analysis'\|id: 'models'\|id: 'prediction'\|id: 'valuation'" src/components/Economics/FinanceHub.tsx
#   oczekiwane: 5 trafien, jedno na kazda zakladke

# (2) TEZA: istnieje JUZ pelny harness huba w dev-render, klucz 'finance-hub', obslugujacy wszystkie 5 zakladek przez query
grep -n "'finance-hub'" -A3 dev-render/main.tsx
#   oczekiwane: wpis z etykieta wspominajaca &tab=statements|analysis|models|prediction|valuation

# (3) TEZA: StandardPreview.tsx (kanoniczny podglad) nie ma zadnego pozycjonowania nakladkowego
grep -n "fixed\|absolute\|inset-0\|z-50\|z-\[" src/components/standard/StandardPreview.tsx
#   oczekiwane: zero trafien

# (4) TEZA: FinanceHub uzywa StandardPreview bezposrednio (nie bespoke)
grep -n "StandardPreview" src/components/Economics/FinanceHub.tsx
#   oczekiwane: co najmniej jeden import + jedno uzycie w JSX

# (5) TEZA (POMIAR 1.09 OBALIL STARSZA LICZBE): 18 z 21 paneli wyceny wola realny backend, 3 sa celowo lokalne
sed -n '1,120p' docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md | grep -n "18 z 21\|DriverPlannerPanel\|EvBasketFootballField\|ValuationVisualsPanel"
#   oczekiwane: cytat obecny doslownie — jesli nie, zglos w Korektach zamiast improwizowac

# (6) TEZA: 25 z 26 ekranow Finansow jest domyslnie OFF za flaga, i to jest ZAMIERZONE
grep -n "25 z 26\|jest stan zamierzony" docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md
cat src/utils/financeValuePanelsFlag.ts | sed -n '1,30p'
#   oczekiwane: cytat w pomiarze + w pliku flagi domyslna wartosc OFF (false/0)

# (7) TEZA: KSZTALT_19 zostal juz raz znaleziony i naprawiony na TYM module — masz uzyc naprawionego wzorca, nie odkrywac od nowa
ls -la scripts/dev/day233-finanse-panele-zrzuty-jasne.mjs scripts/dev/lib/checkScreenshotPairState.mjs scripts/dev/lib/meanLuma.mjs
grep -n "DEFAULT_LUMA_DIFF_THRESHOLD\|requiresResultMarker" scripts/dev/lib/checkScreenshotPairState.mjs
#   oczekiwane: wszystkie trzy pliki istnieja, bezpiecznik ma DWA wymiary (luma + marker wyniku)

# (8) TEZA: piec tras artefaktow Finansow (statement/model/analysis/prediction/valuation detail) to PELNE STRONY, nie panel podgladu z listy
grep -n 'path="/finance/statements/:id\|path="/finance/models/:id\|path="/finance/analyses/:id\|path="/finance/predictions/:id\|path="/finance/valuations/:id' src/routes/AppRoutes.tsx
#   oczekiwane: 5 tras, kazda osobnym route (nie podgladem bocznym listy)

# (9) TEZA: miejsce na dysku wystarcza
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day265-finanse-zrzuty-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6270`. Twój JEDYNY port harnessu to `5250 i 5251`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day265-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6269, 5010-5249, 6404-6411, 6600-6830. Twoje własne: baza 6270, harness 5250 i 5251. Cudze — siostrzane dyżury TEJ SAMEJ paczki (komplety zrzutów pod werdykt), nie dotykasz: baza 6272 harness 5252-5253 (dyżur 266 Wyniki), baza 6274 harness 5254-5255 (dyżur 267 Materiały), baza 6276 harness 5256-5257 (dyżur 268 Czat+Moja Praca), baza 6278 harness 5258-5259 (dyżur 269 Audyty+Narzędzia). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. Nadpisania WYŁĄCZNIE przez query string (`?ff_financeValuePanels=1`, `?ff_wave3FinanceOwnerReview=1`) na czas przechwytywania zrzutu, nigdy w kodzie ani w `.env*`. `Z10` obowiązuje bez wyjątku.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY265_FINANSE_ZRZUTY_REPORT.md`. Brak innych dokumentów do modyfikacji. Jedyny plik zapisu w repo to raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY265_FINANSE_ZRZUTY_REPORT.md` plus (jeśli `R2` wykaże potrzebę) rozszerzenie ISTNIEJĄCEGO `dev-render/screens/finance-hub.tsx` o brakujące stany/zakładki i nowy, nazwany skrypt `scripts/dev/day265-finanse-zrzuty-werdykt.mjs` (wzorem `day233-finanse-panele-zrzuty-jasne.mjs`) — zero nowych dokumentów rejestrowych. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day265-finanse-zrzuty-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day265-finanse-zrzuty-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ NAPRAWIANIA CZEGOKOLWIEK** — kolumna „/”, panel bez danych, atrapa o złym kształcie: opisujesz z `plik:linia`, nie łatasz. **ZAKAZ zmiany domyślnej wartości JAKIEJKOLWIEK flagi** (25 z 26 ekranów OFF jest zamierzone — `Z10`/`CLAUDE.md` p.9). **ZAKAZ oceniania POPRAWNOŚCI liczb** na panelach wyceny (to zakres innych dyżurów, np. 233) — ten dyżur ocenia WYŁĄCZNIE kompletność i uczciwość dowodu wizualnego (czy podgląd jest w kadrze, czy para pokazuje ten sam stan, czy atrapa ma kształt serwera). **ZAKAZ fotografowania spoza modułu Finanse** — nie dotykasz Wyników/Materiałów/Audytów/Czatu/Narzędzi, to osobne dyżury (266-269) tej samej paczki. | Zmierzone 1.09: bramka „moduł zaakceptowany i zaczekpointowany” ma status NIEROZPOCZĘTY we WSZYSTKICH 16 kartach modułów — formalnie żaden moduł nigdy nie przeszedł ostatniej bramki zamknięcia. Przez tydzień robiliśmy pomiar i naprawę, nie zamykanie. Ten dyżur (jeden z pięciu — 265 Finanse, 266 Wyniki, 267 Materiały, 268 Czat+Moja Praca, 269 Audyty+Narzędzia) produkuje materiał do werdyktu: komplet zrzutów gotowy do położenia przed właścicielem. Reguła nienaruszalna z `CLAUDE.md` p.7: właściciel NIGDY nie jest pierwszym testerem wizualnym — zrzut robi wykonawca, sam go ogląda, dopiero czysty materiał trafia do właściciela, do AKCEPTU nie do odkrywania zepsucia. Finanse mają dodatkowy powód pilności: to JEDYNY moduł z już udokumentowanym kształtem 19 (para zgodna, różne stany) — dowód, że stary, jednowymiarowy bezpiecznik jasności nie wystarcza, i że bez naprawionego skryptu ten sam błąd powtórzy się przy każdej kolejnej parze zrzutów tego modułu. |

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
cd /private/tmp/cx-day265-finanse-zrzuty

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day265-pg psql -U postgres -d cx265 \
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
cd /private/tmp/cx-day265-finanse-zrzuty

docker run -d --name cx-day265-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx265 \
  -p 127.0.0.1:6270:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day265-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6270/cx265 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6270/cx265 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day265-finanse-zrzuty && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6270/cx265 \
JWT_SECRET=cx265-test-secret-do-not-reuse \
npx vitest run scripts/dev/__tests__/day265-finanse-zrzuty-werdykt.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day265-finanse-zrzuty-artefakty/day265-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day265-finanse-zrzuty && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run scripts/dev/__tests__/day265-finanse-zrzuty-werdykt.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day265-finanse-zrzuty-artefakty/day265-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day265-finanse-zrzuty/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day265-pg psql -U postgres -d cx265 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day265-pg`.
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
> **(e) ★★ 25 Z 26 EKRANÓW FINANSÓW JEST ZAMKNIĘTYCH ZA FLAGAMI DOMYŚLNIE WYŁĄCZONYMI — TO JEST ZAMIERZONE, NIE DEFEKT (pomiar 1.09, `docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md` §1.2). `VITE_FINANCE_VALUE_PANELS` (front, domyślnie OFF, `src/utils/financeValuePanelsFlag.ts:1-30`) jest NIEZALEŻNA od backendowego `ENABLE_V8_GLOBAL` (zwraca `404 V8_DISABLED` gdy wyłączony, `server/src/middleware/v8FeatureGate.middleware.ts:10-20`) — dwie różne bramki, dwa różne warstwy. Do zrzutów używasz WYŁĄCZNIE nadpisania przez QUERY STRING (`?ff_financeValuePanels=1` itp., wzorem pomiaru 1.09) — **NIGDY nie zmieniasz wartości domyślnej w kodzie ani w `.env*`** (`Z10`, `CLAUDE.md` p.9 zakaz masowego włączania). Druga pułapka: „18 z 21 paneli woła backend” jest OBALONYM twierdzeniem starszej wersji („5 z 21”, oparte na nieistniejącym pliku) — aktualny, zmierzony 1.09 wynik to 18 z 21 z danymi, 3 celowo lokalne (`DriverPlannerPanel`, `EvBasketFootballField`, `ValuationVisualsPanel` — render z propsów, brak wołania backendu jest ZAMIERZONY, nie luka). Nie licz tych trzech jako „ekranów niesfotografowanych z powodu defektu” — to jest architektura, opisz to wprost w tabeli `R4`.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day265-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day265-finanse-zrzuty-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (inwentarz ekranów Finansów: 5 zakładek huba + 21 paneli wyceny + 5 tras artefaktów `/finance/{statements,models,analyses,predictions,valuations}/:id`, z klasyfikacją lista/panel-boczny vs artefakt/pełna-strona) · R2 (kontrola kształtu atrapy — czy `dev-render/screens/finance-hub.tsx` odzwierciedla kształt SERWERA, nie frontu, per `KSZTALT_21`) · R3 (wykonanie kompletu zrzutów — klik→zrzut, dwa selektory wyniku, `checkScreenshotPairState`, jasny/ciemny/pusty/pełny/każda zakładka osobno) · R4 (raport + katalog zrzutów + tabela + lista niefotografowalnych)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6270` albo `5250 i 5251` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6270` albo `5250 i 5251`** (`Z7`).

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

Zmierzone 1.09: bramka „moduł zaakceptowany i zaczekpointowany” ma status
**NIEROZPOCZĘTY we wszystkich 16 kartach modułów**. Formalnie **żaden moduł
nigdy nie przeszedł ostatniej bramki zamknięcia**. Przez tydzień robiliśmy
pomiar i naprawę — **nie robiliśmy zamykania**.

Ten dyżur (jeden z pięciu — 265 Finanse, 266 Wyniki, 267 Materiały, 268 Czat+
Moja Praca, 269 Audyty+Narzędzia) produkuje **MATERIAŁ DO WERDYKTU**: komplet
zrzutów modułu Finanse, gotowy do położenia przed właścicielem. **Nic więcej.
Zero naprawiania.**

**Reguła nienaruszalna** (`CLAUDE.md` p.7): właściciel NIGDY nie jest
pierwszym testerem wizualnym. Zrzut robi wykonawca, sam go ogląda, i dopiero
czysty materiał trafia do właściciela — **do akceptu, nie do odkrywania
zepsucia**.

## Dlaczego akurat Finanse mają dodatkową pilność

`docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md` (1.09) opisuje
defekt znaleziony PRZY ODBIORZE dyżuru 233 (Finanse): pięć par zrzutów jasny/
ciemny **przeszło** bezpiecznik różnicy jasności (próg 150) z zapasem >200 —
a mimo to dwie z pięciu par pokazywały **dwa różne stany aplikacji** (Monte
Carlo: jasny = sam formularz, ciemny = policzony histogram; Scenariusze:
jasny = sam przycisk „Uruchom”, ciemny = gotowy wykres). Przyczyna: wyścig
klik→zrzut w jednorazowym, niezacommitowanym skrypcie.

**Naprawa istnieje i jest zacommitowana**: `scripts/dev/day233-finanse-panele-zrzuty-jasne.mjs`
(czeka na selektor DOM wyniku, nie na czas) + `scripts/dev/lib/checkScreenshotPairState.mjs`
(bezpiecznik DWUWYMIAROWY — jasność ORAZ obecność wyniku w DOM w obu
wariantach). Dowód mutacyjny istnieje: `scripts/dev/__tests__/checkScreenshotPairState.test.mjs`
(6/6 PASS z zabezpieczeniem, 3/6 FAIL po jego ręcznym usunięciu). Po naprawie:
5 z 5 par miało wynik policzony w obu motywach.

**Ten dyżur MUSI użyć DOKŁADNIE tego samego, już naprawionego wzorca** dla
CAŁEGO huba (5 zakładek + panele wyceny), nie tylko dla pięciu paneli objętych
dyżurem 233. Powtórzenie starego, jednowymiarowego bezpiecznika na nowych
ekranach byłoby dokładnie tym błędem, który `KSZTALT_19` już raz kosztował.

## Trzeci element kanonu list — PODGLĄD — nigdy niesfotografowany

`docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md` (1.09):
**12 z 12** obejrzanych zrzutów z 12 różnych modułów pokazuje samą tabelę,
**ZERO** z otwartym podglądem; **0 z 20** własnych ekranów dowodowych dyżurów
wspomina o stanie podglądu. **To są dwa różne pomiary — nie sumuj ich w jedno
zdanie** (patrz „Twarde zasady” niżej).

Rekomendacja WSPÓLNA, przyjęta, koszt zero dodatkowych zrzutów: **dwa zrzuty
PO KLIKNIĘCIU w wiersz** (jasny/ciemny — nadal dwa, tylko poprzedzone
kliknięciem), bo `StandardPreview.tsx` (kanoniczny panel podglądu, którego
`FinanceHub.tsx` używa bezpośrednio — komenda 4) **nie ma żadnego
pozycjonowania nakładkowego**. **Cztery zrzuty TYLKO tam, gdzie podgląd jest
nakładką zasłaniającą tabelę** — rozstrzygać MECHANICZNIE, nigdy z pamięci.

## Co ten dyżur świadomie NIE robi

- **Nie naprawia** kolumny „/”, panelu bez danych ani żadnej atrapy — opisuje
  z `plik:linia`.
- **Nie ocenia poprawności liczb** na panelach wyceny (zakres innych dyżurów).
- **Nie zmienia wartości domyślnej ŻADNEJ flagi** — 25 z 26 ekranów Finansów
  jest OFF domyślnie i to jest **zamierzone** (`CLAUDE.md` p.9, zakaz
  masowego włączania).
- **Nie fotografuje innych modułów** — Wyniki/Materiały/Audyty/Czat/Narzędzia
  to osobne dyżury tej samej paczki (266-269).

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | `FinanceHub.tsx` ma dokładnie 5 zakładek: statements/analysis/models/prediction/valuation | komenda (1) |
| T2 | Istnieje już pełny harness huba w `dev-render` (klucz `finance-hub`), obsługujący wszystkie 5 zakładek przez query string | komenda (2) |
| T3 | `StandardPreview.tsx` nie ma żadnego pozycjonowania nakładkowego (panel boczny) | komenda (3) |
| T4 | `FinanceHub.tsx` renderuje `StandardPreview` bezpośrednio, nie bespoke odpowiednik | komenda (4) |
| T5 | 18 z 21 paneli wyceny woła realny backend i dostaje dane; 3 są celowo lokalne (nie defekt) | komenda (5) |
| T6 | 25 z 26 ekranów Finansów jest domyślnie OFF za flagą i to jest zamierzone | komenda (6) |
| T7 | Kształt 19 (para zgodna, różne stany) był już raz znaleziony i naprawiony na TYM module — istnieje gotowy, zacommitowany wzorzec do ponownego użycia | komenda (7) |
| T8 | 5 tras artefaktów Finansów (`/finance/{statements,models,analyses,predictions,valuations}/:id`) to pełne strony, nie panel podglądu z listy | komenda (8) |
| T9 | Miejsce na dysku wystarcza | komenda (9) |

---

# 3. POZYCJE DYŻURU

## R1 — INWENTARZ EKRANÓW FINANSÓW (rdzeń, pomiarowy)

**Nie licz z pamięci ani nie przepisuj liczby z tego dokumentu bez własnej
weryfikacji** — cytaty T1-T9 są punktem startowym, nie dowodem gotowym do
wklejenia.

1. **5 zakładek huba** (`statements`, `analysis`, `models`, `prediction`,
   `valuation`) — dla każdej ustal: czy to lista `StandardTable`+`StandardPreview`
   (kanon list) czy coś innego. Dla każdej zakładki listowej: liczba wierszy w
   stanie pełnym/pustym dostępna w atrapie `dev-render/screens/finance-hub.tsx`.
2. **21 paneli wyceny** (zakładka `valuation`, workspace, NIE lista) — pełna
   tabela z `plik:linia` dla każdego, klasyfikacja: woła backend z danymi (18)
   / celowo lokalny (3, imiennie: `DriverPlannerPanel`, `EvBasketFootballField`,
   `ValuationVisualsPanel`). To są ekrany-panele wewnątrz jednej zakładki, nie
   osobne trasy — sfotografować każdy PO uruchomieniu (AutoRun / kliknięciu
   „Uruchom”), analogicznie do `day233-finanse-panele-zrzuty-jasne.mjs`.
3. **5 tras artefaktów** (`/finance/statements/:id`, `/finance/models/:id`,
   `/finance/analyses/:id`, `/finance/predictions/:id`, `/finance/valuations/:id`)
   — to są PEŁNE STRONY (SPEC-A, nie panel boczny listy). Dla nich reguła
   „klik→dwa zrzuty” z `ZNALEZISKO_PODGLAD` NIE ma zastosowania wprost (nie ma
   tabeli obok), ale kanon artefaktu (`ARTIFACT_ANATOMY_STANDARD.md`) nadal
   wymaga jasny/ciemny/pusty/pełny/menu/kebab per ekran — sfotografuj tak samo.
4. Zbuduj tabelę **ekran × typ (lista/panel/artefakt) × stan pusty/pełny ×
   jasny/ciemny × podgląd w kadrze (tak/nie/nie dotyczy)** — to jest szkielet
   `R4`.
5. Policz **łączną liczbę unikalnych kadrów potrzebnych** i porównaj z liczbą
   faktycznie wykonanych w `R3` — rozbieżność idzie do „Twierdzenia
   niezweryfikowane” lub do listy niefotografowalnych, nigdy do milczenia.

## R2 — KONTROLA KSZTAŁTU ATRAPY (rdzeń, dowodowy — `KSZTALT_21`)

`docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` (1.09,
moduł Audyty): atrapa, która ma nazwy pól **frontu**, a nie **serwera**,
potrafi wyprodukować zrzut, który **wygląda poprawnie, mimo że produkt jest
zepsuty** — właściciel oglądał taki ekran DWUKROTNIE i przyjął, bo liczby na
zrzucie były wiarygodne (`0/42`, `12/42`), podczas gdy realny produkt pokazuje
literalny ukośnik.

**Zanim zrobisz jakikolwiek zrzut z `dev-render/screens/finance-hub.tsx`:**

1. Znajdź realny kontrakt odpowiedzi każdej trasy, którą atrapa przechwytuje
   (np. `GET /finance/statements`, `GET /finance/valuations/:id/...`) po
   stronie serwera (`server/src/routes/finance*.routes.ts` albo odpowiednik —
   zlokalizuj sam, zapisz `plik:linia`).
2. Porównaj nazwy pól w odpowiedzi serwera z nazwami pól, które atrapa w
   `finance-hub.tsx` zwraca. **Jeśli się różnią** — to jest dokładnie kształt
   21: zrzut zrobiony z tej atrapy BĘDZIE fałszywym dowodem, nawet jeśli
   wygląda dobrze. Zgłoś to jako **blokujące dla wiarygodności zrzutu tej
   konkretnej zakładki/panelu** — nie naprawiaj (zakaz naprawiania), ale NIE
   włączaj tego zrzutu do kompletu bez jawnej adnotacji „atrapa ma kształt
   frontu, nie serwera — zrzut nie dowodzi zachowania produkcyjnego”.
3. Powtórz dla KAŻDEJ zakładki i KAŻDEGO z 21 paneli wyceny — nie tylko dla
   jednej próbki. Wynik: tabela zakładka/panel × zgodność kształtu × `plik:linia`
   obu stron porównania.

## R3 — WYKONANIE KOMPLETU ZRZUTÓW (rdzeń, dowodowy)

**Dla każdego ekranu z inwentarza `R1`, który przeszedł `R2` bez zastrzeżenia
blokującego:**

1. **Klik→zrzut, nie zrzut przed kliknięciem.** Dla 5 zakładek listowych:
   otwórz zakładkę, kliknij PIERWSZY wiersz tabeli, zaczekaj na wyrenderowanie
   `StandardPreview`, dopiero wtedy zrzut. **Dwa zrzuty (jasny/ciemny)** w
   standardowym przypadku panelu bocznego. **Cztery TYLKO** jeśli mechaniczna
   kontrola (komenda 3, powtórzona per konkretny ekran, nie założona z góry)
   wykaże nakładkę.
2. **Czekaj na WYNIK, nie na czas.** Dla paneli wyceny z AutoRun (Monte Carlo,
   Scenariusze i inne z wynikiem obliczanym asynchronicznie): selektor DOM
   wyniku, **DWA niezależne selektory** (np. kontener wykresu ORAZ tekst
   metryki) — jeden selektor przepuszcza zrzut, gdy drugiego jeszcze nie ma
   (wymóg z instrukcji nadrzędnej tej fali dyżurów).
3. **Para jasny/ciemny musi pokazywać TEN SAM STAN.** Użyj
   `checkScreenshotPairState` z `requiresResultMarker=true` dla wszystkich
   paneli/ekranów, które mają stan „policzony wynik” — podaj średnią jasność
   OBU wariantów ORAZ jednozdaniowy opis, co widać na obrazie (nie „panel”,
   tylko „histogram Monte Carlo z metrykami P10/P50/P90” itp.).
4. **Stan pusty i pełny osobno**, dla każdej zakładki listowej — z jawną
   adnotacją, **czyim kontem** zrobiono zrzut stanu pustego (obcy dostający
   `200` z pustą listą po naprawie uprawnień jest zachowaniem POPRAWNYM, nie
   defektem — ale trzeba wiedzieć, który to przypadek).
5. **Każda zakładka osobno** — nie jeden zrzut na cały hub. Jeśli zakładka ma
   wewnętrzne pod-zakładki (np. `valuation` z 21 panelami), każdy panel osobno
   po uruchomieniu.
6. **Dowód realności — mutacja.** Wybierz JEDEN ekran z inwentarza (np.
   zakładkę `statements`), zepsuj coś widocznego w kodzie produkcyjnym (np.
   zmień etykietę kolumny albo warunek renderowania — **na kopii, cofasz przez
   `cp`, nigdy `git stash`**), zrób zrzut — pokaż, że **się zmienił**. Cofnij,
   zrób zrzut ponownie — pokaż, że wrócił do stanu z kroku 1. To jest dowód, że
   harness montuje REALNY komponent produkcyjny, nie atrapę wizualną.
7. Zapisz wszystkie zrzuty do `/private/tmp/cx-day265-finanse-zrzuty-artefakty` z `shasum -a 256`, nazwane wg
   wzorca `<ekran>-<stan>-<motyw>.png` (np. `finance-statements-full-light.png`).

## R4 — RAPORT + KATALOG ZRZUTÓW + TABELA (rdzeń)

Produkt dyżuru:

1. **Katalog zrzutów** w `/private/tmp/cx-day265-finanse-zrzuty-artefakty` — spis plików z `shasum -a 256`.
2. **Tabela**: ekran · stan (pusty/pełny) · jasność jasny/ciemny (dwie
   liczby) · co widać (jedno zdanie, konkretne) · czy podgląd w kadrze
   (tak-panel-boczny / tak-nakładka-4-zrzuty / nie dotyczy).
3. **Lista ekranów, których NIE dało się sfotografować, z powodem** —
   obowiązkowa nawet pusta. Powody uczciwe: flaga OFF bez query-override
   dostępnego w harnessie, atrapa o niezgodnym kształcie (`R2`), brak
   zamontowanej trasy, timeout wyniku mimo dwóch selektorów.
4. Sekcja „TWIERDZENIA NIEZWERYFIKOWANE” (obowiązkowa nawet pusta).
5. Sekcja „Korekty wobec instrukcji” (obowiązkowa nawet pusta).
6. Wynik `R2` (tabela zgodności kształtu atrapy) w całości, nie streszczony.

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (WĄSKO) | `dev-render/screens/finance-hub.tsx` — WYŁĄCZNIE rozszerzenie o brakujące stany/selektory wyniku wg `R3`, zero zmiany istniejącej logiki niezwiązanej ze zrzutami |
| Zapis (NOWE) | `scripts/dev/day265-finanse-zrzuty-werdykt.mjs` (nowy, wzorem `day233-finanse-panele-zrzuty-jasne.mjs`) · `scripts/dev/__tests__/day265-finanse-zrzuty-werdykt.test.mjs` (nowy, dowód mutacyjny narzędzia) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY265_FINANSE_ZRZUTY_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/Economics/FinanceHub.tsx` · `src/components/Finance/**` (21 paneli) · `src/components/standard/StandardPreview.tsx` · `src/routes/AppRoutes.tsx` · `src/utils/financeValuePanelsFlag.ts` · `server/src/middleware/v8FeatureGate.middleware.ts` |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md` · `docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md` · `docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` · `docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md` · `scripts/dev/day233-finanse-panele-zrzuty-jasne.mjs` · `scripts/dev/lib/checkScreenshotPairState.mjs` · `scripts/dev/lib/meanLuma.mjs` |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` · `docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **ZAKAZ NAPRAWIANIA.** Znajdziesz kolumnę „/”, panel bez danych albo
  atrapę o złym kształcie — **opisujesz, nie łatasz**. To dyżur dowodowy.
- ★★ **NIE ZMIENIASZ WARTOŚCI DOMYŚLNEJ ŻADNEJ FLAGI.** 25 z 26 ekranów
  Finansów jest OFF domyślnie i to jest zamierzone — nadpisujesz wyłącznie
  przez query string na czas zrzutu.
- ★★ **PARA JASNY/CIEMNY MUSI POKAZYWAĆ TEN SAM STAN** (`KSZTALT_19`) —
  różnica jasności powyżej progu NIE jest dowodem poprawności, jeśli obrazy
  przedstawiają dwa różne momenty programu. Użyj `checkScreenshotPairState`
  z wymogiem obecności wyniku, nie samej różnicy jasności.
- ★★ **ATRAPA MA MIEĆ KSZTAŁT SERWERA, NIE FRONTU** (`KSZTALT_21`) — sprawdź
  to dla KAŻDEGO ekranu przed zrzutem, nie tylko dla próbki. Zrzut z atrapy
  o złym kształcie jest FAŁSZYWYM dowodem, nie brakiem dowodu.
- ★ **DWA SELEKTORY WYNIKU, NIE JEDEN.** Jeden selektor przepuszcza zrzut, gdy
  drugiego jeszcze nie ma na ekranie.
- ★ **KAŻDA ZAKŁADKA OSOBNO.** Akcept jednej zakładki nie jest akceptem
  całego huba.
- ★ **ZRZUT PO CZASIE MODYFIKACJI, NIGDY PO NAZWIE KATALOGU** — jeśli
  regenerujesz zrzut, upewnij się, że raport wskazuje na NAJNOWSZY plik, nie
  na alfabetycznie pierwszy/ostatni.
- ★ **DOWÓD REALNOŚCI JEST OBOWIĄZKOWY** (`R3.6`) — bez mutacji kodu i dwóch
  zrzutów (przed/po) raport nie dowodzi, że harness montuje realny komponent.
- ★ **`Z13`:** zrzuty i logi NIE wchodzą do repo — leżą w `/private/tmp/cx-day265-finanse-zrzuty-artefakty`,
  raport podaje ścieżki i `shasum -a 256`.
- ★ **PUSZ WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE” JEST OBOWIĄZKOWA.** Brak tej
  sekcji jest podstawą odrzucenia dyżuru.
- ★★ **NIE SUMUJ „12 z 12” (podgląd w kadrze) i „0 z 20” (dowody wspominają
  o podglądzie)** — mierzą co innego, cytuj oba osobno z podpisem który jest
  który.
