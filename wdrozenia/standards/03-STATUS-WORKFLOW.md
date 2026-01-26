# 📊 Status Workflow Standard (kanoniczny)

## Cel
Jeden, spójny workflow statusów inicjatyw widoczny i walidowany w całym systemie (backend + frontend), z bramkami decyzyjnymi (gate decisions).

## Źródła
- (Legacy) `wdrozenia/standards/STATUS-WORKFLOW 2.md` – **nie jest kanoniczny**
- Audyt integracji E2E: `wdrozenia/AUDYT_SYSTEM_INTEGRATION.md`

## Kanoniczny enum statusów inicjatywy
Statusy muszą być spójne pomiędzy backend i frontend.

- **Backend**: `server/src/constants/initiativeStatuses.ts`
- **Frontend**: `src/types/initiative.ts` + helpery widoczności: `src/services/initiativeLifecycle.ts`

## Widoczność per moduł (kanon)
- Tools / Assessment: `DRAFT`
- Initiatives: `PLANNING`, `REVIEW`, `APPROVED`
- Execution: `EXECUTING`, `BLOCKED`, `DONE`, `CANCELLED`
- Benefits: `DONE`
- My Work: agregacja (widzi przekrój)

## Walidacja przejść
Zmiana statusu musi przejść przez:
1) walidację dozwolonego przejścia, 2) walidację wymaganych gate decisions, 3) audit log.

## Historia zmian
- 2026-01-26: utworzono kanoniczny standard statusów (odwołania do kodu i audytu)

