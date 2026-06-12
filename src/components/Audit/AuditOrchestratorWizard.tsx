/**
 * AuditOrchestratorWizard — defines an audit program (owner flagged direction
 * ⭐⭐⭐, audit #19 / #19b / #19c).
 *
 * Self-contained multi-step wizard (deliberately not coupled to the shared
 * WizardModal shell so it stays robust while sibling wizards evolve in parallel).
 * It reuses the canonical form primitives (MultiSelect) for the picker steps.
 *
 * Flow:
 *   1. Objective + (optional) preset — ISO 27001 (#19c) or "new company" (#19b)
 *      pre-populate the objective and a suggested who-fills-what plan.
 *   2. Templates — multi-select of interview templates ("what to ask").
 *   3. Assignees — multi-select of org users ("who fills what").
 *   4. Review — summary + suggested plan, then "Create program".
 *
 * On create it POSTs the program (name, objective, preset, config{templateIds,
 * assigneeIds, plan, surveysGenerated:false}). The program record persists
 * end-to-end. Bulk creation of the underlying surveys/assignments is the
 * documented MVP boundary — surfaced as a disabled "Generate surveys" note on
 * the review step and `surveysGenerated:false` in config.
 *
 * Bilingual (pl/en) throughout.
 */

import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MultiSelect, type MultiSelectOption } from '@/components/shared/forms';
import { type WizardStep, WizardStepper } from '@/components/shared/WizardModal';

import {
  type AuditProgram,
  type AuditTemplateOption,
  type AuditUserOption,
  createProgram,
  listTemplateOptions,
  listUserOptions,
} from './auditApi';
import {
  AUDIT_PRESETS,
  type AuditPreset,
  buildPlanFromPreset,
  getPresetById,
  type SuggestedPlanRow,
} from './auditPresets';

interface AuditOrchestratorWizardProps {
  open: boolean;
  onClose: () => void;
  /** Called with the created program so the hub can refresh/select it. */
  onCreated?: (program: AuditProgram) => void;
  /** Optional preset to start from (e.g. opened via "New ISO 27001 audit"). */
  initialPresetId?: string | null;
}

type StepId = 'objective' | 'templates' | 'assignees' | 'review';
const STEP_ORDER: StepId[] = ['objective', 'templates', 'assignees', 'review'];

