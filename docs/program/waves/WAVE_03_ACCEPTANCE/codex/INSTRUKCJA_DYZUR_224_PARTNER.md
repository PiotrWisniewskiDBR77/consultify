# INSTRUKCJA DYŻURU nr 224 — Codex — „Partner — trzy pozycje po naprawach dyżurów 188/189: żywy dowód baneru rozliczeń na porcie kanonicznym, obcięta prawa kolumna tabeli Organizacji (PRT-D112-003, brakujący opt-in minTableWidth), i rozstrzygnięcie „Users: 0” — defekt czy uczciwa liczba"

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
> **wyłącznie** `/private/tmp/cx-day224-partner`.

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
Zakres: **16 Partner — src/views/partner/sections/EarningsSection.tsx (baner rozliczeń), src/views/partner/PartnerPortalView.tsx (tabela Organizacji, FilterableTable), src/components/shared/ModuleHub/FilterableTable.tsx (WYŁĄCZNIE odczyt — prop minTableWidth), server/src/services/partnerReferralService.ts (getPartnerClients — źródło users/userCount). Kontrakt: docs/program/funkcje/POMIAR_MODULOW_2026-08-31_WIECZOR.md sekcja „16 Partner”, docs/program/funkcje/FALA_Z1_2026-08-31.md wiersz 16 Partner, docs/program/funkcje/PAKIET_WERDYKT_PARTNER.md, docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY112_PARTNER_OWNER_REPORT.md (PRT-D112-003), docs/program/waves/WAVE_03_ACCEPTANCE/modules/16_PARTNER/MODULE_ACCEPTANCE.md. ★ Ekonomia partnera (prowizje/wypłaty/accrual) zostaje WYŁĄCZONA — AMD-PRT-ECONOMICS-002 / 410 PARTNER_ECONOMICS_POLICY_DISABLED NIE jest w zakresie i NIE jest ruszana.**.
Trasy front: `src/views/partner/sections/EarningsSection.tsx (blok `error && !summary && programStatus` — baner bursztynowy ok. linii 570-593, klucze i18n `partner.earnings.policyUnavailableTitle`/`payoutOperationsUnavailable`); src/views/partner/PartnerPortalView.tsx (ClientsSection, subsection='organizations', FilterableTable ok. linii 1264-1358, sześć kolumn: name/industry/users/projects/assessmentScore/status, BRAK propa `minTableWidth` — dziedziczy domyślne `DEFAULT_MIN_TABLE_WIDTH=980` z src/components/shared/ModuleHub/FilterableTable.tsx)`. Trasy tył: `GET /api/v8/partner/earnings-summary (server/src/routes/v8/partner.routes.ts, zmierz linię — na markerze ok. :1080-1127) -> PartnerCommissionService.getEarningsSummary + PartnerProgramLedgerService.getProgramStatusDetail + PartnerCommissionService.getPayoutEligibility (catch na PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER, fallback payoutEligibility.reason='POLICY_NOT_APPROVED' — naprawa dyżuru 188, R1). GET /api/v8/partner/clients (server/src/routes/v8/partner.routes.ts ok. :551-581) -> PartnerReferralService.getPartnerClients (server/src/services/partnerReferralService.ts ok. :1383-1520) — realne zapytania COUNT do tabel `projects`/`users` per organization_id, z catch->warn->fallback 0 przy błędzie zapytania; komentarz w kodzie ok. :1452-1454 mówi wprost, że na demo atrybucje bywają sierotami (organization_id bez wiersza w `organizations`)`.

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
WT=/private/tmp/cx-day224-partner
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
git -C "$VAULT" worktree add "$WT" -b codex/day224-partner-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day224-partner/config.worktree"
cat "$VAULT/worktrees/cx-day224-partner/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day224-partner-scratch
mkdir -p /private/tmp/cx-day224-partner-artefakty

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
git -C "$WT" push github-backup codex/day224-partner-20260901
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
cd /private/tmp/cx-day224-partner

# (W1) TEZA 1: dyzur 188 naprawil earnings-summary na 200 + payoutEligibility fallback
sed -n '1078,1128p' server/src/routes/v8/partner.routes.ts
#   oczekiwane: catch na PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER zwraca obiekt z
#   reason:'POLICY_NOT_APPROVED', NIE rzuca dalej -> odpowiedz 200.

