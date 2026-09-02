# INSTRUKCJA DYŻURU nr 250 — Codex — „★★ USTAWIENIA AI — RODZINA 18 TRAS, JEDNA NAPRAWIONA PARA WCALE NIE ZNACZY „RODZINA GOTOWA”: piętro superadministratora (`GET`/`PUT /superadmin`, `ai-settings.routes.ts:189-253`) ma TEN SAM mechanizm transformacji (`transformSettingsToCamelCase`/`ToSnakeCase`, linie 60-93) jak piętro organizacji, ale **zero realdb testu chroniącego go** (`tests/integration/ai-settings-api.test.ts` mockuje `dbGet` na poziomie serwisu, nie dowodzi trasy HTTP) — podczas gdy piętro organizacji ma `org-ai-settings-camelcase.realdb.test.ts` z realnym Postgresem; `GET /api/ai-settings/effective` (linia 491-518) zwraca surowe, niespójne pole (`{...superadmin, ...org, ...user}` ze WSZYSTKICH TRZECH surowych serwisowych snake_case kształtów, `aiSettingsService.ts:492-513`) — **oba żywe front-endowe wołacze tej trasy są martwe** (`src/hooks/useAISettings.ts` i `Api.getAIEffectiveSettings` w `src/services/api.ts:17383` mają ZERO importerów, zweryfikowane grepem), ale jeden ŻYWY serwerowy konsument istnieje — `server/src/services/aiContextBuilder.ts:220` woła `getEffectiveSettings()` wprost (z pominięciem trasy HTTP i jej ewentualnej transformacji) i karmi wynik do `AIPipeline.ts:1608-1630`, gdzie tylko 4 z ~20+ pól mają obronę dwukształtną (`s.response_style || s.responseStyle`), reszta (pola piętra organizacji: `policyLevel`/`maxTokensPerMonth`/`freezeOnLimit` itd.) nie jest tam w ogóle czytana — **realne wymuszanie limitów budżetu/tokenów czyta bazę bezpośrednio, z pominięciem tego całego mechanizmu**, więc ryzyko biznesowe `/effective` jest dziś NISKIE, nie zerowe, i to MUSISZ zmierzyć, nie założyć. Osobny, martwy `docs/program/grafika/ZAPIS_USTAWIEN_AI_20260901.md` analizował plik `server/src/routes/ai-settings.routes.ts` (BEZ prefiksu `ai/`) — **ten plik DZIŚ NIE ISTNIEJE w repozytorium** (`ls` → `No such file or directory`, zweryfikowane na markerze) — jego wnioski o piętrze superadmina („ZEPSUTE”) są sprzeczne z żywym plikiem i NIE WOLNO Ci ich cytować jako faktu o dzisiejszym kodzie bez ponownej weryfikacji na żywym pliku."

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
> **wyłącznie** `/private/tmp/cx-day250-ai-ustawienia-rodzina`.

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
Zakres: ****Ustawienia AI — rodzina wszystkich 18 tras w `server/src/routes/ai/ai-settings.routes.ts` (JEDYNY zamontowany plik tego kontraktu — `server/src/Gateway.ts:54,744`).** Piętro organizacji (`GET`/`PUT /org/:orgId`, 18 pól) ma już naprawę camelCase↔snake_case (`transformOrgSettingsToCamelCase`/`ToSnakeCase`, `ai-settings.routes.ts:149-155,264-303,310-388`) i własny realdb test (`tests/integration/org-ai-settings-camelcase.realdb.test.ts`) — **KROK 0 tego dyżuru wypisuje pozostałych 16 tras i mierzy, która z nich naprawę odziedziczyła, a która nie**, zamiast zakładać status z cudzego audytu.**.
Trasy front: ``src/hooks/useAISettings.ts` (ZWERYFIKUJ: martwy, zero importerów) · `src/services/api.ts:17362-17389` (`Api.getAIUserSettings`/`updateAIUserSettings`/`getAIAvailableModels`/`getAIEffectiveSettings` — ostatni martwy) · `src/views/admin/OrgAISettingsView.tsx` (piętro org, już naprawione — TYLKO ODCZYT, nie dotykasz) · `src/components/SuperAdmin/SuperAdminAISettings.tsx` (piętro superadmina) · `src/components/settings/AISettings.tsx` (piętro użytkownika, już poprawne wzorcowo — `getUserAISetting` dual-key, linie ok. 144-159,322-339)`. Trasy tył: ``server/src/routes/ai/ai-settings.routes.ts` (JEDYNY zamontowany plik, 18 tras, 1079 linii — `Gateway.ts:54,744`; `server/src/routes/ai/index.ts:25,64` też go montuje pod `/api/ai/settings`, DRUGA ścieżka do TEGO SAMEGO routera — sprawdź w `R1`, czy to zamierzone czy kolejny rozjazd) · `server/src/services/aiSettingsService.ts` (serwis, snake_case spójnie na wszystkich piętrach, `getSuperAdminSettings`:180 · `getOrgSettings`:264 · `getUserSettings`:375 · `getEffectiveSettings`:492) · `server/src/services/aiContextBuilder.ts:190-230` (ŻYWY konsument `getEffectiveSettings()`, z pominięciem HTTP) · `server/src/services/ai/AIPipeline.ts:1608-1630` (konsument `ctx.aiSettings`, dual-key TYLKO dla 4 pól użytkownika)`.

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
WT=/private/tmp/cx-day250-ai-ustawienia-rodzina
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
git -C "$VAULT" worktree add "$WT" -b codex/day250-ai-ustawienia-rodzina-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day250-ai-ustawienia-rodzina/config.worktree"
cat "$VAULT/worktrees/cx-day250-ai-ustawienia-rodzina/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day250-ai-ustawienia-rodzina-scratch
mkdir -p /private/tmp/cx-day250-ai-ustawienia-rodzina-artefakty

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
git -C "$WT" push github-backup codex/day250-ai-ustawienia-rodzina-20260901
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

