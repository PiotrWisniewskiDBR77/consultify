/**
 * Chat-to-Schema Pipeline — barrel exports.
 *
 * Pipeline stages:
 *   IntentParser → SchemaGrounder → ProposalGenerator → (SchemaValidator) → MutationExecutor
 */

export { parseIntent } from './intentParser.js';
export type { ProposalIntent, ParsedIntent } from './intentParser.js';

export { groundSchema, inferFieldType } from './schemaGrounder.js';

export { generateProposal, callLLM } from './proposalGenerator.js';
export type { SchemaProposal, SchemaOperation } from './proposalGenerator.js';

export { MutationExecutor } from './mutationExecutor.js';
export type { MutationResult, RollbackAction, ExecutionOutcome } from './mutationExecutor.js';

export { UndoRedoStack, getStack, clearStack, clearAllStacks } from './undoRedoStack.js';
export type { UndoEntry } from './undoRedoStack.js';
