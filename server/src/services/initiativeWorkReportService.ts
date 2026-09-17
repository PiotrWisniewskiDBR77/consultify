import PDFDocument from 'pdfkit';
import path from 'node:path';

import { PDF_FONT, PDF_FONT_DIR } from '../utils/pdfFonts.js';

export const INITIATIVE_WORK_REPORT_TEMPLATES = [
  'EXECUTIVE_SUMMARY',
  'PORTFOLIO_STATUS',
  'DECISION_BACKLOG',
  'DELIVERY_RISKS',
  'WEEKLY_TEAM_UPDATE',
  'WORKLOAD_CAPACITY',
] as const;

export type InitiativeWorkReportTemplate = (typeof INITIATIVE_WORK_REPORT_TEMPLATES)[number];

export interface InitiativeWorkReportContent {
  generatedAt: string;
  title: string;
  templateId: InitiativeWorkReportTemplate;
  projectIds: string[];
  summary: {
    initiatives: number;
    pendingDecisions: number;
    overdueDecisions: number;
    byStatus: Record<string, number>;
  };
  initiatives: Array<{
    id: string;
    version: number;
    title: string;
    status: string;
    projectId: string | null;
    ownerId: string | null;
    updatedAt: string;
  }>;
  decisionDebtors: Array<{
    authorityId: string;
    authorityName: string;
    pending: number;
    overdue: number;
    oldestDueAt: string | null;
  }>;
  workload?: {
    weeks: string[];
    people: Array<{
      userId: string;
      name: string;
      weeklyCapacityHours: number;
      availabilityPercent: number;
    }>;
    rows: Array<{
      userId: string;
      weekStart: string;
      demandHours: number;
      supplyHours: number;
      utilizationPercent: number;
      capacityExceeded: boolean;
    }>;
    overloadedCount: number;
  };
}

const safeText = (value: unknown, fallback: string) => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

/** Human labels for the raw template codes (Wpis 50 part B — no raw enum in the PDF). */
const TEMPLATE_LABELS: Record<InitiativeWorkReportTemplate, string> = {
  EXECUTIVE_SUMMARY: 'Executive summary',
  PORTFOLIO_STATUS: 'Portfolio status',
  DECISION_BACKLOG: 'Decision backlog',
  DELIVERY_RISKS: 'Delivery risks',
  WEEKLY_TEAM_UPDATE: 'Weekly team update',
  WORKLOAD_CAPACITY: 'Workload & capacity',
};

const templateLabel = (id: InitiativeWorkReportTemplate) => TEMPLATE_LABELS[id] ?? id;

/** Initiative status codes (IN_EXECUTION, DRAFT, UNKNOWN, …) → readable words. */
const statusLabel = (status: unknown) =>
  safeText(status, 'UNKNOWN')
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

/** UI date format (date-only) so the PDF matches the on-screen tables. */
const formatDate = (value: string | null | undefined, fallback = 'not set') => {
  if (!value) return fallback;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : fallback;
};

/** UI timestamp format for the generated-at line. */
const formatTimestamp = (value: string) => {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
};

export function selectInitiativeWorkReportSections(content: InitiativeWorkReportContent) {
  const recentThreshold = new Date(content.generatedAt).getTime() - 7 * 86_400_000;
  switch (content.templateId) {
    case 'EXECUTIVE_SUMMARY':
      return {
        initiativeHeading: 'Priority initiatives',
        initiatives: content.initiatives.slice(0, 5),
        decisionDebtors: content.decisionDebtors.slice(0, 5),
      };
    case 'PORTFOLIO_STATUS':
      return {
        initiativeHeading: 'Initiatives',
        initiatives: content.initiatives,
        decisionDebtors: [],
      };
    case 'DECISION_BACKLOG':
      return {
        initiativeHeading: null,
        initiatives: [],
        decisionDebtors: content.decisionDebtors,
      };
    case 'DELIVERY_RISKS':
      return {
        initiativeHeading: 'Initiatives requiring attention',
        initiatives: content.initiatives.filter((item) =>
          /BLOCK|RISK|DELAY|ESCALAT/i.test(item.status)
        ),
        decisionDebtors: content.decisionDebtors.filter((debtor) => debtor.overdue > 0),
      };
    case 'WEEKLY_TEAM_UPDATE':
      return {
        initiativeHeading: 'Initiatives updated this week',
        initiatives: content.initiatives.filter(
          (item) => new Date(item.updatedAt).getTime() >= recentThreshold
        ),
        decisionDebtors: content.decisionDebtors,
      };
    case 'WORKLOAD_CAPACITY':
      return {
        initiativeHeading: null,
        initiatives: [],
        decisionDebtors: [],
      };
  }
}

