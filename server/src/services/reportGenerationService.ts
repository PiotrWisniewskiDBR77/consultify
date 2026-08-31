/**
 * Report Generation Service
 *
 * AI-powered content generation for reports.
 * Uses assessment data, company context, and methodology to generate professional reports.
 */

import { v4 as uuidv4 } from 'uuid';

import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/index.js';
import { AppError } from '../utils/ErrorHandler.js';
import logger from '../utils/Logger.js';
import modelRouter from './ai/modelRouter.js';
import { buildContextPack, saveContextPackSnapshot, type SourceRef } from './contextPackBuilder.js';
import {
  generateNarrative,
  type NarrativeEngineInput,
  type NarrativeEngineOutput,
} from './narrativeEngine/index.js';
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

  // ── REQ-1: Block Blueprint Settings ──

  // Content Instructions (detailed instructions for what to include)
  if (
    settings.contentInstructions &&
    typeof settings.contentInstructions === 'string' &&
    settings.contentInstructions.trim()
  ) {
    guidance.push(`\nCONTENT BLUEPRINT (follow strictly):\n${settings.contentInstructions.trim()}`);
  }

  // Required Sub-sections
  if (
    settings.requiredSectionsList &&
    typeof settings.requiredSectionsList === 'string' &&
    settings.requiredSectionsList.trim()
  ) {
    const subSections = settings.requiredSectionsList.trim().split('\n').filter(Boolean);
    if (subSections.length > 0) {
      guidance.push(`\nREQUIRED SUB-SECTIONS (include all of these):`);
      subSections.forEach((s, i) => {
        guidance.push(`  ${i + 1}. ${s.trim()}`);
      });
    }
  }

  // Output structure
  if (settings.outputStructure && settings.outputStructure !== 'auto') {
    const structureMap: Record<string, string> = {
      narrative:
        'Write in a flowing narrative style with natural transitions between points. Use paragraphs, not lists.',
      structured:
        'Use a clearly structured format with numbered sections, headers, and organized sub-points.',
      data_driven:
        'Lead with data and numbers. Every claim must reference a specific metric, score, or percentage. Use tables where appropriate.',
    };
    if (structureMap[settings.outputStructure as string]) {
      guidance.push(`- OUTPUT STRUCTURE: ${structureMap[settings.outputStructure as string]}`);
    }
  }

  // Min/Max items count
  if (settings.minItemsCount !== undefined) {
    guidance.push(`- Include at least ${settings.minItemsCount} items/points/findings`);
  }
  if (settings.maxItemsCount !== undefined) {
    guidance.push(`- Include no more than ${settings.maxItemsCount} items/points/findings`);
  }

  // Require data references
  if (settings.requireDataReferences === true) {
    guidance.push(
      '- MANDATORY: Every finding or recommendation MUST cite specific scores, percentages, or data points from the assessment. No unsupported claims.'
    );
  }

  // Require actionable conclusions
  if (settings.requireActionable === true) {
    guidance.push(
      '- MANDATORY: Each section MUST end with concrete, actionable next steps. Avoid vague conclusions.'
    );
  }

  // Forbidden topics
  if (
    settings.forbiddenTopics &&
    typeof settings.forbiddenTopics === 'string' &&
    settings.forbiddenTopics.trim()
  ) {
    guidance.push(`- DO NOT discuss these topics: ${settings.forbiddenTopics.trim()}`);
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

  // Extract sourceContext from blockConfig (stored as _sourceContext by frontend)
  const sourceContext = (blockSettings as any)._sourceContext || '';

  // Build settings guidance string from blockSettings
  const settingsGuidance = buildSettingsGuidance(sectionType, blockSettings);

  // Get report-level style settings from config
  const reportConfig = report.config || {};
  const styleGuidance = buildStyleGuidance(reportConfig);
  const outputLanguage =
    String((reportConfig as any)?.language || 'en').toLowerCase() === 'pl' ? 'Polish' : 'English';

  const baseSystem = `You are a senior management consultant creating a professional assessment report.
Output language: ${outputLanguage}.
Write in ${section.language} style. ${languageGuidance}
Target length: ${lengthGuidance}
${section.customPrompt ? `\nAdditional guidance: ${section.customPrompt}` : ''}
${sourceContext ? `\nUser-provided source data and context:\n${sourceContext}` : ''}
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
- Date: ${new Date().toLocaleDateString(
          String((reportConfig as any)?.language || '').toLowerCase() === 'pl' ? 'pl-PL' : 'en-US',
          { year: 'numeric', month: 'long', day: 'numeric' }
        )}

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

    case 'initiatives':
      return {
        system: `${baseSystem}\n\nIMPORTANT: You MUST return ONLY valid JSON. No markdown, no explanation, no code fences. Just the JSON object.`,
        user: `Generate a structured set of digital transformation initiatives for ${companyName} based on the ${assessmentType} assessment.

Assessment Data:
${JSON.stringify(scores, null, 2)}

Company Context:
${JSON.stringify(companyContext, null, 2)}

Return a JSON object in this EXACT format:
{
  "type": "initiatives",
  "title": "Recommended Initiatives Portfolio",
  "items": [
    {
      "name": "Initiative name (concise, actionable)",
      "summary": "1-2 sentence description of what this initiative does and why",
      "strategicIntent": "Grow" | "Fix" | "Stabilize" | "De-risk" | "Build Capability",
      "strategicRole": "Foundation" | "Enabler" | "Accelerator" | "Scaling",
      "priority": "high" | "medium" | "low",
      "timeline": "e.g. 0-3 months, 3-6 months, 6-12 months",
      "budget": "e.g. $50k, $100k-200k",
      "roi": "e.g. 3x, 5-8x",
      "impact": 1-5 (number),
      "effort": 1-5 (number),
      "effortProfile": { "analytical": 1-5, "operational": 1-5, "change": 1-5 },
      "owner": "Suggested owner role",
      "relatedGap": "The specific gap from assessment this addresses",
      "relatedAxis": "Assessment axis this relates to",
      "tags": ["tag1", "tag2"],
      "problemStatement": "The core problem this initiative solves"
    }
  ]
}

Guidelines:
- Generate ${(section.blockConfig as any)?.maxItems || 6}-${((section.blockConfig as any)?.maxItems || 6) + 4} initiatives
- Each initiative must directly relate to assessment findings
- Include a mix of strategic intents (Grow/Fix/Stabilize/De-risk/Build Capability)
- Include a mix of strategic roles (Foundation/Enabler/Accelerator/Scaling)
- Cover different time horizons (short/medium/long)
- Be specific about gaps and axes from the actual assessment data
- Ensure initiatives are realistic and actionable for the organization
${(section.blockConfig as any)?.prioritization === 'quick_wins' ? '- Focus on quick wins: high impact, low effort items' : ''}
${(section.blockConfig as any)?.groupBy === 'axis' ? '- Group related initiatives by assessment axis' : ''}
${(section.blockConfig as any)?.groupBy === 'intent' ? '- Group related initiatives by strategic intent' : ''}

CRITICAL: Return ONLY valid JSON. No markdown formatting, no code fences, no explanations.`,
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
    logger.warn('[ReportGeneration] LLM Service not available', err);
    return null;
  }
}

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  options?: { purpose?: string; organizationId?: string; tier?: string }
): Promise<GenerationResult> {
  logger.info('[ReportGeneration] Generating content with AI...', {
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    maxTokens,
  });

  const llm = await getLLMServiceInstance();

  if (!llm) {
    throw new AppError(
      'AI report generation is not available (LLM not configured)',
      503,
      'FEATURE_UNAVAILABLE'
    );
  }

  try {
    const modelCfg = await modelRouter.select({
      capability: 'report_section',
      purpose: options?.purpose || 'report_section_draft',
      organizationId: options?.organizationId,
      tier: options?.tier,
    });
    const result = await llm.call({
      type: 'text',
      modelConfig: {
        provider: modelCfg.provider,
        id: modelCfg.id,
        endpoint: modelCfg.endpoint || undefined,
        apiKey: modelCfg.apiKey || undefined,
      },
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
      throw new AppError('AI report generation returned empty content', 503, 'FEATURE_UNAVAILABLE');
    }

    logger.info('[ReportGeneration] AI generation successful', {
      contentLength: content.length,
      tokensUsed,
      model,
    });

    return { content, tokensUsed, model };
  } catch (err: unknown) {
    const msg = (err as Error)?.message || String(err);
    logger.error('[ReportGeneration] LLM call failed:', msg);
    if (err instanceof AppError) throw err;
    throw new AppError('AI report generation failed', 503, 'FEATURE_UNAVAILABLE', { message: msg });
  }
}

// ==========================================
// V3 NARRATIVE ENGINE BRIDGE
// ==========================================

async function generateSectionViaNarrativeEngine(
  report: ReportRecord,
  section: SectionRecord,
  organizationId: string,
  context: GenerationContext
): Promise<NarrativeEngineOutput | null> {
  const sourceRefs: SourceRef[] = [];
  if (section.sourceRefs) {
    try {
      const refs = Array.isArray(section.sourceRefs)
        ? section.sourceRefs
        : JSON.parse(section.sourceRefs as unknown as string);
      if (Array.isArray(refs)) sourceRefs.push(...refs);
    } catch {
      /* skip */
    }
  }
  if (report.sourceRefs) {
    try {
      const refs = Array.isArray(report.sourceRefs)
        ? report.sourceRefs
        : JSON.parse(report.sourceRefs as unknown as string);
      if (Array.isArray(refs)) sourceRefs.push(...refs);
    } catch {
      /* skip */
    }
  }

  const language =
    String(
      (report as any)?.config?.language ||
        (report as any)?.config?.intent?.language ||
        (report as any)?.companyContext?.language ||
        'en'
    ).toLowerCase() === 'pl'
      ? 'pl'
      : 'en';

  let contextPack: any = null;
  if (sourceRefs.length > 0) {
    try {
      contextPack = await buildContextPack(organizationId, sourceRefs, language);
    } catch (err) {
      logger.warn('[ReportGeneration] ContextPack build failed, using lightweight pack', {
        error: err,
      });
    }
  }

  if (!contextPack) {
    contextPack = {
      pack_id: `cp_fallback_${Date.now()}`,
      created_at: new Date().toISOString(),
      organization_id: organizationId,
      language,
      sources: sourceRefs,
      headings: [],
      key_points: context.sourceData.assessment
        ? [`Assessment: ${context.sourceData.assessment.name}`]
        : [],
      data_points: [],
      charts_available: [],
      images_available: [],
      metadata: {
        total_source_artifacts: sourceRefs.length,
        confidence_score: 0.5,
        extraction_warnings: ['fallback_pack'],
      },
    };
  }

  const reportTypeV3 = (report as any).reportTypeV3 || (report as any).report_type_v3 || 'custom';
  const goalV3 = (report as any).goalV3 || (report as any).goal_v3 || 'inform';
  const reportRegister =
    (report as any).communicationRegister || (report as any).communication_register || 'formal';
  const density = (report as any).density || 'standard';
  const form = (report as any).form || 'narrative';
  const dataLevel = (report as any).dataLevel || (report as any).data_level || 'summary';

  // G4: Per-section voice override from canonical template
  let sectionRegister = reportRegister;
  try {
    const { getCanonicalTemplate } = await import('./reportCanonicalTemplatesService.js');
    const template = getCanonicalTemplate(reportTypeV3);
    if (template) {
      const canonicalSection = template.sections.find((s) => s.key === section.sectionKey);
      if (canonicalSection?.defaultRegister) {
        sectionRegister = canonicalSection.defaultRegister;
      }
    }
  } catch {
    /* canonical templates not required */
  }

  const input: NarrativeEngineInput = {
    context_pack: contextPack,
    organizationId,
    report_config: {
      report_type_v3: reportTypeV3,
      goal_v3: goalV3,
      communication_register: sectionRegister,
      density,
      form,
      data_level: dataLevel,
      language,
    },
    section_key: section.sectionKey,
    section_type: section.sectionType,
    section_title: section.title,
    aiPurpose: 'report_section_draft',
  };

  const result = await generateNarrative(input);

  if (!result.content || result.content.trim().length < 50) {
    logger.warn('[ReportGeneration] Narrative Engine produced insufficient content', {
      sectionKey: section.sectionKey,
      contentLength: result.content?.length ?? 0,
    });
    return null;
  }

  return result;
}

// ==========================================
// V3 EXECUTIVE NARRATIVE SYNTHESIS (G3)
// ==========================================

/**
 * After all sections are generated for R2/R4 reports, synthesize a cross-section
 * executive summary by feeding all section summaries to the LLM.
 * Overwrites the `executive_summary` section with a synthesis narrative.
 */
async function synthesizeExecutiveSummary(
  reportId: string,
  organizationId: string,
  sectionSummaries: Array<{ key: string; title: string; summary: string }>
): Promise<{ content: string; tokensUsed: number } | null> {
  if (sectionSummaries.length < 2) return null;

  const execSection = await queryOne<{ section_key: string }>(
    `SELECT section_key FROM report_builder_sections
     WHERE report_id = ? AND section_key = 'executive_summary' AND enabled = 1`,
    [reportId]
  );
  if (!execSection) return null;

  const report = await queryOne<{
    report_type_v3: string;
    goal_v3: string;
    communication_register: string;
    title: string;
  }>(
    `SELECT report_type_v3, goal_v3, communication_register, title
     FROM report_builder_reports WHERE id = ?`,
    [reportId]
  );
  if (!report) return null;

  const register = report.communication_register || 'executive';
  const goal = report.goal_v3 || 'inform';
  const reportType = report.report_type_v3 || 'R2';

  const sectionDigest = sectionSummaries
    .filter((s) => s.key !== 'executive_summary')
    .map((s) => `### ${s.title}\n${s.summary}`)
    .join('\n\n');

  const systemPrompt = [
    'You are a senior executive report synthesizer.',
    `Communication register: ${register}. Write in crisp, decision-oriented language.`,
    'Your task: produce a single Executive Summary that synthesizes all section content below.',
    'Rules:',
    '1. Lead with the most critical finding or decision required.',
    '2. Cover each section in 1-2 sentences maximum.',
    '3. Highlight Red/Amber items first, then Green.',
    '4. End with a clear "recommended actions" list (max 3 items).',
    '5. Total length: 250-500 words.',
    '6. Output Markdown. Start with ## Executive Summary.',
  ].join('\n');

  const userPrompt = [
    `Report: "${report.title}" (${reportType})`,
    `Goal: ${goal}`,
    '',
    '## Section Digests',
    sectionDigest,
    '',
    'Write the executive summary now.',
  ].join('\n');

  const result = await callAI(systemPrompt, userPrompt, 1200, {
    purpose: 'report_executive_synthesis',
    organizationId,
    tier: 'REASONING',
  });

  const now = new Date().toISOString();
  await queryRun(
    `UPDATE report_builder_sections
     SET generated_content = ?, generated_at = ?, tokens_used = ?,
         generation_model = ?, updated_at = ?
     WHERE report_id = ? AND section_key = 'executive_summary'`,
    [result.content, now, result.tokensUsed, result.model + ':executive-synthesis', now, reportId]
  );

  return { content: result.content, tokensUsed: result.tokensUsed };
}

