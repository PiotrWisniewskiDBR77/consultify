# INSTRUKCJA DYŻURU nr 225 — Codex — „Narzędzia — blokada z komentarza w toolsInsightsWiringFlag.ts nie istnieje (tabela tool_outputs istnieje od 28.08): sprostować trzeci kłamiący komentarz dnia, retestować GET /api/tool-outputs lokalnie z flagą włączoną, flaga zostaje domyślnie WYŁĄCZONA do akceptu właściciela"

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
> **wyłącznie** `/private/tmp/cx-day225-narzedzia`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `9fb7942a01`**
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
Zakres: **03 Narzędzia — src/utils/toolsInsightsWiringFlag.ts (komentarz do sprostowania), src/components/Discovery/DiscoveryToolsHub.tsx (konsument flagi, bootstrap Outputs/Insights), server/src/routes/toolOutputs.routes.ts + server/src/controllers/ToolOutputsController.ts (GET /api/tool-outputs), server/migrations/946_tool_outputs_reports_lineage.sql + 947_tool_outputs_idempotency_guard.sql + 948_tool_promotion_idempotency.sql. Kontrakt: docs/program/funkcje/ZNALEZISKO_TOOL_OUTPUTS.md (pomiar nadzorcy na stagingu, 31.08 wieczorem — tabela ISTNIEJE od 2026-08-28 09:35 UTC, wszystkie trzy migracje success), docs/program/funkcje/FALA_Z1_2026-08-31.md sekcja B „03 Narzędzia”, docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS/MODULE_ACCEPTANCE.md. ★★ ZAKAZ ŁĄCZENIA SIĘ DO STAGINGU w tym dyżurze (Z28) — cały retest jest lokalny, na własnym kontenerze.**.
Trasy front: `src/components/Discovery/DiscoveryToolsHub.tsx (bootstrap `fetchData`, zmierz linię na swojej bazie — na markerze warunek `isToolsInsightsWiringEnabled()` ok. :1079, wywołanie `Api.listToolOutputs(undefined)` ok. :1080, `.catch` fallback do `{outputs:[]}` + `setToolOutputsUnavailable(true)` ok. :1081-1084, konsument stanu `toolOutputsUnavailable` w renderze zakładki Outputs ok. :4410) — flaga rozstrzygana przez src/utils/toolsInsightsWiringFlag.ts (komentarz do sprostowania w TRZECH miejscach, ok. :27-28, :45-46, :97)`. Trasy tył: `GET /api/tool-outputs (server/src/Gateway.ts, montaż ok. :609-610 — 'Mounting /api/tool-outputs') -> server/src/routes/toolOutputs.routes.ts (router.get('/', ToolOutputsController.listOutputs), middleware apiAuthRateLimiter+verifyToken+requireOrgAccess+demoContextMiddleware) -> server/src/controllers/ToolOutputsController.ts:listOutputs (ok. :207). Zależy od trzech migracji: 946_tool_outputs_reports_lineage.sql, 947_tool_outputs_idempotency_guard.sql, 948_tool_promotion_idempotency.sql (server/migrations/) — WSZYSTKIE trzy istnieją w repo (zmierz `ls`) i muszą przejść na Twojej lokalnej bazie.`.

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
WT=/private/tmp/cx-day225-narzedzia
MARKER=9fb7942a01

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day225-narzedzia-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day225-narzedzia/config.worktree"
cat "$VAULT/worktrees/cx-day225-narzedzia/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day225-narzedzia-scratch
mkdir -p /private/tmp/cx-day225-narzedzia-artefakty

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
git -C "$VAULT" log --oneline 9fb7942a01..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 9fb7942a01..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day225-narzedzia-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9fb7942a01..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `10` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day225-narzedzia

# (W1) TEZA 1: komentarz klamie w TRZECH miejscach tego samego pliku
grep -n "NIE ISTNIEJE\|nie istnieje\|does not exist\|COFNIĘTE 28.08\|DEC-158" src/utils/toolsInsightsWiringFlag.ts
#   oczekiwane: co najmniej trzy trafienia (naglowek funkcji, blok rezolucji, JSDoc
#   funkcji isToolsInsightsWiringEnabled) twierdzace, ze tabela tool_outputs NIE ISTNIEJE.

