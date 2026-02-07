/**
 * Report Generation Service
 *
 * AI-powered content generation for reports.
 * Uses assessment data, company context, and methodology to generate professional reports.
 */

import { v4 as uuidv4 } from 'uuid';

import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/index.js';
import logger from '../utils/Logger.js';
import ReportBuilderService, {
  ReportRecord,
  SectionLanguage,
  SectionLength,
  SectionRecord,
  SectionType,
} from './reportBuilderService.js';

// ==========================================
// TYPES
// ==========================================

interface GenerationContext {
  report: ReportRecord;
  section: SectionRecord;
  companyContext: Record<string, unknown>;
  sourceData: {
    assessment?: {
      type: string;
      name: string;
      scores: Record<string, unknown>;
      answers: Record<string, unknown>;
    };
    axisData?: Record<string, unknown>;
  };
  previousSections?: Array<{ key: string; content: string }>;
}

interface GenerationResult {
  content: string;
  tokensUsed: number;
  model: string;
}

// ==========================================
// DATABASE HELPERS
// ==========================================

const db: IDatabase = getDatabase();

function queryRun(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: { changes: number }, err: Error | null) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
}

function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: T | null) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

// ==========================================
// PROMPT TEMPLATES
// ==========================================

const LENGTH_GUIDANCE: Record<SectionLength, string> = {
  short: '200-400 words. Focus only on key points.',
  medium: '500-800 words. Balanced detail with clear structure.',
  long: '1000-1500 words. Comprehensive analysis with examples.',
};

const LANGUAGE_GUIDANCE: Record<SectionLanguage, string> = {
  technical:
    'Use technical terminology. Include specific metrics, systems, and implementation details. Target audience: IT/Engineering teams.',
  business:
    'Use executive-friendly language. Focus on strategic impact, ROI, and business outcomes. Target audience: C-level, management.',
  general: 'Use clear, accessible language. Avoid jargon. Target audience: All stakeholders.',
};

// Verbosity levels control the richness and detail of generated content
type VerbosityLevel = 'concise' | 'standard' | 'detailed' | 'comprehensive';

const VERBOSITY_GUIDANCE: Record<VerbosityLevel, string> = {
  concise:
    'Be concise and to the point. Every sentence should add value. Avoid repetition and filler words.',
  standard:
    'Use a balanced approach. Include necessary context and explanations without excessive detail.',
  detailed:
    'Provide thorough explanations with supporting details. Use multiple paragraphs to explore different aspects. Include context and background information.',
  comprehensive:
    'Maximize detail and depth. Use extensive explanations, multiple examples for each point, and thorough analysis. Include industry context, best practices references, and actionable insights. Each section should be exhaustive.',
};

// Writing style options
type WritingStyle = 'formal' | 'professional' | 'consultative' | 'persuasive';

const WRITING_STYLE_GUIDANCE: Record<WritingStyle, string> = {
  formal:
    'Use formal academic tone. Avoid contractions. Use passive voice where appropriate. Maintain objectivity.',
  professional: 'Use professional business tone. Clear and direct. Active voice. Results-focused.',
  consultative:
    'Use advisory tone. Frame content as expert recommendations. Include "we recommend", "consider", "based on our analysis".',
  persuasive:
    'Use persuasive tone to drive action. Emphasize benefits, urgency, and competitive advantage. Include strong calls to action.',
};

// Illustration preferences
type IllustrationLevel = 'minimal' | 'moderate' | 'extensive';

const ILLUSTRATION_GUIDANCE: Record<IllustrationLevel, string> = {
  minimal: 'Include examples only when essential for understanding. Focus on concepts.',
  moderate: 'Include relevant examples to illustrate key points. Balance theory with practice.',
  extensive:
    'Include multiple examples, case studies, and real-world scenarios for every major point. Use analogies and comparisons to make concepts relatable.',
};

/**
 * Build style guidance from report config
 * These settings control the overall "voice" and detail level of the generated content
 */
function buildStyleGuidance(config?: Record<string, unknown>): string {
  if (!config) return '';

  const guidance: string[] = [];

  // Verbosity level
  const verbosity = (config.verbosity as VerbosityLevel) || 'standard';
  if (VERBOSITY_GUIDANCE[verbosity]) {
    guidance.push(`VERBOSITY: ${VERBOSITY_GUIDANCE[verbosity]}`);
  }

  // Writing style
  const style = (config.writingStyle as WritingStyle) || 'professional';
  if (WRITING_STYLE_GUIDANCE[style]) {
    guidance.push(`STYLE: ${WRITING_STYLE_GUIDANCE[style]}`);
  }

  // Illustration level
  const illustration = (config.illustrationLevel as IllustrationLevel) || 'moderate';
  if (ILLUSTRATION_GUIDANCE[illustration]) {
    guidance.push(`EXAMPLES: ${ILLUSTRATION_GUIDANCE[illustration]}`);
  }

  // Custom focus areas
  if (config.focusAreas && typeof config.focusAreas === 'string') {
    guidance.push(`FOCUS: Pay special attention to: ${config.focusAreas}`);
  }

  // Custom tone/voice
  if (config.customTone && typeof config.customTone === 'string') {
    guidance.push(`TONE: ${config.customTone}`);
  }

  // Key messages to emphasize
  if (config.keyMessages && typeof config.keyMessages === 'string') {
    guidance.push(`KEY MESSAGES: Ensure these points are emphasized: ${config.keyMessages}`);
  }

  // Word usage preferences
  if (config.preferTechnicalTerms === true) {
    guidance.push('Use precise technical terminology where appropriate.');
  }
  if (config.useMetrics === true) {
    guidance.push(
      'Include specific metrics, percentages, and quantitative data wherever possible.'
    );
  }
  if (config.includeReferences === true) {
    guidance.push('Include references to industry standards, best practices, and methodologies.');
  }

  return guidance.length > 0 ? '\n\nSTYLE REQUIREMENTS:\n' + guidance.join('\n') : '';
}

/**
 * Build guidance string from block-specific settings
 * Translates frontend settings into AI-understandable instructions
 */
