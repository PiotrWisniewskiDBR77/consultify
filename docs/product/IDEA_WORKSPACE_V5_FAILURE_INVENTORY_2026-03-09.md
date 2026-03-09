# Idea Workspace V5 — Failure Inventory (2026-03-09)

> **Status:** ACTIVE  
> **Purpose:** capture the first concrete bug / failure list for `Idea Workspace V5` based on runtime review, code review, and screenshot review.
>
> This document is intentionally harsh and specific.  
> It exists to support remediation, not to describe aspirations.

---

## 0) References

- `docs/product/IDEA_WORKSPACE_V5_REMEDIATION_PLAN.md`
- `docs/product/IDEA_WORKSPACE_V5_1_IMPLEMENTATION_PROGRAM.md`
- `docs/product/IDEA_WORKSPACE_V5_SSOT.md`
- `docs/product/ARTIFACT_LINKING_V5_SSOT.md`

Evidence inputs:
- runtime screenshots from `2026-03-09`
- code review of current `Idea Workspace` implementation

---

## 1) Executive summary

The current `Idea Workspace V5` state is not just incomplete.
It is currently misleading in a way that damages trust:

- UI suggests advanced capability where little usable behavior exists
- canvases look like placeholders rather than working tools
- artifact linking is not visibly operational in the main workflow
- table behavior suggests AI magic before core structure works
- status claims overstate delivery

---

## 2) Severity scale

- `P0` — blocker / unacceptable for active development sign-off
- `P1` — major issue / core experience broken or misleading
- `P2` — meaningful but secondary

---

## 3) Failure inventory

## 3.1 Shared workspace / shell

### F-001 — Workspace feels structurally unfinished

**Severity:** `P0`

Symptoms:
- center canvas is mostly empty
- large parts of chrome are visible, but the work surface looks underpowered
- tool richness is implied, but not evidenced by visible output

Why this is bad:
- destroys confidence immediately
- user feels system is fake or unfinished

Evidence:
- `Screenshot_2026-03-09_at_06.17.14-6290b2c4-4428-4cd8-8361-f46ee492dc63.png`

### F-002 — Workspace is overloaded with promise-chrome

**Severity:** `P1`

Symptoms:
- left chat, central canvas, right tools rail, bottom system switcher, top local toolbar
- but core interaction value is still weak

Why this is bad:
- too much chrome for too little working behavior
- users pay cognitive cost without product payoff

### F-003 — Canvas switching bar looks polished but not trustworthy

**Severity:** `P1`

Symptoms:
- switcher looks premium
- actual canvases behind it do not yet justify the confidence of the control

Evidence:
- `Screenshot_2026-03-09_at_06.17.44-b32661eb-308d-45d6-a9be-79094804797b.png`

---

## 3.2 Mind Map

### F-010 — Mind map nodes look like empty capsules, not idea branches

**Severity:** `P0`

Symptoms:
- nodes show `0 nodes`
- branch structure is visually meaningless
- map does not communicate reasoning, framing, or hierarchy

Why this is bad:
- fails the most basic promise of a map-based thinking tool

Evidence:
- `Screenshot_2026-03-09_at_06.17.14-6290b2c4-4428-4cd8-8361-f46ee492dc63.png`
- `Screenshot_2026-03-09_at_06.17.57-92e75bf8-5f28-4650-9468-83fcff22e019.png`

### F-011 — Center node styling is disconnected from branch quality

**Severity:** `P1`

Symptoms:
- central orange node is visually dominant
- surrounding nodes do not carry meaningful semantic content

Why this is bad:
- the system creates a fake sense of richness

### F-012 — AI-generated map content is not rendered as useful map structure

**Severity:** `P0`

Symptoms:
- chat produces structured text
- map area still shows empty / generic branch capsules

Why this is bad:
- direct contradiction between AI promise and visible result

Evidence:
- `Screenshot_2026-03-09_at_06.17.57-92e75bf8-5f28-4650-9468-83fcff22e019.png`

---

## 3.3 Whiteboard

### F-020 — Whiteboard looks like duplicated placeholder rectangles

**Severity:** `P0`

Symptoms:
- repeated brown blocks with almost no semantic differentiation
- weak visual language for sticky vs shape vs frame vs text

Why this is bad:
- freeform ideation surface feels fake
- workshop usability is near zero

### F-021 — Whiteboard lacks visible workshop energy

**Severity:** `P1`

Symptoms:
- no clear note semantics
- no visible grouping affordance
- no visible clustering value

Why this is bad:
- fails its intended brainstorming role

---

## 3.4 Process Flow

### F-030 — Process Flow is still a generic action-node layout

**Severity:** `P0`

