# D-2 pilot retest — W62 refreeze

**VERDICT: ACCEPT FOR THE REPORT.** After the mechanical rebase onto `7ecfcf007b`, the package still records P-T19 as **PASS_LOCAL**, P-P11 as **PARTIAL**, and P-T13 as **STOP_OWNER_DECISION**; no product behavior, test, or migration was changed.

## Identity and equivalence

- Original base: `4de31efbcb0c286cdcbdb0251b10a894db02848d`.
- Original reviewed SHA: `5d70c2468b7b6bbb804be65fb171ce72384afc30`.
- Required W62 base: `7ecfcf007b`.
- Rebased delivery: `a380c4180e4135277a2ad26f10fe4bc311e95ddc`.
- Rebased independent review: `0f2c640781f3aabb508199d6ba85253512ddb4e5`.
- `git range-diff`: 2/2 commits map as identical.
- Stable aggregate patch-id before and after rebase: `3fb2d21f83a113e6328f5f1c682cd7fe0cdd609e`.
- Name-status delta before and after rebase: identical.

## Preserved verdicts

- **P-T19 PASS_LOCAL:** the retained RealPG/API/browser receipt proves registration of a fresh organization, 9/9 enabled V8 flags, interview API 200, Assessment API 200, and no V8-unavailable banner. This remains local evidence, not staging evidence.
- **P-P11 PARTIAL:** five measured areas remain green; the mounted same-organization Library/cold-reopen and offline retry suite remains 0/2. The rebase does not claim those defects are fixed.
- **P-T13 STOP_OWNER_DECISION:** existing Mind Map context wiring remains evidenced, while the product decision about a role-, organization-, and flag-filtered canonical navigation manifest remains open. No Teresa product semantics were added.

## W62 evidence maintenance

- `evidence/a-d2-pilot/W62_REFREEZE_RECEIPT.json` inventories the retained evidence with SHA-256 hashes and records the rebase equivalence.
- The unrelated evidence-only phantom `VITE_INITIATIVES_PLAN_ANALYSIS` in `evidence/f2-p2-plan/e1/VERIFICATION.md` was corrected to the real server flag `ENABLE_INITIATIVES_PLAN`, verified against `server/src/config/initiativesPlanFlag.ts`.
- The branch delta from `7ecfcf007b` contains report/evidence only: zero product source, test, migration, or J3 files.
