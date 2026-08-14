# SIRI PM v2 — plan migracji/backfillu `calculation_version`

**Agent:** A11 (`codex/mac-a11-siri-pm-20260813`) · **Decyzja:** COORD-08 —
APPROVED WITH VERSIONING · **Data:** 2026-08-13

Ten dokument NIE jest wykonaniem migracji. Migracja jest przygotowana
addytywnie i **NIEURUCHOMIONA** — patrz „Co zostało zrobione" niżej.

---

## 1. Gdzie dziś persystowane są wyniki priorytetyzacji SIRI (ustalone grepem)

Zweryfikowano bezpośrednio w kodzie (nie z dokumentacji) na `src/`, `server/src/`,
`server/migrations/`:

### 1a. `siriAdapter.prioritise()` — ZERO callerów produkcyjnych

`grep -rn "\.prioritise(\|siriAdapter" src server/src`, z pominięciem testów,
trafia WYŁĄCZNIE na: definicję/eksport samego adaptera
(`src/method-core/methods/siri/siriAdapter.ts:456,475`) i komentarze
dokumentacyjne. Żaden route ani serwis go nie wywołuje. Realne wywołania
istnieją tylko w testach (`siriMethodPack.test.ts`, `zz-opus-probe.test.ts`,
`siriPrioritisation.v2.test.ts` — ten ostatni dodany w tym pakiecie).

**Wniosek:** dziś `calculationVersion` nie jest jeszcze na ścieżce zapisu do
żadnej bazy — silnik jest wywoływany, ale wynik nigdzie nie ląduje w
produkcyjnym flow. To ISTOTNIE zmniejsza ryzyko tego pakietu: nie ma
zaakceptowanych historycznych wierszy do ochrony, bo ich jeszcze nie ma.

### 1b. Ogólna tabela `multi_framework_assessments` — jedyna ŻYWA ścieżka zapisu danych SIRI

`src/store/useMultiFrameworkStore.ts:324-368` `saveAssessment()` →
`PUT /api/mf-assessments/:id` →
`server/src/routes/multi-framework-assessment.routes.ts:176-196`:

```sql
UPDATE multi_framework_assessments
SET data = COALESCE(?::jsonb, data), ...
```

Cały `SIRIAssessmentData` (w tym `prioritisationMatrix: Record<string, number>`
z `src/services/siriStructure.ts`) trafia jako JSON do kolumny `data JSONB`.
Kolumna zdefiniowana w `server/migrations/043_multi_framework_assessments_complete.sql:10-20`
(`framework VARCHAR CHECK IN ('SIRI', ...)`, `data JSONB NOT NULL DEFAULT '{}'`).
Brak dedykowanej kolumny `prioritisation_matrix` — to klucz WEWNĄTRZ blobu JSON,
nie kolumna SQL. Ten blob dziś nie zawiera `calculationVersion`, bo
`prioritisationMatrix` na tej ścieżce liczony jest poza `siriAdapter.prioritise()`
(brak dowodu, że po tej stronie w ogóle wywoływany jest kod
`siriPrioritisation.ts` — NOT VERIFIED, poza zakresem tego pakietu).

**Zastrzeżenie:** ten route jest montowany przez `mountStub()`
(`server/src/Gateway.ts:962-966`), a `multiFrameworkAssessmentRoutes` jest na
liście `STUB_NAMES_WITH_LIVE_UI_ON_DEMO` (`Gateway.ts:397`) — w produkcji to
501-stub, chyba że `ENABLE_STUB_ROUTES=true` (`Gateway.ts:371,404-419`).
Działa więc na dev/demo, niekoniecznie na prod.

### 1c. `siri_dimension_scores` / `siri_prioritisation_snapshots` — PRZYGOTOWANE, NIE ZASTOSOWANE

`server/migrations/946_siri_16d_source_of_truth.sql` definiuje docelowe
tabele dopasowane 1:1 do `PrioritisationResult`
(`ranked_unit_ids`, `rationale_by_unit_id`, `parameters_version`,
teraz też `calculation_version` — patrz §3). Nagłówek pliku wprost mówi:
„STATUS: PREPARED, NOT APPLIED [...] blocked on COORD-02". Żaden inny plik w
repo nie odwołuje się do tych nazw tabel poza samą migracją — to jeszcze nie
jest ścieżka zapisu, to jest docelowy kształt schematu, czekający na
rozstrzygnięcie COORD-02 (8D→16D dla SIRI).