# (1) TEZA: jest DOKLADNIE JEDEN zamontowany plik tras Ustawien AI
ls server/src/routes/ai-settings.routes.ts 2>&1
ls -la server/src/routes/ai/ai-settings.routes.ts
grep -n "ai-settings.routes" server/src/Gateway.ts server/src/routes/ai/index.ts
#   oczekiwane: pierwszy `ls` -> "No such file or directory"; drugi -> plik istnieje;
#   grep -> Gateway.ts:54 import + :744 mount pod /api/ai-settings, ORAZ ai/index.ts:25,64
#   mount pod /settings (czyli /api/ai/settings) — DWA mounty TEGO SAMEGO routera, zapisz obie sciezki

# (2) TEZA: piętro organizacji juz ma transformacje i realdb test
grep -n "transformOrgSettingsToCamelCase\|transformOrgSettingsToSnakeCase" server/src/routes/ai/ai-settings.routes.ts
ls -la tests/integration/org-ai-settings-camelcase.realdb.test.ts
#   oczekiwane: funkcje istnieja (linie ok. 149-155), plik testu istnieje

# (3) TEZA: pietro superadmina MA transformacje w zywym pliku (mimo ze inny dokument mowi INACZEJ)
sed -n '60,93p;189,253p' server/src/routes/ai/ai-settings.routes.ts
#   oczekiwane: transformSettingsToCamelCase/ToSnakeCase zdefiniowane i uzyte w GET/PUT /superadmin

# (4) TEZA: pietro superadmina NIE MA realdb testu rownowaznego org
find tests -iname "*superadmin*ai-settings*"
grep -n "describe(\|it(" tests/integration/ai-settings-api.test.ts | head -10
#   oczekiwane: find -> pusto; grep -> nazwa opisu "REAL_CODE" ale z mockResolvedValueOnce (mock, nie realdb)

# (5) TEZA: GET /effective zwraca surowy, niespojny ksztalt
sed -n '491,518p' server/src/routes/ai/ai-settings.routes.ts
sed -n '492,513p' server/src/services/aiSettingsService.ts
#   oczekiwane: `return res.json(effective)` bez transformacji; serwis zwraca spread trzech surowych
#   snake_case obiektow

# (6) TEZA: oba frontendowe wolacze /effective sa martwe (zero importerow)
grep -rln "useAISettings" src --include='*.tsx' --include='*.ts' | grep -v "useAISettings.ts$" | grep -v __tests__
grep -rn "getAIEffectiveSettings" src --include='*.ts' --include='*.tsx' | grep -v __tests__
#   oczekiwane: obie komendy -> pusto (zero importerow/wolan poza definicja)

# (7) TEZA: jeden zywy SERWEROWY konsument istnieje i broni sie dual-key TYLKO dla 4 pol
grep -n "getEffectiveSettings" server/src/services/aiContextBuilder.ts
sed -n '1608,1630p' server/src/services/ai/AIPipeline.ts
#   oczekiwane: aiContextBuilder.ts:220 wola getEffectiveSettings(); AIPipeline.ts czyta TYLKO
#   response_style/writing_tone/proactivity_mode/custom_instructions z dual-key, zero pol
#   pietra organizacji (policyLevel/maxTokensPerMonth/freezeOnLimit)

# (8) TEZA: cytowany martwy plik `ZAPIS_USTAWIEN_AI_20260901.md` analizowal NIEISTNIEJACY plik
grep -n "server/src/routes/ai-settings.routes.ts" docs/program/grafika/ZAPIS_USTAWIEN_AI_20260901.md | head -3
#   oczekiwane: dokument cytuje sciezke BEZ ai/ — potwierdza pulapke opisana w PULAPCE wyzej

