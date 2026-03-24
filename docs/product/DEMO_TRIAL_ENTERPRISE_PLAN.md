# Demo & Trial — Enterprise-Ready Implementation Plan

> **Status:** Implementation Plan (v1.0)  
> **Date:** 2026-03-05  
> **Scope:** Demo (Atelier ToolToys) + Trial (7 days) — comprehensive, SAS enterprise-ready, DBR77 tech-sexy

---

## Executive Summary

This document provides a comprehensive plan to make Consultify's Demo and Trial system enterprise-ready, ensuring:

1. **Demo** — Atelier ToolToys dataset, read-only isolation (no DB changes on exit), token/storage limits, constant tutorial reminders
2. **Trial** — 7 days, clear limits, persistent reminders before expiry, conversion-ready
3. **Enterprise SaaS** — Scalable, auditable, multi-tenant safe
4. **DBR77 Tech Sexy** — Visual refresh aligned with DBR77 visual language

---

## 0) Current State Analysis

### 0.1 What Exists

| Component | Location | Status |
|-----------|----------|--------|
| Demo org type | `AccessTypes.ts` | DEMO, limits: 10 AI/day, 10k tokens, 10MB storage |
| Trial limits | `AccessTypes.ts` | 7 days, 50 AI/day, 100k tokens, 100MB storage |
| Atelier ToolToys seed | `seed-demo-dataset-contract.ts` | Exists, full dataset |
| Demo toggle API | `demo.routes.ts` | Works |
| Demo write protection | `demoGuard.middleware.ts` | **BUG:** depends on `X-Demo-Mode` header |
| X-Demo-Mode header | `api.ts` getHeaders() | **BUG:** only sent when `isDemoMode && isDemoSession` — real users have `isDemoSession=false`, so writes persist |
| Trial warnings | `TrialCron.ts`, `trialService.ts` | T-7, T-3 exist |
| Demo banner | `DemoModeBanner.tsx` | Exists, gradient (non-DBR77) |
| Help playbooks | `seedHelpPlaybooks.js` | DEMO and TRIAL playbooks exist |

### 0.2 Critical Gaps

1. **Demo DB isolation broken** — Writes from real users in demo mode persist to the shared demo org because `X-Demo-Mode` is not sent (isDemoSession check)
2. **Demo dataset** — Legolex/Technolex seeds coexist; Atelier ToolToys should be the single canonical demo
3. **Trial reminders** — Not "constantly" visible; no in-app countdown prominence
4. **Token/storage limits** — Enforced in AccessPolicy but not surfaced prominently in UI
5. **Tutorial time alerts** — No proactive "Your trial/demo time will end soon" messaging
6. **Graphics** — Demo banner and conversion CTAs use gradients; not DBR77 "tech sexy"

---

## 1) Demo — Requirements & Design

### 1.1 Dataset: Atelier ToolToys (Kanon)

**MUST:** Demo always uses **Atelier ToolToys** as the single demo organization.

- **DEMO_ORG_ID:** `demo-org` (or `atelier-demo-org` for clarity)
- **DEMO_ORG_NAME:** `Atelier ToolToys`
- **Seed script:** `server/scripts/seed-demo-dataset-contract.ts` — run as part of deployment
- **i18n:** 6 locales (pl, en, de, es, ja, ar) via `demo_dataset_translations` table

**Data scope (from existing seed):**

- 1 project: "Atelier Transformation 2026"
- 8–15 initiatives with varied statuses
- Tasks, decisions, KPI/ROI results, reports, presentations
- Traceability to deliverables

### 1.2 Ephemeral Demo — No DB Changes on Exit

**Requirement:** When a user leaves demo mode, the database must be unchanged. All mutations during demo must be either blocked or stored in a session-scoped layer that is discarded on exit.

#### Option A: Write Blocking (Recommended — Simpler)

- **All** write operations (POST, PUT, PATCH, DELETE) to demo org are rejected when `X-Demo-Mode: true`
- Demo is effectively **read-only** — user explores pre-seeded data
- **Fix:** Send `X-Demo-Mode: true` whenever `isDemoMode === true` (remove isDemoSession gate)

