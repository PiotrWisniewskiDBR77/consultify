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
### 4.1 Primary benchmark family (SSOT)
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ORGANIZATION_2026-03-29.md`
- Adjacent modules boundary (must not collapse):
  - `Settings` (31), `Admin` (32), `Superadmin` (33)

### 4.2 Local Softs evidence (concrete artifacts)
- **Linear (members/roles/security as canonical “workspace identity” posture)**:
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/settings/members.html` (members management posture).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/docs/members-roles.html` (roles semantics posture).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/settings/account/security.html` + `Linear/linear.appx/security.html` (security posture).
- **Atlassian (org-level support/admin posture adjacency)**:
  - `Softs/0 Baza wiedzy /Atlassion 1/developer.atlassian.com/support.html` (org/system support entry posture; useful as “tenant trust surface” adjacency).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “jedna prawda o organizacji (tenant identity) + reuse contract”, nie “kolejny panel ustawień”.**

- **Explicit membership + roles posture (Linear)**:
  - Członkowie i role są zrozumiałe; boundary org vs user jest widoczny.
- **Security/trust posture (Linear security)**:
  - Trust controls są częścią “org identity layer” (bounded) i są czytelne (kto kontroluje co).
- **Downstream reuse contract (Wave2)**:
  - Moduły downstream konsumują org truth, nie redefiniują jej fragmentami.
- **No scope collapse into Admin/Superadmin (non-goal)**:
  - Organization nie staje się operator cockpit; to warstwa tożsamości i defaults.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Wave2 plan)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_ORGANIZATION_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Organization v8 canon | one tenant product | “canon missing” | Spisać i wdrożyć jeden kanon Organization (profile/ownership/defaults/trust) | P0 |
| Reuse contract | downstream consistency | “not explicit enough” | Zdefiniować stable reuse fields i ownership boundaries dla modułów | P0 |
| Trust boundaries | visible security posture | “partial” | Ujawnić domain/trust controls i error/degraded modes | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Org truth jest jedna i reuse’owana; UI/UX jest spójny ze standardem; ownership boundaries są jawne.
- Członkowie/role oraz trust controls są czytelne (kto ma władzę i gdzie).
- Downstream moduły mają jasny contract “które pola dziedziczą” i nie tworzą alternatywnej prawdy.

### 5.2 Tests
- Integracyjne: create/update org profile/defaults → downstream read (np. Tools/Assessment/Partner) → consistent rendering.
- Regression: brak permissions / conflict with Settings/Admin → czytelny error + brak silent driftu.
- Contract tests: org schema stable; ownership boundaries enforced; audit events emitted.

### 5.3 Staging proof checklist
- Demo: owner zmienia podstawowe org defaults + widoczny efekt w 2 downstream surfaces.
- Demo: member/role change → natychmiastowy efekt permissions + audit trace (bounded).

