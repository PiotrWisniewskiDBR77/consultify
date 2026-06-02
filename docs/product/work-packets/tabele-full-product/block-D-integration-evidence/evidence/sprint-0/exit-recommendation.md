# D-S0 — Sprint Exit Recommendation

**Date:** 2026-05-08
**Verdict:** `GO` — D-S1 may proceed.

## Deliverables shipped

| Deliverable | Path |
|---|---|
| Block C gate verification | `evidence/sprint-0/block-c-gate-verification.md` |
| Intent routing audit | `audit-findings/INTENT_ROUTING_AUDIT_2026-05-08.md` |
| V8 contract audit | `audit-findings/V8_CONTRACT_AUDIT_2026-05-08.md` |
| Public form audit | `audit-findings/PUBLIC_FORM_AUDIT_2026-05-08.md` |
| CTO decisions Q15–Q17 | `00_CTO_DECISIONS.md` |

## Key findings

1. **Tabele MELS right rail is the canonical conversion entry point.** Reuse the `share` tool (Q15). No taxonomy bloat.
2. **No new V8 snapshot kind.** Adapter inside `TableArtifactConversionService` translates source-pack snapshot to explicit materialize params (Q16). `tp_table_conversions` is the audit row.
3. **Public form pipeline already exists** — `FormService.submitForm` + `publicFormRouter`. Block D adds a parallel JWT route, field allow-list, public rate limit (Q17). Slug route unchanged.
4. **`WordyArtifactService` / `PrezentacjeArtifactService` are conceptual labels.** Real entry point is `artifactRegistryService.materializeArtifactRun`. Sprint-1 plan corrected.

## Migration plan signed off

| Migration | Block | Status |
|---|---|---|
| `20260512_block_d_table_conversions.sql` | D-S1 | Drafted in V8 audit |
| `20260513_block_d_form_intake.sql` | D-S2 | Drafted in public-form audit |

Both migrations are idempotent, additive (no destructive operations), and online-safe.

## Risks updated

| Risk | Status |
|---|---|
| D-T1 (V8 drift) | Closed by Q16 — adapter strategy. |
| D-S1 (public form data leak) | Closed by Q17 — JWT + allow-list + rate-limit. |
| D-T2 (right-rail tool overflow) | Closed by Q15 — share-panel reuse. |

## Sprint Exit Gate

- [x] Audits complete (3/3).
- [x] Block C gate `GO_WITH_CONSTRAINTS` confirmed.
- [x] CTO decisions Q15–Q17 locked.
- [x] Migration plans drafted.
- [x] Recommendation: `GO` to D-S1.
