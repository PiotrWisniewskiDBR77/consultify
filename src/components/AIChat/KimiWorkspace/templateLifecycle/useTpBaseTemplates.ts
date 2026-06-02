/**
 * useTpBaseTemplates — React hook around the Block A lifecycle endpoint
 * (`GET /api/table-platform/templates/lifecycle`).
 *
 * Returns the templates plus an in-place setter for the `status` filter
 * so consumers can wire `<TemplateLifecycleFilter>` straight into the
 * hook's state. The host integration in `ArtifactModuleHome` (A-S5b)
 * mounts this in the `lane === 'tabele'` branch.
 *
 * Stays decoupled from `useModuleTemplates` (Outputs Library) which
 * reads from a different surface and powers the other lanes today.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type LifecycleTemplate,
  listLifecycleTemplates,
  type TemplateStatus,
} from '@/services/api/templateLifecycle.api';

export interface UseTpBaseTemplatesOptions {
  /** Initial filter — defaults to `approved` per A-P1. */
  initialStatus?: TemplateStatus;
  /** Optional category filter forwarded to the API. */
  category?: string;
  /** Skip fetching (e.g. when the host module is not active). */
  enabled?: boolean;
}

export interface UseTpBaseTemplatesResult {
  templates: LifecycleTemplate[];
  status: TemplateStatus;
  setStatus: (next: TemplateStatus) => void;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTpBaseTemplates(
  options: UseTpBaseTemplatesOptions = {}
): UseTpBaseTemplatesResult {
  const { initialStatus = 'approved', category, enabled = true } = options;
  const [status, setStatus] = useState<TemplateStatus>(initialStatus);
  const [templates, setTemplates] = useState<LifecycleTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Track the latest in-flight request so a stale response can't overwrite
  // a fresher one (e.g. when the user toggles the filter rapidly).
  const requestSeq = useRef(0);

  const refetch = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const items = await listLifecycleTemplates({ status, category });
      if (seq === requestSeq.current) {
        setTemplates(items);
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setTemplates([]);
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [enabled, status, category]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    templates,
    status,
    setStatus,
    loading,
    error,
    refetch,
  };
}

export default useTpBaseTemplates;
