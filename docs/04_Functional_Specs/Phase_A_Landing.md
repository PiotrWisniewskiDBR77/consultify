# Phase A – Landing Page Functional Specification

## 1. Purpose of Phase A

- **What Phase A is**: The entry gateway to the Consultinity ecosystem that provides a concise, 90‑second overview of the product, establishes the correct mental model, and routes users to the appropriate next step.
- **What Phase A is not**: It is **not** a marketing brochure, pricing page, or feature catalog. It does not collect payment information or perform authentication.
- **Business Goal**: Quickly convey the essence of Consultinity, set expectations, and guide the visitor toward a Demo, a Trial, or Direct Consulting contact, thereby maximizing conversion into deeper phases.

## 2. Core Positioning

> **Positioning Statement**: *“Consultinity is the first open consulting ecosystem that teaches leaders to think like Harvard and act in real business — with AI as a partner, not an authority.”*

## 3. Target Audiences

| Audience | Expectations / Mindset |
|----------|------------------------|
| **Executives** | Want a high‑level value proposition, quick ROI insight, and a clear path to decision making. |
| **Teams** | Seek collaborative evaluation, hands‑on trial experience, and evidence of team‑wide benefits. |
| **Consultants** | Look for partnership opportunities, referral incentives, and a platform to extend their advisory services. |

## 4. User Entry Paths (Critical Section)

| CTA | Eligibility | Next Phase | Data Handling Rules |
|-----|--------------|------------|----------------------|
| **Explore Demo** | Open to all visitors | Phase B – Demo onboarding | No personal data collected; only anonymous analytics cookie for navigation tracking. |
| **Start Trial** | May provide a referral or invitation code (optional). If a code is supplied it must exist in the `referrals` table. | Phase C – Trial activation | Collect optional email, referral/invitation code, and consent flag. Validation of code existence occurs here; deeper eligibility checks deferred to trial flow. |
| **Talk to Consulting** | Any visitor, especially enterprises or consultants | Phase D – Direct Consulting contact workflow | Capture name, email, company, and optional referral/invitation token. Data stored securely and used solely for outreach. |

### Eligibility Details
- **Explore Demo**: No pre‑conditions.
- **Start Trial**: Referral code must be syntactically valid and present in the system; otherwise the user may proceed without a code.
- **Talk to Consulting**: No restrictions; URL parameters may pre‑populate fields for invited consultants.

## 5. Referral & Invitation Logic (High Level)

- **Referral Code Entry**: Users may type a code on the landing page. The system checks the `referrals` table for existence, activity, and expiry. Only existence is validated at this stage; quota or organization checks happen later in the trial flow.
- **Consultant Invitation Entry**: A token supplied via `?invite=TOKEN` is verified against the `consultant_invitations` table. If valid, the landing page pre‑selects the “Talk to Consulting” CTA and pre‑fills the invitation field.
- **Team Invitation Entry**: Similar to consultant invites but uses the `team_invitations` table and may direct the user to the “Start Trial” CTA.
- **Validation Boundaries**: Phase A validates **format** and **existence** only. Full business‑rule validation (quota, role, expiration) is performed in subsequent phases.

## 6. UX & Interaction Principles

- **Minimal Friction**: Only three primary CTA buttons/links are visible. No secondary navigation, feature lists, or pricing tables.
- **No Feature Listing**: The page contains a short video or animation summarizing the product within 90 seconds.
- **No SaaS‑style Funnels**: Users are not forced through multi‑step sign‑ups before choosing a path.
- **Login Timing**: Authentication is triggered **only after** a CTA is selected, redirecting to the appropriate auth flow for the chosen path.
- **Responsive Design**: Works on desktop, tablet, and mobile with a single‑column layout.

## 7. Relationship to Other Phases

- **Hand‑off to Phase B (Demo)**: After selecting **Explore Demo**, the user is taken to the Demo onboarding flow defined in `Phase_B_Demo.md`.
- **Hand‑off to Phase C (Trial)**: After selecting **Start Trial**, the user proceeds to the Trial activation flow defined in `Phase_C_Trial.md`.
- **Hand‑off to Phase D (Consulting)**: After selecting **Talk to Consulting**, the user enters the consulting contact workflow defined in `Phase_D_Consulting.md`.
- **Explicit Non‑Overlap**: Phase A never collects payment, subscription, or detailed feature information; those belong to later phases.

---

**Definition of Done**
- `docs/04_Functional_Specs/Phase_A_Landing.md` exists with the full content above.
- No TODOs or placeholders remain.
- README and Product Lifecycle documentation reference this spec.

---

**Validation Tests**
- A developer can implement the landing page UI using only the information in this document.
- The three entry paths are clearly defined, unambiguous, and include data handling rules.
- No SaaS‑style funnel language appears.
