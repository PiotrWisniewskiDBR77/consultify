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
    db.get(sql, params, (err: Error | null, row: T) => {
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

  const baseSystem = `You are a senior management consultant creating a professional assessment report.
Write in ${section.language} style. ${languageGuidance}
Target length: ${lengthGuidance}
${section.customPrompt ? `\nAdditional guidance: ${section.customPrompt}` : ''}`;

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
// MOCK AI GENERATION (replace with real AI)
// ==========================================

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<GenerationResult> {
  // TODO: Replace with actual AI provider (OpenAI, Anthropic, etc.)
  // For now, generate placeholder content based on section type

  logger.info('[ReportGeneration] Generating content with AI...', {
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    maxTokens,
  });

  // Simulate AI response with meaningful placeholder
  const content = generatePlaceholderContent(userPrompt);

  return {
    content,
    tokensUsed: Math.floor(content.length / 4), // Rough estimate
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
 * Generate content for a single section
 */
export async function generateSectionContent(
  reportId: string,
  sectionKey: string,
  organizationId: string,
  userId: string
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
  if ((section as any).blockTypeId) {
    const bt = await queryOne<any>(
      `
      SELECT * FROM report_builder_block_types
      WHERE id = ? AND is_active = 1 AND (organization_id IS NULL OR organization_id = ?)
      LIMIT 1
    `,
      [(section as any).blockTypeId, organizationId]
    );

    const promptTemplate: string | null | undefined = bt?.prompt_template || null;
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
  // Get report
  const reportData = await ReportBuilderService.getReport(reportId, organizationId);
  if (!reportData) throw new Error('Report not found');

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
// EXPORTS
// ==========================================

const ReportGenerationService = {
  generateSectionContent,
  generateFullReport,
  regenerateSection,
};

export default ReportGenerationService;
