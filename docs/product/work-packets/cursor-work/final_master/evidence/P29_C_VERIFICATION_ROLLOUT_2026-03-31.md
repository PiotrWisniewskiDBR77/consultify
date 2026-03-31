# P29-C — weryfikacja i rollout (verification)

**Data:** 2026-03-31  
**Zakres:** FINAL 29 §8.1 P29-C — regresje, degraded payout, rollback, znane limity.

## Co jest zamknięte (technicznie)

- **Brak kompletnych ustawień wypłat:** `POST /api/v8/partner/program/lifecycle/request-payout-phase` zwraca **409** z kodem `P29_PAYOUT_SETTINGS_INCOMPLETE` i `whatNext`, jeśli `isPartnerPayoutDestinationComplete` jest fałszywe (serwis: `partnerPayoutSettingsService.ts`).
- Idempotencja zapisu ledger: unikalny `idempotency_key` w `partner_program_ledger` (jak wcześniej).
- Testy kontraktu: `tests/integration/p29-payout-readiness.contract.test.ts`.
- Smoke C (statyczny): `npx tsx server/scripts/smoke-p29-partner-program-c.ts`  
- Bazeline P29-B: status `whatNext`/`hold`, smoke B, kontrakt `p28-p29.program-assessment.contract.test.ts`.

## Staging (checklist operatorski)

1. Migracja ledger/runtime (wspólny plik z P28).
2. Partner bez uzupełnionego konta: request payout phase → **409** + komunikat o `PUT /api/v8/partner/payout-settings`.
3. Po uzupełnieniu profilu wypłaty i fazie `earn`: request → **200** (gdy lifecycle i dane na to pozwalają).
4. Operator: `GET .../program/:id/status` — nadal zgodny z portalem (B).

## Rollback (§8.3)

- Wyłączenie tras programu / zapisów accrual i payout po stronie produktu; tabele runtime + ledger zostają (odczyt i audyt).

## Znane limity

- **Dual-control payouts / pełny audit P33:** kanon §2.3.5 wymaga drugiej akceptacji dla wysokich kwot — **nie zaimplementowano** jako automatyczny gate w tym pakiecie (polega na procedurze operatorskiej + przyszłe P33).
- **Ledger unavailable snapshot (`degraded: true`):** nie zaimplementowano osobnej ścieżki odczytu snapshot; błędy DB propagują jak dotychczas.
- **Enablement / materiały / Help:** P1 poza tym pakietem.