# (W2) TEZA 1 c.d.: skutek dla banera EarningsSection.tsx — czy warunek error&&!summary nadal moze byc PRAWDA
sed -n '555,600p' src/views/partner/sections/EarningsSection.tsx
grep -n "setError\|catch" src/views/partner/sections/EarningsSection.tsx | head -10
#   oczekiwane: ustal, czy po fixie 188 `error` w ogole moze byc ustawiony dla samej
#   sciezki earnings-summary (skoro ona teraz zawsze zwraca 200) — jesli NIE, ten
#   konkretny bursztynowy baner jest dzis NIEOSIAGALNY tą sciezką i realny UI po
#   naprawie wyglada INACZEJ niz zrzut z dnia 189 (ktory mogl byc sprzed wejscia fixu
#   do gałęzi uruchomieniowej).

# (W3) TEZA 2: Organizacje uzywaja FilterableTable, bez propa minTableWidth
grep -n "FilterableTable\|minTableWidth" src/views/partner/PartnerPortalView.tsx | sed -n '1,10p'
#   oczekiwane: wywolanie FilterableTable dla subsection='organizations' (ok. :1264) NIE
#   przekazuje `minTableWidth` — dziedziczy domyslne zachowanie.

# (W4) TEZA 2 c.d.: domyslne zachowanie to zahardkodowane 980px, addytywny opt-in istnieje
sed -n '150,182p' src/components/shared/ModuleHub/FilterableTable.tsx
grep -n "DEFAULT_MIN_TABLE_WIDTH\s*=\|AUTO_MIN_WIDTH_COLUMN_THRESHOLD\s*=" src/components/shared/ModuleHub/FilterableTable.tsx
#   oczekiwane: DEFAULT_MIN_TABLE_WIDTH=980, prop minTableWidth (`number | 'auto' | 'columns'`)
#   jest ADDYTYWNY — domyslnie odtwarza stare 980px. AUTO_MIN_WIDTH_COLUMN_THRESHOLD=2
#   (Organizacje maja 6 kolumn danych — 'columns' NIE pomoglyby, potrzebne 'auto').

# (W5) TEZA 2 c.d.: ile z 26 wywolan FilterableTable w calym repo opiekuje sie propem
grep -rl "<FilterableTable" src --include="*.tsx" | grep -v __tests__ | wc -l
grep -rl "minTableWidth" src --include="*.tsx" | grep -v __tests__ | wc -l
#   oczekiwane: 26 wywolan calkowitych, tylko czesc (na markerze zmierz sam) przekazuje
#   minTableWidth — Partner Organizacje NIE jest wsrod nich.

# (W6) TEZA 3: users/userCount w API Organizacji to REALNE zapytanie COUNT, nie 0 na sztywno
sed -n '1383,1520p' server/src/services/partnerReferralService.ts | grep -n "COUNT(\*)\|userCountByOrg\|orphan\|sierot"
#   oczekiwane: prawdziwe `SELECT organization_id, COUNT(*) ... FROM users ... GROUP BY
#   organization_id`, z catch->warn->fallback pustej mapy (=0 dla kazdej org) przy bledzie
#   zapytania; komentarz o "orphan" atrybucjach na demo.

# (W7) port kanoniczny runtime — NIE robocza baza dyzuru 188
grep -n "start-wave3-owner-runtime\|PORT\|port" scripts/dev/start-wave3-owner-runtime.mjs | head -10
#   oczekiwane: skrypt uzywa portu innego niz 6108/5048/5049 (te byly przypisane dyzurowi
#   188 — NIE Twoje, `Z7`/`Z6`); Twoj kanoniczny runtime dziala na porcie TEGO dyzuru.

# (W8) karta modulu 16 nie jest CLOSED_FINAL
grep -n "Current gate" docs/program/waves/WAVE_03_ACCEPTANCE/modules/16_PARTNER/MODULE_ACCEPTANCE.md
#   oczekiwane: TECHNICAL_BROWSER_PASS / OWNER_PENDING / ECONOMICS_OFF — nie CLOSED_FINAL,
#   wolno dopisac.

# (W9) ekonomia partnera zostaje wylaczona — potwierdz ze nie ma zadnej zmiany w tym obszarze
grep -n "PARTNER_ECONOMICS_POLICY_DISABLED\|AMD-PRT-ECONOMICS-002" server/src/routes/v8/partner.routes.ts | head -5
#   oczekiwane: istnieje, NIE dotykasz.

