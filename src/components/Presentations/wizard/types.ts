/**
 * Presentation Generator V3 — Wizard Types & Constants
 * Canonical source: docs/product/PRESENTATION_GENERATOR_V3.md
 */

// ─── Presentation Mode ───────────────────────────────────────────────
export type PresentationMode = 'show' | 'document' | 'briefing' | 'workshop';

export interface PresentationModeInfo {
  id: PresentationMode;
  labelKey: string;
  descriptionKey: string;
  icon: string;
  wordsPerSlide: string;
  images: string;
  animations: boolean;
  typicalSlides: string;
}

export const PRESENTATION_MODES: PresentationModeInfo[] = [
  {
    id: 'show',
    labelKey: 'presentations.wizard.modes.show',
    descriptionKey: 'presentations.wizard.modes.showDesc',
    icon: 'Monitor',
    wordsPerSlide: '15–25',
    images: 'frequent, large',
    animations: true,
    typicalSlides: '8–15',
  },
  {
    id: 'document',
    labelKey: 'presentations.wizard.modes.document',
    descriptionKey: 'presentations.wizard.modes.documentDesc',
    icon: 'FileText',
    wordsPerSlide: '50–120',
    images: 'rare, supporting',
    animations: false,
    typicalSlides: '15–40',
  },
  {
    id: 'briefing',
    labelKey: 'presentations.wizard.modes.briefing',
    descriptionKey: 'presentations.wizard.modes.briefingDesc',
    icon: 'Zap',
    wordsPerSlide: '30–50',
    images: 'minimal (icons/KPI)',
    animations: true,
    typicalSlides: '5–10',
  },
  {
    id: 'workshop',
    labelKey: 'presentations.wizard.modes.workshop',
    descriptionKey: 'presentations.wizard.modes.workshopDesc',
    icon: 'Users',
    wordsPerSlide: '10–30',
    images: 'frameworks/diagrams',
    animations: false,
    typicalSlides: '10–20',
  },
];

// ─── Communication Register ──────────────────────────────────────────
export type CommunicationRegister = 'executive' | 'professional' | 'technical' | 'narrative';

export interface RegisterInfo {
  id: CommunicationRegister;
  labelKey: string;
  descriptionKey: string;
}

export const COMMUNICATION_REGISTERS: RegisterInfo[] = [
  {
    id: 'executive',
    labelKey: 'presentations.wizard.registers.executive',
    descriptionKey: 'presentations.wizard.registers.executiveDesc',
  },
  {
    id: 'professional',
    labelKey: 'presentations.wizard.registers.professional',
    descriptionKey: 'presentations.wizard.registers.professionalDesc',
  },
  {
    id: 'technical',
    labelKey: 'presentations.wizard.registers.technical',
    descriptionKey: 'presentations.wizard.registers.technicalDesc',
  },
  {
    id: 'narrative',
    labelKey: 'presentations.wizard.registers.narrative',
    descriptionKey: 'presentations.wizard.registers.narrativeDesc',
  },
];

// ─── Image Style Presets ─────────────────────────────────────────────
export type ImageStylePreset =
  | 'corporate_photography'
  | 'abstract_geometric'
  | 'flat_illustration'
  | 'data_focused'
  | 'industry_realistic'
  | 'minimal_no_images';

export interface ImageStyleInfo {
  id: ImageStylePreset;
  labelKey: string;
  descriptionKey: string;
  icon: string;
}

export const IMAGE_STYLE_PRESETS: ImageStyleInfo[] = [
  {
    id: 'corporate_photography',
    labelKey: 'presentations.wizard.imageStyles.corporatePhotography',
    descriptionKey: 'presentations.wizard.imageStyles.corporatePhotographyDesc',
    icon: 'Camera',
  },
  {
    id: 'abstract_geometric',
    labelKey: 'presentations.wizard.imageStyles.abstractGeometric',
    descriptionKey: 'presentations.wizard.imageStyles.abstractGeometricDesc',
    icon: 'Hexagon',
  },
  {
    id: 'flat_illustration',
    labelKey: 'presentations.wizard.imageStyles.flatIllustration',
    descriptionKey: 'presentations.wizard.imageStyles.flatIllustrationDesc',
    icon: 'Palette',
  },
  {
    id: 'data_focused',
    labelKey: 'presentations.wizard.imageStyles.dataFocused',
    descriptionKey: 'presentations.wizard.imageStyles.dataFocusedDesc',
    icon: 'BarChart3',
  },
  {
    id: 'industry_realistic',
    labelKey: 'presentations.wizard.imageStyles.industryRealistic',
    descriptionKey: 'presentations.wizard.imageStyles.industryRealisticDesc',
    icon: 'Factory',
  },
  {
    id: 'minimal_no_images',
    labelKey: 'presentations.wizard.imageStyles.minimalNoImages',
    descriptionKey: 'presentations.wizard.imageStyles.minimalNoImagesDesc',
    icon: 'Type',
  },
];

