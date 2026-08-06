/**
 * Consultify Document Studio — System Template Seeder (Epic E1, Slice 1.3).
 *
 * Seeds one approved `DocumentTemplate` per `DocumentTypeKey` × language
 * (PL + EN) under the SYSTEM_ORG_ID convention. Every tenant gets the
 * full curated catalogue without per-org duplication: `loadTemplatesForOrg`
 * folds `is_system = TRUE` rows into the org's listing.
 *
 * The seeder is idempotent: it inserts only templates whose `templateId`
 * is missing. A `templateId` is the deterministic
 * `doc-template-system-${language}-${documentType}` so reruns never
 * mint duplicate IDs.
 *
 * Scope guards:
 *   - Runs once per process via `seedSystemDocumentTemplates`.
 *   - Failures are logged and swallowed (the in-process service keeps
 *     working without seeded templates; the next start retries).
 *   - System-org rows are stored with `organizationId = SYSTEM_ORG_ID`,
 *     `is_system = TRUE`, `status = 'approved'`. They are immutable from
 *     the public API: an org-scoped `approveTemplate` / `deprecateTemplate`
 *     of a `templateId` belonging to SYSTEM_ORG_ID is rejected at the
 *     route layer (the artifact resolves to system-org tenancy).
 */

import logger from '../../utils/Logger.js';
import { planDocumentOutline } from './documentNarrativePlanner.js';
import type {
  CommunicationRegister,
  DocumentConfidentiality,
  DocumentDensity,
  DocumentLanguageStyle,
  DocumentTemplate,
  DocumentTypeKey,
  TemplateCategory,
  TemplateExportRules,
  TemplateSectionBlueprint,
} from './documentStudioTypes.js';
import { DEFAULT_CONSULTING_FORMATTING_SCHEMA } from './documentStudioTypes.js';
import {
  loadTemplatesForOrg,
  persistTemplate,
  SYSTEM_ORG_ID,
} from './documentTemplateRegistryDao.js';

interface SeedSpec {
  documentType: DocumentTypeKey;
  category: TemplateCategory;
  purposeEn: string;
  purposePl: string;
  audienceEn: string[];
  audiencePl: string[];
  requiredInputs: string[];
  confidentiality: DocumentConfidentiality;
  density: DocumentDensity;
  register: CommunicationRegister;
  languageStyle: DocumentLanguageStyle;
  approvalRequiredForExport: boolean;
}

/**
 * 22 catalogue entries — one per `DocumentTypeKey`. The seeder spreads
 * each entry across two languages (PL + EN) so a Polish consultant gets
 * native templates and an English-speaking partner sees English ones.
 *
 * Each entry maps tightly to `documentNarrativePlanner.ts` so the
 * deterministic blueprint stays in lock-step with the live outline that
 * Mode 1 / Mode 3 generation would produce.
 */
