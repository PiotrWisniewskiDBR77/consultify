/**
 * Knowledge Base Editorial Rewrite
 *
 * Deterministically rewrites knowledge-base markdown articles so they read more
 * like decision articles and less like bullet-point decks.
 *
 * Usage:
 *   npx tsx scripts/rewrite-kb-editorial.ts [--dry-run] [--product Consultify]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const BLOGS_ROOT = path.join(ROOT, 'Blogs');
const DRY_RUN = process.argv.includes('--dry-run');
const PRODUCT_FILTER = (() => {
  const idx = process.argv.indexOf('--product');
  return idx >= 0 ? process.argv[idx + 1] : null;
})();
const FILE_FILTER = (() => {
  const idx = process.argv.indexOf('--file');
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

const GOLDEN_SAMPLE_SLUGS = new Set([
  '02_10_questions_before_buying_ai_consulting_platform',
  '50_how_to_build_a_manufacturing_ai_governance_system_that_survives_scale',
  '28_what_internal_red_flags_should_pause_an_automation_buying_process',
  '21_how_ai_is_changing_factory_operations_when_execution_is_connected',
]);

const DIRECT_ANSWER_HEADING = /^##\s+(Direct answer|Bezpośrednia odpowiedź|Direkte Antwort)\s*$/i;
const H3_COMBINE_PATTERN = /^###\s+((Element|Loop|Pillar)\s+\d+:.+)$/i;
const METADATA_LINE =
  /^(Target persona|Funnel stage|Core problem|Main promise|Docelowa persona|Etap lejka|Główny problem|Główna obietnica|Zielpersona|Funnel-Stufe|Kernproblem|Hauptversprechen):/i;

const ALLOWED_LIST_KEYWORDS = [
  'checklist',
  'scorecard',
  'red flag',
  'vendor',
  'vendor questions',
  'questions to ask',
  '10 questions',
  'leadership',
  'what leadership gets',
  'pause decision record',
  'self-test',
  'framework',
  'annual governance health minimum',
  'check',
  'checks',
  'lista kontrolna',
  'lista pytań',
  'czerwona flaga',
  'wynik',
  'scorecard',
  'checkliste',
  'rote flagge',
  'fragen',
  'führung',
];

interface ArticleMetrics {
  path: string;
  beforeBullets: number;
  afterBullets: number;
  beforeParagraphs: number;
  afterParagraphs: number;
  mergedShortParagraphs: number;
  convertedLists: number;
  changed: boolean;
}

interface Block {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'hr' | 'quote' | 'other';
  lines: string[];
}

function listProductDirs(): string[] {
  return fs.readdirSync(BLOGS_ROOT).filter((entry) => {
    if (entry.startsWith('_')) return false;
    if (PRODUCT_FILTER && entry !== PRODUCT_FILTER) return false;
    const blogDir = path.join(BLOGS_ROOT, entry, 'Blog');
    return fs.existsSync(blogDir) && fs.statSync(blogDir).isDirectory();
  });
}

function listArticleFiles(product: string): string[] {
  const blogDir = path.join(BLOGS_ROOT, product, 'Blog');
  const result: string[] = [];
  for (const entry of fs.readdirSync(blogDir)) {
    const full = path.join(blogDir, entry);
    if (!fs.statSync(full).isDirectory()) continue;
    if (/^(00_|_archive_)/.test(entry)) continue;
    if (!/^\d+_/.test(entry)) continue;
    for (const locale of ['EN', 'PL', 'DE']) {
      const file = path.join(full, `article_${locale}.md`);
      if (fs.existsSync(file)) result.push(file);
    }
  }
  return result;
}

function countBullets(content: string): number {
  return content.split('\n').filter((line) => /^[-*]\s+/.test(line.trim())).length;
}

function countParagraphBlocks(content: string): number {
  return splitBlocks(content).filter((block) => block.type === 'paragraph').length;
}

function splitBlocks(content: string): Block[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const chunks = normalized.split(/\n{2,}/);

  return chunks.map((chunk) => {
    const lines = chunk.split('\n');
    const trimmed = lines.map((line) => line.trim()).filter(Boolean);
    const first = trimmed[0] || '';
    if (!trimmed.length) return { type: 'other' as const, lines };
    if (trimmed.every((line) => /^#{1,6}\s+/.test(line))) return { type: 'heading', lines };
    if (trimmed.every((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))) return { type: 'list', lines };
    if (trimmed.every((line) => /^\|.*\|$/.test(line) || /^\|[-: ]+\|$/.test(line))) return { type: 'table', lines };
    if (trimmed.every((line) => /^---+$/.test(line))) return { type: 'hr', lines };
    if (first.startsWith('>')) return { type: 'quote', lines };
    if (/^#{1,6}\s+/.test(first)) return { type: 'heading', lines };
    return { type: 'paragraph', lines };
  });
}

function normalizeParagraph(block: Block): Block {
  if (block.type !== 'paragraph') return block;
  const text = block.lines.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return block;
  const normalized = text
    .replace(/^\*\*(Direct answer|Bezpośrednia odpowiedź|Direkte Antwort):\*\*\s*/i, '')
    .replace(/\s+([,.;:?!])/g, '$1')
    .replace(/\.\s+(and|but|or|i|a|ale|lub|und|aber|oder)\s+/gi, '; $1 ')
    .trim();
  return { type: 'paragraph', lines: [normalized] };
}

