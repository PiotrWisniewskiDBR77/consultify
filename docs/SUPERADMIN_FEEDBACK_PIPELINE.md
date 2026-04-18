# Superadmin Feedback Pipeline — Source of Truth

Status: V2.1 (2026-04-17) — operations hardening on top of V2.0.
Previously: V2.0 (2026-04-17) — rich capture + Cursor dossier; V1 (2026-04-16) — metadata-driven pipeline.
Owner: Piotr Wiśniewski / Consultinity Platform.

> V2.1 changelog (incremental on top of V2.0):
>
> - **Screenshot capture is now opt-in (default off)** in
>   `FeedbackSidePanel`. Diagnostics (console / network / breadcrumbs)
>   remain on by default because they are cheap and textual. Rationale:
>   eliminate payload bloat, GDPR surprises on admin views, and avoid
>   rasterising enormous dashboards. When disabled, the dossier still
>   ships console logs, network errors, breadcrumbs, uncaught errors
>   and app context — enough for 90% of Cursor sessions.
> - **Feedback submission rate limiter**
>   (`server/src/middleware/rateLimiting.middleware.ts →
>   feedbackRateLimiter`) — 10 req/min (prod) / 100 (dev) per user/IP,
>   applied to `POST /api/feedback`, `/pulse`, `/feature`. Protects the
>   queue + volume from malicious loops and accidental retry storms.
> - **Automatic Cursor handoff**: `GET /api/feedback/:id/cursor-brief`
>   now side-effects a workflow PATCH — first time a brief is pulled we
>   stamp `workflow.source = 'cursor'`, set `branch = feedback/<short>`
>   if empty, and append a `workflow_updated` timeline entry. No more
>   manual "I forgot to flip the source" in triage.
> - **Triage data on the list view**: the Superadmin feedback list now
>   shows first-class badges for `duplicate_count`, `has_screenshot`,
>   `has_diagnostics` (extracted on the backend in `feedbackShape.ts`,
>   surfaced on every `GET /api/feedback*` response). Duplicate chips in
>   the detail view are clickable and load the matching ticket in place.
> - **Unit tests**: `server/src/services/__tests__/feedbackTriage.test.ts`
>   (14) and `feedbackShape.test.ts` (16) cover clustering, priority
>   inference, duplicate lookup, workflow/resolution normalisation and
>   the full `shapeFeedbackRow` contract. Run with `npm test` inside
>   `server/`.
> - **Artifact retention pruner**: `startArtifactPruner()` (called from
>   `server/src/index.ts` on boot) deletes screenshots older than
>   `FEEDBACK_ARTIFACTS_RETENTION_DAYS` (default 30) once per day. Safe
>   on ephemeral dirs and Railway volumes alike.
> - **Operational docs for Railway volume**:
>   `docs/operations/FEEDBACK_VOLUME_SETUP.md` — exact steps to mount
>   `/app/server/.feedback-artifacts`, with rationale and smoke test.
> - **Global feedback entry point**: `FeedbackFloatingButton` in
>   `MainLayout` plus keyboard shortcut `Shift+Ctrl+B` (or `Shift+⌘+B`
>   on macOS). Hidden inside `/superadmin/*` and when the panel is open.
> - **Cursor plumbing scripts**:
>   - `scripts/feedback-link-pr.ts` — reads current git branch
>     `feedback/<8>`, PATCHes workflow with `branch`, `prUrl`,
>     `deployStatus`, `owner=cursor`, `source=cursor`.
>   - `scripts/generate-feedback-regression-test.ts` — pulls ticket
>     details and scaffolds a vitest/playwright regression skeleton in
>     `tests/regression/feedback-<short>.spec.ts`.
> - **Slack daily digest**: `server/src/services/feedbackDigest.ts`
>   runs once per UTC day (configurable via
>   `FEEDBACK_DIGEST_HOUR_UTC`, gated on `FEEDBACK_DIGEST_ENABLED=true`).
>   Sections: *new in last 24h*, *stuck in NEW > 48h*, *open CRITICAL
>   on production*. Severity of the Slack system alert escalates to
>   `CRITICAL` when the prod list is non-empty.
> - **Analytics surface**:
>   `GET /api/feedback/analytics/overview` + new tab
>   `Feedback Analytics` in the Superadmin Customers module. KPIs: open
>   count, MTTR (median + p90, last 30d), aging distribution of NEW,
>   volume breakdown by status/type/severity/env, re-open rate.
> - **Additive workflow columns** (migration
>   `server/migrations/20260417_feedback_workflow_columns.sql`):
>   `owner`, `cluster`, `deploy_status`, `workflow_updated_at` on
>   `feedback_items`. Metadata JSON remains the source of truth; the
>   columns are written through on each workflow PATCH (and at creation
>   time for `cluster`). Enables cheap SQL dashboards without back-
>   parsing JSON.

