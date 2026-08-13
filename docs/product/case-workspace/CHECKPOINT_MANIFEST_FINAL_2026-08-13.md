# Case Workspace V1 — MANIFEST CHECKPOINTU FINALNEGO

Tryb: FINAL PRESERVATION. To jest bramka zabezpieczenia pracy, **nie odbiór
produktu**. Nic tu nie jest scalone, wdrożone ani zaakceptowane.

## Tozsamosc

| pole | wartosc |
|---|---|
| modul | Case Workspace V1 (Zlecenia) |
| wlasciciel produktu | Piotr Wisniewski |
| wykonawca | sesja agenta Claude, koordynator + pakiety Sonnet |
| worktree | `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809` |
| branch | `claude/case-workspace-v1-20260809` |
| baseline | `origin/demo` @ `9d17cac11484a82f729a51044e30453e39fbcb02` |
| merge-base | `9d17cac11484a82f729a51044e30453e39fbcb02` (identyczny z baseline — brak rebase) |
| **SHA testowany** | `44f00d154c1157e2ddb25550211790eaec118ca1` |
| **rodzic tego manifestu** | `c8c843a2e21bcfb3ad68ee8682d4917fd8172543` |
| commity baseline..rodzic | 119 |
| ahead/behind vs `origin/demo` (biezace) | 119 / 2 |

Ten plik **nie moze zawierac wlasnego SHA** — commit nie zna swojego skrotu.
SHA finalnego commita podany jest w raporcie sesji; tutaj podany jest jego
rodzic. Diff `rodzic..finalny` to wylacznie ten manifest.

## Prowieniencja

- commity wlasne: **119 / 119** — wszystkie autorstwa `s <s@l>`, ta sama galaz,
  brak commitow scalajacych (`--merges` = 0), brak cherry-pickow z cudzych galezi.
- commity odziedziczone: **BRAK**.
- zakres czasowy: 2026-08-09 → 2026-08-13

## Pliki wspoldzielone / kolizyjne

Pliki poza wlasnymi katalogami modulu, ktore ta galaz zmienia. Kazdy z nich
jest potencjalnym punktem konfliktu przy integracji i wymaga przegladu
hunk po hunku, a nie przyjecia calego pliku.

| plik | +/- | dlaczego dotkniety |
|---|---|---|
| `server/src/index.ts` | +59 -0 | bootstrap rejestru capability (env-gated) |
| `server/src/Gateway.ts` | +7 -0 | montaz tras Case Workspace |
| `server/src/database/DatabaseInitializer.ts` | +49 -10 | wspolny komparator kolejnosci migracji |
| `server/src/services/tablePlatform/migrationRunner.ts` | +61 -0 | tiebreaker kolejnosci migracji (blokada swiezej instalacji) |
| `server/scripts/migrate.postgres.ts` | +156 -9 | `--safe` przestal raportowac realna porazke jako `skipped`+exit 0 |
| `src/App.tsx` | +28 -0 | trasa modulu |
| `src/utils/enumLabels.ts` | +451 -0 | etykiety PL/EN modulu + naprawa kanonu statusow planu |
| `src/components/AIChat/MessageRenderer.tsx` | +21 -1 | osadzenie karty intake (patrz DEFEKTY) |
| `src/components/AIChat/CaseIntakeConfirmCard.tsx` | +224 -0 | nowa karta czatu |
| `server/src/routes/v8/chat.routes.ts` | +269 -1 | sciezka czat → Zlecenie |
| `server/src/routes/v8/teresa.routes.ts` | +168 -0 | j.w. |
| `server/src/routes/v10/teresa.routes.ts` | +201 -0 | j.w. |
| `server/src/services/v8/chatExecutionService.ts` | +81 -9 | j.w. |
| `server/src/services/presentationGeneratorService.ts` | +22 -2 | `createNativeDeck` |
| `src/components/navigation/BottomNavigation.tsx` | +3 -3 | tokeny `c-*` zamiast crimson |
| `src/components/shared/NModeLayout/NModeHeader.tsx` | +11 -1 | `aria-label` przycisku wstecz |
| `.claude/launch.json` | +21 -0 | **wspoldzielony miedzy sesjami** — nigdy `git checkout --` na nim |
| `scripts/check-triada.baseline.txt` | +0 -1 | baseline bezpiecznika kanonu list |

## Pelna lista zmienionych plikow (baseline..rodzic)

Razem: **781** plikow.

