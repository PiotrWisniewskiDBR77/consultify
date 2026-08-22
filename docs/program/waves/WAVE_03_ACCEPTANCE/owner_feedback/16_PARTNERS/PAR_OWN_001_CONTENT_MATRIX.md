# PAR-OWN-001 — canonical claim and publication matrix

UI candidate: `6cfdf6f1e5`

Status: `IMPLEMENTED_FOR_OWNER_REVIEW / COMMERCIAL_DECISION_OPEN / OWNER_ACCEPTANCE_REQUIRED`

## Publication rules

- `PUBLISH_QUALITATIVE` permits the exact bounded wording represented in the UI.
- `LIVE_WITH_LIMITATIONS` permits only the stated route or read seam and its visible limitation.
- `AGREEMENT_REQUIRED` means no number, entitlement or service promise may be shown.
- `NO_PUBLISHABLE_EVIDENCE` means no logo, quote, company or result may render as proof.
- Internal anti-ICP, economics and pursuit strategy remain non-public.

## Claim matrix

| ID | Visible claim / UI family | Audience | Stage | Source | Evidence owner | Runtime state | Commercial/legal state | Allowed wording | CTA/destination | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `PAR-CLM-001` | Six partner paths exist as a program taxonomy | All | Orientation | `docs/Marketing/partner-motion-playbook.md` §2 + ecosystem personas | Partner Program Owner | `CONTENT_ONLY` | `NON_NUMERIC` | “Choose the partner path that matches your business” | In-page role selector | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-002` | Consulting Owner outcome, contributions and first step | Consulting Owner | Qualify | motion playbook + consulting-owner persona/pack | Partner Program Owner | `CONTENT_ONLY` | `NON_NUMERIC` | Designed to explore a repeatable offer; no margin/revenue guarantee | Role tab | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-003` | Individual Consultant outcome, contributions and first step | Individual Consultant | Qualify | motion playbook + consultant persona/pack | Partner Program Owner | `CONTENT_ONLY` | `NON_NUMERIC` | Structured offer and qualified introduction; no earnings promise | Role tab | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-004` | Software House outcome, contributions and first step | Software House | Qualify | motion playbook + software-house persona/pack | Partner Program Owner | `CONTENT_ONLY` | `NON_NUMERIC` | Explore broader advisory scope; no upsell or revenue guarantee | Role tab | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-005` | System Integrator outcome, contributions and first step | System Integrator | Qualify | motion playbook + SI persona/pack | Partner Program Owner | `CONTENT_ONLY` | `NON_NUMERIC` | Joint pursuit hypothesis; no deal-size promise | Role tab | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-006` | Boutique Consultancy outcome, contributions and first step | Boutique Consultancy | Qualify | motion playbook + boutique persona/pack | Partner Program Owner | `CONTENT_ONLY` | `NON_NUMERIC` | Repeatable output hypothesis; no top-tier equivalence claim | Role tab | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-007` | Financial Institution outcome, contributions and first step | Financial Institution | Qualify | motion playbook + FI persona/pack | Partner Program Owner | `CONTENT_ONLY` | `COMPLIANCE_REVIEW_REQUIRED` | Explore selected-client support subject to compliance | Role tab | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-008` | Referral responsibility split | Relevant partner path | Align | motion playbook §4 | Partner Program Owner | `CONTENT_ONLY` | `AGREEMENT_REQUIRED` | Qualified introduction; recognition and ownership follow agreement | Model card | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-009` | Co-sell responsibility split | Relevant partner path | Align | motion playbook §4 | Partner Program Owner | `CONTENT_ONLY` | `AGREEMENT_REQUIRED` | Joint conversation with roles aligned before pursuit | Model card | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-010` | White-label / Powered-by responsibility split | Relevant partner path | Align | motion playbook §4 | Partner Program Owner | `CONTENT_ONLY` | `IP_BRAND_AGREEMENT_REQUIRED` | Availability and brand/IP/data rights require written terms | Model card | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-011` | Reseller responsibility split | Relevant partner path | Align | motion playbook §4 | Partner Program Owner | `CONTENT_ONLY` | `AGREEMENT_REQUIRED` | Possible model; availability and economics follow agreement | Model card | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-012` | Strategic / Joint pursuit responsibility split | SI / FI / selected | Align | motion playbook §4 | Partner Program Owner | `CONTENT_ONLY` | `OPPORTUNITY_GOVERNANCE_REQUIRED` | Governance and responsibilities decided per opportunity | Model card | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-013` | Qualify stage owner/output/proof | All | Qualify | motion playbook §6 | Partner Program Owner | `CONTENT_ONLY` | `NON_NUMERIC` | Continue only after both sides confirm fit | Journey card | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-014` | Align stage owner/output/proof | All | Align | motion playbook §6 | Partner Program Owner | `CONTENT_ONLY` | `NON_NUMERIC` | One-page responsibility and success definition | Journey card | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-015` | Enable stage owner/output/proof | All | Enable | motion playbook §6/§8 | Partner Program Owner | `CONTENT_ONLY` | `APPROVED_ASSETS_ONLY` | Only approved narrative and working materials | Journey card | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-016` | Pursuit stage owner/output/proof | All | Pursuit | motion playbook §6 | Partner Program Owner | `CONTENT_ONLY` | `ACCOUNT_GOVERNANCE_REQUIRED` | Coordinated client conversation; no win promise | Journey card | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-017` | Pilot stage owner/output/proof | All | Pilot | motion playbook §6 | Partner Program Owner | `CONTENT_ONLY` | `SCOPE_AGREEMENT_REQUIRED` | Bounded scope and its own acceptance conditions | Journey card | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-018` | Expand stage owner/output/proof | All | Expand | motion playbook §6 | Partner Program Owner | `CONTENT_ONLY` | `EVIDENCE_REQUIRED` | Stop/repeat/expand only after evidence review | Journey card | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-019` | Documentation is an available entry point | All | Enable | `src/config/partnerKnowledge.ts` | Product Owner | `LIVE_WITH_LIMITATIONS` | `NON_COMMERCIAL` | Open canonical partner overview documentation | `/docs/consultify-partner-program/partner-program-overview` | `PUBLISH_WITH_LIMITATION` |
| `PAR-CLM-020` | Academy may be available after activation | Activated partners | Enable | Academy build plan + current partner routes | Product Owner | `ACCESS_DEPENDENT / NOT_MARKETED_AS_LIVE` | `NO_ENTITLEMENT_PROMISE` | “may be available”; verify in workspace | No acquisition CTA | `PUBLISH_WITH_LIMITATION` |
| `PAR-CLM-021` | Deal/operational support depends on agreement | Qualified partners | Pursuit | motion playbook + open PAR-Q-003 | Partner Program Owner | `NOT_VERIFIED` | `AGREEMENT_REQUIRED` | No SLA or named owner | Approved generic contact route | `PUBLISH_WITH_LIMITATION` |
| `PAR-CLM-022` | Economics unavailable in this workspace | All | Decision | `AMD-PRT-ECONOMICS-002`, PRT policy evidence | Commercial Owner | `APPROVED_OUT / READ_ONLY` | `PAR-Q-001 OPEN` | No tiers, rates, thresholds, payout or SLA values | None | `PUBLISH_BOUNDARY` |
| `PAR-CLM-023` | No approved public testimonial exists | All | Proof | source audit + illustrations brief | Partner Program Owner | `NO_PUBLISHABLE_EVIDENCE` | `PAR-Q-002 OPEN` | No company, logo, quote or result | None | `PUBLISH_BOUNDARY` |
| `PAR-CLM-024` | State-aware application/onboarding/workspace CTA | Prospect / onboarding / active | Join | V8 onboarding status + PartnerStartRouter | Product Owner | `LIVE_WITH_LIMITATIONS` | `NO_COMMERCIAL_IMPLICATION` | Start/continue/open only after status read; error = Retry | public apply / onboarding / dashboard | `PUBLISH_WITH_RUNTIME_STATE` |
| `PAR-CLM-025` | FAQ client ownership and delivery boundaries | All | Align | motion playbook + owner register | Legal / Partner Program Owner | `CONTENT_ONLY` | `AGREEMENT_AUTHORITATIVE` | Responsibility is explicit, never implied | FAQ | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-026` | FAQ data, confidentiality, IP and branding boundaries | All | Align | program audit + legal baseline | Legal / Security Owner | `CONTENT_ONLY` | `WRITTEN_TERMS_REQUIRED` | Access is not granted by program membership alone | FAQ | `PUBLISH_QUALITATIVE` |
| `PAR-CLM-027` | FAQ support, economics and joining boundaries | All | Join | owner register PAR-Q-001–004 | Partner Program Owner | `CONTENT_ONLY` | `AGREEMENT_REQUIRED` | No service, compensation or timing promise | FAQ / application | `PUBLISH_WITH_LIMITATION` |

## Explicitly prohibited on candidate `6cfdf6f1e5`

- fictional companies, logos, quotations, “partner since” dates and results;
- commission percentages, payout threshold/day, cooling-off period and response-time SLA;
- named partner-manager identity or personal contact data;
- Academy, certification, directory, billing, analytics, commissions or payout operations described as universally available;
- internal anti-ICP, confidential economics or unapproved pursuit language;
- calculator output derived from draft configuration.

## Open owner gates retained

`PAR-Q-001` through `PAR-Q-005` remain open. The candidate resolves them only
through fail-closed wording and reversible navigation; it does not fabricate an
owner decision. Explicit owner acceptance remains `PAR-AC-012`.
