# Consultify — final tree, branch and placeholder audit (2026-08-03)

## Verdict

The canonical integration branch is the only release candidate. GitHub `demo` and Railway
demo matched its pre-audit revision at the start of this audit. The audit then found three
real consolidation omissions and corrected them locally on the same branch:

1. TLS-01 five stable, URL-addressable Tools surfaces;
2. INI-08 dynamic initiative-card composition persistence;
3. Decision-domain fresh-schema boolean normalization plus removal of an unmounted duplicate
   Decision router.

These corrections must pass gates, be pushed to the same two Git refs and reach Railway demo
before the UI/UX agent starts.

## Git and worktree inventory

Snapshot at audit start:

- 765 local branches: 449 reachable from the final branch, 316 not reachable;
- 154 `origin/*` refs: 99 reachable, 55 not reachable;
- 37 registered worktrees;
- 5 dirty worktrees;
- 11 stashes.

These counts are history, not release scope. A non-merged branch is not automatically a
missing feature. The repository has a year of parallel experiments, backups and agent
worktrees. Deleting them does not make the release more integrated.

### Accepted canonical package heads

All nine whole-package inputs frozen in `FINAL_INTEGRATION_MANIFEST_2026-08-03.md` are true
ancestors of the final integration branch:

- strict schema, MAT-10, FIN-05, FIN-07;
- MW-07, MW-08, MW-10;
- INI-04/05;
- RES-02/03/04/09/10/11.

MW-11 and CHAT-07/08/09 were intentionally replayed on the current tree under the hashes
recorded in `CURRENT_MVP_CONTROL.md`. Accepted INT-08 `692bbc855d` is an ancestor. The
unreviewed INT-08 WIP `2bc65b8037` remains excluded.

### Dirty worktrees

The release worktree is clean between deliberate consolidation commits. Other dirty trees
are not release inputs:

- the primary `codex/sync-demo-20260729` checkout contains a large, mixed documentation and
  visual-evidence draft; it requires its own controlled handoff and must not be merged or
  deleted wholesale;
- three old Claude worktrees contain isolated test/migration/source edits;
- one old Claude worktree contains an untracked `dev-render/` directory.

They remain preservation sources, not hidden release deltas. No destructive cleanup is
authorized until their owners report or their contents are archived explicitly.

### Stashes

The newest stash is labeled as a foreign RES-02 WIP recovered from a shared-stash race. Its
intent (one canonical KPI definition writer, immutable versions and CAS) is already present
through accepted RES-02 ancestry, but the patch no longer applies cleanly in either direction
because the final Results tree has advanced. Keep it as forensic recovery material; do not
apply or drop it during release consolidation. The remaining ten stashes are older safety/WIP
snapshots and are not release inputs.

## Placeholder and mock audit

Naive text search reports many `placeholder`, `mock`, `stub` and `TODO` occurrences. Most are
SQL parameter placeholders, input placeholder text, test/dev-render mocks, documentation or
explicit empty-state copy. They are not evidence of fake production behavior.

The material runtime finding is different: `Gateway.ts` deliberately disables a family of
legacy/generated routers in `NODE_ENV=production`. Twelve paths have live UI callers and
therefore return an honest `501` on demo instead of a fake success:

- audit log;
- integrations;
- governance permissions;
- AI context readiness;
- Rapid Lean;
- locations;
- project status;
- workqueue/My Approvals;
- multi-framework assessment;
- notification settings;
- help analytics;
- consultants.

They must not be enabled wholesale. Several underlying routers contain cross-tenant update or
read gaps (context, Rapid Lean, status, multi-framework assessment, consultants, integration
logs); workqueue is an intentional stub; governance and locations are degraded-mode routers;
notification test currently reports success without sending. The safe release behavior is
the current explicit 501 until each scope receives a tenant/RBAC/data-contract review.

These paths are not silently counted as completed by the 93-task MVP ledger. Audits and the
broader meeting/consulting-tool/assessment-tool expansions remain separate post-MVP program
items. During the UI/UX pass, unsupported entry points must be hidden or explain their
unavailability; the agent must not fabricate data or convert 501 into visual success.

## Historical UI branches

Several July branches contain UI improvements not reachable by ancestry. Their semantics were
checked before deciding whether to integrate:

- N-type AutoFit/history/presentation-mode work is already present through independent,
  newer implementations in the final tree; do not merge the old branches;
- Process Flow toolbar slimming and Ideas Table/Whiteboard context-menu branches are old UX
  proposals, not frozen 93-task inputs; use them only as comparison material during visual
  review;
- the missing TLS-01 and INI-08 deltas were frozen task evidence and were therefore
  reconstructed onto the current final branch.

## Release rule

Only `codex/integrate-mvp-final-20260803` may advance to demo. Claude UI/UX work must branch
from the exact post-audit SHA after it is pushed and deployed. No historical branch, stash,
dirty primary checkout or dev-render harness may be merged wholesale into the release.
