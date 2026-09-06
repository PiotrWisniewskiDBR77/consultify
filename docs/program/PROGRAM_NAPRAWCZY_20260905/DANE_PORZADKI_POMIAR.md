# Dane — porządki: pomiar 4 problemów + skrypt naprawczy (dry-run)

Data pomiaru: 2026-09-06. Gałąź: `mvp/dane-porzadki` (worktree `/private/tmp/wt-dane-porzadki`).
Charakter zadania: **pomiar i propozycja — zero zapisów** na żadnej z dwóch baz. Wszystkie
zapytania niżej są `SELECT`; jedyny zapis, jaki ten dokument opisuje, to hipotetyczny
`--apply` skryptu naprawczego, który **nie został uruchomiony**.

Odróżnienie od pokrewnego dokumentu: `P3_KONIEC_ANGIELSKIEGO.md` w tym samym katalogu
audytuje angielskie stringi **zaszyte w kodzie UI** (komponenty, słowniki enumów,
i18n). Ten dokument audytuje angielskie **dane w bazie** (rekordy `initiatives`,
`decisions`, `raid_items` należące do organizacji DBR77) — inny warstwa, inna naprawa
(SQL `UPDATE` po dopasowaniu tekstu, nie zmiana kodu komponentu).

## UUID organizacji DBR77 — DWA RÓŻNE, po jednym na środowisko

| Środowisko | UUID | Zweryfikowane jak |
| --- | --- | --- |
| **Stanowisko lokalne** (Postgres `54400`, baza `consultify_noc`) | `cc9db573-260f-4a19-927f-f3cc1fbaea38` | `SELECT id,name FROM organizations WHERE name ILIKE '%dbr77%'` → jedyny wiersz z `name='DBR77'` dokładnie |
| **Staging** (Railway, `DATABASE_PUBLIC_URL`, baza `railway`) | `a3e05d4a-5397-419d-b486-8e44366c0063` | `SELECT id,name FROM organizations WHERE name ILIKE '%dbr77%'` → dwa wyniki: `a3e05d4a…` = `'DBR77'` (dokładne dopasowanie nazwy — użyty), `dbr77` = `'DBR77 Digital Consulting'` (inna organizacja, pominięta) |

Uwaga zgodna z ostrzeżeniem w zleceniu: uuid `a3e05d4a-5397-419d-b486-8e44366c0063`
krążący w przekazaniach jest **prawdziwy, ale tylko dla stagingu**. Na stanowisku
lokalnym ten sam uuid nie istnieje w `organizations` — użycie go tam trafiłoby w nic.
Skrypt naprawczy **wymaga** uuid jako argumentu i sam odmawia pracy, jeśli organizacja
nie istnieje w bazie, do której się połączył (`resolveOrg()`, patrz niżej) — więc pomyłka
uuid kończy się czytelnym błędem, nie cichym brakiem trafień.

---

## Problem 1 — angielskie nazwy inicjatyw

| Środowisko | Wszystkich inicjatyw DBR77 | Angielskich (do naprawy słownikiem) | Angielskich (dodatkowe, poza słownikiem — patrz niżej) |
| --- | --- | --- | --- |
| Lokalnie | 72 | **15** | **53** (dodatkowe odkrycie, patrz §1.3) |
| Staging | 97 | **0** | 4 (patrz §1.4 — inny wzorzec, nie z listy Piotra) |

### 1.1 Pierwotna lista Piotra — zweryfikowana 1:1

Wszystkie 12 nazw z zamówienia znalezione **dokładnie**, wyłącznie lokalnie, w jednej
partii wstawionej `2026-09-05T21:09:17` (15 wierszy, nie 12 — patrz §1.2):

`Supply Chain Optimization`, `Digital Workplace Platform`, `Vendor Consolidation`,
`Talent Upskilling Program`, `Legacy Decommission`, `ERP SAP Integration`,
`Security Hardening`, `Process Automation — RPA`, `API Gateway v2`,
`Data Platform — Lakehouse`, `DevOps Maturity Program`, `Compliance & GDPR Audit`.

### 1.2 Źródło znalezione — `server/scripts/seed-execution-reports-data.ts`

