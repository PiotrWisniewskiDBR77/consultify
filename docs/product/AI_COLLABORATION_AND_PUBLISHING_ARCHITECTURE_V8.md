# AI Collaboration And Publishing Architecture v8

> Status: Draft v8
> Owner: Product + Engineering
> Cel: zdefiniowac kanoniczny model wspolpracy zespolowej, sharingu i publikowania wynikow AI.

---

## 1. Why this matters for Consultify

W biznesie wartosc AI nie konczy sie na odpowiedzi dla jednego usera.
Musi przechodzic w:

- wspoldzielona prace,
- review zespolowe,
- zarzadzane udostepnianie,
- publikowanie wynikow i artefaktow.

---

## 2. Leader patterns

Liderzy wzmacniaja:

- shareable conversations and folders,
- collaborative project spaces,
- persistent outputs that teams can revisit.

Imported lesson:

AI value compounds when outputs can move safely from personal space into team-visible work.

---

## 3. Current V8 coverage

Strong inputs:

- `CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`

Current gap:

- brak jednej architektury dla przejscia `personal -> shared -> published`, szczegolnie poza samym chatem.

---

## 4. Canonical target architecture

Canonical collaboration flow:

`private work -> reviewable share -> team-visible artifact or conversation -> published output -> governed archive`

Required objects:

- `ShareIntent`
- `VisibilityState`
- `PublishedArtifactRef`
- `CollaborationAuditEntry`

## 4.1 Leader-grade hardening requirements

This architecture must also define:

- exact differences between sharing a conversation, artifact, source pack and published output,
- inherited visibility rules from workspace and project contexts,
- review and retention semantics after publishing,
- collaboration-safe version traces when multiple users and AI contribute to one output.

### 4.2 Coordinated publish for paired outputs

> V8 Decision W6-12 applied — 2026-03-23

Report+presentation pairs support **coordinated publish** as a supported workflow mode. Both outputs also remain **independently publishable** when needed.

- Coordinated publish is a supported mode, not the only mode.
- Each output in a pair retains its own `reviewState` and `publishState`.
- Coordinated publish ensures both outputs are published together when the workflow requires it (e.g., board pack + board deck).
- Independent publish remains available for cases where only one output is needed or ready.

Canonical rule:

`independent by capability, coordinated by workflow`

### 4.3 Finance locked state

> V8 Decision W6-11 applied — 2026-03-23

Finance locked state extends the shared visibility and publish lifecycle — it is not a completely separate universe.

- Finance may have stricter module-specific lock semantics (e.g., budget version or forecast cycle frozen for review — no further edits allowed).
- These finance-specific restrictions map into the shared publish/review contract as a domain-specific gate between `editing` and `in_review`.
- The shared lifecycle remains canonical; finance adds restrictions within it, not outside it.

Canonical rule:

`shared lifecycle, finance-specific restrictions`

### 4.4 Output recall

> V8 Decision W6-13 applied — 2026-03-23

Output recall is a **required capability** for all published outputs.

- **Permission**: only authorized owners, reviewers, or publish-governance roles may recall a published output.
- **Explicit**: recall must be an explicit user action, never automatic or silent.
- **Auditable**: every recall creates a durable audit record (who recalled, when, why).
- **Stateful**: recalled output moves into a visible post-publish controlled state — it does not silently disappear.
- **Lineage preservation**: recall does not erase lineage. The output's history, provenance, and prior distribution records remain intact.

---

## 5. Contracts and boundaries

Module docs own local collaboration UX.

This document owns:

- the shared visibility lifecycle,
- how AI-generated outputs move from private to team-visible states,
- publishing semantics and audit expectations.

---

## 6. Risks and failure modes

- private AI outputs leak into team-visible state,
- published artifact lacks ownership or review context,
- conversations and artifacts use different sharing vocabulary,
- users do not know whether they are sharing source materials, outputs or both.

---

## 7. Implementation implications

- define one visibility lifecycle across chat and artifacts,
- standardize publish readiness and post-publish traceability,
- tie collaboration actions to role and scope policy,
- preserve source and review context when outputs are shared.

---

## 8. Acceptance criteria

- AI outputs can move from personal to shared states through a governed model.
- Users can tell whether they are sharing a conversation, artifact, source set or published output.
- Publishing preserves author, review and provenance trace.
- Collaboration vocabulary is consistent across AI surfaces.

---

## 9. Related canonical docs

- `docs/product/CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `docs/product/CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md`
- `docs/product/KNOWLEDGE_RAG_V8_SSOT.md`
- `docs/product/AI_LEADER_PARITY_ARCHITECTURE_V8.md`
