# Results Next — Consortium Critical Review Register

> Data: 2026-08-09  
> Zakres: Master + KPI + ROI + OKR implementation plans  
> Metoda: każdy plan domenowy został przygotowany przez właściciela domeny, a następnie sprawdzony przez specjalistę spoza tej domeny; Chief Product & System Architect rozstrzygnął findings przekrojowe.

## 1. Cel review

Review miał aktywnie szukać powodów, dla których dokumentacja nie powinna jeszcze wejść do implementacji. Sprawdzano:

- zgodność z decyzjami D01–D15;
- wykonalność kolejności etapów i bramek;
- granice domen i ryzyko split truth;
- clean-start i legacy archive;
- model indywidualny i organizacyjny;
- UI canon, Menu 2/3 i list-preview-tool;
- API, schema, events i idempotency;
- Teresa, MyWork i Decisions;
- visibility, maker-checker i non-leaking projections;
- realDB, cold reopen i acceptance evidence.

## 2. P0 wykryte w pierwszym cross-review

| ID | Finding | Rozstrzygnięcie |
|---|---|---|
| CR-P0-01 | Master wymagał read-model/auth, real Draft, Teresa command i cold reopen przed utworzeniem schematu/outbox | Osiem etapów przebudowano: contract -> platform/schema -> projections/shell -> Teresa integrations -> parallel gold flows -> depth -> integrations -> hardening |
| CR-P0-02 | Dokumenty wskazywały pozornie konkurencyjne standardy tabel | Zamrożono kompozycję: StandardModuleBar + StandardTable facade -> FilterableTable mechanics + StandardPreview + TableWithPreviewLayout orchestration + shared GridView |
| CR-P0-03 | KPI Menu 3 mieszało filtry z Portfolio/My KPIs/Deviation Queue/Archive | Menu 3 ograniczono do presetów/counts/bulk/AI/open tabs; odmienne schematy są osobnymi KPI workspace routes/views |
| CR-P0-04 | KPI MyWorkReference nie zapewniał idempotency i lineage | Dodano organization, assignee, aggregate version, policy/source event/cadence occurrence, dedupe key i invariant pojedynczego aktywnego obligation |
| CR-P0-05 | ROI nie implementowało zatwierdzonej D10 visibility | Dodano policy/ACL/sensitivity, restricted-by-default build, osobną minimalną Approved Summary Projection i pełne non-leak tests |
| CR-P0-06 | OKR ponownie otwierało decyzję o domyślnej widoczności | Zamrożono `OPEN_ORGANIZATION` z governed narrowing; EVIDENCE_NEEDED dotyczy już implementacji, nie ponownego wyboru defaultu |

## 3. P1/P2 zamknięte w korekcie

- Jeden lowercase API namespace: `/api/vnext/results/{kpi|roi|okr}`.
- Nowe tabele ROI używają prefiksu `rvn_`, aby nie udawać istniejącego V8.
- Wszystkie ROI events używają dotted names i wspólnej `ResultsEventEnvelope`.
- ROI legacy archive ma wyłącznie jawne GET endpoints; mutacje fail closed.
- ROI KPI evidence jest typed, version-pinned relation, a nie luźnym `kpi_id`.
- D06 zastąpiło niejednoznaczne odwołania do „6C”.
- Master otrzymał acceptance matrix D01–D15.
- KPI ma default `SCOPE_AND_MANAGEMENT_CHAIN` i jawny zakaz self-approval materialnej wersji.
- KPI escalation jest attention overlay, nie konkurencyjnym lifecycle state.
- KPI acceptance Teresy obejmuje authorization, provenance, accept/reject i no silent write.
- OKR Program/Cycle admin nie jest częścią narzędzia pojedynczego Set.
- OKR pierwszy zaakceptowany slice ma twardą zależność od Teresy.
- OKR runtime proof obejmuje individual/team/business-unit/company i identyczne aggregate IDs w projekcjach.
- Widoczna geometria TRIADA i semantyczny hit target 44×44 zostały rozdzielone.

## 4. Rozstrzygnięcie standardu tabel

Pozorna sprzeczność wynikała z opisania różnych warstw tego samego rozwiązania:

- `TRIADA_KANON.md` i `CANON.md` wskazują standardowe fasady i anatomię;
- `StandardTable` deleguje mechanikę do `FilterableTable`;
- `TableWithPreviewLayout` odpowiada za selekcję, preview, klawiaturę, historię i mobile;
- `StandardPreview` narzuca treść/anatomię preview;
- `GridView` jest alternatywną reprezentacją tych samych rekordów.

Nowy kod nie wybiera jednego z tych komponentów przeciw pozostałym. Używa ich zgodnie z rolą i nie tworzy kolejnej implementacji tabeli.

## 5. Pozostałe EVIDENCE_NEEDED przed Gate 0/1

Nie są to ponownie otwarte decyzje produktowe, lecz dowody implementacyjne:

- aktualny organization/team/manager hierarchy contract i kompletność realDB;
- dokładna macierz ról i materiality thresholds per domena;
- źródłowy kontrakt MyWork/Decisions/outbox, który można bezpiecznie rozszerzyć;
- stabilny route/history owner dla full tools;
- lista legacy write consumers z telemetry/logs;
- policy dla reflection waiver i minimalnej liczby KR;
- finance calculation artifacts/version identifiers potrzebne do D06 seam;
- znane zestawy obliczeniowe ROI i polityki currency/discount/rounding;
- pilot population i pierwsze okresy/cykle.

Brak dowodu zachowuje literalny status `EVIDENCE_NEEDED`; nie może zostać zastąpiony założeniem podczas kodowania.

## 6. Końcowy werdykt

`DOCUMENTATION_READY_FOR_GATE_0`

Finalny recheck został wykonany niezależnie przez trzech specjalistów. Wszystkie zgłoszone P0 i P1 mają status `CLOSED`; nie wykryto nowego P0. Pakiet może przejść do Gate 0 i rozpisania pierwszych pionowych pakietów.

Ten werdykt nie jest dowodem implementacji ani runtime GO. Każdy kolejny gate nadal wymaga własnych dowodów i niezależnego acceptance.

## 7. Cross-review suplementu acceptance i handoffu Claude

Po dodaniu dokumentów 06–08 przeprowadzono osobny review functional, visual/CX i execution-safety. W pierwszej rundzie wykryto i poprawiono:

- brak rozróżnienia candidate SHA od deployed terminal SHA;
- brak nazwanego terminalnego acceptance environment;
- niepełne cross-domain E2E dla Finance, OKR context, Notifications i Reporting;
- brak blokującego Open Decision & Evidence Register;
- zbyt słabe feature-level coverage rules;
- brakujące przypadki KPI dimension independence, ROI rebaseline/correction i OKR scheduler restart/dedupe;
- przedwczesną równoległość domen przed RN-G1;
- brak jawnych checkpointów RN-G4/RN-G5;
- brak nazwanego Integration Ownera;
- niejednoznaczny status sugerujący self-acceptance.

Rozdzielono:

- `IMPLEMENTED_EVIDENCED_CANDIDATE` — kompletny kandydat Claude’a na jednym integrated SHA, bez nieautoryzowanego deployu;
- `ACCEPTED_ACCEPTANCE_ENV` — niezależnie odtworzony exact-SHA runtime w nazwanym środowisku;
- `ACCEPTED_TERMINAL` — końcowy werdykt Codex/Foundera.

Finalny visual/CX review: `PASS`. Finalny execution-contract review: `PASS`. Functional/traceability review po korektach: `PASS`, bez nowego P0.
