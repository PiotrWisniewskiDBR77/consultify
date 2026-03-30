# P25-B Evidence — Help contextual entry points (3 surfaces) + routing + reco payload (v1)
Date: 2026-03-30  
Packet: **P25-B**  
State: evidence-first plan (tests + staging proof script) — implement next

## Context pack (max 5, SSOT order)
1. Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
2. Contract (P25): `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_25_HELP_2026-03-29.md` (see §8.1 P25-B)
3. Help runtime (server): `server/src/routes/help.routes.ts`
4. Help runtime (client): `src/contexts/HelpContext.tsx` + `src/components/layout/HelpPanel.tsx`
5. Knowledge Base bridge (if needed for article ids): `server/src/routes/v8/knowledge-base.routes.ts`

---

## Automated tests (run locally)

### Existing baseline (must stay green)

```bash
npx vitest run \
  tests/integration/routes/helpRoutes.test.ts \
  tests/integration/help/help-chat.routes.test.ts \
  tests/integration/help/help-feedback.routes.test.ts \
  tests/integration/help/help-analytics.routes.test.ts \
  tests/components/AppProviders.help-context.test.tsx
```

### P25-B additions (to be implemented in this packet)

After P25-B runtime changes land, add (and keep green):

```bash
npx vitest run \
  tests/integration/routes/p25b-help-contextual-entrypoints.routes.sqlite.integration.test.ts \
  tests/unit/help/p25b-help-next-action-routing.test.tsx
```

Expected (P25-B):
- **3 surfaces** (`Tools`, `Interview`, `Results/Outputs`) expose a clear contextual help entry point that opens Help with a correct context mapping.
- Help supports: **search → open article → next action routing** back to the correct surface.
- Degraded states are explicit:
  - missing article id → safe fallback + search CTA
  - missing PL translation → explicit PL degraded banner + EN fallback
- Teresa/Anna guidance can deep-link using **exact `article_id`** (no vague “help link”), and the UI/API keeps the id visible/auditable.

---

## Staging proof script (runtime checklist)

Environment prerequisites:
- User can access the 3 target surfaces: `Tools`, `Interview`, `Results/Outputs`.
- At least one Help article exists for each pilot surface (seed minimum per contract §2.3.4), plus at least one article that has **EN-only** content to validate fallback.

### A) Contextual entry points (3 surfaces)

1. Go to **Tools**.
2. Click **Help / Contextual help** (primary entry point).
3. Confirm Help opens and shows content that matches the **Tools** context (module/surface id visible in UI state or in the help header).

Repeat steps 1–3 for:
- **Interview**
- **Results/Outputs**

### B) Search → article → next action routing (3 surfaces)

For each of the 3 surfaces:
1. Open contextual help.
2. Use search to find an article relevant to that surface.
3. Open the article.
4. Click **Next action** (or safe “Back to <surface>” fallback when next action missing).
5. Confirm you return to the correct surface, preserving continuity (no landing on a wrong module).

### C) Degraded / fallback posture (explicit)

1. Switch UI locale to **PL**.
2. Open an **EN-only** article.
3. Confirm an explicit PL banner (“Brak wersji PL — wyświetlamy EN”) and that the article body is EN (no mixing).
4. Trigger a missing article id (bounded: navigate to a known-invalid id via dev link or test route) and confirm a safe degraded screen + search CTA (no crash).

### D) Teresa/Anna deep-linking to exact article id (bounded)

1. Trigger a Teresa/Anna suggestion that references a help article.
2. Confirm the suggestion includes an explicit **`article_id`** and the click opens the correct article.
3. Confirm the user can see which article id was opened (auditable posture).

Capture:
- short screen recording (or screenshots) for A+B+C+D.

---

## Rollback posture (P25-B scope)
- Revert only contextual entry point wiring and routing helpers; keep baseline Help routes (`/api/help/*`) intact.
- No destructive data operations; existing help content remains available.

---

## Known limits (explicit, for honesty)
- This packet is **bounded** to 3 pilot surfaces and v1 routing/reco posture; full Help expansion to all surfaces is P25-C/P1.