// ==========================================
// DRD BOOK GROUNDING (RAG)
// ==========================================

/**
 * Section types whose narrative benefits from grounding in the "Digital
 * Pathfinder" book methodology (Dr. Piotr Wiśniewski). Deterministic sections
 * (cover/matrix/appendix/initiatives-JSON) are excluded — they render from
 * engine data, not prose.
 */
const DRD_GROUNDABLE_SECTION_TYPES = new Set<string>([
  'summary',
  'methodology',
  'axis_analysis',
  'recommendations',
  'action_plan',
  'list',
]);

/**
 * Retrieve "Digital Pathfinder" book methodology excerpts for a section and
 * format them as an inline grounding block appended to the user prompt.
 *
 * This wires the SAME indexed tool-KB (`knowledge/tool-kb/drd/methodology/**`,
 * `tool_slug='drd'`, `pack_type='methodology'`) that the standalone DRD report
 * narrator uses (`drdReportGrounding.ts` / `searchKnowledgeBase`). The Report
 * Builder path previously never called it, so DRD reports produced generic
 * consultant prose with no book grounding — this closes that wiring gap.
 *
 * Fail-open by design: any KB/retrieval failure resolves to '' so report
 * generation always proceeds (matches the drdReportGrounding fail-safe posture).
 * Numbers still come only from the assessment data already in the prompt — book
 * excerpts are qualitative grounding/citation material, never a source of facts.
 */
