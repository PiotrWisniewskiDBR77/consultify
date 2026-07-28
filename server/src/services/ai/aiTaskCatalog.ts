export type PurposeKind = 'TEXT_LLM' | 'IMAGE_MODEL' | 'BUSINESS_MODEL';
export type PurposeTier = 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING' | 'FREE';
export type UseCaseKey =
  | 'chat'
  | 'document_understanding'
  | 'reports'
  | 'presentations'
  | 'visuals'
  | 'research'
  | 'governance'
  | 'results';

export interface AITaskDefinition {
  purpose: string;
  aliases?: string[];
  kind: PurposeKind;
  defaultTier?: PurposeTier | null;
  useCase: UseCaseKey;
  businessOwner: string;
  qualityProfile: 'speed' | 'balanced' | 'precision' | 'creative';
  maxLatencyMs: number;
  costProfile: 'budget' | 'balanced' | 'premium';
  fallbackPurposes?: string[];
  requirements?: Record<string, unknown>;
  description: string;
  legacy?: boolean;
}

export interface ExecutiveUseCaseDefinition {
  key: UseCaseKey;
  label: string;
  description: string;
  purposes: string[];
  businessOwner: string;
}

const TASK_DEFINITIONS: AITaskDefinition[] = [
  {
    purpose: 'chat_simple',
    kind: 'TEXT_LLM',
    defaultTier: 'BUDGET',
    useCase: 'chat',
    businessOwner: 'AI Chat',
    qualityProfile: 'speed',
    maxLatencyMs: 8000,
    costProfile: 'budget',
    fallbackPurposes: ['chat_complex'],
    description: 'Fast low-cost chat for lightweight user requests.',
  },
  {
    purpose: 'chat_complex',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'chat',
    businessOwner: 'AI Chat',
    qualityProfile: 'balanced',
    maxLatencyMs: 16000,
    costProfile: 'balanced',
    fallbackPurposes: ['chat_simple'],
    description: 'General-purpose chat for multi-step reasoning without attachments.',
  },
  {
    purpose: 'chat_confirm',
    kind: 'TEXT_LLM',
    defaultTier: 'BUDGET',
    useCase: 'chat',
    businessOwner: 'AI Chat',
    qualityProfile: 'speed',
    maxLatencyMs: 6000,
    costProfile: 'budget',
    fallbackPurposes: ['chat_simple'],
    description: 'Short confirmation and approval interactions.',
  },
  {
    purpose: 'chat_with_pdf',
    aliases: ['document_answer'],
    kind: 'TEXT_LLM',
    defaultTier: 'PREMIUM',
    useCase: 'document_understanding',
    businessOwner: 'Document Chat',
    qualityProfile: 'precision',
    maxLatencyMs: 20000,
    costProfile: 'balanced',
    fallbackPurposes: ['chat_with_files', 'chat_complex'],
    requirements: { vision: true },
    description: 'Grounded chat over PDF documents with citations and traceability.',
  },
  {
    purpose: 'chat_with_files',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'document_understanding',
    businessOwner: 'Document Chat',
    qualityProfile: 'precision',
    maxLatencyMs: 16000,
    costProfile: 'balanced',
    fallbackPurposes: ['chat_complex'],
    description: 'Grounded chat over attached files and extracted chunks.',
  },
  {
    purpose: 'document_extract',
    aliases: ['vision_extract'],
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'document_understanding',
    businessOwner: 'Document Chat',
    qualityProfile: 'precision',
    maxLatencyMs: 14000,
    costProfile: 'balanced',
    fallbackPurposes: ['chat_with_files'],
    requirements: { vision: true },
    description: 'Structured extraction from documents, PDFs, or page images.',
  },
  {
    purpose: 'document_compare',
    aliases: ['vision_compare'],
    kind: 'TEXT_LLM',
    defaultTier: 'REASONING',
    useCase: 'document_understanding',
    businessOwner: 'Document Chat',
    qualityProfile: 'precision',
    maxLatencyMs: 22000,
    costProfile: 'premium',
    fallbackPurposes: ['document_answer', 'chat_with_pdf'],
    requirements: { vision: true },
    description: 'Compares documents, attachments, or pages and highlights differences.',
  },
  {
    purpose: 'document_answer',
    kind: 'TEXT_LLM',
    defaultTier: 'PREMIUM',
    useCase: 'document_understanding',
    businessOwner: 'Document Chat',
    qualityProfile: 'precision',
    maxLatencyMs: 18000,
    costProfile: 'balanced',
    fallbackPurposes: ['chat_with_pdf', 'chat_with_files'],
    description: 'Answers grounded questions using retrieved evidence from documents.',
  },
  {
    purpose: 'report_section_draft',
    aliases: ['report_section'],
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'reports',
    businessOwner: 'Reports',
    qualityProfile: 'balanced',
    maxLatencyMs: 18000,
    costProfile: 'balanced',
    fallbackPurposes: ['report_quality_gate'],
    description: 'Drafts report sections from structured facts and context packs.',
  },
  {
    purpose: 'report_executive_synthesis',
    aliases: ['full_report'],
    kind: 'TEXT_LLM',
    defaultTier: 'REASONING',
    useCase: 'reports',
    businessOwner: 'Reports',
    qualityProfile: 'precision',
    maxLatencyMs: 22000,
    costProfile: 'premium',
    fallbackPurposes: ['report_section_draft'],
    description: 'Synthesizes executive-grade report narratives across sections.',
  },
  {
    purpose: 'report_evidence_validation',
    kind: 'TEXT_LLM',
    defaultTier: 'REASONING',
    useCase: 'reports',
    businessOwner: 'Reports',
    qualityProfile: 'precision',
    maxLatencyMs: 20000,
    costProfile: 'premium',
    fallbackPurposes: ['report_section_draft'],
    description: 'Checks evidence coverage, contradictions, and source fidelity in reports.',
  },
  {
    purpose: 'report_quality_gate',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'reports',
    businessOwner: 'Reports',
    qualityProfile: 'precision',
    maxLatencyMs: 12000,
    costProfile: 'balanced',
    fallbackPurposes: ['report_section_draft'],
    description: 'Runs final quality checks for clarity, consistency, and completeness.',
  },
  {
    purpose: 'presentation_deck_outline',
    aliases: ['deck_outline'],
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'presentations',
    businessOwner: 'Presentations',
    qualityProfile: 'balanced',
    maxLatencyMs: 12000,
    costProfile: 'balanced',
    fallbackPurposes: ['presentation_slide_copy'],
    description: 'Generates deck structure and slide sequencing.',
  },
  {
    purpose: 'presentation_slide_copy',
    aliases: ['deck_copy_polish'],
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'presentations',
    businessOwner: 'Presentations',
    qualityProfile: 'balanced',
    maxLatencyMs: 14000,
    costProfile: 'balanced',
    fallbackPurposes: ['chat_complex'],
    description: 'Writes slide headlines, key messages, and concise storylines.',
  },
  {
    purpose: 'presentation_visual_generation',
    aliases: ['image_cover', 'image_diagram', 'image_slide_asset'],
    kind: 'IMAGE_MODEL',
    defaultTier: 'STANDARD',
    useCase: 'visuals',
    businessOwner: 'Presentations',
    qualityProfile: 'creative',
    maxLatencyMs: 30000,
    costProfile: 'premium',
    fallbackPurposes: ['image_slide_asset'],
    description: 'Generates slide visuals and presentation assets.',
  },
  {
    purpose: 'presentation_vision_qc',
    kind: 'TEXT_LLM',
    defaultTier: 'REASONING',
    useCase: 'presentations',
    businessOwner: 'Presentations',
    qualityProfile: 'precision',
    maxLatencyMs: 18000,
    costProfile: 'premium',
    fallbackPurposes: ['report_quality_gate'],
    requirements: { vision: true },
    description: 'Runs visual QA for slides, diagrams, and rendered assets.',
  },
  {
    purpose: 'image_cover',
    kind: 'IMAGE_MODEL',
    defaultTier: 'STANDARD',
    useCase: 'visuals',
    businessOwner: 'Presentations',
    qualityProfile: 'creative',
    maxLatencyMs: 30000,
    costProfile: 'premium',
    fallbackPurposes: ['presentation_visual_generation'],
    description: 'Generates hero cover images for decks and reports.',
    legacy: true,
  },
  {
    purpose: 'image_diagram',
    kind: 'IMAGE_MODEL',
    defaultTier: 'STANDARD',
    useCase: 'visuals',
    businessOwner: 'Presentations',
    qualityProfile: 'creative',
    maxLatencyMs: 30000,
    costProfile: 'premium',
    fallbackPurposes: ['presentation_visual_generation'],
    description: 'Generates diagram-style assets for presentations.',
    legacy: true,
  },
  {
    purpose: 'image_slide_asset',
    kind: 'IMAGE_MODEL',
    defaultTier: 'STANDARD',
    useCase: 'visuals',
    businessOwner: 'Presentations',
    qualityProfile: 'creative',
    maxLatencyMs: 30000,
    costProfile: 'premium',
    fallbackPurposes: ['presentation_visual_generation'],
    description: 'Generates inline slide assets and textures.',
    legacy: true,
  },
  {
    purpose: 'deep_research_plan',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'research',
    businessOwner: 'Research',
    qualityProfile: 'precision',
    maxLatencyMs: 15000,
    costProfile: 'balanced',
    fallbackPurposes: ['chat_complex'],
    description: 'Plans multi-step deep research execution.',
  },
  {
    purpose: 'deep_research_claims_extract',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'research',
    businessOwner: 'Research',
    qualityProfile: 'precision',
    maxLatencyMs: 15000,
    costProfile: 'balanced',
    fallbackPurposes: ['document_extract'],
    description: 'Extracts claims, facts, and evidence from research sources.',
  },
  {
    purpose: 'deep_research_synthesis',
    kind: 'TEXT_LLM',
    defaultTier: 'REASONING',
    useCase: 'research',
    businessOwner: 'Research',
    qualityProfile: 'precision',
    maxLatencyMs: 22000,
    costProfile: 'premium',
    fallbackPurposes: ['report_executive_synthesis'],
    description: 'Synthesizes findings across multiple research passes.',
  },
  {
    purpose: 'deep_research_contradictions',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'research',
    businessOwner: 'Research',
    qualityProfile: 'precision',
    maxLatencyMs: 18000,
    costProfile: 'balanced',
    fallbackPurposes: ['report_evidence_validation'],
    description: 'Finds contradictions and tension between research sources.',
  },
  {
    purpose: 'deep_research_export_polish',
    kind: 'TEXT_LLM',
    defaultTier: 'BUDGET',
    useCase: 'research',
    businessOwner: 'Research',
    qualityProfile: 'balanced',
    maxLatencyMs: 12000,
    costProfile: 'budget',
    fallbackPurposes: ['presentation_slide_copy'],
    description: 'Polishes research output for export or delivery.',
  },
  {
    purpose: 'deep_research_quality_gate',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'research',
    businessOwner: 'Research',
    qualityProfile: 'precision',
    maxLatencyMs: 15000,
    costProfile: 'balanced',
    fallbackPurposes: ['report_quality_gate'],
    description: 'Quality gate for research fidelity and export readiness.',
  },
  {
    purpose: 'tool_recommendation',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'chat',
    businessOwner: 'Tools',
    qualityProfile: 'balanced',
    maxLatencyMs: 12000,
    costProfile: 'balanced',
    fallbackPurposes: ['chat_complex'],
    description: 'Suggests tools or next actions for user workflows.',
  },
  {
    purpose: 'session_missing_items',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'chat',
    businessOwner: 'Tools',
    qualityProfile: 'balanced',
    maxLatencyMs: 12000,
    costProfile: 'balanced',
    fallbackPurposes: ['chat_complex'],
    description: 'Detects missing information in sessions and workflows.',
  },
  {
    purpose: 'session_summary',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'chat',
    businessOwner: 'Tools',
    qualityProfile: 'balanced',
    maxLatencyMs: 12000,
    costProfile: 'balanced',
    fallbackPurposes: ['chat_complex'],
    description: 'Builds summaries of user sessions and interactions.',
  },
  {
    purpose: 'assessment_explain',
    kind: 'TEXT_LLM',
    defaultTier: 'PREMIUM',
    useCase: 'reports',
    businessOwner: 'Assessments',
    qualityProfile: 'precision',
    maxLatencyMs: 18000,
    costProfile: 'premium',
    fallbackPurposes: ['report_section_draft'],
    description: 'Explains assessment outputs in business-friendly language.',
  },
  {
    purpose: 'validate_initiative',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'governance',
    businessOwner: 'Initiatives',
    qualityProfile: 'precision',
    maxLatencyMs: 15000,
    costProfile: 'balanced',
    fallbackPurposes: ['chat_complex'],
    description: 'Validates initiative proposals and implementation readiness.',
  },
  {
    purpose: 'governance_risk_scan',
    kind: 'TEXT_LLM',
    defaultTier: 'REASONING',
    useCase: 'governance',
    businessOwner: 'Initiatives',
    qualityProfile: 'precision',
    maxLatencyMs: 20000,
    costProfile: 'premium',
    fallbackPurposes: ['validate_initiative'],
    description: 'Performs governance and delivery risk scanning.',
  },
  {
    purpose: 'build_roadmap',
    kind: 'TEXT_LLM',
    defaultTier: 'REASONING',
    useCase: 'governance',
    businessOwner: 'Initiatives',
    qualityProfile: 'precision',
    maxLatencyMs: 20000,
    costProfile: 'premium',
    fallbackPurposes: ['validate_initiative'],
    description: 'Builds transformation roadmaps and sequencing.',
  },
  {
    purpose: 'results_anomaly_insights',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'results',
    businessOwner: 'Results',
    qualityProfile: 'precision',
    maxLatencyMs: 14000,
    costProfile: 'balanced',
    fallbackPurposes: ['chat_complex'],
    description: 'Explains anomalies in performance or results data.',
  },
  {
    purpose: 'results_report_draft',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'results',
    businessOwner: 'Results',
    qualityProfile: 'balanced',
    maxLatencyMs: 16000,
    costProfile: 'balanced',
    fallbackPurposes: ['report_section_draft'],
    description: 'Drafts results and benefits reporting content.',
  },
  {
    purpose: 'lean_suggestions',
    kind: 'BUSINESS_MODEL',
    useCase: 'governance',
    businessOwner: 'Ops Excellence',
    qualityProfile: 'balanced',
    maxLatencyMs: 12000,
    costProfile: 'budget',
    description: 'Suggests lean improvement actions.',
  },
  {
    purpose: 'waste_detection',
    kind: 'BUSINESS_MODEL',
    useCase: 'governance',
    businessOwner: 'Ops Excellence',
    qualityProfile: 'precision',
    maxLatencyMs: 12000,
    costProfile: 'budget',
    description: 'Detects operational waste patterns.',
  },
  {
    purpose: 'process_optimization',
    kind: 'BUSINESS_MODEL',
    useCase: 'governance',
    businessOwner: 'Ops Excellence',
    qualityProfile: 'balanced',
    maxLatencyMs: 15000,
    costProfile: 'balanced',
    description: 'Optimizes business process flows.',
  },
  // -------------------------------------------------------------------------
  // Workbook / Excel generation (naprawa 2026-07-28, "Excel od tygodni nie
  // działa"): WorkbookGeneratorService used to call `capability: 'chat'` with
  // NO purpose at all, so every phase fell through `inferChatTaskPurpose`'s
  // generic text-length heuristic into `chat_simple`/`chat_complex` — tiers
  // tuned for casual conversation, not for producing a schema-valid, formula-
  // correct, multi-sheet financial model. Report/Presentation generation both
  // have dedicated purposes above (`report_section_draft`,
  // `presentation_deck_outline`, …); Workbook never did. See
  // WorkbookGeneratorService.callLLM for the call sites.
  // -------------------------------------------------------------------------
  {
    purpose: 'workbook_template_match',
    kind: 'TEXT_LLM',
    defaultTier: 'BUDGET',
    useCase: 'reports',
    businessOwner: 'Materiały — Excel',
    qualityProfile: 'speed',
    maxLatencyMs: 8000,
    costProfile: 'budget',
    fallbackPurposes: ['chat_simple'],
    description: 'Cheap gate: does the request match a registered parametric workbook template?',
  },
  {
    purpose: 'workbook_plan',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'reports',
    businessOwner: 'Materiały — Excel',
    qualityProfile: 'balanced',
    maxLatencyMs: 18000,
    costProfile: 'balanced',
    fallbackPurposes: ['chat_complex'],
    description: 'Decomposes a workbook request into a driver-tree model plan (E1-E5).',
  },
  {
    purpose: 'workbook_confirm',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'reports',
    businessOwner: 'Materiały — Excel',
    qualityProfile: 'precision',
    maxLatencyMs: 12000,
    costProfile: 'balanced',
    fallbackPurposes: ['workbook_plan', 'chat_complex'],
    description: 'Validates a workbook plan against the original user intent before generation.',
  },
  {
    purpose: 'workbook_generate',
    kind: 'TEXT_LLM',
    defaultTier: 'PREMIUM',
    useCase: 'reports',
    businessOwner: 'Materiały — Excel',
    qualityProfile: 'precision',
    maxLatencyMs: 60000,
    costProfile: 'premium',
    fallbackPurposes: ['workbook_plan', 'chat_complex'],
    description:
      'Produces the full WorkbookSchema JSON — sheets, live cross-sheet formulas, assumptions layer. Long structured output; needs a precision-tier model, not a casual-chat one.',
  },
  {
    purpose: 'workbook_review',
    kind: 'TEXT_LLM',
    defaultTier: 'STANDARD',
    useCase: 'reports',
    businessOwner: 'Materiały — Excel',
    qualityProfile: 'precision',
    maxLatencyMs: 20000,
    costProfile: 'balanced',
    fallbackPurposes: ['workbook_generate', 'chat_complex'],
    description: 'Self-review pass over a generated WorkbookSchema before build.',
  },
  {
    purpose: 'workbook_repair',
    kind: 'TEXT_LLM',
    defaultTier: 'PREMIUM',
    useCase: 'reports',
    businessOwner: 'Materiały — Excel',
    qualityProfile: 'precision',
    maxLatencyMs: 45000,
    costProfile: 'premium',
    fallbackPurposes: ['workbook_generate', 'chat_complex'],
    description:
      'Targeted repair pass fixing deterministic quality-gate defects (DX-01 assumptions layer, DX-02 formula cycles).',
  },
];

