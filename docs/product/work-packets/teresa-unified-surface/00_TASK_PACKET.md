# 00 — Phase 1 Task Packet

**Phase:** 1 — Binding layer for the Unified Conversation Surface (Teresa)
**Owning SSOT:** `DRD/consultify/docs/product/UNIFIED_CONVERSATION_SURFACE_TERESA_SSOT.md` (canonical; this packet defers to it on every conflict)
**Template:** `.cursor/TASK_PACKET_TEMPLATE.md`

## 1) Goal

Make Teresa context-aware of the active module and artifact, and let modules publish suggested actions and intent handlers to her, **without removing any existing module-local UI**. After Phase 1, every module view registers itself with Teresa via a single hook; Teresa renders module-specific suggestion chips above her input and routes triggered intents back to the registering module. Module-local prompts and "Agent AI" panels remain on screen — they are removed in Phase 2.

The success state of Phase 1 is: an agent picking up Phase 2 (Prezentacje cutover) has a stable contract to delete the local prompt against. Without Phase 1, Phase 2 cannot ship without a regression in deck generation.

## 2) Non-Goals

- **Do not remove** module-local prompt fields in `PrezentacjeView`, `WordyView`, `ExceleView`, `TabeleView`. Removal is Phase 2+ scope.
- **Do not remove** `DeckBuilder/AgentPanel`. Conversion to passive history view is Phase 2 scope.
- **Do not change** `useKimiArtifactPipeline` public API. Re-routing it through Teresa is Phase 2 scope.
- **Do not** rewrite `TeresaIntentRouter` from scratch. Phase 1 only extends existing intent detectors with module-aware dispatch metadata.
- **Do not** introduce a new chat thread model, persistence schema, or backend route. Phase 1 is frontend-only.
- **Do not** touch `TeresaVoiceContext` or voice routing.
- **Do not** add a new tenant/scope dimension to threads (per-project / per-org). That decision is captured in `03_DECISIONS_REQUIRED.md` and follows in Phase 1.B once approved; it is not a Phase 1.A blocker.

## 3) Constraints

### Technical

- Frontend-only. Zero backend changes. Zero new API endpoints. Zero migrations.
- Additive code only. No deletions of existing components, props, or state shapes in Phase 1.
- Must be feature-flag-gated through existing `chatV9FeatureFlags` so partial rollout and rollback are one-line operations.
- The new `ChatSurfaceContext` must be implemented as a lightweight React provider mounted once in `MainLayout` / `SplitLayout`, not via Redux, to avoid cross-cutting state migrations in Phase 1.
- `useTeresaModuleBinding` must clean up on unmount in a single tick (test required) — stale suggestions from a closed view must not appear in Teresa.
- TypeScript strict; no `any`. Public types live in `consultify/src/components/AIChat/types/teresaBinding.ts`.

### Product / UX

- Behavior with the feature flag OFF must be byte-identical to current state.
- With the flag ON: Teresa's `ChatSmartSuggestions` row reflects the active module's suggestions; `ContextBadge` shows the active module + artifact; module-local prompts continue to work unchanged.
- Suggestion chips published by modules must be data (id + i18n label key + intent payload), not React nodes. Teresa renders them in her uniform style.
- No auto-prompt injection on view enter. If a module wants an "onboarding line", it publishes it as a *suggestion*, not as a hidden first message.
- i18n: every `labelKey` published by a module must exist in PL and EN locale files; missing keys fail validation.

### Safety / Security

- Capabilities published by a module are an *allowlist*. Teresa's intent router must reject any intent not in the active `capabilities` array (deny-by-default per `.cursor/rules/40-security-tenancy.mdc`).
- ACL: `KimiModuleGate` (existing) must be honored at the binding registration call site — a module the user cannot access cannot register suggestions or intent handlers in Teresa.
- Audit: every intent dispatched via Teresa to a module emits a structured audit record `{ moduleKey, artifactKind, artifactId, intent, actor, ts }`. No silent calls.
- No telemetry of message content beyond what current Teresa already emits. Phase 1 is not the place to add new telemetry.

## 4) Scope

### Files in scope (Phase 1 will touch these)

New files (additive):

