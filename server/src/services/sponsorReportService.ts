/**
 * Sponsor Report Service (T017)
 * Generates sponsor-level analysis reports from approved insights,
 * interview data, and assessment results.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export interface SponsorReportSection {
  id: string;
  title: string;
  content: string;
  order: number;
  evidenceSources: string[];
  sectionType: 'executive_summary' | 'key_findings' | 'insight_detail' | 'assumptions' | 'recommendations' | 'next_steps';
}

export interface SponsorReportData {
  reportId: string;
  title: string;
  sections: SponsorReportSection[];
  assumptions: string[];
  unknowns: string[];
  counterpoints: string[];
  insightSourceIds: string[];
  language: string;
}

const SECTION_TEMPLATES: Record<string, Record<string, { title: string; prompt: string }>> = {
  executive_summary: {
    en: { title: 'Executive Summary', prompt: 'Summarize key findings in 3-5 sentences.' },
    pl: { title: 'Podsumowanie wykonawcze', prompt: 'Podsumuj kluczowe ustalenia w 3-5 zdaniach.' },
  },
  key_findings: {
    en: { title: 'Key Findings', prompt: 'List the most important findings with evidence.' },
    pl: { title: 'Kluczowe ustalenia', prompt: 'Wymień najważniejsze ustalenia z dowodami.' },
  },
  insight_detail: {
    en: { title: 'Detailed Insights', prompt: 'Expand on each approved insight with evidence links.' },
    pl: { title: 'Szczegółowe wnioski', prompt: 'Rozwiń każdy zatwierdzony wniosek z linkami do dowodów.' },
  },
  assumptions: {
    en: { title: 'Assumptions & Unknowns', prompt: 'Document assumptions, unknowns, and counterpoints.' },
    pl: { title: 'Założenia i niewiadome', prompt: 'Udokumentuj założenia, niewiadome i kontrargumenty.' },
  },
  recommendations: {
    en: { title: 'Recommendations', prompt: 'Provide actionable recommendations based on findings.' },
    pl: { title: 'Rekomendacje', prompt: 'Przedstaw rekomendacje oparte na ustaleniach.' },
  },
  next_steps: {
    en: { title: 'Next Steps', prompt: 'Outline proposed next steps with timeline.' },
    pl: { title: 'Następne kroki', prompt: 'Przedstaw proponowane następne kroki z harmonogramem.' },
  },
};

export async function generateSponsorReport(params: {
  organizationId: string;
  projectId?: string;
  assessmentId?: string;
  insightIds?: string[];
  title?: string;
  language?: string;
  createdBy: string;
  templateType?: 'executive_board' | 'owner_pm';
}): Promise<{ reportId: string; sections: SponsorReportSection[] }> {
  const {
    organizationId,
    projectId,
    assessmentId,
    insightIds = [],
    language = 'en',
    createdBy,
    templateType = 'executive_board',
  } = params;

  const reportId = uuidv4();
  const lang = language === 'pl' ? 'pl' : 'en';
  const title = params.title || (lang === 'pl' ? 'Raport sponsorski' : 'Sponsor Analysis Report');

  const insights = insightIds.length > 0
    ? await dbAll(
        `SELECT * FROM interview_insights WHERE id IN (${insightIds.map(() => '?').join(',')}) AND organization_id = ?`,
        [...insightIds, organizationId]
      ) || []
    : await dbAll(
        `SELECT * FROM interview_insights WHERE organization_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 20`,
        [organizationId]
      ) || [];

  let assessmentData: any = null;
  if (assessmentId) {
    assessmentData = await dbGet(`SELECT * FROM assessments WHERE id = ? AND organization_id = ?`, [assessmentId, organizationId]);
  }

  const sections = buildSections(insights, assessmentData, lang, templateType);
  const assumptions = extractAssumptions(insights, lang);
  const unknowns = extractUnknowns(insights, lang);
  const counterpoints = extractCounterpoints(insights, lang);

  await dbRun(
    `INSERT INTO assessment_reports (id, organization_id, project_id, assessment_id, title, status, language,
     sponsor_mode, insight_source_ids, assumptions_json, unknowns_json, counterpoints_json, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, TRUE, ?, ?, ?, ?, ?, NOW())`,
    [
      reportId, organizationId, projectId || null, assessmentId || null, title, lang,
      JSON.stringify(insightIds),
      JSON.stringify(assumptions),
      JSON.stringify(unknowns),
      JSON.stringify(counterpoints),
      createdBy,
    ]
  );

  for (const section of sections) {
    await dbRun(
      `INSERT INTO assessment_report_sections (id, report_id, title, content, section_order, section_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [section.id, reportId, section.title, section.content, section.order, section.sectionType]
    );
  }

  logger.info(`[SponsorReport] Generated report ${reportId} with ${sections.length} sections`);
  return { reportId, sections };
}

function buildSections(
  insights: any[],
  assessmentData: any,
  lang: string,
  templateType: string
): SponsorReportSection[] {
  const sections: SponsorReportSection[] = [];
  let order = 1;

  const insightSummary = insights.map((i: any) => {
    const sc = typeof i.structured_content === 'string' ? JSON.parse(i.structured_content || '{}') : (i.structured_content || {});
    return {
      title: sc.title || i.title || 'Insight',
      finding: sc.whyItMatters || sc.finding || i.content || '',
      recommendation: sc.recommendation || '',
      confidence: i.confidence_score || sc.confidence || 50,
      category: i.insight_category || sc.category || 'general',
    };
  });

  const execTemplate = SECTION_TEMPLATES.executive_summary[lang] || SECTION_TEMPLATES.executive_summary.en;
  const execContent = insightSummary.length > 0
    ? insightSummary.slice(0, 5).map((i: any) => `• ${i.title}: ${i.finding}`).join('\n')
    : (lang === 'pl' ? 'Brak danych do podsumowania.' : 'No data available for summary.');

  sections.push({
    id: uuidv4(), title: execTemplate.title, content: execContent,
    order: order++, evidenceSources: insights.map((i: any) => i.id), sectionType: 'executive_summary',
  });

  if (insightSummary.length > 0) {
    const findingsTemplate = SECTION_TEMPLATES.key_findings[lang] || SECTION_TEMPLATES.key_findings.en;
    const findingsContent = insightSummary
      .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 8)
      .map((i: any, idx: number) => `${idx + 1}. **${i.title}** (${lang === 'pl' ? 'pewność' : 'confidence'}: ${i.confidence}%)\n   ${i.finding}`)
      .join('\n\n');

    sections.push({
      id: uuidv4(), title: findingsTemplate.title, content: findingsContent,
      order: order++, evidenceSources: insights.map((i: any) => i.id), sectionType: 'key_findings',
    });
  }

  if (insightSummary.some((i: any) => i.recommendation)) {
    const recsTemplate = SECTION_TEMPLATES.recommendations[lang] || SECTION_TEMPLATES.recommendations.en;
    const recsContent = insightSummary
      .filter((i: any) => i.recommendation)
      .map((i: any, idx: number) => `${idx + 1}. ${i.recommendation}`)
      .join('\n');

    sections.push({
      id: uuidv4(), title: recsTemplate.title, content: recsContent,
      order: order++, evidenceSources: [], sectionType: 'recommendations',
    });
  }

  const assumptionsTemplate = SECTION_TEMPLATES.assumptions[lang] || SECTION_TEMPLATES.assumptions.en;
  sections.push({
    id: uuidv4(), title: assumptionsTemplate.title,
    content: lang === 'pl'
      ? 'Wnioski oparte na zatwierdzonych danych z wywiadów i ocen. Pełna weryfikacja wymaga dalszych konsultacji.'
      : 'Findings based on approved interview and assessment data. Full verification requires further consultation.',
    order: order++, evidenceSources: [], sectionType: 'assumptions',
  });

  const nextTemplate = SECTION_TEMPLATES.next_steps[lang] || SECTION_TEMPLATES.next_steps.en;
  sections.push({
    id: uuidv4(), title: nextTemplate.title,
    content: lang === 'pl'
      ? '1. Przegląd ustaleń z kluczowymi interesariuszami\n2. Priorytetyzacja rekomendacji\n3. Zdefiniowanie budżetów i właścicieli inicjatyw\n4. Ustalenie kadencji przeglądu postępów'
      : '1. Review findings with key stakeholders\n2. Prioritize recommendations\n3. Define budgets and initiative owners\n4. Establish progress review cadence',
    order: order++, evidenceSources: [], sectionType: 'next_steps',
  });

  return sections;
}

function extractAssumptions(insights: any[], lang: string): string[] {
  const result: string[] = [];
  for (const i of insights) {
    const sc = typeof i.structured_content === 'string' ? JSON.parse(i.structured_content || '{}') : (i.structured_content || {});
    const assumptions = typeof i.assumptions === 'string' ? JSON.parse(i.assumptions || '[]') : (i.assumptions || sc.assumptions || []);
    if (Array.isArray(assumptions)) result.push(...assumptions.map(String));
  }
  if (result.length === 0) {
    result.push(lang === 'pl' ? 'Wnioski oparte na dostępnych danych' : 'Findings based on available data');
  }
  return [...new Set(result)];
}

function extractUnknowns(insights: any[], lang: string): string[] {
  const result: string[] = [];
  for (const i of insights) {
    const sc = typeof i.structured_content === 'string' ? JSON.parse(i.structured_content || '{}') : (i.structured_content || {});
    const unknowns = typeof i.unknowns === 'string' ? JSON.parse(i.unknowns || '[]') : (i.unknowns || sc.unknowns || []);
    if (Array.isArray(unknowns)) result.push(...unknowns.map(String));
  }
  return [...new Set(result)];
}

function extractCounterpoints(insights: any[], lang: string): string[] {
  const result: string[] = [];
  for (const i of insights) {
    const sc = typeof i.structured_content === 'string' ? JSON.parse(i.structured_content || '{}') : (i.structured_content || {});
    const cp = typeof i.counterpoints === 'string' ? JSON.parse(i.counterpoints || '[]') : (i.counterpoints || sc.counterpoints || []);
    if (Array.isArray(cp)) result.push(...cp.map(String));
  }
  return [...new Set(result)];
}

export async function getReport(reportId: string, organizationId: string): Promise<any> {
  const report = await dbGet(
    `SELECT * FROM assessment_reports WHERE id = ? AND organization_id = ? AND sponsor_mode = TRUE`,
    [reportId, organizationId]
  );
  if (!report) return null;

  const sections = await dbAll(
    `SELECT * FROM assessment_report_sections WHERE report_id = ? ORDER BY section_order`,
    [reportId]
  ) || [];

  return { ...report, sections };
}

export async function listReports(organizationId: string): Promise<any[]> {
  return (await dbAll(
    `SELECT id, title, status, language, created_by, created_at, utilized_at
     FROM assessment_reports WHERE organization_id = ? AND sponsor_mode = TRUE ORDER BY created_at DESC`,
    [organizationId]
  )) || [];
}

export async function updateSection(sectionId: string, reportId: string, content: string): Promise<void> {
  await dbRun(
    `UPDATE assessment_report_sections SET content = ?, updated_at = NOW() WHERE id = ? AND report_id = ?`,
    [content, sectionId, reportId]
  );
}

export async function updateReportStatus(
  reportId: string,
  organizationId: string,
  status: string,
  params?: { approvedBy?: string; rejectedReason?: string; utilizationNotes?: string }
): Promise<void> {
  const validStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FINAL', 'UTILIZED', 'ARCHIVED'];
  if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`);

  let extra = '';
  const values: any[] = [status];

  if (status === 'APPROVED' && params?.approvedBy) {
    extra += ', approved_by = ?';
    values.push(params.approvedBy);
  }
  if (status === 'REJECTED' && params?.rejectedReason) {
    extra += ', rejected_reason = ?';
    values.push(params.rejectedReason);
  }
  if (status === 'UTILIZED') {
    extra += ', utilized_at = NOW()';
    if (params?.utilizationNotes) {
      extra += ', utilization_notes = ?';
      values.push(params.utilizationNotes);
    }
  }

  values.push(reportId, organizationId);
  await dbRun(
    `UPDATE assessment_reports SET status = ?${extra} WHERE id = ? AND organization_id = ? AND sponsor_mode = TRUE`,
    values
  );
}

export async function getReportForExport(reportId: string, organizationId: string): Promise<SponsorReportData | null> {
  const report = await getReport(reportId, organizationId);
  if (!report) return null;

  return {
    reportId: report.id,
    title: report.title,
    sections: (report.sections || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      content: s.content,
      order: s.section_order,
      evidenceSources: [],
      sectionType: s.section_type || 'key_findings',
    })),
    assumptions: JSON.parse(report.assumptions_json || '[]'),
    unknowns: JSON.parse(report.unknowns_json || '[]'),
    counterpoints: JSON.parse(report.counterpoints_json || '[]'),
    insightSourceIds: JSON.parse(report.insight_source_ids || '[]'),
    language: report.language || 'en',
  };
}
