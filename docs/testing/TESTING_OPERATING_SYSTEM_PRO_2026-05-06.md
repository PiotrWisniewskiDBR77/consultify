# Testing Operating System (Professional)

Status: active  
Applies to: `consultify` (all modules, with priority on AI Chat)

---

## 1) Purpose

This document defines one professional process for:
- test scope registry,
- scenario execution rules,
- evidence standards,
- release gate decisions,
- mandatory automation before manual testing,
- mandatory deployment after each manual testing round.

If a step here is skipped, the round is invalid.

---

## 2) Environments and login rules

### 2.1 Environments

| Env | URL | Use case | Data policy |
| --- | --- | --- | --- |
| Local | `http://127.0.0.1:3000` + API `:3001` | dev verification, fast debug | synthetic/demo only |
| Stage/Demo | `https://demo.consultify.ai` | official manual QA rounds | controlled tenant data |
| Production | production domain | release verification only | no destructive manual tests |

### 2.2 Login and account policy

Default QA account for demo rounds:
- User: `piotr.wisniewski@dbr77.com`
- Password: `<HASLO>`

Get/refresh known credentials:
- `npm run fix:credentials`

Rules:
1. Each tester logs in with an approved QA account only.
2. Tester records account + env at the start of each round.
3. No round result is valid without env+account traceability.

---

## 3) Test area registry (Master Register)

| Area ID | Area name | Priority | Owner | Required frequency |
| --- | --- | --- | --- | --- |
| AR-CHAT-01 | Basic chat quality and trust | P0 | QA + AI Team | every round |
| AR-CHAT-02 | Deep Thinking and Show Reasoning | P0 | QA + AI Team | every round |
| AR-CHAT-03 | Conversation history and folders | P0 | QA + Backend | every round |
| AR-CHAT-04 | Attachments and degraded behavior | P1 | QA + Backend | every round |
| AR-CHAT-05 | Web research source integrity | P1 | QA + AI Team | every round |
| AR-CHAT-06 | Product assistant usefulness | P1 | QA + Product | every round |
| AR-CHAT-07 | Follow-up context retention | P1 | QA + AI Team | every round |
| AR-CORE-01 | Auth/session/navigation baseline | P1 | QA + Frontend | daily |
| AR-CROSS-01 | Module tabs and command row integrity | P1 | QA + Frontend | daily |
| AR-SEC-01 | Tenant/access guardrails | P1 | QA + Backend | release candidate |

---

## 4) Required high-demand test scenarios

### 4.1 Chat scenario pack (must run, in order)

1. **S01 Basic DBR77 prompts**
   - Prompts:
     - `Opowiedz mi o DBR77`
     - `Podsumuj czym jest Consultify`
     - `Wyjasnij roznice miedzy DBR77 a Consultify`
   - Must pass:
     - no `Source ledger`, `Blocked scopes`, `rag_*`, `artifact:*`,
     - no `No cited sources` when citations are visible,
     - no random irrelevant sources.

2. **S02 Deep mode parity**
   - Same prompt in normal chat vs deep thinking/show reasoning.
   - Must pass:
     - no confirmation loop,
     - deep mode produces richer analysis than normal mode,
     - no raw JSON artifacts.

3. **S03 Real work steps**
   - competition prompt + product prompt + attachment prompt.
   - Must pass:
     - realistic processing narrative,
     - no fake status text,
     - clear uncertainty only when justified.

4. **S04 Attachment truthfulness**
   - one readable file + one broken/scanned PDF.
   - Must pass:
     - readable file is used,
     - broken file returns honest degraded state,
     - no hallucinated file analysis.

5. **S05 History durability**
   - create -> send -> switch -> back -> refresh -> rename -> folder -> refresh.
   - Must pass:
     - no loading loop,
     - no disappearing conversation,
     - rename and folder persist.

6. **S06 Product assistant quality**
   - prompts about real product modules and actions.
   - Must pass:
     - practical steps, product-grounded guidance,
     - no generic encyclopedia-style answer.

7. **S07 Follow-up context**
   - 3-5 chained prompts in one thread.
   - Must pass:
     - context preserved,
     - follow-up is logically connected.

### 4.2 Severity mapping

- `P0`: data loss/history broken, deep loop, fake success, raw internals visible.
- `P1`: poor source integrity, wrong product grounding, major UX regressions.
- `P2`: medium UX/copy issues without critical impact.
- `P3`: cosmetic issues.

---

## 5) Execution rules (manual rounds)

1. Use one official round ID, for example: `ROUND-CHAT-2026-05-06-01`.
2. Run scenarios in fixed order (`S01 -> S07`).
3. Capture evidence for each scenario:
   - UI screenshot,
   - Sources screenshot (if applicable),
   - Network screenshot (request + status + key fields).
4. Record status per scenario:
   - `PASS`, `BLOCKED_P0`, `BLOCKED_P1`, `INCONCLUSIVE`.
5. End round with one global verdict:
   - `GO`, `GO_WITH_RISK`, `NO-GO`.

---

## 6) Mandatory automation gate before manual testing