// ─── Image Source ────────────────────────────────────────────────────
export type ImageSource = 'smart' | 'org_library' | 'ai_only' | 'none' | 'manual';

export interface ImageSourceInfo {
  id: ImageSource;
  labelKey: string;
}

export const IMAGE_SOURCES: ImageSourceInfo[] = [
  { id: 'smart', labelKey: 'presentations.wizard.imageSources.smart' },
  { id: 'org_library', labelKey: 'presentations.wizard.imageSources.orgLibrary' },
  { id: 'ai_only', labelKey: 'presentations.wizard.imageSources.aiOnly' },
  { id: 'none', labelKey: 'presentations.wizard.imageSources.none' },
  { id: 'manual', labelKey: 'presentations.wizard.imageSources.manual' },
];

// ─── Content Depth ───────────────────────────────────────────────────
export type ContentDepth = 'minimal' | 'concise' | 'detailed' | 'extensive';

export interface ContentDepthInfo {
  id: ContentDepth;
  labelKey: string;
  descriptionKey: string;
}

export const CONTENT_DEPTHS: ContentDepthInfo[] = [
  {
    id: 'minimal',
    labelKey: 'presentations.wizard.contentDepth.minimal',
    descriptionKey: 'presentations.wizard.contentDepth.minimalDesc',
  },
  {
    id: 'concise',
    labelKey: 'presentations.wizard.contentDepth.concise',
    descriptionKey: 'presentations.wizard.contentDepth.conciseDesc',
  },
  {
    id: 'detailed',
    labelKey: 'presentations.wizard.contentDepth.detailed',
    descriptionKey: 'presentations.wizard.contentDepth.detailedDesc',
  },
  {
    id: 'extensive',
    labelKey: 'presentations.wizard.contentDepth.extensive',
    descriptionKey: 'presentations.wizard.contentDepth.extensiveDesc',
  },
];

// ─── Card Size ───────────────────────────────────────────────────────
export type CardSize = '16:9' | '4:3' | 'fluid';

export const CARD_SIZES: { id: CardSize; label: string }[] = [
  { id: '16:9', label: '16:9' },
  { id: '4:3', label: '4:3' },
  { id: 'fluid', label: 'Fluid' },
];

// ─── Card Intent ─────────────────────────────────────────────────────
export type CardIntent =
  | 'cover'
  | 'executive_summary'
  | 'section_intro'
  | 'key_messages'
  | 'performance_overview'
  | 'single_insight'
  | 'comparison'
  | 'assessment'
  | 'recommendation_portfolio'
  | 'initiative_portfolio'
  | 'prioritization_matrix'
  | 'roadmap'
  | 'risk_management'
  | 'next_steps'
  | 'appendix'
  // Deck Builder legacy intents (kept for backwards compatibility)
  | 'content'
  | 'summary'
  | 'kpi_dashboard'
  | 'data'
  | 'recommendation'
  | 'section_divider'
  | 'timeline'
  | 'process'
  | 'quote'
  | 'risk_overview'
  | 'thank_you';

