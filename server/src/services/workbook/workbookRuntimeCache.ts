import type { WorkbookSchema } from './WorkbookSchema.js';

export interface WorkbookRuntimeCacheEntry {
  buffer: Buffer;
  fileName: string;
  schema: WorkbookSchema;
  createdAt: string;
  organizationId: string;
}

const MAX_CACHE = 50;

export const workbookRuntimeCache = new Map<string, WorkbookRuntimeCacheEntry>();

export function pruneWorkbookRuntimeCache(): void {
  if (workbookRuntimeCache.size <= MAX_CACHE) return;
  const entries = [...workbookRuntimeCache.entries()].sort((a, b) =>
    a[1].createdAt.localeCompare(b[1].createdAt)
  );
  while (workbookRuntimeCache.size > MAX_CACHE) {
    workbookRuntimeCache.delete(entries.shift()![0]);
  }
}

export function invalidateWorkbookRuntimeCache(workbookId: string): void {
  workbookRuntimeCache.delete(workbookId);
}