const PURPOSE_MAP = new Map<string, AITaskDefinition>();
const ALIAS_MAP = new Map<string, string>();

for (const definition of TASK_DEFINITIONS) {
  PURPOSE_MAP.set(definition.purpose, definition);
  for (const alias of definition.aliases || []) {
    ALIAS_MAP.set(alias, definition.purpose);
  }
}

export const EXECUTIVE_USE_CASES: ExecutiveUseCaseDefinition[] = [
  {
    key: 'chat',
    label: 'Chat',
    description: 'General chat, confirmations, tool help, and workflow assistance.',
    purposes: [
      'chat_simple',
      'chat_complex',
      'chat_confirm',
      'tool_recommendation',
      'session_missing_items',
      'session_summary',
    ],
    businessOwner: 'AI Chat',
  },
  {
    key: 'document_understanding',
    label: 'Document Understanding',
    description: 'Chat over PDFs/files, extraction, comparison, and grounded answers.',
    purposes: [
      'chat_with_pdf',
      'chat_with_files',
      'document_extract',
      'document_compare',
      'document_answer',
    ],
    businessOwner: 'Document Chat',
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Drafting, synthesis, evidence validation, and quality gates for reports.',
    purposes: [
      'report_section_draft',
      'report_executive_synthesis',
      'report_evidence_validation',
      'report_quality_gate',
      'assessment_explain',
      'results_report_draft',
    ],
    businessOwner: 'Reports',
  },
  {
    key: 'presentations',
    label: 'Presentations',
    description: 'Deck outline, slide copy, and visual QA for presentations.',
    purposes: ['presentation_deck_outline', 'presentation_slide_copy', 'presentation_vision_qc'],
    businessOwner: 'Presentations',
  },
  {
    key: 'visuals',
    label: 'Visuals',
    description: 'Image generation layer for decks, diagrams, and slide assets.',
    purposes: [
      'presentation_visual_generation',
      'image_cover',
      'image_diagram',
      'image_slide_asset',
    ],
    businessOwner: 'Presentations',
  },
];

