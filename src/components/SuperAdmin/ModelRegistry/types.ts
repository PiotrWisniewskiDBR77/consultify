export type ModelKind = 'TEXT_LLM' | 'IMAGE_MODEL' | 'BUSINESS_MODEL';
export type ProviderType = 'direct' | 'aggregator' | 'local' | 'customer_managed';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type ErrorCategory =
  | 'missing_key'
  | 'auth'
  | 'billing'
  | 'rate_limit'
  | 'network'
  | 'unknown';
export type DataClass = 'no_pii' | 'pii' | 'confidential';
export type PriceSource = 'api_sync' | 'manual' | 'contract';

export interface ModelCapabilities {
  vision: boolean;
  tools: boolean;
  streaming: boolean;
  jsonMode: boolean;
  contextWindow: number;
}

export interface RegistryModel {
  id: string;
  name: string;
  provider: string;
  providerType: ProviderType;
  originVendor: string;
  modelId: string;
  kind: ModelKind;
  isActive: boolean;
  healthStatus: HealthStatus;
  lastHealthCheck?: string;
  lastErrorCategory?: ErrorCategory;
  lastErrorHttpStatus?: number;
  lastErrorMessage?: string;
  lastErrorAt?: string;
  avgLatencyMs?: number;
  costPer1k?: number;
  capabilities: ModelCapabilities;
  executionRegions: string[];
  allowedDataClasses: DataClass[];
  createdAt: string;
  updatedAt: string;
}

export interface PurposeAssignment {
  id: string;
  purpose: Purpose;
  kind: ModelKind;
  modelId: string;
  modelName: string;
  tier?: string;
  priority: number;
  isActive: boolean;
  fallbackModelId?: string;
  healthStatus?: HealthStatus;
}

export interface ModelAuditEntry {
  id: string;
  action: 'created' | 'updated' | 'deleted' | 'assignment_changed' | 'fallback_used';
  entityType: 'model' | 'assignment' | 'policy';
  entityId: string;
  changedBy: string;
  changedAt: string;
  changes: Record<string, { from: unknown; to: unknown }>;
}

export interface PriceSnapshot {
  id: string;
  modelId: string;
  provider: string;
  inputPer1MTokens?: number;
  outputPer1MTokens?: number;
  perImage?: number;
  perRequest?: number;
  source: PriceSource;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
  createdAt: string;
}

export type Purpose =
  | 'chat_simple'
  | 'chat_complex'
  | 'chat_confirm'
  | 'chat_with_pdf'
  | 'chat_with_files'
  | 'document_extract'
  | 'document_compare'
  | 'document_answer'
  | 'tool_recommendation'
  | 'session_missing_items'
  | 'session_summary'
  | 'assessment_explain'
  | 'validate_initiative'
  | 'governance_risk_scan'
  | 'build_roadmap'
  | 'results_anomaly_insights'
  | 'results_report_draft'
  | 'report_section_draft'
  | 'report_executive_synthesis'
  | 'report_evidence_validation'
  | 'report_quality_gate'
  | 'report_section'
  | 'full_report'
  | 'presentation_deck_outline'
  | 'presentation_slide_copy'
  | 'presentation_visual_generation'
  | 'presentation_vision_qc'
  | 'deck_outline'
  | 'deck_copy_polish'
  | 'vision_extract'
  | 'vision_compare'
  | 'image_cover'
  | 'image_diagram'
  | 'image_slide_asset'
  | 'lean_suggestions'
  | 'waste_detection'
  | 'process_optimization';

export interface PurposeCategory {
  label: string;
  purposes: Purpose[];
}

export const PURPOSE_CATEGORIES: PurposeCategory[] = [
  {
    label: 'Chat',
    purposes: ['chat_simple', 'chat_complex', 'chat_confirm', 'chat_with_pdf', 'chat_with_files'],
  },
  {
    label: 'Documents',
    purposes: ['document_extract', 'document_compare', 'document_answer'],
  },
  {
    label: 'Tools & Assessments',
    purposes: [
      'tool_recommendation',
      'session_missing_items',
      'session_summary',
      'assessment_explain',
    ],
  },
  {
    label: 'Initiatives',
    purposes: ['validate_initiative', 'governance_risk_scan', 'build_roadmap'],
  },
  {
    label: 'Results',
    purposes: ['results_anomaly_insights', 'results_report_draft'],
  },
  {
    label: 'Reports & Presentations',
    purposes: [
      'report_section_draft',
      'report_executive_synthesis',
      'report_evidence_validation',
      'report_quality_gate',
      'report_section',
      'full_report',
      'presentation_deck_outline',
      'presentation_slide_copy',
      'presentation_visual_generation',
      'presentation_vision_qc',
      'deck_outline',
      'deck_copy_polish',
    ],
  },
  {
    label: 'Vision',
    purposes: ['vision_extract', 'vision_compare'],
  },
  {
    label: 'Image',
    purposes: ['image_cover', 'image_diagram', 'image_slide_asset'],
  },
  {
    label: 'Business',
    purposes: ['lean_suggestions', 'waste_detection', 'process_optimization'],
  },
];

