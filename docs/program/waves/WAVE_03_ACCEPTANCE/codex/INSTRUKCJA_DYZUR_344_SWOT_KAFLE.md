# INSTRUKCJA DYŻURU nr 344 — Codex — „SWOT — kafle etapów i plakietka gotowości sesji są warstwą BEZ KONSUMENTA: siedzą w gałęzi, do której dynamic-swot nigdy nie wchodzi; podłączyć je do realnego renderu i policzyć z uchwytu DOM, a nie ze zrzutu"

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
> **wyłącznie** `/private/tmp/cx-day344-swot-kafle`.

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
Zakres: **Narzędzia (Discovery Tools) — sesja Dynamic SWOT: kafle etapów, plakietka gotowości sesji, panel kontekstu narzędzia**.
Trasy front: `/tools → sesja Dynamic SWOT (`src/components/DiscoveryTools/ToolDocumentView.tsx`), panel kontekstu (`src/components/DiscoveryTools/ToolContextPanel.tsx`), liczenie gotowości (`src/components/DiscoveryTools/toolCompletion.ts`), paczka (`src/toolPacks/packs/dynamicSwot.pack.ts`), flaga (`src/utils/dynamicSwotSevenStagesFlag.ts`), harness `dev-render/screens/tools-swot-session-workspace.tsx``. Trasy tył: ``server/src/routes/tools*` wyłącznie do ODCZYTU — dyżur jest frontowy; PostgreSQL służy migracjom, dowodowi `Z30` i ewentualnemu uruchomieniu runtime'u do zrzutów`.

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
WT=/private/tmp/cx-day344-swot-kafle
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
git -C "$VAULT" worktree add "$WT" -b codex/day344-swot-kafle-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day344-swot-kafle/config.worktree"
cat "$VAULT/worktrees/cx-day344-swot-kafle/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day344-swot-kafle-scratch
mkdir -p /private/tmp/cx-day344-swot-kafle-artefakty

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
git -C "$WT" push github-backup codex/day344-swot-kafle-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 6a4919f72d..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziewięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day344-swot-kafle

# (1) ★ TEZA: uchwyt kafla istnieje w DOKLADNIE JEDNYM miejscu w calym repo
grep -rn 'dynamic-swot-phase-tile' src/ dev-render/ tests/
#   oczekiwane: DOKLADNIE JEDNO trafienie — ToolDocumentView.tsx ok. 1188 (atrybut `data-testid`).
#   Zero testow, zero ekranow harnessu. Nikt tego nigdy nie zmierzyl.

# (2) ★ TEZA: kafle siedza w `workSection`, a `workSection` idzie TYLKO do `defaultSections`
grep -n 'workSection\|defaultSections\|isStrategicPhaseTool' src/components/DiscoveryTools/ToolDocumentView.tsx
#   oczekiwane: `workSection` deklarowany ok. 1115 i uzyty ok. 1931 (wewnatrz `defaultSections` ok. 1926);
#   `isStrategicPhaseTool` ok. 304 i wczesniejszy powrot ok. 1722. To jest cala przyczyna „0 kafli".

# (3) TEZA: `dynamic-swot` jest na liscie narzedzi fazowych
sed -n '304,311p' src/components/DiscoveryTools/ToolDocumentView.tsx
#   oczekiwane: tablica z 'dynamic-swot', 'market-forces', 'growth-paths', 'portfolio-priority', 'risk-uncertainty'

# (4) ★ TEZA: plakietka gotowosci ma ZERO osiagalnych konsumentow
grep -rn 'computeDynamicSwotOverallReadiness' src/ tests/
#   oczekiwane: definicja w toolCompletion.ts ok. 229; uzycia w ToolContextPanel.tsx ok. 89
#   oraz w ToolDocumentView.tsx ok. 533 (zmienna `dynamicSwotReadiness`).
#   Nastepnie sprawdz, gdzie `dynamicSwotReadiness` jest RENDEROWANY — moja teza: wylacznie
#   wewnatrz `workSection` ok. 1135, czyli w tej samej martwej galezi.

# (5) ★ TEZA: `ToolContextPanel` jest dla dynamic-swot wykluczony JAWNYM warunkiem, w OBU galeziach
grep -n "toolType === 'dynamic-swot'" src/components/DiscoveryTools/ToolDocumentView.tsx
#   oczekiwane: m.in. dwa warunki postaci `toolType === 'dynamic-swot' ? [] : [ { id: 'ai-collaboration' … } ]`
#   — jeden ok. 1911 (galaz fazowa), drugi ok. 2054 (galaz domyslna). To jest DECYZJA W KODZIE, nie brak przewodu.

# (6) TEZA: flaga siedmiu etapow jest zastana, statyczna i domyslnie OFF
cat src/utils/dynamicSwotSevenStagesFlag.ts
#   oczekiwane: `import.meta.env.VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES` (dostep STATYCZNY — dyzur 341
#   zmierzyl, ze zapis obliczony `import.meta.env[KLUCZ]` NIE jest podstawiany przez Vite) + brak zmiennej = OFF

# (7) ★ TEZA: aktywny kafel lamie kanon crimsona
grep -n 'border-primary-300\|bg-primary-500' src/components/DiscoveryTools/ToolDocumentView.tsx
#   oczekiwane: trafienie ok. 1195 w klasie aktywnego kafla. `primary` w tailwindzie tego repo
#   to crimson #85182F, zarezerwowany dla semantyki krytycznej (CLAUDE.md §3).

# (8) TEZA: liscie i18n
node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'
#   oczekiwane: 35198 33065 — te liczby NIE MOGA zmalec

