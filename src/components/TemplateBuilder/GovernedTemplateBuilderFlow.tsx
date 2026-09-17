import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { ArtifactRightPanel } from '@/components/standard/ArtifactRightPanel';

import { TemplateBuilder } from './TemplateBuilder';
import {
  approveGovernedTemplate,
  type DeliverableTemplateRecord,
  loadTemplate,
  recordToDraft,
  runTemplateLiveTest,
  saveGovernedTemplate,
  submitTemplate,
  type TemplateWorkflow,
} from './templateBuilderApi';
import { Field, Select, TextInput } from './templateBuilderFields';
import {
  emptyDraft,
  newDeckSlide,
  newDocSection,
  newWorkbookSheet,
  type TemplateDraft,
  type TemplateType,
} from './templateBuilderModel';

type BaseKind = 'archetype' | 'system' | 'own';
type ObjectType = 'initiative' | 'kpi' | 'decision' | 'artifact';

function archetypeDraft(type: TemplateType, t: TFunction): TemplateDraft {
  const draft = emptyDraft(
    type,
    type === 'deck'
      ? t('templateBuilder.workflow.boardDeck')
      : type === 'doc'
        ? t('templateBuilder.workflow.clientReport')
        : t('templateBuilder.workflow.scorecard'),
    'org'
  );
  draft.description = t('templateBuilder.workflow.reusableDescription');
  if (type === 'deck') {
    const specs = [
      [t('templateBuilder.workflow.slideCover'), 'cover', 'DRD'],
      [t('templateBuilder.workflow.slideAgenda'), 'agenda', 'Initiatives'],
      [t('templateBuilder.workflow.slideSectionBreak'), 'section', 'DRD'],
      [t('templateBuilder.workflow.slideContentOne'), 'content', 'DRD'],
      [t('templateBuilder.workflow.slideContentTwo'), 'two-column', 'DRD'],
      [t('templateBuilder.workflow.slideTable'), 'content', 'Initiatives'],
      [t('templateBuilder.workflow.slideChart'), 'chart', 'KPI'],
      [t('templateBuilder.workflow.slideDecision'), 'closing', 'Decisions'],
    ] as const;
    draft.deck = specs.map(([title, archetype, source]) => ({
      ...newDeckSlide(title),
      archetype,
      source,
    }));
  } else if (type === 'doc') {
    draft.doc = [
      { ...newDocSection(t('templateBuilder.workflow.executiveSummary')), source: 'DRD' },
      { ...newDocSection(t('templateBuilder.workflow.evidence')), block: 'table', source: 'KPI' },
      {
        ...newDocSection(t('templateBuilder.workflow.recommendations')),
        block: 'bullets',
        source: 'Initiatives',
      },
    ];
  } else {
    draft.table = [{ ...newWorkbookSheet(t('templateBuilder.workflow.scorecard')), source: 'KPI' }];
  }
  return draft;
}

function sourceBindings(draft: TemplateDraft): Record<string, string> {
  const items = draft.type === 'doc' ? draft.doc : draft.type === 'deck' ? draft.deck : draft.table;
  return Object.fromEntries(items.map((item) => [item.id, item.source]));
}

