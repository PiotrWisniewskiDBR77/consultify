---
module_id: MODULE_PRESENTATIONS
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Prezentacje (Presentation Studio)

## Purpose

Kontrakt zachowania Presentation Studio: pipeline generacji, reopen, builder handoff, export, source pack, QA i approvals.

## Must

- MUST: pipeline `/prezentacje` jest “honest and restartable”: fatal preflight stopuje flow, a błędy są jawne (toast + detale), bez infinite spinner.
- MUST: reopen decka używa kanonicznych ścieżek (`/api/artifacts/origin/presentation/...`), bez 404 dla “Recent”.
- MUST: “Open in builder” działa deterministycznie (same-tab nav) i ma jawny feedback.
- MUST: 3 mode’y docelowe (generate like gamma / template first / from approved template) realizują pełny lifecycle: outline approval → generation → preview → edit → export/share.

## Must Not

- MUST NOT: silent execution w krytycznych krokach pipeline (catch{} bez sygnału).
- MUST NOT: łamać visibility scopes i tenant safety w bibliotece.

## Should

- SHOULD: mieć source pack coverage i missing inputs przed generacją (sprint 2+).
- SHOULD: mieć QA engine dla executive clarity, methodology i sources (sprint 6–7).

## Acceptance Criteria

- [ ] Manual loop R1 PASS: `/prezentacje` fresh generation + reopen + builder handoff (evidence report 2026-05-09).
- [ ] Brak infinite spinner w bootstrap/pipeline; fatal errors stopują accept/materialize.

## Related Sources

- `DRD/consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_SPRINT_PLAN_2026-05-08.md`
- `DRD/consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md`
- `DRD/testy_antygravity/reports/2026-05-09_0519_presentations-manual-loop-r1-builder-handoff.md`