# (W2) TEZA 1 c.d.: trzy migracje istnieja w repo, w kolejnosci 946/947/948
ls server/migrations/ | grep -E "^94[678]_tool"
#   oczekiwane: 946_tool_outputs_reports_lineage.sql, 947_tool_outputs_idempotency_guard.sql,
#   948_tool_promotion_idempotency.sql — trzy pliki.

# (W3) TEZA 2: flaga jest domyslnie OFF, rezolucja query>localStorage>env>default
grep -n "resolved = fromQuery\|export function isToolsInsightsWiringEnabled" src/utils/toolsInsightsWiringFlag.ts
#   oczekiwane: `resolved = fromQuery ?? fromLs ?? fromEnv ?? false` — default false.

# (W4) TEZA 3: konsument (DiscoveryToolsHub) MA juz .catch() na tool-outputs, nie tylko surowy throw
sed -n '1075,1086p' src/components/Discovery/DiscoveryToolsHub.tsx
#   oczekiwane: warunek isToolsInsightsWiringEnabled(), wywolanie Api.listToolOutputs,
#   .catch((error) => { console.warn(...); setToolOutputsUnavailable(true); return
#   {outputs:[]} }) — sprawdz, czy to lagodzi obawe z komentarza flagi o "cały hub pada
#   na pelnoekranowy blad" (mogla byc PRAWDZIWA w chwili pisania komentarza flagi i
#   NIEAKTUALNA dzis — zmierz, nie zakladaj).

# (W5) trasa zamontowana, middleware stack
grep -n "Mounting /api/tool-outputs" server/src/Gateway.ts
sed -n '1,26p' server/src/routes/toolOutputs.routes.ts
#   oczekiwane: montaz w Gateway.ts + router.get('/', ToolOutputsController.listOutputs)
#   za verifyToken+requireOrgAccess+demoContextMiddleware.

# (W6) kontroler istnieje i ma metode listOutputs
grep -n "static listOutputs" server/src/controllers/ToolOutputsController.ts
#   oczekiwane: metoda obecna.

# (W7) karta modulu 03 — jaki jest dzisiejszy gate
grep -n "Current gate" docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS/MODULE_ACCEPTANCE.md
#   oczekiwane: zawiera 'NO_REMEDIATION_AUTHORIZED' — sprawdz czy Twoj zakres (sprostowanie
#   komentarza + retest lokalny) miesci sie w tym, co dozwolone, czy wymaga adnotacji.

# (W8) ZAKAZ stagingu — potwierdz brak w kodzie/env jakichkolwiek adresow zdalnych w Twoich komendach
env | grep -iE "staging|railway|DATABASE_URL" || echo "BRAK zmiennych zdalnych — czysty start"
#   oczekiwane: brak; wszystkie Twoje polaczenia beda do 127.0.0.1:6168.

# (W9) czy istnieje juz test kontraktowy dla tej flagi/trasy
find src -iname "*toolsInsightsWiring*" -o -iname "*toolOutputs*" | grep -i test
find server/src -iname "*toolOutputs*" | grep -i test
#   oczekiwane: zmierz co juz istnieje, zeby nie duplikowac pokrycia.

