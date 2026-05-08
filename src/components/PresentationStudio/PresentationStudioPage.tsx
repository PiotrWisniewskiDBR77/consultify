/**
 * PresentationStudioPage (Sprint S5)
 *
 * Module: Consultify Presentation Studio.
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - DRD/UI_UX_SOURCE_OF_TRUTH.md
 *   - DRD/consultify/docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md
 *   - DRD/consultify/docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md
 *
 * Minimal, read-only Studio surface that consumes the four S1..S4 preview
 * endpoints and renders honest source/narrative/template/generate previews.
 * NEVER mutates anything. There is no "Generate" or "Approve" CTA: those
 * land in later sprints behind explicit approval flows.
 *
 * UI/UX governance:
 *   - The contextual AI action ("Run preview") lives in the local Menu 3
 *     command-row right slot per `.cursor/rules/ai-actions-menu3.mdc`.
 *     This page does not yet adopt the full ModuleHub shell, so the local
 *     command row stands in for `commandRowRightContent`. Adopting the
 *     full ModuleHub shell will be a separate sprint.
 *   - Status semantics use the canonical color map (slate/blue/amber/
 *     emerald/rose; primary reserved for selection/CTA).
 *   - Loading, success, error, empty, and degraded states are all rendered
 *     honestly. No fake success, no infinite spinner, no hidden writes.
 */

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import {
  GeneratePreviewResponse,
  NarrativePlanPreviewResponse,
  PresentationStudioApi,
  PresentationStudioSetupInput,
  SourcePackPreviewResponse,
  TemplatePlanPreviewResponse,
} from '@/services/api/presentationStudio.api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviewState {
  loading: boolean;
  error: string | null;
  sourcePack: SourcePackPreviewResponse | null;
  narrativePlan: NarrativePlanPreviewResponse | null;
  templatePlan: TemplatePlanPreviewResponse | null;
  generate: GeneratePreviewResponse | null;
}

const INITIAL_STATE: PreviewState = {
  loading: false,
  error: null,
  sourcePack: null,
  narrativePlan: null,
  templatePlan: null,
  generate: null,
};

const DEFAULT_SETUP: PresentationStudioSetupInput = {
  title: 'Steering Committee Preview',
  audience: 'executive',
  goal: 'decide',
  language: 'en',
  theme: 'corporate',
  confidentiality: 'internal',
  deckType: 'steering_committee',
  sourceArtifacts: [
    {
      type: 'assessment',
      id: 'demo-assessment-1',
      label: 'Demo readiness assessment',
      confidence: 0.7,
      readiness: 'ready',
    },
  ],
};

// ---------------------------------------------------------------------------
// Reusable status badge using canonical color semantics
// ---------------------------------------------------------------------------

type StatusTone = 'slate' | 'blue' | 'amber' | 'emerald' | 'rose';

interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
  icon?: React.ReactNode;
}

function StatusBadge({ tone, label, icon }: StatusBadgeProps): React.ReactElement {
  const TONE_CLASS: Record<StatusTone, string> = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
      data-testid="status-badge"
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section card primitive
// ---------------------------------------------------------------------------

interface SectionCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
  testId?: string;
}

