# TBL-FU-B1 — DBR77 token-ize provenance components

**Priority:** P1
**Owner:** Frontend lead
**Source:** Block B · B-S6 hex scan finding (`evidence/sprint-6/validation-matrix-run.md` § L1.4).
**Filed at:** B-S6 gate, 2026-05-08

## Goal

Replace the 19 raw hex literals across three Block B provenance components with semantic Tailwind utility classes / CSS variables consistent with the DBR77 invariant. Functional contract is already covered by 133/133 tests; this follow-up is purely a presentation refactor and must NOT change rendered output by more than 1 % per pixel-diff.

## Affected files (19 hits)

- `src/components/MyWork/table/provenance/RowGutterIndicator.tsx` — 5 hits (validation status colours, confidence-tier colours).
- `src/components/MyWork/table/provenance/ConfidenceBar.tsx` — 5 hits (4-tier `pickColor` palette + neutral fallback).
- `src/components/MyWork/table/provenance/ValidationBadge.tsx` — 9 hits (4-state palette × 3 colour roles).

## Acceptance Criteria

- DBR77 hex scan on the three files returns 0 hits.
- All Block B component tests remain GREEN (38/38 in `provenance/__tests__` + `tabelePreview/__tests__/TabeleProvenanceColumn.test.tsx`).
- Pixel-diff vs current render at the documented thresholds (0.4 / 0.65 / 0.85) ≤ 1 % (operator visual diff).
- Tone palette uses the same family as A-S5 cells:
  - high severity / danger → `bg-rose-100`, `text-rose-700`, `border-rose-200` (and dark counterparts).
  - medium → `bg-amber-100`, `text-amber-700`, `border-amber-200`.
  - low / safe → `bg-emerald-100`, `text-emerald-700`, `border-emerald-200`.
  - neutral / unscored → `bg-slate-100`, `text-slate-600`, `border-slate-200`.
- Code review confirms no regression in dark-mode rendering.

## Estimate

~0.5 day (mechanical replacement + visual diff capture).

## Carry-over note

Filed at B-S6 gate so Block B can close `GO_WITH_CONSTRAINTS` and Day-10 barrier can pass. This follow-up is non-blocking for Block C kickoff because:
- The 5 specialized A-S5 cells (which Block C AI Editor relies on for rendering proposed values) already use the correct token palette.
- Block C does not surface the provenance components in its AI Editor / QA panel design (per CTO Q10 / Q13 — those panels reuse `TabelePreviewLayout` records section, not provenance internals directly).
