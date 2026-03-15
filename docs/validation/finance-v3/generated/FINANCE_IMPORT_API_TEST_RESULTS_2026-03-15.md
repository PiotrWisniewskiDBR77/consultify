# Finance Import API Test Report

- API URL: `http://127.0.0.1:3001`
- Statements attempted: 33
- Ready after values: 1
- Recoverable after values: 3
- Rejected after values: 0
- Hard failures: 29

| Document | Type | Eligible | Mapped | Coverage | Readiness | Confirmed | Error |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| Apator SA Raport R 2024 | BS | 33 | 33 | 100% | ready | yes | — |
| Apator SA Raport R 2024 | P&L | 14 | 14 | 100% | recoverable | no | — |
| Apator SA Raport R 2024 | CF | 28 | 28 | 100% | recoverable | no | — |
| Grupa Apator Raport RS 2023 | BS | 42 | 42 | 100% | recoverable | no | — |
| Grupa Apator Raport RS 2023 | P&L | 0 | 0 | 0% | n/a | no | fetch failed |
| Grupa Apator Raport RS 2023 | CF | 0 | 0 | 0% | n/a | no | fetch failed |
| Grupa Apator Raport RS 2024 | BS | 0 | 0 | 0% | n/a | no | fetch failed |
| Grupa Apator Raport RS 2024 | P&L | 0 | 0 | 0% | n/a | no | fetch failed |
| Grupa Apator Raport RS 2024 | CF | 0 | 0 | 0% | n/a | no | fetch failed |
| Raport skonsolidowany Apator | BS | 0 | 0 | 0% | n/a | no | fetch failed |
| Raport skonsolidowany Apator | P&L | 0 | 0 | 0% | n/a | no | fetch failed |
| Raport skonsolidowany Apator | CF | 0 | 0 | 0% | n/a | no | fetch failed |
| BMW Group Financial Statements 2024 | BS | 0 | 0 | 0% | n/a | no | fetch failed |
| BMW Group Financial Statements 2024 | P&L | 0 | 0 | 0% | n/a | no | fetch failed |
| BMW Group Financial Statements 2024 | CF | 0 | 0 | 0% | n/a | no | fetch failed |
| KGHM SRR 2024 | BS | 0 | 0 | 0% | n/a | no | fetch failed |
| KGHM SRR 2024 | P&L | 0 | 0 | 0% | n/a | no | fetch failed |
| KGHM SRR 2024 | CF | 0 | 0 | 0% | n/a | no | fetch failed |
| bp Annual Report 2025 | BS | 0 | 0 | 0% | n/a | no | fetch failed |
| bp Annual Report 2025 | P&L | 0 | 0 | 0% | n/a | no | fetch failed |
| bp Annual Report 2025 | CF | 0 | 0 | 0% | n/a | no | fetch failed |
| Coca-Cola 10-K 2025 | BS | 0 | 0 | 0% | n/a | no | fetch failed |
| Coca-Cola 10-K 2025 | P&L | 0 | 0 | 0% | n/a | no | fetch failed |
| Coca-Cola 10-K 2025 | CF | 0 | 0 | 0% | n/a | no | fetch failed |
| Tesla 10-K 2024 | BS | 0 | 0 | 0% | n/a | no | fetch failed |
| Tesla 10-K 2024 | P&L | 0 | 0 | 0% | n/a | no | fetch failed |
| Tesla 10-K 2024 | CF | 0 | 0 | 0% | n/a | no | fetch failed |
| BDG 2026 V1 XLSX | BS | 0 | 0 | 0% | n/a | no | fetch failed |
| BDG 2026 V1 XLSX | P&L | 0 | 0 | 0% | n/a | no | fetch failed |
| BDG 2026 V1 XLSX | CF | 0 | 0 | 0% | n/a | no | fetch failed |
| BDG 2026 V1 XLS | BS | 0 | 0 | 0% | n/a | no | fetch failed |
| BDG 2026 V1 XLS | P&L | 0 | 0 | 0% | n/a | no | fetch failed |
| BDG 2026 V1 XLS | CF | 0 | 0 | 0% | n/a | no | fetch failed |

