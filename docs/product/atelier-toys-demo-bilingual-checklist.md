# Atelier Toys Demo Bilingual Checklist

## Goal
Keep one shared demo dataset for `Atelier Toys`, but verify that seeded content, API responses, and demo chrome stay consistent in both `EN` and `PL`.

## Smoke Test
1. Start demo in English and confirm the top bar shows `EN`.
2. Open executive overview, portfolio, DRD baseline, reports, docs, notebook, and canvas tools.
3. Confirm seeded records are English-only within that tenant.
4. Switch app language to Polish.
5. Confirm demo chrome switches to Polish, but the top bar offers a restart action for the demo session.
6. Restart the demo session in Polish.
7. Confirm the top bar shows `PL`.
8. Re-open executive overview, portfolio, DRD baseline, reports, docs, notebook, and canvas tools.
9. Confirm the seeded tenant is Polish-only and does not mix English narrative copy with Polish copy.

## Data Checklist
- Leadership titles, department labels, and focus statements are localized.
- Project names, descriptions, and goals are localized.
- Initiative names, summaries, stages, tasks, decisions, milestones, and narrative arrays are localized.
- Reports, knowledge docs, prompts, notebooks, and idea/canvas workspaces are localized.
- DRD baseline notes, executive summary, maturity overview, and recommendations are localized.
- Scenario cards and tool coverage returned by `/api/demo/*` match the active demo session locale.

## UX Checklist
- Demo session locale is pinned to the seeded tenant.
- When app locale differs from session locale, the user sees a restart action instead of silent reseeding.
- Restarting demo in another locale creates a fresh tenant and updates the locale badge in the top bar.
- Exiting demo clears session-local demo state, including session org and locale.

## Automated Checks
- `tests/unit/backend/demo/demoLocale.test.ts`
- `tests/unit/backend/demo/demoRelativeDate.test.ts`
