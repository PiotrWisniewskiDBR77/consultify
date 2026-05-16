# Presentation Stage-Gate Workflow

This workflow defines mandatory promotion gates for the Presentation Artifact Engine across `dev -> staging -> preprod -> prod`.

## 1) Promotion Policy

- No direct promotion to `prod` from feature branches.
- Every environment promotion requires explicit evidence and an owner.
- Any `BLOCKED_P1` or `P0` quality result blocks promotion.
- Confidentiality policy controls must be verified on every environment.

## 2) Gate Checklist (Mandatory)

### Dev -> Staging

- [ ] Unit tests pass for:
  - template compatibility adapter
  - access/control regressions on presentation routes
  - agent edit proposal/approval behavior
- [ ] Contract checks pass for export-blocked payload (`QUALITY_GATE_BLOCKED`).
- [ ] Migration checks pass (`presentation_runtime_events` table available).
- [ ] Manual smoke:
  - generate deck
  - run agent proposal
  - approve proposal
  - export PDF/PPTX/HTML/PNG

### Staging -> Preprod

- [ ] All quality gates return `PASS` or `PASS_WITH_P2` for benchmark decks.
- [ ] Confidentiality behavior validated:
  - confidential deck export blocked for non-privileged roles
  - non-public share blocked for `PROJECT_MANAGER`
  - privileged roles can proceed when policy allows
- [ ] Telemetry evidence captured for:
  - `agent_edit_proposal_created`
  - `agent_edit_applied`
  - `agent_edit_rejected`
  - `export_blocked`
- [ ] No unresolved P0/P1 UI regressions in Deck Builder.

### Preprod -> Prod

- [ ] Release note includes:
  - schema changes
  - API behavior changes
  - rollback steps
- [ ] Export reliability SLI check (last 7 days) meets target.
- [ ] Security sign-off for confidentiality and share controls.
- [ ] Product owner approval recorded in audit trail.

## 3) Evidence Pack (Required)

For each promotion, collect:

- Test evidence: CI run URL and summary.
- UI evidence: screenshots or recording of export/share flows.
- API evidence: sample request/response for success and blocked scenarios.
- Runtime evidence: telemetry rows for proposal/edit/export-blocked events.
- Rollback evidence: script/command and owner.

## 4) Rollback Rules

- If any prod regression impacts export availability, revert within 30 minutes.
- If confidentiality control fails, disable share/export for affected tenant scope until fix.
- Rollback must preserve audit logs and version history.

## 5) Ownership Matrix

- Engineering lead: implementation readiness, migration safety.
- QA owner: gate evidence completeness.
- Product owner: acceptance and release scope.
- Security owner: confidentiality and access policy verification.
