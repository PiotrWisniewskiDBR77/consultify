# npm audit remediation plan (L5 blocker)

Generated: 2026-02-15

`npm run test:l5` currently fails at the `npm audit --audit-level=high` step (via `npm run test:security`).

This is **not** a test-quality/coverage issue — it is a dependency vulnerability gate.

## How to refresh

- Run: `npm audit --audit-level=high`
- Save the output in your PR description (or attach as CI artifact).

## Current approach (honest gate with temporary allowlist)

To keep L5 usable while `sqlite3` pulls in a vulnerable `tar` chain, `npm run test:security` uses an allowlisted gate:

- Gate runner: `scripts/security/npm-audit-gate.ts`
- Allowlist: `scripts/security/npm-audit-allowlist.json`

Rule: fail CI if any **new** high/critical vulnerabilities appear outside the allowlist.

## Safe remediation sequence (minimize breakage)

1. **Non-breaking fixes first**
   - Run: `npm audit fix`
   - Re-run: `npm run test:security`

2. **Then evaluate breaking updates explicitly**
   - If audit still reports **high/critical**, identify which packages require `--force`.
   - Prefer targeted dependency bumps in `package.json` over blind `--force` if the upgrade is known to be breaking.

3. **If `--force` is unavoidable**
   - Run: `npm audit fix --force`
   - Immediately run: `npm run type-check && npm run test:unit && npm run test:security`

## Notes

- If you want L5 to block merges in CI, keep `npm audit --audit-level=high` strict.
- If you want L5 to be runnable locally even during a remediation sprint, make the audit strictness controlled by CI/env (separate decision).
