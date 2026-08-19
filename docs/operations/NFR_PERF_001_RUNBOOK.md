# NFR-PERF-001 mounted release gate

This is a fail-closed performance and reconciliation gate for an already mounted Consultify candidate. It does not start a mock server, replace routers, mint fake sessions, or persist credentials. It exercises signed HTTP routes for Case, My Work, Settings, Initiative, and Finance.

## Authority

- release mode refuses less than 30 minutes or fewer than 50 distinct primary JWTs;
- read p95 must be at most 1500 ms, write p95 at most 2500 ms, and the error rate must be strictly below 1%;
- every write command must expose a stable command/entity identity, exact replay must resolve the same command, and exact-ID readback must produce loss=0 and duplicate=0;
- the foreign tenant token continuously attempts reads of primary-tenant targets; any successful target response is a false success;
- desktop/mobile cold-context Web Vitals are evaluated at p75. LCP 2.5s/4s, CLS 0.10, and INP 200ms remain provisional and require owner acceptance.

## Inputs

Copy `scripts/performance/nfr-perf-profile.example.json` outside the repository and replace every placeholder with real seeded fixture IDs and the exact 40-character candidate SHA. Confirm paths against the mounted candidate: the example is a schema/template, not evidence that those route contracts are present on a different SHA.

Create a mode-0600 JSON credential file outside the repository:

```json
{"primary":["JWT_1", "JWT_2"], "foreign":"JWT_FOREIGN"}
```

The primary array must contain 50 different authenticated users. Create a JSON array of browser samples outside the repository; each sample contains `productSha`, `device` (`desktop` or `mobile`), `cold: true`, `LCP`, `CLS`, and `INP`. Browser capture must use real cold contexts without request interception.

Run:

```sh
NFR_PERF_RELEASE_GATE=1 \
NFR_PERF_PROFILE=/absolute/private/profile.json \
NFR_PERF_TOKENS=/absolute/private/tokens.json \
NFR_PERF_WEB_VITALS=/absolute/private/web-vitals.json \
NFR_PERF_EVIDENCE_DIR=/absolute/evidence/nfr-perf-<sha> \
npm run test:nfr-perf:mounted
```

The evidence directory receives an atomically replaced report plus a hash manifest. It never contains tokens. `PASS` proves the repository gate on the exact mounted SHA; it does not prove production deployment or production availability. A shortened run is always labelled `QUALIFICATION_ONLY`, never release evidence.

## Disposable exact-SHA qualification

For local qualification, the repository can create a fresh PostgreSQL database, run all migrations, create 50 active signed users plus a foreign tenant, seed deterministic targets through the mounted production routers, serve the production build, and capture the desktop/mobile browser batch automatically:

```sh
NFR_PERF_ADMIN_DATABASE_URL=postgresql://user:password@127.0.0.1:55432/admin_database \
NFR_PERF_PRODUCT_SHA=$(git rev-parse HEAD) \
NFR_PERF_EVIDENCE_DIR=/absolute/evidence/nfr-perf-$(git rev-parse --short HEAD) \
NFR_PERF_RELEASE_GATE=1 \
npm run test:nfr-perf:disposable
```

This path requires an existing `dist/index.html` from `npm run build`. Its temporary database and private JWT/profile directory are deleted on completion; the credential-free report, Web Vitals batch, migration result, and hashes remain in the external evidence directory. Release mode still enforces the full 30 minutes and 50 users.
