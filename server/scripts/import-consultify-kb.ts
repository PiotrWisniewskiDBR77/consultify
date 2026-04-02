/**
 * Import Consultify Knowledge Base articles into kb_* tables.
 *
 * Reads:
 *  - Blogs/_LP_KB_READY/Consultify/knowledge_base_manifest.json
 *  - Blogs/Consultify/Blog/<slug>/article_EN.md, article_PL.md, article_DE.md
 *  - Blogs/Consultify/Blog/<slug>/seo.md
 *  - Blogs/Consultify/Blog/<slug>/assets/images/*.png + *.meta.json
 *  - Blogs/Consultify/Blog/<slug>/publish.md (image placement)
 *
 * Outputs:
 *  - server/migrations/20260402_consultify_kb_import.sql
 *  - public/kb/consultify/<slug>/ (hero, analytical, social images)
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const BLOGS_ROOT = path.join(ROOT, 'Blogs', 'Consultify', 'Blog');
const MANIFEST_PATH = path.join(ROOT, 'Blogs', '_LP_KB_READY', 'Consultify', 'knowledge_base_manifest.json');
const RENDERER_PATH = path.join(ROOT, 'Blogs', '_LP_KB_READY', 'Consultify', 'renderer_manifest.json');
const RELATION_PATH = path.join(ROOT, 'Blogs', '_LP_KB_READY', 'Consultify', 'relation_manifest.json');
const OUTPUT_PATH = path.join(ROOT, 'server', 'migrations', '20260402_consultify_kb_import.sql');

interface ManifestArticle {
  canonical_id: string;
  slug: string;
  title: string;
  summary_line: string;
  product: string;
  target_persona: string;
  funnel_stage: string;
  core_problem: string;
  main_promise: string;
  lp_section: string;
  knowledge_layer: number;
  bridge_product: string;
  bridge_section: string;
  primary_keyword: string;
  featured: boolean;
  mva_role: string | null;
  locales: {
    en: { path: string };
    pl: { path: string };
    de: { path: string };
  };
}

interface ManifestSection {
  section_id: string;
  label: string;
  promise: string;
  intro: string;
  featured_slugs: string[];
  deeper_slugs: string[];
  section_cta: string;
}

interface Manifest {
  product: string;
  sections: ManifestSection[];
  articles: ManifestArticle[];
  cta_ladder: Record<string, string>;
  cross_product_bridges: Record<string, { target_product: string; target_section: string }>;
}

function esc(s: string): string {
  if (!s) return '';
  return s.replace(/'/g, "''");
}

function readArticleBody(slug: string, lang: string): string {
  const folder = slugToFolderName(slug);
  if (!folder) {
    console.warn(`  WARN: No folder found for slug: ${slug}`);
    return '';
  }

  const filePath = path.join(BLOGS_ROOT, folder, `article_${lang.toUpperCase()}.md`);

  if (!fs.existsSync(filePath)) {
    console.warn(`  WARN: Missing ${filePath}`);
    return '';
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  const lines = content.split('\n');
  let bodyStart = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].match(/^(Target persona|Funnel stage|Core problem|Main promise|Docelowa persona|Etap lejka|Główny problem|Główna obietnica|Zielpersona|Funnel-Stufe|Kernproblem|Hauptversprechen):/i)) {
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
  heroCaption: string;
  analyticalAlt: string;
  analyticalCaption: string;
  socialAlt: string;
}

function readImageMeta(slug: string): ImageMeta {
  const folder = slugToFolderName(slug);
  const defaults: ImageMeta = { heroAlt: '', heroCaption: '', analyticalAlt: '', analyticalCaption: '', socialAlt: '' };
  if (!folder) return defaults;

  const imgDir = path.join(BLOGS_ROOT, folder, 'assets', 'images');
  if (!fs.existsSync(imgDir)) return defaults;

  const readLatestMeta = (role: string): { alt: string; caption: string } => {
    const files = fs.readdirSync(imgDir)
      .filter(f => f.startsWith(`${role}_`) && f.endsWith('.meta.json'))
      .sort();
    const latest = files[files.length - 1];
    if (!latest) return { alt: '', caption: '' };
    try {
      const data = JSON.parse(fs.readFileSync(path.join(imgDir, latest), 'utf-8'));
      return { alt: data.alt_text_en || '', caption: data.caption_en || '' };
    } catch { return { alt: '', caption: '' }; }
  };

  const hero = readLatestMeta('hero_16x9');
  const analytical = readLatestMeta('analytical_16x9');
  const social = readLatestMeta('social_1x1');

  return {
    heroAlt: hero.alt,
    heroCaption: hero.caption,
    analyticalAlt: analytical.alt,
    analyticalCaption: analytical.caption,
    socialAlt: social.alt,
  };
}

function injectImagesIntoContent(content: string, slug: string, meta: ImageMeta): string {
  const heroUrl = `/kb/consultify/${slug}/hero.png`;
  const analyticalUrl = `/kb/consultify/${slug}/analytical.png`;

  const heroMd = `\n\n![${meta.heroAlt || 'Article hero image'}](${heroUrl})\n\n`;
  const analyticalMd = `\n\n![${meta.analyticalAlt || 'Analytical illustration'}](${analyticalUrl})\n\n`;

  const lines = content.split('\n');
  const result: string[] = [];
  let heroInserted = false;
  let analyticalInserted = false;
  let h2Count = 0;
  const totalH2 = lines.filter(l => /^##\s+/.test(l)).length;
  const analyticalAfterH2 = Math.max(1, Math.floor(totalH2 * 0.6));

  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);

    if (!heroInserted && /^#\s+/.test(lines[i])) {
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

    if (!analyticalInserted && /^##\s+/.test(lines[i])) {
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

  if (!heroInserted) {
    result.splice(1, 0, heroMd);
  }
  if (!analyticalInserted) {
    const midpoint = Math.floor(result.length * 0.7);
    result.splice(midpoint, 0, analyticalMd);
  }

  return result.join('\n');
}

function findParagraphEnd(lines: string[], start: number): number {
  let i = start;
  while (i < lines.length && lines[i].trim() !== '') i++;
  return i - 1;
}

function readSeoData(slug: string): { metaTitle: string; metaDesc: string; primaryKeyword: string } {
  const folders = fs.readdirSync(BLOGS_ROOT).filter(d => {
    const parts = d.split('_');
    const rest = parts.slice(1).join('_');
    return rest === slug || d.endsWith(slug);
  });

  const defaults = { metaTitle: '', metaDesc: '', primaryKeyword: '' };
  if (folders.length === 0) return defaults;

  const filePath = path.join(BLOGS_ROOT, folders[0], 'seo.md');
  if (!fs.existsSync(filePath)) return defaults;

  const text = fs.readFileSync(filePath, 'utf-8');
  const metaTitle = text.match(/Meta title:\s*(.+)/i)?.[1]?.trim() || '';
  const metaDesc = text.match(/Meta description:\s*(.+)/i)?.[1]?.trim() || '';
  const primaryKeyword = text.match(/Primary keyword:\s*(.+)/i)?.[1]?.trim() || '';

  return { metaTitle, metaDesc, primaryKeyword };
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : '';
}

function estimateReadingTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.max(3, Math.ceil(words / 200));
}

function slugToFolderName(slug: string): string | null {
  const folders = fs.readdirSync(BLOGS_ROOT).filter(d => {
    const parts = d.split('_');
    const rest = parts.slice(1).join('_');
    return rest === slug || d.endsWith(slug);
  });
  return folders.length > 0 ? folders[0] : null;
}

function main() {
  console.log('Reading manifests...');
  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const renderer = JSON.parse(fs.readFileSync(RENDERER_PATH, 'utf-8'));
  const relations = JSON.parse(fs.readFileSync(RELATION_PATH, 'utf-8'));

  const sql: string[] = [];

  sql.push(`-- Migration: 20260402_consultify_kb_import.sql`);
  sql.push(`-- Purpose: Import 50 Consultify knowledge base articles with EN/PL/DE translations`);
  sql.push(`-- Source: Blogs/_LP_KB_READY/Consultify manifests + Blogs/Consultify/Blog/ articles`);
  sql.push(`-- Date: 2026-04-02`);
  sql.push('');

  // --- Categories for Consultify KB sections ---
  sql.push('-- ============================================');
  sql.push('-- CONSULTIFY KB CATEGORIES (3 sections)');
  sql.push('-- ============================================');

  const sectionCategoryMap: Record<string, string> = {};

  for (const section of manifest.sections) {
    const catId = `kb-cat-consultify-${section.label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
    const catSlug = `consultify-${section.label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
    sectionCategoryMap[section.label] = catId;

    const iconMap: Record<string, string> = {
      'Governance And ROI': 'Shield',
      'Execution And Rollout': 'Rocket',
      'AI And Decision Making': 'Brain',
    };

    sql.push(`INSERT INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES`);
    sql.push(`  ('${catId}', '${catSlug}', '${iconMap[section.label] || 'BookOpen'}', ${manifest.sections.indexOf(section) + 10}, 1, 1)`);
    sql.push(`ON CONFLICT (id) DO NOTHING;`);
    sql.push('');

    const sectionTranslations: Record<string, { name: string; description: string }> = {
      'Governance And ROI': {
        en: { name: 'Governance & ROI', description: 'Strategy governance, ROI visibility, and transformation control for executive leadership.' },
        pl: { name: 'Governance i ROI', description: 'Governance strategiczny, widoczność ROI i kontrola transformacji dla kadry zarządzającej.' },
        de: { name: 'Governance & ROI', description: 'Strategische Governance, ROI-Transparenz und Transformationssteuerung für die Unternehmensführung.' },
      },
      'Execution And Rollout': {
        en: { name: 'Execution & Rollout', description: 'Practical transformation execution, PMO operations, and initiative rollout management.' },
        pl: { name: 'Egzekucja i Wdrożenie', description: 'Praktyczna realizacja transformacji, operacje PMO i zarządzanie wdrożeniami inicjatyw.' },
        de: { name: 'Umsetzung & Rollout', description: 'Praktische Transformationsumsetzung, PMO-Betrieb und Initiativ-Rollout-Management.' },
      },
      'AI And Decision Making': {
        en: { name: 'AI & Decision Making', description: 'AI-powered strategic analysis, decision support, and data-driven transformation intelligence.' },
        pl: { name: 'AI i Podejmowanie Decyzji', description: 'Analiza strategiczna wspierana AI, wsparcie decyzji i inteligencja transformacyjna oparta na danych.' },
        de: { name: 'KI & Entscheidungsfindung', description: 'KI-gestützte strategische Analyse, Entscheidungsunterstützung und datengetriebene Transformationsintelligenz.' },
      },
    } as any;

    const trans = (sectionTranslations as any)[section.label];
    if (trans) {
      for (const lang of ['en', 'pl', 'de']) {
        const t = (trans as any)[lang];
        sql.push(`INSERT INTO kb_category_translations (id, category_id, language, name, description) VALUES`);
        sql.push(`  ('${catId}-trans-${lang}', '${catId}', '${lang}', '${esc(t.name)}', '${esc(t.description)}')`);
        sql.push(`ON CONFLICT (category_id, language) DO NOTHING;`);
      }
    }
    sql.push('');
  }

  // --- Collections (mirror categories as collections for P26-B) ---
  sql.push('-- ============================================');
  sql.push('-- CONSULTIFY KB COLLECTIONS');
  sql.push('-- ============================================');

  const parentCollectionId = 'kb-coll-consultify';
  sql.push(`INSERT INTO kb_collections (id, slug, visibility, featured, sort_order, status) VALUES`);
  sql.push(`  ('${parentCollectionId}', 'consultify-knowledge-base', 'public', TRUE, 1, 'active')`);
  sql.push(`ON CONFLICT (id) DO NOTHING;`);
  sql.push('');

  sql.push(`INSERT INTO kb_collection_translations (id, collection_id, language, title, description) VALUES`);
  sql.push(`  ('${parentCollectionId}-trans-en', '${parentCollectionId}', 'en', 'Consultify Knowledge Base', 'Complete transformation management knowledge library — governance, execution, and AI decision support.')`);
  sql.push(`ON CONFLICT (collection_id, language) DO NOTHING;`);
  sql.push(`INSERT INTO kb_collection_translations (id, collection_id, language, title, description) VALUES`);
  sql.push(`  ('${parentCollectionId}-trans-pl', '${parentCollectionId}', 'pl', 'Baza Wiedzy Consultify', 'Kompletna biblioteka wiedzy o zarządzaniu transformacją — governance, egzekucja i wsparcie decyzji AI.')`);
  sql.push(`ON CONFLICT (collection_id, language) DO NOTHING;`);
  sql.push(`INSERT INTO kb_collection_translations (id, collection_id, language, title, description) VALUES`);
  sql.push(`  ('${parentCollectionId}-trans-de', '${parentCollectionId}', 'de', 'Consultify Wissensdatenbank', 'Vollständige Wissensbibliothek für Transformationsmanagement — Governance, Umsetzung und KI-Entscheidungsunterstützung.')`);
  sql.push(`ON CONFLICT (collection_id, language) DO NOTHING;`);
  sql.push('');

  for (const section of manifest.sections) {
    const collId = `kb-coll-consultify-${section.label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
    const collSlug = `consultify-${section.label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;

    sql.push(`INSERT INTO kb_collections (id, slug, parent_collection_id, visibility, featured, sort_order, status) VALUES`);
    sql.push(`  ('${collId}', '${collSlug}', '${parentCollectionId}', 'public', TRUE, ${manifest.sections.indexOf(section) + 1}, 'active')`);
    sql.push(`ON CONFLICT (id) DO NOTHING;`);

    const collTranslations: Record<string, Record<string, string>> = {
      'Governance And ROI': { en: 'Governance & ROI', pl: 'Governance i ROI', de: 'Governance & ROI' },
      'Execution And Rollout': { en: 'Execution & Rollout', pl: 'Egzekucja i Wdrożenie', de: 'Umsetzung & Rollout' },
      'AI And Decision Making': { en: 'AI & Decision Making', pl: 'AI i Podejmowanie Decyzji', de: 'KI & Entscheidungsfindung' },
    };

    const ct = collTranslations[section.label] || { en: section.label, pl: section.label, de: section.label };
    for (const lang of ['en', 'pl', 'de']) {
      sql.push(`INSERT INTO kb_collection_translations (id, collection_id, language, title, description) VALUES`);
      sql.push(`  ('${collId}-trans-${lang}', '${collId}', '${lang}', '${esc(ct[lang])}', '${esc(section.promise)}')`);
      sql.push(`ON CONFLICT (collection_id, language) DO NOTHING;`);
    }
    sql.push('');
  }

  // --- Tags ---
  sql.push('-- ============================================');
  sql.push('-- CONSULTIFY KB TAGS');
  sql.push('-- ============================================');

  const tagDefs = [
    { slug: 'transformation-governance', kind: 'domain', en: 'Transformation Governance', pl: 'Governance Transformacji', de: 'Transformations-Governance' },
    { slug: 'roi-visibility', kind: 'domain', en: 'ROI Visibility', pl: 'Widoczność ROI', de: 'ROI-Transparenz' },
    { slug: 'execution-control', kind: 'domain', en: 'Execution Control', pl: 'Kontrola Egzekucji', de: 'Umsetzungssteuerung' },
    { slug: 'pmo-operations', kind: 'domain', en: 'PMO Operations', pl: 'Operacje PMO', de: 'PMO-Betrieb' },
    { slug: 'strategic-alignment', kind: 'domain', en: 'Strategic Alignment', pl: 'Alignment Strategiczny', de: 'Strategische Ausrichtung' },
    { slug: 'portfolio-management', kind: 'domain', en: 'Portfolio Management', pl: 'Zarządzanie Portfolio', de: 'Portfoliomanagement' },
    { slug: 'board-reporting', kind: 'domain', en: 'Board Reporting', pl: 'Raportowanie do Zarządu', de: 'Vorstandsberichterstattung' },
    { slug: 'ai-decision-support', kind: 'domain', en: 'AI Decision Support', pl: 'Wsparcie Decyzji AI', de: 'KI-Entscheidungsunterstützung' },
    { slug: 'change-management', kind: 'domain', en: 'Change Management', pl: 'Zarządzanie Zmianą', de: 'Change Management' },
    { slug: 'capacity-planning', kind: 'domain', en: 'Capacity Planning', pl: 'Planowanie Zasobów', de: 'Kapazitätsplanung' },
    { slug: 'owner-president', kind: 'audience', en: 'Owner / President', pl: 'Właściciel / Prezes', de: 'Inhaber / Geschäftsführer' },
    { slug: 'cfo-finance', kind: 'audience', en: 'CFO / Finance', pl: 'CFO / Finanse', de: 'CFO / Finanzen' },
    { slug: 'transformation-lead', kind: 'audience', en: 'Transformation Lead', pl: 'Lider Transformacji', de: 'Transformationsleiter' },
    { slug: 'awareness', kind: 'stage', en: 'Awareness', pl: 'Świadomość', de: 'Bewusstsein' },
    { slug: 'consideration', kind: 'stage', en: 'Consideration', pl: 'Rozważanie', de: 'Erwägung' },
    { slug: 'decision', kind: 'stage', en: 'Decision', pl: 'Decyzja', de: 'Entscheidung' },
    { slug: 'adoption', kind: 'stage', en: 'Adoption', pl: 'Adopcja', de: 'Einführung' },
  ];

  for (const tag of tagDefs) {
    const tagId = `kb-tag-${tag.slug}`;
    sql.push(`INSERT INTO kb_tags (id, slug, kind, visibility, status) VALUES`);
    sql.push(`  ('${tagId}', '${tag.slug}', '${tag.kind}', 'public', 'active')`);
    sql.push(`ON CONFLICT (id) DO NOTHING;`);

    for (const lang of ['en', 'pl', 'de']) {
      const label = (tag as any)[lang];
      sql.push(`INSERT INTO kb_tag_translations (id, tag_id, language, label) VALUES`);
      sql.push(`  ('${tagId}-trans-${lang}', '${tagId}', '${lang}', '${esc(label)}')`);
      sql.push(`ON CONFLICT (tag_id, language) DO NOTHING;`);
    }
    sql.push('');
  }

  // --- Articles ---
  sql.push('-- ============================================');
  sql.push('-- CONSULTIFY KB ARTICLES (50)');
  sql.push('-- ============================================');

  const articleIds: Record<string, string> = {};
  const articleSections: Record<string, string> = {};

  const personaTagMap: Record<string, string> = {
    'Owner / President / Chairman': 'owner-president',
    'Owner / President': 'owner-president',
    'CFO / Finance Director': 'cfo-finance',
    'Transformation Lead': 'transformation-lead',
    'Transformation Lead / PMO Director': 'transformation-lead',
    'PMO Director': 'transformation-lead',
  };

  const stageTagMap: Record<string, string> = {
    'Awareness': 'awareness',
    'Consideration': 'consideration',
    'Decision': 'decision',
    'Adoption': 'adoption',
  };

  const sectionTagMap: Record<string, string[]> = {
    'Governance And ROI': ['transformation-governance', 'roi-visibility', 'board-reporting'],
    'Execution And Rollout': ['execution-control', 'pmo-operations', 'change-management'],
    'AI And Decision Making': ['ai-decision-support', 'strategic-alignment'],
  };

  let articleCount = 0;

  for (const article of manifest.articles) {
    const artId = `kb-consultify-${article.slug}`;
    articleIds[article.slug] = artId;
    articleSections[article.slug] = article.lp_section;

    const catId = sectionCategoryMap[article.lp_section] || Object.values(sectionCategoryMap)[0];
    const folder = slugToFolderName(article.slug);

    if (!folder) {
      console.warn(`SKIP: No folder for ${article.slug}`);
      continue;
    }

    const enContentRaw = readArticleBody(article.slug, 'en');
    const plContentRaw = readArticleBody(article.slug, 'pl');
    const deContentRaw = readArticleBody(article.slug, 'de');

    if (!enContentRaw) {
      console.warn(`SKIP: Empty EN content for ${article.slug}`);
      continue;
    }

    const imageMeta = readImageMeta(article.slug);
    const enContent = injectImagesIntoContent(enContentRaw, article.slug, imageMeta);
    const plContent = plContentRaw ? injectImagesIntoContent(plContentRaw, article.slug, imageMeta) : '';
    const deContent = deContentRaw ? injectImagesIntoContent(deContentRaw, article.slug, imageMeta) : '';

    const readingTime = estimateReadingTime(enContentRaw);
    const seo = readSeoData(article.slug);

    const enTitle = extractTitle(enContentRaw) || article.title;
    const plTitle = extractTitle(plContentRaw) || enTitle;
    const deTitle = extractTitle(deContentRaw) || enTitle;

    const thumbnailUrl = `/kb/consultify/${article.slug}/hero.png`;
    const socialImageUrl = `/kb/consultify/${article.slug}/social.png`;
    const relatedModules = JSON.stringify(['assessment', 'dashboard', 'roadmap']);
    const targetAudience = JSON.stringify([article.target_persona]);

    sql.push(`-- Article ${folder}`);
    sql.push(`INSERT INTO kb_articles (id, category_id, slug, status, is_featured, is_public, reading_time_minutes, thumbnail_url, related_modules, target_audience, created_at, updated_at) VALUES`);
    sql.push(`  ('${artId}', '${catId}', '${esc(article.slug)}', 'published', ${article.featured ? 1 : 0}, 1, ${readingTime}, '${esc(thumbnailUrl)}', '${esc(relatedModules)}', '${esc(targetAudience)}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
    sql.push(`ON CONFLICT (id) DO UPDATE SET status = 'published', is_public = 1, is_featured = ${article.featured ? 1 : 0}, reading_time_minutes = ${readingTime}, thumbnail_url = '${esc(thumbnailUrl)}', updated_at = CURRENT_TIMESTAMP;`);
    sql.push('');

    // EN translation
    sql.push(`INSERT INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES`);
    sql.push(`  ('${artId}-trans-en', '${artId}', 'en', '${esc(enTitle)}', '${esc(article.summary_line)}', '${esc(enContent)}')`);
    sql.push(`ON CONFLICT (article_id, language) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, content = EXCLUDED.content;`);

    // PL translation
    if (plContent) {
      sql.push(`INSERT INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES`);
      sql.push(`  ('${artId}-trans-pl', '${artId}', 'pl', '${esc(plTitle)}', '${esc(article.summary_line)}', '${esc(plContent)}')`);
      sql.push(`ON CONFLICT (article_id, language) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, content = EXCLUDED.content;`);
    }

    // DE translation
    if (deContent) {
      sql.push(`INSERT INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES`);
      sql.push(`  ('${artId}-trans-de', '${artId}', 'de', '${esc(deTitle)}', '${esc(article.summary_line)}', '${esc(deContent)}')`);
      sql.push(`ON CONFLICT (article_id, language) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, content = EXCLUDED.content;`);
    }
    sql.push('');

    // Surface bindings
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

    // Article ↔ Collection
    const collId = `kb-coll-consultify-${article.lp_section.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
    sql.push(`INSERT INTO kb_article_collections (article_id, collection_id, sort_order) VALUES`);
    sql.push(`  ('${artId}', '${parentCollectionId}', ${articleCount})`);
    sql.push(`ON CONFLICT (article_id, collection_id) DO NOTHING;`);
    sql.push(`INSERT INTO kb_article_collections (article_id, collection_id, sort_order) VALUES`);
    sql.push(`  ('${artId}', '${collId}', ${articleCount})`);
    sql.push(`ON CONFLICT (article_id, collection_id) DO NOTHING;`);
    sql.push('');

    // Article ↔ Tags
    const tags: string[] = [];
    const personaTag = personaTagMap[article.target_persona];
    if (personaTag) tags.push(personaTag);
    const stageTag = stageTagMap[article.funnel_stage];
    if (stageTag) tags.push(stageTag);
    const sectionTags = sectionTagMap[article.lp_section] || [];
    tags.push(...sectionTags.slice(0, 2));

    for (const tagSlug of tags) {
      sql.push(`INSERT INTO kb_article_tags (article_id, tag_id) VALUES`);
      sql.push(`  ('${artId}', 'kb-tag-${tagSlug}')`);
      sql.push(`ON CONFLICT (article_id, tag_id) DO NOTHING;`);
    }
    sql.push('');

    articleCount++;
  }

  // --- Related articles (from relation manifest) ---
  sql.push('-- ============================================');
  sql.push('-- RELATED ARTICLE LINKS');
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
      sql.push(`UPDATE kb_articles SET related_article_ids = '${JSON.stringify(relatedIds)}' WHERE id = '${artId}';`);
    }
  }

  sql.push('');
  sql.push(`-- Import complete: ${articleCount} Consultify articles with EN/PL/DE translations`);

  const output = sql.join('\n');
  fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');
  console.log(`\nGenerated migration: ${OUTPUT_PATH}`);
  console.log(`Articles processed: ${articleCount}`);
  console.log(`SQL size: ${(output.length / 1024).toFixed(1)} KB`);
}

main();
