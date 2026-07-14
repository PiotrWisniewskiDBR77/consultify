/**
 * useAttachments — manages attachments for a record in the Table Platform.
 */
import i18n from 'i18next';
import { useCallback, useEffect, useState } from 'react';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

export interface UseAttachmentsOpts {
  recordId: string | null;
  fieldId?: string;
  enabled: boolean;
}

export interface UseAttachmentsReturn {
  attachments: any[];
  loading: boolean;
  error: string | null;
  addAttachment: (
    fileName: string,
    mimeType: string,
    sizeBytes: number,
    storageKey: string,
    fieldId: string
  ) => Promise<void>;
  removeAttachment: (attachmentId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAttachments(opts: UseAttachmentsOpts): UseAttachmentsReturn {
  const { recordId, fieldId, enabled } = opts;
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttachments = useCallback(
    async (resetError = true) => {
      if (!recordId || !enabled) return;
      if (resetError) setError(null);
      setLoading(true);
      try {
        const list = await TablePlatformApi.getAttachments(recordId, fieldId);
        setAttachments(Array.isArray(list) ? list : []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : i18n.t('ideas.table.failedToLoadAttachments', 'Failed to load attachments')
        );
      } finally {
        setLoading(false);
      }
    },
    [recordId, fieldId, enabled]
  );

  useEffect(() => {
    if (enabled && recordId) {
      fetchAttachments();
    } else {
      setAttachments([]);
      setError(null);
    }
  }, [enabled, recordId, fieldId]); // eslint-disable-line react-hooks/exhaustive-deps -- fetchAttachments intentionally excluded to avoid loops

  const addAttachment = useCallback(
    async (
      fileName: string,
      mimeType: string,
      sizeBytes: number,
      storageKey: string,
      addFieldId: string
    ) => {
      if (!recordId) throw new Error('recordId required');
      await TablePlatformApi.createAttachment(
        recordId,
        addFieldId,
        fileName,
        mimeType,
        sizeBytes,
        storageKey
      );
      await fetchAttachments(false);
    },
    [recordId, fetchAttachments]
  );

  const removeAttachment = useCallback(async (attachmentId: string) => {
    await TablePlatformApi.deleteAttachment(attachmentId);
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  }, []);

  const refresh = useCallback(async () => {
    await fetchAttachments();
  }, [fetchAttachments]);

  return {
    attachments,
    loading,
    error,
    addAttachment,
    removeAttachment,
    refresh,
  };
}
