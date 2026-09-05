# Seed „Wyniki" (KPI · OKR · ROI) — realne dane DBR77

Data: 2026-09-05 · Gałąź: `data/seed-wyniki-dbr77` (baza: `origin/staging` @ `d963af93b0`)
Skrypt: `server/scripts/seed-wyniki-dbr77.ts` · Dowód: `server/src/services/resultsVnext/__tests__/seedWynikiDbr77.pg.test.ts`
Tag seeda: `seed:wyniki-dbr77-20260905`

## 1. Co robi seed i dlaczego tak

Moduł Wyniki był pusty — w organizacji DBR77 istniał tylko jeden ćwiczebny miernik,
jeden raport, jeden zestaw OKR i jedna analiza ROI z próby odbiorowej z 13.08.
Seed dokłada komplet danych zakładu:

- **KPI** — 138 mierników z arkusza właściciela (`Apator_szablon_raport_KPI_20260905_Ogolny.csv`,
  Plant Balanced Scorecard) z nazwą, obszarem, metodą liczenia, definicją, kierunkiem,
  jednostką, częstotliwością, typem i odpowiedzialnością; 1098 pomiarów (I–IX 2026,
  para CEL/Rezultat na miesiąc; X–XII bez danych); 3 raporty (główny + produkcja Q3 + jakość VIII).
- **OKR** — 2 cykle (Q4 2026, H2 2026), 3 zestawy, 10 celów, 28 rezultatów kluczowych,
  28 check-inów; właściciele to REALNI użytkownicy organizacji z bazy (nazwiska, nie UUID).
- **ROI** — 3 analizy z zaakceptowanego prototypu wraz z 3 inicjatywami, na których wiszą
  (`rvn_roi_cases.initiative_id` to klucz obcy NOT NULL do `initiatives`).

### Trzy własności, które seed musiał mieć

| Własność | Jak zrobiona |
| --- | --- |
| Idempotentność | KAŻDY identyfikator to UUIDv5 z `TAG + organizacja + klucz naturalny`. Powtórny `--apply` nie dokłada ani jednego wiersza (`ON CONFLICT DO NOTHING` + ten sam id). Nie ma manifestu, bo deterministyczny id działa tak samo na każdej bazie. |
| Addytywność | Seed nigdy nie robi UPDATE ani DELETE na cudzym wierszu. Jedyne UPDATE to `current_definition_version_id` i `active_policy_version_id` — oba z warunkiem `IS NULL`, więc nie nadpisują cudzej wartości. |
| Odwracalność | `--rollback` kasuje WYŁĄCZNIE wiersze o deterministycznych identyfikatorach seeda, w kolejności odwrotnej do zapisu. |

### Pułapka, która przesądziła o kształcie seeda

Repozytoria Wyników filtrują odczyt przez `rvn_platform_resource_visibility`
(`buildVisibilityScopedCte`). Wiersz bez wpisu widoczności **istnieje w tabeli i jednocześnie
nie istnieje dla ekranu**. Dlatego seed dokłada 147 wpisów widoczności (kpi, kpi_scorecard,
okr_set, roi_case) i re-używa AKTYWNYCH polityk organizacji zamiast tworzyć własne.
Test broni tego mutacyjnie (patrz §4).

## 2. Schemat — co ma pole, a co nie

Elementy arkusza właściciela zmapowane na dzisiejszy schemat (bez ani jednej nowej migracji):

| Element arkusza | Pole w schemacie |
| --- | --- |
| Nazwa miernika | `rvn_kpi_definition_versions.name` |
| Definicja | `.description` |
| Metoda liczenia | `.formula_text` |
| Kierunek min./max. | `.target_geometry` (`threshold_min` / `threshold_max`) |
| Jednostka | `.unit` |
| Częstotliwość | `.measurement_frequency_days` |
| Odpowiedzialność (osoba) | `rvn_kpi_definitions.owner_user_id` |
| CEL (roczny) | `.target_value` + progi `warning_*` / `critical_*` |
| Rezultat per okres | `rvn_kpi_measurements.actual_value` + `period_start/end` |
| Raport i zakres | `rvn_kpi_scorecards` |