export const INTENT_COLORS: Record<CardIntent, string> = {
  cover: 'bg-navy-900',
  executive_summary: 'bg-blue-500',
  section_intro: 'bg-slate-500',
  key_messages: 'bg-emerald-500',
  performance_overview: 'bg-navy-900',
  single_insight: 'bg-amber-500',
  comparison: 'bg-amber-500',
  assessment: 'bg-blue-500',
  recommendation_portfolio: 'bg-green-500',
  initiative_portfolio: 'bg-blue-500',
  prioritization_matrix: 'bg-pink-500',
  roadmap: 'bg-sky-500',
  risk_management: 'bg-danger-500',
  next_steps: 'bg-indigo-500',
  appendix: 'bg-slate-400',
  // Legacy mappings
  content: 'bg-emerald-500',
  summary: 'bg-blue-500',
  kpi_dashboard: 'bg-navy-900',
  data: 'bg-amber-500',
  recommendation: 'bg-green-500',
  section_divider: 'bg-slate-500',
  timeline: 'bg-sky-500',
  process: 'bg-sky-500',
  quote: 'bg-emerald-500',
  risk_overview: 'bg-danger-500',
  thank_you: 'bg-indigo-500',
};

// ─── Curated Color Sets ──────────────────────────────────────────────
// Fala 1 (2026-07-28): moved to a shared, non-feature-specific location so
// the Deck/Word Template Architects can reuse the exact same gallery the
// Wizard already uses. Re-exported here so every existing import of
// `CURATED_COLOR_SETS` / `CuratedColorSet` from this module keeps working.
export {
  CURATED_COLOR_SETS,
  type CuratedColorSet,
} from '@/components/shared/colorPatterns/curatedColorSets';

// ─── Wizard State ────────────────────────────────────────────────────
export type WizardStep = 'sources' | 'setup' | 'outline' | 'generating' | 'result';

export interface SourceArtifact {
  type: string;
  id?: string;
  label: string;
  artifactId?: string;
  confidence?: number;
  readiness?:
    'ready' | 'partial_ready' | 'missing_sales_data' | 'policy_blocked' | 'insufficient_evidence';
  lineage?: {
    runtime?: string;
    recordId?: string;
    family?: string;
  };
  /** Draft/throwaway flag (M17 junk filter). Hidden from the default picker. */
  isDraft?: boolean;
  data?: unknown;
}

export interface OutlineItem {
  intent: CardIntent;
  title: string;
  contentHint?: string;
  keyMessage?: string;
  enabled: boolean;
  sourceRef?: string;
  sourceRefs?: string[];
  confidence?: number;
  density?: 'visual' | 'balanced' | 'document';
  visualPolicy?: string;
  layoutHint?: string;
  suggestedBlocks?: string[];
  imageHint?: 'org_photo' | 'ai_image' | 'chart' | 'diagram' | 'none';
  warnings?: string[];
}

export interface DeckTemplate {
  id: string;
  name: string;
  description: string;
  deck_type: string;
  audience: string;
  goal: string;
  theme: string;
  presentation_mode?: PresentationMode;
  communication_register?: CommunicationRegister;
  outline_json: OutlineItem[];
  is_system: boolean;
}

export interface IntentInfo {
  id: CardIntent;
  label: string;
  description: string;
}

export interface WizardSettings {
  title: string;
  selectedTemplate: string;
  presentationMode: PresentationMode;
  communicationRegister: CommunicationRegister;
  imageStylePreset: ImageStylePreset;
  imageSource: ImageSource;
  contentDepth: ContentDepth;
  cardSize: CardSize;
  colorSetId: string;
  audience: string;
  goal: string;
  language: 'en' | 'pl';
  confidentiality: 'confidential' | 'internal' | 'public';
  visualsEnabled: boolean;
  visualsPriority: 'quality' | 'cost';
  additionalInstructions: string;
}

export const DEFAULT_WIZARD_SETTINGS: WizardSettings = {
  title: '',
  selectedTemplate: '',
  presentationMode: 'briefing',
  communicationRegister: 'professional',
  imageStylePreset: 'abstract_geometric',
  imageSource: 'smart',
  contentDepth: 'concise',
  cardSize: '16:9',
  colorSetId: 'slate',
  audience: 'executive',
  goal: 'inform',
  language: 'en',
  confidentiality: 'internal',
  visualsEnabled: true,
  visualsPriority: 'quality',
  additionalInstructions: '',
};

// ─── Source Types ────────────────────────────────────────────────────
export interface SourceTypeInfo {
  type: string;
  icon: string;
  color: string;
}

