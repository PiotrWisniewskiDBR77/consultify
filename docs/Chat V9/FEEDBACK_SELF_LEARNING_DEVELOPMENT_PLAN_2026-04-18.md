# Chat V10 / LEARNING — development plan (2026-04-18)

> **Scope note:** this plan is **design-phase** only. It documents the 18
> tickets `V10-LRN-001..018` that implement the Feedback &
> Self-Learning block of Chat V10. **No ticket here is shipped yet.**
>
> Authoritative input: [`DEEP_RESEARCH_FEEDBACK_SELF_LEARNING_REQUIREMENTS_2026-04-18.md`](./DEEP_RESEARCH_FEEDBACK_SELF_LEARNING_REQUIREMENTS_2026-04-18.md)
> (R-LEARN-1..18). Master plan: [`CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md`](./CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md).

> **Cross-refs**
> - Kill-switches & learning incident response → [`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)
> - Adding a learning signal → [`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)
> - Telemetry payloads → [`CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md`](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md)

## Block summary

Learning is how Chat V10 **gets better per tenant without memorising
secrets** and **without drifting into stale preferences**. The block
defines:

- Explicit opt-in per feedback channel (typed consent).
- Typed **FeedbackSignal** events across behavioural, explicit, and audit sources.
- A per-tenant **preference store** (`MemoryPackV1`) with TTL, forgetting, and revocation.
- Guardrails that prevent learning from poisoning reasoning (never override TrustBundle / approval gates).
- Aggregated quality signals fed back into routing, coverage, and prompt selection.

**Non-goals (explicit).** No user-specific fine-tuning, no PII in prompts,
no training on raw customer data, no tenant-level model weights. Learning
is **prompt / routing / retrieval** signal, not model weights.

**MVP focus (Wave A):** explicit consent, typed FeedbackSignal, MemoryPack
store with TTL, three channels (thumbs, undo, outcome), and routing
adjustment. Wave B: adaptive coverage thresholds, per-tenant
prompt snippets, interaction-based connector ranking.

## Backlog

| ID | Requirement | Priority | Effort | Risk | Wave | Status |
|---|---|---|---|---|---|---|
| [V10-LRN-001](#v10-lrn-001) | R-LEARN-1: typed consent for learning channels | P0 | 1.5 d | medium | A | 📐 design |
| [V10-LRN-002](#v10-lrn-002) | R-LEARN-2: `FeedbackSignalV1` schema | P0 | 1.5 d | medium | A | 📐 design |
| [V10-LRN-003](#v10-lrn-003) | R-LEARN-3: feedback collector (thumbs + free text + category) | P0 | 2 d | low | A | 📐 design |
| [V10-LRN-004](#v10-lrn-004) | R-LEARN-4: behavioural signals (undo, abandon, edit-after-accept) | P0 | 2 d | medium | A | 📐 design |
| [V10-LRN-005](#v10-lrn-005) | R-LEARN-5: outcome signals (KPI accept, proposal accept rate, rerun rate) | P0 | 2 d | medium | A | 📐 design |
| [V10-LRN-006](#v10-lrn-006) | R-LEARN-6: `MemoryPackV1` schema + store | P0 | 2 d | high | A | 📐 design |
| [V10-LRN-007](#v10-lrn-007) | R-LEARN-7: memory pack TTL + forgetting | P0 | 1.5 d | high | A | 📐 design |
| [V10-LRN-008](#v10-lrn-008) | R-LEARN-8: memory pack revocation (user + admin) | P0 | 1 d | high | A | 📐 design |
| [V10-LRN-009](#v10-lrn-009) | R-LEARN-9: routing adjustment from memory pack | P0 | 2 d | medium | A | 📐 design |
| [V10-LRN-010](#v10-lrn-010) | R-LEARN-10: PII redaction on signal ingest | P0 | 2 d | high | A | 📐 design |
| [V10-LRN-011](#v10-lrn-011) | R-LEARN-11: never-override invariants (TrustBundle, approval, safety) | P0 | 1 d | high | A | 📐 design |
| [V10-LRN-012](#v10-lrn-012) | R-LEARN-12: signal telemetry + dashboard | P0 | 1.5 d | low | A | 📐 design |
| [V10-LRN-013](#v10-lrn-013) | R-LEARN-13: adaptive coverage threshold (per-tenant) | P1 | 2 d | medium | B | 📐 design |
| [V10-LRN-014](#v10-lrn-014) | R-LEARN-14: tenant-level prompt snippets (governed) | P1 | 2 d | high | B | 📐 design |
| [V10-LRN-015](#v10-lrn-015) | R-LEARN-15: connector ranking from interaction history | P1 | 1.5 d | low | B | 📐 design |
| [V10-LRN-016](#v10-lrn-016) | R-LEARN-16: drift detection (signals disagreeing over time) | P0 | 2 d | high | A | 📐 design |
| [V10-LRN-017](#v10-lrn-017) | R-LEARN-17: learning audit export | P0 | 1 d | medium | A | 📐 design |
| [V10-LRN-018](#v10-lrn-018) | R-LEARN-18: kill-switch per-tenant (disable all learning) | P0 | 1 d | medium | A | 📐 design |

**Totals:** 18 tickets (15 × P0, 3 × P1). Estimated effort ≈28 engineer-days.

**Proposed flag namespace:** `ff.learning_*`.

---

<a id="v10-lrn-001"></a>

## V10-LRN-001 — typed consent

**Requirement:** R-LEARN-1 (P0) — learning is **opt-in** per channel.

**Design.** Consent record in `src/models/learning/LearningConsent.ts`:

```ts
export type LearningConsent = {
  tenantId: TenantId;
  userId: UserId;
  channels: {
    explicit_feedback: boolean;    // thumbs, free text
    behavioural: boolean;          // undo, abandon, edit-after-accept
    outcome: boolean;              // KPI accept, proposal accept rate
    routing_adjustment: boolean;   // use pack to adjust routing
    prompt_snippets: boolean;      // tenant-level prompt bits (Wave B)
  };
  revokedAt?: Timestamp;
  updatedAt: Timestamp;
};
```

Consent UI in settings with plain-language copy + separate toggles per channel. Default: all off. No legitimate-interest fallback.

**Acceptance criteria.**
- No signal is ingested without matching channel consent.
- Revocation purges pack (V10-LRN-008) and halts ingest immediately.

**Cross-refs.** V10-LRN-008, V10-ONB-018.

---

<a id="v10-lrn-002"></a>

## V10-LRN-002 — `FeedbackSignalV1`

**Requirement:** R-LEARN-2 (P0) — every signal is typed and auditable.

**Design.** Schema:

```ts
export type FeedbackSignalV1 = {
  id: SignalId;
  tenantId: TenantId;
  userId: UserId;                  // hashed beyond this point
  correlationId: string;           // ties to turn / proposal / artifact
  channel: LearningChannel;
  kind: "positive" | "negative" | "neutral" | "directional";
  subject: SignalSubject;          // "answer" | "artifact" | "proposal" | "connector" | "workload_class"
  subjectId: string;
  attributes: Record<string, JsonValue>;  // sanitised (V10-LRN-010)
  createdAt: Timestamp;
};
```

**Acceptance criteria.**
- Signals without consent are rejected at ingest.
- PII redaction (V10-LRN-010) runs before persistence.

**Cross-refs.** V10-LRN-010.

---

<a id="v10-lrn-003"></a>

## V10-LRN-003 — feedback collector

**Requirement:** R-LEARN-3 (P0) — user-initiated feedback UI.

**Design.** Per-answer thumbs (up/down) + optional category dropdown (wrong, incomplete, off-tone, safety) + optional free text. Free text passes through redaction before signal is created.

**Acceptance criteria.**
- Feedback submit latency ≤ 200 ms perceived.
- Duplicate thumbs on same subject is idempotent.

**Cross-refs.** V10-LRN-002.

---

<a id="v10-lrn-004"></a>

## V10-LRN-004 — behavioural signals

**Requirement:** R-LEARN-4 (P0) — observe outcomes without asking.

**Design.** Emits signals on:
- Undo within 60s of acceptance → negative signal for proposal.
- User abandons draft without acceptance → neutral / mild-negative signal.
- User edits a KPI / accepted value within 10 min → directional signal with delta.
- User rejects a proposal with "wrong tool" → negative routing signal.

All tied to `correlationId` from the originating turn.

**Cross-refs.** V10-AGT-008 (undo), V10-ART-013 (partial acceptance).

---

<a id="v10-lrn-005"></a>

## V10-LRN-005 — outcome signals

**Requirement:** R-LEARN-5 (P0) — downstream outcomes feed learning.

**Design.** Signals from Outcome block:
- Onboarding activation success → positive routing signal for the persona path.
- Proposal ship → positive artifact signal.
- Proposal re-run within 24 h → negative quality signal.
- KPI accept → positive grounded-chat signal.

**Cross-refs.** V10-OUT-* (ROI block).

---

<a id="v10-lrn-006"></a>

## V10-LRN-006 — `MemoryPackV1`

**Requirement:** R-LEARN-6 (P0) — per-tenant pack of learned preferences.

**Design.** Schema:

```ts
export type MemoryPackV1 = {
  tenantId: TenantId;
  version: number;                // monotonic
  preferences: {
    workloadAdjustments?: Record<WorkloadClass, WorkloadAdjustment>;
    connectorPreferences?: Record<ConnectorId, { weight: number }>;
    coverageOverrides?: Record<WorkloadClass, number>;
    tonePreference?: ToneLabel;
    language?: LangCode;
  };
  provenance: SignalId[];         // signals that contributed
  createdAt: Timestamp;
  ttlAt: Timestamp;               // V10-LRN-007
};
```

Stored per-tenant, versioned, bounded in size. No user-specific pack (tenant granularity) in Wave A; per-user pack deferred.

**Acceptance criteria.**
- Pack size bounded (≤ 32 KB per tenant); oldest provenance dropped first.
- Pack version increments on every update.

**Cross-refs.** V10-LRN-007, V10-LRN-009.

---

<a id="v10-lrn-007"></a>

## V10-LRN-007 — TTL + forgetting

**Requirement:** R-LEARN-7 (P0) — preferences decay if not reinforced.

**Design.** Each preference entry has an independent TTL (30 / 60 / 90 days). Reinforcing signal extends TTL. Expired entries are purged from pack. Full pack TTL backstop of 180 days forces revalidation.

**Acceptance criteria.**
- Expired entries never surface in routing.
- Purge is deterministic and logged.

**Cross-refs.** V10-LRN-012.

---

<a id="v10-lrn-008"></a>

## V10-LRN-008 — revocation

**Requirement:** R-LEARN-8 (P0) — user or admin can wipe the pack.

**Design.** Two revocation flows:
- **User:** settings → "Reset learned preferences" → wipes user-scoped entries.
- **Admin:** tenant settings → "Reset tenant learning pack" → wipes entire pack + halts ingest for 24 h.

Both flows emit an audit event and are reversible only via new consent + new signals (old signals stay deleted).

**Acceptance criteria.**
- Revocation completes within 2s.
- Audit log lists revocation + scope.

**Cross-refs.** V10-LRN-017.

---

<a id="v10-lrn-009"></a>

## V10-LRN-009 — routing adjustment

**Requirement:** R-LEARN-9 (P0) — apply pack when routing.

**Design.** Reasoning router (V10-RSN-001) reads pack at turn start; applies workload adjustments (e.g. prefer `grounded_chat` over `fast_chat` for this tenant), coverage overrides (tighten threshold for workloads with historical quality issues), and connector preferences (prefer Drive over Notion in search ranking). Adjustments are **bounded** (cannot cross safety thresholds — V10-LRN-011).

**Acceptance criteria.**
- Adjustments never drop coverage below workload minimum.
- Adjustment decisions appear in reasoning telemetry (`learning_adjustment_applied`).

**Cross-refs.** V10-RSN-001, V10-RSN-010, V10-LRN-011.

---

<a id="v10-lrn-010"></a>

## V10-LRN-010 — PII redaction

**Requirement:** R-LEARN-10 (P0) — never persist PII in signals or pack.

**Design.** Redaction pipeline on ingest: emails, phone numbers, SSN-like strings, customer-data samples are replaced with typed tokens (`<email>`, `<phone>`). Free-text feedback length-capped at 500 chars and passed through the same redactor. The redaction spec is shared with V9 telemetry redaction (if available).

**Acceptance criteria.**
- Fuzz test: 1000 realistic PII samples → 0 leaks post-redaction.
- Redaction is deterministic and logged (without revealing raw input).

**Cross-refs.** V10-LRN-002.

---

<a id="v10-lrn-011"></a>

## V10-LRN-011 — never-override invariants

**Requirement:** R-LEARN-11 (P0) — learning never weakens safety.

**Design.** Explicit invariants:
- Learning never lowers a workload's minimum coverage below spec.
- Learning never disables approval gates.
- Learning never changes DataClassification.
- Learning never unlocks write scopes.
- Learning never overrides TrustBundle hash verification.

Enforced by CI test suite that feeds adversarial packs into router and asserts guarantees hold.

**Cross-refs.** V10-RSN-013, V10-CON-007, V10-ART-008.

---

<a id="v10-lrn-012"></a>

## V10-LRN-012 — telemetry + dashboard

**Requirement:** R-LEARN-12 (P0) — observability.

**Design.** Events: `learning.consent_granted`, `learning.consent_revoked`, `learning.signal_ingested`, `learning.signal_rejected`, `learning.pack_updated`, `learning.pack_revoked`, `learning.adjustment_applied`, `learning.drift_detected`. Admin dashboard shows per-tenant: signal volume, pack size, adjustment frequency, drift incidents.

**Cross-refs.** V10-LRN-016.

---

<a id="v10-lrn-013"></a>

## V10-LRN-013 — adaptive coverage threshold

**Requirement:** R-LEARN-13 (P1) — per-tenant coverage override.

**Design.** Wave B. If a tenant's veto / low-coverage rate is persistently low (e.g. <2%), router can offer a stricter coverage target (opt-in via admin). Conversely, sustained high veto rate triggers an admin nudge. Never lowers minimum, only raises.

**Cross-refs.** V10-RSN-010.

---

<a id="v10-lrn-014"></a>

## V10-LRN-014 — tenant prompt snippets

**Requirement:** R-LEARN-14 (P1) — governed tenant-level prompt bits.

**Design.** Wave B. Admin-curated short snippets injected into system prompts (e.g. "This tenant refers to clients as 'customers' not 'accounts'"). Snippets are reviewed, versioned, auditable; size-capped; never contain PII; learning pack can **suggest** snippets but admin must approve.

**Cross-refs.** V10-LRN-017.

---

<a id="v10-lrn-015"></a>

## V10-LRN-015 — connector ranking from interaction history

**Requirement:** R-LEARN-15 (P1) — rank connectors by observed usage value.

**Design.** Wave B. Boosts connector rank in retrieval based on historical citation usefulness (did answers citing Drive get positive outcomes?). Capped adjustment; never excludes a connector.

**Cross-refs.** V10-CON-010, V10-RSN-006.

---

<a id="v10-lrn-016"></a>

## V10-LRN-016 — drift detection

**Requirement:** R-LEARN-16 (P0) — detect contradictions over time.

**Design.** Rolling comparison of signal aggregates: if recent signals contradict established pack preferences by >X%, a drift event fires. Actions:
- Flag pack entries as `drifting`.
- Shrink adjustment magnitude.
- Surface admin notification + suggest pack revalidation.

**Acceptance criteria.**
- Drift detector triggers on synthetic contradictory signal set.
- Mitigation applied within one turn after drift fires.

**Cross-refs.** V10-LRN-012.

---

<a id="v10-lrn-017"></a>

## V10-LRN-017 — learning audit export

**Requirement:** R-LEARN-17 (P0) — export signals + pack for audit.

**Design.** Admin can export per-tenant:
- Learning consent history
- All ingested signals (with IDs + metadata, no PII raw form)
- Pack versions
- Adjustment events
- Drift events

Exported as JSON Lines. Read-only; tamper-evident via checksum.

**Cross-refs.** V10-LRN-008, V10-LRN-016.

---

<a id="v10-lrn-018"></a>

## V10-LRN-018 — per-tenant kill switch

**Requirement:** R-LEARN-18 (P0) — admin can instantly disable all learning.

**Design.** Single admin toggle. When off:
- No signals ingested (rejected at source).
- Pack is preserved but not applied to routing.
- Telemetry keeps recording for audit purposes only.

Kill switch is wired to the operations runbook.

**Cross-refs.** V10-LRN-001, V10-LRN-009, ops runbook.

---

## Test strategy (aggregate)

- Unit: 18 tickets × ~3 unit tests (~55 tests) — consent enforcement, signal schema, TTL decay, revocation paths, PII redaction, adjustment bounds, drift detector, kill switch.
- Integration: end-to-end consent → signal ingest → pack update → routing adjustment → outcome signal → pack update.
- Security fuzz: 1000 PII samples through redactor; adversarial pack → no safety bypass.
- Compliance: export → schema validation + PII-free check.

**Pre-release gate.** Wave A: all consent paths green; adversarial pack cannot weaken safety invariants; PII fuzz clean; kill switch halts all ingest within 2s.

## MVP exit criteria (Wave A)

1. Typed consent per channel; default-off; revocation works within 2s.
2. `FeedbackSignalV1` schema + collector + behavioural + outcome signals ingest with consent.
3. MemoryPackV1 with TTL, forgetting, and revocation.
4. Routing adjustment applies bounded preferences (never weakens safety).
5. PII redaction passes 1000-sample fuzz.
6. Drift detector triggers + applies mitigation.
7. Audit export + tenant kill switch live.
8. Telemetry contract extended with 8 `learning.*` events.
9. CI tests (never-override invariants) green.

## Rollout order

1. **Consent + redaction** (V10-LRN-001 → 010 → 011) — do not ingest anything without these.
2. **Signals** (V10-LRN-002 → 003 → 004 → 005) — schema + collector + behavioural + outcome.
3. **Pack + forgetting** (V10-LRN-006 → 007 → 008) — store + TTL + revocation.
4. **Apply** (V10-LRN-009) — routing adjustment.
5. **Governance + observability** (V10-LRN-012 → 016 → 017 → 018) — dashboard + drift + audit + kill switch.
6. **Wave B** — V10-LRN-013, 014, 015.

## Cross-refs to sibling dev plans

| Depends on | What's needed |
|---|---|
| `REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md` | Hook in router start (V10-RSN-001), coverage scorer (V10-RSN-010) |
| `AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` | Undo events → behavioural signals (V10-AGT-008) |
| `ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` | Partial acceptance / revert → signals (V10-ART-013) |
| `ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md` | Connector ranking input (V10-CON-010) |
| `ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md` | Outcome signals (V10-OUT-*) |
| `ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md` | Learning opt-in (V10-ONB-018) |

Learning is the **smallest** block by effort but the **highest-risk** by
trust — every ticket above exists primarily to bound what learning can
change.

## Flags to register at implementation time

18 flags (`ff.learning_*`). Key Wave A:

- `ff.learning_consent_v1` (V10-LRN-001) — **on-by-construction**
- `ff.learning_signal_schema` (V10-LRN-002) — **on-by-construction**
- `ff.learning_feedback_ui` (V10-LRN-003)
- `ff.learning_behavioural_signals` (V10-LRN-004)
- `ff.learning_outcome_signals` (V10-LRN-005)
- `ff.learning_memory_pack_v1` (V10-LRN-006)
- `ff.learning_ttl_forgetting` (V10-LRN-007) — **on-by-construction**
- `ff.learning_revocation` (V10-LRN-008) — **on-by-construction**
- `ff.learning_routing_adjustment` (V10-LRN-009)
- `ff.learning_pii_redaction` (V10-LRN-010) — **on-by-construction**
- `ff.learning_never_override` (V10-LRN-011) — **on-by-construction**
- `ff.learning_telemetry_full` (V10-LRN-012)
- `ff.learning_drift_detection` (V10-LRN-016) — **on-by-construction**
- `ff.learning_audit_export` (V10-LRN-017)
- `ff.learning_kill_switch` (V10-LRN-018) — **on-by-construction**

Wave B: `ff.learning_adaptive_coverage`, `ff.learning_prompt_snippets`, `ff.learning_connector_ranking`.

Safety flags on-by-construction: consent + signal schema, TTL/forgetting, revocation, PII redaction, never-override invariants, drift detection, kill switch.
