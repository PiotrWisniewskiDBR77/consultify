# Landing V8 SSOT

> **Status:** Canonical (minimal viable)
> **Owner:** Product
> **Created:** 2026-03-23
> **Origin:** WP-W7-ROOF-03 gap analysis — Landing identified as weakest branch in V8 canon
> **Authority:** Decision W7-11 (demo/trial V8 refresh), SYSTEMATYKA_PRZEGLADU_V8.md §5 item #1

---

## 1. Purpose and scope

This document defines the canonical V8 landing experience for Consultify: the public-facing page structure, first-run onboarding flow, and demo/trial alignment with V8 product narrative.

**What this doc covers:**

- Landing page information architecture and section hierarchy
- Messaging anchored to `BUSINESS_POSITIONING_SSOT.md`
- First-run flow from visitor → demo → trial → paying user
- Demo/trial V8 narrative alignment (Decision W7-11)
- LP assistant contract reference
- Gap summary and hardening priorities

**What this doc does NOT cover:**

- Visual/asset production (deferred to a Landing Content Spec)
- Expert showcase catalog (deferred; depends on this SSOT)
- Full marketing copy (this defines the messaging framework, not final copy)
- Implementation-level frontend code

---

## 2. V8 landing experience structure

### 2.1 Page information architecture

The landing page follows a single-page scroll with a fixed topbar. Sections are ordered by the value-proof funnel: hook → explain → prove → convert.

| # | Section | Purpose | Messaging anchor |
|---|---------|---------|------------------|
| 1 | **Hero** | Hook: one-sentence value proposition | "Consultify democratizes consulting intelligence" |
| 2 | **Problem** | Why this matters: consulting knowledge is locked away | §2 of BUSINESS_POSITIONING_SSOT |
| 3 | **Platform pattern** | How access platforms win | §3 of BUSINESS_POSITIONING_SSOT |
| 4 | **What Consultify does** | Product statement | "Consulting Intelligence Platform" — §4–5 |
| 5 | **Value layers** | Five layers: Inspiration → Knowledge → Frameworks → Guidance → Execution | §6 of BUSINESS_POSITIONING_SSOT |
| 6 | **Consulting journey** | Full journey: Understanding → Diagnosis → Design → Execution → Results | §7 of BUSINESS_POSITIONING_SSOT |
| 7 | **Extended scope** | Financial Intelligence, Reports & Presentations, My Work | §8 of BUSINESS_POSITIONING_SSOT |
| 8 | **Social proof / trust** | Testimonials, metrics, partner logos (when available) | — |
| 9 | **CTA block** | Demo / Trial / Contact | Conversion entry points |
| 10 | **Footer** | Legal, links, language selector | — |

### 2.2 Topbar

Fixed topbar with:

- Logo (left)
- Navigation links: Product, Pricing, Partners, Help
- Language selector (PL, EN + future locales)
- "Demo" button (secondary)
- "Start Trial" button (primary CTA)

### 2.3 Messaging hierarchy

All landing messaging must derive from `BUSINESS_POSITIONING_SSOT.md`. The canonical strategic phrases are:

- **Category:** Consulting Intelligence Platform
- **Analogy:** Spotify for consulting knowledge
- **Promise:** Democratization of consulting intelligence
- **Differentiator:** Structured consulting workflow, not just AI answers

Landing copy must never reduce Consultify to "just an AI assistant", "just a dashboard", "just a PM tool", or "just a knowledge base" (per §12 of BUSINESS_POSITIONING_SSOT).

### 2.4 CTA architecture

Two primary conversion paths from landing:

| CTA | Target | Placement |
|-----|--------|-----------|
| **"Try Demo"** | Demo flow (login gate → language → Atelier ToolToys) | Topbar, Hero, mid-page |
| **"Start Trial"** | Trial creation (org setup → 7-day trial) | Topbar, Hero, CTA block, post-demo |

Rule: every screen-height of scroll should have at least one visible CTA or path to conversion.

---

## 3. First-run and onboarding flow

### 3.1 Visitor → Demo path

