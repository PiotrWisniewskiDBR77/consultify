/**
 * ReportGeneratorWizard — the BASE report generator wizard (Task #20 / Lane L9).
 *
 * Visually matches the Interview InsightCreatorModal by REUSING the canonical
 * shared shell <WizardModal> (src/components/shared/WizardModal). Each step's
 * body is supplied via WizardStep.content, so all chrome (overlay, stepper
 * header, Back/Next/Complete footer, accent color, a11y, bilingual copy) is
 * inherited from the shell — guaranteeing parity with the other platform
 * wizards.
 *
 * Wiring:
 *  - This component self-mounts and listens for the 'reporting:new-report'
 *    CustomEvent (dispatched by ExecutionHub / Lane L7) to OPEN.
 *  - On Complete it builds a ReportConfig and dispatches the
 *    'reporting:report-created' CustomEvent with the config so the Reporting
 *    list can append the generated entry. (No global reporting store exists
 *    yet, so the event is the integration contract.)
 *
 * Scope: MVP BASE — wizard + config + emit. Full per-type rendering engines are
 * deliberately out of scope.
 *
 * Steps:
 *   1. Type     — choose one of the 11 report types
 *   2. Cadence  — On-demand vs Recurring
 *   3. Repeat   — (only when Recurring) Weekly / Bi-weekly / Monthly / Quarterly
 *   4. Scope    — goal + period/scope + presentation (sections / density / audience)
 */
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  FileText,
  GripVertical,
  Repeat,
  Scale,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { WizardModal, type WizardStep } from '@/components/shared/WizardModal';

import {
  type CadenceMode,
  type RecurrenceUnit,
  REPORT_CREATED_EVENT,
  REPORT_TYPES,
  REPORT_WIZARD_OPEN_EVENT,
  type ReportConfig,
  type ReportDensity,
  type ReportIconName,
  type ReportTypeDef,
  type ReportTypeId,
  resolveCadenceLabel,
} from './reportWizardTypes';

const ACCENT = 'rgb(var(--color-primary-600, 79 70 229))';

const ICON_MAP: Record<ReportIconName, React.ElementType> = {
  CalendarDays,
  TrendingUp,
  Shield,
  AlertTriangle,
  Clock,
  Users,
  Scale,
  GripVertical,
  Sparkles,
  FileText,
};

const RECURRENCE_UNITS: Array<{
  id: RecurrenceUnit;
  labelEn: string;
  labelPl: string;
  hintEn: string;
  hintPl: string;
}> = [
  {
    id: 'weekly',
    labelEn: 'Weekly',
    labelPl: 'Tygodniowo',
    hintEn: 'Every week',
    hintPl: 'Co tydzień',
  },
  {
    id: 'bi_weekly',
    labelEn: 'Bi-weekly',
    labelPl: 'Co dwa tygodnie',
    hintEn: 'Every two weeks',
    hintPl: 'Co dwa tygodnie',
  },
  {
    id: 'monthly',
    labelEn: 'Monthly',
    labelPl: 'Miesięcznie',
    hintEn: 'Every month',
    hintPl: 'Co miesiąc',
  },
  {
    id: 'quarterly',
    labelEn: 'Quarterly',
    labelPl: 'Kwartalnie',
    hintEn: 'Every quarter',
    hintPl: 'Co kwartał',
  },
];

const DENSITY_OPTIONS: Array<{
  id: ReportDensity;
  labelEn: string;
  labelPl: string;
  hintEn: string;
  hintPl: string;
}> = [
  {
    id: 'concise',
    labelEn: 'Concise',
    labelPl: 'Zwięzły',
    hintEn: 'One-pager, headlines only',
    hintPl: 'Jedna strona, tylko nagłówki',
  },
  {
    id: 'standard',
    labelEn: 'Standard',
    labelPl: 'Standardowy',
    hintEn: 'Balanced detail',
    hintPl: 'Zbalansowany poziom szczegółów',
  },
  {
    id: 'detailed',
    labelEn: 'Detailed',
    labelPl: 'Szczegółowy',
    hintEn: 'Full breakdown with appendices',
    hintPl: 'Pełna analiza z załącznikami',
  },
];

