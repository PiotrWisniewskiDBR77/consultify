/**
 * Document Narrative Planner — MVP-1 (Mode 1 only).
 *
 * Produces a deterministic outline for a free-form document intake using the
 * canonical document type taxonomy. The outline is the input to the content
 * generator and the basis for the Document Schema.
 *
 * MVP-1 boundary: deterministic outline based on declared document type.
 * MVP-1 finalization (a follow-up wiring pass) will plug this planner into
 * the existing AI service abstraction so that:
 *   - undeclared document types are inferred from the description,
 *   - section ordering and length hints are tuned to the audience and density,
 *   - argumentation structure (Observation -> Explanation -> Implication ->
 *     Recommendation, per REPORT_GENERATOR_V3 §5.6.1) is enforced.
 */

import type {
  CommunicationRegister,
  DocumentDensity,
  DocumentIntake,
  DocumentLanguageStyle,
  DocumentOutline,
  DocumentOutlineSection,
  DocumentTypeKey,
} from './documentStudioTypes.js';

const FALLBACK_TYPE: DocumentTypeKey = 'generic_document';

/**
 * Default sections per document type, taken directly from
 * `CONSULTIFY_DOCUMENT_STUDIO_V1_TYPE_TAXONOMY.md`.
 */
const DEFAULT_SECTIONS_BY_TYPE: Record<DocumentTypeKey, string[]> = {
  executive_memo: [
    'Executive Summary',
    'Context',
    'Findings',
    'Recommendations',
    'Decisions Required',
    'Next Steps',
  ],
  decision_memo: [
    'Decision in One Sentence',
    'Context',
    'Options',
    'Recommended Option',
    'Risks',
    'Next Steps',
  ],
  project_status_report: [
    'Executive Summary',
    'Period and Scope',
    'Status Overview',
    'Initiatives Progress',
    'Risks and Issues',
    'Decisions Required',
    'Next Steps',
  ],
  steering_committee_report: [
    'Executive Summary',
    'Decisions Required',
    'Portfolio Status',
    'Escalations',
    'Benefits Snapshot',
    'Risks',
    'Next Steps',
  ],
  benefits_tracking_report: [
    'Executive Summary',
    'Benefits Methodology',
    'Benefits Snapshot',
    'KPI Evidence',
    'Variances',
    'Recommended Adjustments',
  ],
  portfolio_overview: [
    'Executive Summary',
    'Portfolio Health',
    'RAG Heatmap',
    'Top Risks and Decisions',
    'Strategic Themes',
    'Recommended Actions',
  ],
  ai_audit_report: [
    'Executive Summary',
    'Audit Scope',
    'Methodology',
    'Current State',
    'AI Opportunities',
    'Risks and Constraints',
    'Recommended Initiatives',
    'Implementation Roadmap',
    'Appendix',
  ],
  interview_summary_report: [
    'Executive Summary',
    'Scope and Methodology',
    'Interview Coverage',
    'Key Organizational Findings',
    'Main Pain Points',
    'Root Causes',
    'Risks and Consequences',
    'Recommended Initiatives',
    'Prioritization',
    'Next Steps',
    'Appendix',
  ],
  digital_transformation_roadmap: [
    'Executive Summary',
    'Strategic Context',
    'Target State',
    'Roadmap Waves',
    'Initiatives by Wave',
    'Capabilities',
    'Risks and Dependencies',
    'Governance',
    'Appendix',
  ],
  business_case: [
    'Executive Summary',
    'Problem Statement',
    'Scope and Approach',
    'Proposed Initiative',
    'Scenarios and Assumptions',
    'Benefits and KPIs',
    'Risks',
    '30/60/90 Implementation Roadmap',
    'Recommendation',
  ],
  sales_proposal: [
    'Executive Summary',
    'Client Context',
    'Proposed Approach',
    'Scope',
    'Team and Credentials',
    'Timeline',
    'Investment',
    'Assumptions',
    'Next Steps',
  ],
  client_discovery_report: [
    'Executive Summary',
    'Discovery Scope',
    'Findings',
    'Themes',
    'Hypotheses',
    'Next Steps',
    'Appendix',
  ],
  workshop_summary: [
    'Executive Summary',
    'Workshop Context',
    'Themes',
    'Decisions',
    'Open Questions',
    'Next Steps',
    'Appendix',
  ],
  risk_register_report: [
    'Executive Summary',
    'Risk Methodology',
    'Risk Register Table',
    'Top Risks Detail',
    'Mitigation Plans',
    'Owners',
    'Next Review',
  ],
  sop_document: [
    'Purpose',
    'Scope',
    'Roles',
    'Process Steps',
    'Inputs and Outputs',
    'Controls',
    'Exceptions',
    'Revision History',
  ],
  implementation_plan: [
    'Executive Summary',
    'Plan Approach',
    'Waves',
    'Milestones',
    'Dependencies',
    'Owners',
    'Risks',
    'Governance',
    'Appendix',
  ],
  change_management_plan: [
    'Executive Summary',
    'Stakeholder Analysis',
    'Communication Plan',
    'Training Plan',
    'Adoption KPIs',
    'Risks',
    'Governance',
  ],
  board_report: [
    'Executive Summary',
    'Decisions Required',
    'For Information',
    'Portfolio Status',
    'Financial Snapshot',
    'Risks',
    'Next Steps',
  ],
  research_report: [
    'Executive Summary',
    'Research Question',
    'Method',
    'Sources',
    'Findings',
    'Implications',
    'Open Questions',
  ],
  due_diligence_note: [
    'Executive Summary',
    'Target Overview',
    'Strategic Fit',
    'Financial Snapshot',
    'Operational Snapshot',
    'Risks',
    'Opportunities',
    'Recommendation',
  ],
  internal_policy_document: [
    'Purpose',
    'Scope',
    'Definitions',
    'Policy Statements',
    'Roles',
    'Compliance',
    'Revision History',
  ],
  client_final_report: [
    'Executive Summary',
    'Project Context',
    'Scope and Approach',
    'Key Results',
    'KPIs',
    'Recommendations',
    'Next Steps',
    'Appendix',
  ],
  generic_document: ['Executive Summary', 'Context', 'Findings', 'Recommendations', 'Next Steps'],
};

