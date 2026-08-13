# Real demo OWNER rehearsal

This is a fail-closed, read-only reachability gate for `https://demo.consultify.ai`.
It signs in through the real `/login` UI as a dedicated acceptance OWNER in DBR77,
validates the expected email, role and organization from the login response, independently
reads back that Piotr remains an active OWNER, then visits the canonical routes without
query/localStorage feature activation. It records Playwright traces, screenshots,
console errors, failed requests and HTTP >=400 API responses under `/tmp` by default.

It deliberately does not use test-support, demo-login, register-demo, unsigned tokens,
API token injection or an existing browser storage state.

```sh
E2E_ACCEPTANCE_OWNER_EMAIL=acceptance.owner@consultify.local \
E2E_ACCEPTANCE_OWNER_PASSWORD='<same-secret-used-by-the-fixture-seed>' \
E2E_BASE_URL=https://demo.consultify.ai \
npx playwright test -c playwright.demo-acceptance.config.ts
```

The acceptance fixture runner creates or rotates this dedicated account idempotently, only
inside its existing fail-closed `demo` transaction:

```sh
RAILWAY_ENVIRONMENT_NAME=demo \
ACCEPTANCE_FIXTURES_CONFIRM=SEED_DEMO_ACCEPTANCE_FIXTURES \
ACCEPTANCE_ORG_ID=a3e05d4a-5397-419d-b486-8e44366c0063 \
ACCEPTANCE_USER_ID='<existing-active-owner-id>' \
ACCEPTANCE_TEST_OWNER_EMAIL=acceptance.owner@consultify.local \
ACCEPTANCE_TEST_OWNER_PASSWORD='<random-secret-at-least-16-characters>' \
npx tsx server/scripts/acceptance-fixtures/run.ts --write
```

Without the dedicated secret the suite stops with `ACCEPTANCE_OWNER_CREDENTIALS_REQUIRED`.
That is an authentication evidence gate, not a test skip.