function SectionCard({
  title,
  description,
  children,
  badge,
  testId,
}: SectionCardProps): React.ReactElement {
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      data-testid={testId}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
        </div>
        {badge ? <div className="flex shrink-0 items-center">{badge}</div> : null}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tone helpers
// ---------------------------------------------------------------------------

function toneForSourcePackStatus(status?: string): StatusTone {
  if (status === 'ready') return 'emerald';
  if (status === 'partial') return 'amber';
  return 'slate';
}

function toneForNarrativeStatus(status?: string): StatusTone {
  if (status === 'ready') return 'emerald';
  if (status === 'needs_sources') return 'amber';
  return 'slate';
}

function toneForTemplateStatus(status?: string): StatusTone {
  if (status === 'ready_for_review') return 'blue';
  if (status === 'draft') return 'amber';
  if (status === 'needs_sources') return 'rose';
  return 'slate';
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export const PresentationStudioPage: React.FC = () => {
  const [setup] = useState<PresentationStudioSetupInput>(DEFAULT_SETUP);
  const [state, setState] = useState<PreviewState>(INITIAL_STATE);

  const runPreview = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [sourcePack, narrativePlan, templatePlan, generate] = await Promise.all([
        PresentationStudioApi.previewSourcePack(setup),
        PresentationStudioApi.previewNarrativePlan({ setup }),
        PresentationStudioApi.previewTemplatePlan({ setup }),
        PresentationStudioApi.previewGenerate({ setup }),
      ]);
      setState({
        loading: false,
        error: null,
        sourcePack,
        narrativePlan,
        templatePlan,
        generate,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error running Studio preview.',
      }));
    }
  }, [setup]);

  const isEmpty =
    !state.sourcePack && !state.narrativePlan && !state.templatePlan && !state.generate;

  // Stable display fields built off current state. Memoized so re-renders
  // from local state do not recompute these on every paint.
  const summary = useMemo(() => {
    return {
      sourcePackStatus: state.sourcePack?.sourcePack.status ?? null,
      narrativeStatus: state.narrativePlan?.narrativePlan.status ?? null,
      templateStatus: state.templatePlan?.templatePlan.status ?? null,
      canProceed: state.generate?.wouldGenerate.canProceed ?? null,
    };
  }, [state]);

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-950"
      data-testid="presentation-studio-page"
    >
      {/* Local Menu 3 / command row. Per the AI-actions-menu3 rule, the
          contextual AI action ("Run preview") MUST live on the right side of
          the local command row, not inside the canvas. */}
      <header
        className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/90"
        data-testid="presentation-studio-command-row"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Presentation Studio
            </p>
            <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
              Studio preview surface
            </h1>
          </div>
          <div
            className="flex shrink-0 items-center gap-2"
            data-testid="presentation-studio-command-row-right"
          >
            <button
              type="button"
              onClick={runPreview}
              disabled={state.loading}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-primary-500 dark:hover:bg-primary-400"
              data-testid="presentation-studio-run-preview"
            >
              {state.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{state.loading ? 'Running preview…' : 'Run preview'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-4 px-6 py-6">
        {state.error ? (
          <div
            className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
            role="alert"
            data-testid="presentation-studio-error"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <div className="font-medium">Studio preview failed</div>
              <div className="mt-1">{state.error}</div>
            </div>
          </div>
        ) : null}

        {isEmpty && !state.loading && !state.error ? (
          <div
            className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
            data-testid="presentation-studio-empty"
          >
            Click{' '}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              Run preview
            </strong>{' '}
            to fetch source pack, narrative plan, template plan, and generate previews. This page
            never persists anything and never invokes deck generation.
          </div>
        ) : null}

        {/* Source Pack */}
        <SectionCard
          title="Source pack preview"
          description="Tenant-scoped read of source coverage, missing inputs, and readiness."
          testId="section-source-pack"
          badge={
            summary.sourcePackStatus ? (
              <StatusBadge
                tone={toneForSourcePackStatus(summary.sourcePackStatus)}
                label={summary.sourcePackStatus}
              />
            ) : null
          }
        >
          {state.sourcePack ? (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sources
                </dt>
                <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                  {state.sourcePack.sourcePack.sources.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Missing inputs
                </dt>
                <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                  {state.sourcePack.missingInputs.length}
                </dd>
              </div>
              {state.sourcePack.warnings.length > 0 ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Warnings
                  </dt>
                  <ul
                    className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700 dark:text-slate-300"
                    data-testid="source-pack-warnings"
                  >
                    {state.sourcePack.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No data yet.</p>
          )}
        </SectionCard>

        {/* Narrative Plan */}
        <SectionCard
          title="Narrative plan preview"
          description="Deck-level thesis, storyline, decisions, and per-slide narrative role."
          testId="section-narrative-plan"
          badge={
            summary.narrativeStatus ? (
              <StatusBadge
                tone={toneForNarrativeStatus(summary.narrativeStatus)}
                label={summary.narrativeStatus}
              />
            ) : null
          }
        >
          {state.narrativePlan ? (
            <div className="space-y-3 text-sm">
              {state.narrativePlan.narrativePlan.thesis ? (
                <p className="text-slate-800 dark:text-slate-200">
                  <span className="font-medium">Thesis:</span>{' '}
                  {state.narrativePlan.narrativePlan.thesis}
                </p>
              ) : null}
              <p className="text-slate-600 dark:text-slate-400">
                {state.narrativePlan.narrativePlan.slidePlan.length} slide narrative roles planned.
              </p>
              {state.narrativePlan.warnings.length > 0 ? (
                <ul
                  className="list-disc space-y-0.5 pl-5 text-slate-700 dark:text-slate-300"
                  data-testid="narrative-warnings"
                >
                  {state.narrativePlan.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No data yet.</p>
          )}
        </SectionCard>

        {/* Template Plan */}
        <SectionCard
          title="Template architect plan preview"
          description="Methodology-first template plan. Always returned with approvalRequired=true."
          testId="section-template-plan"
          badge={
            summary.templateStatus ? (
              <StatusBadge
                tone={toneForTemplateStatus(summary.templateStatus)}
                label={summary.templateStatus}
                icon={<ShieldAlert className="h-3 w-3" aria-hidden="true" />}
              />
            ) : null
          }
        >
          {state.templatePlan ? (
            <div className="space-y-3 text-sm">
              <p className="text-slate-800 dark:text-slate-200">
                <span className="font-medium">Template:</span>{' '}
                {state.templatePlan.templatePlan.templateName}{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  ({state.templatePlan.templatePlan.templateFamily})
                </span>
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                {state.templatePlan.templatePlan.sections.length} sections,{' '}
                {state.templatePlan.templatePlan.requiredInputs.length} required inputs,{' '}
                {state.templatePlan.templatePlan.optionalInputs.length} optional.
              </p>
              <div
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                data-testid="template-approval-banner"
              >
                Approval required before this template enters the registry.
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No data yet.</p>
          )}
        </SectionCard>

        {/* Generate Preview */}
        <SectionCard
          title="Generate dispatcher preview"
          description="What the deck would look like if generated now. Read-only — never persists."
          testId="section-generate"
          badge={
            summary.canProceed === null ? null : summary.canProceed ? (
              <StatusBadge
                tone="emerald"
                label="canProceed=true"
                icon={<CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
              />
            ) : (
              <StatusBadge
                tone="rose"
                label="canProceed=false"
                icon={<AlertTriangle className="h-3 w-3" aria-hidden="true" />}
              />
            )
          }
        >
          {state.generate ? (
            <div className="space-y-3 text-sm">
              <p className="text-slate-800 dark:text-slate-200">
                <span className="font-medium">Outline:</span> {state.generate.outlinePreview.length}{' '}
                items, {state.generate.estimatedSlideCount} estimated slides.
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Template family:{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {state.generate.usedTemplate.family ?? '—'}
                </span>
                {'  ·  '}
                Source: {state.generate.usedTemplate.source}
              </p>
              {state.generate.wouldGenerate.blockingReasons.length > 0 ? (
                <ul
                  className="list-disc space-y-0.5 pl-5 text-rose-700 dark:text-rose-300"
                  data-testid="generate-blocking-reasons"
                >
                  {state.generate.wouldGenerate.blockingReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No data yet.</p>
          )}
        </SectionCard>
      </main>
    </div>
  );
};

export default PresentationStudioPage;
