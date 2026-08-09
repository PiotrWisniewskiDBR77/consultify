# A12 Agent process-template governance — realDB evidence

> Date: 2026-08-07
> Candidate: local `codex/agent-t01-i01`
> Database: isolated PostgreSQL `consultify_agent_a12_proof_20260807`

The implementation extends the existing canonical `ai_playbook_templates` and `ai_playbook_template_versions` registry. It does not create a competing template library.

```json
{
  "proof": "A12_REALDB_GREEN",
  "publishedVersion": 1,
  "immutableSnapshot": true,
  "draftBlocked": true,
  "tenantIsolation": true,
  "revisionVersion": 2,
  "versionOnePreserved": true,
  "deprecatedInstantiationBlocked": true,
  "runtimeBundlePinned": true,
  "runtimeBundleDigestVerified": true,
  "governanceEvents": 6
}
```

PostgreSQL assertions:

- template head and version 1 were created transactionally;
- draft instantiation was rejected;
- publication marked the exact immutable version as `PUBLISHED`;
- instantiation created a new A08 work graph linked to the requested execution run;
- source `template_graph` remained equivalent after instantiation;
- another tenant listed zero templates;
- governance history read back `created`, `published`, `instantiated` in order.
- revision created version 2 while preserving the complete published version 1 snapshot;
- version 2 passed through a separate publication event;
- deprecation prevented all new instantiations without deleting historical versions or graphs;
- HTTP tests enforce admin-only mutation, governance reasons and authenticated tenant/run context.
- published versions pin prompt, model, policy, tool-policy and specialist-definition versions;
- instantiated graphs preserve the exact runtime bundle, template/version reference and matching SHA-256 digest;
- digest mismatch blocks instantiation instead of silently adopting current configuration.
- Agent Hub exposes the governed registry as a separate `Process templates` surface, preserving the legacy analysis-template library;
- the UI reads real API state, displays status/version/usage and supports reason-gated publish/deprecate plus published-only template-to-intake selection without a pasted execution-run ID; legacy Work Graph instantiation remains compatible at the administrative API/service boundary;
- the detail endpoint and expandable UI read immutable version snapshots, pinned runtime-bundle digests and the governance-event log without exposing another tenant;
- focused A12 evidence is green: service + route + component — 12/12; the component covers load/status, governance publication reason, run-bound instantiation and version/event history; full repository TypeScript check is green.

A12 remains partial only at the release-evidence layer: deployed same-SHA HTTP/browser evidence is still required. Runtime bundle pinning, admin HTTP/RBAC, revision/deprecation and the operational publication/instantiation/history UI now have automated local evidence.

## Full-content digest and planning-blueprint integration

Governed versions now preserve both the runtime-bundle digest and a SHA-256 digest over the complete template graph, including an optional validated planning blueprint. Template create/revise routes preserve that blueprint rather than stripping it. Published planning templates can be pinned to A03 intakes by immutable template/version/version-ID/digest/snapshot lineage; this does not replace or break the legacy Work Graph instantiation contract.

The new A03 integration proof returned `A03_TEMPLATE_INTAKE_REALDB_GREEN`: concurrency 2 produced exactly one template-backed Case/plan/context/run/identity/link/audit/event/usage increment/receipt, replay created no duplicates and forced failure rolled back the complete conversion. The user-facing flow requires no pasted Run ID. Focused template/intake service, route and DOM suites passed `17/17`, and the full TypeScript check passed.

The refreshed isolated PostgreSQL A12 regression returned `A12_REALDB_GREEN`: immutable version snapshots, published-only legacy Work Graph instantiation, runtime-bundle digest verification, version preservation, deprecation enforcement, tenant isolation and six governance events remain intact.

A12 remains `PARTIAL` only at the release-evidence boundary: same-SHA deployed HTTP/browser evidence for governance, history and template-to-intake selection remains required.
