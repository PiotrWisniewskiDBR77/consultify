/**
 * SIDE_EFFECT_TOOLS — single source of truth for which `toolDefinitions.ts`
 * tools mutate/propose state and must therefore pause a plan at
 * `awaiting_approval` before running (Piotr semantics: aprobata przed
 * mutacją — see _KONCEPT_HP4_AGENT_W_TERESIE.md §3 "Bezpieczeństwo").
 *
 * Split out of `agentPlannerService.ts` into its own module (HP-4 F1) so
 * `planBuilderService.ts` (manifest -> steps) can read the same list without
 * importing the whole planner service — that module is mocked wholesale in
 * `tests/unit/backend/agentPlan.routes.test.ts`, and a second consumer
 * depending on that mock's shape would be a hidden coupling. Both
 * `agentPlannerService.createPlan` (the actual gate — computes each step's
 * persisted `requiresApproval`) and `planBuilderService.buildPlanFromManifest`
 * (a read-only preview of the same flag, for the panel/audit trail) import
 * from here — one list, two readers.
 */
export const SIDE_EFFECT_TOOLS = new Set([
  'create_initiative_draft',
  'generate_report_section',
  'schedule_meeting',
  'create_notebook_entry',
  'query_structured_data',
  // My Work writers (2026-07-26, decyzja właściciela — Harvey benchmark: agent
  // proponuje, człowiek zatwierdza). Do tej daty te trzy pisały do bazy od razu
  // — jedyne trzy z `AI_TOOLS`/`executeToolCall` bez bramki, mimo że wprost
  // mutują `tasks`/`decisions`. Zob. toolDefinitions.ts nagłówek "Teresa
  // last-mile" — opisy narzędzi tam zaktualizowane w tym samym commicie.
  'create_task',
  'update_task',
  'create_decision',
]);