#### Option B: Ephemeral Session Layer (Advanced)

- Create `demo_session_mutations` table or in-memory store keyed by `(sessionId, userId)`
- Writes during demo go to this layer; reads merge seed + mutations
- On exit: discard session mutations
- **Pros:** User can "try" creating tasks, etc., without persisting
- **Cons:** Complex, merge logic on every read

**Recommendation:** Start with **Option A** (write blocking). It satisfies "database unchanged on exit" and is simpler. Option B can be a future enhancement.

#### Implementation (Option A)

**1. Frontend — `src/services/api.ts`**

```ts
// BEFORE (broken):
if (isDemoMode && isDemoSession) {
  headers['X-Demo-Mode'] = 'true';
}

// AFTER (correct):
if (isDemoMode) {
  headers['X-Demo-Mode'] = 'true';
}
```

**2. Backend — Global write protection**

- Already in place: `demoWriteProtection` in `Gateway.ts` with `allowedRoutes: ['/api/demo/', '/api/auth/']`
- Ensure `demoContextMiddleware` sets `req.organizationId = DEMO_ORG_ID` when header present
- Add **organization-level** check: reject writes for org `organization_type === 'DEMO'` even if header is bypassed (defense in depth)

**3. Defense in depth**

Add middleware or route-level check:

```ts
// In routes that modify data for orgId:
if (org.organization_type === 'DEMO' && req.get('X-Demo-Mode') === 'true') {
  return res.status(403).json({ error: 'Demo is read-only', code: 'DEMO_READ_ONLY' });
}
```

### 1.3 Demo Limits

| Limit | Value | Source |
|-------|-------|--------|
| AI calls/day | 10 | `DEFAULT_DEMO_LIMITS` |
| Total tokens | 10,000 | `DEFAULT_DEMO_LIMITS` |
| Storage | 10 MB | `DEFAULT_DEMO_LIMITS` |
| Projects | 1 | (view-only, no creation) |
| Initiatives | 5 | (view-only) |

**Enforcement:**

- `AccessPolicyService` / `AccessUsageService` for org type DEMO
- AI orchestrator blocks when limit reached
- Storage: check on upload; reject if over

**UI:** Show usage in demo banner: "AI: 3/10 today • Tokens: 2.1k/10k"

### 1.4 Demo Entry Flow

1. Landing → "Demo" button
2. **Login gate:** Require at least Google (or email) — no "no signup" promise
3. **Language selection:** PL, EN, DE, ES, JA, AR
4. "Start Demo" → `POST /api/demo/toggle` with `enabled: true` + store `preferredDemoLanguage`
5. Redirect to app with demo org context
6. Banner: "Demo Mode • Atelier ToolToys • [Start Trial]"

### 1.5 Demo Exit

- User clicks "Exit Demo" → `POST /api/demo/toggle` with `enabled: false`
- No DB cleanup needed (Option A: no writes occurred)
- Return to user's own org (or org picker if multiple)

---

## 2) Trial — Requirements & Design

### 2.1 Duration & Lifecycle

- **7 days** (already `TRIAL_DURATION_DAYS = 7`)
- **Start:** When user creates org via "Start Trial" from demo or landing
- **End:** `trial_expires_at`; after that → read-only + CTA to upgrade

### 2.2 Trial Limits

| Limit | Value | Notes |
|-------|-------|-------|
| AI calls/day | 50 | Soft; hard limit = token budget |
| Total tokens | 100,000 | Per trial period |
| Storage | 100 MB | |
| Projects | 3 | |
| Users | 4 | Owner + 3 invites |
| Initiatives | 5 | |

### 2.3 Constant Reminders — "Trial Will End Soon"

**Requirements:**

- User must see trial time remaining **frequently**
- Progressive urgency: T-7 (warning), T-3 (critical), T-1 (urgent), T-0 (expired)

**Implementation:**

1. **Banner (always visible in trial):**
   - "Trial: X days left • Upgrade to keep your data"
   - Color: `warning` at T-7–T-3, `danger` at T-1–T-0
   - CTA: "Upgrade" → /billing

