# 01 — Phase 1 Validation Matrix

Maps SSOT §9 (Quality Gates) to concrete test artifacts, owners, and run commands. Every row must be GREEN before Phase 1 closes.

Legend:
- **Type:** `unit` / `component` / `integration` / `e2e` / `static` / `manual`.
- **Scope:** the SSOT invariant it guards (sect §4 invariants 1–10).
- **Owner:** the role responsible for keeping the test green; not necessarily the agent who writes it.
- **State:** `planned` initially. Updated to `pass` / `fail` in `04_BLOCK_CLOSEOUT.md`.

## A. Binding contract — invariants §4.1, §4.5, §4.6

| ID | Type | Artifact (file path) | What it asserts | Owner | State |
|---|---|---|---|---|---|
| A1 | unit | `consultify/src/components/AIChat/teresaBinding/__tests__/useTeresaModuleBinding.test.ts` | Calling the hook with a payload sets `ChatSurfaceContext` to that payload synchronously after mount. | Frontend | planned |
| A2 | unit | same file | On unmount, the context is cleared in one effect tick (no stale `moduleKey` visible to a subsequent render). | Frontend | planned |
| A3 | unit | same file | Re-rendering with a changed `artifactId` updates the context exactly once and emits no duplicate suggestion entries. | Frontend | planned |
| A4 | unit | `consultify/src/components/AIChat/teresaBinding/__tests__/intentDispatcher.test.ts` | An intent in the active `capabilities` allowlist is dispatched to `onIntent` and produces an audit record of the documented shape. | Frontend | planned |
| A5 | unit | same file | An intent NOT in the allowlist is rejected, surfaces a user-visible failure (toast/role=alert), and emits a denial audit record. | Frontend / Sec | planned |
| A6 | component | `consultify/src/components/AIChat/teresaBinding/__tests__/ChatSurfaceContext.test.tsx` | A consumer rendered inside the provider receives the latest payload published by the hook. | Frontend | planned |

## B. Teresa surface integration — invariants §4.5, §4.6, §4.8

| ID | Type | Artifact (file path) | What it asserts | Owner | State |
|---|---|---|---|---|---|
| B1 | component | `consultify/src/components/AIChat/__tests__/UnifiedChatPanel.surface.test.tsx` | With flag OFF, the panel renders byte-identically to current snapshot (no chip row driven by registry). | Frontend | planned |
| B2 | component | same file | With flag ON and an active module binding, the chip row is driven by `suggestionRegistry`; chips correspond 1:1 to descriptors. | Frontend | planned |
| B3 | component | same file | Clicking a chip calls `intentDispatcher` with the chip's `intent` and `payload`; no direct call to `Api.post('/ai/...')` from the panel. | Frontend | planned |
| B4 | component | `consultify/src/components/AIChat/__tests__/ContextBadge.surface.test.tsx` | When `ChatSurfaceContext` is empty, existing badges (canvas etc.) render unchanged. | Frontend | planned |
| B5 | component | same file | When `ChatSurfaceContext` has `moduleKey` and `title`, a module badge renders with the i18n label (PL + EN locale fixtures verified). | Frontend / i18n | planned |

## C. Anti-regression on existing module surfaces — invariants §4.2, §4.3

| ID | Type | Artifact (file path) | What it asserts | Owner | State |
|---|---|---|---|---|---|
| C1 | integration | `consultify/src/components/AIChat/KimiWorkspace/__tests__/PrezentacjeView.no-new-chat-input.test.tsx` | The view tree contains zero new elements with `data-chat-surface="module-local"` after Phase 1 (snapshot guard against accidental local-chat additions). | Frontend / QA | planned |
| C2 | integration | analogous file in `WordyView` test folder | Same assertion for Wordy. | Frontend / QA | planned |
| C3 | integration | analogous file in `ExceleView` test folder | Same assertion for Excele. | Frontend / QA | planned |
| C4 | integration | analogous file in `TabeleView` test folder | Same assertion for Tabele. | Frontend / QA | planned |
| C5 | integration | `consultify/src/components/Presentations/DeckBuilder/__tests__/AgentPanel.no-new-input.test.tsx` | `AgentPanel` retains its current `<textarea>` (Phase 2 removes it) but no *additional* input is added in Phase 1. | Frontend / QA | planned |
| C6 | static | `scripts/lint/no-new-chat-input.ts` (existing or new lint task) | Repository grep gate: no new occurrences of `<EnhancedChatInput` outside `consultify/src/components/AIChat/`. | Frontend infra | planned |

## D. ACL and tenancy — invariant §4.10 + `40-security-tenancy.mdc`

