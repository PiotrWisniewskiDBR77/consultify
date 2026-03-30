# P24-B — Templates runtime (Outputs) — evidence plan (2026-03-30)

Scope: packet **P24-B** (runtime) per `FINAL_IMPLEMENTATION_PLAN_24_TEMPLATY_2026-03-29.md`.

This document is **evidence-first**: tests + staging proof steps are defined before runtime changes land.

## Automated tests (run locally)

```bash
npx vitest run \
  tests/integration/routes/artifacts.routes.test.ts \
  tests/unit/hooks/useTemplates.canonicalArtifacts.test.tsx
```

Expected:
- `artifacts.routes` accepts `artifactFamily=template` and passes it through to the canonical registry filters.
- `useTemplates` loads templates from canonical Outputs artifacts (`/api/artifacts?artifactFamily=template&outputType=...`) and maps them into `TemplateItem`.

## Staging proof script (§5.3 — click-by-click)

Environment:
- Two users in the **same org**: `User A` (member) + `User B` (admin/owner).
- Outputs feature gate enabled (P19 baseline).

1. Open **Outputs Library** (route `/presentations`) and go to tab **Templates**.
2. Confirm the Templates list is **canonical** (powered by `/api/artifacts?artifactFamily=template`) and not by legacy runtime endpoints.
3. **Template-first generation (report)**:
   - Pick a **report** template and click **Use template**.
   - Confirm builder opens with `templateArtifactId=<artifactId>` and that the generated draft respects the template structure blueprint.
4. **Reopen / continue**:
   - Return to Outputs list; reopen the same output; confirm template reference persists (template id + structure contract).
5. **Save-as-template** (bounded):
   - From the generated output choose **Save as template** (row action).
   - In the confirm dialog choose **Cancel** (personal scope) and confirm the saved template is visible to `User A` (personal scope).
6. **Review gate + publish to org**:
   - From the same output choose **Save as template** again, and in the confirm dialog choose **OK** (org scope).
   - In Templates tab find the org-scope draft template and click **Submit for review** (no silent publish).
   - As `User B`, open **Needs review** tab and click **Approve & publish**.
   - Confirm template becomes **published** and visible at org scope.
7. **Reuse by another user**:
   - Switch back to `User A` and confirm the org-published template appears in Templates tab.
   - Use the org template to generate a new output; confirm access and reuse works.

Optional capture:
- Short screen recording or screenshots for steps 2, 6, 7 attached to PR.

## Rollback posture

- Revert the P24-B runtime commit(s) that switch template listing + templateId wiring; keep Outputs Library list (P19) intact.
- No destructive data operations; template artifacts remain as rows in the canonical registry and can be ignored by UI if needed.

## Known limits (bounded by P24-B)

- Recommendation engine (P1) is out-of-scope; P24-B proves explicit selection → generation → save-as-template → governed publish → reuse.

