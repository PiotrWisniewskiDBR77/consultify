/**
 * reportWizardTypes — config + catalog for the Report Generator Wizard (Task #20).
 *
 * This is the data SSOT for the wizard: the 11 report types mirrored from the
 * Reporting screen (ExecutionHub reportCatalog), the cadence model, and the
 * shape of the report config object produced on Complete.
 *
 * The wizard is an MVP BASE: it captures the report *configuration* (type +
 * cadence + goal/scope/presentation) and emits it. Full per-type rendering
 * engines are deliberately out of scope.
 */

import i18n from '@/i18n';

/** Stable ids matching the Reporting screen catalog (ExecutionHub reportCatalog). */
export type ReportTypeId =
  | 'weekly-exec'
  | 'monthly-pmo'
  | 'program-health'
  | 'blockers-recovery'
  | 'milestone-slippage'
  | 'capacity-utilization'
  | 'budget-variance'
  | 'decision-backlog'
  | 'cross-dependency'
  | 'delivery-confidence'
  | 'sponsor-onepager';

/** How the report runs: once vs on a repeating schedule. */
export type CadenceMode = 'on_demand' | 'recurring';

/** Repeat interval when cadence mode is 'recurring'. */
export type RecurrenceUnit = 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly';

/** Visual density of the produced report. */
export type ReportDensity = 'concise' | 'standard' | 'detailed';

/** A lucide icon name reference (resolved in the wizard component). */
export type ReportIconName =
  | 'CalendarDays'
  | 'TrendingUp'
  | 'Shield'
  | 'AlertTriangle'
  | 'Clock'
  | 'Users'
  | 'Scale'
  | 'GripVertical'
  | 'Sparkles'
  | 'FileText';

/** Catalog descriptor for one of the 11 report types. */
export interface ReportTypeDef {
  id: ReportTypeId;
  title: string;
  /** Bilingual title for PL UI. */
  titlePl: string;
  /** Primary intended audience. */
  audience: string;
  audiencePl: string;
  /** Default cadence label as shown on the Reporting screen. */
  defaultCadence: string;
  /** Default cadence mode pre-selected in step 2. */
  defaultCadenceMode: CadenceMode;
  /** Default recurrence unit pre-selected in step 3 (when recurring). */
  defaultRecurrenceUnit: RecurrenceUnit;
  /** Default mandatory sections for the report. */
  defaultSections: string[];
  /** Short one-line purpose. */
  blurb: string;
  blurbPl: string;
  icon: ReportIconName;
}

/**
 * The 11 report types — EXACTLY the catalog from the Reporting screen
 * (ExecutionHub.tsx reportCatalog), enriched with wizard defaults.
 */
