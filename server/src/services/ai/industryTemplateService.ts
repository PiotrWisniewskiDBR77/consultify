/**
 * Industry Template Service (Enterprise)
 *
 * Provides industry-specific Deep Thinking configurations.
 * Enables:
 * - Auto-detect industry from organization profile
 * - Apply industry-specific DoD extensions
 * - Include relevant terminology and constraints
 */

import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface IndustryTemplate {
  id: string;
  industry: string;
  displayName: string;
  description?: string | null;
  additionalSections: string[];
  extraQualityChecks: string[];
  terminology: Record<string, string>;
  constraints: string[];
  typicalMetrics: string[];
  promptAddon?: string | null;
  reportTemplate?: string | null;
  isActive: boolean;
}

export type SupportedIndustry =
  | 'manufacturing'
  | 'healthcare'
  | 'finance'
  | 'retail'
  | 'technology'
  | 'general';

// ==========================================
// SERVICE
// ==========================================

/**
 * Get all available industry templates
 */
export async function getAvailableTemplates(): Promise<IndustryTemplate[]> {
  const rows = (await dbAll(
    `SELECT * FROM ai_industry_templates WHERE is_active = 1 ORDER BY display_name`,
    []
  )) as any[];

  return rows.map(parseTemplateRow);
}

/**
 * Get template by industry code
 */
export async function getTemplateByIndustry(industry: string): Promise<IndustryTemplate | null> {
  const row = (await dbGet(
    `SELECT * FROM ai_industry_templates WHERE industry = ? AND is_active = 1`,
    [industry]
  )) as any;

  if (!row) return null;
  return parseTemplateRow(row);
}

/**
 * Get template for an organization (auto-detect from org profile)
 */
export async function getTemplateForOrg(orgId: string): Promise<IndustryTemplate | null> {
  // Try to get industry from org memory
  const orgMemory = (await dbGet(`SELECT industry FROM ai_org_memory WHERE organization_id = ?`, [
    orgId,
  ])) as any;

  if (!orgMemory?.industry) {
    logger.debug(`[IndustryTemplate] No industry set for org ${orgId}`);
    return null;
  }

  const industry = normalizeIndustry(orgMemory.industry);
  return getTemplateByIndustry(industry);
}

/**
 * Build prompt addon for industry
 */
export function buildIndustryPromptAddon(template: IndustryTemplate, language?: string): string {
  const isPolish = (language || 'en').startsWith('pl');

  const header = isPolish
    ? `## Kontekst Branżowy: ${template.displayName}`
    : `## Industry Context: ${template.displayName}`;

  const sections = [];

  // Add terminology
  if (Object.keys(template.terminology).length > 0) {
    const termHeader = isPolish ? '**Terminologia branżowa:**' : '**Industry Terminology:**';
    const terms = Object.entries(template.terminology)
      .map(([k, v]) => `- **${k}**: ${v}`)
      .join('\n');
    sections.push(`${termHeader}\n${terms}`);
  }

  // Add constraints
  if (template.constraints.length > 0) {
    const constHeader = isPolish ? '**Ograniczenia regulacyjne:**' : '**Regulatory Constraints:**';
    const constraints = template.constraints.map((c) => `- ${c}`).join('\n');
    sections.push(`${constHeader}\n${constraints}`);
  }

  // Add typical metrics
  if (template.typicalMetrics.length > 0) {
    const metricHeader = isPolish ? '**Kluczowe metryki:**' : '**Key Metrics to Consider:**';
    const metrics = template.typicalMetrics.map((m) => `- ${m}`).join('\n');
    sections.push(`${metricHeader}\n${metrics}`);
  }

  // Add additional sections requirement
  if (template.additionalSections.length > 0) {
    const sectionHeader = isPolish
      ? '**Wymagane dodatkowe sekcje w analizie:**'
      : '**Required Additional Sections:**';
    const sectionMap: Record<string, string> = {
      oee_impact: isPolish ? 'Wpływ na OEE' : 'OEE Impact Analysis',
      lean_assessment: isPolish ? 'Ocena Lean' : 'Lean Assessment',
      safety_implications: isPolish ? 'Implikacje BHP' : 'Safety Implications',
      supply_chain_effects: isPolish ? 'Efekty łańcucha dostaw' : 'Supply Chain Effects',
      patient_safety: isPolish ? 'Bezpieczeństwo pacjenta' : 'Patient Safety Analysis',
      regulatory_compliance: isPolish ? 'Zgodność regulacyjna' : 'Regulatory Compliance',
      clinical_efficacy: isPolish ? 'Skuteczność kliniczna' : 'Clinical Efficacy',
      privacy_hipaa: isPolish ? 'Prywatność (HIPAA/GDPR)' : 'Privacy (HIPAA/GDPR)',
      regulatory_risk: isPolish ? 'Ryzyko regulacyjne' : 'Regulatory Risk',
      market_impact: isPolish ? 'Wpływ na rynek' : 'Market Impact',
      counterparty_risk: isPolish ? 'Ryzyko kontrahenta' : 'Counterparty Risk',
      compliance_checklist: isPolish ? 'Lista kontrolna zgodności' : 'Compliance Checklist',
      customer_experience: isPolish ? 'Doświadczenie klienta' : 'Customer Experience',
      inventory_impact: isPolish ? 'Wpływ na zapasy' : 'Inventory Impact',
      scalability_assessment: isPolish ? 'Ocena skalowalności' : 'Scalability Assessment',
      technical_debt: isPolish ? 'Dług techniczny' : 'Technical Debt',
      security_review: isPolish ? 'Przegląd bezpieczeństwa' : 'Security Review',
    };

    const addSections = template.additionalSections
      .map((s) => `- ${sectionMap[s] || s}`)
      .join('\n');
    sections.push(`${sectionHeader}\n${addSections}`);
  }

  // Add custom prompt addon
  if (template.promptAddon) {
    sections.push(template.promptAddon);
  }

  return `\n${header}\n\n${sections.join('\n\n')}\n`;
}

