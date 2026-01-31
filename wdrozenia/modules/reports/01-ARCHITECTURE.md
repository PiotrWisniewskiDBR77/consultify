# Reports Module – Architecture

## Status: 🔨 W PLANOWANIU

---

## 🏗️ Architektura wysokopoziomowa

### Zasada: Adaptery źródeł + Generyczny silnik

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           REPORT BUILDER SYSTEM                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         SOURCE ADAPTERS                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │ │
│  │  │  Assessment  │  │  Interview   │  │    Tool      │  │ Initiative │ │ │
│  │  │   Adapter    │  │   Adapter    │  │   Adapter    │  │  Adapter   │ │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │ │
│  │         │                 │                 │                │        │ │
│  │         └─────────────────┴─────────────────┴────────────────┘        │ │
│  │                                   │                                    │ │
│  │                                   ▼                                    │ │
│  │                    ┌──────────────────────────┐                        │ │
│  │                    │   UNIFIED DATA FORMAT    │                        │ │
│  │                    │   (ReportSourceData)     │                        │ │
│  │                    └────────────┬─────────────┘                        │ │
│  └─────────────────────────────────┼──────────────────────────────────────┘ │
│                                    │                                        │
│  ┌─────────────────────────────────▼──────────────────────────────────────┐ │
│  │                         REPORT ENGINE                                  │ │
│  │                                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │   Template   │  │  Generation  │  │    Export    │                 │ │
│  │  │   Manager    │  │   Service    │  │   Service    │                 │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                 │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         STORAGE LAYER                                  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │   Reports    │  │   Sections   │  │    Files     │                 │ │
│  │  │   (SQLite)   │  │   (SQLite)   │  │   (Disk)     │                 │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Source Adapters

### Interface: `ISourceAdapter`

```typescript
interface ISourceAdapter<T = unknown> {
  sourceType: ReportSourceType;

  // Discovery
  listAvailableSources(organizationId: string, filters?: SourceFilters): Promise<SourceListItem[]>;

  // Data extraction
  getSourceData(sourceId: string): Promise<T>;

  // Transform to unified format
  transformToReportData(sourceData: T): ReportSourceData;

  // Get default template for this source
  getDefaultTemplate(): ReportTemplate;

  // Get methodology-specific prompts
  getGenerationPrompts(section: SectionConfig): GenerationPrompt[];
}
```

### Assessment Adapter

```typescript
class AssessmentSourceAdapter implements ISourceAdapter<AssessmentData> {
  sourceType = 'ASSESSMENT' as const;

  async listAvailableSources(
    organizationId: string,
    filters?: SourceFilters
  ): Promise<SourceListItem[]> {
    // Return only APPROVED assessments
    const assessments = await db.query(
      `
      SELECT id, name, assessment_type, status, approved_at, created_at
      FROM assessments
      WHERE organization_id = ?
        AND status = 'APPROVED'
      ORDER BY approved_at DESC
    `,
      [organizationId]
    );

    return assessments.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.assessment_type,
      status: a.status,
      date: a.approved_at,
      metadata: {
        framework: a.assessment_type,
      },
    }));
  }

  async getSourceData(sourceId: string): Promise<AssessmentData> {
    const assessment = await db.query(
      `
      SELECT a.*, p.name as project_name, o.name as organization_name
      FROM assessments a
      LEFT JOIN projects p ON a.project_id = p.id
      LEFT JOIN organizations o ON a.organization_id = o.id
      WHERE a.id = ?
    `,
      [sourceId]
    );

    return {
      ...assessment,
      answers: JSON.parse(assessment.answers_json || '{}'),
      scores: JSON.parse(assessment.score_summary || '{}'),
    };
  }

  transformToReportData(data: AssessmentData): ReportSourceData {
    return {
      sourceType: 'ASSESSMENT',
      sourceId: data.id,
      sourceName: data.name,

      company: {
        name: data.organization_name,
        // Additional company data from context
      },

      methodology: {
        framework: data.assessment_type,
        description: this.getMethodologyDescription(data.assessment_type),
        axes: this.getAxesDefinition(data.assessment_type),
      },

      data: {
        axes: this.transformAxes(data),
        scores: data.scores,
        gaps: this.calculateGaps(data),
        strengths: this.identifyStrengths(data),
        weaknesses: this.identifyWeaknesses(data),
      },

      metadata: {
        assessedAt: data.approved_at,
        assessedBy: data.created_by_name,
        version: data.version,
      },
    };
  }

  getDefaultTemplate(): ReportTemplate {
    return ASSESSMENT_REPORT_TEMPLATE;
  }
}
```

