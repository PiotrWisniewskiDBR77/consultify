#!/usr/bin/env node
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PRODUCTS = ['IoT', 'IRIS', 'DT', 'Marketplace', 'Vector'];
const importScript = path.join(ROOT, 'server', 'scripts', 'import-kb-product.ts');
const copyAssets = process.argv.includes('--copy-assets');

for (const product of PRODUCTS) {
  const args = ['--import', 'tsx', importScript, product];
  if (copyAssets) args.push('--copy-assets');
  const res = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
}

console.log('\nGenerated KB imports for all 5 LP products.');
