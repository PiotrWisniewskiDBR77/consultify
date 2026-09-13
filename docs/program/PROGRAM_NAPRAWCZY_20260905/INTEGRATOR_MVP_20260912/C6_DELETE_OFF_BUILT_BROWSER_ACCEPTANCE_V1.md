# C6 DELETE approved-out: actual built UI acceptance

Status: **bounded PASS** for the OrganizationsView deletion-control correction. Full C6/E4 export and deletion readiness remains open.

## Exact candidate

- Browser run started while the integrated checkout HEAD was `1395964f6540ba554aa0f073be6bea42f6a02119`; root committed the already-built, byte-identical source afterward as `c65f430a6064f582bfd22d394821a2bd66f47450`.
- `OrganizationsView.tsx`: `2c357dd688f584b61fd17ccf07b867c16af6e7451d2b9e89eaed2a5b05a1a55e`
- focused test: `f78e8ac0e453c6d127dda26a533bdf5c62117e1c455a0be721196ab194a111d3`
- refusal route: `5510c8543b22b1cd8055a46a2edc8d48c01090bd3ea72770cba485271a7de41d`
- corrected dist `index.html`: `efb170c64f784f7f95454327e9d67d74dc27723cd7e75835b1c5470e0378a907`
- previous RED dist `index.html`: `1ce32e2b9e3fb4e89d2d2d254a13be6eb03761df57d89f8d39f3d2ff9c8eb408`

## Actual behavior

The old built StandardTable menu visibly rendered a disabled `Delete` item. The immutable RED evidence is `ui-red-v1/menu-open.png` and `menu-open.txt`. That run later ended as an instrument failure because Playwright exposed an empty `response.body()` for a browser download even though the export GET returned 200 and the downloaded JSON was 13,052 bytes. Both files and the failed result are preserved.

The corrected built view completed `GREEN` in `ui-green-v2/result.json`:

- real StandardTable and target fixture row visible;
- exact approved-out policy message visible;
- inline Delete controls: 0; row-menu Delete controls: 0; browser dialogs/prompts: 0;
- menu still exposes `Export Data`; actual Gateway GET returned 200, response Content-Length and downloaded file are both 13,052 bytes;
- downloaded JSON parsed to exact target organization `9a557579-6e26-488b-ae8f-4f3c30cef691`;
- security manifest is `tenant-export-contract-v9-20260912`, `complete=false`, `truncated=false`, with 90 unresolved tables;
- no page errors. `/api/system-health` returned an unrelated 404 and is retained in raw events.

The instrument now treats an empty Playwright `response.body()` transparently: it requires HTTP 200, nonempty downloaded JSON, exact target ID, the expected security-manifest version, and records response Content-Length. It does not claim byte equality when Chromium does not expose the response body. The first GREEN setup attempt never launched a browser because the harness referenced a wrong route-hash path; its immutable setup-failure receipt is preserved, and `green-v2` is the executed run.

## Runtime and cleanup

- exact existing PostgreSQL container: `4787ced942d4b28650a212dc1b13da82ecc3640d924b155be2a38713b18ef64c`, `127.0.0.1:6457/cx6_export_contract`;
- actual API 4216 and preview 5216; persisted SUPERADMIN signed JWT; test-auth bypass false;
- disposable fixture before cleanup: 2 organizations, 3 users, 3 memberships, one retention policy (`365`, `legal_hold_enabled=0`);
- readback after browser execution matched those counts and policy;
- scoped cleanup readback: organizations 0, users 0, memberships 0, policy 0; private token state removed;
- owned PIDs 88673/88674/88720 are gone; ports 4216 and 5216 are free.

No deletion request was issued. This proves the UI no longer advertises an unavailable destructive action and that export remains reachable. It does not prove full E4 deletion readiness; the export itself truthfully remains partial per its security manifest.

## Evidence

Raw evidence is under `/Users/piotrwisniewski/Developer/codex-wt/codex6-scratch/C6_DELETE_OFF_BUILT`. The companion manifest contains exact hashes for 30 source, launcher, fixture, RED, GREEN, and cleanup artifacts.
