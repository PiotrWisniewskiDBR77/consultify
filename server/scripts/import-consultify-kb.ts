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
const OUTPUT_PATH = path.join(ROOT, 'server', 'migrations', '20260403_consultify_kb_import_v2.sql');

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

  sql.push(`-- Migration: 20260403_consultify_kb_import_v2.sql`);
  sql.push(`-- Purpose: Import 50 Consultify knowledge base articles with EN/PL/DE translations`);
  sql.push(`-- Source: Blogs/_LP_KB_READY/Consultify manifests + Blogs/Consultify/Blog/ articles`);
  sql.push(`-- Date: 2026-04-02`);
  sql.push('');

  sql.push('-- ============================================');
  sql.push('-- CLEANUP: Remove previous Consultify KB data');
  sql.push('-- ============================================');
  sql.push(`DELETE FROM kb_article_tags WHERE article_id LIKE 'kb-consultify-%';`);
  sql.push(`DELETE FROM kb_article_collections WHERE article_id LIKE 'kb-consultify-%';`);
  sql.push(`DELETE FROM kb_surface_bindings WHERE article_id LIKE 'kb-consultify-%';`);
  sql.push(`DELETE FROM kb_article_translations WHERE article_id LIKE 'kb-consultify-%';`);
  sql.push(`DELETE FROM kb_articles WHERE id LIKE 'kb-consultify-%';`);
  sql.push(`DELETE FROM kb_tag_translations WHERE tag_id LIKE 'kb-tag-%';`);
  sql.push(`DELETE FROM kb_tags WHERE id LIKE 'kb-tag-%';`);
  sql.push(`DELETE FROM kb_collection_translations WHERE collection_id LIKE 'kb-coll-consultify%';`);
  sql.push(`DELETE FROM kb_collections WHERE id LIKE 'kb-coll-consultify%';`);
  sql.push(`DELETE FROM kb_category_translations WHERE category_id LIKE 'kb-cat-consultify-%';`);
  sql.push(`DELETE FROM kb_categories WHERE id LIKE 'kb-cat-consultify-%';`);
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
      'Why Transformations Fail': 'AlertTriangle',
      'The Money Question': 'TrendingUp',
      'Decisions That Ship': 'Zap',
    };

    sql.push(`INSERT INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES`);
    sql.push(`  ('${catId}', '${catSlug}', '${iconMap[section.label] || 'BookOpen'}', ${manifest.sections.indexOf(section) + 10}, 1, 1)`);
    sql.push(`ON CONFLICT (id) DO NOTHING;`);
    sql.push('');

    const sectionTranslations: Record<string, { name: string; description: string }> = {
      'Why Transformations Fail': {
        en: { name: 'Why Transformations Fail', description: 'The uncomfortable patterns behind stalled programs, dead initiatives, and governance theater.' },
        pl: { name: 'Dlaczego transformacje padają', description: 'Niewygodne wzorce za wstrzymanymi programami, martwymi inicjatywami i governance-teatrem.' },
        de: { name: 'Warum Transformationen scheitern', description: 'Die unbequemen Muster hinter ins Stocken geratenen Programmen, toten Initiativen und Governance-Theater.' },
      },
      'The Money Question': {
        en: { name: 'The Money Question', description: 'ROI defense, board packets, budget linkage, and investment logic that survives scrutiny.' },
        pl: { name: 'Pytanie o pieniądze', description: 'Obrona ROI, pakiety dla zarządu, powiązanie z budżetem i logika inwestycyjna, która przetrwa weryfikację.' },
        de: { name: 'Die Geldfrage', description: 'ROI-Verteidigung, Vorstandspakete, Budgetverknüpfung und Investitionslogik, die einer Prüfung standhält.' },
      },
      'Decisions That Ship': {
        en: { name: 'Decisions That Ship', description: 'From decision latency to owned initiatives — how to move from alignment theater to execution clarity.' },
        pl: { name: 'Decyzje, które lądują w egzekucji', description: 'Od opóźnień decyzyjnych do inicjatyw z właścicielem — jak przejść od teatru alignmentu do jasności egzekucji.' },
        de: { name: 'Entscheidungen, die umgesetzt werden', description: 'Von Entscheidungslatenz zu verantworteten Initiativen — wie man vom Alignment-Theater zur Ausführungsklarheit gelangt.' },
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
      'Why Transformations Fail': { en: 'Why Transformations Fail', pl: 'Dlaczego transformacje padają', de: 'Warum Transformationen scheitern' },
      'The Money Question': { en: 'The Money Question', pl: 'Pytanie o pieniądze', de: 'Die Geldfrage' },
      'Decisions That Ship': { en: 'Decisions That Ship', pl: 'Decyzje, które lądują w egzekucji', de: 'Entscheidungen, die umgesetzt werden' },
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
    { slug: 'governance', kind: 'domain', en: 'Governance', pl: 'Governance', de: 'Governance' },
    { slug: 'roi-finance', kind: 'domain', en: 'ROI & Finance', pl: 'ROI i Finanse', de: 'ROI & Finanzen' },
    { slug: 'execution', kind: 'domain', en: 'Execution', pl: 'Egzekucja', de: 'Umsetzung' },
    { slug: 'pmo', kind: 'domain', en: 'PMO', pl: 'PMO', de: 'PMO' },
    { slug: 'decision-speed', kind: 'domain', en: 'Decision Speed', pl: 'Szybkość Decyzji', de: 'Entscheidungsgeschwindigkeit' },
    { slug: 'ai-strategy', kind: 'domain', en: 'AI & Strategy', pl: 'AI i Strategia', de: 'KI & Strategie' },
    { slug: 'portfolio', kind: 'domain', en: 'Portfolio Mgmt', pl: 'Zarządzanie Portfolio', de: 'Portfoliomanagement' },
    { slug: 'risk', kind: 'domain', en: 'Risk', pl: 'Ryzyko', de: 'Risiko' },
    { slug: 'leadership', kind: 'domain', en: 'Leadership', pl: 'Przywództwo', de: 'Führung' },
    { slug: 'board-room', kind: 'domain', en: 'Board Room', pl: 'Sala Zarządu', de: 'Vorstandsraum' },
    { slug: 'for-owners', kind: 'audience', en: 'For Owners & Presidents', pl: 'Dla Właścicieli', de: 'Für Inhaber' },
    { slug: 'for-cfo', kind: 'audience', en: 'For CFOs & Finance', pl: 'Dla CFO', de: 'Für CFOs' },
    { slug: 'for-pmo', kind: 'audience', en: 'For PMO & Delivery', pl: 'Dla PMO', de: 'Für PMO' },
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
    'Owner / President / Chairman': 'for-owners',
    'Owner / President': 'for-owners',
    'Owner / President / Change Leader': 'for-owners',
    'Owner / President / CFO': 'for-owners',
    'Owner / President / COO': 'for-owners',
    'Owner / COO / transformation sponsor': 'for-owners',
    'COO / Change Leader / Owner': 'for-owners',
    'COO / change leader / owner': 'for-owners',
    'COO / transformation sponsor / owner': 'for-owners',
    'COO / transformation sponsor / portfolio owner': 'for-owners',
    'CFO / Owner / President': 'for-cfo',
    'CFO / Finance Director': 'for-cfo',
    'CFO / COO / Owner': 'for-cfo',
    'CFO / transformation sponsor / portfolio steering lead': 'for-cfo',
    'CFO / transformation sponsor / finance partner': 'for-cfo',
    'CFO / PMO lead / transformation sponsor': 'for-cfo',
    'CFO / portfolio sponsor / transformation steering owner': 'for-cfo',
    'CFO / transformation sponsor / metrics owner': 'for-cfo',
    'CFO / transformation sponsor / head of strategy reporting to the board': 'for-cfo',
    'Transformation PMO lead / portfolio office head / program director': 'for-pmo',
    'Transformation PMO lead / chief of staff to sponsor / portfolio operations head': 'for-pmo',
    'Transformation PMO lead / delivery lead / sponsor': 'for-pmo',
    'Transformation PMO lead / enterprise architect / sponsor chief of staff': 'for-pmo',
    'Transformation PMO director / transformation office lead': 'for-pmo',
    'Transformation Lead': 'for-pmo',
    'Transformation Lead / PMO Director': 'for-pmo',
    'PMO Director': 'for-pmo',
    'Program director / transformation PMO lead / interface owner': 'for-pmo',
    'Risk owner / transformation PMO / program director': 'for-pmo',
    'Transformation PMO lead / delivery lead / sponsor': 'for-pmo',
  };

  const sectionTagMap: Record<string, string[]> = {
    'Why Transformations Fail': ['governance', 'risk', 'leadership'],
    'The Money Question': ['roi-finance', 'board-room', 'portfolio'],
    'Decisions That Ship': ['decision-speed', 'execution', 'ai-strategy'],
  };

  const articleSpecificTags: Record<string, string[]> = {
    '01_why_traditional_consulting_is_broken': ['governance', 'leadership', 'risk'],
    '02_10_questions_before_buying_ai_consulting_platform': ['ai-strategy', 'decision-speed', 'roi-finance'],
    '03_first_30_minutes_in_consultify': ['execution', 'ai-strategy', 'decision-speed'],
    '04_roi_calculator_guide': ['roi-finance', 'board-room', 'decision-speed'],
    '05_ai_driven_swot': ['ai-strategy', 'decision-speed', 'leadership'],
    '06_scenario_planning': ['ai-strategy', 'decision-speed', 'risk'],
    '07_competitive_intelligence': ['ai-strategy', 'leadership', 'decision-speed'],
    '08_strategic_alignment': ['execution', 'leadership', 'governance'],
    '09_data_first_strategy': ['ai-strategy', 'decision-speed', 'board-room'],
    '10_decision_latency': ['decision-speed', 'execution', 'leadership'],
    '11_strategic_reporting': ['board-room', 'decision-speed', 'governance'],
    '12_okr_management': ['execution', 'governance', 'leadership'],
    '13_why_board_updates_should_come_from_live_transformation_systems': ['board-room', 'roi-finance', 'governance'],
    '14_why_strategy_workshops_fail_without_execution_system': ['execution', 'leadership', 'governance'],
    '15_how_to_keep_transformation_roi_visible_after_kickoff': ['roi-finance', 'governance', 'portfolio'],
    '16_why_steering_committees_fail_when_the_system_is_static': ['governance', 'leadership', 'decision-speed'],
    '17_why_transformation_programs_need_one_source_of_truth': ['execution', 'governance', 'pmo'],
    '18_how_to_turn_leadership_decisions_into_owned_initiatives': ['decision-speed', 'execution', 'leadership'],
    '19_why_transformation_portfolios_fail_without_live_prioritization': ['portfolio', 'decision-speed', 'execution'],
    '20_how_to_keep_leadership_alignment_after_the_offsite': ['leadership', 'execution', 'governance'],
    '21_how_to_defend_transformation_investment_with_live_value_evidence': ['roi-finance', 'board-room', 'portfolio'],
    '22_what_monthly_transformation_reviews_should_actually_decide': ['governance', 'decision-speed', 'board-room'],
    '23_how_to_run_quarterly_transformation_resets_without_losing_momentum': ['portfolio', 'governance', 'execution'],
    '24_what_a_transformation_pmo_should_track_every_week': ['pmo', 'execution', 'decision-speed'],
    '25_how_to_cut_dead_initiatives_without_political_drift': ['portfolio', 'leadership', 'governance'],
    '26_when_to_replan_a_transformation_portfolio_and_when_to_hold_course': ['portfolio', 'governance', 'risk'],
    '27_how_to_make_strategy_assumptions_visible_before_the_board_review': ['board-room', 'governance', 'risk'],
    '28_why_transformation_capacity_breaks_before_strategy_does': ['risk', 'execution', 'leadership'],
    '29_how_to_link_transformation_initiatives_to_budget_reality': ['roi-finance', 'portfolio', 'governance'],
    '30_what_executive_sponsors_should_never_delegate_in_transformation': ['leadership', 'governance', 'risk'],
    '31_how_to_build_a_live_transformation_risk_register': ['risk', 'governance', 'pmo'],
    '32_when_a_transformation_program_needs_intervention_not_more_reporting': ['governance', 'pmo', 'leadership'],
    '33_how_to_design_a_sponsor_cadence_that_actually_changes_transformation_outcomes': ['leadership', 'governance', 'board-room'],
    '34_when_a_transformation_portfolio_should_stop_funding_an_initiative': ['portfolio', 'roi-finance', 'governance'],
    '35_what_a_good_escalation_path_looks_like_in_cross_functional_programs': ['pmo', 'decision-speed', 'execution'],
    '36_how_to_reduce_governance_debt_in_large_transformation_programs': ['governance', 'pmo', 'decision-speed'],
    '37_when_transformation_metrics_start_driving_the_wrong_behavior': ['governance', 'risk', 'roi-finance'],
    '38_how_to_keep_strategy_reviews_from_turning_into_narrative_theater': ['board-room', 'governance', 'decision-speed'],
    '39_what_executives_should_require_before_approving_the_next_wave_of_change': ['board-room', 'portfolio', 'risk'],
    '40_how_to_prove_transformation_value_before_the_full_program_finishes': ['roi-finance', 'governance', 'risk'],
    '41_when_a_transformation_team_is_overloaded_even_if_the_plan_looks_green': ['risk', 'pmo', 'execution'],
    '42_how_to_reset_transformation_control_after_a_missed_quarter': ['governance', 'execution', 'portfolio'],
    '43_how_to_define_decision_rights_in_a_transformation_operating_system': ['decision-speed', 'governance', 'execution'],
    '44_what_a_board_ready_transformation_packet_should_include_every_time': ['board-room', 'roi-finance', 'governance'],
    '45_when_to_rewrite_a_transformation_business_case_and_when_not_to': ['roi-finance', 'governance', 'risk'],
    '46_how_to_manage_transformation_assumptions_without_spreadsheet_chaos': ['governance', 'risk', 'pmo'],
    '47_what_a_good_transformation_capacity_model_should_make_visible': ['risk', 'pmo', 'execution'],
    '48_when_change_exhaustion_is_a_governance_problem_not_a_people_problem': ['governance', 'risk', 'leadership'],
    '49_how_to_keep_a_transformation_pmo_from_becoming_a_reporting_factory': ['pmo', 'governance', 'decision-speed'],
    '50_how_to_turn_transformation_management_into_a_repeatable_operating_system': ['execution', 'governance', 'pmo'],
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

    // Article ↔ Tags (3-4 tags: specific domain tags + optional audience tag)
    const tags: string[] = [];
    const specificTags = articleSpecificTags[article.slug];
    if (specificTags) {
      tags.push(...specificTags);
    } else {
      const fallbackTags = sectionTagMap[article.lp_section] || [];
      tags.push(...fallbackTags.slice(0, 3));
    }
    const personaTag = personaTagMap[article.target_persona];
    if (personaTag) tags.push(personaTag);

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
