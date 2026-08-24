# Canonical 16-module data/API qualification — 2026-08-24

Status: `SOURCE QUALIFIED / OWNER FREEZE PENDING / NO RELEASE`

This note qualifies the seven modules marked `CANONICAL_WITH_GAP` in
`canonical-16-module-bindings.json`. It answers one narrow question: is the
visible gap caused by a missing backend, or by unresolved routing, runtime
policy, cutover, or owner-selection work?

## Outcome

| Module | Backend/data finding | Remaining integration decision |
|---|---|---|
| Interview | Real authoring, assignment, insight, decision and task APIs are called by `InterviewHub`. The gateway explicitly keeps `/api/interview` for authoring because V8 has no equivalent, while governed assignment/insight calls use V8. | Make `/interview` the only product route; redirect `/discovery` and `/project-intelligence`. Do not blanket-migrate authoring to V8. |
| Assessment | The hub reads `/api/assessments`, `/api/assessment-reports`, users, report imports and method/session data. The gateway mounts the collection and report routers. | Freeze one accepted DRD session UI and its read/write contract; remove legacy UI only after authenticated persistence/readback proof. |
| Execution | `ExecutionHub` calls initiatives, tasks, capacity, delay, risk, budget and report-definition services. Both `/api/execution-control` and exact V8 manager routes are mounted. | Prevent a capability-discovery failure from replacing the usable module with `V8UnavailableBanner`; prove the intended policy in a fresh authenticated runtime. |
| Meetings | `MeetingHub` loads meetings through `Api.getMeetings` and uses governed `/api/meeting/:id/notes` decisions. The meeting router is mounted. | Freeze and implement the stable object route (`/meeting/:meetingId` or equivalent) so list → card → reload is deterministic. |
| Finance | `FinanceHub` has real V8 Finance clients for statement packs, models, analyses, valuations, budgets, baselines and versions, but also carries legacy fallbacks to finance-statements, financial-modeling and economics. | Select the five final registries/cards, bind them to Finance V2 artifacts/business versions, then prove them before removing each corresponding fallback. No bulk deletion of legacy paths. |
| Materials | The hub loads reports, presentations, templates, artifact outputs and sheets and uses presentation, deliverables and work-canvas services. | Freeze the canonical sheet engine (`ExceleView` or `TabeleView`) and redirect the losing path only after behavior and persisted artifacts are equivalent. |
| Partner | The portal reads connection state, dashboard, organization, clients, projects, resources, certifications and metrics. Both legacy `/api/partners` and V8 successor direction are visible. | Freeze the connected-partner landing and onboarding/connected state transition; then cut over endpoint-by-endpoint with readback. |

## Integration rule derived from the source

The seven gaps are **not evidence that the backend work is absent**. They are
primarily selection and cutover gaps. Therefore:

1. no screen is rebuilt merely because the wrong route or fixture was shown;
2. no legacy endpoint/component is deleted before the selected successor has
   authenticated list, open, mutate, reload and provenance evidence;
3. feature flags and runtime capability gates are recorded as part of the
   candidate identity, not treated as incidental local settings;
4. owner review selects the product surface; technical qualification selects
   the data authority; neither substitutes for the other;
5. fixtures may support visual review but never prove persistence, acceptance,
   or release readiness.

## Next proof package per gap module

For each module capture exactly: candidate SHA, route, selected component,
active flag/capability state, API request family, database target identity,
list response, object open response, one safe local/demo mutation, cold reload,
and screenshot. Any missing item remains `NOT PROVEN`.
