import { Archive, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState, LoadingState } from '@/components/shared/states';
import { StatusChip } from '@/components/ui/primitives/chips';
import { Api } from '@/services/api';
import {
  TransformationCasesApi,
  type TransformationPlanningIntakeDto,
} from '@/services/api/v8/transformation-cases';

interface GovernedTemplate {
  id: string;
  key: string;
  title: string;
  description?: string | null;
  status: 'draft' | 'published' | 'deprecated';
  version: number;
  usage_count?: number;
  updated_at?: string;
  has_planning_blueprint?: boolean;
}

interface GovernanceDetail {
  versions: Array<{
    version: number;
    status_at_version: string;
    change_notes?: string | null;
    runtime_bundle_digest?: string | null;
  }>;
  events: Array<{
    event_id: string;
    version: number;
    event_type: string;
    reason?: string | null;
    created_at: string;
  }>;
}

function extractData<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'data' in value) {
    return (value as { data: T }).data;
  }
  return value as T;
}

function readableTemplateKey(value: string): string {
  const normalized = value.replace(/[_-]+/g, ' ').trim();
  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : value;
}

const TEMPLATE_LABELS: Record<string, { pl: string; en: string }> = {
  draft: { pl: 'Wersja robocza', en: 'Draft' },
  published: { pl: 'Opublikowany', en: 'Published' },
  deprecated: { pl: 'Wycofany', en: 'Deprecated' },
  created: { pl: 'Utworzono', en: 'Created' },
  updated: { pl: 'Zaktualizowano', en: 'Updated' },
};

export function agentTemplateLabel(value: string, isPolish: boolean): string {
  return (
    TEMPLATE_LABELS[value.toLowerCase()]?.[isPolish ? 'pl' : 'en'] ?? readableTemplateKey(value)
  );
}

