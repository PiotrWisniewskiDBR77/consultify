# T4 Charter - broader `Sync` completion

> Status: active
> Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
> Lane: broader `Sync` completion
> Taxonomy: `T4`
> Priority: highest
> Last updated: 2026-03-27

---

## 1. Goal

Promote the broader `Sync` completion lane from visible backlog into active execution and close the remaining split-brain between the accepted bounded `Sync / connectors / interoperability` lane and a coherent broader sync onboarding/completion surface.

This lane exists because the accepted bounded sync cut already closed entry authority, hub observability, error resolution, pause/resume, run-now, reauth trigger, and disconnect continuity, but it explicitly left provider connect initiation, honest onboarding state, OAuth round-trip completion, and broader provider completion breadth outside the bounded scope.

---

## 2. In scope

- Broader sync completion breadth on live admin/operator sync surfaces
- Residual split-brain mapping across V8 sync, legacy `sync-hub`, canonical org-level integrations, and user-level settings integrations
- Bounded packets chosen only after the remaining active sync residual stays explicit
- Focused regression coverage for any promoted broader sync packets
- Evidence updates and plan/tracker/program status updates

---

## 3. Explicitly out of scope

- Reopening the accepted bounded sync observability and lifecycle-control packets
- Pretending full provider OAuth callback/refresh completion already exists when it does not
- Provider-specific setup redesigns, mapping UX, or broad connector-package governance
- Multiplayer, Notes, Partner, or other already accepted/bounded non-sync lanes
- Unbounded sync-platform consolidation framed as one more parity packet

---

## 4. First bounded packet

### Packet name

`sync connect initiation V8 seam`

### Why this packet starts first

- the active `UnifiedSyncHub` still uses legacy `POST /api/sync-hub/connect` for its visible connect CTA while the rest of the live hub already prefers governed V8 seams
- that legacy path mixes a config-heavy backend contract with an active UI that submits empty config and then reports fake `connected` truth
- the missing connect initiation seam is smaller and more honest than claiming full OAuth/provider completion in one step
- it closes one live admin-facing onboarding authority cut without silently broadening into callback, refresh, or provider-specific setup breadth

### Packet scope

- add governed V8 parity for active sync connect initiation
- move `UnifiedSyncHub` connect CTA onto a governed V8-first seam
- keep initiated integrations in an honest `pending` onboarding state instead of claiming live completion
- keep OAuth callback/refresh completion, provider-specific config follow-up, and broader org-level consolidation outside this packet

---

## 5. Lane acceptance target

This broader lane is not done after one connect-initiation packet.

The lane will be accepted only when:

1. the remaining broader `Sync` residuals are broken into honest bounded packets,
2. those packets land with real runtime and surface continuity,
3. no smaller real packet remains,
4. and the lane can be accepted without silently broadening into a whole sync-platform rewrite.
