/**
 * Unified JSON Transformer
 *
 * Converts the existing Report Builder format {report, sections}
 * into the Unified Report JSON model required by the PPTX pipeline.
 *
 * This is the bridge between the legacy system and the new component model.
 * It handles:
 * 1. Report-level metadata extraction
 * 2. Per-section intent resolution
 * 3. Content structure transformation (markdown → structured JSON)
 * 4. Decision rules (auto-splitting, intent upgrades)
 */

import { inferIntentFromContent, resolveIntent } from './IntentResolver.js';
import { decideKpiIntent, decideRecommendationIntent } from './RulesEngine.js';
import type {
  AppendixContent,
  AssessmentContent,
  AxisScore,
  ComparisonContent,
  CoverContent,
  ExecutiveSummaryContent,
  InitiativePortfolioContent,
  KeyMessagesContent,
  KpiData,
  NextStepsContent,
  PerformanceOverviewContent,
  PrioritizationMatrixContent,
  RecommendationPortfolioContent,
  RecommendationSingleContent,
  RiskManagementContent,
  RoadmapContent,
  RootCauseContent,
  SectionIntroContent,
  SingleInsightContent,
  SlideContent,
  SlideIntent,
  UnifiedReportJSON,
  UnifiedReportMeta,
  UnifiedSlide,
} from './types.js';

// ============================================================
// MAIN TRANSFORMER
// ============================================================

interface ReportInput {
  report: {
    id: string;
    title: string;
    description?: string;
    sourceType: string;
    sourceFramework?: string;
    sourceName?: string;
    config?: Record<string, any>;
    companyContext?: Record<string, any>;
    createdAt: string;
    createdBy: string;
  };
  sections: Array<{
    sectionKey: string;
    sectionType: string;
    title: string;
    orderIndex: number;
    enabled: boolean;
    blockTypeId?: string;
    blockConfig?: Record<string, any>;
    renderKind?: string;
    generatedContent?: string;
    editedContent?: string;
    contentFormat?: string;
    repeatFor?: string;
    repeatKey?: string;
    repeatName?: string;
    repeatData?: string;
    /** Explicit slide intent from block type DB (migration 525) */
    slideIntent?: string;
  }>;
  scoreSummary?: {
    overall?: number;
    axes?: Record<string, { actual: number; target?: number; name?: string }>;
    dimensions?: Record<string, { current: number; target?: number }>;
  };
  organizationName?: string;
  projectName?: string;
}

export interface TransformOptions {
  language?: 'en' | 'pl';
  template?: 'corporate' | 'minimal' | 'modern';
  brandColor?: string;
  confidentiality?: 'confidential' | 'internal' | 'public';
  addCover?: boolean;
}

/**
 * Transform legacy report data into Unified Report JSON.
 */