export const REPORT_TYPES: ReportTypeDef[] = [
  {
    id: 'weekly-exec',
    title: 'Weekly Execution Pack',
    titlePl: 'Tygodniowy Pakiet Wykonawczy',
    audience: 'PMO, Team Leads',
    audiencePl: 'PMO, Liderzy zespołów',
    defaultCadence: 'Weekly',
    defaultCadenceMode: 'recurring',
    defaultRecurrenceUnit: 'weekly',
    defaultSections: [
      'Progress summary',
      'Blockers & escalations',
      'Overdue items',
      'Next milestones',
      'Key decisions needed',
    ],
    blurb: 'Weekly delivery status for the execution cycle.',
    blurbPl: 'Tygodniowy status realizacji w bieżącym cyklu.',
    icon: 'CalendarDays',
  },
  {
    id: 'monthly-pmo',
    title: 'Monthly PMO Review',
    titlePl: 'Miesięczny Przegląd PMO',
    audience: 'PMO Director, Sponsors',
    audiencePl: 'Dyrektor PMO, Sponsorzy',
    defaultCadence: 'Monthly',
    defaultCadenceMode: 'recurring',
    defaultRecurrenceUnit: 'monthly',
    defaultSections: [
      'Portfolio trend (MoM)',
      'Milestone slippage summary',
      'Budget variance',
      'Delivery confidence',
      'Capacity utilization overview',
    ],
    blurb: 'Full portfolio month-over-month trends.',
    blurbPl: 'Trendy całego portfela miesiąc do miesiąca.',
    icon: 'TrendingUp',
  },
  {
    id: 'program-health',
    title: 'Program Health Summary',
    titlePl: 'Podsumowanie Kondycji Programu',
    audience: 'Steering Committee',
    audiencePl: 'Komitet Sterujący',
    defaultCadence: 'Bi-weekly',
    defaultCadenceMode: 'recurring',
    defaultRecurrenceUnit: 'bi_weekly',
    defaultSections: [
      'RAG per initiative',
      'Priority alerts',
      'Confidence score & trend',
      'Executive narrative',
      'Required governance decisions',
    ],
    blurb: 'Per-initiative RAG and aggregate program health.',
    blurbPl: 'RAG inicjatyw i zagregowana kondycja programu.',
    icon: 'Shield',
  },
  {
    id: 'blockers-recovery',
    title: 'Blockers & Recovery Report',
    titlePl: 'Raport Blokad i Naprawy',
    audience: 'PMO, Delivery Managers',
    audiencePl: 'PMO, Menedżerowie dostarczania',
    defaultCadence: 'On demand',
    defaultCadenceMode: 'on_demand',
    defaultRecurrenceUnit: 'weekly',
    defaultSections: [
      'Active blockers list',
      'Blast radius per blocker',
      'Owner accountability',
      'Recovery actions proposed',
      'Dependency chain impact',
    ],
    blurb: 'Blocked initiatives and downstream blast radius.',
    blurbPl: 'Zablokowane inicjatywy i ich zasięg oddziaływania.',
    icon: 'AlertTriangle',
  },
  {
    id: 'milestone-slippage',
    title: 'Milestone Slippage Report',
    titlePl: 'Raport Poślizgów Kamieni Milowych',
    audience: 'PMO, Sponsors',
    audiencePl: 'PMO, Sponsorzy',
    defaultCadence: 'Weekly',
    defaultCadenceMode: 'recurring',
    defaultRecurrenceUnit: 'weekly',
    defaultSections: [
      'Slipped milestones',
      'Drift by initiative',
      'Root cause analysis',
      'Forecast accuracy trend',
      'Recovery timeline',
    ],
    blurb: 'Milestones with baseline vs forecast drift.',
    blurbPl: 'Kamienie milowe z odchyleniem plan vs prognoza.',
    icon: 'Clock',
  },
  {
    id: 'capacity-utilization',
    title: 'Capacity Utilization Report',
    titlePl: 'Raport Wykorzystania Zasobów',
    audience: 'Resource Managers, PMO',
    audiencePl: 'Menedżerowie zasobów, PMO',
    defaultCadence: 'Monthly',
    defaultCadenceMode: 'recurring',
    defaultRecurrenceUnit: 'monthly',
    defaultSections: [
      'Utilization by person',
      'Team averages',
      'Overload alerts',
      'Underutilized resources',
      'Capacity horizon (4-week lookahead)',
    ],
    blurb: 'Per-person and per-team workload vs capacity.',
    blurbPl: 'Obciążenie osób i zespołów względem dostępności.',
    icon: 'Users',
  },
  {
    id: 'budget-variance',
    title: 'Budget Variance Report',
    titlePl: 'Raport Odchyleń Budżetowych',
    audience: 'Finance, Sponsors',
    audiencePl: 'Finanse, Sponsorzy',
    defaultCadence: 'Monthly',
    defaultCadenceMode: 'recurring',
    defaultRecurrenceUnit: 'monthly',
    defaultSections: [
      'Aggregate budget status',
      'Per-initiative variance',
      'Forecast overshoot alerts',
      'Burn rate trend',
      'Cost category breakdown',
    ],
    blurb: 'Planned vs actual budget per initiative.',
    blurbPl: 'Budżet planowany vs rzeczywisty per inicjatywa.',
    icon: 'TrendingUp',
  },
  {
    id: 'decision-backlog',
    title: 'Decision Backlog & Approval Aging',
    titlePl: 'Zaległe Decyzje i Wiek Zatwierdzeń',
    audience: 'PMO, Decision Owners',
    audiencePl: 'PMO, Właściciele decyzji',
    defaultCadence: 'Weekly',
    defaultCadenceMode: 'recurring',
    defaultRecurrenceUnit: 'weekly',
    defaultSections: [
      'Pending decisions list',
      'Aging histogram',
      'Decision-latency risk',
      'Accountability gaps',
      'Downstream blocked work',
    ],
    blurb: 'All pending decisions and approval age.',
    blurbPl: 'Wszystkie oczekujące decyzje i wiek zatwierdzeń.',
    icon: 'Scale',
  },
  {
    id: 'cross-dependency',
    title: 'Cross-Initiative Dependency Report',
    titlePl: 'Raport Zależności Międzyinicjatywowych',
    audience: 'PMO, Architects',
    audiencePl: 'PMO, Architekci',
    defaultCadence: 'Bi-weekly',
    defaultCadenceMode: 'recurring',
    defaultRecurrenceUnit: 'bi_weekly',
    defaultSections: [
      'Dependency map',
      'Critical path',
      'Cascade impact analysis',
      'Dependency health',
      'External dependency risks',
    ],
    blurb: 'Inter-initiative dependency graph and cascade risk.',
    blurbPl: 'Graf zależności inicjatyw i ryzyko kaskadowe.',
    icon: 'GripVertical',
  },
  {
    id: 'delivery-confidence',
    title: 'Delivery Confidence Report',
    titlePl: 'Raport Pewności Dostarczenia',
    audience: 'Steering Committee, Sponsors',
    audiencePl: 'Komitet Sterujący, Sponsorzy',
    defaultCadence: 'Monthly',
    defaultCadenceMode: 'recurring',
    defaultRecurrenceUnit: 'monthly',
    defaultSections: [
      'Confidence per initiative',
      'Trend direction',
      'Risk-adjusted forecast',
      'Sponsor-ready narrative',
      'Recommended governance actions',
    ],
    blurb: 'Risk-adjusted delivery forecast with confidence scoring.',
    blurbPl: 'Prognoza dostarczenia skorygowana o ryzyko.',
    icon: 'Sparkles',
  },
  {
    id: 'sponsor-onepager',
    title: 'Sponsor-Ready One-Pager',
    titlePl: 'Jednostronicowy Raport dla Sponsora',
    audience: 'Executive Sponsors',
    audiencePl: 'Sponsorzy wykonawczy',
    defaultCadence: 'On demand',
    defaultCadenceMode: 'on_demand',
    defaultRecurrenceUnit: 'monthly',
    defaultSections: [
      'Overall progress',
      'Top 3 risks',
      'Next milestones',
      'Decisions required from sponsor',
      'Key achievements this period',
    ],
    blurb: 'Concise executive summary of portfolio state.',
    blurbPl: 'Zwięzłe wykonawcze podsumowanie stanu portfela.',
    icon: 'FileText',
  },
];

