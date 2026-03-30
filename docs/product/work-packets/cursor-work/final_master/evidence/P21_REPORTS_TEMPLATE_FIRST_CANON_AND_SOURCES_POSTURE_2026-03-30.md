# P21-A Evidence — Reports template-first canon + sources posture
Date: 2026-03-30  
Packet: **P21-A**  
State: `approved(scope)` (scope/spec only; no runtime delivery)

## What was frozen (scope closure)
- **Report artifact schema**: report artifact extends Templates canon (P24 `OutputTemplate`) by attaching report-instance generation/runtime fields, including `sources_ledger`, `generation_plan`, `degraded_flags`.
- **Template-first flow**: select template → set params → generate plan → **approve(run)** → generate → land in Outputs Library (P19) → reopen/continue → **review(artifact)** → export.
- **Sources/citations posture**: evidence pointers (url, title, retrieved_at, confidence) + **no overclaim** rule + section-level attribution.
- **Degraded / no-web posture**: explicit flags + bannered safe draft; tool errors yield partial output with failed steps.
- **Hard separation**: **approve(run) ≠ review(artifact)** (P18 invariant).
- **Boundaries**: Reports (P21) are template-driven; Wordy (P22) is freeform; both land in Outputs (P19), but P21 requires `templateId` + sources ledger posture when web used.
- **Anti-duplicate gate**: no parallel template store (P24), no parallel Outputs library (P19), no parallel provenance (P18).

## Canon references (SSOT)
- Contract (P21): `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_21_RAPORTY_2026-03-29.md`
- Templates contract (P24): `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_24_TEMPLATY_2026-03-29.md` (§2.3.1, §2.3.3, §2.3.5)
- Outputs Library contract (P19): `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_19_OUTPUTS_LIBRARY_2026-03-29.md`
- Provenance contract (P18): `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_18_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md` (§2.5)

## Acceptance checklist pointer
See P21 contract §8.4 (P21-A — Acceptance checklist).

## Notes / known limits (explicit)
- This evidence row is **scope-only** (no tests/staging proof until P21-B/P21-C).
- Web/search is treated as a bounded tool step in `generation_plan`, not a general “research product”.