Ta sama partia (ta sama sekunda utworzenia) niesie **15**, nie 12, wierszy — dokłada
`Cloud Migration — Azure`, `Customer Portal Redesign`, `AI-Powered Analytics` (Piotr ich
nie wymienił, ale są tym samym problemem). Pełne 15 dopasowane 1:1 do literałów w
`server/scripts/seed-execution-reports-data.ts:96-110` (tablica `initiatives`), która
zasila też **decyzje** (§2.2) i **RAID** (§2.3) — jeden skrypt, trzy tabele.

Ciekawostka bez wpływu na naprawę: plik jawnie ustawia `const ORG = 'dbr77'` (literał),
a żywe wiersze w lokalnej bazie mają `organization_id = cc9db573-...`. Organizacja o id
dosłownie `'dbr77'` **nie istnieje** lokalnie (sprawdzone), więc skrypt musiał zostać
uruchomiony z podmienioną wartością `ORG` (nie tą, która jest dziś w repo) albo dane
przepisano `UPDATE` po fakcie. Nieustalone do końca — nie wpływa na naprawę, bo skrypt
naprawczy dopasowuje po **treści tytułu** w podanej organizacji, niezależnie od tego, co
go wstawiło.

### 1.3 ODKRYCIE DODATKOWE — 53 kolejne angielskie inicjatywy lokalnie (Piotr ich nie widział)

Pomiar poszedł szerzej niż ekran „Realizacja” (który pokazuje tylko `IN_EXECUTION`) i
znalazł **53 dalsze** angielskie inicjatywy w tej samej organizacji DBR77 lokalnie, o
statusach `DRAFT`/`PENDING_APPROVAL`/`APPROVED`/`CLOSED`/`REJECTED` — czyli poza
zakładką, na którą patrzył Piotr. Rozkład wg prefiksu id (= partia seeda):

| Prefiks id | Liczba | Przykład |
| --- | --- | --- |
| `init-drd-*` (test/final) | 20 | „SOC Enhancement — SIEM Full Deployment” |
| `init-siri-*` | 10 | „AGV Fleet Expansion & Traffic Management” |
| `init-adma-*` | 10 | „Digital Strategy Cascading Workshops” |
| `seed_ri_init_*` | 13 | „Approval SLA and escalation governance” |

**Dlaczego to NIE jest w skrypcie naprawczym**: to wygląda na dane wygenerowane przez
automatyczne fixtury e2e/QA (prefiksy `drd`/`siri`/`adma`/`seed_ri_init` to konwencje
nazewnicze testów, nie realnej pracy DBR77), które wylądowały w tej samej organizacji co
dane pokazowe. Zanim ktokolwiek je "przetłumaczy", trzeba rozstrzygnąć **czy w ogóle mają
zostać w organizacji pokazowej** (może powinny być usunięte/przeniesione, nie
przetłumaczone) — to decyzja właściciela, nie coś, co skrypt powinien zgadywać. Pełna
lista 53 tytułów z id: `docs/program/PROGRAM_NAPRAWCZY_20260905/DANE_PORZADKI_ZALACZNIK_53.csv`
(dołączona do tego commitu, wygenerowana bezpośrednio z żywego zapytania do bazy lokalnej,
żeby nie przepisywać ręcznie — nie pomyłka kopiowania).

### 1.4 Staging — inny, mniejszy wzorzec

Zero trafień ze słownika (12/15 nazw Piotra nie istnieje na stagingu). Cztery pojedyncze
angielskie tytuły niezwiązane z seedem lokalnym: `F1-26 from assessment`,
`F3 Rich Card Initiative`, `New Idea`, `P1` — krótkie, niejednoznaczne (mogą być
literaturą roboczą użytkownika, nie oczywistym tłumaczeniem) — **pominięte w słowniku
naprawczym**, bo automatyczne tłumaczenie 4-znakowego „P1” albo „New Idea” bez kontekstu
biznesowego byłoby zgadywaniem, nie naprawą.

---

## Problem 2 — angielskie tytuły decyzji i pozycji RAID