```
M	.claude/launch.json
A	docs/product/case-workspace/00_CASE_WORKSPACE_CANON.md
A	docs/product/case-workspace/01_PRODUCT_CANON_AND_MODES.md
A	docs/product/case-workspace/02_INFORMATION_ARCHITECTURE_AND_UX.md
A	docs/product/case-workspace/03_INTERACTION_RESPONSIVE_ACCESSIBILITY.md
A	docs/product/case-workspace/04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md
A	docs/product/case-workspace/05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md
A	docs/product/case-workspace/06_SECURITY_EVENTS_OBSERVABILITY.md
A	docs/product/case-workspace/07_LEGACY_MIGRATION_AND_DELIVERY_PLAN.md
A	docs/product/case-workspace/08_GOVERNANCE_AUTONOMY_APPROVALS.md
A	docs/product/case-workspace/09_HISTORY_VALUE_REUSE_AND_PLAYS.md
A	docs/product/case-workspace/10_TEST_ACCEPTANCE_AND_GOLDEN_CASES.md
A	docs/product/case-workspace/11_OWNER_DECISION_REGISTER.md
A	docs/product/case-workspace/12_CASE_WORKSPACE_MODULE_SSOT.md
A	docs/product/case-workspace/13_CLAUDE_MULTI_AGENT_IMPLEMENTATION_MASTER_PLAN.md
A	docs/product/case-workspace/14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md
A	docs/product/case-workspace/15_FULL_EXECUTION_LAUNCH_MANIFEST_2026-08-09.md
A	docs/product/case-workspace/CANDIDATE_DOD_AUDIT_2026-08-12.md
A	docs/product/case-workspace/CANDIDATE_GATES_REPORT.md
A	docs/product/case-workspace/CHECKPOINT_MANIFEST_2026-08-12.txt
A	docs/product/case-workspace/CODEX_REVIEW_REPORT_2026-08-11.md
A	docs/product/case-workspace/FINAL_HANDOFF_2026-08-13.md
A	docs/product/case-workspace/LIVE_STACK_RUNBOOK.md
A	docs/product/case-workspace/PERFORMANCE_EVIDENCE.md
A	docs/product/case-workspace/RESUME_HANDOFF_2026-08-11.md
A	docs/product/case-workspace/RESUME_HANDOFF_2026-08-12.md
A	docs/product/case-workspace/SUCCESSOR_PROMPT_2026-08-11.md
A	docs/product/case-workspace/SUCCESSOR_PROMPT_2026-08-12_WAVE_E.md
A	docs/product/case-workspace/TERMINAL_STATUS_2026-08-12.md
A	docs/product/case-workspace/TEST_DETERMINISM_REPORT.md
A	docs/product/case-workspace/VOICEOVER_MANUAL_RUNBOOK.md
A	docs/product/case-workspace/acceptance/API_EVENT_SCHEMA_COVERAGE.csv
A	docs/product/case-workspace/acceptance/CARTESIAN_UX_COVERAGE.csv
A	docs/product/case-workspace/acceptance/CODEBASE_CONVERGENCE_MAP.csv
A	docs/product/case-workspace/acceptance/CUSTOMER_JOURNEY_LEDGER.csv
A	docs/product/case-workspace/acceptance/DEPENDENCY_GRAPH.md
A	docs/product/case-workspace/acceptance/EPIC_DOD_COVERAGE.csv
A	docs/product/case-workspace/acceptance/EVENT_TAXONOMY.md
A	docs/product/case-workspace/acceptance/FUNCTIONAL_REQUIREMENT_COVERAGE.csv
A	docs/product/case-workspace/acceptance/GOLDEN_CASE_EVIDENCE_LEDGER.csv
A	docs/product/case-workspace/acceptance/LEDGER_SNAPSHOT.md
A	docs/product/case-workspace/acceptance/LEGACY_MIGRATION_PARITY.csv
A	docs/product/case-workspace/acceptance/PACKET_REGISTRY.md
A	docs/product/case-workspace/acceptance/README.md
A	docs/product/case-workspace/acceptance/RESPONSIVE_ACCESSIBILITY_LEDGER.csv
A	docs/product/case-workspace/acceptance/SCOPE_ADJUDICATION.md
A	docs/product/case-workspace/acceptance/SECURITY_RESILIENCE_MATRIX.csv
A	docs/product/case-workspace/acceptance/TRACEABILITY_AUTH_ROUTES.csv
A	docs/product/case-workspace/acceptance/VISUAL_TRIADA_SPEC_A_LEDGER.csv
A	docs/product/case-workspace/api/openapi.yaml
A	docs/product/case-workspace/evidence/c3-live-e2e-2026-08-12/C3_CLASSIFICATION_REPORT.md
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/README.md
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/capture-keyboard.mjs
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/capture-mobile-scroll.mjs
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/capture-theme-fix.mjs
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/capture.mjs
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/deeplink-01-direct-url-fresh-tab.png
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/desktop-dark-four-states-table.png
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/desktop-light-four-states-table.png
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/focus-repro.mjs
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/keyboard-01-focused-before-open.png
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/keyboard-02-opened-target-module.png
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/keyboard-03-returned-focus-restored.png
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/keyboard-results.json
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/mobile-dark-four-states-table.png
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/mobile-dark-otworz-column-scrolled.png
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/mobile-light-four-states-table.png
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/refresh-01-results-tab-survived.png
A	docs/product/case-workspace/evidence/c4-deliverable-ui-2026-08-12/run-results.json
A	docs/product/case-workspace/evidence/e4-long-run-2026-08-12/01-before-restart-db-snapshot.json
A	docs/product/case-workspace/evidence/e4-long-run-2026-08-12/02-after-restart-db-snapshot.json
A	docs/product/case-workspace/evidence/e4-long-run-2026-08-12/03-final-db-snapshot.json
A	docs/product/case-workspace/evidence/e4-long-run-2026-08-12/04-memory-and-latency.json
A	docs/product/case-workspace/evidence/e5-a11y-matrix-2026-08-12/01_WIDTH_THEME_AXE_MATRIX.md
A	docs/product/case-workspace/evidence/e5-a11y-matrix-2026-08-12/02_KEYBOARD_FOCUS_DEEPLINK_STATES_ZOOM.md
A	docs/product/case-workspace/evidence/e7-migration-paths-2026-08-12/MIGRATION_PATH_ASSESSMENT.md
A	docs/product/case-workspace/evidence/f2-bottomnav-contrast-2026-08-12/.gitignore
A	docs/product/case-workspace/evidence/f2-bottomnav-contrast-2026-08-12/README.md
A	docs/product/case-workspace/evidence/f2-bottomnav-contrast-2026-08-12/build.sh
A	docs/product/case-workspace/evidence/f2-bottomnav-contrast-2026-08-12/fixture.html
A	docs/product/case-workspace/evidence/f2-bottomnav-contrast-2026-08-12/measure.cjs
A	docs/product/case-workspace/evidence/f2-bottomnav-contrast-2026-08-12/nav-dark-after.png
A	docs/product/case-workspace/evidence/f2-bottomnav-contrast-2026-08-12/nav-dark-before.png
A	docs/product/case-workspace/evidence/f2-bottomnav-contrast-2026-08-12/nav-light-after.png
A	docs/product/case-workspace/evidence/f2-bottomnav-contrast-2026-08-12/nav-light-before.png
A	docs/product/case-workspace/evidence/f2-bottomnav-contrast-2026-08-12/package.json
A	docs/product/case-workspace/evidence/f2-bottomnav-contrast-2026-08-12/results.json
A	docs/product/case-workspace/evidence/f2-bottomnav-contrast-2026-08-12/screenshot.cjs
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/README.md
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/capture.mjs
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/desktop-dark-after-refresh.png
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/desktop-dark-after-reopen.png
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/desktop-dark-case-list-after-close.png
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/desktop-dark-node-results-table.png
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/desktop-dark-partial-preview.png
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/desktop-dark-skipped-preview.png
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/desktop-light-node-results-table.png
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/drive-states-output.json
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/drive-states.mjs
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/mobile-dark-node-results-fullpage.png
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/mobile-dark-node-results-scrolled-right.png
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/mobile-dark-node-results-table.png
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/mobile-light-node-results-table.png
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/run-results.json
A	docs/product/case-workspace/evidence/f3-partial-skipped-2026-08-12/scroll-check.mjs
A	docs/product/case-workspace/evidence/g1-nav-active-canon-2026-08-12/README.md
A	docs/product/case-workspace/evidence/g1-nav-active-canon-2026-08-12/build.sh
A	docs/product/case-workspace/evidence/g1-nav-active-canon-2026-08-12/compiled.css
A	docs/product/case-workspace/evidence/g1-nav-active-canon-2026-08-12/fixture.html
A	docs/product/case-workspace/evidence/g1-nav-active-canon-2026-08-12/measure.cjs
A	docs/product/case-workspace/evidence/g1-nav-active-canon-2026-08-12/nav-dark-after.png
A	docs/product/case-workspace/evidence/g1-nav-active-canon-2026-08-12/nav-dark-before.png
A	docs/product/case-workspace/evidence/g1-nav-active-canon-2026-08-12/nav-light-after.png
A	docs/product/case-workspace/evidence/g1-nav-active-canon-2026-08-12/nav-light-before.png
A	docs/product/case-workspace/evidence/g1-nav-active-canon-2026-08-12/package.json
A	docs/product/case-workspace/evidence/g1-nav-active-canon-2026-08-12/results.json
A	docs/product/case-workspace/evidence/g1-nav-active-canon-2026-08-12/screenshot.cjs
A	docs/product/case-workspace/evidence/g1-nav-active-canon-2026-08-12/tailwind.config.evidence.mjs
A	docs/product/case-workspace/evidence/l1-triada-speca-2026-08-12/README.md
A	docs/product/case-workspace/evidence/l2-ledgers-2026-08-12/README.md
A	docs/product/case-workspace/evidence/l3-axe-completion-2026-08-12/README.md
A	docs/product/case-workspace/evidence/l3-axe-completion-2026-08-12/build.sh
A	docs/product/case-workspace/evidence/l3-axe-completion-2026-08-12/compiled.css
A	docs/product/case-workspace/evidence/l3-axe-completion-2026-08-12/fixture.html
A	docs/product/case-workspace/evidence/l3-axe-completion-2026-08-12/measure.cjs
A	docs/product/case-workspace/evidence/l3-axe-completion-2026-08-12/package.json
A	docs/product/case-workspace/evidence/l3-axe-completion-2026-08-12/results.json
A	docs/product/case-workspace/evidence/m1-plan-authoring-ui-2026-08-12/README.md
A	docs/product/case-workspace/evidence/m2-approval-status-ui-2026-08-12/README.md
A	docs/product/case-workspace/evidence/m2-approval-status-ui-2026-08-12/fixture-and-check.sh
A	docs/product/case-workspace/evidence/m2-approval-status-ui-2026-08-12/tsc-exit.txt
A	docs/product/case-workspace/evidence/m4-triada-applicability-2026-08-12/README.md
A	docs/product/case-workspace/evidence/m5-journeys-2026-08-12/README.md
A	docs/product/case-workspace/evidence/n3-canon-label-fix-2026-08-12/README.md
A	docs/product/case-workspace/evidence/q1-plan-edit-loop-2026-08-12/README.md
A	docs/product/case-workspace/evidence/q2-scope-accounting-2026-08-12/CRITERIA_MATRIX_219.csv
A	docs/product/case-workspace/evidence/q2-scope-accounting-2026-08-12/README.md
A	docs/product/case-workspace/evidence/q3-case-closure-2026-08-12/README.md
A	docs/product/case-workspace/prototype-w2-v0/DECISIONS.md
A	docs/product/case-workspace/prototype-w2-v0/README.md
A	docs/product/case-workspace/prototype-w2-v0/css/shell.css
A	docs/product/case-workspace/prototype-w2-v0/css/tokens.css
A	docs/product/case-workspace/prototype-w2-v0/evidence/SCREENSHOT_INDEX.md
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__blocked__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__blocked__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__default__aktywnosc.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__default__plan-ekspercki.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__default__plan-lista.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__default__plan-prosty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__default__powiazania.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__default__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__default__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__default__return-to-case-overlay.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__default__rezultaty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__empty__plan-prosty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__empty__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__empty__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__empty__rezultaty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__error__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__loading__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__partial__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__partial__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__stale__plan-ekspercki.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__dark__stale__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__blocked__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__blocked__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__default__aktywnosc.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__default__plan-ekspercki.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__default__plan-lista.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__default__plan-prosty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__default__powiazania.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__default__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__default__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__default__return-to-case-overlay.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__default__rezultaty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__empty__plan-prosty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__empty__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__empty__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__empty__rezultaty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__error__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__loading__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__partial__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__partial__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__stale__plan-ekspercki.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__desktop__light__stale__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__blocked__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__blocked__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__default__aktywnosc.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__default__plan-ekspercki.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__default__plan-lista.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__default__plan-prosty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__default__powiazania.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__default__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__default__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__default__return-to-case-overlay.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__default__rezultaty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__empty__plan-prosty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__empty__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__empty__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__empty__rezultaty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__error__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__loading__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__partial__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__partial__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__stale__plan-ekspercki.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__dark__stale__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__blocked__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__blocked__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__default__aktywnosc.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__default__plan-ekspercki.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__default__plan-lista.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__default__plan-prosty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__default__powiazania.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__default__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__default__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__default__return-to-case-overlay.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__default__rezultaty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__empty__plan-prosty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__empty__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__empty__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__empty__rezultaty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__error__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__loading__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__partial__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__partial__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__stale__plan-ekspercki.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/case__mobile__light__stale__przeglad.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__dark__blocked.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__dark__default.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__dark__empty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__dark__error.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__dark__loading.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__dark__partial.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__dark__stale.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__light__blocked.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__light__default.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__light__empty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__light__error.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__light__loading.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__light__partial.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__desktop__light__stale.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__dark__blocked.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__dark__default.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__dark__empty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__dark__error.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__dark__loading.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__dark__partial.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__dark__stale.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__light__blocked.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__light__default.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__light__empty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__light__error.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__light__loading.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__light__partial.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/list__mobile__light__stale.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/not-found__desktop__dark.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/not-found__desktop__light.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/not-found__mobile__dark.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/screenshots/not-found__mobile__light.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/01__desktop-1440__dark__lista.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/02__desktop-1440__dark__plan-prosty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/03__desktop-1440__dark__plan-ekspercki.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/04__desktop-1440__dark__realizacja.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/05__desktop-1440__dark__rezultaty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/06__desktop-1440__light__plan-ekspercki.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/07__desktop-1440__light__rezultaty.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/08__mobile-375__light__lista.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/09__mobile-375__light__plan-lista.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/10__mobile-375__light__realizacja-blocked.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/11__mobile-375__dark__lista.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/12__mobile-375__dark__plan-lista.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/13__mobile-375__dark__realizacja-blocked.png
A	docs/product/case-workspace/prototype-w2-v0/evidence/w2v01/14__mobile-320__dark__dowod-braku-overflow.png
A	docs/product/case-workspace/prototype-w2-v0/index.html
A	docs/product/case-workspace/prototype-w2-v0/js/app.js
A	docs/product/case-workspace/prototype-w2-v0/js/labels.js
A	docs/product/case-workspace/prototype-w2-v0/screens/not-found.html
A	docs/product/case-workspace/prototype-w2-v0/screens/zlecenia-list.html
A	docs/product/case-workspace/prototype-w2-v0/screens/zlecenie.html
A	docs/program/CLAUDE_DELEGATION_OPERATING_RULE_2026-08-07.md
A	docs/qa/screens/audyt-a11y/measurements.json
A	docs/qa/screens/audyt-a11y/state-empty-zablokowane.png
A	docs/qa/screens/audyt-a11y/state-error-forced500.png
A	docs/qa/screens/audyt-a11y/zlecenia-1024-dark.png
A	docs/qa/screens/audyt-a11y/zlecenia-1024-light.png
A	docs/qa/screens/audyt-a11y/zlecenia-1440-dark.png
A	docs/qa/screens/audyt-a11y/zlecenia-1440-light.png
A	docs/qa/screens/audyt-a11y/zlecenia-1920-dark.png
A	docs/qa/screens/audyt-a11y/zlecenia-1920-light.png
A	docs/qa/screens/audyt-a11y/zlecenia-320-dark.png
A	docs/qa/screens/audyt-a11y/zlecenia-320-light.png
A	docs/qa/screens/audyt-a11y/zlecenia-375-dark.png
A	docs/qa/screens/audyt-a11y/zlecenia-375-light.png
A	docs/qa/screens/audyt-a11y/zlecenia-430-dark.png
A	docs/qa/screens/audyt-a11y/zlecenia-430-light.png
A	docs/qa/screens/audyt-a11y/zlecenia-768-dark.png
A	docs/qa/screens/audyt-a11y/zlecenia-768-light.png
A	docs/qa/screens/audyt-a11y/zoom200-640x400.png
A	docs/qa/screens/case-workspace-a11y-fix/p1a-01-header-taskdropdown-tab-focus-c-focus-blue.png
A	docs/qa/screens/case-workspace-a11y-fix/p1b-00-table-baseline-no-focus.png
A	docs/qa/screens/case-workspace-a11y-fix/p1b-01-tab-focuses-resize-handle.png
A	docs/qa/screens/case-workspace-a11y-fix/p1b-02-arrowright-grows-column-360-to-420.png
A	docs/qa/screens/case-workspace-a11y-fix/p1b-03-shift-arrowleft-large-step-420-to-372.png
A	docs/qa/screens/case-workspace-a11y-fix/p1b-04-escape-reverts-width-372-to-360.png
A	docs/qa/screens/case-workspace-a11y-fix/p1b-05-home-jumps-to-min-360-to-200.png
A	docs/qa/screens/case-workspace-a11y-fix/p1b-numeric-trace.json
A	docs/qa/screens/case-workspace-cardinality/01-lista-dwa-zlecenia-jeden-projekt.png
A	docs/qa/screens/case-workspace-cardinality/02-podglad-audyt.png
A	docs/qa/screens/case-workspace-cardinality/03-otwarte-wlasciwy-case.png
A	docs/qa/screens/case-workspace-e2e/01-lista-desktop-light.png
A	docs/qa/screens/case-workspace-e2e/02-lista-filtr-w-toku.png
A	docs/qa/screens/case-workspace-e2e/03-preview-desktop.png
A	docs/qa/screens/case-workspace-e2e/04-plan-prosty.png
A	docs/qa/screens/case-workspace-e2e/05-plan-ekspercki.png
A	docs/qa/screens/case-workspace-e2e/06-plan-ekspercki-po-przesunieciu.png
A	docs/qa/screens/case-workspace-e2e/07-plan-ekspercki-po-zoom.png
A	docs/qa/screens/case-workspace-e2e/08-plan-ekspercki-fit.png
A	docs/qa/screens/case-workspace-e2e/09-plan-lista.png
A	docs/qa/screens/case-workspace-e2e/10-realizacja.png
A	docs/qa/screens/case-workspace-e2e/11-rezultaty.png
A	docs/qa/screens/case-workspace-e2e/12a-back-po-zakladkach.png
A	docs/qa/screens/case-workspace-e2e/12b-back-kontrola-z-filtrem.png
A	docs/qa/screens/case-workspace-e2e/13-lista-dark.png
A	docs/qa/screens/case-workspace-e2e/14-plan-ekspercki-dark.png
A	docs/qa/screens/case-workspace-e2e/15-stan-blad.png
A	docs/qa/screens/case-workspace-e2e/15-stan-brak-dostepu.png
A	docs/qa/screens/case-workspace-e2e/15-stan-puste.png
A	docs/qa/screens/case-workspace-e2e/16-ekspercki-wybrany-krok.png
A	docs/qa/screens/case-workspace-e2e/17-back-po-zakladkach-wielokrotny.png
A	docs/qa/screens/case-workspace-e2e/18-desktop-duzy-graf-fit.png
A	docs/qa/screens/case-workspace-e2e/18-m320-duzy-graf-fit.png
A	docs/qa/screens/case-workspace-e2e/18-m430-duzy-graf-fit.png
A	docs/qa/screens/case-workspace-e2e/19-dark-plan-prosty.png
A	docs/qa/screens/case-workspace-e2e/19-dark-realizacja.png
A	docs/qa/screens/case-workspace-e2e/19-dark-rezultaty.png
A	docs/qa/screens/case-workspace-e2e/20-m320-ekspercki-kolizja.png
A	docs/qa/screens/case-workspace-e2e/20-m375-ekspercki-kolizja.png
A	docs/qa/screens/case-workspace-e2e/20-m430-ekspercki-kolizja.png
A	docs/qa/screens/case-workspace-e2e/21-m320-prosty-pigulki.png
A	docs/qa/screens/case-workspace-e2e/22-m320-przewiniete-w-prawo.png
A	docs/qa/screens/case-workspace-e2e/23-produkcyjna-powloka-bez-backendu.png
A	docs/qa/screens/case-workspace-e2e/_raport.json
A	docs/qa/screens/case-workspace-e2e/k1-375-fokus-wiecej.png
A	docs/qa/screens/case-workspace-e2e/k2-375-menu-otwarte.png
A	docs/qa/screens/case-workspace-e2e/k3-375-po-escape.png
A	docs/qa/screens/case-workspace-e2e/k4-375-po-wyborze.png
A	docs/qa/screens/case-workspace-e2e/m320-lista.png
A	docs/qa/screens/case-workspace-e2e/m320-plan-ekspercki.png
A	docs/qa/screens/case-workspace-e2e/m320-plan-lista.png
A	docs/qa/screens/case-workspace-e2e/m320-plan-prosty.png
A	docs/qa/screens/case-workspace-e2e/m320-realizacja.png
A	docs/qa/screens/case-workspace-e2e/m320-rezultaty.png
A	docs/qa/screens/case-workspace-e2e/m375-back-z-filtrem.png
A	docs/qa/screens/case-workspace-e2e/m375-lista.png
A	docs/qa/screens/case-workspace-e2e/m375-plan-ekspercki.png
A	docs/qa/screens/case-workspace-e2e/m375-plan-lista.png
A	docs/qa/screens/case-workspace-e2e/m375-plan-prosty.png
A	docs/qa/screens/case-workspace-e2e/m375-preview.png
A	docs/qa/screens/case-workspace-e2e/m375-realizacja.png
A	docs/qa/screens/case-workspace-e2e/m375-rezultaty.png
A	docs/qa/screens/case-workspace-e2e/m430-lista.png
A	docs/qa/screens/case-workspace-e2e/m430-plan-ekspercki.png
A	docs/qa/screens/case-workspace-e2e/m430-plan-lista.png
A	docs/qa/screens/case-workspace-e2e/m430-plan-prosty.png
A	docs/qa/screens/case-workspace-e2e/m430-realizacja.png
A	docs/qa/screens/case-workspace-e2e/m430-rezultaty.png
A	docs/qa/screens/case-workspace-e7/desktop-dark-01-zlecenia-lista.png
A	docs/qa/screens/case-workspace-e7/desktop-dark-02-plan-prosty.png
A	docs/qa/screens/case-workspace-e7/desktop-dark-03-plan-ekspercki.png
A	docs/qa/screens/case-workspace-e7/desktop-dark-04-realizacja.png
A	docs/qa/screens/case-workspace-e7/desktop-dark-05-rezultaty.png
A	docs/qa/screens/case-workspace-e7/desktop-dark-06-lista-podglad.png
A	docs/qa/screens/case-workspace-e7/desktop-dark-plan-ekspercki-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/desktop-dark-plan-prosty-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/desktop-light-01-zlecenia-lista.png
A	docs/qa/screens/case-workspace-e7/desktop-light-02-plan-prosty.png
A	docs/qa/screens/case-workspace-e7/desktop-light-03-plan-ekspercki.png
A	docs/qa/screens/case-workspace-e7/desktop-light-04-realizacja.png
A	docs/qa/screens/case-workspace-e7/desktop-light-05-rezultaty.png
A	docs/qa/screens/case-workspace-e7/desktop-light-06-lista-podglad.png
A	docs/qa/screens/case-workspace-e7/desktop-light-07-plan-ekspercki-po-interakcji.png
A	docs/qa/screens/case-workspace-e7/desktop-light-08-stan-pusty.png
A	docs/qa/screens/case-workspace-e7/desktop-light-09-stan-brak-dostepu.png
A	docs/qa/screens/case-workspace-e7/desktop-light-plan-ekspercki-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/desktop-light-plan-prosty-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/kontrola-regresji-1280-dark.png
A	docs/qa/screens/case-workspace-e7/kontrola-regresji-375-dark.png
A	docs/qa/screens/case-workspace-e7/mobile320-dark-plan-ekspercki-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile320-dark-plan-lista-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile320-dark-plan-prosty-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile320-dark-powrot-filtr-fokus-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile320-dark-zlecenia-lista-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile320-light-01-zlecenia-brak-overflow.png
A	docs/qa/screens/case-workspace-e7/mobile320-light-01-zlecenia-lista.png
A	docs/qa/screens/case-workspace-e7/mobile320-light-02-plan-ekspercki-brak-overflow.png
A	docs/qa/screens/case-workspace-e7/mobile320-light-06-plan-lista.png
A	docs/qa/screens/case-workspace-e7/mobile320-light-plan-ekspercki-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile320-light-plan-lista-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile320-light-plan-prosty-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile320-light-powrot-filtr-fokus-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile320-light-zlecenia-lista-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile375-dark-01-zlecenia-lista.png
A	docs/qa/screens/case-workspace-e7/mobile375-dark-02-plan-lista.png
A	docs/qa/screens/case-workspace-e7/mobile375-dark-06-plan-lista.png
A	docs/qa/screens/case-workspace-e7/mobile375-dark-plan-ekspercki-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile375-dark-plan-lista-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile375-dark-plan-prosty-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile375-dark-zlecenia-lista-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile375-light-01-zlecenia-lista.png
A	docs/qa/screens/case-workspace-e7/mobile375-light-02-plan-lista.png
A	docs/qa/screens/case-workspace-e7/mobile375-light-03-wiecej-klawiatura.png
A	docs/qa/screens/case-workspace-e7/mobile375-light-06-plan-lista.png
A	docs/qa/screens/case-workspace-e7/mobile375-light-plan-ekspercki-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile375-light-plan-lista-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile375-light-plan-prosty-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile375-light-zlecenia-lista-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile430-dark-plan-ekspercki-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile430-dark-plan-lista-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile430-dark-plan-prosty-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile430-dark-zlecenia-lista-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile430-light-plan-ekspercki-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile430-light-plan-lista-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile430-light-plan-prosty-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/mobile430-light-zlecenia-lista-po-naprawie.png
A	docs/qa/screens/case-workspace-e7/plan-lista-1280-dark.png
A	docs/qa/screens/case-workspace-e7/plan-lista-320-dark.png
A	docs/qa/screens/case-workspace-e7/plan-lista-375-dark.png
A	docs/qa/screens/case-workspace-e7/plan-lista-375-light.png
A	docs/qa/screens/case-workspace-e7/plan-lista-430-dark.png
A	docs/qa/screens/case-workspace-e7/zlecenia-lista-1280-dark.png
A	docs/qa/screens/case-workspace-e7/zlecenia-lista-320-dark.png
A	docs/qa/screens/case-workspace-e7/zlecenia-lista-375-dark.png
A	docs/qa/screens/case-workspace-e7/zlecenia-lista-375-light.png
A	docs/qa/screens/case-workspace-e7/zlecenia-lista-430-dark.png
A	docs/qa/screens/case-workspace-live-e2e/01-lista-zlecen.png
A	docs/qa/screens/case-workspace-live-e2e/02-zlecenie-plan.png
A	docs/qa/screens/case-workspace-live-e2e/03-zlecenie-realizacja.png
A	docs/qa/screens/case-workspace-live-e2e/04-zlecenie-rezultaty.png
A	docs/qa/screens/case-workspace-live-e2e/README.md
A	docs/qa/screens/case-workspace-live-e2e/_zadania-sieciowe.txt
A	docs/qa/screens/case-workspace-live-fix/01-lista-rozroznialne-nazwy-1440.png
A	docs/qa/screens/case-workspace-live-fix/02-plan-opublikowany-2-kroki-1440.png
A	docs/qa/screens/case-workspace-live-fix/03-plan-projekcja-lista-1440.png
A	docs/qa/screens/case-workspace-live-fix/04-rezultaty-tabela-pomiarow-1440.png
A	docs/qa/screens/case-workspace-live-fix/05-rezultaty-tabela-bez-obciecia-1440.png
A	docs/qa/screens/case-workspace-live-fix/06-historia-po-polsku-1440.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-1024-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-1024-light.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-1440-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-1440-light.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-1920-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-1920-light.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-320-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-320-light.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-375-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-375-light.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-430-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-430-light.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-768-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-ekspercki-768-light.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-1024-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-1024-light.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-1440-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-1440-light.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-1920-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-1920-light.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-320-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-320-light.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-375-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-375-light.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-430-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-430-light.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-768-dark.png
A	docs/qa/screens/case-workspace-responsive/plan-lista-768-light.png
A	docs/qa/screens/case-workspace-responsive/realizacja-1024-dark.png
A	docs/qa/screens/case-workspace-responsive/realizacja-1024-light.png
A	docs/qa/screens/case-workspace-responsive/realizacja-1440-dark.png
A	docs/qa/screens/case-workspace-responsive/realizacja-1440-light.png
A	docs/qa/screens/case-workspace-responsive/realizacja-1920-dark.png
A	docs/qa/screens/case-workspace-responsive/realizacja-1920-light.png
A	docs/qa/screens/case-workspace-responsive/realizacja-320-dark.png
A	docs/qa/screens/case-workspace-responsive/realizacja-320-light.png
A	docs/qa/screens/case-workspace-responsive/realizacja-375-dark.png
A	docs/qa/screens/case-workspace-responsive/realizacja-375-light.png
A	docs/qa/screens/case-workspace-responsive/realizacja-430-dark.png
A	docs/qa/screens/case-workspace-responsive/realizacja-430-light.png
A	docs/qa/screens/case-workspace-responsive/realizacja-768-dark.png
A	docs/qa/screens/case-workspace-responsive/realizacja-768-light.png
A	docs/qa/screens/case-workspace-responsive/realizacja-zoom200-1024-light.png
A	docs/qa/screens/case-workspace-responsive/realizacja-zoom200-1440-light.png
A	docs/qa/screens/case-workspace-responsive/realizacja-zoom200-640-light.png
A	docs/qa/screens/case-workspace-responsive/rezultaty-375-light.png
A	docs/qa/screens/case-workspace-results/01-rezultaty-wyniki-krokow.png
A	docs/qa/screens/case-workspace-results/02-rezultaty-partial-preview-otwieralne.png
A	docs/qa/screens/case-workspace-results/03-otworz-rezultat-document-studio.png
A	docs/qa/screens/case-workspace-results/04-powrot-po-otwarciu.png
A	docs/qa/screens/case-workspace-results/05-powiazany-obiekt-niedostepny.png
A	docs/qa/screens/case-workspace-results/06-po-odswiezeniu.png
A	docs/qa/screens/case-workspace-spec-a-fix/po-P1a-1-menu1.png
A	docs/qa/screens/case-workspace-spec-a-fix/po-P1a-2-powiazania.png
A	docs/qa/screens/case-workspace-spec-a-fix/po-P1b-1-realizacja-tab.png
A	docs/qa/screens/case-workspace-spec-a-fix/po-P1b-2-historia-panel.png
A	docs/qa/screens/case-workspace-spec-a-fix/po-P1c-historia-panel.png
A	docs/qa/screens/case-workspace-spec-a-fix/po-console.json
A	docs/qa/screens/case-workspace-spec-a-fix/przed-P1a-1-menu1.png
A	docs/qa/screens/case-workspace-spec-a-fix/przed-P1a-2-powiazania.png
A	docs/qa/screens/case-workspace-spec-a-fix/przed-P1b-1-realizacja-tab.png
A	docs/qa/screens/case-workspace-spec-a-fix/przed-P1b-2-historia-panel.png
A	docs/qa/screens/case-workspace-spec-a-fix/przed-P1c-historia-panel.png
A	docs/qa/screens/case-workspace-spec-a-fix/przed-console.json
A	docs/qa/screens/case-workspace-spec-a/01-powloka-artefaktu-dark.png
A	docs/qa/screens/case-workspace-spec-a/01-powloka-artefaktu-light.png
A	docs/qa/screens/case-workspace-spec-a/02-prawy-panel-powiazania-dark.png
A	docs/qa/screens/case-workspace-spec-a/02-prawy-panel-powiazania-light.png
A	docs/qa/screens/case-workspace-spec-a/03-sekcja-plan-dark.png
A	docs/qa/screens/case-workspace-spec-a/03-sekcja-plan-light.png
A	docs/qa/screens/case-workspace-spec-a/04-rezultaty-tabela-otworz-dark.png
A	docs/qa/screens/case-workspace-spec-a/05-stan-niedostepny-dark.png
A	docs/qa/screens/case-workspace-spec-a/05b-podglad-otwieralny-dark.png
A	docs/qa/screens/case-workspace-spec-a/06-przed-otwarciem-dark.png
A	docs/qa/screens/case-workspace-spec-a/07-otwarty-deliverable-dark.png
A	docs/qa/screens/case-workspace-spec-a/07c-ryzyko-modul-wylaczony-dark.png
A	docs/qa/screens/case-workspace-spec-a/08-powrot-scroll-fokus-dark.png
A	docs/qa/screens/case-workspace-spec-a/09-brak-dostepu-dark.png
A	docs/qa/screens/case-workspace-spec-a/10-brak-rezultatu-light.png
A	docs/qa/screens/case-workspace-spec-a/_POMIARY.txt
A	docs/qa/screens/case-workspace-teresa/01-dowod-http-i-baza.png
A	docs/qa/screens/case-workspace-teresa/README.md
A	docs/qa/screens/case-workspace-teresa/_dowod.html
A	docs/qa/screens/case-workspace-teresa/_select-i-outbox.txt
A	docs/qa/screens/case-workspace-teresa/_zadania-sieciowe.txt
A	docs/qa/screens/case-workspace-terminal-e2e/README.md
A	docs/qa/screens/case-workspace-wave-b/a11y-log.txt
A	docs/qa/screens/case-workspace-wave-b/deep-link-plan-ekspercki.png
A	docs/qa/screens/case-workspace-wave-b/matrix-results.json
A	docs/qa/screens/case-workspace-wave-b/realizacja-1024-dark.png
A	docs/qa/screens/case-workspace-wave-b/realizacja-1024-light.png
A	docs/qa/screens/case-workspace-wave-b/realizacja-1440-dark.png
A	docs/qa/screens/case-workspace-wave-b/realizacja-1440-light.png
A	docs/qa/screens/case-workspace-wave-b/realizacja-1920-dark.png
A	docs/qa/screens/case-workspace-wave-b/realizacja-1920-light.png
A	docs/qa/screens/case-workspace-wave-b/realizacja-320-dark.png
A	docs/qa/screens/case-workspace-wave-b/realizacja-320-light.png
A	docs/qa/screens/case-workspace-wave-b/realizacja-375-dark.png
A	docs/qa/screens/case-workspace-wave-b/realizacja-375-light.png
A	docs/qa/screens/case-workspace-wave-b/realizacja-430-dark.png
A	docs/qa/screens/case-workspace-wave-b/realizacja-430-light.png
A	docs/qa/screens/case-workspace-wave-b/realizacja-768-dark.png
A	docs/qa/screens/case-workspace-wave-b/realizacja-768-light.png
A	docs/qa/screens/case-workspace-wave-b/zoom-200-realizacja.png
A	docs/ui-standards/MY_WORK_TABLE_SURFACE_CONTRACT_V1.md
A	scripts/case-workspace/ledger-report.mjs
M	scripts/check-triada.baseline.txt
A	scripts/dev/case-workspace-local-backend.sh
A	scripts/dev/case-workspace-seed-local.mjs
A	server/migrations/20260809_case_workspace_artifact_links.sql
A	server/migrations/20260809_case_workspace_capability_registry.sql
A	server/migrations/20260809_case_workspace_case_core.sql
A	server/migrations/20260809_case_workspace_case_plan_version.sql
A	server/migrations/20260809_case_workspace_execution_graph.sql
A	server/migrations/20260809_case_workspace_history_value.sql
A	server/migrations/20260809_case_workspace_migration_readiness.sql
A	server/migrations/20260809_case_workspace_plays.sql
A	server/migrations/20260809_case_workspace_proposals_approvals.sql
A	server/migrations/20260809_case_workspace_run_binding.sql
A	server/migrations/20260809_case_workspace_wait_subscription.sql
A	server/migrations/20260810_case_workspace_event_outbox.sql
A	server/migrations/20260810_case_workspace_node_run_and_inbox.sql
A	server/migrations/20260810c_case_workspace_inbox_ambiguous_code.sql
A	server/migrations/20260810d_case_workspace_case_identity.sql
A	server/migrations/20260810e_case_workspace_event_correlation.sql
A	server/migrations/20260810f_case_workspace_append_only_guards.sql
A	server/migrations/20260811a_case_workspace_run_lifecycle.sql
A	server/migrations/20260812a_case_workspace_outbox_next_retry_at.sql
A	server/scripts/case-workspace-realdb-harness/EVIDENCE.md
A	server/scripts/case-workspace-realdb-harness/harnessFixtures.ts
A	server/scripts/case-workspace-realdb-harness/task4_insert_markers.ts
A	server/scripts/case-workspace-realdb-harness/task4_readback_markers.ts
A	server/scripts/case-workspace-realdb-harness/task5a_claim_timer_wait_race.ts
A	server/scripts/case-workspace-realdb-harness/task5b_create_action_proposal_race.ts
A	server/scripts/case-workspace-realdb-harness/task5c_capability_and_history_dedupe_race.ts
A	server/scripts/case-workspace-realdb-harness/verify_schema_vs_migrations.ts
M	server/scripts/migrate.postgres.ts
M	server/scripts/run-migrations-staging.cjs
M	server/src/Gateway.ts
M	server/src/database/DatabaseInitializer.ts
M	server/src/index.ts
A	server/src/routes/caseWorkspace/__tests__/actionProposals.routes.test.ts
A	server/src/routes/caseWorkspace/__tests__/artifactLinks.routes.test.ts
A	server/src/routes/caseWorkspace/__tests__/capabilities.routes.test.ts
A	server/src/routes/caseWorkspace/__tests__/caseHistory.routes.test.ts
A	server/src/routes/caseWorkspace/__tests__/casePlanVersions.routes.test.ts
A	server/src/routes/caseWorkspace/__tests__/cases.routes.test.ts
A	server/src/routes/caseWorkspace/__tests__/contract/casesLifecycle.contract.pg.test.ts
A	server/src/routes/caseWorkspace/__tests__/contract/contractHarness.ts
A	server/src/routes/caseWorkspace/__tests__/contract/errorAndAuthz.contract.pg.test.ts
A	server/src/routes/caseWorkspace/__tests__/contract/idempotencyAndPagination.contract.pg.test.ts
A	server/src/routes/caseWorkspace/__tests__/contract/openapiRouteParity.contract.test.ts
A	server/src/routes/caseWorkspace/__tests__/contract/openapiSchemaValidity.contract.test.ts
A	server/src/routes/caseWorkspace/__tests__/contract/readSurface.contract.pg.test.ts
A	server/src/routes/caseWorkspace/__tests__/executionGraph.routes.test.ts
A	server/src/routes/caseWorkspace/__tests__/migrationReadiness.routes.test.ts
A	server/src/routes/caseWorkspace/__tests__/play.routes.test.ts
A	server/src/routes/caseWorkspace/__tests__/runBindings.routes.test.ts
A	server/src/routes/caseWorkspace/__tests__/waitSubscriptions.routes.test.ts
A	server/src/routes/caseWorkspace/_shared/access.ts
A	server/src/routes/caseWorkspace/_shared/errors.ts
A	server/src/routes/caseWorkspace/_shared/handler.ts
A	server/src/routes/caseWorkspace/_shared/pagination.ts
A	server/src/routes/caseWorkspace/_shared/validate.ts
A	server/src/routes/caseWorkspace/actionProposals.routes.ts
A	server/src/routes/caseWorkspace/artifactLinks.routes.ts
A	server/src/routes/caseWorkspace/capabilities.routes.ts
A	server/src/routes/caseWorkspace/caseHistory.routes.ts
A	server/src/routes/caseWorkspace/casePlanVersions.routes.ts
A	server/src/routes/caseWorkspace/cases.routes.ts
A	server/src/routes/caseWorkspace/eventInbox.routes.ts
A	server/src/routes/caseWorkspace/executionGraph.routes.ts
A	server/src/routes/caseWorkspace/index.ts
A	server/src/routes/caseWorkspace/intake.routes.ts
A	server/src/routes/caseWorkspace/lightStart.routes.ts
A	server/src/routes/caseWorkspace/migrationReadiness.routes.ts
A	server/src/routes/caseWorkspace/play.routes.ts
A	server/src/routes/caseWorkspace/runBindings.routes.ts
A	server/src/routes/caseWorkspace/runLifecycle.routes.ts
A	server/src/routes/caseWorkspace/waitSubscriptions.routes.ts
M	server/src/routes/v10/teresa.routes.ts
M	server/src/routes/v8/chat.routes.ts
M	server/src/routes/v8/index.ts
M	server/src/routes/v8/teresa.routes.ts
A	server/src/services/__tests__/presentationGeneratorService.createNativeDeck.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/_helpers/fixtureCleanup.ts
A	server/src/services/caseWorkspace/__tests__/_helpers/outboxOrdering.ts
A	server/src/services/caseWorkspace/__tests__/_helpers/schemaBootstrapGuard.ts
A	server/src/services/caseWorkspace/__tests__/_helpers/testNamespace.ts
A	server/src/services/caseWorkspace/__tests__/adapters/_fixtures.ts
A	server/src/services/caseWorkspace/__tests__/adapters/decisionAdapter.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/adapters/financeAdapter.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/adapters/initiativeAdapter.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/adapters/kpiAdapter.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/artifactLinkService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/autonomyPolicyService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/capabilityAdapterService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/capabilityRegistryService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/caseCoreService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/caseHistoryService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/caseIntakeService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/casePlanVersionService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/caseWorkspaceAuthContext.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/e2e/liveStack.e2e.part2.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/e2e/liveStack.e2e.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/e2e/liveStackHarness.ts
A	server/src/services/caseWorkspace/__tests__/eventInboxService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/eventOutboxService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/executionGraphService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseApprovalRefused.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseDirectModuleLateBinding.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseHappyPath.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseHarness.ts
A	server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseLightOneClick.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseRequestChangesPartialRetry.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseTenancyRefusal.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseTransformationMultiModule.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/goldenCases/goldenCaseWaitExpiry.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/appendOnlyGuards.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/caseCardinality.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/chainTenancy.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/chatIntake.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/deliverableOpenReturn.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/fullChainObservability.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/gatewayAdvance.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/inboxIngress.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/lightOneClick.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/outboxWorker.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/partialResults.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/polishIntent.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/resilience.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/runRuntime.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/integration/teresaProductionIntake.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/lightOneClickService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/longRun/thirtyMinuteRun.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/migrationReadinessService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/nodeRunService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/perf/outboxThroughput.perf.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/performance/lib/dbLifecycle.ts
A	server/src/services/caseWorkspace/__tests__/performance/lib/envInfo.ts
A	server/src/services/caseWorkspace/__tests__/performance/lib/fixtures.ts
A	server/src/services/caseWorkspace/__tests__/performance/lib/graphBuilder.ts
A	server/src/services/caseWorkspace/__tests__/performance/lib/runProfile.ts
A	server/src/services/caseWorkspace/__tests__/performance/lib/stats.ts
A	server/src/services/caseWorkspace/__tests__/performance/orchestrate.ts
A	server/src/services/caseWorkspace/__tests__/performance/runProfileMain.ts
A	server/src/services/caseWorkspace/__tests__/playService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/proposalApprovalService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/runBindingService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/runLifecycleService.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/runSemantics.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/security/artifactLinkService.security.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/security/caseCoreService.security.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/security/newSurface.security.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/security/planVersionEnumeration.security.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/security/playService.security.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/security/playsEnumeration.security.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/security/proposalApprovalService.security.pg.test.ts
A	server/src/services/caseWorkspace/__tests__/waitSubscriptionService.pg.test.ts
A	server/src/services/caseWorkspace/adapters/__tests__/assessmentAdapter.pg.test.ts
A	server/src/services/caseWorkspace/adapters/__tests__/capabilityBootWiring.pg.test.ts
A	server/src/services/caseWorkspace/adapters/__tests__/capabilityBootstrap.pg.test.ts
A	server/src/services/caseWorkspace/adapters/__tests__/documentsAdapter.pg.test.ts
A	server/src/services/caseWorkspace/adapters/__tests__/resultsAdapter.pg.test.ts
A	server/src/services/caseWorkspace/adapters/_shared.ts
A	server/src/services/caseWorkspace/adapters/assessmentAdapter.ts
A	server/src/services/caseWorkspace/adapters/decisionAdapter.ts
A	server/src/services/caseWorkspace/adapters/documentsAdapter.ts
A	server/src/services/caseWorkspace/adapters/financeAdapter.ts
A	server/src/services/caseWorkspace/adapters/index.ts
A	server/src/services/caseWorkspace/adapters/initiativeAdapter.ts
A	server/src/services/caseWorkspace/adapters/kpiAdapter.ts
A	server/src/services/caseWorkspace/adapters/resultsAdapter.ts
A	server/src/services/caseWorkspace/artifactLinkService.ts
A	server/src/services/caseWorkspace/autonomyPolicyService.ts
A	server/src/services/caseWorkspace/capabilityAdapterService.ts
A	server/src/services/caseWorkspace/capabilityBootstrap.ts
A	server/src/services/caseWorkspace/capabilityRegistryService.ts
A	server/src/services/caseWorkspace/caseCoreService.ts
A	server/src/services/caseWorkspace/caseHistoryService.ts
A	server/src/services/caseWorkspace/caseIntakeService.ts
A	server/src/services/caseWorkspace/casePlanVersionService.ts
A	server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts
A	server/src/services/caseWorkspace/eventInboxService.ts
A	server/src/services/caseWorkspace/eventOutboxService.ts
A	server/src/services/caseWorkspace/executionGraphService.ts
A	server/src/services/caseWorkspace/lightOneClickService.ts
A	server/src/services/caseWorkspace/migrationReadinessService.ts
A	server/src/services/caseWorkspace/nodeRunService.ts
A	server/src/services/caseWorkspace/outboxWorker.ts
A	server/src/services/caseWorkspace/playService.ts
A	server/src/services/caseWorkspace/proposalApprovalService.ts
A	server/src/services/caseWorkspace/runBindingService.ts
A	server/src/services/caseWorkspace/runLifecycleService.ts
A	server/src/services/caseWorkspace/waitSubscriptionService.ts
M	server/src/services/presentationGeneratorService.ts
M	server/src/services/tablePlatform/migrationRunner.ts
M	server/src/services/v8/chatExecutionService.ts
M	src/App.tsx
A	src/components/AIChat/CaseIntakeConfirmCard.tsx
M	src/components/AIChat/MessageRenderer.tsx
A	src/components/CaseWorkspace/CaseDetailScreen.tsx
A	src/components/CaseWorkspace/CaseWorkspaceHub.tsx
A	src/components/CaseWorkspace/CaseWorkspaceRoute.tsx
A	src/components/CaseWorkspace/CasesListScreen.tsx
A	src/components/CaseWorkspace/PlanGraphCanvas.tsx
A	src/components/CaseWorkspace/PlanView.tsx
A	src/components/CaseWorkspace/RealizacjaView.tsx
A	src/components/CaseWorkspace/RezultatyView.tsx
A	src/components/CaseWorkspace/api.ts
A	src/components/CaseWorkspace/apiIntake.ts
A	src/components/CaseWorkspace/apiLightStart.ts
A	src/components/CaseWorkspace/apiResults.ts
A	src/components/CaseWorkspace/caseWorkspaceFlag.ts
A	src/components/CaseWorkspace/podglad/README.md
A	src/components/CaseWorkspace/podglad/daneProbne.ts
A	src/components/CaseWorkspace/podglad/index.html
A	src/components/CaseWorkspace/podglad/main.tsx
A	src/components/CaseWorkspace/types.ts
A	src/components/CaseWorkspace/ui.tsx
M	src/components/TaskDropdown.tsx
M	src/components/navigation/BottomNavigation.tsx
M	src/components/shared/ModuleHub/FilterableTable.tsx
M	src/components/shared/NModeLayout/NModeHeader.tsx
A	src/components/shared/NModeLayout/__tests__/NModeHeader.a11y.test.tsx
M	src/components/standard/StandardTable.tsx
M	src/routes/AppRoutes.tsx
M	src/routes/routeConfig.ts
M	src/types/core.ts
M	src/utils/betaAccess.ts
M	src/utils/enumLabels.ts
A	tests/components/CaseWorkspace/PlanView.onDraftSaved.test.tsx
A	tests/components/navigation/BottomNavigation.activeStateCanon.test.tsx
A	tests/integration/case-workspace-fresh-install-migration-order.realdb.test.ts
A	tests/integration/migration-ordering-parity.realdb.test.ts
```

