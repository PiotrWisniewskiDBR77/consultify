# P24-C — Templates verification + rollout evidence (2026-03-30)

Packet: **P24-C**  
Depends on: **P24-B delivered** (`42e2a699b7`)  

This document captures the P24-C proof bundle required to mark position **#24 Templates** as `verified(evidence)`.

## 1) Automated regression tests (local)

Command:

```bash
npx vitest run \
  tests/integration/routes/artifacts.routes.test.ts \
  tests/unit/hooks/useTemplates.canonicalArtifacts.test.tsx
```

Result: **PASS** (see terminal output in this session; `artifacts.routes` + `useTemplates` green).

## 2) Rollback posture validation (publish/review disabled)

### Server toggles (no redeploy schema impact)

- Disable template review (but keep browse+generate):
  - `V8_TEMPLATES_REVIEW_ENABLED=false`
- Disable template publish (but keep browse+generate):
  - `V8_TEMPLATES_PUBLISH_ENABLED=false`
- Simulate P18 outage (provenance stamp unavailable) → **fail closed** for org/app publish:
  - `V8_PROVENANCE_STAMP_ENABLED=false`

### Verified behavior (local contract tests)

- With `V8_TEMPLATES_REVIEW_ENABLED=false`:
  - `POST /api/artifacts/:id/start-review` for `artifactFamily=template` returns **503**
- With `V8_TEMPLATES_PUBLISH_ENABLED=false`:
  - `POST /api/artifacts/:id/publish` returns **503**
- With `V8_PROVENANCE_STAMP_ENABLED=false` and `template.scope=org`:
  - `POST /api/artifacts/:id/publish` returns **503** with `Provenance stamp unavailable` (fail closed)

## 3) Staging proof (end-to-end)

Script source: `docs/product/work-packets/cursor-work/final_master/evidence/P24-B_TEMPLATE_RUNTIME_VERIFICATION_2026-03-30.md`

### Proof captures (to attach)

Save assets under:
- `docs/product/work-packets/cursor-work/final_master/evidence/assets/p24c-templates/`

Required screenshots (minimum):
1. `01-templates-tab-canonical.png` — Templates tab showing canonical list (templates are artifacts).
2. `02-use-template-report.png` — “Use template” opens report builder with `templateArtifactId=...`.
3. `03-save-as-template-personal.png` — Output row action “Save as template” creates personal template.
4. `04-save-as-template-org.png` — Save as org template + “Submit for review”.
5. `05-needs-review-approve-publish.png` — Needs review → “Approve & publish”.
6. `06-reuse-by-another-user.png` — Another user in same org sees org template and can use it.

Notes:
- The environment must have two users in the same org (`User A` member + `User B` admin/owner).
- If the staging base URL differs from `staging.consultify.app`, record it here with date/time.

### Current blocker (needs runtime inputs)

This agent session does not have:
- staging base URL that successfully completes TLS,
- and/or staging credentials/JWT for two users.

Once provided, run the script and attach the screenshots listed above, plus a short note per step:
- what was clicked,
- what was observed,
- any degraded posture banners.

## 4) Known limits (bounded)

- Presentation template “edit” remains bounded to wizard entrypoints (no full template editor in this packet).
- Publish is admin-only and is blocked when provenance stamping is disabled (fail closed for org/app scope).

