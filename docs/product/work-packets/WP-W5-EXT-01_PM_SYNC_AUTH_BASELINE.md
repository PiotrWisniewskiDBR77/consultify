# WP-W5-EXT-01 — PM Sync Baseline and Auth/Reauth/Degraded States Analysis

> Packet: WP-W5-EXT-01
> Wave: 5 — External-world and operator hardening
> Status: completed
> Produced by: worker agent (bounded)
> Sources: see §9 context pack

---

## 1. Auth lifecycle hardening

### 1.1 Canonical auth stages requiring hardening

The auth lifecycle defined in `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md` §4 specifies eight sequential stages. For production-grade PM sync, each stage must be hardened beyond the current doctrine-level description into an implementable contract.

| Stage | Hardening requirement | Current gap (from EXTERNAL_SYNC_READINESS_AUDIT §3.2) |
|---|---|---|
| **Connect intent** | Provider, ownership level, connector purpose and capability scope must be captured in `ConnectorInstallation` aggregate before any auth redirect. | No single easy-sync setup shell exists (Audit §3.4). |
| **Authorization** | OAuth redirect must carry correct scopes per provider; org-level vs user-level vs service-account path must be selected based on `ProviderCatalogEntry.auth_model`. | Jira 3LO, Google Workspace, Microsoft 365 OAuth lifecycle incomplete in runtime (Audit §3.2). |
| **Verification** | Post-callback: validate token, confirm granted scopes match requested scopes, verify reachable workspace/tenant/project, confirm provider account identity. Store result in `ConnectionCredentialRef`. | Verification is not yet a first-class product step; failures surface only at runtime. |
| **Active use** | Track `last_token_verification`, `next_expected_refresh`, `current_scope_integrity`, `connector_health_state` on the `ConnectorInstallation` aggregate. | Health tracking exists in fragments, not as one coherent model. |
| **Refresh** | Proactive refresh before hard expiry. Log success/failure. Distinguish transient provider failure from true credential expiry before state transition (WP-W1-PMSYNC-01 §1.3). | Refresh logic exists for some providers but is not uniformly instrumented. |
| **Degraded auth** | Transition to `degraded_reauth_needed` only after transient-failure discrimination. Expose degraded state on all affected business objects (OAUTH_LIFECYCLE §10). | No degraded-state propagation to business objects today. |
| **Reauth** | Preserve mapping state, provider identity context, object linkage. Guide actor through recovery (OAUTH_LIFECYCLE §7). | Reauth journey not yet implemented as a guided UX flow. |
| **Revoke / disconnect** | Preserve audit trace, connector history, last-known mapping state. Immediately halt sync. | Disconnect exists but audit preservation is incomplete. |

### 1.2 Token management contract

For every OAuth-based PM connector, the platform must maintain:

| Property | Location | Update trigger |
|---|---|---|
| `access_token` (encrypted) | `ConnectionCredentialRef` | On auth callback, on refresh |
| `refresh_token` (encrypted) | `ConnectionCredentialRef` | On auth callback (if issued) |
| `token_expires_at` | `ConnectionCredentialRef` | On auth callback, on refresh |
| `scopes_granted` | `ConnectionCredentialRef` | On auth callback, on refresh (scopes can change) |
| `last_verification_at` | `ConnectorInstallation` | On periodic health check |
| `last_refresh_at` | `ConnectorInstallation` | On refresh attempt |
| `last_refresh_result` | `ConnectorInstallation` | On refresh attempt (`success` / `transient_failure` / `credential_expired` / `scope_revoked`) |
| `provider_account_id` | `ConnectionCredentialRef` | On auth callback |
| `workspace_or_tenant_id` | `ConnectionCredentialRef` | On auth callback, on verification |

### 1.3 Refresh timing policy

| Provider family | Typical token lifetime | Recommended refresh window |
|---|---|---|
| Google Workspace (Jira Cloud via Atlassian) | 1 hour access token | Refresh at T-10 minutes |
| Microsoft 365 | 1 hour access token | Refresh at T-10 minutes |
| Atlassian (Jira Cloud 3LO) | 1 hour access token | Refresh at T-10 minutes |
| Asana | Long-lived refresh token, 1 hour access | Refresh at T-10 minutes |
| Monday | Token-based, varies | Refresh at T-10 minutes or on 401 |
| ClickUp | OAuth2, 1 hour access | Refresh at T-10 minutes |
| Linear | OAuth2, varies | Refresh at T-10 minutes or on 401 |

