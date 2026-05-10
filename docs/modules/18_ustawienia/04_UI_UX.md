---
module_id: MODULE_SETTINGS
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Ustawienia

## 1. Main Screen

As-Is: `/settings/*` is the active user/workspace preference surface with nested settings sections. The screen job is configuration of user/workspace preferences and settings.

## 2. Runtime States

- Loading: settings sections must show loading while preferences/configuration are fetched.
- Empty: empty or unconfigured sections must explain what can be configured and what defaults apply.
- Error: failed reads/writes must show business-readable copy and must not show fake saved state.
- Degraded: unavailable settings providers, policy-locked settings or partial configuration must be visible.
- Success: setting saves must confirm persistence and tell the user whether refresh/re-login/retry is needed.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps settings module navigation. Menu 3 is the active settings command row for the selected section or preference group.

## 4. AI Actions Placement

Any contextual AI help for settings explanation or policy guidance must live in Menu 3/right-side command placement. It must not be duplicated inside settings canvas.

## 5. Next Action Guidance

Settings UX must tell the user whether to save, retry, revert, request admin access, refresh, re-login or do nothing because defaults/policies apply.

## 6. Source / Evidence / Provenance

Settings that affect workspace behavior must show whether the value comes from user preference, workspace policy, tenant policy or default configuration. Policy/ACL locks must be visible.

## 7. Approval / Diff / Review

High-impact settings changes require confirmation/review. Save state and lifecycle/governance state must remain separate; `Saved` only means persisted, not approved.

## 8. Anti-Patterns

- Fake saved state after failed write.
- Hidden policy lock or tenant restriction.
- AI actions duplicated in canvas and Menu 3.
- Raw internals as setting error copy.
- Changing high-impact settings without confirmation.

## 9. As-Is Gaps

- Existing docs confirm active nested settings module and route ownership, but not every section's loading/empty/error/degraded copy.
- Persistence/read-back evidence for all high-impact settings remains to be validated.

## 10. Acceptance Criteria

- `/settings/*` is documented as canonical settings ownership.
- Loading, empty, error, degraded and success states are visible across nested sections.
- AI/help actions use Menu 3/right-side placement without duplication.
- Preference source and policy/ACL state are visible.
- High-impact settings changes require confirmation and successful persistence feedback.

## 11. Function Annex — Settings Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `SET_SETTINGS_WORKSPACE` | Settings Workspace | `/settings/*` | real | `SettingsView` | `functions/SET_SETTINGS_WORKSPACE.md` |
| `SET_POLICY_BOUNDARY_LINKS` | Policy Boundary and Admin Links | settings vs admin policy ownership boundary | partial | lock/deeplink boundary behavior | `functions/SET_POLICY_BOUNDARY_LINKS.md` |
