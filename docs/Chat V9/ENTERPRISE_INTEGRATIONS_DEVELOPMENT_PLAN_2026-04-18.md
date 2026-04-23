# Chat V10 / CONNECTORS — development plan (2026-04-18)

> **Scope note:** this plan is **design-phase** only. It documents the 24
> tickets `V10-CON-001..024` that implement the Enterprise Integrations
> (Connectors) block of Chat V10. **No ticket here is shipped yet.**
>
> Authoritative input: [`DEEP_RESEARCH_ENTERPRISE_INTEGRATIONS_REQUIREMENTS_2026-04-18.md`](./DEEP_RESEARCH_ENTERPRISE_INTEGRATIONS_REQUIREMENTS_2026-04-18.md)
> (R-CONNECT-1..24). Master plan: [`CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md`](./CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md).

> **Cross-refs**
> - Kill-switches & connector incident response → [`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)
> - Adding a new connector → [`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)
> - Telemetry payloads → [`CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md`](./CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md)

## Block summary

Connectors make Chat V10 **operate on the customer's actual work**, not on
chat history. The block defines a uniform `Connector` contract, a secure
OAuth/token layer, ACL propagation, federated search, incremental sync,
freshness SLOs, and a governance surface visible to admins and end users.

Without this block, every other block reasons over demo data. With this
block, Reasoning gets real sources, Onboarding gets real activation,
Research gets real evidence, Artifact gets real inputs, and Outcome gets
real signals.

**MVP focus (Wave A):** `google_drive`, `slack`, `notion`, `email`
(read-only), `calendar` (read-only) with OAuth, ACL propagation, federated
search, and freshness SLO. Wave B: `salesforce`, `hubspot`,
`jira`/`linear`, `github`, `confluence`. Wave C: write-scope connectors
(send email, create jira ticket, post slack message) gated behind
ExecutionProposal + approval.

## Backlog

| ID | Requirement | Priority | Effort | Risk | Wave | Status |
|---|---|---|---|---|---|---|
| [V10-CON-001](#v10-con-001) | R-CONNECT-1: `Connector` interface (contract) | P0 | 2 d | medium | A | 📐 design |
| [V10-CON-002](#v10-con-002) | R-CONNECT-2: connector registry + capability declarations | P0 | 1.5 d | medium | A | 📐 design |
| [V10-CON-003](#v10-con-003) | R-CONNECT-3: OAuth layer (device flow + PKCE) | P0 | 2.5 d | high | A | 📐 design |
| [V10-CON-004](#v10-con-004) | R-CONNECT-4: token vault (encryption at rest, rotation) | P0 | 2 d | high | A | 📐 design |
| [V10-CON-005](#v10-con-005) | R-CONNECT-5: token refresh + revocation | P0 | 1.5 d | high | A | 📐 design |
| [V10-CON-006](#v10-con-006) | R-CONNECT-6: `ConnectorSession` per-user | P0 | 1 d | medium | A | 📐 design |
| [V10-CON-007](#v10-con-007) | R-CONNECT-7: read scopes vs write scopes — explicit split | P0 | 1 d | medium | A | 📐 design |
| [V10-CON-008](#v10-con-008) | R-CONNECT-8: `SourceRef` provenance schema | P0 | 1 d | medium | A | 📐 design |
| [V10-CON-009](#v10-con-009) | R-CONNECT-9: ACL probe (per-source, per-user) | P0 | 2 d | high | A | 📐 design |
| [V10-CON-010](#v10-con-010) | R-CONNECT-10: federated search interface | P0 | 2.5 d | high | A | 📐 design |
| [V10-CON-011](#v10-con-011) | R-CONNECT-11: incremental sync (delta tokens / watermarks) | P0 | 2 d | high | A | 📐 design |
| [V10-CON-012](#v10-con-012) | R-CONNECT-12: freshness SLO tracker (per-connector) | P0 | 1.5 d | medium | A | 📐 design |
| [V10-CON-013](#v10-con-013) | R-CONNECT-13: rate-limit + backoff per-connector | P0 | 1.5 d | medium | A | 📐 design |
| [V10-CON-014](#v10-con-014) | R-CONNECT-14: ACL propagation into retrieved artifacts | P0 | 2 d | high | A | 📐 design |
| [V10-CON-015](#v10-con-015) | R-CONNECT-15: health dashboard (per-connector uptime + error rate) | P0 | 1.5 d | low | A | 📐 design |
| [V10-CON-016](#v10-con-016) | R-CONNECT-16: Google Drive connector (MVP) | P0 | 3 d | medium | A | 📐 design |
| [V10-CON-017](#v10-con-017) | R-CONNECT-17: Slack connector (MVP, read-only) | P0 | 3 d | medium | A | 📐 design |
| [V10-CON-018](#v10-con-018) | R-CONNECT-18: Notion connector (MVP) | P0 | 2.5 d | medium | A | 📐 design |
| [V10-CON-019](#v10-con-019) | R-CONNECT-19: Email connector (Gmail + O365, read-only) | P0 | 3 d | high | A | 📐 design |
| [V10-CON-020](#v10-con-020) | R-CONNECT-20: Calendar connector (Google + O365, read-only) | P0 | 2 d | medium | A | 📐 design |
| [V10-CON-021](#v10-con-021) | R-CONNECT-21: connector governance UI (per-tenant enable/disable + scopes) | P0 | 2 d | low | A | 📐 design |
| [V10-CON-022](#v10-con-022) | R-CONNECT-22: user-level connector disconnect + token forgetting | P0 | 1 d | medium | A | 📐 design |
| [V10-CON-023](#v10-con-023) | R-CONNECT-23: connector telemetry (read/write calls, latency, failures) | P0 | 1.5 d | low | A | 📐 design |
| [V10-CON-024](#v10-con-024) | R-CONNECT-24: write-scope framework (gated behind ExecutionProposal) | P0 | 2 d | high | C | 📐 design |

**Totals:** 24 tickets, all P0. Estimated effort ≈47 engineer-days for Wave A; Wave B/C additions separate.

**Proposed flag namespace:** `ff.connector_*`.

---

<a id="v10-con-001"></a>

## V10-CON-001 — `Connector` interface

**Requirement:** R-CONNECT-1 (P0) — every integration implements a single contract.

**Design.** Interface in `src/services/connectors/types.ts`:

```ts
export interface Connector {
  id: ConnectorId;
  version: string;
  capabilities: CapabilityFlag[];   // "search" | "read_doc" | "list_recent" | "write_doc" | ...
  authStrategy: AuthStrategy;
  acl: ACLProvider;                 // V10-CON-009
  search: SearchProvider;           // V10-CON-010
  read: ReadProvider;
  write?: WriteProvider;            // optional, gated (V10-CON-024)
  sync: SyncProvider;               // V10-CON-011
  health: HealthProbe;              // V10-CON-015
}
```

**Acceptance criteria.**
- Every connector exports a `Connector` export; registry (V10-CON-002) validates conformance.
- CI invariant 44 asserts no direct HTTP calls to vendor APIs outside connector modules.

**Cross-refs.** V10-CON-002, contributor guide.

---

<a id="v10-con-002"></a>

## V10-CON-002 — registry + capability declarations

**Requirement:** R-CONNECT-2 (P0) — discoverable, declarative connector set.

**Design.** Static registry of all connectors + their capability flags. Reasoning retrieval (V10-RSN-006) queries registry to know which connectors to fan out to. Onboarding (V10-ONB-009) reads registry to rank recommended connectors for a persona.

**Acceptance criteria.**
- Registry is closed set; adding a connector without registry entry fails CI.
- Capability flags are typed (no free-form strings).

**Cross-refs.** V10-RSN-006, V10-ONB-009.

---

<a id="v10-con-003"></a>

## V10-CON-003 — OAuth layer

**Requirement:** R-CONNECT-3 (P0) — standard OAuth with PKCE.

**Design.** Central OAuth orchestrator handles:
- Authorisation URL build (with state, nonce, PKCE challenge)
- Callback exchange for tokens
- Device flow for desktop/mobile
- Consent scope introspection (record which scopes user actually granted)

Connectors declare scopes; OAuth layer enforces they are requested.

**Acceptance criteria.**
- No connector handles OAuth directly; all routes through orchestrator.
- State / nonce / PKCE enforced on every flow.

**Cross-refs.** V10-CON-004, V10-CON-007.

---

<a id="v10-con-004"></a>

## V10-CON-004 — token vault

**Requirement:** R-CONNECT-4 (P0) — tokens encrypted at rest, rotated.

**Design.** Token store with:
- Per-tenant encryption key (KMS-backed)
- Per-user encryption envelope
- Rotation on refresh
- Never log / return in plaintext
- Vault ACL: only `ConnectorSession` can read, never exported

**Acceptance criteria.**
- Tokens encrypted end-to-end in persistence layer.
- No log line contains token material (CI regex guard).

**Cross-refs.** V10-CON-005, V10-CON-022.

---

<a id="v10-con-005"></a>

## V10-CON-005 — token refresh + revocation

**Requirement:** R-CONNECT-5 (P0) — keep tokens fresh, honour revoke.

**Design.** Background refresh scheduler; refresh happens N minutes before expiry (N per-connector). On refresh failure → mark session as `needs_reauth`, surface in UI, pause all connector calls. Revoke flow is explicit and deletes tokens from vault.

**Acceptance criteria.**
- Token refresh is idempotent; concurrent refresh → single call.
- Revoke wipes tokens from vault within 1s.

**Cross-refs.** V10-CON-022.

---

<a id="v10-con-006"></a>

## V10-CON-006 — `ConnectorSession`

**Requirement:** R-CONNECT-6 (P0) — per-user session object.

**Design.** Every connector call runs in a `ConnectorSession { userId, tenantId, connectorId, token, scopes, expiresAt }`. Never shared across users. Never persisted beyond token vault.

**Cross-refs.** V10-CON-014.

---

<a id="v10-con-007"></a>

## V10-CON-007 — read vs write scopes split

**Requirement:** R-CONNECT-7 (P0) — write scopes are separate, explicit, auditable.

**Design.** Connector declares `readScopes[]` and `writeScopes[]`. Read scopes granted during normal onboarding. Write scopes require a separate, explicit user consent flow invoked at first write-intent (not at onboarding). All writes require ExecutionProposal approval (V10-AGT-001).

**Acceptance criteria.**
- Onboarding never requests write scopes.
- Write-scope grant is a distinct UI flow with explicit copy.

**Cross-refs.** V10-CON-024, V10-AGT-001.

---

<a id="v10-con-008"></a>

## V10-CON-008 — `SourceRef` provenance schema

**Requirement:** R-CONNECT-8 (P0) — every retrieved source carries provenance.

**Design.** Schema in `src/models/connectors/SourceRef.ts`:

```ts
export type SourceRef = {
  id: SourceId;                // stable
  connectorId: ConnectorId;
  vendorType: string;          // "google_doc" | "slack_message" | ...
  vendorId: string;            // vendor-native ID
  tenantId: TenantId;
  title: string;
  uri: string;                 // deep link back to vendor
  lastModifiedAt: Timestamp;
  freshnessAt: Timestamp;      // when we last fetched it
  aclFingerprint: string;      // hash of ACL set — V10-CON-014
};
```

**Cross-refs.** V10-RSN-006, V10-ART-009.

---

<a id="v10-con-009"></a>

## V10-CON-009 — ACL probe

**Requirement:** R-CONNECT-9 (P0) — verify per-user, per-source access before returning.

**Design.** Each connector implements `canRead(userId, sourceId) → boolean`. Federated search (V10-CON-010) calls probe in batch before returning results. Reasoning (V10-RSN-006) never sees a source user cannot access.

**Acceptance criteria.**
- No search result returned without ACL probe pass.
- ACL probe caching respects vendor ACL changes (TTL ≤ 5 min).

**Cross-refs.** V10-CON-014.

---

<a id="v10-con-010"></a>

## V10-CON-010 — federated search

**Requirement:** R-CONNECT-10 (P0) — query multiple connectors, merged ranking.

**Design.** `federatedSearch(userId, query, filters) → SourceRef[]`. Fans out to enabled connectors in parallel with per-connector timeout; merges and ranks by relevance × freshness × access-confidence. Applies scope ACLs before return.

**Acceptance criteria.**
- Fan-out parallelism; one slow connector never blocks others beyond timeout.
- Result set deterministic for same inputs (given cache state).

**Cross-refs.** V10-RSN-006.

---

<a id="v10-con-011"></a>

## V10-CON-011 — incremental sync

**Requirement:** R-CONNECT-11 (P0) — delta tokens / watermarks, not full re-fetch.

**Design.** Each connector exposes a `sync(watermark) → { items, nextWatermark }`. Scheduler runs per tenant every N minutes (configurable), walks watermark, updates local index. Freshness SLO (V10-CON-012) reads watermark.

**Acceptance criteria.**
- Sync is incremental in steady-state (full sync only on first connect or watermark loss).
- Failed sync does not advance watermark.

**Cross-refs.** V10-CON-012.

---

<a id="v10-con-012"></a>

## V10-CON-012 — freshness SLO

**Requirement:** R-CONNECT-12 (P0) — freshness is measured + surfaced.

**Design.** Per-connector SLO (e.g. Drive ≤15 min, Slack ≤2 min, Email ≤10 min). Freshness breach → health dashboard flag + downstream retrieval marks source as `stale`. Reasoning retrieval surfaces staleness in citation panel.

**Cross-refs.** V10-CON-015, V10-RSN-010 (source freshness feeds hedging).

---

<a id="v10-con-013"></a>

## V10-CON-013 — rate limit + backoff

**Requirement:** R-CONNECT-13 (P0) — respect vendor limits, never cause outage.

**Design.** Per-connector rate limit config; shared token bucket per tenant. On 429 → exponential backoff + jitter; on persistent 429 → open circuit breaker, pause connector, alert health dashboard.

**Cross-refs.** V10-CON-015.

---

<a id="v10-con-014"></a>

## V10-CON-014 — ACL propagation

**Requirement:** R-CONNECT-14 (P0) — retrieved artifact carries original ACL fingerprint.

**Design.** On retrieval, ACL fingerprint from source is attached to `SourceRef`. Reasoning scope resolver (V10-RSN-003) unions fingerprints and checks consuming user still matches. Cross-user contamination is impossible by construction.

**Acceptance criteria.**
- Cached retrieval never bypasses current-user ACL check.
- Fingerprint mismatch → source dropped from results, event logged.

**Cross-refs.** V10-CON-009, V10-RSN-003.

---

<a id="v10-con-015"></a>

## V10-CON-015 — health dashboard

**Requirement:** R-CONNECT-15 (P0) — per-connector uptime, error rate, freshness.

**Design.** Admin UI with one card per connector. Status: `healthy` | `degraded` | `down`. Driven by telemetry (V10-CON-023) + freshness SLO (V10-CON-012). Includes "last successful sync" + "last error".

**Cross-refs.** V10-CON-023.

---

<a id="v10-con-016"></a>

## V10-CON-016 — Google Drive connector

**Requirement:** R-CONNECT-16 (P0) — MVP connector.

**Design.** Read scopes: `drive.readonly`, `drive.metadata.readonly`. Implements search (via Drive API), read (files.export for docs), sync (changes API with watermark = `pageToken`). ACL probe: `files.get` with fields=`permissions` mapped to tenant user.

**Acceptance criteria.**
- Search P90 latency ≤ 1.5s.
- Freshness ≤ 15 min.

**Cross-refs.** V10-CON-010, V10-CON-011.

---

<a id="v10-con-017"></a>

## V10-CON-017 — Slack connector

**Requirement:** R-CONNECT-17 (P0) — MVP connector, read-only.

**Design.** Scopes: `search:read`, `channels:history`, `users:read`. Search messages + threads; ACL derived from channel membership. No posting in MVP (deferred to V10-CON-024 + Wave C).

**Acceptance criteria.**
- Private channels not in user's membership never returned.
- Freshness ≤ 2 min via Events API webhook (with polling fallback).

**Cross-refs.** V10-CON-014.

---

<a id="v10-con-018"></a>

## V10-CON-018 — Notion connector

**Requirement:** R-CONNECT-18 (P0) — MVP connector.

**Design.** Uses Notion API search + page fetch. ACL derived from page permissions. Sync via last-edited-time watermark.

---

<a id="v10-con-019"></a>

## V10-CON-019 — Email connector

**Requirement:** R-CONNECT-19 (P0) — MVP connector, read-only.

**Design.** Gmail + O365. Read scope only. High sensitivity → explicit consent copy at OAuth time; per-tenant admin can force-disable. ACL = user's own mailbox only (no shared inbox contamination). Hide contents under default classification `Sensitive` unless user opts-in per artifact.

**Acceptance criteria.**
- Default classification for retrieved email = `sensitive`.
- Per-tenant admin kill switch works.

**Cross-refs.** V10-ART-008 (DataClassification).

---

<a id="v10-con-020"></a>

## V10-CON-020 — Calendar connector

**Requirement:** R-CONNECT-20 (P0) — MVP connector, read-only.

**Design.** Google + O365 calendar. Fetches events (title, attendees, times). Powers meeting intelligence skills. Read-only in Wave A.

---

<a id="v10-con-021"></a>

## V10-CON-021 — governance UI

**Requirement:** R-CONNECT-21 (P0) — admin controls.

**Design.** Per-tenant admin page:
- Enable / disable each connector
- Restrict which scopes are allowed
- View per-user connection status
- View tenant-wide connector health
- Force-disconnect a user's connection
- Export audit log of connector calls

**Cross-refs.** V10-CON-023.

---

<a id="v10-con-022"></a>

## V10-CON-022 — user-level disconnect + forgetting

**Requirement:** R-CONNECT-22 (P0) — right-to-forget connector data.

**Design.** User can disconnect a connector in settings. Flow:
1. Revoke token with vendor (best-effort).
2. Delete token from vault.
3. Purge user-specific indexed data.
4. Emit audit event `connector.disconnected`.

**Acceptance criteria.**
- Disconnect completes within 5s.
- Purge verifiable via admin export.

**Cross-refs.** V10-CON-004, V10-CON-023.

---

<a id="v10-con-023"></a>

## V10-CON-023 — connector telemetry

**Requirement:** R-CONNECT-23 (P0) — observability.

**Design.** Events: `connector.connected`, `connector.token_refreshed`, `connector.token_refresh_failed`, `connector.search_called`, `connector.read_called`, `connector.write_called`, `connector.rate_limited`, `connector.error`, `connector.sync_started`, `connector.sync_completed`, `connector.freshness_breach`, `connector.disconnected`. Per-event properties: `connector_id`, `tenant_id`, `user_id` (hashed), `duration_ms`, `status`.

---

<a id="v10-con-024"></a>

## V10-CON-024 — write-scope framework

**Requirement:** R-CONNECT-24 (P0) — Wave C. Writes are gated behind ExecutionProposal + approval.

**Design.** Connector `write` provider is invocable only from Agent Runtime's executor after ExecutionProposal approval. Write scope grant is separate from read scope. Every write logs a `connector.write_called` event with proposal ID. Write-scope tests include dry-run + idempotency.

**Cross-refs.** V10-CON-007, V10-AGT-001, V10-AGT-004.

---

## Test strategy (aggregate)

- Unit: 24 tickets × typical 2–4 unit tests each (~70 tests) — interface conformance, OAuth state machine, token vault encryption, ACL probe, sync watermark logic.
- Integration: one E2E per connector — OAuth → search → read → disconnect.
- Chaos: token expiry mid-call, vendor 429, vendor 500, ACL change mid-session, watermark loss.
- Security: no-token-in-logs regex sweep; encryption-at-rest verification; scope-granted vs scope-requested parity.

**Pre-release gate.** Wave A: 5 MVP connectors (Drive, Slack, Notion, Email, Calendar) green on E2E + chaos; token vault audit clean; ACL propagation holds across 1000-item fuzz set.

## MVP exit criteria (Wave A)

1. `Connector` interface + registry + 5 MVP connectors implemented.
2. OAuth + token vault + refresh/revoke all green.
3. ACL probe + ACL propagation enforced; no cross-user contamination in fuzz test.
4. Federated search returns ranked + ACL-filtered results.
5. Incremental sync working with freshness SLO monitored per connector.
6. Governance UI + user disconnect flow live.
7. Telemetry contract extended with the 12 `connector.*` events.
8. CI invariant 44 (no direct vendor API calls) green.

## Rollout order

1. **Contract** (V10-CON-001 → 002) — interface + registry.
2. **Auth** (V10-CON-003 → 004 → 005 → 006 → 007) — OAuth, vault, refresh, session, scope split.
3. **Provenance + ACL** (V10-CON-008 → 009 → 014) — SourceRef + ACL probe + propagation.
4. **Read paths** (V10-CON-010 → 011 → 012 → 013) — federated search, sync, freshness, rate limit.
5. **Observability** (V10-CON-015 → 023) — health dashboard + telemetry.
6. **MVP connectors** (V10-CON-016..020) — Drive, Slack, Notion, Email, Calendar.
7. **Governance** (V10-CON-021 → 022) — admin + user controls.
8. **Write scope** (V10-CON-024) — Wave C, gated.

## Cross-refs to sibling dev plans

| Block | What they need from Connectors |
|---|---|
| Reasoning | Federated search + SourceRef + ACL filtering (V10-RSN-006) |
| Onboarding | Connector registry + persona-based ranking (V10-ONB-009..010) |
| Artifact | SourceRef provenance on MutationProposals (V10-ART-009) |
| Agent Runtime | Write-scope gating via ExecutionProposal (V10-CON-024) |
| Research | Private-first retrieval before open web (V10-RSR-*) |
| ROI / Outcome | Signal ingest from CRM / PM / calendar (Wave B connectors) |
| Learning | Interaction signals across connectors for feedback (V10-LRN-*) |

Connectors is a **foundation for real work** — if it is missing, every other block falls back to demo data.

## Flags to register at implementation time

24 flags (`ff.connector_*`). Key Wave A:

- `ff.connector_interface_v1` (V10-CON-001) — **on-by-construction**
- `ff.connector_registry` (V10-CON-002) — **on-by-construction**
- `ff.connector_oauth` (V10-CON-003)
- `ff.connector_token_vault` (V10-CON-004) — **on-by-construction**
- `ff.connector_token_refresh` (V10-CON-005) — **on-by-construction**
- `ff.connector_session` (V10-CON-006)
- `ff.connector_scope_split` (V10-CON-007) — **on-by-construction**
- `ff.connector_source_ref` (V10-CON-008)
- `ff.connector_acl_probe` (V10-CON-009) — **on-by-construction**
- `ff.connector_federated_search` (V10-CON-010)
- `ff.connector_incremental_sync` (V10-CON-011)
- `ff.connector_freshness_slo` (V10-CON-012)
- `ff.connector_rate_limit` (V10-CON-013) — **on-by-construction**
- `ff.connector_acl_propagation` (V10-CON-014) — **on-by-construction**
- `ff.connector_health_dashboard` (V10-CON-015)
- `ff.connector_google_drive` (V10-CON-016)
- `ff.connector_slack` (V10-CON-017)
- `ff.connector_notion` (V10-CON-018)
- `ff.connector_email` (V10-CON-019)
- `ff.connector_calendar` (V10-CON-020)
- `ff.connector_governance_ui` (V10-CON-021)
- `ff.connector_user_disconnect` (V10-CON-022) — **on-by-construction**
- `ff.connector_telemetry_full` (V10-CON-023)

Wave C: `ff.connector_write_framework` (V10-CON-024) — behind explicit admin opt-in per tenant.

Safety flags on-by-construction: interface + registry, token vault, refresh, scope split, ACL probe, ACL propagation, rate limit, user disconnect.