export function transformToUnifiedJson(
  input: ReportInput,
  options: TransformOptions = {}
): UnifiedReportJSON {
  const { report, sections, scoreSummary } = input;
  const config = report.config || {};
  const lang = (options.language ?? config.language ?? 'pl') as 'en' | 'pl';

  // 1. Build meta
  const meta: UnifiedReportMeta = {
    client: input.organizationName || config.organizationName || 'Client',
    project: input.projectName || report.sourceName || report.title,
    date: new Date(report.createdAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    author: report.createdBy || 'Consultinity',
    confidentiality: options.confidentiality ?? 'confidential',
    framework: report.sourceFramework,
    sourceType: report.sourceType,
    language: lang,
    brandColor: options.brandColor,
    template: options.template ?? 'corporate',
  };

  // 2. Build slides
  const slides: UnifiedSlide[] = [];

  // Cover slide (auto-generated)
  if (options.addCover !== false) {
    slides.push(buildCoverSlide(report, meta));
  }

  // Process sections → slides
  const enabledSections = sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  for (const section of enabledSections) {
    const content = section.editedContent || section.generatedContent || '';
    if (!content.trim() && section.sectionType !== 'cover') continue;

    // Resolve intent: prefer explicit DB slide_intent > block type mapping > section type
    const intent = resolveIntent(section.sectionType, section.blockTypeId, section.slideIntent);

    // Try to parse content as structured JSON first (from pptx_prompt_template output)
    let directContent: SlideContent | null = null;
    try {
      const parsed = JSON.parse(content);
      if (parsed && parsed.type && typeof parsed.type === 'string') {
        // Content is already structured JSON matching our SlideContent shape — use directly
        directContent = parsed as SlideContent;
      }
    } catch {
      // Not JSON — will be parsed from markdown below
    }

    const slideContent =
      directContent || buildSlideContent(intent, section, content, scoreSummary, meta);

    if (slideContent) {
      // Auto-paginate initiative_portfolio slides (max 6 per slide)
      if (intent === 'initiative_portfolio' && 'initiatives' in slideContent) {
        const iContent = slideContent as InitiativePortfolioContent;
        const allInitiatives = iContent.initiatives || [];
        const PAGE_SIZE = 6;

        if (allInitiatives.length > PAGE_SIZE) {
          const pageCount = Math.ceil(allInitiatives.length / PAGE_SIZE);
          for (let page = 0; page < pageCount; page++) {
            const pageItems = allInitiatives.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
            const suffix = pageCount > 1 ? ` (${page + 1}/${pageCount})` : '';
            slides.push({
              intent,
              key_message: extractKeyMessage(section.title, content, intent) + suffix,
              content: {
                type: 'initiative_portfolio',
                initiatives: pageItems,
              } as InitiativePortfolioContent,
            });
          }
        } else {
          slides.push({
            intent,
            key_message: extractKeyMessage(section.title, content, intent),
            content: slideContent,
          });
        }
      } else {
        slides.push({
          intent,
          key_message: extractKeyMessage(section.title, content, intent),
          content: slideContent,
        });
      }
    }
  }

  // Auto-add score overview if present and no assessment slide exists
  if (scoreSummary && !slides.some((s) => s.intent === 'assessment')) {
    const assessmentSlide = buildAssessmentFromScore(scoreSummary, meta);
    if (assessmentSlide) {
      // Insert after executive summary or at position 2
      const insertIdx = slides.findIndex((s) => s.intent === 'executive_summary');
      slides.splice(
        insertIdx >= 0 ? insertIdx + 1 : Math.min(2, slides.length),
        0,
        assessmentSlide
      );
    }
  }

  return { meta, slides };
}

// ============================================================
// SLIDE BUILDERS
// ============================================================

function buildCoverSlide(report: ReportInput['report'], meta: UnifiedReportMeta): UnifiedSlide {
  return {
    intent: 'cover',
    key_message: report.title,
    content: {
      type: 'cover',
      title: report.title,
      subtitle: report.description || meta.framework || undefined,
      organization: meta.client,
      date: meta.date,
      confidentiality: meta.confidentiality,
    } as CoverContent,
  };
}

function buildSlideContent(
  intent: SlideIntent,
  section: ReportInput['sections'][0],
  rawContent: string,
  scoreSummary: ReportInput['scoreSummary'],
  meta: UnifiedReportMeta
): SlideContent | null {
  // Try to parse JSON content first
  let parsed: any = null;
  if (
    section.contentFormat === 'json' ||
    section.renderKind === 'json' ||
    section.renderKind === 'matrix' ||
    section.renderKind === 'initiatives'
  ) {
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Fall through to markdown parsing
    }
  }

  switch (intent) {
    case 'cover':
      return null; // Cover is auto-generated

    case 'executive_summary':
      return buildExecutiveSummary(section, rawContent, parsed);

    case 'section_intro':
      return {
        type: 'section_intro',
        section_title: section.title,
        section_number: section.orderIndex + 1,
        description: extractFirstParagraph(rawContent),
      } as SectionIntroContent;

    case 'key_messages':
      return buildKeyMessages(section, rawContent);

    case 'performance_overview':
      return buildPerformanceOverview(section, rawContent, parsed, scoreSummary);

    case 'single_insight':
      return buildSingleInsight(section, rawContent, parsed, scoreSummary);

    case 'comparison':
      return buildComparison(section, rawContent, parsed);

    case 'assessment':
      return buildAssessment(section, rawContent, parsed, scoreSummary);

    case 'root_cause':
      return buildRootCause(section, rawContent, parsed);

    case 'recommendation_single':
      return buildRecommendationSingle(section, rawContent, parsed);

    case 'recommendation_portfolio':
      return buildRecommendationPortfolio(section, rawContent, parsed);

    case 'initiative_portfolio':
      return buildInitiativePortfolio(section, rawContent, parsed);

    case 'prioritization_matrix':
      return buildPrioritizationMatrix(section, rawContent, parsed);

    case 'roadmap':
      return buildRoadmap(section, rawContent, parsed);

    case 'risk_management':
      return buildRiskManagement(section, rawContent, parsed);

    case 'next_steps':
      return buildNextSteps(section, rawContent, parsed);

    case 'appendix':
    default:
      return {
        type: 'appendix',
        title: section.title,
        body: cleanMarkdown(rawContent),
      } as AppendixContent;
  }
}

