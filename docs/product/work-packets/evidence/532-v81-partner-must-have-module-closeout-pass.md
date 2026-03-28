# 532 - V8.1 Partner Program must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Program partnerski` must-have closure

## Problem before closeout

- Partner navigation had split truth between `AppView`, old `/partner/<path>` routes, and the real governed `PartnerPortalView` which actually uses `?tab=...`.
- Legacy partner entry paths like `/partner/resources` and `/partner/directory` could silently land users in the wrong place or default dashboard state.
- The main partner portal sidebar showed fake local badge values (`12` active clients, `2` pending certifications), which overstated runtime truth.
- Public and in-app partner entry surfaces (`BecomePartnerView`, `ProviderHomeView`, `PartnerPricingView`) did not point to a single honest next step. Some CTAs still routed to generic registration or implied support flows not governed by runtime.
- Partner-facing copy still contained stale launch framing (`Q1 2026`) even though the current state is a controlled rollout, not a future launch teaser.
- `DirectoryView` and `ResourcesView` existed as static pseudo-surfaces with fake/demo-like content (`Consultify Partners Group`, `Explore →`) instead of behaving as canonical partner entry shims.

## What landed

### 1. Route / AppView / portal tab coherence

- `src/views/partner/PartnerPortalView.tsx`
  - now recognizes legacy partner path entries and maps them to governed partner tabs:
    - `/partner/dashboard` -> `dashboard`
    - `/partner/clients` -> `client-access`
    - `/partner/commission` -> `earnings`
    - `/partner/directory` -> `public-listing`
    - `/partner/resources` -> `documentation`
  - now canonicalizes those legacy entries back to `/partner?tab=...`
  - now validates `tab` against real `PartnerSection` values instead of trusting arbitrary URL search input

### 2. Honest sidebar truth

- `src/views/partner/PartnerPortalView.tsx`
  - removed the hardcoded partner sidebar badge counts:
    - `activeClients={12}`
    - `pendingCertifications={2}`
  - the sidebar now shows no badge unless governed runtime actually supplies data

### 3. Entry CTA authority

- `src/views/BecomePartnerView.tsx`
  - primary application CTA now routes to `ROUTES.PARTNER.ONBOARDING`
  - no longer sends the user to generic `REGISTER`
  - public access CTA is now explicit: `Mam już konto partnera`
  - hero wording was normalized so the top-level entry no longer mixes PL/EN in the main proposition

- `src/views/partner/ProviderHomeView.tsx`
  - hero CTA now opens real partner onboarding
  - secondary hero CTA now opens governed partner docs (`/partner?tab=documentation`)
  - stale launch promise was replaced with an honest controlled-rollout message

- `src/views/partner/PartnerPricingView.tsx`
  - top CTA now opens partner onboarding
  - pricing CTAs route to onboarding or governed docs instead of vague/legacy partner destinations
  - bottom CTA section no longer implies unsupported “Talk to PDM” behavior when the real action is docs access

### 4. Duplicate/dead partner surfaces neutralized

- `src/views/partner/DirectoryView.tsx`
  - converted from static fake profile content into a redirect shim
  - now redirects to canonical partner listing tab:
    - `/partner?tab=public-listing`

- `src/views/partner/ResourcesView.tsx`
  - converted from static fake cards/buttons into a redirect shim
  - now redirects to canonical partner documentation tab:
    - `/partner?tab=documentation`

This removes the most misleading “second portal” surfaces without taking risky destructive action.

## Automated verification

Passed:

- `npx vitest run tests/components/partner/DirectoryView.redirect.test.tsx tests/components/partner/ResourcesView.redirect.test.tsx tests/components/partner/PartnerPricingView.cta-authority.test.tsx tests/components/partner/ProviderHomeView.cta-authority.test.tsx tests/components/partner/PartnerPortalView.route-alignment.test.tsx tests/components/BecomePartnerView.marketing-shell.test.tsx tests/unit/routes/routeConfig.test.ts`

Coverage includes:

- deprecated directory surface redirects to canonical public-listing tab
- deprecated resources surface redirects to canonical documentation tab
- public partner entry routes the main CTA to partner onboarding
- provider home hero CTAs point only to governed onboarding/docs actions
- pricing entry CTAs point only to governed onboarding/docs actions
- legacy partner paths canonicalize into the correct governed portal tab
- route helpers still resolve legacy partner paths to the correct partner `AppView`

## Manual acceptance checklist

- Open `/become-partner` and confirm:
  - primary CTA opens partner onboarding
  - secondary CTA for existing partners opens canonical `/partner`
- Open `/partner/resources` directly and confirm it ends at `/partner?tab=documentation`
- Open `/partner/directory` directly and confirm it ends at `/partner?tab=public-listing`
- Open partner pricing and confirm CTA buttons route to:
  - onboarding
  - governed docs/resources
- Open the main partner portal and confirm sidebar badges are not showing fake counts
- Confirm no partner-facing launch banner still claims “launch coming Q1 2026”

## Residual risk

- `PartnerDashboardView`, `CommissionView`, and some other legacy partner surfaces still exist in the repo as older component surfaces; this packet focused first on canonical routing and duplicate static entry points rather than full code deletion.
- `ProviderHomeView` tests still emit existing `act(...)` warning noise from `OnboardingChecklistSection`; tests pass, but that noise should be cleaned later.
- `BecomePartnerView` tests still emit existing `act(...)` warning noise through `AnnaAssistantWidget`; tests pass, but the warning remains pre-existing background noise.
- Some product-level decisions remain outside this bounded closure:
  - exact future partner application contract
  - deeper academy/runtime parity
  - broader partner pipeline / inquiry routing beyond the currently governed runtime

## Status

- `Program partnerski` now has one much clearer authority chain:
  - legacy partner entries -> canonical portal tab
  - public entry -> partner onboarding
  - pricing/home entry -> onboarding or governed docs
  - deprecated duplicate directory/resources surfaces -> redirect shims
- Current closure status: code landed, focused tests green, manual acceptance still required.