async function listBases(type: TemplateType): Promise<DeliverableTemplateRecord[]> {
  const res = await fetch(`/api/deliverables/templates?type=${encodeURIComponent(type)}`, {
    credentials: 'include',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.templates) ? data.templates : [];
}

export const GovernedTemplateBuilderFlow: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const [type, setType] = useState<TemplateType>('deck');
  const [baseKind, setBaseKind] = useState<BaseKind>('archetype');
  const [baseTemplateId, setBaseTemplateId] = useState('');
  const [seed, setSeed] = useState<TemplateDraft>(() => archetypeDraft('deck', t));
  const [bases, setBases] = useState<DeliverableTemplateRecord[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<TemplateWorkflow | null>(null);
  const [objectType, setObjectType] = useState<ObjectType>('initiative');
  const [objectId, setObjectId] = useState('');
  const [documentType, setDocumentType] = useState('board');
  const [audience, setAudience] = useState(() => t('templateBuilder.workflow.leadershipTeam'));
  const [confidentiality, setConfidentiality] = useState('internal');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listBases(type).then((rows) => active && setBases(rows));
    return () => {
      active = false;
    };
  }, [type]);

  const changeType = useCallback(
    (next: TemplateType) => {
      setType(next);
      setBaseKind('archetype');
      setBaseTemplateId('');
      setSeed(archetypeDraft(next, t));
      setTemplateId(null);
      setWorkflow(null);
      setMessage(null);
    },
    [t]
  );

  const changeBase = useCallback(
    async (id: string) => {
      setBaseTemplateId(id);
      if (!id) return;
      const record = await loadTemplate(id);
      const next = recordToDraft(record);
      next.name = t('templateBuilder.workflow.copyName', { name: record.name });
      next.scope = 'org';
      setSeed(next);
    },
    [t]
  );

  const saveNew = useCallback(
    async (draft: TemplateDraft) => {
      const saved = await saveGovernedTemplate(draft, {
        baseKind,
        baseTemplateId: baseKind === 'archetype' ? undefined : baseTemplateId,
        language: 'en',
        documentType,
        audience,
        confidentiality,
        sourceBindings: sourceBindings(draft),
      });
      setTemplateId(saved.id);
      setWorkflow(saved.workflow ?? null);
      setMessage(t('templateBuilder.workflow.draftSaved'));
      return saved;
    },
    [audience, baseKind, baseTemplateId, confidentiality, documentType, t]
  );

  const handleTest = useCallback(async () => {
    if (!templateId || !objectId.trim()) {
      setMessage(t('templateBuilder.workflow.objectRequired'));
      return;
    }
    setTesting(true);
    try {
      const result = await runTemplateLiveTest(templateId, {
        objectType,
        objectId: objectId.trim(),
      });
      setWorkflow(result.workflow);
      setMessage(
        result.status === 'pass'
          ? `${result.exportFormat.toUpperCase()} PASS · ${result.exportByteSize} B`
          : t('templateBuilder.workflow.testFailed')
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('templateBuilder.workflow.testFailed'));
    } finally {
      setTesting(false);
    }
  }, [templateId, objectId, objectType, t]);

  const handleSubmit = useCallback(async () => {
    if (!templateId) return;
    setSubmitting(true);
    try {
      const next = await submitTemplate(templateId);
      setWorkflow(next);
      setMessage(t('templateBuilder.workflow.submitted'));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t('templateBuilder.workflow.submitFailed')
      );
    } finally {
      setSubmitting(false);
    }
  }, [templateId, t]);

  const handleApprove = useCallback(async () => {
    if (!templateId) return;
    try {
      const next = await approveGovernedTemplate(templateId, setAsDefault);
      setWorkflow(next);
      setMessage(t('templateBuilder.workflow.approved'));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t('templateBuilder.workflow.approvalFailed')
      );
    }
  }, [setAsDefault, templateId, t]);

  const baseOptions = useMemo(
    () =>
      bases
        .filter((item) => (baseKind === 'system' ? item.isSystem : !item.isSystem))
        .map((item) => ({ value: item.id, label: item.name })),
    [bases, baseKind]
  );

  const setup = (
    <div
      className="border-b border-c-border bg-c-surface px-6 py-4"
      data-testid="template-governed-setup"
    >
      <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-[2fr_1fr]">
        <Field label={t('templateBuilder.workflow.base')}>
          <div className="grid gap-2 sm:grid-cols-3" data-testid="template-base-kind">
            {[
              {
                value: 'archetype' as const,
                label: t('templateBuilder.workflow.archetype'),
              },
              {
                value: 'system' as const,
                label: t('templateBuilder.workflow.systemBase'),
              },
              {
                value: 'own' as const,
                label: t('templateBuilder.workflow.ownBase'),
              },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs ${
                  baseKind === option.value
                    ? 'border-c-focus-solid bg-c-selection text-c-text'
                    : 'border-c-border bg-c-surface text-c-text-secondary'
                }`}
              >
                <input
                  type="radio"
                  name="template-base-kind"
                  value={option.value}
                  checked={baseKind === option.value}
                  onChange={() => {
                    setBaseKind(option.value);
                    setBaseTemplateId('');
                    setSeed(archetypeDraft(type, t));
                  }}
                  className="h-4 w-4 accent-[color:var(--c-focus-solid)]"
                />
                {option.label}
              </label>
            ))}
          </div>
        </Field>
        <Field label={t('templateBuilder.workflow.format')}>
          <Select
            value={type}
            options={[
              { value: 'deck', label: t('templateBuilder.workflow.deck') },
              { value: 'doc', label: t('templateBuilder.workflow.document') },
              { value: 'table', label: t('templateBuilder.workflow.sheet') },
            ]}
            onChange={changeType}
            testId="template-format"
          />
        </Field>
      </div>
      <div className="mx-auto mt-3 grid max-w-4xl gap-4 lg:grid-cols-[2fr_1fr]">
        {baseKind !== 'archetype' ? (
          <Field label={t('templateBuilder.workflow.templateBase')}>
            <Select
              value={baseTemplateId}
              options={[{ value: '', label: '—' }, ...baseOptions]}
              onChange={(id) => void changeBase(id)}
              testId="template-base-id"
            />
          </Field>
        ) : (
          <div className="self-end pb-2 text-xs text-c-text-muted">
            {t('templateBuilder.workflow.inheritedBrand')}
          </div>
        )}
      </div>
      <div className="mx-auto mt-3 grid max-w-4xl gap-4 lg:grid-cols-[180px_1fr]">
        <Field label={t('templateBuilder.workflow.liveObjectType')}>
          <Select
            value={objectType}
            options={[
              { value: 'initiative', label: t('templateBuilder.workflow.initiative') },
              { value: 'kpi', label: 'KPI' },
              { value: 'decision', label: t('templateBuilder.workflow.decision') },
              { value: 'artifact', label: t('templateBuilder.workflow.artifact') },
            ]}
            onChange={setObjectType}
            testId="template-test-object-type"
          />
        </Field>
        <Field label={t('templateBuilder.workflow.liveObject')}>
          <TextInput
            value={objectId}
            onChange={setObjectId}
            placeholder="UUID"
            testId="template-test-object-id"
          />
        </Field>
      </div>
      {message && (
        <p className="mx-auto mt-3 max-w-4xl text-xs text-c-text-secondary" role="status">
          {message}
        </p>
      )}
    </div>
  );

  const menu2 = (
    <nav
      aria-label={t('templateBuilder.workflow.sections')}
      className="flex h-11 items-center gap-1 border-b border-c-border bg-c-surface px-5"
      data-testid="template-workflow-menu2"
    >
      {[
        t('templateBuilder.workflow.structure'),
        t('templateBuilder.workflow.formatting'),
        t('templateBuilder.workflow.sources'),
        t('templateBuilder.workflow.testRun'),
        t('templateBuilder.workflow.history'),
      ].map((label, index) => (
        <button
          key={label}
          type="button"
          className={`h-full border-b-2 px-3 text-xs font-medium transition-colors ${
            index === 0
              ? 'border-c-focus-solid text-c-text'
              : 'border-transparent text-c-text-muted hover:text-c-text'
          }`}
          aria-current={index === 0 ? 'page' : undefined}
        >
          {label}
        </button>
      ))}
      <span className="ml-auto text-c-text-muted" aria-label={t('templateBuilder.workflow.more')}>
        ⋮
      </span>
    </nav>
  );

  const detailRow = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-3 py-1 text-xs">
      <span className="text-c-text-muted">{label}</span>
      <span className="text-right font-medium text-c-text">{value}</span>
    </div>
  );

  const rightPanel = (
    <ArtifactRightPanel
      width="100%"
      className="h-full border-l border-c-border"
      ariaLabel={t('templateBuilder.workflow.details')}
      sections={[
        {
          id: 'metadata',
          label: t('templateBuilder.workflow.metadata'),
          defaultOpen: true,
          content: (
            <div className="space-y-2">
              {detailRow(t('templateBuilder.workflow.name'), seed.name)}
              {detailRow(t('templateBuilder.workflow.format'), type)}
              <Field label={t('templateBuilder.workflow.documentType')}>
                <TextInput value={documentType} onChange={setDocumentType} />
              </Field>
              {detailRow(t('templateBuilder.workflow.language'), 'EN')}
              <Field label={t('templateBuilder.workflow.audience')}>
                <TextInput value={audience} onChange={setAudience} />
              </Field>
              <Field label={t('templateBuilder.workflow.confidentiality')}>
                <Select
                  value={confidentiality}
                  options={[
                    { value: 'internal', label: t('templateBuilder.workflow.internal') },
                    { value: 'confidential', label: t('templateBuilder.workflow.confidential') },
                  ]}
                  onChange={setConfidentiality}
                />
              </Field>
            </div>
          ),
        },
        {
          id: 'formatting',
          label: t('templateBuilder.workflow.formatting'),
          defaultOpen: true,
          content: (
            <div className="space-y-1 text-xs text-c-text-secondary">
              <p className="font-medium text-c-text">{t('templateBuilder.workflow.brand')}</p>
              <p>{t('templateBuilder.workflow.formattingInherited')}</p>
            </div>
          ),
        },
        {
          id: 'sources',
          label: t('templateBuilder.workflow.sources'),
          content: (
            <p className="text-xs text-c-text-secondary">
              {t('templateBuilder.workflow.sourceCatalog')}
            </p>
          ),
        },
        {
          id: 'assignment',
          label: t('templateBuilder.workflow.assignment'),
          content: (
            <label className="flex items-center gap-2 text-xs text-c-text">
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={(event) => setSetAsDefault(event.target.checked)}
                className="h-4 w-4 rounded border-c-border accent-[color:var(--c-focus-solid)]"
              />
              {t('templateBuilder.workflow.defaultForType')}
            </label>
          ),
        },
        {
          id: 'approval',
          label: t('templateBuilder.workflow.approval'),
          content: (
            <div>
              {detailRow(
                t('templateBuilder.workflow.author'),
                t('templateBuilder.workflow.currentUser')
              )}
              {detailRow(
                t('templateBuilder.workflow.approver'),
                workflow?.approvedBy ?? t('templateBuilder.workflow.differentApprover')
              )}
              {detailRow(t('templateBuilder.workflow.version'), workflow?.version ?? '0.1')}
              {detailRow(t('templateBuilder.workflow.status'), workflow?.status ?? 'draft')}
            </div>
          ),
        },
        {
          id: 'history',
          label: t('templateBuilder.workflow.history'),
          content: (
            <p className="text-xs text-c-text-secondary">
              {workflow
                ? t('templateBuilder.workflow.draftCreated', { version: workflow.version })
                : t('templateBuilder.workflow.historyEmpty')}
            </p>
          ),
        },
      ]}
    />
  );

  return (
    <TemplateBuilder
      key={templateId ?? `${type}:${baseKind}:${baseTemplateId}`}
      initialDraft={seed}
      templateId={templateId ?? undefined}
      saveFn={saveNew}
      onSaved={() => undefined}
      onClose={onClose}
      centerHeader={setup}
      secondBar={menu2}
      artifactRightPanel={rightPanel}
      saveBlocked={baseKind !== 'archetype' && !baseTemplateId}
      workflow={{
        status: workflow?.status ?? 'draft',
        version: workflow?.version ?? '0.1',
        testPassed: Boolean(workflow?.lastTestPassedAt),
        testDisabled: !templateId || !objectId.trim(),
        testing,
        submitting,
        onTest: handleTest,
        onSubmit: handleSubmit,
        onApprove: workflow?.status === 'submitted' ? handleApprove : undefined,
      }}
    />
  );
};

export default GovernedTemplateBuilderFlow;