2. **Modal (dismissible, shown periodically):**
   - T-7: "Your 7-day trial has started. You have 7 days to explore."
   - T-3: "3 days left. Upgrade now to avoid losing access."
   - T-1: "Last day! Upgrade to save your work."
   - T-0: Blocking modal: "Trial expired. Upgrade to continue."

3. **In-app notifications:**
   - `trial_expiry_warning_shown` event at T-7, T-3, T-1
   - Use existing `NotificationService` + `recordDemoTrialEvent`

4. **Frequency:**
   - Banner: every page load
   - Modal: once per session at T-3 and T-1 (or when user performs write action)
   - Optional: gentle toast on first action of the day when &lt; 3 days left

### 2.4 Trial Conversion Path

- Demo → "Start Trial" → create org + 7 days
- Landing "Start Trial" → same
- Post-trial: read-only + upgrade CTA

---

## 3) Token & Storage Limits — Net/Gross

### 3.1 Definitions

- **Demo:** Hard limits (10 AI/day, 10k tokens, 10 MB)
- **Trial:** Hard limits (100k tokens total, 100 MB); daily AI soft (50)
- **Paid:** Per-plan (see `DEFAULT_PAID_LIMITS`)

### 3.2 Enforcement Points

| Layer | Responsibility |
|-------|----------------|
| `AccessPolicyService` | Returns limits + usage |
| `AccessUsageService` | Counters (AI, storage) |
| `AIOrchestrator` | Blocks when AI limit/token budget exceeded |
| Upload routes | Check storage before accept |
| Invitation/org creation | Check user/project limits |

### 3.3 UI Display

- **Demo banner:** "AI: 3/10 • Tokens: 2.1k/10k • Storage: 0.5/10 MB"
- **Trial banner:** "AI: 12/50 today • Tokens: 45k/100k • 4 days left"
- **Settings / Billing:** Full meters + upgrade CTA

---

## 4) Telemetry & SuperAdmin

**Events (existing + ensure):**

- `demo_started` (language, source)
- `demo_mode_enabled` / `demo_mode_disabled`
- `demo_ai_limit_reached`
- `trial_started` (source: demo | landing | invite)
- `trial_expiry_warning_shown` (daysLeft)
- `trial_converted_to_paid`

**SuperAdmin view:** List demo/trial starts, conversion rates, usage stats.

---

## 5) DBR77 Tech Sexy — Graphics Refresh

**Source:** `docs/ui-standards/00-foundation/visual-language.md`

### 5.1 Principles to Apply

- **Monochromatyczna hierarchia** — minimal color in chrome
- **Invisible borders** — separate by background, shadow, spacing
- **Confidence in emptiness** — more whitespace, less clutter
- **Depth without decoration** — layers (navy-950, navy-900, navy-800)
- **4 semantic colors:** primary, danger, success, warning (amber)

### 5.2 Demo Banner — Before vs After

**Before:**
- `bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600`
- High contrast, "loud"

**After (DBR77):**
- Dark: `bg-navy-800/90` or `bg-navy-900` with subtle `border-b border-white/5`
- Light: `bg-slate-100` + subtle `border-b border-slate-200`
- Accent: single primary CTA ("Start Trial") — `bg-primary-500` or `text-primary-500`
- Text: `text-slate-100` (dark) / `text-slate-900` (light)
- Badges: `bg-white/10` (dark) or `bg-slate-200/50` (light)
- No gradients; use depth via layers

### 5.3 Trial Banner

- Same treatment: navy/slate base, single accent for "Upgrade"
- Warning state: `border-l-4 border-amber-500` or `bg-amber-500/10`
- Critical: `border-l-4 border-danger-500`

### 5.4 Conversion CTAs

- Primary: `bg-primary-500 hover:bg-primary-600` — one per screen
- Secondary: `text-primary-500` link style

### 5.5 Components to Update

| Component | Change |
|-----------|--------|
| `DemoModeBanner.tsx` | DBR77 palette, remove gradient |
| Trial banner (new or existing) | DBR77 + urgency states |
| Auth modal (demo entry) | Clean, minimal |
| Help playbook CTAs | Align with primary button |

---

## 6) Implementation Checklist

### Phase 1: Critical Fixes (Demo Isolation) ✅