function blockText(block: Block | undefined): string {
  return (block?.lines || []).join(' ').trim();
}

function isAllowedList(listBlock: Block, currentHeading: string, previousText: string): boolean {
  const context = `${currentHeading} ${previousText}`.toLowerCase();
  if (ALLOWED_LIST_KEYWORDS.some((keyword) => context.includes(keyword))) return true;
  const items = listBlock.lines.map((line) => stripListPrefix(line));
  return items.length <= 3 && items.every((item) => item.endsWith('?'));
}

function stripListPrefix(line: string): string {
  return line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim();
}

function listToInlineSentence(lines: string[]): string {
  const items = lines.map((line) => stripListPrefix(line)).filter(Boolean);
  if (!items.length) return '';
  const normalized = items.map((item) => item.replace(/[.;]\s*$/, '').trim());
  return normalized.join('; ');
}

function mergeShortParagraphs(blocks: Block[]): { blocks: Block[]; merged: number } {
  const result: Block[] = [];
  let merged = 0;

  for (const block of blocks) {
    if (block.type !== 'paragraph') {
      result.push(block);
      continue;
    }

    const text = blockText(block);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const prev = result[result.length - 1];

    if (
      prev &&
      prev.type === 'paragraph' &&
      (
        wordCount <= 8 ||
        text.length <= 70 ||
        /^(and|but|or|i|a|ale|lub|und|aber|oder)\b/i.test(text)
      )
    ) {
      prev.lines = [`${blockText(prev)} ${text}`.replace(/\s+/g, ' ').trim()];
      merged += 1;
      continue;
    }

    result.push(block);
  }

  return { blocks: result, merged };
}

function combineFrameworkSubheads(blocks: Block[]): Block[] {
  const result: Block[] = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const current = blocks[i];
    const next = blocks[i + 1];
    const heading = blockText(current);

    if (
      current.type === 'heading' &&
      H3_COMBINE_PATTERN.test(heading) &&
      next?.type === 'paragraph'
    ) {
      const cleanHeading = heading.replace(/^###\s+/, '').trim();
      const text = blockText(next);
      result.push({ type: 'paragraph', lines: [`**${cleanHeading}.** ${text}`] });
      i += 1;
      continue;
    }

    result.push(current);
  }

  return result;
}

function extractTailCta(content: string): { main: string; tail: string } {
  const marker = '\n---\n';
  const idx = content.lastIndexOf(marker);
  if (idx === -1) return { main: content.trim(), tail: '' };
  const after = content.slice(idx).trim();
  if (!after.includes('*[') && !after.includes('http')) {
    return { main: content.trim(), tail: '' };
  }
  return {
    main: content.slice(0, idx).trimEnd(),
    tail: content.slice(idx).trim(),
  };
}

function splitOperationalHeader(content: string): { title: string; metadata: string[]; body: string } {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const title = lines[0] || '';
  let index = 1;

  while (index < lines.length && lines[index].trim() === '') index += 1;

  const metadata: string[] = [];
  while (index < lines.length && METADATA_LINE.test(lines[index].trim())) {
    metadata.push(lines[index]);
    index += 1;
  }

  while (index < lines.length && lines[index].trim() === '') index += 1;

  return {
    title,
    metadata,
    body: lines.slice(index).join('\n').trim(),
  };
}