| ID | Type | Artifact (file path) | What it asserts | Owner | State |
|---|---|---|---|---|---|
| D1 | integration | `consultify/src/components/AIChat/teresaBinding/__tests__/aclGuard.test.tsx` | A user denied access to `excele` cannot register an excele binding (the hook no-ops with a dev warning when `KimiModuleGate` rejects). | Sec / Frontend | planned |
| D2 | integration | same file | Even if a binding is somehow present, `intentDispatcher` re-checks ACL at dispatch time and rejects out-of-scope intents. Defense in depth. | Sec / Frontend | planned |
| D3 | unit | `consultify/src/components/AIChat/teresaBinding/__tests__/auditEmission.test.ts` | Every accepted and every rejected dispatch produces an audit record with the documented shape. No silent paths. | Sec | planned |

## E. End-to-end (Playwright) — invariants §4.1, §4.5, §4.6, §4.7

All E2E live under `consultify/e2e/teresa-unified-surface/`. Names match the SSOT §9 spec list.

| ID | Type | Artifact (file path) | What it asserts | Owner | State |
|---|---|---|---|---|---|
| E1 | e2e | `consultify/e2e/teresa-unified-surface/single-input-per-route.spec.ts` | With flag ON, every protected route still has *exactly one* visible chat input; the additional UI is a chip row, not a second input. | QA | planned |
| E2 | e2e | `consultify/e2e/teresa-unified-surface/cross-module-thread.spec.ts` | Navigating Wordy → Prezentacje preserves the Teresa thread (last user message visible after the route change). | QA | planned |
| E3 | e2e | `consultify/e2e/teresa-unified-surface/module-suggestion-chip-dispatch.spec.ts` | On `/prezentacje` with flag ON, clicking the "Skróć slajdy" chip results in a recorded intent in `PrezentacjeView`'s test harness `onIntent` log. | QA | planned |
| E4 | e2e | `consultify/e2e/teresa-unified-surface/flag-off-byte-identical.spec.ts` | With flag OFF, all four artifact routes render the same DOM as the current baseline (visual regression diff = 0). | QA | planned |

## F. i18n — invariant §4 (no untranslated keys)

| ID | Type | Artifact (file path) | What it asserts | Owner | State |
|---|---|---|---|---|---|
| F1 | static | `scripts/i18n/check-binding-keys.ts` | Every `labelKey` referenced by any module's `useTeresaModuleBinding` call exists in PL and EN locale files. CI-blocking. | i18n / Frontend | planned |
| F2 | component | `consultify/src/components/AIChat/__tests__/UnifiedChatPanel.i18n.test.tsx` | Switching app locale re-renders the chip row with localized labels. | i18n / Frontend | planned |

## G. Performance — invariant (implicit; SSOT §10 token bloat risk)

| ID | Type | Artifact (file path) | What it asserts | Owner | State |
|---|---|---|---|---|---|
| G1 | static | `scripts/perf/bundle-delta.ts` | Phase 1 increases `consultify/src/components/AIChat/**` bundle by < 2 KB gzipped. | Frontend perf | planned |
| G2 | manual | profiling note in `04_BLOCK_CLOSEOUT.md` | Provider re-renders on artifact change do not trigger Teresa input re-render (selector isolation verified with React DevTools Profiler). | Frontend | planned |

## H. Documentation — governance hygiene

| ID | Type | Artifact (file path) | What it asserts | Owner | State |
|---|---|---|---|---|---|
| H1 | manual | `DRD/consultify/docs/product/UNIFIED_CONVERSATION_SURFACE_TERESA_SSOT.md` §13 | Phase 1 closeout entry appended with date + commit + flag rollout note. | Product | planned |
| H2 | manual | `.cursor/SOURCE_OF_TRUTH_INDEX.md` | Cross-link to this packet present and ordered correctly. | Product | planned |
| H3 | manual | `DRD/consultify/docs/product/work-packets/follow-ups/TBL-FU-3_WORDY_EXCELE_PREZENTACJE_PRODUCTIONIZE.md` | Status note added: "Phase 1 binding live; module-local removal still pending Phase 2". | Product | planned |

## Ownership summary

- Frontend writes A, B, C tests and supplies the implementation under test.
- Sec reviews D and signs off A4/A5 audit shape.
- QA owns E (Playwright) and reviews C5/C6 anti-regression gates.
- i18n owns F.
- Frontend perf owns G.
- Product owns H.

## Run commands (placeholder — agent fills exact commands at execution time)

- Unit + component: `npm --workspace consultify run test -- teresaBinding`
- E2E: `npm --workspace consultify run e2e -- teresa-unified-surface`
- Static: `npm --workspace consultify run lint:no-new-chat-input && npm --workspace consultify run i18n:check-binding-keys`
- Bundle delta: `npm --workspace consultify run perf:bundle-delta -- AIChat`

Exact command names follow whatever `consultify/package.json` already exposes; if a script is missing it is added under `scripts/` and listed here in the closeout.
