# ORG-OWN-003 — complete Organization screen blueprint

Date: `2026-08-21`

Status: `PROPOSED_UNRECONCILED`

Hardened navigation interpretation (2026-08-21): the Settings-derived hierarchy
in [`../CROSS_MODULE/SETTINGS_UI_STANDARD.md`](../CROSS_MODULE/SETTINGS_UI_STANDARD.md)
is the sole target navigation proposal. In the historical text below, "card" means
a domain module and every former "horizontal tab" means a child screen in the left
menu. Neither may duplicate that hierarchy inside content. The exact final module
count and labels remain blocked by `ORG-DEC-001`; this clarification does not record
owner acceptance.

Visual/navigation standard override: the module must follow
[`../CROSS_MODULE/SETTINGS_UI_STANDARD.md`](../CROSS_MODULE/SETTINGS_UI_STANDARD.md).
The content model below remains valid, but its six primary areas are rendered
as Settings-style expandable left-menu modules with child screens, not as a
second custom navigation system.

Authority: owner-requested expert concept. This document synthesizes three
simulated professional perspectives inspired by BCG, McKinsey and IMP. It is
not a statement by actual representatives of those firms and is not an
accepted implementation specification.

## 1. Target information architecture

The Organization module is a guided process for building decision-grade
context, not a collection of forms and technical registers.

The vertical Organization sidebar contains exactly six primary cards:

1. `Profil organizacji`
2. `Cele i oczekiwania`
3. `Wyzwania`
4. `Synteza strategiczna`
5. `Źródła i wiedza`
6. `Gotowość i governance`

`Megatrendy` is removed from Organization. `Graf wiedzy` becomes a
cross-cutting exploration mode opened from the module header or from a
specific record. It does not create a seventh workflow step.

Progression:

`Profil → Cele → Wyzwania → Synteza → Źródła → Gotowość`

## 2. Common screen shell

Every primary card uses the same page anatomy.

### Header

- page name;
- one-sentence business purpose;
- business owner, where applicable;
- last updated date;
- state: `EMPTY`, `DRAFT`, `INCOMPLETE`, `CONFLICT`, `STALE`,
  `READY_FOR_REVIEW`, `APPROVED` or `PUBLISHED`;
- compact readiness summary: completeness, evidence quality, conflicts and
  open decisions;
- one primary CTA;
- no more than two secondary actions in an overflow menu.

The full-width Teresa context banner is replaced by a compact, expandable
status in the header. Selecting it opens concrete missing, conflicting or
stale context rather than a generic information strip.

### Local navigation

- Vertical sidebar: only the six primary cards.
- Horizontal tabs: only peer subsections of the active primary card.
- Content cards: only information, records, summaries or actions. They never
  duplicate either navigation level.
- Accordions: optional detail inside a subsection only; never the architecture
  of an entire screen.

### Working area

Order:

1. executive summary or top issue;
2. attention items and decisions;
3. primary working content;
4. provenance and quality on demand.

Use a controlled content width. A narrow form must not sit at the left of an
otherwise empty ultra-wide canvas. Spare desktop width may hold an actionable
summary/next-step panel, not decorative emptiness.

### Save and progression

- The latest explicit owner requirement `XMOD-OWN-005` supersedes the earlier
  autosave proposal: editable screens use one `Save Changes` action in the
  canonical header slot. Local draft preservation may not impersonate persistence.
- Business decisions, conflict resolution, approval and publication require
  explicit confirmation.
- Sequential workflows may expose `Wstecz` and `Zapisz i przejdź dalej`, but this
  secondary progression pattern does not replace or duplicate the authoritative
  header save action.
- An error never discards already entered information.

### Canonical record metadata

Every material business record can expose:

- content/value;
- business owner;
- importance and status;
- source and evidence fragment;
- effective date and review/expiry date;
- confidence/evidence strength;
- origin: user-entered, extracted, AI-inferred or owner-approved;
- required next action.

## 3. Card 1 — Profil organizacji

### Purpose and decision

Build the canonical description of the organization used by downstream
analysis. The owner decides whether it represents the correct entity and
transformation perimeter.

### Header summary

- entity/perimeter name;
- profile completion by subsection;
- material unsupported facts;
- stale information;
- CTA: `Uzupełnij najważniejszy brak` or `Przekaż profil do przeglądu`.