# (W10) PORTY I KONTENERY
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(6167|5122|5123)\b' || echo "6167/5122/5123 wolne"
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day224-partner-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6167`. Twój JEDYNY port harnessu to `5122 i 5123`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day224-pg`**. **ZAKAZANE:** `na stałe: 5000, 5037, 5060-5061; zajęte przez dyżury wcześniejsze i odbiory nadzorcy (w tym 6108/5048/5049 dyżur 188 — jednorazowa robocza baza, NIE Twoja, nie adoptujesz jej): 6012, 5433, 6047, 6054-6164, 5010-5117, 6404-6411; zabronione na przód (fala 18): 6170-6175, 5128-5139; CUDZE w TEJ SAMEJ fali Z1 (222-225, pomijasz własne): baza 6165 (222) / 6166 (223) / 6168 (225), harness 5118-5119 (222) / 5120-5121 (223) / 5124-5125 (225). Twój wyłączny przydział: baza 6167, harness 5122 i 5123, kontener cx-day224-pg`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur nie tworzy, nie włącza i nie wyłącza żadnej flagi funkcyjnej. Ekonomia partnera (AMD-PRT-ECONOMICS-002, 410 PARTNER_ECONOMICS_POLICY_DISABLED) zostaje WYŁĄCZONA i NIE jest dotykana w żadnym punkcie tego dyżuru`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `server/src/middleware/auth.middleware.ts (verifyToken) · server/src/Gateway.ts (ApiGateway.initializeRoutes) · server/src/middleware/v8FeatureGate.middleware.ts · server/src/middleware/resultsInternalBetaVisibility.middleware.ts · server/src/services/aiRoleGuard.ts · server/src/services/aiPolicyEngine.ts · requirePartnerEconomicsReadAccess (server/src/routes/v8/partner.routes.ts) — bramka ekonomii, ZAKAZ zmiany zachowania — żadnej nie dotykasz`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY224_PARTNER_REPORT.md`. docs/program/waves/WAVE_03_ACCEPTANCE/modules/16_PARTNER/MODULE_ACCEPTANCE.md — WYŁĄCZNIE dopisanie notatki o trzech pozycjach (§R.1), zero zmiany `Current gate` bez decyzji właściciela; docs/program/funkcje/PAKIET_WERDYKT_PARTNER.md — WYŁĄCZNIE aktualizacja sekcji „OTWARTE POZYCJE” (punkty 2-4) o wynik tego dyżuru, zero zmiany reszty pliku. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day224-partner-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day224-partner-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | zakaz jakiejkolwiek zmiany w `requirePartnerEconomicsReadAccess`, w routingu `410 PARTNER_ECONOMICS_POLICY_DISABLED` i w ogóle w zachowaniu ekonomii partnera (prowizje/wypłaty/accrual) — zostaje WYŁĄCZONA; zakaz zmiany `DEFAULT_MIN_TABLE_WIDTH` albo `AUTO_MIN_WIDTH_COLUMN_THRESHOLD` w `FilterableTable.tsx` (zmiana stałej dotyka ok. 26 list w całym produkcie) — wolno Ci wyłącznie przekazać `minTableWidth` jako prop z poziomu `PartnerPortalView.tsx` | AMD-PRT-ECONOMICS-002 to świadoma decyzja zakresu MVP, nie defekt — ruszenie jej byłoby poza mandatem tego dyżuru; zmiana stałych w `FilterableTable.tsx` ma blast radius 26 ekranów w całym produkcie i wymaga osobnej fali regresji, nie jednego dyżuru Partnera |

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
cd /private/tmp/cx-day224-partner

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day224-pg psql -U postgres -d cx224 \
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
cd /private/tmp/cx-day224-partner

docker run -d --name cx-day224-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx224 \
  -p 127.0.0.1:6167:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day224-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6167/cx224 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6167/cx224 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day224-partner && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6167/cx224 \
