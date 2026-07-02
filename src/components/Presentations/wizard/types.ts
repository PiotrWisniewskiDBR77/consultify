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
export interface CuratedColorSet {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    heading: string;
  };
  chartPalette: string[];
  styleTags: string[];
}

export const CURATED_COLOR_SETS: CuratedColorSet[] = [
  // Harvard — canonical brand-default theme. Crimson + HBS complementary.
  // Spec: docs/audit/2026-06-03/HARVARD_COLOR_REMAP_AUDIT.md
  {
    id: 'harvard',
    name: 'Harvard',
    colors: {
      primary: '#A51C30', // Harvard Crimson
      secondary: '#3B2883', // HBS Blue 1 (dark)
      accent: '#6578B4', // HBS Blue 2
      background: '#FAFAF9',
      surface: '#FFFFFF',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      heading: '#A51C30',
    },
    // Harvard categorical chart palette — crimson-anchored, HBS complementary.
    chartPalette: ['#A51C30', '#6578B4', '#52A52E', '#E87D1E', '#00979D', '#80408D'],
    styleTags: ['brand', 'professional', 'executive'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      primary: '#0B3D91',
      secondary: '#1A8A8A',
      accent: '#00BCD4',
      background: '#F0F7FA',
      surface: '#FFFFFF',
      textPrimary: '#1A2332',
      textSecondary: '#5A6B7D',
      heading: '#0B3D91',
    },
    chartPalette: ['#0B3D91', '#1A8A8A', '#00BCD4', '#4FC3F7', '#80DEEA', '#B2EBF2'],
    styleTags: ['professional', 'calm', 'corporate'],
  },
  {
    id: 'slate',
    name: 'Slate',
    colors: {
      primary: '#475569',
      secondary: '#1E40AF',
      accent: '#3B82F6',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      heading: '#1E293B',
    },
    chartPalette: ['#475569', '#1E40AF', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'],
    styleTags: ['neutral', 'modern', 'professional'],
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      primary: '#14532D',
      secondary: '#166534',
      accent: '#CA8A04',
      background: '#F0FDF4',
      surface: '#FFFFFF',
      textPrimary: '#052E16',
      textSecondary: '#4D7C5E',
      heading: '#14532D',
    },
    chartPalette: ['#14532D', '#166534', '#22C55E', '#CA8A04', '#86EFAC', '#FDE047'],
    styleTags: ['natural', 'warm', 'professional'],
  },
  {
    id: 'ember',
    name: 'Ember',
    colors: {
      primary: '#292524',
      secondary: '#78350F',
      accent: '#EA580C',
      background: '#FFFBEB',
      surface: '#FFFFFF',
      textPrimary: '#1C1917',
      textSecondary: '#78716C',
      heading: '#292524',
    },
    chartPalette: ['#292524', '#EA580C', '#F59E0B', '#FB923C', '#FDBA74', '#FED7AA'],
    styleTags: ['bold', 'energetic', 'dark'],
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      primary: '#0F0F23',
      secondary: '#312E81',
      accent: '#6366F1',
      background: '#0F0F23',
      surface: '#1E1B4B',
      textPrimary: '#F8FAFC',
      textSecondary: '#A5B4FC',
      heading: '#E0E7FF',
    },
    chartPalette: ['#6366F1', '#A78BFA', '#C4B5FD', '#6D28D9', '#4C1D95', '#DDD6FE'],
    styleTags: ['dark', 'premium', 'modern'],
  },
  {
    id: 'arctic',
    name: 'Arctic',
    colors: {
      primary: '#E2E8F0',
      secondary: '#64748B',
      accent: '#0EA5E9',
      background: '#FFFFFF',
      surface: '#F1F5F9',
      textPrimary: '#1E293B',
      textSecondary: '#64748B',
      heading: '#334155',
    },
    chartPalette: ['#0EA5E9', '#38BDF8', '#7DD3FC', '#64748B', '#94A3B8', '#CBD5E1'],
    styleTags: ['light', 'clean', 'minimal'],
  },
  {
    id: 'sand',
    name: 'Sand',
    colors: {
      primary: '#78716C',
      secondary: '#92400E',
      accent: '#D97706',
      background: '#FAFAF9',
      surface: '#FFFFFF',
      textPrimary: '#292524',
      textSecondary: '#78716C',
      heading: '#44403C',
    },
    chartPalette: ['#92400E', '#D97706', '#F59E0B', '#78716C', '#A8A29E', '#D6D3D1'],
    styleTags: ['warm', 'elegant', 'natural'],
  },
  {
    id: 'indigo',
    name: 'Indigo',
    colors: {
      primary: '#3730A3',
      secondary: '#4338CA',
      accent: '#10B981',
      background: '#EEF2FF',
      surface: '#FFFFFF',
      textPrimary: '#1E1B4B',
      textSecondary: '#6366F1',
      heading: '#312E81',
    },
    chartPalette: ['#3730A3', '#4338CA', '#10B981', '#6366F1', '#818CF8', '#34D399'],
    styleTags: ['vibrant', 'modern', 'tech'],
  },
  {
    id: 'graphite',
    name: 'Graphite',
    colors: {
      primary: '#374151',
      secondary: '#4B5563',
      accent: '#2563EB',
      background: '#F3F4F6',
      surface: '#FFFFFF',
      textPrimary: '#111827',
      textSecondary: '#6B7280',
      heading: '#1F2937',
    },
    chartPalette: ['#374151', '#2563EB', '#3B82F6', '#60A5FA', '#6B7280', '#9CA3AF'],
    styleTags: ['corporate', 'neutral', 'professional'],
  },
  {
    id: 'olive',
    name: 'Olive',
    colors: {
      primary: '#4D5F3E',
      secondary: '#6B7F3E',
      accent: '#BDB76B',
      background: '#FEFDF6',
      surface: '#FFFFFF',
      textPrimary: '#2D3A1F',
      textSecondary: '#6B7F5E',
      heading: '#3D4F2E',
    },
    chartPalette: ['#4D5F3E', '#6B7F3E', '#BDB76B', '#9CB380', '#C5D6A0', '#E8F0D8'],
    styleTags: ['organic', 'soft', 'earthy'],
  },
  {
    id: 'burgundy',
    name: 'Burgundy',
    colors: {
      primary: '#7F1D1D',
      secondary: '#991B1B',
      accent: '#374151',
      background: '#FEF2F2',
      surface: '#FFFFFF',
      textPrimary: '#450A0A',
      textSecondary: '#991B1B',
      heading: '#7F1D1D',
    },
    chartPalette: ['#7F1D1D', '#991B1B', '#DC2626', '#374151', '#6B7280', '#F87171'],
    styleTags: ['premium', 'bold', 'executive'],
  },
  {
    id: 'teal',
    name: 'Teal',
    colors: {
      primary: '#115E59',
      secondary: '#0F766E',
      accent: '#475569',
      background: '#F0FDFA',
      surface: '#FFFFFF',
      textPrimary: '#042F2E',
      textSecondary: '#5EEAD4',
      heading: '#134E4A',
    },
    chartPalette: ['#115E59', '#0F766E', '#3B82F6', '#2DD4BF', '#475569', '#94A3B8'],
    styleTags: ['fresh', 'professional', 'balanced'],
  },
];

// ─── Wizard State ────────────────────────────────────────────────────
export type WizardStep = 'sources' | 'setup' | 'outline' | 'generating' | 'result';

export interface SourceArtifact {
  type: string;
  id?: string;
  label: string;
  artifactId?: string;
  confidence?: number;
  readiness?:
    | 'ready'
    | 'partial_ready'
    | 'missing_sales_data'
    | 'policy_blocked'
    | 'insufficient_evidence';
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
  { type: 'report', icon: 'FileText', color: 'text-primary-500' },
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
