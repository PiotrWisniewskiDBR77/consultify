# Partner Program content source audit — 2026-08-22

## Decision

`MORE_MATERIAL_EXISTS / CURRENT PAGE IS NOT THE COMPLETE CONTENT SET`

The current Partner Program overview is not the fullest or strongest partner
narrative available in the repository. A materially richer content system exists,
but it is fragmented across marketing, public recruitment, partner-portal,
academy, pricing and product-specification sources. It must not be attached or
published wholesale: the corpus mixes current UI copy, internal GTM guidance,
drafts, aspirational capabilities, unconfirmed commercial terms and fictional
example companies.

No repair observation has been opened by this audit. Piotr explicitly requested a
source decision first and a subsequent work-register entry after that decision.

## Piotr's diagnostic request (verbatim)

> Dobrze, słuchaj, niemalże jestem przekonany, że mieliśmy znacznie lepsze treści programu Partners. Poszukaj, proszę, czy to jest wszystko, co mamy. Jeśli to jest wszystko, będzie trzeba je rozwinąć, żeby było bardziej przekonywujące, bo obecne nie są przekonywujące. Wydaje mi się, że gdzieś znajdziesz jeszcze więcej materiałów i będzie można je podpiąć w całości.
>
> Rozstrzygnij ten temat. Jak go rozstrzykniesz, to wtedy zrobimy wpis, który będzie mówił to, co trzeba robić dalej.

## What the current surface contains

The screenshot and current source `src/views/partner/ProviderHomeView.tsx` show an
in-product Partner Program overview with ten intended sections:

1. hero and three calls to action;
2. four generic benefit cards;
3. beta success stories;
4. tier progression;
5. onboarding checklist;
6. commission calculator;
7. Academy preview;
8. partner-manager contact;
9. FAQ;
10. resource links.

The screenshot captures only the upper portion, so the visible page is richer below
the fold than the attachment alone suggests. Nevertheless, its leading proposition
is generic and does not explain which partner model is offered, how a partner makes
money in the first deal, what each party delivers, or how the first joint engagement
works.

## Richer sources found

| Source | Classification | Reusable value | Constraint |
|---|---|---|---|
| `docs/Marketing/partner-motion-playbook.md` | `INTERNAL_GTM_SSOT` | North star, six partner types, five cooperation models, fit/anti-fit, economics questions, first-deal playbook and stage journey | Adapt into public copy; do not copy internal qualification language wholesale |
| `docs/Marketing/personas/ecosystem/` and `personas-overview-ecosystem.md` | `INTERNAL_PERSONA_RESEARCH` | Role-specific pains, desired outcomes, objections, proof and preferred collaboration model | Claims still need evidence and commercial approval |
| `docs/Marketing/assets/partner/01`–`11` | `READY_TO_ADAPT_DRAFTS` | Eleven role-specific partner packs, including landing-page copy, pitches, hooks and CTAs | The directory README says terms and names must be completed by the business |
| `docs/Marketing/asset-gap-map.md` | `CONTENT_INVENTORY` | Confirms ready Markdown packs for consulting owner, software house, SI, boutique and financial institution | “Ready source” is not proof that a claim is approved for publication |
| `src/views/BecomePartnerView.tsx` | `PUBLIC_RECRUITMENT_SURFACE` | Stronger recruitment structure: benefits, tiers, requirements, joining flow and trust/value strip | Still inherits commercial tier claims that require contract confirmation |
| `src/views/partner/partnerPricingData.ts` | `APPLICATION_TIER_SSOT_WITH_OPEN_BUSINESS_GATE` | Central Bronze/Silver/Gold/Platinum schedule, features and requirements | Source comment explicitly says “confirm % with partner contract” |
| `src/config/partnerKnowledge.ts` | `CURRENT_NAVIGATION_MAP` | Seven concrete program, operations, FAQ and case-study documents | Existence of routes does not prove content quality or runtime availability |
| `docs/product/PARTNER_KNOWLEDGE_AND_CERTIFICATION_BUILD_PLAN_2026-04-11.md` | `PRODUCT_PLAN` | Academy, certification and knowledge architecture | Plan/target is not automatically a live capability |
| `docs/product/modules/partner/PARTNER_PORTAL_MODULE.md` and specification/work packets | `PRODUCT_SPEC_AND_SCOPE_HISTORY` | Detailed portal capability map and bounded delivery history | Must be reconciled with exact-SHA runtime before any “available now” claim |