function buildSettingsGuidance(sectionType: string, settings: Record<string, unknown>): string {
  if (!settings || Object.keys(settings).length === 0) return '';

  const guidance: string[] = [];

  // Content settings
  if (settings.maxRecommendations !== undefined) {
    guidance.push(`- Include maximum ${settings.maxRecommendations} recommendations`);
  }
  if (settings.maxFindings !== undefined) {
    guidance.push(`- Include maximum ${settings.maxFindings} findings`);
  }
  if (settings.maxItems !== undefined) {
    guidance.push(`- Include maximum ${settings.maxItems} items`);
  }
  if (settings.maxItemsPerQuadrant !== undefined) {
    guidance.push(`- Include maximum ${settings.maxItemsPerQuadrant} items per quadrant`);
  }
  if (settings.maxLevels !== undefined) {
    guidance.push(`- Use maximum ${settings.maxLevels} levels of depth`);
  }
  if (settings.maxSteps !== undefined) {
    guidance.push(`- Include maximum ${settings.maxSteps} steps`);
  }
  if (settings.maxScenarios !== undefined) {
    guidance.push(`- Include maximum ${settings.maxScenarios} scenarios`);
  }
  if (settings.maxFactors !== undefined) {
    guidance.push(`- Include maximum ${settings.maxFactors} factors`);
  }
  if (settings.maxSubjects !== undefined) {
    guidance.push(`- Compare maximum ${settings.maxSubjects} subjects`);
  }
  if (settings.maxDimensions !== undefined) {
    guidance.push(`- Use maximum ${settings.maxDimensions} dimensions`);
  }
  if (settings.maxRows !== undefined) {
    guidance.push(`- Include maximum ${settings.maxRows} rows`);
  }

  // Prioritization
  if (settings.prioritization) {
    const priorityMap: Record<string, string> = {
      impact: 'Prioritize by business impact (highest impact first)',
      effort: 'Prioritize by effort required (lowest effort first)',
      quick_wins: 'Prioritize quick wins (high impact, low effort first)',
    };
    if (priorityMap[settings.prioritization as string]) {
      guidance.push(`- ${priorityMap[settings.prioritization as string]}`);
    }
  }

  // Analysis depth
  if (settings.analysisDepth) {
    const depthMap: Record<string, string> = {
      overview: 'Provide a high-level overview only',
      detailed: 'Provide detailed analysis with supporting evidence',
      comprehensive: 'Provide comprehensive analysis with all available details',
    };
    if (depthMap[settings.analysisDepth as string]) {
      guidance.push(`- ${depthMap[settings.analysisDepth as string]}`);
    }
  }

  // Time horizon
  if (settings.timeHorizon) {
    const horizonMap: Record<string, string> = {
      short: 'Focus on short-term actions (0-3 months)',
      medium: 'Focus on medium-term actions (3-12 months)',
      long: 'Focus on long-term strategic initiatives (12+ months)',
    };
    if (horizonMap[settings.timeHorizon as string]) {
      guidance.push(`- ${horizonMap[settings.timeHorizon as string]}`);
    }
  }

  // Grouping
  if (settings.groupBy) {
    guidance.push(`- Group items by ${settings.groupBy}`);
  }
  if (settings.sortBy) {
    guidance.push(`- Sort items by ${settings.sortBy}`);
  }

  // Boolean flags for content inclusion
  if (settings.includeKeyMetrics === true) {
    guidance.push('- Include key metrics and KPIs');
  }
  if (settings.includeComparisons === true) {
    guidance.push('- Include benchmark comparisons');
  }
  if (settings.highlightGaps === true) {
    guidance.push('- Highlight gaps between current and target state');
  }
  if (settings.includeTimeline === true) {
    guidance.push('- Include implementation timeline');
  }
  if (settings.includeOwners === true) {
    guidance.push('- Suggest responsible owners for each item');
  }
  if (settings.includeResources === true) {
    guidance.push('- Include resource requirements');
  }
  if (settings.includeMilestones === true) {
    guidance.push('- Include key milestones');
  }
  if (settings.includeRisks === true) {
    guidance.push('- Include associated risks');
  }
  if (settings.includeEvidence === true) {
    guidance.push('- Include supporting evidence for each finding');
  }
  if (settings.includeFramework === true) {
    guidance.push('- Describe the assessment framework used');
  }
  if (settings.includeDataSources === true) {
    guidance.push('- Describe data sources and collection methods');
  }
  if (settings.showCorrelations === true) {
    guidance.push('- Include strategic correlations (SO/WO/ST/WT)');
  }
  if (settings.showStrategies === true) {
    guidance.push('- Include strategic recommendations for each correlation');
  }
  if (settings.showTrends === true) {
    guidance.push('- Include trend indicators (increasing/stable/decreasing)');
  }
  if (settings.showDrivers === true) {
    guidance.push('- Include key drivers for each force/factor');
  }
  if (settings.showAttractiveness === true) {
    guidance.push('- Include overall industry attractiveness assessment');
  }
  if (settings.showImpact === true) {
    guidance.push('- Include impact assessment for each item');
  }
  if (settings.showRootCause === true) {
    guidance.push('- Clearly identify and highlight the root cause');
  }
  if (settings.showKaizen === true) {
    guidance.push('- Mark improvement opportunities (Kaizen points)');
  }
  if (settings.showEscalation === true) {
    guidance.push('- Include escalation matrix with thresholds');
  }
  if (settings.highlightCritical === true) {
    guidance.push('- Highlight critical items requiring immediate attention');
  }
  if (settings.highlightQuickWins === true) {
    guidance.push('- Highlight quick wins (high impact, low effort)');
  }
  if (settings.highlightOutOfControl === true) {
    guidance.push('- Highlight out-of-control data points');
  }

  // Style preferences
  if (settings.executiveStyle === true) {
    guidance.push('- Use executive summary style (concise, action-oriented)');
  }
  if (settings.compactMode === true) {
    guidance.push('- Use compact format with minimal descriptions');
  }

  // Output format
  if (settings.outputFormat) {
    const formatMap: Record<string, string> = {
      prose: 'Write in prose/paragraph format',
      bullets: 'Use bullet points throughout',
      mixed: 'Mix prose with bullet points as appropriate',
    };
    if (formatMap[settings.outputFormat as string]) {
      guidance.push(`- ${formatMap[settings.outputFormat as string]}`);
    }
  }

  // Layout preferences (for visual blocks)
  if (settings.orientation) {
    guidance.push(`- Use ${settings.orientation} orientation`);
  }
  if (settings.layout) {
    guidance.push(`- Use ${settings.layout} layout`);
  }
  if (settings.columns) {
    guidance.push(`- Organize into ${settings.columns} columns`);
  }
  if (settings.variant) {
    guidance.push(`- Use ${settings.variant} variant style`);
  }

  // Threshold settings
  if (settings.threshold !== undefined) {
    guidance.push(`- Use ${settings.threshold}% as the threshold`);
  }
  if (settings.gridSize) {
    guidance.push(`- Use ${settings.gridSize}x${settings.gridSize} grid`);
  }
  if (settings.levels) {
    guidance.push(`- Use ${settings.levels} maturity levels`);
  }

  // Axis labels for matrices
  if (settings.xAxisLabel) {
    guidance.push(`- X-axis represents: ${settings.xAxisLabel}`);
  }
  if (settings.yAxisLabel) {
    guidance.push(`- Y-axis represents: ${settings.yAxisLabel}`);
  }

  // Categories for fishbone
  if (settings.categories && typeof settings.categories === 'string') {
    guidance.push(`- Use these categories: ${settings.categories}`);
  }

  // Focus areas
  if (
    settings.focusAreas &&
    typeof settings.focusAreas === 'string' &&
    settings.focusAreas.trim()
  ) {
    guidance.push(`- Focus on these areas: ${settings.focusAreas}`);
  }

  return guidance.join('\n');
}