export const AuditOrchestratorWizard: React.FC<AuditOrchestratorWizardProps> = ({
  open,
  onClose,
  onCreated,
  initialPresetId = null,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const tr = (en: string, pl: string) => (isPolish ? pl : en);

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [presetId, setPresetId] = useState<string | null>(initialPresetId);

  const [templateOptions, setTemplateOptions] = useState<AuditTemplateOption[]>([]);
  const [userOptions, setUserOptions] = useState<AuditUserOption[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);

  const [loadingLookups, setLoadingLookups] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load templates + users when opened.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingLookups(true);
    Promise.all([listTemplateOptions(), listUserOptions()])
      .then(([templates, users]) => {
        if (cancelled) return;
        setTemplateOptions(templates);
        setUserOptions(users);
      })
      .finally(() => {
        if (!cancelled) setLoadingLookups(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reset transient state on each fresh open; apply the initial preset.
  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setName('');
    setSelectedTemplateIds([]);
    setSelectedAssigneeIds([]);
    setError(null);
    setSubmitting(false);
    setPresetId(initialPresetId);
    const preset = getPresetById(initialPresetId);
    setObjective(preset ? (isPolish ? preset.objective.pl : preset.objective.en) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPresetId]);

  const activePreset: AuditPreset | null = useMemo(() => getPresetById(presetId), [presetId]);

  const plan: SuggestedPlanRow[] = useMemo(
    () => (activePreset ? buildPlanFromPreset(activePreset, isPolish) : []),
    [activePreset, isPolish]
  );

  const templateMultiOptions: MultiSelectOption[] = useMemo(
    () =>
      templateOptions.map((t) => ({
        value: t.id,
        label: t.name,
        description: t.category,
      })),
    [templateOptions]
  );

  const userMultiOptions: MultiSelectOption[] = useMemo(
    () =>
      userOptions.map((u) => ({
        value: u.id,
        label: u.name,
        description: u.email,
      })),
    [userOptions]
  );

  if (!open) return null;

  const step = STEP_ORDER[stepIndex];
  const isLastStep = stepIndex === STEP_ORDER.length - 1;

  /** Per-step gate for the Next button. Name is the only hard requirement. */
  const canProceed = (): boolean => {
    if (step === 'objective') return name.trim().length > 0;
    return true;
  };

  const applyPreset = (id: string | null) => {
    setPresetId(id);
    const preset = getPresetById(id);
    // Only auto-fill objective if the user hasn't typed their own.
    if (preset && !objective.trim()) {
      setObjective(isPolish ? preset.objective.pl : preset.objective.en);
    }
  };

  const handleCreate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const program = await createProgram({
        name: name.trim(),
        objective: objective.trim() || null,
        preset: presetId,
        status: 'draft',
        config: {
          templateIds: selectedTemplateIds,
          assigneeIds: selectedAssigneeIds,
          // Advisory plan rows from the preset (#19b/#19c). Purely metadata.
          plan,
          // MVP boundary: surveys/assignments are NOT generated yet.
          surveysGenerated: false,
        },
      });
      onCreated?.(program);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr('Failed to create program', 'Nie udało się utworzyć programu')
      );
    } finally {
      setSubmitting(false);
    }
  };

  // §5 — Map the wizard steps to the shared <WizardStepper> contract (clickable
  // pills + progress bar + managed accent), mirroring InsightCreatorModal. The
  // step labels/hints carry their EN/PL pairs. Per-step status drives the pill
  // state and the canonical "empty step" affordance (§5b): a picker step with
  // nothing selected yet shows as 'empty' (muted) rather than falsely complete.
  const stepMeta: Record<StepId, { label: WizardStep['label']; hint: WizardStep['hint'] }> = {
    objective: {
      label: { en: 'Objective', pl: 'Cel' },
      hint: { en: 'Name + preset', pl: 'Nazwa + szablon' },
    },
    templates: {
      label: { en: 'Templates', pl: 'Szablony' },
      hint: { en: 'What to ask', pl: 'O co pytać' },
    },
    assignees: {
      label: { en: 'Assignees', pl: 'Przypisani' },
      hint: { en: 'Who fills it', pl: 'Kto wypełnia' },
    },
    review: {
      label: { en: 'Review', pl: 'Podsumowanie' },
      hint: { en: 'Create program', pl: 'Utwórz program' },
    },
  };

  const stepHasContent = (id: StepId): boolean => {
    switch (id) {
      case 'objective':
        return name.trim().length > 0;
      case 'templates':
        return selectedTemplateIds.length > 0;
      case 'assignees':
        return selectedAssigneeIds.length > 0;
      case 'review':
        return false;
    }
  };

  const wizardSteps: WizardStep[] = STEP_ORDER.map((id, index) => {
    let status: WizardStep['status'] = 'empty';
    if (index === stepIndex) {
      status = 'ready';
    } else if (index < stepIndex && stepHasContent(id)) {
      status = 'complete';
    }
    return { id, label: stepMeta[id].label, hint: stepMeta[id].hint, status };
  });

  // Reachability gate: the user may revisit any already-visited step and step
  // exactly one ahead — but only when step 0's hard requirement (name) is met,
  // so they can't skip the gate. Mirrors canProceed() for step 'objective'.
  const maxReachableIndex = name.trim().length > 0 ? STEP_ORDER.length - 1 : stepIndex;

  const handleStepChange = (index: number) => {
    if (index <= maxReachableIndex) setStepIndex(index);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-navy-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/[0.08]">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {tr('New audit program', 'Nowy program audytu')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tr(
                'Define the objective, what to ask, and who fills it.',
                'Określ cel, o co pytać i kto wypełnia.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('Close', 'Zamknij')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper (shared §5 header: progress bar + clickable pills + accent). */}
        <WizardStepper
          steps={wizardSteps}
          activeStepIndex={stepIndex}
          maxReachableIndex={maxReachableIndex}
          onStepChange={handleStepChange}
          isPolish={isPolish}
          accentColor="#3b82f6"
        />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {step === 'objective' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {tr('Program name', 'Nazwa programu')} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tr('e.g. ISO 27001 readiness', 'np. Gotowość ISO 27001')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/40 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {tr('Start from a preset', 'Zacznij od szablonu')}
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => applyPreset(null)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                      presetId === null
                        ? 'border-primary-500 bg-primary-500/5'
                        : 'border-slate-200 hover:border-slate-300 dark:border-white/[0.08]'
                    }`}
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {tr('Custom', 'Własny')}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {tr('Start blank', 'Zacznij od zera')}
                    </span>
                  </button>
                  {AUDIT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                        presetId === p.id
                          ? 'border-primary-500 bg-primary-500/5'
                          : 'border-slate-200 hover:border-slate-300 dark:border-white/[0.08]'
                      }`}
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {isPolish ? p.label.pl : p.label.en}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {isPolish ? p.description.pl : p.description.en}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {tr('Objective', 'Cel')}
                </label>
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  rows={3}
                  placeholder={tr(
                    'What is this audit trying to assess?',
                    'Co ma ocenić ten audyt?'
                  )}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/40 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                />
              </div>

              {activePreset && (
                <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    {tr('Suggested plan (who fills what)', 'Sugerowany plan (kto co wypełnia)')}
                  </div>
                  {/* #19b enhancement boundary: heuristic, not AI. */}
                  <p className="mb-2 text-[11px] text-slate-500">
                    {tr(
                      'Heuristic suggestion. AI-generated planning from org context is a planned enhancement.',
                      'Sugestia heurystyczna. Planowanie generowane przez AI z kontekstu organizacji to planowane rozszerzenie.'
                    )}
                  </p>
                  <ul className="space-y-1">
                    {plan.map((row) => (
                      <li key={row.areaKey} className="flex justify-between text-xs">
                        <span className="text-slate-700 dark:text-slate-200">{row.area}</span>
                        <span className="text-slate-400">{row.suggestedRole}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 'templates' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {tr(
                  'Pick the interview templates this audit will ask.',
                  'Wybierz szablony wywiadów, o które ten audyt zapyta.'
                )}
              </p>
              {loadingLookups ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tr('Loading templates…', 'Ładowanie szablonów…')}
                </div>
              ) : (
                <MultiSelect
                  values={selectedTemplateIds}
                  onChange={setSelectedTemplateIds}
                  options={templateMultiOptions}
                  placeholder={tr('Select templates…', 'Wybierz szablony…')}
                  searchPlaceholder={tr('Search templates', 'Szukaj szablonów')}
                  emptyLabel={tr('No templates found', 'Nie znaleziono szablonów')}
                  aria-label={tr('Templates', 'Szablony')}
                />
              )}
            </div>
          )}

          {step === 'assignees' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {tr(
                  'Pick the people who will fill the surveys.',
                  'Wybierz osoby, które wypełnią ankiety.'
                )}
              </p>
              {loadingLookups ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tr('Loading people…', 'Ładowanie osób…')}
                </div>
              ) : (
                <MultiSelect
                  values={selectedAssigneeIds}
                  onChange={setSelectedAssigneeIds}
                  options={userMultiOptions}
                  placeholder={tr('Select assignees…', 'Wybierz przypisanych…')}
                  searchPlaceholder={tr('Search people', 'Szukaj osób')}
                  emptyLabel={tr('No people found', 'Nie znaleziono osób')}
                  aria-label={tr('Assignees', 'Przypisani')}
                />
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <ReviewRow label={tr('Name', 'Nazwa')} value={name || '—'} />
              <ReviewRow label={tr('Objective', 'Cel')} value={objective || '—'} />
              <ReviewRow
                label={tr('Preset', 'Szablon')}
                value={
                  activePreset
                    ? isPolish
                      ? activePreset.label.pl
                      : activePreset.label.en
                    : tr('Custom', 'Własny')
                }
              />
              <ReviewRow
                label={tr('Templates', 'Szablony')}
                value={String(selectedTemplateIds.length)}
              />
              <ReviewRow
                label={tr('Assignees', 'Przypisani')}
                value={String(selectedAssigneeIds.length)}
              />

              <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                {tr(
                  'The program record will be created now. Individual surveys and assignments can be generated from the program page after creation.',
                  'Rekord programu zostanie utworzony teraz. Ankiety i przypisania można wygenerować ze strony programu po jego utworzeniu.'
                )}
              </div>

              {error && (
                <div className="rounded-xl border border-red-400/30 bg-red-400/5 p-3 text-xs text-red-600 dark:text-red-300">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={() => (stepIndex === 0 ? onClose() : setStepIndex((i) => i - 1))}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            <ArrowLeft className="h-4 w-4" />
            {stepIndex === 0 ? tr('Cancel', 'Anuluj') : tr('Back', 'Wstecz')}
          </button>

          {isLastStep ? (
            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {tr('Create program', 'Utwórz program')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStepIndex((i) => i + 1)}
              disabled={!canProceed()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {tr('Next', 'Dalej')}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ReviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 dark:border-white/[0.06]">
    <span className="text-sm text-slate-500">{label}</span>
    <span className="max-w-[60%] text-right text-sm font-medium text-slate-800 dark:text-slate-100">
      {value}
    </span>
  </div>
);

export default AuditOrchestratorWizard;
