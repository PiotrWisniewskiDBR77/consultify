#!/usr/bin/env node
/**
 * Generate seo.md, cta.md, publish.md, social.md, sources.md, image-prompts.md
 * for each article folder under Blogs/{IoT,IRIS,DT,Marketplace,Vector}/Blog/
 * using knowledge_base_manifest.json + parsed article_EN.md headers.
 *
 * Usage (from repo consultify root or DRD/consultify):
 *   node Blogs/_TOOLS/generate_article_metadata_packs.mjs
 *   node Blogs/_TOOLS/generate_article_metadata_packs.mjs --force   # overwrite existing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOGS_ROOT = path.resolve(__dirname, '..');
const PRODUCTS = ['IoT', 'IRIS', 'DT', 'Marketplace', 'Vector'];

const PRODUCT_PAGES = {
  IoT: { path: '/iot', name: 'DBR77 IoT' },
  IRIS: { path: '/iris', name: 'DBR77 IRIS' },
  DT: { path: '/digital-twin', name: 'DBR77 Digital Twin' },
  Marketplace: { path: '/marketplace', name: 'DBR77 Marketplace' },
  Vector: { path: '/vector', name: 'DBR77 Vector' },
};

const DEMO = 'https://dbr77.com/demo';
const ROOT = 'https://dbr77.com';

function kebabFromArticleSlug(slug) {
  const withoutNum = slug.replace(/^\d+_/, '');
  return withoutNum.replace(/_/g, '-');
}

function parseArticleEn(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  const title = (lines[0].match(/^#\s+(.+)/) || [])[1]?.trim() || '';
  const get = (prefix) => {
    const re = new RegExp(`^${prefix}:\\s*(.+)$`, 'i');
    for (const line of lines.slice(0, 15)) {
      const m = line.match(re);
      if (m) return m[1].trim();
    }
    return '';
  };
  return {
    title,
    persona: get('Target persona'),
    funnel: get('Funnel stage'),
    coreProblem: get('Core problem'),
    mainPromise: get('Main promise'),
    raw,
  };
}

function loadManifest(product) {
  const p = path.join(BLOGS_ROOT, '_LP_KB_READY', product, 'knowledge_base_manifest.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeIfNeeded(filePath, content, force) {
  if (!force && fs.existsSync(filePath)) return false;
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

function buildSeo(product, slug, art, parsed) {
  const urlSlug = kebabFromArticleSlug(slug);
  const pk = art.primary_keyword || urlSlug.replace(/-/g, ' ');
  const metaTitle = `${parsed.title} | ${PRODUCT_PAGES[product].name}`;
  const metaDesc = (parsed.mainPromise || parsed.coreProblem || parsed.title).slice(0, 155);
  return `Slug: \`${urlSlug}\`
Meta title: ${metaTitle}
Meta description: ${metaDesc}${metaDesc.length >= 155 ? '…' : ''}
Primary keyword: ${pk}
Secondary keywords:
- ${product.toLowerCase()} manufacturing
- industrial operations
- ${parsed.persona ? parsed.persona.toLowerCase() : 'operations leader'}
Search intent: educational / decision support
Core question to answer: ${parsed.coreProblem || `What should ${parsed.persona || 'leaders'} understand about this topic?`}
Question variants:
- ${parsed.title}?
- Why do teams still struggle with ${pk}?
- How should manufacturing leaders improve ${pk}?
- What is the first step when ${parsed.persona || 'leadership'} wants faster operational control?
Direct answer snippet: ${(parsed.mainPromise || parsed.coreProblem || parsed.title).slice(0, 420)}${(parsed.mainPromise || '').length > 420 ? '…' : ''}
Entity/context notes:
- Product: ${PRODUCT_PAGES[product].name}
- Persona: ${parsed.persona || 'Operations / plant leadership'}
- Context: manufacturing and industrial operations
- Region: global (EN master; PL/DE localized articles)
Internal links to add:
- \`${ROOT}\`
- \`${ROOT}${PRODUCT_PAGES[product].path}\`
- \`${DEMO}\`
Internal linking plan:
- Use manifest relation_manifest same-section edges for forward links to adjacent topics
`;
}

function buildCta(product, art, parsed) {
  const base = ROOT + PRODUCT_PAGES[product].path;
  return `Primary CTA: See ${PRODUCT_PAGES[product].name.replace('DBR77 ', '')} overview
Secondary CTA: Book or view demo
Product bridge: ${parsed.mainPromise || art.main_promise || art.summary_line || parsed.title} — ${PRODUCT_PAGES[product].name} is built to close this gap in real plants, not only in slides.
Objection to handle: "We already have dashboards / vendors / pilots."
Suggested next step: align ${parsed.persona || 'sponsors'} on one measurable outcome for the next 90 days and trace it to data definitions.
Links:
- ${base}
- ${DEMO}
`;
}

function buildPublish(product, slug, parsed) {
  return `Page goal: Publish a decision-grade article that earns trust before the product pitch; support EN/PL/DE.
Page components in order:
1. Hero (title + short promise)
2. Lead paragraphs (tension + stakes)
3. Body sections (H2 in article order)
4. Analytical visual after major H2 block (~60% through)
5. Product bridge + bottom line
6. CTA strip

Image placement:
- Hero: above-the-fold, 16:9, industrial editorial (no stock cliché robots)
- Analytical: after second or third H2, explains system or trade-off
- Social: 1:1 crop from hero or analytical for LinkedIn

CTA placement:
- Primary CTA mid-page after "what changes" section (optional text link)
- Closing CTA block after final paragraph (match article footer)

Component suggestions:
- Pull quote from "Reality check" or "What leadership should notice" if present
- Optional compact checklist only if article already uses decision bullets
Product: ${product}
Source slug folder: ${slug}
`;
}

function buildSocial(product, parsed) {
  return `Primary publishing face: company
Short teaser: ${(parsed.coreProblem || parsed.title).slice(0, 220)}
Email angle or hook: ${parsed.mainPromise || parsed.title}
Hashtags / topics: manufacturing, ${product}, operations, industrial AI (if relevant)
`;
}

function buildSources() {
  return `Sources and methodology:
- Internal DBR77 domain synthesis for manufacturing decision systems
- Cross-checked against common plant operating patterns (brownfield, multi-vendor, shift work)
- No single third-party study required; prefer plant-specific validation in sales conversations

Suggested citations to add when upgrading:
- ISA-95 / IEC context where relevant to MES/SCADA boundaries
- Your customer anonymized case fragments (with approval)
`;
}

function buildImagePrompts(product, parsed) {
  const mood = 'precise industrial editorial, calm authority, no sci-fi, no cartoon robots';
  return `## Hero
- objective: Illustrate the article's central tension for ${product} readers (${parsed.persona || 'plant leadership'}).
- scene: Wide manufacturing floor or operations room, readable context, human-in-loop.
- visual style: ${mood}
- brand mood: DBR77 — serious, European industrial, trustworthy
- negative prompts: glossy marketing stock, exaggerated AI brain graphics, clutter, unreadable text overlays

## Analytical
- objective: Visual metaphor for trade-offs, signal flow, or governance called out in the article.
- scene: Simple diagram-like composition or split view (before/after), still photographic not UI screenshot.
- visual style: ${mood}
- negative prompts: fake dashboards with nonsense metrics, watermarks

## Social
- objective: 1:1 crop-friendly focal subject from Hero or Analytical
- scene: Strong single focal point readable at small size
- negative prompts: small text, busy backgrounds
`;
}

function main() {
  const force = process.argv.includes('--force');
  let written = 0;
  let skipped = 0;

  for (const product of PRODUCTS) {
    const manifest = loadManifest(product);
    const blogDir = path.join(BLOGS_ROOT, product, 'Blog');
    const bySlug = new Map(manifest.articles.map((a) => [a.slug, a]));

    const dirs = fs
      .readdirSync(blogDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{2}_/.test(d.name))
      .map((d) => d.name);

    for (const folder of dirs) {
      const m = folder.match(/^(\d{2})_(.+)$/);
      const slug = m ? `${m[1]}_${m[2]}` : folder;
      const art = bySlug.get(slug);
      const enPath = path.join(blogDir, folder, 'article_EN.md');
      if (!fs.existsSync(enPath)) {
        console.warn(`Missing ${enPath}`);
        continue;
      }
      const parsed = parseArticleEn(enPath);

      const dir = path.join(blogDir, folder);
      const files = [
        ['seo.md', buildSeo(product, slug, art || {}, parsed)],
        ['cta.md', buildCta(product, art || {}, parsed)],
        ['publish.md', buildPublish(product, slug, parsed)],
        ['social.md', buildSocial(product, parsed)],
        ['sources.md', buildSources()],
        ['image-prompts.md', buildImagePrompts(product, parsed)],
      ];

      for (const [name, content] of files) {
        const fp = path.join(dir, name);
        if (writeIfNeeded(fp, content, force)) written++;
        else skipped++;
      }
    }
  }

  console.log(`Metadata packs: wrote ${written} files, skipped ${skipped} (use --force to overwrite)`);
}

main();
