## PACKS_02 — Bundle 30 (Platform P0) — Slices A (3 agentów)

Cel: dowieźć “platform pack” w małych krokach, z bramkami po każdej paczce.

### Agent A — T107 Stability / SLO / deploy gates
- **Wejście**: `bundle-30-2-stability-deploy-gates`
- **Zakres**:
  - Merge do integracji.
  - `npm run verify:quick`
  - (jeśli w scope) `npm run test:protect`

### Agent B — T108 SuperAdmin + test support hardening
- **Wejście**: `bundle-30b-superadmin-control-testing-cursor` (albo `bundle-30-3-superadmin-testing`)
- **Zakres**:
  - Merge do integracji.
  - `npm run verify:quick`
  - Walidacja, że endpointy SuperAdmin nie są stubami tam gdzie powinny być realne.

### Agent C — T109 Billing (Stripe/webhooks/dunning) + SSOT
- **Wejście**: `bundle-30c-stripe-payments-dunning`, `bundle-30-4-billing-ssot`
- **Zakres**:
  - Merge do integracji (najpierw SSOT jeśli conflict-heavy).
  - `npm run verify:quick` + `npm run test:protect`
  - Upewnić się, że webhooki mają raw body tam gdzie trzeba.