function getSectionPrompt(
  sectionType: SectionType,
  context: GenerationContext
): { system: string; user: string } {
  const { report, section, companyContext, sourceData } = context;
  const lengthGuidance = LENGTH_GUIDANCE[section.length];
  const languageGuidance = LANGUAGE_GUIDANCE[section.language];

  const companyName = (companyContext as any)?.organizationName || 'the organization';
  const assessmentType = sourceData.assessment?.type || 'DRD';
  const scores = sourceData.assessment?.scores || {};
  const answers = sourceData.assessment?.answers || {};

  // Block-specific settings from frontend
  const blockSettings = section.blockConfig || {};

  // Build settings guidance string from blockSettings
  const settingsGuidance = buildSettingsGuidance(sectionType, blockSettings);

  // Get report-level style settings from config
  const reportConfig = report.config || {};
  const styleGuidance = buildStyleGuidance(reportConfig);

  const baseSystem = `You are a senior management consultant creating a professional assessment report.
Write in ${section.language} style. ${languageGuidance}
Target length: ${lengthGuidance}
${section.customPrompt ? `\nAdditional guidance: ${section.customPrompt}` : ''}
${settingsGuidance ? `\nBlock-specific settings:\n${settingsGuidance}` : ''}
${styleGuidance}`;

  switch (sectionType) {
    case 'cover':
      return {
        system: baseSystem,
        user: `Generate cover page content for ${companyName}'s ${assessmentType} Assessment Report.
Include:
- Report title
- Company name: ${companyName}
- Assessment type: ${assessmentType}
- Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Format as structured JSON with fields: title, subtitle, companyName, date, assessmentType.`,
      };

    case 'summary':
      return {
        system: baseSystem,
        user: `Create an Executive Summary for ${companyName}'s ${assessmentType} digital maturity assessment.

Assessment Data:
${JSON.stringify(scores, null, 2)}

Company Context:
${JSON.stringify(companyContext, null, 2)}

The Executive Summary should:
1. Open with a clear statement of assessment purpose and scope
2. Highlight 3-5 key findings from the assessment
3. Summarize the overall maturity level and what it means
4. Present top strategic recommendations
5. Close with recommended next steps

Be specific with numbers and percentages. Reference actual scores.`,
      };

    case 'methodology':
      return {
        system: baseSystem,
        user: `Describe the ${assessmentType} assessment methodology used for ${companyName}.

${
  assessmentType === 'DRD'
    ? `
The Digital Readiness Diagnosis (DRD) framework consists of 7 axes:
1. Digital Processes - Process digitization and automation maturity
2. Digital Products - Digital product and service offerings
3. Digital Business Models - Revenue models and digital transformation
4. Data & Analytics - Data management and analytics capabilities
5. Organizational Culture - Digital culture and change readiness
6. Cybersecurity - Security posture and risk management
7. AI Maturity - AI adoption and capabilities

Each axis is scored on a scale of 1-7, where:
- Level 1-2: Initial/Basic - Manual, ad-hoc processes
- Level 3-4: Developing - Some standardization and digitization
- Level 5-6: Advanced - Integrated, data-driven operations
- Level 7: Optimized - Industry-leading, continuous innovation

The assessment evaluates ${companyName}'s current state (Actual) against target state (Target) to identify gaps.
`
    : `
The assessment framework evaluates digital maturity across multiple dimensions.
`
}

Explain the methodology, scoring approach, and how results should be interpreted.`,
      };

    case 'matrix':
      return {
        system: baseSystem,
        user: `Interpret the maturity matrix results for ${companyName}.

Assessment Scores:
${JSON.stringify(scores, null, 2)}

Provide:
1. Overall maturity level interpretation
2. Highest performing areas and why they matter
3. Lowest performing areas and their business impact
4. Key patterns or observations from the matrix
5. What the gap between current and target means strategically

Include specific numbers and comparisons. This section should help executives quickly understand where they stand.`,
      };

    case 'axis_analysis':
      const axisKey = section.repeatKey || '1';
      const axisData = (sourceData.axisData as any)?.[axisKey] || {};
      const axisName = section.title || `Axis ${axisKey}`;

      return {
        system: baseSystem,
        user: `Analyze the "${axisName}" axis of ${companyName}'s assessment in detail.

Axis Data:
${JSON.stringify(axisData, null, 2)}

For each area in this axis, provide:
1. **Current State**: What was observed/assessed
2. **Key Finding**: The main insight from this area
3. **Gap Analysis**: Difference between current and target (if applicable)
4. **Recommendation**: Specific action to improve

Structure the analysis by area. Be specific and actionable.
Include any evidence or justifications provided in the assessment.`,
      };

    case 'list':
      const isStrengths = section.sectionKey.includes('strength');

      return {
        system: baseSystem,
        user: `${isStrengths ? 'Identify the key STRENGTHS' : 'Identify the key AREAS FOR IMPROVEMENT'} for ${companyName} based on the assessment.

Assessment Data:
${JSON.stringify(scores, null, 2)}

${
  isStrengths
    ? `
List 5-8 strengths, focusing on:
- Areas with highest scores
- Competitive advantages
- Strong foundations for growth
- Quick wins and capabilities

For each strength, explain:
1. What it is
2. Why it matters strategically
3. How to leverage it further
`
    : `
List 5-8 areas for improvement, focusing on:
- Areas with lowest scores or biggest gaps
- Critical capabilities that are missing
- Blockers to transformation
- Urgent priorities

For each area, explain:
1. What the gap or issue is
2. Business impact of not addressing it
3. Initial steps to improve
`
}

Be constructive and specific. Reference actual assessment data.`,
      };

    case 'recommendations':
      return {
        system: baseSystem,
        user: `Generate strategic recommendations for ${companyName} based on the ${assessmentType} assessment.

Assessment Data:
${JSON.stringify(scores, null, 2)}

Company Context:
${JSON.stringify(companyContext, null, 2)}

Provide 5-10 strategic recommendations that:
1. Address the biggest gaps identified
2. Build on existing strengths
3. Are realistic given the company context
4. Have clear business value

For each recommendation, include:
- **Title**: Clear, action-oriented name
- **Priority**: High / Medium / Low
- **Description**: What needs to be done and why
- **Expected Outcome**: What success looks like
- **Timeline**: Immediate (0-3mo) / Short-term (3-6mo) / Long-term (6-12mo)
- **Dependencies**: What's needed to execute

Order by strategic importance.`,
      };

    case 'action_plan':
      return {
        system: baseSystem,
        user: `Create a concrete action plan / next steps for ${companyName} following the ${assessmentType} assessment.

Assessment Summary:
${JSON.stringify(scores, null, 2)}

Organize next steps by timeframe:

## Immediate Actions (Next 30 Days)
- Quick wins that build momentum
- Critical issues to address now
- Stakeholder alignment activities

## Short-Term Initiatives (1-3 Months)
- Foundation-building activities
- Key capability development
- Initial transformation projects

## Long-Term Roadmap (3-12 Months)
- Strategic transformation initiatives
- Major capability investments
- Organizational change programs

For each action, specify:
- What to do (specific and actionable)
- Who should own it
- What success looks like

Be practical and realistic.`,
      };

    case 'appendix':
      return {
        system: baseSystem,
        user: `Create appendix content for ${companyName}'s assessment report.

Include:
1. Detailed scoring table by axis and area
2. Methodology reference (brief)
3. Glossary of key terms
4. Data sources and evidence summary

Assessment Data:
${JSON.stringify(answers, null, 2)}

Format as structured sections with clear headers.`,
      };

    default:
      return {
        system: baseSystem,
        user: `Generate content for the "${section.title}" section of ${companyName}'s assessment report.

Assessment Data:
${JSON.stringify(scores, null, 2)}

Company Context:
${JSON.stringify(companyContext, null, 2)}

Create professional, insightful content appropriate for this section.`,
      };
  }
}

