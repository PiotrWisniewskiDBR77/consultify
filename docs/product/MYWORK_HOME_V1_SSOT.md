# My Work Home — Product Specification (SSOT)

## 1. Overview

`My Work > Home` is now a living transformation screen, not a static dashboard. It is the default landing tab for My Work and acts as:

- the user’s AI-first transformation desktop
- a bridge between signals, ideas, execution, and chat
- an inspirational but decision-useful surface
- a transformation support layer, not an operational cockpit

This screen must stay positioned as support for transformation programs. It must not drift into plant telemetry, live operational control, or IRIS-like daily operations management.

---

## 2. Tab Order (Frozen)

The My Work tab order remains frozen:

1. **Home** (default landing)
2. Ideas
3. Notebook
4. Inbox
5. Calendar
6. Tasks
7. Decisions
8. Manager (manager-only)

---

## 3. Home V2 Model: 8 Blocks

Home V2 replaces the old 4-zone model with an orchestration-based block system.

### 3.1 Block Registry

The canonical Home V2 blocks are:

1. `aiPulseCore`
2. `momentum`
3. `sparkField`
4. `decisionTemperature`
5. `industryLens`
6. `executionCurrent`
7. `teamSignal`
8. `commandDock`

### 3.2 Block Purposes

- `aiPulseCore`: main AI briefing, dominant daily storyline, top transformation moves
- `momentum`: where the program is accelerating vs losing speed
- `sparkField`: ideas, notes, and unresolved creative energy with highest transformation potential
- `decisionTemperature`: approvals, blockers, governance friction, unresolved trade-offs
- `industryLens`: external transformation signals filtered by role and industry
- `executionCurrent`: near-term execution flow in a transformation frame, not a generic ops list
- `teamSignal`: alignment, narrative coherence, leadership attention, organizational pull
- `commandDock`: the persistent bridge to create artifacts, open modules, and jump into AI chat

---

## 4. Dynamic Behaviour

Home V2 must feel alive and change over time without becoming noisy.

### 4.1 Time Modes

- `morning`
- `liveDay`
- `eveningWrap`

Time mode affects:

- pulse copy
- background color drift
- emphasis of hero messaging
- which blocks visually feel hottest

### 4.2 Priority and Freshness

Each block exposes:

- `priorityWeight`
- `relevanceScore`
- `freshnessScore`
- recommended `size`

These values drive layout emphasis, subtle motion, and “live” accents. The point is dramaturgy and hierarchy, not novelty for its own sake.

---

## 5. Personalization

Layout is stored in `user_preferences.home_layout`.

Supported metadata:

- ordered `blockLayouts[]`
- per-block `visible`
- per-block `pinned`
- optional `priorityOverride`
- optional `sizeOverride`
- `ambientMotion` intensity

We are not introducing a new profile system yet. Relevance comes from data already available in the product:

- `currentUser`
- organization context
- existing My Work activity
- existing preferences

---

## 6. Data Contract

### 6.1 Primary Endpoint

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/my-work/home/v2` | Aggregated Home V2 screen with time mode, pulse label, and 8 block contracts |

### 6.2 Legacy Compatibility

The old V1 endpoints may remain temporarily for compatibility, but Home V2 must render from the aggregated contract:

- `/api/my-work/home/brief`
- `/api/my-work/home/spark`
- `/api/my-work/home/pulse`
- `/api/my-work/home/nudge`

### 6.3 Relevance Inputs

Home V2 relevance scoring should be based on:

- `req.user`
- `organizationContextService.buildResolvedContext()`
- ideas, notebook activity, tasks, decisions
- lightweight freshness and urgency logic

No new profile model is required in this phase.

---

## 7. Industry Lens Guardrails

`industryLens` is explicitly transformational, not operational.

Allowed:

- market signals
- technology signals
- sector benchmarks
- peer cases
- “why this matters for you” interpretation

Not allowed in this phase:

- live plant telemetry
- pseudo-real operational events from the factory
- IRIS-style daily operations monitoring

For manufacturing users, examples include:

- supply disruption pressure
- energy price implications
- cost pressure / demand volatility
- AI use cases in quality, planning, maintenance, scheduling
- sector transformation benchmarks

---

## 8. Chat and Cross-App Bridge

Home V2 must have a structured bridge into chat and modules.

### 8.1 Chat Bridge

Blocks send structured packets containing:

- `sourceBlock`
- `intent`
- `title`
- `starterPrompt`
- optional `entityType`
- optional `entityId`
- optional `contextData`

These packets are used to:

- open chat with context
- prefill the first message
- preserve the origin block for follow-up reasoning

### 8.2 Module Bridge

Home must bridge directly to:

- Ideas
- Notebook
- Calendar
- Tasks
- Decisions
- Manager

---

## 9. Frontend Components

| Component | Path | Role |
|-----------|------|------|
| `HomeView` | `src/components/MyWork/Home/HomeView.tsx` | Orchestrates Home V2 block layout and canvas background |
| `useHomeData` | `src/components/MyWork/Home/useHomeData.ts` | Fetches `/home/v2`, merges layout personalization, keeps V1 compatibility helpers |
| `AIPulseCore` | `src/components/MyWork/Home/AIPulseCore.tsx` | Hero AI briefing block |
| `MomentumBlock` | `src/components/MyWork/Home/MomentumBlock.tsx` | Program momentum block |
| `SparkField` | `src/components/MyWork/Home/SparkField.tsx` | Ideas + notes block |
| `DecisionTemperatureBlock` | `src/components/MyWork/Home/DecisionTemperatureBlock.tsx` | Governance / blocker block |
| `IndustryLensBlock` | `src/components/MyWork/Home/IndustryLensBlock.tsx` | External transformation signals block |
| `ExecutionCurrentBlock` | `src/components/MyWork/Home/ExecutionCurrentBlock.tsx` | Transformation execution flow block |
| `TeamSignalBlock` | `src/components/MyWork/Home/TeamSignalBlock.tsx` | Organizational alignment block |
| `CommandDock` | `src/components/MyWork/Home/CommandDock.tsx` | Sticky actions + AI bridge |
| `HomeBlockShell` | `src/components/MyWork/Home/HomeBlockShell.tsx` | Shared glass block shell with motion and size rules |

---

## 10. Design Language

Home V2 uses Canvas Mode, but as a more mature “living transformation screen” variant:

- animated ambient blobs tied to `timeMode`
- glass cards with stronger hierarchy and depth
- dynamic block scaling
- live accents for fresh/high-priority blocks
- motion that clarifies hierarchy rather than decorating
- dark-mode-first visual system

---

## 11. Role-Based Access

- **Home:** visible to all users
- **Manager tab:** restricted to `admin`, `manager`, and `superadmin`