| Tabela | Środowisko | Wszystkich | Angielskich (w słowniku) | Uwagi |
| --- | --- | --- | --- | --- |
| `decisions` | Lokalnie | 35 | **15** | Ta sama partia co §1.2, ten sam plik `seed-execution-reports-data.ts:222-236` |
| `decisions` | Staging | 67 | **8** | 7 tytułów biznesowych + „Meeting Notes”; patrz §2.4 dla debris pominiętego |
| `raid_items` | Lokalnie | 16 | **16** (100%) | Ta sama partia, `seed-execution-reports-data.ts:262-278` |
| `raid_items` | Staging | 0 | 0 | Brak pozycji RAID dla DBR77 na stagingu |

### 2.1 Przykłady (5 z każdej tabeli/środowiska, gdzie występują)

**Decyzje lokalnie** (5 z 15): „Budget Approval Q2 — Cloud Migration”, „Vendor selection —
SAP integration partner”, „Go/No-Go — Data Platform MVP”, „Security architecture —
ZeroTrust approach”, „RPA vendor change to Automation Anywhere”.

**Decyzje staging** (5 z 8): „Launch public beta — go/no-go decision”, „Select AI model
provider for production workloads”, „Approve Q2 transformation budget — $450K allocation”,
„Adopt multi-provider LLM strategy to reduce vendor risk”, „Meeting Notes”.

**RAID lokalnie** (5 z 16): „Azure region outage risk”, „SAP vendor hotfix delay”, „GDPR
non-compliance penalty”, „UiPath license expired — blocking RPA”, „API Gateway depends on
Auth Service migration”.

### 2.4 Znalezisko dodatkowe (poza zakresem naprawy) — 16 wierszy testowych/E2E w `decisions` na stagingu

Przy okazji pomiaru dekcyzji na stagingu znaleziono **16 wierszy** z tytułami w stylu
`E2E Bulk BULK-hcm5in`, `E2E ToDecision-vztc3a`, `M05-E2E-CV-Dec-2jydvv`, `TEST P0 link
1781490572782` — to nie problem językowy (są po angielsku, ale to śmieci po testach e2e,
nie treść biznesowa do tłumaczenia). Osobno: **4 wiersze** z prefiksem `[M13SEED]` mają
treść PO POLSKU (np. „[M13SEED] Wybór dostawcy RPA”) — tylko sam tag w nawiasie jest
angielski, kosmetyczny, niska waga. Żadna z tych 20 pozycji nie jest w słowniku
naprawczym — to inny rodzaj długu (higiena testowa, nie lokalizacja) i wymaga osobnej
decyzji, żeby nie mieszać dwóch różnych napraw w jednym `--apply`.

---

## Problem 3 — czterokrotnie powtórzone zadania (tylko staging)

| Środowisko | Wszystkich zadań DBR77 | Grup zadań powtórzonych ≥4× | Wierszy-duplikatów do usunięcia |
| --- | --- | --- | --- |
| Lokalnie | 84 | **0** | 0 |
| Staging | 141 | **1** | **3** (4 kopie − 1 oryginał) |

Potwierdzone: zero duplikatów 4× lokalnie — zgodne z tym, co audytor zgłosił („TYLKO na
stagingu”).

**Sygnatura na stagingu** — tytuł `„Audyt 3 maszyn krytycznych pod PdM"`, identyczny
`status='todo'`, identyczny `assignee_id`, `initiative_id IS NULL` we wszystkich 4
wierszach, utworzone `2026-07-08` w odstępach **7–10 sekund** (03:23:17 → 03:23:24 →
03:23:33 → 03:23:43) — klasyczny wzorzec podwójnego/poczwórnego kliknięcia albo retry bez
`idempotency_key` (kolumna `idempotency_key` jest `NULL` na wszystkich czterech). Żaden z
czterech nie ma `initiative_id`, co samo w sobie jest osobną, mniejszą usterką (zadanie
audytowe niepodpięte pod inicjatywę) — nienaprawiane tu, bo naprawa dotyczy tylko
duplikacji, nie brakującego powiązania.

Sprawdzono też duplikaty 2× i 3× na stagingu (informacyjnie, NIE w zakresie skryptu — inny
wzorzec, prawdopodobnie legalne powtórzenie tej samej nazwy fazy w różnych inicjatywach):
14 grup 3×, 5 grup 2× (w tym m.in. `[PRODUCTION] BUG: …` — zgłoszenia błędów, osobny temat).
Skrypt naprawczy dotyka **wyłącznie** grup ≥4× z identyczną sygnaturą
(tytuł+status+assignee+initiative_id) — nie rusza 2×/3×, żeby nie skasować legalnie
powtarzającej się nazwy fazy w innej inicjatywie.

