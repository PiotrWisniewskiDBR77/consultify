# QD15 — audyt `.down.sql` dla migracji ≥ 20262260 (Wpis 193, kolumna D v2)

Data pomiaru: 2026-09-19 02:05–02:31 CDT
Tip linii: `700e8f8e98de88b8ab0f20b33ca73f1dbdca362a` (`origin/integracja/20260911`)
Kopia: `~/Developer/kopie/staging-pre-d121-20260918.dump` → kontener `qoder-d-pg-5`
(`pgvector/pgvector:pg17` = PostgreSQL 17.11, `127.0.0.1:6634`), bazy
`consultify_qd15` (audyt pełny) i `consultify_qd15_iso` (izolacje + mutacje).
Staging i demo nietknięte — zero zapisów poza tym kontenerem.

## Werdykt w liczbach

| miara | liczba |
|---|---|
| migracji ≥ 20262260 na linii | **15** |
| z plikiem `rollback/<base>.down.sql` | **13** |
| **BEZ pliku `.down.sql`** | **2** (`20262260`, `20262286`) |
| downów transakcyjnych (`BEGIN;`) | 9 z 13 |
| cykli UP→DOWN→UP z RC=0 we wszystkich trzech krokach | **12 z 13** |
| cykli, w których schemat wrócił semantycznie do baseline (SEM=TAK) | **9 z 13** |
| cykli z `pg_dump -s` diff = 0 linii | **5 z 13** |
| cykli, w których DOWN realnie zmienił schemat (DOWNeff=TAK) | 11 z 13 |
| **defektów produktu znalezionych przez audyt** | **3** (D-129, D-130, D-131) |
| odtwarzalność: dwa niezależne świeże restore'y, diff wyników | **0 różnic** |

## Tabela wyników (audyt pełny, `wyniki-runC-FINAL.txt`)

Kolejność = odwrotna chronologiczna, czyli realna kolejność rollbacku.
Kolumny: `up1/down/up2` = RC trzech kroków; `SEM` = semantyczny odcisk katalogu
wrócił do baseline; `POS` = osobno: kolejność kolumn wróciła; `DUMP` = znormalizowany
`pg_dump -s` bajt w bajt; `dD/dS/dP` = liczba różniących się linii (dump/SEM/POS);
`dDelta` = ile nowych linii SEM rozjechało się **w tym** cyklu (atrybucja);
`DOWNeff` = czy DOWN w ogóle zmienił schemat.

| migracja | down | up1 | down RC | up2 | SEM | POS | DUMP | dD | dS | dDelta | dP | DOWNeff | ledger |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20262303_meeting_protocols | JEST | 0 | 0 | 0 | **TAK** | **TAK** | **TAK** | 0 | 0 | 0 | 0 | TAK | success |
| 20262302_meetings_protocol_columns | JEST | 0 | 0 | 0 | **TAK** | NIE | **TAK** | 0 | 0 | 0 | 12 | TAK | success |
| 20262301_meetings_agenda_lifecycle | JEST | 0 | 0 | 0 | **TAK** | NIE | NIE | 6 | 0 | 0 | 20 | TAK | success |
| 20262300_showcase_date_roll | JEST | 0 | 0 | 0 | **TAK** | NIE | NIE | 6 | 0 | 0 | 20 | TAK | success |
| 20262286_m1_plan_task_role_demand | **BRAK** | – | – | – | – | – | – | – | – | – | – | – | – |
| 20262285_initiatives_priority_score | JEST | 0 | 0 | 0 | **TAK** | NIE | NIE | 6 | 0 | 0 | 26 | TAK | success |
| 20262284_initiative_lifecycle_projection_backfill | JEST | 0 | 0 | 0 | **TAK** | NIE | NIE | 6 | 0 | 0 | 26 | **NIE** | success |
| 20262283_meeting_approved_minutes_pointer | JEST | 0 | 0 | 0 | **TAK** | NIE | **TAK** | 0 | 0 | 0 | 32 | TAK | success |
| 20262282_meeting_note_materializations | JEST | 0 | 0 | 0 | **NIE** | NIE | NIE | 25 | **13** | **13** | 32 | TAK | success |
| 20262281_pmo1b_roles_sla_escalations | JEST | 0 | 0 | 0 | NIE | NIE | NIE | 25 | 13 | 0 | 36 | TAK | success |
| 20262280_feedback1_unescape_entities | JEST | 0 | **3** | 0 | NIE | NIE | NIE | 25 | 13 | 0 | 36 | **NIE** | success |
| 20262273_deliverable_template_workflow | JEST | 0 | 0 | 0 | NIE | NIE | NIE | 25 | 13 | 0 | 36 | TAK | success |
| 20262272_template_library_cleanup_96 | JEST | 0 | 0 | 0 | NIE | NIE | NIE | 25 | 13 | 0 | 36 | TAK | success |
| 20262271_template_base_family | JEST | **1** | 0 | **1** | NIE | NIE | NIE | 45 | **20** | **7** | 40 | TAK | **failed** |
| 20262260_initiatives_lifecycle_stage | **BRAK** | – | – | – | – | – | – | – | – | – | – | – | – |

