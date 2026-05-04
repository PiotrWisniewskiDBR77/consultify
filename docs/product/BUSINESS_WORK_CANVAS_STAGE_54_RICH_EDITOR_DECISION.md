## Business Work Canvas Stage 54 Decision Gate

Status: `DECIDED / POST-GA EXECUTION`
Owner: Product + Engineering
Date: 2026-05-04

### Decision

Stage 54 is accepted as a decision gate and remains post-GA for execution.

- Canonical runtime stays Markdown-first with proposal/review controls.
- Rich editor runtime (TipTap/ProseMirror lane) is feature-flagged and not GA-critical.
- Collaboration features must not bypass proposal-first governance or capability checks.

### Why this decision is safe

- It preserves one source of truth for Canvas outputs (`contentMd` + markdown projection).
- It keeps compliance and review semantics enforceable in server workflows.
- It avoids shipping a second write model before Research/Tier1 runtime and telemetry are stable.

### Entry criteria to execute Stage 54 implementation

- Stage 51 (Research GA) and Stage 52 (Tier 1 runtime) are operationally stable.
- Stage 53 production testing and telemetry runbook are green in rollout evidence.
- Collaboration storage and conflict strategy are validated in integration + E2E.

### Implementation constraints

- Any rich editor representation must round-trip to Markdown projection deterministically.
- Inline suggestions/comments are advisory until explicit approval/apply operations.
- Feature flags must provide immediate rollback to Markdown-first shell.

### Exit criteria

- Rich editor produces no hidden business mutations.
- Governance APIs and capability denials behave identically to Markdown lane.
- Source-of-truth documentation and release checklist include explicit Stage 54 evidence.