---

## Problem 4 — właściciele pozycji RAID bez `organization_members`

| Środowisko | Pozycji RAID | Właścicieli bez wiersza w `organization_members` | Z czego "bezpiecznych" (user istnieje, poprawny `users.organization_id`) |
| --- | --- | --- | --- |
| Lokalnie | 16 | **16 / 16** | 16/16 → 7 unikalnych użytkowników |
| Staging | 0 | 0 (nie dotyczy — brak pozycji RAID) | — |

### 4.1 Sprostowanie sformułowania audytora

Audytor zmierzył „16 na 16 właścicieli spoza organizacji” — pomiar to potwierdza
liczbowo, ale **doprecyzowuje mechanizm**: żaden z 7 właścicieli (Anna Kowalska, Marek
Nowak, Marta Kamińska, Katarzyna Wójcik, Paweł Mazur, Jan Zieliński, Tomasz Lewandowski)
nie jest naprawdę „spoza organizacji” — każdy ma poprawny wiersz w `users` z
`organization_id = cc9db573-...` (czyli DBR77). Problem jest inny: **tabela
`organization_members` nie ma dla nich żadnego wiersza**. Sprawdzone szerzej: cała
organizacja DBR77 lokalnie ma **31 użytkowników** w `users`, ale **tylko 1 wiersz** w
`organization_members` (jeden `OWNER`, konto `audyt@dbr77.local`). To sugeruje, że
`organization_members` jest ogólnie niedopełniona dla tej organizacji (nie tylko dla
siedmiu właścicieli RAID) — prawdopodobnie osobny, większy temat. Widziałem w repo ślad
równoległej pracy nad tym obszarem (nazwa pliku migracji sugerująca "org members
permission scope gap") w innej gałęzi/worktree — **nie sprawdzałem jej treści** (nie mój
worktree, poza zakresem tego zlecenia) i **nie koordynowałem** z nią; flaguję, żeby
uniknąć dwóch niezależnych napraw tego samego obszaru w tym samym czasie.

**Decyzja o zakresie naprawy**: skrypt naprawia wyłącznie tych **7 użytkowników, którzy
faktycznie są właścicielami pozycji RAID** (dokładnie to, co zmierzył audytor) — NIE
próbuje domyślnie uzupełnić wszystkich 31 brakujących członkostw, bo to wykracza poza
zmierzony problem i należy do szerszego tematu wspomnianego wyżej.

---

## Propozycje naprawy i ocena ryzyka

| # | Problem | Co zmienić na co | Ryzyko złej naprawy |
| - | --- | --- | --- |
| 1 | Nazwy inicjatyw (15 lokalnie) | `initiatives.name` (i `title`, jeśli równe `name`) z angielskiego tekstu na polski wg słownika `server/scripts/dane-porzadki/slownik-tlumaczen.json`, dopasowanie **dokładne** | Niskie — dopasowanie 1:1 po pełnym tekście, nie regex/fuzzy; rekord spoza słownika jest pomijany, nie zgadywany |
| 2a | Tytuły decyzji (15 lokalnie + 8 staging) | `decisions.title` wg tego samego słownika | Niskie — jak wyżej |
| 2b | Tytuły RAID (16 lokalnie) | `raid_items.title` wg tego samego słownika | Niskie — jak wyżej |
| 3 | Duplikaty zadań (3 na stagingu) | `DELETE` z `tasks` — zachowany najwcześniej utworzony wiersz w grupie o identycznej sygnaturze (tytuł+status+assignee+initiative_id) występującej ≥4× | **Średnie** — nieodwracalne bez manifestu; ograniczone przez sygnaturę ≥4× + wymóg identycznego assignee/status/initiative_id, żeby nie skasować 2–3 legalnie powtórzonych nazw fazy w różnych inicjatywach. Manifest + kopia CSV pozwalają cofnąć |
| 4 | Właściciele RAID bez członkostwa (7 lokalnie) | `INSERT INTO organization_members (role='MEMBER', status='ACTIVE')` dla użytkownika, który ma poprawny `users.organization_id` w tej samej organizacji | Niskie dla "bezpiecznych" (użytkownik potwierdzony w tej organizacji); skrypt **odmawia** wstawienia, gdy właściciel nie ma użytkownika w tej organizacji (prawdziwy przypadek cross-org) — te przypadki tylko raportuje, nigdy nie naprawia automatycznie |