Manual testing cannot start until this gate is green.

### 6.1 Quick gate (developer pre-check, mandatory)

Run in `consultify`:

```bash
npm run lint
npm run type-check
npm run test:unit
```

### 6.2 Standard gate (mandatory before every manual round)

```bash
npm run test:integration
npm run test:runtime-gate
npm run test:aios:wave-1
npm run test:e2e:tier0
```

### 6.3 Optional extended gate (release candidate)

```bash
npm run test:e2e:smoke
npm run test:l4:auto
npm run test:security
```

If any mandatory command fails, manual round is blocked.

### 6.4 Official manual round gate (strict mode, required)

For official Antygravity manual rounds, run as much automation as available before manual:

```bash
npm run lint
npm run type-check
npm run test:all
npm run test:runtime-gate
npm run test:aios:retro
npm run test:e2e:smoke
npm run test:security
```

If environment/time allows, additionally run:

```bash
npm run test:l4:auto
npm run test:levels
```

Policy:
- strict mode failure => manual round cannot start,
- strict mode pass is recorded in round metadata.

---

## 7) Deploy-after-round enforcement (non-optional)

After each manual round:

1. Triage defects and assign severity (`P0/P1/P2/P3`).
2. Implement fixes in code.
3. Re-run automation gate (Quick + Standard, at minimum impacted tests).
4. Deploy latest fixes to demo/stage.
5. Run post-deploy smoke checks:
   - `npm run smoke:b02-chat-actions`
   - `npm run smoke:ai:research-ledger`
6. Start retest round only on that deployed build.

Hard rule:
- no retest on old build,
- no "manual-only fix confirmation" without redeploy.

---

## 8) Round registry template

Use this table for every round:

| Round ID | Build/Deploy ID | Env | Tester | Start | End | Global verdict |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

Scenario results:

| Scenario | Status | Defect ID(s) | Evidence path |
| --- | --- | --- | --- |
| S01 |  |  |  |
| S02 |  |  |  |
| S03 |  |  |  |
| S04 |  |  |  |
| S05 |  |  |  |
| S06 |  |  |  |
| S07 |  |  |  |

### Recorded rounds

| Round ID | Build/Deploy ID | Env | Tester | Start | End | Global verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `qa-chat-8-areas-20260506-0637` | pending deploy metadata | `demo.consultify.ai` | Owner/Admin | 2026-05-06 | 2026-05-06 | `GO` (with open P2) |

---

## 9) Defect record template

| Defect ID | Area | Severity | Repro | Expected | Actual | Owner | ETA | Retest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |

---

## 10) Decision policy

- `NO-GO`: any open `P0`, or 2+ open `P1`.
- `GO_WITH_RISK`: max 1 open `P1` with accepted fix deadline.
- `GO`: no open `P0/P1`, complete evidence set.

---

## 11) Ready-to-use tester prompt

```text
Wykonaj runde manualna ROUND-CHAT-<data>-<nr> na demo.consultify.ai po zalogowaniu kontem QA. Przejdz scenariusze S01-S07 w kolejnosci. Dla kazdego scenariusza zwroc: status PASS/BLOCKED_P0/BLOCKED_P1/INCONCLUSIVE, 2-4 zdania obserwacji, oraz evidence: UI screenshot, Sources screenshot (jesli dotyczy), Network screenshot. Oznacz osobno wszystkie przypadki: Source ledger, Blocked scopes, rag_*, artifact:*, No cited sources przy widocznych cytowaniach, nieklikalne lub nieadekwatne zrodla. Na koncu podaj globalny werdykt GO/GO_WITH_RISK/NO-GO oraz liste defektow P0/P1.
```

## 12) Round automation commands

Initialize round + run preflight:

```bash
npm run qa:chat:round -- --round-id ROUND-CHAT-YYYY-MM-DD-01 --tester "QA Name" --account "piotr.wisniewski@dbr77.com"
```

Validate completed round report:

```bash
npm run qa:chat:validate -- --file test-results/manual-rounds/ROUND-CHAT-YYYY-MM-DD-01/report.template.json
```

Generate closure report after successful validation:

```bash
npm run qa:chat:close -- --file test-results/manual-rounds/ROUND-CHAT-YYYY-MM-DD-01/report.template.json
```

Artifacts are generated in:
- `test-results/manual-rounds/<ROUND_ID>/report.template.json`
- `test-results/manual-rounds/<ROUND_ID>/report.template.md`
- `test-results/manual-rounds/<ROUND_ID>/report.template.validation.json`
- `test-results/manual-rounds/<ROUND_ID>/report.template.closure.json`
- `docs/testing/reports/CHAT_ROUND_CLOSURE_<timestamp>.md`

## 13) Daily impact campaigns

For focused development days (Interview/Initiatives/Tools + AI/Presentation/Context/Canvas),
use:
- `docs/testing/rounds/DAILY_IMPACT_TEST_PLAN_INTERVIEW_INITIATIVES_TOOLS_2026-05-06.md`

Core rule:
- every changed component must run mapped automated tests + mapped manual checks before deploy.

