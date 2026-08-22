# AI OS — owner feedback register

Date opened: `2026-08-21`

Intake status: `OWNER_REVIEW_IN_PROGRESS / CAPTURED_UNRECONCILED`

## AIOS-OWN-001 — Determine whether the AI OS control-plane screen is useful

- Module: `AI OS`
- Screen/route: `AI OS control plane`; ambient route `/ai`, route `NOT VERIFIED`
- Category: `UX / CX / INFORMATION ARCHITECTURE / PRODUCT VALUE`
- Piotr's original wording (verbatim):

  > pytanie czy ten ekran jest nam do czegos przedatne

- Current behavior visible in evidence:
  - the screen presents six entry cards: AI Actions, Memory & Scope, Connectors,
    Agents, KPI/ROI & AI Ops, and Research & Artifacts;
  - it describes itself as a manual acceptance-test entry point;
  - every card is marked `OPEN` and contains checklist-like actions;
  - a lower table presents static build milestones and PASS labels;
  - the surface mixes runtime control, acceptance work and historical build evidence.
- Expected experience: before retaining this screen, define its primary persona,
  recurring job, canonical ownership and unique value. It must not duplicate Admin
  AI Control, System Health, Audit, Connectors or ordinary product navigation.
- Skeptical preliminary assessment — `EXPERT_PROPOSED`, not an owner decision:
  - potentially useful as an internal acceptance/operations hub for integrators,
    release reviewers or platform operators;
  - not yet justified as a customer-facing or ordinary user screen;
  - the static PASS milestone table is especially risky because historical build
    status can be mistaken for current runtime or owner acceptance;
  - if retained, separate live operational state, manual acceptance queue and
    historical evidence into clearly labelled child screens;
  - if no named persona performs these tasks repeatedly, remove it from normal
    navigation and keep the capability in authorized Admin/operations surfaces.
- Impact: an unexplained control plane can duplicate existing modules, expose
  technical concepts to the wrong persona and create false confidence from static
  PASS labels.
- Proposed importance: `HIGH / ARCHITECTURE DECISION`
- Evidence: `AIOS-EVD-001`
- Open question: `AIOS-Q-001`
- Status: `CAPTURED_UNRECONCILED`

### AIOS-Q-001 — Retain, relocate or remove

- Question: Who is the primary user and recurring decision for this screen, and
  should it remain a dedicated AI OS module, move under restricted Admin/Operations,
  or be removed from navigation while its functions are distributed to canonical
  modules?
- Decision owner: Piotr / integrator
- Blocks: AI OS information architecture and navigation placement
- Status: `OPEN_UNRECONCILED`

## Counters

- Observations: `1`
- Evidence items: `1`
- Open questions: `1`
- Fixed: `0`
- Accepted: `0`