async function buildDrdBookGroundingBlock(
  query: string,
  organizationId: string,
  userId?: string,
  maxChunks = 3
): Promise<string> {
  try {
    const mod = await import('./ai/tools/searchKnowledgeBase.js');
    const searchKnowledgeBase = mod.searchKnowledgeBase || mod.default?.searchKnowledgeBase;
    if (typeof searchKnowledgeBase !== 'function') return '';

    const { results } = await searchKnowledgeBase(
      { query, maxResults: maxChunks, toolSlug: 'drd', packType: 'methodology' },
      // FIX-2 (dyżur 210): thread the requesting user through so an
      // owner-aware access filter can see their own private docs. This
      // query is tool_slug='drd'/pack_type='methodology' book grounding
      // (always global tool_pack content today), so it has no practical
      // effect yet — kept honest for whenever a caller narrows this query.
      { organizationId, userId }
    );

    const excerpts = (results || [])
      .filter((r: any) => r?.content && String(r.content).trim().length > 0)
      // Only ground on the branded book pack — never on unrelated org docs that
      // may leak through a loose vector match (integrity guard).
      .filter((r: any) => r?.branded === true)
      .map((r: any, idx: number) => {
        const cite =
          r.branded && r.sourceAuthor
            ? `„${r.source}", ${r.sourceAuthor}`
            : r.source || 'DRD Methodology';
        return `[${idx + 1}] (${cite})\n${String(r.content).slice(0, 600).trim()}`;
      });

    if (excerpts.length === 0) return '';

    return (
      `\n\n---\nMETHODOLOGY GROUNDING — excerpts from the "Digital Pathfinder" book ` +
      `(the canonical DRD source). Ground your analysis in this methodology and cite it ` +
      `inline as (Digital Pathfinder) where you draw on it. Use it for qualitative framing ` +
      `(maturity-level meaning, good practices) only — do NOT introduce any numbers that are ` +
      `not already in the assessment data above.\n\n` +
      excerpts.join('\n\n')
    );
  } catch (err) {
    logger.warn('[ReportGeneration] DRD book grounding failed (non-fatal), continuing ungrounded', {
      query,
      error: err instanceof Error ? err.message : String(err),
    });
    return '';
  }
}

