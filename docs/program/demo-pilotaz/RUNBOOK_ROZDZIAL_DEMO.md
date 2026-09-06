# RUNBOOK — środowisko demo dla pilotażu (pozycja 1.10, kryterium 8)

**Data napisania:** 2026-09-06 · **Gałąź:** `mvp/demo-rozdzial-przygotowanie` · **Stan:** PRZYGOTOWANIE.
Nic z tego dokumentu nie zostało wykonane na demo, stagingu ani produkcji.
Wszystkie komendy przećwiczone na sucho na bazie lokalnej — log:
`evidence/demo-pilotaz/PROBA_NA_SUCHO_20260906.md` (12 kroków, z liczbami).

**Zasada dokumentu:** każdy krok ma komendę i oczekiwany wynik. Krok bez jednego
z nich jest błędem dokumentu, nie „oczywistością".

---

## 0. SPROSTOWANIE — założenie zlecenia jest nieaktualne

Zlecenie (i `docs/program/TRZY_POJEMNIKI_PRACY_20260906.md:31`, i panel
`docs/program/plan-pojemniki/PANEL.html:273`) mówi: *„dziś demo i staging dzielą
bazę `trolley`"*. **To już nieprawda.** Pomiar z 06.09, wyłącznie odczyt:

```bash
railway variables --environment staging --service consultify --json > /tmp/staging-vars.json
railway variables --environment demo    --service consultify --json > /tmp/demo-vars.json
```

| | `DATABASE_URL` (host prywatny) | `DATABASE_PUBLIC_URL` | sha256(hasło)[:12] |
|---|---|---|---|
| staging | `pgvector.railway.internal:5432/railway` | `thomas.proxy.rlwy.net:52567/railway` | `82bf62d1c0bd` |
| demo | `pgvector.railway.internal:5432/railway` | `trolley.proxy.rlwy.net:28146/railway` | `0684fe2a930c` |

Nazwa hosta prywatnego jest ta sama, ale **hasła są różne, więc to dwie różne
bazy**. `pgvector.railway.internal` rozwiązuje się wewnątrz każdego środowiska do
JEGO pluginu. Potwierdzenie niezależne: `docs/program/PRZEKAZANIE_20260902.md:57`
wymienia zrzut `staging-thomas-20260902.dump`, a
`docs/program/funkcje/ODZYSKIWANIE_HASLA_20260902.md:19` — pomiar `psql` READ ONLY
na `thomas.proxy.rlwy.net:52567` jako na stagingu.

Który plik konfiguracji wygrywa: `server/src/config/DatabaseConfig.ts:176-183` —
`DATABASE_URL` ma pierwszeństwo przed `DB_HOST/DB_PORT/…`. Na stagingu
`DB_HOST=postgres.railway.internal` z jeszcze innym hasłem (`2d66d264962c`) to
**martwa konfiguracja po trzeciej, nieużywanej usłudze** — nic jej nie czyta,
ale warto ją skasować przy okazji (§F4 krok 6), żeby następny pomiar się o nią
nie potknął.

### Co z tego wynika dla zakresu 1.10

Rozdział baz **jest już faktem**. Zostaje to, co naprawdę blokuje pilotaż:

| | rzecz | stan |
|---|---|---|
| a | demo ma własną bazę | ✅ zrobione (trolley) |
| b | demo ma te same flagi co staging | ❌ **brakuje 27 flag**, 2 mają sprzeczną wartość |
| c | `CSRF_MODE=report` na demo | ❌ nie ma zmiennej (staging ma) |
| d | limiter AI z budżetem | ❌ `AI_BUDGETS_ENABLED` nie ustawione po żadnej stronie |
| e | dane pokazowe (Wyniki DBR77, Finanse CD PROJEKT) | ❓ do zmierzenia na trolley (F3) |
| f | czysta organizacja pilotażowa + 8 kont (DEC-402: 7 osób + administrator) | ⚠️ mechanika gotowa i zmierzona lokalnie (`scripts/demo/seed-organizacja-pilotaz.ts`), NIE uruchomiona jeszcze na demo/trolley |
| g | promocja z cofnięciem przećwiczona | ❌ `LISTA_KONTROLNA_PROMOCJI.md` |
| h | odciski bazy w GitHubie po ewentualnej zmianie bazy | ⚠️ pułapka, patrz F4 krok 5 |

**Decyzja do podjęcia przez właściciela przed F2:** czy demo zostaje na `trolley`
(wariant A — zero ryzyka, ale baza niesie cały historyczny bałagan demo:
104 organizacje, 65 kont na próbce lokalnej o tym samym rodowodzie), czy pilotaż
dostaje **świeżą, pustą bazę** (wariant B — czysta twarz produktu, ale trzeba
przeładować schemat i dane pokazowe). Rekomendacja CTO: **wariant B**, uzasadnienie
w §F2.

---

## Legenda faz

| faza | co | kto | czas | STOP |
|---|---|---|---|---|
| F1 | kopia zapasowa bazy demo | nadzorca | 15–40 min | kopia bez zgodnego sha256 |
| F2 | nowa baza demo (albo świadome zostanie przy trolley) | **właściciel decyduje**, nadzorca wykonuje | 10 min | brak decyzji właściciela |
| F3 | schemat + dane pokazowe + organizacja pilotażowa | nadzorca | 40–90 min | migracje nie przechodzą na czysto |
| F4 | przełączenie usługi demo + zmienne + odciski | nadzorca | 20 min | health ≠ SHA |
| F5 | cofnięcie (ćwiczenie i procedura) | nadzorca | 5 min | — |

Wszystkie komendy `railway`, które **zmieniają** cokolwiek, są w tym dokumencie
oznaczone `⛔ RĘCZNIE — NADZORCA` i podane dosłownie do przeklejenia. Żadna z nich
nie została wykonana przy pisaniu runbooka.

---

## F1 — kopia zapasowa bazy demo

