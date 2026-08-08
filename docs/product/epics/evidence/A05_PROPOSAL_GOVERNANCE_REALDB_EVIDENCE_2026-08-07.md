# A05 — proposal preview and approval governance evidence

Date: 2026-08-07
Scope: local candidate; not final epic acceptance

The common proposal extension persists before/after previews, proposal and plan versions, context digest, approval scopes, exact reviewer authority and expiry. Individual scopes support approval, rejection or revision request. Revised and rebaselined proposals create new durable versions, supersede stale authority and reset approvals. Execution rechecks exact plan version, context digest and expiry and durably invalidates stale authority.

PostgreSQL database: `consultify_agent_a05_proof_20260807`
Proof script: `server/src/scripts/a05ProposalGovernanceRealDbProof.ts`

```json
{"proof":"A05_REALDB_GREEN","beforeAfter":true,"tenantIsolationFailClosed":true,"reviewerAuthorityPerScope":true,"unauthorizedReviewDenied":true,"partialApproval":true,"reject":true,"requestRevisionAndRevise":true,"exactVersionExecutable":true,"planChangeInvalidated":true,"rebaselineResetsApproval":true,"durableVersions":3,"durableGovernanceEvents":9}
```

## Integrated surfaces

- A caller-owned PostgreSQL client can be pinned into A05, allowing proposal governance and domain mutation to share one transaction; conflicting clients fail closed.
- A tenant-scoped generic HTTP surface exposes read projection, scope review/reject/request-revision, revise and rebaseline using authenticated organization and actor identity only.
- The Transformation Case UI exposes before/after, scope authority, partial approval, expiry/invalidation, revision and rebaseline states and fails closed when governance evidence or mutation APIs are unavailable.
- Initial Ideas, Interviews, DRD, Opportunity Synthesis, Finance/KPI, Portfolio Decision and Mobilization register and review A05 atomically. Common A05 is the fail-closed materialization authority; legacy status and owner-module side effects occur only after the exact governed version is executable.
- Interview preserves its two-phase `approved` then `applied` recovery contract. A controlled post-approval failure persisted one template and no assignments; retry revalidated exact A05 authority and produced exactly one template, assignment and task.
- Initiative Results, Finance/KPI Results, Portfolio Decision Results and Mobilization Results use durable governed gate mappings with the source Case version, A05 version, pending/approved/applied state and persisted result for idempotent replay. Register, scope decision, exact authority assertion, stage advance and parity finalization share one transaction.

Independent clean PostgreSQL enforcement replay: `consultify_agent_t01_a05_enforce_root_20260807`.

```json
{"proof":"T01_A05_ENFORCEMENT_GREEN","mappedStages":["drd","finance_kpi","initial_ideas","interviews","mobilization","opportunity_synthesis","portfolio_decision"],"pinnedAtomicMappings":7,"unauthorizedDeniedAndRolledBack":true,"parityAudits":7,"divergence":0,"negativeGates":["unauthorized","revision_requested","rejected","expired","invalidated"],"materializationAuthority":"common_a05"}
```

Combined A05/A10/service/route/T01/UI regression: `58/58` PASS. Full repository TypeScript check: PASS. Every negative governance state blocked side effects and preserved legacy state. The complete T01 flow reached Case v24 / `final_outputs`, with seven parity audits and zero divergence.

Result-gate proof: `T01_A05_RESULT_GATES_GREEN` with four applied mappings, four idempotent replays, four parity audits and zero divergence. An unauthorized Initiative gate created no mapping and did not advance the Case.

Terminal-gate proof: `T01_A05_TERMINAL_RESULT_GATES_GREEN`. Execution Start, Execution Results, Delivery Handoff, Benefits Review and Sustainability Review add five durable mappings and five idempotent replays. Across all result gates there are nine applied mappings, nine parity audits and zero divergence. Unauthorized Delivery rolled back the Case transition, KPI actual, KPI measurement and mapping.

Final publication is a two-phase governed operation: prepare an envelope bound to the exact facts digest, Case v24, plan and context; review scope `final_outputs.publish`; generate only after executable authority. Before approval there are zero files/manifests/links/audits. Unauthorized, revision-requested, expired, context-invalidated and changed-digest attempts are blocked before file writes. Authorized generation creates one manifest, three links and one audit; replay preserves the same run and hashes.

A05 is locally complete at the service/API/realDB contract level. The local final-publish UI now covers prepare-publication, exact digest and before/after review, scope authority, reject/revision states and generation that remains disabled until the mapped proposal is approved and executable. It remains `PARTIAL` under the binding matrix because same-SHA deployed role/browser evidence is still required.