Rule: `refresh must be attempted proactively before expiry, not reactively on 401 only`

Exception: if a provider does not issue refresh tokens (API-key-based connectors), the platform must track key validity through periodic verification instead.

### 1.4 Scope integrity checks

After every token refresh, the platform must verify that `scopes_granted` still includes all scopes required by the active `MappingProfile` and `SyncDefinition`. If scopes have been reduced:

1. Log the scope reduction with before/after comparison.
2. Evaluate whether the remaining scopes support the current sync mode.
3. If sync mode is no longer supportable, transition to `degraded_reauth_needed` with reason `scope_reduced`.
4. Surface the specific missing scopes in the reauth journey.

---

## 2. Reauth journey

### 2.1 Trigger conditions

Reauth is triggered when the connector transitions to `degraded_reauth_needed`. The canonical triggers are:

| Trigger | Detection method | Urgency |
|---|---|---|
| Token refresh failure (non-transient) | Refresh endpoint returns permanent error after retry | Immediate |
| Scope revoked by provider admin | Scope check after refresh reveals missing required scopes | Immediate |
| Workspace/tenant access revoked | Verification call returns 403/404 for workspace | Immediate |
| Provider account deactivated | Verification call returns account-level error | Immediate |
| User who owns the token leaves the organization | Org membership check or token use returns identity error | High |
| OAuth app consent revoked | Provider callback or token use returns consent error | Immediate |

### 2.2 User-facing reauth flow

The canonical journey from `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md` §7:

```
auth degraded → explain reason → show impact → offer reauth → verify recovery → resume runs
```

Detailed steps:

1. **Notification**: The system notifies the connector owner (and affected users if configured) that reauth is needed. Notification must include: provider name, connector name, reason category.

2. **Explain reason**: The reauth surface must show:
   - Why reauth is needed (in non-technical language per OAUTH_LIFECYCLE §9)
   - Which provider account is affected
   - When the degradation was detected

3. **Show impact**: The surface must show:
   - Number and type of business objects affected (tasks, decisions, inbox items)
   - Whether sync is fully paused or partially degraded
   - How long sync has been degraded
   - Which sync runs are queued but blocked

4. **Offer reauth**: The reauth action must:
   - Pre-select the correct provider and auth path
   - Request at minimum the same scopes as the original connection
   - Preserve the existing `MappingProfile` and `SyncDefinition`
   - Preserve object linkage (`ExternalObjectMirror` records) where still valid

5. **Verify recovery**: After reauth callback:
   - Run the full verification sequence (token validity, scopes, workspace, identity)
   - Compare new scopes with required scopes
   - Confirm the provider account identity matches (or flag if different)
   - If verification passes, transition to `healthy`

6. **Resume runs**: After transition to `healthy`:
   - Resume queued sync runs in order
   - Re-evaluate stale objects and schedule catch-up sync
   - Log the recovery event with before/after state

### 2.3 Reauth ownership routing

| Connector ownership | Who must reauth | Routing rule |
|---|---|---|
| Org-owned, service account | Org admin or designated connector admin | Route to admin via admin notification channel |
| Org-owned, user-token-powered | The specific user whose token powers the connector | Route to user; escalate to admin if user is unavailable |
| User-owned | The owning user | Route to user; if user is inactive, surface to admin for disconnect decision |
| Mixed (org setup, user token) | The user whose token is active | Route to user; admin sees the degraded state but cannot reauth on behalf of user without re-consent |

### 2.4 Reauth failure handling

If the reauth attempt fails (user cancels, callback error, scope insufficient):

- Connector remains in `degraded_reauth_needed`
- The failure is logged with reason
- A retry counter is incremented
- After 3 failed reauth attempts, the system should escalate to admin/operator with a recommendation to investigate or disconnect

---

## 3. Degraded state model

### 3.1 Degraded state taxonomy

Not all degraded states are equal. The platform must distinguish:

| Degraded condition | Auth state | Sync behavior | User visibility |
|---|---|---|---|
| **Token expired, refresh failed** | `degraded_reauth_needed` | All sync halted for this connector | "Connection expired — reauth needed" |
| **Scope reduced** | `degraded_reauth_needed` | Sync halted for operations requiring missing scopes; read-only sync may continue if read scopes intact | "Partial access — some sync paused" |
| **Workspace unreachable** | `degraded_reauth_needed` | All sync halted | "Provider workspace unreachable" |
| **Provider outage (transient)** | `healthy` (with `provider_outage` error on runs) | Sync retries per retry policy; not a reauth issue | "Provider temporarily unavailable — retrying" |
| **Rate limited** | `healthy` (with `rate_limited` error on runs) | Sync delayed per backoff; not a reauth issue | "Sync delayed — provider rate limit" |
| **Account deactivated** | `degraded_reauth_needed` or `revoked` | All sync halted | "Provider account deactivated" |

### 3.2 Degraded state propagation to business objects

When a connector enters `degraded_reauth_needed`, every linked business object must:

1. Inherit `connector_auth_state = degraded_reauth_needed` in its per-object sync status (WP-W1-PMSYNC-01 §3.2).
2. Transition to `stale` if `last_sync_success_at` exceeds the staleness threshold.
3. Transition to `error` with `error_class = auth_failure` if a sync attempt was in progress.
4. Display a staleness indicator on PM surfaces (OAUTH_LIFECYCLE §10): "linked work is stale because auth degraded."

### 3.3 Degraded state duration tracking

The platform must track:

| Metric | Purpose |
|---|---|
| `degraded_since` | Timestamp when connector entered degraded state |
| `degraded_duration` | Computed: `now - degraded_since` |
| `affected_object_count` | Number of business objects impacted |
| `queued_run_count` | Number of sync runs blocked by degraded auth |
| `reauth_attempt_count` | Number of reauth attempts since degradation |
| `last_reauth_attempt_at` | Timestamp of most recent reauth attempt |

### 3.4 Degraded state escalation policy

| Duration threshold | Action |
|---|---|
| 0–4 hours | Standard notification to connector owner |
| 4–24 hours | Escalation notification to org admin |
| 24–72 hours | Operator alert; connector flagged as at-risk |
| >72 hours | Auto-disable recommendation surfaced to admin; operator incident created |

---

## 4. Sync runtime contract

### 4.1 Sync job lifecycle

Every sync job must follow this lifecycle, grounded in the `ConnectorRun` aggregate from `CONNECTOR_BACKEND_DOMAIN_MODEL_V8.md` §5:

```
queued → pre_check → running → post_check → completed | failed | dead_letter
```

| Phase | Responsibility |
|---|---|
| `queued` | Job created by trigger (schedule, event, manual). Assigned to connector. |
| `pre_check` | Verify connector auth state is `healthy`. Verify mapping is valid. If auth is degraded, job transitions to `failed` with `error_class = auth_failure` without attempting provider calls. |
| `running` | Execute sync operations per `SyncDefinition`. Track per-object results. |
| `post_check` | Validate results. Detect conflicts. Update `ExternalObjectMirror` freshness. |
| `completed` | All objects synced successfully or with auto-resolved conflicts. |
| `failed` | One or more objects failed. Error class attached. Retry eligible per policy. |
| `dead_letter` | Unrecoverable failure after retry exhaustion. Operator inspection required. |

### 4.2 Pre-check gate

The pre-check gate is the critical auth-sync integration point. Before any provider API call:

1. Check `ConnectorInstallation.reauth_state` — if `degraded_reauth_needed`, fail immediately.
2. Check `ConnectionCredentialRef.token_expires_at` — if expired or within refresh window, trigger refresh.
3. If refresh fails, transition connector to `degraded_reauth_needed` and fail the run.
4. Check `scopes_granted` against `SyncDefinition` requirements.
5. If scopes insufficient, fail with `permission_denied`.

### 4.3 Runtime guarantees