# (9) zasoby wolne
df -h /
lsof -nP -iTCP:6391 -sTCP:LISTEN; lsof -nP -iTCP:5531 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep cx-day344 || echo 'brak kontenera'
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day344-swot-kafle-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6391`. Twój JEDYNY port harnessu to `5531`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day344-pg`**. **ZAKAZANE:** `5530, 5532, 5533 (runtime dyżurów 343, 345 i 346), 6390, 6392, 6393 (bazy dyżurów 343, 345 i 346), 5432 (cudzy nasłuch na hoście), a także wszystkie porty dyżurów 347-350, które inny autor wydaje równolegle w tej samej serii`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNA — dyżur nie zakłada ani jednej NOWEJ flagi. Pracuje wyłącznie na zastanej `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES` (dodanej przez dyżur 341), której WARTOŚĆ DOMYŚLNA POZOSTAJE OFF I NIE WOLNO JEJ ZMIENIĆ`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/resultsInternalBetaVisibility.middleware.ts`, `server/src/middleware/appErrorMapper.ts`, `src/services/api.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY344_SWOT_KAFLE_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS/MODULE_ACCEPTANCE.md` (istnieje na markerze; wyłącznie AKTUALIZACJA zastanego wiersza `R-20` dotkniętego przez dyżur 341 i ewentualne dopisanie NOWEGO wiersza dla kafli — zakaz kasowania i przeredagowywania pozostałych wierszy, `Z32`).. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day344-swot-kafle-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day344-swot-kafle-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ ZAKAZ ZAPISANIA W JAKIMKOLWIEK DOKUMENCIE ZDANIA „kafle mają 7 etapów" (ani żadnego jego wariantu) BEZ ZAŁĄCZONEJ LICZBY Z UCHWYTU DOM. Deskryptor deklarujący siedem faz nie jest dowodem, że siedem kafli się renderuje — na markerze renderuje się ZERO. ★★ ZAKAZ ZMIANY WARTOŚCI DOMYŚLNEJ flagi `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES` na ON. ★★ ZAKAZ USUWANIA `workSection`, `computeDynamicSwotOverallReadiness` ani wykluczenia `ai-collaboration` bez jawnego wpisu, czym je zastąpiłeś — „naprawa przez skasowanie martwego kodu" zamyka pomiar i kasuje funkcję, której właściciel nie widział ani razu. ★★ ZAKAZ crimsona poza semantyką krytyczną: aktywny kafel używa dziś `border-primary-300` i `bg-primary-500/10`, a `primary` w tym repo to crimson #85182F — to jest naruszenie kanonu do naprawienia w `R4`, nie wzór do powielenia. | Dyżur 341 (scalony) podłączył LEWE DRZEWO sesji SWOT i to jest prawdziwy efekt: OFF 5 etapów, ON 7 (`Rekomendacje`, `Przegląd` w grupie REZULTATY), potwierdzone na kadrach. Odbiór adwersaryjny 04.09 obalił jednak drugą połowę tezy: kafli `dynamic-swot-phase-tile` jest w DOM ZERO przy fladze ON, po rozwinięciu wszystkich akordeonów i kliknięciu każdego celu nawigacji. Bez tego zakazu następny raport znów przepisze liczbę z deskryptora zamiast ją zmierzyć — a to jest dokładnie ten sposób, w jaki „gotowe" powstaje bez produktu. Kanon crimsona: `CLAUDE.md` §3 i §6. |

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
cd /private/tmp/cx-day344-swot-kafle

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day344-pg psql -U postgres -d cx344 \
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
cd /private/tmp/cx-day344-swot-kafle

docker run -d --name cx-day344-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx344 \
  -p 127.0.0.1:6391:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day344-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6391/cx344 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6391/cx344 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day344-swot-kafle && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6391/cx344 \
JWT_SECRET=cx344-test-secret-do-not-reuse \
npx vitest run src/toolPacks/__tests__ tests/unit/tools --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day344-swot-kafle-artefakty/day344-swot.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day344-swot-kafle && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/toolPacks/__tests__ tests/unit/tools --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day344-swot-kafle-artefakty/day344-swot.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day344-swot-kafle/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day344-pg psql -U postgres -d cx344 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day344-pg`.
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
> **(e) PRZYRZĄD DO URUCHAMIANIA RUNTIME'U ODRZUCA PRZYDZIELONĄ NAZWĘ BAZY. Dyżur 341 zmierzył, że `scripts/dev/start-wave3-owner-runtime.mjs` dopuszcza wyłącznie rodzinę nazw `consultify_w3_*` i odrzuca `cx341`; dla `cx344` będzie tak samo. To NIE jest powód do STOP-u ani do wzięcia cudzego portu: warstwę wizualną robisz w kanonicznym `dev-render` na porcie 5531, a realny HTTP/PostgreSQL zostaje osobnym dowodem. Druga pułapka, właściwa temu modułowi: kafle i plakietka siedzą w zmiennej `workSection`, a `workSection` wchodzi WYŁĄCZNIE do `defaultSections` — dla `dynamic-swot` funkcja sekcji wraca wcześniej z gałęzi `isStrategicPhaseTool`. Selektor kafli zwróci więc `0` niezależnie od tego, ile akordeonów rozwiniesz, i `0` JEST WYNIKIEM, a nie awarią pomiaru. Trzecia: panel `ToolContextPanel` jest dla `dynamic-swot` wykluczany JAWNYM warunkiem w OBU gałęziach — to nie jest przeoczenie przewodu, tylko decyzja zapisana w kodzie, i musisz ją nazwać, zanim ją zmienisz**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day344-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day344-swot-kafle-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1, R2, R3`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6391` albo `5531` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6391` albo `5531`** (`Z7`).

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

Sesja Dynamic SWOT jest jednym z narzędzi, które właściciel ogląda najczęściej. Dyżur 341 (scalony
jako `937f2d3193`) zrobił rzecz prawdziwą: **podłączył lewe drzewo sesji**. Przy fladze
`VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES` wyłączonej drzewo pokazuje **pięć** etapów
(`mission, input, swot, insights, outputs`), przy włączonej **siedem** — dochodzą `recommendations`
i `review` w grupie REZULTATY. To zostało zmierzone na prawdziwym bundlu Vite i widać to na
kadrach. Ten dyżur tego nie rusza.

### Czego dyżur 341 NIE zrobił, choć raport brzmiał, jakby zrobił

Odbiór adwersaryjny 04.09 zmierzył drugą powierzchnię tego samego szwu i obalił tezę:

> **Kafli etapów `[data-testid="dynamic-swot-phase-tile"]` jest w DOM ZERO przy fladze ON** — po
> rozwinięciu wszystkich akordeonów i po kliknięciu każdego celu nawigacji.

To nie jest kwestia kadru ani przewijania. **Przyczyna jest strukturalna i widać ją w kodzie:**

1. Kafle (`data-testid="dynamic-swot-phase-tile"`, ok. linii 1188) oraz plakietka gotowości sesji
   (ok. linii 1135) siedzą wewnątrz zmiennej `workSection`
   (`src/components/DiscoveryTools/ToolDocumentView.tsx`, deklaracja ok. 1115).
2. `workSection` jest użyty **dokładnie raz** — jako `component` sekcji `work` w tablicy
   `defaultSections` (ok. 1926-1931).
