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
import { buildContextPack, saveContextPackSnapshot } from './contextPackBuilder.js';
import { generateNarrative } from './narrativeEngine/index.js';
import type { NarrativeEngineInput } from './narrativeEngine/types.js';
import { recordDeckGeneration } from './organizationStyleProfileService.js';
import { qaGatedImageGeneration } from './presentationVisionQAService.js';
import { planDeckVisuals } from './presentationVisualDirectorService.js';
import { PptxPipelineService } from './report/pptx/PptxPipelineService.js';
import type {
  SlideIntent,
  UnifiedReportJSON,
  UnifiedReportMeta,
  UnifiedSlide,
} from './report/pptx/types.js';
import * as artifactRegistryService from './v8/artifactRegistryService.js';

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
    | 'custom';
  id?: string;
  label: string;
  data?: any;
}

export interface OutlineItem {
  intent: SlideIntent;
  title: string;
  keyMessage?: string;
  enabled: boolean;
  sourceRef?: string;
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

  return outline;
}

function generateDefaultOutline(setup: DeckSetup): OutlineItem[] {
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

  return items;
}

// ============================================================
// SLIDE CONTENT GENERATORS
// ============================================================

function buildSlideContent(
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
              body: isPl ? 'Do uzupełnienia' : 'To be populated from source data',
            },
            {
              title: isPl ? 'Wniosek 2' : 'Finding 2',
              body: isPl ? 'Do uzupełnienia' : 'To be populated from source data',
            },
            {
              title: isPl ? 'Wniosek 3' : 'Finding 3',
              body: isPl ? 'Do uzupełnienia' : 'To be populated from source data',
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
              name: isPl ? 'Faza 1: Quick Wins' : 'Phase 1: Quick Wins',
              timeframe: '0-3m',
              items: [],
            },
            {
              name: isPl ? 'Faza 2: Optymalizacja' : 'Phase 2: Optimization',
              timeframe: '3-6m',
              items: [],
            },
            { name: isPl ? 'Faza 3: Skalowanie' : 'Phase 3: Scale', timeframe: '6-12m', items: [] },
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
          risks: artifactData._risks || [],
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
              owner: 'TBD',
              deadline: 'TBD',
            },
            {
              action: isPl ? 'Zatwierdzić roadmapę' : 'Approve roadmap',
              owner: 'TBD',
              deadline: 'TBD',
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

  return warnings;
}

export async function generateOutline(
  setup: DeckSetup,
  organizationId: string
): Promise<{ outline: OutlineItem[]; deckId: string; validationWarnings: string[] }> {
  let outline: OutlineItem[];
  const sourceArtifacts = Array.isArray(setup.sourceArtifacts) ? setup.sourceArtifacts : [];

  if (setup.templateId) {
    const template = await dbGet(
      `SELECT outline_json FROM presentation_templates WHERE id = ? AND (organization_id IS NULL OR organization_id = ?)`,
      [setup.templateId, organizationId]
    );
    if (template) {
      const templateOutline = JSON.parse((template as any).outline_json).map((o: any) => ({
        intent: o.intent as SlideIntent,
        title: o.title,
        keyMessage: o.keyMessage,
        enabled: true,
      }));
      outline = generateOutlineFromTemplate(templateOutline, sourceArtifacts);
    } else {
      outline = generateDefaultOutline(setup);
    }
  } else {
    outline = generateDefaultOutline(setup);
  }

  const deckId = uuidv4().replace(/-/g, '');
  const resolvedSourceType =
    setup.sourceType || (sourceArtifacts[0]?.type === 'tool_session' ? 'tool' : 'manual');
  const resolvedSourceId = setup.sourceId || sourceArtifacts[0]?.id || null;
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
      JSON.stringify(outline),
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

  const validationWarnings = validateOutline(outline, setup);
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
    const sourceRefs = sourceArtifacts.map((sa) => ({
      artifact_id: sa.id || '',
      artifact_type: sa.type,
      artifact_name: sa.label,
    }));
    const contextPack = await buildContextPack(organizationId, sourceRefs, setup.language);
    await saveContextPackSnapshot(deckId, contextPack);
    logger.info(
      `[PresentationGen] ContextPack built: ${contextPack.key_points.length} key points, ${contextPack.data_points.length} data points, confidence=${contextPack.metadata.confidence_score.toFixed(2)}`
    );

    const artifactData = await loadArtifactData(sourceArtifacts, organizationId);
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
          (slide as any)._narrative_enrichment = {
            content: narrativeOutput.content,
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

      // 1) Plan visuals (deterministic v1)
      const plannedSlides = planDeckVisuals({
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
      });
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

    const unifiedJson: UnifiedReportJSON = { meta, slides };
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

    await dbRun(
      `UPDATE presentation_decks SET status = 'ready', unified_json = ?, slide_count = ?, export_path = ?, export_format = 'pptx', exported_at = CURRENT_TIMESTAMP, validation_warnings = ?, outline_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [
        JSON.stringify(unifiedJson),
        result.slideCount,
        exportPath,
        JSON.stringify([...(result.warnings || []), ...extraWarnings]),
        JSON.stringify(outline),
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
      warnings: [...(result.warnings || []), ...extraWarnings],
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

export async function regenerateSlide(
  deckId: string,
  slideIndex: number,
  organizationId: string
): Promise<{ slide: UnifiedSlide }> {
  const deck = (await dbGet(
    `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
    [deckId, organizationId]
  )) as any;
  if (!deck) throw new Error('Deck not found');

  const unifiedJson: UnifiedReportJSON = JSON.parse(deck.unified_json);
  if (slideIndex < 0 || slideIndex >= unifiedJson.slides.length)
    throw new Error('Invalid slide index');

  return { slide: unifiedJson.slides[slideIndex] };
}