const SEED_CATALOGUE: SeedSpec[] = [
  {
    documentType: 'executive_memo',
    category: 'memo',
    purposeEn: 'Standardize executive memos: context, findings, decisions required, next steps.',
    purposePl: 'Ujednolić memo zarządcze: kontekst, wnioski, decyzje, następne kroki.',
    audienceEn: ['CEO', 'Board'],
    audiencePl: ['CEO', 'Zarząd'],
    requiredInputs: ['decision context', 'recommended action'],
    confidentiality: 'internal',
    density: 'concise',
    register: 'executive',
    languageStyle: 'consulting',
    approvalRequiredForExport: false,
  },
  {
    documentType: 'decision_memo',
    category: 'memo',
    purposeEn: 'Drive a single named decision with options, recommendation and risks.',
    purposePl: 'Doprowadzić do jednej decyzji z opcjami, rekomendacją i ryzykami.',
    audienceEn: ['Decision Maker', 'Sponsor'],
    audiencePl: ['Decydent', 'Sponsor'],
    requiredInputs: ['decision in one sentence', 'options', 'recommendation'],
    confidentiality: 'internal',
    density: 'concise',
    register: 'executive',
    languageStyle: 'consulting',
    approvalRequiredForExport: true,
  },
  {
    documentType: 'project_status_report',
    category: 'report',
    purposeEn: 'Periodic project status: progress, risks, blockers, asks.',
    purposePl: 'Okresowy status projektu: postęp, ryzyka, blokery, prośby.',
    audienceEn: ['Sponsor', 'Steering Committee', 'PMO'],
    audiencePl: ['Sponsor', 'Komitet Sterujący', 'PMO'],
    requiredInputs: ['progress summary', 'risk list', 'next milestones'],
    confidentiality: 'internal',
    density: 'standard',
    register: 'professional',
    languageStyle: 'consulting',
    approvalRequiredForExport: false,
  },
  {
    documentType: 'steering_committee_report',
    category: 'report',
    purposeEn: 'Formal steering committee report with decisions required and risk dashboard.',
    purposePl: 'Formalny raport na komitet sterujący z decyzjami i mapą ryzyk.',
    audienceEn: ['Steering Committee'],
    audiencePl: ['Komitet Sterujący'],
    requiredInputs: ['period summary', 'decisions required', 'risk register'],
    confidentiality: 'restricted',
    density: 'standard',
    register: 'executive',
    languageStyle: 'formal',
    approvalRequiredForExport: true,
  },
  {
    documentType: 'benefits_tracking_report',
    category: 'report',
    purposeEn: 'Track realized vs planned benefits per initiative.',
    purposePl: 'Śledź zrealizowane vs planowane korzyści per inicjatywa.',
    audienceEn: ['CFO', 'Transformation Officer'],
    audiencePl: ['CFO', 'Transformation Officer'],
    requiredInputs: ['benefit baseline', 'measurement method'],
    confidentiality: 'internal',
    density: 'standard',
    register: 'professional',
    languageStyle: 'consulting',
    approvalRequiredForExport: false,
  },
  {
    documentType: 'portfolio_overview',
    category: 'report',
    purposeEn: 'Portfolio-level view of initiatives, status, dependencies.',
    purposePl: 'Widok portfela: inicjatywy, status, zależności.',
    audienceEn: ['CEO', 'COO', 'PMO'],
    audiencePl: ['CEO', 'COO', 'PMO'],
    requiredInputs: ['initiative list', 'dependency map'],
    confidentiality: 'internal',
    density: 'standard',
    register: 'executive',
    languageStyle: 'consulting',
    approvalRequiredForExport: false,
  },
  {
    documentType: 'ai_audit_report',
    category: 'audit',
    purposeEn: 'Formal AI readiness audit with risks, opportunities, recommended initiatives.',
    purposePl: 'Formalny audyt gotowości AI z ryzykami, szansami i rekomendowanymi inicjatywami.',
    audienceEn: ['CEO', 'CFO', 'Transformation Officer'],
    audiencePl: ['CEO', 'CFO', 'Transformation Officer'],
    requiredInputs: ['audit scope', 'interview summaries', 'current state assessment'],
    confidentiality: 'client_confidential',
    density: 'detailed',
    register: 'executive',
    languageStyle: 'consulting',
    approvalRequiredForExport: true,
  },
  {
    documentType: 'interview_summary_report',
    category: 'audit',
    purposeEn: 'Structured summary of interview findings for an organization.',
    purposePl: 'Strukturalne podsumowanie obserwacji z rozmów w organizacji.',
    audienceEn: ['Sponsor', 'Project Lead'],
    audiencePl: ['Sponsor', 'Project Lead'],
    requiredInputs: ['interview transcripts', 'observations'],
    confidentiality: 'client_confidential',
    density: 'detailed',
    register: 'professional',
    languageStyle: 'consulting',
    approvalRequiredForExport: false,
  },
  {
    documentType: 'digital_transformation_roadmap',
    category: 'plan',
    purposeEn: 'Multi-year digital transformation roadmap with phases, dependencies, KPIs.',
    purposePl: 'Wieloletnia roadmapa transformacji cyfrowej z fazami, zależnościami i KPI.',
    audienceEn: ['Board', 'Transformation Officer', 'CIO'],
    audiencePl: ['Zarząd', 'Transformation Officer', 'CIO'],
    requiredInputs: ['current state', 'target state', 'priority initiatives'],
    confidentiality: 'restricted',
    density: 'comprehensive',
    register: 'executive',
    languageStyle: 'consulting',
    approvalRequiredForExport: false,
  },
  {
    documentType: 'business_case',
    category: 'business_case',
    purposeEn: 'Economic justification with assumptions, scenarios, ROI, sensitivity.',
    purposePl: 'Uzasadnienie ekonomiczne z założeniami, scenariuszami, ROI, wrażliwością.',
    audienceEn: ['CFO', 'Sponsor', 'Investment Committee'],
    audiencePl: ['CFO', 'Sponsor', 'Komitet Inwestycyjny'],
    requiredInputs: ['baseline KPIs', 'investment cost', 'expected benefits'],
    confidentiality: 'client_confidential',
    density: 'detailed',
    register: 'executive',
    languageStyle: 'consulting',
    approvalRequiredForExport: true,
  },
  {
    documentType: 'sales_proposal',
    category: 'proposal',
    purposeEn: 'Client-facing proposal with scope, methodology, team, timeline, investment.',
    purposePl: 'Oferta dla klienta: zakres, metodologia, zespół, harmonogram, inwestycja.',
    audienceEn: ['Buyer', 'Procurement', 'Sponsor'],
    audiencePl: ['Kupujący', 'Zakupy', 'Sponsor'],
    requiredInputs: ['client need', 'proposed approach', 'pricing model'],
    confidentiality: 'client_confidential',
    density: 'detailed',
    register: 'executive',
    languageStyle: 'consulting',
    approvalRequiredForExport: true,
  },
  {
    documentType: 'client_discovery_report',
    category: 'discovery',
    purposeEn: 'Discovery findings: pain points, goals, constraints, opportunities.',
    purposePl: 'Wyniki discovery: bóle, cele, ograniczenia, szanse.',
    audienceEn: ['Client Sponsor', 'Account Team'],
    audiencePl: ['Sponsor Klienta', 'Zespół Account'],
    requiredInputs: ['stakeholder map', 'discovery interviews'],
    confidentiality: 'client_confidential',
    density: 'standard',
    register: 'professional',
    languageStyle: 'consulting',
    approvalRequiredForExport: false,
  },
  {
    documentType: 'workshop_summary',
    category: 'discovery',
    purposeEn: 'Workshop output: decisions, themes, next steps, owners.',
    purposePl: 'Wynik warsztatu: decyzje, tematy, następne kroki, właściciele.',
    audienceEn: ['Workshop Participants', 'Sponsor'],
    audiencePl: ['Uczestnicy', 'Sponsor'],
    requiredInputs: ['workshop agenda', 'participants', 'outputs'],
    confidentiality: 'internal',
    density: 'standard',
    register: 'professional',
    languageStyle: 'narrative',
    approvalRequiredForExport: false,
  },
  {
    documentType: 'risk_register_report',
    category: 'governance',
    purposeEn: 'Risk register with severity, mitigation, owner, status.',
    purposePl: 'Rejestr ryzyk z severity, mitigacją, ownerem, statusem.',
    audienceEn: ['PMO', 'Sponsor', 'Risk Officer'],
    audiencePl: ['PMO', 'Sponsor', 'Risk Officer'],
    requiredInputs: ['risk taxonomy', 'severity scale'],
    confidentiality: 'internal',
    density: 'standard',
    register: 'professional',
    languageStyle: 'formal',
    approvalRequiredForExport: false,
  },
  {
    documentType: 'sop_document',
    category: 'sop',
    purposeEn: 'Standard Operating Procedure with steps, roles, controls.',
    purposePl: 'Standard Operating Procedure: kroki, role, kontrole.',
    audienceEn: ['Process Owners', 'Operators'],
    audiencePl: ['Właściciele Procesów', 'Operatorzy'],
    requiredInputs: ['process scope', 'roles', 'controls'],
    confidentiality: 'restricted',
    density: 'detailed',
    register: 'professional',
    languageStyle: 'formal',
    approvalRequiredForExport: false,
  },
  {
    documentType: 'implementation_plan',
    category: 'plan',
    purposeEn: 'Implementation plan: phases, milestones, owners, dependencies, deadlines.',
    purposePl: 'Plan wdrożenia: fazy, kamienie milowe, właściciele, zależności, terminy.',
    audienceEn: ['Project Team', 'Sponsor', 'PMO'],
    audiencePl: ['Zespół Projektu', 'Sponsor', 'PMO'],
    requiredInputs: ['scope', 'team', 'timeline'],
    confidentiality: 'internal',
    density: 'detailed',
    register: 'professional',
    languageStyle: 'consulting',
    approvalRequiredForExport: false,
  },
  {
    documentType: 'change_management_plan',
    category: 'plan',
    purposeEn: 'Change management plan with stakeholder analysis, comms, training.',
    purposePl: 'Plan zarządzania zmianą: analiza interesariuszy, komunikacja, szkolenia.',
    audienceEn: ['HR', 'Transformation Lead', 'Comms Lead'],
    audiencePl: ['HR', 'Lider Transformacji', 'Lider Komunikacji'],
    requiredInputs: ['stakeholder map', 'change impact'],
    confidentiality: 'internal',
    density: 'detailed',
    register: 'professional',
    languageStyle: 'consulting',
    approvalRequiredForExport: false,
  },
  {
    documentType: 'board_report',
    category: 'report',
    purposeEn: 'Board-level report: executive summary, strategic decisions, risks.',
    purposePl: 'Raport dla zarządu: executive summary, decyzje strategiczne, ryzyka.',
    audienceEn: ['Board', 'Chairman'],
    audiencePl: ['Zarząd', 'Prezes Rady Nadzorczej'],
    requiredInputs: ['period KPIs', 'decisions required', 'risks'],
    confidentiality: 'restricted',
    density: 'standard',
    register: 'executive',
    languageStyle: 'formal',
    approvalRequiredForExport: true,
  },
  {
    documentType: 'research_report',
    category: 'report',
    purposeEn: 'Research report with methodology, findings, conclusions, citations.',
    purposePl: 'Raport badawczy z metodologią, obserwacjami, wnioskami, cytowaniami.',
    audienceEn: ['Research Sponsor', 'Subject-Matter Experts'],
    audiencePl: ['Sponsor Badania', 'Eksperci'],
    requiredInputs: ['research scope', 'sources'],
    confidentiality: 'internal',
    density: 'detailed',
    register: 'professional',
    languageStyle: 'consulting',
    approvalRequiredForExport: false,
  },
  {
    documentType: 'due_diligence_note',
    category: 'business_case',
    purposeEn: 'Due diligence note: business model, financials, risks, recommendation.',
    purposePl: 'Due diligence: model biznesowy, finanse, ryzyka, rekomendacja.',
    audienceEn: ['Investment Committee', 'Acquirer'],
    audiencePl: ['Komitet Inwestycyjny', 'Nabywca'],
    requiredInputs: ['target financials', 'commercial assessment', 'risk assessment'],
    confidentiality: 'restricted',
    density: 'detailed',
    register: 'executive',
    languageStyle: 'formal',
    approvalRequiredForExport: true,
  },
  {
    documentType: 'internal_policy_document',
    category: 'governance',
    purposeEn: 'Internal policy: scope, applicability, rules, enforcement, exceptions.',
    purposePl: 'Polityka wewnętrzna: zakres, zastosowanie, zasady, egzekwowanie, wyjątki.',
    audienceEn: ['All Employees', 'Compliance'],
    audiencePl: ['Pracownicy', 'Compliance'],
    requiredInputs: ['policy scope', 'rule list'],
    confidentiality: 'restricted',
    density: 'detailed',
    register: 'professional',
    languageStyle: 'formal',
    approvalRequiredForExport: true,
  },
  {
    documentType: 'client_final_report',
    category: 'report',
    purposeEn: 'Final client report: scope, methodology, findings, recommendations, roadmap.',
    purposePl: 'Finalny raport dla klienta: zakres, metodologia, wnioski, rekomendacje, roadmapa.',
    audienceEn: ['Client Sponsor', 'Executive Team'],
    audiencePl: ['Sponsor Klienta', 'Zespół Zarządczy'],
    requiredInputs: ['scope statement', 'methodology', 'findings', 'recommendations'],
    confidentiality: 'client_confidential',
    density: 'comprehensive',
    register: 'executive',
    languageStyle: 'consulting',
    approvalRequiredForExport: true,
  },
];

