/**
 * Presentation Generator Service (T058)
 *
 * Transforms platform artifacts into sponsor-ready UnifiedReportJSON decks.
 * Pipeline: source selection → guided setup → outline → UnifiedJSON → PPTX via PptxPipelineService.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { materializePlannedVisual } from './ai/deckVisualsService.js';
import {
  buildContextPack,
  getContextPackSnapshot,
  saveContextPackSnapshot,
} from './contextPackBuilder.js';
import { generateNarrative } from './narrativeEngine/index.js';
import type { NarrativeEngineInput } from './narrativeEngine/types.js';
import { recordDeckGeneration } from './organizationStyleProfileService.js';
import {
  applyApprovedTemplateToOutline,
  resolveApprovedPresentationTemplate,
  type TemplateSlotMappingResult,
} from './presentationApprovedTemplateService.js';
import {
  applyBrandLayoutSystem,
  buildBrandLayoutSystem,
} from './presentationBrandLayoutService.js';
import { deckDocumentFromUnifiedJson } from './presentationDeckDocumentService.js';
import { buildPresentationNarrativePlan } from './presentationNarrativePlannerService.js';
import { preflightPresentationSourcePack } from './presentationSourcePackService.js';
import { applyIntentDensityDefaults } from './presentationStudioIntentDensityDefaultsService.js';
import { auditPresentationStudioOutlineLayout } from './presentationStudioLayoutAuditService.js';
import { decorateSlidesWithAuditFlags } from './presentationStudioSlideAuditDecoratorService.js';
import {
  applyTemplateRuntime,
  buildSystemTemplateRuntime,
  buildTemplateRuntimeFromRow,
  type PresentationTemplateRuntime,
} from './presentationTemplateRuntimeService.js';
import { qaGatedImageGeneration } from './presentationVisionQAService.js';
import { planDeckVisuals, planDeckVisualsTiered } from './presentationVisualDirectorService.js';
import { generateDeckVariants } from './presentationLayoutVariantsService.js';
import { resolveDeliverableTier } from './deliverableGenerationTier.js';
import { PptxPipelineService } from './report/pptx/PptxPipelineService.js';
import type {
  SlideIntent,
  UnifiedReportJSON,
  UnifiedReportMeta,
  UnifiedSlide,
} from './report/pptx/types.js';
import { planSlides } from './slidePlanningEngineService.js';
import {
  applyTransformationPackToArtifactData,
  buildTransformationReadDeckPack,
} from './transformationReadDeckPackService.js';
import * as artifactRegistryService from './v8/artifactRegistryService.js';
import { runBundleContentGate } from './deliverables/bundleContentGate.js';

// ============================================================
// TYPES
// ============================================================

export interface DeckSetup {
  title: string;
  templateId?: string;
  audience: 'sponsor' | 'executive' | 'investor' | 'internal';
  goal: 'inform' | 'decide' | 'sell' | 'align';
  language: 'en' | 'pl';
  theme: 'corporate' | 'minimal' | 'modern';
  confidentiality: 'confidential' | 'internal' | 'public';
  brandColor?: string;
  sourceArtifacts: SourceArtifact[];

  /** V3-A01: Traceability — canonical source of this deck */
  sourceType?: string;
  sourceId?: string;

  /**
   * Gamma-like visuals for PPTX.
   * - `enabled`: whether to attempt AI image generation (safe to enable even without keys; falls back).
   * - `priority`: explicit user preference: quality vs cost.
   */
  visuals?: {
    enabled?: boolean;
    priority?: 'quality' | 'cost';
    /** Controls how many images we attempt to generate per deck. */
    imageDensity?: 'low' | 'medium' | 'high';
  };
  sourcePack?: Record<string, unknown>;
  sourcePackStrict?: boolean;
}

export interface SourceArtifact {
  type:
    | 'initiative_portfolio'
    | 'execution_status'
    | 'raid'
    | 'kpi_roi'
    | 'assessment'
    | 'tool_session'
    | 'report'
    | 'valuation'
    | 'financial_analysis'
    | 'interview_study'
    | 'insight_pack'
    | 'decision_pack'
    | 'workspace'
    | 'custom';
  id?: string;
  artifactId?: string;
  label: string;
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
  data?: any;
}

export interface OutlineItem {
  intent: SlideIntent;
  title: string;
  keyMessage?: string;
  enabled: boolean;
  sourceRef?: string;
  sourceRefs?: string[];
  confidence?: number;
  density?: 'visual' | 'balanced' | 'document';
  /**
   * Sprint S12 — per-slot density override. When present, the layout
   * audit resolves capacity caps per-slot rather than routing the entire
   * slide through one `density`. Closes R-S10-2. Backward compatible:
   * omitted slots fall back to `density` (which itself falls back to
   * 'balanced' inside the audit).
   */
  slotDensities?: {
    title?: 'visual' | 'balanced' | 'document';
    keyMessage?: 'visual' | 'balanced' | 'document';
    blocks?: 'visual' | 'balanced' | 'document';
  };
  visualPolicy?: string;
  layoutHint?: string;
  suggestedBlocks?: string[];
  notesPolicy?: 'none' | 'light' | 'standard' | 'speaker_heavy';
  warnings?: string[];
}

export interface GenerationResult {
  deckId: string;
  slideCount: number;
  warnings: string[];
  exportPath?: string;
}

// ============================================================
// OUTLINE GENERATORS (per deck type / template)
// ============================================================

function generateOutlineFromTemplate(
  templateOutline: OutlineItem[],
  sources: SourceArtifact[]
): OutlineItem[] {
  const outline = templateOutline.map((item) => ({ ...item, enabled: true }));

  const hasKpi = sources.some((s) => s.type === 'kpi_roi');
  const hasRaid = sources.some((s) => s.type === 'raid');
  const hasAssessment = sources.some((s) => s.type === 'assessment');

  if (!hasKpi) {
    outline.forEach((o) => {
      if (o.intent === 'performance_overview' && !o.sourceRef) o.enabled = false;
    });
  }
  if (!hasRaid) {
    outline.forEach((o) => {
      if (o.intent === 'risk_management' && !o.sourceRef) o.enabled = false;
    });
  }
  if (!hasAssessment) {
    outline.forEach((o) => {
      if (o.intent === 'assessment' && !o.sourceRef) o.enabled = false;
    });
  }

  // Sprint S14: fill in slide-level density + per-slot density defaults
  // for any item that didn't already declare them. Caller-provided
  // values are preserved verbatim. Closes the consumer side of R-S12-1.
  return outline.map(applyIntentDensityDefaults);
}