3. Dla `dynamic-swot` funkcja budująca sekcje **nigdy nie dochodzi do `defaultSections`**: wraca
   wcześniej z gałęzi `if (isStrategicPhaseTool) { … return […] as NModeSection[]; }` (warunek
   ok. 304-310, wejście w gałąź ok. 1722, `return` ok. 1922).

**Siedem kafli, o których mówi raport 341, to warstwa 1-2 bez konsumenta.** Deskryptor deklaruje
siedem faz — i to jest prawda. Kafle renderują zero — i to też jest prawda. Raport zmierzył
deskryptor i opisał nim ekran.

### To samo dotyczy plakietki gotowości sesji

`computeDynamicSwotOverallReadiness` (`src/components/DiscoveryTools/toolCompletion.ts` ok. 229)
ma w całym `src/` dwa wywołania:

- `ToolDocumentView.tsx` ok. 533 → zmienna `dynamicSwotReadiness`, renderowana **wyłącznie wewnątrz
  `workSection`** (ok. 1135) — czyli w tej samej martwej gałęzi;
- `ToolContextPanel.tsx` ok. 89 → ale **`ToolContextPanel` jest dla `dynamic-swot` wykluczony
  jawnym warunkiem**, w OBU gałęziach budowania sekcji: `toolType === 'dynamic-swot' ? [] : [ { id:
  'ai-collaboration', … } ]` (ok. 1911 w gałęzi fazowej i ok. 2054 w gałęzi domyślnej).

**Wniosek autora instrukcji, do sprawdzenia przez Ciebie: funkcja `computeDynamicSwotOverallReadiness`
nie ma dziś ANI JEDNEGO osiągalnego konsumenta.** Liczy się, kosztuje, i nikt jej wyniku nie widzi.

### Trzy rzeczy, które to zlecenie mówiło inaczej, niż pokazał mój pomiar

1. **„`ToolContextPanel` — zastany defekt”.** Panel **nie jest martwy w produkcie**: dla wszystkich
   pozostałych narzędzi (`market-forces`, `growth-paths`, `portfolio-priority`,
   `risk-uncertainty`, narzędzia niefazowe) sekcja `ai-collaboration` jest budowana i panel się
   renderuje. Dla `dynamic-swot` jest **jawnie wykluczony warunkiem w kodzie**. To jest różnica
   między „ktoś zapomniał przewodu” a „ktoś podjął decyzję i jej nie opisał”. **Zanim cokolwiek
   zmienisz, nazwij tę decyzję i sprawdź, czy ma uzasadnienie** — patrz `R3`.
2. **„Zastany defekt, nie wina dyżuru 341”.** Zgadza się co do winy i **potwierdzam to jako fakt**:
   gałąź `isStrategicPhaseTool` i wykluczenie panelu są starsze niż 341. Ale to nie zwalnia z
   naprawy — właściciel widzi ekran, nie historię commitów.
3. **Liczba kolumn siatki kafli.** Raport 341 mówi o siatce „twardo pięciokolumnowej”
   (`xl:grid-cols-5`), a na markerze klasa brzmi `grid gap-3 sm:grid-cols-2 xl:grid-cols-4`.
   **Zmierz sam** i podaj swoją wartość — przy siedmiu kaflach siatka ma być elastyczna, nie
   przybita do żadnej liczby.

## ★ Zdanie, którego NIE WOLNO zapisać w rejestrze

> **„kafle mają 7 etapów”**

— ani żaden jego wariant, **bez załączonej liczby z uchwytu DOM**. Deskryptor paczki może
deklarować siedem faz i deklaruje; kafli renderuje się na markerze **zero**. To jest ten sam
kształt fałszywego „gotowe”, który kosztował ten program najwięcej: **wołacz istnieje ≠ komponent
się renderuje**. Warstw jest cztery — deskryptor, przewód, montaż, kadr — i zielona jest dopiero
ostatnia.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

## ★ Zmierz moje liczby sam