function interpolateTemplate(template: string, vars: Record<string, unknown>): string {
  const safe = (v: unknown) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  };
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) =>
    safe((vars as any)[key])
  );
}

// ==========================================
// AI GENERATION via LLM Service
// ==========================================

let _llmServiceInstance: any = null;

async function getLLMServiceInstance(): Promise<any> {
  if (_llmServiceInstance) return _llmServiceInstance;
  try {
    const mod = await import('./ai/llmService.js');
    _llmServiceInstance = mod.llmService || mod.default;
    return _llmServiceInstance;
  } catch (err) {
    logger.warn('[ReportGeneration] LLM Service not available, falling back to placeholder', err);
    return null;
  }
}

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<GenerationResult> {
  logger.info('[ReportGeneration] Generating content with AI...', {
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    maxTokens,
  });

  const llm = await getLLMServiceInstance();

  if (llm) {
    try {
      const result = await llm.call({
        type: 'text',
        modelConfig: { id: 'standard' },
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: maxTokens || 4096,
        temperature: 0.7,
        cache: true,
        cacheTtl: 7200,
      });

      const content = String(result?.content || '');
      const usage = (result?.usage || {}) as Record<string, number>;
      const tokensUsed =
        usage.totalTokens || usage.completionTokens || Math.floor(content.length / 4);
      const model = String(result?.model || result?.modelId || 'llm-standard');

      if (!content || content.length < 50) {
        logger.warn(
          '[ReportGeneration] LLM returned empty/short content, falling back to placeholder'
        );
        return {
          content: generatePlaceholderContent(userPrompt),
          tokensUsed: 0,
          model: 'placeholder-fallback',
        };
      }

      logger.info('[ReportGeneration] AI generation successful', {
        contentLength: content.length,
        tokensUsed,
        model,
      });

      return { content, tokensUsed, model };
    } catch (err: any) {
      logger.error(
        '[ReportGeneration] LLM call failed, falling back to placeholder:',
        err?.message || err
      );
      return {
        content: generatePlaceholderContent(userPrompt),
        tokensUsed: 0,
        model: 'placeholder-fallback',
      };
    }
  }

  // Fallback: generate placeholder content when LLM is not available
  logger.info('[ReportGeneration] Using placeholder content (no LLM available)');
  const content = generatePlaceholderContent(userPrompt);
  return {
    content,
    tokensUsed: 0,
    model: 'placeholder-v1',
  };
}