# (9) miejsce na dysku
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day250-ai-ustawienia-rodzina-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6240`. Twój JEDYNY port harnessu to `5220 i 5221`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day250-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6239, 5010-5219, 6404-6411, 6600-6830. Twoje własne: baza 6240, harness 5220 i 5221. Cudze — siostrzane dyżury TEJ SAMEJ paczki (rozjazdy nazw pól / ciche zapisy / integralność danych), nie dotykasz: baza 6242 i harness 5222-5223 (dyżur 251 Audyty — kolumna Postęp), baza 6244 i harness 5224-5225 (dyżur 252 Przemiatanie rozjazdów), baza 6246 i harness 5226-5227 (dyżur 253 Fałszywe obietnice zapisu), baza 6248 i harness 5228-5229 (dyżur 254 Sprzeczności rejestru/dokumentacji). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi. Ten dyżur nie dotyka żadnej flagi funkcyjnej — cała praca jest w warstwie transformacji nazw pól tras/serwisu i w testach.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts` · `server/src/services/legacyCutover/requireActiveMembership.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts` · `server/src/Gateway.ts` (odczyt WYŁĄCZNIE — montaż tras, nie ruszasz linii 54/744/919-921 poza R1 pomiarem)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY250_AI_USTAWIENIA_RODZINA_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć: `docs/program/grafika/ZAPIS_USTAWIEN_AI_20260901.md` — WYŁĄCZNIE nowa sekcja na końcu (`R4`), zakaz kasowania/przepisywania istniejącej treści, zakaz zmiany jej werdyktu "POTWIERDZONE" w nagłówku (dopisujesz obok, nie nadpisujesz). **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day250-ai-ustawienia-rodzina-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day250-ai-ustawienia-rodzina-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ zmiany zachowania piętra organizacji** (`GET`/`PUT /org/:orgId`) — jest już naprawione i chronione realdb testem; dotykasz go WYŁĄCZNIE do odczytu jako wzorca do powielenia. **ZAKAZ kasowania ani przepisywania `docs/program/grafika/ZAPIS_USTAWIEN_AI_20260901.md`** — jeśli jego twierdzenia okażą się nieaktualne wobec żywego pliku, dopisujesz PROSTOWANIE na końcu tego dokumentu (nowa sekcja, nie kasujesz istniejącej treści), z dowodem `ls`/`git log`. **ZAKAZ tworzenia nowego, ogólnego mechanizmu transformacji nazw** (np. generycznego konwertera regexowego snake↔camel) — `mapKeys()` (linia 106-115) już jest tym mechanizmem i komentarz w kodzie (linie 96-105) tłumaczy WPROST, dlaczego naiwny regex jest zły dla akronimów (`maxAICallsPerDay`, `monthlyBudgetUSD`) — reużywasz `mapKeys`, nie wymyślasz nowego wzorca. **ZAKAZ łączenia dwóch montaży tego samego routera** (`Gateway.ts:744` pod `/api/ai-settings` i `ai/index.ts:64` pod `/settings`, czyli finalnie `/api/ai/settings`) w jedną trasę — jeśli KROK 0 potwierdzi, że to naprawdę dwa różne, żywe mounty tego samego routera, zgłaszasz to jako ODDZIELNE znalezisko w raporcie (sekcja „Korekty wobec instrukcji”), NIE naprawiasz w tym dyżurze bez jawnego zamówienia — promień rażenia (kto woła który adres) jest poza czasem tego dyżuru. | `docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md` zmierzyło, że piętro organizacji (18 pól) było zepsute w OBIE strony (odczyt zawsze pokazywał domyślne, zapis zawsze cichy no-op na starą wartość) i że naprawa (transform camelCase↔snake_case) `transformSettingsToCamelCase`/`ToSnakeCase` **już istniała w TYM SAMYM pliku dla piętra superadmina, kilkadziesiąt linii dalej** — narzędzie naprawy stało obok przez cały czas. Ten dyżur bierze KROK 0 dosłownie: zgłoszona para (org) jest PRÓBKĄ z rodziny 18 tras jednego pliku, nie całym zasięgiem — trzeba wypisać wszystkie 18 i zmierzyć każdą, bo trzy poprzednie audyty tego dnia (Ustawienia AI, kolumna Postęp Audytów, rejestr uprawnień) już pokazały, że punktowe zgłoszenie regularnie okazuje się szersze ALBO — jak w tym przypadku — częściowo JUŻ naprawione przez równoległy tor, i tylko bezpośredni pomiar na marker `df7f13056f` rozstrzyga które. |

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
cd /private/tmp/cx-day250-ai-ustawienia-rodzina

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day250-pg psql -U postgres -d cx250 \
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
cd /private/tmp/cx-day250-ai-ustawienia-rodzina

docker run -d --name cx-day250-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx250 \
  -p 127.0.0.1:6240:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day250-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6240/cx250 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6240/cx250 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day250-ai-ustawienia-rodzina && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6240/cx250 \