| Guarantee | Contract |
|---|---|
| **Auth-aware execution** | No sync run proceeds against a degraded connector. |
| **Per-object atomicity** | Each business object sync is independently trackable. One object failure does not abort the entire run. |
| **Idempotency** | Sync operations must be safe to retry. External writes must use provider-side idempotency keys where available. |
| **Ordering** | Within a single run, objects are processed in dependency order where applicable (e.g., parent before child). Cross-run ordering is guaranteed by queue discipline. |
| **Correlation** | Every run carries a `run_id`. Every per-object operation within a run carries the `run_id` for traceability. |
| **Timeout** | Each run has a maximum execution time. Timeout triggers graceful shutdown: completed objects are committed, in-progress objects are marked `error` with `timeout` reason. |

### 4.4 Sync status reporting

Every completed run must produce a run summary:

| Field | Description |
|---|---|
| `run_id` | Unique identifier |
| `connector_id` | Parent connector |
| `trigger` | `scheduled` / `event_driven` / `manual` |
| `started_at` | Execution start |
| `completed_at` | Execution end |
| `status` | `completed` / `completed_with_warnings` / `failed` / `dead_letter` |
| `objects_synced` | Count of successfully synced objects |
| `objects_failed` | Count of failed objects |
| `objects_conflicted` | Count of objects with detected conflicts |
| `error_classes` | Distinct error classes encountered |
| `conflict_classes` | Distinct conflict classes encountered |
| `auth_state_at_start` | Connector auth state when run began |
| `auth_state_at_end` | Connector auth state when run ended (may have changed if refresh occurred mid-run) |

### 4.5 Retry contract

Retry policy is per-connector-family, not global. The platform must support:

| Parameter | Description | Default for PM connectors |
|---|---|---|
| `max_retries` | Maximum retry attempts per failed run | 3 |
| `retry_backoff` | Backoff strategy | Exponential with jitter |
| `retry_delay_base` | Base delay between retries | 60 seconds |
| `retry_on_auth_failure` | Whether to retry on auth failure | No (auth failure = pre-check gate) |
| `retry_on_rate_limit` | Whether to retry on rate limit | Yes (with provider-specified backoff) |
| `retry_on_provider_outage` | Whether to retry on transient outage | Yes |
| `retry_on_conflict` | Whether to retry on business conflict | No (conflict requires resolution) |

---

## 5. Provider tier considerations

### 5.1 Tier A — Enterprise parity (Jira, Asana or Monday)

Auth hardening requirements:

- Full OAuth 2.0 with PKCE where supported
- Org-level and user-level token paths
- Proactive refresh with transient-failure discrimination
- Scope verification after every refresh
- Full reauth journey with mapping preservation
- Degraded state propagation to all linked business objects
- Operator-grade auth diagnostics

Sync runtime requirements:

- Bidirectional sync with field authority model
- Full conflict vocabulary (all 9 classes from WP-W1-PMSYNC-02 §2.6)
- Per-object sync status tracking
- Run history with per-object detail
- Retry with exponential backoff
- Dead-letter for unrecoverable failures

### 5.2 Tier B — Strong operational interoperability (ClickUp, Linear)

Auth hardening requirements:

- OAuth 2.0 (PKCE where supported)
- At minimum user-level token path
- Proactive refresh
- Scope verification
- Reauth journey (may be simplified compared to Tier A)
- Degraded state propagation

Sync runtime requirements:

- Import and publish sync modes at minimum; scoped bidirectional for core fields
- Conflict handling for supported sync modes (subset of full vocabulary)
- Per-object sync status tracking
- Run history
- Retry policy
- Dead-letter support

### 5.3 Tier C — Scoped PM adjacency (Notion, email-origin work capture)

Auth hardening requirements:

- Provider-appropriate auth (OAuth or API key)
- Token/key validity tracking
- Basic reauth flow
- Degraded state visibility

Sync runtime requirements:

- Import or publish only
- Minimal conflict surface (mapping failures, target-not-found)
- Basic run history
- Retry for transient failures

### 5.4 Tier D — Benchmark or future scope

Auth hardening requirements:

- No runtime auth implementation required
- Provider listed in catalog with `future_scope` flag
- Honest labeling on all surfaces (Decision 7, DECISION_LOG_WAVE_1.md)

Sync runtime requirements:

- None. No sync mode, conflict model or operator surface required.

---

## 6. Wave 1 platform truth integration

### 6.1 Auth lifecycle states

This analysis builds directly on the 8-state auth lifecycle ratified in WP-W1-PMSYNC-01 §1.1:

`not_connected` → `authorizing` → `connected_unverified` → `healthy` → `refreshing` → `degraded_reauth_needed` → `revoked` → `disconnected`

The state machine transitions from WP-W1-PMSYNC-01 §1.2 are adopted without modification. This packet adds the hardening layer: what must happen at each transition to make the state machine production-grade.

### 6.2 Per-object sync status

The 7-state per-object sync status enum ratified in WP-W1-PMSYNC-02 §3.3 is the foundation for sync runtime reporting:

`synced` | `syncing` | `stale` | `conflict` | `error` | `dead_letter` | `not_linked`

This packet defines how auth degradation propagates to object-level status (§3.2 above).

### 6.3 Conflict vocabulary

The 9-class conflict vocabulary from WP-W1-PMSYNC-02 §2.6 is adopted as the canonical conflict classification for sync runtime reporting. The sync runtime contract (§4.4) requires every run to report conflict classes encountered.

### 6.4 Error classification

The 7-class error classification from WP-W1-PMSYNC-01 §3.5 is adopted for per-object error reporting. The pre-check gate (§4.2) specifically uses `auth_failure` and `permission_denied` from this vocabulary.

### 6.5 Field authority model

The 4-type field authority enum from `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md` §3, cross-referenced in WP-W1-PMSYNC-02 §1.3, governs how the sync runtime resolves field-level conflicts:

- `consultify_authoritative`
- `external_authoritative`
- `last_writer_with_guardrails`
- `manual_resolution_required`

### 6.6 Visibility contract

The four-audience visibility contract from WP-W1-PMSYNC-01 §1.4 (Admin, Operator, Support, User) defines who sees what auth and sync state information. The reauth ownership routing in §2.3 of this packet operationalizes the routing rules implied by that visibility contract.

---

## 7. Downstream dependency map

### 7.1 What this packet unblocks

| Downstream packet/wave | Dependency on this baseline |
|---|---|
| **WP-W5-EXT-02 — Dead-letter and replay semantics** | Requires the sync runtime contract (§4), retry policy (§4.5), and the `dead_letter` terminal state definition. |
| **WP-W5-EXT-03 — Operator/admin surfaces** | Requires degraded state model (§3), run summary schema (§4.4), reauth routing (§2.3), and escalation policy (§3.4). |
| **Wave 5 provider-specific hardening** | Requires tier-specific auth and sync requirements (§5) as the acceptance checklist per provider. |
| **Connector Implementation Plan Wave B** | Easy connection shell requires the auth stage hardening (§1.1) and verification contract. |
| **Connector Implementation Plan Wave D** | PM interoperability requires the full sync runtime contract and pre-check gate. |
| **Connector Implementation Plan Wave G** | Operator excellence requires run summary, degraded state tracking, and escalation policy. |

### 7.2 What this packet depends on

| Upstream dependency | What it provides |
|---|---|
| **WP-W1-PMSYNC-01** | Auth lifecycle state machine, per-object sync status model, error classification, visibility contract |
| **WP-W1-PMSYNC-02** | Ratified conflict vocabulary (9 classes), field authority enum reference, per-object sync status ratification |
| **Decision Log Wave 1 (Decisions 7-9, 18)** | Tier D inclusion, per-object sync status promotion, SYNC_MODES cross-check mandate, SYNC_MODES doc updates |
| **CONNECTOR_BACKEND_DOMAIN_MODEL_V8.md** | Aggregate model (`ConnectorInstallation`, `ConnectionCredentialRef`, `ConnectorRun`, `ExternalObjectMirror`) |
| **CONNECTOR_CONTROL_PLANE_AND_API_CONTRACT_V8.md** | API surface for auth, reauth, sync actions, operator inspection |
| **CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md** | Canonical sync modes, field authority model, conflict classes, resolution paths |

---

## 8. Open questions and conflicts

### 8.1 No inter-document conflicts found

All canonical docs referenced in this analysis are consistent on auth lifecycle, sync modes, conflict vocabulary, and domain model. The Wave 1 cross-check (WP-W1-PMSYNC-02) resolved the naming divergences between `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md` and `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md`. Decision 18 ratified the additions.

### 8.2 Transient-failure discrimination threshold not specified

`CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md` §4.5 requires the platform to "distinguish transient provider failure from true credential expiry" before transitioning to `degraded_reauth_needed`. However, no canonical doc specifies the discrimination criteria (e.g., number of consecutive failures, error code classification, time window).

**Recommendation:** Define a transient-failure discrimination policy per provider family before Tier A implementation. Proposed baseline: 3 consecutive refresh failures within 15 minutes, or a single permanent-error response code (e.g., `invalid_grant`), triggers transition to `degraded_reauth_needed`.

### 8.3 Degraded state escalation thresholds not canonically defined

The escalation policy in §3.4 of this document proposes duration-based thresholds (4h, 24h, 72h). These are not defined in any canonical doc and are proposed as a reasonable baseline.

**Recommendation:** Escalation thresholds should be reviewed by product and ops before implementation. They may need to be configurable per org or per connector family.

### 8.4 Reauth on behalf of another user

The ownership doctrine (OAUTH_LIFECYCLE §5) states that "runtime ownership must not be ambiguous," but does not address whether an admin can reauth a connector on behalf of a user whose token powers it. The routing table in §2.3 assumes the admin cannot reauth without re-consent, but this may not be acceptable for enterprise scenarios where the user is unavailable.

**Recommendation:** Escalate for a product decision: should admin be able to re-bind a connector to a different user's token (effectively changing the runtime identity), or must the original user always re-consent?

### 8.5 Non-Jira Tier A peer selection still open

Multiple canonical docs reference "Asana or Monday" as the first non-Jira Tier A peer. This selection was correctly deferred in WP-W1-PMSYNC-01 §7.4. It remains open and does not block this analysis, but must be resolved before Wave 5 provider-specific hardening begins.

### 8.6 Provider-specific refresh token behavior varies

Some providers (e.g., Atlassian) rotate refresh tokens on every use. Others issue long-lived refresh tokens. The token management contract in §1.2 must accommodate both patterns. The current domain model (`ConnectionCredentialRef`) supports this, but implementation must handle refresh-token rotation atomically to avoid race conditions.

**Recommendation:** Flag refresh-token rotation handling as a Tier A implementation risk item.

---

## 9. Packet output

- **Status:** completed
- **Completed:**
  - Auth lifecycle hardening contract (8 stages, token management, refresh timing, scope integrity)
  - Reauth journey specification (6-step flow, ownership routing, failure handling)
  - Degraded state model (6 conditions, business-object propagation, duration tracking, escalation policy)
  - Sync runtime contract (5-phase job lifecycle, pre-check gate, 6 runtime guarantees, run summary schema, retry policy)
  - Provider tier considerations (Tier A-D auth and sync requirements)
  - Wave 1 platform truth integration (state machines, enums, vocabulary adoption)
  - Downstream dependency map (6 downstream, 6 upstream dependencies)
- **Remaining:**
  - None within packet scope
- **Blockers or risks:**
  - Transient-failure discrimination threshold not yet specified (medium risk — needed before Tier A implementation)
  - Refresh-token rotation race condition handling (low-medium risk — implementation concern for Atlassian/Jira)
  - Non-Jira Tier A peer selection still open (does not block this packet but blocks provider-specific hardening)
- **Questions requiring escalation:**
  1. Should admin be able to re-bind a connector to a different user's token when the original user is unavailable? (§8.4)
  2. What are the approved transient-failure discrimination criteria per provider family? (§8.2)
  3. Are the proposed degraded-state escalation thresholds (4h/24h/72h) acceptable as defaults, and should they be configurable per org? (§8.3)

---

## 10. Context pack

### Canonical docs read

- `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md`
- `CONNECTOR_IMPLEMENTATION_PLAN_V8.md`
- `CONNECTOR_BACKEND_DOMAIN_MODEL_V8.md`
- `CONNECTOR_CONTROL_PLANE_AND_API_CONTRACT_V8.md`
- `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md`
- `EXTERNAL_SYNC_READINESS_AUDIT_V8.md`

### Supporting anchors read

- `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.6
- `WP-W1-PMSYNC-01_PM_SYNC_PLATFORM_TRUTH.md`
- `WP-W1-PMSYNC-02_CONFLICT_CROSSCHECK_AND_RATIFICATION.md`
- `DECISION_LOG_WAVE_1.md` (Decisions 7, 8, 9, 18)
