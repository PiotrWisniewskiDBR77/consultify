/**
 * useArtifactApprovalStatus (HP-8) — thin data hook over the HP-7 REST
 * surface (`/api/artifact-approvals/:type/:id/...`).
 *
 * Intentionally NOT wired into any live artifact shell yet — see
 * `src/utils/artifactApprovalUiFlag.ts` header comment for why (visual
 * acceptance pipeline is a separate Vegas pass). This hook + the paired
 * `ArtifactApprovalStatusBar` component are the ready-to-drop-in pieces for
 * that pass.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  approveArtifact as approveArtifactApi,
  type ArtifactApprovalState,
  type ArtifactApprovalStatusResponse,
  getArtifactApprovalState,
  rejectArtifact as rejectArtifactApi,
  submitArtifactForReview as submitArtifactForReviewApi,
} from '@/services/api/artifactApprovals.api';
import { normalizeApiErrorMessage } from '@/utils/apiError';

export interface UseArtifactApprovalStatusResult {
  state: ArtifactApprovalState | null;
  /**
   * Czy dla artefaktu ISTNIEJE rekord zatwierdzenia (HP-7 `approval_assignments`).
   *
   * Kluczowe dla prawdomówności paska: backend przy BRAKU rekordu i tak zwraca
   * `state: 'draft'` (patrz `mapStatusToState(row?.status)` → gałąź `default`),
   * więc samo `state` nie odróżnia „artefakt jest szkicem w obiegu" od „obieg
   * jeszcze się nie zaczął". Rozróżnia to dopiero `assignment`: `null` = brak
   * rekordu. Pasek pokazuje pigułkę stanu TYLKO gdy `hasRecord === true` —
   * inaczej nie zmyśla „Szkic" (kanon: lepiej brak niż kłamliwy element).
   */
  hasRecord: boolean;
  loading: boolean;
  error: string | null;
  actionPending: boolean;
  refresh: () => Promise<void>;
  submitForReview: (assignedToUserId: string) => Promise<boolean>;
  approve: () => Promise<boolean>;
  reject: (reason?: string) => Promise<boolean>;
}

export function useArtifactApprovalStatus(
  artifactType: string | null | undefined,
  artifactId: string | null | undefined
): UseArtifactApprovalStatusResult {
  const [state, setState] = useState<ArtifactApprovalState | null>(null);
  const [hasRecord, setHasRecord] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const refresh = useCallback(async () => {
    if (!artifactType || !artifactId) {
      setState(null);
      setHasRecord(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res: ArtifactApprovalStatusResponse = await getArtifactApprovalState(
        artifactType,
        artifactId
      );
      setState(res.state);
      // `assignment === null` = artefakt nie wszedł jeszcze w obieg zatwierdzenia.
      setHasRecord(res.assignment != null);
    } catch (err) {
      // Błąd endpointu NIE może udawać rekordu — inaczej pasek znów zmyśliłby stan.
      setHasRecord(false);
      setError(normalizeApiErrorMessage(err, 'Failed to load approval state'));
    } finally {
      setLoading(false);
    }
  }, [artifactType, artifactId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (action: () => Promise<{ state: ArtifactApprovalState }>): Promise<boolean> => {
      if (!artifactType || !artifactId) return false;
      setActionPending(true);
      setError(null);
      try {
        const res = await action();
        setState(res.state);
        // submit/approve/reject zawsze tworzą lub aktualizują rekord obiegu.
        setHasRecord(true);
        return true;
      } catch (err) {
        setError(normalizeApiErrorMessage(err, 'Approval action failed'));
        return false;
      } finally {
        setActionPending(false);
      }
    },
    [artifactType, artifactId]
  );

  const submitForReview = useCallback(
    (assignedToUserId: string) =>
      runAction(() =>
        submitArtifactForReviewApi(artifactType as string, artifactId as string, {
          assignedToUserId,
        })
      ),
    [runAction, artifactType, artifactId]
  );

  const approve = useCallback(
    () => runAction(() => approveArtifactApi(artifactType as string, artifactId as string)),
    [runAction, artifactType, artifactId]
  );

  const reject = useCallback(
    (reason?: string) =>
      runAction(() => rejectArtifactApi(artifactType as string, artifactId as string, { reason })),
    [runAction, artifactType, artifactId]
  );

  return {
    state,
    hasRecord,
    loading,
    error,
    actionPending,
    refresh,
    submitForReview,
    approve,
    reject,
  };
}
