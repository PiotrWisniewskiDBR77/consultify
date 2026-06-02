# 03 — Decisions Required (Product Approval)

Source: SSOT §12 (Open questions). Each decision below is a `proposal → approval → execution → audit` artifact per `.cursor/rules/00-core-execution.mdc`. Phase 1 cannot exit `PLANNED` until the three decisions are resolved.

Each card has: question, options, recommendation, blast radius, default if undecided.

## D-01 — Break-glass local prompt when Teresa is unavailable

### Question

If Teresa is offline / degraded, do we expose a per-module fallback prompt so the user can still operate the module's AI features?

### Options

- **A. No fallback.** Teresa down → AI features in modules are unavailable; user sees a clear "AI unavailable" banner per module. Single source of truth for AI input remains absolute.
- **B. Module-local emergency prompt** that appears only when Teresa health probe fails; clearly marked "Teresa offline — emergency mode"; audited; auto-hidden when Teresa recovers.
- **C. Read-only Teresa.** Teresa visible but accepts no input; user can review history; modules still cannot generate.

### Recommendation: **A. No fallback. (proposed)**

Rationale:
- Invariant §4.1 ("Jedna powierzchnia czatu") is binary. Adding a fallback input creates a second surface, even if conditional, and that surface will accumulate behavior over time. Two years from now we are back to the current debt with worse provenance because the fallback path is rarely exercised and tested.
- Outage frequency for the conversation surface is low; failure mode is recoverable. Operational cost of a fallback exceeds its rare benefit.
- Option B's auditing burden is non-trivial: every emergency-mode dispatch is a separate code path with its own ACL re-check and audit shape.
- Option C is acceptable as a *display* behavior of A, not a separate decision. We will display Teresa with an "input disabled" affordance during outages instead of removing her chrome.

### Blast radius if wrong

- A wrong → during a Teresa outage, modules cannot run AI generation; users wait for recovery.
- B wrong → silent two-surface drift returns; technical debt re-accumulates.
- C wrong → cosmetic only.

### Default if undecided

`A` is the safer default because it is forward-compatible with `B` (you can add a fallback later if data justifies it) but `B` is not reversible without breaking a contract once published.

### Approval block (filled by product)

```
Decision: ___
Decided by: ___
Date: ___
Notes: ___
```

## D-02 — Migration of existing module-local conversation threads

### Question

When Phase 2 removes module-local chats, what happens to threads that already exist inside `PrezentacjeView`, `WordyView`, `ExceleView`, `DeckBuilder/AgentPanel`?

### Options

- **A. Read-only legacy thread for 30 days, then archived.** The view continues to render the legacy thread as a non-editable history pane. After 30 days, threads are archived (recoverable from audit, not visible by default).
- **B. Merge into Teresa's main thread.** Each legacy thread is appended into the user's Teresa thread on first login post-migration, with a divider message "Legacy thread imported from {module}".
- **C. Discard.** Legacy threads are dropped; users start clean.
- **D. Keep indefinitely.** The history pane stays forever read-only.

### Recommendation: **A. Read-only 30 days, then archived. (proposed)**

Rationale:
- B is risky: thread merging changes message ordering, can leak context across artifacts, and inflates the resulting Teresa thread arbitrarily. It also creates ambiguity about who wrote what (user vs. AI vs. legacy AI).
- C destroys customer artifacts and breaks trust.
- D extends the deletion debate indefinitely and adds a permanent maintenance surface for a deprecated feature.
- A balances continuity (users can read what they had), audit (archived data still recoverable), and hygiene (the deprecated UI eventually goes away).

### Blast radius if wrong

- A wrong (too short window) → users complain a missing pane after 30 days; mitigation is "extend window" or "expose the archive UI". Cheap to fix.
- B wrong → thread corruption, user confusion, irreversible without restoring backups.
- C wrong → permanent data loss; legal / contractual implications for some customers.
- D wrong → frozen UI surface that violates §4.2 forever.

### Default if undecided

`A` is the safest. The 30-day window is configurable via a single config value, so the operational lever exists if extension is needed.

### Approval block (filled by product)

```
Decision: ___
Decided by: ___
Date: ___
Notes: ___
```

## D-03 — Conversation thread scope (per-user / per-project / per-org)

### Question

Today threads are scoped per user. As Teresa becomes the unified surface across modules and projects, what is the canonical scope?

### Options

- **A. Per-user (status quo).** One thread per user, regardless of project. Simple model; Teresa carries everything.
- **B. Per-user-per-project.** Switching project switches thread context. Threads are project-scoped objects. Cross-project work needs explicit thread switching.
- **C. Per-user-per-org.** Threads are org-scoped (relevant for users in multiple orgs).
- **D. Hybrid: per-user globally, per-project pinned context windows.** Single thread for the user, but Teresa's *system prompt scope* narrows to the active project; cross-project bleed is prevented at the prompt level even though the thread is one.

### Recommendation: **D — proceed with a hybrid: keep per-user thread storage (status quo), but introduce per-project scoping in the system prompt assembly during Phase 1.B (the binding work-packet itself). (proposed)**

Rationale:
- Pure per-user (A) violates project-data hygiene at scale: a user with two unrelated client projects ends up with cross-client context in one prompt, which is a confidentiality risk per `.cursor/rules/40-security-tenancy.mdc`.
- Per-project storage (B) breaks continuity for the very common "I'm just exploring across projects" workflow and forces visible thread switching that users will forget to do.
- Per-org storage (C) is too coarse and conflicts with the multi-tenancy model.
- D ("storage flat, scope smart") gives the best UX continuity without breaking confidentiality. Implementation: `ChatSurfaceContext` already knows the active project (from `WorkspaceContext`); the system prompt builder limits retrieval and tool capabilities to the active project even though the thread persistence is shared.

### Blast radius if wrong

- A wrong → cross-project leakage; potential customer trust incident.
- B wrong → fragmented UX; users complain "Teresa forgot what we discussed".
- C wrong → multi-org users get one thread for two orgs; confusion and a tenancy edge case.
- D wrong → moderate complexity in the system prompt builder; mitigation is a feature flag isolating the scoping logic.

### Default if undecided

`D` proposed. If product chooses A or B, Phase 1 still ships (storage shape doesn't change in Phase 1). The decision affects Phase 2 onward, so `D` can be re-evaluated at the Phase 1 → Phase 2 gate.

### Approval block (filled by product)

```
Decision: ___
Decided by: ___
Date: ___
Notes: ___
```

## Summary

| ID | Question | Proposed | Blocking Phase 1? |
|---|---|---|---|
| D-01 | Break-glass local prompt | A — No fallback | Yes |
| D-02 | Legacy thread migration | A — 30 days read-only → archived | Yes |
| D-03 | Thread scope | D — Per-user storage, per-project scope | Yes |

All three must be resolved before Phase 1 leaves `PLANNED`. The default-if-undecided values exist so a single missing approval does not block the rest, but every decision must have an explicit owner sign-off recorded above before merge.