type ReportStepId = 'type' | 'cadence' | 'repeat' | 'scope';

/** A small uppercase section label, matching the table-canon header tone. */
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
    {children}
  </p>
);

export const ReportGeneratorWizard: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const tr = useCallback((en: string, pl: string) => (isPolish ? pl : en), [isPolish]);

  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completing, setCompleting] = useState(false);

  // Selection state
  const [typeId, setTypeId] = useState<ReportTypeId | null>(null);
  const [titleOverride, setTitleOverride] = useState('');
  const [cadenceMode, setCadenceMode] = useState<CadenceMode>('recurring');
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>('weekly');
  const [goal, setGoal] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [scopeNote, setScopeNote] = useState('');
  const [density, setDensity] = useState<ReportDensity>('standard');
  const [sections, setSections] = useState<string[]>([]);

  const selectedType: ReportTypeDef | null = useMemo(
    () => REPORT_TYPES.find((t) => t.id === typeId) ?? null,
    [typeId]
  );

  const resetState = useCallback(() => {
    setStepIndex(0);
    setTypeId(null);
    setTitleOverride('');
    setCadenceMode('recurring');
    setRecurrenceUnit('weekly');
    setGoal('');
    setPeriodFrom('');
    setPeriodTo('');
    setScopeNote('');
    setDensity('standard');
    setSections([]);
    setCompleting(false);
  }, []);

  // Listen for the host-dispatched open event (ExecutionHub / L7).
  useEffect(() => {
    const handleOpen = () => {
      resetState();
      setOpen(true);
    };
    window.addEventListener(REPORT_WIZARD_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(REPORT_WIZARD_OPEN_EVENT, handleOpen);
  }, [resetState]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  // Applying a type pre-fills defaults (cadence, recurrence, sections).
  const applyType = useCallback((def: ReportTypeDef) => {
    setTypeId(def.id);
    setCadenceMode(def.defaultCadenceMode);
    setRecurrenceUnit(def.defaultRecurrenceUnit);
    setSections(def.defaultSections);
  }, []);

  const toggleSection = (section: string) => {
    setSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  // The Repeat step only exists when the cadence is recurring. Keeping the steps
  // array dynamic keeps the stepper honest (no dead pill for on-demand).
  const steps: WizardStep[] = useMemo(() => {
    const base: Array<{ id: ReportStepId; step: WizardStep }> = [];

    base.push({
      id: 'type',
      step: {
        id: 'type',
        label: { en: 'Type', pl: 'Typ' },
        hint: { en: 'Which report?', pl: 'Który raport?' },
        status: typeId ? 'complete' : 'ready',
      },
    });

    base.push({
      id: 'cadence',
      step: {
        id: 'cadence',
        label: { en: 'Cadence', pl: 'Tryb' },
        hint: { en: 'On-demand or recurring?', pl: 'Na żądanie czy cyklicznie?' },
        status: 'ready',
      },
    });

    if (cadenceMode === 'recurring') {
      base.push({
        id: 'repeat',
        step: {
          id: 'repeat',
          label: { en: 'Repeat', pl: 'Powtarzanie' },
          hint: { en: 'How often?', pl: 'Jak często?' },
          status: 'ready',
        },
      });
    }

    base.push({
      id: 'scope',
      step: {
        id: 'scope',
        label: { en: 'Scope', pl: 'Zakres' },
        hint: { en: 'Goal, period & presentation', pl: 'Cel, okres i prezentacja' },
        status: goal.trim() ? 'complete' : 'ready',
      },
    });

    return base.map((b) => b.step);
  }, [typeId, cadenceMode, goal]);

  const activeStepId = (steps[stepIndex]?.id ?? 'type') as ReportStepId;

  // Next/Complete blocker: a type is required to advance past step 1; a goal is
  // required to Complete.
  const nextDisabled = useMemo(() => {
    if (activeStepId === 'type') return !typeId;
    if (activeStepId === 'scope') return goal.trim().length === 0;
    return false;
  }, [activeStepId, typeId, goal]);

  const handleComplete = useCallback(() => {
    if (!selectedType || goal.trim().length === 0) return;
    setCompleting(true);

    const config: ReportConfig = {
      id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      typeId: selectedType.id,
      title: titleOverride.trim() || (isPolish ? selectedType.titlePl : selectedType.title),
      audience: isPolish ? selectedType.audiencePl : selectedType.audience,
      cadenceMode,
      recurrenceUnit: cadenceMode === 'recurring' ? recurrenceUnit : undefined,
      cadenceLabel: resolveCadenceLabel(
        cadenceMode,
        cadenceMode === 'recurring' ? recurrenceUnit : undefined,
        isPolish
      ),
      goal: goal.trim(),
      periodFrom: periodFrom || undefined,
      periodTo: periodTo || undefined,
      scopeNote: scopeNote.trim() || undefined,
      sections: sections.length > 0 ? sections : selectedType.defaultSections,
      density,
      createdAt: new Date().toISOString(),
    };

    // No global reporting store exists yet, so the CustomEvent is the contract:
    // the Reporting list can listen and append the generated entry.
    window.dispatchEvent(new CustomEvent<ReportConfig>(REPORT_CREATED_EVENT, { detail: config }));

    setCompleting(false);
    setOpen(false);
  }, [
    selectedType,
    titleOverride,
    isPolish,
    cadenceMode,
    recurrenceUnit,
    goal,
    periodFrom,
    periodTo,
    scopeNote,
    sections,
    density,
  ]);

  // ---- Step bodies ----------------------------------------------------------

  const typeBody = (
    <div className="space-y-3">
      <SectionLabel>{tr('Report type', 'Typ raportu')}</SectionLabel>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {REPORT_TYPES.map((def) => {
          const Icon = ICON_MAP[def.icon];
          const active = typeId === def.id;
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => applyType(def)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                active
                  ? 'border-primary-500 bg-primary-50/70 ring-1 ring-primary-500/30 dark:border-primary-500/60 dark:bg-primary-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-navy-900 dark:hover:bg-white/[0.04]'
              }`}
            >
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  active
                    ? 'bg-navy-900 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-300'
                }`}
              >
                <Icon size={16} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {isPolish ? def.titlePl : def.title}
                  </span>
                  {active && <Check size={14} className="shrink-0 text-primary-600" />}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                  {isPolish ? def.blurbPl : def.blurb}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-navy-800 dark:text-slate-400">
                  {isPolish ? def.audiencePl : def.audience}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const cadenceBody = (
    <div className="space-y-4">
      <SectionLabel>{tr('How should this report run?', 'Jak ma działać raport?')}</SectionLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(
          [
            {
              id: 'on_demand' as CadenceMode,
              icon: Zap,
              titleEn: 'On-demand',
              titlePl: 'Na żądanie',
              hintEn: 'Generate once, now. No schedule.',
              hintPl: 'Wygeneruj raz, teraz. Bez harmonogramu.',
            },
            {
              id: 'recurring' as CadenceMode,
              icon: Repeat,
              titleEn: 'Recurring',
              titlePl: 'Cyklicznie',
              hintEn: 'Repeat automatically on a schedule.',
              hintPl: 'Powtarzaj automatycznie wg harmonogramu.',
            },
          ] as const
        ).map((opt) => {
          const Icon = opt.icon;
          const active = cadenceMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setCadenceMode(opt.id)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                active
                  ? 'border-primary-500 bg-primary-50/70 ring-1 ring-primary-500/30 dark:border-primary-500/60 dark:bg-primary-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-navy-900 dark:hover:bg-white/[0.04]'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  active
                    ? 'bg-navy-900 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-300'
                }`}
              >
                <Icon size={18} />
              </span>
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {isPolish ? opt.titlePl : opt.titleEn}
                  {active && <Check size={14} className="text-primary-600" />}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {isPolish ? opt.hintPl : opt.hintEn}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {selectedType && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {tr('Default for this report:', 'Domyślnie dla tego raportu:')}{' '}
          <span className="font-medium text-slate-500 dark:text-slate-400">
            {selectedType.defaultCadence}
          </span>
        </p>
      )}
    </div>
  );

  const repeatBody = (
    <div className="space-y-4">
      <SectionLabel>{tr('Repeat interval', 'Interwał powtarzania')}</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RECURRENCE_UNITS.map((unit) => {
          const active = recurrenceUnit === unit.id;
          return (
            <button
              key={unit.id}
              type="button"
              onClick={() => setRecurrenceUnit(unit.id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                active
                  ? 'border-primary-500 bg-primary-50/70 ring-1 ring-primary-500/30 dark:border-primary-500/60 dark:bg-primary-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-navy-900 dark:hover:bg-white/[0.04]'
              }`}
            >
              <CalendarClock
                size={18}
                className={active ? 'text-primary-600' : 'text-slate-400 dark:text-slate-500'}
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {isPolish ? unit.labelPl : unit.labelEn}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {isPolish ? unit.hintPl : unit.hintEn}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const scopeBody = (
    <div className="space-y-5">
      {/* Goal */}
      <div className="space-y-1.5">
        <SectionLabel>{tr('Goal', 'Cel')}</SectionLabel>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          placeholder={tr(
            'What should this report achieve for its audience?',
            'Co ten raport ma osiągnąć dla odbiorców?'
          )}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      {/* Optional title override */}
      <div className="space-y-1.5">
        <SectionLabel>{tr('Report name (optional)', 'Nazwa raportu (opcjonalnie)')}</SectionLabel>
        <input
          type="text"
          value={titleOverride}
          onChange={(e) => setTitleOverride(e.target.value)}
          placeholder={selectedType ? (isPolish ? selectedType.titlePl : selectedType.title) : ''}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      {/* Period / scope */}
      <div className="space-y-1.5">
        <SectionLabel>{tr('Period & scope', 'Okres i zakres')}</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              {tr('From', 'Od')}
            </span>
            <input
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              {tr('To', 'Do')}
            </span>
            <input
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-100"
            />
          </label>
        </div>
        <input
          type="text"
          value={scopeNote}
          onChange={(e) => setScopeNote(e.target.value)}
          placeholder={tr(
            'Scope note (e.g. only active initiatives, specific portfolio)',
            'Notatka o zakresie (np. tylko aktywne inicjatywy, wybrany portfel)'
          )}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      {/* Presentation: density */}
      <div className="space-y-1.5">
        <SectionLabel>{tr('Density', 'Gęstość')}</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {DENSITY_OPTIONS.map((opt) => {
            const active = density === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDensity(opt.id)}
                className={`rounded-xl border p-2.5 text-left transition-all ${
                  active
                    ? 'border-primary-500 bg-primary-50/70 ring-1 ring-primary-500/30 dark:border-primary-500/60 dark:bg-primary-500/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-navy-900 dark:hover:bg-white/[0.04]'
                }`}
              >
                <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {isPolish ? opt.labelPl : opt.labelEn}
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">
                  {isPolish ? opt.hintPl : opt.hintEn}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Presentation: sections */}
      {selectedType && (
        <div className="space-y-1.5">
          <SectionLabel>{tr('Sections', 'Sekcje')}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {selectedType.defaultSections.map((section) => {
              const active = sections.includes(section);
              return (
                <button
                  key={section}
                  type="button"
                  onClick={() => toggleSection(section)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all ${
                    active
                      ? 'border-c-text bg-c-text text-c-bg'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/[0.12] dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {active && <Check size={12} strokeWidth={3} />}
                  {section}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Audience read-out (presentation context) */}
      {selectedType && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {tr('Audience:', 'Odbiorcy:')}{' '}
          <span className="font-medium text-slate-500 dark:text-slate-400">
            {isPolish ? selectedType.audiencePl : selectedType.audience}
          </span>
        </p>
      )}
    </div>
  );

  const bodyByStep: Record<ReportStepId, React.ReactNode> = {
    type: typeBody,
    cadence: cadenceBody,
    repeat: repeatBody,
    scope: scopeBody,
  };

  return (
    <WizardModal
      open={open}
      onClose={handleClose}
      title={{ en: 'New report', pl: 'Nowy raport' }}
      steps={steps}
      activeStepIndex={stepIndex}
      onStepChange={setStepIndex}
      onComplete={handleComplete}
      completing={completing}
      isPolish={isPolish}
      accentColor={ACCENT}
      nextDisabled={nextDisabled}
    >
      {bodyByStep[activeStepId]}
    </WizardModal>
  );
};

export default ReportGeneratorWizard;