export function listAITaskDefinitions(options?: { includeLegacy?: boolean }): AITaskDefinition[] {
  if (options?.includeLegacy) return [...TASK_DEFINITIONS];
  return TASK_DEFINITIONS.filter((item) => !item.legacy);
}

export function normalizePurposeKey(purpose?: string | null): string | null {
  const key = String(purpose || '').trim();
  if (!key) return null;
  return PURPOSE_MAP.has(key) ? key : (ALIAS_MAP.get(key) ?? key);
}

export function getAITaskDefinition(purpose?: string | null): AITaskDefinition | null {
  const normalized = normalizePurposeKey(purpose);
  if (!normalized) return null;
  return PURPOSE_MAP.get(normalized) || null;
}

export function getRoutingPurposeKeys(purpose?: string | null): string[] {
  const raw = String(purpose || '').trim();
  if (!raw) return [];
  const normalized = normalizePurposeKey(raw);
  const keys = normalized ? [normalized] : [raw];
  const definition = normalized ? PURPOSE_MAP.get(normalized) : null;
  if (raw && !keys.includes(raw)) keys.push(raw);
  for (const alias of definition?.aliases || []) {
    if (!keys.includes(alias)) keys.push(alias);
  }
  return keys;
}

export function isDocumentPurpose(purpose?: string | null): boolean {
  const definition = getAITaskDefinition(purpose);
  return definition?.useCase === 'document_understanding';
}