## Commity (baseline..rodzic)

```
80d75f24ce01751639e572226f4e52b30503cd22 docs(case-workspace): import planning corpus and referenced authorities
46b9c24045c89d9615abcc8653ced973c3a04915 docs(case-workspace): W1 baseline convergence map, coverage ledgers, packet registry
81e65dc2ab5e4144176b76c109d88260f857448d feat(case-workspace): CW-P01 E1 Case Core — case_core table + service
b2a7ba4dede6d67791d392881fec2c80b217ca7c docs(case-workspace): record CW-P01 status and accepted design decisions
9ad406a09bb53bea1b049eb0d34823b3b196e288 test(case-workspace): CW-P01 real-Postgres tests for caseCoreService
408e7b96452b7d03ed06eaa052133b8b214ce015 docs(case-workspace): ledger update — CW-P01 rows to IMPLEMENTED_AND_PROVEN/PARTIAL
1fe58aaef534c880662b2592855b26fb664a2950 feat(case-workspace): CW-P02 E2 CasePlanVersion — plan versions + view state
3332ed209f14c9dc2fd0182aad1aba0963d4964e docs(case-workspace): record CW-P02 status and accepted design decisions
391fcb2f30d475eeb0642582364b45d3ba1f4feb test(case-workspace): CW-P02 real-Postgres tests for casePlanVersionService
a07077e7102a71fca0e6e73378449930313e0e89 docs(case-workspace): ledger update — CW-P02 rows to IMPLEMENTED_AND_PROVEN/PARTIAL
84535b61d69a66d6fd404000f30f59559ed887b4 feat(case-workspace): CW-P03 E3 Capability Registry — namespaced case_workspace_*
b677e266171cdf6d5e9cb7e9c6ab4c799875322a docs(case-workspace): record CW-P03 status and accepted design decisions
6f7ae332df23d90f60e17d6b4311dbd4833374c1 test(case-workspace): CW-P03 real-Postgres tests for capabilityRegistryService
59f0e5a737a9d6b1581ffe882827d26307bd7c4e docs(case-workspace): ledger update — CW-P03 rows to IMPLEMENTED_AND_PROVEN/PARTIAL
2ede09b5b6a5fd30736e13b3e420062fc8503a14 feat(case-workspace): CW-P04 E4 Run<->CasePlanVersion binding
ba2930818f7db02bbca910249dc9bde4958eeeab docs(case-workspace): record CW-P04 status and accepted design decisions
9fd5e1d79fa669891309955e2a47fa016359e1cb test(case-workspace): CW-P04 real-Postgres tests for runBindingService
7ab8ee326a7c07df53e8b5682df34693adc8174c docs(case-workspace): ledger update — CW-P04 rows PROVEN/PARTIAL, CW-01-011 upgraded
b3e5f4c5242a468e58181ae202dc0c6d1a92e33e feat(case-workspace): CW-P05 E6 ActionProposal + approval/decision persistence
f6d03e23f29103974e435871c18bbaea54307d7d docs(case-workspace): record CW-P05 status, decisions, and packet-numbering note
6ef587a879bf52ea3efedab589a2cdf8dfeffbee test(case-workspace): CW-P05 real-Postgres tests for proposalApprovalService
d4ca24d371c3fadd876756fa34539254eede9bf3 docs(case-workspace): ledger update — CW-P05 rows to IMPLEMENTED_AND_PROVEN/PARTIAL
cbc65d7b428b2bc0cd74ae86c7e99874d31dc2cd feat(case-workspace): CW-P06 E5 WaitSubscription — durable human/timer waits
5b6c4b0bd0edb13cbc1c8874f1839514003c69ee docs(case-workspace): record CW-P06 status and accepted design decisions
7114bc9242f03b97a458ccdc58fb40167dc5b857 test(case-workspace): CW-P06 real-Postgres tests for waitSubscriptionService
41b9d0adc3f4b83747d595aa5954733954f5690b docs(case-workspace): ledger update — CW-P06 rows to IMPLEMENTED_AND_PROVEN/PARTIAL
1002af2a8941038219ff20d148878bd8765fd5f1 feat(case-workspace): CW-P07 E11 append-only history events + value measurements
c5a0895ef953860a591f772e40c78812e25e8cd1 docs(case-workspace): record CW-P07 status and accepted design decisions
27ad62bb6b7f1bbe585a0fe6974170fb230995e9 test(case-workspace): CW-P07 real-Postgres tests for caseHistoryService
9c2060287e4ad991179b5abfcd51557f4fc67d0d docs(case-workspace): ledger update — CW-P07 rows to IMPLEMENTED_AND_PROVEN/PARTIAL
b8a644a4f882301dd66d0ca030d71d30654ff780 feat(case-workspace): CW-P08 E12 reusable Plays — ProcessDefinition/ProcessVersion
44769e6bc90f9944cde2978bffda3d310105db46 fix(case-workspace): close CW-P08 cross-tenant instantiation gap
9cd8a8fa94b4783e9d30fff0fac9d23f68405461 docs(case-workspace): record CW-P08 status, decisions, and the cross-tenant fix
d5f766d0000ab5793f12df5576b3e5dd9c158276 test(case-workspace): CW-P08 real-Postgres tests for playService
f2d0c4f7b8835aea5c720978ae38009865e0e822 docs(case-workspace): ledger update — CW-P08 rows to IMPLEMENTED_AND_PROVEN/PARTIAL
21d8578ba52f87e16a90a0e888588d5fbc9ef60a feat(case-workspace): CW-P09 E10 CaseArtifactLink — typed late-binding artifact pointers
e9eb3c44a5e8b43143945508470cdfc83a0417f3 docs(case-workspace): record CW-P09 status and accepted design decisions
4f5fb3cd196cba4527b67bee3e50abf61cf5e03b test(case-workspace): CW-P09 real-Postgres tests for artifactLinkService
87123ce5479e9dc2337361d7a7f0d7a74a5a27e0 docs(case-workspace): ledger update — CW-P09 rows to IMPLEMENTED_AND_PROVEN
1920cdf1ff6f5677d19519dbc1cbc518420b4548 feat(case-workspace): CW-P10 E9 gateway evaluation + node result-acceptance
0bde96a79094a730b588330b2d81671ca279d956 docs(case-workspace): record CW-P10 status
e1613df030f30fc198d4adaa73c97283b6376a22 test(case-workspace): CW-P10 real-Postgres tests for executionGraphService
42d1a81fa186288fc72383b745645ce5db29cd0f docs(case-workspace): ledger update — CW-P10 rows to IMPLEMENTED_AND_PROVEN/PARTIAL
c11b43f40a5b521ee73d402679fda3566281d417 feat(case-workspace): CW-P11 E13 migration readiness — flags + legacy quarantine
cb8a00dac76f760f625cf7468478a3140ea3c8fb docs(case-workspace): record CW-P11 status
85533516cb7960a6ec9df40db157581162b1f925 test(case-workspace): CW-P11 real-Postgres tests for migrationReadinessService
0067c9eb67a5be56d5a565344cae50a51e37b9dc docs(case-workspace): ledger update — CW-P11 rows to IMPLEMENTED_AND_PROVEN/PARTIAL
cbbc97f95c195b911cb31417222bee1e767568ae feat(case-workspace): CW-P12 shared tenant/membership authorization primitive
f147877c0fb4f3d1359484369e6e12b92c062f31 fix+test(case-workspace): CW-P12 TIMESTAMPTZ bug + real-Postgres tests
8995c05d0ebc3fa1d4aae9a8488787daf227d997 docs(case-workspace): ledger update — CW-P12 security rows to IMPLEMENTED_AND_PROVEN/PARTIAL
c4d059a63a92291c99326b8f99a393b84b5b4857 docs(case-workspace): record CW-P12 status and 12-packet checkpoint summary
c4374eb5dd898d72ad0ab195621c639f4c449444 feat(caseWorkspace): wire authorization checks into all 11 domain services (CW-P12 retrofit)
a5e4009b52a4e443c5b10dd355d8f47be7c1e327 test(caseWorkspace): seed real org membership and add auth negative tests (CW-P12)
e416096d15bfce0979b71713b32782f4afe70a80 fix(case-workspace): fan-in Stream A — 3 real test regressions found by realDB run
10ac81b5c063f12b4a31d8f62ecf97fb81c163cb feat(case-workspace): CW-W2V0 non-production prototype (Stream D fan-in)
35afcbe28c99869710e08630c04fc2303e8cdf8f fix(migrations): explicit intra-day order for the 11 case_workspace migrations
8e3ef2bf8ba69ddc12a35bdc34c8815d3f35c32f feat(case-workspace): mount typed HTTP routes for all 12 packets
715c1bd5b87f0f466729f910c3699e2d309458e7 docs(case-workspace): close out realdb-harness Task 1 with fixed-and-reverified evidence
e43d0977052d4c280c6b09ca2fd163cd9898f355 wip(w2v01): PL label map + data-i18n sweep (checkpoint, graph/mobile/diet still open)
b87eca20697c3269f4515c1c890077c7f0a178cb feat(case-workspace): event/audit spine — transactional outbox wired into all 11 services
24b5952f9be471cb79756fad6fdfbf17e67ba563 feat(w2v01): corrective UX pass + honest DoD ledger audit
572d0b3a29c3dcbd425761db5d527fc89fafedec docs(case-workspace): traceability with real event evidence + DoD corrections
ff9e6859b9088270b63220538e94b64de583d646 fix(case-workspace): close the instantiateProcessVersion event gap properly
aca3ee9ffc1fb3469e9dcc3055a51e51b32555b0 docs(case-workspace): retire the instantiateProcessVersion GAP row — the gap is closed
b0f033eb635db90307353c849c898e005a9203af feat(case-workspace): intake, autonomy A0-A4, NodeRun/inbox/adapters, OpenAPI + golden cases
f6497e8e74e65bb49d466e959f1d048807360d85 wip(case-workspace): production UI scaffold behind an off-by-default flag
43c718083694ce0b9d67dfa952257503b92b2064 feat(case-workspace): production UI registered behind a flag + adversarial audit of the new surface
4e06c45f39e1168ccc0c90c9ceb72b05024927b9 fix(case-workspace): close all five security holes found by the adversarial audit
62f2945701f61efbc92615a0e3d69b54c2a29af9 fix(ui): make the shared table's 980px floor opt-out, and close the ledgers honestly
c06b3d485ddc1a87a58b0a6c95aa6ffab0981d0f fix(tests): the mid-chain revocation test never revoked anything
1aedf980497e028064180bde7fe2d3a90657fd88 feat(dev): boot the real backend against the disposable Postgres, and give AMBIGUOUS its own code
7364551421ffe2baa7b762285b1e02a5f697c80d feat(case-workspace): live UI commands, chat intake on the real route, SPEC-A shell, responsive pass
cbfd32a48ad73d5b4c89c48d313e8cec1c79302d fix(case-workspace): close the five defects the live backend exposed
be4bb504d908c09cd7acb7da823bfda448b48d12 feat(case-workspace): many Cases per project, inbox ingress, LIGHT one-click, partial results, correlation
92fbb992851fce6e21c83b829230249470c8e350 fix(case-workspace): close the P0/P1 findings from seven independent skeptics
292bafd4e8689ceae1fe72fc17e5d4075c179256 fix(case-workspace): clear both typecheck gates and make POST /capabilities reachable
8c763a5a98cc35ade720e9e5211fe054591ed99a wip(case-workspace): waves A and B — Run/NodeRun runtime, gateways, adapters, PL classifier, outbox worker wired
ebe4046df95d92bb7559387f287aef8722060e04 docs(case-workspace): handoff, successor prompt and Codex report for the 2026-08-11 stop
472abebf8a109be26fa6e34730790069eecd5dd7 wip(case-workspace): wave C+D — adapters wired, run semantics, outbox resilience
48d54807e955c16e3698d1602c484bae54ed7a71 fix(case-workspace): fresh install could not boot — migration ordering inversion
5b7dcfc2638b4c15c926e33e5c0812e2a10d1d37 fix(case-workspace): server typecheck regression and stale append-only assertion
a565ce454ce732b86f4183d466b74b1aa707d679 fix(case-workspace): e2e files could not run together — shared mutable identity
cb96c748c1a38bea3c13e5ebbedc7d4b8e25e57c feat(case-workspace): capability bootstrap, OpenAPI offline validation, ledger truth
778c2fb058a09ac25c630458f1cafbc0e32740cb fix(case-workspace): ledger supersede chain, a11y matrix evidence
906cc6b532dc14e3893862dec371a80adc851ff2 fix(migrations): propagate ordering fix to sibling runners; --safe no longer lies
cb73de5e82522e369933b4e181a8a6742d316752 test(case-workspace): 30-minute Run closed with real wall-clock evidence
63a5d317246fc5d5d15d544e86f26808ef588b46 docs(case-workspace): successor prompt after wave E
b4a513bac0a5c64ad2624b4c29261b040371452d fix(a11y): back-button accessible name, bottom-nav contrast, real partial/skipped
8c4ddd9f0741d4fea77e49850d89a93e16ba4cd7 fix(a11y): bottom-nav active state was crimson — canon violation, not a colour taste
1d81d1c458d9a4933dde82694d6d36d861608cf7 fix(test): long-run evidence dir is opt-in; committed pack was incoherent
d02ebe924d1a75ca4c81614b39889f9b6712dbdc docs(case-workspace): VoiceOver manual runbook — BLOCKED_BY_HOST_PERMISSION
dbaaa4422d9c12ac066a564191d638cc5a1c57b2 fix(test): capability-registry test isolation; RETRACT the incoherence claim
e3d616b4b1912b585d7d720d706874a7aee74321 fix(test): serialize real-builtin-capability sections with an advisory lock
a36cc943644b584a2e0a135d493c11a0bed321eb fix(test): isolate assessment/results adapter capability ids — third and last instance
a8003082a3059356db6fa48568543feb7a9736cb docs(ledgers): three untouched ledgers now tell the truth — GAP rose, as it should
1309a8965f585adae903e8882b99504ddc02fb7e docs(a11y): full axe matrix — 56/56 cells clean; the "remaining serious" was a phantom
4903ac36e93ae05fb926f20fafe3ed5b249bfe90 fix(ledgers): CRLF on two appended rows broke git diff --check
c435abdb9507baf81e877c819c91d9c7844b5891 docs(ledgers): regenerate snapshot after L1/L2 evidence pass
1754ce048bc197a14922a91bdc8429929115c7fb docs(case-workspace): terminal status — BLOCKED on three items, only one is VoiceOver
2fe6e65c5847bc451d9ae4b76074f55b948d0008 feat(case-workspace): wire plan and proposal lifecycles into the UI
67e69f5a52d74edbe6b533ccdb984410dc6e32b3 docs(case-workspace): plan lifecycle proven in the browser — M1 no longer PARTIAL
68df34058ec733ca4a728ed1993eaa0bd9436e7d docs(case-workspace): proposal lifecycle proven in the browser — M2 no longer PARTIAL
0687420a61bb36c776721a1abd74d3674edbe13d docs(case-workspace): blocker 1 closed — plan and proposal lifecycles proven
c40fc7d382f27d98b7cdd3bd1a9e6c5ee7721a30 fix(case-workspace): case_core.current_plan_version_id is now written
1bfab9dde753cc2ecb14ba1a1ba718c9a9387305 docs(ledgers): 18 customer journeys reconciled with reality — GAP rose again
8e44775f3f6ec9deb7f86758b2fcdb654cc7aec7 fix(ledgers): CRLF on 19 appended journey rows broke git diff --check
b810e12e4a28f6af7eea14c1643b662f06a5ba7e docs(ledgers): TRIADA/SPEC-A applicability audit — 219 of 235 genuinely apply
0567368216a5588afb3e38f854000f0d171e8117 feat(case-workspace): wire updatePlanDraft — draft editing from all three views
d7a78cf7dacfd14bf6706bd4e864b8e613b59e68 fix(canon): plan-version status labels now match the canon; Comments gap adjudicated
91d300a607b25c70e0b29032c9962635cad32b50 docs(canon): OD-12 — Komentarze section deferred past V1, cited not dropped
36add5a24c006460a4b381ce6f8e5004eaf28ca2 feat(case-workspace): artifact-relations vertical — link, pin, unlink
5a2d7fce2791f6c68e808d3b3ad61767d06e8650 fix(test): isolate the four ORIGINAL adapter tests — fourth and final collision
cf709284d2be714976e1354fc19689e02c659a3c fix(case-workspace): close the plan-edit state loop — no more 409 after saving
d72eb749662c31910204fb88bf9ef7976e15f7be docs(case-workspace): checkpoint manifest — 160 files changed this session
060597a50b166802129a934b71ecfa27f616d549 docs(scope): defect-3 retracted, closure ruled IN V1, criteria matrix delivered
de5c986c69436ae2fb59c7e38deb46b561802b7d fix(evidence): CRLF in criteria matrix broke git diff --check
03c4dd8ab509c21ce2f0b23958e5ecf36fdc4f09 test(case-workspace): runtime proof + regression test for plan-edit reload loop
44f00d154c1157e2ddb25550211790eaec118ca1 feat(case-workspace): wire Case closure to the client and the UI
c8c843a2e21bcfb3ad68ee8682d4917fd8172543 docs(case-workspace): final handoff + stamp tested SHA into the criteria matrix
```


