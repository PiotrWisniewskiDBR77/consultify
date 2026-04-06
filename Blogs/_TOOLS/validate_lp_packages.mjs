#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOGS_ROOT = path.resolve(__dirname, '..');
const PRODUCTS = ['IoT', 'IRIS', 'DT', 'Marketplace', 'Vector'];
const REQUIRED_FILES = [
  'article_EN.md',
  'article_PL.md',
  'article_DE.md',
  'seo.md',
  'cta.md',
  'publish.md',
  'social.md',
  'sources.md',
  'image-prompts.md',
];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const onlyProduct = process.argv[2];
  const products = onlyProduct ? [onlyProduct] : PRODUCTS;
  let hasError = false;
  let hasWarning = false;

  for (const product of products) {
    const blogRoot = path.join(BLOGS_ROOT, product, 'Blog');
    const manifestPath = path.join(BLOGS_ROOT, '_LP_KB_READY', product, 'knowledge_base_manifest.json');
    const relationPath = path.join(BLOGS_ROOT, '_LP_KB_READY', product, 'relation_manifest.json');
    const rendererPath = path.join(BLOGS_ROOT, '_LP_KB_READY', product, 'renderer_manifest.json');
    const qaPath = path.join(BLOGS_ROOT, '_LP_KB_READY', product, 'qa_manifest.json');

    console.log(`
=== ${product} ===`);
    for (const p of [manifestPath, relationPath, rendererPath, qaPath]) {
      if (!fs.existsSync(p)) {
        console.log(`MISSING manifest: ${p}`);
        hasError = true;
      }
    }
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = readJson(manifestPath);
    const slugs = manifest.articles.map((a) => a.slug);
    if (slugs.length != 50) {
      console.log(`Expected 50 articles in manifest, got ${slugs.length}`);
      hasError = true;
    }

    for (const slug of slugs) {
      const dirName = fs.readdirSync(blogRoot).find((d) => d === slug || d.endsWith(slug));
      if (!dirName) {
        console.log(`Missing folder for slug: ${slug}`);
        hasError = true;
        continue;
      }
      const articleDir = path.join(blogRoot, dirName);
      for (const file of REQUIRED_FILES) {
        if (!fs.existsSync(path.join(articleDir, file))) {
          console.log(`Missing ${file} in ${product}/${dirName}`);
          hasError = true;
        }
      }
      const dupes = fs.readdirSync(articleDir).filter((f) => / 2\.md$/i.test(f));
      if (dupes.length) {
        console.log(`Duplicate files in ${product}/${dirName}: ${dupes.join(', ')}`);
        hasWarning = true;
      }
    }

    const forbidden = fs.readdirSync(blogRoot).filter((name) => name.startsWith('00_') || name.startsWith('_archive_'));
    console.log(`Manifest folders: ${slugs.length}`);
    console.log(`Operational entries at Blog root (expected, must be excluded when copying): ${forbidden.length}`);
  }

  if (hasError) {
    console.error('\nValidation failed. Resolve missing files, duplicate * 2.md variants, or manifest gaps.');
    process.exit(1);
  }

  if (hasWarning) {
    console.warn('\nValidation passed with warnings. Duplicate * 2.md variants exist in the source tree, but copy/export scripts exclude them by design.');
  }

  console.log('\nAll LP article packages are structurally valid and copy-ready.');
}

main();
