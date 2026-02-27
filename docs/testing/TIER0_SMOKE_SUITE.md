# Tier-0 Smoke Suite

Data: 2026-02-26
Cel: deterministyczny gate PR (krotki czas, wysoki sygnal, niska flakiness).

## Zawartosc (Tier-0)
- tests/e2e/smoke/login.spec.ts
- tests/e2e/smoke/pages-render.spec.ts
- tests/e2e/smoke/sidebar-navigation.spec.ts
- tests/e2e/smoke/settings-and-modules-render.spec.ts
- tests/e2e/smoke/tier0-core-workflows.spec.ts
- tests/e2e/smoke/tier0-initiative-create.spec.ts

## Uruchomienie
- npm run test:e2e:tier0

## Zasady
- Tylko stabilne, deterministyczne scenariusze.
- Max 5-10 scenariuszy w Tier-0.
- Flaky testy nie moga byc w Tier-0 (naprawa lub degradacja do nightly).
