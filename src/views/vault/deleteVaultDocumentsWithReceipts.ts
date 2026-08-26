export interface VaultBulkReceipt {
  id: string;
  status: 'deleted' | 'applied' | 'failed';
  reason?: string;
}

/** @deprecated kept for callers written against the delete-only shape. */
export type VaultDeleteReceipt = VaultBulkReceipt;

/**
 * MYW-CV-REC-003 ("nie ma dynamicznego pokazywania na listwie tego, co jest
 * potwierdzane"): every bulk action on the vault documents table — not just
 * delete — returns one honest per-item receipt instead of a single
 * all-or-nothing result, so the bulk bar can render a per-row confirmation
 * list (see `VaultDocumentsView.tsx` `bulkReceipts` state / `.receipts`
 * panel in the accepted prototype).
 */
export async function applyVaultBulkActionWithReceipts(
  ids: string[],
  apply: (id: string) => Promise<unknown>,
  successStatus: 'deleted' | 'applied' = 'applied'
): Promise<VaultBulkReceipt[]> {
  return Promise.all(
    ids.map(async (id) => {
      try {
        await apply(id);
        return { id, status: successStatus } as const;
      } catch (cause) {
        return {
          id,
          status: 'failed' as const,
          reason: cause instanceof Error ? cause.message : 'ACTION_FAILED',
        };
      }
    })
  );
}

export async function deleteVaultDocumentsWithReceipts(
  ids: string[],
  remove: (id: string) => Promise<unknown>
): Promise<VaultDeleteReceipt[]> {
  return applyVaultBulkActionWithReceipts(ids, remove, 'deleted');
}
