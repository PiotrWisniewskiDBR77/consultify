# E2a-bis — independent skeptical review

**ACCEPT.** The rebased E2a-bis package is a bounded decision packet plus a
localized licence notice; it does not implement the 25 DRD title proposals or
change J3-owned methodology content.

## Identity and scope

- W54 and W59 define the 25-title decision packet. W60/W61 transfer content
  implementation to CTO J3. The retained artifact says this explicitly.
- Exact review base: `7ecfcf007bca01a64d350464edd85f53d7bc197e`.
- Product commit after the mechanical W62 rebase:
  `8f55b91d8b72391e63c90f40e1920696615ecead`.
- The product diff contains exactly five files: the decision artifact, the
  frontend compiler and its locale test, and the server registry mirror and
  its test. It contains no migration.
- Diff against the exact base is empty for `drdStructure.ts`,
  `drdMatrixCellContent.ts`, `EventDerivedOutputBridge.ts`,
  `MethodOutputService.ts`, and `method-core.routes.ts`.

## Findings

1. **25/25 rows match runtime.** Parsing the artifact and the exported
   `DRD_STRUCTURE` found 25 Polish titles, 11 on axis 5 and 14 on axis 6. Every
   artifact row matched axis, unit, level and current title; there were no
   missing or extra rows.
2. **J3/content is untouched.** The package changes 0 titles and 0
   descriptions. Its artifact is headed “CONTENT IMPLEMENTATION SUPERSEDED BY
   CTO J3; OWNER DECISION ARTIFACT RETAINED.”
3. **Licence locale mirrors agree.** `compileDrdPack('en')` and
   `compileDrdPack('pl')` return the exact EN and PL notices. The exported
   frontend and server notice maps are byte-equal, and the server's `KEEP IN
   SYNC` contract covers `manifest.name/licence`.
4. **Licence does not alter methodology/output content.** Against the exact
   base, serialized EN and PL compile results are byte-equal after removing
   `pack.manifest.licence`. Their SHA-256 values are respectively
   `da5365cd72cc98c8de2e855f8cae0df9ed2c7d19f280d92484cf2484ea4815b7`
   and `a5e149828ac258a10046d541ac865e7d9e04f5b412e434acb2de25c955cb2bed`.
   The frontend and server output hash builders consume output content and do
   not consume the method-pack licence.

## Verification

- Focused locale/registry tests: 15/15 (`--retry=0`).
- Compiler structure sibling: 10/10. Output/hash siblings: 28/28.
- Server TypeScript: exit 0, 0 errors on the rebased commit.
- Frontend TypeScript before the W62 mechanical rebase: 177 inherited errors,
  0 references to changed files. Two full reruns after rebase exceeded the
  mandatory 120-second command ceiling; neither produced a contradictory
  diagnostic. Changed implementation files bundle independently, and focused
  TypeScript-bearing tests pass.
- K4/K5 after rebase: K4 PL 22, K4 EN 871, K5 PL 256, K5 EN 1822, equal to the
  package's recorded before/after values.
- esbuild: 2/2 changed implementation files bundle successfully.
- `git diff --check`: clean. Migration scan: none.

The frontend full-scan timeout is recorded as an infrastructure-duration
limitation, not concealed as a green rerun. It does not identify a package
defect: the pre-rebase scan measured the required 177/0 result, the rebase was
conflict-free, the five-file product diff stayed identical in scope, and all
changed-code gates are green.
