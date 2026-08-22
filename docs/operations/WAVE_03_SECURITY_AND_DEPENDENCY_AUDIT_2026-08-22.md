# Wave 3 security and dependency audit — 2026-08-22

Status: `AUDITED / REMEDIATION_REQUIRED / NO_AUTOMATIC_MAJOR_UPGRADES`

Candidate SHA at audit start: `e2acc9b4c0d104f708ac30f66d79b5481de3d435`

## Controls completed

- Every product checkpoint created during recovery was scanned with staged
  `gitleaks`; the scans reported zero secrets.
- Repository connectivity passed `git fsck --connectivity-only`; no missing or
  corrupt objects were reported. Dangling objects remain intentionally
  untouched, so no garbage collection or pruning is authorized.
- Two dirty auxiliary worktrees were archived with SHA-256 manifests before
  reconciliation. Neither was reset, stashed, deleted or overwritten.
- The exact-current full-lineage PostgreSQL fixture finished with zero disabled
  triggers and zero advisory locks. Only the canonical `system` organization
  and `system` user remained; projects, assessments, initiatives and audit logs
  were zero. The owned disposable container was removed and its port released.
- Railway demo application and database remain frozen. No restart, redeploy,
  variable update, role mutation or production action was performed.

## Production dependency audit

Command: `npm audit --omit=dev --json`

Result: `11` findings — `0 critical`, `2 high`, `7 moderate`, `2 low`.

The two high findings are the `image-size` denial-of-service advisories inherited
through direct dependency `pptxgenjs`. The audit tool proposes a semver-major
change and reports an unexpected target version, so an unattended lockfile
rewrite is not safe. The moderate findings include transitive `uuid` exposure
through document/cloud packages and a direct `postcss` advisory. Low findings
include `body-parser` and a Windows development-server-only `esbuild` issue.

## Required remediation gate

Dependency remediation must run as a separate bounded package-change candidate:

1. resolve the currently supported `pptxgenjs` line and prove image parsing with
   hostile ICNS/JXL/HEIF fixtures or disable unsupported parsers at ingress;
2. upgrade compatible patch/minor dependencies first, then review unavoidable
   major changes one package at a time;
3. run document/PPTX/XLSX generation tests, upload limits, backend and frontend
   builds, type checks, gitleaks and the full affected module suites;
4. do not deploy from the dependency candidate without a separately frozen SHA
   and explicit release authorization.

This audit does not claim the findings are exploitable in the deployed product;
it records unresolved supply-chain risk and prevents an unsafe bulk `npm audit
fix --force` operation.
