---
module_id: MODULE_ADMIN_PANEL
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Panel Administratora (Admin + SuperAdmin)

## Purpose

Ustalić granice odpowiedzialności modułu `Panel Administratora` i jego relacje z `Organization` (P30), `Settings` (P31) oraz modułami domenowymi.

## In scope (Must)

- **Admin (`/admin/*`) — tenant scope (P32)**:
  - Members & roles, invites, ownership ops (bounded).
  - Security & identity: MFA/SSO/session/password policy (tenant), API keys/webhooks (gdy w admin scope).
  - Billing/limits/FinOps (dla ról uprawnionych).
  - AI governance & AI operations w kontekście tenant.
  - Integrations health + remediation w obrębie tenant.
  - Audit/compliance/risk dla admin‑scoped zdarzeń.
- **SuperAdmin (`/superadmin/*`) — platform scope (P33)**:
  - Cross‑tenant operations i platform governance zgodnie z `SUPERADMIN_V8_SSOT.md` (domains + vertical packages).

## Out of scope (Must Not)

- **MUST NOT**: Cross‑tenant działania w Admin (to należy do SuperAdmin).
- **MUST NOT**: Osobiste preferencje użytkownika i większość user‑scoped settings (to `Settings`).
- **MUST NOT**: Business profile / strategic workspace organizacji jako “authoring surface” (to `Organization`).
- **MUST NOT**: Domena‑specyficzne ustawienia jako osobny “admin root” — powinny być embedowane w swoim module.

## Should

- **SHOULD**: Jawna macierz ownership (Admin vs Organization vs Settings vs SuperAdmin) i jednoznaczne deep‑linki do właściwej powierzchni.

## Acceptance Criteria

- [ ] “Admin vs SuperAdmin” jest rozdzielone na poziomie routingu, UI i uprawnień.
- [ ] Nie ma sprzeczności z inventory mounted surfaces.

## Related Sources

- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md`
- `DRD/consultify/docs/product/SUPERADMIN_V8_SSOT.md`