const PURPOSE_HINTS: Partial<Record<string, string>> = {
  'Executive Summary': 'Top-level synthesis with the decision or recommendation.',
  Context: 'Background and operating environment relevant to the document goal.',
  Findings: 'Evidence-grounded findings that lead to the recommendation.',
  Recommendations: 'Concrete recommendations with owner and next step where possible.',
  'Decisions Required': 'Decisions that the audience must make, with options.',
  'Next Steps': 'Time-bound actions, owners and acceptance criteria.',
  'Risks and Constraints': 'Material risks and constraints with explicit mitigation.',
  Methodology: 'Method, scope, sources and limitations of the analysis.',
  'Audit Scope': 'Audit boundaries: in-scope, out-of-scope, sampling and timeframe.',
};

function inferDocumentTypeFromText(input: DocumentIntake): DocumentTypeKey {
  if (input.documentType) return input.documentType;
  const lower = (input.description || '').toLowerCase();
  if (lower.includes('audit') || lower.includes('audyt')) return 'ai_audit_report';
  if (lower.includes('memo') && lower.includes('decision')) return 'decision_memo';
  if (lower.includes('memo')) return 'executive_memo';
  if (lower.includes('roadmap') || lower.includes('mapa')) return 'digital_transformation_roadmap';
  if (lower.includes('business case') || lower.includes('uzasadnienie ekonom'))
    return 'business_case';
  if (lower.includes('sales') || lower.includes('proposal') || lower.includes('oferta')) {
    return 'sales_proposal';
  }
  if (lower.includes('discovery')) return 'client_discovery_report';
  if (lower.includes('workshop') || lower.includes('warsztat')) return 'workshop_summary';
  if (lower.includes('risk register') || lower.includes('rejestr ryzyk'))
    return 'risk_register_report';
  if (lower.includes('sop') || lower.includes('standard operating procedure'))
    return 'sop_document';
  if (lower.includes('implementation plan') || lower.includes('plan wdroże'))
    return 'implementation_plan';
  if (lower.includes('change management')) return 'change_management_plan';
  if (lower.includes('board') || lower.includes('zarząd')) return 'board_report';
  if (lower.includes('research')) return 'research_report';
  if (lower.includes('due diligence')) return 'due_diligence_note';
  if (lower.includes('policy') || lower.includes('polityka')) return 'internal_policy_document';
  if (lower.includes('final report') || lower.includes('raport finalny'))
    return 'client_final_report';
  if (lower.includes('interview') || lower.includes('wywiad')) return 'interview_summary_report';
  if (lower.includes('status report') || lower.includes('weekly')) return 'project_status_report';
  if (lower.includes('steering')) return 'steering_committee_report';
  if (lower.includes('benefits')) return 'benefits_tracking_report';
  if (lower.includes('portfolio')) return 'portfolio_overview';
  return FALLBACK_TYPE;
}

