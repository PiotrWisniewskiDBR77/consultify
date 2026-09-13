# E1b evidence feed — niezależny Sol review

Data: 2026-09-13

## Werdykt

**SCOPED ACCEPT** do normalnego commita i integracji 14 zamrożonych plików z `E1B_EVIDENCE_FINAL_FREEZE_20260913T090000Z.md`.

Akceptacja obejmuje produkcyjny feed `progressEvidence`, `forecastStartEvidence` i `forecastEndEvidence`, jego opt-in HTTP projection, podłączenie do Execution Bank, receipt dla `manager_scope_reduction`, controlled `asOf` oraz synchronizację historycznego/bieżącego `asOf` przez Back/Forward. Nie jest to akceptacja całego MVP ani signed-JWT/pełnego ApiGateway.

## Tożsamość freeze

- Worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex-execution-bank-evidence-20260913`
- Base/HEAD: `a743a96c6302b6e81d030168e0c3cc687eaa1fee`
- Author checkpoint SHA256: `32af235c6028f1d20dcd8c980d74236dc8b06b2b172429c2437a1c3dcb2ec500`
- Wszystkie 14 blobów odczytanych niezależnie zgadza się z checkpointem.
- `git diff --check`: PASS.

## Niezależny wynik

Polecenie:

```text
npx vitest run src/services/__tests__/api.getInitiatives.e1bEvidence.test.ts tests/components/Execution/ExecutionHub.e1bBankViews.behavior.test.tsx server/src/controllers/__tests__/InitiativeController.e1bEvidence.test.ts src/components/Execution/__tests__/executionBankModel.test.ts server/src/services/initiative/__tests__/executionBankEvidenceReadService.adversarial.test.ts server/src/services/initiative/__tests__/executionBankEvidenceReadService.test.ts server/src/services/v8/__tests__/managerActionExecutionService.test.ts --reporter=json --outputFile=/Users/piotrwisniewski/Developer/consultify-handoff-docs/integrator-20260912/E1B_EVIDENCE_SOL_COMBINED_GREEN_20260913T0830Z.json
```

Wynik: 7 plików, 14 raportowanych suites, **52/52 testy PASS**, exit 0.

- Raw SHA256: `c1470e9cd11c292b75537b01beffec016fafeef431e0e1ac91f65de0e064885c`
- Własny test adwersarialny: 13/13 PASS.
- Własny finalny test blob: `3bad1d9abab8b237b0c39e62837e7581305acd27`.
- Service blob: `67518aee417978c44ccc33f1fa3c4d43c9dfcdcf`.

## Sprawdzone zachowania

- Najnowszy receipt pola jest rozstrzygający. Nowszy konflikt nie pozwala wybrać starszej zgodnej wartości.
- Najnowszy `task_history.field='progress'` jest pobierany bez filtra wartości; brak receipt albo mismatch daje `UNKNOWN`, bez fallbacku do `tasks.updated_at`.
- Brakujące lub niepoprawne wartości pozostają `UNKNOWN`; `false`, tablica i obiekt nie są zamieniane na zmierzone `0`, a malformed forecast payload nie rzuca wyjątku.
- Start-only i end-only receipts zachowują osobne `recordId`, `observedAt` i wynik.
- Wszystkie history joins są tenant-scoped przez organizację i Initiative.
- Cztery źródła czasu są projektowane jako epoch seconds przed parserem node-pg. Chroni to `execution_audit_log.changed_at TIMESTAMP WITHOUT TIME ZONE` przed przesunięciem procesu America/Chicago i zachowuje milisekundy.
- `manager_scope_reduction` zapisuje oraz odczytuje dokładne old/new forecast end evidence pod rzeczywistą nazwą akcji `manager_scope_reduction`.
- Zwykły `GET /initiatives` nie uruchamia dodatkowego readera. Evidence jest opt-in przez `includeExecutionEvidence=1` lub `asOf`.
- Back/Forward między historycznymi `asOf` oraz czystym `/execution` powoduje refetch odpowiedniego snapshotu i ponowne wyrenderowanie wariancji.
- Model używa per-field Initiative evidence z zachowaniem provenance; nie tworzy Case identity dla Initiative bez Case.

## RealPG V2

`E1B_EVIDENCE_CX8_REALPG_CANDIDATE_V2_20260913T083500Z.json` ma SHA256 `23230c220e792891a7580a143b926634ae09180340ca6320654f087090e4246e` i **12/12 PASS** na cx8.

Harness nie tworzy ani nie migruje schema. Używa świeżych losowych identyfikatorów, istniejących tabel, realnych routerów/kontrolerów/middleware oraz jawnego `E2E_MODE` unsigned-JWT bypass. Czasy testów 5–204 ms i HTTP/SQL assertions potwierdzają, że suite nie przeszła przez vacuous skip. Cleanup/readback po V2 i pozostałości V1 wyniósł zero dla prefiksów fixture i powiązanych rekordów.

Golden flow potwierdza po HTTP dokładne receipt IDs i timestampy względem bezpośredniego PG readback, następnie prowadzi ten sam Initiative ID/evidence/asOf przez realny model i mounted table. Nie dowodzi produkcyjnej walidacji podpisu JWT. Nie wymusza też wyboru `execution_audit_log` jako zwycięskiego receipt; ten problem czasu jest pokryty actual catalog readback, epoch SQL oraz testem UTC/Chicago/ms.

## Zachowana linia RED

- `E1B_EVIDENCE_ADVERSARIAL_MANAGER_RED_20260913T0745Z.json`: 5 PASS / 2 FAIL — niezgodna nazwa realnego manager receipt.
- `E1B_EVIDENCE_ADVERSARIAL_MALFORMED_RED_20260913T0805Z.json`: 9 PASS / 3 FAIL — wyjątek malformed date oraz fałszywe zero progress.
- `E1B_EVIDENCE_ADVERSARIAL_TIMEZONE_MALFORMED_RED_20260913T0810Z.json`: 12 PASS / 1 FAIL — brak epoch SQL projection.
- `E1B_EVIDENCE_ADVERSARIAL_GREEN_20260913T0820Z.json`: 13/13 PASS, SHA256 `8a9c30706b0ad324e0b459a390291d6c72d0d66db5f89fbc174e5230f09a3910`.

Artefakt `E1B_EVIDENCE_ADVERSARIAL_TASK_RECEIPT_RED_20260913T0755Z.json` jest błędnie nazwanym GREEN 8/8, ponieważ poprawka autora weszła równolegle przed wykonaniem testu. Nie stanowi task-receipt RED. Artefakt `E1B_EVIDENCE_ADVERSARIAL_GREEN_20260913T0818Z.json` ma 12/13 i jest błędem instrumentacji review: filtr liczył `AS observed_at`, ale pomijał prawidłowy alias `AS progress_observed_at`. Został zachowany, nie jest product failure ani GREEN evidence.

## Otwarte granice

- cx8 nie ma `task_history`; task-derived progress pozostaje `UNKNOWN`, chyba że istnieje dokładny canonical progress receipt w `initiative_history`. Nie wolno użyć `MAX(tasks.updated_at)` jako obserwacji postępu.
- Brak zatwierdzonej polityki freshness: znana wartość zachowuje `staleness: UNKNOWN` i `FRESHNESS_POLICY_MISSING`.
- Historyczny `asOf` bez kompletnego, zgodnego event history pozostaje `UNKNOWN`; reader nie rekonstruuje stanu z bieżącego wiersza ani ze starszego podobnego receipt.
- Full ApiGateway plus signed-JWT pozostaje osobnym root-owned gate.
