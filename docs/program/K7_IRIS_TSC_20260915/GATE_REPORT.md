# K7 package 1 — gate report

Base: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`  
Branch: `codex/b-k7-iris-tsc-20260915`

| Gate | Result | Evidence |
|---|---|---|
| Front TSC baseline | RC 2, 177 errors / 54 files | `tsc-before-incremental.log`, `tsc-before-by-file.tsv` |
| Front TSC candidate | RC 2, 153 errors / 37 files | `tsc-after-package1.log`, `tsc-after-by-file.tsv` |
| Delta | exactly -24; no test-file TSC errors remain | before/after TSV |
| Server build / TSC | RC 0 | `server-build.log` plus recorded process exit 0 |
| Front build | green with `NODE_OPTIONS=--max-old-space-size=8192`; Vite built 10,754 modules in 33.93 s | `front-build.log` |
| First front build attempt | OOM/Abort trap without 8 GB; superseded by required 8 GB run | retained in final successful log context only as disclosed here |
| List canon | RC 0, 349 / baseline 349 | `list-canon.log` |
| Artifact canon | RC 0, 8 / 0 / 117 | `artefakt.log` |
| Language ratchet | RC 0 | `language.log` |
| Changed-test runtime, candidate | 15/17 files pass; 117/124 assertions pass; 7 fail + 2 async errors | `tests-package1.log` |
| Changed-test runtime, exact base worktree | identical: 15/17 files, 117/124 assertions, 7 fail + 2 async errors | `tests-package1-exact-base-worktree.log` |
| Product importers | none: delta contains only 17 leaf test files | `git diff --name-only` in manifest |
| New `as any` | 0 | zero-match diff scan |
| Forbidden files/workflow | 0 changed | exact diff manifest |
| Screenshots | not applicable: product/UI bytes are unchanged; screenshots cannot exercise type-only test fixture edits | exact diff manifest |

The runtime comparison ran from a separate detached worktree at exact base, then that worktree was removed. No test assertion was deleted or weakened. The two red files and their counts are retained in both logs.