- [x] **DEMO-01:** Fix `api.ts` — send `X-Demo-Mode` when `isDemoMode` only (remove `isDemoSession` gate)
- [x] **DEMO-02:** Add defense-in-depth: block writes for `organization_type === 'DEMO'` in key routes
- [x] **DEMO-03:** Verify `demo-org` is seeded with Atelier ToolToys; deprecate Legolex/Technolex as demo

### Phase 2: Atelier ToolToys as Canonical Demo ✅

- [x] **DEMO-04:** Ensure `seed-demo-dataset-contract.ts` runs in deployment/setup (`db:seed:demo:contract`)
- [x] **DEMO-05:** Set `DEMO_ORG_ID=demo-org`, `DEMO_ORG_NAME=Atelier ToolToys` in env
- [ ] **DEMO-06:** Add i18n for 6 locales (demo_dataset_translations) — partial via DemoModeModal

### Phase 3: Trial Reminders ✅

- [x] **TRIAL-01:** Create `TrialReminderBanner` component (DBR77 styled)
- [x] **TRIAL-02:** Add `TrialExpiryModal` — shown at T-3, T-1, T-0
- [ ] **TRIAL-03:** Wire `trial_expiry_warning_shown` events
- [ ] **TRIAL-04:** Ensure T-7, T-3 crons send in-app notifications

### Phase 4: Limits UI ✅

- [x] **LIMIT-01:** Add usage meters to Demo banner (AI, tokens, storage)
- [x] **LIMIT-02:** Add usage meters to Trial banner
- [ ] **LIMIT-03:** Add "Approaching limit" soft warnings (70% threshold)

### Phase 5: DBR77 Graphics ✅

- [x] **UI-01:** Refactor `DemoModeBanner` to DBR77 visual language
- [x] **UI-02:** Create/refactor `TrialReminderBanner` with DBR77
- [x] **UI-03:** Update demo entry modal to DBR77 + language selection
- [x] **UI-04:** Audit conversion CTAs across app

### Phase 6: Enterprise Hardening

- [x] **ENT-01:** Add `organization_type` check (defense in depth in demoWriteProtection)
- [ ] **ENT-02:** Audit logging for demo/trial events
- [ ] **ENT-03:** SuperAdmin dashboard for demo/trial analytics
- [ ] **ENT-04:** Documentation for support/sales

---

## 7) Environment Variables

```env
# Demo
DEMO_ORG_ID=demo-org
DEMO_ORG_NAME=Atelier ToolToys
DEMO_ORG_SLUG=demo-org
DEMO_ORG_DESCRIPTION=Demo organization - Atelier ToolToys

# Optional: override limits
DEMO_AI_CALLS_PER_DAY=10
DEMO_MAX_TOKENS=10000
DEMO_MAX_STORAGE_MB=10

# Trial (already in AccessTypes, but can override)
TRIAL_DURATION_DAYS=7
```

---

## 8) Acceptance Criteria

### Demo

1. User enters demo → sees Atelier ToolToys data in selected language
2. User attempts any write (create task, edit initiative, upload) → blocked with "Demo is read-only"
3. User exits demo → DB unchanged
4. Demo banner shows: "Demo • Atelier ToolToys • AI: X/10 • [Start Trial]"
5. After 10 AI calls in demo → "Upgrade to trial for more AI"

### Trial

1. Trial starts → 7 days countdown
2. T-7, T-3, T-1 → User sees reminder (banner + optional modal)
3. T-0 → Read-only + "Upgrade" CTA
4. Limits enforced: tokens, storage, AI/day

### Graphics

1. Demo and Trial banners follow DBR77: navy/slate, no gradients, single CTA accent
2. Consistent with `visual-language.md`

---

## 9) References

- `docs/product/DEMO_TRIAL_V3.md` — Previous SSOT
- `docs/ui-standards/00-foundation/visual-language.md` — DBR77 Tech Sexy
- `server/src/services/access/AccessTypes.ts` — Limits
- `server/scripts/seed-demo-dataset-contract.ts` — Atelier ToolToys seed
- `server/src/middleware/demoGuard.middleware.ts` — Write protection
