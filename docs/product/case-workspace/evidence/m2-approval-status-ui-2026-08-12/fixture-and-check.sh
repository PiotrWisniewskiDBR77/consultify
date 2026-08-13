#!/usr/bin/env bash
# Packet M2 — approval/proposal lifecycle UI. Fixture + DB-readback helper.
#
# WHY THIS SCRIPT EXISTS: RealizacjaView.tsx now wires four proposal
# transitions (submitProposalForReview / retryProposal / revokeProposal /
# markProposalFailed) that only appear for a proposal in DRAFT / FAILED /
# APPROVED / EXECUTING respectively. Those statuses are normally produced by
# the agent/run pipeline (createActionProposal -> submit -> decide ->
# transitionProposalToExecuting -> ...), which is other packets' scope and
# not something this packet drives end-to-end. To exercise the FOUR
# transitions THIS packet actually built, against the REAL backend and REAL
# Postgres, this script:
#
#   1. Logs in as the seeded local user (real auth, real JWT).
#   2. Creates a REAL Case and a REAL Run through the REAL API (createCase,
#      createPlanDraft, createRun) — no shortcuts here, these are the actual
#      HTTP routes.
#   3. INSERTS four ActionProposal rows DIRECTLY into
#      case_workspace_action_proposals on the disposable local Postgres
#      (127.0.0.1:55432, case_workspace_test) — one each pre-set to DRAFT,
#      FAILED, APPROVED, EXECUTING — because standing up the full agent/run
#      pipeline to reach those statuses organically is out of this packet's
#      scope. This is a fixture (the "arrange" step), not the thing being
#      tested.
#   4. Prints the four actionProposalIds plus the caseId so the transitions
#      can be driven through the REAL UI (RealizacjaView, Realizacja tab) in
#      the browser — THAT click, THAT network request, THAT DB write is the
#      actual evidence, not this script.
#
# Never touches demo/staging. Hard-fails if DATABASE_URL is not localhost.
set -euo pipefail

API="http://127.0.0.1:3001"
DB_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test"
EMAIL="cw.local@local.test"
PASSWORD="CaseWorkspaceLocal!2026"
PROJECT_ID="cw-local-project"

host="$(python3 -c "from urllib.parse import urlparse; print(urlparse('$DB_URL').hostname)")"
case "$host" in
  127.0.0.1|localhost|0.0.0.0|::1) ;;
  *) echo "BLOCKED: DB_URL host '$host' is not local. Refusing." >&2; exit 1 ;;
esac

# No local psql client in this shell — use the disposable container's own
# psql via `docker exec`. Same DB, same disposable local-only container
# (case-workspace-test-pg, 127.0.0.1:55432), just invoked differently.
psql_exec() {
  docker exec -i case-workspace-test-pg psql -U case_workspace -d case_workspace_test "$@"
}

