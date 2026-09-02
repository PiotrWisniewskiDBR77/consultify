# INSTRUKCJA DYŻURU nr 267 — Codex — „★★ KOMPLET ZRZUTÓW MATERIAŁÓW POD WERDYKT WŁAŚCICIELA — z otwartym podglądem, I z jawnym zapisem, że pomiar jakości dokumentu/prezentacji z 1.09 (`docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md`) był wykonany BEZ klucza do modelu językowego, więc dokument/prezentacja NIE BYŁY oceniane — oceniane były ich awaryjne zastępniki. Arkusz (XLSX) DZIAŁA (100/100, deterministyczny silnik). Dokument (DOCX) był SŁABY, ale eksport zablokowany przez bramkę jakości. Prezentacja (PPTX) była NAJGORSZA (fałszywe „0 inicjatyw i 0 ryzyk” na slajdzie mimo realnych danych), a mimo to PRZESZŁA (99/100) — bramki jakości NIE SĄ spójne między formatami. Ten dyżur nie ocenia treści (zakaz), ale MUSI zapisać w każdej adnotacji, czy w środowisku zrzutu był dostępny klucz LLM, inaczej powtórzy dokładnie ten sam błąd atrybucji."

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
> **wyłącznie** `/private/tmp/cx-day267-materialy-zrzuty`.

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
Zakres: ****MODUŁ MATERIAŁY (`ReportsAndPresentationsHub.tsx`, route `/presentations`, menu pozycja `MODULE_PRESENTATIONS`).** Bramka „moduł zaakceptowany i zaczekpointowany” ma status NIEROZPOCZĘTY we wszystkich 16 kartach modułów (pomiar 1.09). Ten dyżur produkuje MATERIAŁ DO WERDYKTU: komplet zrzutów Materiałów (5 zakładek huba: `outputs_all`, `outputs_documents`, `presentations`, `outputs_sheets`, `templates` — jasny/ciemny, stan pusty/pełny, menu, kebab, **podgląd otwarty PO kliknięciu w wiersz**). Zero naprawiania.**.
Trasy front: ``src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx` (hub, 5 zakładek: `outputs_all`/`outputs_documents`/`presentations`/`outputs_sheets`/`templates`, route `/presentations`) · `src/components/standard/StandardPreview.tsx` · pliki zakładek z kanonicznym podglądem (5 z 6 plików `*TabContent.tsx`/`*GalleryView.tsx` importuje `StandardPreview` — `SheetsTabContent.tsx` NIE importuje, sprawdź osobno w `R1` czym renderuje podgląd) · **ŻADEN dev-render nie montuje pełnego `<ReportsAndPresentationsHub>` — zweryfikowane brakiem trafienia `grep -n "ReportsAndPresentationsHub" dev-render/main.tsx`** — istniejące fragmenty: `dev-render/screens/day235-materialy-dokumenty.tsx`, `day235-materialy-prezentacje.tsx`, `day235-materialy-excele.tsx`, `day235-materialy-architekt-szablonow.tsx`, `materials-registry.tsx`, `materialy-launcher.tsx`, `materialy-template-library-slice.tsx``. Trasy tył: `brak w zakresie zapisu — dyżur nie zmienia backendu; do zasilenia ekranów danymi używasz istniejących atrap dev-render (odczyt, ewentualna rozbudowa wg `R2`), nigdy nowego endpointu, i nigdy nie woła realnego modelu językowego (`Z15`)`.

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
WT=/private/tmp/cx-day267-materialy-zrzuty
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
git -C "$VAULT" worktree add "$WT" -b codex/day267-materialy-zrzuty-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day267-materialy-zrzuty/config.worktree"
cat "$VAULT/worktrees/cx-day267-materialy-zrzuty/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day267-materialy-zrzuty-scratch
mkdir -p /private/tmp/cx-day267-materialy-zrzuty-artefakty

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
git -C "$WT" push github-backup codex/day267-materialy-zrzuty-20260901
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