// ============================================================
// CONTENT BUILDERS
// ============================================================

function buildExecutiveSummary(
  section: ReportInput['sections'][0],
  rawContent: string,
  parsed: any
): ExecutiveSummaryContent {
  if (parsed && parsed.headline) {
    return {
      type: 'executive_summary',
      headline: parsed.headline,
      kpis: parsed.kpis || [],
      key_findings: parsed.key_findings || [],
      recommendation: parsed.recommendation,
    };
  }

  // Parse from markdown
  const lines = extractBulletPoints(rawContent);
  return {
    type: 'executive_summary',
    headline: section.title,
    key_findings: lines.slice(0, 5),
    recommendation: lines.length > 5 ? lines[5] : undefined,
  };
}

function buildKeyMessages(
  section: ReportInput['sections'][0],
  rawContent: string
): KeyMessagesContent {
  const bullets = extractBulletPoints(rawContent);
  return {
    type: 'key_messages',
    messages: bullets.slice(0, 4).map((b) => {
      const parts = b.split(':');
      return {
        title: parts[0]?.trim() || b,
        description: parts.slice(1).join(':').trim() || '',
      };
    }),
  };
}

function buildPerformanceOverview(
  section: ReportInput['sections'][0],
  rawContent: string,
  parsed: any,
  scoreSummary: ReportInput['scoreSummary']
): PerformanceOverviewContent {
  if (parsed && parsed.kpis) {
    return { type: 'performance_overview', kpis: parsed.kpis };
  }

  // Extract KPIs from score summary
  const kpis: KpiData[] = [];
  if (scoreSummary?.axes) {
    Object.entries(scoreSummary.axes).forEach(([key, val]) => {
      kpis.push({
        name: val.name || `Axis ${key}`,
        value: val.actual,
        target: val.target,
        trend: val.target ? (val.actual >= val.target ? 'up' : 'down') : undefined,
      });
    });
  }
  if (scoreSummary?.overall != null) {
    kpis.unshift({ name: 'Overall', value: scoreSummary.overall, unit: '/7' });
  }

  return { type: 'performance_overview', kpis: kpis.slice(0, 6) };
}