# (W10) PORTY I KONTENERY
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(6168|5124|5125)\b' || echo "6168/5124/5125 wolne"
docker ps --format '{{.Names}} {{.Ports}}' | grep -i cx-day22
#   oczekiwane: wolne; jesli zajete, STOP i zglos kolizje zasobowa.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day225-narzedzia-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6168`. Twój JEDYNY port harnessu to `5124 i 5125`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day225-pg`**. **ZAKAZANE:** `na stałe: 5000, 5037, 5060-5061; zajęte przez dyżury wcześniejsze i odbiory nadzorcy: 6012, 5433, 6047, 6054-6164, 5010-5117, 6404-6411; zabronione na przód (fala 18): 6170-6175, 5128-5139; CUDZE w TEJ SAMEJ fali Z1 (222-225, pomijasz własne): baza 6165 (222) / 6166 (223) / 6167 (224), harness 5118-5119 (222) / 5120-5121 (223) / 5122-5123 (224). Twój wyłączny przydział: baza 6168, harness 5124 i 5125, kontener cx-day225-pg`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `VITE_TOOLS_INSIGHTS_WIRING (src/utils/toolsInsightsWiringFlag.ts) — włączasz WYŁĄCZNIE jako zmienną środowiskową Vite na czas retestu lokalnego lub przez URL query `?ff_toolsInsightsWiring=1` w Twojej przeglądarce lokalnej; zero zmiany `resolved = ... ?? false` w kodzie, zero zmiany w `.env*`/`docker-compose*`/`railway*` trwale. Flaga zostaje domyślnie WYŁĄCZONA po tym dyżurze — to jest twardy warunek zlecenia, nie sugestia`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `server/src/middleware/auth.middleware.ts (verifyToken) · server/src/Gateway.ts (ApiGateway.initializeRoutes) · server/src/middleware/v8FeatureGate.middleware.ts · server/src/middleware/resultsInternalBetaVisibility.middleware.ts · server/src/middleware/rbac.middleware.ts (requireOrgAccess) · server/src/middleware/demoGuard.middleware.ts (demoContextMiddleware) — żadnej nie dotykasz, trasa ma je już zamontowane`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY225_NARZEDZIA_REPORT.md`. docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS/MODULE_ACCEPTANCE.md — WYŁĄCZNIE dopisanie notatki o sprostowaniu komentarza i wyniku retestu (§R.1); docs/program/funkcje/ZNALEZISKO_TOOL_OUTPUTS.md — WYŁĄCZNIE dopisanie sekcji 'Wykonanie — Day225' na końcu z wynikiem retestu lokalnego, zero zmiany istniejącej treści powyżej. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day225-narzedzia-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day225-narzedzia-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ zakaz łączenia się do stagingu, demo i produkcji w KAŻDĄ stronę i KAŻDYM narzędziem (psql, curl, przeglądarka, MCP) — to jest ten sam bezwzględny zakaz co `Z28`, wypisany tu powtórnie, bo to jedyny dyżur fali Z1, który w ogóle dotyka tematu, który KIEDYŚ wymagał ręki nadzorcy na stagingu; zakaz zmiany wartości domyślnej `VITE_TOOLS_INSIGHTS_WIRING` z `false` na `true` w kodzie | ten dyżur istnieje WYŁĄCZNIE dlatego, że poprzednie przekonanie („niewykonalne bez stagingu”) było fałszywe — powtórzenie tego samego błędu przez przypadkowe połączenie zdalne zniweczyłoby cel sprostowania; włączenie flagi domyślnie na ON bez czystego zrzutu i akceptu właściciela łamie CLAUDE.md §9 identycznie jak każde inne masowe włączenie |

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
cd /private/tmp/cx-day225-narzedzia

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day225-pg psql -U postgres -d cx225 \
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
cd /private/tmp/cx-day225-narzedzia

docker run -d --name cx-day225-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx225 \
  -p 127.0.0.1:6168:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day225-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6168/cx225 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6168/cx225 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day225-narzedzia && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6168/cx225 \
