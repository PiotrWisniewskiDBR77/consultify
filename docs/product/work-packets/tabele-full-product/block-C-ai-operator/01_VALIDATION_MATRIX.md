# Validation Matrix — Block C: AI Operator

**Block ID:** `TABELE_BLOCK_C_AI_OPERATOR`
**Template basis:** `.cursor/SPRINT_GATE_CHECKLIST.md`
**Status:** `PLANNED`

---

## Layer 1 — Static / Lint / Type

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L1.1 | Frontend lint | `cd DRD/consultify && npm run lint` | 0 errors | Agent D |
| L1.2 | Frontend typecheck | `cd DRD/consultify && npm run type-check` | exit 0 | Agent D |
| L1.3 | Backend typecheck | `cd DRD/consultify/server && npm run typecheck` | exit 0 | Agent A |
| L1.4 | DBR77 hex scan | `rg -n "#[0-9a-fA-F]{3,6}\b" consultify/src/components/AIChat/KimiWorkspace/{aiEditor,qa,sourcePack}` | 0 hits | Agent C |
| L1.5 | i18n keys | `npm run i18n:check` | green | Agent C |
| L1.6 | Untouched-files guard | git diff for Foundation Block + Block A + Block B owned files | 0 hits except documented integration points | Orchestrator |

## Layer 2 — Unit Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L2.1 | `TableAiEditorService` orchestrator | `npm run test -- TableAiEditorService` | green: 8-level dispatch + token budget enforcement + audit | Agent A |
| L2.2 | 8 level handlers | `npm run test -- TableAiEditorLevels` | each level produces proposal, never executes | Agent A |
| L2.3 | `TableQaService` | `npm run test -- TableQaService` | 5-axis scoring + persistence | Agent A |
| L2.4 | `SourcePackService` | `npm run test -- SourcePackService` | ranked candidates + ACL filter | Agent A |
| L2.5 | `AiUsageService` | `npm run test -- AiUsageService` | budget consumption, reset, 429 | Agent A |
| L2.6 | Frontend unit | `npm run test:unit` | regression green | Agent D |

## Layer 3 — Component Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L3.1 | `TabeleAiEditorPanel` | `vitest run tests/components/AIChat/KimiWorkspace/aiEditor/TabeleAiEditorPanel.test.tsx` | renders 8 level tabs; level switch works | Agent B |
| L3.2 | `ProposalDiffCard` | same path | apply / reject / refine actions wired | Agent B |
| L3.3 | `TabeleQaPanel` | `tests/components/AIChat/KimiWorkspace/qa/TabeleQaPanel.test.tsx` | renders 5-axis bar + suggestion list | Agent B |
| L3.4 | `TabeleSourcePackPanel` | `tests/components/AIChat/KimiWorkspace/sourcePack/TabeleSourcePackPanel.test.tsx` | candidate list + select-to-pack works | Agent B |
| L3.5 | `KimiWorkspaceShell` Menu 3 buttons (lane=tabele) | shell test | "AI Editor" / "QA Report" / "Source Pack" buttons render in right slot | Agent B |
| L3.6 | 8 level cards | `tests/components/AIChat/KimiWorkspace/aiEditor/levels/*.test.tsx` | each card renders proposal payload | Agent B |

## Layer 4 — Integration Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L4.1 | AI Editor end-to-end (cell level) | `npm run test:integration -- ai-editor-cell` | request → proposal in `tp_proposals` → user apply → record updated | Agent A |
| L4.2 | AI Editor structure level (uses ChatToSchemaService) | same suite | proposal in queue, no auto-execute | Agent A |
| L4.3 | Cross-tenant 403 on all new endpoints | `npm run test:integration -- ai-operator-acl` | 403 in every cross-tenant case | Agent A |
| L4.4 | Token budget hard cap → 429 | `npm run test:integration -- ai-usage-quota` | 429 returned with `AI_DAILY_QUOTA_EXHAUSTED` code | Agent A |
| L4.5 | QA Engine produces report | integration | report saved + retrievable | Agent A |
| L4.6 | Source Pack Builder | integration | candidates ranked + filtered | Agent A |
| L4.7 | Methodological / source level requires super-admin | integration | non-admin gets 403 | Agent A |

## Layer 5 — E2E Smoke

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L5.1 | Open AI Editor from Menu 3 | `npx playwright test tests/e2e/smoke/tabele-ai-operator.spec.ts --project=chromium --workers=1` | panel opens, 8 levels visible | Agent D |
| L5.2 | Apply a cell-level proposal | same suite | record updates after Apply click | Agent D |
| L5.3 | View QA report | same suite | 5-axis bar + suggestions render | Agent D |
| L5.4 | Use Source Pack Builder | same suite | candidates list + add-to-pack works | Agent D |
| L5.5 | Token budget banner appears at 70 % simulated | same suite | banner visible | Agent D |

## Layer 6 — Manual

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L6.1 | DBR77 visual review | side-by-side with `color-system.md` | screenshots attached | Agent C |
| L6.2 | Menu 3 placement audit | grep + visual | only AI Editor / QA / Source Pack buttons in right slot | Orchestrator |
| L6.3 | Word-canvas idiom preserved when AI panel is open | side-by-side with Foundation Block screenshot | shape preserved | Agent C |
| L6.4 | Demo recording — 5 min e2e | screen capture | full AI Editor flow + QA + Source Pack | Agent D |
| L6.5 | LLM cost report on representative workload | runtime telemetry | total token consumption documented | Agent A |

## Layer 7 — Security / Tenant

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L7.1 | Tenant resolution on every endpoint | code review + L4.3 | every endpoint reads `tenant_id` | Agent A |
| L7.2 | AI Editor never auto-executes | code review + L4.1/2 | every level returns `proposalId` only | Agent A |
| L7.3 | Cross-tenant data in LLM context audit | code review | prompt builder reads only tenant-scoped data | Agent A |
| L7.4 | Methodological / source levels super-admin only | code review + L4.7 | role-checked | Agent A |
| L7.5 | Proposal replay prevention | code review | nonce-signed, single-use | Agent A |
| L7.6 | Token budget enforced server-side | code review | client cannot bypass via header manipulation | Agent A |

## Layer 8 — Performance / Capacity

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L8.1 | AI Editor cell-level p95 | benchmark | < 3 s | Agent A |
| L8.2 | QA Engine full-table report | benchmark | < 8 s for 1k records | Agent A |
| L8.3 | Source Pack candidate ranking | benchmark | < 2 s for 10k record corpus | Agent A |
| L8.4 | Token budget calibration | run `evidence/token-baseline.md` | usage in 50–80 % of 100k for typical day | Agent A |

---

## Sprint Exit Gate

- [ ] L1.1–L1.6 GREEN
- [ ] L2.1–L2.6 GREEN
- [ ] L3.1–L3.6 GREEN
- [ ] L4.1–L4.7 GREEN
- [ ] L5.1–L5.5 GREEN
- [ ] L6.1–L6.5 RECORDED
- [ ] L7.1–L7.6 GREEN
- [ ] L8.1–L8.4 GREEN
- [ ] DoD checklist in `00_TASK_PACKET.md` §5 fully checked
- [ ] Release recommendation set