```
Landing page
  → Click "Demo"
  → Login gate (Google minimum)
  → Language selection (6 locales: PL, EN, DE, ES, JA, AR)
  → "Start Demo"
  → Switch to DEMO org (Atelier ToolToys)
  → Demo banner visible: "Demo Mode • Atelier ToolToys • AI: X/10 • [Start Trial]"
  → Explore pre-seeded data (read-only)
```

Demo mechanics are defined in `DEMO_TRIAL_V3.md` §1–4 and `DEMO_TRIAL_ENTERPRISE_PLAN.md` §1. The V8 layer adds narrative framing (§4 below), not mechanical changes.

### 3.2 Demo → Trial conversion

Strategic CTA moments during demo (after user sees value):

1. After viewing a report or presentation
2. After exploring an initiative with full lifecycle data
3. After interacting with Teresa (AI assistant) and hitting demo AI limit
4. After viewing Results/KPI dashboard

Conversion flow:

```
Click "Start Trial" (from demo banner or strategic CTA)
  → Create organization (name, language, role)
  → 7-day trial begins
  → Onboarding wizard starts
```

### 3.3 First-run onboarding (post-signup)

After trial creation, the user enters the first-run onboarding sequence:

| Step | What happens | First-value target |
|------|-------------|-------------------|
| 1. Org setup | Name, language, sector, size | Context captured |
| 2. Teresa introduction | AI assistant introduces itself, explains capabilities | User meets the guide |
| 3. Interview prompt | Teresa offers a quick business context interview (3–5 questions) | Org context seeded |
| 4. First workspace tour | Guided walkthrough of key modules (Chat, Initiatives, Tools) | User oriented |
| 5. First action | Suggested action: create a note, start an interview, or explore a tool | First value moment |

Rule: the gap between "user signs up" and "user gets first value" must be under 5 minutes. The onboarding must not require completing all steps — each step delivers incremental value.

### 3.4 Trial lifecycle

- **Duration:** 7 days (per `DEMO_TRIAL_V3.md` §1.2)
- **Reminders:** T-7 (start), T-3 (warning), T-1 (urgent), T-0 (expired/read-only)
- **Post-expiry:** Read-only + upgrade CTA
- **Limits:** As defined in `DEMO_TRIAL_ENTERPRISE_PLAN.md` §2.2

---

## 4. Demo/trial alignment (Decision W7-11)

> **Decision W7-11:** Demo/trial should be refreshed to V8 narrative as part of Landing V8. Do not leave demo/trial at V3 if Landing moves to V8. Can be a scoped Wave 7 refresh; not a blocker for earlier platform/runtime waves. Rule: `commercial narrative surfaces should converge together`.

### 4.1 What stays from V3

The V3 demo/trial mechanics are sound and partially implemented:

- Login gate + language selection + demo toggle API
- Atelier ToolToys dataset with 6-locale support
- AI limits + degraded mode + CTA to trial
- Trial 7-day lifecycle with reminders
- Telemetry events (demo_started, trial_started, trial_converted_to_paid)
- Write protection and enterprise hardening

These mechanics do not need rewriting for V8.

### 4.2 What V8 adds

| Area | V3 state | V8 target |
|------|----------|-----------|
| **Hero messaging** | Generic "consulting platform" | V8 canonical: "Consulting Intelligence Platform" + "Spotify for consulting knowledge" |
| **Demo banner copy** | "Demo Mode" | "Explore Consultify — Atelier ToolToys demo" with V8 value framing |
| **CTA copy** | "Start Trial" | "Start your consulting intelligence journey" or similar V8-aligned copy |
| **Demo strategic moments** | Basic AI limit CTA | Value-proof CTAs after report view, initiative exploration, Teresa interaction |
| **Trial onboarding** | Minimal org creation | First-run wizard with Teresa introduction and context interview |
| **Value proof in demo** | Data exploration only | Guided demo path highlighting five value layers |

### 4.3 Convergence rule

All commercial narrative surfaces (landing page, demo banners, trial onboarding, conversion CTAs, email sequences) must use V8 messaging vocabulary from `BUSINESS_POSITIONING_SSOT.md`. No surface may use pre-V8 positioning language after Landing V8 ships.

