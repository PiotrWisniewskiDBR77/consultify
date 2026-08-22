# Partners — owner feedback register

Date opened: `2026-08-22`

Intake status: `OWNER_REVIEW_IN_PROGRESS / CAPTURED_UNRECONCILED`

## PAR-OWN-001 — Rebuild the Partner Program content from the complete verified corpus

- Module: `Partners`
- Screens/routes: `Partner Program / Program overview`; ambient route `/partner`,
  route and exact runtime `NOT VERIFIED`
- Category: `CX / UX / CONTENT / INFORMATION ARCHITECTURE / COMMERCIAL TRUST`
- Piotr's original wording (verbatim):

  > Dobrze, słuchaj, niemalże jestem przekonany, że mieliśmy znacznie lepsze treści programu Partners. Poszukaj, proszę, czy to jest wszystko, co mamy. Jeśli to jest wszystko, będzie trzeba je rozwinąć, żeby było bardziej przekonywujące, bo obecne nie są przekonywujące. Wydaje mi się, że gdzieś znajdziesz jeszcze więcej materiałów i będzie można je podpiąć w całości.
  >
  > Rozstrzygnij ten temat. Jak go rozstrzykniesz, to wtedy zrobimy wpis, który będzie mówił to, co trzeba robić dalej.

- Piotr's authorization to open the repair entry (verbatim):

  > Zatem wpisz do rejestru, co i jak ma być naprawione.

- Source-audit decision:
  `MORE_MATERIAL_EXISTS / CURRENT PAGE IS NOT THE COMPLETE CONTENT SET`.
- Current behavior:
  - the upper page uses a generic “Be Our Partner / Let's Grow Together” value
    proposition and four broad benefit cards;
  - the current source contains additional sections below the captured viewport,
    including tiers, onboarding, calculator, Academy, contact, FAQ and resources;
  - the page does not lead with the distinct needs, economics or first-deal journey
    of the six partner types already described in the repository;
  - materially richer partner content is fragmented across an internal motion
    playbook, six personas, eleven partner marketing packs, the public recruitment
    page, pricing/tier configuration, knowledge navigation and product plans;
  - visible “beta partner” stories use “Nordic Digital Solutions” and
    “TransformACE Consulting”; the illustration brief explicitly describes these
    as fictional companies, while repository search found no independent customer
    evidence for their quotations or numerical results;
  - commission percentages, payout logic, response time and partner contact data
    remain marked in source as requiring business/contract confirmation;
  - planned or specified Partner Portal and Academy capabilities have not been
    reconciled with the exact candidate runtime for purposes of marketing claims.
- Expected experience — owner requirement:
  - replace the generic overview with a substantially more persuasive program
    explanation built from the complete existing partner corpus;
  - present clearly what a partner can achieve, how cooperation works, what each
    party contributes, how the partner earns and how the first joint deal proceeds;
  - use the richer materials already available rather than treating the current
    screen as the complete source;
  - retain only truthful, verified and approved statements.
- Required repair — implementation-ready decomposition:
  1. build one canonical content matrix linking every proposed claim to its partner
     audience, journey stage, source, evidence owner, runtime state and
     commercial/legal approval state;
  2. introduce role-aware entry paths for `Consulting Owner`, `Individual
     Consultant`, `Software House`, `System Integrator`, `Boutique Consultancy`
     and `Financial Institution`;
  3. explain the supported cooperation models: `Referral`, `Co-sell`,
     `White-label / Powered-by`, `Reseller` and `Strategic / Joint pursuit`;
  4. show a concrete first-deal flow: `Qualify → Align → Enable → Pursuit → Pilot
     → Expand`, including ownership and proof of success;
  5. describe partner value in business terms—revenue, margin, delivery capacity,
     offer expansion and account access—using only substantiated claims;
  6. present platform access, Academy/certification, resources, deal support,
     directory and operational capabilities only after exact-SHA runtime
     classification as `LIVE_VERIFIED` or explicitly `LIVE_WITH_LIMITATIONS`;
  7. derive tiers, commission, eligibility, payout and SLA language from one
     contract-backed source approved by the business owner;
  8. replace fictional testimonials and invented numerical outcomes with real,
     consented evidence, or label them unambiguously as illustrative scenarios;
     fictional companies must not appear as actual beta partners;
  9. provide one authoritative CTA for each user state: learn/compare, apply,
     continue onboarding, open partner workspace or contact the approved owner;
  10. close with a concise FAQ covering client ownership, delivery responsibility,
      data, IP, branding, support, commercial boundaries and the joining process.
