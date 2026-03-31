# P29-C — weryfikacja i rollout (verification) — 100%

**Data:** 2026-03-31  
**Zakres:** FINAL 29 §8.1 P29-C — regresje, degraded payout, dual-control, ledger unavailable, rollback.

## Co jest zamknięte

- **Brak kompletnych ustawień wypłat:** `POST /api/v8/partner/program/lifecycle/request-payout-phase` zwraca **409** z kodem `P29_PAYOUT_SETTINGS_INCOMPLETE` i `whatNext` (serwis: `partnerPayoutSettingsService.ts`, `isPartnerPayoutDestinationComplete`).
- **Dual-control payouts (§2.3.5):** `appendEntry` dla `payout.approved` / `payout.executed` wymaga `sourceRef.elevatedRiskConfirmed = true` gdy kwota >= 1000 EUR lub to pierwszy payout partnera. Brak flagi → **`P29_DUAL_CONTROL_REQUIRED`**. Helper: `requiresDualControl`. Testy: `p29-payout-readiness.contract.test.ts`.
- **Ledger unavailable (§2.3.6):** `getProgramStatusDetail` łapie błąd `getBalances` i zwraca zerowy snapshot z `degraded: { reason: 'ledger_unavailable', snapshotAt }`. Trasy partner i superadmin propagują `degraded` w odpowiedzi.
- Idempotencja zapisu ledger: unikalny `idempotency_key` (jak wcześniej).
- Testy kontraktu: `tests/integration/p29-payout-readiness.contract.test.ts` (payout readiness + dual-control).
- Smoke C: `npx tsx server/scripts/smoke-p29-partner-program-c.ts`
- Bazeline P29-B: status `whatNext`/`hold`, smoke B, kontrakt `p28-p29.program-assessment.contract.test.ts`.

## Staging (checklist operatorski)

1. Migracja ledger/runtime (wspólny plik z P28).
2. Partner bez uzupełnionego konta: request payout phase → **409** + komunikat.
3. Po uzupełnieniu profilu: request → **200** (gdy lifecycle pozwala).
4. Operator: `POST .../ledger-entry` z `payout.approved` kwota >= 1000 bez `elevatedRiskConfirmed` → **`P29_DUAL_CONTROL_REQUIRED`**; z flagą → OK.
5. Operator: `GET .../program/:id/status` — nadal zgodny z portalem; przy awarii ledgera `degraded` w odpowiedzi.

## Rollback (§8.3)

- Wyłączenie tras programu / zapisów accrual i payout; tabele runtime + ledger zostają (odczyt i audyt).