function buildSingleInsight(
  section: ReportInput['sections'][0],
  rawContent: string,
  parsed: any,
  scoreSummary: ReportInput['scoreSummary']
): SingleInsightContent {
  if (parsed && parsed.chart_data) {
    return {
      type: 'single_insight',
      chart_type: parsed.chart_type || 'bar',
      chart_data: parsed.chart_data,
      insight_text: parsed.insight_text || section.title,
    };
  }

  // Build chart from score summary axis data
  const labels: string[] = [];
  const values: number[] = [];
  if (scoreSummary?.axes) {
    Object.entries(scoreSummary.axes).forEach(([key, val]) => {
      labels.push(val.name || `Axis ${key}`);
      values.push(val.actual);
    });
  }

  return {
    type: 'single_insight',
    chart_type: 'bar',
    chart_data: {
      labels,
      series: [{ name: 'Score', values }],
    },
    insight_text: extractFirstParagraph(rawContent) || section.title,
  };
}

function buildComparison(
  section: ReportInput['sections'][0],
  rawContent: string,
  parsed: any
): ComparisonContent {
  if (parsed && parsed.left_items) {
    return { type: 'comparison', ...parsed };
  }

  // Heuristic: split content by "vs" or numbered sections
  const bullets = extractBulletPoints(rawContent);
  const mid = Math.ceil(bullets.length / 2);
  return {
    type: 'comparison',
    left_label: 'Current State',
    right_label: 'Target State',
    left_items: bullets.slice(0, mid),
    right_items: bullets.slice(mid),
  };
}

function buildAssessment(
  section: ReportInput['sections'][0],
  rawContent: string,
  parsed: any,
  scoreSummary: ReportInput['scoreSummary']
): AssessmentContent {
  if (parsed && parsed.type === 'assessment_matrix') {
    return {
      type: 'assessment',
      matrix_type: 'heatmap',
      axes: (parsed.axes || []).map((a: any) => ({
        axisId: a.axisId || a.id,
        axisName: a.axisName || a.name,
        score: a.score,
        maxScore: parsed.scaleMax || 7,
        target: a.target,
        gap: a.gap,
      })),
      scale_max: parsed.scaleMax || 7,
      overall_score: scoreSummary?.overall,
    };
  }

  // Build from score summary
  const axes: AxisScore[] = [];
  if (scoreSummary?.axes) {
    Object.entries(scoreSummary.axes).forEach(([key, val]) => {
      axes.push({
        axisId: key,
        axisName: val.name || `Axis ${key}`,
        score: val.actual,
        maxScore: 7,
        target: val.target,
        gap: val.target ? val.target - val.actual : undefined,
      });
    });
  }

  return {
    type: 'assessment',
    matrix_type: 'heatmap',
    axes,
    scale_max: 7,
    overall_score: scoreSummary?.overall,
  };
}

function buildRootCause(
  section: ReportInput['sections'][0],
  rawContent: string,
  parsed: any
): RootCauseContent {
  if (parsed && parsed.causes) {
    return { type: 'root_cause', problem: parsed.problem || section.title, causes: parsed.causes };
  }

  const bullets = extractBulletPoints(rawContent);
  return {
    type: 'root_cause',
    problem: section.title,
    causes: bullets.slice(0, 5).map((b) => ({
      cause: b,
      impact: 'To be assessed',
      severity: 'medium' as const,
    })),
  };
}

function buildRecommendationSingle(
  section: ReportInput['sections'][0],
  rawContent: string,
  parsed: any
): RecommendationSingleContent {
  if (parsed && parsed.title) {
    return {
      type: 'recommendation_single',
      title: parsed.title,
      description: parsed.description || '',
      impact: parsed.impact || 'To be assessed',
      effort: parsed.effort || 'To be assessed',
      priority: parsed.priority || 'medium',
      timeline: parsed.timeline,
    };
  }

  return {
    type: 'recommendation_single',
    title: section.title,
    description: extractFirstParagraph(rawContent),
    impact: 'To be assessed',
    effort: 'To be assessed',
    priority: 'high',
  };
}