> V2.0 changelog (incremental on top of V1):
> - **Frontend collector** (`src/services/feedbackCollector/`) installs global
>   ring-buffers (console, network, breadcrumbs), captures viewport screenshot
>   via `html-to-image` with hard-redact on password/email inputs and
>   `[data-feedback-redact]` elements, snapshots build/viewport/locale/online
>   context and computes a **`signatureHash`** (FNV-1a of normalised
>   stack+route+message).
> - **`POST /api/feedback`** accepts a new optional payload: `signatureHash`,
>   `appContext`, `consoleLogs`, `networkErrors`, `breadcrumbs`,
>   `lastUncaughtError`, `screenshot.dataUrl`. Everything is persisted inside
>   `metadata_json.dossier` (no schema migration).
> - **Screenshot storage**: `server/src/services/feedbackArtifacts.ts` saves
>   bytes under `FEEDBACK_ARTIFACTS_DIR` (defaults to `.feedback-artifacts`
>   relative to `process.cwd()`; point it at a Railway volume in production).
>   Served by `GET /api/feedback/:id/artifacts/screenshot` (SuperAdmin only).
> - **Triage**: `server/src/services/feedbackTriage.ts` infers `workflow.cluster`
>   from the route, looks up duplicate tickets by `signatureHash` (stored as
>   `metadata_json.duplicateOf` + `duplicateCandidates`), and bumps priority on
>   production BUGs, uncaught errors, and duplicate storms (≥3).
> - **Cursor handoff**: `GET /api/feedback/:id/cursor-brief` returns a markdown
>   brief (description, breadcrumbs, network errors, console logs, uncaught
>   error, env, explicit Cursor action checklist). Superadmin detail view has a
>   **Copy Cursor brief** button plus a Cursor dossier panel (screenshot,
>   breadcrumbs, network errors, console logs, app context, duplicates).
> - **ErrorBoundary** gets a **Zgłoś ten błąd** button that pre-fills the
>   feedback dialog via `window.__FEEDBACK_PREFILL__` + `feedback:open` event.

This document defines **how user-submitted reports (bugs, ideas, feature requests, pulse)
are handled as an operational delivery pipeline** inside the Superadmin module.
It is the canonical reference for anyone (human or Cursor session) touching the
feedback system. If behavior diverges between code and this document, update
the document first, then align the code.

---

## 1. Goals

1. Every user report is a **unit of work** with an owner, status, delivery trail
   and verifiable resolution — not a loose comment.
2. Superadmin UI must answer at a glance:
   - What is critical in production right now?
   - What is unassigned?
   - What is waiting for user verification?
   - What has been hanging in `NEW` for too long?
3. Cursor-driven sessions must leave machine-readable traces
   (`workflow.source = "cursor"`) so nothing gets "silently fixed".
4. No destructive DB migration for V1. All new fields live in
   `feedback_items.metadata_json` and are shaped on read.

## 2. Data model (V1)

Physical storage: `feedback_items.metadata_json` (JSON string).
Read-side shaping: `shapeFeedbackRow()` in
`server/src/routes/feedback.routes.ts`.