export function generateDefaultOutline(setup: DeckSetup): OutlineItem[] {
  const items: OutlineItem[] = [
    { intent: 'cover', title: setup.title, enabled: true },
    {
      intent: 'executive_summary',
      title: setup.language === 'pl' ? 'Podsumowanie' : 'Executive Summary',
      enabled: true,
    },
    {
      intent: 'key_messages',
      title: setup.language === 'pl' ? 'Kluczowe wnioski' : 'Key Messages',
      enabled: true,
    },
  ];

  // Blank-brief (no source artifacts): a 4-slide stub (cover/exec/key/next) is
  // too thin for a consulting-grade deck. Lay down the standard narrative arc
  // — problem → approach → findings → recommendations → roadmap → risks — with
  // sensible per-slide key messages so downstream content-gen has real anchors
  // (not "Key message for X" placeholders). When sources ARE present, the
  // source-driven slides below carry the analytical narrative instead.
  const pl = setup.language === 'pl';
  // "Rich" sources drive the analytical slides below. A deck whose only source is
  // the synthetic `custom` placeholder (injected by the V8 materialize path when
  // no real artifact exists) is effectively a blank-brief narrative deck — so the
  // arc must fire on "no rich source", not merely "no source at all".
  const RICH_SOURCE_TYPES = new Set([
    'initiative_portfolio', 'execution_status', 'kpi_roi', 'raid', 'assessment', 'tool_session',
  ]);
  const hasRichSource =
    Array.isArray(setup.sourceArtifacts) &&
    setup.sourceArtifacts.some((s) => RICH_SOURCE_TYPES.has(String((s as any).type)));
  if (!hasRichSource) {
    const arc: OutlineItem[] = [
      { intent: 'root_cause', title: pl ? 'Problem i kontekst' : 'Problem & Context',
        keyMessage: pl ? 'Jaki problem rozwiązujemy i dlaczego teraz' : 'The problem we solve and why now', enabled: true },
      { intent: 'single_insight', title: pl ? 'Podejście i metodyka' : 'Approach & Methodology',
        keyMessage: pl ? 'Jak podchodzimy do problemu' : 'How we approach the problem', enabled: true },
      { intent: 'performance_overview', title: pl ? 'Wyniki i analiza' : 'Findings & Analysis',
        keyMessage: pl ? 'Co pokazują dane i analiza' : 'What the data and analysis show', enabled: true },
      { intent: 'recommendation_portfolio', title: pl ? 'Rekomendacje' : 'Recommendations',
        keyMessage: pl ? 'Co rekomendujemy i dlaczego' : 'What we recommend and why', enabled: true },
      { intent: 'roadmap', title: pl ? 'Roadmapa wdrożenia' : 'Implementation Roadmap',
        keyMessage: pl ? 'Plan realizacji w czasie' : 'Phased execution plan', enabled: true },
      { intent: 'risk_management', title: pl ? 'Ryzyka i mitygacje' : 'Risks & Mitigations',
        keyMessage: pl ? 'Kluczowe ryzyka i plan ich ograniczenia' : 'Key risks and how we mitigate them', enabled: true },
    ];
    items.push(...arc);
  }

  for (const source of setup.sourceArtifacts) {
    switch (source.type) {
      case 'initiative_portfolio':
        items.push({
          intent: 'initiative_portfolio',
          title: setup.language === 'pl' ? 'Portfel inicjatyw' : 'Initiative Portfolio',
          enabled: true,
          sourceRef: source.id,
        });
        break;
      case 'execution_status':
        items.push({
          intent: 'roadmap',
          title: setup.language === 'pl' ? 'Plan realizacji' : 'Execution Roadmap',
          enabled: true,
          sourceRef: source.id,
        });
        break;
      case 'kpi_roi':
        items.push({
          intent: 'performance_overview',
          title: setup.language === 'pl' ? 'KPI i ROI' : 'KPI & ROI Overview',
          enabled: true,
          sourceRef: source.id,
        });
        break;
      case 'raid':
        items.push({
          intent: 'risk_management',
          title: setup.language === 'pl' ? 'Ryzyka i mitygacje' : 'Risks & Mitigations',
          enabled: true,
          sourceRef: source.id,
        });
        break;
      case 'assessment':
        items.push({
          intent: 'assessment',
          title: setup.language === 'pl' ? 'Wyniki oceny' : 'Assessment Results',
          enabled: true,
          sourceRef: source.id,
        });
        items.push({
          intent: 'comparison',
          title: setup.language === 'pl' ? 'Analiza luk' : 'Gap Analysis',
          enabled: true,
          sourceRef: source.id,
        });
        break;
      case 'tool_session':
        items.push({
          intent: 'single_insight',
          title: source.label || 'Tool Insight',
          enabled: true,
          sourceRef: source.id,
        });
        break;
    }
  }

  items.push({
    intent: 'next_steps',
    title: setup.language === 'pl' ? 'Kolejne kroki' : 'Next Steps',
    enabled: true,
  });

  if (setup.confidentiality === 'confidential' || setup.goal === 'sell') {
    items.push({
      intent: 'appendix',
      title: setup.language === 'pl' ? 'Zastrzeżenia' : 'Disclaimers & Methodology',
      enabled: true,
    });
  }

  // Sprint S14: enrich with intent-driven density defaults so the layout
  // audit can reason about per-slot capacities (e.g. comparison hero
  // titles vs dense bullet cells) without forcing every caller to set
  // the densities explicitly. See `presentationStudioIntentDensityDefaultsService`.
  return items.map(applyIntentDensityDefaults);
}

function getSourceKey(source: SourceArtifact): string {
  return String(source.artifactId || source.id || source.type);
}

function outlineSourceRefs(item: OutlineItem, setup: DeckSetup) {
  const selected = Array.isArray(setup.sourceArtifacts) ? setup.sourceArtifacts : [];
  const ids = new Set<string>([
    ...(Array.isArray(item.sourceRefs) ? item.sourceRefs : []),
    ...(item.sourceRef ? [item.sourceRef] : []),
  ]);
  const matched =
    selected.find((source) => ids.has(getSourceKey(source))) ||
    selected.find((source) => item.title.toLowerCase().includes(source.type.replace(/_/g, ' '))) ||
    selected[0];
  const refs = matched ? [matched] : [];
  return refs.map((source) => ({
    artifact_id: source.artifactId || source.id || source.type,
    artifact_type: source.type,
    artifact_name: source.label || source.type,
    confidence: source.confidence ?? item.confidence ?? null,
    readiness: source.readiness || 'ready',
    freshness_days:
      typeof (source.data as any)?.freshness_days === 'number'
        ? Number((source.data as any).freshness_days)
        : typeof (source.data as any)?.freshnessDays === 'number'
          ? Number((source.data as any).freshnessDays)
          : null,
    captured_at: (source.data as any)?.captured_at || (source.data as any)?.capturedAt || null,
    lineage: source.lineage || null,
  }));
}

function attachSlideGovernance(
  slide: UnifiedSlide,
  item: OutlineItem,
  setup: DeckSetup
): UnifiedSlide {
  const sourceRefs = outlineSourceRefs(item, setup);
  return {
    ...slide,
    key_message: String(slide.key_message || item.keyMessage || item.title)
      .split(/\s+/)
      .slice(0, 14)
      .join(' '),
    ...(sourceRefs.length ? { source_refs: sourceRefs } : {}),
    ...(item.layoutHint ? { layout_hint: item.layoutHint } : {}),
    ...(item.visualPolicy ? { visual_policy: item.visualPolicy } : {}),
    ...(item.confidence !== undefined ? { confidence: item.confidence } : {}),
    ...(item.notesPolicy && item.notesPolicy !== 'none'
      ? { speaker_notes: `${item.title}: ${item.keyMessage || slide.key_message || ''}` }
      : {}),
  } as UnifiedSlide;
}

function getStringList(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => String(item)).filter(Boolean);
}

const ENCODING_REPAIRS: Array<[RegExp, string]> = [
  [/&amp;/g, '&'],
  [/&nbsp;/g, ' '],
  [/â€™/g, "'"],
  [/â€“/g, '-'],
  [/â€œ/g, '"'],
  [/â€\u009d/g, '"'],
  [/�/g, ''],
];