JWT_SECRET=cx225-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__/toolOutputs.day225.pg.test.ts (NOWY, real-PG, GET /api/tool-outputs z flagą włączoną lokalnie i wyłączoną) · src/utils/__tests__/toolsInsightsWiringFlag.day225.commentAccuracy.test.ts (NOWY, kontrakt pilnujący, że komentarz nie wróci do stanu kłamiącego — patrz DoD §A.1) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day225-narzedzia-artefakty/day225-narzedzia.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day225-narzedzia && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__/toolOutputs.day225.pg.test.ts (NOWY, real-PG, GET /api/tool-outputs z flagą włączoną lokalnie i wyłączoną) · src/utils/__tests__/toolsInsightsWiringFlag.day225.commentAccuracy.test.ts (NOWY, kontrakt pilnujący, że komentarz nie wróci do stanu kłamiącego — patrz DoD §A.1) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day225-narzedzia-artefakty/day225-narzedzia.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day225-narzedzia/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day225-pg psql -U postgres -d cx225 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day225-pg`.
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
> **(e) nie dotyczy — trasa `/api/tool-outputs` nie ma własnej bramki bezpieczeństwa poza standardowym stosem (`verifyToken`/`requireOrgAccess`/`demoContextMiddleware`), już wymienionym w `LISTA_BRAMEK`; dowód: `sed -n '20,26p' server/src/routes/toolOutputs.routes.ts` pokazuje kompletny, standardowy stos middleware bez dodatkowego strażnika specyficznego dla tej trasy**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day225-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day225-narzedzia-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`obie pozycje (§A.1 sprostowanie komentarza, §A.2 retest lokalny) są rdzeniem obowiązkowym; §A.3 (decyzja o fladze pozostaje OFF) jest stwierdzeniem faktu, nie osobną pracą kodową`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6168` albo `5124 i 5125` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6168` albo `5124 i 5125`** (`Z7`).

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

`docs/program/funkcje/ZNALEZISKO_TOOL_OUTPUTS.md` opisuje odkrycie nadzorcy z 31.08
wieczorem: komentarz w `src/utils/toolsInsightsWiringFlag.ts` twierdzi, że tabela
`tool_outputs` „NIE ISTNIEJE na bazie staging" — a pomiar read-only na stagingu pokazał
`to_regclass('tool_outputs')` → **tabela ISTNIEJE**, wszystkie trzy migracje
(`946_tool_outputs_reports_lineage.sql`, `947_tool_outputs_idempotency_guard.sql`,
`948_tool_promotion_idempotency.sql`) mają status `success`, zastosowane **28.08 o 9:35
UTC**. Moduł 03 leżał TRZY DNI oznaczony jako „zablokowany dostępem do bazy" — **nie był
zablokowany, zablokował go komentarz**. To trzeci kłamiący komentarz znaleziony jednego
dnia (obok „NOT MOUNTED YET" przy trasie finansowej i przeterminowanego „shadow mode"
przy `gate-roles`).

**Zweryfikowane przy pisaniu tej instrukcji (nadzorca, na tipie `9fb7942a01`, 01.09):**

1. Komentarz KŁAMIE w **TRZECH** osobnych miejscach tego samego pliku (nie w jednym):
   - nagłówek funkcji rezolucji, ok. `:27-28`: „COFNIĘTE 28.08 (DEC-158): read-only
     kontrola bazy staging potwierdziła, że tabela `tool_outputs` NIE ISTNIEJE na tej
     bazie";
   - opis kroku 4 rezolucji (query→localStorage→env→default), ok. `:45-46`: „Default: OFF
     — cofnięte 28.08 (tool_outputs nie istnieje na bazie staging, DEC-158)";
   - JSDoc funkcji `isToolsInsightsWiringEnabled`, ok. `:97`: „OFF again since the
     2026-08-28 revert, DEC-158 — `tool_outputs` does not exist on the staging database".
   Wszystkie trzy opisują stan **SPRZED** 28.08 09:35 UTC i nie zostały zaktualizowane po
   migracji — mimo że data w treści komentarza („28.08") to DOKŁADNIE dzień, w którym
   migracja weszła.
2. Trzy migracje istnieją w repo na markerze (`ls server/migrations/ | grep -E
   "^94[678]_tool"` → trzy pliki) — mechanika (warstwa odczytu `tool_outputs`) NIE
   wymaga naprawy, jest gotowa.
3. **Konsument frontowy ma DODATKOWY bezpiecznik, którego treść komentarza flagi nie
   uwzględnia.** `DiscoveryToolsHub.tsx` (ok. `:1079-1085`) opakowuje wywołanie
   `Api.listToolOutputs(undefined)` we WŁASNY `.catch()`, który przy błędzie (w tym
   `5xx` przepuszczonym dalej przez `resolveBootstrapRequest`) ustawia
   `setToolOutputsUnavailable(true)` i zwraca `{outputs:[]}` — **nie** wywala całego huba
   narzędzi na pełnoekranowy błąd. To może oznaczać, że nawet OBAWA, która uzasadniała
   `DEC-158` (katastrofalny crash przy 500), jest dziś złagodzona przez zmianę
   niezależną od tej flagi. **Zmierz to sam (`W4`)** — możliwe, że ten `.catch()` powstał
   PO `DEC-158` i sam w sobie czyni rewert jeszcze mniej potrzebnym, niż sugerowałby sam
   fakt istnienia tabeli.
4. Trasa `GET /api/tool-outputs` jest zamontowana (`server/src/Gateway.ts:609-610`),
   ma standardowy stos middleware (`verifyToken`, `requireOrgAccess`,
   `demoContextMiddleware`, `apiAuthRateLimiter`) i kontroler
   `ToolOutputsController.listOutputs` (ok. `:207`) istnieje.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak weryfikujesz | Co, jeśli teza padnie |
| --- | --- | --- | --- |
| T1 | Komentarz w `toolsInsightsWiringFlag.ts` kłamie w trzech miejscach o nieistnieniu tabeli | `W1` | Nie może paść — to jest zmierzony fakt kodu, nie hipoteza o świecie zewnętrznym |
| T2 | Migracje 946/947/948 istnieją i są kompletne | `W2` | Jeśli brakuje któregoś pliku — STOP MERYTORYCZNY, cały zakres dyżuru się zmienia (wróć do „niewykonalne bez migracji") |
| T3 | Trasa `GET /api/tool-outputs` działa lokalnie po migracjach, z flagą ON | `§A.2` niżej | Jeśli 500 mimo migracji na Twojej lokalnej bazie — to jest INNY, nowy defekt niż ten, który opisywał komentarz; opisz go osobno, nie myl z DEC-158 |
| T4 | `.catch()` w `DiscoveryToolsHub.tsx` już łagodzi ryzyko crashu całego huba | `W4` | Jeśli okaże się, że jednak przepuszcza wyjątek dalej (np. błąd w samym `.catch()`) — to jest realny, dodatkowy defekt do zgłoszenia |

---

# 3. POZYCJE DYŻURU

## §A.1 — Sprostowanie komentarza (rdzeń, obowiązkowy)

**Cel:** wszystkie TRZY miejsca w `src/utils/toolsInsightsWiringFlag.ts` opisujące stan
tabeli `tool_outputs` mówią PRAWDĘ, datowaną i źródłowaną.

**Treść naprawy (wzorzec, dostosuj do dokładnego brzmienia, zachowaj sens):**
- nagłówek `:27-28`: zamień „COFNIĘTE 28.08 (DEC-158): read-only kontrola bazy staging
  potwierdziła, że tabela `tool_outputs` NIE ISTNIEJE na tej bazie" na coś w rodzaju:
  „COFNIĘTE 28.08 (DEC-158) na podstawie ÓWCZESNEGO stanu bazy staging — **SPROSTOWANE
  01.09 (dyżur 225, `ZNALEZISKO_TOOL_OUTPUTS.md`): tabela `tool_outputs` ISTNIEJE od
  2026-08-28 09:35 UTC, migracje 946/947/948 mają status `success`. Rewert z 28.08 opisywał
  stan SPRZED wejścia migracji tego samego dnia i nie został zaktualizowany. Flaga
  pozostaje domyślnie OFF nie z powodu brakującej tabeli, tylko do świadomego akceptu
  właściciela na czystym zrzucie (`CLAUDE.md` §9) — patrz `§A.3` niżej.";
- analogicznie popraw `:45-46` (opis kroku 4 rezolucji) i `:97` (JSDoc) — **każde z trzech
  miejsc osobno**, żeby żadne nie zostało z tyłu (dokładnie ten błąd, który spowodował,
  że trzy miejsca kłamały RAZEM przez trzy dni);
- dopisz JEDNO zdanie linkujące do `ZNALEZISKO_TOOL_OUTPUTS.md` jako źródła prawdy o
  dacie i metodzie pomiaru.

**DoD `§A.1`:**
- `grep -n "NIE ISTNIEJE\|nie istnieje\|does not exist" src/utils/toolsInsightsWiringFlag.ts`
  → **zero trafień** po Twojej zmianie (albo trafienia wyłącznie w kontekście
  historycznym, jawnie oznaczonym jako „SPROSTOWANE"/„stan sprzed 28.08 09:35");
- nowy test `src/utils/__tests__/toolsInsightsWiringFlag.day225.commentAccuracy.test.ts`
  — **dowód mutacyjny wprost przeciwny do zwykłego wzorca `Z32`**: ten test NIE testuje
  zachowania runtime (funkcja i tak zawsze zwracała `false` domyślnie — to się NIE
  zmienia), tylko TREŚĆ komentarza źródłowego przez `readFileSync` + `toContain`/`not
  toContain` na frazach kłamiących. Dowód: PRZED naprawą (kopia pliku sprzed zmiany,
  `cp`, `Z27`) test jest CZERWONY (bo plik zawiera frazę „NIE ISTNIEJE"); PO naprawie —
  ZIELONY; cofnięcie przez `cp` przywraca czerwień. To jest zabezpieczenie PRZED
  REGRESJĄ KOMENTARZA, dokładnie ten sam wzorzec co strażnik `Z32`, zastosowany do
  tekstu, nie do kodu wykonywalnego — uzasadnij to explicite w raporcie, bo to
  nietypowe zastosowanie reguły.

## §A.2 — Retest ścieżki `GET /api/tool-outputs` lokalnie, z flagą włączoną

**Cel:** dowód, że ścieżka odczytu `tool_outputs` DZIAŁA na świeżej, w pełni
zmigrowanej lokalnej bazie tego dyżuru — z flagą włączoną WYŁĄCZNIE lokalnie.

**★★ ZAKAZ ŁĄCZENIA SIĘ DO STAGINGU** — cały retest jest na kontenerze `cx-day225-pg`
(port `6168`), zero `psql`/`curl` do jakiegokolwiek hosta poza `127.0.0.1` (`Z28`).

**Krok 1 — migracje pełne, dwa przebiegi (`§0.2c(A)`)**, potwierdź w wyniku obecność
`946_tool_outputs_reports_lineage`, `947_tool_outputs_idempotency_guard`,
`948_tool_promotion_idempotency` w logu zastosowanych migracji.

**Krok 2 — real-PG test trasy**, komplet env w jednej linii (`§0.2c(B)`):
```bash
cd /private/tmp/cx-day225-narzedzia && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6168/cx225 \
JWT_SECRET=cx225-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__/toolOutputs.day225.pg.test.ts --retry=0 \
  --config server/vitest.config.ts \
  --reporter=json --outputFile=/private/tmp/cx-day225-narzedzia-artefakty/day225-narzedzia-routetest.json
