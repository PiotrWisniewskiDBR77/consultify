# Canvas Stability And Growth Plan (May 2026)

Tester checklist: `docs/product/OCE_STAGING_MANUAL_TEST_CHECKLIST_2026-05-04.md`

## Purpose

This document defines the execution context and delivery plan for Canvas under current production-like instability (`DEF-SYS-05`).  
It is intended as a handoff package for an implementation agent, while QA ownership and release gating remain with the current testing lead.

## Current Context (Why This Plan Exists)

Recent manual stability smokes for both streams returned `FAIL_P0 (CRITICAL)` due to systemic app instability:

- Renderer crashes (`target closed / EOF`)
- Repeating auth/init loop symptoms
- Burst traffic on:
  - `/api/conversations/:id` (404)
  - `/api/demo/status` (429)
  - peripheral auth-sensitive endpoints (401)
- Testers blocked before reaching core Canvas workflows

Additional risk: stale session/browser state can invalidate test results when old client state survives between runs.

## Delivery Model (Important Operating Constraint)

We operate in **two streams (A/B) with one tester agent, alternating**, not in parallel.

- Stream A: Interview / Insight / Initiative workflows
- Stream B: Canvas workflows
- If stability fails in one stream, treat it as a **cross-stream risk** and block both until stability is restored.

## Non-Negotiable Standards

All work must remain compliant with `DRD/UI_UX_SOURCE_OF_TRUTH.md`:

- No silent execution
- Honest degraded UI (no fake success, no infinite spinner)
- Traceability for AI actions
- Tenant/ACL safety
- AI contextual actions in Menu 3
- Clear distinction: save state vs lifecycle state

## Strategic Decision

Use a **two-track plan**:

1. **Track S (Stability containment first)**  
   Freeze new Canvas feature expansion for a short window and close P0/P1 instability causes.
2. **Track C (Canvas product growth after gate)**  
   Resume functional expansion only after Stability Gate passes.

---

## Track S: Stability Containment (Priority P0)

### Goal

Bring environment to `PASS`/`PASS_WITH_P2` for stability smoke so functional Canvas testing is reliable.

### Scope

#### S1. Session Quarantine At Boot

- On app bootstrap, detect invalid/missing active conversation state early.
- Hard-clear only corrupted conversation pointers (not entire user storage).
- Redirect safely to `/chat` (or neutral route) when active conversation is known-missing.

#### S2. Conversation Rehydrate Hard-Stop

- In rehydrate path, `404/401/403` must terminate reattempt loop immediately.
- No eager retry on missing conversation IDs.
- Ensure local "missing conversation" memory is respected before fetch.

#### S3. Transport/Auth Burst Control

- Enforce endpoint-level backoff for repeated `401/404/429`.
- Suppress global auth retry cascades from peripheral endpoints.
- Ensure cooldown state survives soft reload where needed.

#### S4. Browser Cache/Service Worker Hygiene (Demo/Staging)

- Ensure `demo.consultify.ai` cannot retain stale worker/cache that resurrects old bundles.
- Keep cache invalidation deterministic and explicit.

#### S5. Runtime Observability (Minimal But Sufficient)

- Add structured markers for:
  - session quarantine trigger
  - hard-stop due to missing conversation
  - transport circuit open/close
- Required for incident triage and deterministic QA verdicts.

### Exit Criteria (Track S)

Must pass all:

1. Cold start without init/auth loop spam.
2. No high-rate recurrence of `/api/conversations/:id` 404 for missing ID.
3. No sustained `/api/demo/status` 429 burst caused by client loops.
4. No renderer crash (`target closed / EOF`) in 10-15 min smoke.
5. Stream A and Stream B stability smoke both at least `PASS_WITH_P2`.

---

## Track C: Canvas Product Growth (After Stability Gate)

### Goal

Continue Canvas maturation once environment is testable.

### Scope Priority

#### C1. Foundation UX

- Reliable save/read-back loop
- Explicit degraded states
- Recovery affordances (retry, reset local session pointer)

#### C2. Governance-ready Canvas

- Proposal -> Approval -> Execution -> Audit for AI-affecting changes
- No hidden mutations
- Block-level traceability (sources/confidence where applicable)

#### C3. Workflow Depth

- Better structure templates (problem, options, decisions, actions)
- Version/snapshot recovery model
- Cross-links with Interview artifacts

### Exit Criteria (Track C)

- Canvas flow usable end-to-end without blockers
- No P0/P1 in save/read-back/refresh lifecycle
- Governance and audit behavior aligned with source-of-truth rules

---

## Work Packages For Implementation Agent

### WP-S (Execute Now)

1. Implement S1-S5 in small, reviewable steps.
2. After each step, provide:
   - changed files
   - rationale
   - risk notes
   - expected QA impact
3. Do not broaden into non-stability feature work.

### WP-C (Execute Only After Stability Green)

1. Start with C1.
2. Move to C2 and C3 only after QA confirms stability gate.

---

## QA Ownership Model

QA remains with current testing lead (this chat flow):

- Implementation agent delivers patches.
- QA lead runs/coordinates alternating stream retests.
- Only QA lead can mark:
  - `PASS`
  - `PASS_WITH_P2`
  - `BLOCKED_P1`
  - `FAIL_P0`
  - `INCONCLUSIVE`

## Test Gate Sequence

1. Stability Smoke A
2. Stability Smoke B
3. Functional Smoke A
4. Functional Smoke B
5. Deeper E2E rounds

If any step returns `FAIL_P0`, stop sequence and return to Track S.

---

## Risk Register (Short)

- **R1:** stale browser state produces false-negative QA verdicts  
  Mitigation: mandatory pre-flight reset instructions.
- **R2:** partial fixes hide loop symptoms without eliminating root cause  
  Mitigation: enforce request-rate and crash criteria, not visual-only checks.
- **R3:** cross-stream regression  
  Mitigation: alternating stream protocol + cross-stream risk flagging.

## Immediate Next Action

### Mandatory QA Pre-Flight For DEF-SYS-05 Retest

Before rerunning Stability Smoke A or B after a `target closed / EOF` failure, QA must start from a clean browser context or run this same-origin console reset on `demo.consultify.ai`:

```js
const blockedConversationId = '64d7b4cf-538a-4a30-9371-f5162daacd52';
const missingKey = 'consultify-missing-conversations';
const missing = new Set(JSON.parse(localStorage.getItem(missingKey) || '[]'));
missing.add(blockedConversationId);
localStorage.setItem(missingKey, JSON.stringify([...missing]));
sessionStorage.removeItem('consultify:transportCircuit:v1');
sessionStorage.removeItem('consultify-endpoint-backoff');
sessionStorage.removeItem('consultify:authRefreshBackoff:v1');
history.replaceState(null, '', '/chat');
location.reload();
```

Acceptance for the next smoke:

- No repeated fetches for `/api/conversations/64d7b4cf-538a-4a30-9371-f5162daacd52`.
- No sustained `/api/demo/status` burst after the first failed/throttled response.
- If the stale conversation is encountered, the app emits `[stability:conversation]` markers and lands on `/chat`.
- Canvas testing remains blocked if renderer crash or auth/init loop returns.

Hand this plan to the implementation agent and request execution of **WP-S only** until stability gates pass.
