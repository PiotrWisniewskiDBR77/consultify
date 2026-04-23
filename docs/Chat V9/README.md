# Chat V9 — index (develop branch, 2026-04-18)

This folder is intentionally **narrow**: it documents what is actually
shipped on this branch, not the full Chat V9 roadmap. Earlier sessions
produced a much larger doc set (audits, implementation plans, owner
runbooks) that did not land on `develop` alongside the code. Rather than
carry dead references, we keep this README pointing only to files that
exist and describe features with live code behind them.

> **On-call? Reading this during an incident?** Go straight to the
> [Chat V9 operations runbook](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md).
> It codifies the kill-switch paths, rollback patterns, and known
> failure modes in one place. Every shipped V9 feature can be
> disabled in **under 30 seconds** without a redeploy.

## Shipped and tracked

| Block | Ticket | Feature | Flag | Registered | Docs |
|---|---|---|---|---|---|
| Voice | **VM3** | Voice modes legend popover | `voice-mode-legend` | ✅ | [plan](./VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#vm3), [telemetry](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md#voice_mode_legend_opened) |
| Voice | **VM3.1** | Voice legend keyboard shortcut (`Alt+Shift+V`) | `voice-legend-shortcut` | ✅ | [plan](./VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#vm3-1), [telemetry](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md#voice_mode_legend_shortcut) |
| Voice | **VM3.2** | Voice legend · "Copy legend" button | `voice-legend-copy-text` | ✅ | [plan](./VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#vm3-2) |
| Voice | **VM1-lite** | "Voice unavailable" fallback row inside VM3 | (uses `voice-mode-legend`) | ✅ | [plan](./VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#vm1-lite) |
| Trust | **T-PM1** | Private Mode details popover | `private-mode-details` | ✅ | [plan](./TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-pm1), [telemetry](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md#private_mode_details_opened) |
| Trust | **T-TR1** | AI response trust badge | `trust-badge` | ✅ | [plan](./TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr1), [telemetry](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md#trust_badge_opened) |
| Trust | **T-TR1.2** | Trust badge model label humanizer | `trust-badge-humanize-model` | ✅ | [plan](./TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr1-2) |
| Trust | **T-TR1.3** | Trust badge copy citations button | `trust-badge-copy-citations` | ✅ | [plan](./TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr1-3) |
| Trust | **T-TR1.4** | Trust badge copy reasoning button | `trust-badge-copy-reasoning` | ✅ | [plan](./TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr1-4) |
| Trust | **T-TR3-lite** | Trust badge per-citation clickable link | `trust-badge-citation-links` | ✅ | [plan](./TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr3-lite) |
| Trust | **T-TR3.4** | Trust badge citation row · domain pill | `trust-badge-citation-domain` | ✅ | [plan](./TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr34) |
| Trust | **T-TR2** | Trust badge "Why this answer?" reasoning snippet | `trust-badge-reasoning` | ✅ | [plan](./TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-tr2) |
| Trust | **T-PM2-lite** | Post-send PII heuristic toast | `pii-heuristic-toast` | ✅ | [plan](./TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-pm2-lite), [telemetry](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md#pii_heuristic_warning_shown) |
| Trust | **T-PM2.1** | PII toast · "Don't show again this session" | `pii-heuristic-session-dismiss` | ✅ | [plan](./TRUST_SECURITY_EXPLAINABILITY_DEVELOPMENT_PLAN_2026-04-18.md#t-pm2-lite-v11) |
| Voice | **VM4** | Barge-in acknowledgement toast | `barge-in-toast` | ✅ | [plan](./VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#vm4), [telemetry](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md#voice_barge_in_notified) |
| Voice | **VM10** | Voice funnel telemetry | `voice-funnel-telemetry` | ✅ | [plan](./VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#vm10), [telemetry](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md#voice-funnel-vm10) |
| Admin | **AG1 v1** | Feature flag control panel (URL + role-gated) | _(role-gated, URL query)_ | ✅ | [plan](./ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v1) |
| Admin | **AG1 v1.1** | Override indicator chip | _(role-gated, auto-hides at 0 overrides)_ | ✅ | [plan](./ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v11) |
| Admin | **AG1 v1.2** | Copy-snapshot button in flags panel | `flags-snapshot-copy` | ✅ | [plan](./ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v12) |
| Admin | **AG1 v1.3** | URL reset one-liner (`?v9flags=reset`) | `flags-reset-url` | ✅ | [plan](./ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v13) |
| Admin | **AG1 v1.5** | Admin flag panel filter input | `flags-panel-filter` | ✅ | [plan](./ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v15) |
| Admin | **AG1 v1.6** | Admin flag panel collapsible block groups | `flags-panel-grouping` | ✅ | [plan](./ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v16) |
| Admin | **AG1 v1.7** | Admin flag panel · per-row spec-doc breadcrumb | `flags-panel-doc-links` | ✅ | [plan](./ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v17) |
| Admin | **AG1 v1.8** | Admin flag panel · per-flag description expansion toggle | `flags-panel-description-expand` | ✅ | [plan](./ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v18) |
| Admin | **AG1 v1.9** | Admin flag panel · sticky block-group headers | `flags-panel-sticky-group-headers` | ✅ | [plan](./ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v19) |
| Admin | **AG1 v1.10** | Admin flag panel · per-row keyboard shortcuts (`o`/`f`/`d`) | `flags-panel-row-shortcuts` | ✅ | [plan](./ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v110) |
| Admin | **AG1 v1.11** | Admin flag panel · header shortcut cheat-sheet pill | `flags-panel-shortcut-cheat-sheet` | ✅ | [plan](./ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v111) |
| Admin | **AG1 v1.12** | Admin flag panel · "Copy override URL" button | `flags-panel-override-url-copy` | ✅ | [plan](./ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v112) |
| Admin | **AG1 v1.13** | Admin flag panel · Escape clears the filter input | `flags-panel-filter-escape-clear` | ✅ | [plan](./ADMIN_PRODUCT_GOVERNANCE_DEVELOPMENT_PLAN_2026-04-18.md#ag1-v113) |
| Input | **C-IN1** | Next-message model hint chip | `next-model-chip` | ✅ | [plan](./INPUT_CONTROL_DEVELOPMENT_PLAN_2026-04-18.md#c-in1) |
| Input | **C-IN2** | Input character counter pill | `input-char-counter` | ✅ | [plan](./INPUT_CONTROL_DEVELOPMENT_PLAN_2026-04-18.md#c-in2) |
| Input | **C-IN4-lite** | Input keyboard-hint strip | `input-hint-strip` | ✅ | [plan](./INPUT_CONTROL_DEVELOPMENT_PLAN_2026-04-18.md#c-in4-lite) |
| Input | **C-IN6-lite** | Input soft-limit inline toast (rose threshold nudge) | `input-soft-limit-toast` | ✅ | [plan](./INPUT_CONTROL_DEVELOPMENT_PLAN_2026-04-18.md#c-in6-lite) |
| Navigation | **NAV-M1** | Back-to-chat floating button | `back-to-chat-button` | ✅ | [plan](./NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m1), [telemetry](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md#navigation_back_to_chat_clicked) |
| Navigation | **NAV-M1.1** | Back-to-chat keyboard shortcut (`Alt+Shift+C`) | `back-to-chat-shortcut` | ✅ | [plan](./NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m1-1), [telemetry](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md#navigation_back_to_chat_shortcut) |
| Navigation | **NAV-M2-lite** | Workspace breadcrumb pill | `workspace-breadcrumb` | ✅ | [plan](./NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m2-lite) |
| Navigation | **NAV-M2.1** | Workspace breadcrumb · conversation title segment | `workspace-breadcrumb-conversation` | ✅ | [plan](./NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m2-lite-plus) |
| Navigation | **NAV-M3** | Workspace breadcrumb · recent conversations dropdown | `workspace-breadcrumb-recents` | ✅ | [plan](./NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m3-lite) |
| Navigation | **NAV-M3.1** | Workspace breadcrumb · pinned conversations first | `workspace-breadcrumb-recents-pinned` | ✅ | [plan](./NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m3-lite-plus) |
| Navigation | **NAV-M3.2** | Workspace breadcrumb · "View all" recents footer | `workspace-breadcrumb-recents-view-all` | ✅ | [plan](./NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m3-lite-plus-plus) |
| Navigation | **NAV-M3.3** | Workspace breadcrumb · recents dropdown arrow-key navigation | `workspace-breadcrumb-recents-arrow-keys` | ✅ | [plan](./NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m3-lite-v3) |
| Navigation | **NAV-M3.4** | Workspace breadcrumb · recents trigger ArrowDown shortcut | `workspace-breadcrumb-recents-trigger-arrow` | ✅ | [plan](./NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m34) |
| Navigation | **NAV-M3.5** | Workspace breadcrumb · recents trigger ArrowUp shortcut | `workspace-breadcrumb-recents-trigger-arrow-up` | ✅ | [plan](./NAVIGATION_INFORMATION_ARCHITECTURE_DEVELOPMENT_PLAN_2026-04-18.md#nav-m35) |

Every flag above:

- Defaults to **ON** on `develop`.
- Ships behind an individual per-feature helper in `src/utils/*Flag.ts`.
- Follows the resolution order `URL query > localStorage > env > default`.
- Is listed in `src/utils/chatV9FeatureFlags.ts` (`CHAT_V9_FLAGS`) so the
  same metadata is queryable at runtime.

## Design-phase (Chat V10)

The following dev plans are **design-phase** for Chat V10 blocks. They live
in this folder intentionally so the flag registry and the master plan can
link to them with stable relative paths:

- [`REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md`](./REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md)
- [`FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md`](./FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md)
- [`AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md`](./AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md)
- [`ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md`](./ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md)
- [`ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md`](./ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md)
- [`DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md`](./DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md)
- [`ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md`](./ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md)
- [`ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md`](./ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md)

## Operations runbook

Incident response, kill-switch order-of-operations, recovery after a
bad rollout, and the "copy-reproduce-apply" workflow for sharing an
override set between operators all live in a single document:

- **[`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)**

Reach for the runbook first during an S0/S1 incident; reach for the
cheat sheets below when you already know the flag id.

## Contributor guide

Adding a new V9 feature? Read the end-to-end recipe first — every
step below is enforced by a test, so a skipped step means a broken
PR:

- **[`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)**

The guide is the contract: naming convention, resolver scaffold,
registry descriptor, README cheat-sheet updates, telemetry PII
rules, and the PR checklist that keeps CI green.

## CI-enforced invariants

Every item below is asserted by a test in CI; if a PR violates one, CI
goes red and the PR cannot merge. This exists so a tired reviewer at
23:00 doesn't have to remember a 12-item checklist by heart — the
pipeline remembers for them.

| # | Invariant | Guard lives in |
|---|---|---|
| 1 | Every `CHAT_V9_FLAGS` entry has a unique `id`, localStorage key, URL query key, env key, and **ticket code**. | `chatV9FeatureFlags.test.ts` |
| 2 | Every id is kebab-case; every ticket matches `[A-Z]+(-[A-Z]+)?\d+(\.\d+)?`. | `chatV9FeatureFlags.test.ts` |
| 3 | Every key uses the documented prefix (`ff.` / `ff_` / `VITE_`) **and** the word sequence underneath all three keys is identical across casings. | `chatV9FeatureFlags.test.ts` |
| 4 | Every declared `block` is in the closed universe (`voice`, `trust`, `navigation`, `input`, `admin`). | `chatV9FeatureFlags.test.ts` |
| 5 | Every `specDocs` path points at a file that exists on disk. | `chatV9FeatureFlags.test.ts` |
| 6 | Every declared `telemetry` event name exists in the `FunnelEventName` union. | `chatV9FeatureFlags.test.ts` |
| 7 | Every declared `telemetry` event name also has a heading in the telemetry contract doc. | `chatV9FeatureFlags.test.ts` |
| 8 | Every flag appears in all three README cheat-sheets (status table, URL kill-switch, localStorage). | `chatV9FeatureFlags.test.ts` |
| 9 | Every `./doc.md#anchor` reference in `docs/Chat V9/` resolves to a real heading or explicit `<a id="...">` anchor. | `chatV9FeatureFlags.test.ts` |
| 10 | Every declared `testId` is kebab-case (null and sharing allowed). | `chatV9FeatureFlags.test.ts` |
| 11 | Every flag's resolver honours the URL > localStorage > default chain and does not throw on garbage input. | `chatV9FlagResolverContract.test.ts` |
| 12 | Every flag has an `isEnabled()` function that returns a boolean under default conditions. | `chatV9FeatureFlags.test.ts` |
| 13 | Every `src/utils/*Flag.ts` resolver file is imported by the registry (no orphan resolvers) and the file count matches the registry length. | `chatV9FeatureFlags.test.ts` |
| 14 | Every backticked kebab-case identifier in runbook § 4 is a registered flag id (no stale incident-response targets). | `chatV9FeatureFlags.test.ts` |
| 15 | Every "Shipped and tracked" row's bolded ticket column matches the registry `ticket` (allowing the `-lite` and `AG1 v1.N` human conventions). | `chatV9FeatureFlags.test.ts` |
| 16 | Every `specDocs` path with a `#anchor` resolves to a real heading or explicit `<a id>` in the target file. Catches stale uppercase anchors that silently 404 in the admin panel. | `chatV9FeatureFlags.test.ts` |
| 17 | Every member of the `ChatV9Block` union has ≥1 registered flag (no dead enum values). | `chatV9FeatureFlags.test.ts` |
| 18 | Every flag's ticket appears in its block's development plan (as a heading prefix or inline reference). Catches "shipped without design docs". | `chatV9FeatureFlags.test.ts` |
| 19 | Every non-null `testId` appears as a quoted string in ≥1 non-test `src/` file outside the registry. Catches descriptor lies — typo'd or removed DOM hooks. | `chatV9FeatureFlags.test.ts` |
| 20 | Every `*_DEVELOPMENT_PLAN_*.md` opens with a `> **Cross-refs**` block linking to the runbook, contributor guide, and telemetry contract (within the first 40 lines). Catches doc-cleanup PRs that strip operational links. | `chatV9FeatureFlags.test.ts` |
| 21 | Every V9-prefixed event (`voice_*`, `trust_*`, `pii_*`, `navigation_*`, `private_*`) in `FunnelEventName` is claimed by at least one flag's `telemetry[]`. Catches "added event to union, forgot to gate it". | `chatV9FeatureFlags.test.ts` |
| 22 | Every event-level heading in the telemetry contract doc resolves to a member of `FunnelEventName`. Reverse direction of # 6 — catches "doc describes an event we can no longer emit". | `chatV9FeatureFlags.test.ts` |
| 23 | Every `*_DEVELOPMENT_PLAN_*.md` on disk is linked from the README (typically in the "Shipped and tracked" table). Catches orphan dev-plans that rot silently. | `chatV9FeatureFlags.test.ts` |
| 24 | Every row in the telemetry contract's `## Index` table matches the registry: the event → flag id pairing is correct **and** the ticket column normalises to the flag's registry ticket. Catches doc-refactors that rewrite an Index cell without rippling to the registry or README. | `chatV9FeatureFlags.test.ts` |
| 25 | Every top-level `## \`event\`` detailed section in the telemetry contract carries a metadata line `**Ticket:** T · **Flag:** \`ff.key\` · **Source:** …` that matches the registry's ticket and `keys.localStorage`. Catches drift in the first thing an on-call engineer reads after clicking an Index link. | `chatV9FeatureFlags.test.ts` |
| 26 | The `## Index` table events and the detailed-section headings (both `##` and `###` levels, to cover grouped sections like Voice funnel) are in bijection. Catches half-documented events and missing Index rows in either direction. | `chatV9FeatureFlags.test.ts` |
| 27 | Every ticket-shaped token in the operations runbook (`AG1 v1.N`, `NAV-Mx.y`, `VMx.y`, `T-TRx.y`, `T-PMx-lite`, `C-INx-lite`, ...) resolves to either a registered flag ticket **or** a `### ticket ·` heading in one of the block dev-plans. Catches runbook references that survived a ticket rename but lost their anchor. | `chatV9FeatureFlags.test.ts` |
| 28 | Every dev-plan's "Cross-refs" block (first 40 lines) uses **relative** links (`./FILE.md`) to the runbook, contributor guide, and telemetry contract — not absolute URLs — and every linked file exists on disk. Catches absolute-URL drift that would bypass doc previews on forks and clones. | `chatV9FeatureFlags.test.ts` |
| 29 | Every backticked file-path in the contributor guide (full paths under `src/` or `docs/`, or bare `*.ts`/`*.tsx`/`*.md` filenames) resolves to a real file. Placeholders (`<name>`, `**/*`) and suffix-style examples (`Flag.ts`) are whitelisted. Catches guide drift after a refactor renames or moves a file. | `chatV9FeatureFlags.test.ts` |
| 30 | Every `docs/Chat V9/*.md` file matches one of five known taxonomies (`README`, `*_DEVELOPMENT_PLAN_YYYY-MM-DD`, `CHAT_V9_OPERATIONS_RUNBOOK_YYYY-MM-DD`, `CHAT_V9_CONTRIBUTOR_GUIDE_YYYY-MM-DD`, `CHAT_V9_TELEMETRY_CONTRACT_YYYY-MM-DD`). Catches stray or work-in-progress docs that would otherwise rot without CI validation. | `chatV9FeatureFlags.test.ts` |

The registry tests average under 300ms; the resolver-contract suite
parametrises ~240 assertions across every flag in one sub-second run.
Adding a new flag should cost approximately two seconds of CI time.

If a row goes red, the failure message names the exact flag, file,
or anchor that drifted. Fix the artifact the message points at, not
the test.

## Kill-switches (cheat sheet)

Append any of these to the app URL to force-disable a feature in the
current tab. Add `=1` to force-enable.

```
?ff_bargeInToast=0
?ff_voiceModeLegend=0
?ff_voiceLegendShortcut=0
?ff_voiceFunnelTelemetry=0
?ff_privateModeDetails=0
?ff_trustBadge=0
?ff_trustBadgeHumanizeModel=0
?ff_trustBadgeCopyCitations=0
?ff_trustBadgeCopyReasoning=0
?ff_trustBadgeReasoning=0
?ff_piiHeuristicToast=0
?ff_piiHeuristicSessionDismiss=0
?ff_nextModelChip=0
?ff_backToChatButton=0
?ff_backToChatShortcut=0
?ff_workspaceBreadcrumb=0
?ff_workspaceBreadcrumbConversation=0
?ff_workspaceBreadcrumbRecents=0
?ff_workspaceBreadcrumbRecentsPinned=0
?ff_workspaceBreadcrumbRecentsViewAll=0
?ff_inputCharCounter=0
?ff_inputHintStrip=0
?ff_flagsSnapshotCopy=0
?ff_flagsResetUrl=0
?ff_flagsPanelFilter=0
?ff_flagsPanelGrouping=0
?ff_flagsPanelDocLinks=0
?ff_flagsPanelDescriptionExpand=0
?ff_flagsPanelStickyGroupHeaders=0
?ff_inputSoftLimitToast=0
?ff_workspaceBreadcrumbRecentsArrowKeys=0
?ff_workspaceBreadcrumbRecentsTriggerArrow=0
?ff_trustBadgeCitationLinks=0
?ff_flagsPanelRowShortcuts=0
?ff_workspaceBreadcrumbRecentsTriggerArrowUp=0
?ff_flagsPanelShortcutCheatSheet=0
?ff_voiceLegendCopyText=0
?ff_flagsPanelOverrideUrlCopy=0
?ff_trustBadgeCitationDomain=0
?ff_flagsPanelFilterEscapeClear=0
```

### AG1 v1.3 — one-click override nuke

For admins who want to reset every V9 override in their browser
session without opening the panel first:

```
?v9flags=reset
```

Appending that to any app URL calls `resetAllChatV9FlagOverrides()`,
rewrites the query to `?v9flags=1` (keeping every other query param
and the hash intact), and pops the overlay open on top of the
current route for visible confirmation. Role-gated — non-admins get
their URL cleaned but no overrides are touched. Kill-switch lives in
the `flags-reset-url` flag above.

For the **admin flag panel** itself (AG1 v1), append the following to
any app URL — the panel opens as a modal overlay on top of the current
view, Escape or backdrop click dismisses:

```
?v9flags=1
```

The panel is **role-gated**: only users with role `SUPERADMIN`, `OWNER`
or `ADMIN` ever see it. Every other session receives `null` from the
overlay even with the query present. The panel lists every registered
flag, its current resolved state, whether it's overridden in this
browser, and per-flag ON / OFF / default buttons backed by
`setChatV9FlagOverride` / `clearChatV9FlagOverride`.

### Killing from localStorage (cheat sheet)

Set the matching `localStorage` key for an organisation-level override
without a redeploy:

```js
localStorage.setItem('ff.barge_in_toast', '0');
localStorage.setItem('ff.voice_mode_legend', '0');
localStorage.setItem('ff.voice_legend_shortcut', '0');
localStorage.setItem('ff.voice_funnel_telemetry', '0');
localStorage.setItem('ff.private_mode_details', '0');
localStorage.setItem('ff.trust_badge', '0');
localStorage.setItem('ff.trust_badge_humanize_model', '0');
localStorage.setItem('ff.trust_badge_copy_citations', '0');
localStorage.setItem('ff.trust_badge_copy_reasoning', '0');
localStorage.setItem('ff.trust_badge_reasoning', '0');
localStorage.setItem('ff.pii_heuristic_toast', '0');
localStorage.setItem('ff.pii_heuristic_session_dismiss', '0');
localStorage.setItem('ff.next_model_chip', '0');
localStorage.setItem('ff.back_to_chat_button', '0');
localStorage.setItem('ff.back_to_chat_shortcut', '0');
localStorage.setItem('ff.workspace_breadcrumb', '0');
localStorage.setItem('ff.workspace_breadcrumb_conversation', '0');
localStorage.setItem('ff.workspace_breadcrumb_recents', '0');
localStorage.setItem('ff.workspace_breadcrumb_recents_pinned', '0');
localStorage.setItem('ff.workspace_breadcrumb_recents_view_all', '0');
localStorage.setItem('ff.input_char_counter', '0');
localStorage.setItem('ff.input_hint_strip', '0');
localStorage.setItem('ff.flags_snapshot_copy', '0');
localStorage.setItem('ff.flags_reset_url', '0');
localStorage.setItem('ff.flags_panel_filter', '0');
localStorage.setItem('ff.flags_panel_grouping', '0');
localStorage.setItem('ff.flags_panel_doc_links', '0');
localStorage.setItem('ff.flags_panel_description_expand', '0');
localStorage.setItem('ff.flags_panel_sticky_group_headers', '0');
localStorage.setItem('ff.input_soft_limit_toast', '0');
localStorage.setItem('ff.workspace_breadcrumb_recents_arrow_keys', '0');
localStorage.setItem('ff.workspace_breadcrumb_recents_trigger_arrow', '0');
localStorage.setItem('ff.trust_badge_citation_links', '0');
localStorage.setItem('ff.flags_panel_row_shortcuts', '0');
localStorage.setItem('ff.workspace_breadcrumb_recents_trigger_arrow_up', '0');
localStorage.setItem('ff.flags_panel_shortcut_cheat_sheet', '0');
localStorage.setItem('ff.voice_legend_copy_text', '0');
localStorage.setItem('ff.flags_panel_override_url_copy', '0');
localStorage.setItem('ff.trust_badge_citation_domain', '0');
localStorage.setItem('ff.flags_panel_filter_escape_clear', '0');
```

## Adding a new V9 feature

Quick reference (full recipe + enforced invariants in
[`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)):

1. Drop `src/utils/<name>Flag.ts` implementing the standard resolver.
2. Implement the feature. Gate every user-visible side effect on
   `is<Name>Enabled()`.
3. Register it in `src/utils/chatV9FeatureFlags.ts` (`CHAT_V9_FLAGS`).
   Add the id to `EXPECTED_IDS` in the registry test.
4. Append the telemetry event(s) to `src/services/funnelAnalytics.ts`
   with an inline PII contract comment.
5. Add entries to the plan + telemetry docs in this folder. Keep the
   `specDocs` array in the flag descriptor pointing at real files.
6. Update the three README cheat sheets (status table, URL kill-switch,
   localStorage). The registry test enforces this automatically.

Test expectations: every public helper + side effect gets a unit test.
Kill-switch path (flag OFF → component returns null or helper is a
no-op) is mandatory coverage.
