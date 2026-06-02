---
module_id: MODULE_MY_WORK
function_id: MW_HOME_RADAR
function_name: Home / Start (Radar)
doc_kind: FUNCTION_CONTRACT
status: canonical
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-18
---

# Function Contract — Home / Start (Radar v1)

## 1. Function Identity

- Function ID: `MW_HOME_RADAR`
- Module: `02_moja-praca`
- UI labels/aliases: `Radar` (`Home` as route alias only)
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work"`, `"/my-work/home"`
- Feature state: `target_v1_rebuild`

## 2. One-Sentence Definition (LOCKED)

Radar is a personalized visual map of signals worth noticing for user development, projects, industry, and role.

## 3. Product Intent and Non-Goals (LOCKED)

- Radar is personal, visual, selective, calm, and actionable.
- Radar is not a KPI dashboard, PMO board, task tracker, or news feed.
- Radar is not a full market report; it is a guided noticing-and-thinking surface.

## 4. Core UX Model (LOCKED)

### 4.1 Layout

- Two-column desktop layout:
  - left: graphical radar map (`65-70%` width, square or near-square),
  - right: signal preview panel (`30-35%` width).
- No page redirect and no heavy modal in the primary interaction loop.

### 4.2 Primary Flow

1. User clicks a signal on radar.
2. Selected signal becomes highlighted.
3. Right preview panel updates immediately.
4. User reads context and guidance.
5. User may optionally trigger actions (`Talk to Teresa`, `Save`, `Turn into Idea`, `Develop Thought`, `Watch`, `Forget`).

### 4.3 Teresa Separation Rule

- Right panel is not Teresa chat.
- Teresa is a separate conversation surface, opened as an action with signal context.

## 5. Visual Grammar (LOCKED)

### 5.1 Rings (proximity-to-action, not time)

- `NOW` — close to action now.
- `PREPARE` — close to preparation.
- `LEARN` — close to learning.
- `OBSERVE` — close to horizon observation.

### 5.2 Quadrants

- `My Development`
- `My Projects`
- `My Industry`
- `My Role`

### 5.3 Signal Density and Hierarchy

- Default radar load: `12-20` signals (ideal `16`).
- Signal visual hierarchy:
  - point size -> potential impact,
  - color intensity -> user fit,
  - outline/glow -> new/updated/recommended,
  - active highlight -> selected signal.

## 6. Signal Object Contract (v1 static-ready)

Each signal must support:

- `id`, `name`, `icon`
- `ring` (`NOW|PREPARE|LEARN|OBSERVE`)
- `quadrant` (`MY_DEVELOPMENT|MY_PROJECTS|MY_INDUSTRY|MY_ROLE`)
- `type` (`TECHNOLOGY|SKILL|BUSINESS|RISK|PROCESS|TOOL|TREND|IDEA`)
- `importanceLevel` (small/medium/large mapping)
- `fitLevel` (low/medium/high mapping)
- `status` (`new|updated|saved|watching|ignored`)
- `preview` payload:
  - short description,
  - why it matters,
  - why it matters for you,
  - how to think about it,
  - good first question,
  - suggested next step.

## 7. Runtime States (LOCKED)

- `loading`: radar skeleton + panel skeleton.
- `empty`: short onboarding context prompt.
- `error`: personalization failed -> fallback generic radar + retry.
- `no_signal_selected`: right panel invites selection, shows featured/top signals.
- `signal_selected`: full preview + actions.

## 8. Actions and Governance Boundaries

- Action triggers exist in Radar context; high-impact work happens in owner modules.
- `Talk to Teresa` opens separate chat surface with injected signal context.
- `Save to Notebook`, `Turn into Idea`, `Develop Thought`, `Watch`, `Forget` can start intent handoff.
- No hidden mutation of PMO/initiative/task systems from Radar click.
- AI action placement must respect Menu 3 governance and avoid duplicate controls in multiple toolbars.

## 9. Acceptance Gate (v1)

Radar v1 is accepted if:

1. Two-column layout (`2/3 + 1/3`) is implemented and readable.
2. Left side is a true graphical radar (4 rings, 4 quadrants).
3. Radar displays `12-20` signals with icon + short label.
4. Clicking a signal updates right panel instantly.
5. Right panel includes all six narrative sections and action triggers.
6. View is calm, selective, and not dashboard-like.
7. User understands "personal radar" in ~10s and finds one actionable signal in ~30s.

## 10. Development Plan (Roadmap)

### R0 — Canon Lock and UX Baseline

- Freeze product intent, layout contract, and interaction model.
- Freeze "Radar panel != Teresa chat" rule.
- Prepare static prototype payload (16 signals, 4x4 model).

### R1 — Static Preview Build (No backend intelligence)

- Implement full UI shell and interactions with local/static data.
- Implement ring/quadrant rendering, selection, highlight, panel update.
- Implement local filters and basic anti-overlap/jitter.

### R2 — Action Wiring and Module Handoffs

- Wire action triggers to explicit handoff intents.
- Ensure Teresa action opens unified chat with context packet.
- Add observability events for selection/filter/action usage.

### R3 — Personalization Runtime

- Introduce scoring-driven signal selection and placement.
- Connect user/profile/project/role/industry context.
- Add feedback loop (`watch`, `forget`) into ranking behavior.

## 11. Risks and Guardrails

- Risk: radar regresses into dashboard/feed.
  - Guardrail: enforce density cap and preview-first interaction.
- Risk: Teresa interaction swallows right panel purpose.
  - Guardrail: strict separation of preview panel vs chat surface.
- Risk: overloading with too many points.
  - Guardrail: hard max `20` signals on radar canvas.

## 12. Change Log (Function-Level)

- 2026-05-18: replaced legacy radar triage contract with Radar v1 rebuild SoT (product intent, locked UX flow, visual grammar, signal contract, and R0-R3 roadmap).