### Elementy arkusza BEZ własnego pola w schemacie (lista dla P7K część A)

Te elementy **nie mają dziś kolumny**. Seed nie zgaduje i nie podkłada ich pod cudze pole —
zapisuje je jawnie i rozpoznawalnie tam, gdzie da się je później przenieść:

| Element | Gdzie tymczasowo trafił | Co trzeba dodać |
| --- | --- | --- |
| **Obszar** (SALES DIRECTOR, DPW, EHS, LEAN…) | `rvn_kpi_scorecard_items.display_config.obszar` | jawne pole/relacja obszaru na pozycji raportu |
| **Właściciel nadrzędny (MD)** | `display_config.wlascicielNadrzedny` | pole semantyczne, nie wyprowadzać z ownera |
| **Grupa (MT)** | `display_config.grupa` | j.w. |
| **Typ wskaźnika** (Rozliczeniowy/Informacyjny) | `display_config.typWskaznika` | enum ograniczony do wartości SSOT |
| **Benchmark** | `display_config.benchmark` | nullable numeric, „—" gdy brak |
| **Dopuszczalny limit [%]** | `display_config.dopuszczalnyLimitPct` | nullable numeric; progi `warning_*`/`critical_*` są ABSOLUTNE, nie procentowe |
| **CEL per okres** (12 miesięcy osobno) | `rvn_kpi_measurements.evidence_refs[0]` jako `{"kind":"seed_period_target"}` + `notes` | kontrakt celu okresowego powiązany z raportem, miernikiem i okresem |
| **YTD** | brak | wyliczać wg częstotliwości, nie utrwalać drugiej prawdy |
| **Edycja / data rewizji / przygotował** | brak | metadane raportu |
| **Rekomendacja ROI** (GO / CONDITIONAL GO) | `rvn_roi_calculation_policy.notes` jako jawne zdanie | enum rekomendacji na zatwierdzonym wyniku |
| **Klasa korzyści Hard/Avoided/Soft/Strategic** | prefiks w `rvn_roi_benefit_lines.description` | osobne pole klasy |
| **ΔNWC / contingency / przyrostowy OPEX jako osobne kategorie** | `rvn_roi_assumptions` (kategorie `working_capital`, `contingency`, `opex`) | kategorie semantyczne na `cost_lines` |
| **Temat celu OKR, zespół KR, termin KR** | brak | pola addytywne na celu/KR |

To pokrywa się z ustaleniami `evidence/p7k-wyniki/KROK_0_MAPOWANIE_SSOT_SCHEMA_DTO.md` —
seed niczego tam nie zmienia, tylko potwierdza listę na realnych danych.

### Dwie decyzje, które podjąłem sam

1. **Wartości liczbowe są wygenerowane, nie przepisane.** Arkusz właściciela to SZABLON —
   kolumny BENCHMARK, DOPUSZCZALNE LIMITY oraz wszystkie pola CEL/Rezultat są w nim **puste**
   (0 ze 138 wierszy ma benchmark, 0 ma limit). Nazwy, obszary, kierunki, jednostki,
   częstotliwości i odpowiedzialności są przepisane z arkusza 1:1; liczby są deterministycznie
   wygenerowane jako wiarygodne dla zakładu DBR77 (zakresy dobrane per jednostka), nie zerowe
   i z wyraźnymi odchyleniami.
2. **Stan pomiaru liczy ten sam ewaluator co aplikacja.** Skrypt importuje
   `evaluatePerformanceStatus` z `targetGeometryEvaluator.ts` i zapisuje JEGO wynik — nie własne
   założenie. Dzięki temu para CEL/Rezultat i kolorowy stan nigdy się nie rozjadą. Przy tej
   okazji wyszło, że dla mierników całkowitych o małym celu (np. 3 szt.) próg ostrzegawczy po
   zaokrągleniu zbiega się z celem i pasmo „ostrzeżenie" jest NIEOSIĄGALNE — seed wymusza
   odstęp minimum jednego kroku zaokrąglenia.

