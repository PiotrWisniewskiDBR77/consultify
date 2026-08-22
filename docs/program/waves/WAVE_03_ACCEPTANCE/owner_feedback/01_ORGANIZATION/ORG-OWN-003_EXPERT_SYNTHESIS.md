# ORG-OWN-003 — requested expert synthesis

Date: `2026-08-21`

Status: `PROPOSED_UNRECONCILED`

This is a synthesis requested by Piotr. It uses three simulated professional
lenses inspired by BCG, McKinsey and IMP. It is not a statement by, or evidence
of participation by, actual employees or representatives of those firms. It
does not replace Piotr's verbatim wording in the owner register.

## Shared diagnosis

All three reviews identify an information-architecture problem rather than a
styling problem alone. The current module mixes:

1. organization inputs;
2. evidence and source management;
3. analytical work and AI-derived conclusions;
4. readiness, conflicts and approval controls.

This produces excessive navigation without a clear progression, very large
empty areas, technical labels, inconsistent use of forms/tables/cards and no
obvious answer to “where do I start, what is missing and what should I do
next?”.

## Recommended Company Profile card model

| Order | Card | Business question | Core content |
|---:|---|---|---|
| 1 | Identity & Scale | Who are we and at what scale do we operate? | Type, industry, segment, locations, employee count, revenue |
| 2 | Operating Model | How does the organization operate? | Delivery/revenue model, markets, customers, systems and technology |
| 3 | Strategic Direction | Where are we going and how will we differentiate? | Position, growth stage, mission, vision, priorities and success measures |
| 4 | Constraints & Preferences | Within what boundaries should the organization and AI work? | Regulation, risk appetite, budget/time constraints, communication and AI preferences |
| 5 | Sources & Files | What evidence supports the profile? | Unified file list, owner, date, processing status, extracted information, conflicts and errors |
| 6 | Readiness & Decisions | Is the context usable and what remains unresolved? | Completeness per card, freshness, missing data, conflicts, decisions and final next action |

Progression: `Identity → Operating Model → Strategic Direction → Constraints →
Sources → Readiness`.

## Navigation contract

- The Organization inner sidebar changes the primary destination.
- Horizontal tabs divide peer subsections within the active destination.
- Content cards show records, status and actions; they do not duplicate either
  navigation level.
- Accordion controls are allowed only for optional detail inside a card, not as
  the architecture of the entire profile.
- Knowledge Graph is proposed as a cross-cutting exploration mode accessible
  from relevant screens.
- Context-governance functions are proposed for distribution between Sources &
  Files and Readiness & Decisions.
- “Megatrendy” is removed from this menu in line with `ORG-OWN-001`.

## Common page anatomy

Every Organization destination should use the same sequence:

1. page name and one-sentence business purpose;
2. compact completeness/readiness status linked to its explanation;
3. local horizontal tabs, if the destination has peer subsections;
4. top insight, issue or decision requiring attention;
5. primary actions;
6. working content;
7. source, provenance and quality detail on demand.

## Screen-specific application

- Goals & Expectations: control the working width or use the spare area for a
  progress/next-step panel rather than leaving an empty canvas.
- Challenges and Strategic Synthesis: use readable record cards/lists for a
  small number of items; switch to tables only when comparison and filtering
  justify them.
- Knowledge Graph: an empty state explains the value, data prerequisite and
  first action. A partial state gives examples and suggested queries.
- Context governance: business labels replace raw keys and UUIDs. Sources,
  conflicts, claims and versions are separated; decisions show what, why,
  supporting sources, impact and approve/reject/defer actions.
- Teresa context: reduce the repeated full-width strip to a compact actionable
  status that links directly to missing or conflicting context.

## State and quality rules

- Empty: explain value, prerequisite and one primary CTA.
- Partial: show the most important `3–5` items, gaps and “view all”.
- Complete: begin with a short management summary before detail.
- Each card shows purpose, completion, attention count, save state and next
  step.
- AI-derived, user-entered and owner-approved information are visibly distinct.
- Every readiness score is explainable and links to gaps, conflicts or stale
  data.
- The same hierarchy, spacing, action placement and interaction patterns apply
  across desktop, tablet and mobile acceptance widths.

## Proposed owner-note formulation