Baseline i stan końcowy (odtwarzalne co do bajtu w trzech przebiegach):

```
baseline_sem=eda03e29eabc3bc234b9546ffe25f087
baseline_pos=806db0f2c4a988345c80580d255e4666
baseline_dump_sha256=9d7837393fa4a70967f015eb332f61d15cf16ba8436dc43cb3a934eef1b1e2dd
koniec_sem=ca4a24135293e287e310fd89c2001652
koniec_dump_sha256=817b37afd66363ae9864e5ff1302c9c83e4b0b09c1d9b62d1dc422c997ef2171
koniec_diff_vs_baseline_linie=45
```

## Jak czytać trzy miary (dlaczego nie wystarczy `pg_dump -s`)

Zlecenie pyta: „`pg_dump -s` diff przed/po = 0?". Odpowiedź brzmi **5 z 13**, ale ta
liczba sama w sobie myli: `pg_dump -s` wypisuje kolumny w kolejności `attnum`, więc
`DROP COLUMN` + ponowny `ADD COLUMN` zmienia tekst dumpu, chociaż schemat jest
semantycznie ten sam. Dlatego każdy cykl mierzony jest trzema miarami:

1. **SEM** — odcisk katalogu: kolumny z typem/nullability/defaultem, indeksy
   (`indexdef`), constrainty (`pg_get_constraintdef`), relacje, funkcje, triggery.
   Odporny na przestawienie `attnum`. **To jest miara merytoryczna.**
2. **POS** — osobny odcisk `table.column.ordinal_position`. `SEM=TAK / POS=NIE`
   oznacza: struktura ta sama, kolumna stoi w innym miejscu tabeli.
3. **DUMP** — znormalizowany `pg_dump -s` (bez losowego tokena sesji `\restrict`/
   `\unrestrict`, który pg_dump 18 dokleja w każdym przebiegu) — hash + liczba linii
   diff. Miara najsurowsza, dokładnie ta, o którą pyta zlecenie.

Rozróżnienie działa w praktyce: `20262301/20262300/20262285/20262284` mają
`SEM=TAK` i `DUMP diff=6` — te 6 linii to wyłącznie przestawione kolumny
(`dP` rośnie, `dS`=0). `20262282` ma `SEM=NIE` i `dS=13` — to już nie kosmetyka.

## Trzy defekty (atrybucja co do linii katalogu)

### 1. `20262282` — down kasuje obiekt cudzej migracji i nie odtwarza go (D-129)

`dDelta=13`: to **ten** cykl wprowadził cały rozjazd SEM, który potem widnieje przy
20262281/20262280/20262273/20262272 (`dDelta=0`, czyli nie dokładały nic nowego).

Przyczyna, plik:linia:
- `server/migrations/20261090_meetings_day19_note_materialization.sql:4` tworzy
  `meeting_note_materializations` (kolumny `TEXT`, tabelowy
  `UNIQUE (organization_id, meeting_id, note_id)`, `idx_meeting_note_materializations_lookup` :22).
