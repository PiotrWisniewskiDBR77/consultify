import { FileCheck, FileText } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ArtifactBreadcrumb } from '@/components/standard/ArtifactBreadcrumb';
import {
  ArtifactPropertiesTable,
  type ArtifactPropertyRow,
} from '@/components/standard/ArtifactPropertiesTable';
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
import type { NModeHeaderConfig, NModeSection } from '@/components/shared/NModeLayout/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import {
  getAssessmentReportContract,
  isOfflineError,
  MethodCoreApiError,
  type AssessmentReportArea,
  type AssessmentReportAreaComment,
  type AssessmentReportChapter,
  type AssessmentReportContract,
  type AssessmentReportEvidenceState,
  type AssessmentReportSkip,
} from '@/method-core/api/methodCoreApi';
import { isAssessmentReportViewEnabled } from '@/utils/assessmentReportViewFlag';

import { SKIP_REASON_LABELS } from '../../method-workspace/skipReasonCodes';

export interface AssessmentReportContractViewProps {
  readonly sessionId: string;
  readonly className?: string;
}

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: unknown }
  | { readonly kind: 'ready'; readonly contract: AssessmentReportContract };

const evidenceKey: Record<AssessmentReportEvidenceState, string> = {
  evidenced: 'evidenced',
  incomplete: 'incomplete',
  declared: 'declared',
  not_assessed: 'notAssessed',
};

function EmptySlot({ min, max }: { readonly min: number; readonly max: number }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-dashed border-c-border bg-c-surface-raised px-4 py-3 text-sm text-c-text-muted">
      {t('assessment.reportView.emptySlot', { min, max })}
    </div>
  );
}

