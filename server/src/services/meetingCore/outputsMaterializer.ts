/**
 * outputsMaterializer.ts — the pluggable seam between the output-approval
 * saga (outputs.ts) and the CANONICAL target services (TaskService,
 * decisionService).
 *
 * WHY A SEAM INSTEAD OF A DIRECT IMPORT (BLOKER 2 + test isolation)
 * --------------------------------------------------------------------
 * `server/src/services/TaskService.ts` statically imports
 * `notificationService.ts`, which statically imports
 * `../database/Database.js`, which statically imports
 * `../config/DatabaseConfig.ts` — a module that validates environment
 * variables at IMPORT time and can call `process.exit(1)` on
 * misconfiguration (server/src/config/DatabaseConfig.ts). `decisionService.ts`
 * has the same chain via its own `getDatabase` import. If `outputs.ts` (or
 * anything reachable from `tests/meeting-core/domain/**`) statically imported
 * either service, importing the test file would risk running that
 * validation/exit logic — exactly the "silent/foreign DB contamination"
 * failure mode `tests/meeting-core/pg/scratchPg.ts` exists to prevent.
 *
 * So: `outputs.ts` only knows about the `OutputTargetMaterializer`
 * interface below. `createProductionMaterializer()` is the ONLY place that
 * touches TaskService/decisionService, and it does so with DYNAMIC
 * `import()` calls made lazily inside each method — never at module load.
 * Production wiring (meeting.routes.ts) calls
 * `createProductionMaterializer(actorUserId)`; tests inject their own fake
 * implementation that writes into the scratch-PG `tasks`/`decisions` tables
 * from tests/meeting-core/pg/schema.ts.
 */

export interface MaterializedTarget {
  id: string;
}

export interface CreateTaskTargetInput {
  organizationId: string;
  title: string;
  description?: string;
  /** Written to tasks.source_id (source_type='MEETING_OUTPUT') for recovery lookups. */
  sourceId: string;
}

export interface CreateDecisionTargetInput {
  organizationId: string;
  title: string;
  description?: string;
  decisionMakerId: string;
  /** Written to decisions.source_id (source_type='MEETING_OUTPUT') for recovery lookups. */
  sourceId: string;
}

export const MEETING_OUTPUT_SOURCE_TYPE = 'MEETING_OUTPUT';

export interface OutputTargetMaterializer {
  createTask(input: CreateTaskTargetInput): Promise<MaterializedTarget>;
  createDecision(input: CreateDecisionTargetInput): Promise<MaterializedTarget>;
  /** Recovery lookup: does a task with this (org, source_id) already exist? Never trust canonical_id alone — see outputs.ts. */
  findTaskBySource(organizationId: string, sourceId: string): Promise<MaterializedTarget | null>;
  findDecisionBySource(
    organizationId: string,
    sourceId: string
  ): Promise<MaterializedTarget | null>;
}

/**
 * Production adapter. `actorUserId` is the server-derived acting user (never
 * from request body) — passed as `createdBy`/`decisionMakerId`-fallback to
 * the canonical services.
 */
export function createProductionMaterializer(actorUserId: string): OutputTargetMaterializer {
  return {
    async createTask(input) {
      const [{ TaskService }, dbModule] = await Promise.all([
        import('../TaskService.js'),
        import('../../database/Database.js'),
      ]);
      const db = dbModule.getDatabase();
      const taskService = new TaskService(db);
      const task = await taskService.createTask(
        {
          title: input.title,
          description: input.description,
          // TaskService.CreateTaskSchema extension — see TaskService.ts.
          sourceType: MEETING_OUTPUT_SOURCE_TYPE,
          sourceId: input.sourceId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        actorUserId
      );
      return { id: task.id };
    },

    async createDecision(input) {
      // `decisionService` is a DEFAULT export in decisionService.ts:838 — the
      // named binding used here previously did not exist and only surfaced in
      // `tsc` (the domain tests inject a fake materializer, so this production
      // adapter is never exercised by them). Use the module's named
      // `createDecision` wrapper (decisionService.ts:841) instead.
      const { createDecision } = await import('../decisionService.js');
      const decision = await createDecision({
        organizationId: input.organizationId,
        title: input.title,
        description: input.description,
        type: 'APPROVAL',
        decisionMakerId: input.decisionMakerId,
        createdBy: actorUserId,
        // decisionService.CreateDecisionInput extension — see decisionService.ts.
        sourceType: MEETING_OUTPUT_SOURCE_TYPE,
        sourceId: input.sourceId,
      });
      return { id: decision.id };
    },

    async findTaskBySource(organizationId, sourceId) {
      const { getDatabase } = await import('../../database/Database.js');
      const db = getDatabase();
      const row = await db.get<{ id: string }>(
        `SELECT id FROM tasks WHERE organization_id = ? AND source_type = ? AND source_id = ? LIMIT 1`,
        [organizationId, MEETING_OUTPUT_SOURCE_TYPE, sourceId]
      );
      return row ? { id: row.id } : null;
    },

    async findDecisionBySource(organizationId, sourceId) {
      const { getDatabase } = await import('../../database/Database.js');
      const db = getDatabase();
      const row = await db.get<{ id: string }>(
        `SELECT id FROM decisions WHERE organization_id = ? AND source_type = ? AND source_id = ? LIMIT 1`,
        [organizationId, MEETING_OUTPUT_SOURCE_TYPE, sourceId]
      );
      return row ? { id: row.id } : null;
    },
  };
}
