# W103 — INTERVIEW-SHELL U05-1 fix

**READY FOR CTO REVIEW.** The respondent primary action resolves to shipped EN/PL copy, the editable respondent state is covered by the real workspace harness, and Save remains visible and functional in the footer.

## Fixes

- Added `interview.workspace.submitForReview` in EN and PL and a contract test that fails when the primary respondent labels are absent.
- Added `respondent-draft` to the real `InterviewWorkspace` dev-render harness with respondent identity and review access disabled.
- Kept `Submit for review` as the lifecycle primary while `Save & Exit` and the saved-state footer remain visible.
- Changed the empty AI quality-review action from `Refresh` to `Run`; an existing evaluation still uses `Refresh`.
- Replaced the Interview Hub content wrapper's clipping overflow with vertical scrolling.

## Evidence

- Base: `ffc14dab59` (DRD-2 accepted line).
- Targeted importers: 3 files, 32/32 tests passed, `--retry=0`.
- TypeScript with the same current `node_modules`: base 0 / candidate 0; server candidate 0. W103's earlier line receipt remains 169 / 0 under the CTO measurement environment.
- Esbuild: InterviewWorkspace, InterviewHub and U05 harness passed.
- Browser URL: `http://127.0.0.1:4214/?screen=u05-sesja-wywiadu-powloka&wariant=respondent-draft&lang=en&theme=light`.
- Screenshot: `evidence/interview-shell-u05-1-fix/respondent-draft-en-light-1440x900.png` (169 KB).
- Browser assertions: one `Submit for review`, at least one `Save & Exit`, raw translation key absent.

No migration, staging write, deployment, Railway change, or protected-branch push was performed.