- `consultify/src/components/AIChat/teresaBinding/ChatSurfaceContext.tsx` — React provider holding `{ moduleKey, artifactKind, artifactId, title, capabilities, suggestions, onIntent }` for the active module. One mount in the app shell.
- `consultify/src/components/AIChat/teresaBinding/useTeresaModuleBinding.ts` — hook the modules call to register/unregister themselves with the context.
- `consultify/src/components/AIChat/teresaBinding/suggestionRegistry.ts` — pure-data store mapped from active context. Subscribed by `ChatSmartSuggestions` and `ContextBadge`.
- `consultify/src/components/AIChat/teresaBinding/intentDispatcher.ts` — dispatch helper that validates an intent against the active `capabilities` allowlist and emits the audit record before invoking `onIntent`.
- `consultify/src/components/AIChat/types/teresaBinding.ts` — public types (`ModuleKey`, `ArtifactKind`, `Capability`, `SuggestionDescriptor`, `IntentPayload`, `BindingResult`).
- `consultify/src/components/AIChat/teresaBinding/__tests__/useTeresaModuleBinding.test.ts` — unit (registration, cleanup-in-one-tick, capability deny-by-default).
- `consultify/src/components/AIChat/teresaBinding/__tests__/intentDispatcher.test.ts` — unit (allowlist enforcement, audit emission).
- `consultify/src/components/AIChat/teresaBinding/__tests__/ChatSurfaceContext.test.tsx` — component (provider + consumer round-trip).

Edits to existing files (extension only, no behavior change with flag OFF):

- `consultify/src/components/AIChat/UnifiedChatPanel.tsx` — read suggestions from `ChatSurfaceContext` *only when flag is ON*; fall through to existing source otherwise.
- `consultify/src/components/Chat/ChatSmartSuggestions.tsx` — accept an optional `descriptors` prop driven by `suggestionRegistry`; render unchanged when not provided.
- `consultify/src/components/AIChat/ContextBadge.tsx` — extend to render `moduleKey` + `artifactKind` + `title` chips when present in `ChatSurfaceContext`. Existing badges unchanged.
- `consultify/src/utils/chatV9FeatureFlags.ts` — add `teresaUnifiedSurfaceBinding` flag, default OFF.
- `consultify/src/layouts/MainLayout.tsx` and `consultify/src/components/layout/SplitLayout.tsx` — mount `ChatSurfaceContext` provider once at the highest layout that always renders Teresa.
- i18n locale files — add `prezentacje.suggest.*`, `wordy.suggest.*`, `excele.suggest.*`, `tabele.suggest.*` keys (PL + EN). No copy in views; copy lives only in locale files.

Documentation edits:

- `DRD/consultify/docs/product/UNIFIED_CONVERSATION_SURFACE_TERESA_SSOT.md` — append to §13 (Audit trail) the Phase 1 closeout link when Phase 1 is done.
- `.cursor/SOURCE_OF_TRUTH_INDEX.md` — add cross-link to this packet under the SSOT entry.

### Files explicitly out of scope (Phase 1 must NOT modify)

