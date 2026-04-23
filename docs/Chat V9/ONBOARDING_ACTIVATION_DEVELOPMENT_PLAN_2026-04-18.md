# Chat V10 / ONBOARDING — development plan (2026-04-18)

> **Scope note:** this plan is **design-phase** only. It documents the 25
> tickets `V10-ONB-001..025` that implement the Onboarding + First-5-Minutes
> Activation block of Chat V10. **No ticket here is shipped yet.** No flag in
> this plan is registered in `CHAT_V9_FLAGS` until the corresponding PR
> implements and tests the resolver. The plan is the contract for the next
> implementation wave, not a status report.
>
> Authoritative input: [`DEEP_RESEARCH_ONBOARDING_ACTIVATION_DETAILED_2026-04-18.md`](./DEEP_RESEARCH_ONBOARDING_ACTIVATION_DETAILED_2026-04-18.md)
> (R-ONBOARD-1..25). Master plan: [`CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md`](./CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md).

> **Cross-refs**
> - Kill-switches & incident response → [`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)
> - Adding a new onboarding feature → [`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)
> - Telemetry payloads → [`CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md`](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md)

## Block summary

Onboarding is the **binding layer** of Chat V10. It is the only block that
touches every other block in the first five minutes of real-user contact.
A well-executed onboarding flow produces a real artifact from real buyer
data, crosses an approval gate, and saves the result to a reusable library
— all before 05:00. Anything less is **not activation**, only onboarding
progress.

**Design inputs:**
- 6 persona paths (Partner, CFO, CEO, COO, CISO, Transformation Officer)
- 5-minute activation SLA (median ≤240s, P90 ≤300s)
- Trust-first disclosure before any prompt box or connector CTA
- Workspace bootstrap protocol (10 objects, conservative defaults)
- Honest fallbacks for OAuth failure, citation-validation failure, abandonment
- 22 telemetry events with 11 required properties each
- Numeric KPI target overall and per persona

**MVP focus:** CFO path end-to-end, because it yields the clearest, fastest,
highest-signal activation loop (a real file, a real analysis, a real
approval, a real export with SHA-256). Partner and CISO paths follow once
CFO has crossed the full trust-and-deliverable boundary.

## Backlog