function sanitizePrimitiveText(text: string): string {
  let cleaned = String(text || '');
  for (const [pattern, replacement] of ENCODING_REPAIRS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  cleaned = cleaned.replace(/\[object Object\]/gi, '').trim();
  return cleaned;
}

/**
 * Deck-quality polish (mirrors docGenerationRuntime.polishMarkdownForCanvas):
 * slide blocks render as PLAIN text, so internal/markdown tokens emitted by the
 * LLM layers must never reach storage. Cleans:
 *  - `## `/`### ` markdown heading markers leaking into body text (marker
 *    stripped, text kept — block structure already carries the heading),
 *  - `[Fact: <label>]` provenance markers from the Narrative Engine
 *    (internal id labels are removed; if the bracket wraps real prose, the
 *    prose survives),
 *  - `**bold**` / `` `code` `` markers (noise in plain-text slide blocks),
 *  - `Data gap:` internal placeholder prefix → human phrasing in deck language.
 */
function polishDeckText(text: string, language: 'pl' | 'en' = 'en'): string {
  let out = sanitizePrimitiveText(text);
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  out = out.replace(/\s*\[Fact:\s*([^\]]*)\]/gi, (_match, inner: string) => {
    const trimmed = String(inner || '').trim();
    // Internal id labels (fact_kp_3, kp-12, …) carry no reader value — drop.
    if (!trimmed || /^[\w.-]+$/.test(trimmed)) return '';
    return ` ${trimmed}`;
  });
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  out = out.replace(/`([^`\n]+)`/g, '$1');
  const gapLabel = language === 'pl' ? 'Do uzupełnienia' : 'To be completed';
  out = out.replace(/^(\s*)Data gap:\s*/gim, `$1${gapLabel}: `);
  if (/^data gap$/i.test(out.trim())) out = gapLabel;
  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

function sanitizeSlideContentValue(value: unknown, language: 'pl' | 'en' = 'en'): unknown {
  if (typeof value === 'string') return polishDeckText(value, language);
  if (Array.isArray(value)) return value.map((entry) => sanitizeSlideContentValue(entry, language));
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = sanitizeSlideContentValue(nested, language);
    }
    return output;
  }
  return value;
}

// ============================================================
// SLIDE CONTENT GENERATORS
// ============================================================

function buildSlideContentBase(
  item: OutlineItem,
  setup: DeckSetup,
  artifactData: Record<string, any>
): UnifiedSlide {
  const isPl = setup.language === 'pl';

  switch (item.intent) {
    case 'cover':
      return {
        intent: 'cover',
        key_message: item.title,
        content: {
          type: 'cover',
          title: item.title,
          subtitle: item.keyMessage || (isPl ? 'Przegląd strategiczny' : 'Strategic Review'),
          organization: artifactData._orgName || 'Organization',
          date: new Date().toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
            year: 'numeric',
            month: 'long',
          }),
          confidentiality: setup.confidentiality,
        },
      };

    case 'executive_summary':
      return {
        intent: 'executive_summary',
        key_message:
          item.keyMessage || (isPl ? 'Podsumowanie kluczowych ustaleń' : 'Summary of key findings'),
        content: {
          type: 'executive_summary',
          headline: item.keyMessage || (isPl ? 'Podsumowanie' : 'Executive Summary'),
          key_findings: artifactData._keyFindings || [
            isPl
              ? 'Dane zostaną uzupełnione na podstawie wybranych źródeł'
              : 'Data will be populated from selected sources',
          ],
          kpis: artifactData._kpis || [],
          recommendation: artifactData._recommendation,
        },
      };

    case 'key_messages':
      return {
        intent: 'key_messages',
        key_message: item.keyMessage || (isPl ? 'Kluczowe wnioski' : 'Key Messages'),
        content: {
          type: 'key_messages',
          messages: artifactData._keyMessages || [
            {
              title: isPl ? 'Wniosek 1' : 'Finding 1',
              description: isPl
                ? 'Evidence gap: brak kompletnego materiału źródłowego (owner danych: PMO).'
                : 'Evidence gap: complete source material is missing (data owner: PMO).',
            },
            {
              title: isPl ? 'Wniosek 2' : 'Finding 2',
              description: isPl
                ? 'Evidence gap: brak kompletnego materiału źródłowego (owner danych: PMO).'
                : 'Evidence gap: complete source material is missing (data owner: PMO).',
            },
            {
              title: isPl ? 'Wniosek 3' : 'Finding 3',
              description: isPl
                ? 'Evidence gap: brak kompletnego materiału źródłowego (owner danych: PMO).'
                : 'Evidence gap: complete source material is missing (data owner: PMO).',
            },
          ],
        },
      };

    case 'initiative_portfolio':
      return {
        intent: 'initiative_portfolio',
        key_message:
          item.keyMessage || (isPl ? 'Status portfela inicjatyw' : 'Initiative portfolio status'),
        content: {
          type: 'initiative_portfolio',
          initiatives: artifactData._initiatives || [],
        },
      };

    case 'performance_overview':
      return {
        intent: 'performance_overview',
        key_message:
          item.keyMessage ||
          (isPl ? 'Przegląd kluczowych wskaźników' : 'Key performance indicators overview'),
        content: {
          type: 'performance_overview',
          kpis: artifactData._performanceKpis || [],
          period: artifactData._period || 'Current',
        },
      };

    case 'roadmap':
      return {
        intent: 'roadmap',
        key_message: item.keyMessage || (isPl ? 'Plan transformacji' : 'Transformation roadmap'),
        content: {
          type: 'roadmap',
          phases: artifactData._phases || [
            {
              label: isPl ? 'Faza 1: Quick Wins' : 'Phase 1: Quick Wins',
              timeframe: '0-3m',
              items: [],
            },
            {
              label: isPl ? 'Faza 2: Optymalizacja' : 'Phase 2: Optimization',
              timeframe: '3-6m',
              items: [],
            },
            {
              label: isPl ? 'Faza 3: Skalowanie' : 'Phase 3: Scale',
              timeframe: '6-12m',
              items: [],
            },
          ],
        },
      };

    case 'risk_management':
      return {
        intent: 'risk_management',
        key_message:
          item.keyMessage || (isPl ? 'Kluczowe ryzyka i mitygacje' : 'Key risks and mitigations'),
        content: {
          type: 'risk_management',
          risks: (artifactData._risks || []).map((risk: any) => ({
            risk: risk.risk || risk.title || risk.description || 'Risk',
            likelihood: String(risk.likelihood || risk.probability || 'medium').toLowerCase(),
            impact: String(risk.impact || 'medium').toLowerCase(),
            mitigation: risk.mitigation || risk.strategy || 'Define mitigation owner',
            owner: risk.owner,
          })),
        },
      };

    case 'assessment':
      return {
        intent: 'assessment',
        key_message:
          item.keyMessage || (isPl ? 'Wyniki oceny dojrzałości' : 'Maturity assessment results'),
        content: {
          type: 'assessment',
          matrix_type: 'maturity',
          axes: [],
          scale_max: artifactData._maxScore || 5,
          overall_score: artifactData._overallScore || 0,
        },
      };

    case 'comparison':
      return {
        intent: 'comparison',
        key_message: item.keyMessage || (isPl ? 'Analiza porównawcza' : 'Comparative analysis'),
        content: {
          type: 'comparison',
          left_label: isPl ? 'Opcja A' : 'Option A',
          right_label: isPl ? 'Opcja B' : 'Option B',
          left_items: (artifactData._comparisonItems || []).map((i: any) => String(i?.left || i)),
          right_items: (artifactData._comparisonItems || []).map((i: any) => String(i?.right || i)),
        },
      };

    case 'section_intro':
      return {
        intent: 'section_intro',
        key_message: item.keyMessage || item.title,
        content: {
          type: 'section_intro',
          section_title: item.title,
          section_number: Number((item as any).orderIndex || 0) + 1,
          description:
            item.keyMessage ||
            (isPl
              ? 'Sekcja decku oparta na wybranych źródłach.'
              : 'Deck section grounded in selected sources.'),
        },
      };

    case 'single_insight':
      return {
        intent: 'single_insight',
        key_message: item.keyMessage || artifactData._toolInsight?.summary || item.title,
        content: {
          type: 'single_insight',
          chart_type: 'bar',
          chart_data: artifactData._insightChart || {
            labels: getStringList(artifactData._categories, ['Current', 'Target']).slice(0, 5),
            series: [
              {
                name: isPl ? 'Wynik' : 'Score',
                values: [
                  Number(artifactData._overallScore || 3),
                  Number(artifactData._maxScore || 5),
                ],
              },
            ],
          },
          insight_text:
            artifactData._toolInsight?.summary ||
            item.keyMessage ||
            (isPl
              ? 'Wniosek częściowo ugruntowany: wymagane dodatkowe potwierdzenie źródłowe.'
              : 'Insight is partially grounded: additional source confirmation required.'),
          source: item.sourceRef || artifactData._framework || 'Consultify evidence',
        },
      };

    case 'recommendation_portfolio':
      return {
        intent: 'recommendation_portfolio',
        key_message:
          item.keyMessage ||
          (isPl
            ? 'Rekomendacje wynikające z diagnozy'
            : 'Recommendations derived from the diagnostic'),
        content: {
          type: 'recommendation_portfolio',
          recommendations:
            artifactData._recommendations ||
            (artifactData._initiatives || []).slice(0, 6).map((initiative: any) => ({
              title: initiative.name,
              description: initiative.summary || initiative.status || '',
              impact: String(
                initiative.impact ||
                  initiative.roi ||
                  (isPl ? 'Do uzupełnienia' : 'To be confirmed')
              ),
              priority: String(initiative.priority || 'medium').toLowerCase(),
              category: initiative.axis || initiative.category,
            })) ||
            [],
        },
      };

    case 'recommendation_single':
      return {
        intent: 'recommendation_single',
        key_message: item.keyMessage || item.title,
        content: {
          type: 'recommendation_single',
          title: item.title,
          description:
            item.keyMessage ||
            (isPl
              ? 'Rekomendacja oparta na wybranym materiale.'
              : 'Recommendation grounded in selected evidence.'),
          impact: artifactData._recommendationImpact || 'High',
          effort: artifactData._recommendationEffort || 'Medium',
          priority: 'high',
          timeline: artifactData._recommendationTimeline || '30-90 days',
        },
      };

    case 'prioritization_matrix':
      return {
        intent: 'prioritization_matrix',
        key_message:
          item.keyMessage || (isPl ? 'Priorytetyzacja inicjatyw' : 'Initiative prioritization'),
        content: {
          type: 'prioritization_matrix',
          xAxisLabel: isPl ? 'Wysiłek' : 'Effort',
          yAxisLabel: isPl ? 'Wpływ' : 'Impact',
          quadrants: artifactData._prioritizationQuadrants || [
            { label: 'Quick wins', position: 'top_left', items: [] },
            { label: 'Strategic bets', position: 'top_right', items: [] },
            { label: 'Fill-ins', position: 'bottom_left', items: [] },
            { label: 'Defer', position: 'bottom_right', items: [] },
          ],
        },
      };

    case 'root_cause':
      return {
        intent: 'root_cause',
        key_message: item.keyMessage || (isPl ? 'Źródła problemu' : 'Root causes'),
        content: {
          type: 'root_cause',
          problem: item.title,
          causes: (
            artifactData._rootCauses || [
              {
                cause: isPl ? 'Niedojrzałość procesu' : 'Process maturity gap',
                impact: isPl ? 'Wolniejsze decyzje' : 'Slower decisions',
                severity: 'medium',
              },
            ]
          ).slice(0, 5),
        },
      };

    case 'next_steps':
      return {
        intent: 'next_steps',
        key_message:
          item.keyMessage ||
          (isPl ? 'Kolejne kroki i decyzje' : 'Next steps and decisions required'),
        content: {
          type: 'next_steps',
          actions: artifactData._actions || [
            {
              action: isPl ? 'Zdefiniować priorytety' : 'Define priorities',
              owner: isPl ? 'Do ustalenia przez PMO' : 'To be assigned by PMO',
              deadline: isPl
                ? 'Do potwierdzenia w planie programu'
                : 'To be confirmed in program plan',
            },
            {
              action: isPl ? 'Zatwierdzić roadmapę' : 'Approve roadmap',
              owner: isPl ? 'Do ustalenia przez Sponsor Board' : 'To be assigned by Sponsor Board',
              deadline: isPl
                ? 'Do potwierdzenia w planie programu'
                : 'To be confirmed in program plan',
            },
          ],
        },
      };

    case 'appendix':
      return {
        intent: 'appendix',
        key_message: 'Disclaimers & Methodology',
        content: {
          type: 'appendix',
          title: isPl ? 'Zastrzeżenia i metodologia' : 'Disclaimers & Methodology',
          body: isPl
            ? 'Niniejsza prezentacja została wygenerowana automatycznie na bazie danych z platformy. Wszystkie liczby oparte na zadeklarowanych założeniach.'
            : 'This presentation was auto-generated from platform data. All figures are based on stated assumptions.',
        },
      };

    default:
      return {
        intent: item.intent,
        key_message: item.keyMessage || item.title,
        content: {
          type: 'section_intro',
          section_name: item.title,
          section_number: 0,
        } as any,
      };
  }
}

function buildSlideContent(
  item: OutlineItem,
  setup: DeckSetup,
  artifactData: Record<string, any>
): UnifiedSlide {
  const hasDataGapFallback = (item.suggestedBlocks || []).includes('data_gap_notice');
  const baseSlide = hasDataGapFallback
    ? ({
        intent: item.intent,
        key_message:
          setup.language === 'pl'
            ? `Data gap: ${item.title} wymaga dodatkowych źródeł`
            : `Data gap: ${item.title} requires additional evidence`,
        content: {
          type: 'section_intro',
          section_title: item.title,
          description:
            setup.language === 'pl'
              ? 'Ten slajd został wygenerowany w trybie degradacji: brak pełnych danych źródłowych. Uzupełnij evidence i właściciela danych.'
              : 'This slide is in degradation mode: complete source evidence is missing. Add evidence and data owner.',
        },
      } as UnifiedSlide)
    : buildSlideContentBase(item, setup, artifactData);
  const governed = attachSlideGovernance(baseSlide, item, setup);
  const keyMessage = polishDeckText(
    String(governed.key_message || item.title || item.intent),
    setup.language
  );
  return {
    ...governed,
    key_message:
      keyMessage.length >= 8
        ? keyMessage
        : polishDeckText(String(item.title || item.intent), setup.language),
    content: sanitizeSlideContentValue(governed.content, setup.language) as any,
  } as UnifiedSlide;
}

// ============================================================
// ARTIFACT DATA LOADER
// ============================================================

async function loadArtifactData(
  sources: SourceArtifact[],
  orgId: string
): Promise<Record<string, any>> {
  const data: Record<string, any> = {};

  try {
    const org = await dbGet(`SELECT name FROM organizations WHERE id = ?`, [orgId]);
    data._orgName = (org as any)?.name || 'Organization';
  } catch {
    data._orgName = 'Organization';
  }

  for (const source of sources) {
    try {
      switch (source.type) {
        case 'initiative_portfolio': {
          const initiatives = await dbAll(
            `SELECT id, name, status, priority, axis, progress, expected_roi FROM initiatives WHERE organization_id = ? AND status NOT IN ('CANCELLED', 'ARCHIVED') ORDER BY priority DESC LIMIT 20`,
            [orgId]
          );
          data._initiatives = ((initiatives || []) as any[]).map((i: any) => ({
            name: i.name,
            status: i.status,
            priority: i.priority,
            progress: i.progress || 0,
            roi: i.expected_roi,
          }));
          data._portfolioSummary = `${(initiatives as any[])?.length || 0} active initiatives`;
          break;
        }
        case 'kpi_roi': {
          const kpis = await dbAll(
            `SELECT name, unit, baseline_value, target_value, current_value FROM initiative_kpis WHERE organization_id = ? LIMIT 6`,
            [orgId]
          );
          data._performanceKpis = ((kpis || []) as any[]).map((k: any) => {
            const current = Number(k.current_value ?? 0);
            const target = Number(k.target_value ?? 0);
            const onTarget = target > 0 ? current >= target : current > 0;
            return {
              label: k.name,
              value: current || target || 0,
              target: k.target_value,
              unit: k.unit,
              trend: onTarget ? 'up' : 'down',
            };
          });
          data._kpis = data._performanceKpis?.slice(0, 4);
          break;
        }
        case 'raid': {
          const raidItems = await dbAll(
            `SELECT id, type, title, description, status, probability, impact, mitigation_plan, response_strategy, owner_id FROM raid_items WHERE organization_id = ? AND status NOT IN ('CLOSED', 'RESOLVED') ORDER BY impact DESC, probability DESC LIMIT 15`,
            [orgId]
          );
          data._risks = ((raidItems || []) as any[])
            .filter((r: any) => r.type === 'RISK')
            .map((r: any) => ({
              title: r.title,
              description: r.description,
              probability: r.probability || 'MEDIUM',
              impact: r.impact || 'MEDIUM',
              status: r.status,
              mitigation: r.mitigation_plan,
              strategy: r.response_strategy,
            }));
          data._raidSummary = {
            risks: ((raidItems || []) as any[]).filter((r: any) => r.type === 'RISK').length,
            assumptions: ((raidItems || []) as any[]).filter((r: any) => r.type === 'ASSUMPTION')
              .length,
            issues: ((raidItems || []) as any[]).filter((r: any) => r.type === 'ISSUE').length,
            dependencies: ((raidItems || []) as any[]).filter((r: any) => r.type === 'DEPENDENCY')
              .length,
          };
          break;
        }
        case 'execution_status': {
          const initiatives = await dbAll(
            `SELECT name, status, progress, start_date, target_end_date FROM initiatives WHERE organization_id = ? AND status IN ('IN_PROGRESS', 'ACTIVE', 'ON_TRACK', 'AT_RISK', 'DELAYED') ORDER BY target_end_date ASC LIMIT 20`,
            [orgId]
          );
          data._phases = [
            {
              name: 'In Progress',
              timeframe: 'Current',
              items: ((initiatives || []) as any[]).map((i: any) => ({
                name: i.name,
                status: i.status,
                progress: i.progress || 0,
                deadline: i.target_end_date,
              })),
            },
          ];
          data._executionSummary = `${((initiatives || []) as any[]).length} active initiatives`;
          break;
        }
        case 'tool_session': {
          if (source.id) {
            const session = await dbGet(
              `SELECT id, tool_type, name, answers_json FROM tool_sessions WHERE id = ? AND organization_id = ?`,
              [source.id, orgId]
            );
            if (session) {
              const answers = JSON.parse((session as any).answers_json || '{}');
              data._toolInsight = {
                tool: (session as any).tool_type,
                title: (session as any).name,
                findings: answers.findings || answers.insights || [],
                summary: answers.summary || answers.conclusion || '',
              };
              if (answers.key_findings) data._keyFindings = answers.key_findings;
              if (answers.recommendations) data._recommendation = answers.recommendations[0];
              if (answers.key_messages) data._keyMessages = answers.key_messages;
            }
          }
          break;
        }
        case 'assessment': {
          if (source.data?.reportId) {
            data._framework = source.data.framework || 'DRD';
            data._overallScore = source.data.overallScore || 0;
            data._maxScore = source.data.maxScore || 5;
            data._categories = source.data.categories || [];
          }
          break;
        }
        default:
          if (source.data) {
            Object.assign(data, source.data);
          }
      }
    } catch (err) {
      logger.warn(`[PresentationGen] Failed to load artifact ${source.type}: ${err}`);
    }
  }

  return data;
}

// ============================================================
// MAIN SERVICE
// ============================================================

function validateOutline(outline: OutlineItem[], setup: DeckSetup): string[] {
  const warnings: string[] = [];
  const isPl = setup.language === 'pl';
  const enabled = outline.filter((o) => o.enabled);

  if (enabled.length < 2) {
    warnings.push(
      isPl
        ? 'Outline wymaga minimum 2 kart (cover + content).'
        : 'Outline requires at least 2 cards (cover + content).'
    );
  }
  if (enabled.length > 30) {
    warnings.push(
      isPl
        ? `Outline ma ${enabled.length} kart (zalecane maks. 30). Rozważ podział na dwie prezentacje.`
        : `Outline has ${enabled.length} cards (recommended max 30). Consider splitting into two presentations.`
    );
  }

  const hasCover = enabled.some((o) => o.intent === 'cover');
  if (!hasCover) {
    warnings.push(
      isPl
        ? 'Brak karty tytułowej (cover). Dodaj ją dla profesjonalnego wyglądu.'
        : 'Missing cover card. Add one for a professional look.'
    );
  }

  const dataIntents: SlideIntent[] = [
    'performance_overview',
    'initiative_portfolio',
    'risk_management',
    'comparison',
    'assessment',
  ];
  const hasDataCard = enabled.some((o) => dataIntents.includes(o.intent));
  const hasDataSource = setup.sourceArtifacts.some((s) =>
    ['kpi_roi', 'initiative_portfolio', 'assessment', 'raid'].includes(s.type)
  );
  if (hasDataCard && !hasDataSource) {
    warnings.push(
      isPl
        ? 'Outline zawiera karty danych, ale nie wybrano źródeł danych. Dane mogą być niepełne.'
        : 'Outline contains data cards but no data sources are selected. Data may be incomplete.'
    );
  }

  const manualOrUnreadySources = setup.sourceArtifacts.filter(
    (source) => !source.id || source.id.startsWith('manual-') || source.readiness !== 'ready'
  );
  if (manualOrUnreadySources.length > 0) {
    warnings.push(
      isPl
        ? 'Część źródeł nie jest konkretnym, gotowym artefaktem. Deck zostanie oznaczony jako częściowo ugruntowany.'
        : 'Some sources are not concrete ready artifacts. The deck will be marked as partially grounded.'
    );
  }

  return warnings;
}

export async function generateOutline(
  setup: DeckSetup,
  organizationId: string
): Promise<{ outline: OutlineItem[]; deckId: string; validationWarnings: string[] }> {
  let outline: OutlineItem[];
  let templateOutlineUsed = false;
  let templateRuntime: PresentationTemplateRuntime | null = null;
  let templateWarnings: string[] = [];
  let templateSlotMapping: TemplateSlotMappingResult | null = null;
  const sourceArtifacts = Array.isArray(setup.sourceArtifacts) ? setup.sourceArtifacts : [];
  const sourcePackPreflight = preflightPresentationSourcePack({
    setup,
    organizationId,
    strict: Boolean(setup.sourcePackStrict),
  });

  if (setup.templateId) {
    const template = await dbGet(
      `SELECT * FROM presentation_templates WHERE id = ? AND is_active = TRUE AND (organization_id IS NULL OR organization_id = ?)`,
      [setup.templateId, organizationId]
    );
    const approvedTemplate = resolveApprovedPresentationTemplate(template);
    templateRuntime = approvedTemplate.runtime;
    const templateOutline = templateRuntime?.outline || [];
    outline = generateOutlineFromTemplate(templateOutline, sourceArtifacts);
    const templated = applyApprovedTemplateToOutline({
      outline,
      runtime: templateRuntime,
      sources: sourceArtifacts,
    });
    outline = templated.outline;
    templateSlotMapping = templated.slotMapping;
    templateWarnings = [...approvedTemplate.warnings, ...templated.warnings];
    templateOutlineUsed = true;
  } else {
    const requestedFamily = (setup as any).templateFamily || (setup as any).deckType;
    if (requestedFamily) {
      templateRuntime = buildSystemTemplateRuntime(requestedFamily);
      outline = templateRuntime.outline;
      const templated = applyTemplateRuntime({
        outline,
        runtime: templateRuntime,
        sources: sourceArtifacts,
      });
      outline = templated.outline;
      templateWarnings = templated.warnings;
      templateOutlineUsed = true;
    } else {
      outline = generateDefaultOutline(setup);
    }
  }

  const planning = planSlides({ setup, outline, templateOutlineUsed });
  outline = planning.outline;
  const narrativePlan = buildPresentationNarrativePlan({
    setup,
    outline,
    sourcePack: sourcePackPreflight.sourcePack,
  });

  const deckId = uuidv4().replace(/-/g, '');
  const resolvedSourceType =
    setup.sourceType || (sourceArtifacts[0]?.type === 'tool_session' ? 'tool' : 'manual');
  const resolvedSourceId = setup.sourceId || sourceArtifacts[0]?.id || null;
  // C7 — initiative linkage: when the deck's canonical source is an initiative
  // (sourceType 'INITIATIVE'/'initiative'), carry the id into the registry so
  // the initiative detail view can list this deck under "Artefakty".
  const resolvedSourceInitiativeId =
    resolvedSourceId && String(resolvedSourceType).toLowerCase() === 'initiative'
      ? String(resolvedSourceId)
      : null;
  await dbRun(
    `INSERT INTO presentation_decks (id, organization_id, title, template_id, deck_type, audience, goal, language, confidentiality, theme, brand_kit_id, source_artifacts, outline_json, status, generated_by, source_type, source_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    [
      deckId,
      organizationId,
      setup.title,
      setup.templateId || '',
      'custom',
      setup.audience,
      setup.goal,
      setup.language,
      setup.confidentiality,
      setup.theme,
      null,
      JSON.stringify(sourceArtifacts),
      JSON.stringify({
        deckIntentSummary: planning.deckIntentSummary,
        createMode: planning.createMode,
        templateRuntime: templateRuntime
          ? {
              templateId: templateRuntime.templateId,
              templateFamily: templateRuntime.templateFamily,
              minSlides: templateRuntime.minSlides,
              maxSlides: templateRuntime.maxSlides,
              mustHaveIntents: templateRuntime.mustHaveIntents,
              recommendedVisuals: templateRuntime.recommendedVisuals,
              sourceRequirements: templateRuntime.sourceRequirements,
              headerFooter: templateRuntime.headerFooter,
            }
          : null,
        templateSlotMapping,
        outline,
        slideRecipes: planning.slideRecipes,
        sourcePriorityMap: planning.sourcePriorityMap,
        evidenceGaps: planning.evidenceGaps,
        sourcePack: sourcePackPreflight.sourcePack,
        missingInputs: sourcePackPreflight.missingInputs,
        narrativePlan,
        warnings: [
          ...planning.warnings,
          ...templateWarnings,
          ...sourcePackPreflight.warnings,
          ...narrativePlan.warnings,
        ],
      }),
      null,
      resolvedSourceType,
      resolvedSourceId,
    ]
  );

  try {
    await artifactRegistryService.registerArtifactOrigin({
      organizationId,
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: deckId,
      titleSnapshot: setup.title,
      ownerUserId: null,
      createdBy: 'system',
      deliveryState: artifactRegistryService.mapPresentationStatusToDeliveryState('draft'),
      visibilityScope: artifactRegistryService.deriveArtifactVisibilityScope({
        outputType: 'presentation',
        ownerUserId: null,
      }),
      sourceInitiativeId: resolvedSourceInitiativeId,
      originSummary: {
        sourceType: resolvedSourceType,
        sourceId: resolvedSourceId,
        sourceArtifacts,
        nativeStatus: 'draft',
        sourceTable: 'presentation_decks',
      },
    });
  } catch (err) {
    await dbRun(`DELETE FROM presentation_decks WHERE id = ? AND organization_id = ?`, [
      deckId,
      organizationId,
    ]);
    throw err;
  }

  const validationWarnings = [
    ...validateOutline(outline, setup),
    ...planning.warnings,
    ...templateWarnings,
    ...sourcePackPreflight.warnings,
    ...narrativePlan.warnings,
  ];
  if (validationWarnings.length > 0) {
    await dbRun(
      `UPDATE presentation_decks SET validation_warnings = ? WHERE id = ? AND organization_id = ?`,
      [JSON.stringify(validationWarnings), deckId, organizationId]
    );
    logger.info(
      `[PresentationGen] Outline validation: ${validationWarnings.length} warning(s) for deck ${deckId}`
    );
  }

  return { outline, deckId, validationWarnings };
}