### Horizontal tab 1 — Tożsamość i skala

Sections in order:

1. Entity scope:
   - legal/trading name;
   - legal entity, group, business unit or transformation perimeter;
   - reporting period, currency and units.
2. Classification:
   - organization type;
   - industry and sub-industry;
   - industry classification and code.
3. Scale:
   - employee count;
   - company-size band;
   - revenue and currency;
   - founding year.
4. Geography:
   - headquarters;
   - countries of operation;
   - primary markets.
5. Short business description.

Validation includes employee count versus size band, reporting period and
currency for revenue, valid founding year and classification consistency.

### Horizontal tab 2 — Model działania

Sections:

1. delivery/value-creation model;
2. revenue or funding model, including recurring/non-recurring logic;
3. key products and services;
4. customer segments and buying channels;
5. critical value-chain processes and dependencies;
6. critical systems, integrations and process owners;
7. decision-rights summary.

Begin with a short “How the organization operates and earns” summary.

### Horizontal tab 3 — Pozycja i kierunek

Sections:

1. current competitive position and growth stage;
2. markets, competitors and alternatives;
3. market-share claim with market definition, date and source;
4. differentiators and strategic capabilities;
5. mission and vision;
6. strategic priorities.

Mission, vision and market position do not appear approved without a named
owner and evidence/status.

### Horizontal tab 4 — Technologia, kultura i ograniczenia

Sections:

1. digital maturity with scale definition and rationale;
2. cloud posture and technology stack;
3. data quality and critical data owners;
4. regulatory environment;
5. risk appetite;
6. budget and timeline constraints with units and periods;
7. communication and AI preferences, visually separated from business facts.

The design must make clear whether assistant configuration contributes to
business readiness. The recommended default is to score it separately.

### Main states

- `EMPTY`: choose manual setup or add a source document; show the minimum
  dataset required for the intended analysis.
- `PARTIAL`: prioritize missing items by downstream impact.
- `COMPLETE`: management summary plus scope, owner and confirmation date.
- `CONFLICT`: compare competing values and sources; select a canonical value or
  explicitly defer.
- `ERROR`: preserve inputs, identify what failed and allow retry.

## 4. Card 2 — Cele i oczekiwania

### Purpose and decision

Define what the organization wants to achieve, how success will be measured
and what is explicitly outside the transformation.

### Header summary

- North Star;
- number of measures with valid baseline and target;
- unresolved scope/stakeholder conflicts;
- CTA: `Przekaż kierunek do zatwierdzenia`.

### Tab 1 — Intencja strategiczna

- North Star statement;
- business rationale;
- time horizon;
- sponsor;
- supporting objectives;
- ranked top three priorities.

Priorities use ranking and the UI enforces the maximum instead of allowing a
contradictory selection state.

### Tab 2 — Mierniki sukcesu

Each metric contains:

- name and definition;
- baseline, target and unit;
- target date;
- owner;
- measurement source;
- update frequency;
- current freshness/status.

### Tab 3 — Zakres i granice

Three explicit lists:

- `IN SCOPE`;
- `OUT OF SCOPE`;
- `TO DECIDE`.

Cover business units, processes, geographies, systems and dependencies. Fold
the current No-Go area into this tab and record reason, authority able to
change the boundary and review date.

### Tab 4 — Oczekiwania interesariuszy

Each record:

- stakeholder/role;
- expected outcome and success criterion;
- influence and engagement level;
- owner of the relationship;
- agreement status;
- conflict with other expectations.

### Readiness rule

Goals are ready for diagnosis only when North Star, sponsor, time horizon,
ranked priorities, measurable outcomes and scope boundaries meet explicit
minimums.

## 5. Card 3 — Wyzwania

### Purpose and decision

Move from reported symptoms to evidence-backed problems, root causes and
blockers of agreed goals.

### Header summary

- number of material challenges;
- evidence coverage;
- critical blockers;
- hypotheses awaiting validation;
- CTA: `Dodaj wyzwanie` or `Rozstrzygnij hipotezy`.

### Tab 1 — Zadeklarowane wyzwania

Use cards/compact list for `1–5` records and a filterable table only for larger
sets. Each challenge contains:

- symptom and description;
- functional area;
- affected goal/KPI;
- impact, severity and frequency;
- problem owner and resolution owner;
- source, evidence strength and status.