- Content hierarchy — `EXPERT_PROPOSED`, pending owner/integrator reconciliation:
  1. program promise and role selector;
  2. role-specific outcome and use cases;
  3. cooperation models and responsibility split;
  4. first-deal journey;
  5. verified tools, enablement and Academy;
  6. approved tiers and economics;
  7. verified proof/case studies;
  8. eligibility, onboarding and next action;
  9. FAQ, safeguards and resources.
- Prohibited implementation shortcuts:
  - do not bulk-copy internal GTM or anti-ICP language into customer-facing UI;
  - do not convert product plans/specifications into present-tense promises;
  - do not retain fictional logos, quotations or results as social proof;
  - do not publish TODO-marked commercial terms merely because they are
    centralized in code;
  - do not create divergent commission or tier values across overview, pricing,
    onboarding, calculator and FAQ.
- Impact: the current generic and partially unverified narrative weakens conversion,
  obscures the actual cooperation model and creates material reputational and
  commercial risk when fictional evidence or unapproved terms look real.
- Proposed importance: `CRITICAL / CONTENT TRUST / COMMERCIAL GATE`
- Evidence: `PAR-EVD-001`
- Diagnostic basis:
  [`PARTNER_CONTENT_SOURCE_AUDIT_2026-08-22.md`](PARTNER_CONTENT_SOURCE_AUDIT_2026-08-22.md)
- Requirements: `PAR-REQ-001` through `PAR-REQ-010`
- Acceptance criteria: `PAR-AC-001` through `PAR-AC-012`
- Open questions: `PAR-Q-001` through `PAR-Q-005`
- Status: `CAPTURED_UNRECONCILED`

## Atomic requirements

| ID | Requirement | Authority | Status |
|---|---|---|---|
| `PAR-REQ-001` | Use the complete existing partner corpus as the redesign input, with source classification and traceability. | `OWNER_EXPLICIT + AUDIT_CONFIRMED` | `CAPTURED_UNRECONCILED` |
| `PAR-REQ-002` | Make the proposition materially more persuasive and concrete than the current generic overview. | `OWNER_EXPLICIT` | `CAPTURED_UNRECONCILED` |
| `PAR-REQ-003` | Differentiate the six partner types and their value propositions. | `EXPERT_PROPOSED_FROM_EXISTING_SSOT` | `PROPOSED_UNRECONCILED` |
| `PAR-REQ-004` | Explain cooperation models, responsibility split and the first-deal journey. | `EXPERT_PROPOSED_FROM_EXISTING_SSOT` | `PROPOSED_UNRECONCILED` |
| `PAR-REQ-005` | Publish only exact-SHA verified current capabilities; distinguish limitations and planned functions. | `TRUST_CONTROL_DERIVED` | `PROPOSED_UNRECONCILED` |
| `PAR-REQ-006` | Use one business-approved contract source for all tiers and commercial terms. | `TRUST_CONTROL_DERIVED` | `PROPOSED_UNRECONCILED` |
| `PAR-REQ-007` | Remove or explicitly relabel fictional success stories; use real testimonials only with traceable evidence and consent. | `TRUST_CONTROL_DERIVED / AUDIT_CONFIRMED` | `PROPOSED_UNRECONCILED` |
| `PAR-REQ-008` | Provide state-aware, non-conflicting CTAs for acquisition, onboarding and established partners. | `EXPERT_PROPOSED` | `PROPOSED_UNRECONCILED` |
| `PAR-REQ-009` | Cover eligibility, onboarding, Academy/enablement, support and safeguards in a coherent journey. | `EXPERT_PROPOSED_FROM_EXISTING_CORPUS` | `PROPOSED_UNRECONCILED` |
| `PAR-REQ-010` | Preserve claim-level source, approval and evidence traceability in a canonical content matrix. | `TRUST_CONTROL_DERIVED` | `PROPOSED_UNRECONCILED` |