## Material truth and publication blockers

### 1. The displayed success stories are not publishable as real references

Repository search found no independent customer evidence for “Nordic Digital
Solutions” or “TransformACE Consulting”. More importantly,
`docs/product/modules/partner/PARTNER_ILLUSTRATIONS_BRIEF.md` explicitly describes
them as **fictional companies**. Their logos, quotations and numerical results must
therefore be labelled as fictional examples or removed. They must not be presented
as real beta partners or social proof without a separate, traceable owner-approved
evidence package.

### 2. Commercial terms are not fully approved

`ProviderHomeView.tsx` centralizes payout threshold, payout day, cooling-off period,
response time and named partner-manager details under comments stating they could
not be confirmed at build time and require Piotr's confirmation before launch.
`partnerPricingData.ts` likewise requires commission percentages to be confirmed
against the partner contract. Centralization prevents drift but does not constitute
business approval.

### 3. Product plans cannot become present-tense promises without runtime proof

Academy, certification, resource library, client management, billing, commissions,
profile/directory and analytics are described across current code, plans and module
specifications. Each capability must be classified as `LIVE_VERIFIED`,
`LIVE_WITH_LIMITATIONS`, `PLANNED`, or `NOT_VERIFIED` against the exact candidate
runtime before the page promises it.

### 4. The richer GTM corpus must be adapted by audience

The motion playbook correctly differentiates consulting owners, individual
consultants, software houses, system integrators, boutique consultancies and
financial institutions. A single generic hero cannot credibly carry all six value
propositions. The content should provide role-aware entry paths while keeping one
canonical program contract.

## Recommended content architecture for the later repair entry

The later owner observation should require one canonical content matrix and a
role-aware page, not a bulk paste of repository text.

1. **Role selection:** “Which kind of partner are you?” with six supported partner
   types and a role-specific proposition.
2. **Concrete business value:** how the partner grows revenue, margin, delivery
   capacity or account scope; avoid generic “grow together” copy.
3. **Cooperation model:** referral, co-sell, white-label/powered-by, reseller or
   strategic joint pursuit, with responsibility split between partner and Consultify.
4. **First-deal journey:** qualify, align, enable, pursue, pilot and expand, including
   the expected proof of success in 30–60 days.
5. **What the partner receives:** only exact-SHA verified platform capabilities,
   Academy/certification, templates, deal support and program resources.
6. **Economics and tiers:** one contract-backed schedule, eligibility, payout logic,
   exclusions and owner-approved wording.
7. **Proof:** only real, consented and traceable case studies; otherwise clearly
   labelled illustrative scenarios with no invented logos, quotes or results.
8. **Joining path:** eligibility, application, review, onboarding, certification and
   first-deal readiness with a single authoritative CTA per state.
9. **FAQ and safeguards:** data, IP, brand ownership, end-client relationship,
   responsibilities, support and commercial/legal boundaries.

## Required content matrix before implementation

For every statement proposed for the final page, record:

- audience/partner type;
- journey stage;
- claim and benefit;
- source file;
- evidence owner;
- capability state on exact runtime;
- commercial/legal approval state;
- allowed wording;
- destination screen/CTA;
- status: `APPROVED`, `NEEDS_OWNER_DECISION`, `NEEDS_RUNTIME_PROOF`, or
  `PROHIBITED_UNVERIFIED`.

## Resolution summary

- **Is the current page everything available?** No.
- **Are there materially better materials?** Yes: a complete partner-motion
  playbook, persona system and eleven partner execution packs exist.
- **Can they be connected in full without review?** No. They contain internal,
  draft, planned and commercially unconfirmed material.
- **Is the current visible narrative persuasive enough?** The evidence and source
  comparison support Piotr's concern: it is generic relative to the available
  role-specific corpus.
- **What should happen next?** Open one explicit owner observation requiring a
  verified, role-aware Partner Program content redesign, including removal or clear
  relabelling of fictional testimonials and closure of commercial/runtime gates.

## Audit counters

- Diagnostic evidence: `1`
- Repair observations opened: `0`
- Major reusable source groups: `9`
- Partner-specific marketing source files: `11`
- Publication blockers: `4`
- Owner acceptance: `0`
