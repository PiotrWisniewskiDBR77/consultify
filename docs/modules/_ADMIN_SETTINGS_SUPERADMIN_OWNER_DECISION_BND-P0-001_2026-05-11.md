---
decision_id: BND-P0-001
decision_title: Superadmin access to tenant-admin plane
decision_owner_role: CTO
decision_date: 2026-05-11
scope_anchor: 17_18_ADMIN_SETTINGS_BOUNDARY/INTEGRATION_AUDIT
status: DECIDED
---

# Owner Decision — BND-P0-001

## Problem

Aktualny runtime guard (`SUPERADMIN >= ADMIN`) technicznie dopuszcza `SUPERADMIN` na `/admin/*`.
To rozmywa granice plane-ownership miedzy tenant admin a superadmin.

## Decision (LOCKED)

**Polityka docelowa: `ALLOWED_WITH_EXPLICIT_OVERRIDE_AUDIT`**

Znaczy to:
- domyslnie superadmin operuje w `/superadmin/*`,
- wejscie superadmin w tenant-admin plane (`/admin/*`) jest dozwolone tylko jako jawny tryb override,
- kazdy override musi miec:
  - reason code,
  - actor identity,
  - tenant scope,
  - timestamp,
  - immutable audit record.

## Why this decision

- Nie blokuje operacji wsparcia i incydentow cross-tenant.
- Zachowuje separacje produktowa i odpowiedzialnosci przez explicit override zamiast silent inheritance.
- Jest zgodne z security-tenancy guardrails (no hidden writes, auditable high-impact actions).

## Enforcement contract

### 1) Route/guard contract
- Brak "cichego" dostepu superadmin do `/admin/*`.
- Dostep tylko przez jawny mechanizm override i audyt.

### 2) Mutation contract
- Bez override: brak tenant-admin mutacji z poziomu superadmin.
- W override: tylko mutacje zgodne z approved scope i audytem.

### 3) Visibility contract
- UI musi pokazywac, ze aktywny jest tryb override.
- Tenant scope i reason code musza byc widoczne podczas sesji override.

## Not done (implementation)

- Runtime guard i flow override nie sa jeszcze dostosowane.
- To jest decyzja wlascicielska i lock kontraktowy, nie potwierdzenie wdrozenia runtime.

## Execution next step

Zaktualizowac:
- `17_panel-administratora/functions/ADM_SUPERADMIN_BOUNDARY.md`
- `17_panel-administratora/06_PERMISSIONS_AND_SECURITY.md`
- `17_panel-administratora/07_ACCEPTANCE_AND_TESTS.md`
- `18_ustawienia/functions/SET_POLICY_BOUNDARY_LINKS.md`
- `18_ustawienia/06_PERMISSIONS_AND_SECURITY.md`
- `18_ustawienia/07_ACCEPTANCE_AND_TESTS.md`

tak, aby wszedzie obowiazywala polityka:
`ALLOWED_WITH_EXPLICIT_OVERRIDE_AUDIT`.