### 1d. Martwy/błędny odczyt — NIE ścieżka zapisu, ale warto odnotować

`server/src/routes/assessment-reports.routes.ts:2699,2870` czyta
`formData.prioritisationMatrix` z `report.form_data` — ale `form_data` NIE
jest kolumną zdefiniowaną w żadnej migracji (jedyne wystąpienie w całym repo).
Realna kolumna na `assessments` to `answers_json`
(`server/migrations/20260719_baseline_gap.sql:2128`). Wygląda na martwy/zepsuty
odczyt — poza zakresem tego pakietu, zgłoszony tu tylko żeby nie mylić go z
działającą ścieżką.

---

## 2. Dlaczego zaakceptowanych historycznych Outputów NIE wolno przeliczać bez decyzji

1. **Zmiana liczbowa, nie kosmetyczna.** `siri_pm_v2` naprawia normalizację
   (Step 6) i obcinanie ujemnego proximity (Step 4) — to **zmienia
   Impact Value i może zmienić ranking** na tych samych danych wejściowych
   (dowód: `docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/SIRI_PM_V1_VS_V2.md`,
   §6 zadania A11). Ciche przeliczenie zaakceptowanego wyniku to podmiana
   rekomendacji, którą klient/konsultant już przyjął do wiadomości/działania.
2. **Frozen snapshot = decyzja biznesowa zamrożona w czasie.**
   `siriAdapter.prioritise()` wymaga jawnego `frozenSnapshotId` — model
   kernela (`ASSESSMENT_KB_SIRI.md`) traktuje priorytetyzację jako wynik
   przypięty do konkretnego zamrożonego stanu oceny. Przeliczenie z nową
   formułą bez nowego `frozenSnapshotId` łamie tę semantykę: ten sam
   identyfikator snapshotu zaczyna oznaczać dwa różne wyniki w zależności od
   tego, KIEDY ktoś go odczytał.
3. **Brak właściciela metody, który by to zaakceptował.** COORD-08 jest
   oznaczony jako P1 OTWARTY w momencie pisania tego dokumentu — status
   „APPROVED WITH VERSIONING" oznacza zgodę na TO, żeby `siri_pm_v2`
   ISTNIAŁO za flagą, nie zgodę na przepisanie już dostarczonych wyników.
4. **`legacy_v1` i tak zostaje ścieżką domyślną** (patrz
   `src/services/siriPrioritisation.ts` — `DEFAULT_SIRI_PM_WEIGHTS`,
   `SIRI_PM_V2` flag domyślnie OFF), więc dopóki ktoś świadomie nie przełączy
   flagi lub nie poda `calculationVersion: 'siri_pm_v2'`, nowe wiersze i tak
   będą oznaczone `legacy_v1` — spójnie z historycznymi.

**Zasada robocza:** `calculation_version` jest zapisywany RAZ, w momencie
utworzenia wiersza, i nigdy nie jest nadpisywany wstecznie przez migrację
danych. Jedyny sposób, żeby jakiś obszar dostał wynik `siri_pm_v2`, to nowe
wywołanie `prioritise()` z jawną wersją/flagą — nigdy `UPDATE ... SET
calculation_version = 'siri_pm_v2'` na istniejących wierszach.

---

## 3. Jak dodać kolumnę `calculation_version` addytywnie

**Co zostało zrobione w tym pakiecie:** ponieważ `siri_prioritisation_snapshots`
(migracja 946) nigdy nie została zastosowana do żadnej bazy (STATUS: PREPARED,
NOT APPLIED — zero wierszy do zabezpieczenia), kolumna
`calculation_version TEXT NOT NULL DEFAULT 'legacy_v1' CHECK (calculation_version
IN ('legacy_v1', 'siri_pm_v2'))` została dopisana WPROST do instrukcji
`CREATE TABLE siri_prioritisation_snapshots` w
`server/migrations/946_siri_16d_source_of_truth.sql`, z komentarzem
przypisującym zmianę do COORD-08/A11. To jest jedyna bezpieczna forma
„addytywności" dla tabeli, która jeszcze nie istnieje na żadnym środowisku —
nie ma czego backfillować, więc `ALTER TABLE ... ADD COLUMN` byłby
niepotrzebnym pośrednim krokiem (i ryzykowałby kolejność uruchomienia
względem 946, skoro oba pliki byłyby nieuruchomione).