**Kto:** nadzorca. **Czas:** 15–40 min (zależnie od rozmiaru trolley).
**Po co:** przed każdą zmianą na demo ma istnieć punkt powrotu, którego
autentyczność da się udowodnić liczbą, a nie pamięcią.

### F1.1 — pobierz publiczny adres bazy demo (odczyt)

```bash
railway variables --environment demo --service consultify --json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);const u=new URL(v.DATABASE_PUBLIC_URL);console.log(u.hostname+":"+u.port+"/"+u.pathname.slice(1));})'
```

**Oczekiwany wynik:** `trolley.proxy.rlwy.net:28146/railway`.
**STOP,** jeśli w odpowiedzi jest `centerbeam` — to produkcja, przerwij natychmiast.

### F1.2 — zrób kopię

`pg_dump` **nie jest zainstalowany na maszynie nadzorcy** (zmierzone: `which pg_dump`
→ brak). Skrypt sam użyje kontenera `pgvector/pgvector:pg16` i przepuści archiwum
strumieniem — **Docker Desktop na tym Macu nie udostępnia `/private/tmp` ani `/tmp`**
(zmierzone: `docker run -v /private/tmp/x:/praca alpine ls /praca` → katalog pusty),
więc montowanie katalogu nie zadziała, a strumień tak.

```bash
cd /private/tmp/wt-demo-prep    # albo katalog roboczy nadzorcy

export DATABASE_URL="$(railway variables --environment demo --service consultify --json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).DATABASE_PUBLIC_URL))')"

KATALOG_KOPII="$HOME/kopie-consultify" \
bash scripts/demo/kopia-bazy.sh --oczekiwany-host trolley --etykieta demo-przed-rozdzialem
```

**Oczekiwany wynik** (kształt, liczby będą własne):

```
[demo] cel: trolley.proxy.rlwy.net:28146/railway
[demo] klient Postgresa: docker (obraz: pgvector/pgvector:pg16)
[demo] zrzut → /Users/<user>/kopie-consultify/demo-przed-rozdzialem-<stempel>.dump
[demo] gotowe: <rozmiar> B, sha256 <64 znaki>, tabel w zrzucie: <ok. 1900>
/Users/<user>/kopie-consultify/demo-przed-rozdzialem-<stempel>.manifest.json
```

Ostatnia linia to **ścieżka manifestu** — zapisz ją, jest wejściem do F5.

**Miara odniesienia z próby lokalnej:** baza o 1802 tabelach dała zrzut 10,3 MB
w ~14 s i 1938 wpisów `TABLE` w archiwum.

**STOP,** jeśli skrypt napisał „zrzut jest PUSTY" albo jeśli nie powstał manifest.

### F1.3 — udowodnij, że kopia jest czytelna (nie tylko że plik istnieje)

```bash
bash scripts/demo/przywroc-baze.sh \
  --manifest "$HOME/kopie-consultify/demo-przed-rozdzialem-<stempel>.manifest.json" \
  --oczekiwany-host trolley
```

Bez `--tak-nadpisz` skrypt **nic nie pisze** — sprawdza istnienie pliku, sha256
i rozmiar.

**Oczekiwany wynik:**
```
[demo] manifest OK: … (<rozmiar> B, sha256 <…>)
[demo] TRYB SPRAWDZENIA — nic nie zapisano. Aby przywrócić, powtórz z --tak-nadpisz.
```
kod wyjścia `0`.

**STOP,** jeśli padnie „sha256 pliku NIE ZGADZA SIĘ z manifestem" — kopii nie ma,
powtórz F1.2.

### F1.4 — zapisz liczby odniesienia ZE ŹRÓDŁA (potrzebne w F3/F5)

```bash
docker run --rm -i pgvector/pgvector:pg16 psql "$DATABASE_URL" -At -F '|' -c "
 select
  (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'),
  (select count(*) from pg_constraint where contype='f'),
  (select count(*) from organizations),
  (select count(*) from users);"
```

**Oczekiwany wynik:** cztery liczby rozdzielone `|` — tabele, klucze obce,
organizacje, konta. **Zapisz je.** Liczba kluczy obcych jest tu nie dla ozdoby:
patrz F3.4.

---

## F2 — baza dla demo: zostać przy trolley czy założyć nową

**Kto:** decyzja właściciela, wykonanie nadzorca. **Czas:** 10 min.

### Wariant A — demo zostaje na `trolley`
*Za:* zero ruchu, zero ryzyka, kryterium 8a już spełnione.
*Przeciw:* pilotaż czterech osób startuje na bazie, która niesie cały historyczny
osad demo. Na próbce o tym samym rodowodzie: 104 organizacje i 65 kont, w tym
konta pracowników DBR77 przypisane do **innej** organizacji — a to blokuje
założenie im kont w organizacji pilotażowej pod ich własnymi adresami
(zmierzone, patrz F3.5).

### Wariant B — nowa, pusta baza w środowisku demo — **REKOMENDACJA**
*Za:* pilotaż zaczyna od czystej twarzy produktu; stary trolley zostaje
nietknięty jako natychmiastowe cofnięcie (jedna zmienna z powrotem, §F5.1);
przy okazji **dowodzimy, że produkt stawia się od zera** — czego dziś nie wiemy
na pewno (pamięć nadzorcy: „schemat mieszka poza migracjami", 27 tabel bez
pokrycia w migracjach).
*Przeciw:* trzeba przepuścić 1120 migracji na pustej bazie i przeładować dane
pokazowe (F3). Jeśli migracje nie przechodzą na czysto — to jest znalezisko
warte tej fazy, nie porażka.

**Nowy plugin, nie nowa baza w istniejącym pluginie.** Uzasadnienie: bramka
`scripts/validate-deploy-target.sh` porównuje **host**, a wszystkie trzy bazy
Railway nazywają się `railway` (DEC-165) — druga baza w tym samym pluginie miałaby
ten sam host i bramka nie odróżniłaby jej od starej. Osobny plugin daje osobny
host, więc odcisk znowu coś znaczy.