```
Nowy test montuje `ApiGateway.getInstance().initializeRoutes(app)` (`Z22`), robi
realny podpisany JWT dla użytkownika Twojej bazy, i asertuje: `GET /api/tool-outputs`
→ `200` (nie `500`), kształt `{ outputs: [] }` na pustej bazie (zero wierszy — tabela
istnieje, ale nic w niej nie ma, dokładnie jak w pomiarze stagingu z
`ZNALEZISKO_TOOL_OUTPUTS.md`), oraz `403`/`401` dla żądania bez ważnego tokenu/spoza
organizacji (boundary — para dowodowa „obcy nie widzi").

**Krok 3 — front, z flagą włączoną WYŁĄCZNIE lokalnie:**
```bash
VITE_TOOLS_INSIGHTS_WIRING=true npm run dev
# w przeglądarce lokalnej: http://127.0.0.1:<port dev-servera>/discovery-tools?ff_toolsInsightsWiring=1
```
Zaloguj się kontem testowym, otwórz zakładkę Outputs/Insights, potwierdź w devtools
Network, że `GET /api/tool-outputs` zwraca `200`, i że hub NIE wchodzi w stan błędu
pełnoekranowego. Zrób JEDEN zrzut (nie para light/dark — to nie jest pozycja
wizualna do akceptu, to dowód techniczny) potwierdzający zakładkę Outputs bez
błędu. **NIE ustawiasz flagi na `true` domyślnie ani trwale** — to jest WYŁĄCZNIE
przebieg lokalny na czas dowodu, patrz `§A.3`.

**DoD `§A.2`:**
- log migracji (dwa przebiegi) w raporcie;
- wynik real-PG testu trasy: `200`+kształt na happy path, `401`/`403` na boundary —
  dowód „obcy nie widzi" (401/403) ORAZ „właściciel widzi" (200 z ważnym JWT dla
  właściwej organizacji) — para dowodowa kompletna;
- jeden zrzut zakładki Outputs z flagą ON lokalnie, w `/private/tmp/cx-day225-narzedzia-artefakty`, `shasum -a 256`;
- jawne zdanie w raporcie: „Retest lokalny POTWIERDZA, że blokada opisana w
  DEC-158 nie istnieje na tej bazie po migracjach — ścieżka działa."

## §A.3 — Decyzja o fladze: pozostaje domyślnie WYŁĄCZONA

To NIE jest praca kodowa — to jest fakt do udokumentowania i PILNOWANIA, żeby nikt (Ty
ani przyszły dyżur) go nie odwrócił bez akceptu właściciela. `VITE_TOOLS_INSIGHTS_WIRING`
i `resolved = fromQuery ?? fromLs ?? fromEnv ?? false` w
`src/utils/toolsInsightsWiringFlag.ts` **zostają BEZ ZMIANY** — `false` na końcu łańcucha
rezolucji to twardy wymóg tego zlecenia (`CLAUDE.md` §9: nigdy nie włączamy flag
wizualnych hurtem; jeden ekran po drugim, po akcepcie właściciela na czystym zrzucie).
Zrzut z `§A.2` krok 3 jest dowodem TECHNICZNYM (że działa), nie zrzutem ODBIOROWYM
(do akceptu Piotra) — te dwie role NIE są tożsame; jeśli chcesz przygotować materiał pod
przyszły akcept właściciela, dodaj go do `/private/tmp/cx-day225-narzedzia-artefakty` z jawną adnotacją „materiał
przygotowawczy, NIE jest jeszcze zrzutem odbiorowym wg reguły 7".

**DoD `§A.3`:**
- `git diff` na `src/utils/toolsInsightsWiringFlag.ts` pokazuje WYŁĄCZNIE zmiany treści
  komentarza (`§A.1`) — zero zmiany w linii `resolved = ...` i zero zmiany domyślnej
  wartości w kodzie/`.env*`;
- raport ma jawne zdanie: „Flaga `VITE_TOOLS_INSIGHTS_WIRING` pozostaje domyślnie
  WYŁĄCZONA. Włączenie wymaga osobnej decyzji właściciela na czystym zrzucie."

## §R.1 — podniesienie karty modułu 03 i ZNALEZISKO_TOOL_OUTPUTS.md

Dopisz do `docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS/MODULE_ACCEPTANCE.md`
notatkę o sprostowaniu komentarza i wyniku retestu, z odsyłaczem do raportu. Dopisz do
`docs/program/funkcje/ZNALEZISKO_TOOL_OUTPUTS.md` nową sekcję na KOŃCU pliku
(„## Wykonanie — Day225") z wynikiem retestu lokalnego — **zero zmiany istniejącej
treści powyżej**, ten dokument jest już `status: canonical` i opisuje POMIAR nadzorcy
z 31.08, który pozostaje prawdziwy i nietknięty.

## §R.2 — raport dyżuru

`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY225_NARZEDZIA_REPORT.md`.
Struktura: (1) wynik komend `(2)`/`(7)` z `§0.1`; (2) wynik `W1`-`W10`; (3) `§A.1` —
diff komentarza + dowód mutacyjny testu treści; (4) `§A.2` — log migracji, wynik testu
trasy (para dowodowa 401/403 vs 200), zrzut zakładki Outputs; (5) `§A.3` — potwierdzenie
`git diff` bez zmiany domyślnej; (6) `§0.4a`; (7) „Korekty wobec instrukcji"; (8)
„TWIERDZENIA NIEZWERYFIKOWANE".

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
| --- | --- |
| Zapis — WĄSKA, wyłącznie treść trzech bloków komentarza (`:27-28`, `:45-46`, `:97`) | `src/utils/toolsInsightsWiringFlag.ts` (zakaz zmiany jakiejkolwiek linii kodu wykonywalnego, w tym `resolved = ... ?? false`) |
| Zapis — NOWY plik | `server/src/routes/__tests__/toolOutputs.day225.pg.test.ts` |
| Zapis — NOWY plik | `src/utils/__tests__/toolsInsightsWiringFlag.day225.commentAccuracy.test.ts` |
| Zapis — WYŁĄCZNIE dopisanie notatki (§R.1) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS/MODULE_ACCEPTANCE.md` |
| Zapis — WYŁĄCZNIE nowa sekcja na końcu (§R.1) | `docs/program/funkcje/ZNALEZISKO_TOOL_OUTPUTS.md` |
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY225_NARZEDZIA_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/Discovery/DiscoveryToolsHub.tsx` — dowodzisz istniejącego `.catch()` (§A.2, W4), NIE zmieniasz |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/toolOutputs.routes.ts` · `server/src/controllers/ToolOutputsController.ts` · `server/migrations/946_tool_outputs_reports_lineage.sql` · `947_tool_outputs_idempotency_guard.sql` · `948_tool_promotion_idempotency.sql` — mechanika gotowa, dowodzisz, nie zmieniasz |
| Odczyt (ZAKAZ ZAPISU — `Z18`) | `tests/setup.ts` · `tests/helpers/**` · `tests/__mocks__/**` · `vitest.config.ts` · `vitest.*.config.ts` · `server/vitest.config*.ts` · `tests/integration/_helpers/assertRealPostgres.ts` |
| Odczyt | `docs/program/funkcje/ZNALEZISKO_TOOL_OUTPUTS.md` (treść powyżej Twojej nowej sekcji — SSOT pomiaru 31.08, nietykalna) |