**Migracja pozostaje NIEURUCHOMIONA** — nadal blokowana przez COORD-02, tak
jak reszta pliku 946. Ten pakiet (A11) NIE zmienia statusu blokady COORD-02
ani nie uruchamia żadnej migracji.

**Jeżeli w przyszłości `946` zostanie zastosowana ZANIM ta zmiana trafi do
bazy** (np. inny agent zastosuje starą wersję pliku z innej gałęzi), właściwa
addytywna korekta to:

```sql
ALTER TABLE IF EXISTS siri_prioritisation_snapshots
  ADD COLUMN IF NOT EXISTS calculation_version TEXT NOT NULL DEFAULT 'legacy_v1'
  CHECK (calculation_version IN ('legacy_v1', 'siri_pm_v2'));
```

jako osobny plik migracji z numerem WYŻSZYM niż faktycznie zastosowany `946`
— nigdy jako nadpisanie już zastosowanego pliku migracji.

**Ścieżka `multi_framework_assessments.data JSONB` (§1b) nie wymaga migracji
schematu** — to blob JSON, więc `calculationVersion` można w niego dopisać
jako zwykły klucz w momencie, gdy kod faktycznie zacznie zapisywać wynik
`prioritise()` na tej ścieżce (dziś nie zapisuje — §1a). To osobna decyzja
implementacyjna (podłączenie `prioritise()` do tego route'a), poza zakresem
tego pakietu.

---

## 4. Procedura porównania before/after

1. Zamroź reprezentatywny zestaw fixture'ów (te same 16 `unitLevels`,
   `planningHorizon`, `industryBenchmark`) — patrz
   `SIRI_PM_V1_VS_V2.md` dla gotowej tabeli.
2. Uruchom `rankByImpactValue()` (legacy_v1) i `rankByImpactValueV2()`
   (siri_pm_v2) na TYCH SAMYCH danych wejściowych — nigdy nie porównuj
   wyników policzonych na różnych `frozenSnapshotId`.
3. Dla każdego obszaru zapisz: `IV(v1)`, `rank(v1)`, `IV(v2)`, `rank(v2)`,
   `delta_rank = rank(v1) - rank(v2)`.
4. Policz metrykę zbiorczą: ile obszarów zmieniło rangę (`delta_rank != 0`)
   i ile zmieniło się w obrębie top-4 (Step 8 focus dimensions) — to jest
   liczba, która idzie do raportu końcowego przed jakąkolwiek decyzją o
   włączeniu `SIRI_PM_V2` domyślnie.
5. Przed włączeniem flagi domyślnie na środowisku z realnymi danymi klienta:
   uruchom ten sam raport na PRAWDZIWYCH zamrożonych sesjach (nie tylko
   fixture'ach), pokaż deltę właścicielowi metody / Piotrowi, i dopiero wtedy
   podejmij decyzję o zmianie domyślnej ścieżki — zgodnie z „ZAKAZ CICHEJ
   ZMIANY" w `siriPrioritisation.ts`.

---

## 5. NOT VERIFIED / poza zakresem tego pakietu

- Czy `multi_framework_assessments` w ogóle zapisuje `prioritisationMatrix`
  liczony przez `src/services/siriPrioritisation.ts`, czy przez jakąś inną,
  niepowiązaną ścieżkę liczenia po stronie store'a — NIE ZWERYFIKOWANE.
- Status `ENABLE_STUB_ROUTES` na demo/prod w chwili pisania tego dokumentu —
  NIE SPRAWDZONE (patrz zastrzeżenie w §1b).
- Czy `assessment-reports.routes.ts:2699,2870` (`form_data`) to faktycznie
  martwy kod, czy istnieje jakiś adapter/proxy tworzący tę kolumnę w locie —
  NIE ZWERYFIKOWANE, tylko odnotowane jako podejrzane.
- Rozstrzygnięcie COORD-02 (SIRI 8D vs 16D) — poza mandatem A11, warunkuje
  kiedy `946` (i teraz `calculation_version`) w ogóle może zostać zastosowana.
