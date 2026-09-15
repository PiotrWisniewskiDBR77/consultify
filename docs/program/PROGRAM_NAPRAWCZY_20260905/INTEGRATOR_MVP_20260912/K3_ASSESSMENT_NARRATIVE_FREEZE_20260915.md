# K3 — Assessment narrative locale freeze

**READY_FOR_CODEX_REVIEW.** Content commit `b827e65fee` implements W73 K3 on exact base `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`; no migration and no data transformation were introduced.

## Behavioral delta

- The report contract passes its resolved `en` or `pl` locale through programme, chapter, and area narrative composition.
- Generator-owned phrases and grammar live in the EN/PL dictionary in `assessmentReportI18n.ts`; finding values remain verbatim.
- Exact-base measurement on the controlled finding fixture: 8 of 9 narrative families contained Polish diacritics. The ninth, the chapter matrix caption, was already English after G1. Candidate measurement: 0 of 9.
- Candidate DOCX, PPTX, and PDF text layers contain 0 Polish diacritics for the all-English finding fixture.
- PL compatibility snapshot: 26 generated blocks, SHA-256 `dd2ed604dc34e2ae3b9f2c78646e00506ba2dcfdba90e061a641f918ad762074` on both exact base and candidate.

## Verification

- K3/G1: 12/12 passed on candidate; the same acceptance test is RED 3/12 on exact base and lists all eight contaminated narrative families. The PL snapshot passes on both revisions.
- Importers, each with `--retry=0`: Day 50 12/12, no-gap 4/4, S1.4b 12/12, legacy engine 8/8. Exact base and candidate are both green: 36/36.
- `npm run type-check:server`: exit 0.
- `npm run check:jezyk:ci`: exit 0; ratchet reports K4en -68 and K7 -1.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build`: exit 0, without a shell pipe.
- New `as any`: 0. Changed runtime/test files: 4. Migrations: 0.

Raw logs are stored under `evidence/k3-assessment-narrative/logs/` and are content-addressed by the companion manifest. The repository font binaries are not required by the language assertion: the PDF test uses PDFKit standard fonts while executing the real deck PDF renderer and extracting its text layer.

## Review boundary

Review exact content commit `b827e65fee` and the subsequent freeze commit against exact base `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`. The package does not modify `DrdHttpMethodWorkspaceScreen.tsx`, `languagePolicy.ts`, `Dockerfile.api`, database schema, or stored finding content.