export async function renderInitiativeWorkReportPdf(
  content: InitiativeWorkReportContent
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
  // Register by path: pdfkit 0.17 accepts the vendored TrueType path in all
  // supported runtimes, while Buffer registration is broken under pnpm/symlinked
  // dependency layouts. Both files and names remain the shared DEC-132 SSOT.
  doc.registerFont(PDF_FONT.regular, path.join(PDF_FONT_DIR, 'Lato-Regular.ttf'));
  doc.registerFont(PDF_FONT.bold, path.join(PDF_FONT_DIR, 'Lato-Bold.ttf'));
  doc.registerFont(PDF_FONT.italic, path.join(PDF_FONT_DIR, 'Lato-Italic.ttf'));
  doc.registerFont(PDF_FONT.boldItalic, path.join(PDF_FONT_DIR, 'Lato-BoldItalic.ttf'));
  doc.font(PDF_FONT.regular);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.font(PDF_FONT.bold).fontSize(22).fillColor('#0f172a').text(content.title);
  doc.moveDown(0.4);
  doc
    .font(PDF_FONT.regular)
    .fontSize(9)
    .fillColor('#64748b')
    .text(`Generated ${formatTimestamp(content.generatedAt)} · ${templateLabel(content.templateId)}`);
  doc.moveDown(1.2);
  doc.font(PDF_FONT.bold).fontSize(13).fillColor('#0f172a').text('Portfolio summary');
  doc.font(PDF_FONT.regular).fontSize(10).fillColor('#334155');
  doc.text(`Initiatives: ${content.summary.initiatives}`);
  doc.text(`Pending decisions: ${content.summary.pendingDecisions}`);
  doc.text(`Overdue decisions: ${content.summary.overdueDecisions}`);
  for (const [status, count] of Object.entries(content.summary.byStatus)) {
    doc.text(`${statusLabel(status)}: ${count}`);
  }

  if (content.templateId === 'WORKLOAD_CAPACITY' && content.workload) {
    doc.moveDown(1.2);
    doc.font(PDF_FONT.bold).fontSize(13).fillColor('#0f172a').text('Workload by person and week');
    doc
      .font(PDF_FONT.regular)
      .fontSize(10)
      .fillColor('#334155')
      .text(`Overloaded person-weeks: ${content.workload.overloadedCount}`);
    for (const person of content.workload.people) {
      if (doc.y > 700) doc.addPage();
      doc.font(PDF_FONT.bold).fontSize(10).fillColor('#0f172a').text(person.name);
      const cells = content.workload.rows
        .filter((row) => row.userId === person.userId)
        .map(
          (row) =>
            `${row.weekStart}: ${row.capacityExceeded ? 'NO CAPACITY' : `${row.utilizationPercent}%`} (${row.demandHours}h / ${row.supplyHours}h)`
        );
      doc.font(PDF_FONT.regular).fontSize(9).fillColor('#475569').text(cells.join(' · '));
    }
  }

  const selected = selectInitiativeWorkReportSections(content);
  const showInitiatives = selected.initiativeHeading !== null;
  const showDecisionOwners = content.templateId !== 'PORTFOLIO_STATUS';
  const initiatives = selected.initiatives;

  if (showInitiatives) {
    doc.moveDown(1.2);
    doc
      .font(PDF_FONT.bold)
      .fontSize(13)
      .fillColor('#0f172a')
      .text(selected.initiativeHeading ?? 'Initiatives');
    if (initiatives.length === 0) {
      doc
        .font(PDF_FONT.italic)
        .fontSize(10)
        .fillColor('#64748b')
        .text(
          content.templateId === 'DELIVERY_RISKS'
            ? 'No initiatives requiring attention.'
            : 'No initiatives in scope.'
        );
    }
    for (const item of initiatives) {
      if (doc.y > 730) doc.addPage();
      doc.font(PDF_FONT.bold).fontSize(10).fillColor('#0f172a').text(item.title);
      doc
        .font(PDF_FONT.regular)
        .fontSize(9)
        .fillColor('#475569')
        .text(
          `${item.status} · project ${item.projectId ?? 'unassigned'} · owner ${item.ownerId ?? 'unassigned'}`
        );
    }
  }

  if (showDecisionOwners) {
    doc.moveDown(1.2);
    if (doc.y > 680) doc.addPage();
    doc.font(PDF_FONT.bold).fontSize(13).fillColor('#0f172a').text('Decision owners');
    if (selected.decisionDebtors.length === 0) {
      doc.font(PDF_FONT.italic).fontSize(10).fillColor('#64748b').text('No pending decisions.');
    }
    for (const debtor of selected.decisionDebtors) {
      if (doc.y > 730) doc.addPage();
      doc.font(PDF_FONT.bold).fontSize(10).fillColor('#0f172a').text(debtor.authorityName);
      doc
        .font(PDF_FONT.regular)
        .fontSize(9)
        .fillColor('#475569')
        .text(
          `Pending ${debtor.pending} · overdue ${debtor.overdue} · oldest due ${formatDate(debtor.oldestDueAt)}`
        );
    }
  }

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc
      .font(PDF_FONT.regular)
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(`Consultify · ${index + 1}/${range.count}`, 48, doc.page.height - 32, {
        align: 'right',
      });
  }
  doc.end();
  return completed;
}