Co się stanie, jeśli naprawa trafi w zły rekord:
- Problem 1/2 (tłumaczenia): dopasowanie jest po **całym, dokładnym tekście tytułu** — literówka albo inny szyk słów w tytule = brak dopasowania = rekord nietknięty. Nie ma częściowego/regexowego trafienia, więc nie da się "przypadkiem" zmienić rekordu, którego nie ma w słowniku.
- Problem 3 (kasowanie): błąd oznaczałby skasowanie prawdziwego zadania. Zabezpieczenia: (a) próg ≥4 identycznych kopii, (b) identyczna sygnatura (tytuł+status+assignee+initiative_id), (c) pełna kopia CSV + manifest PRZED `DELETE`, (d) drugi `--apply` musi wypisać 0. Rollback przywraca skasowane wiersze z manifestu.
- Problem 4 (insert członkostwa): najgorszy scenariusz — nadanie dostępu do organizacji użytkownikowi, który już jest w tej organizacji wg `users.organization_id`, tylko z innym poziomem uprawnień niż zamierzony (skrypt zawsze wstawia `role='MEMBER'`, nie zgaduje `ADMIN`/`OWNER`). Rollback = `DELETE` wstawionego wiersza (obsłużone osobno w trybie `--rollback`, bo nie jest to "przywrócenie skasowanego", tylko "cofnięcie wstawienia").

---

## Skrypt naprawczy

Ścieżka: `server/scripts/napraw-jezyk-i-czlonkostwo.ts` (wzorowany na
`server/scripts/usun-rekordy-aco.ts` + `server/scripts/higiena-wlasciciela/wspolne.ts` —
te same konwencje: dry-run domyślny, `--org` obowiązkowe bez wartości domyślnej,
`resolveOrg()` odmawia pracy, gdy uuid nie istnieje w podłączonej bazie, CSV planu +
manifest cofnięcia przed każdym zapisem, drugi `--apply` musi wypisać `ŁĄCZNIE: 0`).

Słownik tłumaczeń (edytowalny bez zmiany kodu): `server/scripts/dane-porzadki/slownik-tlumaczen.json`.

### Jak uruchomić — DRY-RUN (bezpieczne, żadnego zapisu)

```bash
# Stanowisko lokalne (Postgres 54400, użytkownik/hasło z docker inspect consultify-noc-pg)
DATABASE_URL="postgresql://postgres:noc@localhost:54400/consultify_noc" \
  npx tsx server/scripts/napraw-jezyk-i-czlonkostwo.ts \
  --org=cc9db573-260f-4a19-927f-f3cc1fbaea38 --problem=wszystkie --dry-run

# Staging (DATABASE_PUBLIC_URL z `railway variables --environment staging --service consultify --json`)
DATABASE_URL="<DATABASE_PUBLIC_URL ze stagingu>" \
  npx tsx server/scripts/napraw-jezyk-i-czlonkostwo.ts \
  --org=a3e05d4a-5397-419d-b486-8e44366c0063 --problem=wszystkie --dry-run
```

`--problem=` przyjmuje `1` (inicjatywy), `2` (decyzje+RAID), `3` (duplikaty zadań), `4`
(członkostwo RAID) albo `wszystkie` (domyślnie w przykładach wyżej).

### Jak uruchomić — TRYB ZAPISU (NIE URUCHAMIANY W TYM ZADANIU)

```bash
DATABASE_URL="…" npx tsx server/scripts/napraw-jezyk-i-czlonkostwo.ts \
  --org=<uuid> --problem=wszystkie --apply
```

Cofnięcie:

```bash
DATABASE_URL="…" npx tsx server/scripts/napraw-jezyk-i-czlonkostwo.ts \
  --org=<uuid> --rollback=evidence/higiena-danych/napraw-jezyk-i-czlonkostwo-…-manifest.json
```

---

## Dowód — oba przebiegi próbne (dry-run), wklejone z konsoli

### Lokalnie (org `cc9db573-...`) — 2026-09-06