### F2.1 — założenie pluginu ⛔ RĘCZNIE — NADZORCA

```bash
railway add --database postgres --service pgvector-pilotaz --environment demo
```

**Oczekiwany wynik:** Railway tworzy usługę `pgvector-pilotaz` w środowisku `demo`
i nadaje jej własne `DATABASE_URL` / `DATABASE_PUBLIC_URL`.

**Uwaga (near-miss z 05.09, pamięć „podpięcie gałęzi Railway dotyka wszystkich
środowisk"):** `railway add` z pominiętym `--environment` trafia do środowiska
podlinkowanego w katalogu — dziś to **staging** (`railway status` → `Environment: staging`).
**Zawsze podawaj `--environment demo` jawnie.**

### F2.2 — odczytaj adres nowej bazy

```bash
railway variables --environment demo --service pgvector-pilotaz --json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);const u=new URL(v.DATABASE_PUBLIC_URL);console.log(u.hostname+":"+u.port+"/"+u.pathname.slice(1));})'
```

**Oczekiwany wynik:** `<nowy-host>.proxy.rlwy.net:<port>/railway`, host **inny** niż
`trolley` i **inny** niż `thomas`. Zapisz nazwę hosta — to nowy odcisk do F4.5.

**STOP,** jeśli host to `trolley`, `thomas` albo `centerbeam`.

---

## F3 — schemat i dane pokazowe na nowej bazie (tylko wariant B)

**Kto:** nadzorca. **Czas:** 40–90 min.

```bash
export NOWA_DB="$(railway variables --environment demo --service pgvector-pilotaz --json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).DATABASE_PUBLIC_URL))')"
```

### F3.1 — migracje na pustej bazie, tryb ścisły

```bash
cd /private/tmp/wt-demo-prep
DB_TYPE=postgres NODE_ENV=test DATABASE_URL="$NOWA_DB" \
  npx tsx server/scripts/migrate.postgres.ts
```

To ta sama komenda, którą stanowisko lokalne wykonuje na czystym kontenerze
(`scripts/dev/stanowisko-lokalne/migracje.sh`), **bez** `--allow-checksum-drift`.
`NODE_ENV=test` jest tu potrzebne, żeby przejść przez `assertNoLocalDatabaseOutsideTests`;
przy zdalnym hoście nie podstawia atrapy bazy, bo runner używa `pg.Pool` wprost.

**Oczekiwany wynik:** przebieg kończy się bez `FAILED`, liczba zastosowanych
migracji zbliżona do `ls server/migrations | wc -l` = **1120**.

**STOP,** jeśli którakolwiek migracja padnie. To jest dokładnie ten defekt, którego
szukamy (pamięć: „migracja przyrostowa nie jest dowodem") — zgłoś go jako
znalezisko, nie obchodź `--safe`.

### F3.2 — sprawdź, że schemat naprawdę stanął

```bash
docker run --rm -i pgvector/pgvector:pg16 psql "$NOWA_DB" -At -F '|' -c "
 select (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'),
        (select count(*) from pg_constraint where contype='f');"
```

**Oczekiwany wynik:** liczba tabel **rzędu 1800** i kluczy obcych **rzędu 1680**
(odniesienie z bazy lokalnej: `1802|1681`). Znacząco mniej = migracje nie doszły
do końca. **STOP.**

### F3.3 — dane pokazowe: Wyniki DBR77 i Finanse CD PROJEKT

Oba seedy mają `--dry-run` i `--rollback` — **zawsze najpierw dry-run**.

```bash
# Wyniki (KPI · OKR · ROI) dla DBR77
DATABASE_URL="$NOWA_DB" npx tsx server/scripts/seed-wyniki-dbr77.ts --org=DBR77 --dry-run
DATABASE_URL="$NOWA_DB" npx tsx server/scripts/seed-wyniki-dbr77.ts --org=DBR77 --apply

# Finanse — skonsolidowane sprawozdanie CD PROJEKT 2025 (org podaj id-em)
DATABASE_URL="$NOWA_DB" npx tsx server/scripts/finance-seed-cdprojekt.ts --dry-run --org=<ID_ORG_DBR77>
DATABASE_URL="$NOWA_DB" npx tsx server/scripts/finance-seed-cdprojekt.ts --apply   --org=<ID_ORG_DBR77>
```

**Oczekiwany wynik:** `--dry-run` wypisuje plan; `--apply` kończy się bez błędu;
**powtórny `--apply` wstawia 0 nowych wierszy** (oba seedy mają deterministyczne
identyfikatory — `seed-wyniki-dbr77.ts:44`, `finance-seed-cdprojekt.ts` §IDEMPOTENCJA).

**Warunek wstępny:** organizacja DBR77 musi na tej bazie istnieć. Na pustej bazie
załóż ją najpierw przez rejestrację w UI (to jednocześnie sprawdza kryterium
„świeża organizacja od zera") albo przenieś ją z kopii trolley zapytaniem
punktowym — decyzja nadzorcy, obie ścieżki są dopuszczalne, **żadna nie polega na
kopiowaniu całej starej bazy**, bo to unieważniłoby sens wariantu B.

### F3.4 — jeśli jednak przenosisz dane z trolley: policz klucze obce

**Znalezisko z próby na sucho (06.09), warte zapamiętania:**
`pg_restore` przywrócił **komplet danych** (1802 tabele, 104 organizacje, 65 kont
— co do wiersza), ale **11 kluczy obcych NIE powstało**, bo dane źródłowe je łamią:

```
artifact_lifecycle_events_organization_id_fkey        financial_statement_values_statement_id_fkey
financial_statement_ingest_runs_organization_id_fkey  financial_statement_versions_statement_id_fkey
financial_statement_ingest_runs_statement_id_fkey     fk_artifact_lifecycle_events_artifact_org
financial_statement_quality_runs_statement_id_fkey    fk_artifact_lifecycle_events_bv_org
financial_statement_source_artifacts_statement_id_fkey
financial_statement_validations_statement_pack_id_fkey
financial_statement_values_source_candidate_row_id_fkey
```

Licznik tabel po przywróceniu **zgadzał się idealnie** — czyli „tabele się zgadzają"
nie jest dowodem na wierną kopię. Dlatego `sprawdz-demo.sh` liczy klucze obce i
porównuje je z `OCZ_KLUCZE`:

```bash
OCZ_KLUCZE=<liczba ze źródła z F1.4> DATABASE_URL="$NOWA_DB" \
  bash scripts/demo/sprawdz-demo.sh --tylko-baza --oczekiwany-host <nowy-host>
```

**Oczekiwany wynik:** `OK  baza: kluczy obcych = <N> (zgodne z OCZ_KLUCZE)`.
Jeśli mniej — w bazie demo są wiersze-sieroty; zapisz to jako osobne znalezisko
i **nie** udawaj, że kopia jest wierna.

### F3.5 — organizacja pilotażowa „DBR77 Pilotaż" i 8 kont (DEC-402)

Lista 7 osób pierwszej linii mieszka w `scripts/demo/pilotaz-uzytkownicy.json`
(SSOT — DEC-402, właściciel, 06.09, `PLAN_DEMO_KLIENCI_I_POKAZY.md` §5). Ósme
konto — administrator organizacji — skrypt ustala SAM w czasie działania: próbuje
`piotr.wisniewski@dbr77.com` (prawdziwe konto właściciela, jeśli już jest na tej
bazie), inaczej `audyt@dbr77.local`. Jeśli wybrany e-mail już istnieje —
skrypt **nigdy go nie rusza** (zero zmiany hasła/roli/organizacji), dopisuje mu
tylko członkostwo `OWNER` w organizacji pilotażu. Podmień przez `--admin-email
<e-mail>`, jeśli trzeba inny.

Najpierw plan, bez zapisu:

```bash
DATABASE_URL="$NOWA_DB" npx tsx scripts/demo/seed-organizacja-pilotaz.ts \
  --oczekiwany-host <nowy-host> --dry-run
```

**Oczekiwany wynik:** plan na **8 kont** (7 + administrator), linia
`dry-run: plan obejmuje 8 kont (7 + administrator). N rzeczy do zmiany. Nic nie
zapisano.`

**Ostrzeżenie, które skrypt wypisuje sam:** e-mail Bartłomieja Straszaka jest na
domenie `db77.pl` (podanej przez właściciela w DEC-402), różnej od `dbr77.com`
pozostałych sześciu osób:
```
[pilotaz] OSTRZEŻENIE: bartlomiej.straszak+pilotaz@db77.pl — domena różna od
  dbr77.com — potwierdzić z właścicielem przed wysyłką zaproszenia.
```
To jest tylko ostrzeżenie (informacja do potwierdzenia), nie blokada.

**Pułapka, którą skrypt wykrywa sam (zmierzona na próbie):** jeśli któreś z 7
kont (aliasy `imie.nazwisko+pilotaz@…`) już istnieje na tej bazie w **innej**
organizacji (`users_email_key` jest globalne), skrypt wypisze `KONFLIKT` i **nic
nie zapisze** — decyzja należy do właściciela, skrypt jej nie podejmuje:
```
konto tomasz.jankowski+pilotaz@dbr77.com  KONFLIKT — konto istnieje już w innej
  organizacji (organization_id="cc9db573-…"). E-mail jest globalnie unikalny —
  nie przenoszę. Rozstrzygnij z właścicielem.
[pilotaz] KONFLIKTY: 1. Nic nie zapisano — to decyzja właściciela, nie skryptu.
```

Zapis:

```bash
DATABASE_URL="$NOWA_DB" npx tsx scripts/demo/seed-organizacja-pilotaz.ts \
  --oczekiwany-host <nowy-host> --apply \
  --haslo-plik "/private/tmp/stanowisko-noc/pilotaz-hasla-$(date -u +%Y%m%d).json"
```

(Domyślna ścieżka haseł w skrypcie, gdy nie podasz `--haslo-plik` z inną
lokalizacją, to właśnie `/private/tmp/stanowisko-noc/pilotaz-hasla-<data>.json`
— zawsze POZA repozytorium, zawsze `chmod 600`.)

**Oczekiwany wynik** (gdy administrator jest kontem JUŻ ISTNIEJĄCYM — nie dostaje
hasła, bo skrypt go nie rusza):
```
[pilotaz] hasła (7) zapisane do …/pilotaz-hasla-<data>.json (chmod 600). NIE są drukowane.
[pilotaz] utworzono=15 zmieniono=1
```
(15 = 1 organizacja + 7 kont + 7 członkostw; 1 zmieniono = dopisanie członkostwa
`OWNER` cudzemu/istniejącemu kontu administratora. Jeśli administrator też
trzeba założyć od zera — np. `audyt@dbr77.local` na czystej bazie — wtedy
`utworzono=16 zmieniono=0` i hasło administratora też ląduje w pliku, razem 8.)

Dowód idempotencji — uruchom **drugi raz**:

```bash
DATABASE_URL="$NOWA_DB" npx tsx scripts/demo/seed-organizacja-pilotaz.ts \
  --oczekiwany-host <nowy-host> --apply \
  --haslo-plik /private/tmp/stanowisko-noc/pilotaz-hasla-drugi-raz.json
```

**Oczekiwany wynik:** `utworzono=0 zmieniono=0` i `idempotentnie: nic nie było do
zrobienia.` — i plik haseł drugim razem w ogóle NIE powstaje (zero nowych haseł
do zapisania). Zmierzone lokalnie 06.09 (127.0.0.1:54400, `consultify_noc`):
dry-run 0 zmian, apply `utworzono=15 zmieniono=1`, drugi apply `utworzono=0
zmieniono=0`, `sprawdz-demo.sh --tylko-baza` → 8/8, rollback przywrócił bazę do
stanu sprzed (organizacje/konta wróciły do liczby wyjściowej), konto właściciela
nietknięte przez cały cykl.

**Cofnięcie (nowość — poprzednia wersja tego skryptu tego nie miała):**

```bash
DATABASE_URL="$NOWA_DB" npx tsx scripts/demo/seed-organizacja-pilotaz.ts \
  --oczekiwany-host <nowy-host> --rollback
```

Kasuje organizację pilotażu i konta, które seed **sam utworzył** — nigdy konto
administratora, jeśli było cudze/wcześniej istniejące (dostaje wtedy tylko
odebrane członkostwo, przez skasowanie organizacji — `organization_members` ma
`ON DELETE CASCADE`). Bezpieczne do uruchomienia dwa razy z rzędu (drugi raz:
„organizacja pilotażu już nie istnieje — nic do zrobienia").

**Hasła:** plik jest `chmod 600` i leży **poza repozytorium**. Przekaż go
właścicielowi kanałem prywatnym i skasuj. Nie wklejaj haseł do żadnego dokumentu,
zgłoszenia ani czatu.

**Typ organizacji = `PAID`, i to nie jest kosmetyka.**
`server/src/services/access/AccessTypes.ts`: `DEFAULT_TRIAL_LIMITS.max_users = 4`,
`DEFAULT_DEMO_LIMITS.max_users = 1`, `DEFAULT_PAID_LIMITS.max_users = 10000`.
Pilotaż ma **8 kont** (DEC-402) — na `TRIAL` piąte konto już uderzyłoby w limit,
na `DEMO` drugie. Seed ustawia `PAID` z tego powodu.

**Czego seed NIE robi:** nie nadaje `users.role = 'SUPERADMIN'` (i odmawia, gdyby
ktoś podał taką rolę w konfiguracji). Wymuszony superadmin zapisuje się w bazie na
trwałe i odbiera dostęp do `/chat` — to już raz zablokowało właściciela (05.09).
Nie rusza konta administratora, gdy jest cudze/wcześniej istniejące — zmierzone
testem izolacji `scripts/demo/__tests__/seed-organizacja-pilotaz.pg.test.mjs`
(`RUN_DB_TESTS=1`), włącznie z dowodem mutacyjnym: ręcznie ścięty guard
„administrator utworzony przez seed" w rollbacku faktycznie kasuje obce konto.

---

## F4 — przełączenie usługi demo i zmienne

**Kto:** nadzorca. **Czas:** 20 min.

### F4.1 — punkt powrotu: zapisz obecną wartość ⛔ zanim cokolwiek zmienisz

```bash
railway variables --environment demo --service consultify --json > "$HOME/demo-vars-przed-$(date -u +%Y%m%dT%H%M%SZ).json"
grep -c . /dev/null; node -e 'const v=require(process.argv[1]);console.log("zmiennych:",Object.keys(v).length)' "$HOME/demo-vars-przed-"*.json
```

**Oczekiwany wynik:** `zmiennych: 184` (stan z 06.09).
Ten plik to wejście do cofnięcia w F5.1 — **bez niego nie ruszaj dalej.**

### F4.2 — wskaż nową bazę ⛔ RĘCZNIE — NADZORCA (tylko wariant B)

```bash
railway variables --set 'DATABASE_URL=${{pgvector-pilotaz.DATABASE_URL}}' \
  --environment demo --service consultify --skip-deploys
railway variables --set 'DATABASE_PUBLIC_URL=${{pgvector-pilotaz.DATABASE_PUBLIC_URL}}' \
  --environment demo --service consultify --skip-deploys
```

Referencja `${{usługa.ZMIENNA}}` zamiast wklejonego łańcucha — dzięki temu rotacja
hasła po stronie pluginu nie wywraca aplikacji.
`--skip-deploys` przy każdej z osobna, żeby redeploy poszedł **raz**, po komplecie
zmian (F4.6).

### F4.3 — CSRF i limiter AI ⛔ RĘCZNIE — NADZORCA

```bash
railway variables --set "CSRF_MODE=report" --environment demo --service consultify --skip-deploys
railway variables --set "AI_BUDGETS_ENABLED=true" --environment demo --service consultify --skip-deploys
```

`CSRF_MODE` czyta `server/src/middleware/csrf.middleware.ts:34` — bez tej zmiennej
warstwa jest bezczynna (staging ma `report`, demo nie ma nic).
Limiter AI z budżetem to `AI_BUDGETS_ENABLED` (`server/src/services/ai/AIPipeline.ts:264-267`);
mechanizm jest **domyślnie włączony**, chyba że zmienna ma wartość `false` — ustawiamy
ją jawnie na `true`, żeby stan był widoczny w panelu, a nie domniemany.
Budżet per organizacja siedzi w kolumnie `organizations.monthly_budget_usd` — ustawia
się go w danych, nie w zmiennej środowiskowej.

### F4.4 — flagi: dosyp 27 brakujących ⛔ RĘCZNIE — NADZORCA

Lista jest **wyliczana**, nie przepisywana:

```bash
railway variables --environment staging --service consultify --json > /tmp/staging-vars.json
railway variables --environment demo    --service consultify --json > /tmp/demo-vars.json
node scripts/demo/porownaj-flagi.mjs /tmp/staging-vars.json /tmp/demo-vars.json
```

**Oczekiwany wynik dziś (zmierzone 06.09):**
```
ŹLE  flagi: demo NIE MA zmiennej CSRF_MODE (ma być „report")
ŹLE  flagi: demo NIE MA zmiennej AI_BUDGETS_ENABLED (ma być „true")
ŹLE  flagi: na demo BRAKUJE 27 flag ze stagingu: ENABLE_SIGNAL_PRODUCER ENABLE_TEST_SUPPORT
     VITE_ASSESSMENT_DOCX_ENABLED VITE_ASSESSMENT_OUTPUT_ARTIFACTS_ENABLED VITE_DRD_REPORT_ENABLED
     VITE_FINANCE_VALUE_PANELS VITE_GALERIA_SZABLONOW_ENABLED VITE_I18N_DEBUG VITE_IDEA_DECISION_LOG
     VITE_IDEA_DETAILS_IN_PANEL VITE_IDEA_FINANCIAL_CASE VITE_INITIATIVE_BRIDGE
     VITE_INTERVIEW_PENDING_REVIEW_TAB VITE_INTERVIEW_PIPELINE_STEPPER VITE_MELS_PREZENTACJE
     VITE_MELS_TABELE VITE_MYWORK_TWO_LEVEL_NAV VITE_NAV_DECLUTTER VITE_QUICK_ACCESS_ENABLED
     VITE_RECORD_PROVENANCE VITE_RESULTS_VNEXT_MANAGEMENT_REPORT_ENTRY_ENABLED VITE_STUDIO_ENABLED
     VITE_TEMPLATE_LIFECYCLE VITE_TOOLS_INSIGHTS_WIRING VITE_VF1_CANVAS_SPECA VITE_VF1_INIT_SPECA
     VITE_ZAI_TERESA_ENABLED
ŹLE  flagi: 2 flag o SPRZECZNEJ wartości: ENABLE_TEST_GATEWAY ENABLE_V8_SHADOW_MODE
INFO flagi: 4 flag zapisanych inną formą tej samej prawdy (1 vs true): VITE_TABELE_*
INFO flagi: 22 flag jest TYLKO na demo (staging ich nie ma): … VITE_RESULTS_VNEXT_KPI/OKR/ROI …
```

**Dwie decyzje w tej liście, nie jedna:**
1. **`ENABLE_TEST_SUPPORT` i `ENABLE_TEST_GATEWAY` NIE mają iść na demo** —
   to furtki testowe. Staging ma `ENABLE_TEST_SUPPORT` i `TEST_SUPPORT_KEY`; demo
   ma dziś `ENABLE_TEST_GATEWAY=true`, a staging `false`. Na demo pilotażowym obie
   mają być **wyłączone**. To jedyne dwa wyjątki od „te same flagi co staging".
2. **`VITE_I18N_DEBUG`** to narzędzie tłumacza, nie funkcja — na demo zostaw wyłączone.

Pozostałe 24 flagi ustaw hurtem (`VITE_*` są wypalane w build, więc i tak potrzebny
jeden redeploy):

```bash
for F in VITE_ASSESSMENT_DOCX_ENABLED VITE_ASSESSMENT_OUTPUT_ARTIFACTS_ENABLED \
         VITE_DRD_REPORT_ENABLED VITE_FINANCE_VALUE_PANELS VITE_GALERIA_SZABLONOW_ENABLED \
         VITE_IDEA_DECISION_LOG VITE_IDEA_DETAILS_IN_PANEL VITE_IDEA_FINANCIAL_CASE \
         VITE_INITIATIVE_BRIDGE VITE_INTERVIEW_PENDING_REVIEW_TAB VITE_INTERVIEW_PIPELINE_STEPPER \
         VITE_MELS_PREZENTACJE VITE_MELS_TABELE VITE_MYWORK_TWO_LEVEL_NAV VITE_NAV_DECLUTTER \
         VITE_QUICK_ACCESS_ENABLED VITE_RECORD_PROVENANCE \
         VITE_RESULTS_VNEXT_MANAGEMENT_REPORT_ENTRY_ENABLED VITE_STUDIO_ENABLED \
         VITE_TEMPLATE_LIFECYCLE VITE_TOOLS_INSIGHTS_WIRING VITE_VF1_CANVAS_SPECA \
         VITE_VF1_INIT_SPECA VITE_ZAI_TERESA_ENABLED ENABLE_SIGNAL_PRODUCER; do
  railway variables --set "$F=true" --environment demo --service consultify --skip-deploys
done
railway variables --set "ENABLE_TEST_GATEWAY=false" --environment demo --service consultify --skip-deploys
```

**Uwaga, bo to już raz kosztowało 108 flag:** `VITE_*` docierają do frontendu tylko
wtedy, gdy klucz jest wymieniony w `Dockerfile` (pamięć: „Vite: rozdzielony
import.meta.env"). Po redeployu sprawdź to strażnikiem, a nie wzrokiem:

```bash
node scripts/check-flags-env-static.mjs
```

### F4.5 — ⚠️ ODCISKI BAZY W GITHUBIE (wariant B — pułapka, która zablokuje deploy)

`.github/workflows/railway-deploy.yml` w zadaniu `promote-demo` woła
`scripts/validate-deploy-target.sh` z:
`vars.DEMO_DB_HOST_FINGERPRINT`, `secrets.DEMO_APP_DATABASE_URL`,
`secrets.DEMO_MIGRATION_DATABASE_URL`.

Po zmianie bazy **te trzy wartości wskazują starą bazę**. Skutki:
* jeśli `vars.DEPLOY_TARGET_GUARD_ENFORCE` jest włączone → **każda promocja na demo
  zostanie odrzucona** z komunikatem „database target mismatch";
* jeśli nie jest → promocja przejdzie z ostrzeżeniem, a bramka DEC-165 przestanie
  cokolwiek chronić (najgorszy z możliwych stanów: zielono i bez ochrony).

⛔ RĘCZNIE — NADZORCA, w ustawieniach repozytorium GitHub (Settings → Secrets and
variables → Actions):

| co | gdzie | nowa wartość |
|---|---|---|
| `DEMO_DB_HOST_FINGERPRINT` | Variables | nazwa nowego hosta, np. `sakura` — **nigdy `railway`**, bo to nazwa bazy wspólna dla wszystkich trzech i bramka jawnie ją odrzuca (`validate-deploy-target.sh`, FIX-4) |
| `DEMO_APP_DATABASE_URL` | Secrets | `DATABASE_PUBLIC_URL` nowej bazy |
| `DEMO_MIGRATION_DATABASE_URL` | Secrets | to samo połączenie co wyżej |

Sprawdzenie bez wchodzenia do GitHuba — odpal bramkę lokalnie:

```bash
DEPLOY_ENVIRONMENT=demo GIT_REF=refs/tags/staging-deployed \
FRONTEND_URL=https://demo.consultify.ai TARGET_ENVIRONMENT=demo \
DEPLOY_TARGET_GUARD_ENFORCE=1 \
DEMO_DB_HOST_FINGERPRINT=<nowy-host> \
APP_DATABASE_URL="$NOWA_DB" MIGRATION_DATABASE_URL="$NOWA_DB" \
bash scripts/validate-deploy-target.sh
```

**Oczekiwany wynik:**
`deploy-target: ok for demo (refs/tags/staging-deployed -> demo.consultify.ai, db identity verified: migration and application agree)`

### F4.6 — redeploy i pomiar zdrowia

Kod na demo idzie **wyłącznie** przez promocję taga `staging-deployed`
(workflow `Railway Deploy` → `workflow_dispatch`, `environment=demo`,
`confirm_demo=yes`). `scripts/deploy-demo.sh` jest wycofany od 31.08 i sam się blokuje.

⛔ RĘCZNIE — NADZORCA: uruchom workflow z GitHuba (Actions → Railway Deploy → Run
workflow → environment `demo`, confirm_demo `yes`).

Odczytaj, co naprawdę zostało wdrożone:

```bash
railway deployment list --service consultify --environment demo --limit 1 --json
bash scripts/demo/sprawdz-demo.sh --tylko-zdrowie --oczekiwany-sha <SHA z taga staging-deployed>
```

**Oczekiwany wynik:**
```
OK  zdrowie: status=ok
OK  zdrowie: database=connected
OK  zdrowie: gitSha = wdrożony commit (<SHA>)
WERDYKT: zgodność
```

**Uwaga (pamięć „health gitSha przybity zmienną"):** `/api/health` podaje
`APP_BUILD_SHA`, a tę zmienną **ustawia sam workflow** na promowany SHA
(`railway-deploy.yml`, krok „Deploy promoted SHA to demo"). Nie ustawiaj jej ręcznie —
ręczna wartość zamienia health w deklarację zamiast pomiaru. Wartość na 06.09:
`f3237e94230481d2bf4ad0a9c0dc10b1391191c9`.

**STOP,** jeśli `gitSha` ≠ SHA z `railway deployment list`. Wtedy porównaj oba
i nie ogłaszaj wdrożenia.

### F4.7 — pomiar końcowy, wszystkie trzy warstwy naraz

```bash
railway variables --environment staging --service consultify --json > /tmp/staging-vars.json
railway variables --environment demo    --service consultify --json > /tmp/demo-vars.json

OCZ_KLUCZE=<liczba z F3.2> DATABASE_URL="$NOWA_DB" \
bash scripts/demo/sprawdz-demo.sh \
  --oczekiwany-host <nowy-host> \
  --oczekiwany-sha  <SHA> \
  --flagi-staging /tmp/staging-vars.json --flagi-demo /tmp/demo-vars.json
```

**Oczekiwany wynik:** ostatnia linia `WERDYKT: zgodność`, kod wyjścia 0.
Każda linia `ŹLE` lub `POMINIĘTE` liczy się jako **niesprawdzone**, nie jako
zaliczone — skrypt celowo traktuje brak pomiaru jako porażkę.

### F4.8 — sprzątanie martwej konfiguracji (opcjonalne, ale zalecane)

Na demo i stagingu leżą zmienne `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`,
których **nic nie czyta**, dopóki `DATABASE_URL` jest ustawione
(`DatabaseConfig.ts:176-183`). Na stagingu wskazują trzecią, nieużywaną usługę
(`postgres.railway.internal`, inne hasło). Zostawione, będą kłamać następnemu
pomiarowi. ⛔ RĘCZNIE — NADZORCA, **po** potwierdzeniu zdrowia z F4.6:

```bash
for Z in DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD; do
  railway variables delete "$Z" --environment demo --service consultify
done
railway variables --environment demo --service consultify --json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);
      console.log("pozostale DB_*:", Object.keys(v).filter(k=>/^DB_/.test(k)).join(" ")||"(brak)")})'
```

**Oczekiwany wynik:** `pozostale DB_*: DB_SSL DB_TYPE` (te dwie są czytane niezależnie
od `DATABASE_URL` — `DatabaseConfig.ts:196-204`) i **żadnego** `DB_HOST/DB_PASSWORD`.

**Uwaga:** `railway variables delete` **nie ma** `--skip-deploys` (sprawdzone
`railway variables delete --help`), więc każde skasowanie wyzwala redeploy — rób to
jednym ciągiem i potem powtórz pomiar z F4.6.

**STOP:** nie rób tego przed F4.6 — gdyby `DATABASE_URL` zniknęło, to jedyna
awaryjna droga do bazy.

---

## F5 — cofnięcie

**Kto:** nadzorca. **Czas:** 5 min (F5.1) / 20–60 min (F5.3).

### F5.1 — powrót na starą bazę (wariant B, dramat po przełączeniu) — 5 minut

```bash
railway variables --set 'DATABASE_URL=${{pgvector.DATABASE_URL}}' \
  --environment demo --service consultify
railway variables --set 'DATABASE_PUBLIC_URL=${{pgvector.DATABASE_PUBLIC_URL}}' \
  --environment demo --service consultify
```

(bez `--skip-deploys` — chcemy redeploy natychmiast)

**Oczekiwany wynik:** po 1–3 min `curl -s https://demo.consultify.ai/api/health`
zwraca `"database":"connected"`, a demo działa jak przed zmianą, bo **stary
trolley nie został tknięty**.

**★ Pułapka, która wystąpiła 05.09 (pamięć „zmiana zmiennej wdraża obcy kod"):**
redeploy wywołany zmianą zmiennej bierze **ostatni commit z GitHuba**, a nie ten,
który stał na usłudze. Po cofnięciu zmiennej **zawsze** sprawdź:

```bash
railway deployment list --service consultify --environment demo --limit 2 --json
curl -s https://demo.consultify.ai/api/health
```

**Oczekiwany wynik:** `gitSha` z health = `commitHash` ostatniego wdrożenia.
Jeśli się różnią — wdrożył się inny kod; promuj świadomie tag `staging-deployed`.

### F5.2 — cofnięcie samego kodu (dramat funkcjonalny, baza w porządku)

Wg `Harvard/wdrozenie-100/_RUNBOOK_COFANIA.md`, warstwa 2:
Railway → deployments → poprzedni `SUCCESS` → „Rollback". ~30 s, zero gita.

Z linii poleceń:

```bash
railway redeploy --service consultify --environment demo --yes
```

**★ NIGDY nie dodawaj `--from-source`.** `railway redeploy` bez tej flagi odtwarza
**istniejące wdrożenie** (ten sam obraz, ten sam kod). Z `--from-source` Railway
pobiera **najnowszy commit z podpiętego źródła** — a to dokładnie mechanizm, który
05.09 wdrożył na środowisko kod, którego nikt nie promował (pamięć: „zmiana zmiennej
wdraża obcy kod").

**Oczekiwany wynik:**
```bash
railway deployment list --service consultify --environment demo --limit 2 --json
curl -s https://demo.consultify.ai/api/health
```
`commitHash` nowego wdrożenia = `commitHash` tego, do którego wracasz, i `gitSha`
z health = ta sama wartość.

**Nigdy force-push ani reset na `demo`** — cofanie zawsze do przodu.

### F5.3 — przywrócenie danych z kopii (utrata danych)

```bash
export DATABASE_URL="<połączenie do bazy, którą przywracasz>"
bash scripts/demo/przywroc-baze.sh \
  --manifest "$HOME/kopie-consultify/demo-przed-rozdzialem-<stempel>.manifest.json" \
  --oczekiwany-host <host-celu>          # najpierw BEZ --tak-nadpisz: samo sprawdzenie
bash scripts/demo/przywroc-baze.sh \
  --manifest "…" --oczekiwany-host <host-celu> --tak-nadpisz
```

**Oczekiwany wynik:** `pg_restore zakończony kodem 0 lub 1, linii błędów: N`
(kod 1 z błędami wyłącznie o kluczach obcych jest normalny — patrz F3.4),
a potem:

```bash
OCZ_KLUCZE=<liczba z F1.4> bash scripts/demo/sprawdz-demo.sh --tylko-baza --oczekiwany-host <host-celu>
```

**Zmierzone na próbie:** przywrócenie 1802 tabel zajęło **26 s**; dane wróciły
co do wiersza, 11 kluczy obcych nie.

### F5.4 — zamrożenie punktu bezpiecznego

Po akcepcie właściciela na żywym demo:

```bash
git tag demo-safe-$(date -u +%Y%m%d) <SHA promowany na demo>
git push origin demo-safe-$(date -u +%Y%m%d)
```

Ostatnie istniejące tagi: `demo-safe-20260904`, `demo-safe-20260905-p1`.

---

## Pytania do decyzji właściciela

| # | pytanie | rekomendacja CTO | co przyjęto na razie |
|---|---|---|---|
| 1 | Wariant A (zostajemy na trolley) czy B (świeża baza dla pilotażu)? | **B** — czysta twarz produktu + dowód, że produkt stawia się od zera | runbook opisuje oba, F3 dotyczy B |
| 2 | Jedna wspólna organizacja „DBR77 Pilotaż" czy osobne? | **jedna wspólna** — pilotaż ma sprawdzić współpracę | **ROZSTRZYGNIĘTE DEC-402 (06.09):** jedna wspólna organizacja, typ `PAID` |
| 3 | Lista osób i adres e-mail Iriny — nie występował nigdzie w repozytorium | podać przed F3.5 | **ROZSTRZYGNIĘTE DEC-402 (06.09):** 7 osób — Tomek, Kasia, Justyna, Irina Lebedjuk, Torian Richardson, Bartłomiej Straszak (`db77.pl` — do potwierdzenia), Paweł Mroczkowski; lista w `scripts/demo/pilotaz-uzytkownicy.json` |
| 4 | Konta pod prawdziwymi adresami czy pod aliasami `+pilotaz`? | zależy od wyniku `--dry-run`: jeśli konta już istnieją w innej organizacji, alias jest jedynym wyjściem bez ruszania cudzych rekordów | **ROZSTRZYGNIĘTE DEC-402 (06.09):** aliasy `+pilotaz` dla wszystkich 7 (zakodowane wprost w `pilotaz-uzytkownicy.json`, skrypt nie ma już flagi `--alias`) |
| 5 | Budżet AI per organizacja (`organizations.monthly_budget_usd`) — jaka kwota na pilotaż? | ustawić cokolwiek skończonego przed startem; dziś limiter jest wyłączony od 05.09 = rachunek bez sufitu | **ROZSTRZYGNIĘTE DEC-402 (06.09):** 50 USD |

---

## Czego ten runbook NIE obejmuje

* **Produkcji `consultify.ai` (`centerbeam`)** — pilotaż idzie na demo (kryterium 9
  pojemnika 2). Wszystkie skrypty w `scripts/demo/` odmawiają połączenia z hostem
  zawierającym `centerbeam`.
* **Migracji na żywej bazie demo** poza `migrate.postgres.ts` — procedura w skillu
  `consultify-promocja-demo`.
* **Odbioru wizualnego** — to osobna ścieżka (właściciel ocenia żywy obraz).