export const AgentProcessTemplatesPanel: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isPolish = i18n.language.startsWith('pl');
  const [templates, setTemplates] = useState<GovernedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ forbidden: boolean; message: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [planningIntake, setPlanningIntake] = useState<TransformationPlanningIntakeDto | null>(
    null
  );
  const [intakeValues, setIntakeValues] = useState({
    measurableOutcomes: '',
    sponsor: '',
    scope: '',
    horizon: '',
  });
  const [intakeKeys, setIntakeKeys] = useState<{ start: string; convert: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, GovernanceDetail>>({});
  const [announcement, setAnnouncement] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setAnnouncement(isPolish ? 'Wczytywanie szablonów…' : 'Loading templates…');
    try {
      setTemplates(extractData<GovernedTemplate[]>(await Api.listAgentProcessTemplates()));
      setAnnouncement(isPolish ? 'Szablony zostały wczytane.' : 'Templates loaded.');
    } catch (error) {
      const status = Number(
        (error as { response?: { status?: number }; status?: number })?.response?.status ??
          (error as { status?: number })?.status
      );
      setLoadError({
        forbidden: status === 401 || status === 403,
        message:
          error instanceof Error
            ? error.message
            : isPolish
              ? 'Szablony są niedostępne.'
              : 'Templates are unavailable.',
      });
      setAnnouncement(isPolish ? 'Nie udało się wczytać szablonów.' : 'Failed to load templates.');
      toast.error(error instanceof Error ? error.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  const transition = async (template: GovernedTemplate, action: 'publish' | 'deprecate') => {
    const reason = window.prompt(
      isPolish ? 'Podaj uzasadnienie decyzji governance:' : 'Provide a governance reason:'
    );
    if (!reason?.trim()) return;
    setBusyId(template.id);
    try {
      await Api.transitionAgentProcessTemplate(template.id, action, reason.trim());
      toast.success(isPolish ? 'Stan szablonu został zmieniony.' : 'Template status updated.');
      setAnnouncement(isPolish ? 'Stan szablonu został zmieniony.' : 'Template status updated.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Template transition failed');
    } finally {
      setBusyId(null);
    }
  };

  const startTransformationFromTemplate = async (template: GovernedTemplate) => {
    setBusyId(template.id);
    try {
      const keys = { start: crypto.randomUUID(), convert: crypto.randomUUID() };
      setIntakeKeys(keys);
      const intake = extractData<TransformationPlanningIntakeDto>(
        await TransformationCasesApi.startPlanningIntakeFromTemplate(
          { templateId: template.id },
          keys.start
        )
      );
      setPlanningIntake(intake);
      setIntakeValues({
        measurableOutcomes: intake.measurableOutcomes.join(', '),
        sponsor: intake.sponsor ?? '',
        scope: intake.scope ?? '',
        horizon: intake.horizon ?? '',
      });
      setAnnouncement(
        isPolish
          ? 'Szablon przypięty do intake transformacji.'
          : 'Template pinned to transformation intake.'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Template instantiation failed');
    } finally {
      setBusyId(null);
    }
  };

  const continueTemplateIntake = async () => {
    if (!planningIntake || !intakeKeys) return;
    setBusyId(planningIntake.sourceTemplateId);
    try {
      let intake = planningIntake;
      if (intake.status === 'needs_clarification')
        intake = extractData<TransformationPlanningIntakeDto>(
          await TransformationCasesApi.answerPlanningIntake(intake.intakeId, {
            measurableOutcomes: intakeValues.measurableOutcomes
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean),
            sponsor: intakeValues.sponsor,
            scope: intakeValues.scope,
            horizon: intakeValues.horizon,
          })
        );
      setPlanningIntake(intake);
      if (intake.status === 'ready' && intake.sourceTemplateDigest) {
        const converted = extractData<{ transformationCaseId: string }>(
          await TransformationCasesApi.convertTemplatePlanningIntake(
            intake.intakeId,
            intake.sourceTemplateDigest,
            intakeKeys.convert
          )
        );
        navigate(
          `/my-work?tab=agent&transformationCaseId=${encodeURIComponent(converted.transformationCaseId)}`
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Template intake failed');
    } finally {
      setBusyId(null);
    }
  };

  const toggleHistory = async (templateId: string) => {
    if (expandedId === templateId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(templateId);
    if (details[templateId]) return;
    try {
      const detail = extractData<GovernanceDetail>(
        await Api.getAgentProcessTemplateGovernance(templateId)
      );
      setDetails((current) => ({ ...current, [templateId]: detail }));
    } catch (error) {
      setExpandedId(null);
      toast.error(error instanceof Error ? error.message : 'Failed to load governance history');
    }
  };

  if (loading)
    return (
      <div aria-busy="true">
        <LoadingState template="list" rows={5} />
      </div>
    );

  if (loadError)
    return (
      <section
        aria-label={isPolish ? 'Zarządzane szablony procesów' : 'Governed process templates'}
      >
        <EmptyState
          variant={loadError.forbidden ? 'forbidden' : 'error'}
          title={
            loadError.forbidden
              ? isPolish
                ? 'Brak dostępu do governance szablonów'
                : 'Template governance access denied'
              : isPolish
                ? 'Nie udało się wczytać szablonów'
                : 'Failed to load templates'
          }
          description={loadError.message}
          onRetry={loadError.forbidden ? undefined : load}
        />
      </section>
    );

  return (
    <section
      className="space-y-4"
      data-testid="agent-process-templates-panel"
      aria-labelledby="agent-templates-heading"
      aria-busy={Boolean(busyId)}
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-c-border bg-c-surface p-4">
        <div>
          <h2
            id="agent-templates-heading"
            className="flex items-center gap-2 font-semibold text-c-text"
          >
            <ShieldCheck size={18} />
            {isPolish ? 'Zarządzane szablony procesów' : 'Governed process templates'}
          </h2>
          <p className="mt-1 text-sm text-c-text-muted">
            {isPolish
              ? 'Wersjonowane definicje agentów z kontrolą publikacji i niezmiennym pakietem runtime.'
              : 'Versioned agent definitions with publication governance and immutable runtime bundle.'}
          </p>
        </div>
        <button
          type="button"
          aria-label={isPolish ? 'Odśwież szablony procesów' : 'Refresh process templates'}
          className="inline-flex items-center gap-2 text-sm text-c-text"
          onClick={() => void load()}
        >
          <RefreshCw size={15} /> {isPolish ? 'Odśwież' : 'Refresh'}
        </button>
      </div>

      {planningIntake && (
        <div
          className="space-y-2 rounded-xl border border-c-border bg-c-surface p-4"
          data-testid="template-planning-intake"
        >
          <p className="font-semibold text-c-text">{planningIntake.mandate}</p>
          <p className="text-xs text-c-text-muted">
            v{planningIntake.sourceTemplateVersion} ·{' '}
            {planningIntake.sourceTemplateDigest?.slice(0, 12)}…
          </p>
          <input
            aria-label={isPolish ? 'Mierzalne wyniki' : 'Measurable outcomes'}
            value={intakeValues.measurableOutcomes}
            onChange={(e) => setIntakeValues((v) => ({ ...v, measurableOutcomes: e.target.value }))}
            className="w-full rounded border border-c-border bg-c-bg px-2 py-1"
          />
          <input
            aria-label={isPolish ? 'Sponsor' : 'Sponsor'}
            value={intakeValues.sponsor}
            onChange={(e) => setIntakeValues((v) => ({ ...v, sponsor: e.target.value }))}
            className="w-full rounded border border-c-border bg-c-bg px-2 py-1"
          />
          <input
            aria-label={isPolish ? 'Zakres' : 'Scope'}
            value={intakeValues.scope}
            onChange={(e) => setIntakeValues((v) => ({ ...v, scope: e.target.value }))}
            className="w-full rounded border border-c-border bg-c-bg px-2 py-1"
          />
          <input
            aria-label={isPolish ? 'Horyzont' : 'Horizon'}
            value={intakeValues.horizon}
            onChange={(e) => setIntakeValues((v) => ({ ...v, horizon: e.target.value }))}
            className="w-full rounded border border-c-border bg-c-bg px-2 py-1"
          />
          <p className="text-xs text-c-text-muted">
            {planningIntake.missingKeys.join(', ') ||
              (isPolish ? 'Gotowe do utworzenia Case' : 'Ready to create Case')}
          </p>
          <button
            type="button"
            onClick={() => void continueTemplateIntake()}
            className="rounded bg-c-text px-3 py-2 text-sm text-c-bg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {planningIntake.status === 'needs_clarification'
              ? isPolish
                ? 'Uzupełnij i utwórz Case'
                : 'Complete and create Case'
              : isPolish
                ? 'Utwórz Case'
                : 'Create Case'}
          </button>
        </div>
      )}

      {templates.length === 0 ? (
        <EmptyState title={isPolish ? 'Brak zarządzanych szablonów' : 'No governed templates'} />
      ) : (
        <div className="grid gap-3">
          {templates.map((template) => (
            <article
              key={template.id}
              className="rounded-xl border border-c-border bg-c-surface p-4"
              aria-labelledby={`agent-template-${template.id}-title`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      id={`agent-template-${template.id}-title`}
                      className="font-semibold text-c-text"
                    >
                      {template.title}
                    </h3>
                    <StatusChip
                      tone={
                        template.status === 'published'
                          ? 'success'
                          : template.status === 'deprecated'
                            ? 'warning'
                            : 'neutral'
                      }
                      label={agentTemplateLabel(template.status, isPolish)}
                    />
                  </div>
                  <p className="mt-1 text-sm text-c-text-muted">
                    {template.description || template.key}
                  </p>
                  <p className="mt-2 text-xs text-c-text-muted">
                    v{template.version} · {isPolish ? 'użycia' : 'uses'}:{' '}
                    {template.usage_count ?? 0}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-expanded={expandedId === template.id}
                    aria-controls={`agent-template-${template.id}-history`}
                    className="rounded-lg border border-c-border px-3 py-2 text-sm text-c-text"
                    onClick={() => void toggleHistory(template.id)}
                  >
                    {expandedId === template.id
                      ? isPolish
                        ? 'Ukryj historię'
                        : 'Hide history'
                      : isPolish
                        ? 'Historia'
                        : 'History'}
                  </button>
                  {template.status === 'draft' && (
                    <button
                      type="button"
                      disabled={busyId === template.id}
                      className="rounded-lg border border-c-border px-3 py-2 text-sm text-c-text disabled:opacity-50"
                      onClick={() => void transition(template, 'publish')}
                    >
                      {isPolish ? 'Opublikuj' : 'Publish'}
                    </button>
                  )}
                  {template.status === 'published' && (
                    <>
                      {template.has_planning_blueprint && (
                        <button
                          type="button"
                          disabled={busyId === template.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-c-text px-3 py-2 text-sm text-c-bg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
                          onClick={() => void startTransformationFromTemplate(template)}
                        >
                          <Play size={14} />{' '}
                          {isPolish ? 'Użyj do transformacji' : 'Use for transformation'}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === template.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-c-border px-3 py-2 text-sm text-c-text disabled:opacity-50"
                        onClick={() => void transition(template, 'deprecate')}
                      >
                        <Archive size={14} /> {isPolish ? 'Wycofaj' : 'Deprecate'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {expandedId === template.id && (
                <div
                  id={`agent-template-${template.id}-history`}
                  className="mt-4 grid gap-4 border-t border-c-border pt-4 md:grid-cols-2"
                  role="region"
                  aria-label={`${isPolish ? 'Historia governance' : 'Governance history'}: ${template.title}`}
                >
                  <div>
                    <h4 className="text-sm font-semibold text-c-text">
                      {isPolish ? 'Wersje' : 'Versions'}
                    </h4>
                    <ul className="mt-2 space-y-2 text-sm text-c-text-muted">
                      {(details[template.id]?.versions || []).map((version) => (
                        <li key={version.version}>
                          v{version.version} ·{' '}
                          {agentTemplateLabel(version.status_at_version, isPolish)}
                          {version.change_notes ? ` · ${version.change_notes}` : ''}
                          {version.runtime_bundle_digest && (
                            <code className="mt-1 block text-xs">
                              SHA-256 {version.runtime_bundle_digest.slice(0, 12)}…
                            </code>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-c-text">
                      {isPolish ? 'Dziennik governance' : 'Governance log'}
                    </h4>
                    <ul className="mt-2 space-y-2 text-sm text-c-text-muted">
                      {(details[template.id]?.events || []).map((event) => (
                        <li key={event.event_id}>
                          v{event.version} · {agentTemplateLabel(event.event_type, isPolish)}
                          {event.reason ? ` · ${event.reason}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
