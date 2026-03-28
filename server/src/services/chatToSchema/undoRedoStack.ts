/**
 * UndoRedoStack — in-memory undo/redo history for schema mutations.
 *
 * Each entry stores the MutationResults from an executed proposal so that
 * the MutationExecutor can roll back (undo) or re-execute (redo) them.
 *
 * Scoped per base — use `getStack(baseId)` to retrieve the correct instance.
 */

import logger from '../../utils/Logger.js';
import type { MutationResult } from './mutationExecutor.js';
import { MutationExecutor } from './mutationExecutor.js';
import type { SchemaOperation } from './proposalGenerator.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UndoEntry {
  proposalId: string;
  baseId: string;
  timestamp: string;
  operations: MutationResult[];
  originalOperations: SchemaOperation[];
  description: string;
  userId?: string;
}

// ---------------------------------------------------------------------------
// Per-base stack
// ---------------------------------------------------------------------------

export class UndoRedoStack {
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 50) {
    this.maxSize = maxSize;
  }

  push(entry: UndoEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  async undo(): Promise<UndoEntry | null> {
    const entry = this.undoStack.pop();
    if (!entry) return null;

    const executor = new MutationExecutor();
    try {
      await executor.rollback(entry.operations);
      this.redoStack.push(entry);
      logger.info('[UndoRedoStack] Undo succeeded', {
        proposalId: entry.proposalId,
        baseId: entry.baseId,
      });
      return entry;
    } catch (err) {
      this.undoStack.push(entry);
      logger.error('[UndoRedoStack] Undo failed', {
        proposalId: entry.proposalId,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  async redo(): Promise<UndoEntry | null> {
    const entry = this.redoStack.pop();
    if (!entry) return null;

    const executor = new MutationExecutor();
    try {
      const outcome = await executor.executeOperations(
        entry.originalOperations,
        entry.baseId,
        entry.userId
      );

      const redoneEntry: UndoEntry = {
        ...entry,
        timestamp: new Date().toISOString(),
        operations: outcome.results,
      };

      this.undoStack.push(redoneEntry);
      logger.info('[UndoRedoStack] Redo succeeded', {
        proposalId: entry.proposalId,
        baseId: entry.baseId,
      });
      return redoneEntry;
    } catch (err) {
      this.redoStack.push(entry);
      logger.error('[UndoRedoStack] Redo failed', {
        proposalId: entry.proposalId,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  getHistory(): { undo: UndoEntry[]; redo: UndoEntry[] } {
    return {
      undo: [...this.undoStack],
      redo: [...this.redoStack],
    };
  }

  getUndoStack(): UndoEntry[] {
    return [...this.undoStack];
  }

  getRedoStack(): UndoEntry[] {
    return [...this.redoStack];
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

// ---------------------------------------------------------------------------
// Global registry keyed by baseId
// ---------------------------------------------------------------------------

const stacks = new Map<string, UndoRedoStack>();

export function getStack(baseId: string): UndoRedoStack {
  let stack = stacks.get(baseId);
  if (!stack) {
    stack = new UndoRedoStack();
    stacks.set(baseId, stack);
  }
  return stack;
}

export function clearStack(baseId: string): void {
  stacks.delete(baseId);
}

export function clearAllStacks(): void {
  stacks.clear();
}