function deriveBlueprint(
  documentType: DocumentTypeKey,
  density: DocumentDensity
): TemplateSectionBlueprint[] {
  const probe = {
    description: 'system seed probe',
    documentType,
    density,
  };
  const outline = planDocumentOutline(probe);
  const base = outline.sections.map((section) => ({
    title: section.title,
    level: section.level,
    purpose: section.purpose,
    required:
      section.title.toLowerCase().includes('executive summary') ||
      section.title.toLowerCase() === 'next steps' ||
      section.title.toLowerCase() === 'recommendations',
    expectedLengthHint: section.expectedLengthHint,
  }));

  // Executive templates need a visual/content contract, not merely a list of
  // headings. These recipes are deliberately evidence-led: they tell Mode 3
  // which form factor to create without seeding fake client facts.
  const premiumRecipes: Partial<
    Record<DocumentTypeKey, Record<string, Partial<TemplateSectionBlueprint>>>
  > = {
    business_case: {
      'executive summary': {
        formattingStyle: 'executive_kpi_strip_with_recommendation_callout',
        requiredData: ['investment envelope', 'base-case NPV', 'payback period'],
        contentHints: ['Lead with the investment decision', 'Show value, cost and timing as KPI cards'],
        keyMessage: 'The evidence supports one explicit investment recommendation and clear conditions.',
      },
      recommendation: {
        formattingStyle: 'decision_callout_with_conditions',
        requiredData: ['recommended option', 'approval conditions'],
        approvalRequired: true,
      },
      options: {
        formattingStyle: 'comparison_table_with_tradeoffs',
        requiredData: ['option costs', 'option benefits', 'delivery risk'],
      },
      risks: {
        formattingStyle: 'risk_heatmap_with_mitigations',
        requiredData: ['risk owner', 'probability', 'impact', 'mitigation'],
      },
    },
    board_report: {
      'executive summary': {
        formattingStyle: 'board_kpi_strip_with_status_callout',
        requiredData: ['period KPIs', 'overall RAG status', 'management recommendation'],
        contentHints: ['Use a one-page board digest', 'Separate facts, interpretation and ask'],
      },
      'decisions required': {
        formattingStyle: 'numbered_decision_cards',
        requiredData: ['decision owner', 'decision deadline', 'recommended resolution'],
        approvalRequired: true,
      },
      risks: {
        formattingStyle: 'top_risks_table_with_trend',
        requiredData: ['risk trend', 'financial exposure', 'accountable executive'],
      },
    },
    project_status_report: {
      'executive summary': {
        formattingStyle: 'transformation_status_kpi_strip',
        requiredData: ['progress percent', 'budget status', 'milestone status'],
        contentHints: ['Show plan-versus-actual', 'State the recovery action for every amber or red metric'],
      },
      risks: {
        formattingStyle: 'risk_table_with_severity_and_owner',
        requiredData: ['likelihood', 'impact', 'owner', 'next mitigation date'],
      },
      'next steps': {
        formattingStyle: 'thirty_sixty_ninety_day_roadmap',
        requiredData: ['action owner', 'due date', 'success measure'],
      },
    },
  };

  const recipes = premiumRecipes[documentType];
  if (!recipes) return base;
  return base.map((section) => {
    const normalized = section.title.toLowerCase();
    const recipe = Object.entries(recipes).find(([key]) => normalized.includes(key))?.[1];
    return recipe ? { ...section, ...recipe } : section;
  });
}