/** The configuration object produced by the wizard on Complete. */
export interface ReportConfig {
  /** Locally-generated unique id for the produced report entry. */
  id: string;
  typeId: ReportTypeId;
  /** Human title (defaults to the type title; user may override). */
  title: string;
  audience: string;
  cadenceMode: CadenceMode;
  /** Present only when cadenceMode === 'recurring'. */
  recurrenceUnit?: RecurrenceUnit;
  /** Resolved cadence label for list display (e.g. "Weekly", "On demand"). */
  cadenceLabel: string;
  /** What the report should achieve (free text). */
  goal: string;
  /** Scope: explicit period and/or a free-text scope note. */
  periodFrom?: string;
  periodTo?: string;
  scopeNote?: string;
  /** Presentation controls. */
  sections: string[];
  density: ReportDensity;
  /** ISO timestamp of creation. */
  createdAt: string;
}

/** Event name dispatched by the host (ExecutionHub / L7) to open the wizard. */
export const REPORT_WIZARD_OPEN_EVENT = 'reporting:new-report';
/** Event name emitted on Complete so the Reporting list can pick up the entry. */
export const REPORT_CREATED_EVENT = 'reporting:report-created';

/** Resolve a human-readable cadence label from mode + unit. */
export const resolveCadenceLabel = (
  mode: CadenceMode,
  unit: RecurrenceUnit | undefined,
  isPolish: boolean
): string => {
  const lng = isPolish ? 'pl' : 'en';
  if (mode === 'on_demand') {
    return i18n.t('reports.reportWizardTypes.cadenceOnDemand', { lng, defaultValue: 'On demand' });
  }
  switch (unit) {
    case 'weekly':
      return i18n.t('reports.reportWizardTypes.cadenceWeekly', { lng, defaultValue: 'Weekly' });
    case 'bi_weekly':
      return i18n.t('reports.reportWizardTypes.cadenceBiWeekly', {
        lng,
        defaultValue: 'Bi-weekly',
      });
    case 'monthly':
      return i18n.t('reports.reportWizardTypes.cadenceMonthly', { lng, defaultValue: 'Monthly' });
    case 'quarterly':
      return i18n.t('reports.reportWizardTypes.cadenceQuarterly', {
        lng,
        defaultValue: 'Quarterly',
      });
    default:
      return i18n.t('reports.reportWizardTypes.cadenceRecurring', {
        lng,
        defaultValue: 'Recurring',
      });
  }
};
