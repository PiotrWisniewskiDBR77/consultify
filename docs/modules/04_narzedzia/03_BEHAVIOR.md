---
module_id: MODULE_TOOLS
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Narzędzia / Tools

## Runtime Behavior (As-Is)

- Tools module is split into discovery-tools hub paths and assessment hub paths, both mounted in app router.
- `DiscoveryToolsHub` handles library/sessions/reports&presentations/initiative handoff patterns with category filtering.
- `AssessmentHub` handles assessment/report/initiative flows and session editor route under `/assessment/:framework/:assessmentId`.
- Legacy `/licensed-tools/*` entry is redirected into assessment routes.

### Function Runtime Breakdown (As-Is)

- Discovery hub functions: `NZ_DISCOVERY_LIBRARY`, `NZ_DISCOVERY_SESSIONS`, `NZ_DISCOVERY_OUTPUTS`, `NZ_DISCOVERY_INITIATIVES`.
- Assessment function: `NZ_ASSESSMENT_HUB` for assessment/report/initiative lanes.
- Strategic workspace function: `NZ_MEGATRENDS_WORKSPACE` on canonical megatrends path.

## State Handling (As-Is)

- Hub state includes category filters, status chips, view mode switching, preview panes, and open-document handling.
- Assessment runtime keeps cached list/session/report state in browser session storage for continuity.
- Errors and degraded data paths are surfaced through toast and explicit status mapping in hub logic.

## Security / Tenant / Governance (As-Is)

- Data operations run through shared API/session context (`Api` + app store identity).
- Initiative promotion/handoff uses explicit runtime actions and lifecycle mapping helpers, not hidden route mutations.
- No separate bypass route for assessment/tool writes is declared in router layer.
- Licensed and permission-sensitive surfaces must remain explicit; no silent bypass from discovery or assessment tabs.
