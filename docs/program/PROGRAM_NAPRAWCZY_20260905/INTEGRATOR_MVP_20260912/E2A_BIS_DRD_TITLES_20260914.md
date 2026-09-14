# E2a-bis — DRD axes 5–6 level-title decision packet

**Verdict: OWNER DECISION REQUIRED.** The runtime contains exactly 25 Polish
level titles in an English DRD compile, all on axes 5 and 6. This package does
not modify those titles or their descriptions. It only proposes English titles
for the DRD methodology owner to accept, revise, or reject.

## Measured scope

- Exact base: `a2b0a0fe32f2a3f137d919ad81248b9da0f54edd`.
- Source: `src/services/drdStructure.ts`, measured through the exported
  `DRD_STRUCTURE` runtime object.
- Detector: Polish diacritics in `levels[].title`, matching the existing
  `compileDrdPack.language.test.ts` content-gap contract.
- Result: 25 titles; axis 5 = 11, axis 6 = 14; every affected unit belongs to
  axis 5 or 6.
- Contractual content changed in this package: **0 titles, 0 descriptions**.

## Titles proposed for owner approval

| # | Axis | Unit | Level | Current canonical title (PL) | Proposed title (EN) |
|---:|---:|---|---:|---|---|
| 1 | 5 | 5A Leadership Attitudes | 4 | Wspierający | Supportive Leadership |
| 2 | 5 | 5B Readiness for Change | 5 | Wdrażanie zmiany | Change Implementation |
| 3 | 5 | 5C Continuous Competency Development | 1 | Kontakt zewnętrzny | External Exposure |
| 4 | 5 | 5C Continuous Competency Development | 2 | Szkolenia wewnętrzne | Internal Training |
| 5 | 5 | 5C Continuous Competency Development | 3 | Szkolenia zewnętrzne | External Training |
| 6 | 5 | 5C Continuous Competency Development | 5 | Zespoły projektowe | Project Teams |
| 7 | 5 | 5D Innovation Culture | 1 | Promowanie pomysłów | Idea Promotion |
| 8 | 5 | 5D Innovation Culture | 3 | Analiza trendów | Trend Analysis |
| 9 | 5 | 5D Innovation Culture | 4 | Akceptacja błędów | Acceptance of Failure |
| 10 | 5 | 5D Innovation Culture | 6 | Współpraca zewnętrzna | External Collaboration |
| 11 | 5 | 5E Resource Availability | 1 | Kapitał | Capital |
| 12 | 6 | 6A Strategy and Risk Management | 3 | Plan działań | Action Plan |
| 13 | 6 | 6A Strategy and Risk Management | 4 | Polityki bezpieczeństwa | Security Policies |
| 14 | 6 | 6B Network and System Protection | 4 | SIEM/IDS korelujące | Correlating SIEM/IDS |
| 15 | 6 | 6C Data Security | 2 | Polityka haseł | Password Policy |
| 16 | 6 | 6C Data Security | 3 | Kontrola dostępu | Access Control |
| 17 | 6 | 6C Data Security | 6 | Weryfikacja tożsamości | Identity Verification |
| 18 | 6 | 6D Security Education and System Quality | 1 | Opis systemu szkoleń | Training System Description |
| 19 | 6 | 6D Security Education and System Quality | 2 | Plan wdrożenia szkoleń | Training Implementation Plan |
| 20 | 6 | 6D Security Education and System Quality | 3 | System testów | Security Testing System |
| 21 | 6 | 6D Security Education and System Quality | 4 | Audytorzy wewnętrzni | Internal Auditors |
| 22 | 6 | 6D Security Education and System Quality | 5 | Plan audytów cyber | Cybersecurity Audit Plan |
| 23 | 6 | 6E Contingency Plans | 1 | Identyfikacja zagrożeń | Threat Identification |
| 24 | 6 | 6E Contingency Plans | 3 | Procedury postępowania | Response Procedures |
| 25 | 6 | 6E Contingency Plans | 5 | Testy planów | Contingency Plan Testing |

The proposals follow each title's existing Polish description. They do not
translate or reinterpret the description. In particular, `Kontakt zewnętrzny`
means participation in trade fairs and conferences, hence “External Exposure”;
`System testów` is explicitly about security testing; and `Testy planów` is
scenario-based contingency-plan testing.

## Required owner decision

For each row, choose **ACCEPT**, **REVISE** (supply the final English title), or
**REJECT**. A single “accept all 25” decision is sufficient if every proposal is
approved. Only after that decision may implementation add a language-specific
title field or otherwise change the methodology content. Descriptions remain a
separate content decision because the existing discrepancy also reports Polish
descriptions in the English compile.

## Licence notice correction

The licence notice is product/provenance chrome rather than a level title,
description, question, scoring fixture, or output payload. The package therefore
localizes it without waiting for methodology-content approval:

- the frontend compiler returns an English notice for `compileDrdPack('en')`
  and the unchanged Polish notice for `compileDrdPack('pl')`;
- the server identity mirror stores the DEC-461 English default in `notice` and
  both exact variants in `notices.en` / `notices.pl` for locale-aware readers;
- existing registered rows are not rewritten; there is no migration, data
  update, backfill, or output-hash mutation.

Hash boundary measurement: method output hashes are built in
`src/method-core/outputs/assessmentOutput.ts` and
`server/src/method-core/outputs/MethodOutputService.ts` from output content.
Neither path consumes `manifest.licence`. Repository search found no
`manifest.licence.notice` consumer in a hash builder. The content-hash STOP does
not apply to this provenance-chrome correction.

## Evidence and freeze gate

- RED: frontend locale test 8 passed / 1 failed because EN received the Polish
  notice; server registry test 5 passed / 1 failed because the bilingual mirror
  was absent.
- GREEN: frontend locale test 9/9; server registry test 6/6, both with
  `--retry=0`.
- Existing content-gap assertion remains green and still pins exactly 25 Polish
  titles on axes 5–6.
- K4/K5 full scan: K4 PL 22→22, K4 EN 871→871, K5 PL 256→256,
  K5 EN 1822→1822.
- TypeScript and final SHA: completed at freeze; reported in the final section
  added immediately before commit.