---

## 📋 Report Templates

### Template Structure

```typescript
interface ReportTemplate {
  id: string;
  name: string;
  sourceType: ReportSourceType;
  description: string;

  sections: SectionDefinition[];

  defaultOptions: {
    length: 'short' | 'medium' | 'long';
    language: 'technical' | 'business' | 'general';
  };
}

interface SectionDefinition {
  id: string;
  key: string; // Unique key for mapping
  title: string;
  type: SectionType;

  required: boolean;
  order: number;

  // For repeating sections (e.g., per axis)
  repeatFor?: 'axis' | 'area' | 'dimension';

  // Default options
  defaultOptions: SectionOptions;

  // Content schema
  contentSchema: ContentSchema;

  // Generation config
  generationConfig: {
    systemPrompt: string;
    userPromptTemplate: string;
    outputFormat: 'markdown' | 'json' | 'html';
  };
}

type SectionType =
  | 'cover'
  | 'summary'
  | 'methodology'
  | 'matrix'
  | 'axis_analysis'
  | 'list'
  | 'recommendations'
  | 'action_plan'
  | 'appendix'
  | 'custom';
```

### Assessment Report Template

```typescript
const ASSESSMENT_REPORT_TEMPLATE: ReportTemplate = {
  id: 'assessment-standard',
  name: 'Standard Assessment Report',
  sourceType: 'ASSESSMENT',
  description: 'Comprehensive assessment report with methodology-specific chapters',

  defaultOptions: {
    length: 'medium',
    language: 'business',
  },

  sections: [
    {
      id: 'cover',
      key: 'cover',
      title: 'Cover Page',
      type: 'cover',
      required: true,
      order: 0,
      defaultOptions: { length: 'short', language: 'business' },
      contentSchema: {
        fields: ['company_name', 'report_title', 'date', 'authors', 'logo'],
      },
      generationConfig: {
        systemPrompt: '',
        userPromptTemplate: '',
        outputFormat: 'json',
      },
    },

    {
      id: 'executive_summary',
      key: 'executive_summary',
      title: 'Executive Summary',
      type: 'summary',
      required: true,
      order: 1,
      defaultOptions: { length: 'medium', language: 'business' },
      contentSchema: {
        fields: ['overview', 'key_findings', 'recommendations', 'next_steps'],
      },
      generationConfig: {
        systemPrompt: `You are a senior management consultant creating an executive summary.
Focus on strategic insights, not technical details.
Be concise but comprehensive.`,
        userPromptTemplate: `Create an executive summary for {{company.name}}'s {{methodology.framework}} assessment.

Overall maturity: {{data.scores.overall}} / {{data.scores.max}}