function buildRecommendationPortfolio(
  section: ReportInput['sections'][0],
  rawContent: string,
  parsed: any
): RecommendationPortfolioContent {
  if (parsed && Array.isArray(parsed.recommendations)) {
    return { type: 'recommendation_portfolio', recommendations: parsed.recommendations };
  }
  if (parsed && Array.isArray(parsed)) {
    return {
      type: 'recommendation_portfolio',
      recommendations: parsed.map((r: any) => ({
        title: r.title || r.name || 'Recommendation',
        description: r.description || '',
        impact: r.impact || 'To be assessed',
        priority: r.priority || 'medium',
      })),
    };
  }

  const bullets = extractBulletPoints(rawContent);
  return {
    type: 'recommendation_portfolio',
    recommendations: bullets.slice(0, 8).map((b, i) => ({
      title: b,
      description: '',
      impact: 'To be assessed',
      priority: i < 3 ? ('high' as const) : ('medium' as const),
    })),
  };
}

function buildRoadmap(
  section: ReportInput['sections'][0],
  rawContent: string,
  parsed: any
): RoadmapContent {
  if (parsed && parsed.phases) {
    return { type: 'roadmap', phases: parsed.phases };
  }

  // Parse markdown for Now/Next/Later pattern
  const bullets = extractBulletPoints(rawContent);
  const third = Math.ceil(bullets.length / 3);
  return {
    type: 'roadmap',
    phases: [
      {
        label: 'Now',
        timeframe: '0–3 months',
        items: bullets.slice(0, third),
        status: 'in_progress' as const,
      },
      {
        label: 'Next',
        timeframe: '3–6 months',
        items: bullets.slice(third, third * 2),
        status: 'planned' as const,
      },
      {
        label: 'Later',
        timeframe: '6–12 months',
        items: bullets.slice(third * 2),
        status: 'planned' as const,
      },
    ],
  };
}

function buildRiskManagement(
  section: ReportInput['sections'][0],
  rawContent: string,
  parsed: any
): RiskManagementContent {
  if (parsed && parsed.risks) {
    return { type: 'risk_management', risks: parsed.risks };
  }

  const bullets = extractBulletPoints(rawContent);
  return {
    type: 'risk_management',
    risks: bullets.slice(0, 8).map((b) => ({
      risk: b,
      likelihood: 'medium' as const,
      impact: 'medium' as const,
      mitigation: 'To be defined',
    })),
  };
}

function buildNextSteps(
  section: ReportInput['sections'][0],
  rawContent: string,
  parsed: any
): NextStepsContent {
  if (parsed && parsed.actions) {
    return { type: 'next_steps', actions: parsed.actions, closing_message: parsed.closing_message };
  }

  const bullets = extractBulletPoints(rawContent);
  return {
    type: 'next_steps',
    actions: bullets.slice(0, 10).map((b) => ({
      action: b,
    })),
  };
}

// ============================================================
// INITIATIVE + PRIORITIZATION BUILDERS
// ============================================================

function buildInitiativePortfolio(
  section: ReportInput['sections'][0],
  rawContent: string,
  parsed: any
): InitiativePortfolioContent {
  // Direct structured JSON from AI
  if (
    parsed &&
    (parsed.type === 'initiatives' ||
      parsed.type === 'initiative_cards' ||
      parsed.type === 'initiative_portfolio')
  ) {
    return {
      type: 'initiative_portfolio',
      initiatives: (parsed.items || parsed.initiatives || []).map((item: any) => ({
        name: item.name || 'Unnamed Initiative',
        summary: item.summary || item.description,
        strategicIntent: item.strategicIntent,
        strategicRole: item.strategicRole,
        priority: item.priority,
        timeline: item.timeline,
        impact: typeof item.impact === 'number' ? item.impact : undefined,
        effort: typeof item.effort === 'number' ? item.effort : undefined,
        effortProfile: item.effortProfile,
        budget: item.budget,
        roi: item.roi,
        owner: item.owner,
        relatedGap: item.relatedGap,
        relatedAxis: item.relatedAxis,
        tags: item.tags,
      })),
    };
  }

  // If parsed is an array of initiatives
  if (parsed && Array.isArray(parsed)) {
    return {
      type: 'initiative_portfolio',
      initiatives: parsed.map((item: any) => ({
        name: item.name || 'Initiative',
        summary: item.summary,
        strategicIntent: item.strategicIntent,
        priority: item.priority || 'medium',
        impact: item.impact,
        effort: item.effort,
        timeline: item.timeline,
      })),
    };
  }

  // Fallback: parse from markdown bullet points
  const bullets = extractBulletPoints(rawContent);
  return {
    type: 'initiative_portfolio',
    initiatives: bullets.slice(0, 8).map((b, i) => ({
      name: b,
      priority: i < 3 ? ('high' as const) : ('medium' as const),
    })),
  };
}

