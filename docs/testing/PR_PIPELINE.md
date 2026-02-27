# PR Pipeline - Minimal Gates

## Cel
Ten dokument opisuje minimalny zestaw gate'ow dla PR oraz zasady szybkiego feedbacku.

## PR Gates (obowiazkowe)
1. Lint + Type Check
2. Test Quality (anti-placeholder)
3. Skip/Only Gate
4. Coverage gates L1-L3
5. Unit tests (sharding)
6. Component tests
7. E2E Tier-0 (smoke)
8. Security integrity gate
9. Quality scorecard + flaky report (artefakty)

## Uzasadnienie
- PR powinien dawac feedback do 20 minut.
- Ciezsze testy (full E2E, OWASP, performance real DB) uruchamiane sa poza PR (nightly/weekly).

## Weryfikacja
- Workflow: `.github/workflows/test-suite.yml`
- Artefakty: quality-scorecard.json, flaky-tests.json