Rozkład stanów raportu głównego wychodzi **93 w normie / 21 ostrzeżenie / 8 krytyczne /
16 brak danych** — dokładnie te liczby, które właściciel zaakceptował na prototypie
`dev-render/screens/p7k-wyniki-prototype.tsx`. Miesiącem odniesienia jest **sierpień 2026**,
bo karta liczy rozkład z pomiaru o `period_end <= now()`, a wrzesień (`period_end` 30.09)
jeszcze się nie skończył — pomiary wrześniowe mają `data_quality_status = 'estimated'`.

## 3. Liczby

### Jednorazowy Postgres (kontener `seed-wyniki-pg`, `127.0.0.1:54340`, pełne migracje)

| Pozycja | dry-run | po `--apply` | po 2. `--apply` | po `--rollback` |
| --- | --- | --- | --- | --- |
| mierniki KPI | 138 | 138 | 138 | 0 |
| pomiary KPI | 1098 | 1098 | 1098 | 0 |
| raporty KPI (pozycje) | 3 (180) | 3 (180) | 3 (180) | 0 (0) |
| cykle / zestawy / cele / KR / check-iny OKR | 2/3/10/28/28 | 2/3/10/28/28 | 2/3/10/28/28 | 0 |
| inicjatywy · analizy ROI · pozycje · przebiegi | 3 · 3 · 9 · 2 | 3 · 3 · 9 · 2 | 3 · 3 · 9 · 2 | 0 |
| wpisy widoczności | 147 | 147 | 147 | 0 |

Wiersze cudzej organizacji (kontrolne KPI + polityka widoczności) — **nietknięte po apply i po
rollbacku** (liczba przed = liczba po). Po pełnym przebiegu testu na czystej bazie zostaje
**zero** wierszy seeda.

### Staging (`thomas.proxy.rlwy.net:52567/railway` — baza WSPÓŁDZIELONA, twarz produktu)

- Organizacja trafiona: **DBR77**, id `a3e05d4a-5397-419d-b486-8e44366c0063`.
- Właściciele przypisani do mierników i celów (6 realnych, aktywnych członków):
  Tomasz Jankowski, Piotr Wiśniewski, Marek Nowak, Krzysztof Zieliński, Julia Lewandowska, Justyna Laskowska.
- Polityki widoczności: **wszystkie trzy już istniały i zostały ponownie użyte** —
  `kpi=OPEN_ORG`, `okr=OPEN_ORG`, `roi=ROI_GOVERNED` (plus istniejący wpis
  `rvn_roi_visibility_governance`, dzięki któremu OWNER/ADMIN widzi ROI). Seed nie utworzył
  żadnej nowej polityki i nie zmienił postawy widoczności organizacji.
- Wierszy seeda przed apply: **0**. Po apply: **komplet jak w tabeli wyżej**.
  Ponowny `--dry-run` po apply: 0 nowych.

Odczyt przez REALNE repozytoria aplikacji jako Piotr Wiśniewski
(`d2b6a316-08c5-47cf-9bf7-4ba50311d5a2`), nie przez `SELECT` z boku:

```
RAPORTY KPI widoczne dla Piotra: 4
  - Karta wyników transformacji            (istniejąca, próba odbiorowa 13.08)
  - Plant Balanced Scorecard — Zakład DBR77
  - KPI produkcji — Q3 2026
  - KPI jakości — sierpień 2026
ROZKŁAD raportu głównego: { safe: 93, warning: 21, critical: 8, missing: 16, totalVisible: 138 }
ZESTAWY OKR: 4   (3 z seeda + 1 istniejący)
ANALIZY ROI: 4   (3 z seeda + 1 istniejąca)
```

## 4. Dowód, że test naprawdę broni tych twierdzeń

`server/src/services/resultsVnext/__tests__/seedWynikiDbr77.pg.test.ts` — 5 twierdzeń,
5 PASS na realnym Postgresie. Dwie mutacje celujące w SAMO zabezpieczenie:

