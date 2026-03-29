# Final Implementation Contract — Admin (Position 32/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Dopasować UI/UX; połączyć z Settings i Superadmin; zarządzanie rolami i organizacją.
- **Primary users**: tenant operatorzy (admins/owners).
- **Success metric**: jeden tenant operator cockpit (team/org-adjacent/sync oversight) z jasnym handoff do Settings i Superadmin.

## 2. Scope
### 2.1 In-scope
- Admin cockpit: team membership, tenant operations, sync oversight (wg planu).
- Jasne ownership boundaries.

### 2.2 Out-of-scope / non-goals
- Platform operator scope (to `Superadmin`).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ADMIN_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: „tenant admin systems / operator cockpits” — repo nie zawiera zdistylowanej listy vendorów (**missing input**).

## 5. Evidence plan (DoD)
- Acceptance: core admin flows są odkrywalne i spójne; boundaries z org/settings/superadmin nie są sprzeczne.
- Evidence: staging operator walkthrough + testy uprawnień/role gating.

