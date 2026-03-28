/**
 * Chat-to-Schema Pipeline — barrel exports.
 *
 * Pipeline stages:
 *   IntentParser → SchemaGrounder → ProposalGenerator → (SchemaValidator) → MutationExecutor
 */

export type { ParsedIntent, ProposalIntent } from './intentParser.js';
export { parseIntent } from './intentParser.js';
export type { ExecutionOutcome, MutationResult, RollbackAction } from './mutationExecutor.js';
export { MutationExecutor } from './mutationExecutor.js';
export type { SchemaOperation, SchemaProposal } from './proposalGenerator.js';
export { callLLM, generateProposal } from './proposalGenerator.js';
export { groundSchema, inferFieldType } from './schemaGrounder.js';
export type { UndoEntry } from './undoRedoStack.js';
export { clearAllStacks, clearStack, getStack, UndoRedoStack } from './undoRedoStack.js';