echo "== 1. login =="
LOGIN_JSON=$(curl -sS -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN_JSON" | jq -r '.data.token // .token // empty')
if [ -z "$TOKEN" ]; then
  echo "LOGIN FAILED: $LOGIN_JSON" >&2
  exit 1
fi
echo "token acquired (${#TOKEN} chars)"

AUTH=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')

echo "== 2. create case (STANDARD profile — LIGHT forces the one-click run path, run_lifecycle_light_case_requires_one_click, which this fixture does not need) =="
CASE_JSON=$(curl -sS -X POST "$API/api/v8/case-workspace/cases" "${AUTH[@]}" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"caseName\":\"M2 evidence — sprawy do zatwierdzenia\",\"caseProfile\":\"STANDARD\",\"contractedClosureType\":\"DELIVERY_COMPLETED\"}")
CASE_ID=$(echo "$CASE_JSON" | jq -r '.data.caseId')
echo "caseId=$CASE_ID"
[ -n "$CASE_ID" ] && [ "$CASE_ID" != "null" ] || { echo "CASE CREATE FAILED: $CASE_JSON" >&2; exit 1; }

echo "== 3. create plan draft =="
PLAN_JSON=$(curl -sS -X POST "$API/api/v8/case-workspace/cases/$CASE_ID/plan-versions" "${AUTH[@]}" \
  -d '{"semanticGraph":{"entryNodeIds":["n1"],"terminalNodeIds":["n1"],"nodes":[{"nodeId":"n1"}],"edges":[]}}')
PLAN_VERSION_ID=$(echo "$PLAN_JSON" | jq -r '.data.casePlanVersionId')
echo "casePlanVersionId=$PLAN_VERSION_ID"
[ -n "$PLAN_VERSION_ID" ] && [ "$PLAN_VERSION_ID" != "null" ] || { echo "PLAN CREATE FAILED: $PLAN_JSON" >&2; exit 1; }

echo "== 3b. propose + publish the plan draft (createRun requires PUBLISHED, run_lifecycle_plan_not_published otherwise) =="
PROPOSE_JSON=$(curl -sS -X POST "$API/api/v8/case-workspace/plan-versions/$PLAN_VERSION_ID/propose" "${AUTH[@]}" \
  -H "Idempotency-Key: cw-fixture-propose-$(date +%s)" \
  -d '{"expectedVersion":1}')
PROPOSED_VERSION=$(echo "$PROPOSE_JSON" | jq -r '.data.version')
echo "proposed, version=$PROPOSED_VERSION"
[ -n "$PROPOSED_VERSION" ] && [ "$PROPOSED_VERSION" != "null" ] || { echo "PROPOSE FAILED: $PROPOSE_JSON" >&2; exit 1; }

PUBLISH_JSON=$(curl -sS -X POST "$API/api/v8/case-workspace/plan-versions/$PLAN_VERSION_ID/publish" "${AUTH[@]}" \
  -H "Idempotency-Key: cw-fixture-publish-$(date +%s)" \
  -d "{\"expectedVersion\":$PROPOSED_VERSION}")
PUBLISH_STATUS=$(echo "$PUBLISH_JSON" | jq -r '.data.status')
echo "publish status=$PUBLISH_STATUS"
[ "$PUBLISH_STATUS" = "PUBLISHED" ] || { echo "PUBLISH FAILED: $PUBLISH_JSON" >&2; exit 1; }

echo "== 4. create run (needs the now-PUBLISHED plan version) =="
IDEMP="cw-fixture-run-$(date +%s)"
RUN_JSON=$(curl -sS -X POST "$API/api/v8/case-workspace/cases/$CASE_ID/runs" "${AUTH[@]}" \
  -H "Idempotency-Key: $IDEMP" \
  -d "{\"casePlanVersionId\":\"$PLAN_VERSION_ID\"}")
RUN_ID=$(echo "$RUN_JSON" | jq -r '.data.runId')
echo "runId=$RUN_ID"
[ -n "$RUN_ID" ] && [ "$RUN_ID" != "null" ] || { echo "RUN CREATE FAILED: $RUN_JSON" >&2; exit 1; }

echo "== 5. create ONE real DRAFT proposal through the real API (createActionProposal) =="
IDEMP2="cw-fixture-proposal-draft-$(date +%s)"
DRAFT_JSON=$(curl -sS -X POST "$API/api/v8/case-workspace/cases/$CASE_ID/proposals" "${AUTH[@]}" \
  -H "Idempotency-Key: $IDEMP2" \
  -d '{"runId":"'"$RUN_ID"'","nodeRunId":"m2-fixture-noderun-draft","payloadDigest":"sha256:m2fixturedraft0000000000000000000000000000000000000000000000","policySnapshotRef":"policy-m2-fixture","effectClass":"SAFE_ADDITIVE","previewRef":"artifact://document/m2-fixture-draft","proposerType":"AGENT"}')
DRAFT_ID=$(echo "$DRAFT_JSON" | jq -r '.data.actionProposalId')
echo "DRAFT actionProposalId=$DRAFT_ID"
[ -n "$DRAFT_ID" ] && [ "$DRAFT_ID" != "null" ] || { echo "PROPOSAL CREATE FAILED: $DRAFT_JSON" >&2; exit 1; }

echo "== 6. seed FAILED / APPROVED / EXECUTING / FAILED-for-conflict proposal rows directly (fixture, not the evidence) =="
psql_exec -v ON_ERROR_STOP=1 <<SQL
INSERT INTO case_workspace_action_proposals (
  action_proposal_id, organization_id, project_id, case_id, run_id, node_run_id,
  proposal_version, payload_digest, policy_snapshot_ref, effect_class, preview_ref,
  idempotency_key, proposer_type, created_by_actor_id, status, version
) VALUES
  ('m2fx-prop-failed',    'cw-local-org', '$PROJECT_ID', '$CASE_ID', '$RUN_ID', 'm2-fixture-noderun-failed',
   1, 'sha256:m2fixturefailed000000000000000000000000000000000000000000000', 'policy-m2-fixture', 'SAFE_UPDATE', 'artifact://document/m2-fixture-failed',
   'm2fx-idemp-failed', 'AGENT', 'cw-local-user', 'FAILED', 1),
  ('m2fx-prop-approved',  'cw-local-org', '$PROJECT_ID', '$CASE_ID', '$RUN_ID', 'm2-fixture-noderun-approved',
   1, 'sha256:m2fixtureapproved00000000000000000000000000000000000000000', 'policy-m2-fixture', 'SENSITIVE_UPDATE', 'artifact://document/m2-fixture-approved',
   'm2fx-idemp-approved', 'AGENT', 'cw-local-user', 'APPROVED', 1),
  ('m2fx-prop-executing', 'cw-local-org', '$PROJECT_ID', '$CASE_ID', '$RUN_ID', 'm2-fixture-noderun-executing',
   1, 'sha256:m2fixtureexecuting0000000000000000000000000000000000000000', 'policy-m2-fixture', 'DESTRUCTIVE', 'artifact://document/m2-fixture-executing',
   'm2fx-idemp-executing', 'AGENT', 'cw-local-user', 'EXECUTING', 1),
  ('m2fx-prop-conflict',  'cw-local-org', '$PROJECT_ID', '$CASE_ID', '$RUN_ID', 'm2-fixture-noderun-conflict',
   1, 'sha256:m2fixtureconflict000000000000000000000000000000000000000000', 'policy-m2-fixture', 'SAFE_UPDATE', 'artifact://document/m2-fixture-conflict',
   'm2fx-idemp-conflict', 'AGENT', 'cw-local-user', 'FAILED', 1)
ON CONFLICT (action_proposal_id) DO UPDATE SET
  status = EXCLUDED.status, version = 1, updated_at = CURRENT_TIMESTAMP;
SQL

echo "== 7. readback (before UI action) =="
psql_exec -c "SELECT action_proposal_id, status, version, updated_at FROM case_workspace_action_proposals WHERE case_id = '$CASE_ID' ORDER BY created_at;"

cat <<EOF

Case ready at: $API -> UI at http://127.0.0.1:4501/zlecenia/$CASE_ID?zakladka=realizacja

  DRAFT proposal (submit-for-review target, then self-approval refusal):  $DRAFT_ID
  FAILED proposal (retry target):                                        m2fx-prop-failed
  APPROVED proposal (revoke target):                                     m2fx-prop-approved
  EXECUTING proposal (mark-failed target):                               m2fx-prop-executing
  FAILED proposal (conflict target — bump its version externally, THEN
    click Ponów in the UI so the client's expectedVersion=1 is stale):    m2fx-prop-conflict

Drive each transition through the REAL UI, then re-run:
  docker exec -i case-workspace-test-pg psql -U case_workspace -d case_workspace_test -c "SELECT action_proposal_id, status, version, updated_at FROM case_workspace_action_proposals WHERE case_id = '$CASE_ID' ORDER BY created_at;"

To force the conflict path on m2fx-prop-conflict AFTER the UI has loaded its preview (version=1):
  docker exec -i case-workspace-test-pg psql -U case_workspace -d case_workspace_test -c "UPDATE case_workspace_action_proposals SET version = version + 1, updated_at = now() WHERE action_proposal_id = 'm2fx-prop-conflict';"
EOF
