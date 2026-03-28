/**
 * Report Canonical Templates Service
 *
 * Defines canonical section structures for R1-R4 report types
 * and provides AI-assisted outline proposal based on report definition layer.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/index.js';
import logger from '../utils/Logger.js';
import type {
  CommunicationRegister,
  GoalV3,
  ReportDensity,
  ReportTypeV3,
  SectionLanguage,
  SectionLength,
  SectionType,
} from './reportBuilderService.js';

// ==========================================
// TYPES
// ==========================================

export interface CanonicalSection {
  key: string;
  type: SectionType;
  title: string;
  titlePl: string;
  required: boolean;
  defaultLength: SectionLength;
  defaultLanguage: SectionLanguage;
  ragEnabled: boolean;
  defaultRegister?: CommunicationRegister;
}

export interface CanonicalTemplate {
  reportType: ReportTypeV3;
  label: string;
  labelPl: string;
  sections: CanonicalSection[];
}

export interface OutlineVariant {
  variantId: string;
  label: string;
  sections: CanonicalSection[];
  rationale: string;
}

// ==========================================
// CANONICAL TEMPLATES (R1-R4)
// ==========================================

export const CANONICAL_TEMPLATES: Record<string, CanonicalTemplate> = {
  R1: {
    reportType: 'R1',
    label: 'Weekly Execution',
    labelPl: 'Raport Tygodniowy Wykonania',
    sections: [
      {
        key: 'initiatives_overview',
        type: 'summary',
        title: 'Initiatives Overview',
        titlePl: 'Przegląd Inicjatyw',
        required: true,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        ragEnabled: true,
      },
      {
        key: 'tasks_progress',
        type: 'list',
        title: 'Tasks Progress',
        titlePl: 'Postęp Zadań',
        required: true,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        ragEnabled: true,
      },
      {
        key: 'blocked_risks',
        type: 'matrix',
        title: 'Blocked / Risks',
        titlePl: 'Blokady / Ryzyka',
        required: true,
        defaultLength: 'short',
        defaultLanguage: 'business',
        ragEnabled: true,
      },
      {
        key: 'decisions_pending',
        type: 'list',
        title: 'Decisions Pending',
        titlePl: 'Decyzje Oczekujące',
        required: false,
        defaultLength: 'short',
        defaultLanguage: 'business',
        ragEnabled: false,
      },
      {
        key: 'next_week_focus',
        type: 'action_plan',
        title: 'Next Week Focus',
        titlePl: 'Fokus na Następny Tydzień',
        required: true,
        defaultLength: 'short',
        defaultLanguage: 'business',
        ragEnabled: false,
      },
    ],
  },

  R2: {
    reportType: 'R2',
    label: 'Steering Committee',
    labelPl: 'Komitet Sterujący',
    sections: [
      {
        key: 'executive_summary',
        type: 'summary',
        title: 'Executive Summary',
        titlePl: 'Podsumowanie dla Zarządu',
        required: true,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        ragEnabled: true,
        defaultRegister: 'executive',
      },
      {
        key: 'initiatives_requiring_decision',
        type: 'recommendations',
        title: 'Initiatives Requiring Decision',
        titlePl: 'Inicjatywy Wymagające Decyzji',
        required: true,
        defaultLength: 'long',
        defaultLanguage: 'business',
        ragEnabled: true,
        defaultRegister: 'executive',
      },
      {
        key: 'budget_capacity_overview',
        type: 'matrix',
        title: 'Budget / Capacity Overview',
        titlePl: 'Przegląd Budżetu / Pojemności',
        required: true,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        ragEnabled: true,
        defaultRegister: 'technical',
      },
      {
        key: 'escalated_risks',
        type: 'list',
        title: 'Escalated Risks',
        titlePl: 'Eskalowane Ryzyka',
        required: true,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        ragEnabled: true,
      },
      {
        key: 'gate_decisions',
        type: 'action_plan',
        title: 'Gate Decisions',
        titlePl: 'Decyzje Bramkowe',
        required: false,
        defaultLength: 'short',
        defaultLanguage: 'business',
        ragEnabled: false,
      },
    ],
  },

  R3: {
    reportType: 'R3',
    label: 'Benefits Tracking',
    labelPl: 'Śledzenie Korzyści',
    sections: [
      {
        key: 'delivered_initiatives',
        type: 'list',
        title: 'Delivered Initiatives',
        titlePl: 'Zrealizowane Inicjatywy',
        required: true,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        ragEnabled: true,
      },
      {
        key: 'planned_vs_realized_benefits',
        type: 'matrix',
        title: 'Planned vs Realized Benefits',
        titlePl: 'Planowane vs Zrealizowane Korzyści',
        required: true,
        defaultLength: 'long',
        defaultLanguage: 'business',
        ragEnabled: true,
      },
      {
        key: 'kpi_trends',
        type: 'axis_analysis',
        title: 'KPI Trends',
        titlePl: 'Trendy KPI',
        required: true,
        defaultLength: 'medium',
        defaultLanguage: 'technical',
        ragEnabled: true,
      },
      {
        key: 'financial_impact',
        type: 'summary',
        title: 'Financial Impact',
        titlePl: 'Wpływ Finansowy',
        required: true,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        ragEnabled: true,
      },
      {
        key: 'corrective_actions',
        type: 'action_plan',
        title: 'Corrective Actions',
        titlePl: 'Działania Korygujące',
        required: false,
        defaultLength: 'short',
        defaultLanguage: 'business',
        ragEnabled: false,
      },
    ],
  },

  R4: {
    reportType: 'R4',
    label: 'Portfolio Overview',
    labelPl: 'Przegląd Portfela',
    sections: [
      {
        key: 'status_distribution',
        type: 'matrix',
        title: 'Status Distribution',
        titlePl: 'Rozkład Statusów',
        required: true,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        ragEnabled: true,
        defaultRegister: 'executive',
      },
      {
        key: 'budget_allocation',
        type: 'matrix',
        title: 'Budget Allocation',
        titlePl: 'Alokacja Budżetu',
        required: true,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        ragEnabled: true,
        defaultRegister: 'technical',
      },
      {
        key: 'value_realized_vs_planned',
        type: 'axis_analysis',
        title: 'Value Realized vs Planned',
        titlePl: 'Wartość Zrealizowana vs Planowana',
        required: true,
        defaultLength: 'long',
        defaultLanguage: 'business',
        ragEnabled: true,
        defaultRegister: 'executive',
      },
      {
        key: 'risk_exposure',
        type: 'summary',
        title: 'Risk Exposure',
        titlePl: 'Ekspozycja na Ryzyko',
        required: true,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        ragEnabled: true,
      },
      {
        key: 'timeline_heatmap',
        type: 'matrix',
        title: 'Timeline Heatmap',
        titlePl: 'Mapa Cieplna Harmonogramu',
        required: false,
        defaultLength: 'medium',
        defaultLanguage: 'technical',
        ragEnabled: true,
        defaultRegister: 'technical',
      },
    ],
  },
};

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Return the canonical template for a given report type (R1-R4).
 */