```
PLAN · napraw-jezyk-i-czlonkostwo · DBR77 (cc9db573-260f-4a19-927f-f3cc1fbaea38) · dry-run

Problem: wszystkie · tryb: dry-run · organizacja: DBR77 (cc9db573-260f-4a19-927f-f3cc1fbaea38)

=== Problem 1: angielskie nazwy inicjatyw ===
PLAN CSV (15 wierszy): evidence/higiena-danych/problem1-inicjatywy-…-plan.csv
Dopasowania w bazie: 15 / pozycji w słowniku: 15

=== Problem 2a: angielskie tytuły decyzji ===
PLAN CSV (15 wierszy): evidence/higiena-danych/problem2-decyzje-…-plan.csv

=== Problem 2b: angielskie tytuły pozycji RAID ===
PLAN CSV (16 wierszy): evidence/higiena-danych/problem2-raid-…-plan.csv

=== Problem 3: czterokrotnie powtórzone zadania ===
PLAN CSV (0 wierszy): evidence/higiena-danych/problem3-duplikaty-zadan-…-plan.csv
Grup duplikatów (≥4×): 0 · wierszy do usunięcia: 0

=== Problem 4: właściciele RAID bez organization_members ===
PLAN CSV (7 wierszy): evidence/higiena-danych/problem4-czlonkostwo-raid-…-plan.csv
Właściciele RAID bez organization_members: 7 (bezpiecznych do naprawy: 7, wymagających decyzji: 0)

DRY-RUN: nic nie zostało zmienione. Uruchom ponownie z --apply po akcepcie właściciela.
DO ZMIANY / USUNIĘCIA ŁĄCZNIE: 53
```

Zweryfikowane po przebiegu, że baza jest nietknięta:
`SELECT count(*) FROM initiatives WHERE organization_id='cc9db573-...' AND name='Cloud Migration — Azure'` → `1` (angielska nazwa nadal tam, bo to był dry-run).

### Staging (org `a3e05d4a-...`) — 2026-09-06

```
PLAN · napraw-jezyk-i-czlonkostwo · DBR77 (a3e05d4a-5397-419d-b486-8e44366c0063) · dry-run

Problem: wszystkie · tryb: dry-run · organizacja: DBR77 (a3e05d4a-5397-419d-b486-8e44366c0063)

=== Problem 1: angielskie nazwy inicjatyw ===
PLAN CSV (0 wierszy)
Dopasowania w bazie: 0 / pozycji w słowniku: 15

=== Problem 2a: angielskie tytuły decyzji ===
PLAN CSV (8 wierszy): evidence/higiena-danych/problem2-decyzje-…-plan.csv

=== Problem 2b: angielskie tytuły pozycji RAID ===
PLAN CSV (0 wierszy)

=== Problem 3: czterokrotnie powtórzone zadania ===
PLAN CSV (3 wierszy): evidence/higiena-danych/problem3-duplikaty-zadan-…-plan.csv
  tasks | 5d13b4ae-… | "Audyt 3 maszyn krytycznych pod PdM" (kopia 2/4, utworzono 2026-07-08 05:23:24) → USUNIĘCIE — duplikat retry; zachowany oryginał: 7795c3b1-… (utworzono 2026-07-08 05:23:17)
  tasks | 0732411e-… | "Audyt 3 maszyn krytycznych pod PdM" (kopia 3/4, utworzono 2026-07-08 05:23:33) → USUNIĘCIE — duplikat retry; zachowany oryginał: 7795c3b1-…
  tasks | 9cd03a9a-… | "Audyt 3 maszyn krytycznych pod PdM" (kopia 4/4, utworzono 2026-07-08 05:23:43) → USUNIĘCIE — duplikat retry; zachowany oryginał: 7795c3b1-…
Grup duplikatów (≥4×): 1 · wierszy do usunięcia: 3

=== Problem 4: właściciele RAID bez organization_members ===
PLAN CSV (0 wierszy)
Właściciele RAID bez organization_members: 0 (bezpiecznych do naprawy: 0, wymagających decyzji: 0)

DRY-RUN: nic nie zostało zmienione. Uruchom ponownie z --apply po akcepcie właściciela.
DO ZMIANY / USUNIĘCIA ŁĄCZNIE: 11
```

