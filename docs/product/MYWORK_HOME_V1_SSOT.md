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

Home V2 originally assumed no dedicated profile model. The current Radar-based Home implementation adds a focused preference layer for external signals while still reusing the broader My Work context.

Baseline relevance still comes from data already available in the product:

- `currentUser`
- organization context
- existing My Work activity
- existing preferences

Radar-specific preference profiling additionally uses:

- `user_radar_profiles`
- `watchlist_items`
- `radar_actions`

---

## 6. Data Contract

### 6.1 Primary Endpoint

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/my-work/home/v2` | Aggregated Home V2 screen with time mode, pulse label, and 8 block contracts |
| GET | `/api/my-work/radar` | Current Radar-based Home surface with briefing, ranked signals, recommendations, watchlist, metrics, and localization state |

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

Current Radar implementation also uses:

- tracked topics and tracked companies
- muted topics and muted sources
- watchlist entities
- recent Radar actions (`ask_ai`, `save`, `more_like_this`, `less_like_this`, `dismiss`)

This means Home now has a lightweight dedicated profile model for external signal relevance.

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

For Radar signals, chat must open with the selected signal as explicit context, not as a generic Home conversation. The active signal payload must include at minimum:

- signal title
- summary / insight summary
- why it matters
- why the user sees it
- suggested next step
- source and tags

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

---

## 12. Radar 2.0 — Current Home SSOT

This section remains the shell-level and Home-surface truth for Radar inside `My Work > Home`.

Detailed `Radar v8` package documents now extend this section without changing:

- the frozen My Work tab order,
- the role of Home as the landing surface,
- or the distinction between Radar and Inbox.

Companion documents:

- `MYWORK_RADAR_V8_READINESS_AUDIT.md`
- `MYWORK_RADAR_V8_SSOT.md`
- `MYWORK_RADAR_SIGNAL_PIPELINE_AND_RUNTIME_V8.md`
- `MYWORK_RADAR_PERSONALIZATION_AND_ACTION_ENGINE_V8.md`
- `MYWORK_RADAR_BRIEFINGS_AND_DISTRIBUTION_V8.md`
- `MYWORK_RADAR_SOURCE_TRUST_AND_GOVERNANCE_V8.md`

### 12.1 Product Positioning

`My Work > Home` currently operates as **Radar 2.0** for the default landing experience.

Radar is:

- an interpretation and action layer, not a raw news feed
- a personalized signal ranking surface for transformation work
- a bridge between external signals, internal work context, and AI follow-up
- a decision-support layer, not an operational telemetry cockpit

### 12.2 Core Flow

Radar must work in this sequence:

1. ingest signals from registered sources
2. normalize them into processed signals
3. rank them against user role, industry, and live My Work context
4. apply preference signals from prior user actions
5. localize content into the active app language
6. present a daily briefing plus ranked downstream sections

### 12.3 Personalization Model

Radar personalization is stored in:

- `user_radar_profiles`
- `watchlist_items`
- `radar_actions`

The system must learn from user behavior:

- `add_to_watchlist` adds a company or topic to the watchlist and profile
- `more_like_this` strengthens similar topics and sources
- `less_like_this` suppresses similar topics and sources
- `ask_ai`, `save`, `dismiss` affect behavioral ranking signals

Profile fields currently used by ranking:

- `trackedTopics`
- `trackedCompanies`
- `mutedTopics`
- `mutedSources`
- `personalizationWeights`

### 12.4 Language Contract

Radar must always respect the active application language.

Rules:

- if the source content already matches the app language, show it immediately
- if it does not match, localization runs in the background
- mixed-language UI is not allowed
- while localization is pending, the UI must show a temporary state and silently refresh

Localization state is part of the contract and includes:

- `requestedLanguage`
- `pendingCount`
- per-signal language metadata

### 12.5 Hero Contract

The Radar hero is the “front page” of the experience and must:

- surface the dominant daily briefing
- provide enough narrative depth to feel like a mini article, not a one-line summary
- anchor actions directly from the active signal
- allow optional reveal of supporting daily signals without permanently inflating the layout

The hero must support:

- one active brief at a time
- navigation between daily signals / briefs
- `Pogadaj z AI`, `Do notatki`, `Utwórz zadanie`
- optional info reveal
- optional signal tray reveal

### 12.6 Screen Structure

The Radar Home payload must expose:

- `dailyBriefing`
- `whatChanged`
- `whyItMattersToMe`
- `whatToDoNext`
- `learnImprove`
- `watchlist`
- `metrics`
- `localization`

### 12.7 AI Chat Contract

When the user opens AI from Radar, the AI must know the exact signal being discussed.

The chat-open packet must contain:

- explicit signal identity
- full signal context payload
- origin block / intent
- starter prompt aligned to the active signal

Radar-to-chat context must never degrade into a generic “home” conversation without signal details.

### 12.8 Canonical Files

Current implementation source of truth for Radar behavior:

- `server/src/routes/my-work.routes.ts`
- `server/src/services/radar/radarService.ts`
- `server/src/services/radar/radarRankingService.ts`
- `server/src/services/radar/radarActionService.ts`
- `server/src/services/radar/radarLocalizationService.ts`
- `server/src/services/radar/radarTypes.ts`
- `src/components/MyWork/Home/HomeView.tsx`
- `src/components/MyWork/Home/useRadarData.ts`
