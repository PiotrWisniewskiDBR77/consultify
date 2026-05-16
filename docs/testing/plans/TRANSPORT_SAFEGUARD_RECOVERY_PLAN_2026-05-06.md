# Transport Safeguard Recovery Plan (Interview + Tools)

Owner scope: Frontend API layer + module UX fallbacks + environment bootstrap checks  
Priority: `P0` (operational block outside chat-only scope)

## Problem statement

Interview and Tools are functionally blocked by client-side global transport safeguard behavior:
- requests return blocked response (`CLIENT_TRANSPORT_GLOBAL_CIRCUIT_OPEN`),
- modules render empty shells without explicit error states,
- users cannot continue critical workflows.

Observed implementation touchpoint:
- `src/services/api.ts` (`buildGlobalBlockedResponse`, global circuit state handling)

---

## Recovery objectives

1. Prevent global safeguard from over-blocking non-failing module paths.
2. Guarantee user-visible degraded UX when safeguard is active.
3. Restore Interview and Tools operational behavior.
4. Add automated regression checks for this failure mode.

---

## Implementation plan

## Step 1 — Scope and reset strategy (P0)

- Narrow global block conditions to high-confidence failure bursts only.
- Add reset conditions:
  - after successful authenticated request to critical module endpoint,
  - after explicit session recovery event,
  - after bounded cooldown with no new failures.
- Ensure path-aware logic does not cascade from one failing endpoint to unrelated module reads.

Expected outcome:
- transient errors no longer freeze whole module families.

## Step 2 — Degraded UX contract (P1)

- In Interview and Tools list/detail loaders:
  - detect safeguard code (`CLIENT_TRANSPORT_GLOBAL_CIRCUIT_OPEN`),
  - show clear blocking banner (not empty shell),
  - offer retry action and short guidance.

Expected outcome:
- user understands outage state and can retry/recover.

## Step 3 — Automation coverage (P0/P1 prevention)

Add/extend tests:
- unit/integration:
  - `api.ts` safeguard transition and reset behavior,
  - module data loaders with safeguard response -> banner fallback.
- e2e:
  - Interview route with forced safeguard response -> visible degraded banner.
  - Tools route with forced safeguard response -> visible degraded banner.
  - recovery path after retry/success.

Minimum commands:

```bash
npm run lint
npm run type-check
npm run test:integration
npm run test:runtime-gate
npx playwright test --config playwright.smoke.config.ts tests/e2e/smoke/deploy-gate-api-interview.spec.ts tests/e2e/smoke/deploy-gate-api-tools-workflow.spec.ts --project=chromium --workers=1
```

## Step 4 — Deploy and retest loop

1. Implement fixes.
2. Pass mandatory automation.
3. Deploy to demo/stage.
4. Execute manual retest focused on:
   - Interview open/new/save/submit,
   - Tools Education/Audits data visibility,
   - clear degraded UX if safeguard re-triggers.
5. Close defects only with evidence.

---

## Exit criteria

- `IMPACT-TR-001` closed (no operational block in Interview/Tools).
- `IMPACT-UX-002` closed (explicit degraded UX present and verified).
- No open P0/P1 in impacted modules.
- New closure report upgrades decision from `NO-GO` to `GO/GO_WITH_RISK`.

