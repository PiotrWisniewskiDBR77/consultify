# RECEIPT — TPL-1a W185 v2

- base: `3960d78feca391785e992cce5449d70854e5b5aa`
- branch: `codex/b-tpl1a-v2-w185-20260917`
- scope: Template Library card actions and canonical builder routing only
- lock-ci: `/Users/piotrwisniewski/Developer/codex-lock-ci/b-tpl1a-v2-w185-20260917`
- install: `npm ci --ignore-scripts` from repository `package-lock.json`
- `npm ls @types/node --depth=0`: `@types/node@22.19.3`

## Verification

| Gate | Line | Candidate | Result |
|---|---:|---:|---|
| frontend `tsc --noEmit --pretty false` | 152, RC=2 | 152, RC=2 | diagnostic sets identical |
| server `tsc -p server/tsconfig.json --noEmit --pretty false` | — | 0, RC=0 | PASS from lock-ci |
| focused behavior + adapter + accepted XLSX snapshot | — | 46/46 | PASS |
| ESLint changed TS/TSX | — | 0 errors, RC=0 | PASS |
| `git diff --check` | — | RC=0 | PASS |

The first frontend attempt without an explicit heap limit ended `RC=134` with an empty output and was discarded as **no measurement**. The recorded line/candidate results above are complete runs with `NODE_OPTIONS=--max-old-space-size=8192`; both ended `RC=2` and emitted 152 diagnostics.

## Mutation proof

Mutation: `TemplatesGalleryView` system-card Build / Edit guard changed from `disabled={item.scope === 'system'}` to `disabled={false}`.

- mutated: `TemplatesGalleryView.tpl1a.test.tsx` → 1 failed / 1 passed, RC=1;
- restored: 2/2 PASS;
- evidence: `evidence/mutation-system-readonly.txt`, `evidence/mutation-system-readonly.exit-code.txt`.

## Evidence files

- `evidence/front-tsc-line.txt`
- `evidence/front-tsc-candidate.txt`
- `evidence/front-tsc-diff.txt` (empty)
- `evidence/server-tsc-lock-ci.txt`
- `evidence/npm-ls-types-node.txt`
- `evidence/tests-final.txt`
- `evidence/eslint.txt`
- `evidence/template-library-card-actions-light.png` (`e5be81e09b3ebe8d193ef95c0354c2cd49b406a299cf75ceca8371b9511349ec`)
- `evidence/template-library-system-readonly-dark.png` (`c71ffdfc1d03725330b6d99ebcb28574e4b0d9f5436808369023a93975f57919`)