export const PURPOSE_KIND_MAP: Record<Purpose, ModelKind> = {
  chat_simple: 'TEXT_LLM',
  chat_complex: 'TEXT_LLM',
  chat_confirm: 'TEXT_LLM',
  chat_with_pdf: 'TEXT_LLM',
  chat_with_files: 'TEXT_LLM',
  document_extract: 'TEXT_LLM',
  document_compare: 'TEXT_LLM',
  document_answer: 'TEXT_LLM',
  tool_recommendation: 'TEXT_LLM',
  session_missing_items: 'TEXT_LLM',
  session_summary: 'TEXT_LLM',
  assessment_explain: 'TEXT_LLM',
  validate_initiative: 'TEXT_LLM',
  governance_risk_scan: 'TEXT_LLM',
  build_roadmap: 'TEXT_LLM',
  results_anomaly_insights: 'TEXT_LLM',
  results_report_draft: 'TEXT_LLM',
  report_section_draft: 'TEXT_LLM',
  report_executive_synthesis: 'TEXT_LLM',
  report_evidence_validation: 'TEXT_LLM',
  report_quality_gate: 'TEXT_LLM',
  report_section: 'TEXT_LLM',
  full_report: 'TEXT_LLM',
  presentation_deck_outline: 'TEXT_LLM',
  presentation_slide_copy: 'TEXT_LLM',
  presentation_visual_generation: 'IMAGE_MODEL',
  presentation_vision_qc: 'TEXT_LLM',
  deck_outline: 'TEXT_LLM',
  deck_copy_polish: 'TEXT_LLM',
  vision_extract: 'TEXT_LLM',
  vision_compare: 'TEXT_LLM',
  image_cover: 'IMAGE_MODEL',
  image_diagram: 'IMAGE_MODEL',
  image_slide_asset: 'IMAGE_MODEL',
  lean_suggestions: 'BUSINESS_MODEL',
  waste_detection: 'BUSINESS_MODEL',
  process_optimization: 'BUSINESS_MODEL',
};

// kanon TRIADA pułapka #1: `primary-*` = crimson (zarezerwowane dla semantyki
// krytycznej). IMAGE_MODEL to identyfikator kategorii, nie stan krytyczny —
// purple (HBS Purple, patrz tailwind.config central remap) zamiast primary.
// axe color-contrast (odbior G06, 2026-09-03) — text-*-400 na jasnym tle /10
// mierzone 1.8-3.47:1 (prog 4.5:1); text-slate-600 na ciemnym tle /10 mierzone
// 2.17:1. Dodano jawny wariant per motyw zamiast jednego koloru dla obu.
// DRUGI PRZEJAZD G06 (2026-09-03, podgląd — kontrast): text-blue-600 (#4F62A2)
// na tle KOMÓRKI ZAZNACZONEGO WIERSZA (bg-blue-500/10 + bg-state-selected
// złożone = #dee0e6) mierzył 4,41:1 — wciąż pod 4,5:1 mimo poprzedniej
// naprawy (ta mierzyła zwykłe tło, nie zaznaczony wiersz). blue-700 —
// 8,76:1 na tym samym złożonym tle.
export const KIND_BADGE_STYLES: Record<ModelKind, { bg: string; text: string }> = {
  TEXT_LLM: { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400' },
  IMAGE_MODEL: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
  BUSINESS_MODEL: { bg: 'bg-amber-500/10', text: 'text-amber-800 dark:text-amber-400' },
};

export const PROVIDER_TYPE_STYLES: Record<ProviderType, { bg: string; text: string }> = {
  direct: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400' },
  aggregator: { bg: 'bg-amber-500/10', text: 'text-amber-800 dark:text-amber-400' },
  local: { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400' },
  customer_managed: { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-300' },
};

export const HEALTH_STYLES: Record<HealthStatus, { bg: string; text: string; dot: string }> = {
  healthy: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-400' },
  degraded: { bg: 'bg-amber-500/10', text: 'text-amber-800 dark:text-amber-400', dot: 'bg-amber-400' },
  unhealthy: { bg: 'bg-danger-500/10', text: 'text-danger-600 dark:text-danger-400', dot: 'bg-danger-400' },
  unknown: { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-300', dot: 'bg-slate-400' },
};