**Nietykalne imiennie:** `tests/setup.ts` i sąsiedzi (`Z18`) · `resolved = fromQuery ??
fromLs ?? fromEnv ?? false` w `toolsInsightsWiringFlag.ts` (domyślna wartość flagi) ·
jakikolwiek host poza `127.0.0.1` w Twoich komendach (`Z28`, bez wyjątku, jedyny zakaz w
tym programie, który zatrzymuje CAŁY dyżur).

**Rozłączność z partią równoległą:** `222`/`223`/`224` dotyczą modułów 07/13/16 — zero
wspólnych plików produktowych.

---

# 5. TWARDE ZASADY

- ★★ **`Z28` OBOWIĄZUJE BEZ WYJĄTKU — zero połączeń do stagingu/demo/produkcji, w każdą
  stronę, każdym narzędziem.** To jedyny zakaz w tym programie, który zatrzymuje CAŁY
  dyżur, nie tylko pozycję. Cały dowód `§A.2` jest na `127.0.0.1:6168`.
- ★★ **Flaga zostaje domyślnie WYŁĄCZONA.** Sprostowanie komentarza (`§A.1`) i dowód
  działania (`§A.2`) NIE są uzasadnieniem do zmiany `default false` — to dwie różne
  decyzje, rozdzielone celowo (`CLAUDE.md` §9).
