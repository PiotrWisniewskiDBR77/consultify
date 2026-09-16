import createDOMPurify from 'dompurify';
import fs from 'fs';
import Handlebars from 'handlebars';
import { JSDOM } from 'jsdom';
import path from 'path';
import { fileURLToPath } from 'url';

const purifyWindow = new JSDOM('').window;
const htmlPurifier = createDOMPurify(
  purifyWindow as unknown as Parameters<typeof createDOMPurify>[0]
);

export function sanitizePremiumReportContent(value: unknown): string {
  return htmlPurifier.sanitize(String(value ?? ''), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  });
}

export interface PremiumReportTemplateSection {
  title?: unknown;
  sectionType?: unknown;
  content?: unknown;
  [key: string]: unknown;
}

export interface PremiumReportTemplateData {
  sections?: PremiumReportTemplateSection[];
  [key: string]: unknown;
}

let compiledTemplate: HandlebarsTemplateDelegate | null = null;

function template(): HandlebarsTemplateDelegate {
  if (compiledTemplate) return compiledTemplate;
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = [
    path.resolve(currentDir, '../../templates/premium-report.hbs'),
    path.resolve(process.cwd(), 'server/src/templates/premium-report.hbs'),
    path.resolve(process.cwd(), 'src/templates/premium-report.hbs'),
  ].find((candidate) => fs.existsSync(candidate));
  if (!templatePath) {
    throw new Error('PREMIUM_REPORT_TEMPLATE_NOT_FOUND');
  }
  compiledTemplate = Handlebars.compile(fs.readFileSync(templatePath, 'utf8'), { noEscape: false });
  return compiledTemplate;
}

/**
 * Canonical server boundary for premium-report HTML. Editor content is rich
 * HTML, so Handlebars escaping alone would destroy formatting. Every section
 * receives a separately sanitized `safeContent`; the template never injects
 * the raw `content` property.
 */
export function renderPremiumReportHtml(data: PremiumReportTemplateData): string {
  const sections = (data.sections ?? []).map((section) => ({
    ...section,
    safeContent: sanitizePremiumReportContent(section.content),
  }));

  const helpers = {
    formatDate: (value: unknown) => String(value ?? ''),
    formatNumber: (value: unknown) => String(value ?? ''),
    gt: (left: unknown, right: unknown) => Number(left) > Number(right),
    getGapColor: () => '#475569',
    multiply: (left: unknown, right: unknown) => Number(left) * Number(right),
  };

  return template()({ ...data, sections }, { helpers });
}
