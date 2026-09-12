# IE-00 — checkpoint Definition, 12.09.2026

**Stanowisko: pierwszy pion gotowy do niezależnego odbioru; cały IE-00 PARTIAL.**

Wydanie root DEC-2026091202, TWO_MODULES_CLOSURE_DISPATCH.md i IE00_PREFLIGHT_AND_ADAPTER.md zastępuje historyczny marker/branch i mechaniczne utożsamienie runtime Definition z legacy GO. WT codex7-zatwierdzanie, branch codex/ie00-governance-20260912, baza ee397109a072b41a39a938fdd48c267f0d58e9e2. Root jest jedynym integratorem. Nie wykonano push/deploy/live ani nowych migracji.

## KROK 0

1. Istniejące request/decide potwierdzone: `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2806` i `:2878` (aktualna ścieżka zawiera pmo). Zod zachowuje expectedVersion, decisionId, APPROVED/RETURNED i rationale.
2. initiative.review potwierdzone w tej trasie `:2898`. V2 dodaje403 dla widocznego rekordu i niepowołanego aktora, pozostawiając404 granicy tenant/missing oraz historyczne OFF.
3. Lejek etykiet istnieje: `src/components/Initiatives/lifecycle/initiativeLifecycleMessages.ts:348`, callery InitiativeDocumentView/InitiativesHub. Historyczna liczba40 kluczy nie jest w tym checkpointcie nowym niezależnym pomiarem kompletności.
4. D-1 częściowo naprawiony w V2 przez jawny403/named authority; pełne cztery odmowy z kluczami EN/PL pozostają NOT_PROVEN. Nie przedstawiamy tego jako zamknięcia D-1.

## Model decyzji i wersjonowanie

Nie ma drugiego magazynu. Istniejące ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json), ie_audit_events, command receipt/outbox. Domain definitionDecision.ts ponownie używa tej samej decyzji po RETURNED i weryfikuje requester/initiative/Decision ID. Version CAS inicjatywy i related aggregate pozostają w jednej istniejącej transakcji material command. Brak nowej migracji; minimalny lokalny runtime używa istniejących932–934.

Istotna zmiana dla Definition to zmiana wersji karty snapshotu: summary-scope, strategic-fit, success-criteria, outcomes-benefits, options, people-team, roles-raci, stakeholders; oraz zmiana efektywnej polityki względem snapshotu. Nie definiowano nowej listy globalnych pól legacy GO. Zmiana summary-scope po RETURN i nowy snapshot po niezależnym review są zmierzone. Cała macierz invalidation po APPROVE pozostaje do kolejnej paczki.

## Rozliczenie historycznego §3 w aktualnym pionie

| Punkt | Zakres i wynik |
|---|---|
|1 decyzja|Real Gateway/JWT/PG request→RETURN→resubmit→APPROVE tego samego Decision; nie jest to legacy GO. Pełna macierz identycznego-key retry nie została w tej paczce zmierzona.|
|2 zatwierdzenie|Definition zmienia runtime lifecycle na DEFINED, lista/karta/typedDecision po cold reload zgodne. Pozostałe gates/GO nadal w kolejce.|
|3 unieważnienie|Version snapshot zachowany, real edycja+review po RETURN oraz stale expectedVersion409. Osobny approved→edit→approval invalidation NOT_PROVEN.|
|4 odmowy|Foreign/missing identyczna404; niepowołany visible ADMIN403; authority selection403 bez zmiany agregatu. Kompletna lokalizacja D-1 NOT_PROVEN.|
|5 audit|SQL czyta jeden Decision, historię PENDING→RETURNED→PENDING→APPROVED i wersje; zapytania poniżej.|
|6 UI|Istniejąca karta Gates i aktywny DecisionsPanelContent; wspólna treść inline. Brak nowego panelu, fakeCase/A05 lub nowego magazynu. Typed routing, bulk i doubleclick chronione.|
|7 OFF|Real legal request+approve writer PASS; nowe read hidden. Legacy real browser text identyczny ON/OFF. Nie jest to pełny globalny bitmap regression.|
|8 testy|Final5, dwie mutacje identycznego mianownika, dwa real source-review findingi RED→GREEN; pełna macierz wszystkich istniejących guards pozostaje do kolejnych paczek.|