Twierdzę: uchwyt `dynamic-swot-phase-tile` ma w całym repo **1** wystąpienie (sam atrybut, zero
testów, zero ekranów harnessu); `workSection` ma **1** użycie; gałąź `isStrategicPhaseTool` wraca
**przed** `defaultSections`; kafli w DOM przy fladze ON jest **0**;
`computeDynamicSwotOverallReadiness` ma **2** wywołania i **0** osiągalnych konsumentów;
wykluczeń `ai-collaboration` dla `dynamic-swot` są **2**; siatka kafli ma dziś klasę
`xl:grid-cols-4`; etapów w drzewie jest **5** przy OFF i **7** przy ON; liście
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
| **komponent (rdzeń dyżuru)** | `src/components/DiscoveryTools/ToolDocumentView.tsx` | **★ PEŁNA LICENCJA — WYŁĄCZNIE w zakresie: (a) udostępnienia kafli etapów i plakietki gotowości gałęzi `isStrategicPhaseTool`; (b) rozstrzygnięcia losu sekcji `ai-collaboration` dla `dynamic-swot` z `R3`; (c) siatki kafli i klas kafla z `R4`.** ZAKAZ jakiejkolwiek innej zmiany w tym pliku, w szczególności ZAKAZ ruszania deskryptorów faz i licznika kroku, które podłączył dyżur 341 | Gotowy diff w bloku kodu, **nienałożony**, + brief: promień rażenia, ile typów narzędzi dotyka, co widzi właściciel przed i po |
| **liczenie gotowości** | `src/components/DiscoveryTools/toolCompletion.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zmiany ADDYTYWNE** (nowa funkcja pomocnicza, nowy eksport). **ZAKAZ zmiany zachowania `computeDynamicSwotPhaseSummaries` i `computeDynamicSwotOverallReadiness`** — one liczą poprawnie, problem jest w tym, że nikt ich wyniku nie renderuje | Gotowy diff nienałożony + brief |
| **panel kontekstu** | `src/components/DiscoveryTools/ToolContextPanel.tsx` | **TYLKO ODCZYT.** Panel działa dla pozostałych narzędzi; ten dyżur rozstrzyga wyłącznie, czy `dynamic-swot` ma go dostać — a to jest zmiana po stronie **wołającego**, nie panelu | Opis w raporcie z dowodem plik:linia + gotowy diff nienałożony |
| **paczka narzędzia** | `src/toolPacks/packs/dynamicSwot.pack.ts` | **TYLKO ODCZYT** — deskryptor siedmiu faz jest źródłem prawdy podłączonym przez dyżur 341 i jest poprawny. Kafle mają go KONSUMOWAĆ, nie duplikować | Errata w raporcie |
| **flaga** | `src/utils/dynamicSwotSevenStagesFlag.ts` | **TYLKO ODCZYT.** Dostęp do `import.meta.env` jest już statyczny (naprawa dyżuru 341) i **wartość domyślna OFF nie może się zmienić** (`Z10`, `Z11`, `Z40`) | Errata w raporcie |
| **magazyn** | `src/store/useToolStore.ts` | **TYLKO ODCZYT** — dotknięty przez dyżur 341, szew działa | Opis w raporcie + gotowy diff nienałożony |
| **powłoka N** | `src/components/shared/NModeLayout/**` | **TYLKO ODCZYT — PLIK PRZEKROJOWY.** Powłoka niesie uchwyty `data-nmode-section-item` / `data-nmode-section-group`, którymi mierzysz drzewo, i obsługuje wszystkie moduły | **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT DLA DYŻURU 344 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`, + brief: plik:linia · promień rażenia · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **walidator (NOWE pliki)** | `tests/unit/tools/**`, `src/toolPacks/__tests__/**` | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31`. **★ NOWE PLIKI TESTOWE KŁADZIESZ W `tests/`, NIGDY POD `src/`** — plik testowy pod `src/` czerwieni bezpiecznik osiągalności (zdarzyło się 04.09 trzy razy, naprawiane commitem `6a4919f72d`, który jest markerem tego dyżuru). **Wyjątek: `src/toolPacks/__tests__/` jest na markerze ZASTANE i widziane przez bezpiecznik — dopisujesz tam wyłącznie przypadki do PLIKÓW, KTÓRE JUŻ ISTNIEJĄ; każdy NOWY plik testowy idzie do `tests/`.** `git add -f` obowiązkowo | — |
| **walidator (ZASTANE)** | `src/toolPacks/__tests__/dynamicSwotRuntimeWiring.test.ts`, `dynamicSwotSevenStagesFlag.test.ts`, `tests/e2e/tools/swot-real-pg-resume.spec.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisywanie NOWYCH przypadków `it(...)`.** Zakaz zmiany i osłabiania istniejących asercji, zakaz obniżania progów (`Z40`) | Nowy plik testowy obok, w `tests/`, z nagłówkiem `// KONTRAKT DYŻURU 344` |
| **przyrząd** | `dev-render/screens/tools-swot-session-workspace.tsx`, `dev-render/screens/tools-swot-*.tsx`, `dev-render/main.tsx` | **★ PEŁNA LICENCJA** — to jest harness, nie produkt. Ten ekran montuje realny `DiscoveryToolsHub` (potwierdzone w raporcie dyżuru 341) i jest właściwym miejscem pomiaru. **Host harnessu nie jest produktem**; kontrolki harnessu nie mogą wejść w kadr | — |
| **narzędzie zrzutów** | `scripts/dev/grafika-zrzuty.mjs` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zmiany ADDYTYWNE i OPT-IN** (nowy parametr, domyślnie wyłączony). **ZAKAZ zmiany zachowania domyślnego.** **ZAKAZ pisania własnego skryptu zrzutowego obok kanonicznego** — doraźny skrypt obok kanonicznego dał już raz parę identycznych obrazów i meldunek sukcesu | Opis brakującej zdolności w raporcie + gotowy diff |
| **przyrząd runtime** | `scripts/dev/start-wave3-owner-runtime.mjs` | **TYLKO ODCZYT.** Odrzuca nazwy baz spoza rodziny `consultify_w3_*` — to jest znane i **nie jest powodem do STOP-u** ani do wzięcia cudzego portu | Opis w raporcie: co blokuje pomiar i jak go wykonałeś zamiast tego. Pozycja jest **ZROBIONA** z takim opisem |
| **i18n** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości. **Liczba liści nie może zmaleć** (35198 / 33065). ★ Klucz w `pl` trzymający angielskie słowo NIE jest przetłumaczony | — |
| **odbiór modułu** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS/MODULE_ACCEPTANCE.md` | **★ WĄSKA LICENCJA — wyłącznie aktualizacja wiersza `R-20` i dopisanie NOWEGO wiersza dla kafli.** Zakaz kasowania i przeredagowywania pozostałych wierszy (`Z32`) | — |
| **dowody** | `evidence/swot-kafle-20260904/**` (**NOWY**) | **★ PEŁNA LICENCJA**, `git add -f` | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY344_SWOT_KAFLE_REPORT.md` (**NOWY**) | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **migracje** | `server/migrations/**` | **BEZ LICENCJI — ten dyżur nie dodaje ani nie zmienia żadnej migracji.** Przedział nie jest mu przydzielony | Uznasz migrację za potrzebną → **STOP MERYTORYCZNY z briefem**, przechodzisz do następnej pozycji |
| **kanon (dokumentacja)** | `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`, `docs/ui-standards/TRIADA_KANON.md`, `CLAUDE.md` | **TYLKO ODCZYT** | Errata w raporcie |
| **infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest **ZROBIONA** z takim opisem |
| **cudzy teren** | `src/components/Initiatives/**`, `src/utils/initiativeSectionsCompleteFlag.ts` — **teren dyżuru 343**; `src/components/MyWork/notebook/**`, `src/components/MyWork/prototypes/**`, `src/components/standard/IdeaRightPanel.tsx`, `src/components/standard/ArtifactRightRail.tsx`, `src/utils/artifactRightRailFlag.ts` — **teren dyżuru 345**; `server/src/services/report/**`, `server/src/routes/assessment-reports.routes.ts` — **teren dyżuru 346**; wszystko dotknięte przez dyżury 347-350 tej serii | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, treść problemu, **gotowa rekomendacja jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit robisz PO KAŻDEJ pozycji,
push na `github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Pomiar wejściowy: cztery liczby z DOM + nazwanie martwej gałęzi | TAK | NIE — dowód: `grep -n 'workSection' src/components/DiscoveryTools/ToolDocumentView.tsx` pokazuje, że pomiar jest odczytem | bazowe | Cztery liczby z uchwytu DOM (etapy drzewa i kafle × OFF/ON) + wskazanie plik:linia gałęzi, która odcina `workSection` + odczyt, gdzie renderuje się plakietka | `node scripts/dev/grafika-zrzuty.mjs --zlicz='etapy:[data-nmode-section-item];kafle:[data-testid="dynamic-swot-phase-tile"];plakietka:[data-testid="dynamic-swot-readiness-badge"]' --wynik-json=…` ×2 | `docs(day344): pomiar wejsciowy — kafle 0, przyczyna w galezi fazowej (344 R1)` |
| R2 | **RDZEŃ: kafle etapów renderują się realnie — 5 przy OFF, 7 przy ON** | TAK | NIE — dowód: `B.1` daje pełną licencję na `ToolDocumentView.tsx` w wąskim zakresie | +1 test broniący ZACHOWANIA | Liczba **z uchwytu DOM**: OFF → 5 kafli, ON → 7 kafli, na tej samej sesji; kafle konsumują `computeDynamicSwotPhaseSummaries`, a nie własną listę; klik w kafel dalej przełącza krok | `--zlicz=…` ×2 + `npx vitest run tests/unit/tools src/toolPacks/__tests__ --retry=0 --reporter=json --outputFile=…` | `feat(tools): kafle etapow SWOT renderuja sie w galezi fazowej (344 R2)` |
| R3 | Plakietka gotowości i `ToolContextPanel` — konsument albo jawny wpis o śmierci | TAK | NIE | +1 test | Plakietka ma **osiągalnego konsumenta** i uchwyt DOM, albo w rejestrze stoi wpis „martwa, powód, koszt usunięcia, rekomendacja”. To samo dla wykluczenia `ai-collaboration` — z **cytatem warunku i obu numerów linii** | `grep -rn 'computeDynamicSwotOverallReadiness' src/` + `--zlicz='plakietka:…'` ×2 | `feat(tools): plakietka gotowosci sesji SWOT ma konsumenta (344 R3)` |
| R4 | Siatka kafli i kanon crimsona | NIE | NIE | +1 test | Siatka mieści 7 kafli bez przycięcia w obu motywach; klasy `border-primary-300` / `bg-primary-500/10` zastąpione neutralnym stanem aktywnym (crimson wyłącznie dla semantyki krytycznej); `scripts/check-list-canon.sh` i `check-focus-canon.sh --ci` zielone | `bash scripts/check-focus-canon.sh --ci; bash scripts/check-list-canon.sh; bash scripts/check-artefakt.sh` | `fix(tools): siatka kafli SWOT i stan aktywny bez crimsona (344 R4)` |
| R5 | Para zrzutów OFF/ON gotowa do pokazania właścicielowi | NIE | NIE | n/d | Para na tej samej sesji, sekcje ROZWINIĘTE, **różne sumy `shasum -a 256`**, podana średnia jasność, light + dark, zero kontrolek harnessu w kadrze, zero błędów konsoli | `node scripts/dev/grafika-zrzuty.mjs …` + `shasum -a 256 evidence/swot-kafle-20260904/*.png` | `docs(day344): pary zrzutow OFF/ON sesji SWOT (344 R5)` |
| R6 | Raport + odbiór modułu | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE” **niepusta**; wiersz `R-20` w `03_TOOLS/MODULE_ACCEPTANCE.md` sprostowany o kafle | — | `docs(day344): raport i sprostowanie wiersza R-20` |

> **Kolumna „Wymaga plików przekrojowych?” jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Jedyny plik przekrojowy w promieniu tego dyżuru to
> `src/components/shared/NModeLayout/**` i **żadna pozycja go nie zmienia** — kafle są w centrum
> sekcji, nie w powłoce. Jeśli uznasz, że musi — produktem jest czerwony kontrakt + brief,
> a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą z tych liczb mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz
w `bash`, nigdy w `zsh` — `grep --include` w `zsh` zwraca pustkę zamiast wyniku, a pustka nie jest
wynikiem, dopóki nie sprawdzisz, że polecenie się wykonało.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Wystąpienia uchwytu `dynamic-swot-phase-tile` w repo | 1 | `grep -rn 'dynamic-swot-phase-tile' src/ dev-render/ tests/` | TAK — sam atrybut w `ToolDocumentView.tsx` ok. 1188; zero testów i zero ekranów |
| 2 | Użycia `workSection` | 1 | `grep -n 'workSection' src/components/DiscoveryTools/ToolDocumentView.tsx` | TAK — deklaracja ok. 1115, użycie ok. 1931 wewnątrz `defaultSections` |
| 3 | Kafle w DOM przy fladze ON | 0 | `--zlicz='kafle:[data-testid="dynamic-swot-phase-tile"]'` | TAK — **jedyny dopuszczalny przyrząd**; nigdy liczenie ze zrzutu. `0` JEST wynikiem |
| 4 | Etapy w drzewie: OFF / ON | 5 / 7 | `--zlicz='etapy:[data-nmode-section-item]'` ×2 | TAK — to jest zmierzony efekt dyżuru 341, punkt odniesienia dla `R2` |
| 5 | Wywołania `computeDynamicSwotOverallReadiness` | 2 | `grep -rn 'computeDynamicSwotOverallReadiness' src/` | TAK — oba w martwych dla `dynamic-swot` ścieżkach; **osiągalnych konsumentów: 0** |
| 6 | Wykluczenia `ai-collaboration` dla `dynamic-swot` | 2 | `grep -n "toolType === 'dynamic-swot'" src/components/DiscoveryTools/ToolDocumentView.tsx` | TAK — ok. 1911 i ok. 2054 |
| 7 | Narzędzia wpadające w gałąź `isStrategicPhaseTool` | 5 | `sed -n '304,311p' src/components/DiscoveryTools/ToolDocumentView.tsx` | TAK — promień rażenia zmiany z `R2` |
| 8 | Klasa siatki kafli | `xl:grid-cols-4` | `sed -n '1180,1184p' src/components/DiscoveryTools/ToolDocumentView.tsx` | TAK — **raport dyżuru 341 mówi `xl:grid-cols-5`; zmierz sam i podaj swoją wartość** |
| 9 | Trafienia crimsona w kaflu | 1 (klasa aktywnego kafla) | `grep -n 'border-primary-300\|bg-primary-500' src/components/DiscoveryTools/ToolDocumentView.tsx` | TAK — `primary` = crimson #85182F |
| 10 | Liście `translation.json` | pl 35198 / en 33065 | `node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'` | TAK — **liczba nie może zmaleć** |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY344_SWOT_KAFLE_REPORT.md` | NOWY | R6 | ZEROWE |
| 2 | `evidence/swot-kafle-20260904/**` | NOWY | R1/R5 | ZEROWE |
| 3 | `src/components/DiscoveryTools/ToolDocumentView.tsx` | ZASTANY | R2/R3/R4 | ★★ WYSOKIE — plik dotknięty przez dyżur 341 i przez cztery inne dyżury tej serii historycznie; **zmieniasz wyłącznie trzy zakresy z `B.1`, nigdy „przy okazji”** |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS/MODULE_ACCEPTANCE.md` | ZASTANY — aktualizacja wiersza | R6 | ŚREDNIE — wiersz `R-20` był aktualizowany przez dyżur 341 (`b4ad4f439d`); **poprawiasz go, nie przepisujesz dokumentu** |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `src/components/DiscoveryTools/toolCompletion.ts` | R3 | Tylko addytywnie i tylko jeżeli plakietka potrzebuje nowego kształtu danych; zachowanie dwóch zastanych funkcji bez zmian |
| `tests/unit/tools/**` (NOWE) | R2/R3/R4 | `git add -f`; test musi czerwienić się od mutacji ZABEZPIECZENIA, nie mechanizmu |
| `src/toolPacks/__tests__/dynamicSwotRuntimeWiring.test.ts` | R2 | Wyłącznie dopisanie nowych `it(...)`; zakaz osłabiania zastanych asercji |
| `dev-render/screens/tools-swot-*.tsx`, `dev-render/main.tsx` | R1/R5 | Tylko jeśli przyrząd nie pozwala zamontować sesji w obu stanach; kontrolki harnessu poza kadrem |
| `scripts/dev/grafika-zrzuty.mjs` | R1/R5 | Tylko addytywnie i opt-in; zachowanie domyślne bit w bit jak dziś |
| `public/locales/{pl,en}/translation.json` | R2/R3 | Tylko dopisanie kluczy, parytet w tym samym commicie, liczba liści nie maleje |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
src/components/shared/NModeLayout/**                     — powloka przekrojowa, przyrzad pomiarowy
src/components/DiscoveryTools/ToolContextPanel.tsx       — panel dziala dla pozostalych narzedzi
src/toolPacks/packs/dynamicSwot.pack.ts                  — deskryptor 7 faz jest poprawny
src/utils/dynamicSwotSevenStagesFlag.ts                  — flaga zastana, default OFF
src/store/useToolStore.ts                                — szew dyzuru 341 dziala
scripts/dev/start-wave3-owner-runtime.mjs                — przyrzad, nie produkt
src/components/Initiatives/**                            — teren dyzuru 343
src/components/MyWork/notebook/**                        — teren dyzuru 345
src/components/MyWork/prototypes/**                      — teren dyzuru 345
src/components/standard/IdeaRightPanel.tsx               — teren dyzuru 345
src/components/standard/ArtifactRightRail.tsx            — teren dyzuru 345
src/utils/artifactRightRailFlag.ts                       — teren dyzuru 345
server/src/services/report/**                            — teren dyzuru 346
server/src/routes/assessment-reports.routes.ts           — teren dyzuru 346
server/migrations/**                                     — przedzial nieprzydzielony
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6391 | `lsof -nP -iTCP:6391 -sTCP:LISTEN` → puste (sprawdzone przy pisaniu instrukcji, marker `6a4919f72d`) |
| Port harnessu | 5531 | `lsof -nP -iTCP:5531 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day344-pg` | `docker ps -a --format '{{.Names}}' \| grep cx-day344` → brak |
| Nazwa bazy | `cx344` | n/d — ★ `start-wave3-owner-runtime.mjs` tej nazwy nie przyjmie; to jest znane, patrz `§0.2e` |
| **Przedział migracji** | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | n/d |
| Gałąź | `codex/day344-swot-kafle-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day344-swot-kafle` | nie istnieje |
| Flagi funkcyjne | `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES` — **ZASTANA (dyżur 341), domyślnie OFF; dyżur jej NIE zmienia ani nie dokłada nowej** | `grep -rn 'VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES' .env* docker-compose* railway* 2>/dev/null` → 0 trafień na markerze |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day344-swot-kafle
git diff --name-only --cached | tee /private/tmp/cx-day344-swot-kafle-artefakty/staged.txt
grep -iE 'shared/NModeLayout/|ToolContextPanel|toolPacks/packs/|dynamicSwotSevenStagesFlag|store/useToolStore|start-wave3-owner-runtime|components/Initiatives/|MyWork/notebook/|MyWork/prototypes/|standard/IdeaRightPanel|standard/ArtifactRightRail|utils/artifactRightRailFlag|services/report/|assessment-reports\.routes|server/migrations/' \
  /private/tmp/cx-day344-swot-kafle-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"

# ★ NOWY plik testowy pod src/ czerwieni bezpiecznik osiagalnosci:
git diff --name-only --cached --diff-filter=A | grep -E '^src/.*\.(test|spec)\.(ts|tsx)$' \
  && echo "★★ NOWY TEST POD src/ — PRZENIES DO tests/" || echo "testy we wlasciwym miejscu"
```

---

## R1 — POMIAR WEJŚCIOWY: CZTERY LICZBY Z DOM I NAZWANIE MARTWEJ GAŁĘZI

**Ta pozycja nie naprawia niczego.** Ma dać Ci własną bazę odniesienia i własne, nie cudze,
potwierdzenie, że kafli jest zero.

Cztery stany, wszystkie na **tej samej sesji Dynamic SWOT**:

| # | Flaga | Co zapisujesz |
| --- | --- | --- |
| 1 | OFF | etapów w drzewie · kafli · plakietek · identyfikator sesji · stan `localStorage` |
| 2 | ON | jw. |

```bash
cd /private/tmp/cx-day344-swot-kafle
node scripts/dev/grafika-zrzuty.mjs \
  --zlicz='etapy:[data-nmode-section-item];kafle:[data-testid="dynamic-swot-phase-tile"]' \
  --wynik-json=/private/tmp/cx-day344-swot-kafle-artefakty/r1-off.json \
  <pozostałe parametry przelotu wg pomocy narzędzia>
#   oczekiwane OFF: etapy 5, kafle 0
#   oczekiwane ON:  etapy 7, kafle 0   ← to jest cala teza tego dyzuru
```

**`0` trafień jest wynikiem `0`, nigdy „pomiar się nie udał”.** Ale zanim ogłosisz zero, udowodnij,
że mierzysz właściwy ekran: ten sam przebieg ma dać niezerową liczbę etapów. Jeżeli etapy też dają
`0` — nie zamontowałeś sesji i nie masz pomiaru.

Drugi produkt pozycji: **własne wskazanie plik:linia gałęzi, która odcina `workSection`**, oraz
odczyt, w którym miejscu renderuje się `dynamicSwotReadiness`. Porównaj z liczbami z sekcji
„★ Zmierz moje liczby sam” i **zapisz rozbieżność wprost**.

Prawo zatrzymania po tej pozycji.

## R2 — RDZEŃ: KAFLE ETAPÓW RENDERUJĄ SIĘ REALNIE

Wymaganie, w kolejności rozstrzygającej:

1. **Kafle etapów renderują się w gałęzi, którą faktycznie wchodzi `dynamic-swot`.** Liczba
   **z uchwytu DOM**: **5 przy fladze OFF, 7 przy fladze ON**, na tej samej sesji.
2. **Kafle konsumują `computeDynamicSwotPhaseSummaries`** — ten sam deskryptor, z którego korzysta
   lewe drzewo. **Zakaz dopisywania drugiej, równoległej listy faz.** Jeden SSOT, inaczej za dwa
   tygodnie drzewo i kafle rozjadą się o jedną pozycję i nikt tego nie zauważy.
3. **Klik w kafel dalej przełącza krok** (`setCurrentStep`), a aktywny kafel jest rozpoznawalny.
4. **Przy fladze OFF zachowanie jest bit w bit zastane** — to też mierzysz.

**Czego NIE robisz:** nie przenosisz całego `workSection` do gałęzi fazowej hurtem (niesie treści,
które dla `dynamic-swot` są zdublowane z kanwą fazy — „dwie karty jedna na drugiej”, uwaga
właściciela z 02.09 zapisana w komentarzu ok. linii 1755); nie kasujesz `defaultSections`; nie
tykasz deskryptora paczki.

**Dowód mutacyjny wycelowany w ZABEZPIECZENIE, nie w mechanizm** (`Z32`), w obie strony:

- usuń jedną fazę z listy, którą konsumują kafle → test **CZERWONY**, ze wskazaniem nazwy fazy;
- **★ mutacja kontrolna, obowiązkowa: zostaw kafle w pliku, ale przywróć wcześniejszy `return`
  z gałęzi fazowej tak, żeby kafle znów nie trafiały do DOM** → test ma **CZERWIENIĆ**. Jeżeli
  przechodzi, Twój test broni deskryptora, a nie renderu — czyli powtarza dokładnie ten błąd,
  z którego bierze się ten dyżur, i pozycja jest **NIEZROBIONA**;
- cofnij każdą mutację przez `cp` z kopii w katalogu scratch (`Z27`, **nigdy `git stash`**) →
  **ZIELONY**; `git diff` po cofnięciu **pusty**.

Obie komendy i wszystkie wyniki **dosłownie** w raporcie.

Prawo zatrzymania po tej pozycji.

## R3 — PLAKIETKA GOTOWOŚCI I `ToolContextPanel`: KONSUMENT ALBO JAWNY WPIS O ŚMIERCI

**To jest pozycja o uczciwości, nie o kodzie.** Dwa obiekty istnieją, liczą i nikt ich nie widzi.
Masz je albo podłączyć, albo nazwać martwymi — **trzeciej możliwości nie ma**, a „jest w kodzie”
nie jest odpowiedzią.

**(a) Plakietka gotowości sesji.** `computeDynamicSwotOverallReadiness` renderuje się dziś wyłącznie
w `workSection` (martwym dla `dynamic-swot`) i w `ToolContextPanel` (wykluczonym dla
`dynamic-swot`). Produkt pozycji: **plakietka ma osiągalnego konsumenta i własny uchwyt DOM**
(zaproponuj `data-testid="dynamic-swot-readiness-badge"`), zmierzony w obu stanach flagi —
**albo** wpis w rejestrze: „martwa, powód, koszt usunięcia, rekomendacja”, z komendą, która to
pokazuje.

**(b) `ToolContextPanel` dla `dynamic-swot`.** Wykluczenie jest **jawnym warunkiem w dwóch
miejscach**, nie brakiem przewodu. Zanim je ruszysz:

1. Zacytuj oba warunki z numerami linii.
2. Sprawdź `git log -S` na tym warunku i **podaj commit, który go wprowadził, oraz jego
   uzasadnienie**, jeżeli jest w treści commita.
3. Dopiero mając to, rozstrzygnij: podłączyć czy zostawić. **Jeżeli nie potrafisz rozstrzygnąć
   bez decyzji produktowej** — wpisujesz `DO DECYZJI WŁAŚCICIELA` ze zdaniem **„czego konkretnie mi
   zabrakło, żeby rozstrzygnąć samodzielnie”** i kadrem obecnego stanu. Wpis bez tego zdania liczy
   się jako nierozstrzygnięty, ale **pozycja z takim wpisem jest ZROBIONA**.

**★ Zakaz „naprawy przez skasowanie”.** Usunięcie martwego kodu wyzeruje pomiar i zamknie temat
bez oddania właścicielowi funkcji, której nie widział ani razu. Kasować wolno dopiero po decyzji
nadzorcy, osobnym krokiem.

Prawo zatrzymania po tej pozycji.

## R4 — SIATKA KAFLI I KANON CRIMSONA

1. **Siatka**: przy siedmiu kaflach żaden nie może być przycięty ani wypchnięty poza kadr w żadnym
   z dwóch motywów. Siatka ma być **elastyczna**, nie przybita do konkretnej liczby kolumn. Podaj
   zmierzoną klasę PRZED i PO.
2. **Crimson**: aktywny kafel używa dziś `border-primary-300` i `bg-primary-500/10`.
   **`primary` w tailwindzie tego repo to crimson `#85182F`, zarezerwowany dla semantyki
   krytycznej** (`CLAUDE.md` §3 i §6 — pułapka nr 1 tego projektu; **każdy numer** `primary-*` jest
   crimsonem). Stan aktywny ma być neutralny; fokus zostaje niebieski `c-focus`.
3. **Bramki zielone**: `bash scripts/check-focus-canon.sh --ci`, `bash scripts/check-list-canon.sh`,
   `bash scripts/check-artefakt.sh`. **Bramka, która nie mogła się uruchomić, nie jest wynikiem** —
   jeżeli którakolwiek nie wystartuje, wklejasz jej błąd i mówisz to wprost, zamiast raportować
   „zielono”.

Prawo zatrzymania po tej pozycji.

## R5 — PARY ZRZUTÓW GOTOWE DO POKAZANIA WŁAŚCICIELOWI

**★ Właściciel NIGDY nie jest pierwszym testerem wizualnym.** Ty renderujesz realny ekran, Ty
robisz zrzut, zrzut ma być **czysty**: tokeny `c-*`, zero ozdób, **zero kontrolek harnessu
w kadrze**.

- Cztery kadry: OFF/ON × light/dark, **na tej samej sesji**.
- **Sekcje ROZWINIĘTE.** Rozwijaj tak, żeby nie zamykało to podglądu, a skan rób po zakończeniu
  animacji, nie w trakcie — skan w połowie przejścia daje fałszywy kontrast.
- **`shasum -a 256` każdego pliku + średnia jasność każdego.**
  **★ Para bajtowo identyczna = ZERO dowodu.** To samo dotyczy pary light/dark: dwa identyczne
  obrazy pod dwiema nazwami to nie jest para motywów.
- **Liczebność bierzesz z uchwytu DOM, nigdy ze zrzutu** — lewy panel i siatka kafli mają własne
  przewijanie, a kadr obcina.
- **Zero błędów konsoli** w każdym z czterech kadrów; jeżeli są — wypisujesz je co do sztuki
  i mówisz wprost, że para nie nadaje się do pokazania.
- Harness kanoniczny `scripts/dev/grafika-zrzuty.mjs`, **zakaz własnego skryptu obok**.

**Flaga kończy dyżur OFF.**

Prawo zatrzymania po tej pozycji.

## R6 — RAPORT I SPROSTOWANIE ODBIORU MODUŁU

Struktura `§R.2`. Obowiązkowo: cztery liczby z `R1`; para OFF/ON kafli po naprawie z `R2` **z
uchwytu DOM**; oba dowody mutacyjne z `R2` dosłownie; werdykt plakietki i panelu z `R3` z cytatem
obu warunków i numerami linii; klasa siatki PRZED/PO i wynik trzech bramek z `R4`; sumy i jasności
czterech kadrów z `R5`; sekcja **TWIERDZENIA NIEZWERYFIKOWANE** niepusta.

**Sprostowanie w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS/MODULE_ACCEPTANCE.md`:**
wiersz `R-20` opisuje dziś podłączenie siedmiu etapów. **Dopisz do niego zmierzony stan kafli
i plakietki** — przed tym dyżurem i po nim. Zastanych wierszy nie kasujesz i nie przeredagowujesz
(`Z32`).

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione, R2 zrobione, R3 rozpoczęte, R4-R5 nietknięte”
jest pełnowartościowym wynikiem — o ile R1 i R2 stoją na uchwycie DOM, a nie na oglądaniu obrazka,
i o ile R2 ma **obie** mutacje, z mutacją kontrolną włącznie.

**Odwrotna kolejność — siatka i kolory (R4) poprawione, a kafle dalej się nie renderują — jest
podstawą odrzucenia.** Poprawianie wyglądu obiektu, którego nie ma w DOM, jest pracą nad niczym.

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela niżej | TAK |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na worktree z markera `6a4919f72d`; zero `BRAK` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, dziesięć wierszy |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — każdy wiersz „tylko odczyt” ma rzeczownik-produkt (diff · brief · kontrakt · pomiar · wpis · errata) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4 |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (343, 345, 346 oraz 347-350) | TAK — `B.4.4`; porty 5531/6391 zmierzone jako wolne, kontener i gałąź nie istnieją |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu modułowi (trzy) | TAK — `§0.2e` punkt (e) |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru” bez ścieżki | TAK |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK |

### AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| Zakaz `Z10` „zero nowych flag” **vs** `R2` mierzy dwa stany flagi | `Z10` (pole wyjątku) — **żadnej nowej flagi**; flaga jest zastana z dyżuru 341, a jej wartość domyślna pozostaje OFF |
| Zakaz `Z11` „nie odsłaniasz nowego ekranu bez akceptu” **vs** `R5` wymaga kadrów przy fladze ON | `R5` + `Z11` — flagę włączasz **wyłącznie w swoim harnessie**, do pomiaru i zrzutu; do repo nie wchodzi żadna zmiana wartości domyślnej |
| Zakaz `Z40` „nie usuwaj `workSection` ani wykluczenia panelu” **vs** `R2`/`R3` mają je podłączyć | `R2` (nie przenosisz `workSection` hurtem, kafle konsumują ten sam deskryptor) i `R3` (podłączenie ALBO jawny wpis; kasowanie dopiero po decyzji nadzorcy) |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument” **vs** `R6` pisze do `MODULE_ACCEPTANCE.md` | `Z13` (pole „jedyny inny dokument”) — raport + jeden imiennie wskazany, **zastany** plik odbioru modułu, w którym wyłącznie aktualizujesz wiersz `R-20` i dopisujesz nowy |
| Zakaz `Z32` „nie zaniżasz i nie przeredagowujesz odbioru modułu” **vs** `R6` każe sprostować wiersz `R-20` | `R6` — sprostowanie polega na DOPISANIU zmierzonego stanu kafli; zastana treść zostaje, bo opisuje etapy drzewa, które faktycznie działają |
| Zakaz `Z15` „zero modelu językowego” **vs** sesja SWOT potrafi wołać `useToolAI` | `Z15` bez wyjątku — żaden pomiar tego dyżuru nie przechodzi przez `llmService` ani `/api/ai/**`; kafle mierzysz jako **obecność w DOM**, nie jako treść wygenerowaną |
| Zakaz `Z30` „zero wysyłki” **vs** `R1`/`R5` mogą uruchomić pełny runtime do zrzutów | `§0.2b` punkt (4) — wyjątek wyłącznie dla zrzutów, po dowodach (a) i (b), z deklaracją dosłowną w raporcie |
| Zakaz `Z7` „port zajęty = STOP całości” **vs** `start-wave3-owner-runtime.mjs` odrzuca nazwę bazy `cx344` | `§0.2e` i `B.1`, wiersz „przyrząd runtime” — odrzucenie NAZWY BAZY przez przyrząd **nie jest** zajętym portem i **nie jest STOP-em**; warstwę wizualną robisz w kanonicznym `dev-render` na swoim porcie 5531 |
| „Nowe testy w `tests/`” **vs** licencja wymienia `src/toolPacks/__tests__/**` | `B.1`, wiersz „walidator (NOWE pliki)” — do `src/toolPacks/__tests__/` wolno wyłącznie DOPISYWAĆ przypadki do plików, które już tam są; **każdy NOWY plik testowy idzie do `tests/`** |