function generatePlaceholderContent(prompt: string): string {
  // Extract section type from prompt for context-aware placeholders
  const isExecutiveSummary = prompt.toLowerCase().includes('executive summary');
  const isMethodology = prompt.toLowerCase().includes('methodology');
  const isStrengths = prompt.toLowerCase().includes('strengths');
  const isWeaknesses =
    prompt.toLowerCase().includes('improvement') || prompt.toLowerCase().includes('weaknesses');
  const isRecommendations = prompt.toLowerCase().includes('recommendations');
  const isActionPlan =
    prompt.toLowerCase().includes('action plan') || prompt.toLowerCase().includes('next steps');
  const isAxisAnalysis =
    prompt.toLowerCase().includes('axis') && prompt.toLowerCase().includes('analyze');
  const isMatrix = prompt.toLowerCase().includes('matrix');

  if (isExecutiveSummary) {
    return `## Executive Summary

This assessment provides a comprehensive evaluation of the organization's digital maturity across key transformation dimensions.

### Key Findings

1. **Overall Maturity**: The organization demonstrates a developing level of digital maturity, with notable strengths in operational processes and clear opportunities in data analytics capabilities.

2. **Strengths Identified**: Strong foundation in process standardization and emerging capabilities in automation provide a solid base for digital transformation.

3. **Critical Gaps**: Data management and AI adoption represent the most significant gaps requiring strategic attention.

### Strategic Priorities

The assessment identifies three priority areas for immediate focus:
- Strengthening data infrastructure and governance
- Accelerating automation of key business processes
- Building AI/ML capabilities starting with high-value use cases

### Recommended Approach

A phased transformation approach is recommended, beginning with quick wins in process automation while laying the groundwork for more advanced analytics and AI capabilities.

---
*This content will be replaced with AI-generated analysis based on actual assessment data.*`;
  }

  if (isMethodology) {
    return `## Assessment Methodology

### Framework Overview

The Digital Readiness Diagnosis (DRD) is a comprehensive framework designed to evaluate an organization's digital maturity across seven critical dimensions of transformation.

### Evaluation Dimensions

1. **Digital Processes** - Automation, standardization, and optimization of business processes
2. **Digital Products** - Digital service offerings and product innovation capabilities
3. **Digital Business Models** - Revenue models and market positioning in digital economy
4. **Data & Analytics** - Data management, analytics maturity, and data-driven decision making
5. **Organizational Culture** - Change readiness, digital skills, and innovation culture
6. **Cybersecurity** - Security posture, risk management, and compliance
7. **AI Maturity** - AI/ML adoption, capabilities, and strategic use

### Scoring Approach

Each dimension is evaluated on a 1-7 scale:
- **Levels 1-2**: Initial - Manual, ad-hoc approaches
- **Levels 3-4**: Developing - Standardization emerging
- **Levels 5-6**: Advanced - Integrated, data-driven
- **Level 7**: Optimized - Industry-leading practices

### Gap Analysis

The assessment identifies gaps between current state (Actual) and desired future state (Target), enabling prioritized transformation planning.

---
*This methodology section will be customized based on the specific assessment framework used.*`;
  }

  if (isAxisAnalysis) {
    return `## Detailed Analysis

### Current State Assessment

The organization demonstrates varying levels of maturity across the assessed areas within this dimension.

### Area-by-Area Findings

#### Area 1: Foundation Capabilities
- **Current Level**: 3/7 (Developing)
- **Finding**: Basic capabilities are in place with room for standardization
- **Recommendation**: Implement standardized frameworks and governance

#### Area 2: Advanced Capabilities  
- **Current Level**: 2/7 (Initial)
- **Finding**: Limited adoption of advanced capabilities
- **Recommendation**: Develop pilot programs to build experience

#### Area 3: Integration & Optimization
- **Current Level**: 4/7 (Developing+)
- **Finding**: Good progress on integration, optimization opportunities remain
- **Recommendation**: Focus on end-to-end process optimization

### Key Observations

1. Strong foundation exists for further development
2. Quick wins available in standardization
3. Strategic investment needed for advanced capabilities

### Recommended Actions

1. Prioritize foundational improvements before advanced initiatives
2. Build internal capabilities through training and hiring
3. Consider strategic partnerships for accelerated transformation

---
*This analysis will be generated based on actual axis data from the assessment.*`;
  }

  if (isStrengths) {
    return `## Organizational Strengths

Based on the assessment results, the following strengths have been identified:

### 1. Process Foundation
Strong foundation in core process documentation and standardization provides a solid base for digital transformation.

### 2. Leadership Commitment
Clear executive sponsorship and commitment to digital transformation initiatives.

### 3. Technical Infrastructure
Modern technical infrastructure capable of supporting digital initiatives.

### 4. Operational Excellence
Demonstrated capability in operational efficiency and continuous improvement.

### 5. Customer Focus
Strong customer-centric culture with established feedback mechanisms.

### Leveraging Strengths

These strengths should be leveraged as:
- **Accelerators** for transformation initiatives
- **Proof points** for building organizational confidence
- **Foundations** for more advanced capabilities

---
*This section will highlight actual strengths identified in the assessment data.*`;
  }

  if (isWeaknesses) {
    return `## Areas for Improvement

The assessment identified the following areas requiring attention:

### 1. Data Management
**Gap**: Limited data governance and quality management practices
**Impact**: Constrains analytics capabilities and decision-making
**Priority**: High

### 2. Advanced Analytics
**Gap**: Basic reporting without predictive capabilities
**Impact**: Missed opportunities for proactive optimization
**Priority**: High

### 3. AI/ML Adoption
**Gap**: Minimal AI/ML implementation across operations
**Impact**: Competitive disadvantage in automation
**Priority**: Medium

### 4. Change Management
**Gap**: Informal change management practices
**Impact**: Slower adoption of new technologies
**Priority**: Medium

### 5. Integration Maturity
**Gap**: Siloed systems with manual data transfers
**Impact**: Inefficiency and data quality issues
**Priority**: High

### Addressing These Gaps

A structured approach to addressing these gaps should include:
1. Prioritization based on business impact
2. Phased implementation with quick wins
3. Capability building alongside technology investment

---
*This section will detail actual improvement areas from the assessment.*`;
  }

  if (isRecommendations) {
    return `## Strategic Recommendations

### 1. Data Foundation Program
**Priority**: High | **Timeline**: 0-6 months

Establish enterprise data governance and quality management to enable advanced analytics.

**Expected Outcome**: Trusted data foundation for decision-making
**Dependencies**: Executive sponsorship, dedicated resources

### 2. Process Automation Initiative
**Priority**: High | **Timeline**: 3-9 months

Implement RPA and workflow automation for high-volume, manual processes.

**Expected Outcome**: 30-40% efficiency gains in targeted processes
**Dependencies**: Process documentation, technology selection

### 3. Analytics Capability Development
**Priority**: Medium | **Timeline**: 6-12 months

Build internal analytics capabilities with focus on business-relevant use cases.

**Expected Outcome**: Data-driven decision making culture
**Dependencies**: Data foundation, skill development

### 4. AI/ML Pilot Program
**Priority**: Medium | **Timeline**: 6-12 months

Launch targeted AI pilots in high-value areas (e.g., predictive maintenance, demand forecasting).

**Expected Outcome**: Validated AI use cases for scaling
**Dependencies**: Data foundation, analytics capabilities

### 5. Digital Culture Transformation
**Priority**: Medium | **Timeline**: Ongoing

Foster digital-first mindset through training, change management, and incentive alignment.

**Expected Outcome**: Organization-wide digital adoption
**Dependencies**: Leadership commitment, HR partnership

---
*Recommendations will be tailored to actual assessment results and company context.*`;
  }

  if (isActionPlan) {
    return `## Next Steps & Action Plan

### Immediate Actions (Next 30 Days)

1. **Form Transformation Steering Committee**
   - Owner: CEO/CTO
   - Success: Committee established with clear mandate

2. **Quick Win: Process Documentation**
   - Owner: Operations Lead
   - Success: Top 10 processes documented

3. **Stakeholder Communication**
   - Owner: Change Management
   - Success: All stakeholders informed of transformation vision

### Short-Term Initiatives (1-3 Months)

1. **Data Governance Framework**
   - Define data ownership and quality standards
   - Establish data stewardship roles

2. **Automation Pilot Selection**
   - Identify 3-5 high-impact automation candidates
   - Develop business cases

3. **Skills Assessment & Training Plan**
   - Assess current digital skills
   - Develop training roadmap

### Long-Term Roadmap (3-12 Months)

1. **Enterprise Data Platform** (Q2-Q3)
   - Implement modern data infrastructure
   - Migrate priority data sources

2. **Automation Scaling** (Q3-Q4)
   - Scale successful pilots
   - Build automation CoE

3. **AI/ML Foundation** (Q4+)
   - Launch AI pilots
   - Build ML capabilities

### Success Metrics

- Process automation coverage: 50% of target processes
- Data quality score: >90%
- Employee digital skills: 80% trained

---
*Action plan will be customized based on assessment priorities and organizational context.*`;
  }

  if (isMatrix) {
    return `## Maturity Matrix Analysis

### Overall Assessment

The organization's digital maturity assessment reveals a mixed picture across the evaluated dimensions, with overall maturity at a **Developing** level.

### Dimension Scores Overview

| Dimension | Current | Target | Gap |
|-----------|---------|--------|-----|
| Digital Processes | 3.5 | 5.0 | 1.5 |
| Digital Products | 3.0 | 4.5 | 1.5 |
| Business Models | 2.5 | 4.0 | 1.5 |
| Data & Analytics | 2.0 | 5.0 | 3.0 |
| Culture | 3.5 | 5.0 | 1.5 |
| Cybersecurity | 4.0 | 5.0 | 1.0 |
| AI Maturity | 1.5 | 4.0 | 2.5 |

### Key Observations

1. **Highest Maturity**: Cybersecurity (4.0) - Strong security foundation
2. **Lowest Maturity**: AI Maturity (1.5) - Significant opportunity
3. **Largest Gap**: Data & Analytics (3.0) - Critical priority

### Strategic Implications

The maturity profile suggests a **foundation-first** approach:
1. Address data gaps before AI initiatives
2. Leverage strong security posture
3. Build on process strengths for automation

---
*Matrix visualization and detailed scores will be generated from actual assessment data.*`;
  }

  // Default content
  return `## ${prompt.includes('cover') ? 'Report Cover' : 'Section Content'}

This section will contain professionally written content based on the assessment data and company context.

### Key Points

- Comprehensive analysis based on assessment results
- Strategic insights tailored to organization
- Actionable recommendations

---
*This placeholder will be replaced with AI-generated content specific to this section.*`;
}

