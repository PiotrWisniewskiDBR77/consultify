# Migration Sign-Off — `<migration_id>`

> Copy this template to `docs/operations/sign-off/<YYYY-MM-DD>-<migration_id>.md`
> and complete every checkbox before applying to **staging or higher**.
> Companion runbook: `docs/operations/PRESENTATION_MIGRATION_RUNBOOK.md`.

**Date:** `<YYYY-MM-DD>`
**Author:** `<name>`
**Reviewers:** Backend lead `<name>` · Ops/SRE `<name>` · Product `<name>` (when applicable)
**Migration:** `<migration_id>` (e.g. `767_presentation_template_governance`)
**Risk tier:** `P0 | P1 | P2`
**Rollback strategy:** `drop_columns | restore_snapshot | manual_review | not_applicable`

---

## Pre-flight

- [ ] DB snapshot taken at: `<ISO timestamp>` — storage URI: `<uri>`
- [ ] Dry-run report committed: `<docs/operations/sign-off/...dry-run.json>`
- [ ] Dry-run recommendation: `PROCEED | PROCEED_WITH_REVIEW | BLOCK`
- [ ] Rollback strategy validated: `<strategy>` — validation notes: `<...>`
- [ ] `npm run migrate:rollback-check -- --migrations <ids>` reviewed by ops

---

## Apply

- [ ] **Dev** applied at: `<ISO>` by `<user>` — verification: `<...>`
- [ ] **Staging** applied at: `<ISO>` by `<user>` — verification: `<...>`
- [ ] Smoke tests passed: `<MT-PRES test ids / CI run url>`
- [ ] **Preprod** applied at: `<ISO>` by `<user>` — E2E governance loop: `<run url>`
- [ ] **Prod** applied at: `<ISO>` by `<user>` — apply window: `<window>`

---

## Post-flight

- [ ] Catalog `postCheck` queries executed — results: `<row counts / verdicts>`
- [ ] No new `BLOCKED_P0` decks introduced (governance watchlist verdict: `<...>`)
- [ ] No spike in `export_blocked` runtime events (delta: `<n events / window>`)
- [ ] Audit integrity check ran: `<verdict>` (`npm run audit:integrity`)
- [ ] Operations Health scoreboard status: `pass | at_risk | breach`

---

## Sign-off

- [ ] Backend lead: `<name>` @ `<date>`
- [ ] Ops lead: `<name>` @ `<date>`
- [ ] Product: `<name>` @ `<date>` _(required when user-visible behavior changes)_

---

## Rollback (if triggered)

_Only fill this section if the migration was rolled back. Leave blank otherwise._

- **Reason:** `<incident link / observability evidence>`
- **Rollback strategy used:** `drop_columns | restore_snapshot | manual_review | not_applicable`
- **Rollback executed at:** `<ISO timestamp>` by `<user>`
- **Recovery time (MTTR):** `<minutes>`
- **Postmortem link:** `<docs/operations/postmortems/...>`
- **Follow-up corrective migration ticket:** `<jira/linear id>`

---

## Audit

- Dry-run JSON: `<path>`
- Apply log (CI run): `<url>`
- `presentation_migration_reports` row id (for `data_normalize` migrations): `<run_id>`
- Sign-off ledger entry merged in PR: `<pr url>`