- `server/migrations/20262282_meeting_note_materializations.sql:13` to
  `CREATE TABLE IF NOT EXISTS` z **innym** kształtem (`TIMESTAMPTZ`, `DEFAULT NOW()`,
  `status DEFAULT 'pending'`, `stage NOT NULL DEFAULT 'content'`) → na bazie, gdzie
  20261090 już przeszło (staging, ta kopia), linie 13–28 są **no-opem**.
- `server/migrations/rollback/20262282_meeting_note_materializations.down.sql:9`
  `DROP TABLE IF EXISTS meeting_note_materializations;` → kasuje tabelę **należącą do
  20261090**, a ponowny UP 20262282 odtwarza ją już we własnym kształcie.

Zmierzone 13 różniących się linii katalogu (`fp/consultify_qd15/delta-20262282_meeting_note_materializations-sem.diff`):
5 zmian typu/defaultu kolumn (`created_at` `text`→`timestamptz`+`now()`,
`updated_at` j.w., `last_attempt_at` `text`→`timestamptz`, `stage` →`NOT NULL DEFAULT
'content'`, `status` →`DEFAULT 'pending'`) + **utracony constraint UNIQUE**
`meeting_note_materializations_organization_id_meeting_id_no_key` + **utracone 2
indeksy** (`idx_meeting_note_materializations_lookup`, indeks unikalny 20261090).

Utrata danych: dziś `SELECT count(*) FROM meeting_note_materializations` = **0**
(`pomiar-przyczyn.txt`), więc `DROP TABLE` nie niszczy obecnie żadnego wiersza —
ale jest bezwarunkowy i tabela jest żywym ledgerem materializacji notatek.

**Izolacja: defekt WŁASNY, nie efekt kolejności.** Na osobnym świeżym reście
(`izolacja-20262282_meeting_note_materializations.sql.txt`) ten sam cykl daje
`dS=13`, `dD=25`, `SEM=NIE` — identycznie jak w pełnym audycie.

### 2. `20262271` — UP nie da się ponownie zastosować na dzisiejszym stagingu (D-130)

`up1=1`, `up2=1`, ledger `status=failed`; `dDelta=7` (utracona tabela
`template_1_20262271_backup` z 4 kolumnami, PK i indeksem — bo UP się wycofał).

Komunikat: `✗ 20262271_template_base_family.sql: TEMPLATE-1 readback: duplicate
active base card` (`cykle-izolacja/20262271_template_base_family.log`).
Asercja: `server/migrations/20262271_template_base_family.sql:502-511`.

**Izolacja: defekt WŁASNY (stan danych), nie efekt kolejności.** W pełnym audycie
komunikat brzmiał inaczej (`expected 39 active base snapshots, found 293`) — bo tam
wcześniejszy cykl 20262272 przywrócił wyczyszczone template'y. Na **świeżym,
niezależnym** reście UP pada na innej asercji tego samego pliku, czyli migracja jest
niepowtarzalna także bez żadnego sąsiada.

Pomiar stanu danych (`pomiar-przyczyn.txt`):
- `org_count = 13`, więc asercja `:487` oczekuje `13*3 = 39` aktywnych snapshotów,
  a jest **36**;
- **4 pary** `(organization_id, template_family_ref)` mają więcej niż jedną aktywną
  kartę bazową, każda po **21** kart `DOC-BASE` (`is_draft=0`) — to one odpalają
  `HAVING count(*) > 1` z `:509`.

Skutek operacyjny: rollback `20262271` → ponowny UP **nie przechodzi**; w ledgerze
zostaje `failed`, a bramka `release-migration-gate.ts` liczy `sql_ledger_no_failed`
tylko dla plików z `requiredSet`, więc `failed` na 20262271 **zatrzymałby bramkę**
(plik jest w drzewie i jest wykonywalny).

### 3. `20262280` — down jest fail-closed i na dzisiejszym stagingu przerywa się (D-131)

`down RC=3`, komunikat: `ERROR: 20262280 rollback conflict in
public.organization_context_snapshots.snapshot_json: 1 rows changed or missing after
apply` (podniesiony w `rollback/20262280_feedback1_unescape_entities.down.sql:62`,
plik:129 = koniec bloku `DO`).

