---
module_id: MODULE_MEETING
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Meeting

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

- **Zmierzone i obalone 2026-09-01 (dyżur 237):** `ME_MEETING_PLACEHOLDER`
  poniżej opisuje stan sprzed `DEC-2026-08-24-07` i `FIX-181` (2026-08-30).
  Kod dziś montuje realny `MeetingHub` na `/meetings`
  (`MODULE_MEETING: 'open'`, `src/utils/betaMenuStatus.ts:57`), nie
  placeholder. Zapis poniżej zostaje jako historia, **obalone 1.09** — patrz
  matryca „STAN ZMIERZONY" niżej dla aktualnego gate.
- Expected gate result today (as-is 2026-07-30, przed przeglądem 1.09): `BLOCKED_P1 for functional meeting flow.`
- This is As-Is readiness, not target-state implementation readiness.

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `ME_MEETING_PLACEHOLDER` | `/meeting` mounts honest placeholder runtime | **Obalone 1.09**: `/meeting` jest trwałym przekierowaniem, kanoniczna trasa `/meetings` montuje realny `MeetingHub`, nie `V4ComingSoonView` — `src/routes/AppRoutes.tsx`, `DEC-2026-08-24-07` | fail (nieaktualne) |
| `ME_MEETING_RUNTIME_TARGET` | Target runtime remains documented as not mounted | **Obalone 1.09**: `MeetingHub` jest route-mounted i realnie renderowany (dyżur 237, harness montujący produkcyjny komponent) | fail (nieaktualne) |

## STAN ZMIERZONY 2026-09-01 (dyżur 237) — trzy bramki dostępu

Pełny pomiar: `docs/functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md`.

| Bramka | Stan | Dowód |
| --- | --- | --- |
| Moduł otwarty (`betaMenuStatus`) | OPEN | `src/utils/betaMenuStatus.ts:57` |
| Trasa dozwolona (`pilotAccess`) | ALLOWED (od `FIX-181`, 30.08) | `src/utils/pilotAccess.ts:22-34` |
| Widoczność w menu (`PILOT_VISIBLE_MENU_IDS`) | **BRAK** — pozycja pokazana z kłódką, nie ukryta | `src/utils/pilotAccess.ts:6-12`, `src/components/navigation/Sidebar/Sidebar.tsx:124-149` |

Test regresyjny bramki menu (dowiedziony mutacyjnie 1.09):
`src/components/navigation/Sidebar/__tests__/Sidebar.pilotMeetingLock.test.tsx`
(commit `e63468df76`). Test regresyjny bramki trasy:
`src/components/__tests__/RouterSync.pilotMeetings.test.tsx`.

Backendowy split G09 (`meeting_notes` vs `meeting_decisions`) zmierzony żywym
przebiegiem: `GET /api/meeting/:id/decision-records` zwraca puste, ale UI
dokłada zatwierdzone decyzje z notatek (`MeetingObjectPage.tsx:563-572`,
`:829-846`) — kontrakt Day105 jest PASS.

## Evidence Pointers

- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/types/core.ts`
- `src/utils/pilotAccess.ts`
- `src/components/navigation/Sidebar/Sidebar.tsx`
- `src/components/RouterSync.tsx`
- `src/components/Meeting/MeetingObjectPage.tsx`