// ==========================================
// GENERATION SERVICE
// ==========================================

/**
 * Generate content for a single section.
 *
 * @param targetFormat — When 'pptx', uses pptx_prompt_template from block type
 *   to generate structured JSON instead of markdown. Default: 'markdown'.
 */
export async function generateSectionContent(
  reportId: string,
  sectionKey: string,
  organizationId: string,
  userId: string,
  targetFormat: 'markdown' | 'pptx' = 'markdown'
): Promise<{ content: string; tokensUsed: number }> {
  // Get report and section
  const reportData = await ReportBuilderService.getReport(reportId, organizationId);
  if (!reportData) throw new Error('Report not found');

  const section = reportData.sections.find((s) => s.sectionKey === sectionKey);
  if (!section) throw new Error('Section not found');

  // Get source data
  const sourceData = await ReportBuilderService.getSourceDataForReport(reportId, organizationId);
  if (!sourceData) throw new Error('Source data not found');

  // Build generation context
  const context: GenerationContext = {
    report: reportData.report,
    section,
    companyContext: reportData.report.companyContext || {},
    sourceData: {
      assessment: sourceData.assessment
        ? {
            type: sourceData.assessment.assessmentType,
            name: sourceData.assessment.name,
            scores: sourceData.assessment.scores,
            answers: sourceData.assessment.answers,
          }
        : undefined,
      axisData: sourceData.axesData,
    },
  };

  // Get prompts for this section type
  const prompts = getSectionPrompt(section.sectionType as SectionType, context);

  // If this is a user-defined block type (custom section with block_type_id),
  // prefer the block type prompt template over the generic "custom" prompt.
  // When targetFormat === 'pptx', use pptx_prompt_template for structured JSON output.
  if ((section as any).blockTypeId) {
    const bt = await queryOne<any>(
      `
      SELECT * FROM report_builder_block_types
      WHERE id = ? AND is_active = 1 AND (organization_id IS NULL OR organization_id = ?)
      LIMIT 1
    `,
      [(section as any).blockTypeId, organizationId]
    );

    // Select prompt: pptx_prompt_template for PPTX v2, regular prompt_template otherwise
    const promptTemplate: string | null | undefined =
      targetFormat === 'pptx' && bt?.pptx_prompt_template
        ? bt.pptx_prompt_template
        : bt?.prompt_template || null;

    if (promptTemplate) {
      const vars = {
        report: context.report,
        section: context.section,
        companyContext: context.companyContext,
        assessment: context.sourceData.assessment,
        axisData: context.sourceData.axisData,
        blockConfig: (section as any).blockConfig || null,
        facts: {
          company: context.companyContext,
          assessment: context.sourceData.assessment,
        },
      };
      prompts.user = interpolateTemplate(promptTemplate, vars);

      // For PPTX: also update system prompt to enforce JSON output
      if (targetFormat === 'pptx' && bt?.pptx_prompt_template) {
        prompts.system = `${prompts.system}\n\nIMPORTANT: You MUST return ONLY valid JSON. No markdown, no explanation, no code fences. Just the JSON object.`;
      }
    }
  } else if (targetFormat === 'pptx' && section.sectionType) {
    // Even without a blockTypeId, try to find a block type by sectionType
    // that has a pptx_prompt_template
    const bt = await queryOne<any>(
      `
      SELECT * FROM report_builder_block_types
      WHERE id = ? AND is_active = 1 AND pptx_prompt_template IS NOT NULL
      LIMIT 1
    `,
      [section.sectionType]
    );

    if (bt?.pptx_prompt_template) {
      const vars = {
        report: context.report,
        section: context.section,
        companyContext: context.companyContext,
        assessment: context.sourceData.assessment,
        axisData: context.sourceData.axisData,
        blockConfig: (section as any).blockConfig || null,
        facts: {
          company: context.companyContext,
          assessment: context.sourceData.assessment,
        },
      };
      prompts.user = interpolateTemplate(bt.pptx_prompt_template, vars);
      prompts.system = `${prompts.system}\n\nIMPORTANT: You MUST return ONLY valid JSON. No markdown, no explanation, no code fences. Just the JSON object.`;
    }
  }

  // Calculate max tokens based on length setting
  const maxTokens =
    {
      short: 500,
      medium: 1200,
      long: 2500,
    }[section.length] || 1200;

  // Special-case: matrix sections are deterministic visualizations derived from scores.
  if (section.sectionType === 'matrix') {
    const scores: any = (context.sourceData as any)?.assessment?.scores || {};
    const axes: any[] = Array.isArray(scores?.axes) ? scores.axes : [];
    const scaleMax =
      axes.length > 0
        ? Math.max(
            1,
            ...axes.map((a) => Number(a?.maxScore || a?.fullMark || a?.scaleMax || 7) || 7),
            7
          )
        : 7;

    const matrixData = {
      type: 'assessment_matrix',
      scaleMax,
      axes: axes.map((a) => ({
        axisId: String(a?.axisId || a?.id || ''),
        axisName: String(a?.axisName || a?.name || ''),
        score: Number(a?.score || 0),
        maxScore: Number(a?.maxScore || scaleMax),
        gap: a?.gap !== undefined ? Number(a.gap) : undefined,
      })),
    };

    const now = new Date().toISOString();
    const content = JSON.stringify(matrixData);

    await queryRun(
      `
      UPDATE report_builder_sections
      SET generated_content = ?, generated_at = ?, tokens_used = ?, generation_model = ?,
          source_data_snapshot = ?, content_format = ?, render_kind = ?, updated_at = ?
      WHERE report_id = ? AND section_key = ?
    `,
      [
        content,
        now,
        0,
        'deterministic-matrix-v1',
        JSON.stringify({ ...context.sourceData, matrixData }),
        'json',
        'matrix',
        now,
        reportId,
        sectionKey,
      ]
    );

    return { content, tokensUsed: 0 };
  }

  // Call AI
  const result = await callAI(prompts.system, prompts.user, maxTokens);

  // Save generated content
  const now = new Date().toISOString();
  await queryRun(
    `
    UPDATE report_builder_sections
    SET generated_content = ?, generated_at = ?, tokens_used = ?, generation_model = ?,
        source_data_snapshot = ?, updated_at = ?
    WHERE report_id = ? AND section_key = ?
  `,
    [
      result.content,
      now,
      result.tokensUsed,
      result.model,
      JSON.stringify(context.sourceData),
      now,
      reportId,
      sectionKey,
    ]
  );

  logger.info(`[ReportGeneration] Generated section ${sectionKey}`, {
    reportId,
    sectionKey,
    tokensUsed: result.tokensUsed,
  });

  return {
    content: result.content,
    tokensUsed: result.tokensUsed,
  };
}

