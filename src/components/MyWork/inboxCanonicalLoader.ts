import {
  V8MyWorkApi,
  type V8CanonicalInboxItem,
  type V8CanonicalInboxMaterializeResult,
  type V8CanonicalInboxStats,
  type V8CanonicalInboxTableParams,
} from '@/services/api/v8/my-work';

export interface CanonicalInboxLoaderDeps {
  materializeCanonicalInbox(): Promise<V8CanonicalInboxMaterializeResult>;
  getCanonicalInboxTable(
    params?: V8CanonicalInboxTableParams
  ): Promise<{ items: V8CanonicalInboxItem[] }>;
  getCanonicalInboxStats(): Promise<V8CanonicalInboxStats>;
}

export interface CanonicalInboxSnapshot {
  items: V8CanonicalInboxItem[];
  stats: V8CanonicalInboxStats;
  materialization: V8CanonicalInboxMaterializeResult;
}

/** Canonical materialization must succeed before the mounted Inbox is read. */
export async function loadCanonicalInboxSnapshot(
  params: V8CanonicalInboxTableParams,
  deps: CanonicalInboxLoaderDeps = V8MyWorkApi
): Promise<CanonicalInboxSnapshot> {
  const materialization = await deps.materializeCanonicalInbox();
  if (materialization.success !== true) {
    throw new Error('Canonical Inbox materialization did not confirm success');
  }

  const [table, stats] = await Promise.all([
    deps.getCanonicalInboxTable(params),
    deps.getCanonicalInboxStats(),
  ]);
  return { items: table.items, stats, materialization };
}