### Tab 2 — Przyczyny źródłowe

- hypothesis;
- related challenges;
- evidence for and against;
- confidence;
- validation owner and next step;
- state clearly distinguishes `HYPOTHESIS` from `CONFIRMED_ROOT_CAUSE`.

### Tab 3 — Blockery celów

Goal-by-blocker matrix:

- blocked goal;
- blocker and impact strength;
- urgency and controllability;
- dependencies;
- possible intervention;
- owner and decision required.

### Tab 4 — Dowody

- document, interview, quantitative data or observation;
- date and owner;
- supported or contradicted claim;
- credibility and freshness;
- direct source link.

High severity without described impact, root cause without evidence, or record
without owner cannot be `READY_FOR_REVIEW`.

## 6. Card 4 — Synteza strategiczna

### Purpose and decision

Transform the approved context and diagnosis into comparable options and an
explicit management recommendation.

### Header summary

- data/version used;
- unresolved conflicts affecting analysis;
- last generated/updated date;
- recommended scenario or `INSUFFICIENT_BASIS`;
- CTA: `Odśwież syntezę` or `Przekaż rekomendację do decyzji`.

### Tab 1 — Ryzyka i szanse

Ranked risk and opportunity cards. Each includes cause, impact,
probability/evidence strength, affected goals, owner, response and sources.
AI-generated entries remain suggestions until explicitly reviewed.

### Tab 2 — Scenariusze transformacji

Show no more than `3–4` scenarios using a shared comparison matrix:

- thesis and scope;
- expected value;
- cost and time;
- risks and dependencies;
- required capabilities;
- reversibility;
- assumptions and conditions of success.

### Tab 3 — Rekomendacja

- selected direction or statement that evidence is insufficient;
- rationale and key evidence;
- sensitivity to unresolved assumptions;
- success conditions;
- required owner decisions;
- residual risks.

### Tab 4 — Executive brief

Editable, versioned document with:

- starting situation;
- key objective and problem;
- alternatives considered;
- recommended decision;
- evidence and caveats;
- implications and next actions.

Every material thesis supports “Why am I seeing this?” drill-down to sources.

## 7. Card 5 — Źródła i wiedza

### Purpose and decision

Provide one canonical place for evidence, processing status, extracted claims
and cross-module knowledge relationships.

### Header summary

- active sources;
- files awaiting/failed processing;
- stale sources;
- extracted claims and conflicts;
- CTA: `Dodaj źródło`.

### Tab 1 — Pliki

File list fields:

- file name and type;
- document date and version;
- uploader and business owner;
- added date;
- processing status;
- extracted information count;
- warnings/conflicts;
- areas where the file is used.

Actions: preview, replace version, assign owner, reprocess, view extracted
information, archive/remove with permission and impact confirmation.

### Tab 2 — Twierdzenia i źródła

Each claim:

- business label and value;
- source and exact fragment;
- extraction date;
- confidence and freshness;
- approval state;
- linked profile/goal/challenge/synthesis record.

Raw keys and UUIDs are hidden behind “Technical details”.

### Tab 3 — Konflikty źródeł

Side-by-side comparison:

- competing values;
- source, date, owner and confidence for each;
- impact on downstream analysis;
- recommended resolution with rationale;
- decision owner and due date;
- choose, keep scoped variants, reject or defer.

### Tab 4 — Graf wiedzy

The graph is also accessible as a cross-cutting full-screen mode. Its embedded
tab contains:

- search and filters;
- entity/relationship/conflict counters;
- graph plus accessible list alternative;
- legend;
- selected-node detail with provenance and history.

An empty graph explains what it will show, what data is missing and provides
`Dodaj źródło` or `Zatwierdź informacje` rather than a blank canvas.

## 8. Card 6 — Gotowość i governance

### Purpose and decision

Determine whether the Organization context is complete, current, consistent,
evidence-backed and explicitly approved for downstream use.

### Header summary

- overall state, never an unexplained percentage alone;
- critical blockers;
- last full review;
- active published version;
- CTA determined by state: `Uzupełnij brak`, `Rozstrzygnij konflikt`,
  `Przekaż do przeglądu` or `Opublikuj zatwierdzony kontekst`.

### Tab 1 — Podsumowanie gotowości

Score dimensions shown separately:

- completeness;
- evidence coverage;
- consistency/conflict-free state;
- freshness;
- owner approval.

Show readiness per primary card, enabled/blocked downstream analyses and the
single most important next action.

### Tab 2 — Braki i aktualność

- missing/stale item;
- affected card and field;
- decision impact and blocker status;
- owner and due condition/date;
- direct link to fix or explicitly accept the gap.

### Tab 3 — Decyzje i konflikty

Each decision shows:

- what must be decided;
- competing options;
- supporting sources;
- consequence of each option;
- decision owner and deadline;
- approve/select, reject, defer or accept exception.

Critical unresolved conflict prevents publication unless an authorized,
documented exception is recorded.

### Tab 4 — Wersje i publikacja

- current draft versus active version;
- author/approver and timestamp;
- scope and change summary;
- accepted exceptions;
- compare versions;
- immutable publication receipt/status;
- reopen/create successor version without silently overwriting history.

The final approval states exactly what context, entity/perimeter, date and
downstream use are authorized.

## 9. Collection-size rules

- `0` records: explanatory empty state, value, prerequisite and one CTA.
- `1–5`: readable cards/compact list with visible actions.
- `6–25`: sortable/filterable table where comparison matters.
- `>25`: paginated or virtualized table, saved filters and controlled bulk
  actions.

A one-row table must not stretch a record across the entire viewport merely
because a table component exists.

## 10. Responsive behavior

### Desktop `≥1200 px`

- global rail plus Organization sidebar `280–320 px`;
- controlled centered content width;
- up to two-column forms;
- optional right drawer for provenance/attention detail;
- summary cards in `3–4` columns where meaningful.

### Tablet `768–1199 px`

- Organization sidebar collapses into a drawer;
- horizontal tabs scroll or become a selector;
- content becomes one/two columns by task;
- wide tables transform into cards or controlled horizontal regions.

### Mobile `<768 px`

- single-column content;
- active primary card selected from header/drawer;
- subsections use dropdown/segmented control;
- records render as cards;
- sticky bottom primary CTA;
- source detail and filters open as bottom sheets;
- no simultaneous display of multiple navigation levels.

## 11. Complete state model

Every primary card and horizontal subsection supports:

- `EMPTY`: value, prerequisite and starting action;
- `DRAFT`: work started and saved safely;
- `INCOMPLETE`: named required information missing;
- `CONFLICT`: competing values/evidence and required decision;
- `STALE`: review date exceeded;
- `READY_FOR_REVIEW`: explicit minimums satisfied;
- `APPROVED`: named person accepted a defined version/scope;
- `PUBLISHED`: immutable version used downstream;
- `ERROR`: exact failed operation, preserved user work and retry.

Completeness is never synonymous with readiness. Readiness combines required
data, provenance, freshness, consistency and approval.

## 12. Concept acceptance criteria

1. A user can identify location, purpose, status and next action within ten
   seconds on every screen.
2. The module has exactly six vertical primary cards and at most one horizontal
   subsection level.
3. Every information item has one canonical edit location.
4. Every primary screen uses the same header, readiness model, save feedback,
   CTA placement and state language.
5. No empty screen is a large unexplained surface.
6. Small collections do not render as ultra-wide tables.
7. Raw keys and UUIDs are absent from the primary business view.
8. Every material fact has an owner/source/date/confidence or is explicitly
   marked as missing governance.
9. Every decision shows options, evidence, consequence, owner and deadline.
10. AI suggestions cannot look owner-approved without explicit acceptance.
11. Users can traverse recommendation → fact → claim → source and source → all
    dependent conclusions.
12. Readiness scores drill down to exact gaps and show downstream impact.
13. Critical unresolved conflicts block publication or require an authorized,
    recorded exception.
14. Desktop, tablet and mobile preserve hierarchy and primary actions without
    relying on horizontal scrolling.
15. The acceptance journey covers input → source upload → extraction → gap and
    conflict review → readiness → owner approval → publication → reopen/readback
    of the exact published version.

## 13. Remaining owner decisions

- Confirm the six primary Polish and English labels.
- Confirm whether Graph is embedded in Sources, available as a cross-cutting
  mode, or both as proposed.
- Confirm whether assistant preferences affect business readiness.
- Define the minimum dataset and readiness weights per organization/use case.
- Confirm approval and publication roles and authorized exception handling.
