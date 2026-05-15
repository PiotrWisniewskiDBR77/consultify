/**
 * Generic KB product import: generates idempotent SQL migration + optional asset copy.
 *
 * Usage:
 *   npx tsx server/scripts/import-kb-product.ts IoT
 *   npx tsx server/scripts/import-kb-product.ts IoT --copy-assets
 *
 * Unlike import-consultify-kb.ts, this script:
 * - scopes DELETE to the target product only (never wipes global kb_tags)
 * - uses per-product paths: /kb/<productKey>/<slug>/...
 * - reads section metadata from kb-import-products.json
 *
 * @module scripts/import-kb-product
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(__dirname, 'kb-import-products.json');

// --- shared types ---

interface SharedTag {
  slug: string;
  kind: string;
  en: string;
  pl: string;
  de: string;
}

interface SectionConfig {
  label: string;
  icon: string;
  en: { name: string; description: string };
  pl: { name: string; description: string };
  de: { name: string; description: string };
}

interface ProductConfig {
  productKey: string;
  blogsFolder: string;
  migrationFilename: string;
  collectionRootSlug: string;
  collectionRootTitles: {
    en: { title: string; description: string };
    pl: { title: string; description: string };
    de: { title: string; description: string };
  };
  relatedModulesDefault: string[];
  sections: SectionConfig[];
  sectionTagFallback: Record<string, string[]>;
}

interface ManifestArticle {
  slug: string;
  title: string;
  summary_line: string;
  target_persona: string;
  lp_section: string;
  featured: boolean;
  locales?: Record<string, { path?: string; title?: string }>;
}

interface ManifestSection {
  label: string;
  promise: string;
}

interface Manifest {
  product: string;
  sections: ManifestSection[];
  articles: ManifestArticle[];
}

interface RelationManifest {
  same_lp_edges?: Array<{ from_slug: string; to_slug: string }>;
}

interface ImportProductsFile {
  sharedTags: SharedTag[];
  products: Record<string, ProductConfig>;
}

// --- string helpers ---

function esc(s: string): string {
  if (!s) return '';
  return s.replace(/'/g, "''");
}

function labelToKebab(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// --- article file IO (parameterized blogs root) ---

function slugToFolderName(blogsRoot: string, slug: string): string | null {
  if (!fs.existsSync(blogsRoot)) return null;
  const folders = fs.readdirSync(blogsRoot).filter((d) => {
    const parts = d.split('_');
    const rest = parts.slice(1).join('_');
    return rest === slug || d.endsWith(slug);
  });
  return folders.length > 0 ? folders[0] : null;
}

function readArticleFile(blogsRoot: string, slug: string, lang: string): string {
  const folder = slugToFolderName(blogsRoot, slug);
  if (!folder) {
    console.warn(`  WARN: No folder found for slug: ${slug}`);
    return '';
  }
  const filePath = path.join(blogsRoot, folder, `article_${lang.toUpperCase()}.md`);
  if (!fs.existsSync(filePath)) {
    console.warn(`  WARN: Missing ${filePath}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf-8');
}

function stripArticleMetadata(content: string): string {
  if (!content) return '';
  const lines = content.split('\n');
  let bodyStart = 0;
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    if (
      lines[i].match(
        /^(Target persona|Funnel stage|Funnel-Phase|Core problem|Main promise|Docelowa persona|Etap lejka|Główny problem|Główna obietnica|Zielpersona|Zielperson|Funnel-Stufe|Trichterphase|Kernproblem|Hauptversprechen):/i
      )
    ) {
      bodyStart = i + 1;
    }
  }
  if (bodyStart > 0) {
    while (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart++;
    content = lines.slice(bodyStart).join('\n');
  }
  return content.trim();
}

interface ImageMeta {
  heroAlt: string;
  analyticalAlt: string;
}

interface AssetFiles {
  hero: string | null;
  analytical: string | null;
  social: string | null;
}

function pickLatestPng(dir: string, prefix: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.toLowerCase().endsWith('.png'))
    .sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

function resolveAssetFiles(blogsRoot: string, slug: string): AssetFiles {
  const folder = slugToFolderName(blogsRoot, slug);
  if (!folder) return { hero: null, analytical: null, social: null };
  const imgDir = path.join(blogsRoot, folder, 'assets', 'images');
  return {
    hero: pickLatestPng(imgDir, 'hero_16x9'),
    analytical: pickLatestPng(imgDir, 'analytical_16x9'),
    social: pickLatestPng(imgDir, 'social_1x1'),
  };
}

function readImageMeta(blogsRoot: string, slug: string): ImageMeta {
  const folder = slugToFolderName(blogsRoot, slug);
  const defaults: ImageMeta = { heroAlt: '', analyticalAlt: '' };
  if (!folder) return defaults;
  const imgDir = path.join(blogsRoot, folder, 'assets', 'images');
  if (!fs.existsSync(imgDir)) return defaults;

  const readLatestMeta = (role: string): { alt: string } => {
    const files = fs
      .readdirSync(imgDir)
      .filter((f) => f.startsWith(`${role}_`) && f.endsWith('.meta.json'))
      .sort();
    const latest = files[files.length - 1];
    if (!latest) return { alt: '' };
    try {
      const data = JSON.parse(fs.readFileSync(path.join(imgDir, latest), 'utf-8'));
      return { alt: data.alt_text_en || '' };
    } catch {
      return { alt: '' };
    }
  };

  const hero = readLatestMeta('hero_16x9');
  const analytical = readLatestMeta('analytical_16x9');
  return { heroAlt: hero.alt, analyticalAlt: analytical.alt };
}

function findParagraphEnd(lines: string[], start: number): number {
  let i = start;
  while (i < lines.length && lines[i].trim() !== '') i++;
  return i - 1;
}

function injectImagesIntoContent(
  content: string,
  slug: string,
  productKey: string,
  meta: ImageMeta,
  assets: AssetFiles
): string {
  if (!assets.hero && !assets.analytical) return content;

  const heroUrl = `/kb/${productKey}/${slug}/hero.png`;
  const analyticalUrl = `/kb/${productKey}/${slug}/analytical.png`;
  const heroMd = `\n\n![${meta.heroAlt || 'Article hero image'}](${heroUrl})\n\n`;
  const analyticalMd = `\n\n![${meta.analyticalAlt || 'Analytical illustration'}](${analyticalUrl})\n\n`;

  const lines = content.split('\n');
  const result: string[] = [];
  let heroInserted = false;
  let analyticalInserted = false;
  let h2Count = 0;
  const totalH2 = lines.filter((l) => /^##\s+/.test(l)).length;
  const analyticalAfterH2 = Math.max(1, Math.floor(totalH2 * 0.6));

  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);

    if (assets.hero && !heroInserted && /^#\s+/.test(lines[i])) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && !/^#/.test(lines[j])) {
        const nextParaEnd = findParagraphEnd(lines, j);
        for (let k = i + 1; k <= nextParaEnd; k++) {
          result.push(lines[k]);
        }
        result.push(heroMd);
        heroInserted = true;
        i = nextParaEnd;
        continue;
      } else {
        result.push(heroMd);
        heroInserted = true;
      }
    }

    if (assets.analytical && !analyticalInserted && /^##\s+/.test(lines[i])) {
      h2Count++;
      if (h2Count >= analyticalAfterH2) {
        let j = i + 1;
        while (j < lines.length && !/^##?\s+/.test(lines[j])) {
          result.push(lines[j]);
          j++;
        }
        result.push(analyticalMd);
        analyticalInserted = true;
        i = j - 1;
        continue;
      }
    }
  }

  if (assets.hero && !heroInserted) {
    result.splice(1, 0, heroMd);
  }
  if (assets.analytical && !analyticalInserted) {
    const midpoint = Math.floor(result.length * 0.7);
    result.splice(midpoint, 0, analyticalMd);
  }

  return result.join('\n');
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : '';
}

function extractMetadataValue(content: string, labels: string[]): string {
  if (!content) return '';
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`^(?:${escaped.join('|')}):\\s*(.+)$`, 'mi');
  const match = content.match(pattern);
  return match ? match[1].trim() : '';
}

function estimateReadingTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.max(3, Math.ceil(words / 200));
}

function readSeoData(blogsRoot: string, slug: string): { metaTitle: string } {
  const folder = slugToFolderName(blogsRoot, slug);
  const defaults = { metaTitle: '' };
  if (!folder) return defaults;
  const filePath = path.join(blogsRoot, folder, 'seo.md');
  if (!fs.existsSync(filePath)) return defaults;
  const text = fs.readFileSync(filePath, 'utf-8');
  const metaTitle = text.match(/Meta title:\s*(.+)/i)?.[1]?.trim() || '';
  return { metaTitle };
}

// --- persona → audience tag (shared slugs from sharedTags) ---

const PERSONA_TAG_MAP: Record<string, string> = {
  'Plant Manager': 'for-plant',
  'Plant Manager / Operations': 'for-plant',
  'Plant Manager / COO': 'for-plant',
  'COO': 'for-owners',
  'CTO / COO': 'for-engineering',
  CTO: 'for-engineering',
  'Owner / President': 'for-owners',
  'CFO / Owner / President': 'for-cfo',
  'CFO': 'for-cfo',
  'VP Engineering': 'for-engineering',
  'VP Operations': 'for-plant',
};

function resolvePersonaTag(persona: string): string | undefined {
  if (PERSONA_TAG_MAP[persona]) return PERSONA_TAG_MAP[persona];
  const p = persona.toLowerCase();
  if (p.includes('plant') || p.includes('operations')) return 'for-plant';
  if (p.includes('cfo') || p.includes('finance')) return 'for-cfo';
  if (p.includes('cto') || p.includes('engineering') || p.includes('it')) return 'for-engineering';
  if (p.includes('owner') || p.includes('president') || p.includes('ceo')) return 'for-owners';
  return undefined;
}

function copyKbAssets(
  blogsRoot: string,
  slug: string,
  productKey: string,
  destKbRoot: string
): void {
  const assets = resolveAssetFiles(blogsRoot, slug);
  if (!assets.hero && !assets.analytical && !assets.social) return;

  const outDir = path.join(destKbRoot, productKey, slug);
  fs.mkdirSync(outDir, { recursive: true });

  if (assets.hero) fs.copyFileSync(assets.hero, path.join(outDir, 'hero.png'));
  if (assets.analytical) fs.copyFileSync(assets.analytical, path.join(outDir, 'analytical.png'));
  if (assets.social) fs.copyFileSync(assets.social, path.join(outDir, 'social.png'));
}

function main(): void {
  const args = process.argv.slice(2).filter((a) => a !== '--copy-assets');
  const copyAssets = process.argv.includes('--copy-assets');
  const productName = args[0];
  if (!productName) {
    console.error('Usage: npx tsx server/scripts/import-kb-product.ts <ProductName> [--copy-assets]');
    console.error('Example: npx tsx server/scripts/import-kb-product.ts IoT');
    process.exit(1);
  }

  const cfgRaw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as ImportProductsFile;
  const productCfg = cfgRaw.products[productName];
  if (!productCfg) {
    console.error(`Unknown product "${productName}". Keys: ${Object.keys(cfgRaw.products).join(', ')}`);
    process.exit(1);
  }

  const { productKey, blogsFolder, migrationFilename } = productCfg;
  const blogsRoot = path.join(ROOT, 'Blogs', blogsFolder, 'Blog');
  const manifestPath = path.join(ROOT, 'Blogs', '_LP_KB_READY', productName, 'knowledge_base_manifest.json');
  const relationPath = path.join(ROOT, 'Blogs', '_LP_KB_READY', productName, 'relation_manifest.json');
  const outputPath = path.join(ROOT, 'server', 'migrations', migrationFilename);

  if (!fs.existsSync(manifestPath)) {
    console.error(`Missing manifest: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Manifest;
  const relations: RelationManifest = fs.existsSync(relationPath)
    ? JSON.parse(fs.readFileSync(relationPath, 'utf-8'))
    : {};

  const sql: string[] = [];
  const stamp = new Date().toISOString().slice(0, 10);

  sql.push(`-- Migration: ${migrationFilename}`);
  sql.push(`-- Purpose: Import ${productName} knowledge base articles (EN/PL/DE)`);
  sql.push(`-- Source: Blogs/_LP_KB_READY/${productName} + Blogs/${blogsFolder}/Blog/`);
  sql.push(`-- Generated: ${stamp}`);
  sql.push(`-- Product key: ${productKey} (scoped DELETE — does not remove other products or global tag dictionary)`);
  sql.push('');

  sql.push('-- ============================================');
  sql.push(`-- CLEANUP: ${productName} only`);
  sql.push('-- ============================================');
  sql.push(`DELETE FROM kb_article_tags WHERE article_id LIKE 'kb-${productKey}-%';`);
  sql.push(`DELETE FROM kb_article_collections WHERE article_id LIKE 'kb-${productKey}-%';`);
  sql.push(`DELETE FROM kb_surface_bindings WHERE article_id LIKE 'kb-${productKey}-%';`);
  sql.push(`DELETE FROM kb_article_translations WHERE article_id LIKE 'kb-${productKey}-%';`);
  sql.push(`DELETE FROM kb_articles WHERE id LIKE 'kb-${productKey}-%';`);
  sql.push(
    `DELETE FROM kb_collection_translations WHERE collection_id LIKE 'kb-coll-${productKey}%';`
  );
  sql.push(`DELETE FROM kb_collections WHERE id LIKE 'kb-coll-${productKey}%';`);
  sql.push(
    `DELETE FROM kb_category_translations WHERE category_id LIKE 'kb-cat-${productKey}-%';`
  );
  sql.push(`DELETE FROM kb_categories WHERE id LIKE 'kb-cat-${productKey}-%';`);
  sql.push('');

  // --- Shared tags: idempotent inserts (safe across multiple product migrations) ---
  sql.push('-- ============================================');
  sql.push('-- SHARED TAGS (idempotent)');
  sql.push('-- ============================================');
  for (const tag of cfgRaw.sharedTags) {
    const tagId = `kb-tag-${tag.slug}`;
    sql.push(`INSERT INTO kb_tags (id, slug, kind, visibility, status) VALUES`);
    sql.push(`  ('${tagId}', '${esc(tag.slug)}', '${tag.kind}', 'public', 'active')`);
    sql.push(`ON CONFLICT (id) DO NOTHING;`);
    for (const lang of ['en', 'pl', 'de'] as const) {
      const label = tag[lang];
      sql.push(`INSERT INTO kb_tag_translations (id, tag_id, language, label) VALUES`);
      sql.push(`  ('${tagId}-trans-${lang}', '${tagId}', '${lang}', '${esc(label)}')`);
      sql.push(`ON CONFLICT (tag_id, language) DO NOTHING;`);
    }
    sql.push('');
  }

  // --- Categories ---
  sql.push('-- ============================================');
  sql.push(`-- CATEGORIES: ${productName}`);
  sql.push('-- ============================================');

  const sectionCategoryMap: Record<string, string> = {};
  const manifestSectionByLabel = new Map(manifest.sections.map((s) => [s.label, s]));

  for (let i = 0; i < productCfg.sections.length; i++) {
    const sec = productCfg.sections[i];
    const catId = `kb-cat-${productKey}-${labelToKebab(sec.label)}`;
    sectionCategoryMap[sec.label] = catId;
    const manSec = manifestSectionByLabel.get(sec.label);
    const sortOrder = 10 + i;

    sql.push(`INSERT INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES`);
    sql.push(
      `  ('${catId}', '${productKey}-${labelToKebab(sec.label)}', '${sec.icon}', ${sortOrder}, 1, 1)`
    );
    sql.push(`ON CONFLICT (id) DO NOTHING;`);
    sql.push('');

    const descEn = manSec?.promise || sec.en.description;
    for (const lang of ['en', 'pl', 'de'] as const) {
      const t = sec[lang];
      const desc = lang === 'en' ? descEn : t.description;
      sql.push(`INSERT INTO kb_category_translations (id, category_id, language, name, description) VALUES`);
      sql.push(
        `  ('${catId}-trans-${lang}', '${catId}', '${lang}', '${esc(t.name)}', '${esc(desc)}')`
      );
      sql.push(`ON CONFLICT (category_id, language) DO NOTHING;`);
    }
    sql.push('');
  }

  // --- Collections ---
  const parentCollectionId = `kb-coll-${productKey}`;
  sql.push('-- ============================================');
  sql.push('-- COLLECTIONS');
  sql.push('-- ============================================');
  sql.push(`INSERT INTO kb_collections (id, slug, visibility, featured, sort_order, status) VALUES`);
  sql.push(
    `  ('${parentCollectionId}', '${productCfg.collectionRootSlug}', 'public', TRUE, 1, 'active')`
  );
  sql.push(`ON CONFLICT (id) DO NOTHING;`);
  sql.push('');

  for (const lang of ['en', 'pl', 'de'] as const) {
    const t = productCfg.collectionRootTitles[lang];
    sql.push(`INSERT INTO kb_collection_translations (id, collection_id, language, title, description) VALUES`);
    sql.push(
      `  ('${parentCollectionId}-trans-${lang}', '${parentCollectionId}', '${lang}', '${esc(t.title)}', '${esc(t.description)}')`
    );
    sql.push(`ON CONFLICT (collection_id, language) DO NOTHING;`);
  }
  sql.push('');

  for (let i = 0; i < productCfg.sections.length; i++) {
    const sec = productCfg.sections[i];
    const collId = `kb-coll-${productKey}-${labelToKebab(sec.label)}`;
    const collSlug = `${productKey}-${labelToKebab(sec.label)}`;
    const manSec = manifestSectionByLabel.get(sec.label);
    const promise = manSec?.promise || sec.en.description;

    sql.push(`INSERT INTO kb_collections (id, slug, parent_collection_id, visibility, featured, sort_order, status) VALUES`);
    sql.push(
      `  ('${collId}', '${collSlug}', '${parentCollectionId}', 'public', TRUE, ${i + 1}, 'active')`
    );
    sql.push(`ON CONFLICT (id) DO NOTHING;`);

    for (const lang of ['en', 'pl', 'de'] as const) {
      const title = sec[lang].name;
      sql.push(`INSERT INTO kb_collection_translations (id, collection_id, language, title, description) VALUES`);
      sql.push(
        `  ('${collId}-trans-${lang}', '${collId}', '${lang}', '${esc(title)}', '${esc(promise)}')`
      );
      sql.push(`ON CONFLICT (collection_id, language) DO NOTHING;`);
    }
    sql.push('');
  }

  // --- Articles ---
  sql.push('-- ============================================');
  sql.push('-- ARTICLES');
  sql.push('-- ============================================');

  const articleIds: Record<string, string> = {};
  let articleCount = 0;
  const destKbRoot = path.join(ROOT, 'public', 'kb');

  for (const article of manifest.articles) {
    const artId = `kb-${productKey}-${article.slug}`;
    articleIds[article.slug] = artId;

    const catId =
      sectionCategoryMap[article.lp_section] ||
      Object.values(sectionCategoryMap)[0];

    if (!slugToFolderName(blogsRoot, article.slug)) {
      console.warn(`SKIP: No folder for ${article.slug}`);
      continue;
    }

    const enFileRaw = readArticleFile(blogsRoot, article.slug, 'en');
    const plFileRaw = readArticleFile(blogsRoot, article.slug, 'pl');
    const deFileRaw = readArticleFile(blogsRoot, article.slug, 'de');

    const enContentRaw = stripArticleMetadata(enFileRaw);
    const plContentRaw = stripArticleMetadata(plFileRaw);
    const deContentRaw = stripArticleMetadata(deFileRaw);

    if (!enContentRaw) {
      console.warn(`SKIP: Empty EN body for ${article.slug}`);
      continue;
    }

    if (copyAssets) {
      copyKbAssets(blogsRoot, article.slug, productKey, destKbRoot);
    }

    const imageMeta = readImageMeta(blogsRoot, article.slug);
    const assetFiles = resolveAssetFiles(blogsRoot, article.slug);
    const enContent = injectImagesIntoContent(
      enContentRaw,
      article.slug,
      productKey,
      imageMeta,
      assetFiles
    );
    const plContent = plContentRaw
      ? injectImagesIntoContent(plContentRaw, article.slug, productKey, imageMeta, assetFiles)
      : '';
    const deContent = deContentRaw
      ? injectImagesIntoContent(deContentRaw, article.slug, productKey, imageMeta, assetFiles)
      : '';

    const readingTime = estimateReadingTime(enContentRaw);
    const enTitle = extractTitle(enFileRaw) || article.title;
    const plTitle = extractTitle(plFileRaw) || enTitle;
    const deTitle = extractTitle(deFileRaw) || enTitle;
    const enSummary =
      extractMetadataValue(enFileRaw, ['Core problem']) || article.summary_line;
    const plSummary = extractMetadataValue(plFileRaw, ['Główny problem']) || enSummary;
    const deSummary = extractMetadataValue(deFileRaw, ['Kernproblem']) || enSummary;

    const thumbnailUrl = assetFiles.hero ? `/kb/${productKey}/${article.slug}/hero.png` : null;
    const relatedModules = JSON.stringify(productCfg.relatedModulesDefault);
    const targetAudience = JSON.stringify([article.target_persona]);
    const thumbnailSqlValue = thumbnailUrl ? `'${esc(thumbnailUrl)}'` : 'NULL';

    sql.push(`-- ${article.slug}`);
    sql.push(`INSERT INTO kb_articles (id, category_id, slug, status, is_featured, is_public, reading_time_minutes, thumbnail_url, related_modules, target_audience, created_at, updated_at) VALUES`);
    sql.push(
      `  ('${artId}', '${catId}', '${esc(article.slug)}', 'published', ${article.featured ? 1 : 0}, 1, ${readingTime}, ${thumbnailSqlValue}, '${esc(relatedModules)}', '${esc(targetAudience)}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    );
    sql.push(
      `ON CONFLICT (id) DO UPDATE SET status = 'published', is_public = 1, is_featured = ${article.featured ? 1 : 0}, reading_time_minutes = ${readingTime}, thumbnail_url = ${thumbnailSqlValue}, updated_at = CURRENT_TIMESTAMP;`
    );
    sql.push('');

    sql.push(`INSERT INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES`);
    sql.push(
      `  ('${artId}-trans-en', '${artId}', 'en', '${esc(enTitle)}', '${esc(enSummary)}', '${esc(enContent)}')`
    );
    sql.push(
      `ON CONFLICT (article_id, language) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, content = EXCLUDED.content;`
    );

    if (plContent) {
      sql.push(`INSERT INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES`);
      sql.push(
        `  ('${artId}-trans-pl', '${artId}', 'pl', '${esc(plTitle)}', '${esc(plSummary)}', '${esc(plContent)}')`
      );
      sql.push(
        `ON CONFLICT (article_id, language) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, content = EXCLUDED.content;`
      );
    }

    if (deContent) {
      sql.push(`INSERT INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES`);
      sql.push(
        `  ('${artId}-trans-de', '${artId}', 'de', '${esc(deTitle)}', '${esc(deSummary)}', '${esc(deContent)}')`
      );
      sql.push(
        `ON CONFLICT (article_id, language) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, content = EXCLUDED.content;`
      );
    }
    sql.push('');

    sql.push(`INSERT INTO kb_surface_bindings (id, article_id, surface) VALUES`);
    sql.push(`  ('${randomUUID()}', '${artId}', 'public_docs')`);
    sql.push(`ON CONFLICT (article_id, surface, tool_context) DO NOTHING;`);
    sql.push(`INSERT INTO kb_surface_bindings (id, article_id, surface) VALUES`);
    sql.push(`  ('${randomUUID()}', '${artId}', 'help')`);
    sql.push(`ON CONFLICT (article_id, surface, tool_context) DO NOTHING;`);
    sql.push(`INSERT INTO kb_surface_bindings (id, article_id, surface) VALUES`);
    sql.push(`  ('${randomUUID()}', '${artId}', 'lp')`);
    sql.push(`ON CONFLICT (article_id, surface, tool_context) DO NOTHING;`);
    sql.push('');

    const collId = `kb-coll-${productKey}-${labelToKebab(article.lp_section)}`;
    sql.push(`INSERT INTO kb_article_collections (article_id, collection_id, sort_order) VALUES`);
    sql.push(`  ('${artId}', '${parentCollectionId}', ${articleCount})`);
    sql.push(`ON CONFLICT (article_id, collection_id) DO NOTHING;`);
    sql.push(`INSERT INTO kb_article_collections (article_id, collection_id, sort_order) VALUES`);
    sql.push(`  ('${artId}', '${collId}', ${articleCount})`);
    sql.push(`ON CONFLICT (article_id, collection_id) DO NOTHING;`);
    sql.push('');

    const fallback =
      productCfg.sectionTagFallback[article.lp_section] ||
      Object.values(productCfg.sectionTagFallback)[0];
    const tagSlugs = [...fallback];
    const personaTag = resolvePersonaTag(article.target_persona);
    if (personaTag) tagSlugs.push(personaTag);

    const seen = new Set<string>();
    for (const tagSlug of tagSlugs) {
      if (seen.has(tagSlug)) continue;
      seen.add(tagSlug);
      sql.push(`INSERT INTO kb_article_tags (article_id, tag_id) VALUES`);
      sql.push(`  ('${artId}', 'kb-tag-${tagSlug}')`);
      sql.push(`ON CONFLICT (article_id, tag_id) DO NOTHING;`);
    }
    sql.push('');

    articleCount++;
  }

  // --- Related articles ---
  sql.push('-- ============================================');
  sql.push('-- RELATED ARTICLE IDS');
  sql.push('-- ============================================');
  const relatedMap: Record<string, string[]> = {};
  if (relations.same_lp_edges) {
    for (const edge of relations.same_lp_edges) {
      if (!relatedMap[edge.from_slug]) relatedMap[edge.from_slug] = [];
      if (relatedMap[edge.from_slug].length < 5 && articleIds[edge.to_slug]) {
        relatedMap[edge.from_slug].push(articleIds[edge.to_slug]);
      }
    }
  }
  for (const [slug, relatedIds] of Object.entries(relatedMap)) {
    const artId = articleIds[slug];
    if (artId && relatedIds.length > 0) {
      sql.push(
        `UPDATE kb_articles SET related_article_ids = '${esc(JSON.stringify(relatedIds))}' WHERE id = '${artId}';`
      );
    }
  }

  sql.push('');
  sql.push(`-- Import complete: ${articleCount} ${productName} articles`);

  fs.writeFileSync(outputPath, sql.join('\n'), 'utf-8');
  console.log(`\nWrote ${outputPath}`);
  console.log(`Articles included: ${articleCount}`);
  console.log(`SQL size: ${(sql.join('\n').length / 1024).toFixed(1)} KB`);
  if (copyAssets) {
    console.log(`Assets copied under ${path.join(destKbRoot, productKey)}`);
  }
}

main();
