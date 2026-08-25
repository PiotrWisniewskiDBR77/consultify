export interface VaultDeleteReceipt {
  id: string;
  status: 'deleted' | 'failed';
  reason?: string;
}

export async function deleteVaultDocumentsWithReceipts(
  ids: string[],
  remove: (id: string) => Promise<unknown>
): Promise<VaultDeleteReceipt[]> {
  return Promise.all(
    ids.map(async (id) => {
      try {
        await remove(id);
        return { id, status: 'deleted' as const };
      } catch (cause) {
        return {
          id,
          status: 'failed' as const,
          reason: cause instanceof Error ? cause.message : 'DELETE_FAILED',
        };
      }
    })
  );
}
