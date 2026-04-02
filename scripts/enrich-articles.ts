/**
 * Article Enrichment Script
 *
 * Adds missing structural elements to all blog articles across all products:
 * 1. CTA block at the end (from cta.md)
 * 2. Horizontal rule separator before CTA
 *
 * Usage: npx tsx scripts/enrich-articles.ts [--dry-run] [--product Consultify]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BLOGS_ROOT = path.resolve(__dirname, '..', 'Blogs');
const DRY_RUN = process.argv.includes('--dry-run');
const PRODUCT_FILTER = (() => {
  const idx = process.argv.indexOf('--product');
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

interface CtaData {
  primaryCta: string;
  primaryTarget?: string;
  secondaryCta: string;
  secondaryTarget?: string;
  productBridge: string;
  softCta?: string;
  endCta?: string;
}

interface ProductConfig {
  slug: string;
  domain: string;
  ctaLinks: { primary: string; secondary: string };
}

const PRODUCT_CONFIGS: Record<string, ProductConfig> = {
  Consultify: {
    slug: 'consultify',
    domain: 'consultify.ai',
    ctaLinks: {
      primary: 'https://consultify.ai',
      secondary: 'https://consultify.ai/demo',
    },
  },
  DBR77: {
    slug: 'dbr77',
    domain: 'dbr77.com',
    ctaLinks: {
      primary: 'https://dbr77.com',
      secondary: 'https://dbr77.com/demo',
    },
  },
  DT: {
    slug: 'dt',
    domain: 'dbr77.com/digital-twin',
    ctaLinks: {
      primary: 'https://dbr77.com/digital-twin',
      secondary: 'https://dbr77.com/demo',
    },
  },
  IRIS: {
    slug: 'iris',
    domain: 'dbr77.com/iris',
    ctaLinks: {
      primary: 'https://dbr77.com/iris',
      secondary: 'https://dbr77.com/demo',
    },
  },
  IoT: {
    slug: 'iot',
    domain: 'dbr77.com/iot',
    ctaLinks: {
      primary: 'https://dbr77.com/iot',
      secondary: 'https://dbr77.com/demo',
    },
  },
  Marketplace: {
    slug: 'marketplace',
    domain: 'dbr77.com/marketplace',
    ctaLinks: {
      primary: 'https://dbr77.com/marketplace',
      secondary: 'https://dbr77.com/demo',
    },
  },
  Vector: {
    slug: 'vector',
    domain: 'dbr77.com/vector',
    ctaLinks: {
      primary: 'https://dbr77.com/vector',
      secondary: 'https://dbr77.com/demo',
    },
  },
};

const CTA_TEMPLATES: Record<string, Record<string, (cta: CtaData, config: ProductConfig) => string>> = {
  EN: {
    default: (cta, config) =>
      `\n---\n\n*${cta.endCta || cta.productBridge} [${cta.primaryCta}](${config.ctaLinks.primary}) or [${cta.secondaryCta}](${config.ctaLinks.secondary}).*\n`,
  },
  PL: {
    default: (cta, config) =>
      `\n---\n\n*Chcesz zobaczyć, jak to działa w praktyce? [${translateCta(cta.primaryCta, 'PL')}](${config.ctaLinks.primary}) lub [${translateCta(cta.secondaryCta, 'PL')}](${config.ctaLinks.secondary}).*\n`,
  },
  DE: {
    default: (cta, config) =>
      `\n---\n\n*Möchten Sie sehen, wie das in der Praxis funktioniert? [${translateCta(cta.primaryCta, 'DE')}](${config.ctaLinks.primary}) oder [${translateCta(cta.secondaryCta, 'DE')}](${config.ctaLinks.secondary}).*\n`,
  },
};

function translateCta(cta: string, lang: string): string {
  const map: Record<string, Record<string, string>> = {
    PL: {
      'Start free trial': 'Rozpocznij darmowy trial',
      'Open demo': 'Otwórz demo',
      'Book a demo': 'Umów demo',
      'Browse use cases': 'Zobacz przypadki użycia',
      'Start interactive demo': 'Uruchom interaktywne demo',
      'Start 14-day trial': 'Rozpocznij 14-dniowy trial',
      'Plan a pilot': 'Zaplanuj pilota',
      'See online demo': 'Zobacz demo online',
      'Describe your challenge': 'Opisz swoje wyzwanie',
      'Start manufacturer demo': 'Uruchom demo producenta',
      'Review security': 'Sprawdź bezpieczeństwo',
      'Explore the ecosystem': 'Poznaj ekosystem',
      'Schedule a demo': 'Umów demo',
      'Explore Digital Twin': 'Poznaj Digital Twin',
      'Explore methodology': 'Poznaj metodologię',
      'Explore products using Vector': 'Poznaj produkty z Vector',
      'Review deployment options': 'Sprawdź opcje wdrożenia',
      'Review governance readiness': 'Sprawdź gotowość governance',
      'Review vendor fit': 'Sprawdź dopasowanie dostawcy',
      'Schedule a conversation': 'Umów rozmowę',
      'Schedule a strategic conversation': 'Umów rozmowę strategiczną',
      'Watch walkthrough': 'Obejrzyj prezentację',
      'Compare offers': 'Porównaj oferty',
      'Compare demo vs trial': 'Porównaj demo i trial',
      'Discover products': 'Odkryj produkty',
      'Discover the ecosystem': 'Odkryj ekosystem',
      'Explore ROI calculator': 'Poznaj kalkulator ROI',
    },
    DE: {
      'Start free trial': 'Kostenlosen Trial starten',
      'Open demo': 'Demo öffnen',
      'Book a demo': 'Demo buchen',
      'Browse use cases': 'Use Cases ansehen',
      'Start interactive demo': 'Interaktive Demo starten',
      'Start 14-day trial': '14-Tage-Trial starten',
      'Plan a pilot': 'Pilotprojekt planen',
      'See online demo': 'Online-Demo ansehen',
      'Describe your challenge': 'Ihre Herausforderung beschreiben',
      'Start manufacturer demo': 'Hersteller-Demo starten',
      'Review security': 'Sicherheit prüfen',
      'Explore the ecosystem': 'Ökosystem erkunden',
      'Schedule a demo': 'Demo vereinbaren',
      'Explore Digital Twin': 'Digital Twin erkunden',
      'Explore methodology': 'Methodik erkunden',
      'Explore products using Vector': 'Produkte mit Vector erkunden',
      'Review deployment options': 'Deployment-Optionen prüfen',
      'Review governance readiness': 'Governance-Bereitschaft prüfen',
      'Review vendor fit': 'Anbieter-Passung prüfen',
      'Schedule a conversation': 'Gespräch vereinbaren',
      'Schedule a strategic conversation': 'Strategisches Gespräch vereinbaren',
      'Watch walkthrough': 'Walkthrough ansehen',
      'Compare offers': 'Angebote vergleichen',
      'Compare demo vs trial': 'Demo und Trial vergleichen',
      'Discover products': 'Produkte entdecken',
      'Discover the ecosystem': 'Ökosystem entdecken',
      'Explore ROI calculator': 'ROI-Rechner erkunden',
    },
  };
  return map[lang]?.[cta] || cta;
}

function translateBridge(bridge: string, _lang: string): string {
  return bridge;
}

function parseCtaMd(content: string): CtaData {
  const lines = content.split('\n');
  const data: CtaData = {
    primaryCta: '',
    secondaryCta: '',
    productBridge: '',
  };

  for (const line of lines) {
    if (line.startsWith('Primary CTA:')) data.primaryCta = line.replace('Primary CTA:', '').trim();
    if (line.startsWith('Secondary CTA:')) data.secondaryCta = line.replace('Secondary CTA:', '').trim();
    if (line.startsWith('Product bridge:')) data.productBridge = line.replace('Product bridge:', '').trim();
    if (line.startsWith('Suggested end CTA copy:')) data.endCta = line.replace('Suggested end CTA copy:', '').trim();
    if (line.startsWith('Suggested soft CTA copy:')) data.softCta = line.replace('Suggested soft CTA copy:', '').trim();
    if (line.startsWith('Primary CTA target:')) data.primaryTarget = line.replace('Primary CTA target:', '').trim();
    if (line.startsWith('Secondary CTA target:')) data.secondaryTarget = line.replace('Secondary CTA target:', '').trim();
  }

  return data;
}

function articleAlreadyHasCta(content: string): boolean {
  const lastLines = content.slice(-500).toLowerCase();
  return (
    lastLines.includes('---\n\n*') ||
    lastLines.includes('free trial') ||
    lastLines.includes('book a demo') ||
    lastLines.includes('demo öffnen') ||
    lastLines.includes('rozpocznij') ||
    lastLines.includes('kostenlosen trial')
  );
}

function detectLang(filename: string): string {
  if (filename.includes('_PL')) return 'PL';
  if (filename.includes('_DE')) return 'DE';
  return 'EN';
}

function enrichArticle(articlePath: string, ctaData: CtaData, productName: string): { changed: boolean; path: string } {
  const content = fs.readFileSync(articlePath, 'utf-8');
  const lang = detectLang(path.basename(articlePath));
  const config = PRODUCT_CONFIGS[productName];

  if (!config) {
    return { changed: false, path: articlePath };
  }

  let modified = content;
  let changed = false;

  if (!articleAlreadyHasCta(content) && ctaData.primaryCta && ctaData.secondaryCta) {
    const templateFn = CTA_TEMPLATES[lang]?.default;
    if (templateFn) {
      const ctaBlock = templateFn(ctaData, config);
      modified = modified.trimEnd() + '\n' + ctaBlock;
      changed = true;
    }
  }

  if (changed && !DRY_RUN) {
    fs.writeFileSync(articlePath, modified, 'utf-8');
  }

  return { changed, path: articlePath };
}

function processAllArticles() {
  const products = fs.readdirSync(BLOGS_ROOT).filter((d) => {
    const fullPath = path.join(BLOGS_ROOT, d, 'Blog');
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
  });

  let totalProcessed = 0;
  let totalChanged = 0;
  let totalSkipped = 0;

  for (const product of products) {
    if (PRODUCT_FILTER && product !== PRODUCT_FILTER) continue;

    const blogDir = path.join(BLOGS_ROOT, product, 'Blog');
    const articles = fs.readdirSync(blogDir).filter((d) => {
      const fullPath = path.join(blogDir, d);
      return fs.statSync(fullPath).isDirectory() && !d.startsWith('_');
    });

    console.log(`\n=== ${product} (${articles.length} articles) ===`);

    for (const articleDir of articles) {
      const articlePath = path.join(blogDir, articleDir);
      const ctaPath = path.join(articlePath, 'cta.md');

      let ctaData: CtaData = { primaryCta: '', secondaryCta: '', productBridge: '' };
      if (fs.existsSync(ctaPath)) {
        ctaData = parseCtaMd(fs.readFileSync(ctaPath, 'utf-8'));
      }

      const langs = ['EN', 'PL', 'DE'];
      for (const lang of langs) {
        const filePath = path.join(articlePath, `article_${lang}.md`);
        if (!fs.existsSync(filePath)) continue;

        totalProcessed++;
        const result = enrichArticle(filePath, ctaData, product);
        if (result.changed) {
          totalChanged++;
          console.log(`  ${DRY_RUN ? '[DRY] ' : ''}CHANGED: ${articleDir}/article_${lang}.md`);
        } else {
          totalSkipped++;
        }
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${totalProcessed}`);
  console.log(`Changed: ${totalChanged}`);
  console.log(`Skipped (already enriched): ${totalSkipped}`);
  if (DRY_RUN) console.log(`(DRY RUN — no files were modified)`);
}

processAllArticles();
