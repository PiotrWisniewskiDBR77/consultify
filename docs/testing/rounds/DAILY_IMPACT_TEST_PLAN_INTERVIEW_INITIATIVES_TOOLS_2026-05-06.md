# Daily Impact Test Plan — Interview, Initiatives, Tools (2026-05-06)

Scope for today:
- Interview
- Initiatives
- Tools
- Cross-cutting validation: AI, Presentations, Context, Canvas in Chat

Goal:
- Every changed component must be tested (automatic + manual) before deploy.
- No silent regressions in Chat, context routing, canvas split/deeplink, or proposal/governance flows.

---

## 1) Change-based mandatory testing rule (non-negotiable)

For each code change:
1. Identify changed files.
2. Map change -> impacted area.
3. Run mandatory automated tests for that area.
4. If tests pass, run mandatory manual checks for that area.
5. Attach evidence and only then allow deploy.

No mapping => no deploy.

---

## 2) Impact matrix (what to run when something changes)

### A) Interview changes

Trigger examples:
- `src/components/Interview/**`
- `server/src/routes/interview*`
- interview-related services/controllers

Mandatory automated:
- `npm run smoke:interview:d01d02`
- `npm run test:e2e:tier0`
- `npx playwright test --config playwright.smoke.config.ts tests/e2e/smoke/interview-initiative-wizard.spec.ts --project=chromium`

Mandatory manual:
- open interview hub
- create/edit interview flow
- convert/bridge to initiative flow
- verify no broken AI assistance in interview context

### B) Initiatives changes

Trigger examples:
- `src/components/Initiatives/**`
- `server/src/routes/initiatives*`
- initiative domain services

Mandatory automated:
- `npm run test:e2e:tier0`
- `npx playwright test --config playwright.smoke.config.ts tests/e2e/smoke/tier0-initiative-create.spec.ts tests/e2e/smoke/initiatives-ai-language.spec.ts tests/e2e/smoke/interview-initiative-wizard.spec.ts --project=chromium`
- `npm run smoke:j03g01`

Mandatory manual:
- create initiative
- edit initiative
- AI-assisted fields/content in initiative
- cross-navigation to related modules

### C) Tools changes

Trigger examples:
- `src/components/**/Tools*`
- `server/src/services/**tool*`
- known tools governance/runtime files

Mandatory automated:
- `npm run smoke:e04e06e07l01`
- `npm run audit:e07-known-tools`
- `npm run smoke:agent2-agent3-closure`

Mandatory manual:
- run core tool actions
- verify proposal -> approval -> execution -> result flow
- verify blocked scopes stay blocked

### D) AI/Chat/Context changes (cross-cutting)

Trigger examples:
- `src/components/AIChat/**`
- `src/hooks/useAIStream.ts`
- `src/services/api.ts`
- `server/src/routes/ai.routes.ts`
- conversation/context services

Mandatory automated:
- `npm run test:runtime-gate`
- `npm run test:aios:wave-1`
- `npx vitest run "tests/components/AIChat/MessageRenderer.policy.test.tsx"`
- `npx vitest run "src/components/AIChat/__tests__/TrustBadge.test.tsx"`

Mandatory manual:
- basic chat prompts
- deep thinking + reasoning
- trust/sources checks
- follow-up context chain
- history/refresh/rename/folder

### E) Presentations changes (cross-check for today)

Trigger examples:
- `src/components/Presentations/**`
- `server/src/services/presentation*`

Mandatory automated:
- `npm run smoke:v3:presentations-runtime`
- `npx playwright test --config playwright.smoke.config.ts tests/e2e/smoke/deploy-gate-wordy.spec.ts --project=chromium`

Mandatory manual:
- open presentation flow
- create/edit/preview
- verify no regression from AI context or initiative/interview handoff

### F) Canvas in Chat changes (cross-check for today)

Trigger examples:
- `src/components/AIChat/WorkCanvas*`
- `src/components/AIChat/UnifiedChatPanel.tsx`
- canvas route/deeplink files