export async function generateDeck(
  deckId: string,
  outline: OutlineItem[],
  setup: DeckSetup,
  organizationId: string
): Promise<GenerationResult> {
  await dbRun(
    `UPDATE presentation_decks SET status = 'generating', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
    [deckId, organizationId]
  );

  await artifactRegistryService.registerArtifactOrigin({
    organizationId,
    outputType: 'presentation',
    artifactFamily: 'presentation',
    originRuntime: 'presentation',
    originRecordId: deckId,
    createdBy: 'system',
    deliveryState: artifactRegistryService.mapPresentationStatusToDeliveryState('generating'),
  });

  try {
    // Build structured ContextPack for AI consumption
    const sourceArtifacts = Array.isArray(setup.sourceArtifacts) ? setup.sourceArtifacts : [];
    const sourcePackPreflight = preflightPresentationSourcePack({
      setup,
      organizationId,
      strict: Boolean(setup.sourcePackStrict),
    });
    if (!sourcePackPreflight.ok) {
      throw new Error(
        `source_pack_preflight_failed: ${sourcePackPreflight.missingInputs.join(', ') || 'blocked sources'}`
      );
    }
    const narrativePlan = buildPresentationNarrativePlan({
      setup,
      outline,
      sourcePack: sourcePackPreflight.sourcePack,
    });
    const sourceRefs = sourceArtifacts.map((sa) => ({
      artifact_id: sa.artifactId || sa.id || '',
      artifact_type: sa.type,
      artifact_name: sa.label,
      confidence: sa.confidence ?? null,
      readiness: sa.readiness || 'ready',
      lineage: sa.lineage || null,
    }));
    const contextPack = await buildContextPack(organizationId, sourceRefs, setup.language);
    await saveContextPackSnapshot(deckId, contextPack);
    logger.info(
      `[PresentationGen] ContextPack built: ${contextPack.key_points.length} key points, ${contextPack.data_points.length} data points, confidence=${contextPack.metadata.confidence_score.toFixed(2)}`
    );

    let artifactData = await loadArtifactData(sourceArtifacts, organizationId);
    // Enrich artifact data with ContextPack extracted data
    if (contextPack.key_points.length > 0 && !artifactData._keyFindings) {
      artifactData._keyFindings = contextPack.key_points.slice(0, 5);
    }
    if (contextPack.data_points.length > 0 && !artifactData._kpis) {
      artifactData._kpis = contextPack.data_points.slice(0, 4).map((dp) => ({
        label: dp.label,
        value: dp.value,
        unit: dp.unit,
        trend: dp.trend,
      }));
    }
    const transformationPack = buildTransformationReadDeckPack({
      contextPack,
      artifactData,
      sources: sourceArtifacts,
      language: setup.language,
    });
    artifactData = applyTransformationPackToArtifactData(artifactData, transformationPack);

    const enabledSlides = outline.filter((o) => o.enabled);

    const slides: UnifiedSlide[] = enabledSlides.map((item) =>
      buildSlideContent(item, setup, artifactData)
    );

    let brandColor = setup.brandColor;
    if (!brandColor) {
      const brandKit = await dbGet(
        `SELECT primary_color FROM brand_kits WHERE organization_id = ?`,
        [organizationId]
      );
      if (brandKit) brandColor = (brandKit as any).primary_color;
    }

    const meta: UnifiedReportMeta = {
      client: artifactData._orgName || 'Organization',
      project: setup.title,
      date: new Date().toISOString().slice(0, 10),
      author: 'Consultify',
      confidentiality: setup.confidentiality,
      language: setup.language,
      brandColor,
      template: setup.theme,
    };

    const extraWarnings: string[] = [];

    // ------------------------------------------------------------
    // G4: Narrative Engine enrichment for text-heavy slides
    // ------------------------------------------------------------
    const narrativeIntents: SlideIntent[] = [
      'executive_summary',
      'key_messages',
      'next_steps',
      'recommendation_portfolio',
    ];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (!narrativeIntents.includes(slide.intent)) continue;
      try {
        const engineInput: NarrativeEngineInput = {
          context_pack: contextPack,
          organizationId,
          report_config: {
            report_type_v3: 'presentation',
            goal_v3: setup.goal,
            communication_register:
              setup.audience === 'sponsor' || setup.audience === 'executive'
                ? 'executive'
                : 'professional',
            density: 'concise',
            form: 'presentation',
            data_level: 'summary',
            language: setup.language,
          },
          section_key: slide.intent,
          section_type: slide.intent,
          section_title: slide.key_message || slide.intent,
          aiPurpose:
            slide.intent === 'executive_summary' || slide.intent === 'key_messages'
              ? 'presentation_slide_copy'
              : 'presentation_deck_outline',
        };
        const narrativeOutput = await generateNarrative(engineInput);
        if (narrativeOutput.post_check.passed && narrativeOutput.content) {
          // Narrative Engine emits inline `[Fact: <label>]` citation markers and
          // markdown headings by contract (linguisticRealization) — internal
          // provenance, not slide copy. Polish before the text reaches the
          // deck document / unified JSON.
          (slide as any)._narrative_enrichment = {
            content: polishDeckText(narrativeOutput.content, setup.language),
            facts_used: narrativeOutput.facts_used.length,
            observations_used: narrativeOutput.observations_used.length,
          };
          logger.info(
            `[PresentationGen] Narrative Engine enriched slide ${i} (${slide.intent}): ${narrativeOutput.content.length} chars`
          );
        }
      } catch (err) {
        logger.warn(`[PresentationGen] Narrative Engine skipped for slide ${i}: ${err}`);
      }
    }

    // ------------------------------------------------------------
    // Gamma-like visuals (best-effort)
    // ------------------------------------------------------------
    const visualsEnabled = setup.visuals?.enabled !== false; // default ON if caller doesn't specify
    const visualPriority = setup.visuals?.priority || 'quality';
    if (visualsEnabled && slides.length > 0) {
      const density: 'low' | 'medium' | 'high' =
        setup.visuals?.imageDensity || (visualPriority === 'quality' ? 'medium' : 'low');
      const maxImages =
        visualPriority === 'cost' ? 1 : density === 'high' ? 6 : density === 'medium' ? 3 : 1;

      // 1) Plan visuals — premium B1 Layout Director when flag ON (fail-open +
      // byte-identical to deterministic v1 when OFF, default for all clients).
      const tieredVisuals = await planDeckVisualsTiered({
        slides,
        meta,
        deckTitle: setup.title,
        audience: setup.audience,
        goal: setup.goal,
        brandColor,
        settings: {
          enabled: true,
          priority: visualPriority,
          imageDensity: density,
        },
        orgId: organizationId,
        preferPremium: true,
      });
      const plannedSlides = tieredVisuals.slides;
      // Apply planned visuals back into the slides array (in-place by index)
      for (let i = 0; i < slides.length; i++) slides[i] = plannedSlides[i];

      // 2) Materialize planned visuals up to maxImages (with VisionQA gate)
      let used = 0;
      for (let i = 0; i < slides.length && used < maxImages; i++) {
        const s = slides[i];
        const planned = s.visuals || [];
        if (!planned.length) continue;

        for (let j = 0; j < planned.length && used < maxImages; j++) {
          const v = planned[j];
          if (v?.asset?.path || v?.asset?.dataUri || v?.asset?.url) continue;

          const { visual, warning } = await materializePlannedVisual({
            deckId,
            organizationId,
            meta,
            visual: v,
            brandColor,
            priority: visualPriority,
            dataClass: 'no_pii',
          });
          if (warning) extraWarnings.push(warning);
          if (visual) {
            // Apply VisionQA gate on the generated image (best-effort)
            if (visual.asset?.path && visualPriority === 'quality') {
              try {
                const brandColors = brandColor ? [brandColor] : [];
                const qaResult = await qaGatedImageGeneration(
                  async (prompt: string) => {
                    const regen = await materializePlannedVisual({
                      deckId,
                      organizationId,
                      meta,
                      visual: { ...v, prompt },
                      brandColor,
                      priority: visualPriority,
                      dataClass: 'no_pii',
                    });
                    return regen.visual?.asset?.path || visual.asset?.path || '';
                  },
                  {
                    slideTitle: s.key_message || '',
                    slideIntent: s.intent,
                    brandPalette: brandColors,
                    imageStylePreset: v.styleHint || 'corporate',
                    originalPrompt: v.prompt || '',
                  }
                );
                if (qaResult.wasRegenerated) {
                  logger.info(
                    `[PresentationGen] VisionQA improved image for slide ${i}, QA score: ${qaResult.qaScore.toFixed(2)}`
                  );
                }
              } catch (qaErr) {
                logger.warn(`[PresentationGen] VisionQA gate failed, using original image`, {
                  qaErr,
                });
              }
            }
            planned[j] = visual;
            used++;
          }
        }

        s.visuals = planned;
      }
    }

    // ------------------------------------------------------------
    // Sprint S15: layout-audit pass on the assembled outline +
    // decorate the matching UnifiedSlides with their audit flags.
    // The PPTX renderer reads these flags and adds an inline review
    // marker, closing R-S13-4 — the rendered artifact now visibly
    // carries the same warnings the Studio canvas banner shows.
    //
    // Failure-mode safety: the audit is pure and dependency-free, but
    // we still wrap the call in try/catch so a transient logic error
    // never blocks deck generation. If the audit throws, we log and
    // continue with the un-decorated slides — the deck still ships,
    // it just lacks the review marker on this run.
    // ------------------------------------------------------------
    let auditedSlides: UnifiedSlide[] = slides;
    try {
      const templateFamily =
        ((setup as any).templateFamily as string | undefined) ||
        ((setup as any).deckType as string | undefined) ||
        null;
      const layoutAudit = auditPresentationStudioOutlineLayout(outline, {
        templateFamily,
        organizationId,
      });
      const decorated = decorateSlidesWithAuditFlags({
        outline,
        slides,
        audit: layoutAudit,
      });
      auditedSlides = decorated.slides;
      if (decorated.decoratedCount > 0) {
        logger.info(
          `[PresentationGen] Layout audit decorated ${decorated.decoratedCount} slide(s) with review markers`
        );
      }
    } catch (auditErr) {
      logger.warn(`[PresentationGen] Layout audit decoration failed (non-fatal)`, {
        auditErr,
      });
    }

    const unifiedJson: UnifiedReportJSON = { meta, slides: auditedSlides };
    const warnings = [...extraWarnings];

    // ------------------------------------------------------------
    // F1.4 — per-deck CONTENT GATE (placeholder scan on final slides).
    // The bundle pipeline (bundleGenerationRuntime) already runs this for
    // the premium 3-format bundle, but a standalone L1 deck never did — so
    // a "[PLACEHOLDER]" / "TBD" / "AWAITING CONTENT" leak could ship in a
    // solo deck unnoticed. We scan the assembled slide text (key_message +
    // content + narrative enrichment) and surface any hit as a warning the
    // Studio banner + PPTX review marker already know how to display.
    // Pure + fail-open (runBundleContentGate never throws); JSON.stringify
    // the discriminated-union content so every slide variant is covered
    // without hand-mapping 17 content shapes.
    // ------------------------------------------------------------
    try {
      const deckTextForGate = auditedSlides
        .map((s) => {
          const narrative = (s as { _narrative_enrichment?: { content?: string } })
            ._narrative_enrichment?.content;
          return [s.key_message, JSON.stringify(s.content ?? ''), narrative]
            .filter(Boolean)
            .join(' ');
        })
        .filter(Boolean)
        .join('\n');
      const contentGate = runBundleContentGate({ deckText: deckTextForGate });
      if (!contentGate.passed) {
        for (const issue of contentGate.issues) warnings.push(`content-gate: ${issue}`);
        logger.warn(
          `[PresentationGen] content-gate flagged ${contentGate.placeholderHits.length} placeholder(s) in deck ${deckId}`,
          { hits: contentGate.placeholderHits.slice(0, 3).map((h) => h.pattern) }
        );
      }
    } catch (gateErr) {
      logger.warn(`[PresentationGen] content-gate skipped (non-fatal)`, { gateErr });
    }

    // ──────────────────────────────────────────────────────────────
    // B2 (W4): PREMIUM layout variants — 3 distinct palette+intent
    // plans stored as bonus data on deckDocument.variants. Fail-open:
    // any error silently skips variant generation and ships the deck.
    // ──────────────────────────────────────────────────────────────
    let deckVariants: unknown[] | undefined;
    try {
      const tier = resolveDeliverableTier({ orgId: organizationId, preferPremium: true });
      if (tier === 'PREMIUM') {
        const variantsResult = await generateDeckVariants(auditedSlides, meta, {
          orgId: organizationId,
          preferPremium: true,
        });
        if (variantsResult.variants.length > 0) {
          deckVariants = variantsResult.variants as unknown[];
          logger.info('[PresentationGen] B2 deck variants generated', {
            count: deckVariants.length,
            tierUsed: variantsResult.tierUsed,
            fallbackUsed: variantsResult.fallbackUsed,
          });
        }
      }
    } catch (b2Err) {
      logger.warn('[PresentationGen] B2 deck variants failed (non-fatal), skipping', {
        err: (b2Err as Error)?.message,
      });
    }

    let deckDocument = deckDocumentFromUnifiedJson({
      deckId,
      organizationId,
      title: setup.title,
      unifiedJson,
      outline,
      setup: {
        audience: setup.audience,
        goal: setup.goal,
        language: setup.language,
        confidentiality: setup.confidentiality,
        theme: setup.theme,
        presentationMode: (setup as any).presentationMode,
        communicationRegister: (setup as any).communicationRegister,
        contentDepth: (setup as any).contentDepth,
        colorSetId: (setup as any).colorSetId,
        additionalInstructions: (setup as any).additionalInstructions,
        imageSource: setup.visuals?.enabled === false ? 'none' : 'smart',
        transformationReadDeckPack: transformationPack,
        sourcePack: sourcePackPreflight.sourcePack,
        sourcePackMissingInputs: sourcePackPreflight.missingInputs,
        narrativePlan,
      },
      sourceArtifacts,
      sourceRefs,
      status: 'ready',
      warnings: [...warnings, ...sourcePackPreflight.warnings, ...narrativePlan.warnings],
      createdBy: 'system',
    });
    deckDocument = applyBrandLayoutSystem(
      deckDocument,
      buildBrandLayoutSystem({
        brandColor,
        confidentiality: setup.confidentiality,
        templateFamily:
          (setup as any).templateFamily ||
          ((setup as any).presentationMode === 'document'
            ? 'Digital Transformation Read Deck'
            : 'Board Decision Deck'),
        footerText: setup.confidentiality === 'public' ? 'Consultify' : 'Confidential · Consultify',
      })
    );
    const pipeline = new PptxPipelineService();
    const result = await pipeline.generateFromUnifiedJson(unifiedJson, {
      template: setup.theme,
      language: setup.language,
      brandColor,
      confidentiality: setup.confidentiality,
      skipValidation: false,
    });

    const fs = await import('fs');
    const path = await import('path');
    const exportDir = path.default.join(process.cwd(), 'exports', 'presentations');
    if (!fs.default.existsSync(exportDir)) fs.default.mkdirSync(exportDir, { recursive: true });
    const exportPath = path.default.join(exportDir, `${deckId}.pptx`);
    fs.default.writeFileSync(exportPath, result.buffer);

    deckDocument.delivery = {
      exportFormat: 'pptx',
      exportPath,
    };
    deckDocument.lifecycle.exportedAt = new Date().toISOString();
    deckDocument.generation.warnings = [
      ...(result.warnings || []),
      ...warnings,
      ...sourcePackPreflight.warnings,
      ...narrativePlan.warnings,
    ];

    // B2: attach variants (additive — never replaces primary slides).
    if (deckVariants && deckVariants.length > 0) {
      deckDocument.variants = deckVariants;
    }

    let outlinePayload: unknown = outline;
    try {
      const existingDeck = (await dbGet(
        `SELECT outline_json FROM presentation_decks WHERE id = ? AND organization_id = ?`,
        [deckId, organizationId]
      )) as any;
      const parsedOutline = existingDeck?.outline_json
        ? JSON.parse(existingDeck.outline_json)
        : null;
      outlinePayload =
        parsedOutline && typeof parsedOutline === 'object' && !Array.isArray(parsedOutline)
          ? {
              ...parsedOutline,
              outline,
              generatedAt: new Date().toISOString(),
              sourcePack: sourcePackPreflight.sourcePack,
              missingInputs: sourcePackPreflight.missingInputs,
              narrativePlan,
            }
          : outline;
    } catch {
      outlinePayload = outline;
    }

    await dbRun(
      `UPDATE presentation_decks SET status = 'ready', deck_json = ?, unified_json = ?, slide_count = ?, export_path = ?, export_format = 'pptx', exported_at = CURRENT_TIMESTAMP, validation_warnings = ?, outline_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [
        JSON.stringify(deckDocument),
        JSON.stringify(unifiedJson),
        result.slideCount,
        exportPath,
        JSON.stringify(deckDocument.generation.warnings),
        JSON.stringify(outlinePayload),
        deckId,
        organizationId,
      ]
    );

    await artifactRegistryService.registerArtifactOrigin({
      organizationId,
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: deckId,
      createdBy: 'system',
      deliveryState: artifactRegistryService.mapPresentationStatusToDeliveryState('ready'),
      originSummary: {
        exportPath,
        exportFormat: 'pptx',
        slideCount: result.slideCount,
        nativeStatus: 'ready',
        sourceTable: 'presentation_decks',
      },
    });

    // Record deck generation in OrganizationStyleProfile for learning
    try {
      const totalBlocks = enabledSlides.length * 3; // approximate
      await recordDeckGeneration(organizationId, {
        mode: setup.theme || 'show',
        register: 'professional',
        imageStyle: setup.visuals?.imageDensity || 'medium',
        colorSet: setup.brandColor || 'default',
        contentDepth: 'balanced',
        cardCount: result.slideCount,
        totalBlocks,
      });
      logger.info(
        `[PresentationGen] Recorded deck generation to style profile for org=${organizationId}`
      );
    } catch (profileErr) {
      logger.warn('[PresentationGen] Failed to record to style profile', { profileErr });
    }

    return {
      deckId,
      slideCount: result.slideCount,
      warnings: [
        ...(result.warnings || []),
        ...extraWarnings,
        ...sourcePackPreflight.warnings,
        ...narrativePlan.warnings,
      ],
      exportPath,
    };
  } catch (err: any) {
    logger.error(`[PresentationGen] Generation failed for ${deckId}: ${err.message}`);
    await dbRun(
      `UPDATE presentation_decks SET status = 'failed', validation_warnings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [JSON.stringify([err.message]), deckId, organizationId]
    );
    await artifactRegistryService.registerArtifactOrigin({
      organizationId,
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: deckId,
      createdBy: 'system',
      deliveryState: artifactRegistryService.mapPresentationStatusToDeliveryState('failed'),
      originSummary: {
        nativeStatus: 'failed',
        lastError: err.message,
        sourceTable: 'presentation_decks',
      },
    });
    throw err;
  }
}

/**
 * R4 — Default set of intents whose copy is produced by the Narrative Engine.
 * Without an author instruction, only these slides are AI-rewritten (legacy
 * behaviour). With a free-text instruction the user can rewrite ANY slide, so
 * the gate is widened — see {@link shouldRunNarrativeRewrite}.
 */
export const NARRATIVE_REWRITE_INTENTS: SlideIntent[] = [
  'executive_summary',
  'key_messages',
  'next_steps',
  'recommendation_portfolio',
];

/**
 * R4 — Pure decision: should the per-slide narrative rewrite run for this
 * intent? A free-text instruction unlocks every slide; absent an instruction
 * we keep the historical narrative-only gate. Exported for unit testing.
 */
export function shouldRunNarrativeRewrite(
  intent: SlideIntent,
  instruction?: string
): boolean {
  const hasInstruction = typeof instruction === 'string' && instruction.trim().length > 0;
  if (hasInstruction) return true;
  return NARRATIVE_REWRITE_INTENTS.includes(intent);
}

export async function regenerateSlide(
  deckId: string,
  slideIndex: number,
  organizationId: string,
  opts?: { instruction?: string }
): Promise<{ slide: UnifiedSlide; card?: unknown }> {
  const instruction =
    typeof opts?.instruction === 'string' && opts.instruction.trim().length > 0
      ? opts.instruction.trim()
      : undefined;

  const deck = (await dbGet(
    `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
    [deckId, organizationId]
  )) as any;
  if (!deck) throw new Error('Deck not found');

  const unifiedJson: UnifiedReportJSON = JSON.parse(deck.unified_json);
  if (slideIndex < 0 || slideIndex >= unifiedJson.slides.length)
    throw new Error('Invalid slide index');

  const slide = unifiedJson.slides[slideIndex];

  // R4 — narrative path runs for the legacy text-heavy intents OR for ANY slide
  // when the author supplied a free-text rewrite instruction.
  if (shouldRunNarrativeRewrite(slide.intent, instruction)) {
    const contextPack = await getContextPackSnapshot(deckId);
    if (contextPack) {
      try {
        const language: 'en' | 'pl' = unifiedJson.meta?.language === 'pl' ? 'pl' : 'en';
        const narrativeOutput = await generateNarrative({
          context_pack: contextPack,
          organizationId,
          report_config: {
            report_type_v3: 'presentation',
            goal_v3: 'inform',
            communication_register: 'executive',
            density: 'concise',
            form: 'presentation',
            data_level: 'summary',
            language,
          },
          section_key: slide.intent,
          section_type: slide.intent,
          section_title: slide.key_message || slide.intent,
          aiPurpose: 'presentation_slide_copy',
          ...(instruction ? { user_instruction: instruction } : {}),
        });

        if (narrativeOutput.post_check.passed && narrativeOutput.content) {
          (slide as any)._narrative_enrichment = {
            content: polishDeckText(narrativeOutput.content, language),
            facts_used: narrativeOutput.facts_used.length,
            observations_used: narrativeOutput.observations_used.length,
            regenerated_at: new Date().toISOString(),
            ...(instruction ? { instruction } : {}),
          };
          unifiedJson.slides[slideIndex] = slide;
        }
      } catch (err) {
        // Fallback: AI unavailable / failed → keep the existing slide untouched
        // and let the caller persist the (surgically unchanged) deck. No throw.
        logger.warn(`[PresentationGen] Narrative Engine skipped for regenerateSlide: ${err}`);
      }
    }
  }

  // Rebuild deck_json from updated unified_json (surgical: just updates the affected card).
  const updatedDeckDocument = deckDocumentFromUnifiedJson({
    deckId,
    organizationId,
    title: unifiedJson.meta?.project || deck.title || '',
    unifiedJson,
    setup: { language: unifiedJson.meta?.language || 'en' },
  });

  await dbRun(
    `UPDATE presentation_decks SET unified_json = ?, deck_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
    [JSON.stringify(unifiedJson), JSON.stringify(updatedDeckDocument), deckId, organizationId]
  );

  // R4 — return the rebuilt FE-shaped card so the client can `updateCard()` in
  // place (preserves undo) instead of reloading the whole deck.
  const rebuiltCard = (updatedDeckDocument as any)?.cards?.[slideIndex];

  return { slide: unifiedJson.slides[slideIndex], card: rebuiltCard };
}
