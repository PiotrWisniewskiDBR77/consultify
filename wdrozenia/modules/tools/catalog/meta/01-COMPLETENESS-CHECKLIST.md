# Strategic Tools Docs — Completeness Checklist

Use this checklist to verify every tool `.md` is **implementation-ready**, **KB-ready**, and **video-ready**.

## A. Documentation completeness (must pass)

- [ ] Metadata filled (name, slug, level, duration, inputs, outputs, created/updated)
- [ ] Clear purpose and when-to-use / when-not-to-use
- [ ] Key concepts + glossary present
- [ ] Inputs section includes **minimum** + **optional** + data quality checks
- [ ] Step-by-step method can be executed by a non-consultant
- [ ] Outputs section includes a DoD checklist
- [ ] UI/graphic spec is detailed enough to design screens and interactions
- [ ] Worked example is complete and realistic (numbers, constraints, outputs, initiatives)
- [ ] Implementation spec includes a JSON payload example + validation/DoD rules + initiative generation spec
- [ ] AI spec includes: reasoning rules, extraction schema, and self-checks
- [ ] Video storyboard includes scene list and on-screen cues
- [ ] KB pack includes TL;DR + ≥8 FAQs + checklists + glossary
- [ ] References section includes ≥3 authoritative sources

## B. Product quality (should pass)

- [ ] Tool artifacts are MECE (no overlaps, no missing major buckets)
- [ ] Results are actionable (insights → initiatives)
- [ ] Guidance differentiates facts vs assumptions
- [ ] Includes “common mistakes & fixes” grounded in practice
- [ ] Includes edge cases (missing data, contradictions, uncertainty)

## C. Implementation notes (sanity)

- [ ] Tool fits the canonical Tools workflow (Draft → Review → Approved → Generate initiatives)
- [ ] Tool can be implemented in the canonical 2-column UI (left workspace, right control panel)
- [ ] Deep-linking is specified (e.g., clicking a visualization element navigates to the relevant step/section)
- [ ] Initiatives include traceability back to tool outputs (source links)
