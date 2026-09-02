---
module_id: MODULE_ORGANIZATION
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Organizacja

## Scope Of Verification (As-Is)

- Verify sidebar -> AppView -> route -> rendered component chain.
- Verify ownership/alias statements against `menuConfig.ts`, `routeConfig.ts`, `AppRoutes.tsx`.
- Verify role/guard behavior where module is protected.

## Required Checks

- [ ] Route opens documented runtime (`workspace` or `placeholder`) exactly as specified.
- [ ] AppView enum and route mapping are consistent in `src/types/core.ts` and `routeConfig.ts`.
- [ ] No contradiction with global ownership decisions in module docs and global docs.
- [ ] If module is placeholder, UI communicates not-ready state explicitly.

## Current Gate Expectation

- Expected gate result today: `PASS_WITH_P2 (legacy/transitional overlap still present).`
- This is As-Is readiness, not target-state implementation readiness.

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `ORG_CONTEXT_WORKSPACE` | Canonical organization runtime is mounted | `AppRoutes.tsx` + `OrganizationView.tsx` | pass |
| `ORG_LEGACY_CONTEXT_BUILDER` | Transitional `/context/*` runtime remains mounted | `AppRoutes.tsx` + `ContextBuilderView` mapping | pass (`partial`) |

## STAN ZMIERZONY 2026-09-01 (dyżur 236)

Pełny pomiar: `docs/functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md`.

| Sprawdzenie | Wynik | Dowód |
| --- | --- | --- |
| Flaga `orgRedesignV1` default | **OFF** (realnie), nagłówek pliku mówi ON — wyjaśnione w tym samym pliku jako świadome cofnięcie 29.08 | `src/utils/orgRedesignFlag.ts:19,54-59,86-93` |
| Test jednostkowy flagi | **FAIL** (2 zastałe testy oczekują ON) | `src/utils/__tests__/orgRedesignFlag.test.ts:36` |
| Ekrany dostępne pod realnym defaultem | 21 pozycji w 6 grupach (stary układ); 11 ekranów redesignu nieosiągalne bez ręcznego przełączenia flagi | dyżur 236, harness `dev-render/screens/day236-organizacja.tsx`, 22 zrzuty light/dark |
| Werdykt właściciela dla redesignu | `OWNER_NOT_REVIEWED` | dyżur 236 |

To koryguje `docs/FUNCTIONAL_DOCUMENTATION.md:55` (`CLOSED_FINAL 2026-08-25`) —
zamknięcie opierało się na prototypie, nie na odbiorze realnego builda
(`DEC-2026-08-25-74`, wzorzec RUNTIME-IDENTITY-MISMATCH).

## Evidence Pointers

- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/types/core.ts`
- `src/utils/orgRedesignFlag.ts`
- `src/utils/__tests__/orgRedesignFlag.test.ts`