function SkipSummary({
  skips,
  skipped,
  maxLevel,
}: {
  readonly skips: readonly AssessmentReportSkip[];
  readonly skipped: boolean;
  readonly maxLevel: number;
}) {
  const { t } = useTranslation();
  if (skips.length === 0) return null;
  return (
    <div className="mt-2 rounded-lg border border-c-border-subtle bg-c-surface-raised p-3 text-xs text-c-text-secondary">
      <p className="font-semibold text-c-text">
        {skipped
          ? t('assessment.reportView.skips.whole', { count: skips.length })
          : t('assessment.reportView.skips.partial', { count: skips.length, total: maxLevel })}
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {skips.map((skip) => (
          <li key={`${skip.questionId}:${skip.skipCode}`}>
            {t('assessment.reportView.skips.question', {
              question: skip.questionId,
              reason: SKIP_REASON_LABELS[skip.skipCode],
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Matrix({ chapter }: { readonly chapter: AssessmentReportChapter }) {
  const { t } = useTranslation();
  const value = (v: number | null) =>
    v === null ? t('assessment.reportView.notAssessedValue') : String(v);
  return (
    <div className="overflow-x-auto rounded-xl border border-c-border-subtle">
      {/* prettier-ignore */}
      <table className="w-full min-w-[720px] border-collapse text-xs" data-table-canon="§27-exempt-document-matrix">
        <thead className="bg-c-surface-raised text-left text-c-text-muted" data-table-canon="§27-exempt">
          <tr>
            {['area', 'current', 'target', 'gap', 'evidence', 'skips'].map((key) => (
              <th key={key} className="border-b border-c-border-subtle px-3 py-2 font-semibold">
                {t(`assessment.reportView.matrix.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody data-table-canon="§27-exempt">
          {chapter.matrix.areas.map((area: AssessmentReportArea) => (
            <tr key={area.unitId} className="align-top text-c-text">
              <td className="border-b border-c-border-subtle px-3 py-3 font-medium">
                {area.unitId} · {area.unitNamePL ?? area.unitName}
              </td>
              <td className="border-b border-c-border-subtle px-3 py-3">
                {value(area.currentLevel)}
              </td>
              <td className="border-b border-c-border-subtle px-3 py-3">
                {value(area.targetLevel)}
              </td>
              <td className="border-b border-c-border-subtle px-3 py-3">{value(area.gap)}</td>
              <td className="border-b border-c-border-subtle px-3 py-3">
                {t(`assessment.reportView.evidence.${evidenceKey[area.evidenceState]}`)}
              </td>
              <td className="border-b border-c-border-subtle px-3 py-3">
                <SkipSummary
                  skips={area.skips}
                  skipped={area.skipped}
                  maxLevel={chapter.maxLevel}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AreaComment({
  comment,
  chapter,
}: {
  readonly comment: AssessmentReportAreaComment;
  readonly chapter: AssessmentReportChapter;
}) {
  const { t } = useTranslation();
  const area = chapter.matrix.areas.find((candidate) => candidate.unitId === comment.unitId);
  return (
    <article className="rounded-xl border border-c-border-subtle bg-c-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-c-text">
          {comment.unitId} · {area?.unitNamePL ?? area?.unitName ?? comment.unitId}
        </h4>
        <span className="text-xs text-c-text-muted">
          {t('assessment.reportView.wordLimit', { min: comment.minWords, max: comment.maxWords })}
        </span>
      </div>
      <p className="mt-1 text-xs text-c-text-secondary">
        {t(`assessment.reportView.evidence.${evidenceKey[comment.uncertainty]}`)}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {comment.microstructure.map((item) => (
          <div key={item}>
            <h5 className="mb-1 text-xs font-semibold text-c-text">
              {t(`assessment.reportView.microstructure.${item}`)}
            </h5>
            <EmptySlot min={comment.minWords} max={comment.maxWords} />
          </div>
        ))}
      </div>
      <SkipSummary skips={comment.skips} skipped={comment.skipped} maxLevel={chapter.maxLevel} />
      {comment.answerRefs.length + comment.evidenceRefs.length + comment.sourceLocators.length >
      0 ? (
        <details className="mt-3 text-xs text-c-text-secondary">
          <summary className="cursor-pointer font-medium text-c-text">
            {t('assessment.reportView.traceability.title')}
          </summary>
          <p className="mt-2">
            {t('assessment.reportView.traceability.counts', {
              answers: comment.answerRefs.length,
              evidence: comment.evidenceRefs.length,
              sources: comment.sourceLocators.length,
            })}
          </p>
        </details>
      ) : null}
    </article>
  );
}

function Chapter({ chapter }: { readonly chapter: AssessmentReportChapter }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-[760px] space-y-8 bg-c-surface p-8" data-axis-id={chapter.axisId}>
      <section>
        <h3 className="mb-3 text-lg font-semibold text-c-text">
          {t('assessment.reportView.sections.introduction')}
        </h3>
        <EmptySlot min={chapter.introduction.minWords} max={chapter.introduction.maxWords} />
      </section>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-c-text">
          {t('assessment.reportView.sections.matrix')}
        </h3>
        <Matrix chapter={chapter} />
        <EmptySlot min={chapter.matrix.caption.minWords} max={chapter.matrix.caption.maxWords} />
      </section>
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-c-text">
          {t('assessment.reportView.sections.comments')}
        </h3>
        {chapter.areaComments.map((comment) => (
          <AreaComment key={comment.unitId} comment={comment} chapter={chapter} />
        ))}
      </section>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-c-text">
          {t('assessment.reportView.sections.conclusion')}
        </h3>
        <EmptySlot min={chapter.conclusion.minWords} max={chapter.conclusion.maxWords} />
        <dl className="grid gap-3 sm:grid-cols-2">
          {(['direction', 'priority', 'horizon', 'successCondition'] as const).map((field) => (
            <div key={field} className="rounded-lg border border-c-border-subtle p-3">
              <dt className="text-xs font-semibold text-c-text-muted">
                {t(`assessment.reportView.decision.${field}`)}
              </dt>
              <dd className="mt-1 text-sm text-c-text">{t('assessment.reportView.toComplete')}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export const AssessmentReportContractView: React.FC<AssessmentReportContractViewProps> = ({
  sessionId,
  className,
}) => {
  const { t, i18n } = useTranslation();
  const enabled = isAssessmentReportViewEnabled();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [activeSection, setActiveSection] = useState('axis-1');

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    getAssessmentReportContract(sessionId).then(
      (contract) => !cancelled && setState({ kind: 'ready', contract }),
      (error) => !cancelled && setState({ kind: 'error', error })
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, reload, sessionId]);

  const retry = useCallback(() => setReload((value) => value + 1), []);
  const contract = state.kind === 'ready' ? state.contract : null;
  const sections: NModeSection[] = useMemo(
    () =>
      (contract?.chapters ?? []).map((chapter) => ({
        id: `axis-${chapter.axisId}`,
        icon: FileText,
        label: { pl: chapter.axisNamePL ?? chapter.axisName, en: chapter.axisName },
        alwaysShow: true,
        component: <Chapter chapter={chapter} />,
      })),
    [contract]
  );

  if (!enabled) return null;
  if (state.kind === 'loading')
    return <LoadingState template="panel" label={t('assessment.reportView.loading')} />;
  if (state.kind === 'error') {
    const error = state.error;
    const key = isOfflineError(error)
      ? 'offline'
      : error instanceof MethodCoreApiError && error.status === 404
        ? 'notFound'
        : error instanceof MethodCoreApiError && error.status === 401
          ? 'noOrganization'
          : error instanceof MethodCoreApiError && error.message.includes('version')
            ? 'version'
            : 'generic';
    return <ErrorState title={t(`assessment.reportView.errors.${key}`)} onRetry={retry} />;
  }
  if (sections.length === 0) {
    return <EmptyState variant="new" icon={FileCheck} title={t('assessment.reportView.empty')} />;
  }
  if (!contract) return null;

  const propertyRows: ArtifactPropertyRow[] = [
    [
      'revision',
      contract.revision === 0
        ? t('assessment.reportView.noFrozenOutput')
        : String(contract.revision),
    ],
    ['outputId', contract.outputId ?? t('assessment.reportView.noFrozenOutput')],
    [
      'generatedAt',
      new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(contract.generatedAt)
      ),
    ],
    ['methodVersion', contract.methodVersion],
    ['contractVersion', contract.contractVersion],
    ['sessionId', contract.sessionId],
  ].map(([id, value]) => ({
    id,
    label: t(`assessment.reportView.properties.${id}`),
    value,
    mono: true,
  }));
  const panelSections: ArtifactRightPanelSection[] = [
    {
      id: 'actions',
      label: t('assessment.reportView.panel.actions'),
      defaultOpen: true,
      children: (
        <div className="space-y-2">
          {['pdf', 'all'].map((kind) => (
            <div
              key={kind}
              className="flex items-center justify-between rounded-lg border border-c-border-subtle px-3 py-2 opacity-60"
            >
              <span className="text-xs text-c-text-muted">
                {t(`assessment.reportView.export.${kind}`)}
              </span>
              <span className="text-[10px] font-medium text-c-text-muted">
                {t('assessment.reportView.planned')}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'properties',
      label: t('assessment.reportView.panel.properties'),
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable
          rows={propertyRows}
          propertyLabel={t('assessment.reportView.property')}
          valueLabel={t('assessment.reportView.value')}
        />
      ),
    },
  ];
  const header: NModeHeaderConfig = {
    title: t('assessment.reportView.title'),
    onTitleChange: () => {},
    titleReadOnly: true,
    artifactType: 'report',
    artifactId: contract.outputId ?? contract.sessionId,
    onSave: () => {},
    onClose: () => {},
    statusLabel:
      contract.revision === 0
        ? t('assessment.reportView.draft')
        : t('assessment.reportView.revision', { revision: contract.revision }),
    statusTone: contract.revision === 0 ? 'draft' : 'neutral',
    primaryAction: {
      label: { pl: t('assessment.reportView.generate'), en: t('assessment.reportView.generate') },
      icon: FileCheck,
      onClick: () => {},
      disabled: true,
    },
  };
  return (
    <div
      className={`flex h-full min-h-0 flex-col ${className ?? ''}`}
      data-testid="assessment-report-contract-view"
    >
      <ArtifactBreadcrumb
        items={[
          { label: t('assessment.reportView.assessment') },
          { label: contract.sessionId },
          { label: t('assessment.reportView.report') },
        ]}
      />
      <div className="min-h-0 flex-1">
        <NModeShell
          header={header}
          sections={sections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          presentationMode="n"
          onPresentationModeChange={() => {}}
          showModeSwitcher={false}
          rightPanel={
            <ArtifactRightPanel
              sections={panelSections}
              ariaLabel={t('assessment.reportView.panelLabel')}
              className={ARTIFACT_PANEL_CARD_CLASS_DOCKED}
            />
          }
        />
      </div>
    </div>
  );
};

export default AssessmentReportContractView;
