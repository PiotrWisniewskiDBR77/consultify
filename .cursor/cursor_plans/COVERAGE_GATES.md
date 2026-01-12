# Consultify — Coverage Gates (Security-first)

## Philosophy
Coverage is enforced hardest where risk is highest. We aim for **maximum meaningful coverage** and treat “100% overall” as a direction, not a vanity metric.

## Gate A: Critical Security & Money Paths (target 100%)
These modules must reach **100% statements and branches** (or documented exception with rationale):
- Auth/session: `server/routes/auth.js`, `server/routes/sessions.js`, `server/middleware/**auth*`
- Permissions/access-control: `server/routes/access-control.js`, `server/services/**policy**`, `server/middleware/**planLimits**`
- Tenant isolation (org/project boundaries): routes/services touching `organization_id`, `project_id`
- Billing/token-billing: `server/routes/billing.js`, `server/routes/tokenBilling.js`, `server/services/**billing**`
- Invitations: `server/routes/invitations.js`, `server/services/invitationService.js`
- Webhooks (Stripe signatures): `server/routes/webhooks/**`
- Legal export / storage security: `server/routes/legal.js`, `server/services/**legal**`, `tests/integration/storage_security.test.js`

**Acceptance rule**: coverage exceptions must include:\n
- reason (e.g. unreachable branch, defensive logging)\n
- why it’s safe\n
- link to tests that cover surrounding behavior\n

## Gate B: Core Backend (target 95/90)
Global baseline for `server/**` production code (excluding scripts/seed/migrations):
- **>=95%** statements/lines/functions\n
- **>=90%** branches\n

## Gate C: Frontend Core (target 90/85)
Baseline for `src/**` production code:
- **>=90%** statements/lines/functions\n
- **>=85%** branches\n

## Reporting
- HTML/JSON coverage reports are tracked and progress summarized in `Cursor/PROGRESS.md`.


