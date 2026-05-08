/**
 * Table AI Editor Levels — dispatcher (Block C · EPIC-T10 · Sprint C-S1)
 *
 * Routes a `proposeEdit` call to the level-specific handler. C-S1 ships
 * stub handlers that return a static "no-op" envelope so the orchestrator,
 * audit, and budget pipelines can be wired and tested end-to-end before
 * real LLM logic lands in C-S2 (levels 1–4) and C-S3 (levels 5–8).
 *
 * Every handler shares the same input/output contract so swapping a stub
 * for a real implementation is a one-line change in this file.
 */

import type { AiEditorLevel } from '../AiUsageService.js';

import { proposeCellEdit } from './cellLevel.js';
import { proposeColumnEdit } from './columnLevel.js';
import { proposeMethodologicalEdit } from './methodologicalLevel.js';
import { proposeRecordEdit } from './recordLevel.js';
import { proposeRelationalEdit } from './relationalLevel.js';
import { proposeSourceEdit } from './sourceLevel.js';
import { proposeStructureEdit } from './structureLevel.js';
import { proposeViewEdit } from './viewLevel.js';

export interface LevelStubInput {
  level: AiEditorLevel;
  tableId: string;
  prompt: string;
  context: Record<string, unknown>;
  organizationId: string;
}

export interface LevelStubOutput {
  /** "stub" until the corresponding C-S2/C-S3 sprint replaces the handler. */
  handlerStatus: 'stub' | 'live';
  summary: string;
  /** Operation envelopes proposed by the handler. C-S1 stubs emit []. */
  operations: unknown[];
  /** Soft warnings surfaced to the UI (e.g. "low-confidence proposal"). */
  warnings: string[];
  /** Heuristic confidence in [0,1]. C-S1 stubs emit 0. */
  confidence: number;
}

export type LevelHandler = (input: LevelStubInput) => Promise<LevelStubOutput>;

const HANDLERS: Record<AiEditorLevel, LevelHandler> = {
  cell: proposeCellEdit,
  record: proposeRecordEdit,
  column: proposeColumnEdit,
  structure: proposeStructureEdit,
  view: proposeViewEdit,
  relational: proposeRelationalEdit,
  methodological: proposeMethodologicalEdit,
  source: proposeSourceEdit,
};

export async function dispatchLevelStub(input: LevelStubInput): Promise<LevelStubOutput> {
  const handler = HANDLERS[input.level];
  if (!handler) {
    throw new Error(`No handler registered for AI Editor level '${input.level}'`);
  }
  return handler(input);
}
