# AI Human In The Loop Governance Architecture v8

> Status: Draft v8
> Owner: Product + Engineering
> Cel: zdefiniowac kanoniczny model roli czlowieka w review, approval, escalation i override dla pracy AI.

---

## 1. Why this matters for Consultify

W systemie biznesowym AI nie moze byc ani calkowicie zablokowane, ani calkowicie autonomiczne.
Potrzebny jest dojrzaly model:

- kiedy AI proponuje,
- kiedy czlowiek zatwierdza,
- kiedy wystarcza polityka,
- kiedy trzeba eskalacji.

---

## 2. Leader patterns

Leaders increasingly separate:

- conversational help,
- bounded autonomous work,
- explicit approvals for meaningful mutations.

Imported lesson:

human oversight should be selective, visible and proportional to risk.

---

## 3. Current V8 coverage

Strong inputs exist in:

- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `CHAT_V8_WORKFLOW_MODEL.md`
- `AGENT_EXECUTION_V8_SSOT.md`
- `AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`

Current gap:

- brak jednej architektury, ktora spina `risk-based approval`, `batch approvals`, `escalation`, `policy-approved actions` i `override trace`.

---

## 4. Canonical target architecture

Canonical human-in-the-loop chain:

`AI proposes -> system classifies risk -> policy decides approval path -> human reviews when required -> execution or rejection -> audit`

Required objects:

- `ApprovalClass`
- `HumanReviewCheckpoint`
- `EscalationReason`
- `PolicyApprovedAction`
- `OverrideAuditEntry`

## 4.1 Leader-grade hardening requirements

This architecture must also define:

- when approval can be batched vs when step-level approval is mandatory,
- escalation rules for destructive, cross-scope or policy-sensitive actions,
- substitute approver and delayed-approval semantics for long-running work,
- one shared distinction between `human-approved`, `policy-approved`, `blocked` and `expired approval`.

---

## 5. Contracts and boundaries

`Chat` and `Execution` docs own local workflow UX.

This document owns:

- shared approval doctrine,
- how risk maps to review requirements,
- when policy can stand in for immediate human review,
- how overrides and escalations are recorded.

---

## 6. Risks and failure modes

- too many approvals make AI unusable,
- too few approvals make mutations unsafe,
- multi-step run requires repeated low-value confirmation,
- support cannot tell whether a change was human-approved or policy-approved.

---

## 7. Implementation implications

- define shared approval classes by risk and reversibility,
- support batch approval for low-risk coherent proposal sets,
- require explicit escalation for sensitive, cross-scope or destructive actions,
- preserve one audit vocabulary for human and policy gates.

---

## 8. Acceptance criteria

- Approval rules are consistent across chat and execution surfaces.
- Similar risk classes trigger similar review semantics.
- Operators can distinguish human approval, policy approval and denied actions.
- HITL adds control without breaking high-velocity low-risk workflows.

---

## 9. Related canonical docs

- `docs/product/CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `docs/product/CHAT_V8_WORKFLOW_MODEL.md`
- `docs/product/AGENT_EXECUTION_V8_SSOT.md`
- `docs/product/AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`
- `docs/product/AI_LEADER_PARITY_ARCHITECTURE_V8.md`
