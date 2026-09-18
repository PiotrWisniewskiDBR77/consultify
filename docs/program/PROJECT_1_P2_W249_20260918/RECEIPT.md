# PROJECT-1 P2 W249 Receipt

Final candidate implements the F-2 project context switcher behind `VITE_PMO_PROJECT_SWITCHER`, mounted in the global header. It uses the existing `currentProjectId` / `setCurrentProjectId` app store and the existing `GET /api/projects/my-memberships` API contract; selecting a project updates the shared project context and opens the existing `/projects/:projectId` card from PJ-1.

Changed product files:
- `src/components/Projects/ProjectContextSwitcher.tsx`
- `src/layouts/MainLayout.tsx`
- `public/locales/en/translation.json`
- `public/locales/pl/translation.json`
- `Dockerfile.api`

Evidence/support files:
- `src/components/Projects/__tests__/ProjectContextSwitcher.behavior.test.tsx`
- `dev-render/project-context-switcher.html`
- `dev-render/project-context-switcher-main.tsx`
- `docs/program/PROJECT_1_P2_W249_20260918/render-project-context-switcher.mjs`

TypeScript measurement, foreground with `NODE_OPTIONS=--max-old-space-size=8192`:
- line cache `f349a560d5503f3ee51bd3de38bbc822e795c483`: 156 errors, 36 files
- candidate final: 156 errors, 36 files
- file set diff: `+[] / -[]`
- instrument control: injected `const __projectSwitcherTscProbe: number = "x"` in `ProjectContextSwitcher.tsx`; count rose 156 -> 157 with sole new TS2322, then reverted.

Behavior proof:
- Mutation RED: removing `setCurrentProjectId(projectId)` from `selectProject` made `ProjectContextSwitcher.behavior.test.tsx` fail: expected selected project id, got `null`; restored GREEN.
- Tests: `ProjectContextSwitcher.behavior`, `projectDetail.w244.behavior`, `pmoProjectsFeatureRoute`, `menuConfig.pmoProjects` = 16/16 PASS, retry 0.
- Real render: Vite + Chromium rendered the actual `ProjectContextSwitcher` with real CSS/store/router and mocked only `/api/projects/my-memberships`; selecting `Digital & Automation Roadmap` wrote `ae6cfbae-1ba8-5328-9048-d86f2a52a09e`, option count was 4, browser errors 0.
- Screenshots: `/Users/piotrwisniewski/Developer/cto-codex/a-project1-p2-w249/project-switcher-light.png`, `/Users/piotrwisniewski/Developer/cto-codex/a-project1-p2-w249/project-switcher-dark-open.png`.

Gates:
- `git diff --check` PASS
- `npm run check:flagi:dockerfile` PASS: analyzed 206, docker ARG 218, missing 0
- `npm run check:jezyk:ci` PASS, no growth
- `scripts/check-list-canon.sh` PASS, 345 <= 346
- `scripts/check-artefakt.sh` PASS, 8 / 0 / 117 baseline unchanged

No migrations. No protected branch push. No staging/demo/prod writes.