function buildSeedTemplate(spec: SeedSpec, language: 'pl' | 'en'): DocumentTemplate {
  const exportRules: TemplateExportRules = {
    docx: true,
    pdf: true,
    markdown: true,
    approvalRequiredForExport: spec.approvalRequiredForExport,
  };
  const blueprint = deriveBlueprint(spec.documentType, spec.density);
  const now = new Date().toISOString();
  const purpose = language === 'pl' ? spec.purposePl : spec.purposeEn;
  const audience = language === 'pl' ? spec.audiencePl : spec.audienceEn;
  const name =
    language === 'pl'
      ? `[System] ${spec.documentType.replace(/_/g, ' ')} (PL)`
      : `[System] ${spec.documentType.replace(/_/g, ' ')} (EN)`;

  return {
    templateId: `doc-template-system-${language}-${spec.documentType}`,
    organizationId: SYSTEM_ORG_ID,
    name,
    category: spec.category,
    documentType: spec.documentType,
    purpose,
    audience,
    language,
    languageStyle: spec.languageStyle,
    communicationRegister: spec.register,
    density: spec.density,
    confidentiality: spec.confidentiality,
    requiredInputs: spec.requiredInputs,
    sectionBlueprint: blueprint,
    formattingSchema: {
      ...DEFAULT_CONSULTING_FORMATTING_SCHEMA,
      headers: { enabled: true, content: 'Consultify | Executive document' },
      footers: {
        enabled: true,
        pageNumbering: true,
        confidentialityLabel: true,
        pageNumberingFormat: language === 'pl' ? 'Strona X z Y' : 'Page X of Y',
      },
      coverPage: true,
      coverPageDetailed: {
        enabled: true,
        includeLogo: true,
        includeStatus: true,
        includeConfidentiality: true,
      },
      toc: true,
      tocConfig: { enabled: true, maxDepth: 2 },
      colorTemplateId: 'consultify_executive',
    },
    exportRules,
    status: 'approved',
    version: '1.0',
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
    approvedBy: 'system',
    approvedAt: now,
    notes: 'Seeded by documentTemplateSeeder.ts',
  };
}

