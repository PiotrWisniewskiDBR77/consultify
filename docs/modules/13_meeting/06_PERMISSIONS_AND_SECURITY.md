---
module_id: MODULE_MEETING
doc_kind: PERMISSIONS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Permissions & Security — Meeting

## Purpose

Define security, tenancy, ACL and approval rules for this module.

## Must

- Meeting content follows project/client confidentiality and participant permissions.

Function-level enforcement applies uniformly to: `ME_MEETING_PLACEHOLDER`, `ME_MEETING_RUNTIME_TARGET`.

## Global Security Rules

- MUST enforce tenant and project boundaries.
- MUST use deny-by-default when authorization is uncertain.
- MUST audit high-impact mutations and governance transitions.
- MUST NOT expose secrets, raw internals, stack traces or sensitive payloads to business users.

## Should

- SHOULD show locked/unauthorized states with safe explanation and no sensitive leakage.
- SHOULD separate read permissions from mutation/approval permissions.

## Acceptance Criteria

- [ ] Unauthorized users cannot view or mutate protected objects.
- [ ] High-impact actions require explicit approval and produce audit evidence.
- [ ] Sensitive data remains scoped to allowed tenant/project/user context.

## STAN ZMIERZONY 2026-09-01 (dyżur 237)

Trzy niezależne bramki decydują o dostępie pilota do Spotkań; dziś otwarte są
dwie z trzech (moduł `open` + trasa dozwolona), trzecia (widoczność w menu)
pokazuje pozycję z kłódką zamiast ją ukrywać — **to jest front-endowy
affordance, nie dowód separacji danych po stronie serwera.** Zrzut „dostęp
zwykłego użytkownika" jest bitowo identyczny ze zrzutem zwykłej listy, bo
zaplecze harnessu nie rozróżnia roli — **o uprawnieniach backendu (czy
`/api/meeting/*` separuje dane per rola) ten pomiar nic nie mówi.** Pełny
pomiar i cytaty `plik:linia`:
`docs/functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md`.

Test regresyjny bramki menu (dowiedziony mutacyjnie): `src/components/navigation/Sidebar/__tests__/Sidebar.pilotMeetingLock.test.tsx`.
Test regresyjny bramki trasy: `src/components/__tests__/RouterSync.pilotMeetings.test.tsx`.