## Acceptance criteria

All criteria remain `NOT_TESTED`; implementation or smoke evidence does not imply
owner acceptance.

| ID | Acceptance criterion | Required evidence | Status |
|---|---|---|---|
| `PAR-AC-001` | Every visible claim maps to a content-matrix row containing audience, source, evidence owner, approval and runtime state. | Content matrix plus sampled UI-to-source trace | `NOT_TESTED` |
| `PAR-AC-002` | The overview offers clear paths for all six canonical partner types without duplicating contradictory program terms. | Desktop/mobile screenshots and navigation replay | `NOT_TESTED` |
| `PAR-AC-003` | Each partner path states target outcome, cooperation model, contribution split and first-deal next step. | Six-path content review | `NOT_TESTED` |
| `PAR-AC-004` | The first-deal journey displays all six stages and names the owner/output of each stage. | Journey screen evidence | `NOT_TESTED` |
| `PAR-AC-005` | Every present-tense capability claim is backed by exact-SHA runtime evidence or visibly marked with its limitation. | Candidate SHA, route replay and capability matrix | `NOT_TESTED` |
| `PAR-AC-006` | Tier, commission, payout, SLA and eligibility values are identical across all partner surfaces and linked to an explicit owner-approved decision. | Cross-surface comparison and decision ID | `NOT_TESTED` |
| `PAR-AC-007` | No fictional company, logo, quotation or result is presented as real customer evidence. | Content search plus rendered-page review | `NOT_TESTED` |
| `PAR-AC-008` | Any real testimonial includes evidence owner, consent/publication authority and source artifact. | Testimonial evidence register | `NOT_TESTED` |
| `PAR-AC-009` | Acquisition, applicant/onboarding and established-partner states each expose one primary CTA that reaches the intended destination. | State fixtures and destination replay | `NOT_TESTED` |
| `PAR-AC-010` | Internal GTM, anti-ICP and confidential commercial language is absent from public UI unless explicitly approved. | Source classification review | `NOT_TESTED` |
| `PAR-AC-011` | FAQ answers cover client ownership, delivery responsibility, data, IP, branding, support, commercial terms and joining process without contradicting the contract SSOT. | FAQ review against approved decisions | `NOT_TESTED` |
| `PAR-AC-012` | Piotr reviews the completed exact-SHA surface and provides an explicit outcome. | Owner result linked to exact SHA/runtime | `NOT_TESTED / OWNER_GATE_REQUIRED` |

## Open questions and decision gates

### PAR-Q-001 — Final commercial schedule

- Question: What contract-approved commission, tier, payout, cooling-off, SLA and
  eligibility values may be published?
- Decision owner: Piotr / commercial owner / integrator
- Status: `OPEN_UNRECONCILED`

### PAR-Q-002 — Publishable references

- Question: Which real partner cases, quotations, logos and numerical results have
  explicit evidence and publication consent?
- Decision owner: Piotr / partner owner
- Status: `OPEN_UNRECONCILED`

### PAR-Q-003 — Live capability boundary

- Question: Which Partner Portal, Academy, certification, billing, commission,
  directory, resource and analytics capabilities are live on the target candidate,
  and which must be labelled limited or planned?
- Decision owner: integrator / product owner
- Status: `OPEN_UNRECONCILED`

### PAR-Q-004 — Primary audience and landing behavior

- Question: Should `/partner` be an acquisition surface for prospects, an
  orientation surface for accepted partners, or a state-aware router serving both?
- Decision owner: Piotr / product owner
- Status: `OPEN_UNRECONCILED`

### PAR-Q-005 — Final information hierarchy

- Question: Does Piotr accept the proposed nine-part role-aware hierarchy, or should
  role selection lead to separate partner-type pages?
- Decision owner: Piotr / integrator
- Status: `OPEN_UNRECONCILED`

## Counters

- Observations: `1`
- Atomic requirements: `10` (`2 OWNER_EXPLICIT`, `8 PROPOSED/DERIVED`)
- Acceptance criteria: `12 NOT_TESTED`
- Evidence items: `1`
- Open questions: `5`
- Fixed: `0`
- Accepted: `0`
