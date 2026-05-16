# V10 Expanded Canvas - KIMI Lane Decision

Status: `APPROVED_FOR_PLANNING`
Date: 2026-05-01
Scope: Wordy, Excele, Prezentacje, Expanded Canvas runtime
Source: `consultify/docs/AI_dev_fin.md` section `2C.2`

## Decision

Wordy, Excele and Prezentacje should not become three separate product runtimes. They are specialized canvases inside the V10 Expanded Canvas direction:

- `DocumentCanvas` for Wordy;
- `SheetCanvas` for Excele;
- `DeckCanvas` for Prezentacje.

The shared runtime remains:

```text
Conversation -> Canvas Draft -> Artifact Version -> Business Object -> Workflow/Audit
```

## Current Truth

- KIMI-style components and pipeline exist in code:
  - `KimiWorkspaceShell`;
  - `WordyView`;
  - `ExceleView`;
  - `PrezentacjeView`;
  - `useKimiArtifactPipeline`.
- The pipeline already consumes V8 artifact runs for document, sheet and presentation style outputs.
- The public routes `/wordy`, `/excele`, and `/prezentacje` are currently gated through `V4ComingSoonView`.

This means the runtime direction exists, but product availability is not the same as component existence.

## Route Posture

Target route model:

```text
/ai/work-canvas?kind=document -> Wordy / DocumentCanvas
/ai/work-canvas?kind=sheet -> Excele / SheetCanvas
/ai/work-canvas?kind=deck -> Prezentacje / DeckCanvas
```

Legacy branded routes may stay, but each must do one of three honest things:

1. Redirect to the corresponding Expanded Canvas kind.
2. Wrap the shared Expanded Canvas runtime.
3. Show a clear gated/coming-soon state.

They must not claim production availability while rendering a gated shell.

## Runtime Rules

- No second artifact registry.
- No second document/sheet/deck lifecycle.
- No silent apply for Excele-style sheet changes.
- No Excel/Google Sheets parity claim for Excele.
- No hidden writes from chat chips.
- Every durable output must have artifact identity, version, provenance and read-back.
- Every business mutation must go through proposal-first approval.

## Product Implication

Expanded Canvas is the primary consulting workspace. Wordy, Excele and Prezentacje are capability lanes inside that workspace, not competing applications.

This preserves the strongest KIMI pattern: chat-left, work-right, progress visible, export available, but applies Consultify's consulting governance: sources, approvals, roles, audit and tenant boundaries.

## Acceptance Check

The KIMI lane decision is satisfied when:

- the V10 docs name Wordy/Excele/Prezentacje as specialized canvases;
- gated routes remain honest until intentionally unlocked;
- active lanes use shared artifact/provenance/approval rules;
- test pack includes route checks for `/wordy`, `/excele`, `/prezentacje` and `/ai/work-canvas?kind=*`;
- Excele remains a bounded deliverable sheet lane, not a BI suite, ETL product or Tables OS.