function buildPrioritizationMatrix(
  section: ReportInput['sections'][0],
  rawContent: string,
  parsed: any
): PrioritizationMatrixContent {
  // Direct structured JSON
  if (parsed && parsed.quadrants) {
    return {
      type: 'prioritization_matrix',
      quadrants: parsed.quadrants,
      xAxisLabel: parsed.xAxisLabel || 'Effort',
      yAxisLabel: parsed.yAxisLabel || 'Impact',
    };
  }

  // Fallback: create empty matrix structure
  const bullets = extractBulletPoints(rawContent);
  const quarter = Math.ceil(bullets.length / 4);
  return {
    type: 'prioritization_matrix',
    quadrants: [
      {
        label: 'Quick Wins',
        position: 'top_left' as const,
        items: bullets.slice(0, quarter).map((b) => ({ name: b })),
      },
      {
        label: 'Major Projects',
        position: 'top_right' as const,
        items: bullets.slice(quarter, quarter * 2).map((b) => ({ name: b })),
      },
      {
        label: 'Fill-ins',
        position: 'bottom_left' as const,
        items: bullets.slice(quarter * 2, quarter * 3).map((b) => ({ name: b })),
      },
      {
        label: 'Reconsider',
        position: 'bottom_right' as const,
        items: bullets.slice(quarter * 3).map((b) => ({ name: b })),
      },
    ],
    xAxisLabel: 'Effort',
    yAxisLabel: 'Impact',
  };
}

// ============================================================
// HELPERS
// ============================================================

function buildAssessmentFromScore(
  scoreSummary: ReportInput['scoreSummary'],
  meta: UnifiedReportMeta
): UnifiedSlide | null {
  if (!scoreSummary?.axes || Object.keys(scoreSummary.axes).length === 0) return null;

  const axes: AxisScore[] = Object.entries(scoreSummary.axes).map(([key, val]) => ({
    axisId: key,
    axisName: val.name || `Axis ${key}`,
    score: val.actual,
    maxScore: 7,
    target: val.target,
    gap: val.target ? val.target - val.actual : undefined,
  }));

  return {
    intent: 'assessment',
    key_message: meta.language === 'pl' ? 'Ocena Dojrzałości' : 'Maturity Assessment',
    content: {
      type: 'assessment',
      matrix_type: 'heatmap',
      axes,
      scale_max: 7,
      overall_score: scoreSummary.overall,
    } as AssessmentContent,
  };
}

function extractKeyMessage(title: string, content: string, intent: SlideIntent): string {
  // Use title as key message, trimmed to 14 words
  const words = title.split(/\s+/).slice(0, 14);
  return words.join(' ');
}

function extractBulletPoints(markdown: string): string[] {
  return markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.match(/^[-•*]\s/) || l.match(/^\d+\.\s/))
    .map((l) =>
      l
        .replace(/^[-•*]\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .trim()
    )
    .filter((l) => l.length > 0);
}

function extractFirstParagraph(markdown: string): string {
  const cleaned = cleanMarkdown(markdown);
  const paras = cleaned.split('\n\n').filter((p) => p.trim().length > 0);
  return paras[0]?.trim() || '';
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/>\s/g, '')
    .trim();
}
