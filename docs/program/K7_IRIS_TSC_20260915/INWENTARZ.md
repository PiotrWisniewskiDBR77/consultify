# K7 — IRIS 6.0 / front TSC inventory

## Verdict

Package 1 pays down exactly 24 of 177 existing frontend TypeScript errors. The candidate has 153 errors in 37 files; the exact base has 177 errors in 54 files.

## Workflow measurement

`.github/workflows/test-suite.yml` is the IRIS 6.0 workflow. Its `lint-typecheck` job runs `npm run type-check` directly. There is no numeric threshold to lower. The workflow file is byte-identical to base `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`. Adding threshold logic requires the STOP/decision named in W73, so this E1 candidate does not modify the workflow.

## Full baseline grouping

The reproducible machine-readable list is `evidence/k7-iris-tsc-20260915/tsc-before-by-file.tsv`. Largest groups:

| Errors | File |
|---:|---|
| 27 | `src/components/ReportBuilder/useReportBuilder.ts` |
| 23 | `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` |
| 11 | `src/hooks/useReportSections.ts` |
| 10 | `src/components/Economics/FinanceHub.tsx` |
| 10 | `src/components/Initiatives/InitiativeDocumentView.tsx` |
| 9 | `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` |
| 9 | `src/components/Presentations/PresentationTemplateArchitectView.tsx` |
| 6 | `src/components/PMO/StatusTransitionDropdown.tsx` |
| 72 | remaining 46 files |
| **177** | **54 files** |

## Three debt packages

1. **Package 1, delivered here:** 24 errors in 17 test files. These are leaf test contracts and fixtures; no product importer is changed.
2. **Package 2:** 50 errors in two high-density files: `useReportBuilder.ts` (27) and `DocumentStudioDocumentPanel.tsx` (23). This needs its own importer and behavior review.
3. **Package 3:** remaining 103 errors in 35 product/source files, led by report sections, Finance, Initiatives, template architects and PMO.

## Interview reds retained in the queue

W74 identifies the line debt as eight failing tests across `InterviewScoringRubric`, `InterviewHub.smoke`, `InterviewPreviewFooter`, and `day119ThreeStates`. Package 1 removes only compile-time fixture errors in `InterviewHub.jedenPanel.test.tsx` and `InterviewHub.smoke.test.tsx`. It does not hide the runtime red in `InterviewHub.smoke`: the exact-base and candidate batch both report 7 failed / 117 passed assertions across the full 17-file delta set, with two async errors. This line debt remains a separate package.
