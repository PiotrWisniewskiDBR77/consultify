/**
 * Knowledge Base Editorial QA Audit
 *
 * Builds a report for the top 50 sales-critical articles using manifest data.
 *
 * Usage:
 *   npx tsx scripts/audit-kb-editorial.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const READY_ROOT = path.join(ROOT, 'Blogs', '_LP_KB_READY');
const BLOGS_ROOT = path.join(ROOT, 'Blogs');
const REPORT_PATH = path.join(
  ROOT,
  'Blogs',
  '_SYSTEM',
  'lp_kb',
  'DBR77_LP_EDITORIAL_QA_REPORT.md'
);

const METADATA_LINE =
  /^(Target persona|Funnel stage|Core problem|Main promise|Docelowa persona|Etap lejka|Główny problem|Główna obietnica|Zielpersona|Funnel-Stufe|Kernproblem|Hauptversprechen):/i;

interface ManifestArticle {
  slug: string;
  product: string;
  title: string;
  featured?: boolean;
  mva_role?: string | null;
  locales: Record<string, { path: string }>;
}

interface ManifestFile {
  product: string;
  sections: Array<{ featured_slugs?: string[] }>;
  articles: ManifestArticle[];
}

interface LocaleAudit {
  locale: string;
  exists: boolean;
  bulletCount: number;
  paragraphCount: number;
  firstBodyIsNarrative: boolean;
  heavyListSections: number;
}

interface ArticleAudit {
  product: string;
  slug: string;
  title: string;
  featured: boolean;
  locales: LocaleAudit[];
  passed: boolean;
}

function listManifestPaths(): string[] {
  return fs.readdirSync(READY_ROOT)
    .map((entry) => path.join(READY_ROOT, entry, 'knowledge_base_manifest.json'))
    .filter((filePath) => fs.existsSync(filePath));
}

function readManifest(filePath: string): ManifestFile {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function scoreArticle(article: ManifestArticle, featuredSlugs: Set<string>): number {
  let score = 0;
  if (article.featured) score += 100;
  if (featuredSlugs.has(article.slug)) score += 100;
  if (article.mva_role?.includes('flagship')) score += 20;
  return score;
}

function pickTop50(): ManifestArticle[] {
  const all: Array<{ article: ManifestArticle; score: number }> = [];

  for (const manifestPath of listManifestPaths()) {
    const manifest = readManifest(manifestPath);
    const featuredSlugs = new Set(
      manifest.sections.flatMap((section) => section.featured_slugs || [])
    );

    for (const article of manifest.articles) {
      all.push({ article, score: scoreArticle(article, featuredSlugs) });
    }
  }

  return all
    .sort((a, b) => b.score - a.score || a.article.product.localeCompare(b.article.product) || a.article.slug.localeCompare(b.article.slug))
    .slice(0, 50)
    .map((item) => item.article);
}

function stripOperationalHeader(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let index = 0;
  if (lines[index]?.startsWith('# ')) index += 1;
  while (index < lines.length && lines[index].trim() === '') index += 1;
  while (index < lines.length && METADATA_LINE.test(lines[index].trim())) index += 1;
  while (index < lines.length && lines[index].trim() === '') index += 1;
  return lines.slice(index).join('\n').trim();
}

function splitBlocks(content: string): string[] {
  return content.trim().split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean);
}

function auditLocale(product: string, locale: string, relPath: string): LocaleAudit {
  const filePath = path.join(BLOGS_ROOT, product, 'Blog', relPath);
  if (!fs.existsSync(filePath)) {
    return {
      locale,
      exists: false,
      bulletCount: 0,
      paragraphCount: 0,
      firstBodyIsNarrative: false,
      heavyListSections: 0,
    };
  }

  const body = stripOperationalHeader(fs.readFileSync(filePath, 'utf-8'));
  const blocks = splitBlocks(body);
  const firstBodyBlock = blocks[0] || '';
  const bulletCount = body.split('\n').filter((line) => /^[-*]\s+/.test(line.trim())).length;
  const paragraphCount = blocks.filter((block) => !/^#{1,6}\s+/.test(block) && !/^[-*]\s+/m.test(block) && !/^\d+\.\s+/m.test(block) && !/^\|/.test(block)).length;
  const heavyListSections = blocks.filter((block) => {
    const lines = block.split('\n').filter(Boolean);
    return lines.length >= 4 && lines.every((line) => /^[-*]\s+/.test(line.trim()) || /^\d+\.\s+/.test(line.trim()));
  }).length;

  return {
    locale,
    exists: true,
    bulletCount,
    paragraphCount,
    firstBodyIsNarrative: firstBodyBlock.length > 0 && !/^[-*]\s+/.test(firstBodyBlock) && !/^\d+\.\s+/.test(firstBodyBlock),
    heavyListSections,
  };
}

function auditTop50(): ArticleAudit[] {
  return pickTop50().map((article) => {
    const locales: LocaleAudit[] = ['EN', 'PL', 'DE'].map((locale) => {
      const localePath = article.locales?.[locale]?.path;
      return auditLocale(article.product, locale, localePath || `${article.slug}/article_${locale}.md`);
    });

    const passed = locales.every((locale) => {
      return locale.exists && locale.firstBodyIsNarrative && locale.heavyListSections <= 2;
    });

    return {
      product: article.product,
      slug: article.slug,
      title: article.title,
      featured: Boolean(article.featured),
      locales,
      passed,
    };
  });
}

function buildReport(audits: ArticleAudit[]): string {
  const passed = audits.filter((item) => item.passed);
  const failed = audits.filter((item) => !item.passed);

  const lines: string[] = [];
  lines.push('# DBR77 LP Editorial QA Report');
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('- top 50 sales-critical knowledge-base articles selected from `_LP_KB_READY/*/knowledge_base_manifest.json`');
  lines.push('- locale check across `EN`, `PL`, and `DE`');
  lines.push('- editorial checks: narrative opening, limited heavy list sections, file presence');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Articles audited: ${audits.length}`);
  lines.push(`- Passed: ${passed.length}`);
  lines.push(`- Flagged: ${failed.length}`);
  lines.push('');

  if (failed.length) {
    lines.push('## Flagged Articles');
    lines.push('');
    for (const item of failed) {
      const localeSummary = item.locales
        .map((locale) => `${locale.locale}: narrative=${locale.firstBodyIsNarrative ? 'yes' : 'no'}, heavyLists=${locale.heavyListSections}, bullets=${locale.bulletCount}`)
        .join(' | ');
      lines.push(`- ${item.product} / ${item.slug} — ${localeSummary}`);
    }
    lines.push('');
  }

  lines.push('## Pass Samples');
  lines.push('');
  for (const item of passed.slice(0, 20)) {
    const localeSummary = item.locales
      .map((locale) => `${locale.locale}: bullets=${locale.bulletCount}, heavyLists=${locale.heavyListSections}`)
      .join(' | ');
    lines.push(`- ${item.product} / ${item.slug} — ${localeSummary}`);
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main() {
  const audits = auditTop50();
  const report = buildReport(audits);
  fs.writeFileSync(REPORT_PATH, report, 'utf-8');
  console.log(`Editorial QA report written to ${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`Audited ${audits.length} articles; flagged ${audits.filter((item) => !item.passed).length}.`);
}

main();