---

## 5. LP assistant contract reference

The landing page AI assistant (Anna) is governed by `ANNA_LP_ASSISTANT_CONTRACT_V8.md`.

**Current state:** The file is missing from the repository (confirmed by WP-W7-ROOF-03 §8.1). Decision W7-9 mandates recreation.

**Scope of Anna on landing:**

- Public-facing assistant available to unauthenticated visitors
- Answers questions about Consultify, pricing, capabilities
- Guides visitors toward Demo or Trial
- Persona: knowledgeable, helpful, not pushy
- Knowledge boundary: public product information only; no tenant data access
- Session: stateless or short-lived; no cross-session memory
- Handoff: when user enters app (demo or trial), Anna hands off to Teresa (tenant-bound assistant)

**Dependency:** Full Anna LP embedding depends on `ANNA_LP_ASSISTANT_CONTRACT_V8.md` being restored (Decision W7-9). This SSOT defines placement and purpose; the contract defines persona, voice, and technical boundaries.

---

## 6. Gap summary and hardening priorities

Source: WP-W7-ROOF-03 §1.3, updated with this SSOT's coverage.

| Gap | Severity | Status after this SSOT |
|-----|----------|----------------------|
| No Landing V8 SSOT | Critical | **Closed** — this document |
| No page messaging system | High | **Partially closed** — messaging hierarchy defined (§2.3); full copy framework deferred to Landing Content Spec |
| No expert showcase model | High | **Open** — depends on this SSOT; can now be authored |
| No visual/asset plan | High | **Open** — depends on this SSOT; can now be authored |
| Anna LP integration incomplete | Medium | **Partially closed** — placement defined (§5); blocked on ANNA_LP_ASSISTANT_CONTRACT_V8.md restoration (Decision W7-9) |
| Demo/trial V8 narrative alignment | Medium | **Closed** — V8 overlay defined (§4) |
| First-run onboarding spec | Medium | **Closed** — first-run flow defined (§3.3) |
| No onboarding journey spec | Medium | **Closed** — full visitor→demo→trial→onboarding path defined (§3) |

### Hardening priorities (post-SSOT)

| Priority | Deliverable | Depends on |
|----------|-------------|------------|
| P1 | `ANNA_LP_ASSISTANT_CONTRACT_V8.md` restoration | Decision W7-9 |
| P1 | Landing Content Spec (section-by-section copy framework) | This SSOT |
| P2 | Expert showcase model (personas, credentials, use-case mapping) | This SSOT |
| P2 | Visual/asset plan (aligned with DBR77 visual language) | This SSOT + Landing Content Spec |
| P3 | Landing implementation (frontend) | All above |

---

## 7. Related documents

| Document | Relationship |
|----------|-------------|
| `BUSINESS_POSITIONING_SSOT.md` | Canonical business narrative — all landing messaging derives from this |
| `DEMO_TRIAL_V3.md` | Demo/trial mechanics SSOT — V3 mechanics remain valid; V8 adds narrative layer |
| `DEMO_TRIAL_ENTERPRISE_PLAN.md` | Enterprise-ready implementation plan for demo/trial |
| `ANNA_LP_ASSISTANT_CONTRACT_V8.md` | LP assistant contract (missing — Decision W7-9 mandates restoration) |
| `TERESA_ASSISTANT_CONTRACT_V8.md` | In-app assistant contract — Anna hands off to Teresa post-login |
| `WP-W7-ROOF-03_LANDING_SUPERADMIN.md` | Gap analysis that identified Landing as weakest branch |
| `DECISION_LOG_WAVE_7.md` | Decisions W7-9 (Anna), W7-11 (demo/trial V8 refresh) |
| `SYSTEMATYKA_PRZEGLADU_V8.md` | V8 coverage assessment — Landing classified as `Czesciowe pokrycie` → `Brak pakietu` |
| `V8_IMPLEMENTATION_MASTER_PROGRAM.md` | Master program — Landing in Wave 7, Track F |
| `DOCUMENTATION_REGISTRY.md` | Registry of all canonical docs |