JWT_SECRET=cx250-test-secret-do-not-reuse \
npx vitest run tests/integration/org-ai-settings-camelcase.realdb.test.ts tests/integration/superadmin-ai-settings-camelcase.realdb.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day250-ai-ustawienia-rodzina-artefakty/day250-ai-ustawienia.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day250-ai-ustawienia-rodzina && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/integration/org-ai-settings-camelcase.realdb.test.ts tests/integration/superadmin-ai-settings-camelcase.realdb.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day250-ai-ustawienia-rodzina-artefakty/day250-ai-ustawienia.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day250-ai-ustawienia-rodzina/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day250-pg psql -U postgres -d cx250 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day250-pg`.
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
> **(e) ★★ NIE UFAJ ŻADNEMU CUDZEMU AUDYTOWI TEGO TEMATU BEZ PONOWNEGO POMIARU NA WŁASNYM MARKERZE — w tym repo, dziś, TRZY różne audyty tego samego kontraktu (Ustawień AI) dawały TRZY różne, częściowo sprzeczne obrazy stanu kodu, bo pisano je w różnych momentach dnia 2026-09-01, a kod między nimi się zmieniał. `docs/program/grafika/ZAPIS_USTAWIEN_AI_20260901.md` cytuje `server/src/routes/ai-settings.routes.ts` (BEZ `ai/`) — **ten plik nie istnieje na Twoim markerze** (zweryfikuj sam: `ls server/src/routes/ai-settings.routes.ts` → `No such file or directory`), więc każdy numer linii i każdy werdykt („piętro superadmina ZEPSUTE”) w tym dokumencie dotyczy pliku, którego dziś nie ma — **TRAKTUJ GO WYŁĄCZNIE JAKO TROP DO SPRAWDZENIA NA ŻYWYM `ai/ai-settings.routes.ts`, NIGDY JAKO GOTOWY FAKT.** Druga pułapka: `tests/integration/ai-settings-api.test.ts` nazywa się `describe('AI settings service - REAL_CODE'` i UŻYWA `mockResolvedValueOnce` na `dbGet` — to jest test WARSTWY SERWISU z mockiem bazy, NIE dowód trasy HTTP; nie licz go jako ochronę równoważną `org-ai-settings-camelcase.realdb.test.ts` (który idzie przez realny `ApiGateway`+Postgres).**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day250-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day250-ai-ustawienia-rodzina-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (KROK 0 — wypisz wszystkich 18 tras `ai-settings.routes.ts`, zmierz transformację Y/N per trasa, z dowodem plik:linia) · R2 (napraw `GET /api/ai-settings/effective`, żeby zwracał camelCase spójne z resztą pliku, metodą `transformSettingsToCamelCase`+`transformOrgSettingsToCamelCase`+analogiczny mapping dla piętra użytkownika, z realdb dowodem przed/po) · R3 (napisz `superadmin-ai-settings-camelcase.realdb.test.ts` — brakujący bliźniak `org-ai-settings-camelcase.realdb.test.ts`, ten sam wzorzec: realny Postgres, realny `ApiGateway`, para uprawnień) · R4 (sprostowanie `ZAPIS_USTAWIEN_AI_20260901.md` — nowa sekcja na końcu, dowód że cytowany plik nie istnieje na markerze, ponowny werdykt na żywym pliku) · R5 (raport dyżuru)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6240` albo `5220 i 5221` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6240` albo `5220 i 5221`** (`Z7`).

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

`docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md` zmierzyło (#1 w tabeli), że ekran
„Ustawienia AI organizacji" (`OrgAISettingsView.tsx`) czytał i zapisywał 18 pól przez
piętro organizacji (`GET`/`PUT /api/ai-settings/org/:orgId`) w dwóch NIEZGODNYCH
konwencjach nazw: front camelCase, serwer snake_case, zero mapowania w żadną stronę —
odczyt zawsze pokazywał domyślne, zapis zawsze cicho zapisywał z powrotem starą wartość.
Ten sam audyt zauważył, że narzędzie naprawy (`transformSettingsToCamelCase`/
`ToSnakeCase`) **istniało w tym samym pliku dla piętra superadmina, kilkadziesiąt linii
dalej** — i sformułował ogólną zasadę programu: **zgłoszona pozycja jest PRÓBKĄ, nie
zakresem** — jeśli ktoś raz naprawił wzorzec obok, trzeba sprawdzić, czy naprawił go
wszędzie.

**Na Twoim markerze (`df7f13056f`) piętro organizacji JEST już naprawione** —
`transformOrgSettingsToCamelCase`/`ToSnakeCase` (`ai-settings.routes.ts:149-155`, użyte
w `GET`/`PUT /org/:orgId`, linie 264-303 i 310-388) i chronione realnym testem
(`tests/integration/org-ai-settings-camelcase.realdb.test.ts` — realny Postgres, realny
`ApiGateway`, para uprawnień). To NIE JEST praca do wykonania w tym dyżurze — to jest
Twój **punkt odniesienia**, wzorzec do powielenia gdzie jeszcze go brakuje.

Plik `server/src/routes/ai/ai-settings.routes.ts` ma **18 tras w sumie** (policz sam,
`R1`, komenda `grep -c "router\.\(get\|put\|post\)("`). Naprawiona para (org GET+PUT) to
**2 z 18**. Ten dyżur bierze regułę „Krok 0: wypisz rodzinę" dosłownie: wypisuje
wszystkie 18, mierzy każdą osobno, i naprawia to, co realnie jest zepsute — nie to, co
zgłoszenie sugerowało jako zepsute z pamięci.

## ★★ Trzy sprzeczne audyty tego samego kontraktu, jeden dzień — dlaczego KROK 0 mierzysz Ty, nie cytujesz cudzego

W ciągu 2026-09-01 powstały TRZY niezależne dokumenty o Ustawieniach AI:

1. `docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md` — zmierzyło piętro organizacji jako
   zepsute, superadmina jako POPRAWNE (kontrast), NIE naprawiło niczego.
2. `docs/program/grafika/ZAPIS_USTAWIEN_AI_20260901.md` — zmierzyło (rzekomo) piętro
   organizacji ORAZ superadmina jako oba zepsute, cytując plik
   **`server/src/routes/ai-settings.routes.ts` — BEZ prefiksu `ai/`**.
3. Ten dyżur, na markerze `df7f13056f`.

**Zmierz sam, pierwszą czynnością (`R1`, komenda 1):** plik cytowany przez dokument #2
**nie istnieje** w tym repozytorium na Twoim markerze — istnieje wyłącznie
`server/src/routes/ai/ai-settings.routes.ts` (z prefiksem), zamontowany
`Gateway.ts:54,744`. Numery linii i werdykty dokumentu #2 („piętro superadmina
ZEPSUTE") dotyczą pliku, którego dziś nie ma na dysku — **to nie jest dowód o dzisiejszym
kodzie**, dopóki nie sprawdzisz go na żywym pliku. Sprawdziłeś już (przy pisaniu tej
instrukcji) — na żywym pliku piętro superadmina MA transformację (`ai-settings.routes.ts:
60-93,189-253`). Ale to jest MOJE zmierzenie sprzed wydania instrukcji — **Twoim
obowiązkiem jest powtórzyć ten pomiar na SWOIM markerze i wpisać własny wynik do
raportu**, nie przepisać mój.

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Plik `server/src/routes/ai-settings.routes.ts` (bez `ai/`) nie istnieje; jedyny zamontowany plik to `ai/ai-settings.routes.ts`, zamontowany DWA razy pod dwoma różnymi prefiksami | komenda (1) |
| T2 | Piętro organizacji (GET/PUT `/org/:orgId`) ma transformację i realdb test — JUŻ naprawione | komenda (2) |
| T3 | Piętro superadmina (GET/PUT `/superadmin`) MA transformację w żywym pliku | komenda (3) |
| T4 | Piętro superadmina NIE MA realdb testu równoważnego org — `ai-settings-api.test.ts` mockuje `dbGet`, nie dowodzi trasy HTTP | komenda (4) |
| T5 | `GET /effective` zwraca surowy, niespójny (mieszany snake_case) kształt bez żadnej transformacji | komenda (5) |
| T6 | Oba front-endowe wołacze `/effective` (`useAISettings.ts`, `Api.getAIEffectiveSettings`) są martwe — zero importerów | komenda (6) |
| T7 | Jeden żywy SERWEROWY konsument `/effective`-owego kształtu istnieje (`aiContextBuilder.ts`→`AIPipeline.ts`), broni się dual-key TYLKO dla 4 pól piętra użytkownika, zero obrony dla pól piętra organizacji | komenda (7) |
| T8 | `ZAPIS_USTAWIEN_AI_20260901.md` cytuje nieistniejącą ścieżkę pliku | komenda (8) |
| T9 | Miejsce na dysku wystarcza | komenda (9) |

---

# 3. POZYCJE DYŻURU

## R1 — KROK 0: WYPISZ WSZYSTKICH 18 TRAS, ZMIERZ TRANSFORMACJĘ PER TRASA (rdzeń, warunek wejścia)

Wykonaj wszystkie 9 komend `§0.1`. Następnie zbuduj tabelę — **dokładnie 18 wierszy**,
jeden na trasę, w kolejności deklaracji w pliku:

| # | Metoda + ścieżka | Linia | Ma transformację nazw? (TAK/NIE + dowód) | Kto woła (front żywy / serwer żywy / martwe / nieustalone) |
|---|---|---|---|---|
| 1 | `GET /superadmin` | 189 | … | … |
| 2 | `PUT /superadmin` | 214 | … | … |
| 3 | `GET /org/:orgId` | 264 | … | … |
| 4 | `PUT /org/:orgId` | 310 | … | … |
| 5 | `GET /user` | 398 | … | … |
| 6 | `PUT /user` | 429 | … | … |
| 7 | `GET /effective` | 491 | … | … |
| 8 | `GET /available-models` | 529 | … | … |
| 9 | `GET /proactivity` | 573 | … | … |
| 10 | `GET /proactivity/modes` | 609 | … | … |
| 11 | `GET /audit` | 640 | … | … |
| 12 | `GET /audit/org/:orgId` | 709 | … | … |
| 13 | `GET /user/costs` | 766 | … | … |
| 14 | `GET /org/:orgId/users/tiers` | 804 | … | … |
| 15 | `PUT /org/:orgId/users/:userId/tier` | 845 | … | … |
| 16 | `GET /org/:orgId/costs` | 901 | … | … |
| 17 | `GET /compliance/export/:format` | 947 | … | … |
| 18 | `POST /compliance/generate` | 1039 | … | … |

**Wypełnij kolumny 3 i 4 sam, `grep`/`sed -n` na żywym pliku — linie w tabeli wyżej są
punktem startu z markera, na Twoim mogły się przesunąć o kilka wierszy (dopisz
rzeczywiste).** Trasy 1-4 mają TAK (transformacja); mój wstępny pomiar (przy pisaniu tej
instrukcji) pokazał 5-18 jako NIE — **ale to Ty potwierdzasz to na swoim markerze**, nie
przepisujesz. Dla każdej trasy z „NIE" oceń kolumnę 4: czy jej pola w ogóle mają
kolizję nazw front/serwer (wiele z 5-18 zwraca dane, które nie mają odpowiednika
camelCase/snake_case po drugiej stronie — np. `/audit` zwraca listę wpisów audytu z
polami już zgodnymi, `/available-models` zwraca wiersze z bazy `llm_providers` czytane
bezpośrednio przez front bez modelu domenowego). **NIE zgłaszaj trasy jako defektu, jeśli
nie masz dowodu na żywego czytelnika, który oczekuje INNEJ nazwy niż trasa zwraca** —
to dokładnie pułapka „hipoteza jako fakt" z `Z34`.

## R2 — NAPRAW `GET /effective`: SPÓJNY CAMELCASE (rdzeń)

`GET /api/ai-settings/effective` (linia 491-518) dziś woła `AISettingsService.
getEffectiveSettings(userId, organizationId)` i zwraca wynik `res.json(effective)`
bez żadnej transformacji. `getEffectiveSettings()` (`aiSettingsService.ts:492-513`)
zwraca `{...superadmin, ...org, ...user, superadmin, org, user}` gdzie WSZYSTKIE trzy
zagnieżdżone obiekty są surowym, snake_case kształtem prosto z bazy (`getSuperAdminSettings`/
`getOrgSettings`/`getUserSettings` — żadna z tych trzech metod serwisu nie transformuje,
transformacja żyje WYŁĄCZNIE w warstwie tras).

To jest realny rozjazd konwencji: routes 1-4 tego samego pliku zwracają camelCase,
route 7 zwraca snake_case zmieszany z niespójnymi kluczami. Dziś ma to NISKI, nie zerowy,
wpływ biznesowy (`T7` — jedyny żywy konsument broni się dual-key dla 4 pól, reszta pól
piętra organizacji nie jest tam w ogóle czytana, a realne wymuszanie limitów budżetu
czyta bazę bezpośrednio, z pominięciem tego mechanizmu — **sprawdź to zdanie sam**, `R1`
komenda 7, i zapisz w raporcie czy to się zgadza czy nie).

**Napraw**, reużywając DOKŁADNIE istniejące funkcje transformacji (`Z35`/`ZAKAZ_
WLASCIWY`: zakaz nowego generycznego mechanizmu):

```ts
const effective = await AISettingsService.getEffectiveSettings(userId, organizationId);
return res.json({
  ...transformSettingsToCamelCase(effective.superadmin || {}),
  ...transformOrgSettingsToCamelCase(effective.org || {}),
  ...effective.user, // piętro użytkownika już jest w kształcie, który AISettings.tsx zna (dual-key na czytaniu)
  superadmin: transformSettingsToCamelCase(effective.superadmin || {}),
  org: transformOrgSettingsToCamelCase(effective.org || {}),
  user: effective.user,
});
```

(Dostosuj dokładnie do sygnatur — to jest szkic kierunku, nie gotowy diff do wklejenia
bez czytania; sprawdź typy `transformSettingsToCamelCase`/`transformOrgSettingsToCamelCase`
zanim złożysz finalny kod.) **Dowód: realny GET `/api/ai-settings/effective` na
zasianych danych organizacji + użytkownika, porównanie WARTOŚCI pól przed/po zmianie —
`policyLevel`, `maxTokensPerMonth` i 3 inne pola piętra organizacji muszą pojawić się w
odpowiedzi z poprawną nazwą i poprawną wartością (nie domyślną).** Zaktualizuj
`tests/integration/ai-settings-api.test.ts` (`getEffectiveSettings merges...`, linia 50)
ALBO dopisz nowy przypadek w tym samym pliku, jeśli istniejący test mockuje na poziomie
serwisu i nie może dowieść trasy HTTP — rozstrzygnij sam, k

tóry plik jest właściwy, i zapisz decyzję w raporcie.

## R3 — NAPISZ REALDB TEST DLA PIĘTRA SUPERADMINA (rdzeń)

Piętro organizacji ma `tests/integration/org-ai-settings-camelcase.realdb.test.ts` —
realny Postgres, realny `ApiGateway.getInstance().initializeRoutes(app)`, podpisany JWT,
trzy `it()`: odczyt, para zapisu (PUT ciałem camelCase → niezależny GET widzi nowe
wartości → SQL SELECT surowych kolumn potwierdza), para uprawnień (obcy `403` bez
zmiany / własny działa). Piętro superadmina ma DOKŁADNIE TĘ SAMĄ transformację
(`transformSettingsToCamelCase`/`ToSnakeCase`) w tym samym pliku, ale **zero
równoważnej ochrony** (`T4`).

Napisz `tests/integration/superadmin-ai-settings-camelcase.realdb.test.ts` —
**kopiuj strukturę** `org-ai-settings-camelcase.realdb.test.ts` 1:1 (ten sam wzorzec:
`beforeAll` zasiewa `superadmin_ai_settings` bezpośrednio SQL-em w snake_case,
`GET /api/ai-settings/superadmin` musi zwrócić camelCase zgodny z zasianymi wartościami,
`PUT` ciałem camelCase + niezależny GET + surowy SQL SELECT muszą się zgadzać, oraz
para uprawnień: nie-superadmin dostaje `403`, superadmin działa normalnie). Sprawdź
najpierw realną nazwę tabeli i kolumn (`server/migrations/` — `grep -rn
"superadmin_ai_settings"`), bo `DEFAULT_SUPERADMIN`/kolumny mogą się różnić nazwami od
`organization_ai_settings`. **Test MUSI realnie paść na kodzie SPRZED tej pozycji, jeśli
transformacja w ogóle zniknie** — zanim uznasz pozycję za zrobioną, potwierdź `Z32`
(dowód mutacyjny w obie strony: cofnij `transformSettingsToCamelCase` w GET → czerwono;
przywróć przez `cp` → zielono).

## R4 — SPROSTOWANIE `ZAPIS_USTAWIEN_AI_20260901.md` (rdzeń, dokumentacyjny)

Dopisz na końcu `docs/program/grafika/ZAPIS_USTAWIEN_AI_20260901.md` nową sekcję
(NIE kasujesz istniejącej treści, `J`):

```
## Sprostowanie 2026-09-01 (dyżur 250) — plik cytowany w tym dokumencie nie istnieje

`server/src/routes/ai-settings.routes.ts` (bez prefiksu `ai/`), cytowany w sekcjach 1 i
4 tego dokumentu jako źródło numerów linii i werdyktu „piętro superadmina ZEPSUTE", NIE
ISTNIEJE w repozytorium na SHA `df7f13056f` (`ls` → `No such file or directory`).
Jedyny zamontowany plik tego kontraktu jest `server/src/routes/ai/ai-settings.routes.ts`
(`Gateway.ts:54,744`; DRUGI mount pod `/api/ai/settings` przez `routes/ai/index.ts:64` —
patrz dyżur 250, `R1`). Na TYM pliku piętro superadmina MA transformację
(`transformSettingsToCamelCase`/`ToSnakeCase`, linie 60-93,189-253) — sprzeczne z
werdyktem tego dokumentu. Nie ustalono, czy dokument analizował plik, który od tego
czasu usunięto (dead-code cleanup), czy od początku błędną ścieżkę — obie hipotezy są
zgodne z dostępnym dowodem. Werdykt „POTWIERDZONE" w nagłówku dotyczy PIĘTRA
ORGANIZACJI (sekcja 1, wiersz „Organizacja: ZEPSUTE") — TO pozostaje prawdziwe i
zgodne z niezależnym `AUDYT_ROZJAZDY_NAZW_POL.md`; nieprawdziwa jest wyłącznie część o
piętrze superadmina.
```

Dostosuj treść do tego, co realnie zmierzyłeś w `R1` — powyższe jest szkicem opartym na
moim pomiarze sprzed wydania instrukcji, nie gotowym tekstem do wklejenia bez
weryfikacji.

## R5 — RAPORT DYŻURU (rdzeń)

Sekcje: streszczenie, tabela 18 tras z `R1` w całości, `R2`-`R4` z pełnymi dowodami,
sekcja „TWIERDZENIA NIEZWERYFIKOWANE" (obowiązkowa nawet pusta), sekcja „Korekty wobec
instrukcji" (obowiązkowa nawet pusta — w szczególności: czy podwójny mount
`/api/ai-settings` + `/api/ai/settings` okazał się problemem realnym czy nieszkodliwym
duplikatem; czy `R1` znalazł którąkolwiek z tras 8-18 z realną kolizją nazw, której nie
przewidziałem).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (PEŁNA, `R2`) | `server/src/routes/ai/ai-settings.routes.ts` — WYŁĄCZNIE handler `GET /effective`, zakaz zmiany pozostałych 17 tras |
| Zapis (PEŁNA, NOWY PLIK, `R3`) | `tests/integration/superadmin-ai-settings-camelcase.realdb.test.ts` (`git add -f`, `Z18`-sąsiedztwo: katalog `tests/integration/` jest NOWYM plikiem dozwolonym, sam `tests/setup.ts` pozostaje tylko-do-odczytu) |
| Zapis (WĄSKO, `R4`/`J`) | `docs/program/grafika/ZAPIS_USTAWIEN_AI_20260901.md` — WYŁĄCZNIE nowa sekcja na końcu, zakaz kasowania istniejącej treści i zakaz zmiany nagłówkowego „POTWIERDZONE" |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY250_AI_USTAWIENIA_RODZINA_REPORT.md` |
| Zapis (WARUNKOWO, `R2`) | `tests/integration/ai-settings-api.test.ts` — WYŁĄCZNIE jeśli `R1` potwierdzi, że istniejący test `getEffectiveSettings merges...` (linia ok. 50) trzeba rozszerzyć zamiast dopisywać nowy plik; decyzję zapisujesz w raporcie |
| Odczyt (ZAKAZ ZAPISU) | `src/views/admin/OrgAISettingsView.tsx` · `src/components/SuperAdmin/SuperAdminAISettings.tsx` · `src/components/settings/AISettings.tsx` · `src/hooks/useAISettings.ts` · `src/services/api.ts` · `server/src/services/aiSettingsService.ts` · `server/src/services/aiContextBuilder.ts` · `server/src/services/ai/AIPipeline.ts` · `tests/integration/org-ai-settings-camelcase.realdb.test.ts` (wzorzec do kopiowania, nie do zmiany) |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md` (`Z14`-sąsiedztwo — kanoniczny audyt, nie Twój do zmiany) · `server/src/Gateway.ts` · `server/src/routes/ai/index.ts` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **KROK 0 JEST WARUNKIEM WEJŚCIA DO `R2`/`R3`.** Nie naprawiasz `/effective` ani nie
  piszesz testu superadmina, dopóki tabela 18 tras w `R1` nie jest kompletna i policzona
  na TWOIM markerze.
- ★★ **CUDZY AUDYT TEGO SAMEGO TEMATU MOŻE CYTOWAĆ NIEISTNIEJĄCY PLIK.** Zanim
  zacytujesz `plik:linia` z JAKIEGOKOLWIEK dokumentu spoza tej instrukcji, sprawdź `ls`
  na ten plik na swoim markerze.
- ★ **Piętro organizacji jest WZORCEM, nie zadaniem.** Kopiujesz jego mechanizm
  (`mapKeys`, pole-mapa) i jego test (strukturę realdb), nie zmieniasz jego zachowania.
- ★ **Dowód zapisu: WYŁĄCZNIE porównanie wartości po niezależnym ponownym odczycie** —
  nie kod `200`, nie `updated_at`, nie liczba wierszy zmienionych.
- ★ **Para dowodowa, oba człony:** dla `R3` — obcy administrator dostaje `403` bez
  zmiany wartości, WŁASNY superadmin nadal działa normalnie. Sama odmowa dla wszystkich
  dałaby fałszywie zielony wynik.
- ★ **Dowód mutacyjny (`Z32`) obowiązkowy dla `R3`** — cofnij transformację, pokaż
  czerwono, przywróć przez `cp` (`Z27` — nigdy `git stash`), pokaż zielono, `git diff`
  czysty.
- ★ **`Z10`/`Z11`:** zero nowych flag, zero zmiany istniejącej wartości domyślnej.
- ★ **Pułapki środowiska — sprawdź każdą u siebie:** `Database.ts:80-88` atrapa bazy bez
  `RUN_DB_TESTS=1` · `vitest.config.ts:210` przypina `DB_TYPE='sqlite'` ·
  `tests/setup.ts:896` podmienia `global.fetch` · `Z31` (strażnik realdb bez argumentów).
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej
  sekcji jest podstawą odrzucenia dyżuru.