To **nie jest** błąd skryptu — to jego projekt (`down.sql:2-3`: „Any later user edit
is a conflict and aborts the entire rollback"). Pomiar konfliktu
(`pomiar-przyczyn.txt`): manifest `state=APPLIED`, `applied_at=2026-09-16
22:40:09 UTC`, `backup_count=4701`; z tego **1** para wiersz-kolumna jest
konfliktowa: org `a3e05d4a-5397-419d-b486-8e44366c0063`, `rebuilt_at=2026-09-19
01:43:03` (snapshot przebudowany ~2 dni po zastosowaniu migracji), obecna wartość
1 619 181 znaków vs `new_value` 1 667 697 znaków.

**Izolacja: RC=3 także na świeżym, niezależnym reście**
(`izolacja-20262280_feedback1_unescape_entities.sql.txt`) — czyli to trwały stan
danych stagingu, nie efekt łańcucha. Jednocześnie w izolacji `SEM=TAK POS=TAK
DUMP=TAK dD=0`: down jest transakcyjny (`BEGIN;`), więc przerwanie zostawia bazę
**nietkniętą** — `DOWNeff=NIE` dokładnie to pokazuje.

Skutek operacyjny: rollback 20262280 na dzisiejszym stagingu jest **niewykonalny**
bez ręcznej decyzji (albo przywrócenie snapshotu z kopii, albo jawne zaakceptowanie
utraconej przebudowy dla 1 organizacji).

## Braki `.down.sql` → wiersze do DLUG

| migracja | stan | DLUG |
|---|---|---|
| `20262260_initiatives_lifecycle_stage.sql` | pliku nie ma | **D-128** (nowy wiersz, dopisany) |
| `20262286_m1_plan_task_role_demand.sql` | pliku nie ma | **D-114 — znany, NIE duplikowany** |

## Mutacje przyrządu (dowód, że miary potrafią być czerwone)

Cel: `20262303_meeting_protocols` — jedyna migracja w pełni zielona
(`SEM=TAK POS=TAK DUMP=TAK DOWNeff=TAK`), więc każde zepsucie jej downa musi
zmienić co najmniej jedną kolumnę. Oryginał `sha256=029d09974e4720cfcd2a19d8e5c907036fde14e88caba688eed25411990a488c`.

| mutacja | co popsute | oczekiwane | zmierzone | werdykt |
|---|---|---|---|---|
| **M1** | doklejony `SELECT * FROM qd15_tabela_ktorej_nie_ma;` | `rc_down ≠ 0` | `down RC=3`, `DOWNeff=NIE` | **RED** ✓ |
| **M2** | down dokleja `CREATE TABLE qd15_mutation_probe` | `SEM=NIE`, `DUMP=NIE` | `SEM=NIE POS=NIE DUMP=NIE dS=2 dD=9` | **RED** ✓ |
| **M3** | zakomentowany tylko `DROP TABLE` | `DOWNeff=NIE` | `DOWNeff=TAK` | **GREEN — mutacja źle zaprojektowana** |
| **M3b** | cała treść downa = no-op (`BEGIN; COMMIT;`) | `DOWNeff=NIE` przy `SEM=TAK DUMP=TAK` | dokładnie to: `SEM=TAK POS=TAK DUMP=TAK dD=0`, `DOWNeff=NIE` | **RED** ✓ |

M3 była błędna i została powtórzona jako M3b: down 20262303 ma jeszcze trzy
`DROP INDEX`, więc po zakomentowaniu samego `DROP TABLE` DOWN nadal realnie zmieniał
schemat. M3b jest wersją, która testuje zamierzoną rzecz.

Po każdej mutacji plik przywrócony i sprawdzony co do bajtu
(`po_revert_sha=029d0997…` × 4, `git status --porcelain` pusty).

**M3b zamyka realną ślepą plamkę.** Sama równość stanu końcowego UP→DOWN→UP nie
dowodzi, że DOWN cokolwiek cofnął: jeśli down pominie `DROP TABLE`, a UP ma
`CREATE TABLE IF NOT EXISTS`, cykl kończy się stanem identycznym z baseline i miara
mówi PASS o rollbacku, który nie zrobił nic. Kolumna `DOWN_zmienil_schemat` to
wykrywa — i od razu wyjaśnia dwie linie tabeli: `20262284` (`DOWNeff=NIE`,
bo to świadomy rollback data-only, patrz niżej) i `20262280` (`DOWNeff=NIE`,
bo transakcja się przerwała).

## Defekt przyrządu znaleziony i naprawiony w trakcie pomiaru (M4)

Pierwsza wersja `pos_hash` używała `string_agg(... ORDER BY 1)`. **Wewnątrz agregatu
goła liczba nie jest pozycją kolumny wyjściowej, tylko stałą sortującą**, więc
kolejność agregacji była niezdefiniowana. Efekt: trzy identyczne świeże przywrócenia
z tego samego dumpu dały trzy różne hashe POS — `b7af57c3d1e4aa496e2baad728c0838f`,
`e1e8818871f54c011c099a81860c96c0`, `0db535da1bc7cf2a9069b4f483fd07d6` — przy
**identycznych 24 779-liniowych zbiorach** (`diff` = 0 linii). SEM używał nazwanej
kolumny (`ORDER BY line`) i odtwarzał się co do bajtu, DUMP też.

Wykrycie: wiersz `20262303` miał `POS=NIE` przy `pos_diff_vs_baseline=0` —
sprzeczność wewnętrzna, która nie mogła być prawdą.

Poprawka (`audyt-up-down-up.sh`, komentarz przy `pos_hash`): sortowanie po nazwanej
kolumnie podzapytania + **werdykty TAK/NIE liczone z diffów zbiorów linii, nie z
hasha**. Po poprawce hash POS odtwarza się na dwóch niezależnych świeżych
restore'ach: `806db0f2c4a988345c80580d255e4666` (× 4 pomiary).

Wcześniejszy przebieg z uszkodzoną miarą zachowany jako
`wyniki-v1-metryka-bajtowa-ODRZUCONA.txt` (metryka wyłącznie bajtowa) — jego
wnioski o „powrocie do baseline" były niemożliwe fizycznie i zostały odrzucone,
nie nadpisane.

## Odtwarzalność

Trzy przebiegi pełnego audytu, każdy na **osobnym świeżym reście** tego samego
dumpu. `baseline_dump_sha256=9d7837393fa4a70967f015eb332f61d15cf16ba8436dc43cb3a934eef1b1e2dd`
i `koniec_dump_sha256=817b37afd66363ae9864e5ff1302c9c83e4b0b09c1d9b62d1dc422c997ef2171`
we wszystkich; `diff` runA vs runB po odrzuceniu linii z czasem = **0 różnic**;
runC (= FINAL) dodaje kolumnę `DOWN_zmienil_schemat`, wszystkie pozostałe wartości
identyczne.

## `20262284` — DOWNeff=NIE jest zgodne z projektem, nie defektem

`rollback/20262284_initiative_lifecycle_projection_backfill.down.sql` ma 7 linii i
wprost deklaruje: „It intentionally has no destructive automatic rollback; restore a
pre-deploy database backup…", kończąc się
`SELECT '…is data-only and has no automatic rollback' AS notice;`. Pomiar to
potwierdza (`DOWNeff=NIE`, `SEM=TAK`) — migracja jest backfillem danych, więc
brak odwracalności DDL jest tu świadomy. Wpisany do tabeli jako wyjaśniony, nie jako
defekt.

## Ograniczenia pomiaru (uczciwie)

1. **pg17 vs pg18** — kopia chodzi na `pgvector/pgvector:pg17` (17.11), staging to
   PostgreSQL 18.4. `pg_dump`/`psql` klienta są z 18.4. Różnice wersji mogą wpływać
   na tekst dumpu; nie wpływają na SEM (odczyt z katalogu tej samej bazy).
2. **Metryka mierzy SCHEMAT, nie dane.** Downy z `DELETE FROM`/`UPDATE` (20262271,
   20262272, 20262280, 20262283, 20262285, 20262301) trwale zmieniają wiersze i
   audyt tego **nie** wyłapuje — `SEM`/`POS`/`DUMP` czytają wyłącznie katalog.
   Przykład: `20262282` kasuje tabelę razem z wierszami (dziś 0), a wszystkie trzy
   miary mówią tylko o strukturze.
3. **`--only` zamiast pełnego łańcucha.** Cykle używają
   `migrate.postgres.ts --only <plik>`, co pomija walidację spójności łańcucha
   (bramka release'owa robi to osobno — patrz QD14 `PREFLIGHT.md`, 12/12 PASS).
4. **Kolejność.** Audyt idzie odwrotnie chronologicznie na jednej bazie, więc cykl
   N startuje ze stanu po cyklach N+1…N+k. Dlatego trzy wyniki
   (20262271, 20262280, 20262282) zostały **osobno zizolowane** na niezależnych
   świeżych restore'ach — wszystkie trzy okazały się defektami własnymi, żaden nie
   był artefaktem kolejności (choć komunikat 20262271 w łańcuchu był inny).
5. **`NODE_ENV=test`** — migrator chodzi w profilu testowym (loopback dozwolony tylko
   w teście); dla logiki SQL bez znaczenia.
6. **Brak migracji w puli ≥ 20262304.** Zakres zlecenia to ≥ 20262260; w drzewie są
   też 20262300–20262303 (ujęte) i nic nowszego.

## Pliki dowodowe

| plik | co zawiera |
|---|---|
| `audyt-up-down-up.sh` | przyrząd: cykl UP→DOWN→UP + 3 miary + atrybucja + DOWNeff |
| `statyka.sh` / `statyczna-klasyfikacja.txt` | inwentarz statyczny 15 migracji |
| `izolacja.sh` | świeży restore per migracja (test własny vs łańcuch) |
| `izolacja-2026227*.sql.txt`, `izolacja-2026228*.sql.txt` | wyniki 3 izolacji |
| `mutacje.sh`, `mutacja-M3b.sh` | mutacje M1/M2/M3/M3b |
| `mutacje/M1-*`, `M2-*`, `M3-*`, `M3b-*` | przebiegi, wyniki i logi cykli mutacji |
| `wyniki-runA.txt`, `wyniki-runB.txt`, `wyniki-runC-FINAL.txt` | 3 przebiegi pełnego audytu |
| `wyniki-v1-metryka-bajtowa-ODRZUCONA.txt` | przebieg z uszkodzoną miarą (odrzucony) |
| `fp/consultify_qd15/baseline-{sem,pos}.txt` | zbiory linii baseline (24 779 POS) |
| `fp/consultify_qd15/rozjazd-*-sem.diff` | pełny rozjazd SEM vs baseline per cykl |
| `fp/consultify_qd15/delta-*-sem.diff` | **atrybucja**: co dany cykl rozjechał |
| `fp/consultify_qd15/rozjazd-*-pos.diff` | rozjazd kolejności kolumn per cykl |
| `pomiar-przyczyn.txt` | liczby dla trzech defektów (duplikaty, wiersze, konflikt) |
| `cykle/*.log` | logi cykli pełnego audytu |
| `cykle-izolacja/*.log` | logi cykli izolowanych |

**Nie commitowane (za ciężkie, w commicie są ich odciski liczbowe):**
- `dumpy/*.sql` — 15 zrzutów `pg_dump -s` × ~3,8 MB = **68 MB**; w commicie są ich
  `sha256` i liczby linii diff (`wyniki-runC-FINAL.txt`).
- `fp/consultify_qd15/*-sem.txt` i `*-pos.txt` — pełne listingi odcisków
  (24 779 linii POS, ~3,1 MB SEM każdy) × 16 stanów = **55 MB**; w commicie są za to
  **diffy** (`rozjazd-*-sem.diff`, `delta-*-sem.diff`, `rozjazd-*-pos.diff`, razem
  **80 KB**), a diff jest samowystarczalny — zawiera literalne zmienione linie
  (`<`/`>`), nie tylko numery linii.

W katalogu roboczym zostaje więc 143 MB, w commicie ~350 KB.
