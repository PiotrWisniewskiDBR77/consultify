# INSTRUKCJA DYŻURU nr 271 — Codex — „★★ PLAKIETKA ŹRÓDŁA ODPOWIEDZI ASSESSMENT — ZMIANA CELU WZGLĘDEM PIERWOTNEJ DECYZJI. `assessment_responses` (tabela wskazana w pierwotnej decyzji właściciela) ma DZIŚ **ZERO** pisarzy i **ZERO** czytelników w `server/src/` — sierota z migracji 248, martwa gałąź. ŻYWY łańcuch dowodów jest inny: front `V8AssessmentApi`/`src/services/api/v8/assessment.ts` → `server/src/routes/v8/assessment.routes.ts:953` (`addEvidence(...)`) → `server/src/services/assessment/drdEvidenceScoring.ts:100-141` (`addEvidence`, JEDYNY pisarz) → `assessment_axis_evidence` (`server/migrations/20260801_asm005_007_evidence_quality_output.sql:31-45`, CHECK `evidence_type IN ('note','link','document','reference')`, kolumny `created_by`+`created_at`, **ZERO** kolumn `source_type`/`source_id`). Intencja właściciela („plakietka źródła przy odpowiedzi, »Źródło nieznane« dla starych rekordów") zostaje — realizujesz ją na `assessment_axis_evidence`, wzorem migracji `server/migrations/20260311_origin_tracking.sql` (`ALTER TABLE … ADD COLUMN IF NOT EXISTS source_type/source_id`), z plakietką wg pustego-stanu `SourceReferenceCell.tsx` (NIE ukrywającego wzorca), a `assessment_responses` wpisujesz do rejestru jako sierotę."

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
> **Dlatego w `§0.1` masz PEŁNĄ, DOSŁOWNĄ procedurę worktree Z VAULTA.**
> Nie improwizuj jej i nie zastępuj „swoim sposobem". Twoje miejsce pracy to
> **wyłącznie** `/private/tmp/cx-day271-assessment-plakietka`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `444d789363`**
> **Gałąź bazowa: `github-backup/integracja/20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypełnione pole szablonu —
> **dokument nie jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.

Data wystawienia: 2026-09-02.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **Assessment — plakietka źródła odpowiedzi/dowodu, na żywym łańcuchu v8 (`assessment_axis_evidence`), NIE na sierocej `assessment_responses`.**
Trasy front: `src/views/AssessmentSessionEditorView.tsx` (odczyt + miejsce montażu plakietki, zweryfikuj w `R1` DOKŁADNIE gdzie evidence axis/area się renderuje — jeśli nie tam, znajdź realny komponent) · `src/components/assessment/**` (odczyt szeroki, dozwolona wąska licencja na komponent plakietki, patrz `B.1`) · `src/components/MyWork/table/cells/SourceReferenceCell.tsx` (odczyt — wzorzec pustego stanu do naśladowania) · `src/components/Initiatives/InitiativeSourceLink.tsx` (odczyt — wzorzec CZEGO NIE ROBIĆ, ukrywa zamiast pokazywać „nieznane") · `src/services/api/v8/assessment.ts` (odczyt + wąska licencja na typ odpowiedzi, jeśli trzeba przekazać nowe pola do frontu).
Trasy tył: `server/src/routes/v8/assessment.routes.ts:953,1513` (dwa wołania `addEvidence`, oba w licencji) · `server/src/services/assessment/drdEvidenceScoring.ts` (JEDYNY pisarz do `assessment_axis_evidence`, pełna licencja w zakresie dodania `source_type`/`source_id`) · `server/migrations/20260801_asm005_007_evidence_quality_output.sql` (odczyt, definicja bazowa) · `server/migrations/20260311_origin_tracking.sql` (odczyt, wzorzec migracji) · `server/migrations/[NOWY numer 20261910-20261919]` (nowy plik, pełna licencja).

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
WT=/private/tmp/cx-day271-assessment-plakietka
MARKER=444d789363

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/integracja/20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/integracja/20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day271-assessment-plakietka-20260902 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day271-assessment-plakietka/config.worktree"
cat "$VAULT/worktrees/cx-day271-assessment-plakietka/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day271-assessment-plakietka-scratch
mkdir -p /private/tmp/cx-day271-assessment-plakietka-artefakty

# (7) sanity
git -C "$WT" rev-parse HEAD
git -C "$WT" status --short | head -3
```

**Wynik komend (2) i (7) wklejasz do raportu dosłownie.**

> **★★ PUŁAPKA — REMOTE `icloud-source` JEST MARTWY.** Nie wołaj
> `git fetch --all`. Jego błąd nie jest powodem do STOP-u.

**★★ REGUŁA ROZEJŚCIA.** Jeżeli marker **nie jest** przodkiem tipa albo gałąź
nie istnieje — **STOP całego dyżuru**. Jeżeli marker **JEST** przodkiem, ale
tip uciekł do przodu — **NIE jest STOP**; startujesz z markera i wpisujesz do
raportu:

```bash
git -C "$VAULT" log --oneline 444d789363..github-backup/integracja/20260902
git -C "$VAULT" diff --name-only 444d789363..github-backup/integracja/20260902
```

**Rebase w trakcie dyżuru: ZAKAZANY.** **Nie pushujesz sam** — push wykonuje
nadzorca po odbiorze; commity zostają lokalnie na `$WT`, jeden commit na
pozycję.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 444d789363..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: assessment_responses ma ZERO pisarzy w server/src
grep -rn "INTO assessment_responses\|assessment_responses.*VALUES" server/src/ --include="*.ts" | wc -l
grep -rln "assessment_responses" server/src/ --include="*.ts"
#   oczekiwane: 0 wystapien INSERT; jesli grep -rl znajdzie cokolwiek, przeczytaj
#   KAZDY plik i wpisz do "Korekt wobec instrukcji" — to obala teze tytulowa

# (2) TEZA: zywy zapis "dowodu" DRD idzie przez addEvidence -> assessment_axis_evidence
sed -n '95,145p' server/src/services/assessment/drdEvidenceScoring.ts
grep -n "addEvidence" server/src/routes/v8/assessment.routes.ts
#   oczekiwane: funkcja addEvidence robi INSERT INTO assessment_axis_evidence;
#   wolana z assessment.routes.ts w co najmniej 2 miejscach (linie ok. 953, 1513)

# (3) TEZA: assessment_axis_evidence NIE MA kolumn source_type/source_id dzis
grep -n "source_type\|source_id" server/migrations/20260801_asm005_007_evidence_quality_output.sql
#   oczekiwane: 0 trafien

# (4) TEZA: wzorzec migracji do naslodowania to origin_tracking (addytywny ALTER)
cat server/migrations/20260311_origin_tracking.sql
#   oczekiwane: `ALTER TABLE tasks/decisions ADD COLUMN IF NOT EXISTS source_type/source_id`
#   + `CREATE INDEX ... (source_type, source_id)` — to jest ksztalt Twojej nowej migracji

# (5) TEZA: SourceReferenceCell.tsx to wzorzec PUSTEGO STANU (pokazuje "brak/dodaj
#     zrodlo"), InitiativeSourceLink.tsx to wzorzec UKRYWANIA (czego NIE robic)
sed -n '1,30p' src/components/MyWork/table/cells/SourceReferenceCell.tsx
grep -n "return null\|hidden\|!source" src/components/Initiatives/InitiativeSourceLink.tsx
#   oczekiwane: SourceReferenceCell renderuje jawny "Add source"/dash dla pustej
#   wartosci; InitiativeSourceLink ma warunek, ktory usuwa element z drzewa
#   (return null) gdy brak zrodla zamiast pokazac "nieznane"

# (6) TEZA: AssessmentSessionEditorView.tsx istnieje i jest miejscem sesji DRD
test -f src/views/AssessmentSessionEditorView.tsx && echo "PLIK OK"
grep -c "axis\|Axis" src/views/AssessmentSessionEditorView.tsx
#   oczekiwane: PLIK OK; niepusty wynik grep (widok operuje na osiach DRD) —
#   ALE miejsce renderu evidence/plakietki MUSISZ zmierzyc samodzielnie w R1,
#   ten plik moze delegowac render do komponentu dziecka

# (7) TEZA: bramka fresh-migration-gate istnieje jako wzorzec lokalnego przebiegu
test -f scripts/dev/day161-fresh-migration-check.sh && echo "GATE OK"
sed -n '1,15p' scripts/dev/day161-fresh-migration-check.sh
#   oczekiwane: GATE OK; skrypt uzywa wlasnego kontenera/portu parametryzowanego
#   zmiennymi DAY161_* — Ty NIE uruchamiasz tego skryptu wprost (inny port/kontener),
#   tylko naśladujesz jego KSZTALT (swieza baza od zera -> migracje -> pomiar)
#   swoim wlasnym kontenerem z §0.2c

# (8) TEZA: przedzial migracji 20261910-20261919 jest wolny
ls server/migrations/ | grep -cE "^202619[01]"
#   oczekiwane: 0 (przedzial pusty, gotowy do uzycia)

# (9) miejsce na dysku
df -h /
#   oczekiwane: powyzej 5 GB wolnego — ponizej tego STOP calego dyzuru
```

---

### §0.4a — pomiar zasięgu testów (warunek oddania raportu, patrz `Z24`)

Zanim ogłosisz jakikolwiek wynik testów, zmierz zasięg PEŁNYMI NAZWAMI, nie liczbami:

1. PRZED zmianami produktu: uruchom pakiet(y) testów wskazane w licencji z
   `--reporter=json` i zapisz do artefaktów plik `przed-nazwy.txt`.
2. PO zmianach: to samo do `po-nazwy.txt`.
3. Do raportu wchodzi: `diff przed-nazwy.txt po-nazwy.txt`. `N passed` bez nazw
   NIE jest pomiarem. „Ta sama liczba" przy innym składzie nazw to fałszywa
   zieleń (Z37).
4. Przepisanie liczby z instrukcji, cudzego raportu albo rejestru = zawyżenie
   i podstawa odrzucenia raportu. Liczysz sam, u siebie, na swojej bazie.

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`.** Ten dyżur **NIE PUSHUJE W OGÓLE** (push robi nadzorca po odbiorze) | Push na `origin`/demo wykonuje wyłącznie nadzorca |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `integracja/20260902` ani żadnej cudzej gałęzi. Odczyt dozwolony | Cudze tory w toku |
| `Z3` | **Żadnego `--force`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4 |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP`/`NO_COPY`) ani `server/src/_backup/**` | Śmietnik kolizji |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — zero wyjątków poza symlinkiem `node_modules` | Naruszony 28.08: STOP dyżuru 53 |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `cx-*`, `fix-*`, `odbior-*`, `instr-*`, `finish-*`. Wyjątek: katalogi, które Ty zakładasz | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6282`. Twój JEDYNY port harnessu to `5262 i 5263`.** Kontener: **`cx-day271-pg`**. Zajęte na stałe: 5000, 5037, 5060-5061. Zajęte przez inne prace: 6012, 5433, 6047, 6054-6280, 5010-5261, 6404-6411, 6600-6830. Cudze — siostrzane dyżury tej samej paczki (270-273): baza 6280 harness 5260-5261 (270 Realizacja) · baza 6284 harness 5264-5265 (272 Inicjatywy) · baza 6286 harness 5266-5267 (273 Gamma). Sprawdzasz sam: `lsof -nP -iTCP:PORT -sTCP:LISTEN` i `docker ps` | Trzy incydenty zapisu do cudzej bazy |
| `Z8` | **Zero interakcji z Railway** | Produkcja NIETYKALNA |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja | Baza demo i staging to JEDNA baza |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian domyślnej wartości istniejącej.** Plakietka źródła w UI może iść za NOWĄ flagą `default OFF`, jeśli decydujesz się na taką ochronę — jedyny dozwolony wyjątek tego dyżuru, opisz w raporcie nazwę i domyślną wartość | Krach 07-12 |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Plakietka to nowy element wizualny — flaga `default OFF`, zrzuty **Twoje własne** (dev-render/harness), nie „włącz i zobacz" | `CLAUDE.md` reguła 7, załamanie 07-11 |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne: `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts` | Pliki przekrojowe |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY271_ASSESSMENT_REPORT.md`. Zrzuty/logi w `/private/tmp/cx-day271-assessment-plakietka-artefakty` | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `OWNER_DECISION_LEDGER_2026-08-24.md`** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego** | `DEC-51` |
| `Z16` | **Nie usuwasz uczciwych stanów pustych.** „Źródło nieznane" jest wzorcem POPRAWNYM, nie do „naprawienia" | Zero placebo |
| `Z17` | **Zakaz wszystkiego poza zakresem tego dyżuru** | Podział z dyżurami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — zakaz modyfikowania globalnej infrastruktury testowej:** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | Jedna zmiana fałszuje cały korpus |
| `Z19` | **Nie odmontowujesz żadnego routera/middleware/joba CI zamontowanego dziś** | Bramki znikają łatwiej niż wracają |
| `Z20` | **★★ ZAKAZ testów DB bez jawnego kompletu env, W TEJ SAMEJ LINII.** NAJPIERW kontener + migracje od zera, DOPIERO potem pomiar | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI** — realny INSERT przez `addEvidence`, realny odczyt przez frontowy konsument, nie tylko istnienie kolumn | Istnienie kodu ≠ działanie |
| `Z22` | **★★ Test montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej.** Dowód HTTP (jeśli piszesz) idzie przez `ApiGateway.getInstance().initializeRoutes(app)` | Replika rozjeżdża się z produkcją |
| `Z23` | **★★ ZERO ATRAP.** „Źródło nieznane" dla NULL to NIE atrapa (uczciwy stan); plakietka pokazująca źródło, którego serwer nie wysłał, JEST atrapą | `DEC-51` |
| `Z24` | **Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu** | Liczby krążą i utrwalają się jako „fakt" |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL`** wskazującym Twój kontener | Port 5432 nasłuchuje i nie jest Twój |
| `Z26` | **★★ Komplet env w tej samej linii — `§0.2c`** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash`.** Stan odkładasz przez `cp` do `/private/tmp/cx-day271-assessment-plakietka-scratch` | Schowek współdzielony |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI** | Jedyny zakaz zatrzymujący CAŁY dyżur |
| `Z29` | **★★ Testy „atak odrzucony" BEZ PONAWIANIA: `--retry=0`** | `retry: CI ? 3 : 1` w configu |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI.** Protokół `§0.2b` | Nieodwracalne |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA REALDB DO HOSTA/PORTU/BAZY.** `await assertRealPostgresTestEnvironment()` BEZ ARGUMENTÓW | Dyżur 43: 30 przypadków stało się SKIP |
| `Z32` | **★★ ZAKAZ `FIXED`/`VERIFIED` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** Dla pozycji `§A.2` (wszystkie writery wypełniają źródło): usuń wypełnianie `source_type` w jednym writerze → test **CZERWONY**; przywróć → **ZIELONY**; `git diff` po przywróceniu **pusty** | Dyżur 44: FIXED bez podatności |
| `Z33` | **★★ PRZED KAŻDYM POMIAREM SPRAWDŹ, CZY STRAŻNIK SIĘ NIE WYŁĄCZA SAM W TRYBIE TESTOWYM** — `§0.2e` | 416 fałszywych twierdzeń na innym module |
| `Z34` | **★★ GREP DOWODZI, ŻE ŁAŃCUCH ISTNIEJE, NIE ŻE DZIAŁA.** „Działa" tylko po realnym `POST` przez `addEvidence`, realnym Postgresie, i realnym odczycie w komponencie frontu | Komponent istnieje ≠ jest renderowany (ÓSMY kształt) |
| `Z34a` | **NIE DOTYCZY** — ten dyżur nie pushuje w ogóle | — |
| `Z35` | **Zakaz „naprawiania" przez wyciszanie** (`@ts-ignore`, `.skip`, obniżanie progów) | Choroba, którą program leczy |
| `Z36` | **Zakaz `eslint --fix`/`prettier --write` szerzej niż zmieniany plik** | Autofix niszczy pracę równoległych dyżurów |
| `Z37` | **Porównania testów po NAZWACH, NIGDY po liczbach** | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania jakiegokolwiek joba CI** | Bramki znikają łatwiej niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** | Dotyka sekretów poza kontrolą |
| `Z40` | **ZAKAZ tworzenia/reanimowania jakiegokolwiek pisarza do `assessment_responses`** — ta tabela zostaje sierotą wpisaną w rejestr, NIE nowym aktywnym magazynem; jeśli uważasz, że powinna ożyć, to jest `DO DECYZJI WŁAŚCICIELA` w raporcie, nie kod tego dyżuru. **ZAKAZ zmiany CHECK `evidence_type`** — dodajesz kolumny obok, nie ruszasz istniejącego kontraktu. **ZAKAZ migracji NIEADDYTYWNEJ** — wyłącznie `ADD COLUMN IF NOT EXISTS` + indeks, zero `NOT NULL` bez `DEFAULT`, zero `DROP`. **ZAKAZ ukrywania braku źródła** (wzorem `InitiativeSourceLink.tsx` `return null`) — dla `NULL` plakietka pokazuje jawnie „Źródło nieznane", nigdy nie znika | Pierwotna decyzja właściciela nazwała złą tabelę — intencja (plakietka + „nieznane" dla starych rekordów) zostaje nienaruszona, tylko cel techniczny się zmienia po pomiarze |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:** ustawić `SMTP_*`/`RESEND`/`SENDGRID`/`MAIL*`
w środowisku, `.env*`, `docker-compose*`; wstawić konfiguracji SMTP do tabeli
`settings`; uruchomić `server/src/index.ts` na potrzeby testów (testy montują
`ApiGateway`, `Z22`); wywołać ręcznie żadnego `drain*`/`outboxWorker`.

**(2) Dwa dowody do raportu ZANIM uruchomisz cokolwiek zapisującego:**

```bash
cd /private/tmp/cx-day271-assessment-plakietka
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"
docker exec cx-day271-pg psql -U postgres -d cx271 \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy albo "relation settings does not exist"
```

**(3) Deklaracja obowiązkowa w raporcie, dosłownie:** **„Nie ustawiłem żadnej
zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy
konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego
drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane."** Jeśli robisz zrzuty odbiorowe plakietki (za flagą, lokalnie),
uruchamiasz pełny serwer WYŁĄCZNIE przez `scripts/dev/start-wave3-owner-runtime.mjs`,
po dowodach (a)/(b), i dopisujesz analogiczną deklarację dla zrzutów.

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**(A) MIGRACJE OD ZERA — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /private/tmp/cx-day271-assessment-plakietka

docker run -d --name cx-day271-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx271 \
  -p 127.0.0.1:6282:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day271-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6282/cx271 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — bezbledny, bez zmian (idempotencja schematu, wzorem day161-fresh-migration-gate):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6282/cx271 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

To jest Twoja wersja bramki `day161-fresh-migration-gate` — **NIE wołasz**
`scripts/dev/day161-fresh-migration-check.sh` wprost (inny port/kontener już
w nim wpisany), tylko odtwarzasz jego kształt swoim kontenerem. Świeża baza
od zera przechodząca Twoją nową migrację `20261910_*` jest **warunkiem
koniecznym** dowodu dla `§A.1`.

**(B) PAKIETY DOTYKAJĄCE BAZY:**

```bash
cd /private/tmp/cx-day271-assessment-plakietka && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6282/cx271 \
JWT_SECRET=cx271-test-secret-do-not-reuse \
npx vitest run server/src/services/assessment/__tests__/day271-axis-evidence-source.realpg.test.ts --retry=0 \
  --config server/vitest.config.ts \
  --reporter=json --outputFile=/private/tmp/cx-day271-assessment-plakietka-artefakty/day271-pakiet.json
```

**★★ `ENABLE_V8_GLOBAL=true` DOTYCZY TEGO DYŻURU** — `addEvidence` jest
wołany z tras `v8/assessment.routes.ts`, które siedzą za bramką V8. Jeśli
Twój test dowodzi zapisu przez realny HTTP (a nie tylko przez bezpośrednie
wywołanie `addEvidence()` z testu), brak tej zmiennej da fałszywe `404`
**przed** uwierzytelnieniem — patrz `§0.2e (a)`.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (front, komponent plakietki):

```bash
cd /private/tmp/cx-day271-assessment-plakietka && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/assessment/__tests__/day271-source-badge.test.tsx --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day271-assessment-plakietka-artefakty/day271-front.json
```

**Znaczenie każdej zmiennej:**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | `tests/setup.ts` pomija testy bazodanowe; pakiet raportuje `exit 0` |
| `MOCK_DB=false` | odczyty idą cicho na atrapę bazy |
| `DB_TYPE=postgres` | `vitest.config.ts` przybija `sqlite` |
| `NODE_ENV=test` | runner migracji odmawia albo zwraca MOCK |
| `ENABLE_V8_GLOBAL=true` | trasy `v8/assessment.routes.ts` dają fałszywe `404` przed uwierzytelnieniem |
| `ENABLE_TEST_AUTH_BYPASS=false` | `verifyToken` jest omijany |
| `DATABASE_URL` | fallback na `localhost:5432`, który nasłuchuje i nie jest Twój |
| `JWT_SECRET` | podpisany JWT nie przejdzie przez `verifyToken` |
| `--retry=0` | test „atak odrzucony" leczy się skutkiem własnego ataku |

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE, KAŻDA KOSZTOWAŁA GODZINY

1. **Vault jest BARE + `extensions.worktreeConfig=true`** — krok (4) w `§0.1`.
2. **Remote `icloud-source` jest MARTWY.** Nie wołaj `git fetch --all`.
3. **Host NIE MA `psql`.** `docker exec cx-day271-pg psql -U postgres -d cx271 -c '…'`.
4. **Runner migracji wymaga `NODE_ENV=test` przy bazie lokalnej.**
5. **`vitest.config.ts` twardo ustawia `DB_TYPE='sqlite'`.** `DB_TYPE=postgres`
   w tej samej linii; pliku nie zmieniasz.
6. **`JSON.parse` na kolumnie `json` działa na SQLite, wywala `500` na PG.**
7. **CI NIE URUCHAMIA TESTÓW dla naszych gałęzi.** „CI zielone" nie jest dowodem.
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** `docker rm -fv cx-day271-pg`.
9. **Reporter `basic` NIE ISTNIEJE.** Używaj `--reporter=json --outputFile=…`.
10. **`npx vitest run` bywa `exit 0` mimo czerwonych testów.** Nie ufaj kodowi wyjścia.
11. **Nowe pliki w `tests/`/`__tests__/` wymagają `git add -f`.**
12. **`| head` na grepie sierot produkuje FAŁSZYWE SIEROTY.**
13. **ESM nie honoruje `NODE_PATH`.**
14. **Na `github-backup` NIE MA `main`/`develop`/`Londyn`/`demo`.**
15. **`postgres:15` NIE PRZECHODZI migracji.** Obraz: `pgvector/pgvector:pg16`.
16. **`prettier` na wielkich plikach potrafi przepisać cały plik.**
17. **Istnieją testy tekstowe przez `readFileSync` + `toContain`.**
18. **`npx vitest` z roota bez configu daje `No test files found`.** To nie jest `PASS`.

---

### 0.2e. ★★ RAMKA DO `Z33` — PUŁAPKI, KTÓRE FAŁSZUJĄ ZIELONY PRZEBIEG

> **(a) `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404` PRZED uwierzytelnieniem.**
> **DOTYCZY, jeśli Twój test `§A.2` idzie przez realny HTTP** do
> `v8/assessment.routes.ts`. Jeśli zamiast tego wołasz `addEvidence()`
> bezpośrednio z testu integracyjnego (bez `ApiGateway`) — wpisz w raporcie,
> że to jest dowód **zapisu i schematu**, nie dowód **ścieżki HTTP** (`Z22`).
>
> **(b) `resultsInternalBetaVisibility.middleware.ts` przy `NODE_ENV=test`.**
> **Zmierz, czy leży na ścieżce `v8/assessment.routes.ts`** —
> `grep -n "resultsInternalBetaVisibility" server/src/routes/v8/assessment.routes.ts server/src/Gateway.ts`.
> Jeśli 0 trafień: „nie dotyczy" z tym dowodem. Jeśli trafienia: ustaw
> `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`.
>
> **(c) `vitest.config.ts` twardo ustawia `DB_TYPE='sqlite'`.** DOTYCZY —
> `MOCK_DB=false DB_TYPE=postgres` w tej samej linii; dowód: pierwszy `it`
> pakietu asertuje `expect(process.env.DB_TYPE).toBe('postgres')`.
>
> **(d) `ENABLE_TEST_AUTH_BYPASS`.** DOTYCZY, jeśli test przechodzi przez
> `verifyToken` (ścieżka HTTP). NIE DOTYCZY dla wywołania bezpośredniego.
>
> **(e) ★★ PUŁAPKA WŁAŚCIWA TEMU DYŻUROWI — dwa CHECK-i, nie mylić.**
> `assessment_axis_evidence_type_check` ogranicza `evidence_type` do
> `note/link/document/reference` — to jest TYP TREŚCI dowodu, nie jego
> POCHODZENIE. Nowe kolumny `source_type`/`source_id` (Twoja migracja) opisują
> POCHODZENIE (kto/co utworzyło wpis: `manual`, `interview`, `chat`, cokolwiek
> zmierzysz jako realnie używane wartości w `R1` — **nie zgaduj enumeracji,
> zmierz ją z wywołujących**). Test, który asertuje `evidence_type`, gdy miał
> na myśli `source_type`, przechodzi z fałszywego powodu.
>
> **Obowiązek dowodowy.** Dla **każdego** pakietu: akapit *która pułapka
> (a)–(e) dotyczy, jak wyłączona, co dowodzi wyłączenia*. „Nie dotyczy" tylko
> z komendą-dowodem.

---

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości MERYTORYCZNEJ: STOP tej POZYCJI i wpis
w raporcie — nigdy improwizacja.**

- **STOP MERYTORYCZNY** (mile widziany): zmierzyłeś inaczej, niż mówi ta
  instrukcja; brak informacji od właściciela; decyzja produktowa potrzebna.
  Wpisujesz i idziesz dalej.
- **STOP PROCEDURALNY** (zakazany): „sprzeczność", „brak ścieżki", „brak
  licencji". Nie zatrzymuje niczego.

### ★★ TABELA: STOP PROCEDURALNY ZAKAZANY — DZIAŁANIE ZASTĘPCZE

| Powód | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy" | Czerwony kontrakt testowy + brief. Pozycja **ZROBIONA** |
| „Plik nie jest w tabeli licencji" | Tylko do odczytu + czerwony kontrakt + brief |
| „Instrukcja sprzeczna" | Sekcja „JEŚLI COŚ JEST SPRZECZNE" |
| „Ścieżka nie istnieje" | `ls`, wpis do Korekt, szukasz odpowiednika |
| „Dwie różne liczby" | Mierzysz sam, Twoja liczba wiąże (`Z24`) |
| „`icloud-source` błąd" | Nie jest błędem |
| „`psql` nie istnieje" | `docker exec cx-day271-pg psql …` |
| „Hook blokuje commit" | Naprawiasz kodem, `--no-verify` zakazany |
| „Musiałbym odłożyć stan" | `cp` do scratcha, `git stash` zakazany |
| „Test przeszkadza" | Nie osłabiasz asercji |
| „Nie zdążę wszystkiego" | Rdzeń (`§A.1`, `§A.2`) + uczciwy opis reszty |
| „Port `6282`/`5262-5263` zajęty" | **To JEST powód STOP-u całości** |

**Zatrzymanie CAŁEGO dyżuru wyłącznie przy:** `MARKER BRAK` · faktycznym
połączeniu do bazy zdalnej/demo/stagingu/produkcji (`Z28`) · ryzyku utraty
danych albo realnej wysyłce (`Z30`) · mniej niż 5 GB dysku · zajętym porcie
`6282`/`5262`/`5263` (`Z7`).

Format wpisu STOP: identyczny jak w metodyce programu — Rodzaj / Powód /
Licencja sprawdzona / Dowód / Co dostarczyłem zamiast / Co zrobiłbym przy
decyzji X / Rekomendacja / Stan / Czy kontynuowałem.

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Plik nieopisany
> w tabeli jest domyślnie TYLKO DO ODCZYTU, a Twoim produktem jest czerwony
> kontrakt + brief, **nie zatrzymanie dyżuru**.

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `server/src/middleware/auth.middleware.ts`, `server/src/database/Database.ts`, `vitest.config.ts`, `tests/setup.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Czerwony kontrakt + brief. Pozycja **ZROBIONA** |
| `server/src/services/assessment/drdEvidenceScoring.ts` | **★ PEŁNA LICENCJA** w zakresie `§A.1`/`§A.2` (dodanie `sourceType`/`sourceId` do `addEvidence`) | — |
| `server/src/routes/v8/assessment.routes.ts` | **★ WĄSKA LICENCJA:** wyłącznie przekazanie `source_type`/`source_id` z requestu/kontekstu do wywołań `addEvidence` (linie ok. 953, 1513), zakaz zmiany reszty routera | Czerwony kontrakt + brief |
| `server/migrations/20261910_assessment_axis_evidence_source.sql` (**NOWY**, numer w przedziale 20261910-20261919) | **★ PEŁNA LICENCJA** | — |
| `src/components/assessment/**` | **★ WĄSKA LICENCJA:** nowy komponent plakietki (`AssessmentEvidenceSourceBadge.tsx` albo analogicznie nazwany, Twoja decyzja) + jego montaż w miejscu zmierzonym w `R1`; zakaz przepisywania istniejącej logiki widoku | Czerwony kontrakt + brief |
| `src/components/MyWork/table/cells/SourceReferenceCell.tsx`, `src/components/Initiatives/InitiativeSourceLink.tsx` | **TYLKO ODCZYT** — wzorce | — |
| `src/services/api/v8/assessment.ts` | **★ WĄSKA LICENCJA:** rozszerzenie typu odpowiedzi o `sourceType`/`sourceId`, zakaz zmiany innych metod | Czerwony kontrakt + brief |
| `tests/**` (NOWE pliki), `server/src/**/__tests__/**` (NOWE pliki), `src/**/__tests__/**` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` | — |
| `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY** dla tekstu plakietki („Źródło nieznane" itp.), parytet PL+EN w tym samym commicie | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY271_ASSESSMENT_REPORT.md` | `§R.2` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI Z DEFINICJĄ UKOŃCZENIA PER POZYCJA

| Pozycja | Nazwa jednym zdaniem | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `§A.1` | migracja addytywna `source_type`+`source_id` na `assessment_axis_evidence` | TAK | NIE — dowód: migracja jest plikiem `.sql`, poza `auth.middleware.ts`/`Database.ts` | n/d (migracja, nie test) | Nowy plik `server/migrations/20261910_*.sql`, `ALTER TABLE assessment_axis_evidence ADD COLUMN IF NOT EXISTS source_type TEXT, ADD COLUMN IF NOT EXISTS source_id TEXT`, indeks `(source_type, source_id)`; świeża baza od zera przechodzi migrację 2× bez błędu (`§0.2c A`) | `§0.2c (A)`, dwa przebiegi | `feat(migrations): assessment_axis_evidence source_type/source_id (A.1)` |
| `§A.2` | wszystkie writery `assessment_axis_evidence` wypełniają źródło | TAK | NIE — dowód: writer jest w `drdEvidenceScoring.ts`, w licencji | 4 | `addEvidence()` przyjmuje i zapisuje `sourceType`/`sourceId` (nullable, brak wymuszenia na starych wołaniach); OBA wołania w `assessment.routes.ts` (953, 1513) przekazują realną wartość źródła (zmierz w R1 jaką — `manual` z UI? inny typ z importu?); test dowodzi zapisu i **dowodu mutacyjnego**: usunięcie przekazania `sourceType` w jednym z dwóch wywołań → test czerwony; przywrócenie → zielony | `§0.2c (B)` + mutacja opisana w `§A.2` niżej | `feat(assessment): writery wypelniaja zrodlo dowodu (A.2)` |
| `§A.3` | plakietka źródła w UI, „Źródło nieznane" dla NULL | TAK | NIE — dowód: komponent w `src/components/assessment/`, poza plikami przekrojowymi | 2 | Nowy komponent renderuje: (1) czytelną etykietę źródła gdy `source_type` niepusty; (2) jawne „Źródło nieznane" (nie pusty string, nie zniknięcie elementu) gdy `NULL`; montaż w miejscu zmierzonym w `R1`; za flagą `default OFF` (`Z10`/`Z11`), zrzuty własne w `dev-render` | test komponentu + zrzut w artefaktach | `feat(assessment): plakietka zrodla dowodu, flaga OFF (A.3)` |
| `§A.4` | wpis `assessment_responses` do rejestru jako sierota | NIE | NIE | n/d | Raport zawiera akapit z dowodem (`§0.1` weryfikacja 1): zero pisarzy, zero czytelników w `server/src/`, migracja pochodzenia (248), rekomendacja `DO DECYZJI WŁAŚCICIELA` (skasować / zostawić jako dług / zbadać czy front kiedyś czytał) | grep z weryfikacji wejściowej (1) | wpis w `§R.2`, zero zmian kodu |
| `§R.2` | raport dyżuru | NIE | NIE | n/d | struktura z `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" niepusta jeśli coś zostało niedokończone | — | `docs(day271): raport dyzuru (R.2)` |

> **Kolumna „Wymaga plików przekrojowych?" — wszystkie cztery pozycje robocze
> odpowiadają `NIE`, z dowodem: żadna nie dotyka `auth.middleware.ts` ani
> `Database.ts`; `§A.2` dotyka tras `v8/assessment.routes.ts`, które NIE są
> na liście plików przekrojowych `Z12`.**

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora instrukcji | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | pisarze `assessment_responses` w `server/src/` | 0 | `grep -rn "INTO assessment_responses" server/src/ --include="*.ts" \| wc -l` | TAK |
| 2 | pisarze `assessment_axis_evidence` w `server/src/` | 1 (`addEvidence`) | `grep -rln "INTO assessment_axis_evidence" server/src/ --include="*.ts"` | TAK |
| 3 | wołania `addEvidence` z tras v8 | 2 | `grep -n "addEvidence" server/src/routes/v8/assessment.routes.ts \| grep -v "^29:"` (linia importu wykluczona) | TAK |
| 4 | kolumny `source_type`/`source_id` w `assessment_axis_evidence` dziś | 0 | `grep -c "source_type\|source_id" server/migrations/20260801_asm005_007_evidence_quality_output.sql` | TAK |
| 5 | wolne numery migracji w przedziale `20261910`–`20261919` | 0 | `ls server/migrations/ \| grep -cE "^202619[01]"` | **TAK — sprawdź osobno, najczęstszy błąd** |

---

## B.4. TABELA ROZŁĄCZNOŚCI — PLIKI DO ZAPISU TEGO DYŻURU

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `server/migrations/20261910_assessment_axis_evidence_source.sql` | NOWY | `§A.1` | ZEROWE |
| 2 | `server/src/services/assessment/drdEvidenceScoring.ts` | istniejący | `§A.2` | ZEROWE |
| 3 | `server/src/routes/v8/assessment.routes.ts` | istniejący | `§A.2` | ŚREDNIE — wspólny plik v8, sprawdź `git diff` przed commitem że dotknąłeś TYLKO dwóch wołań `addEvidence` |
| 4 | `src/components/assessment/AssessmentEvidenceSourceBadge.tsx` (nazwa orientacyjna) | NOWY | `§A.3` | ZEROWE |
| 5 | `src/services/api/v8/assessment.ts` | istniejący | `§A.2` | ŚREDNIE — wspólny plik, tylko typy |
| 6 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY271_ASSESSMENT_REPORT.md` | NOWY | `§R.2` | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `public/locales/{pl,en}/translation.json` | `§A.3` | tylko jeśli komponent potrzebuje nowych kluczy tekstowych |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/src/database/schemas/assessment_responses* (i kazdy plik zwiazany z ta tabela)
server/src/middleware/auth.middleware.ts
server/src/database/Database.ts
vitest.config.ts, tests/setup.ts
Wszystko w server/src/routes/v8/assessment.routes.ts poza dwoma wolaniami addEvidence
```

### B.4.4. Zasoby wyłączne tego dyżuru

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | `6282` | `lsof -nP -iTCP:6282 -sTCP:LISTEN` |
| Port harnessu | `5262 i 5263` | jw. |
| Nazwa kontenera | `cx-day271-pg` | `docker ps --format '{{.Names}}'` |
| Nazwa bazy | `cx271` | — |
| Przedział migracji | `20261910`–`20261919` | `ls server/migrations/ | grep -cE "^202619[01]"` → 0 |
| Gałąź | `codex/day271-assessment-plakietka-20260902` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day271-assessment-plakietka` | nie istnieje |
| Flagi funkcyjne | jedna nowa, `default OFF`, nazwa Twoja, wpisz w raporcie | `grep -rn "<TWOJA_FLAGA>" server/src/ src/ → tylko Twoje nowe wystapienia` |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day271-assessment-plakietka
git diff --name-only --cached | tee /private/tmp/cx-day271-assessment-plakietka-artefakty/staged.txt
grep -iE 'assessment_responses|auth\.middleware\.ts$|Database\.ts$|vitest\.config\.ts$' /private/tmp/cx-day271-assessment-plakietka-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---
---

# POZYCJE ROBOCZE — SZCZEGÓŁY

## §A.1 — Migracja addytywna

Nowy plik `server/migrations/20261910_assessment_axis_evidence_source.sql`,
wzorem `20260311_origin_tracking.sql`:

```sql
-- Origin tracking dla dowodow DRD assessment (plakietka zrodla, dyzur 271).
-- Wzorzec: server/migrations/20260311_origin_tracking.sql.
ALTER TABLE assessment_axis_evidence ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT NULL;
ALTER TABLE assessment_axis_evidence ADD COLUMN IF NOT EXISTS source_id TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_axis_evidence_source
  ON assessment_axis_evidence(source_type, source_id);
```

Dowód: świeża baza od zera przechodzi Twoją migrację 2× bez błędu (`§0.2c A`).
Zmierz też, czy istnieje SEPARATE bramka CI dla świeżej migracji
(`.github/workflows/day161-fresh-migration-gate.yml`) i czy Twoja migracja
byłaby przez nią objęta — wpisz wynik do raportu, **nie uruchamiaj** tego
workflow (`Z39`), tylko przeczytaj plik i opisz.

## §A.2 — Writery wypełniają źródło

Rozszerz `addEvidence()` w `drdEvidenceScoring.ts` o parametry
`sourceType?: string | null` i `sourceId?: string | null`, dopisz je do
`INSERT`. W `assessment.routes.ts` (oba wołania, ok. linii 953 i 1513)
zmierz w `R1`, **skąd realnie wziąć wartość źródła** — czy istnieje w
requeście/kontekście coś, co dziś opisuje pochodzenie wpisu (np. czy wywołanie
przychodzi zawsze z ręcznego UI, czy istnieje ścieżka z importu/interview)?
Jeśli jedyna dziś istniejąca wartość to `'manual'` (bo cała ścieżka jest
ręcznym formularzem), wpisz to wprost i użyj tej wartości — **nie zgaduj
enumeracji szerszej niż to, co realnie zmierzysz**.

**Dowód mutacyjny (`Z32`, obowiązkowy):**

```bash
cp server/src/routes/v8/assessment.routes.ts /private/tmp/cx-day271-assessment-plakietka-scratch/assessment.routes.original.ts
# usun REALNIE przekazanie sourceType w JEDNYM z dwoch wywolan addEvidence
# URUCHOM test §A.2 -> MUSI byc CZERWONY
cp /private/tmp/cx-day271-assessment-plakietka-scratch/assessment.routes.original.ts server/src/routes/v8/assessment.routes.ts
git diff --stat server/src/routes/v8/assessment.routes.ts   # MA BYC PUSTE
# URUCHOM test ponownie -> MUSI byc ZIELONY
```

## §A.3 — Plakietka w UI

Zmierz w `R1` DOKŁADNIE, gdzie w `AssessmentSessionEditorView.tsx` (albo
komponencie dziecku, którego szukasz przez `grep -rln "assessment_axis_evidence\|axisEvidence\|AxisEvidence" src/`)
lista dowodów axis/area jest renderowana. Zbuduj tam komponent plakietki
wzorem `SourceReferenceCell.tsx` (pusty stan = jawny tekst, nie zniknięcie):
dla `source_type` niepustego pokaż czytelną etykietę (np. ikona + nazwa
źródła), dla `NULL` pokaż **„Źródło nieznane"** (klucz i18n, PL+EN). Nowy
ekran/element idzie za flagą `default OFF` (`Z10`/`Z11`) — zrzut robisz sam
w harnessu `dev-render`, zero logowania właściciela na tym etapie.

## §A.4 — Rejestr sieroty

W raporcie, sekcja osobna: „`assessment_responses` — sierota potwierdzona
`R1`". Cytujesz dowód (weryfikacja wejściowa (1)), migrację pochodzenia (jeśli
zmierzysz jej numer — `grep -rln "CREATE TABLE.*assessment_responses" server/migrations/`),
i rekomendację `DO DECYZJI WŁAŚCICIELA`: skasować migracyjnie / zostawić jako
udokumentowany dług / dalej badać czy kiedykolwiek miała konsumenta we
froncie (np. przez `git log -p` na jej pierwotnym wprowadzeniu, jeśli starczy
czasu — nieobowiązkowe rozszerzenie).

---
---

## §R.1 — Podniesienie rejestru (NIE DOTYCZY tego dyżuru)

Brak przypisanego pliku `MODULE_ACCEPTANCE.md` dla tego zakresu.

## §R.2 — Raport dyżuru

Dokładnie jeden plik:
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY271_ASSESSMENT_REPORT.md`

Struktura obowiązkowa: nagłówek (SHA/gałąź/data) · wynik weryfikacji
wejściowej (9 komend) · `§A.1`-`§A.4` z dowodami · Korekty wobec instrukcji
(w tym: jawne stwierdzenie zmiany celu z `assessment_responses` na
`assessment_axis_evidence`, jeśli R1 to potwierdzi ponownie) · STOP-y, jeśli
były · TWIERDZENIA NIEZWERYFIKOWANE · manifest artefaktów z `shasum -a 256`.

---
---

## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć
błędy. Nie zatrzymuj przez nie dyżuru.**

1. **Opisz sprzeczność w raporcie** — cytat obu zdań, numery paragrafów, dowód.
2. **Wybierz interpretację BEZPIECZNIEJSZĄ:** nie ruszaj cudzego pliku · nie
   osłabiaj asercji · nie kasuj (wpisz `DO DECYZJI WŁAŚCICIELA`) · nie
   włączaj flagi domyślnie · nie wysyłaj niczego na zewnątrz · nie poszerzaj
   dostępu · mierz zamiast zgadywać.
3. **KONTYNUUJESZ POZOSTAŁE POZYCJE.**
4. **Zatrzymanie CAŁEGO dyżuru** — wyłącznie z pięciu powodów `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.**

**★ Ostatnie zdanie tej instrukcji i najważniejsze: obalenie którejkolwiek
tezy z tytułu tego dokumentu (włącznie z „zero pisarzy `assessment_responses`")
jest SUKCESEM dyżuru, a nie porażką. Zapisz to w „Korektach wobec instrukcji"
z dowodem i idź dalej.**

---
---

## AUDYT WYKONANY PRZEZ AUTORA

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — brak par wymagań wzajemnie wykluczających się | TAK |
| 2 | Każda ścieżka pliku zweryfikowana na markerze `444d789363` | TAK |
| 3 | Każda liczba ma odtwarzalną komendę (`B.3`) | TAK |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy „STOP" | TAK |
| 5 | Wykonalność per pozycja bez plików przekrojowych — wszystkie `NIE` z dowodem | TAK |
| 6 | Przydział zasobów sprawdzony wobec dyżurów 270/272/273 | TAK |
| 7 | Komendy paste-ready, komplet env w jednej linii, `--retry=0` | TAK |
| 8 | Pułapki środowiska w całości (18 rdzenia + `§0.2e (e)` własna) | TAK |
| 9 | Samodzielność dokumentu | TAK |
| 10 | Klauzula sprzeczności obecna; `grep -c '<<' <plik>` → `0` | TAK |
