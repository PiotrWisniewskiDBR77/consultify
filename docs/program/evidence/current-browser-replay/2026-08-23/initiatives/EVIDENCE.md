# Initiatives current-browser replay — 2026-08-23

Status: `TECHNICAL EVIDENCE / OWNER RETEST REQUIRED`

Runtime: local client `http://127.0.0.1:4390`; synthetic deterministic sample data only.
Implementation checkpoint: `5c6d72066f8fe72d50edc0948fac4fadd6b4e696`.

## Evidence

| File | Route/state | Verified outcome | SHA-256 |
|---|---|---|---|
| `01-initiative-register.png` | `/initiatives` | Only Initiatives, Plan and Capacity are visible; 11 rows have lifecycle/gate/readiness/owner/action/impact/window/health; lifecycle counters reconcile to 11. | `e25a73a31f7f5c56ae94b9f52691ef1b8a05da203eec7f6fe63f1a01242d8f52` |
| `02-initiative-showcase-card.png` | `/initiatives?mode=doc&open=init-showcase-post-merger-kpi-harmonization` | The existing rich showcase card opens instead of the unavailable backend workspace; visible sections include scope, 3 tasks, 2 decisions, RAID, RACI, outcomes, resources, attachments and history. The false status-drift warning is absent. | `3b1718a13e6b37a1626db5415fce5e78010fb57c80a647d8c8b77c78d8484961` |

## Verification limits

- Screenshots and browser replay are not owner acceptance.
- Plan and Capacity owner specifications remain implementation/retest work.
- Persistent database writes, role boundaries, responsive/theme/PL-EN matrices and Initiatives→Execution exact-ID cold readback were not re-proven in this bounded pass.
- Focused Initiatives run: `129 PASS / 7 FAIL`; the seven failures are in the legacy New-Initiative a11y test helper which requires two duplicate CTA triggers. The current owner-approved IA exposes one canonical toolbar trigger. This residual is recorded, not promoted to PASS.
