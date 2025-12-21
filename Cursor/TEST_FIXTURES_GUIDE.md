# Consultify — Test Fixtures & Isolation Guide

## DB Strategy
- Integration tests use **SQLite `:memory:`** to keep tests fast and isolated.
- Each suite is responsible for creating only the minimum required fixtures and cleaning up after itself.

## Recommended Pattern
- Prefer helper utilities (DB helper / fixture builder) instead of inline SQL sprinkled across tests.
- Use deterministic IDs where possible (fixed UUID strings), unless uniqueness is required.

## Tenant Isolation Rules
When creating data in tests:
- Always include `organization_id` where applicable.
- Always include `project_id` where applicable.
- Verify cross-tenant access is denied (negative tests are mandatory for critical routes).

## Time / Randomness
- Freeze time where business logic depends on it (expiry windows, rate limiting, audit trails).
- Avoid `Math.random()` in production logic; in tests, control randomness.

## External Integrations
- Redis: use stubbed client in unit/component; in integration, either stub or run in-memory emulation.
- Stripe/webhooks: use signature-validation test vectors; never hit real Stripe.
- LLM: use deterministic stub of your API (see `Cursor/LLM_STUB_CONTRACT.md`).


