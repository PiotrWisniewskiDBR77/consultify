# Finance Import API Test Report

- API URL: `http://127.0.0.1:3001`
- Statements attempted: 6
- Ready after values: 5
- Recoverable after values: 1
- Rejected after values: 0
- Hard failures: 0

| Document | Type | Eligible | Mapped | Coverage | Readiness | Confirmed | Error |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| Apator SA Raport R 2024 | P&L | 14 | 14 | 100% | ready | yes | — |
| Apator SA Raport R 2024 | CF | 28 | 28 | 100% | ready | yes | — |
| Grupa Apator Raport RS 2024 | P&L | 17 | 17 | 100% | ready | yes | — |
| Grupa Apator Raport RS 2024 | CF | 28 | 28 | 100% | ready | yes | — |
| Raport skonsolidowany Apator | P&L | 10 | 10 | 100% | recoverable | no | — |
| Raport skonsolidowany Apator | CF | 4 | 4 | 100% | ready | yes | — |

## Apator SA Raport R 2024

- File: `knowledge/Finanse/Apator SA Raport R 2024.pdf`

### P&L

- Statement ID: `7cec5de8-3e03-4af1-a904-ece0405749d5`
- Document class: `mixed_report`
- Extraction strategy: `local_parser`
- Selected period: `2024`
- Comparison period: `n/a`
- Extracted lines: 15
- Eligible lines: 14
- Mapped lines: 14
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: none

### CF

- Statement ID: `274273a6-cd50-48ee-8245-414784a72ae6`
- Document class: `mixed_report`
- Extraction strategy: `local_parser`
- Selected period: `2024`
- Comparison period: `n/a`
- Extracted lines: 29
- Eligible lines: 28
- Mapped lines: 28
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: none

## Grupa Apator Raport RS 2024

- File: `knowledge/Finanse/Grupa Apator Raport RS 2024.pdf`

### P&L

- Statement ID: `fe3d10ef-89c7-4879-b156-f95d7ab44b28`
- Document class: `mixed_report`
- Extraction strategy: `local_parser`
- Selected period: `2024`
- Comparison period: `n/a`
- Extracted lines: 17
- Eligible lines: 17
- Mapped lines: 17
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: none

### CF

- Statement ID: `4054f2ba-feb9-426b-9e21-fe4367fc2b6e`
- Document class: `mixed_report`
- Extraction strategy: `local_parser`
- Selected period: `2024`
- Comparison period: `n/a`
- Extracted lines: 30
- Eligible lines: 28
- Mapped lines: 28
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: none

## Raport skonsolidowany Apator

- File: `knowledge/Finanse/Raport-skonsolidowany-Apator.pdf`

### P&L

- Statement ID: `44798d97-cbe2-4546-8f5a-bccb54b4eb58`
- Document class: `mixed_report`
- Extraction strategy: `openai_input_file`
- Selected period: `2022`
- Comparison period: `n/a`
- Extracted lines: 10
- Eligible lines: 10
- Mapped lines: 10
- Coverage: 100%
- Readiness: `recoverable` (77)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `REQUIRED_LINES_MISSING`
- Top unmapped labels: none
- Error: none

### CF

- Statement ID: `85eb354f-67aa-483e-99d1-f630d2b602a6`
- Document class: `mixed_report`
- Extraction strategy: `openai_input_file`
- Selected period: `2022`
- Comparison period: `n/a`
- Extracted lines: 4
- Eligible lines: 4
- Mapped lines: 4
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: none
