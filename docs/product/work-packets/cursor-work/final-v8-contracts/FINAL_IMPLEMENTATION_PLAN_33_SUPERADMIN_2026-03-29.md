# Final Implementation Contract — Superadmin (Position 33/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Dopasować UI/UX; pełne zarządzanie dzierżawcą + Virtual Workers (Anna/Teresa) + governance; role.
- **Primary users**: platform operatorzy (cross-tenant).
- **Success metric**: jeden widoczny platform control plane z zamontowanymi gałęziami (tenant/user ops, AI ops, connector ops) i bez mieszania z tenant admin.

## 2. Scope
### 2.1 In-scope
- Root control plane + mounted branches wg planu.
- Cross-tenant ops: tenant/user visibility + AI/connector platform ops.

### 2.2 Out-of-scope / non-goals
- Zastąpienie tenant Admin.
- Full enterprise observability parity.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SUPERADMIN_2026-03-29.md`
- SSOT: `docs/product/SUPERADMIN_V8_SSOT.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: „platform control planes” — repo nie zawiera zdistylowanej listy vendorów (**missing input**).

## 5. Evidence plan (DoD)
- Acceptance: root + branches są odkrywalne; cross-tenant operations są spójne; boundaries z Organization/Admin/Settings są jawne.
- Evidence: staging operator walkthrough + testy dla cross-tenant gating.

