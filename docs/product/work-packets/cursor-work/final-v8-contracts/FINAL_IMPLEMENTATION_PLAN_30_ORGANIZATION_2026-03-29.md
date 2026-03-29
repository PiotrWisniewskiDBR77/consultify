# Final Implementation Contract — Organization (Position 30/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Dopasować UI/UX do standardu; dodać/zmienić co ma sens; lepsza organizacja danych.
- **Primary users**: tenant owners + osoby utrzymujące tożsamość organizacji.
- **Success metric**: jeden kanoniczny „tenant organization product” z reuse contract dla reszty modułów (bez redefinicji org truth w Admin/Settings).

## 2. Scope
### 2.1 In-scope
- Organization profile/branding/ownership/defaults/trust controls (wg planu).
- Downstream reuse contract (co dziedziczą inne moduły).

### 2.2 Out-of-scope / non-goals
- Zastąpienie Admin/Superadmin.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ORGANIZATION_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: „tenant identity / organization-control systems” — repo nie zawiera zdistylowanej listy vendorów (**missing input**).

## 5. Evidence plan (DoD)
- Acceptance: org truth jest jedna i reuse’owana; UI/UX jest spójny ze standardem; ownership boundaries są jawne.
- Evidence: staging demo + testy integracyjne dla kluczowych settings/org fields.