Zweryfikowane po przebiegu: `SELECT count(*) FROM tasks WHERE organization_id='a3e05d4a-...'
AND title='Audyt 3 maszyn krytycznych pod PdM'` → `4` (wszystkie 4 kopie nadal tam, bo to
był dry-run).

Pełne pliki CSV z obu przebiegów (wygenerowane automatycznie przez skrypt, nie przepisywane
ręcznie) leżą w `evidence/higiena-danych/` w tym worktree, zgodnie z konwencją
`usun-rekordy-aco.ts`/`wspolne.ts` (`EVIDENCE_DIR`). Ten katalog **nie jest** w `.gitignore`,
ale świadomie NIE dołączam go do commitu — każdy przebieg (w tym każdy kolejny `--dry-run`
uruchomiony przez kogokolwiek) tworzy nowe znaczone czasem pliki, więc commitowanie ich
zaśmiecałoby repo powtarzalnymi artefaktami przebiegu, nie treścią do przeglądu. Commit
niesie tylko dokument, skrypt, słownik i jeden ręcznie wybrany załącznik (53 dodatkowych
tytułów, §1.3) — reszta dowodu jest wklejona jako tekst konsoli niżej.

---

## Czego NIE zmierzono i dlaczego

1. **Angielskie tytuły `initiative_milestones`/`budget_line_items`** — ten sam skrypt
   `seed-execution-reports-data.ts:331-345` wstawia też angielskie nazwy kamieni milowych
   (`Cloud infra ready for prod`, `SOC2 Type II certification`…). Nie były częścią żadnego
   z czterech zdefiniowanych problemów ani listy Piotra — zauważone przy okazji czytania
   skryptu źródłowego, nie zmierzone osobno (brak czasu w budżecie tego zlecenia; do
   ewentualnego piątego problemu, jeśli właściciel zdecyduje).
2. **Angielskie tytuły zadań (`tasks.title`)** — ten sam skrypt tworzy dziesiątki
   angielskich zadań („Create data quality checks”, „SAP FI module config”…). Problem 3 w
   zleceniu dotyczył wyłącznie **duplikacji** zadań, nie ich języka — więc język zadań nie
   był w zakresie pomiaru i nie ma liczby w tym dokumencie.
3. **53 dodatkowe angielskie inicjatywy lokalnie (§1.3)** — zmierzone co do liczby i
   przykładów, ale **nie przygotowano dla nich tłumaczeń** w słowniku, bo nie wiadomo, czy
   to dane do przetłumaczenia czy dane do usunięcia (wyglądają na fixtury e2e/QA w
   organizacji pokazowej) — to decyzja właściciela, nie coś do zgadnięcia.
4. **16 wierszy testowych/E2E w `decisions` na stagingu (§2.4)** — zmierzone liczbowo, nie
   naprawiane (inny rodzaj problemu niż język).
5. **Szerszy stan `organization_members`** (31 użytkowników / 1 członkostwo lokalnie,
   §4.1) — zmierzony liczbowo jako kontekst dla Problemu 4, ale **nie zbadany w całości**
   (nie sprawdzono innych organizacji ani czy to systemowa luka, czy specyfika danych
   demo DBR77) — poza zakresem tego zlecenia; oznaki równoległej pracy nad tym tematem
   widziane, ale nieprzeczytane (nie mój worktree).
6. **Produkcja / demo.consultify.ai** — nie dotykane, nie sprawdzane. Zlecenie ograniczało
   pomiar do stanowiska lokalnego i stagingu.
7. **Wpływ naprawy na raporty/dashboardy, które mogłyby cache'ować stare angielskie tytuły**
   (np. materializowane widoki, `report_definition` z `ie_aggregate_state`) — nie
   sprawdzono, czy istnieją takie zależne kopie tytułów gdzie indziej w bazie; skrypt
   naprawia tylko trzy tabele źródłowe (`initiatives`, `decisions`, `raid_items`).

---

## SHA i stan gałęzi

Worktree: `/private/tmp/wt-dane-porzadki`, gałąź `mvp/dane-porzadki`.
HEAD przed tym commitem: `9d468abffd` (merge Realizacja — filtr IN_EXECUTION, DEC-441).
Ten dokument + skrypt + słownik dodane jednym commitem na wierzchu tego HEAD (SHA w
komunikacie `git log -1` po commicie, patrz meldunek sesji).