```ts
// Persisted inside metadata_json
type FeedbackMetadataV1 = {
  // ...legacy keys: userEmail, userName, routePath, deviceType, alertDispatch, ...
  linkedTaskId?: string | null;
  workflow?: {
    owner?: string | null;           // email or handle
    cluster?: string | null;         // logical group e.g. "Superadmin Users"
    source?: 'cursor' | 'manual' | string | null;
    branch?: string | null;
    prUrl?: string | null;
    taskUrl?: string | null;
    linkedTaskId?: string | null;
    deployStatus?: 'todo' | 'staging' | 'production' | 'verified' | string | null;
    deployTargets?: Array<'staging' | 'production' | string>;
    deployedAt?: string | null;      // ISO timestamp
    verifiedBy?: string | null;
    verifiedAt?: string | null;
    waitingOn?: string | null;       // free text e.g. "user verification"
    lastUpdatedAt?: string | null;
  };
  resolution?: {
    type?: 'fixed' | 'duplicate' | 'not-a-bug' | 'wont-fix' | string | null;
    summary?: string | null;
    rootCause?: string | null;
    verificationNotes?: string | null;
    testPlan?: string[];
  };
  workflowTimeline?: Array<{
    id: string;
    at: string;                      // ISO
    actor: string | null;            // email or id
    action: 'workflow_updated' | string;
    note?: string | null;
    changes?: string[];              // list of field keys touched
  }>;
};
```

### Shape returned by GET /api/feedback and GET /api/feedback/:id

On top of legacy fields the response exposes:

| Field                | Type                         | Notes                                     |
| -------------------- | ---------------------------- | ----------------------------------------- |
| `workflow`           | object                       | Normalized, compacted (no empty values).  |
| `resolution`         | object                       | Normalized, compacted.                    |
| `workflowTimeline`   | array                        | Append-only, capped to last 50 entries.   |
| `owner`              | string \| null               | Convenience mirror of `workflow.owner`.   |
| `cluster`            | string \| null               | Mirror of `workflow.cluster`.             |
| `pr_url`             | string \| null               | Mirror of `workflow.prUrl`.               |
| `branch`             | string \| null               | Mirror of `workflow.branch`.              |
| `deploy_status`      | string \| null               | Mirror of `workflow.deployStatus`.        |
| `deploy_targets`     | string[]                     | Mirror of `workflow.deployTargets`.       |
| `resolution_summary` | string \| null               | Mirror of `resolution.summary`.           |

## 3. API contract

### PATCH /api/feedback/:id/workflow

Auth: `verifySuperAdmin`.

Request body (all fields optional; `undefined` = leave unchanged):

```json
{
  "owner": "piotr@dbr77.com",
  "cluster": "Superadmin Users",
  "source": "cursor",
  "branch": "hotfix/feedback-pipeline",
  "prUrl": "https://github.com/.../pull/73",
  "taskUrl": "https://notion.so/.../task",
  "linkedTaskId": "task_123",
  "deployStatus": "staging",
  "deployTargets": ["staging", "production"],
  "deployedAt": "2026-04-16T09:00:00Z",
  "verifiedBy": "qa@dbr77.com",
  "verifiedAt": "2026-04-16T09:10:00Z",
  "waitingOn": "user verification",
  "resolution": {
    "type": "fixed",
    "summary": "Superadmin users list now handles missing license_plan_id",
    "rootCause": "u.license_plan_id missing on prod",
    "verificationNotes": "Reproduced in staging, confirmed on prod via curl",
    "testPlan": [
      "GET /api/superadmin/users?status=ALL returns non-empty list",
      "Filters render correctly for role=owner"
    ]
  },
  "note": "Picked up via Cursor pipeline"
}
```

Response:

```json
{
  "success": true,
  "workflow": { ...normalized... },
  "resolution": { ...normalized... },
  "workflowTimeline": [ ...updated history... ]
}
```

Side effects:

- Appends a `workflow_updated` entry to `workflowTimeline` with the list of
  changed field keys in `changes`.
- Updates `feedback_items.linked_task_id` column when `linkedTaskId` is
  provided and the column exists.