Mandatory automated:
- `npm run test:v10:canvas:playwright`
- `npx playwright test --config playwright.smoke.config.ts tests/e2e/smoke/work-canvas-split.spec.ts tests/e2e/smoke/work-canvas-core-flow.spec.ts tests/e2e/smoke/work-canvas-deeplink.spec.ts --project=chromium --workers=1`

Mandatory manual:
- open canvas from chat
- verify split panel state
- deeplink to draft id
- refresh and route return stability

---

## 3) Today execution plan (phased)

## Phase 0 — morning baseline gate

Run once before coding:

```bash
npm run lint
npm run type-check
npm run test:runtime-gate
npm run test:aios:wave-1
```

## Phase 1 — during development (impact loop per change batch)

For each finished batch:
1. Map changed files to impact matrix above.
2. Run only mandatory impacted automation.
3. Fix failures immediately.
4. Run quick manual checks for impacted area.

## Phase 2 — pre-deploy integration sweep

Run before deploy candidate:

```bash
npm run smoke:interview:d01d02
npm run smoke:j03g01
npm run smoke:e04e06e07l01
npm run smoke:v3:presentations-runtime
npm run test:e2e:tier0
npm run test:aios:retro
```

## Phase 3 — manual round + closure

1. Initialize round:
```bash
npm run qa:chat:round -- --round-id ROUND-CHAT-2026-05-06-03 --tester "Owner/Admin" --account "piotr.wisniewski@dbr77.com"
```
2. Fill report JSON with evidence.
3. Validate and close:
```bash
npm run qa:chat:validate -- --file test-results/manual-rounds/ROUND-CHAT-2026-05-06-03/report.template.json
npm run qa:chat:close -- --file test-results/manual-rounds/ROUND-CHAT-2026-05-06-03/report.template.json
```
4. Deploy.
5. Post-deploy smoke:
```bash
npm run smoke:b02-chat-actions
npm run smoke:ai:research-ledger
```

---

## 4) Definition of done for today

Today is done only when:
- all impacted automated suites are green,
- manual round closure is generated,
- no open P0/P1 for Interview/Initiatives/Tools/AI/Canvas/Presentation context,
- deploy completed and post-deploy smoke green.

---

## 5) Tester prompt for today (copy-ready)

`Wykonaj dzisiejsza runde testow impact-based dla modulow Interview, Initiatives i Tools oraz cross-check AI/Presentations/Context/Canvas w Chat. Dla kazdego obszaru zwroc status PASS/BLOCKED_P0/BLOCKED_P1/PASS_WITH_P2/INCONCLUSIVE, 2-4 zdania obserwacji, oraz evidence: UI screenshot + Sources screenshot (jesli dotyczy) + Network screenshot. Szczegolnie oznacz: loading loops, utrate historii, bledy proposal approval flow, wycieki raw tagow (rag_/artifact), no cited sources mismatch, i regresje deeplink/split canvas. Na koncu podaj globalna decyzje GO/GO_WITH_RISK/NO-GO oraz liste defektow P0/P1/P2 z ownerem.`

## 6) Current round status update (2026-05-06 10:44)

Recorded closure:
- `docs/testing/reports/DAILY_IMPACT_ROUND_CLOSURE_2026-05-06_1044.md`

Current decision:
- `NO-GO` for non-chat scope due to Interview/Tools transport block.

Active recovery plan:
- `docs/testing/plans/TRANSPORT_SAFEGUARD_RECOVERY_PLAN_2026-05-06.md`

## 7) Recovery retest status update (2026-05-06 11:02)

Recorded retest:
- `docs/testing/reports/RECOVERY_INTERVIEW_TOOLS_RETEST_2026-05-06_1102.md`

Result:
- `NO-GO` remains active.
- `IMPACT-TR-001` and `IMPACT-UX-002` still open.

Last-mile closure plan:
- `docs/testing/plans/INTERVIEW_TOOLS_UNBLOCK_LAST_MILE_PLAN_2026-05-06.md`