/**
 * Generate all enabled sections for a report
 */
export async function generateFullReport(
  reportId: string,
  organizationId: string,
  userId: string,
  options?: { regenerateAll?: boolean; onProgress?: (progress: number, sectionKey: string) => void }
): Promise<{ totalTokens: number; generatedSections: string[] }> {
  logger.info('[ReportGeneration] generateFullReport START', { reportId, organizationId, userId });

  // Get report
  const reportData = await ReportBuilderService.getReport(reportId, organizationId);
  if (!reportData) {
    logger.error('[ReportGeneration] Report not found!', { reportId, organizationId });
    throw new Error('Report not found');
  }

  logger.info('[ReportGeneration] Report loaded, updating status to GENERATING', {
    reportId,
    sectionsCount: reportData.sections?.length,
  });

  // Update status to GENERATING
  await ReportBuilderService.updateReportStatus(reportId, 'GENERATING', userId);

  const enabledSections = reportData.sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const sectionsToGenerate = options?.regenerateAll
    ? enabledSections
    : enabledSections.filter((s) => !s.generatedContent);

  let totalTokens = 0;
  const generatedSections: string[] = [];

  for (let i = 0; i < sectionsToGenerate.length; i++) {
    const section = sectionsToGenerate[i];

    try {
      const result = await generateSectionContent(
        reportId,
        section.sectionKey,
        organizationId,
        userId
      );
      totalTokens += result.tokensUsed;
      generatedSections.push(section.sectionKey);

      // Report progress
      const progress = Math.round(((i + 1) / sectionsToGenerate.length) * 100);
      options?.onProgress?.(progress, section.sectionKey);
    } catch (err) {
      logger.error(`[ReportGeneration] Failed to generate section ${section.sectionKey}`, err);
      // Continue with other sections
    }
  }

  // Update status to GENERATED
  await ReportBuilderService.updateReportStatus(reportId, 'GENERATED', userId);

  // Save generation metadata
  await queryRun(
    `
    UPDATE report_builder_reports
    SET generation_metadata = ?, updated_at = ?
    WHERE id = ?
  `,
    [
      JSON.stringify({
        totalTokens,
        generatedSections,
        generatedAt: new Date().toISOString(),
      }),
      new Date().toISOString(),
      reportId,
    ]
  );

  logger.info(`[ReportGeneration] Full report generated`, {
    reportId,
    totalTokens,
    sectionsGenerated: generatedSections.length,
  });

  return { totalTokens, generatedSections };
}

/**
 * Regenerate a specific section
 */
export async function regenerateSection(
  reportId: string,
  sectionKey: string,
  organizationId: string,
  userId: string,
  customPrompt?: string
): Promise<{ content: string; tokensUsed: number }> {
  // Update custom prompt if provided
  if (customPrompt !== undefined) {
    await ReportBuilderService.updateSectionConfig(reportId, [
      {
        sectionKey,
        customPrompt,
      },
    ]);
  }

  return generateSectionContent(reportId, sectionKey, organizationId, userId);
}

// ==========================================
// ONE-CLICK REPORT GENERATION
// ==========================================

/**
 * Generate a complete report in one step.
 *
 * User flow:
 *   1. Select source (e.g. approved assessment) + optionally pick a template
 *   2. Call generateReport() — this creates the report structure from the
 *      template AND generates AI content for every enabled section.
 *   3. Receive the fully generated report ready for review/edit.
 *
 * Orchestrates:  createReport() → generateFullReport() → return result
 */
export async function generateReport(
  options: {
    reportType: string;
    sourceId: string;
    language?: string;
    templateId?: string;
    includeAppendix?: boolean;
  },
  organizationId: string
): Promise<{
  id: string;
  status: string;
  title?: string;
  sectionsGenerated?: number;
  totalTokens?: number;
}> {
  const { reportType, sourceId, language, templateId, includeAppendix } = options;
  logger.info('[ReportGeneration] generateReport — starting one-click generation', {
    reportType,
    sourceId,
    organizationId,
  });

  // ---------------------------------------------------------------
  // Step 1: Derive source type and framework from reportType
  //   Expected formats: "ASSESSMENT_DRD", "ASSESSMENT_SIRI", "ASSESSMENT", etc.
  // ---------------------------------------------------------------
  let sourceType: 'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE' = 'ASSESSMENT';
  if (reportType.startsWith('ASSESSMENT')) {
    sourceType = 'ASSESSMENT';
  } else if (reportType.startsWith('INTERVIEW')) {
    sourceType = 'INTERVIEW';
  } else if (reportType.startsWith('INITIATIVE')) {
    sourceType = 'INITIATIVE';
  }

  // ---------------------------------------------------------------
  // Step 2: Build report config from options
  // ---------------------------------------------------------------
  const config: Record<string, unknown> = {};
  if (language) config.language = language;
  if (includeAppendix !== undefined) config.includeAppendix = includeAppendix;

  // ---------------------------------------------------------------
  // Step 3: Create report structure from template
  //   This fetches the assessment data, validates status (APPROVED),
  //   picks the correct template, and creates report + section records.
  // ---------------------------------------------------------------
  const { report, sections } = await ReportBuilderService.createReport({
    organizationId,
    sourceType,
    sourceId,
    title: `${reportType} Report`,
    description: `Auto-generated ${reportType} report`,
    config,
    createdBy: 'system',
    templateId,
  });

  logger.info('[ReportGeneration] Report structure created', {
    reportId: report.id,
    sections: sections.length,
    sourceType,
    status: report.status,
  });

  // ---------------------------------------------------------------
  // Step 4: Move to DRAFT so generation can begin
  // ---------------------------------------------------------------
  await ReportBuilderService.updateReportStatus(report.id, 'DRAFT', 'system');

  // ---------------------------------------------------------------
  // Step 5: Generate AI content for all enabled sections
  // ---------------------------------------------------------------
  const result = await generateFullReport(report.id, organizationId, 'system');

  logger.info('[ReportGeneration] One-click generation complete', {
    reportId: report.id,
    totalTokens: result.totalTokens,
    sectionsGenerated: result.generatedSections.length,
  });

  return {
    id: report.id,
    status: 'GENERATED',
    title: report.title,
    sectionsGenerated: result.generatedSections.length,
    totalTokens: result.totalTokens,
  };
}