- ★★ **Sprostuj WSZYSTKIE TRZY miejsca komentarza, nie jedno.** Dokładnie ten błąd
  (poprawienie jednego z trzech powielonych miejsc) spowodował, że fałszywy komentarz
  przetrwał — jeśli zostawisz choć jedno, następny czytelnik trafi na kłamstwo.
- ★ **Nie myl „mechanika gotowa" z „ekran gotowy do akceptu".** Warstwa odczytu
  (migracje+trasa+kontroler) działa — to potwierdzasz w `§A.2`. Czy WYGLĄD zakładki
  Outputs z połączonymi danymi `tool_outputs` jest gotowy do pokazania właścicielowi, to
  osobne pytanie, którego ten dyżur NIE rozstrzyga.
- ★ **`Z13`:** zrzuty, logi migracji, wyniki `--reporter=json` NIE wchodzą do repo —
  leżą w `/private/tmp/cx-day225-narzedzia-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- ★ **Pułapka komentarzy, które kłamią (ten sam mechanizm, który jest TEMATEM tego
  dyżuru):** po naprawie `§A.1` nie zakładaj, że ŻADEN inny komentarz w plikach, które
  czytasz w tym dyżurze, jest prawdziwy — zweryfikuj każdy, na jaki się powołujesz w
  raporcie, tym samym trybem pomiaru.
- ★ **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu** (`Z24`).