Symptoms:
- nodes are generic `action`
- lane and flow semantics are too weak
- Classic / Automation / VSM distinction is not visually credible

Evidence:
- `Screenshot_2026-03-09_at_05.49.37-85b77070-0482-4e19-8da0-59a180c448a2.png`

### F-031 — Top process toolbar overstates actual mode depth

**Severity:** `P1`

Symptoms:
- mode and command labels imply operational depth
- runtime output still looks like a thin placeholder flow

Why this is bad:
- creates disappointment every time the user clicks deeper

---

## 3.5 Table

### F-040 — Table defaults are semantically empty

**Severity:** `P0`

Symptoms:
- rows are generic `node`
- columns do not create meaningful decision or analysis surface
- table does not look connected to idea logic

Evidence:
- `Screenshot_2026-03-09_at_05.49.46-aac733da-621f-4a9f-a40a-dde8c28bd3a0.png`

### F-041 — Right-side AI panel is premature and distracting

**Severity:** `P1`

Symptoms:
- AI suggests autofill and completion before row model is trustworthy
- user sees automation before structure

Why this is bad:
- makes the product feel like fake AI garnish

### F-042 — Artifact-based row workflow is not visibly real

**Severity:** `P0`

Symptoms:
- linked artifact value is not obvious
- autofill / refresh are not user-trustworthy yet

Why this is bad:
- destroys one of the most important differentiators

---

## 3.6 Artifact linking

### F-050 — Attach artifact action is not end-to-end real in the main workspace flow

**Severity:** `P0`

Symptoms:
- main workspace action path falls back to toast guidance instead of actual flow

Evidence in code:
- `src/components/MyWork/IdeaMapWorkspace.tsx`

### F-051 — Open linked artifacts is not reliably surfaced as working UI

**Severity:** `P0`

Symptoms:
- user cannot trust that linked artifact browsing is live
- visible UI path is weak or indirect

### F-052 — Context panel does not fully reflect the new attachment contract

**Severity:** `P0`

Symptoms:
- attached artifacts and extracted artifact cards are not yet one truth

Evidence in code:
- `src/components/MyWork/IdeaContextPanel.tsx`

### F-053 — Persistence may be environment-fragile

**Severity:** `P1`

Symptoms:
- API exists, but DB update path still requires runtime verification on real environment

Evidence in code:
- `server/src/routes/my-work.routes.ts`

---

## 3.7 AI / chat / content realism

### F-060 — AI advice is richer than the canvas behavior it feeds

**Severity:** `P0`

Symptoms:
- chat gives detailed structured suggestions
- canvas result remains visually and behaviorally weak

Why this is bad:
- strongest possible trust break

### F-061 — Prompt-driven scaffolding is presented too close to real functionality

**Severity:** `P1`

Symptoms:
- table autofill and artifact retrieval often feel like prompt dispatches, not product behavior

---

## 3.8 QA / process / truthfulness

### F-070 — Completion claims were materially overstated

**Severity:** `P0`

Symptoms:
- docs said complete
- visible runtime contradicts that status

Why this is bad:
- harms execution quality
- misleads future agents
- hides real risk

### F-071 — Smoke checks rely too much on static presence

**Severity:** `P0`

Symptoms:
- file existence and string presence were enough to support strong completion narrative

Why this is bad:
- rewards scaffolding
- misses runtime failure

---

## 4) Immediate repair priorities

## Priority A — Must start now

- F-050 attach artifact real flow
- F-052 context panel truth
- F-010 mind map reality
- F-030 process flow reality
- F-040 table reality
- F-070 status truth reset
- F-071 browser/runtime verification

## Priority B — Next

- F-020 whiteboard recovery
- F-041 reduce premature AI chrome
- F-060 align AI promise with visible output

## Priority C — After functional repair

- visual refinement
- motion refinement
- density and hierarchy polish

---

## 5) Mapping to remediation tasks

| Failure IDs | Remediation tasks |
| --- | --- |
| F-070, F-071 | `REM-01`, `REM-02`, `REM-13` / `V51-25`, `V51-31` |
| F-050, F-051, F-052, F-053 | `REM-03`, `REM-04`, `REM-05` / `V51-30` |
| F-010, F-011, F-012 | `REM-07` / `V51-26` |
| F-020, F-021 | `REM-08` / `V51-27` |
| F-030, F-031 | `REM-09` / `V51-28` |
| F-040, F-041, F-042 | `REM-06`, `REM-10` / `V51-29` |
| F-001, F-002, F-003, F-060, F-061 | `REM-14` / `V51-32` |

---

## 6) Final note

This inventory should be treated as the first real bug list for `Ideas V5`.

The correct next move is not broad expansion.
It is:
- fix trust
- fix core usability
- fix visible value
- then continue canvas by canvas
