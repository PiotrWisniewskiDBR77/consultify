# Risk Register — Block C: AI Operator

**Block ID:** `TABELE_BLOCK_C_AI_OPERATOR`
**Status:** `PLANNED`

---

## Technical risks (C-T)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| C-T1 | Token budget too restrictive (user complaints) or runaway costs (P5) | High | High | P1 | Telemetry baseline in S0; per-plan configurability; soft-warn first; hard cap second | Agent A |
| C-T2 | AI proposal payload schema drifts across 8 levels | Medium | Medium | P1 | Shared `ProposalEnvelope<T>` TypeScript contract; type-check gate | Agent A |
| C-T3 | LLM provider rate limits hit during integration tests | Medium | Medium | P2 | Mock provider in integration tests; live provider only in `npm run test:llm-live` | Agent A |
| C-T4 | Proposal queue grows unbounded as users defer applying | Medium | Low | P3 | TTL of 30 days on `tp_proposals.status='pending'`; cleanup job | Agent A |
| C-T5 | Token usage tracking races during concurrent AI Editor calls | Medium | High | P1 | Atomic `UPDATE ... RETURNING` via row lock; or Redis counter with periodic flush | Agent A |
| C-T6 | `TableQaService` recompute on every record write tanks throughput | High | Medium | P1 | Async recompute via job queue (debounced 5 min); on-demand "Refresh QA" button for users | Agent A |
| C-T7 | `SourcePackService` candidate ranking too slow on big tables | Medium | Medium | P2 | Pre-computed embeddings index (existing); cap to 10k record corpus per request | Agent A |

## Product / UX risks (C-P)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| C-P1 | 8 level tabs feel overwhelming | Medium | Medium | P2 | Group into 3 supergroups: "Data" (cell/record/column), "Structure" (structure/view), "Reasoning" (relational/methodological/source); collapsed by default | Agent B |
| C-P2 | Diff card UX confusing — users don't understand "proposed but not applied" | High | Medium | P1 | Clear empty-state copy; pending count badge in Menu 3; tooltip "AI proposes; you apply" | Agent C |
| C-P3 | QA report scoring feels arbitrary / cannot be challenged | Medium | Medium | P2 | Each axis card has "Why this score?" expansion showing inputs; user can mark suggestion as "Not applicable" with reason | Agent B |
| C-P4 | Token budget banner appears too often / annoying | Medium | Low | P3 | Show only at 70 / 90 / 100 %; never repeat the same threshold within a session | Agent C |
| C-P5 | "Refine" action on proposal triggers unbounded follow-up loops | Low | Medium | P2 | Refine count cap of 3 per proposal session | Agent A |

## Security / tenant risks (C-S)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| C-S1 | AI Editor bypasses governance and auto-executes | Low | Critical | P0 | Hard rule: every level returns `{proposalId}` only; service has no execute method on level handlers; L7.2 review | Agent A |
| C-S2 | Cross-tenant data appears in LLM context | Medium | Critical | P0 | Prompt builder reads only tenant-scoped sources; tested with dedicated audit (L7.3); separate test fixture per tenant | Agent A |
| C-S3 | Proposal replay attack: same proposalId applied twice with manipulated payload | Low | High | P1 | Server-issued nonce; one-shot per proposal; idempotent apply logs the second attempt | Agent A |
| C-S4 | `methodological` / `source` levels accessible by non-admin | Low | High | P1 | Role check on level handler entry; L4.7 integration test | Agent A |
| C-S5 | Token budget bypass via header manipulation | Low | Medium | P2 | Server-side enforcement; client never sets budget headers | Agent A |
| C-S6 | LLM provider stores tenant data → privacy leak | Medium | High | P1 | Honor `prompt-safety` guardrails (existing service); respect `confidentiality` flag from organization settings | Agent A |

## Cross-block dependencies (C-XB)

| # | Risk | Counterpart | Mitigation |
|---|---|---|---|
| C-XB1 | `ai_generated_summary` and `ai_classification` (Block A) trigger Block C recompute orchestration | Block A EPIC-T7 | C-S1 in this block reads field metadata (auto fields) and orchestrates recompute via proposal queue |
| C-XB2 | `confidence_score` (Block B) feeds QA Engine completeness axis | Block B EPIC-T9 | C reads field; if NULL, treats as "no confidence baseline" |
| C-XB3 | `template.governance_rules` (Block A) feeds methodological-level checks | Block A EPIC-T6 | C reads `governance_rules.approval_required_fields`, `min_records_for_publish` |

---

## Rollback strategy

### Tier 1 — Feature flag
- `featureTableAiOperatorEnabled=false` → UI hides panels; endpoints return 404.

### Tier 2 — Code revert
- All additive: `git revert <pr>`.

### Tier 3 — Migration rollback
- `DROP TABLE tp_qa_reports, tp_ai_usage`; revert ALTER on `tp_proposals` if present.

### Tier 4 — Hot patch
- If P0 lands post-merge: enable Tier 1; investigate; fix or escalate.
