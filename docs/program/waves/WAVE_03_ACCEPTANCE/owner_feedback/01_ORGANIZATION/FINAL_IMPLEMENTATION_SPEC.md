# Organization — final implementation specification

Status: `COMPLETE_EXPERT_SPEC / OWNER_CONFIRMATION_REQUIRED`

## Purpose

Create one decision-grade organization context, supported by evidence, that feeds
AI assistance, assessment and transformation work. Organization is not a settings
page and must end in an explainable readiness decision.

## Canonical left-menu map

### 1. Organization Profile

- `Identity & Scale`: entity scope, legal/trading name, industry, locations,
  employee count, revenue, currency, reporting period.
- `Operating Model`: delivery/revenue model, value chain, capabilities, core systems.
- `Market Position`: markets, segments, competitors, differentiation, growth stage.
- `Technology, Culture & Constraints`: maturity, stack, regulatory, budget/timeline
  constraints and risk appetite. Personal assistant preferences are excluded.

Primary action: `Save changes`. Summary: entity, period, completeness and freshness.
Validation must cover units, dates, ranges and cross-field consistency.

### 2. Goals & Expectations

- `Strategic Intent`: north star and supporting objectives.
- `Success Measures`: KPI, baseline, target, unit, horizon, owner and source.
- `Scope & Boundaries`: in-scope, out-of-scope, dependencies and no-go areas.
- `Stakeholder Expectations`: stakeholder, expected outcome, influence and owner.

Primary action: `Save and review goals`. Every objective must connect to at least
one measure or be explicitly marked qualitative.

### 3. Challenges

- `Declared Challenges`: symptoms, affected area, severity, owner and status.
- `Root Causes`: hypotheses, supporting/contradicting evidence and confidence.
- `Goal Blockers`: relationship between challenge and goal/KPI.
- `Evidence`: contextual view of linked evidence; canonical source editing remains
  under Sources & Knowledge.

Primary action: `Add challenge`. Empty state explains the difference between symptom
and root cause. Small collections use cards/list; comparison and bulk work use tables.

### 4. Strategic Synthesis

- `Risks & Opportunities`: derived items with rationale and traceable inputs.
- `Transformation Scenarios`: assumptions, outcomes, cost/time/risk and dependencies.
- `Recommendation`: selected direction, alternatives rejected and decision owner.
- `Executive Brief`: generated/exportable summary with version and sources.

Primary action: `Generate/update synthesis`. Generated content is always marked,
editable before approval and traceable to current inputs.

### 5. Sources & Knowledge

- `Files`: upload, list, status, owner, effective date, version and remove/archive.
- `Claims & Sources`: business label, value, provenance, confidence and consumers.
- `Source Conflicts`: competing values, comparison, decision owner and resolution.
- `Knowledge Graph`: canonical graph/search screen; other screens deep-link here with
  selected entity/claim context.

Primary action depends on child screen: `Add source`, `Resolve conflict` or `Search`.
Technical identifiers are hidden behind details. Upload is idempotent and shows
processing, failure and retry without duplicating a source.

### 6. Readiness & Governance

- `Readiness Summary`: readiness by business dimension and downstream use case.
- `Gaps & Freshness`: missing, stale, unsupported and low-confidence facts.
- `Decisions & Conflicts`: assigned decisions, blockers, due state and exceptions.
- `Versions & Publication`: draft/review/approved/published history and reopen.

Readiness contract:

- dimensions: identity/scope, strategy/goals, operating model, challenges, evidence
  quality and governance;
- a dimension is ready only when mandatory data for the intended use case exists,
  material facts have source/owner/effective date, and no critical conflict is open;
- stale or unsupported material facts cannot count as fully ready;
- the percentage is secondary to named blockers and drill-down;
- publication requires an authorized reviewer and creates an immutable version;
- reopen creates a new draft and never mutates the published version.

## Canonical object ownership

| Object | Edit screen | Read-only consumers |
|---|---|---|
| Organization fact | relevant Profile child screen | synthesis, readiness, graph |
| Objective/KPI | Goals & Expectations | challenges, synthesis, readiness |
| Challenge/root cause | Challenges | synthesis, readiness |
| Source/file/claim | Sources & Knowledge | all contextual evidence views |
| Conflict/decision | Readiness & Governance | contextual banners/deep-links |
| Published context version | Versions & Publication | downstream AI/assessment consumers |

## Acceptance suite

| AC | Expected result | Required evidence |
|---|---|---|
| `ORG-FINAL-AC-001` | Megatrends and Administration are absent from Organization menu | exact-SHA visual replay on every primary module |
| `ORG-FINAL-AC-002` | Six modules expand to the child screens above with stable breadcrumb/deep-links | desktop/tablet/mobile navigation evidence |
| `ORG-FINAL-AC-003` | Profile fields save without loss and read back after cold session | UI receipt + API/DB readback + cold replay |
| `ORG-FINAL-AC-004` | Sources are not duplicated by retry; conflicts retain both proposals and decision | UI + persistence + audit evidence |
| `ORG-FINAL-AC-005` | Readiness exposes named blockers and never treats an unsupported material fact as ready | controlled fixtures for ready/stale/conflict states |
| `ORG-FINAL-AC-006` | Publish creates immutable version; reopen creates a new draft | authorized/unauthorized flows + version readback |
| `ORG-FINAL-AC-007` | Knowledge Graph has one canonical route and contextual links preserve selection | deep-link and back-navigation replay |
| `ORG-FINAL-AC-008` | All child screens meet keyboard, focus, zoom, PL/EN and responsive requirements | accessibility and viewport evidence |

No AC may be marked `PASS` from a screenshot alone.