function expectedLengthForSection(
  title: string,
  density: DocumentDensity
): 'short' | 'medium' | 'long' {
  const longSections = new Set([
    'Findings',
    'Key Organizational Findings',
    'Recommended Initiatives',
    'AI Opportunities',
    'Implementation Roadmap',
    'Process Steps',
    'Risks and Issues',
  ]);
  if (longSections.has(title)) {
    if (density === 'concise') return 'medium';
    return 'long';
  }
  if (title.startsWith('Executive') || title.includes('Summary')) {
    return density === 'comprehensive' ? 'medium' : 'short';
  }
  return 'medium';
}

function defaultRecommendations(documentType: DocumentTypeKey): {
  density: DocumentDensity;
  register: CommunicationRegister;
  languageStyle: DocumentLanguageStyle;
} {
  switch (documentType) {
    case 'executive_memo':
    case 'decision_memo':
    case 'board_report':
    case 'steering_committee_report':
    case 'portfolio_overview':
      return { density: 'concise', register: 'executive', languageStyle: 'consulting' };
    case 'sales_proposal':
    case 'client_final_report':
    case 'client_discovery_report':
      return { density: 'standard', register: 'executive', languageStyle: 'consulting' };
    case 'ai_audit_report':
    case 'business_case':
    case 'due_diligence_note':
    case 'digital_transformation_roadmap':
    case 'implementation_plan':
      return { density: 'detailed', register: 'professional', languageStyle: 'formal' };
    case 'sop_document':
    case 'internal_policy_document':
      return { density: 'detailed', register: 'professional', languageStyle: 'formal' };
    default:
      return { density: 'standard', register: 'professional', languageStyle: 'consulting' };
  }
}

export function planDocumentOutline(intake: DocumentIntake): DocumentOutline {
  const documentType = inferDocumentTypeFromText(intake);
  const sectionTitles =
    DEFAULT_SECTIONS_BY_TYPE[documentType] ?? DEFAULT_SECTIONS_BY_TYPE.generic_document;
  const recs = defaultRecommendations(documentType);
  const density = intake.density ?? recs.density;

  const sections: DocumentOutlineSection[] = sectionTitles.map((title) => ({
    title,
    level: 1,
    purpose:
      PURPOSE_HINTS[title] ?? `Substantive section "${title}" relevant to the document goal.`,
    expectedLengthHint: expectedLengthForSection(title, density),
  }));

  return {
    documentType,
    title: intake.title?.trim() || deriveTitleFromIntake(intake, documentType),
    sections,
    recommendedDensity: density,
    recommendedRegister: intake.communicationRegister ?? recs.register,
    recommendedLanguageStyle: intake.languageStyle ?? recs.languageStyle,
  };
}

function deriveTitleFromIntake(intake: DocumentIntake, documentType: DocumentTypeKey): string {
  const friendly = documentType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  const summary = intake.description?.split('.')[0]?.trim();
  if (summary && summary.length > 0 && summary.length < 90) {
    return `${friendly}: ${summary}`;
  }
  return friendly;
}