function rewriteBody(body: string): { body: string; convertedLists: number; mergedShortParagraphs: number } {
  const initialBlocks = splitBlocks(body).map(normalizeParagraph);
  const frameworkBlocks = combineFrameworkSubheads(initialBlocks);
  const rewritten: Block[] = [];
  let currentHeading = '';
  let convertedLists = 0;

  for (let i = 0; i < frameworkBlocks.length; i += 1) {
    const block = frameworkBlocks[i];
    const text = blockText(block);

    if (block.type === 'heading') {
      if (DIRECT_ANSWER_HEADING.test(text)) {
        continue;
      }
      currentHeading = text.replace(/^##+\s+/, '').trim();
      rewritten.push(block);
      continue;
    }

    if (block.type === 'list') {
      const previous = rewritten[rewritten.length - 1];
      const previousText = blockText(previous);
      if (!isAllowedList(block, currentHeading, previousText)) {
        const inline = listToInlineSentence(block.lines);
        if (inline) {
          const sentence = inline.endsWith('.') ? inline : `${inline}.`;
          if (previous?.type === 'paragraph' && previousText.endsWith(':')) {
            previous.lines = [`${previousText} ${inline}.`.replace(/\s+/g, ' ').trim()];
          } else {
            rewritten.push({
              type: 'paragraph',
              lines: [sentence.charAt(0).toUpperCase() + sentence.slice(1)],
            });
          }
          convertedLists += 1;
          continue;
        }
      }
    }

    rewritten.push(block);
  }

  const merged = mergeShortParagraphs(rewritten);
  const output = merged.blocks
    .map((block) => block.lines.join('\n').trim())
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    body: output,
    convertedLists,
    mergedShortParagraphs: merged.merged,
  };
}

function rewriteArticle(content: string): { content: string; metrics: Omit<ArticleMetrics, 'path' | 'changed'> } {
  const beforeBullets = countBullets(content);
  const beforeParagraphs = countParagraphBlocks(content);
  const { tail, main } = extractTailCta(content);
  const { title, metadata, body } = splitOperationalHeader(main);
  const rewrittenBody = rewriteBody(body);

  const parts: string[] = [];
  parts.push(title.trim());
  parts.push('');
  if (metadata.length) {
    parts.push(...metadata);
    parts.push('');
  }
  parts.push(rewrittenBody.body.trim());
  if (tail) {
    parts.push('');
    parts.push(tail.trim());
  }

  const nextContent = `${parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;

  return {
    content: nextContent,
    metrics: {
      beforeBullets,
      afterBullets: countBullets(nextContent),
      beforeParagraphs,
      afterParagraphs: countParagraphBlocks(nextContent),
      mergedShortParagraphs: rewrittenBody.mergedShortParagraphs,
      convertedLists: rewrittenBody.convertedLists,
    },
  };
}

function processFile(filePath: string): ArticleMetrics {
  const relativePath = path.relative(ROOT, filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = rewriteArticle(content);
  const changed = result.content !== content;

  if (changed && !DRY_RUN) {
    fs.writeFileSync(filePath, result.content, 'utf-8');
  }

  return {
    path: relativePath,
    changed,
    ...result.metrics,
  };
}

function articleSlugFromPath(filePath: string): string {
  return path.basename(path.dirname(filePath));
}

function main() {
  const metrics: ArticleMetrics[] = [];

  for (const product of listProductDirs()) {
    const files = listArticleFiles(product).filter((filePath) => {
      if (
        GOLDEN_SAMPLE_SLUGS.has(articleSlugFromPath(filePath)) &&
        filePath.endsWith('article_EN.md')
      ) {
        return false;
      }
      if (FILE_FILTER && !filePath.includes(FILE_FILTER)) return false;
      return true;
    });

    for (const file of files) {
      metrics.push(processFile(file));
    }
  }

  const changed = metrics.filter((item) => item.changed);
  const convertedLists = metrics.reduce((sum, item) => sum + item.convertedLists, 0);
  const mergedParagraphs = metrics.reduce((sum, item) => sum + item.mergedShortParagraphs, 0);

  console.log(`KB editorial rewrite ${DRY_RUN ? '(dry-run)' : ''}`);
  console.log(`Files processed: ${metrics.length}`);
  console.log(`Files changed: ${changed.length}`);
  console.log(`Lists converted to prose: ${convertedLists}`);
  console.log(`Short paragraphs merged: ${mergedParagraphs}`);

  const top = changed
    .sort((a, b) => (b.beforeBullets - b.afterBullets) - (a.beforeBullets - a.afterBullets))
    .slice(0, 20);

  if (top.length) {
    console.log('\nTop changed files:');
    for (const item of top) {
      console.log(
        `- ${item.path}: bullets ${item.beforeBullets} -> ${item.afterBullets}, paragraphs ${item.beforeParagraphs} -> ${item.afterParagraphs}`
      );
    }
  }
}

main();