export function inferChatTaskPurpose(params: {
  explicitPurpose?: string | null;
  capability?: string | null;
  message?: string | null;
  attachments?: Array<{ mimeType?: string; name?: string }> | null;
  attachmentDocIds?: string[] | null;
  deepResearch?: boolean;
}): string {
  const explicit = normalizePurposeKey(params.explicitPurpose);
  if (explicit) return explicit;

  if (params.deepResearch) return 'deep_research_synthesis';

  const capability = String(params.capability || '').trim();
  const text = String(params.message || '').toLowerCase();
  const attachments = Array.isArray(params.attachments) ? params.attachments : [];
  const hasAttachmentIds =
    Array.isArray(params.attachmentDocIds) && params.attachmentDocIds.length > 0;
  const hasAttachments = attachments.length > 0 || hasAttachmentIds;
  const hasPdf = attachments.some((att) => {
    const mime = String(att?.mimeType || '').toLowerCase();
    const name = String(att?.name || '').toLowerCase();
    return mime === 'application/pdf' || name.endsWith('.pdf');
  });

  if (hasAttachments) {
    if (/(compare|difference|diff|versus|vs\\b|porown|różnic|roznic)/i.test(text)) {
      return 'document_compare';
    }
    if (
      /(extract|table|fields|invoice|summary|summarize|podsum|wyciągn|wyciagn|lista|list)/i.test(
        text
      )
    ) {
      return 'document_extract';
    }
    if (hasPdf) return 'chat_with_pdf';
    return 'chat_with_files';
  }

  if (capability === 'chat_confirm') return 'chat_confirm';
  if (
    text.length > 900 ||
    /(analy|strategy|report|presentation|roadmap|compare|research|synthes)/i.test(text)
  ) {
    return 'chat_complex';
  }

  return 'chat_simple';
}
