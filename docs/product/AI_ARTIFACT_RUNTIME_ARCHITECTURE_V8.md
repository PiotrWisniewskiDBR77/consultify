# AI Artifact Runtime Architecture v8

> Status: Draft v8
> Owner: Product + Engineering
> Cel: zdefiniowac kanoniczny runtime dla artefaktow tworzonych, edytowanych i handoffowanych przez AI.

---

## 1. Why this matters for Consultify

`consultify` ma byc systemem pracy, nie tylko rozmowy.
To oznacza, ze AI musi pracowac na artefaktach jako first-class objects:

- notatkach,
- raportach,
- prezentacjach,
- tabelach,
- taskach,
- decyzjach,
- initiative outputs.

---

## 2. Leader patterns

Leaders increasingly move value from thread answers into artifacts, canvases and persistent work products.

Imported lesson:

`answer -> draft -> reviewable artifact -> governed save/publish`

To jest mocniejszy model niz sam "response with copy button".

---

## 3. Current V8 coverage

Current strong inputs:

- `CHAT_V8_RICH_OUTPUT_AND_RENDERING.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `AGENT_EXECUTION_V8_SSOT.md`

Current gap:

- brak jednego cross-module runtime contract dla artifact draft, preview, ownership, versioning i publish readiness.

---

## 4. Canonical target architecture

Canonical artifact flow:

`AI output -> artifact draft -> preview diff -> review -> save/update -> version trace -> publish or continue editing`

Required objects:

- `ArtifactDraft`
- `ArtifactPreview`
- `ArtifactMutationIntent`
- `ArtifactVersionTrace`
- `ArtifactPublishState`

## 4.1 Leader-grade hardening requirements

This architecture must also define:

- consistent artifact diff semantics across notes, reports, tables and decks,
- concurrency and merge behavior when human edits and AI edits overlap,
- publish-readiness rules with review provenance,
- durable linkage from artifact version back to run, proposal and evidence set.

---

## 5. Contracts and boundaries

Module-specific SSOTs own domain structure of notes, decks, tables and reports.

This document owns:

- AI-facing artifact contract,
- cross-module draft lifecycle,
- traceability between conversational output and saved artifact state.

---

## 6. Risks and failure modes

- in-thread output and saved artifact drift apart,
- artifact is published without clear review state,
- preview lacks enough diff context,
- support cannot trace which run created which artifact version.

---

## 7. Implementation implications

- unify draft and preview vocabulary across modules,
- attach run and source provenance to artifact mutations,
- standardize save, update, fork and publish semantics for AI-generated work.

---

## 8. Acceptance criteria

- AI-created artifacts preserve source run and review trace.
- Artifact draft lifecycle is consistent across modules.
- Users can distinguish draft, approved update and published state.
- Artifact previews are reviewable before durable mutation.

---

## 9. Related canonical docs

- `docs/product/CHAT_V8_RICH_OUTPUT_AND_RENDERING.md`
- `docs/product/CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `docs/product/AGENT_EXECUTION_V8_SSOT.md`
- `docs/product/AI_LEADER_PARITY_ARCHITECTURE_V8.md`
