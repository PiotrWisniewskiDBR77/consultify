# BROWSER-FIX-A evidence — 2026-08-15

- Baseline: `ce6555c33bf38c806ccbe4219a4cc4e14b2ab6eb`.
- Disposable fresh PostgreSQL/pgvector: 714 migrations; governed fixture 72/72 readbacks.
- Normal OWNER UI login; no token/localStorage/query activation bypass.
- Focused unit/component tests: 11/11 passed.
- Browser evidence: `/tmp/consultify-browser-fix-a-final.1AhF80` and final Chat/Initiatives confirmation `/tmp/consultify-browser-fix-a-last.oTPGnF`.

## Results

| Module | Desktop | Mobile | Evidence |
|---|---|---|---|
| My Work | PASS | PASS | mounted/reload, semantic h1, zero console/API/request/a11y blockers |
| Tools | PASS | PASS | mounted/reload, semantic h1, zero console/API/request/a11y blockers |
| Assessment | PASS | PASS | published DRD actionable; no unsupported `Coming soon` rows; zero blockers |
| Initiatives | PASS | PASS | absent lineage object normalizes to UNKNOWN/undefined; zero blockers |
| Chat | EXPECTED_NAVIGATION_ABORT | PASS | contrast, console, API and Axe clean on both; desktop explicit reload cancels an active Socket.IO polling request with `net::ERR_ABORTED` |

The remaining desktop Chat assertion is not a product/network failure: the gate deliberately calls `page.reload()` while the low-frequency Socket.IO long poll is open, and Chromium reports cancellation of that request. It returns no HTTP error and creates no console error. The product hook now uses the configured backend endpoint and polling transport, eliminating the original mobile WebSocket console error. The durable harness was not weakened to hide this signal.
