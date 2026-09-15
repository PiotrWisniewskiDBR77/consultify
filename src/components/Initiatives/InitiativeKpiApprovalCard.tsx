import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { readDefinitionApproval } from '@/services/initiatives-execution/definitionApprovalApi';
import {
  publishInitiativeCard,
  readInitiativeCards,
  reviewInitiativeCard,
  type InitiativeCardVersionReadModel,
} from '@/services/initiatives-execution/runtimeApi';
import { isInitiativesPortfolioAnalysisEnabled } from '@/utils/initiativesPortfolioAnalysisFlag';

import type { InitiativeKpiEditorRow } from './initiativeKpiContract';

interface Props {
  initiativeId: string;
  kpis: InitiativeKpiEditorRow[];
  readOnly?: boolean;
}

/** DEC-499: the KPI set uses the existing immutable Initiative-card review engine. */
export function InitiativeKpiApprovalCard({ initiativeId, kpis, readOnly = false }: Props) {
  const { t } = useTranslation();
  const enabled = isInitiativesPortfolioAnalysisEnabled();
  const [initiativeVersion, setInitiativeVersion] = useState(0);
  const [actorId, setActorId] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [card, setCard] = useState<InitiativeCardVersionReadModel | null>(null);
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const [approval, cards] = await Promise.all([
      readDefinitionApproval(initiativeId),
      readInitiativeCards(initiativeId),
    ]);
    setActorId(approval.actorId || '');
    setCanEdit(Boolean(approval.enabled && approval.capabilities.edit));
    setCanReview(Boolean(approval.enabled && approval.capabilities.review));
    setInitiativeVersion(cards.initiativeVersion);
    setCard(cards.cards.find((item) => item.cardKey === 'kpi') ?? null);
  }, [initiativeId]);

  useEffect(() => {
    if (!enabled) return;
    void reload().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [enabled, reload]);

  const snapshot = useMemo(
    () => ({
      kpiRefs: kpis.map((kpi) => kpi.id),
      measurementPlan: kpis.map((kpi) => ({
        kpiId: kpi.id,
        name: kpi.name,
        unit: kpi.unit,
        observationPhase: kpi.observationPhase,
        cadence: kpi.cadence,
        realizationTarget: kpi.realizationTarget,
        postImplementationTarget: kpi.postImplementationTarget,
      })),
      challenge: t(
        'initiatives.kpiApproval.challengeReceipt',
        'Targets and measurement cadence require independent review.'
      ),
      counterEvidence: t(
        'initiatives.kpiApproval.counterEvidenceReceipt',
        'The reviewer must check whether the baseline and target are supported by evidence.'
      ),
      acceptedHumanTruth: t(
        'initiatives.kpiApproval.acceptedTruthReceipt',
        'Only the independently accepted KPI snapshot is approved for execution.'
      ),
    }),
    [kpis, t]
  );

  if (!enabled) return null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      setRationale('');
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const mayApprove =
    !readOnly &&
    canReview &&
    card?.reviewState === 'REQUESTED' &&
    card.publishedBy !== actorId &&
    rationale.trim().length > 0;

  return (
    <section className="rounded-2xl border border-c-border-subtle bg-c-surface p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('initiatives.kpiApproval.title', 'KPI approval')}
          </h3>
          <p className="text-xs text-c-text-muted">
            {t(
              'initiatives.kpiApproval.aiHint',
              'AI suggestions remain proposals until you apply them and submit this KPI set for independent review.'
            )}
          </p>
        </div>
        <span className="rounded-full border border-c-border-subtle px-2 py-1 text-xs text-c-text-secondary">
          {t('initiatives.kpiApproval.status', 'Status')}: {card?.reviewState ?? 'NOT_REQUESTED'}
        </span>
      </div>

      {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          disabled={readOnly || busy || !canEdit || !initiativeVersion || kpis.length === 0}
          onClick={() =>
            void run(() =>
              publishInitiativeCard(initiativeId, 'kpi', {
                expectedVersion: initiativeVersion,
                expectedCardVersion: card?.cardVersion ?? 0,
                clientRequestId: crypto.randomUUID(),
                applicability: 'REQUIRED',
                completion: 'COMPLETE',
                quality: 'SUFFICIENT',
                freshness: 'CURRENT',
                reviewState: 'REQUESTED',
                content: snapshot,
                evidenceRefs: kpis.map((kpi) => `initiative-kpi:${kpi.id}`),
                waiverDecisionId: null,
              })
            )
          }
          className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm font-medium text-c-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('initiatives.kpiApproval.submit', 'Submit KPI set for approval')}
        </button>

        <label className="min-w-64 flex-1 text-xs text-c-text-muted">
          {t('initiatives.kpiApproval.rationale', 'Review rationale')}
          <textarea
            value={rationale}
            disabled={readOnly || busy || !canReview}
            onChange={(event) => setRationale(event.target.value)}
            className="mt-1 block min-h-16 w-full rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm text-c-text"
          />
        </label>

        <button
          type="button"
          disabled={!mayApprove}
          title={
            !canReview
              ? t('initiatives.kpiApproval.noPermission', 'You do not have permission to approve this KPI set.')
              : card?.publishedBy === actorId
                ? t('initiatives.kpiApproval.independentReviewer', 'A different person must approve this KPI set.')
                : undefined
          }
          onClick={() =>
            card &&
            void run(() =>
              reviewInitiativeCard(initiativeId, 'kpi', {
                expectedVersion: initiativeVersion,
                expectedCardVersion: card.cardVersion,
                clientRequestId: crypto.randomUUID(),
                outcome: 'ACCEPTED',
                rationale: rationale.trim(),
              })
            )
          }
          className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm font-medium text-c-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('initiatives.kpiApproval.approve', 'Approve KPI set')}
        </button>
      </div>
    </section>
  );
}