> Obecny layout Organizacji jest nieakceptowalny jako całość i wymaga
> przeprojektowania architektury informacji, nie tylko warstwy wizualnej.
> Profil firmy powinien prowadzić przez sześć kart: Tożsamość i skala, Model
> działania, Kierunek strategiczny, Uwarunkowania i preferencje, Źródła i pliki
> oraz Gotowość i decyzje. Wewnętrzny sidebar ma przełączać główne obszary
> Organizacji, zakładki poziome tylko podobszary aktywnego ekranu, a karty w
> treści mają prezentować dane, status i działania. Wszystkie ekrany muszą
> korzystać z jednego szkieletu, wyjaśniać puste stany, pokazywać kompletność i
> następny krok oraz tłumaczyć techniczne źródła i konflikty na język biznesowy.

This proposed formulation remains `PROPOSED_UNRECONCILED` until Piotr or the
integrator explicitly confirms it.

## Skeptical business-specialist review — what is still missing

Status: `PROPOSED_UNRECONCILED`

The six-card structure is clearer, but structure alone does not make the
Organization context decision-grade. A skeptical business reviewer would not
accept “100% complete” or “5/5 ready” until the following gaps are addressed.

### 1. State exactly what entity and period the profile describes

The profile must identify whether it covers a legal entity, consolidated
group, business unit, geography or transformation perimeter. Every financial
or scale figure needs a reporting period, currency, unit and effective date.
Without this, employee count, revenue, market share and budgets cannot be
compared or trusted.

### 2. Define a minimum decision-grade dataset

Required fields should be based on the decisions Consultify must support, not
on the current form. At minimum, consider:

- business model and revenue logic, including recurring/non-recurring mix;
- growth, margin and cash/economic constraints where relevant;
- customer segments, concentration, buying process and value proposition;
- markets, channels, competitive position and evidence for market-share claims;
- critical capabilities, value-chain dependencies and decision rights;
- strategic targets with baseline, target, unit, date and accountable owner;
- transformation perimeter, budget, timing and non-negotiable constraints;
- critical systems, data owners and material data-quality limitations.

Not every organization needs every field. Mandatory/optional logic should vary
by organization type and use case, while preserving a documented minimum.

### 3. Attach accountability and provenance to material facts

Each decision-relevant fact should expose:

- business owner;
- source document or system;
- effective date and expiry/review date;
- confidence or evidence strength;
- status: user-entered, extracted, AI-inferred or owner-approved;
- conflicts and the decision required to resolve them.

A raw value without this context is not governed business information.

### 4. Make readiness explainable and consequential

Readiness cannot be a decorative score. It should show:

- completeness by card and by mandatory decision domain;
- stale, unsupported and contradictory facts;
- material gaps that block analysis;
- non-blocking gaps and why they are tolerated;
- the exact action, owner and due condition for every blocker;
- which downstream analyses are enabled or disabled.

The user should be able to click any score and see the evidence behind it.

### 5. Add cross-field business validation

The system should flag plausible inconsistencies, not only empty fields. For
example: revenue versus employee count, market share without market definition,
growth ambition without capacity or funding, stated priorities without metrics,
or risk appetite inconsistent with regulatory constraints. These should become
review prompts, not silent automated corrections.

### 6. Separate organization truth from assistant configuration

Communication style and AI preferences may belong in assistant settings rather
than in the core Organization profile. Keeping them together risks inflating
business completeness with configuration fields. If retained, the UI and
readiness formula must distinguish business context from assistant behavior.

### 7. End with a business decision, not a completed form

The final card should answer:

1. Is the Organization context sufficient for the intended analyses?
2. What material uncertainties remain?
3. Who must resolve them?
4. What analysis or workflow becomes available after approval?
5. What exactly is being approved, for which scope and as of what date?

The final action should create a visible, versioned decision state rather than
only save fields.

## Skeptical acceptance test

A business owner should be able to answer within one minute:

- what organization/perimeter is represented;
- which facts drive the strategic picture;
- which sources support them;
- what is missing or disputed;
- how current the information is;
- what decision is required next;
- whether the context is safe to use downstream.

If any answer requires reading raw keys, UUIDs, multiple screens or an opaque
readiness score, the redesign is not yet business-ready.