- Sets `updated_at` to `CURRENT_TIMESTAMP` when the column exists.
- Trims `workflowTimeline` to the last 50 entries.

### Existing endpoints (unchanged semantics)

- `GET /api/feedback` — list for Superadmin, now also returns workflow shape.
- `GET /api/feedback/:id` — detail, also returns workflow + `statusHistory`.
- `PATCH /api/feedback/:id/status` — still single source of truth for
  `status` transitions; also writes `feedback_items_status_history`.
- `POST /api/feedback/:id/respond` — admin response; still forces
  `status = REVIEWED`.

## 4. Status lifecycle

```
NEW -> PENDING -> IN_PROGRESS -> REVIEWED -> RESOLVED
                                           \-> ARCHIVED
```

Operational rules (enforced by process, validated by UI, not DB):

1. Moving to **IN_PROGRESS** requires `workflow.owner`.
2. Moving to **REVIEWED** requires an admin response
   (`POST /:id/respond` has already fired, so `admin_response != null`).
3. Moving to **RESOLVED** requires:
   - `resolution.summary` non-empty
   - `workflow.deployStatus` ∈ {`production`, `verified`}
4. **ARCHIVED** is used for spam / duplicates / not-a-bug;
   `resolution.type` must be set.

## 5. Superadmin UI — view contract

File: `src/views/superadmin/SuperAdminFeedbackView.tsx`.

Must always provide:

- Header with filters: status, type, severity, **env**, **ownership**,
  full-text search across title, message, user, owner, cluster, task id, id.
- View toggle: **Board** (per-status lanes) and **List**.
- KPI row (all clickable shortcuts are optional in V1):
  - `Critical prod` — prod items with severity/priority critical
  - `Unassigned` — no `workflow.owner`
  - `Awaiting verification` — status = `REVIEWED`
  - `NEW > 24h` — created over 24h ago and still in `NEW`
- Status counter row with filter toggles.
- Card content: type, status, env, priority, severity, title, message preview,
  reporter, age, owner, cluster, linked task id, PR indicator, deploy status.

Detail view must provide, in this order:

1. Header card with status + quick transitions (→ PENDING, → IN_PROGRESS, ...).
2. Context & metadata card (route, device, screen, theme, language, rest).
3. **Operations** card: owner, cluster, waiting on, linked task.
4. **Delivery** card: branch, PR URL, task URL, deploy status, deploy targets,
   deployed at, verified by, verified at.
5. **Resolution** card: type, summary, root cause, verification notes, test
   plan, update note + single **"Save pipeline data"** action.
6. Alerts & Escalation card (unchanged).
7. **Pipeline timeline** (status history + workflow audit), newest first.
8. Admin response editor.

## 6. Cursor session expectations

When a Cursor session picks up a feedback item it SHOULD:

1. Call `updateFeedbackWorkflow({ owner, cluster, source: 'cursor', note: 'Picked up' })`.
2. While working, keep `workflow.branch` and `workflow.prUrl` up to date.
3. On merge/deploy, set `workflow.deployStatus`, `workflow.deployTargets`,
   `workflow.deployedAt`.
4. On close, set `resolution.type`, `resolution.summary`, `resolution.rootCause`,
   `resolution.verificationNotes`, `resolution.testPlan[]`.
5. Move status via `PATCH /:id/status` with a short `note`.
6. Only then respond to the reporter via `POST /:id/respond`.

This guarantees every pipeline action has a machine-readable trail and is
visible in the Superadmin timeline.

## 7. Out of scope for V1

Tracked for V2 / future work:

- Dedicated DB columns / indexes for `owner`, `cluster`, `deploy_status`
  (currently read from JSON).
- Clustering UI (auto-grouping duplicates).
- Cross-ticket release view ("what did we ship in release X?").
- SLA timers and auto-escalation per cluster.
- Role-based gating (currently any SuperAdmin can edit any field).

## 8. Change log pointer

Human-readable release notes for this V1 live in `docs/CHANGELOG.md` under
`[Unreleased] - 2026-04-16`.