| Mutacja | Wynik |
| --- | --- |
| usunięty INSERT wpisu widoczności raportu KPI | **RED** — `expected [] to deeply equal ['KPI jakości…', …]`; raporty są w tabelach, a lista na ekranie pusta |
| usunięty DELETE pomiarów w `rollbackSeed` | **RED** — test rollbacku pokazuje 1098 pozostałych wierszy |
| przywrócenie kodu (`git diff` czysty) | **GREEN** 5/5 |

Komenda:
```
NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres:test@127.0.0.1:54340/seedtest \
  npx vitest run src/services/resultsVnext/__tests__/seedWynikiDbr77.pg.test.ts --retry=0
```
(uruchamiane z katalogu `server/`). Bez `RUN_DB_TESTS=1` plik jest pominięty, a nie „zielony".

`cd server && npx tsc --build tsconfig.build.json` — **exit 0**.

## 5. Komendy

```bash
# podgląd (nic nie zapisuje)
DATABASE_URL=<url> npx tsx server/scripts/seed-wyniki-dbr77.ts --org=DBR77 --dry-run

# zapis
DATABASE_URL=<url> npx tsx server/scripts/seed-wyniki-dbr77.ts --org=DBR77 --apply

# WYCOFANIE — kasuje wyłącznie wiersze z tagiem seed:wyniki-dbr77-20260905
DATABASE_URL=<url> npx tsx server/scripts/seed-wyniki-dbr77.ts --org=DBR77 --rollback
```

`<url>` dla stagingu = `DATABASE_PUBLIC_URL` z
`railway variables --environment staging --service consultify --json`
(host `thomas.proxy.rlwy.net` — proxy NIE obsługuje SSL, dlatego skrypt włącza SSL tylko
gdy adres zawiera `sslmode=require`).

## 6. Ryzyka i rzeczy do rozstrzygnięcia

1. **Dwie organizacje z „DBR77" w nazwie.** `DBR77` (`a3e05d4a-…`, 9 użytkowników, 94 inicjatywy,
   konto logowania właściciela `piotr.wisniewski@dbr77.com`) oraz `DBR77 Digital Consulting`
   (`dbr77`, 7 użytkowników, 7 inicjatyw, konto `piotr@dbr77.com`). Seed rozstrzyga to
   deterministycznie: `--org=DBR77` dopasowuje **dokładną nazwę**, więc trafia wyłącznie
   w pierwszą. Gdyby właściciel pracował na tej drugiej — `--rollback`, potem
   `--org="DBR77 Digital Consulting" --apply`.
2. **Listy pokazują 4 pozycje, nie 3.** W każdej z trzech list wisi jeden wiersz z próby
   odbiorowej z 13.08 (`Karta wyników transformacji`, `Przyspieszyć realizację wartości
   transformacji`, `Program poprawy realizacji korzyści`). Seed jest addytywny i cudzych
   wierszy nie kasuje — decyzja o ich usunięciu należy do właściciela.
3. **3 nowe inicjatywy w module Inicjatywy.** Analiza ROI ma klucz obcy NOT NULL do
   `initiatives`, więc seed zakłada trzy inicjatywy o nazwach analiz. Pojawią się na liście
   Inicjatyw. `--rollback` je usuwa.
4. **`rvn_kpi_measurements` ma `REVOKE UPDATE, DELETE FROM PUBLIC`.** Rollback działa, bo
   połączenie idzie rolą właściciela bazy (`postgres`). Z konta o mniejszych uprawnieniach
   rollback pomiarów by się nie udał.
5. **CEL per okres w `evidence_refs`** to obejście, nie docelowy kontrakt. Do usunięcia,
   gdy P7K część A doda właściwą kolumnę — wpisy są rozpoznawalne po `kind: "seed_period_target"`.
6. Baza stagingu jest współdzielona z demo — te dane zobaczy każdy, kto wejdzie na demo
   jako członek organizacji DBR77.