// ==========================================
// EXPORT TO FORMAT
// ==========================================

/**
 * Export a generated report to the requested format.
 *
 * Delegates to the existing PDF/DOCX/PPTX writers that are also used
 * by the report-builder routes directly.  The service layer version
 * creates a file + export record and returns the download URL.
 */
export async function exportReport(
  reportId: string,
  format: 'pdf' | 'pptx' | 'docx' | 'xlsx',
  userId: string
): Promise<{ url?: string; status: string; exportId?: string }> {
  logger.info('[ReportGeneration] exportReport', { reportId, format, userId });

  // Validate format
  const supportedFormats = ['pdf', 'docx', 'pptx'];
  if (!supportedFormats.includes(format)) {
    return {
      status: 'error',
      url: undefined,
      exportId: undefined,
    };
  }

  // The actual export logic lives in report-builder.routes.ts (writeReportBuilderPdf,
  // writeReportBuilderDocx, PptxExportService) because it uses heavy deps (pdfkit, docx).
  // From the service layer we return the export URL for the existing route-based endpoints.
  const exportUrl = `/api/report-builder/${reportId}/export/${format}`;

  return {
    status: 'ready',
    url: exportUrl,
    exportId: reportId,
  };
}

// ==========================================
// PUBLIC SHARING
// ==========================================

/**
 * Create a public share link for a report.
 *
 * Delegates to ReportBuilderService.createPublicLink() which handles
 * DB persistence, token generation, and optional password hashing.
 */
export async function createPublicLink(options: {
  reportId: string;
  reportType: string;
  organizationId: string;
  userId: string;
  password?: string;
  expiresInDays?: number;
  showCompanyLogo?: boolean;
  showConsultinityBranding?: boolean;
  customMessage?: string;
}): Promise<{ linkToken: string; url: string; expiresAt: string }> {
  logger.info('[ReportGeneration] createPublicLink', { reportId: options.reportId });

  // Calculate expiry date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (options.expiresInDays || 30));

  // Hash password if provided
  let passwordHash: string | undefined;
  if (options.password) {
    try {
      const bcryptMod = await import('bcryptjs');
      const bcryptLib = bcryptMod.default || bcryptMod;
      passwordHash = await bcryptLib.hash(options.password, 10);
    } catch {
      logger.warn('[ReportGeneration] bcrypt not available, storing password as-is');
      passwordHash = options.password;
    }
  }

  const link = await ReportBuilderService.createPublicLink({
    reportId: options.reportId,
    reportType: options.reportType,
    organizationId: options.organizationId,
    createdBy: options.userId,
    passwordHash,
    expiresAt: expiresAt.toISOString(),
    showCompanyLogo: options.showCompanyLogo,
    showConsultinityBranding: options.showConsultinityBranding,
    customMessage: options.customMessage,
  });

  return {
    linkToken: link.linkToken,
    url: `/api/reports/public/${link.linkToken}`,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Get a report via public link token.
 *
 * Validates token, checks expiry, verifies password if required,
 * then returns the full report with generated content.
 */
export async function getPublicReport(
  linkToken: string,
  password?: string
): Promise<{ report?: Record<string, unknown>; error?: string }> {
  logger.info('[ReportGeneration] getPublicReport', { linkToken, hasPassword: !!password });

  // Look up the link — returns { link, report, sections } or null
  const result = await ReportBuilderService.getPublicLinkByToken(linkToken);
  if (!result) {
    return { error: 'Link not found or expired' };
  }

  const { link, report: reportRecord, sections } = result;

  // Check expiry (double-check; getPublicLinkByToken already checks but we add safety)
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return { error: 'Link has expired' };
  }

  // Check revoked
  if (link.revokedAt) {
    return { error: 'Link has been revoked' };
  }

  // Check password
  if (link.passwordHash) {
    if (!password) {
      return { error: 'Password required' };
    }
    try {
      const bcryptMod = await import('bcryptjs');
      const bcryptLib = bcryptMod.default || bcryptMod;
      const isValid = await bcryptLib.compare(password, link.passwordHash);
      if (!isValid) {
        return { error: 'Invalid password' };
      }
    } catch {
      // Fallback: plain comparison
      if (password !== link.passwordHash) {
        return { error: 'Invalid password' };
      }
    }
  }

  // Return sanitized report data (no internal IDs, no org data)
  return {
    report: {
      id: reportRecord.id,
      title: reportRecord.title,
      description: reportRecord.description,
      sourceType: reportRecord.sourceType,
      sourceFramework: reportRecord.sourceFramework,
      status: reportRecord.status,
      createdAt: reportRecord.createdAt,
      companyContext: {
        organizationName: (reportRecord.companyContext as any)?.organizationName,
      },
      customMessage: link.customMessage,
      showCompanyLogo: link.showCompanyLogo,
      showConsultinityBranding: link.showConsultinityBranding,
      sections: sections
        .filter((s) => s.enabled)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((s) => ({
          key: s.sectionKey,
          type: s.sectionType,
          title: s.title,
          content: s.generatedContent || s.editedContent || '',
          renderKind: s.renderKind,
          contentFormat: s.contentFormat,
        })),
    },
  };
}

// ==========================================
// EXPORTS
// ==========================================

const ReportGenerationService = {
  generateSectionContent,
  generateFullReport,
  regenerateSection,
  generateReport,
  exportReport,
  createPublicLink,
  getPublicReport,
};

export default ReportGenerationService;
