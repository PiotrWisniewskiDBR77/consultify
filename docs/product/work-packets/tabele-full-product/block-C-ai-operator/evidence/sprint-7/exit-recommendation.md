# Block C — Exit Recommendation

**Date:** 2026-05-08
**Block:** Block C / AI Operator
**Status:** `EXECUTED — GO_WITH_CONSTRAINTS`

## Decision

`GO_WITH_CONSTRAINTS` — Block C is approved to exit and Block D may begin.

## Why "WITH_CONSTRAINTS"

Three buckets of work are scoped, ticketed, and intentionally deferred:

1. **Live cost / token calibration** — runs naturally during the Anygravity P0 trial (D-S5).
2. **On-staging perf gates** — QA Engine + Source Pack ranking against a real corpus.
3. **Integration & Playwright e2e** — durable regression coverage that doesn't need to land before Block D.

All three are non-blocking because the AI Operator surface is feature-flagged off in production:

```
Backend  : ENABLE_TABLE_AI_EDITOR=false
Backend  : ENABLE_TABLE_QA_ENGINE=false
Backend  : ENABLE_TABLE_SOURCE_PACK=false
Frontend : isTabeleAiEditorEnabled() → false (default)
Frontend : isTabeleQaEnabled()       → false (default)
Frontend : isTabeleSourcePackEnabled() → false (default)
```

A user cannot reach AI Operator UI without an operator override.

## What we shipped

| Surface | Status | Tests |
|---|---|---|
| `AiUsageService` (token budget, audit ledger) | Live | 11 |
| `TableAiEditorService` orchestrator | Live | 15 |
| 8 AI Editor level handlers | Live | 49 |
| `TableQaService` (5-axis health) | Live | 19 |
| `SourcePackBuilderService` | Live | 21 |
| `<TabeleAiEditorPanel>` | Live | 5 |
| `<TabeleQaPanel>` | Live | 5 |
| `<TabeleSourcePackPanel>` | Live | 5 |
| `useTabeleRightRailPanels` orchestrator | Live | 4 |
| `<TabeleMelsView>` regression | Live | 6 |
| **Total** | | **140 dedicated + 27 regression = 167 tests** |

All green. Lint clean. DBR77 hex scan clean.

## Gate checks

- [x] Day-10 barrier satisfied (Block A + Block B closed `DONE_WITH_CONSTRAINTS`)
- [x] Token budget enforced server-side with atomic `consume()`
- [x] Cross-tenant defenses unit-tested on every public service method
- [x] Super-admin gate runs before token consumption for levels 7–8
- [x] Prompt injection guard wraps every untrusted prompt
- [x] V8 snapshot is immutable post-creation in `tp_source_packs`
- [x] All AI surfaces live in Menu 3 (right rail) per `.cursor/rules/ai-actions-menu3.mdc`
- [x] Three feature flags + three client kill switches default to OFF
- [x] Migrations include rollback scripts
- [x] Closeout doc + 9 follow-up tickets filed

## What Block D inherits

Block D will:

1. (D-S0) Confirm Block C feature flags are still off in staging.
2. (D-S1–S4) Build artifact conversions and form intake on top of Tabele.
3. (D-S5) Run the Anygravity P0 trial #2 — this is the moment Block C surfaces light up for the first user.
4. (D-S6) Record a demo using the live AI Operator.
5. (D-S7) Final program closeout — at this point TBL-FU-C7-1 (live calibration) will resolve.

## Risks at exit

- **Cost ceiling on D-S5 trial** — mitigated by hard-cap 429 and append-only `tp_ai_usage` audit ledger.
- **DBR77 visual regressions on production data** — mitigated by component test coverage; D-S5 will be the visual canary.
- **OpenAI API instability** — mitigated by `LlmProvider` abstraction; we can fall back to `stubLlmProvider` on-the-fly via env if a 5xx storm hits production.

## Recommended ratification

This document is the authoritative Block C exit gate. CTO seat (this orchestrator) ratifies `GO_WITH_CONSTRAINTS`. Block D may begin.