export const SOURCE_TYPES: SourceTypeInfo[] = [
  { type: 'initiative', icon: 'Target', color: 'text-blue-500' },
  { type: 'note', icon: 'BookOpen', color: 'text-emerald-500' },
  { type: 'report', icon: 'FileText', color: 'text-c-info' },
  { type: 'financial_analysis', icon: 'TrendingUp', color: 'text-amber-500' },
  { type: 'tool_session', icon: 'Zap', color: 'text-blue-500' },
  { type: 'workspace', icon: 'Layout', color: 'text-indigo-500' },
  { type: 'insight', icon: 'Lightbulb', color: 'text-pink-500' },
];

// ─── Block Types (for DeckBuilder) ───────────────────────────────────
export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'bullet_list'
  | 'numbered_list'
  | 'table'
  | 'chart'
  | 'image'
  | 'icon_row'
  | 'kpi_widget'
  | 'smart_layout'
  | 'smart_diagram'
  | 'callout'
  | 'quote_block'
  | 'timeline_block'
  | 'metric_strip'
  | 'artifact_embed'
  | 'divider';

// ─── Deck Card (for Builder) ─────────────────────────────────────────
export interface CardBlock {
  block_id: string;
  card_id: string;
  type: BlockType;
  content: Record<string, unknown>;
  source_ref?: { artifact_id: string; artifact_type: string; artifact_name: string };
  is_refreshable: boolean;
  position: { area: 'full' | 'left' | 'right' | 'top' | 'bottom' | 'overlay'; order: number };
  style_overrides?: Record<string, unknown>;
  /** Optional freeform geometry, expressed as percentages of the slide canvas. */
  geometry?: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  /** Blocks sharing a group id move/resize as one selection. */
  group_id?: string;
  ai_editable: boolean;
}

/**
 * STEP 1b — Per-slide composition plan carried from B1
 * (presentationLayoutDirectorService.SlideComposition). Additive +
 * back-compatible: when absent, the renderer keeps its pure heuristic
 * (today's behaviour). When present, `layoutVariantId` is an archetype id
 * the renderer maps to a LAYOUT_TEMPLATES entry, and `regions` carries the
 * AI's area assignment so assignBlocksToRegions can prefer it.
 */
export interface CardComposition {
  layoutVariantId?: string;
  regions?: { area: string; blockTypes?: string[] }[];
  emphasis?: string;
}

export interface DeckCard {
  card_id: string;
  deck_id: string;
  order_index: number;
  intent: CardIntent;
  /**
   * Heuristic sentinel ('auto') OR an AI/archetype-chosen layout id. When set
   * to a known LAYOUT_TEMPLATES id (or a mappable archetype via `composition`),
   * the renderer honours it and skips the heuristic. 'auto'/'' → heuristic.
   */
  layout_id: string;
  /** Manual slide-level vertical alignment/distribution override. */
  content_alignment?: 'top' | 'center' | 'space-between';
  /** STEP 1b — optional B1 composition plan; absent → pure heuristic. */
  composition?: CardComposition | null;
  title: string;
  blocks: CardBlock[];
  source_refs: { artifact_id: string; artifact_type: string; artifact_name: string }[];
  speaker_notes?: string;
  has_refreshable_data: boolean;
  last_data_refresh?: string;
  background: {
    type: 'theme' | 'color' | 'gradient' | 'image';
    value?: string;
  };
  animations: {
    entrance: 'fade' | 'slide_up' | 'none';
    block_stagger: boolean;
  };
  is_locked: boolean;
}

export interface Deck {
  deck_id: string;
  organization_id: string;
  title: string;
  description?: string;
  template_id?: string;
  theme_id: string;
  presentation_mode: PresentationMode;
  communication_register: CommunicationRegister;
  image_style_preset: ImageStylePreset;
  color_set_id?: string;
  status: 'draft' | 'generated' | 'editing' | 'ready' | 'shared' | 'archived';
  card_size: CardSize;
  cards: DeckCard[];
  source_refs: { artifact_id: string; artifact_type: string; artifact_name: string }[];
  generation_settings: {
    text_mode: 'generate' | 'condense' | 'preserve';
    content_depth: ContentDepth;
    audience: string;
    tone: string;
    language: string;
    image_source: ImageSource;
    additional_instructions?: string;
  };
  animations_enabled: boolean;
  share_settings: {
    is_shared: boolean;
    share_url?: string;
    permissions: 'view' | 'comment' | 'edit';
  };
  speaker_notes_generated: boolean;
  last_data_refresh?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