## Testy wykonane na SHA testowanym `44f00d154c`

| bramka | komenda (zakres cytowany doslownie) | exit | liczby |
|---|---|---|---|
| typecheck serwera | `tsc -p server --noEmit` | **0** | — |
| typecheck frontendu | `tsc --noEmit` | **0** | log 0 bajtow, 0 markerow crasha |
| suita modulu | `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=1 DATABASE_URL=…/case_workspace_test npx vitest run src/services/caseWorkspace/ src/routes/caseWorkspace/__tests__/ --exclude "**/e2e/**" --exclude "**/longRun/**" --environment node` (z `server/`) | **0** | **78/78 plikow · 619/619 testow · 0 skip** |
| e2e | oba pliki e2e w JEDNYM wywolaniu (rozdzielenie ukrywa interferencje miedzyplikowa) | **0** | **2/2 pliki · 34/34 testy** |
| swieza migracja od zera | `NODE_ENV=test … tsx server/scripts/migrate.postgres.ts` na pustej bazie | **0** | **598 zastosowanych · 1371 tabel** |
| idempotentny replay | j.w., drugi przebieg | **0** | **0 zastosowanych** |
| higiena | `git diff --check 9d17cac114..HEAD` | **0** | — |

`RUN_DB_TESTS=1 MOCK_DB=false` sa **warunkiem koniecznym** — bez nich
`NODE_ENV=test` po cichu mockuje baze i suita przechodzi przeciwko niczemu.

