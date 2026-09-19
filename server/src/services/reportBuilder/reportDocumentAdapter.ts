export type ReportDocumentSourceType = 'MANAGEMENT_REPORT' | 'AUDIT_REPORT';

export type ReportDocumentSection = {
  id: string;
  reportId: string;
  sectionKey: string;
  sectionType: string;
  title: string;
  orderIndex: number;
  enabled: boolean;
  required: boolean;
  length: 'short' | 'medium' | 'long';
  language: 'business';
  generatedContent: string;
  editedContent?: string;
  contentFormat: 'markdown';
  sourceDataSnapshot?: string;
  generatedAt?: string | null;
};

export type ReportDocumentReport = {
  id: string;
  organizationId?: string | null;
  projectId?: string | null;
  sourceType: ReportDocumentSourceType;
  sourceId: string;
  sourceName?: string | null;
  title: string;
  description?: string | null;
  reportType: string;
  status?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  generatedAt?: string | null;
  version?: number | null;
  config?: Record<string, unknown>;
};

export type ReportBuilderDocument = {
  report: ReportDocumentReport;
  sections: ReportDocumentSection[];
};

type ManagementReportLike = {
  id?: string;
  organizationId?: string | null;
  projectId?: string | null;
  reportType?: string;
  scope?: string;
  title?: string;
  status?: string | null;
  generatedBy?: string | null;
  content?: Record<string, unknown> | null;
  aiNarrative?: string | null;
  aiWarnings?: unknown;
  createdAt?: string | null;
  updatedAt?: string | null;
  currentVersion?: number | null;
};

type AuditReportLike = {
  id?: string;
  programId?: string | null;
  organizationId?: string | null;
  outputId?: string | null;
  version?: number | null;
  reportKind?: string;
  title?: string;
  status?: string | null;
  payload?: { sections?: Array<Record<string, unknown>>; generatedAt?: string | null; asOfDate?: string | null } | null;
  createdBy?: string | null;
  generatedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const SECTION_TITLE_OVERRIDES: Record<string, string> = {
  aiNarrative: 'Narrative',
  executiveSummary: 'Executive summary',
  statusSummary: 'Status summary',
  completedWork: 'Completed work',
  workInProgress: 'Work in progress',
  blockers: 'Blockers',
  pendingDecisions: 'Pending decisions',
  nextPeriodPlan: 'Next period plan',
  portfolioSummary: 'Portfolio summary',
  projectHealth: 'Project health',
  riskSummary: 'Risk summary',
  issues: 'Issues',
  risks: 'Risks',
  assumptions: 'Assumptions',
  dependencies: 'Dependencies',
};

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function valueToMarkdown(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    return value
      .map((item) => {
        if (typeof item === 'string') return `- ${item}`;
        const title =
          typeof item === 'object' && item !== null
            ? valueToString((item as Record<string, unknown>).title || (item as Record<string, unknown>).name || '')
            : '';
        const body = valueToString(item);
        return title ? `- **${title}**\n\n\`\`\`json\n${body}\n\`\`\`` : `- ${body}`;
      })
      .join('\n');
  }

  if (value && typeof value === 'object') {
    return `\`\`\`json\n${valueToString(value)}\n\`\`\``;
  }

  return valueToString(value);
}

function sectionTitle(key: string): string {
  if (SECTION_TITLE_OVERRIDES[key]) return SECTION_TITLE_OVERRIDES[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (first) => first.toUpperCase());
}

function safeKey(value: unknown, fallback: string): string {
  const raw = valueToString(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return raw || fallback;
}

function buildSection(args: {
  reportId: string;
  key: string;
  title?: string;
  content: unknown;
  index: number;
  generatedAt?: string | null;
}): ReportDocumentSection | null {
  const generatedContent = valueToMarkdown(args.content);
  if (!generatedContent.trim()) return null;
  const sectionKey = safeKey(args.key, `section_${args.index + 1}`);
  return {
    id: `${args.reportId}:${sectionKey}`,
    reportId: args.reportId,
    sectionKey,
    sectionType: 'content',
    title: args.title || sectionTitle(sectionKey),
    orderIndex: args.index,
    enabled: true,
    required: args.index === 0,
    length: 'medium',
    language: 'business',
    generatedContent,
    contentFormat: 'markdown',
    sourceDataSnapshot: valueToString(args.content),
    generatedAt: args.generatedAt ?? null,
  };
}

export function adaptManagementReportToReportBuilderDocument(
  report: ManagementReportLike,
): ReportBuilderDocument {
  const reportId = String(report.id || 'management-report');
  const sections: ReportDocumentSection[] = [];

  const narrative = valueToString(report.aiNarrative);
  if (narrative) {
    const section = buildSection({
      reportId,
      key: 'aiNarrative',
      title: 'Management narrative',
      content: narrative,
      index: sections.length,
      generatedAt: report.createdAt ?? null,
    });
    if (section) sections.push(section);
  }

  const content = report.content && typeof report.content === 'object' ? report.content : {};
  for (const [key, value] of Object.entries(content)) {
    const section = buildSection({
      reportId,
      key,
      title: sectionTitle(key),
      content: value,
      index: sections.length,
      generatedAt: report.createdAt ?? null,
    });
    if (section) sections.push(section);
  }

  return {
    report: {
      id: reportId,
      organizationId: report.organizationId ?? null,
      projectId: report.projectId ?? null,
      sourceType: 'MANAGEMENT_REPORT',
      sourceId: reportId,
      sourceName: report.scope ? String(report.scope) : null,
      title: String(report.title || 'Management report'),
      description: null,
      reportType: String(report.reportType || 'MANAGEMENT_REPORT'),
      status: report.status ?? null,
      createdBy: report.generatedBy ?? null,
      createdAt: report.createdAt ?? null,
      updatedAt: report.updatedAt ?? null,
      generatedAt: report.createdAt ?? null,
      version: typeof report.currentVersion === 'number' ? report.currentVersion : null,
      config: { legacyContract: 'management-reports' },
    },
    sections,
  };
}

export function adaptAuditReportToReportBuilderDocument(report: AuditReportLike): ReportBuilderDocument {
  const reportId = String(report.id || 'audit-report');
  const payload = report.payload && typeof report.payload === 'object' ? report.payload : {};
  const payloadSections = Array.isArray(payload.sections) ? payload.sections : [];
  const sections = payloadSections
    .map((section, index) =>
      buildSection({
        reportId,
        key: valueToString(section.id) || `section_${index + 1}`,
        title: valueToString(section.title) || undefined,
        content: section.content,
        index,
        generatedAt: payload.generatedAt ?? report.generatedAt ?? null,
      }),
    )
    .filter((section): section is ReportDocumentSection => Boolean(section));

  return {
    report: {
      id: reportId,
      organizationId: report.organizationId ?? null,
      projectId: report.programId ?? null,
      sourceType: 'AUDIT_REPORT',
      sourceId: report.outputId || report.programId || reportId,
      sourceName: report.programId ?? null,
      title: String(report.title || 'Audit report'),
      description: null,
      reportType: String(report.reportKind || 'audit_report'),
      status: report.status ?? null,
      createdBy: report.createdBy ?? null,
      createdAt: report.createdAt ?? null,
      updatedAt: report.updatedAt ?? null,
      generatedAt: report.generatedAt ?? payload.generatedAt ?? null,
      version: typeof report.version === 'number' ? report.version : null,
      config: { legacyContract: 'audits/reports' },
    },
    sections,
  };
}