# (1) TEZA: ReportsAndPresentationsHub ma dokladnie 5 zakladek
grep -n "id: 'outputs_all'\|id: 'outputs_documents'\|id: 'presentations' as ModuleTab\|id: 'outputs_sheets'\|id: 'templates' as ModuleTab" src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx
#   oczekiwane: 5 trafien

# (2) TEZA: 5 z 6 plikow *TabContent/*GalleryView importuje StandardPreview; SheetsTabContent (zakladka outputs_sheets) — sprawdz osobno
grep -rl "StandardPreview" src/components/ReportsAndPresentations/*.tsx 2>/dev/null
grep -n "Preview" src/components/ReportsAndPresentations/SheetsTabContent.tsx | head -10
#   oczekiwane: 5 plikow w pierwszym grepie, SheetsTabContent NIE wsrod nich — drugi grep pokazuje CZYM faktycznie renderuje podglad

# (3) TEZA: zaden dev-render nie montuje pelnego ReportsAndPresentationsHub
grep -n "ReportsAndPresentationsHub" dev-render/main.tsx
#   oczekiwane: zero trafien

# (4) TEZA: istnieje co najmniej 7 fragmentow harnessu dla Materialow (realne czesci, nie pelny hub)
grep -c "'day235-materialy-\|'materials-registry'\|'materialy-launcher'\|'materialy-template-library-slice'" dev-render/main.tsx
#   oczekiwane: >= 7

# (5) TEZA (POMIAR 1.09): liczba szablonow Excel to 9, nie 8 (regex autora starszego pomiaru nie lapal cashflow12m)
grep -n "9.*nie 8\|cashflow12m" docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md
#   oczekiwane: cytat obecny doslownie

# (6) TEZA: pomiar trzech plikow 1.09 byl BEZ klucza LLM — dokument/prezentacja NIE byly oceniane, ocenione byly zastepniki awaryjne
grep -n "nie było klucza\|NIE BYŁY OCENIANE\|awaryjne zastępniki" docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md
#   oczekiwane: cytat obecny doslownie

# (7) TEZA: bramki jakosci sa niespojne miedzy formatami — dokument gorszy, ale to prezentacja przeszla
grep -n "eksport ZABLOKOWANY\|99/100.*PRZEPUSZCZONY\|Gorszy artefakt dostał wyższą" docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md
#   oczekiwane: cytat obecny

# (8) TEZA: StandardPreview.tsx nie ma zadnego pozycjonowania nakladkowego
grep -n "fixed\|absolute\|inset-0\|z-50\|z-\[" src/components/standard/StandardPreview.tsx
#   oczekiwane: zero trafien

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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day267-materialy-zrzuty-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6274`. Twój JEDYNY port harnessu to `5254 i 5255`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day267-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6269, 5010-5249, 6404-6411, 6600-6830. Twoje własne: baza 6274, harness 5254 i 5255. Cudze — siostrzane dyżury TEJ SAMEJ paczki (komplety zrzutów pod werdykt), nie dotykasz: baza 6270 harness 5250-5251 (dyżur 265 Finanse), baza 6272 harness 5252-5253 (dyżur 266 Wyniki), baza 6276 harness 5256-5257 (dyżur 268 Czat+Moja Praca), baza 6278 harness 5258-5259 (dyżur 269 Audyty+Narzędzia). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. `Z10` obowiązuje bez wyjątku — ten dyżur nie dotyka żadnej flagi funkcyjnej Materiałów.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY267_MATERIALY_ZRZUTY_REPORT.md`. Brak innych dokumentów do modyfikacji. Jedyny plik zapisu w repo to raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY267_MATERIALY_ZRZUTY_REPORT.md` plus (jeśli `R1` potwierdzi brak pełnego huba) nowy plik `dev-render/screens/day267-materialy-hub-zrzuty.tsx` i nowy skrypt `scripts/dev/day267-materialy-zrzuty-werdykt.mjs` — zero nowych dokumentów rejestrowych. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day267-materialy-zrzuty-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day267-materialy-zrzuty-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ NAPRAWIANIA CZEGOKOLWIEK** — cztery znane defekty z pomiaru 1.09 (synteza slajdu ignorująca źródła tekstowe, trwała blokada eksportu po pierwszym niepowodzeniu, kolizja klucza unikalnego, niespójność bramek jakości) zostają opisane, nie łatane. **ZAKAZ wołania jakiegokolwiek modelu językowego** (`Z15`) — żaden zrzut nie może zależeć od realnego wygenerowanego przez LLM dokumentu/prezentacji; jeśli harness tego wymaga, dokumentujesz stan „brak klucza” jako część dowodu, nie próbujesz go obejść. **ZAKAZ oceniania TREŚCI** dokumentu/prezentacji/arkusza (to zakres pomiaru `DOWOD_TRZY_PLIKI_2026-09-01.md`, nie tego dyżuru) — oceniasz WYŁĄCZNIE kompletność i uczciwość dowodu wizualnego. **ZAKAZ fotografowania spoza modułu Materiały.** | Zmierzone 1.09: bramka „moduł zaakceptowany i zaczekpointowany” ma status NIEROZPOCZĘTY we WSZYSTKICH 16 kartach modułów. Ten dyżur (jeden z pięciu — 265 Finanse, 266 Wyniki, 267 Materiały, 268 Czat+Moja Praca, 269 Audyty+Narzędzia) produkuje materiał do werdyktu. Reguła nienaruszalna z `CLAUDE.md` p.7: właściciel NIGDY nie jest pierwszym testerem wizualnym. Materiały mają dodatkowy powód pilności zapisany w Twoim własnym korpusie uwag: to jest moduł z NAJWIĘKSZĄ obawą właściciela dot. szablonów/dokumentów („nigdy nie powstał ani jeden naprawdę dobry dokument z szablonu; PPT nigdy”) — pomiar 1.09 (`DOWOD_TRZY_PLIKI_2026-09-01.md`) to potwierdza liczbowo (dokument słaby, prezentacja z fałszywym zdaniem na slajdzie mimo wysokiej oceny bramki), ale przyczyną była nieobecność klucza LLM w środowisku pomiaru, nie koniecznie generator. Zrzut bez adnotacji o kluczu LLM ryzykuje powtórzenie błędu atrybucji z tego samego pomiaru. |

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
cd /private/tmp/cx-day267-materialy-zrzuty

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day267-pg psql -U postgres -d cx267 \
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
cd /private/tmp/cx-day267-materialy-zrzuty

docker run -d --name cx-day267-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx267 \
  -p 127.0.0.1:6274:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day267-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6274/cx267 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6274/cx267 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day267-materialy-zrzuty && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6274/cx267 \
JWT_SECRET=cx267-test-secret-do-not-reuse \
npx vitest run scripts/dev/__tests__/day267-materialy-zrzuty-werdykt.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day267-materialy-zrzuty-artefakty/day267-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day267-materialy-zrzuty && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run scripts/dev/__tests__/day267-materialy-zrzuty-werdykt.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day267-materialy-zrzuty-artefakty/day267-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day267-materialy-zrzuty/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day267-pg psql -U postgres -d cx267 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day267-pg`.
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
> **(e) ★★ BEZ KLUCZA LLM DOKUMENT I PREZENTACJA NIE SĄ OCENIANE — OCENIANE SĄ ICH AWARYJNE ZASTĘPNIKI (`docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md` §3.3). Realne, nieudane wywołania (brak klucza → błąd → bezpiecznik się otwiera → „brak dostępnego modelu”) SĄ dowodem, że pomiar rozmawiał z prawdziwym kodem, nie atrapą — ale oznaczają też, że stan „pełny” dokumentu/prezentacji, który dziś sfotografujesz bez klucza, pokazuje ZASTĘPNIK AWARYJNY, nie prawdziwy wygenerowany dokument. **Arkusz (XLSX) NIE ma tego problemu** — silnik deterministyczny, nie zależy od LLM. Zapisz w KAŻDEJ adnotacji zrzutu dokumentu/prezentacji, czy w Twoim środowisku był dostępny klucz LLM (zgodnie z `Z15` — ten dyżur i tak nie wywołuje LLM, więc realistycznie zawsze będzie to „brak klucza” — właśnie dlatego musisz to zapisać wprost, żeby nikt nie odczytał zrzutu jako dowodu jakości treści). Druga pułapka: liczba szablonów Excel to **9, nie 8** — starszy pomiar miał regex `[a-zA-Z]*`, który nie łapie `cashflow12m` (cyfry w nazwie klucza); licz sam, nie przepisuj żadnej z tych dwóch liczb bez własnej weryfikacji.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day267-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day267-materialy-zrzuty-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (inwentarz ekranów Materiałów: 5 zakładek huba + generator/wizard + biblioteka szablonów, z klasyfikacją kanon/bespoke podglądu i potwierdzeniem braku pełnego huba w `dev-render`) · R2 (harness pełnego huba + kontrola kształtu atrapy `KSZTALT_21` + adnotacja obecności klucza LLM) · R3 (wykonanie kompletu zrzutów, `checkScreenshotPairState`, jasny/ciemny/pusty/pełny/każda zakładka osobno) · R4 (raport + katalog zrzutów + tabela + lista niefotografowalnych)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6274` albo `5254 i 5255` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6274` albo `5254 i 5255`** (`Z7`).

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
**NIEROZPOCZĘTY we wszystkich 16 kartach modułów**. Ten dyżur (jeden z pięciu
— 265 Finanse, 266 Wyniki, 267 Materiały, 268 Czat+Moja Praca, 269 Audyty+
Narzędzia) produkuje **MATERIAŁ DO WERDYKTU**: komplet zrzutów modułu
Materiały. **Nic więcej. Zero naprawiania.**

**Reguła nienaruszalna** (`CLAUDE.md` p.7): właściciel NIGDY nie jest
pierwszym testerem wizualnym.

## Dlaczego akurat Materiały mają dodatkową pilność

Materiały to moduł z **udokumentowaną, największą obawą właściciela**
dotyczącą szablonów i dokumentów: nigdy nie powstał dobry dokument z szablonu,
prezentacja — nigdy. Pomiar 1.09 (`docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md`,
streszczony w `docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md`
§3.2-3.3) to potwierdza liczbowo — ale z zastrzeżeniem, które MUSI wejść do
KAŻDEJ adnotacji zrzutu tego dyżuru:

**W środowisku pomiaru nie było klucza do żadnego modelu językowego.** Logi
pokazują realne, nieudane wywołania (brak klucza → błąd → bezpiecznik się
otwiera → „brak dostępnego modelu”) — to jest dowód, że pomiar rozmawiał z
prawdziwym kodem, nie atrapą. Ale oznacza też:

> **Dokument i prezentacja NIE BYŁY oceniane — oceniane były ich awaryjne
> zastępniki.**

| Format | Wynik pomiaru 1.09 | Zależność od LLM |
| --- | --- | --- |
| Arkusz (XLSX) | DZIAŁA, 100/100, formuły sprawdzone | **BRAK** — silnik deterministyczny |
| Dokument (DOCX) | Słaby (432 słowa, 0 zdań z konkretem, 18 wypełniaczy) — eksport ZABLOKOWANY przez bramkę jakości, plik powstał dopiero po świadomym obejściu | zależny od LLM |
| Prezentacja (PPTX) | Najgorsza (fałszywe „0 inicjatyw i 0 ryzyk” na slajdzie mimo realnych danych) — mimo to 99/100, eksport PRZEPUSZCZONY | zależny od LLM |

**Werdykt do zapamiętania**: dokument był słabszy niż prezentacja treściowo,
ale to prezentacja przeszła bramkę — **bramki jakości nie są spójne między
formatami**. Ten dyżur nie ocenia treści (poza zakresem, zakaz), ale **każdy
zrzut dokumentu lub prezentacji w stanie „pełny” musi nieść adnotację, czy w
środowisku zrzutu był dostępny klucz LLM** — bez tego zrzut ryzykuje
powtórzenie DOKŁADNIE tego samego błędu atrybucji, który pomiar 1.09 już raz
naprawił nazwaniem go wprost.

## Trzeci element kanonu list — PODGLĄD — nigdy niesfotografowany

Jak w pozostałych czterech dyżurach tej paczki. Reguła WSPÓLNA: dwa zrzuty
PO KLIKNIĘCIU w wiersz, cztery TYLKO przy mechanicznie potwierdzonej nakładce.

## Braki harnessu — zmierzone, nie założone

`grep -n "ReportsAndPresentationsHub" dev-render/main.tsx` daje **zero
trafień** — jak w Wynikach (266), żaden istniejący fragment dev-render
(`day235-materialy-dokumenty`, `day235-materialy-prezentacje`,
`day235-materialy-excele`, `day235-materialy-architekt-szablonow`,
`materials-registry`, `materialy-launcher`, `materialy-template-library-slice`)
nie montuje pełnego huba z pięcioma zakładkami naraz. `R1`/`R2` mają
potwierdzić i zamknąć tę lukę.

**Druga miara do zweryfikowania samodzielnie**: liczba szablonów Excel to
**9, nie 8** (pomiar 1.09 obalił starszą liczbę — regex `[a-zA-Z]*` nie łapał
`cashflow12m`, nazwy klucza z cyframi). Nie przepisuj żadnej z dwóch liczb bez
własnego przeliczenia.

## Co ten dyżur świadomie NIE robi

- **Nie naprawia** czterech znanych defektów z pomiaru 1.09 (synteza slajdu,
  trwała blokada eksportu, kolizja klucza unikalnego, niespójność bramek) —
  opisuje, nie łata.
- **Nie wywołuje modelu językowego** (`Z15`) — żaden zrzut nie zależy od
  realnie wygenerowanej treści LLM.
- **Nie ocenia treści** żadnego dokumentu/prezentacji/arkusza.
- **Nie fotografuje innych modułów.**

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | `ReportsAndPresentationsHub.tsx` ma dokładnie 5 zakładek | komenda (1) |
| T2 | 5 z 6 plików zakładek importuje `StandardPreview`; `SheetsTabContent.tsx` (zakładka `outputs_sheets`) NIE — sprawdź czym renderuje podgląd | komenda (2) |
| T3 | Żaden dev-render nie montuje pełnego huba naraz | komenda (3) |
| T4 | Istnieje co najmniej 7 fragmentów harnessu z realnymi częściami Materiałów | komenda (4) |
| T5 | Szablonów Excel jest 9, nie 8 (starszy pomiar obalony regexem) | komenda (5) |
| T6 | Pomiar 1.09 był BEZ klucza LLM — dokument/prezentacja NIE były oceniane, oceniane były zastępniki awaryjne | komenda (6) |
| T7 | Bramki jakości nie są spójne między formatami (dokument gorszy, ale przeszła prezentacja) | komenda (7) |
| T8 | `StandardPreview.tsx` nie ma pozycjonowania nakładkowego | komenda (8) |
| T9 | Miejsce na dysku wystarcza | komenda (9) |

---

# 3. POZYCJE DYŻURU

## R1 — INWENTARZ EKRANÓW MATERIAŁÓW (rdzeń, pomiarowy)

1. Dla każdej z 5 zakładek: kanon (`StandardTable`+`StandardPreview`) czy
   bespoke. **Osobno rozstrzygnij `outputs_sheets`** — komenda (2) już
   pokazuje, że `SheetsTabContent.tsx` nie importuje `StandardPreview`; ustal
   CZYM renderuje szczegóły wiersza (może to być nakładka — sprawdź
   mechanicznie, nie zakładaj z nazwy modułu, dokładnie ostrzeżenie z
   `ZNALEZISKO_PODGLAD` §e).
2. Zlokalizuj generator/wizard dokumentu i prezentacji (kreator, kroki) —
   to są ekrany-workspace, nie lista, fotografuj jak artefakt (jasny/ciemny/
   każdy krok osobno), nie jak wiersz z podglądem.
3. Policz realną liczbę szablonów Excel (nie przepisuj „9” z tej instrukcji
   bez własnego przeliczenia — metoda w komendzie (5) i w
   `CODEX_DAY235_MATERIALY_REPORT.md`).
4. Zbuduj tabelę **ekran × typ × stan pusty/pełny × jasny/ciemny × podgląd w
   kadrze × wymaga klucza LLM (tak/nie)**.

## R2 — HARNESS PEŁNEGO HUBA + KONTROLA KSZTAŁTU ATRAPY (rdzeń, dowodowy)

1. Napisz `dev-render/screens/day267-materialy-hub-zrzuty.tsx`, montujący
   **REALNY `<ReportsAndPresentationsHub>`**, z `&tab=` dla wszystkich 5
   zakładek i `&state=ready|empty|loading|error`, wzorem `finance-hub` (265).
   Zarejestruj go w `dev-render/main.tsx` — **wyłącznie DOPISANIEM** jednego
   lazy importu i jednego wpisu klucza na końcu listy, zero zmiany
   istniejących wpisów. **Uruchom `scripts/dev/check-devrender-main.sh` i
   wklej pełny wynik do raportu** — zielony wynik jest warunkiem przejścia
   do `R3`.
2. **Kontrola kształtu atrapy (`KSZTALT_21`)**: porównaj nazwy pól atrapy z
   realnym kontraktem backendu dla `outputs`/`presentations`/`templates`
   (zlokalizuj trasy, zapisz `plik:linia` obu stron). Różnica = zrzut nie
   wchodzi do kompletu bez adnotacji blokującej.
3. **Adnotacja klucza LLM obowiązkowa dla generatora dokumentu/prezentacji**:
   potwierdź (analogicznie do `§0.2b`/`Z15` tej instrukcji), że środowisko
   zrzutu NIE MA klucza LLM, i zapisz to w raporcie dosłownie, przy KAŻDYM
   zrzucie stanu „pełny” dokumentu/prezentacji — jednym zdaniem, np. „Zrzut
   pokazuje awaryjny zastępnik po niepowodzeniu wywołania LLM (brak klucza w
   środowisku), nie realnie wygenerowaną treść”.
4. Dowód mutacyjny narzędzia: zepsuj coś widocznego w kodzie huba (na kopii),
   pokaż zmianę w zrzucie, cofnij.

## R3 — WYKONANIE KOMPLETU ZRZUTÓW (rdzeń, dowodowy)

1. Klik→zrzut dla zakładek listowych — dwa zrzuty standardowo, cztery tylko
   przy mechanicznie potwierdzonej nakładce (w tym ewentualnie
   `outputs_sheets`, per `R1.1`).
2. Dwa selektory wyniku dla ekranów z generowaniem asynchronicznym.
3. `checkScreenshotPairState` z wymogiem obecności wyniku.
4. Stan pusty i pełny osobno; dla „pełny” dokumentu/prezentacji — adnotacja
   klucza LLM z `R2.3` obowiązkowa w nazwie pliku i w tabeli `R4`
   (`...-full-light-noLLMkey.png`).
5. Arkusz (XLSX) fotografuj też w stanie „pełny” — to jedyny format, gdzie
   stan pełny NIE zależy od LLM, więc jest to jedyny prawdziwie „dobry wynik”
   możliwy do pokazania bez zastrzeżenia.
6. Każda zakładka osobno.
7. Dowód realności: mutacja + cofnięcie na jednym ekranie.
8. Zapisz do `/private/tmp/cx-day267-materialy-zrzuty-artefakty` z `shasum -a 256`.

## R4 — RAPORT + KATALOG ZRZUTÓW + TABELA (rdzeń)

Katalog zrzutów, tabela ekran/stan/jasność×2/opis/podgląd-w-kadrze/wymaga-
klucza-LLM, lista niefotografowalnych z powodem, „Twierdzenia
niezweryfikowane” (obowiązkowa nawet pusta), „Korekty wobec instrukcji”
(obowiązkowa nawet pusta), wynik `R2.2` (zgodność kształtu atrapy) w całości.

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (NOWE) | `dev-render/screens/day267-materialy-hub-zrzuty.tsx` (nowy) · `scripts/dev/day267-materialy-zrzuty-werdykt.mjs` (nowy) · `scripts/dev/__tests__/day267-materialy-zrzuty-werdykt.test.mjs` (nowy) |
| Zapis (WĄSKO) | `dev-render/main.tsx` — WYŁĄCZNIE dopisanie jednego lazy importu + jednego wpisu klucza na końcu listy, zero zmiany/usunięcia istniejących wpisów; `scripts/dev/check-devrender-main.sh` obowiązkowy po zmianie |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY267_MATERIALY_ZRZUTY_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/ReportsAndPresentations/**` · `src/components/standard/StandardPreview.tsx` · `src/routes/AppRoutes.tsx` |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md` · `docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md` · `docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` · `docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md` · `docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md` · `scripts/dev/lib/checkScreenshotPairState.mjs` · `scripts/dev/lib/meanLuma.mjs` |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` · `docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **ZAKAZ NAPRAWIANIA CZEGOKOLWIEK.**
- ★★ **ZAKAZ WOŁANIA MODELU JĘZYKOWEGO** (`Z15`) — potwierdź brak klucza w
  środowisku PRZED zrzutami stanu „pełny” dokumentu/prezentacji.
- ★★ **KAŻDY ZRZUT „PEŁNY” DOKUMENTU/PREZENTACJI NIESIE ADNOTACJĘ „ZASTĘPNIK
  AWARYJNY, BRAK KLUCZA LLM”** — bez tego zrzut jest fałszywym dowodem
  jakości treści, dokładnie jak w pomiarze 1.09 przed sprostowaniem.
- ★★ **PARA JASNY/CIEMNY MUSI POKAZYWAĆ TEN SAM STAN** (`KSZTALT_19`).
- ★★ **ATRAPA MA MIEĆ KSZTAŁT SERWERA, NIE FRONTU** (`KSZTALT_21`).
- ★ **NIE PRZEPISUJ LICZBY SZABLONÓW BEZ WŁASNEGO PRZELICZENIA** — 8 vs 9 to
  różnica jednego regexu.
- ★ **DWA SELEKTORY WYNIKU DLA EKRANÓW ASYNCHRONICZNYCH.**
- ★ **KAŻDA ZAKŁADKA OSOBNO.**
- ★ **DOWÓD REALNOŚCI OBOWIĄZKOWY.**
- ★ **`scripts/dev/check-devrender-main.sh` OBOWIĄZKOWY PO KAŻDEJ ZMIANIE
  `dev-render/main.tsx`.**
- ★ **`Z13`:** zrzuty i logi w `/private/tmp/cx-day267-materialy-zrzuty-artefakty`, nie w repo.
- ★ **PUSZ WYŁĄCZNIE NA `github-backup`.**
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE” OBOWIĄZKOWA.**