## Znane defekty i braki dowodowe

| pozycja | status | wlasciciel |
|---|---|---|
| VoiceOver | `BLOCKED_BY_HOST_PERMISSION` — dwa okna uprawnien odrzucone; NIE `PASS`, NIE `N/A` | wlasciciel hosta |
| odbior wizualny wlasciciela | **nie wykonany** — zaden ekran nie byl ogladany przez Piotra | Piotr |
| 218 z 225 wierszy macierzy kryteriow | `UNVERIFIED`, kazdy z nazwana grupa blokera | UI Case Workspace |
| prawy panel ponizej 1024px | `NModeShell.tsx:232` = `hidden lg:block`, brak zamiennika → zero akcji na mobile na **6 ekranach**; luka WCZESNIEJSZA, plik nietkniety przez 119 commitow | wspolna powloka, decyzja produktowa |
| osierocona karta czatu | `MessageRenderer.tsx` nie doklada typu metadanych renderujacego `CaseIntakeConfirmCard` | poza plikami modulu |
| `Komentarze` w prawym panelu | `DEFERRED_POST_V1` decyzja OD-12 | Piotr (zapisane) |
| 14 z 18 sciezek klienta | `PARTIAL`, kazda z nazwanym brakiem | UI Case Workspace |
| zrzuty ekranu dla dowodu petli planu | brak — rozszerzenie przegladarki przestalo odpowiadac PO zakonczeniu krokow dowodowych; dowod stoi na logach sieciowych i odczytach SQL | — |

## Rekomendowana metoda integracji

**SELECTIVE CHERRY-PICK / HUNK PORT**, nie merge calej galezi.

Uzasadnienie: 119 commitow dotyka **781 plikow**, z czego 18 lezy poza
katalogami modulu i nalezy do wspolnej powloki, bootstrapu serwera, mechanizmu
migracji i sciezki czatu. Te pliki zmieniaja sie rownolegle w innych sesjach —
przyjecie ich w calosci nadpisaloby cudza prace. Reszta (`server/src/*/caseWorkspace/`,
`src/components/CaseWorkspace/`, `server/migrations/*case_workspace*`,
`docs/product/case-workspace/`) jest wylacznie modulowa i przenosi sie czysto.

Kolejnosc wymuszona przez zaleznosci: migracje → serwis/trasy → bootstrap
(`server/src/index.ts`) → klient (`src/components/CaseWorkspace/`) → trasa
(`src/App.tsx`). Poprawka kolejnosci migracji
(`migrationRunner.ts` + `DatabaseInitializer.ts`) musi wejsc **przed** migracjami
modulu — bez niej swieza instalacja nie wstaje (`artifact_links` przed `case_core`).