export function getCanonicalTemplate(reportType: string): CanonicalTemplate | null {
  const key = reportType.toUpperCase();
  return CANONICAL_TEMPLATES[key] ?? null;
}

/**
 * Propose 1-3 outline variants based on the report's definition layer.
 *
 * Current implementation: deterministic single variant derived from
 * goalV3 + communicationRegister + density stored on the report record.
 * Future: call LLM for creative multi-variant proposals.
 */
export async function proposeOutline(
  reportId: string,
  organizationId: string
): Promise<OutlineVariant[]> {
  const db = getDatabase();

  const row = await new Promise<any>((resolve, reject) => {
    db.get(
      `SELECT id, report_type_v3, goal_v3, communication_register, density, title
       FROM report_builder_reports
       WHERE id = ? AND organization_id = ?`,
      [reportId, organizationId],
      (err: any, r: any) => (err ? reject(err) : resolve(r))
    );
  });

  if (!row) {
    throw new Error(`Report ${reportId} not found in organization ${organizationId}`);
  }

  const reportTypeV3: ReportTypeV3 | undefined = row.report_type_v3;
  const goalV3: GoalV3 | undefined = row.goal_v3;
  const register: CommunicationRegister | undefined = row.communication_register;
  const density: ReportDensity | undefined = row.density;

  const baseTemplate = reportTypeV3 ? CANONICAL_TEMPLATES[reportTypeV3] : null;
  if (!baseTemplate) {
    logger.warn('[CanonicalTemplates] No base template for reportTypeV3, falling back to R1', {
      reportId,
      reportTypeV3,
    });
  }

  const template = baseTemplate ?? CANONICAL_TEMPLATES.R1;

  const variants: OutlineVariant[] = [];

  // Variant 1: Tailored to the report's definition layer
  const tailoredSections = template.sections.map((s) => adaptSection(s, goalV3, register, density));
  variants.push({
    variantId: uuidv4(),
    label: buildVariantLabel(goalV3, register, density),
    sections: tailoredSections,
    rationale: buildRationale(template.reportType, goalV3, register, density),
  });

  logger.info('[CanonicalTemplates] Outline proposed', {
    reportId,
    reportTypeV3: template.reportType,
    variantCount: variants.length,
  });

  return variants;
}

// ==========================================
// INTERNAL HELPERS
// ==========================================

function adaptSection(
  section: CanonicalSection,
  goalV3?: GoalV3,
  register?: CommunicationRegister,
  density?: ReportDensity
): CanonicalSection {
  let length = section.defaultLength;
  let language = section.defaultLanguage;
  const effectiveRegister = section.defaultRegister || register;

  if (density === 'concise') length = 'short';
  else if (density === 'detailed' || density === 'comprehensive') length = 'long';

  if (effectiveRegister === 'executive') language = 'business';
  else if (effectiveRegister === 'technical') language = 'technical';
  else if (effectiveRegister === 'narrative') language = 'general';

  if (goalV3 === 'decide' && section.type === 'recommendations') {
    length = 'long';
  }
  if (goalV3 === 'sell' && section.type === 'summary') {
    length = 'long';
  }

  return {
    ...section,
    defaultLength: length,
    defaultLanguage: language,
    defaultRegister: effectiveRegister,
  };
}

function buildVariantLabel(
  goalV3?: GoalV3,
  register?: CommunicationRegister,
  density?: ReportDensity
): string {
  const parts: string[] = [];
  if (goalV3) parts.push(goalV3.charAt(0).toUpperCase() + goalV3.slice(1));
  if (register) parts.push(register);
  if (density) parts.push(density);
  return parts.length > 0 ? `Tailored: ${parts.join(' / ')}` : 'Default outline';
}

function buildRationale(
  reportType: ReportTypeV3,
  goalV3?: GoalV3,
  register?: CommunicationRegister,
  density?: ReportDensity
): string {
  const lines: string[] = [`Based on canonical ${reportType} template.`];
  if (goalV3)
    lines.push(
      `Goal "${goalV3}" emphasises ${goalV3 === 'decide' ? 'recommendations & options' : goalV3 === 'sell' ? 'executive summary & impact' : goalV3 === 'align' ? 'shared understanding & next steps' : 'clarity & data presentation'}.`
    );
  if (register) lines.push(`Register "${register}" shapes language level across sections.`);
  if (density) lines.push(`Density "${density}" adjusts section lengths accordingly.`);
  return lines.join(' ');
}
