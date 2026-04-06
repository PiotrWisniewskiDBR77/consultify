#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOGS_ROOT = path.resolve(__dirname, '..');
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

function readManifest(product) {
  const manifestPath = path.join(BLOGS_ROOT, '_LP_KB_READY', product, 'knowledge_base_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing manifest: ${manifestPath}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function slugToFolder(blogRoot, slug) {
  return fs.readdirSync(blogRoot).find((name) => name === slug || name.endsWith(slug)) || null;
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function main() {
  const [product, destinationRoot] = process.argv.slice(2);
  if (!product || !destinationRoot) {
    console.error('Usage: node Blogs/_TOOLS/copy_lp_article_packages.mjs <Product> <LP repo root>');
    console.error('Example: node Blogs/_TOOLS/copy_lp_article_packages.mjs IoT /path/to/lp-repo');
    process.exit(1);
  }

  const manifest = readManifest(product);
  const blogRoot = path.join(BLOGS_ROOT, product, 'Blog');
  const outRoot = path.join(destinationRoot, 'Blogs', product, 'Blog');

  let copiedFolders = 0;
  let copiedFiles = 0;

  for (const article of manifest.articles) {
    const slug = article.slug;
    const folder = slugToFolder(blogRoot, slug);
    if (!folder) {
      throw new Error(`Missing article folder for slug: ${slug}`);
    }

    const srcDir = path.join(blogRoot, folder);
    const destDir = path.join(outRoot, folder);
    fs.mkdirSync(destDir, { recursive: true });

    for (const file of REQUIRED_FILES) {
      const srcFile = path.join(srcDir, file);
      if (!fs.existsSync(srcFile)) {
        throw new Error(`Missing required file ${file} in ${srcDir}`);
      }
      copyFile(srcFile, path.join(destDir, file));
      copiedFiles += 1;
    }

    const srcAssetsDir = path.join(srcDir, 'assets', 'images');
    if (fs.existsSync(srcAssetsDir)) {
      const allowedAssets = fs.readdirSync(srcAssetsDir).filter((name) => !/ 2\./.test(name));
      for (const asset of allowedAssets) {
        const srcAsset = path.join(srcAssetsDir, asset);
        if (!fs.statSync(srcAsset).isFile()) continue;
        copyFile(srcAsset, path.join(destDir, 'assets', 'images', asset));
        copiedFiles += 1;
      }
    }

    copiedFolders += 1;
  }

  console.log(`Copied ${copiedFolders} article folders and ${copiedFiles} files to ${outRoot}`);
  console.log('Excluded by design: 00_*, _archive_*, * 2.md, CSVs, and Blog root operational files.');
}

main();