## Apator SA Raport R 2024

- File: `knowledge/Finanse/Apator SA Raport R 2024.pdf`

### BS

- Statement ID: `9002b0bc-bbc3-4d1c-944d-de95245d3316`
- Document class: `mixed_report`
- Extraction strategy: `local_parser`
- Selected period: `2024`
- Comparison period: `n/a`
- Extracted lines: 33
- Eligible lines: 33
- Mapped lines: 33
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation codes: `BS_EQUATION_OK`
- Top unmapped labels: none
- Error: none

### P&L

- Statement ID: `be07ef13-b19e-4fc0-b3e8-70af5f8e99be`
- Document class: `mixed_report`
- Extraction strategy: `local_parser`
- Selected period: `2024`
- Comparison period: `n/a`
- Extracted lines: 15
- Eligible lines: 14
- Mapped lines: 14
- Coverage: 100%
- Readiness: `recoverable` (77)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `REQUIRED_LINES_MISSING`
- Top unmapped labels: none
- Error: none

### CF

- Statement ID: `a5ac3c18-01a9-4c3c-9db3-57eeb9774777`
- Document class: `mixed_report`
- Extraction strategy: `local_parser`
- Selected period: `2024`
- Comparison period: `n/a`
- Extracted lines: 29
- Eligible lines: 28
- Mapped lines: 28
- Coverage: 100%
- Readiness: `recoverable` (89)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `REQUIRED_LINES_MISSING`
- Top unmapped labels: none
- Error: none

## Grupa Apator Raport RS 2023

- File: `knowledge/Finanse/Grupa Apator Raport RS 2023.pdf`

### BS

- Statement ID: `e18adf5c-4f08-4c1f-8a96-5bf84397d36b`
- Document class: `mixed_report`
- Extraction strategy: `local_parser`
- Selected period: `2023`
- Comparison period: `n/a`
- Extracted lines: 42
- Eligible lines: 42
- Mapped lines: 42
- Coverage: 100%
- Readiness: `recoverable` (89)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `BS_EQUATION_OK`, `REQUIRED_LINES_MISSING`
- Top unmapped labels: none
- Error: none

### P&L

- Statement ID: `ff2c3841-2bdc-41f9-ba65-e6ea904f608c`
- Document class: `mixed_report`
- Extraction strategy: `n/a`
- Selected period: `2023`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### CF

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

## Grupa Apator Raport RS 2024

- File: `knowledge/Finanse/Grupa Apator Raport RS 2024.pdf`

### BS

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### P&L

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### CF

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

## Raport skonsolidowany Apator

- File: `knowledge/Finanse/Raport-skonsolidowany-Apator.pdf`

### BS

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### P&L

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### CF

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

## BMW Group Financial Statements 2024

- File: `knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf`

### BS

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### P&L

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### CF

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

## KGHM SRR 2024

- File: `knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf`

### BS

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### P&L

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### CF

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

## bp Annual Report 2025

- File: `knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf`

### BS

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### P&L

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### CF

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

## Coca-Cola 10-K 2025

- File: `knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf`

### BS

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### P&L

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### CF

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

## Tesla 10-K 2024

- File: `knowledge/Finanse/Samples/tsla-20241231-gen.pdf`

### BS

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### P&L

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### CF

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

## BDG 2026 V1 XLSX

- File: `knowledge/Finanse/BDG 2026 V1.xlsx`

### BS

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### P&L

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### CF

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

## BDG 2026 V1 XLS

- File: `knowledge/Finanse/BDG 2026 V1 old.xls`

### BS

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### P&L

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### CF

- Statement ID: `n/a`
- Document class: `n/a`
- Extraction strategy: `n/a`
- Selected period: `n/a`
- Comparison period: `n/a`
- Extracted lines: 0
- Eligible lines: 0
- Mapped lines: 0
- Coverage: 0%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed
