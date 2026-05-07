# Changelog — PRESENTATION_RBAC_MATRIX.md

This file tracks all changes to `docs/product/PRESENTATION_RBAC_MATRIX.md` per the
Documentation Change Control policy
(`docs/governance/DOCUMENTATION_CHANGE_CONTROL.md`).

New entries go on top, under this paragraph and above the previous most-recent entry.
Use `docs/governance/DOC_CHANGE_TEMPLATE.md` as the seed for new entries.

---

## 2026-05-07 — Sprint 14 (L3)

**Doc:** docs/product/PRESENTATION_RBAC_MATRIX.md
**Risk tier:** P1
**Rationale:**
Created by closing Epic L3 (documentation change control). The RBAC matrix is the
authority on permission boundaries for every artifact action, so any drift here directly
maps to security risk. An auditable changelog is a precondition for treating the matrix
as a real source of truth, not just reference text.

**Impact note:**
- Code: none (governance scaffold only)
- Docs: `docs/governance/DOCUMENTATION_CHANGE_CONTROL.md` is the policy parent
- Tests: `server/src/services/__tests__/docChangeControlValidatorService.test.ts`

**Reviewer:** `<Security Lead>` (Security owner per `DOC_OWNER_REGISTRY.md`)
**Linked PR / ticket:** Sprint 14 — Epic L3 (Documentation change control)

**Diff summary:**
- Initial changelog created as part of L3 closure.
- The RBAC matrix itself was NOT modified by this change; only the changelog scaffolding
  was added alongside it.