- `consultify/src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/WordyView.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/ExceleView.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts`
- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` — propeller surface stays untouched in Phase 1; prop pruning is Phase 5.
- `consultify/src/components/Presentations/DeckBuilder/AgentPanel.tsx`
- `consultify/src/components/AIChat/TeresaProposalCard.tsx` — used as-is for Phase 2, no changes in Phase 1.
- Any backend service or API route.

The boundary is hard. A PR that touches a file in this list under the Phase 1 work-packet is rejected without review.

### Where the binding **call sites** are added

Phase 1 adds *one binding call* per artifact-bearing view, *as a no-op subscription*: the view declares its `moduleKey + artifactKind + artifactId + capabilities + suggestions + onIntent` so Teresa is aware of context. The view continues to render its existing local prompt; the binding is silent until the feature flag is ON. Adding the binding call is permitted in:

- `PrezentacjeView.tsx` — single call to `useTeresaModuleBinding` near the top, no other changes.
- `WordyView.tsx` — same.
- `ExceleView.tsx` — same.
- `TabeleView.tsx` — same.

These additions are **not** "modifications to module behavior". They are pure context publishing. A view's render output, props, hooks, and side-effects must be byte-identical with the flag OFF. With the flag ON, the only externally visible difference is what Teresa shows on the left.

## 5) Definition of Done

### Functional

- `ChatSurfaceContext` provider is mounted in `MainLayout` (and applicable nested layouts) and exposes the active module's binding payload.
- `useTeresaModuleBinding` is callable from a module view; calling it (a) sets context, (b) on unmount clears it within one effect tick.
- `ContextBadge` renders module + artifact context chip when context is present.
- `ChatSmartSuggestions` renders chips from `suggestionRegistry`; click on a chip dispatches an intent through `intentDispatcher`.
- `intentDispatcher` rejects any intent not declared in the active `capabilities`. Rejection is visible (toast + audit log entry); no silent failure.
- All four artifact views (`PrezentacjeView`, `WordyView`, `ExceleView`, `TabeleView`) call `useTeresaModuleBinding` with their `moduleKey + artifactKind + capabilities + suggestions`. Their `onIntent` for Phase 1 may simply log "intent received but not yet wired" — wiring to the actual pipeline is Phase 2+.
- Feature flag `teresaUnifiedSurfaceBinding` toggles the entire Phase 1 surface: OFF = byte-identical to current behavior; ON = chips + badge + dispatch.

### Validation / Tests

All rows in `01_VALIDATION_MATRIX.md` are GREEN. At minimum:

- Unit: `useTeresaModuleBinding` registration / cleanup-in-one-tick / re-register on artifact id change.
- Unit: `intentDispatcher` allowlist enforcement; audit record shape.
- Component: `UnifiedChatPanel` renders chips from registry; click dispatches intent.
- Component: `ContextBadge` renders module + artifact chip when context present; renders existing badges unchanged when absent.
- Integration: snapshot guard on `PrezentacjeView`, `WordyView`, `ExceleView`, `TabeleView`, `DeckBuilder` ensures no new `<textarea>` / `<input type="text">` with `data-chat-surface` attribute is added in Phase 1 (anti-regression).
- E2E (Playwright): with flag ON, opening `/prezentacje` shows module suggestion chips in Teresa; clicking a chip emits an intent that the view's `onIntent` records (visible test hook). With flag OFF, no chips and no badge.
- ACL: a user without access to `excele` who navigates to a context that would publish excele suggestions does not see them, and `intentDispatcher` rejects excele intents.
- Cross-module thread: switching between two artifact views in the same session preserves the conversation thread (no thread reset).

### Evidence expected in `04_BLOCK_CLOSEOUT.md`

- Test run output (paths, counts, failures = 0).
- Bundle size delta (must be <2 KB gzipped for the binding code; Phase 1 is small).
- Screenshots: `/prezentacje` with flag OFF (unchanged) and with flag ON (chips + badge visible, local prompt still visible).
- Audit log sample: at least one intent dispatch record showing `{ moduleKey, artifactKind, artifactId, intent, actor, ts }`.
- Feature flag rollout plan: who flips it, where, with what guardrails.
- Sign-off from QA owner (validation matrix) and product owner (decisions in `03_DECISIONS_REQUIRED.md`).

## 6) Risk Notes

See `02_RISK_REGISTER.md` for full register. Highlights:

- **R1 — Phase 1 must precede Phase 2.** If a parallel agent removes module-local prompts before this packet ships, deck generation breaks. Mitigation: SSOT §11 gate is in place; reviewers are instructed to reject such PRs.
- **R2 — Provider mount placement.** Wrong mount position (too low) means Teresa loses context on route transitions. Mitigation: mount at `MainLayout` and verify with cross-route E2E.
- **R3 — Feature flag drift.** A partial enable (badge ON, suggestions OFF) creates UI inconsistency. Mitigation: single flag governs the entire surface; no sub-flags in Phase 1.
- **R4 — i18n debt.** Suggestion `labelKey`s without translations leak raw keys to UI. Mitigation: i18n validation script runs in CI before merge.
- **R5 — Cleanup correctness.** A module that doesn't unregister on unmount leaks stale suggestions. Mitigation: dedicated unit test, lint rule for forgotten cleanup.

### Rollback

- Set `teresaUnifiedSurfaceBinding` flag OFF. The app reverts to current behavior in one config change.
- If the additive code itself causes a regression (e.g., provider crash), revert the merge commit. No data migration is involved, no schema change, no API contract change.

## 7) Acceptance gate (Phase 1 → Phase 2 readiness)

Phase 2 (Prezentacje cutover) cannot start until:

1. This packet's DoD is GREEN.
2. The feature flag has been ON in staging for at least 48 hours with no Sev-1 / Sev-2 incidents.
3. `03_DECISIONS_REQUIRED.md` is fully resolved (all three open questions closed).
4. A Phase 2 packet exists under `work-packets/teresa-unified-surface/phase-2-prezentacje/` with its own task packet, validation matrix, and risk register. Phase 2 is not a continuation file in this packet.

If any of these are RED, Phase 2 stays in `PLANNED` even if Phase 1 is `DONE`.