## Dowody

Trwałe raw artifacts: `/Users/piotrwisniewski/Developer/codex-wt/codex7-artefakty/ie00/`; szczegółowe komendy, ograniczenia i runtime: `IE00_DEFINITION_EVIDENCE.md` i aktualny `HANDOFF-ACTIVE.md` w tym katalogu.

- `final5-mutation-summary.json`: pięć identycznych fullName. Resubmit insert0 mutacja4PASS/1FAIL; pominięcie named authority4PASS/1FAIL; przywrócone źródło5PASS. Po poprawce membership `final5-after-review-green.json`5PASS.
- `review-fixes-mutation-summary.json`: delayed A→B dwa scenariusze0/2→2/2; active secondary-org membership real Gateway/JWT/PG0/1→1/1. Internal keyed boundary + wygaszanie async; reader oparty na requested org membership, nie primary users.org.
- `ui-create-receipt.json`: nowa inicjatywa201 przez rzeczywisty Hub form. **Osiem kart przygotowano przez API**, nie UI (`ui-card-api-preparation.json`). Potem `ui-vertical.json` sześć UI komend201: request/RETURN/edit/review/resubmit/APPROVE, initiative18→23, ten sam Decision.
- `ui-final-sql.jsonl`: Initiative23DEFINED, Decision4APPROVED; summary-scope wersje1/2/3/4, gate history18/19/22/23.
- `readback-ON.json`, `readback-OFF.json`, `legacy-off-parity-summary.json`: kanoniczna lista+karta oraz niezmieniona legalna legacy ścieżka. `typed-consumer.json`: checkbox nie wybiera generic bulk, doubleclick otwiera canonical preview, genericOpens=[], zero legacy decision write.
- `server-tsc-after-review.log` exit0. `esbuild-after-review.json`7 transformsPASS, nie pełny front build. Normalne git hooks, bez --no-verify.

Dwie historyczne próby UI selektora zatrzymały się po RETURN; wznowiono ten sam rekord bez powtarzania komend. Osobna pierwsza próba typed-consumer odczytała Loading zanim doszedł readback; błąd retained i oczekiwanie harness poprawione, finalPASS. Minimalny runtime pokazuje poboczne404/503 i klucze i18n; brak pełnej świeżej organizacji/login/shell acceptance.

```sql
SELECT aggregate_type,aggregate_id,version,payload_json FROM ie_aggregate_state
WHERE organization_id='org-definition' AND aggregate_id IN
('initiative-933be10e-03c6-403a-8c8d-a3042b6b59cb','5dbbbd2a-cba2-4b29-b918-797b31a5d259');
SELECT aggregate_version,command_type,payload_json FROM ie_audit_events
WHERE organization_id='org-definition'
AND aggregate_id='initiative-933be10e-03c6-403a-8c8d-a3042b6b59cb' ORDER BY aggregate_version;
```

## SHA, zakres dalszy i czego nie sprawdzono

Source checkpoint: e14526a711a12832a529e85d60b3b69858c432e9. Raport nie zastępuje niezależnego odbioru tego SHA.

ENABLE_INITIATIVE_APPROVAL_V2 nadal domyślnie OFF. Lokalny ON nie jest zgodą na produkcyjne włączenie. Scope reviewer dostaje nieruchome źródła i runtime6458/4217/5598. Pozostałe IE-00: wszystkie inne gates i12stanów, legacy Case/A05 adapter, rekomendowany wariant ceremonii+parametryzacja, delegacje/kworumUI, pełny D-1 EN/PL, policy/invalidation/idempotency/fullguard matrix, fresh-org real UI. Istniejący wymagany quorum receipt nie został wyłączony; jego ceremonia w UI nie jest jeszcze dostarczona. Nie zgłoszono całego modułu jako ukończonego.