/**
 * Get extra DoD quality checks for industry
 */
export function getIndustryQualityChecks(template: IndustryTemplate): string[] {
  const checks: string[] = [];

  // Add checks based on additional sections
  for (const section of template.additionalSections) {
    checks.push(`section_${section}`);
  }

  // Add constraint compliance checks
  if (template.constraints.includes('HIPAA')) {
    checks.push('hipaa_compliance_mentioned');
  }
  if (template.constraints.includes('SOX')) {
    checks.push('sox_compliance_mentioned');
  }
  if (template.constraints.includes('ISO 9001')) {
    checks.push('quality_standard_referenced');
  }

  return checks;
}

// ==========================================
// HELPERS
// ==========================================

function parseTemplateRow(row: any): IndustryTemplate {
  return {
    id: row.id,
    industry: row.industry,
    displayName: row.display_name,
    description: row.description || null,
    additionalSections: row.additional_sections ? JSON.parse(row.additional_sections) : [],
    extraQualityChecks: row.extra_quality_checks ? JSON.parse(row.extra_quality_checks) : [],
    terminology: row.terminology ? JSON.parse(row.terminology) : {},
    constraints: row.constraints ? JSON.parse(row.constraints) : [],
    typicalMetrics: row.typical_metrics ? JSON.parse(row.typical_metrics) : [],
    promptAddon: row.prompt_addon || null,
    reportTemplate: row.report_template || null,
    isActive: row.is_active === 1,
  };
}

function normalizeIndustry(industry: string): string {
  const lower = (industry || '').toLowerCase();

  const mappings: Record<string, string[]> = {
    manufacturing: ['manufactur', 'produkcj', 'przemysł', 'factory', 'fabryk'],
    healthcare: ['health', 'medical', 'pharma', 'hospital', 'zdrowi', 'medycz', 'szpital'],
    finance: ['financ', 'bank', 'insurance', 'finans', 'ubezpiecz'],
    retail: ['retail', 'ecommerce', 'consumer', 'detalicz', 'sklep'],
    technology: ['tech', 'software', 'saas', 'it ', 'technolog', 'oprogramow'],
  };

  for (const [key, patterns] of Object.entries(mappings)) {
    if (patterns.some((p) => lower.includes(p))) {
      return key;
    }
  }

  return 'general';
}