JWT_SECRET=cx224-test-secret-do-not-reuse \
npx vitest run src/views/partner/__tests__/PartnerPortalView.organizationsColumnWidth.day224.test.tsx (NOWY) · server/src/services/__tests__/partnerReferralService.userCounts.day224.pg.test.ts (NOWY, real-PG, dowód dla pozycji c) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day224-partner-artefakty/day224-partner.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day224-partner && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/views/partner/__tests__/PartnerPortalView.organizationsColumnWidth.day224.test.tsx (NOWY) · server/src/services/__tests__/partnerReferralService.userCounts.day224.pg.test.ts (NOWY, real-PG, dowód dla pozycji c) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day224-partner-artefakty/day224-partner.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day224-partner/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day224-pg psql -U postgres -d cx224 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day224-pg`.
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
> **(e) ★ `FilterableTable` ma sticky kolumnę akcji (`w-20`, `sticky right-0`) doliczaną do bilansu szerokości w `columnFit` — przy zmianie `minTableWidth` na `'auto'` sprawdź, czy ta kolumna nadal nie przykrywa ogona ostatniej kolumny danych (`assessmentScore`) na wąskim viewport; dowód: zrzut przy 1280px I przy szerokości mobile z widoczną, nieukrytą kolumną statusu**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day224-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day224-partner-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`§A.2 (kolumna Organizacji) i §A.3 (Users: 0) są rdzeniem obowiązkowym, bo mają jasny, weryfikowalny fix; §A.1 (dowód banera) jest rdzeniem dowodowym — jeśli W2 pokaże, że stary baner jest dziś nieosiągalny tą ścieżką, rdzeniem staje się UCZCIWE udokumentowanie NOWEGO zachowania, nie odtworzenie starego zrzutu za wszelką cenę`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6167` albo `5122 i 5123` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6167` albo `5122 i 5123`** (`Z7`).

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

`docs/program/funkcje/POMIAR_MODULOW_2026-08-31_WIECZOR.md` (sekcja „16 Partner —
tablica myliła stan sprzed dyżuru ze stanem dzisiejszym") i
`docs/program/funkcje/PAKIET_WERDYKT_PARTNER.md` (sekcja 3 „OTWARTE POZYCJE") mówią:
dyżur 177 przejechał 25/25 sekcji, dyżur 188 naprawił mutacyjnie dwa błędy backendu
(earnings-summary 500→200, projects `uuid=text`), dyżur 189 naprawił polszczyznę na
4 ekranach — a mimo to zostają TRZY pozycje bez żywego dowodu albo bez rozstrzygnięcia.
★ Ekonomia partnera (prowizje/wypłaty/accrual, `AMD-PRT-ECONOMICS-002`) zostaje
**WYŁĄCZONA** — to świadoma decyzja zakresu MVP, nie defekt, i ten dyżur jej NIE rusza.

**Zweryfikowane przy pisaniu tej instrukcji (nadzorca, na tipie `9fb7942a01`, 01.09):**

1. **Baner rozliczeń — R1 dyżuru 188 zmienił WARUNEK, pod którym baner w ogóle się
   pokazuje.** `GET /api/v8/partner/earnings-summary`
   (`server/src/routes/v8/partner.routes.ts`, zmierz linię — na markerze ok. `:1080-1127`)
   dziś **zawsze zwraca `200`**: `payoutEligibility` ma `catch` na
   `PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER`, zwracający obiekt z `reason:'POLICY_NOT_APPROVED'`
   zamiast rzucać dalej. `EarningsSection.tsx` ma bursztynowy baner „Partner economics
   unavailable" (`policyUnavailableTitle`) renderowany WYŁĄCZNIE w gałęzi `error && !summary
   && programStatus` (ok. `:568-593`). **Jeśli `earnings-summary` już nigdy nie zwraca
   błędu, ta konkretna gałąź może być dziś NIEOSIĄGALNA** — ekran po naprawie może
   wyglądać zupełnie inaczej niż zrzut z dnia 189 (który mógł być zrobiony przed
   wejściem fixu do gałęzi uruchomieniowej, albo dotyczyć innej gałęzi kodu w
   `EarningsSection.tsx`). **To jest rzecz, którą MUSISZ zmierzyć (`W2`), nie założyć.**
   `pakiet_partner.md` cytuje wprost recenzentów: „baner earnings do decyzji właściciela"
   i wymaga pokazania ekranu na ŻYWO, na **porcie kanonicznym runtime**, NIE na roboczej
   bazie dyżuru 188 (`6108`/`5048`/`5049` — cudze zasoby, `Z6`/`Z7`).
2. **PRT-D112-003 — obcięta prawa kolumna tabeli Organizacji ma zidentyfikowaną
   przyczynę.** Tabela (`src/views/partner/PartnerPortalView.tsx`, `ClientsSection`,
   `subsection==='organizations'`, `FilterableTable` ok. `:1264-1358`) ma SZEŚĆ kolumn
   danych (name/industry/users/projects/assessmentScore/status) i **NIE przekazuje
   propa `minTableWidth`** — dziedziczy więc domyślne zachowanie
   `src/components/shared/ModuleHub/FilterableTable.tsx`:
   `DEFAULT_MIN_TABLE_WIDTH = 980` (px), zahardkodowane, **addytywny opt-in**
   (komentarz w kodzie tego pliku, ok. `:161-176`, opisuje WPROST ten sam mechanizm,
   który powodował „736 px poziomego przewijania UKRYTEGO wewnątrz `overflow-x-auto`").
   Ten sam plik oferuje już bezpiecznik: `minTableWidth="auto"` (bez wymuszonej
   minimalnej szerokości, tabela zwęża się do kontenera) albo `"columns"` (próg
   `AUTO_MIN_WIDTH_COLUMN_THRESHOLD = 2` — **przy 6 kolumnach Organizacji `"columns"`
   NIC by nie zmieniło**, bo 6 > 2, min-width zostałby 980px tak czy inaczej — potrzebne
   jest `"auto"`). **Tylko część z 26 wywołań `FilterableTable` w całym repo w ogóle
   przekazuje `minTableWidth`** — Organizacje Partnera do nich NIE należą (zmierz `W5`
   sam). To jest dokładnie wzorzec „biblioteka bez wywołania": bezpiecznik zbudowany,
   ale nieprzyjęty na tym konkretnym ekranie.
3. **„Users: 0" — backend liczy REALNIE, nie zwraca zera na sztywno.**
   `PartnerReferralService.getPartnerClients`
   (`server/src/services/partnerReferralService.ts`, ok. `:1383-1520`) robi prawdziwe
   `SELECT organization_id, COUNT(*) FROM users WHERE organization_id IN (...) GROUP BY
   organization_id` (ok. `:1422-1433`), z `catch` logującym `warn` i fallbackiem do
   PUSTEJ mapy przy błędzie zapytania (czyli `?? 0` dla KAŻDEJ organizacji — `:1491`).
   Kod ma też komentarz (ok. `:1452-1454`) mówiący wprost: „na demo every attribution is
   an orphan (its organization_id has no row there)" — czyli atrybucje partnera na
   danych demo/fixture bywają SIEROTAMI, których `organization_id` nie odpowiada żadnemu
   realnemu wierszowi w `organizations`/`users`. **„Users: 0" może więc być UCZCIWĄ
   liczbą (fixture nie ma tam użytkowników) ALBO skutkiem połkniętego błędu zapytania
   (warn w logu) ALBO skutkiem sierocej atrybucji — trzy różne przyczyny, trzy różne
   werdykty, i tylko Twój pomiar na żywej bazie je rozróżni.**

---

# 2. TEZY ZLECENIA

| # | Teza | Jak weryfikujesz | Co, jeśli teza padnie |
| --- | --- | --- | --- |
| T1 | Backend earnings-summary zwraca dziś 200 zawsze (dyżur 188 naprawił) | `W1` | Jeśli nadal 500 w jakimś przypadku — to jest REGRESJA warta osobnego zgłoszenia, nie Twoja naprawa w tym dyżurze (poza zakresem, `Z17`) |
| T2 | Organizacje nie przekazują `minTableWidth`, dziedziczą 980px | `W3`-`W5` | Jeśli już przekazują — pozycja `§A.2` staje się WYŁĄCZNIE testem regresyjnym potwierdzającym istniejący fix |
| T3 | `users`/`userCount` w API Organizacji to realne zapytanie COUNT z fallbackiem 0 na błąd | `W6` | Jeśli kod się zmienił (np. zniknął fallback) — opisz różnicę w „Korektach" |
| T4 | Ekonomia partnera pozostaje WYŁĄCZONA i nie jest w zakresie | `W9` | Nie dotyczy — to jest twardy warunek zlecenia, nie hipoteza do obalenia |

---

# 3. POZYCJE DYŻURU

## §A.1 — Żywy dowód baneru rozliczeń PO naprawie backendu, na porcie kanonicznym

**Cel:** zrzut ekranu earnings/statements/payouts/payout-settings Partnera, zrobiony
NA ŻYWO, na kanonicznym runtime tego dyżuru (port TEGO dyżuru, nie `6108`/`5048`/`5049`
z dyżuru 188), pokazujący RZECZYWISTY dzisiejszy stan UI po fixie backendu.

**Krok 1 — zmierz, czy stary baner jest dziś w ogóle osiągalny** (`W2`). Dwa możliwe
wyniki, oba akceptowalne — różni się WYŁĄCZNIE to, co pokazujesz na zrzucie:
- **(a) Baner nadal się pokazuje** (bo `error` może być ustawiony z innego powodu niż
  `PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER`, np. sieć/timeout w innym z trzech równoległych
  wywołań w `Promise.all`) — zrób zrzut TEGO stanu, potwierdź że treść banera jest
  sensowna (nie pokazuje kwot, nie kłamie o dostępności).
- **(b) Baner jest dziś nieosiągalny tą ścieżką** — `earnings-summary` zawsze `200`,
  więc ekran renderuje NORMALNY widok z `payoutEligibility.reason='POLICY_NOT_APPROVED'`
  i wartościami `null`/`0` z definicji (ekonomia OFF). Zrób zrzut TEGO stanu i opisz w
  raporcie WPROST: „stary bursztynowy baner z dnia 189 nie jest już osiągalny tą ścieżką
  po fixie 188; oto co użytkownik widzi zamiast niego, i to NIE jest defekt".

**Krok 2 — runtime.** Kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na
efemerycznej lokalnej bazie TEGO dyżuru (`cx224`, port `6167`), po dowodach `§0.2b`
(a)/(b). Zaloguj się kontem partnera seedowanym w Twojej bazie. Otwórz kolejno
earnings/statements/payouts/payout-settings — zrzut jasny + ciemny dla PRZYNAJMNIEJ
earnings (reszta: przynajmniej jeden motyw, jeśli budżet czasu się kończy — zaznacz to
w raporcie).

**DoD `§A.1`:**
- co najmniej dwa pliki PNG (earnings, jasny+ciemny) w `/private/tmp/cx-day224-partner-artefakty`, `shasum -a 256`
  w raporcie;
- jawne zdanie w raporcie: który z dwóch wyników (a)/(b) zaobserwowałeś, z cytatem
  odpowiedniego fragmentu `EarningsSection.tsx` i `partner.routes.ts`;
- deklaracja `§0.2b` (poczta jest atrapą) obowiązkowa;
- **NIE pokazujesz kwot/prowizji/wypłat jako realnych liczb** — ekonomia jest OFF,
  wszystkie wartości ekonomiczne to `null`/`0` z definicji, nie dowód działania silnika
  rozliczeń (`pakiet_partner.md`, sekcja 4).

## §A.2 — Prawa kolumna tabeli Organizacji ma być widoczna, nie ucięta

**Cel:** tabela Organizacji (`PartnerPortalView.tsx`, `subsection==='organizations'`)
pokazuje wszystkie sześć kolumn (włącznie z „Assessment"/„OCENA") bez ukrytego
przewijania na typowym viewport (1280px — wzorzec z `CODEX_DAY112_PARTNER_OWNER_REPORT.md`).

**Naprawa:** dopisz `minTableWidth="auto"` do wywołania `FilterableTable` dla Organizacji
(ok. `:1264`). **NIE zmieniasz `DEFAULT_MIN_TABLE_WIDTH` ani `AUTO_MIN_WIDTH_COLUMN_THRESHOLD`
w `FilterableTable.tsx`** — to stałe współdzielone przez ok. 26 list w całym produkcie
(`Z12`-klasy blast radius), zmiana ich wartości jest POZA zakresem i POZA licencją tego
dyżuru. Jedyna dozwolona zmiana to przekazanie propa z poziomu `PartnerPortalView.tsx`.

**Po zmianie sprawdź `PULAPKA_WLASCIWA_TEMU_MODULOWI` (`§0.2e (e)`, patrz Część A):**
sticky kolumna akcji (`w-20`, `right-0`) może przy `'auto'` nadal przykrywać ogon
ostatniej kolumny danych na wąskim viewport — zrób DWA zrzuty (1280px i mobile ~375px)
i potwierdź, że kolumna statusu jest w OBU widoczna, nie przykryta.

**DoD `§A.2`:**
- nowy test `src/views/partner/__tests__/PartnerPortalView.organizationsColumnWidth.day224.test.tsx`
  — dowód mutacyjny: PRZED naprawą (kopia sprzed zmiany, `cp`, `Z27`) test asertuje
  brak `minTableWidth` na propsach `FilterableTable` (albo mierzy realną szerokość
  renderowanej tabeli > kontenera) i jest CZERWONY; PO naprawie — ZIELONY; cofnięcie
  przez `cp` przywraca czerwień. Oba przebiegi w raporcie (`Z32`);
  jeśli test na realną szerokość DOM w JSDOM jest niewiarygodny (brak layoutu), dopuszczalna
  alternatywa: test asertujący WPROST wartość propa `minTableWidth==='auto'` przekazanego
  do `FilterableTable` (płytszy, ale deterministyczny — uzasadnij wybór w raporcie);
- dwa zrzuty (1280px, mobile) potwierdzające widoczność WSZYSTKICH sześciu kolumn,
  `shasum -a 256` w raporcie;
- reszta wywołań `FilterableTable` w repo (pozostałe 25) — **NIE dotykasz żadnego z
  nich** (`Z17`), jeśli Twój test jednostkowy przypadkiem je obejmuje, ogranicz zasięg.

## §A.3 — „Users: 0" — rozstrzygnięcie defekt vs. uczciwa liczba

**Cel:** jednoznaczny werdykt z dowodem, dla KTÓREGO z trzech możliwych powodów (patrz
sekcja 1, punkt 3) kolumna „Users" pokazuje 0 dla organizacji widocznych na ekranie
Partnera w Twojej bazie fixture.

**Procedura pomiaru (wykonaj w tej kolejności):**
1. Uruchom runtime, zaloguj partnera, otwórz `/api/v8/partner/clients` (albo zakładkę
   Organizacje) i zanotuj `organizationId` każdej zwróconej organizacji.
2. Dla KAŻDEGO `organizationId`: `docker exec cx-day224-pg psql -U postgres -d cx224 -c
   "SELECT COUNT(*) FROM users WHERE organization_id = '<id>';"` — porównaj z tym, co
   zwraca API.
3. Sprawdź logi serwera z tego żądania pod kątem `[PartnerReferralService]
   getPartnerClients user counts failed` (`warn`, ok. `:1435`) — obecność oznacza REALNY
   błąd zapytania (przyczyna B), nie brak danych.
4. Sprawdź, czy `organizationId` atrybucji ma odpowiadający wiersz w `organizations`
   (`SELECT id FROM organizations WHERE id = '<id>';`) — brak wiersza potwierdza
   sierocą atrybucję (przyczyna C, komentarz `:1452-1454`).

**Trzy możliwe werdykty, wybierz jeden z dowodem:**
- **DEFEKT (przyczyna B)** — log `warn` obecny, zapytanie faktycznie pada (np. błąd
  typu/rzutowania jak w R2 dyżuru 188 dla `projects`, ale NIE naprawiony dla `users`) →
  **napraw** analogicznie do R2 dyżuru 188 (zmierz realny kierunek typów na PG PRZED
  naprawą, nie zgaduj).
- **DANE FIXTURE (przyczyna A)** — zapytanie się wykonuje, log czysty, realnie 0 wierszy
  w `users` dla tej organizacji → **NIE naprawiasz kodu**, dokumentujesz w raporcie i w
  `§R.1` jako „uczciwa liczba, nie defekt", z konkretnym `organizationId` i wynikiem
  zapytania z kroku 2.
- **SIEROTA (przyczyna C)** — `organizationId` atrybucji nie ma odpowiednika w
  `organizations` → dokumentujesz jako lukę FIXTURE/SEED (poza zakresem naprawy kodu w
  tym dyżurze — rekomendacja dla nadzorcy: seed musi tworzyć spójne `organizationId`
  między `partner_attributions` i `organizations`/`users`).

**DoD `§A.3`:**
- nowy test `server/src/services/__tests__/partnerReferralService.userCounts.day224.pg.test.ts`
  (real-PG, `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres`) — jeśli werdykt to DEFEKT:
  dowód mutacyjny czerwony/zielony/czerwony (`Z32`); jeśli werdykt to DANE FIXTURE albo
  SIEROTA: test jest KONTRAKTEM potwierdzającym uczciwe zachowanie (zapytanie się
  wykonuje, log czysty, wynik zgodny z realnym stanem tabeli — zielony od razu, to jest
  akceptowalne, bo nie naprawiasz kodu, tylko dowodzisz, że nie trzeba);
- raport ma jawne zdanie: „Users: 0 to [DEFEKT NAPRAWIONY / UCZCIWA LICZBA / SIEROTA
  FIXTURE], dowód: [zapytanie + wynik]".

## §R.1 — podniesienie karty modułu 16 i pakietu werdyktu

Dopisz do `docs/program/waves/WAVE_03_ACCEPTANCE/modules/16_PARTNER/MODULE_ACCEPTANCE.md`
notatkę o trzech pozycjach z odsyłaczem do raportu (`§R.2`). W
`docs/program/funkcje/PAKIET_WERDYKT_PARTNER.md`, sekcja „3. OTWARTE POZYCJE", zaktualizuj
punkty 2 (baner), 3 (kolumna) i 4 (Users: 0) o wynik — **wyłącznie te trzy punkty**, zero
zmiany reszty pliku (w tym punktu 1 — ekonomia OFF — i sekcji 5 „PROPONOWANY WERDYKT",
którą zmienia wyłącznie właściciel/nadzorca).

## §R.2 — raport dyżuru

`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY224_PARTNER_REPORT.md`. Struktura:
(1) wynik komend `(2)`/`(7)` z `§0.1`; (2) wynik `W1`-`W10`; (3) `§A.1` — zrzuty +
zdanie (a)/(b) + deklaracja `§0.2b`; (4) `§A.2` — dowód mutacyjny + dwa zrzuty; (5)
`§A.3` — procedura pomiaru + werdykt + dowód; (6) `§0.4a`; (7) „Korekty wobec
instrukcji"; (8) „TWIERDZENIA NIEZWERYFIKOWANE".

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
| --- | --- |
| Zapis — WĄSKA, wyłącznie dopisanie propa `minTableWidth="auto"` do jednego wywołania | `src/views/partner/PartnerPortalView.tsx` (ok. `:1264`) |
| Zapis — WYŁĄCZNIE jeśli §A.3 rozstrzygnie DEFEKT, wąska naprawa zapytania COUNT | `server/src/services/partnerReferralService.ts` (ok. `:1422-1436`, `:1491-1503`) |
| Zapis — NOWY plik | `src/views/partner/__tests__/PartnerPortalView.organizationsColumnWidth.day224.test.tsx` |
| Zapis — NOWY plik | `server/src/services/__tests__/partnerReferralService.userCounts.day224.pg.test.ts` |
| Zapis — WYŁĄCZNIE dopisanie notatki (§R.1) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/16_PARTNER/MODULE_ACCEPTANCE.md` |
| Zapis — WYŁĄCZNIE aktualizacja punktów 2-4 sekcji 3 (§R.1) | `docs/program/funkcje/PAKIET_WERDYKT_PARTNER.md` |
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY224_PARTNER_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/shared/ModuleHub/FilterableTable.tsx` — bezpiecznik już istnieje, dowodzisz i wywołujesz go, NIE zmieniasz stałych ani logiki |
| Odczyt (ZAKAZ ZAPISU) | `src/views/partner/sections/EarningsSection.tsx` · `server/src/routes/v8/partner.routes.ts` — dowodzisz istniejącego zachowania (§A.1), nie zmieniasz go |
| Odczyt (ZAKAZ ZAPISU — `Z18`) | `tests/setup.ts` · `tests/helpers/**` · `tests/__mocks__/**` · `vitest.config.ts` · `vitest.*.config.ts` · `server/vitest.config*.ts` · `tests/integration/_helpers/assertRealPostgres.ts` |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY112_PARTNER_OWNER_REPORT.md` · `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY188_PARTNER_BACKEND_REPORT.md` (jeśli istnieje pod tą nazwą — sprawdź `ls`, w innym wypadku traktuj `pakiet_partner.md`-owe cytaty jako źródło) |

**Nietykalne imiennie:** `requirePartnerEconomicsReadAccess` i cała trasa/logika `410
PARTNER_ECONOMICS_POLICY_DISABLED` (ekonomia zostaje OFF) · `DEFAULT_MIN_TABLE_WIDTH` /
`AUTO_MIN_WIDTH_COLUMN_THRESHOLD` w `FilterableTable.tsx` (blast radius 26 ekranów) ·
`tests/setup.ts` i sąsiedzi (`Z18`) · port/baza dyżuru 188 (`6108`/`5048`/`5049` — cudze,
`Z6`).

**Rozłączność z partią równoległą:** `222`/`223`/`225` dotyczą modułów 07/13/03 — zero
wspólnych plików produktowych. `src/components/shared/ModuleHub/FilterableTable.tsx` jest
plikiem WSPÓLNYM dla wielu modułów spoza tej fali — Twoja zmiana jest wyłącznie ODCZYT
(dowód), więc kolizja zapisu nie istnieje; jeśli mimo to okaże się, że inny równoległy
proces edytuje ten plik, STOP MERYTORYCZNY i zgłoś.

---

# 5. TWARDE ZASADY

- ★★ **Ekonomia partnera zostaje WYŁĄCZONA.** Zero zmiany w `requirePartnerEconomicsReadAccess`,
  zero zmiany jakiejkolwiek wartości ekonomicznej z `null`/`0` na cokolwiek innego. Jeśli
  Twój pomiar pokaże realne kwoty — to jest ALARM, nie sukces; STOP i zgłoś.
- ★★ **`FilterableTable.tsx` jest TYLKO DO ODCZYTU.** Jedyna dozwolona zmiana produktowa
  to nowy prop w WOŁANIU z `PartnerPortalView.tsx`.
- ★★ **„Users: 0" — nie zgaduj przyczyny.** Wykonaj procedurę pomiaru `§A.3` w PEŁNI
  (wszystkie cztery kroki) przed napisaniem werdyktu. Werdykt bez dowodu z kroku 2-4 jest
  odrzuceniem pozycji.
- ★ **Zrzuty §A.1/§A.2: para jasny/ciemny (tam gdzie wymagana) musi się REALNIE różnić** —
  policz `mean_luma` jak w innych dyżurach tej fali, jeśli zrzut ma dwa warianty motywu.
- ★ **`Z13`:** zrzuty, logi, wyniki `psql` NIE wchodzą do repo — leżą w
  `/private/tmp/cx-day224-partner-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- ★ **Pułapka komentarzy, które kłamią (31.08):** zanim uznasz komentarz o „orphan
  attributions" (`partnerReferralService.ts` ok. `:1452-1454`) za prawdziwy opis
  DZISIEJSZEGO stanu Twojej bazy — zweryfikuj go swoim zapytaniem z `§A.3` kroku 4.
  Komentarz opisuje `demo`, Twoja baza to świeży fixture tego dyżuru — może się różnić.
- ★ **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu** (`Z24`).
