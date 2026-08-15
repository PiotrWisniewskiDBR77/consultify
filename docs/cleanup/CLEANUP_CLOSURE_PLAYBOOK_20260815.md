# Cleanup Closure Playbook — 2026-08-15

## Stan wejścia (faktyczny)
- HEAD: `635fd2d48d`
- Branch: `codex/sync-demo-20260729`
- Zmiany tracked: `167`
- Untracked: `187`
- Full test-gate artifact: runner `f6a00552802d3a5d0f2bbd2c72316c05b55b8f82`
- Non-green test set: `283` (`38 798 PASS / 581 FAIL / 485 PENDING / 19 TODO`, `0 missing`, `0 unexpected`)
- performance test: separate gate `PENDING` (wyłączony)

## Priorytetowe decyzje modułowe (niezależne od dalszej pracy dev)

### STOP-KRYTYCZNE
1. **Cross-module Infra / Routing/Menu/FeatureFlags** — to jedyny punkt, który utrzymuje nieciągłość mapy funkcjonalnej.
   - Dowody: `routeConfig.ts`, `AppRoutes.tsx`, `menuConfig.ts`, `Gateway.ts`
   - Wymaganie: źródło prawdy musi odpowiadać tym 3 stronom.

2. **Results (KPI/ROI/OKR)** — defaultowo zamknięte przez flagi, brak spójności użytkownika na produkcji.
   - Wymaganie: canonical enablement + seeded data + smoke dowód.

3. **Finance** — mieszanka ścieżek danych (V2/V3/V8/V10) + konflikt ownera runtime.
   - Wymaganie: decyzja canonical owner + mapowanie bridge + proof.

### WYSOKI PRIORYTET (P1)
4. **Initiatives + Execution + My Work** — live routes + APIs istnieją, ale część integracji i flows jest w limicie non-green testów.
   - Wymaganie: domknięcie bloków non-green dla tych modułów.

5. **Assessment + Materials + Tools** — trzon działa, ale potrzeba finalnych checków runtime.
   - Wymaganie: krótkie acceptance smoke/route checks + fixture state checks.

## Twarda kolejność działań (dalsza) — bez zmian produktowych

### Etap A — Inwentaryzacja końcowa (15 min)
- Uruchomić raz jeszcze:
  - `rg`/status pod kątem status file list (tracked/untracked)
  - potwierdzić, że `docs/cleanup/*` to jedyna aktywna warstwa operacyjna cleanup
- Ustalić, które 187 untracked idą do:
  - `keep_docs_evidence`
  - `quarantine_local_runtime`
  - `archive_ops_recovery`
  - `review_decision`
- Dowód: `docs/cleanup/UNTRACKED_CLASSIFICATION_20260815.json`

### Etap B — Domykanie bloków modułowych (90 min)
- Zgodnie z `MODULE_CLOSURE_DECISIONS_20260815.md`:
  - oznaczyć każdego modułu jako `LIVE/PARTIAL/BLOCKED`
  - dopisać jednoznaczny status domykający
  - podpiąć konkretny link testowy (np. source-anchor/smoke)

### Etap C — Test gate triage (najkrótsza droga do czerwonego stopu)
- Priorytet: najpierw `tests/integration`, potem `tests/components`, potem `tests/unit`, potem backend.
- Dla każdego nie-zielonego:
  - określić typ bloku: `BLOCKED_ARCHITECTURE`, `BLOCKED_DATA`, `READY_FOR_RUNTIME_RECHECK`.
  - utworzyć commit-safe patchy wyłącznie tam, gdzie dotyczy.
- Dowód: `tests/integration` top 136 oraz `tests/components` 55 są obecnie największym blokiem.

### Etap D — Rebuild z zachowaniem jednego źródła prawdy (po etapie C)
- Dopuszczalne tylko:
  - przenoszenie zmian między modułami przez pojedyncze commit-y per obszar
  - brak merge whole-branch bez mapy (zabronione po strefie restartów)
- Zakaz: nowy feature code bez wcześniejszego update'u modułowego.

## Wymagane evidence per moduł przy domknięciu
Dla każdego modułu muszą być dowody: route + component + API/service + migration/fixture proof + demo smoke.

## Właściciel ryzyka i następny gate
- `Cross-module infra`: prowadzący cleanup
- `Finance`: prowadzący finansowy + principal właściciel runtime
- `Results`: właściciel product results
- `Initiatives/Execution/My Work`: właściciel produktu + backend owner

## Koniec etapu (brama)
Etap jest domknięty gdy:
1) liczba tracked/untracked jest świadomie sklasyfikowana,
2) module ledger ma status i decyzję domykającą,
3) brak nowych nieskategoryzowanych plików untracked > 0 w trybie freeze,
4) plan kolejnego etapu nie zależy od ukrytych branchów/worktree.
