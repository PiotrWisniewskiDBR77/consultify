# Finance Import API Test Report

- API URL: `http://127.0.0.1:3105`
- Statements attempted: 12
- Ready after values: 8
- Recoverable after values: 3
- Rejected after values: 0
- Hard failures: 1

| Document | Type | Eligible | Mapped | Coverage | Readiness | Confirmed | Error |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| Apator SA Raport R 2024 | BS | 33 | 33 | 100% | ready | yes | — |
| Apator SA Raport R 2024 | P&L | 14 | 14 | 100% | ready | yes | — |
| Apator SA Raport R 2024 | CF | 28 | 28 | 100% | ready | yes | — |
| Grupa Apator Raport RS 2023 | BS | 42 | 42 | 100% | recoverable | no | — |
| Grupa Apator Raport RS 2023 | P&L | 21 | 21 | 100% | ready | yes | — |
| Grupa Apator Raport RS 2023 | CF | 26 | 26 | 100% | recoverable | no | — |
| Grupa Apator Raport RS 2024 | BS | 45 | 45 | 100% | ready | yes | — |
| Grupa Apator Raport RS 2024 | P&L | 17 | 17 | 100% | ready | yes | — |
| Grupa Apator Raport RS 2024 | CF | 28 | 28 | 100% | ready | yes | — |
| Raport skonsolidowany Apator | BS | 10 | 10 | 100% | n/a | no | fetch failed |
| Raport skonsolidowany Apator | P&L | 13 | 13 | 100% | recoverable | no | — |
| Raport skonsolidowany Apator | CF | 11 | 11 | 100% | ready | yes | — |

## Apator SA Raport R 2024

- File: `knowledge/Finanse/Apator SA Raport R 2024.pdf`

### BS

- Statement ID: `8b1f4c5f-677a-4d66-b78f-22cb4c949934`
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

- Statement ID: `2bcb3100-2277-4000-9c28-95ab8662ad7c`
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

- Statement ID: `f8b8cd9a-d76d-42ed-99a7-f79c32032b79`
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

## Grupa Apator Raport RS 2023

- File: `knowledge/Finanse/Grupa Apator Raport RS 2023.pdf`

### BS

- Statement ID: `4b5594f6-333d-469a-9b51-7c1d76301028`
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

- Statement ID: `0b79dbd5-433c-49db-8cf3-ae75f56b6438`
- Document class: `mixed_report`
- Extraction strategy: `local_parser`
- Selected period: `2023`
- Comparison period: `n/a`
- Extracted lines: 21
- Eligible lines: 21
- Mapped lines: 21
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: none

### CF

- Statement ID: `7a76574b-7b27-461a-81e7-acbfbac50867`
- Document class: `mixed_report`
- Extraction strategy: `local_parser`
- Selected period: `2023`
- Comparison period: `n/a`
- Extracted lines: 27
- Eligible lines: 26
- Mapped lines: 26
- Coverage: 100%
- Readiness: `recoverable` (83)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `REQUIRED_LINES_MISSING`
- Top unmapped labels: none
- Error: none

## Grupa Apator Raport RS 2024

- File: `knowledge/Finanse/Grupa Apator Raport RS 2024.pdf`

### BS

- Statement ID: `72e911ce-626b-474a-9f29-4c9ab544095b`
- Document class: `mixed_report`
- Extraction strategy: `local_parser`
- Selected period: `2024`
- Comparison period: `n/a`
- Extracted lines: 45
- Eligible lines: 45
- Mapped lines: 45
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation codes: `BS_EQUATION_OK`
- Top unmapped labels: none
- Error: none

### P&L

- Statement ID: `845f428c-9d36-4a03-afbf-9f77f71389a1`
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

- Statement ID: `397cded4-47b1-4457-9a0a-fc804e79254c`
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

### BS

- Statement ID: `6e3a95a2-d84a-4ad0-8367-9cf71d803779`
- Document class: `mixed_report`
- Extraction strategy: `openai_input_file`
- Selected period: `2022`
- Comparison period: `n/a`
- Extracted lines: 10
- Eligible lines: 10
- Mapped lines: 10
- Coverage: 100%
- Readiness: `n/a`
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: fetch failed

### P&L

- Statement ID: `afd62ee1-7ac2-4e1c-badb-fba607c7c281`
- Document class: `mixed_report`
- Extraction strategy: `openai_input_file`
- Selected period: `2022`
- Comparison period: `n/a`
- Extracted lines: 13
- Eligible lines: 13
- Mapped lines: 13
- Coverage: 100%
- Readiness: `recoverable` (89)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `REQUIRED_LINES_MISSING`
- Top unmapped labels: none
- Error: none

### CF

- Statement ID: `357f04aa-8eed-431d-89be-2f68e7d9ce81`
- Document class: `mixed_report`
- Extraction strategy: `openai_input_file`
- Selected period: `2022`
- Comparison period: `n/a`
- Extracted lines: 11
- Eligible lines: 11
- Mapped lines: 11
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation codes: none
- Top unmapped labels: none
- Error: none