| ID | Requirement | Priority | Effort | Risk | Persona focus | Wave | Status |
|---|---|---|---|---|---|---|---|
| [V10-ONB-001](#v10-onb-001) | R-ONBOARD-1: persona capture on every first-run session | P0 | 0.5 d | low | all | A | 📐 design |
| [V10-ONB-002](#v10-onb-002) | R-ONBOARD-2: persona inference confidence + one-click override | P0 | 0.75 d | low | all | A | 📐 design |
| [V10-ONB-003](#v10-onb-003) | R-ONBOARD-3: admin-first vs user-first route split | P0 | 1 d | medium | CISO vs rest | A | 📐 design |
| [V10-ONB-004](#v10-onb-004) | R-ONBOARD-4: per-persona first-run journey with distinct artifact + connector order | P0 | 2 d | medium | all | A + B | 📐 design |
| [V10-ONB-005](#v10-onb-005) | R-ONBOARD-5: trust-first disclosure before any prompt or connector CTA | P0 | 1 d | low | all | A | 📐 design |
| [V10-ONB-006](#v10-onb-006) | R-ONBOARD-6: 5-minute activation SLA enforcement and measurement | P0 | 1 d | medium | all | A | 📐 design |
| [V10-ONB-007](#v10-onb-007) | R-ONBOARD-7: first artifact must use buyer data, not demo data | P0 | 0.5 d | high | all | A | 📐 design |
| [V10-ONB-008](#v10-onb-008) | R-ONBOARD-8: connector ranking persona-aware + tenant-aware | P0 | 1 d | medium | all | A | 📐 design |
| [V10-ONB-009](#v10-onb-009) | R-ONBOARD-9: connector success gated on scope + ACL + content validation | P0 | 1 d | medium | all | A | 📐 design |
| [V10-ONB-010](#v10-onb-010) | R-ONBOARD-10: no-ghost-capabilities rule in every persona path | P0 | 0.5 d | medium | all | A | 📐 design |
| [V10-ONB-011](#v10-onb-011) | R-ONBOARD-11: first AI mutation wrapped in proposal envelope with preview/diff | P0 | 1 d | medium | all | A | 📐 design |
| [V10-ONB-012](#v10-onb-012) | R-ONBOARD-12: provenance panel accessible before first approval | P0 | 1 d | low | all | A | 📐 design |
| [V10-ONB-013](#v10-onb-013) | R-ONBOARD-13: first artifact crosses human approval gate with audit event | P0 | 1 d | medium | all | A | 📐 design |
| [V10-ONB-014](#v10-onb-014) | R-ONBOARD-14: first artifact saved to reusable library before 05:00 | P0 | 0.75 d | low | all | A | 📐 design |
| [V10-ONB-015](#v10-onb-015) | R-ONBOARD-15: first export requires manifest + version lineage + SHA-256 | P0 | 1 d | medium | CFO-first | A | 📐 design |
| [V10-ONB-016](#v10-onb-016) | R-ONBOARD-16: first research run exposes cost cap + source policy | P0 | 0.75 d | low | all | B | 📐 design |
| [V10-ONB-017](#v10-onb-017) | R-ONBOARD-17: first persistent learning signal opt-in per memory layer | P0 | 1 d | high | all | A | 📐 design |
| [V10-ONB-018](#v10-onb-018) | R-ONBOARD-18: tenant bootstrap creates shell + manifest + route + library + templates | P0 | 1.5 d | medium | all | A | 📐 design |
| [V10-ONB-019](#v10-onb-019) | R-ONBOARD-19: conservative defaults (Internal / 30d draft / memory off / approval on export) | P0 | 0.5 d | low | all | A | 📐 design |
| [V10-ONB-020](#v10-onb-020) | R-ONBOARD-20: honest OAuth fallback at 20s timeout | P0 | 1 d | medium | all | A | 📐 design |
| [V10-ONB-021](#v10-onb-021) | R-ONBOARD-21: honest citation-validation fallback (scaffold, not fabrication) | P0 | 1.5 d | high | all | A | 📐 design |
| [V10-ONB-022](#v10-onb-022) | R-ONBOARD-22: resume-on-abandonment preserves partial progress | P0 | 1 d | medium | all | A | 📐 design |
| [V10-ONB-023](#v10-onb-023) | R-ONBOARD-23: onboarding-specific telemetry (22 events × 11 properties) | P0 | 1.5 d | low | all | A | 📐 design |
| [V10-ONB-024](#v10-onb-024) | R-ONBOARD-24: numeric activation KPI dashboard overall + per persona | P0 | 2 d | medium | all | B | 📐 design |
| [V10-ONB-025](#v10-onb-025) | R-ONBOARD-25: team-invite CTA only after personal aha | P1 | 0.25 d | low | all | B | 📐 design |

**Totals:** 25 tickets (24 × P0, 1 × P1). Estimated effort ≈23.5 engineer-days (1 engineer × ≈5 weeks, or 2 engineers × ≈2.5 weeks).

**Proposed flag namespace:** `ff.onboard_*` (see master plan §4).

---

<a id="v10-onb-001"></a>

## V10-ONB-001 — persona capture

**Requirement:** R-ONBOARD-1 (P0) — persona must be captured explicitly or inferred for every first-run session.

**Design.** On first authenticated session (no existing `persona` record for the user), the server materialises a persona record within 45 s of session start. Persona can be set in three ways, in order of confidence:

1. **Explicit confirm** — user selects one of six persona chips (Partner, CFO, CEO, COO, CISO, Transformation Officer) in the persona picker UI (`src/components/onboarding/PersonaPicker.tsx` — new).
2. **Invite metadata** — if the user was invited by an admin with a `persona_hint`, that value is pre-selected. Confirmation is still required; the user can override.
3. **Title / group inference** — if neither of the above, the backend applies a deterministic mapping (`resolvePersonaFromProfile` — new, in `src/services/onboarding/personaInference.ts`) from job title + AD / Google Workspace group. Confidence is exposed as `persona_confidence: "low" | "medium" | "high"`.

**Acceptance criteria.**
- In ≥95% of first sessions, a `persona` field is present on the user record within 45 s of session start.
- Persona picker renders the 6 chips in a deterministic order (Partner → CFO → CEO → COO → CISO → Transformation Officer).
- Inferred confidence never exceeds `"medium"` without explicit user confirmation.
- Telemetry `onboard.persona_inferred` fires exactly once per session at inference time; `onboard.persona_confirmed` fires exactly once per session at confirm time.
- Feature flag `ff.onboard_persona_capture` defaults off in prod for tenants not enrolled in V10; when off, fall back to V9 generic onboarding.

**Test strategy.**
- Unit: `resolvePersonaFromProfile` table-driven test with 24 title / group combinations covering all 6 personas + "unknown" fallback.
- Integration: Playwright `onboarding.spec.ts` case "new user sees persona picker within 45s".
- Contract: telemetry event count exactly 1 of each type per session.
- Chaos: SSO returns without title / group — system still materialises persona record but with `persona_confidence: "low"` and forces explicit confirm.

**Failure modes.**
- Server clock skew inflating "seconds_since_start". Mitigation: `seconds_since_start` is computed server-side at event emission time, never client-side.
- Dead-end when user closes picker without selecting. Mitigation: picker is non-dismissible until a persona is chosen; Escape triggers `onboard.abandoned` with reason `persona_skipped`.

**Cross-refs.** V10-ONB-002 (override), V10-ONB-003 (admin-first split), V10-ONB-004 (per-persona journey).

---

<a id="v10-onb-002"></a>

## V10-ONB-002 — persona override

**Requirement:** R-ONBOARD-2 (P0) — persona inference must expose confidence and allow one-click override.

**Design.** The persona picker UI always shows the currently inferred / chosen persona with an inline "Not me — switch" link. Clicking it reopens the picker without destroying progress (source attachment, evidence cache, current draft are preserved; artifact objective and review language are re-skinned). The "switch" control remains visible through the first five minutes (until `session.activation_reached === true` or `session.seconds_since_start > 300`).

**Acceptance criteria.**
- Override link visible in ≥95% of onboarding viewports (header row, persona chip).
- Override preserves source attachment and draft content in 100% of tested flows.
- Switching persona re-renders artifact objective text and review gate language without reloading the page.
- Telemetry: `onboard.persona_confirmed` re-fires on override with `previous_persona` and `override_reason` properties.
- Feature flag `ff.onboard_persona_inference_override` defaults off until QA passes.

**Test strategy.**
- Playwright: switch from CFO → Partner mid-flow, assert source files still attached and draft text still present.
- Unit: artifact-objective string mapper per (persona × source type) pair.

**Failure modes.**
- Source incompatible with new persona (e.g. CFO's finance XLSX selected, user switches to CEO). Mitigation: sources stay attached; artifact objective is re-seeded for the new persona; user can drop the source manually.

**Cross-refs.** V10-ONB-001, V10-ONB-004.

---

<a id="v10-onb-003"></a>

## V10-ONB-003 — admin-first vs user-first split

**Requirement:** R-ONBOARD-3 (P0) — admin-first vs user-first split must be enforced.

**Design.** The route chosen by persona determines the **first interactive surface**:

- **CISO** → admin-first. First screen is the admin / policy console (`/onboarding/admin`) showing region of processing, retention policy, ACL inheritance defaults, and the restricted-workspace badge. No generation surface is rendered until admin flags ≥1 acknowledgement.
- **Partner, CFO, CEO, COO, Transformation Officer** → user-first. First screen is the persona-specific artifact seed (`/onboarding/seed/:persona`). Admin screens are deferred. Partner specifically reaches artifact seed without admin setup in ≤60 s.

The split is deterministic at route resolution time; no runtime branching.

**Acceptance criteria.**
- CISO sees admin / policy console before first generation in **100%** of CISO paths.
- Partner reaches artifact seed (non-admin surface) in ≤60 s from session start in ≥95% of Partner paths.
- Telemetry: `onboard.admin_console_seen` fires for CISO paths; absent for non-admin paths.
- No persona can reach `/onboarding/admin` without explicit navigation (not through the default route).

**Test strategy.**
- Playwright: route test per persona — CISO lands on admin console; other 5 land on artifact seed.
- Unit: route resolver `resolveFirstRoute(persona)` with 6 cases.

**Failure modes.**
- Tenant admin has already configured policy, CISO doesn't need to re-acknowledge. Mitigation: if `tenant.policy_acknowledged_by_admin === true`, CISO console shows read-only summary and progresses automatically.

**Cross-refs.** V10-ONB-004, V10-ONB-005 (trust banner comes before both surfaces).

---

<a id="v10-onb-004"></a>

## V10-ONB-004 — per-persona first-run journey

**Requirement:** R-ONBOARD-4 (P0) — each persona must receive a first-run journey with a distinct primary artifact and connector order.

**Design.** Six distinct journey specs codified in `src/services/onboarding/personaJourneys.ts` (new). Each journey is a typed object:

```ts
type PersonaJourney = {
  persona: Persona;
  primaryArtifactType: ArtifactType;      // e.g. "slide_deck" for Partner
  primaryConnector: ConnectorId | "upload";
  secondaryConnector: ConnectorId | null;
  suppressedConnectors: ConnectorId[];
  ahaTargetSeconds: number;                // from R-ONBOARD-24 KPI table
  reviewGateLanguage: LocalizedString;     // "client-share safe?" for Partner, "audit-ready?" for CFO, etc.
  libraryDestination: LibraryId;
};
```

Journey is selected at session start from `personaJourneys[persona]`; every downstream component reads from this object instead of branching on persona directly.

**Acceptance criteria.**
- In route tests, **all 6 personas surface different primary CTA combinations** (different artifact type, different primary connector, different library destination).
- CFO journey produces a `memo + spreadsheet` pair; Partner produces `slide_deck`; CEO produces `decision_doc`; COO produces `raci + memo`; CISO produces `research_report + evidence_register`; Transformation Officer produces `research_report` or `decision_doc`.
- Journey object is the single source of truth — no `if (persona === "CFO")` branches in component code.

**Test strategy.**
- Unit: golden-file test of `personaJourneys` — 6 entries, each with the canonical combination from the research doc KPI matrix.
- Integration: run each journey end-to-end through the onboarding harness, assert artifact type and library destination match the journey spec.

**Failure modes.**
- Persona added in the future without a journey spec. Mitigation: CI invariant 39 (see master plan §6) — every persona must have a journey entry.

**Cross-refs.** V10-ONB-006, V10-ONB-008, V10-ONB-024.

---

<a id="v10-onb-005"></a>

## V10-ONB-005 — trust-first disclosure banner

**Requirement:** R-ONBOARD-5 (P0) — trust-first disclosure must render before any prompt input or connector CTA.

**Design.** A non-skippable, session-scoped banner (`src/components/onboarding/TrustBanner.tsx` — new) renders at the top of the onboarding viewport for the first 5 minutes. It shows:

- Residency region (e.g. "EU — Frankfurt").
- Retention default (e.g. "Drafts 30d, approved artifacts 365d").
- No-demo-data guarantee ("Your onboarding uses real data you supply — we never substitute demo data.").
- Learning default ("Persistent learning is **off** — opt in anytime per memory layer.").
- Cost-cap status ("Research runs require an explicit cost cap.").
- Export-integrity policy ("Exports carry a SHA-256 hash and version lineage.").

The banner is **rendered before** the prompt box and connector CTA are mounted (not after, not concurrently). The acknowledgement timestamp is persisted to `session.trust_banner_viewed_at` and survives resume.

**Acceptance criteria.**
- Trust banner appears before first interactive generation surface in **100%** of first sessions.
- Banner cannot be dismissed with Escape or click-outside before reading time (~3 s minimum render).
- `onboard.trust_banner_viewed` telemetry fires exactly once per session.
- Acknowledgement is persisted; resume does not re-show banner to the same user within 7 days.

**Test strategy.**
- Playwright: first render test — no prompt box visible in DOM until banner is in DOM.
- Unit: banner content mapper per residency region (EU / US / UK / CA).

**Failure modes.**
- Residency region misconfigured. Mitigation: banner text falls back to "contact your admin" and blocks onboarding until resolved.
- Tenant policy changes mid-session (new residency). Mitigation: re-acknowledgement required on next session start.

**Cross-refs.** V10-ONB-017 (learning default), V10-ONB-019 (conservative defaults), V10-ONB-023 (telemetry).

---

<a id="v10-onb-006"></a>

## V10-ONB-006 — 5-minute activation SLA

**Requirement:** R-ONBOARD-6 (P0) — Consultify must meet a five-minute activation SLA.

**Design.** The onboarding session emits a single `onboard.activation_reached` event when all four gates have passed:

1. Real-data artifact generated (`onboard.artifact_first_draft_rendered` has fired with `validation_status: "passed"`).
2. Provenance visible (`onboard.provenance_panel_opened` has fired).
3. Approval gate crossed (`onboard.artifact_approved` has fired).
4. Artifact saved to library (`onboard.artifact_saved` has fired).

`seconds_since_start` is computed server-side as `now - session.started_at`. SLA dashboard reports median, P90, and per-persona breakouts daily.

**Acceptance criteria.**
- Median time to activation ≤ **240 s** overall; P90 ≤ **300 s**.
- Per-persona medians match the R-ONBOARD-24 KPI table within ±10%.
- Sessions that don't activate within 600 s are marked `onboard.abandoned` with reason `sla_exceeded`.

**Test strategy.**
- Integration dogfood: CFO path timed across ≥20 internal sessions before MVP exit.
- Chaos: force a slow connector response; assert SLA dashboard detects the regression within 1 hour.

**Failure modes.**
- Clock drift between client and server. Mitigation: server-side timestamps only; client timestamps recorded as diagnostic properties but never used for SLA calculation.

**Cross-refs.** V10-ONB-011 through V10-ONB-014 (the four gates), V10-ONB-023 (telemetry), V10-ONB-024 (KPI dashboard).

---

<a id="v10-onb-007"></a>

## V10-ONB-007 — no demo data substitution

**Requirement:** R-ONBOARD-7 (P0) — the first artifact must use buyer data, not demo data.

**Design.** A linter rule (`eslint-plugin-consultify-onboarding/no-demo-data`) forbids imports of any module whose path contains `demo` or `sample` from files under `src/onboarding/`. At runtime, the artifact generator asserts that the source set is non-empty and contains at least one tenant-owned source; if the assertion fails, the user is shown the honest "no sources yet" empty state with a CTA to upload / connect.

**Acceptance criteria.**
- **Zero** onboarding sessions may substitute demo data silently when buyer data is absent.
- Lint rule is CI-enforced.
- Empty state explicitly names the lack of sources rather than showing a demo artifact.

**Test strategy.**
- CI lint: runs on every PR.
- Unit: artifact generator `generateFirstDraft({ sources: [] })` throws `NoSourcesError`.
- Playwright: fresh tenant without any source shows empty state, not demo memo.

**Failure modes.**
- Engineer adds a "demo mode" flag later. Mitigation: lint rule is path-based, not config-based; a demo mode cannot be enabled from the onboarding path.

**Cross-refs.** V10-ONB-021 (honest citation-validation fallback — scaffold, not fabrication, in the same spirit).

---

<a id="v10-onb-008"></a>

## V10-ONB-008 — connector ranking

**Requirement:** R-ONBOARD-8 (P0) — connector ranking must be persona-aware and tenant-aware.

**Design.** The first-connector nudge is computed as `rankConnectors(persona, tenant)` from `src/services/onboarding/connectorRanking.ts` (new). Input: persona (from V10-ONB-001), tenant-authorised connectors (from connector registry), tenant role of user. Output: `{ primary, secondary, suppressed[] }`.

The ranking mirrors the Onboarding research doc §First-connector nudge sequence table verbatim, with tenant overlay: if a persona's primary is not tenant-authorised, fall back to secondary; if neither is, offer secure upload. CISO persona never shows primary CTA until admin has reviewed.

**Acceptance criteria.**
- Primary connector CTA **differs by persona** and respects tenant-authorised systems in 100% of route tests.
- Suppressed connectors (e.g. broad SharePoint crawl for Partner) are not visible in first-run UI.
- Connector ranking is pure — same input produces same output across reloads.

**Test strategy.**
- Golden-file test: 6 personas × 4 tenant configurations = 24 expected rankings.
- Playwright: Partner sees Salesforce-first if tenant-authorised; Gmail-first otherwise; upload last.

**Failure modes.**
- Tenant authorises a connector mid-session. Mitigation: ranking is recomputed at every connector-offer render, not cached at session start.

**Cross-refs.** V10-ONB-004, V10-ONB-009 (validation).

---

<a id="v10-onb-009"></a>

## V10-ONB-009 — connector validation handshake

**Requirement:** R-ONBOARD-9 (P0) — connector success must require validation of scopes, permissions, and visible content.

**Design.** After OAuth callback returns a valid token, the onboarding harness performs a three-step validation:

1. **Scope check** — compares granted scopes against the declared minimum; if any missing, shows the "insufficient scopes" screen with the specific missing scopes.
2. **ACL probe** — performs one read against a safe sentinel resource (e.g. user's own drafts folder) to confirm the permission grant is effective.
3. **Content preview** — shows the user the first 3–5 source items that will be ingested ("you connected SharePoint /Finance; here are the 3 most recent files we will use") with a confirm button.

Only after all three pass does the UI flip to `Connected` state and `onboard.connector_oauth_succeeded` fires. A bare OAuth token success is NOT sufficient.

**Acceptance criteria.**
- "Connected" state is shown only after at least one validated-source preview is rendered.
- Bare OAuth success toast (no content preview) is impossible to reach from any code path.
- Missing-scope screen names the exact scope(s) missing.

**Test strategy.**
- Playwright: OAuth → scope missing → missing-scope screen visible.
- Chaos: revoke ACL between OAuth and probe — UI shows "permission revoked" state, not success.

**Failure modes.**
- Sentinel resource doesn't exist. Mitigation: fallback sentinel is tenant-level metadata read; if that also fails, treat as validation failure.

**Cross-refs.** V10-ONB-020 (OAuth fallback), `R-CONNECT-14` (Connectors block — full ACL handshake).

---

<a id="v10-onb-010"></a>

## V10-ONB-010 — no ghost capabilities

**Requirement:** R-ONBOARD-10 (P0) — no-ghost-capabilities rule.

**Design.** The onboarding UI renders a capability only if it's actually available for the current tenant. A feature flag `ff.onboard_no_ghost_caps` (defaults on) wraps every CTA render; the check is `capabilityRegistry.isAvailable(capability, tenant)`. If unavailable, the CTA is hidden (not greyed out, not disabled). Pre-release test suite enumerates every capability across all persona paths and asserts none is rendered without availability.

**Acceptance criteria.**
- In pre-release test suite, **0** unavailable capabilities are rendered as available across all persona paths.
- Hidden capabilities do not appear in DOM at all (not `display: none`).
- A capability that becomes available mid-session is revealed on next render.

**Test strategy.**
- Pre-release: full enumeration test across 6 personas × N capabilities.
- Unit: `capabilityRegistry.isAvailable` returns false for disabled connectors, deep research cost cap not configured, etc.

**Cross-refs.** V10-ONB-004, V10-ONB-008.

---

<a id="v10-onb-011"></a>

## V10-ONB-011 — first mutation proposal envelope

**Requirement:** R-ONBOARD-11 (P0) — first AI-originated mutation must be wrapped in a proposal envelope with preview or diff.

**Design.** The first AI-generated artifact is **not** rendered as-is; it is wrapped in a `MutationProposal` (see `ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` V10-ART-xxx) with:

- Intent: `create_artifact`.
- Source set: full list of source IDs and their hashes.
- Mutation type: `initial_draft`.
- Preview diff: the actual artifact content, rendered in preview mode.
- Approval requirement: explicit.

User MUST choose **approve**, **edit**, or **reject** before the artifact is written to the library. No silent acceptance path.

**Acceptance criteria.**
- **100%** of first mutations show intent, source set, and preview before user approval.
- Approve / edit / reject are the only three user actions; no "skip review" option exists.
- Telemetry `onboard.approval_gate_opened` fires before the user's first decision.

**Test strategy.**
- Playwright: first artifact render — no library write until approve is clicked.
- Unit: MutationProposal schema enforces `approval_required: true` for `mutation_type: initial_draft`.

**Cross-refs.** V10-ART-* (Artifact Runtime block's MutationProposal contract), V10-AGT-* (Agent Runtime's ExecutionProposalV1).

---

<a id="v10-onb-012"></a>

## V10-ONB-012 — provenance panel

**Requirement:** R-ONBOARD-12 (P0) — provenance panel must be accessible before approval of the first artifact.

**Design.** The proposal envelope from V10-ONB-011 includes a "Show provenance" affordance that expands a panel listing every supporting source (title, system, last-modified, snippet, freshness badge). The panel can be opened and closed freely; opening emits `onboard.provenance_panel_opened`. Approval is possible without opening the panel (we don't force reading), but the panel is visible and one click away.

**Acceptance criteria.**
- In **100%** of first artifact flows, the provenance control is in DOM before the approval button becomes active.
- Panel lists every source actually used by the generator (not a superset, not a subset).
- Freshness badge accurately reflects source last-modified time.

**Test strategy.**
- Playwright: click provenance → panel lists 3 expected sources for CFO test scenario.
- Unit: `collectProvenance(draftId)` returns exact source set that was ingested.

**Cross-refs.** V10-ART-* (provenance as first-class artifact metadata), V10-ONB-013 (approval gate consumes provenance).

---

<a id="v10-onb-013"></a>

## V10-ONB-013 — approval gate + audit event

**Requirement:** R-ONBOARD-13 (P0) — first artifact must cross a human approval gate with an audit event in-session.

**Design.** The approval gate renders three buttons: **Approve**, **Edit**, **Reject**. Each writes an immutable audit event `onboard.artifact_approved` (or `_edited` / `_rejected`) to the audit log with:

- `artifact_id`, `artifact_version`, `mutation_proposal_id`
- `reviewer_id`, `reviewer_role` (from persona)
- `approved_at` (server time)
- `trust_bundle_hash` (for tamper detection)
- `action` (`approve` | `edit` | `reject`)

Activation (V10-ONB-006) is counted only when `action === "approve"` and the artifact is subsequently saved.

**Acceptance criteria.**
- Activation is counted only when approval event is logged **and** artifact is saved.
- Audit log entry is immutable (append-only storage).
- `trust_bundle_hash` matches the hash emitted by the reasoning layer at generation time.

**Test strategy.**
- Integration: approve → activation counter increments by 1; reject → counter unchanged.
- Unit: audit log rejects update / delete operations.

**Cross-refs.** V10-ONB-006 (SLA gates), V10-AGT-* (Agent Runtime audit retention), V10-ART-* (artifact ReviewState transitions).

---

<a id="v10-onb-014"></a>

## V10-ONB-014 — save to library before 05:00

**Requirement:** R-ONBOARD-14 (P0) — first artifact must be saved to a reusable library location before 05:00.

**Design.** On approval, the artifact is written to the persona's default library (`PersonaJourney.libraryDestination` from V10-ONB-004). The save is idempotent — re-running the approval does not duplicate. Template fingerprint is computed (`computeTemplateFingerprint(artifact)`) and stored so a future session can suggest "reuse this template".

**Acceptance criteria.**
- ≥90% of successful internal sessions save first artifact to `Drafts`, `Approved`, or `Templates` before session end.
- Save operation completes in ≤2 s P90.
- Template fingerprint is deterministic (same content → same fingerprint).

**Test strategy.**
- Playwright: approve CFO variance memo → memo visible in Finance Library within 2 s.
- Unit: `computeTemplateFingerprint` returns identical hash for identical artifacts.

**Cross-refs.** V10-ART-* (ArtifactStore), V10-ONB-004.

---

<a id="v10-onb-015"></a>

## V10-ONB-015 — export manifest + lineage + SHA-256

**Requirement:** R-ONBOARD-15 (P0) — first export must require export manifest, version lineage, and SHA-256 surfacing.

**Design.** The export flow is gated behind a manifest preview. The preview shows:

- Artifact ID + version
- Source lineage (every source that contributed, with hash)
- Reviewer + approval timestamp
- SHA-256 of the exported payload (computed after serialisation, before download)
- Watermark / signature status
- Destination (email, shared link, local file)
- Confidentiality tags (from DataClassification)

Download button is disabled until the manifest preview is opened once. The SHA-256 is embedded in the exported PDF as a footer + in a sidecar `.manifest.json` file.

**Acceptance criteria.**
- **100%** of first exports require manifest preview.
- SHA-256 hash is stored server-side and matches the hash embedded in the exported file.
- Manifest preview renders in ≤1 s P90.

**Test strategy.**
- Playwright: first export → manifest opens → download button enables → downloaded PDF SHA-256 matches server.
- Unit: `computeExportManifest(artifact, version)` is deterministic.

**Cross-refs.** V10-ART-* (ArtifactStore export manifest contract, `R-ARTIFACT-24`), V10-ONB-014.

---

<a id="v10-onb-016"></a>

## V10-ONB-016 — research cost cap + source policy

**Requirement:** R-ONBOARD-16 (P0) — first research run must expose cost cap and source policy before execution.

**Design.** If the persona journey triggers a research run (CISO, Transformation Officer primarily), a confirmation gate is shown **before** execution:

- Cost cap slider (with tenant default)
- Source policy selector (private only / private + curated web / private + open web)
- Web / private split estimate
- Citation requirement toggle
- Estimated runtime band
- Confirmation checkbox

Only after explicit confirmation does the research run start. Telemetry `onboard.research_confirmed` fires at confirm time.

**Acceptance criteria.**
- **100%** of first research runs require explicit cap + source-policy confirmation.
- No research run starts without a cost cap.

**Test strategy.**
- Playwright: research CTA → confirmation gate → start button disabled until checkbox + cap set.

**Cross-refs.** V10-RSR-* (Deep Research block's confirmation gate, `R-RESEARCH-3`, `R-RESEARCH-14`).

---

<a id="v10-onb-017"></a>

## V10-ONB-017 — learning opt-in per memory layer

**Requirement:** R-ONBOARD-17 (P0) — first persistent learning signal must be opt-in by memory layer.

**Design.** Persistent memory is **off by default** for every new tenant. The learning opt-in UI is surfaced after first successful activation (not before — we earn the right first). It shows three distinct memory layers:

- **Conversation** — ephemeral, session-scoped. Always on (nothing persistent).
- **User** — persistent for this user across sessions. **Off** by default.
- **Organisation** — persistent across users in the tenant. **Off** by default.
- **Learned** — platform-wide learning contributions. **Off** by default; requires admin-level opt-in.

Each toggle shows what is stored, where, retention period, and a "revoke and purge" link.

**Acceptance criteria.**
- Default persistent memory state is **off** for 100% of new tenants.
- Opt-in requires explicit user action per layer.
- `feedback.consent_granted` event fires before any memory write; CI invariant 45 (master plan §6) enforces this.

**Test strategy.**
- Integration: new tenant → query memory → empty for User, Organisation, Learned layers.
- Unit: memory write function refuses write without valid consent event in same session.

**Cross-refs.** V10-LRN-* (Feedback + Learning block, `R-LEARN-4`, `R-LEARN-5`), V10-ONB-019.

---

<a id="v10-onb-018"></a>

## V10-ONB-018 — tenant bootstrap

**Requirement:** R-ONBOARD-18 (P0) — first-run tenant init must bootstrap workspace shell, policy manifest, approval route, library, and template pack.

**Design.** On first authenticated user of a new tenant, a server-side bootstrap job runs synchronously with the session init. It creates:

1. Persona workspace shell (one per user + persona tag).
2. Versioned policy manifest (residency, retention, classification, approval policy, learning default).
3. Artifact library folders: `Drafts`, `Approved`, `Exported`, `Templates`.
4. Approval route with at least one reviewer slot (initially the user themselves; admin can reassign).
5. Trust banner acknowledgement record (initially empty, populated on banner view).
6. Research policy default (private sources preferred; web off).
7. Connector shortlist ranked by persona + tenant.
8. Org memory seed (org name, primary domain, approved region, approved source policy — no behavioural memory).
9. Template pack (6 persona templates exist; 1 primary surfaced).
10. Telemetry session record (UUID + persona + trust mode + source type).

Bootstrap runs in ≤10 s P99.

**Acceptance criteria.**
- Bootstrap objects exist and are queryable within 10 s of session start in ≥99% of successful sessions.
- Bootstrap is idempotent — re-running produces no duplicates.
- Tenant can delete all bootstrap objects to re-onboard (GDPR).

**Test strategy.**
- Integration: new tenant → wait 10 s → query all 10 object types → all present.
- Chaos: interrupt bootstrap mid-way → next session retries and completes.

**Cross-refs.** V10-ONB-005, V10-ONB-019.

---

<a id="v10-onb-019"></a>

## V10-ONB-019 — conservative defaults

**Requirement:** R-ONBOARD-19 (P0) — workspace defaults must inherit conservative classification, retention, and approval rules until tenant overrides are known.

**Design.** New tenant defaults, applied during bootstrap (V10-ONB-018):

| Dimension | Default |
|---|---|
| DataClassification | `Internal` (elevate to `Confidential` / `Restricted` on detection of finance, security, legal, or customer-identifiable data) |
| Draft retention | 30 days |
| Approved artifact retention | 365 days unless tenant policy overrides |
| Source disconnect purge | follows source-specific contract from Connectors block |
| Approval policy | Mandatory human approval for first external share, first export, first write-back, any artifact classified Confidential or Restricted |
| Learning (User / Org / Learned) | **off** |
| Research source policy | private preferred; web off |

These defaults are enforced at the policy manifest level; UI reads from manifest, not from hardcoded constants.

**Acceptance criteria.**
- New tenants default to Internal / 30d draft / approval-on-export / memory off.
- `ff.onboard_conservative_defaults` is on-by-construction (CI invariant 40, master plan §6).
- Tenant admin can override per-dimension; override emits `tenant.policy_overridden` event.

**Test strategy.**
- Integration: new tenant → policy manifest matches canonical defaults.
- Unit: classification escalation on detection of SSN / credit card / PII patterns.

**Cross-refs.** V10-ONB-005, V10-ONB-017.

---

<a id="v10-onb-020"></a>

## V10-ONB-020 — OAuth fallback at 20s

**Requirement:** R-ONBOARD-20 (P0) — honest OAuth fallback must exist for first connector failure.

**Design.** The OAuth callback waiter starts a 20 s timer at OAuth initiation. If success doesn't arrive within 20 s, the UI transitions to the fallback screen:

- Secure file upload (drop zone + picker)
- Forward-email ingestion (tenant-specific inbox address)
- "Continue with existing approved document" (library search)

Intended connector + scopes are preserved in session state for later retry ("Try Salesforce again" button remains in the header). UI states clearly that live sync is not yet active. No demo data is inserted as substitute.

**Acceptance criteria.**
- If OAuth exceeds 20 s or fails, fallback path is shown automatically in **100%** of tests.
- Intended connector context is preserved (visible as "Retry Salesforce later" chip).
- Fallback screen explicitly names that live sync is not active.

**Test strategy.**
- Chaos: stub OAuth to never return → fallback renders at 20s ± 1s.
- Playwright: upload via fallback → artifact generation uses uploaded file, not demo.

**Cross-refs.** V10-ONB-009, V10-CON-* (Connectors block trust-mode contracts).

---

<a id="v10-onb-021"></a>

## V10-ONB-021 — citation-validation fallback

**Requirement:** R-ONBOARD-21 (P0) — honest citation-validation fallback must exist for first artifact failure.

**Design.** If the first draft cannot meet evidence policy (<80% source coverage, or a required source type is missing), the generator returns a **blocked** state. The UI shows:

- Missing evidence categories (explicit list)
- Source coverage percentage (e.g. "62% coverage — below 80% threshold")
- Exact cells / clauses / paragraphs that failed validation (highlighted)
- Four one-click options:
  1. Narrow scope (regenerate with reduced ambition)
  2. Add source (reopen connector or upload)
  3. Continue with scaffold only (placeholders, no fabricated conclusions)
  4. Hand off to review (invite human reviewer)

**The safe fallback is a scaffolded artifact with evidence placeholders, NEVER a fabricated conclusion.**

**Acceptance criteria.**
- If evidence coverage <80% or required source type missing, system **blocks finalisation** and shows scaffold fallback.
- Scaffold fallback contains zero generated conclusions; only structure + placeholders + source citations.
- Telemetry fires `onboard.artifact_blocked` with reason code.

**Test strategy.**
- Unit: generator with 40% source coverage → returns `BlockedDraft` envelope.
- Playwright: low-coverage scenario → blocked screen visible with 4 options.

**Cross-refs.** V10-ONB-007, V10-RSN-* (Reasoning block's evidence coverage, `R-REASON-10`/`R-REASON-16`).

---

<a id="v10-onb-022"></a>

## V10-ONB-022 — resume on abandonment

**Requirement:** R-ONBOARD-22 (P0) — resume on abandonment must preserve partial progress.

**Design.** Every state transition and every 15 s during long waits, the onboarding harness persists `session.snapshot` to durable storage. Snapshot includes:

- Persona + confidence + override history
- Connector target + scopes
- Uploaded files (references + hashes, content already stored server-side)
- Current draft (full content)
- Approval history
- Trust banner acknowledgement state
- Unresolved validation blockers

On return, the resume handler:

1. Verifies snapshot age ≤ `resume_token.expires_at` (default 7 d).
2. Loads snapshot into a fresh session.
3. Lands the user on the **exact interrupted step**.
4. Shows a short delta banner: "You stopped after connector validation; ready to generate draft."
5. If sources changed since snapshot, shows delta before regeneration.

**Acceptance criteria.**
- Returning user resumes the exact prior step with preserved files, acknowledgements, and draft within **2 clicks** in ≥95% of resume tests.
- Expired resume tokens clear snapshot and start fresh.
- Source-delta detection is correct (hash-based).

**Test strategy.**
- Chaos: abandon at 5 different steps → resume and verify each step restored.
- Unit: snapshot serde round-trip preserves all 7 fields.

**Cross-refs.** V10-AGT-* (Agent Runtime's CheckpointStore has similar semantics, `R-AGENT-11`/`R-AGENT-13`).

---

<a id="v10-onb-023"></a>

## V10-ONB-023 — onboarding telemetry

**Requirement:** R-ONBOARD-23 (P0) — onboarding-specific telemetry must support persona, minute, connector, and artifact funnel analysis.

**Design.** 22 events in the `onboard.*` family, each carrying 11 required properties. Events and properties are defined in `src/services/onboarding/telemetry.ts` (new) and contributed to `CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md` via this ticket's PR.

**Events:**
`onboard.started`, `onboard.persona_inferred`, `onboard.persona_confirmed`, `onboard.admin_console_seen`, `onboard.trust_banner_viewed`, `onboard.connector_offer_rendered`, `onboard.connector_oauth_started`, `onboard.connector_oauth_succeeded`, `onboard.connector_oauth_failed`, `onboard.fallback_upload_used`, `onboard.artifact_seeded`, `onboard.artifact_first_draft_rendered`, `onboard.provenance_panel_opened`, `onboard.approval_gate_opened`, `onboard.artifact_approved`, `onboard.artifact_saved`, `onboard.export_manifest_viewed`, `onboard.export_completed`, `onboard.memory_opt_in`, `onboard.team_invite_sent`, `onboard.resume_reentered`, `onboard.abandoned`.

**Required properties per event:**
`persona`, `source_type`, `data_classification`, `trust_mode`, `residency_region`, `seconds_since_start`, `artifact_type`, `citation_count`, `validation_status`, `approval_required`, `aha_reached`.

**Acceptance criteria.**
- All 22 events and 11 properties are present in ≥99% of first-run sessions.
- Index ↔ detailed bijection holds in telemetry contract (CI invariant 34, master plan §6).
- No event lacks any required property (CI invariant 35).

**Test strategy.**
- Unit: every event emitter is wrapped by a helper that asserts the 11 properties are present at compile time.
- Integration: replay a CFO session → assert all 22 events fire in expected order.

**Cross-refs.** V10-ONB-024 (KPI dashboard consumes these events).

---

<a id="v10-onb-024"></a>

## V10-ONB-024 — activation KPI dashboard

**Requirement:** R-ONBOARD-24 (P0) — activation KPI must be numeric overall and by persona.

**Design.** A dedicated dashboard `/admin/onboarding-kpis` (admin-only) shows:

| Metric | Overall | Partner | CFO | CEO | COO | CISO | Transformation |
|---|---|---|---|---|---|---|---|
| Activation rate | ≥40% | ≥45% | ≥55% | ≥35% | ≥42% | ≥30% | ≥45% |
| Median time-to-first-artifact | ≤240s | ≤210s | ≤180s | ≤240s | ≤240s | ≤300s | ≤240s |
| Connector-attach rate at aha | ≥50% | ≥50% | ≥60% | ≥40% | ≥55% | ≥30% | ≥50% |
| First-artifact-approved rate | ≥35% | ≥40% | ≥45% | ≥30% | ≥38% | ≥35% | ≥40% |

Each cell colour-coded green (meets target) / amber (within 10%) / red (below). Targets are sourced from the Onboarding research doc KPI table.

**Acceptance criteria.**
- Dashboard reports overall activation ≥40% target, plus per-persona targets for time-to-aha, connector attach, and approval.
- Targets are configurable (tenant admin can tighten, not loosen globally).
- Dashboard refreshes every 1 h (or on-demand).

**Test strategy.**
- Unit: KPI calculator with synthetic event stream → expected aggregates.
- Visual regression: dashboard layout stable across zoom / font-size changes.

**Cross-refs.** V10-ONB-023, V10-OUT-* (ROI block consumes activation as leading indicator).

---

<a id="v10-onb-025"></a>

## V10-ONB-025 — team invite after aha

**Requirement:** R-ONBOARD-25 (P1) — team-invite flow must activate only after personal aha, not before it.

**Design.** The team-invite CTA is hidden until either `onboard.artifact_saved` or `onboard.artifact_approved` has fired for the current user. Before that, the header shows a quiet "Invite a teammate later" hint but no interactive CTA. After aha, the CTA is prominent in the next-best-action row (V10-ONB-004's journey).

**Acceptance criteria.**
- Team invite CTA appears **only after** artifact save or approval in 100% of first-run flows.
- Before aha, no invite-related UI element is interactive.

**Test strategy.**
- Playwright: pre-aha state → no "invite" button clickable; post-aha → button visible.

**Cross-refs.** V10-ONB-006, V10-ONB-013.

---

## Test strategy (aggregate)

**Layers.** Each ticket has unit + integration + Playwright + chaos tests where applicable. The suite as a whole must cover:

- 25 tickets × unit (≥50 unit tests)
- 6 persona paths × Playwright (≥24 E2E scenarios — 4 per persona: happy, timeout, low-coverage, resume)
- 4 chaos scenarios (OAuth timeout, ACL revoke mid-session, source-changed-on-resume, clock skew)
- 22 telemetry events × contract test (property completeness)
- KPI dashboard snapshot test

**Pre-release gate.** Before ONBOARDING block ships in Wave A, **all** tests green + internal dogfood ≥20 CFO sessions with ≥55% activation + median ≤180 s.

## MVP exit criteria

Onboarding block ships in Wave A only if **every** one of the following is true:

1. CFO path median time-to-first-artifact ≤ **180 s** in internal dogfood across ≥20 guided sessions.
2. CFO end-to-end activation rate ≥ **55%**.
3. **100%** of CFO exports include manifest preview, version lineage, and SHA-256.
4. **0** silent write-backs anywhere in onboarding (lint + runtime assertion).
5. Resume recovers partial progress in ≥ **95%** of abandonment tests.
6. Partner path reaches first artifact in ≤ **240 s** in dogfood.
7. CISO path always shows admin / trust console before generation in **100%** of route tests.
8. All 25 tickets marked ✅ in the Backlog table.
9. All 22 `onboard.*` events in the telemetry contract with Index ↔ detailed bijection intact.
10. CI invariants 39, 40, 42, 45 green (master plan §6).

## Rollout order

Tickets unblock each other in this order. An engineer can pull the next ticket only after the previous gate is green.

1. **Bootstrap layer** (V10-ONB-018 → V10-ONB-019) — nothing else works without tenant init and conservative defaults.
2. **Trust surface** (V10-ONB-005 → V10-ONB-023) — banner + telemetry skeleton must exist before any interactive surface.
3. **Persona routing** (V10-ONB-001 → V10-ONB-002 → V10-ONB-003 → V10-ONB-004) — the 6 journeys are defined.
4. **Connector path** (V10-ONB-008 → V10-ONB-009 → V10-ONB-020) — CFO's secure upload + SharePoint + OAuth fallback.
5. **Generation + proposal** (V10-ONB-007 → V10-ONB-011 → V10-ONB-012 → V10-ONB-021) — no demo, proposal envelope, provenance, citation fallback.
6. **Approval + library + export** (V10-ONB-013 → V10-ONB-014 → V10-ONB-015) — the aha gates.
7. **Activation + KPI** (V10-ONB-006 → V10-ONB-010 → V10-ONB-024) — SLA enforcement + no-ghost + dashboard.
8. **Research gate** (V10-ONB-016) — only for CISO / Transformation paths.
9. **Learning + invite** (V10-ONB-017 → V10-ONB-022 → V10-ONB-025) — post-aha surfaces.

Partner and CISO paths extend the CFO foundation — they do not require new architecture, only new journey entries (V10-ONB-004) plus per-persona content.

## Cross-refs to sibling dev plans

| Depends on | What's needed from the other block |
|---|---|
| `ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` | `MutationProposal` contract (V10-ART-*), Artifact library (V10-ART-*), export manifest + SHA-256 (V10-ART-*) |
| `AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` | `ExecutionProposalV1` skeleton (V10-AGT-*), S0–S2 severity gates (V10-AGT-*), Run Ledger resume semantics (V10-AGT-*) |
| `REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md` | TrustBundle hash (R-REASON-*), evidence coverage scoring (R-REASON-10, R-REASON-16) |
| `ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md` | OAuth + ACL validation handshake (R-CONNECT-14), trust modes (R-CONNECT-2), residency enforcement (R-CONNECT-17) |
| `FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md` | Memory layer consent (R-LEARN-4, R-LEARN-5), `feedback.consent_granted` event |
| `DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md` | Cost cap + source policy confirmation gate (R-RESEARCH-3, R-RESEARCH-14) |
| `ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md` | Activation as leading indicator for ROI (R-OUTCOME-*) |

Onboarding is **downstream** of every other block on the critical path. It ships last in Wave A, after the other 5 blocks have landed their MVP slices.

## Flags to register at implementation time

Not yet in `CHAT_V9_FLAGS`. When the first implementation PR lands, these flags should be added with `block` extended to include `"onboarding"` (per master plan §1 — requires `ChatV10Block` union or equivalent addition to V9's closed block universe):

- `ff.onboard_persona_capture` (V10-ONB-001)
- `ff.onboard_persona_inference_override` (V10-ONB-002)
- `ff.onboard_admin_first_split` (V10-ONB-003)
- `ff.onboard_persona_journey` (V10-ONB-004)
- `ff.onboard_trust_first_banner` (V10-ONB-005)
- `ff.onboard_five_minute_sla` (V10-ONB-006)
- `ff.onboard_buyer_data_only` (V10-ONB-007)
- `ff.onboard_connector_ranking` (V10-ONB-008)
- `ff.onboard_connector_validation` (V10-ONB-009)
- `ff.onboard_no_ghost_caps` (V10-ONB-010)
- `ff.onboard_first_mutation_proposal` (V10-ONB-011)
- `ff.onboard_provenance_before_approval` (V10-ONB-012)
- `ff.onboard_approval_gate` (V10-ONB-013)
- `ff.onboard_library_save` (V10-ONB-014)
- `ff.onboard_export_manifest` (V10-ONB-015)
- `ff.onboard_research_cost_cap` (V10-ONB-016)
- `ff.onboard_learning_opt_in` (V10-ONB-017)
- `ff.onboard_bootstrap_init` (V10-ONB-018)
- `ff.onboard_conservative_defaults` (V10-ONB-019) — **on-by-construction** (CI invariant 40)
- `ff.onboard_oauth_fallback` (V10-ONB-020)
- `ff.onboard_citation_fallback` (V10-ONB-021)
- `ff.onboard_resume_preserve` (V10-ONB-022)
- `ff.onboard_telemetry_full` (V10-ONB-023)
- `ff.onboard_activation_kpi_dashboard` (V10-ONB-024)
- `ff.onboard_invite_after_aha` (V10-ONB-025)

25 flags total. All default-off except `ff.onboard_conservative_defaults` and `ff.onboard_trust_first_banner` (on-by-construction for safety — CI invariants 40 and the trust-before-prompt rule in R-ONBOARD-5).
