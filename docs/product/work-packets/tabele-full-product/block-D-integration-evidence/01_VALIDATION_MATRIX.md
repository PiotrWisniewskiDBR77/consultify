# Validation Matrix — Block D: Integration & Evidence

**Block ID:** `TABELE_BLOCK_D_INTEGRATION_EVIDENCE`
**Template basis:** `.cursor/SPRINT_GATE_CHECKLIST.md`
**Status:** `PLANNED`

---

## Layer 1 — Static / Lint / Type

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L1.1 | Frontend lint | `npm run lint` | 0 errors | Agent D |
| L1.2 | Frontend typecheck | `npm run type-check` | exit 0 | Agent D |
| L1.3 | Backend typecheck | `npm run typecheck` (server) | exit 0 | Agent A |
| L1.4 | DBR77 hex scan | `rg -n "#[0-9a-fA-F]{3,6}\b" consultify/src/components/AIChat/KimiWorkspace/{conversion,formIntake} consultify/src/components/PublicIntakeForm` | 0 hits | Agent C |
| L1.5 | i18n keys | `npm run i18n:check` | green | Agent C |
| L1.6 | Untouched-files guard | git diff for Block A/B/C owned + Foundation files | 0 hits except documented | Orchestrator |

## Layer 2 — Unit Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L2.1 | `TableArtifactConversionService` | `npm run test -- TableArtifactConversionService` | green: V8 snapshot → Wordy + Prezentacje payloads | Agent A |
| L2.2 | `FormIntakeService` | `npm run test -- FormIntakeService` | green: intake config + JWT issue/verify + submission landing | Agent A |
| L2.3 | Frontend unit | `npm run test:unit` | regression green | Agent D |

## Layer 3 — Component Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L3.1 | `TabeleConvertButton` | component test | renders inside Menu 3 right-slot for lane=tabele | Agent B |
| L3.2 | `CreateIntakeFormDialog` | component test | dialog with field allow-list builder | Agent B |
| L3.3 | `IntakeFormPreview` | component test | renders preview matching public form layout | Agent B |
| L3.4 | `PublicIntakeForm` | component test | renders fields per allow-list; validates per schema | Agent B |
| L3.5 | `KimiWorkspaceShell` Menu 3 buttons (lane=tabele) | shell test | 3 buttons render in right slot | Agent B |

## Layer 4 — Integration Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L4.1 | Convert table → Wordy | `npm run test:integration -- table-conversion-wordy` | Wordy artifact created with V8 snapshot | Agent A |
| L4.2 | Convert table → Prezentacje | `npm run test:integration -- table-conversion-prezentacje` | Prezentacje artifact created with V8 snapshot | Agent A |
| L4.3 | Public form submission | `npm run test:integration -- form-public-submit` | record landed with `form_submission` source | Agent A |
| L4.4 | Public form rate limit | same suite | excess submissions get 429 | Agent A |
| L4.5 | Public form JWT expiry | same suite | expired token rejected with 401 | Agent A |
| L4.6 | Public form field allow-list | same suite | submitting non-allow-listed field fails 400 | Agent A |
| L4.7 | Cross-tenant on conversion + intake endpoints | `acl-tests` | 403 in every cross-tenant case | Agent A |

## Layer 5 — E2E Smoke

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L5.1 | Full E2E walkthrough | `npx playwright test tests/e2e/smoke/tabele-full-program.spec.ts --project=chromium --workers=1` | open Tabele → AI Editor → QA Report → Convert to Wordy → Publish form → External submit | Agent D |
| L5.2 | Convert button visibility per role | same suite | only owner/editor sees button | Agent D |
| L5.3 | Public form happy path | same suite | external user submits, record visible to owner | Agent D |

## Layer 6 — Manual / Anygravity

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L6.1 | Anygravity P0 trial #2 | per `ENTERPRISE_AI_FUNCTION_TRIAL_PROCEDURE.md` | trial PASS | Orchestrator |
| L6.2 | DBR77 visual review across all 4 blocks | side-by-side with `color-system.md` | screenshot grid | Agent C |
| L6.3 | Menu 3 placement audit (final) | grep + visual | only correct buttons in right slot | Orchestrator |
| L6.4 | Word-canvas idiom parity (final) | side-by-side with Wordy | parity preserved | Agent C |
| L6.5 | Demo recording 5-min e2e | screen capture | recording attached | Agent D |
| L6.6 | Spec compliance audit (final) | line-by-line vs `Consultify Table Studio` spec | report attached | Orchestrator |

## Layer 7 — Security / Tenant

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L7.1 | Tenant resolution on every endpoint | code review + L4.7 | every endpoint reads `tenant_id` | Agent A |
| L7.2 | JWT-link tokens are scoped + time-bound | code review | exp ≤ 30 days; tenant in claims | Agent A |
| L7.3 | Public form rate limit | code review + L4.4 | 60 req/min per IP per token | Agent A |
| L7.4 | Conversion service ACL filter | code review | records actor cannot see are excluded from output | Agent A |
| L7.5 | Field allow-list enforced server-side | code review + L4.6 | client cannot bypass | Agent A |

## Layer 8 — Performance

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L8.1 | Convert 1k record table → Wordy | benchmark | < 10 s | Agent A |
| L8.2 | Public form submit p95 | benchmark | < 1 s | Agent A |

---

## Sprint Exit Gate

- [ ] L1.1–L1.6 GREEN
- [ ] L2.1–L2.3 GREEN
- [ ] L3.1–L3.5 GREEN
- [ ] L4.1–L4.7 GREEN
- [ ] L5.1–L5.3 GREEN
- [ ] L6.1–L6.6 RECORDED
- [ ] L7.1–L7.5 GREEN
- [ ] L8.1–L8.2 GREEN
- [ ] DoD checklist in `00_TASK_PACKET.md` §5 fully checked
- [ ] Anygravity P0 trial #2 PASS
- [ ] Final program closeout filed
- [ ] Release recommendation set
