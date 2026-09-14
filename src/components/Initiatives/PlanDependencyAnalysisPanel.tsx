import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DependencyObservation, ObservationReview } from './planDependencyReview';

export interface DependencyCriticalPath {
  pathId: string;
  kind: 'ABSOLUTE' | 'CONDITIONAL';
  initiativeIds: string[];
  condition: string | null;
  rationale: string;
}

interface Props {
  proposal: {
    status: string;
    analysisSource?: 'SOLVER' | 'AI';
    dependencyObservations?: DependencyObservation[];
    criticalPaths?: DependencyCriticalPath[];
    analysisModel?: string | null;
  };
  editable: boolean;
  busy?: boolean;
  resolveName: (id: string) => string;
  onReview: (outcome: 'ACCEPT' | 'REJECT', reviews?: ObservationReview[]) => void;
}

interface Draft {
  accepted: boolean;
  humanComment: string;
  rationale: string;
  kind: 'ABSOLUTE' | 'CONDITIONAL';
  condition: string;
  conditionActive: boolean;
}

export const PlanDependencyAnalysisPanel: React.FC<Props> = ({
  proposal,
  editable,
  busy,
  resolveName,
  onReview,
}) => {
  const { t } = useTranslation();
  const observations = proposal.dependencyObservations ?? [];
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        observations.map((observation) => [
          observation.observationId,
          {
            accepted: false,
            humanComment: '',
            rationale: observation.rationale,
            kind: observation.kind,
            condition: observation.condition ?? '',
            conditionActive: false,
          },
        ])
      )
    );
  }, [proposal]);

  const reviews = useMemo<ObservationReview[]>(
    () =>
      observations.map((observation) => {
        const draft = drafts[observation.observationId];
        return {
          observationId: observation.observationId,
          outcome: draft?.accepted ? 'ACCEPTED' : 'REJECTED',
          conditionActive:
            (draft?.kind ?? observation.kind) === 'CONDITIONAL'
              ? (draft?.conditionActive ?? false)
              : null,
          humanComment: draft?.humanComment.trim() || t('initiatives.planAnalysis.noChangeComment'),
          finalObservation: {
            ...observation,
            rationale: draft?.rationale.trim() || observation.rationale,
            kind: draft?.kind ?? observation.kind,
            condition:
              (draft?.kind ?? observation.kind) === 'ABSOLUTE'
                ? null
                : draft?.condition.trim() || observation.condition,
          },
        };
      }),
    [drafts, observations, t]
  );
  const acceptedCount = reviews.filter((review) => review.outcome === 'ACCEPTED').length;
  const invalid = reviews.some(
    (review) =>
      !review.humanComment.trim() ||
      !review.finalObservation.rationale.trim() ||
      (review.finalObservation.kind === 'CONDITIONAL' && !review.finalObservation.condition?.trim())
  );
  const patch = (id: string, next: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...next } }));
  const button =
    'rounded-lg border border-c-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50';

  if (proposal.analysisSource !== 'AI') return null;
  return (
    <section className="space-y-4" aria-label={t('initiatives.planAnalysis.sectionAria')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-medium">{t('initiatives.planAnalysis.title')}</h4>
          <p className="text-sm text-c-text-muted">
            {t('initiatives.planAnalysis.subtitle', { model: proposal.analysisModel ?? 'AI' })}
          </p>
        </div>
        {editable && proposal.status === 'PENDING_REVIEW' && observations.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              className={button}
              onClick={() =>
                setDrafts((current) =>
                  Object.fromEntries(Object.entries(current).map(([id, draft]) => [id, { ...draft, accepted: true }]))
                )
              }
            >
              {t('initiatives.planAnalysis.acceptAll')}
            </button>
            <button
              type="button"
              className={button}
              onClick={() =>
                setDrafts((current) =>
                  Object.fromEntries(Object.entries(current).map(([id, draft]) => [id, { ...draft, accepted: false }]))
                )
              }
            >
              {t('initiatives.planAnalysis.clearAll')}
            </button>
          </div>
        )}
      </div>

      {observations.length === 0 ? (
        <p className="text-sm text-c-text-muted">{t('initiatives.planAnalysis.empty')}</p>
      ) : (
        <div className="space-y-3">
          {observations.map((observation, index) => {
            const draft = drafts[observation.observationId];
            return (
              <article key={observation.observationId} className="rounded-lg border border-c-border-subtle p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {index + 1}. {resolveName(observation.predecessorId)} → {resolveName(observation.successorId)}
                    </p>
                    <p className="text-xs text-c-text-muted">
                      {t(`initiatives.planAnalysis.kind.${draft?.kind ?? observation.kind}`)} ·{' '}
                      {t(`initiatives.planAnalysis.confidence.${observation.confidence}`)}
                    </p>
                  </div>
                  {editable && proposal.status === 'PENDING_REVIEW' && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft?.accepted ?? false}
                        onChange={(event) => patch(observation.observationId, { accepted: event.target.checked })}
                      />
                      {t('initiatives.planAnalysis.acceptObservation')}
                    </label>
                  )}
                </div>
                <label className="mt-3 block text-xs text-c-text-muted">
                  {t('initiatives.planAnalysis.rationale')}
                  <textarea
                    className="mt-1 min-h-20 w-full rounded-lg border border-c-border bg-c-surface p-2 text-sm text-c-text"
                    value={draft?.rationale ?? observation.rationale}
                    readOnly={!editable || proposal.status !== 'PENDING_REVIEW'}
                    onChange={(event) => patch(observation.observationId, { rationale: event.target.value })}
                  />
                </label>
                {editable && proposal.status === 'PENDING_REVIEW' && (
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <label className="text-xs text-c-text-muted">
                      {t('initiatives.planAnalysis.dependencyType')}
                      <select
                        className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2 text-sm"
                        value={draft?.kind ?? observation.kind}
                        onChange={(event) =>
                          patch(observation.observationId, {
                            kind: event.target.value as Draft['kind'],
                            condition: event.target.value === 'ABSOLUTE' ? '' : draft?.condition ?? '',
                            conditionActive:
                              event.target.value === 'ABSOLUTE'
                                ? false
                                : (draft?.conditionActive ?? false),
                          })
                        }
                      >
                        <option value="ABSOLUTE">{t('initiatives.planAnalysis.kind.ABSOLUTE')}</option>
                        <option value="CONDITIONAL">{t('initiatives.planAnalysis.kind.CONDITIONAL')}</option>
                      </select>
                    </label>
                    {(draft?.kind ?? observation.kind) === 'CONDITIONAL' && (
                      <div className="text-xs text-c-text-muted">
                        <label>
                          {t('initiatives.planAnalysis.condition')}
                          <input
                            className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2 text-sm"
                            value={draft?.condition ?? ''}
                            onChange={(event) =>
                              patch(observation.observationId, { condition: event.target.value })
                            }
                          />
                        </label>
                        <label className="mt-2 flex items-center gap-2 text-sm text-c-text">
                          <input
                            type="checkbox"
                            checked={draft?.conditionActive ?? false}
                            onChange={(event) =>
                              patch(observation.observationId, {
                                conditionActive: event.target.checked,
                              })
                            }
                          />
                          {t('initiatives.planAnalysis.conditionActive')}
                        </label>
                      </div>
                    )}
                  </div>
                )}
                {editable && proposal.status === 'PENDING_REVIEW' && (
                  <label className="mt-2 block text-xs text-c-text-muted">
                    {t('initiatives.planAnalysis.humanComment')}
                    <textarea
                      className="mt-1 min-h-16 w-full rounded-lg border border-c-border bg-c-surface p-2 text-sm text-c-text"
                      value={draft?.humanComment ?? ''}
                      placeholder={t('initiatives.planAnalysis.humanCommentPlaceholder')}
                      onChange={(event) => patch(observation.observationId, { humanComment: event.target.value })}
                    />
                  </label>
                )}
              </article>
            );
          })}
        </div>
      )}

      {(proposal.criticalPaths ?? []).length > 0 && (
        <div>
          <h5 className="font-medium">{t('initiatives.planAnalysis.criticalPaths')}</h5>
          <ul className="mt-2 space-y-2 text-sm">
            {(proposal.criticalPaths ?? []).map((path) => (
              <li key={path.pathId} className="rounded-lg border border-c-border-subtle p-2">
                <b>{t(`initiatives.planAnalysis.kind.${path.kind}`)}</b>: {path.initiativeIds.map(resolveName).join(' → ')}
                {path.condition ? <span className="block text-c-text-muted">{path.condition}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {editable && proposal.status === 'PENDING_REVIEW' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={button}
            disabled={busy || invalid}
            onClick={() => onReview('ACCEPT', reviews)}
          >
            {t('initiatives.planAnalysis.applyAccepted', { count: acceptedCount })}
          </button>
          <button type="button" className={button} disabled={busy} onClick={() => onReview('REJECT')}>
            {t('initiatives.planAnalysis.rejectAnalysis')}
          </button>
        </div>
      )}
    </section>
  );
};