Key metrics:
{{#each data.axes}}
- {{name}}: {{score}}/{{maxScore}} ({{percentage}}%)
{{/each}}

Top strengths: {{data.strengths}}
Key gaps: {{data.weaknesses}}

Generate a {{options.length}} summary in {{options.language}} style.`,
        outputFormat: 'markdown',
      },
    },

    {
      id: 'methodology',
      key: 'methodology',
      title: 'Assessment Methodology',
      type: 'methodology',
      required: true,
      order: 2,
      defaultOptions: { length: 'short', language: 'technical' },
      contentSchema: {
        fields: ['framework_name', 'framework_description', 'axes_overview', 'scoring_method'],
      },
      generationConfig: {
        systemPrompt: `Describe the assessment methodology clearly and professionally.
Include framework background, axes/dimensions, and scoring approach.`,
        userPromptTemplate: `Describe the {{methodology.framework}} assessment methodology.

Framework: {{methodology.description}}
Axes: {{methodology.axes.length}}
{{#each methodology.axes}}
- {{name}}: {{description}}
{{/each}}

Scoring: 1-{{methodology.maxLevel}} scale

Generate {{options.length}} description in {{options.language}} style.`,
        outputFormat: 'markdown',
      },
    },

    {
      id: 'maturity_matrix',
      key: 'maturity_matrix',
      title: 'Maturity Matrix',
      type: 'matrix',
      required: true,
      order: 3,
      defaultOptions: { length: 'medium', language: 'business' },
      contentSchema: {
        fields: ['radar_chart', 'heatmap', 'scores_table', 'interpretation'],
      },
      generationConfig: {
        systemPrompt: `Provide a brief interpretation of the maturity matrix.
Highlight patterns, outliers, and key takeaways.`,
        userPromptTemplate: `Interpret the maturity matrix for {{company.name}}.

Scores by axis:
{{#each data.axes}}
- {{name}}: Current {{current}}, Target {{target}}, Gap {{gap}}
{{/each}}

Overall: {{data.scores.overall}}
Highest: {{data.scores.highest.name}} ({{data.scores.highest.score}})
Lowest: {{data.scores.lowest.name}} ({{data.scores.lowest.score}})

Generate {{options.length}} interpretation in {{options.language}} style.`,
        outputFormat: 'markdown',
      },
    },

    {
      id: 'axis_analysis',
      key: 'axis_{{axis.id}}',
      title: '{{axis.name}} Analysis',
      type: 'axis_analysis',
      required: true,
      order: 4,
      repeatFor: 'axis',
      defaultOptions: { length: 'long', language: 'business' },
      contentSchema: {
        fields: ['axis_summary', 'areas_analysis', 'conclusions', 'recommendations'],
      },
      generationConfig: {
        systemPrompt: `Analyze a specific axis of the assessment.
For each area, provide: finding, conclusion, and recommendation.
Be specific and actionable.`,
        userPromptTemplate: `Analyze {{axis.name}} axis for {{company.name}}.

Axis score: {{axis.score}} / {{axis.maxScore}}

Areas:
{{#each axis.areas}}
### {{name}}
- Score: {{score}}
- Answer: {{answer}}
- Evidence: {{evidence}}
- Notes: {{notes}}
{{/each}}

For each area, generate:
1. **Finding**: What was observed
2. **Conclusion**: What it means
3. **Recommendation**: What to do

Generate {{options.length}} analysis in {{options.language}} style.`,
        outputFormat: 'markdown',
      },
    },

    {
      id: 'strengths',
      key: 'strengths',
      title: 'Strengths',
      type: 'list',
      required: true,
      order: 100,
      defaultOptions: { length: 'medium', language: 'business' },
      contentSchema: {
        fields: ['strengths_list', 'supporting_evidence'],
      },
      generationConfig: {
        systemPrompt: `Identify and describe organizational strengths.
Focus on competitive advantages and high-maturity areas.`,
        userPromptTemplate: `List strengths for {{company.name}} based on assessment.

High-scoring areas:
{{#each data.strengths}}
- {{name}}: {{score}} ({{context}})
{{/each}}

Generate {{options.length}} strengths analysis in {{options.language}} style.
Format as numbered list with brief explanations.`,
        outputFormat: 'markdown',
      },
    },

    {
      id: 'weaknesses',
      key: 'weaknesses',
      title: 'Areas for Improvement',
      type: 'list',
      required: true,
      order: 101,
      defaultOptions: { length: 'medium', language: 'business' },
      contentSchema: {
        fields: ['weaknesses_list', 'impact_analysis'],
      },
      generationConfig: {
        systemPrompt: `Identify areas needing improvement.
Frame constructively, focus on opportunity, not criticism.`,
        userPromptTemplate: `List improvement areas for {{company.name}}.

Low-scoring areas:
{{#each data.weaknesses}}
- {{name}}: {{score}} (gap: {{gap}})
{{/each}}

Generate {{options.length}} improvement areas in {{options.language}} style.
Format as numbered list with impact description.`,
        outputFormat: 'markdown',
      },
    },

    {
      id: 'recommendations',
      key: 'recommendations',
      title: 'Strategic Recommendations',
      type: 'recommendations',
      required: true,
      order: 102,
      defaultOptions: { length: 'long', language: 'business' },
      contentSchema: {
        fields: ['recommendations_list', 'priority', 'timeline', 'expected_impact'],
      },
      generationConfig: {
        systemPrompt: `Provide strategic, actionable recommendations.
Prioritize by impact and feasibility.
Include implementation guidance.`,
        userPromptTemplate: `Generate strategic recommendations for {{company.name}}.

Based on:
- Gaps: {{data.gaps}}
- Weaknesses: {{data.weaknesses}}
- Strategic context: {{company.context}}

Generate {{options.length}} recommendations in {{options.language}} style.
Include priority (High/Medium/Low) and suggested timeline.`,
        outputFormat: 'markdown',
      },
    },

    {
      id: 'next_steps',
      key: 'next_steps',
      title: 'Next Steps',
      type: 'action_plan',
      required: true,
      order: 103,
      defaultOptions: { length: 'medium', language: 'business' },
      contentSchema: {
        fields: ['immediate_actions', 'short_term', 'long_term'],
      },
      generationConfig: {
        systemPrompt: `Define clear, actionable next steps.
Organize by timeframe: immediate, short-term, long-term.`,
        userPromptTemplate: `Define next steps for {{company.name}}.

Priority recommendations:
{{#each data.recommendations}}
- {{title}} (Priority: {{priority}})
{{/each}}

Generate {{options.length}} action plan in {{options.language}} style.
Organize by:
- Immediate (0-30 days)
- Short-term (1-3 months)
- Long-term (3-12 months)`,
        outputFormat: 'markdown',
      },
    },

    {
      id: 'appendix',
      key: 'appendix',
      title: 'Appendix',
      type: 'appendix',
      required: false,
      order: 200,
      defaultOptions: { length: 'long', language: 'technical' },
      contentSchema: {
        fields: ['detailed_scores', 'methodology_details', 'glossary'],
      },
      generationConfig: {
        systemPrompt: '',
        userPromptTemplate: '',
        outputFormat: 'json',
      },
    },
  ],
};
```

---

## 🤖 Generation Service

### Pipeline

```
┌──────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐
│  Source  │───►│  Context  │───►│   Prompt  │───►│    AI    │
│   Data   │    │  Builder  │    │  Compiler │    │ Provider │
└──────────┘    └───────────┘    └───────────┘    └────┬─────┘
                                                       │
┌──────────┐    ┌───────────┐    ┌───────────┐        │
│  Store   │◄───│  Format   │◄───│  Parse    │◄───────┘
│  Result  │    │  Output   │    │  Response │
└──────────┘    └───────────┘    └───────────┘
```

### Implementation

```typescript
class ReportGenerationService {
  private aiProvider: IAIProvider;

  async generateSection(
    report: Report,
    section: ReportSection,
    sourceData: ReportSourceData
  ): Promise<GeneratedContent> {
    // 1. Build context
    const context = this.buildContext(report, section, sourceData);

    // 2. Compile prompt
    const prompt = this.compilePrompt(section.generationConfig, context);

    // 3. Call AI
    const response = await this.aiProvider.generate({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: 0.7,
      maxTokens: this.getMaxTokens(section.options.length),
    });

    // 4. Parse response
    const content = this.parseResponse(response, section.generationConfig.outputFormat);

    // 5. Post-process
    const processed = await this.postProcess(content, section);

    return {
      sectionId: section.id,
      content: processed,
      generatedAt: new Date().toISOString(),
      tokensUsed: response.usage.totalTokens,
    };
  }

  async generateFullReport(report: Report, sourceData: ReportSourceData): Promise<GeneratedReport> {
    const results: GeneratedContent[] = [];

    // Generate sections in order, passing previous context
    for (const section of report.sections.sort((a, b) => a.order - b.order)) {
      if (!section.enabled) continue;

      // Handle repeating sections
      if (section.repeatFor === 'axis') {
        for (const axis of sourceData.data.axes) {
          const axisSection = this.createAxisSection(section, axis);
          const content = await this.generateSection(report, axisSection, sourceData);
          results.push(content);
        }
      } else {
        const content = await this.generateSection(report, section, sourceData);
        results.push(content);
      }
    }

    return {
      reportId: report.id,
      sections: results,
      generatedAt: new Date().toISOString(),
      totalTokens: results.reduce((sum, r) => sum + r.tokensUsed, 0),
    };
  }

  private getMaxTokens(length: 'short' | 'medium' | 'long'): number {
    switch (length) {
      case 'short':
        return 500;
      case 'medium':
        return 1500;
      case 'long':
        return 3000;
    }
  }

  private buildContext(
    report: Report,
    section: ReportSection,
    sourceData: ReportSourceData
  ): GenerationContext {
    return {
      report: {
        id: report.id,
        title: report.title,
        description: report.description,
      },
      section: {
        id: section.id,
        title: section.title,
        type: section.type,
        options: section.options,
      },
      source: sourceData,
      previousSections: report.sections
        .filter((s) => s.order < section.order && s.generatedContent)
        .map((s) => ({
          key: s.key,
          content: s.generatedContent,
        })),
    };
  }
}
```

---

## 📄 Export Service

### PDF Generation

```typescript
class ReportExportService {
  async exportToPdf(report: Report, options: PdfExportOptions = {}): Promise<ExportResult> {
    // 1. Build HTML from sections
    const html = await this.buildHtml(report);

    // 2. Apply template styling
    const styledHtml = this.applyTemplate(html, options.template || 'professional');

    // 3. Generate PDF
    const pdf = await this.generatePdf(styledHtml, {
      format: 'A4',
      margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: this.getHeaderTemplate(report),
      footerTemplate: this.getFooterTemplate(report),
    });

    // 4. Save to disk
    const filename = this.generateFilename(report, 'pdf');
    const path = await this.saveToDisk(pdf, filename);

    // 5. Update report record
    await this.updateReportPath(report.id, 'pdf', path);

    return {
      format: 'pdf',
      path,
      filename,
      size: pdf.length,
      generatedAt: new Date().toISOString(),
    };
  }

  private async buildHtml(report: Report): Promise<string> {
    const sections = report.sections.filter((s) => s.enabled).sort((a, b) => a.order - b.order);

    let html = '';

    for (const section of sections) {
      const content = section.editedContent || section.generatedContent;

      switch (section.type) {
        case 'cover':
          html += this.renderCoverSection(section, content);
          break;
        case 'matrix':
          html += this.renderMatrixSection(section, content);
          break;
        default:
          html += this.renderMarkdownSection(section, content);
      }
    }

    return html;
  }

  private renderMatrixSection(section: ReportSection, content: any): string {
    // Render charts as SVG/images
    const radarChart = this.renderRadarChart(content.radar);
    const heatmap = this.renderHeatmap(content.heatmap);
    const table = this.renderScoresTable(content.scores);

    return `
      <section class="matrix-section page-break-before">
        <h2>${section.title}</h2>
        <div class="charts-grid">
          <div class="radar-chart">${radarChart}</div>
          <div class="heatmap">${heatmap}</div>
        </div>
        <div class="scores-table">${table}</div>
        <div class="interpretation">${content.interpretation}</div>
      </section>
    `;
  }
}
```

---

## 🔄 Workflow Service

```typescript
class ReportWorkflowService {
  private static TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
    DRAFT: ['GENERATED'],
    GENERATED: ['DRAFT', 'IN_REVIEW'],
    IN_REVIEW: ['GENERATED', 'APPROVED'],
    APPROVED: ['UTILIZED'],
    UTILIZED: [],
  };

  canTransition(from: ReportStatus, to: ReportStatus): boolean {
    return this.TRANSITIONS[from]?.includes(to) ?? false;
  }

  async transition(
    reportId: string,
    targetStatus: ReportStatus,
    userId: string,
    comment?: string
  ): Promise<Report> {
    const report = await this.getReport(reportId);

    if (!this.canTransition(report.status, targetStatus)) {
      throw new Error(`Invalid transition: ${report.status} → ${targetStatus}`);
    }

    // Validate requirements
    await this.validateTransition(report, targetStatus);

    // Update status
    const updated = await this.updateStatus(reportId, targetStatus, userId);

    // Log transition
    await this.logTransition(reportId, report.status, targetStatus, userId, comment);

    // Trigger notifications
    await this.notifyTransition(updated, targetStatus);

    return updated;
  }

  private async validateTransition(report: Report, targetStatus: ReportStatus): Promise<void> {
    switch (targetStatus) {
      case 'GENERATED':
        // Must have all required sections configured
        const requiredSections = report.sections.filter((s) => s.required);
        const enabledRequired = requiredSections.filter((s) => s.enabled);
        if (enabledRequired.length < requiredSections.length) {
          throw new Error('All required sections must be enabled');
        }
        break;

      case 'IN_REVIEW':
        // Must have all enabled sections generated
        const pendingSections = report.sections.filter((s) => s.enabled && !s.generatedContent);
        if (pendingSections.length > 0) {
          throw new Error('All enabled sections must be generated');
        }
        break;

      case 'APPROVED':
        // Must be in review
        if (report.status !== 'IN_REVIEW') {
          throw new Error('Report must be in review to approve');
        }
        break;
    }
  }
}
```

---

## 📚 Referencje

- `00-OVERVIEW.md` - Przegląd modułu
- `02-DATA-MODEL.md` - Model danych
- `backend/03-generation-service.md` - Szczegóły generowania
- `backend/04-export-service.md` - Szczegóły eksportu