/**
 * Build the retrieval query for a section's DRD book grounding. Axis sections
 * query by axis name for targeted retrieval; others use a section-oriented query.
 */
function drdGroundingQueryForSection(section: SectionRecord): string {
  const title = (section.title || '').trim();
  switch (section.sectionType) {
    case 'axis_analysis':
      return `${title || 'axis'} — methodology, maturity levels, good practices`;
    case 'methodology':
      return 'DRD digital readiness methodology, seven axes, maturity levels, scoring scale';
    case 'summary':
      return 'digital maturity overall assessment, maturity levels, transformation priorities';
    // 'recommendations' (gap analysis) and 'action_plan' (roadmap) previously shared
    // one generic query and both returned zero branded chunks in production (verified
    // live 2026-07-12: 9/9 other narrative sections grounded, 0/2 for these). Split into
    // two queries, each phrased against the book's own vocabulary for that chapter
    // (verified via direct cosine-similarity probe against the indexed embeddings on
    // TROLLEY: old shared query scored ~0.70 top; these score ~0.77-0.80 and land on
    // the correct branded chunks — the "Tool 3: The Digital Roadmap" chapter and the
    // "assess your current level / rate against the next higher level" gap passages).
    case 'recommendations':
      return (
        'assess the current level of digital maturity in each area and rate your company ' +
        'against the criteria for the next higher level; identify and prioritize the gaps ' +
        'to close across all axes'
      );
    case 'action_plan':
      return (
        'Digital Roadmap — Tool 3: build, implement and execute a digital transformation ' +
        'plan; developing a coherent list of transformation initiatives sequenced across ' +
        'the six axes'
      );
    default:
      return `${title || 'digital readiness'} — digital maturity, methodology`;
  }
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

  // DRD book grounding (RAG): for DRD assessments, ground narrative sections in
  // the "Digital Pathfinder" methodology KB so the report cites the canonical
  // book instead of producing generic consultant prose. Fail-open — appends
  // nothing on any retrieval miss/error. Skipped for pptx (structured JSON) and
  // for the V3 narrative-engine path below (which does its own grounding).
  const assessmentType = String(context.sourceData.assessment?.type || '').toUpperCase();
  if (
    targetFormat !== 'pptx' &&
    assessmentType === 'DRD' &&
    DRD_GROUNDABLE_SECTION_TYPES.has(String(section.sectionType))
  ) {
    const groundingBlock = await buildDrdBookGroundingBlock(
      drdGroundingQueryForSection(section),
      organizationId,
      userId
    );
    if (groundingBlock) {
      prompts.user = `${prompts.user}${groundingBlock}`;
      logger.info('[ReportGeneration] DRD book grounding attached', {
        reportId,
        sectionKey,
        sectionType: section.sectionType,
        addedChars: groundingBlock.length,
      });
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

  // V3 Narrative Engine path: use the 5-layer pipeline when report has V3 parameters
  const reportTypeV3 =
    (reportData.report as any).reportTypeV3 || (reportData.report as any).report_type_v3;
  if (reportTypeV3 && targetFormat !== 'pptx') {
    try {
      const narrativeResult = await generateSectionViaNarrativeEngine(
        reportData.report,
        section,
        organizationId,
        context
      );
      if (narrativeResult) {
        const now = new Date().toISOString();
        await queryRun(
          `UPDATE report_builder_sections
           SET generated_content = ?, generated_at = ?, tokens_used = ?, generation_model = ?,
               source_data_snapshot = ?, updated_at = ?
           WHERE report_id = ? AND section_key = ?`,
          [
            narrativeResult.content,
            now,
            0,
            'narrative-engine-v3',
            JSON.stringify({
              ...context.sourceData,
              narrative_engine: {
                facts_used: narrativeResult.facts_used.length,
                observations_used: narrativeResult.observations_used.length,
                post_check_passed: narrativeResult.post_check.passed,
              },
            }),
            now,
            reportId,
            sectionKey,
          ]
        );

        logger.info(`[ReportGeneration] V3 Narrative Engine generated section ${sectionKey}`, {
          reportId,
          factsUsed: narrativeResult.facts_used.length,
          observationsUsed: narrativeResult.observations_used.length,
          postCheckPassed: narrativeResult.post_check.passed,
        });

        return { content: narrativeResult.content, tokensUsed: 0 };
      }
    } catch (err) {
      logger.warn(
        `[ReportGeneration] Narrative Engine failed for ${sectionKey}, falling back to direct AI`,
        { error: err }
      );
    }
  }

  // Legacy / fallback path: direct AI call
  const result = await callAI(prompts.system, prompts.user, maxTokens, {
    purpose: 'report_section_draft',
    organizationId,
  });

  const isJsonSection = ['initiatives'].includes(section.sectionType);
  const detectedFormat = isJsonSection ? 'json' : undefined;
  const detectedRenderKind = isJsonSection ? 'initiatives' : undefined;

  const now = new Date().toISOString();
  await queryRun(
    `
    UPDATE report_builder_sections
    SET generated_content = ?, generated_at = ?, tokens_used = ?, generation_model = ?,
        source_data_snapshot = ?${detectedFormat ? ', content_format = ?, render_kind = ?' : ''}, updated_at = ?
    WHERE report_id = ? AND section_key = ?
  `,
    [
      result.content,
      now,
      result.tokensUsed,
      result.model,
      JSON.stringify(context.sourceData),
      ...(detectedFormat ? [detectedFormat, detectedRenderKind] : []),
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

  // Build ContextPack from source_refs if available
  let contextPackSummary = '';
  try {
    const sourceRefsRaw = await queryOne<{ source_refs_json: string }>(
      `SELECT source_refs_json FROM report_builder_reports WHERE id = ?`,
      [reportId]
    );
    const sourceRefs: SourceRef[] = sourceRefsRaw?.source_refs_json
      ? JSON.parse(sourceRefsRaw.source_refs_json)
      : [];

    if (sourceRefs.length > 0) {
      const lang = ((reportData.report.config as any)?.language || 'en') as 'en' | 'pl';
      const contextPack = await buildContextPack(organizationId, sourceRefs, lang);

      await saveContextPackSnapshot(reportId, contextPack);

      await queryRun(
        `UPDATE report_builder_reports SET context_pack_snapshot = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(contextPack), new Date().toISOString(), reportId]
      );

      const kpSummary = contextPack.key_points.slice(0, 15).join('\n- ');
      const dpSummary = contextPack.data_points
        .slice(0, 10)
        .map((dp) => `${dp.label}: ${dp.value}${dp.unit ? ' ' + dp.unit : ''}`)
        .join('\n- ');
      contextPackSummary =
        `\n\nCONTEXT PACK DATA (use as primary data source):\n` +
        (kpSummary ? `Key Points:\n- ${kpSummary}\n` : '') +
        (dpSummary ? `Data Points:\n- ${dpSummary}\n` : '') +
        `Sources: ${contextPack.sources.map((s) => s.artifact_name).join(', ')}\n`;

      logger.info('[ReportGeneration] ContextPack built and saved', {
        reportId,
        sourcesCount: sourceRefs.length,
        keyPoints: contextPack.key_points.length,
        dataPoints: contextPack.data_points.length,
      });
    }
  } catch (err) {
    logger.warn('[ReportGeneration] ContextPack build failed (non-fatal), continuing', {
      reportId,
      err,
    });
  }

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

  // ── REQ-5: Cross-Block Coherence ──
  // Step 1: Generate a report outline to guide all sections
  let reportOutline = '';
  if (sectionsToGenerate.length >= 3) {
    try {
      const sourceData = await ReportBuilderService.getSourceDataForReport(
        reportId,
        organizationId
      );
      const companyName =
        (reportData.report.companyContext as any)?.organizationName || 'the organization';
      const assessmentType = sourceData?.assessment?.assessmentType || 'DRD';
      const sectionList = sectionsToGenerate
        .map((s, i) => `${i + 1}. ${s.title || s.sectionKey} (${s.sectionType})`)
        .join('\n');

      const outlineResult = await callAI(
        `You are a senior report strategist. Generate a concise report outline that ensures coherence across all sections.`,
        `Create a coherent narrative outline for a ${assessmentType} assessment report for ${companyName}.

The report has these sections:
${sectionList}

For each section, provide:
- 1-sentence description of what it should focus on
- Key transition from previous section
- 2-3 key points to emphasize

Keep the outline concise (max 400 words). Focus on narrative flow and avoiding repetition between sections.`,
        600,
        {
          purpose: 'report_executive_synthesis',
          organizationId,
        }
      );

      reportOutline = outlineResult.content;
      totalTokens += outlineResult.tokensUsed;
      logger.info('[ReportGeneration] Generated coherence outline', {
        reportId,
        tokensUsed: outlineResult.tokensUsed,
      });
    } catch (err) {
      logger.warn('[ReportGeneration] Failed to generate outline, continuing without it', err);
    }
  }

  // Build narrative context that accumulates as we generate sections sequentially.
  // Each section receives a summary of previously generated content for coherence.
  const previousSectionsSummaries: Array<{ key: string; title: string; summary: string }> = [];

  // Build narrative thread from report config (if set by user)
  // Config structure: { intent: { narrativeThread, glossaryTerms, ... }, styling: {...} }
  const reportConfig = reportData.report.config || {};
  const intentConfig = (reportConfig as any)?.intent || {};
  const narrativeThread =
    intentConfig?.narrativeThread ||
    (reportConfig as any)?.narrativeThread ||
    (reportConfig as any)?.keyMessages ||
    '';
  const glossaryTerms = intentConfig?.glossaryTerms || (reportConfig as any)?.glossaryTerms || '';

  for (let i = 0; i < sectionsToGenerate.length; i++) {
    const section = sectionsToGenerate[i];

    // Inject cross-block context into section's customPrompt temporarily
    let coherenceContext = '';

    // Add report outline for coherence
    if (reportOutline) {
      coherenceContext += `\n\nREPORT OUTLINE (follow this structure, maintain coherent narrative flow):\n${reportOutline}\n`;
    }

    if (previousSectionsSummaries.length > 0) {
      // Include summaries of previous sections (last 5 for token efficiency)
      const recentSummaries = previousSectionsSummaries.slice(-5);
      coherenceContext += '\n\nPREVIOUS SECTIONS CONTEXT (maintain coherence, avoid repetition):\n';
      for (const ps of recentSummaries) {
        coherenceContext += `- "${ps.title}": ${ps.summary}\n`;
      }
    }
    if (narrativeThread) {
      coherenceContext += `\nNARRATIVE THREAD (emphasize throughout): ${narrativeThread}\n`;
    }
    if (glossaryTerms) {
      coherenceContext += `\nTERMINOLOGY (use consistently): ${glossaryTerms}\n`;
    }
    if (contextPackSummary) {
      coherenceContext += contextPackSummary;
    }

    // Temporarily append coherence context to section's customPrompt
    const originalCustomPrompt = section.customPrompt || '';
    if (coherenceContext) {
      await queryRun(
        `UPDATE report_builder_sections SET custom_prompt = ? WHERE report_id = ? AND section_key = ?`,
        [(originalCustomPrompt + coherenceContext).slice(0, 4000), reportId, section.sectionKey]
      );
    }

    try {
      const result = await generateSectionContent(
        reportId,
        section.sectionKey,
        organizationId,
        userId
      );
      totalTokens += result.tokensUsed;
      generatedSections.push(section.sectionKey);

      // Build summary of generated content for next sections (first 300 chars)
      const contentPreview = result.content.replace(/[#*_\n]+/g, ' ').trim();
      previousSectionsSummaries.push({
        key: section.sectionKey,
        title: section.title || section.sectionKey,
        summary:
          contentPreview.length > 300 ? contentPreview.slice(0, 300) + '...' : contentPreview,
      });

      // Report progress
      const progress = Math.round(((i + 1) / sectionsToGenerate.length) * 100);
      options?.onProgress?.(progress, section.sectionKey);
    } catch (err) {
      logger.error(`[ReportGeneration] Failed to generate section ${section.sectionKey}`, err);
      // Continue with other sections
    } finally {
      // Restore original customPrompt (remove coherence injection)
      if (coherenceContext) {
        await queryRun(
          `UPDATE report_builder_sections SET custom_prompt = ? WHERE report_id = ? AND section_key = ?`,
          [originalCustomPrompt || null, reportId, section.sectionKey]
        );
      }
    }
  }

  // V3: Executive Narrative Synthesis for R2/R4 reports
  const reportTypeV3 =
    (reportData.report as any).reportTypeV3 || (reportData.report as any).report_type_v3;
  if (reportTypeV3 && ['R2', 'R4'].includes(String(reportTypeV3).toUpperCase())) {
    try {
      const synthResult = await synthesizeExecutiveSummary(
        reportId,
        organizationId,
        previousSectionsSummaries
      );
      if (synthResult) {
        totalTokens += synthResult.tokensUsed;
        logger.info('[ReportGeneration] Executive synthesis completed for ' + reportTypeV3, {
          reportId,
          tokensUsed: synthResult.tokensUsed,
        });
      }
    } catch (err) {
      logger.warn('[ReportGeneration] Executive synthesis failed (non-fatal)', {
        reportId,
        error: err,
      });
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
  let sourceType: 'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE' | 'UPLOAD_BUNDLE' =
    'ASSESSMENT';
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
  showConsultifyBranding?: boolean;
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
    showConsultifyBranding: options.showConsultifyBranding,
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
      showConsultifyBranding: link.showConsultifyBranding,
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
