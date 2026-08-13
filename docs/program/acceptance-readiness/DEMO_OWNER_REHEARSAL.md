# Real demo OWNER rehearsal

This is a fail-closed, read-only reachability gate for `https://demo.consultify.ai`.
It signs in through the real `/login` UI as the existing DBR77 OWNER, validates the
expected email, role and organization, then visits the canonical routes without
query/localStorage feature activation. It records Playwright traces, screenshots,
console errors, failed requests and HTTP >=400 API responses under `/tmp` by default.

It deliberately does not use test-support, demo-login, register-demo, unsigned tokens,
API token injection or an existing browser storage state.

```sh
E2E_OWNER_EMAIL=piotr.wisniewski@dbr77.com \
E2E_OWNER_PASSWORD='<provided-out-of-band>' \
E2E_BASE_URL=https://demo.consultify.ai \
npx playwright test -c playwright.demo-acceptance.config.ts
```

Without the real password the suite must stop with `REAL_OWNER_CREDENTIALS_REQUIRED`.
That is an authentication evidence gate, not a test skip.