let seededInProcess = false;

/**
 * Seed the curated catalogue into the SYSTEM_ORG_ID namespace if it is
 * not already there. Idempotent: existing rows are skipped, missing rows
 * are inserted. Failures are logged and swallowed.
 *
 * Returns `{ inserted, skipped, total }` so callers (e.g. an admin route
 * or a startup hook) can surface progress in logs without re-running the
 * read.
 */
export async function seedSystemDocumentTemplates(): Promise<{
  inserted: number;
  skipped: number;
  total: number;
}> {
  if (seededInProcess) {
    // Cheap re-entrancy guard. Only the first call in this process pays
    // the SELECT cost; subsequent calls trust the in-process cache.
    return { inserted: 0, skipped: 0, total: 0 };
  }
  try {
    const existing = await loadTemplatesForOrg(SYSTEM_ORG_ID);
    const existingIds = new Set(existing.map((t) => t.templateId));
    let inserted = 0;
    let skipped = 0;
    let total = 0;
    for (const spec of SEED_CATALOGUE) {
      for (const language of ['pl', 'en'] as const) {
        total += 1;
        const template = buildSeedTemplate(spec, language);
        if (existingIds.has(template.templateId)) {
          skipped += 1;
          continue;
        }
        const result = await persistTemplate(template, { isSystem: true });
        if (result.ok) {
          inserted += 1;
        }
      }
    }
    seededInProcess = true;
    if (inserted > 0) {
      logger.info('[DocumentStudio][Seeder] system catalogue seeded', {
        inserted,
        skipped,
        total,
      });
    }
    return { inserted, skipped, total };
  } catch (err) {
    logger.warn('[DocumentStudio][Seeder] failed; service continues without seed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return { inserted: 0, skipped: 0, total: 0 };
  }
}

/**
 * Test-only helper: resets the seed-once-per-process guard so a test
 * suite can re-run the seeder against a fresh DAO.
 *
 * @internal
 */
export function __resetSystemTemplateSeederForTests(): void {
  seededInProcess = false;
}

/**
 * Pure helper exported so tests can introspect the catalogue without
 * triggering DAO writes.
 */
export function getSystemSeedCatalogue(): SeedSpec[] {
  return SEED_CATALOGUE.slice();
}
