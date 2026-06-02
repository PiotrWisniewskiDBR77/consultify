# Documentation Change Entry Template

Copy the block below, paste it at the **top** of the relevant `CHANGELOG_<doc>.md`
(under the changelog title and intro paragraph, above the previous most-recent entry),
and fill in every field.

The validator (`server/src/services/docChangeControlValidatorService.ts`) enforces the
required fields. See `DOCUMENTATION_CHANGE_CONTROL.md` for rules.

---

## Template (copy below this line)

```markdown
## YYYY-MM-DD — <Author>

**Doc:** <relative path, e.g. docs/product/PRESENTATION_RBAC_MATRIX.md>
**Risk tier:** P0 / P1 / P2
**Rationale:**
<2–4 sentence why. Must be ≥ 20 chars and must not be boilerplate like "updated docs".
Answer: why is this change needed now? What problem does it solve, or which decision
does it record?>

**Impact note:**
- Code: <files / modules affected, or `none`>
- Docs: <other docs that need follow-up, or `none`>
- Tests: <test surfaces to update, or `none`>

**Reviewer:** <name> (<role>)
**Linked PR / ticket:** <url or ticket id>

**Diff summary:**
- <bullet 1: what changed>
- <bullet 2: what changed>
```

---

## Authoring tips

- **Date format**: ISO `YYYY-MM-DD` only. The validator parses this; non-ISO dates are
  treated as missing.
- **Author**: free text. Convention is `Sprint NN (<Epic>)` for governance-scope edits and
  `<Name> (<Role>)` for individual edits.
- **Rationale boilerplate**: anything matching `/^updated docs?\.?$/i` is auto-rejected.
  Write at least one substantive sentence.
- **Impact note**: even when there is no downstream impact, write `none` explicitly.
  An empty section reads as "I forgot to think about it".
- **Reviewer**: must be the registered owner of the doc, OR a named delegate in
  `DOC_OWNER_REGISTRY.md`. Validator does not currently cross-check the registry, but
  the human reviewer step does.
- **Linked PR / ticket**: a placeholder like `TBD-after-merge` is acceptable for the very
  first entry of a brand-new doc; for normal edits, use the actual PR URL.
- **Diff summary**: 1–5 bullets. Don't restate the rationale; describe the *edits*.
