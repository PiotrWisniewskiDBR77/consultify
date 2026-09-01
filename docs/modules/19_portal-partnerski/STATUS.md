---
module_id: MODULE_PARTNER_PORTAL
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Status — Portal Partnerski

> **AKTUALIZACJA 2026-09-01 (dyżur 224).** Ten plik jest z 2026-05-09 i jest
> zbyt ogólny wobec dzisiejszego pomiaru. Najpełniejszy zmierzony mianownik
> to **25 sekcji** (dyżur 177, 30.08): 17/25 renderuje się, 7/25 kończyło się
> błędem, 1/25 pusta. **Obalone 1.09, było:** `earnings-summary` zwraca HTTP
> 500 (`PRT-D62-005`, potwierdzone 28-30.08). **Jest:** na markerze dyżuru 224
> ta sama trasa zwraca HTTP 200 z uczciwym `reason: 'POLICY_NOT_APPROVED'` —
> naprawione, ale pozostałe 6 błędnych sekcji z pomiaru 25-sekcyjnego NIE
> zostały dziś ponownie sprawdzone. `Organizations` — dodano
> `minTableWidth="auto"`: 6 kolumn mieści się przy 1280px, **nadal nie** przy
> 375px (`PRT-D112-003` pozostaje `PARTIAL_MOBILE`). „Users: 0" na ekranie
> Clients potwierdzone jako uczciwa liczba fixture, nie defekt. Ekonomia
> (accrual/payout) pozostaje świadomie `OFF`. Pełny pomiar:
> `docs/functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md` §4.

## Shipping Status (As-Is)

- Runtime class: `real + partial`
- Launch path is wired in sidebar + route config, then rendered through `AppRoutes`.
- Current ownership decision: Canonical portal ownership is protected `/partner/*`; public partner acquisition routes remain related but not portal-internal ownership.

## Current Risks

- Route exists, but behavior can diverge if imports are present and not mounted.
- Documentation must track mounted runtime, not planned/RAW target-state behavior.

## Next Contract Work (without changing scope)

- Keep CODEMAP/BEHAVIOR/UI_UX/TESTS aligned with mounted route/component truth.
- Reclassify status only when `AppRoutes` mounts real runtime behavior on launch route.

## Function Coverage Status

- Required functions documented: `2/2`.
- Covered: `PART_PORTAL_WORKSPACE`, `PART_PUBLIC_ACQUISITION_BOUNDARY`.
