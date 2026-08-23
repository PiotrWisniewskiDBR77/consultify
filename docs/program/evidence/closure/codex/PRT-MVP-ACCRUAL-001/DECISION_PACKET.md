# PRT-MVP-ACCRUAL-001 — partner economics and payout decision packet

Date: 2026-08-23
Current status: `APPROVED_OUT / ECONOMICS_OFF`
Production or Railway mutation: `NOT_AUTHORIZED`

## Decision already in force

Owner amendment `INTERNAL-BETA-OWNER-DECISIONS-20260817-AMENDMENT-01`, decision
`AMD-PRT-ACCRUAL-APPROVED-OUT-001`, excludes commission accrual and payout from
the current MVP. No technical fixture, seed or environment variable can
replace a commercial policy.

The fail-closed runtime contract is:

- absent, draft or malformed policy blocks accrual;
- currency mismatch blocks accrual;
- missing, inactive or foreign-tenant attribution blocks accrual;
- automatic payout remains false;
- the requester cannot approve the same payout;
- ledger facts remain append-only;
- a synthetic `APPROVED` fixture is test evidence only.

## Evidence currently available

The evidence packet records `4/4` focused files and `22/22` tests, including
RealPG atomic rollback, concurrent same-key exactly-one effect, idempotent
retry, tenant separation and cold readback. The production policy is absent,
therefore the technically correct current result is zero enabled economics.

Several route/service paths have changed since the historical product SHA.
Their controls must be requalified on the frozen final candidate; this packet
does not manufacture a current-source PASS from the older run.

## Commercial policy required before reopening

Commercial, Finance and Legal must jointly approve one versioned policy with
all fields below. Any `UNKNOWN` keeps economics disabled.

| Decision field                                                  | Required value |
| --------------------------------------------------------------- | -------------- |
| Policy status, version and effective interval                   | `UNKNOWN`      |
| Eligible partner types and contract references                  | `UNKNOWN`      |
| Attribution source, window, precedence and expiry               | `UNKNOWN`      |
| Commission base and `commissionRateBps`                         | `UNKNOWN`      |
| `baseCurrency` and FX treatment                                 | `UNKNOWN`      |
| `payoutFeeBps` and `minimumPayoutMinor`                         | `UNKNOWN`      |
| Jurisdictions and prohibited territories                        | `UNKNOWN`      |
| Tax, invoice, KYC/AML and sanctions prerequisites               | `UNKNOWN`      |
| Reversal, refund, chargeback and clawback rules                 | `UNKNOWN`      |
| Dispute window, evidence, approver and escalation               | `UNKNOWN`      |
| Payout cadence, method, manual approval and maker-checker roles | `UNKNOWN`      |
| Rounding, residual cents and ledger reconciliation              | `UNKNOWN`      |
| Data retention, audit evidence and policy invalidation          | `UNKNOWN`      |

## Activation gates

All gates are mandatory:

1. Commercial + Finance + Legal approves the complete policy above.
2. The approved document is converted into one exact, versioned runtime policy;
   no defaults may invent missing economics.
3. Focused unit and RealPG tests pass on one frozen candidate, including
   reversal, dispute, concurrency, retry, tenant and maker-checker negatives.
4. Signed browser acceptance proves the partner-facing states without creating
   real accrual or payout outside named disposable fixtures.
5. Finance reconciles ledger, currency and payout totals and signs the result.
6. Production activation is separately and explicitly authorized.

Until all six gates close, preserve `PARTNER_ACCRUAL_POLICY_JSON` absent,
automatic payout false and `ECONOMICS_OFF`.
