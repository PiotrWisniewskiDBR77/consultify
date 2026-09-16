# KPI-1 / U-41 — delivery evidence

**Verdict: READY FOR CTO REVIEW, with one explicit PARTIAL.** Implementation and local behavior proof are complete on line `cbad80887c`. Existing Process / Response policy values stored as opaque IDs cannot be resolved because the product has no registry/read contract for either field.

## Scope delivered

- Added default-OFF `VITE_RESULTS_VNEXT_KPI_USABILITY_U41` with review overrides and Docker ARG parity.
- Removed the duplicate internal `KPI registry › …` breadcrumb when ON.
- Removed the technical corrective-actions `DESIGN NOTE` from UI and retained the limitation in `console.info`.
- Replaced case and initiative IDs with business labels. Runtime and legacy initiative reads merge into one selector.
- Both registry failures render explicit messages with Retry; a successful empty pair renders `No initiatives available`.
- Replaced free-text `Initiative id` with a registry-backed selector.
- Shows complete stored Process / Response policy labels instead of shortened values.
- Kept Suspend neutral and suspended status non-critical under the flag.
- OFF parity is behavior-tested for all five UI changes. No migration or server contract change.

## Focused behavior

```text
2 files passed
24/24 tests passed
retry=0
```

The tests cover both registry error/Retry paths, empty state, names and selector, no duplicate breadcrumb/banner, full Process/Response labels, neutral Suspend, and OFF parity.

## Importer family — raw comparative receipt

The exact 17-file input is in `importer-files.txt`. Unedited outputs are in `importer-base.raw.log` and `importer-candidate.raw.log`.

| Measurement | Line `cbad80887c` | Candidate | Delta |
|---|---:|---:|---:|
| Test files failed / passed | 10 / 7 | 9 / 8 | 1 fewer failed |
| Tests failed / passed | 27 / 100 | 22 / 110 | 5 fewer failed, 10 more passed |
| Unhandled errors | 14 | 9 | 5 fewer |
| Normalized failing names | 26 | 21 | 5 resolved, **0 new** |

The deterministic name sets and comparison are stored in `importer-failing-names-base.txt`, `importer-failing-names-candidate.txt`, and `importer-comparison.txt`.

## TypeScript and guards

| Check | Line `cbad80887c` | Candidate |
|---|---:|---:|
| Full frontend `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check` | 152 errors | 152 errors |
| Unique frontend diagnostics | 152 | 152 |
| Full server `npm run type-check:server` | — | 0 errors |

Both full frontend runs completed without a time limit; neither timed out. The actual local dependency graph produced 152/152 rather than the channel's expected 169 baseline. Raw logs are frozen as `tsc-base.raw.log`, `tsc-candidate.raw.log`, and `tsc-server-candidate.raw.log`.

- Docker flag guard: `analyzedFlags=195 dockerArgs=206 wyjatki=13 brakujace=0`.
- Esbuild passed for the page and browser fixture.
- `git diff --check` passed.
- Local dependencies were restored with `npm ci --offline --ignore-scripts`; no cross-worktree symlink remains.

## Browser and contrast proof

English light and dark screenshots render the real component in Actions. Raw i18n keys and the technical banner are absent. The panel shows named case, initiative, Process, and Response policy values.

- light SHA-256: `36e0637fc1e9cdb108a0c683466149bc1549c9b8f01b31075b524c46aff39a38`
- dark SHA-256: `14cb22100c02dda06df93fc17b00f84855f325ed73d290adf90c701fda6b3a02`

`contrast-check.mjs` measured computed foreground/background colors in both themes for Suspend, initiative select, suspended status, registry error, and Retry. Threshold: 4.5:1; measured minimum: **6.34:1**, PASS. Full values are in `contrast-results.json`.

## Explicit PARTIAL

`primaryProcessId` and `responsePolicyId` are free-form strings with no registry/table or name-join endpoint. Complete stored labels render correctly. Already-stored opaque IDs cannot be translated without a separately authorized backend contract; no names are invented.

## Delivery

Decision marker: `[ODMROZENIE 09_RESULTS DEC-574]`. Review owner: CTO. No deploy, staging write, Railway change, or migration was performed.
