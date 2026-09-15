#!/usr/bin/env node
/**
 * Bramka F11 (DEC-461): każda flaga `VITE_*` faktycznie czytana w `src/`
 * (import.meta.env.VITE_X / import.meta.env['VITE_X'] / obiekt-mapa `env: 'VITE_X'`
 * używany przez wspólny readEnv(key)) musi mieć parę `ARG`/`ENV` w `Dockerfile.api`,
 * inaczej Railway ustawi zmienną w panelu, a `vite build` jej nie zobaczy —
 * flaga zostaje po cichu wycięta z bundla (patrz komentarz BEZPIECZNIK VITE_*
 * w Dockerfile.api).
 *
 * Wyjątki (dev-only debug, metadane builda, artefakty regexu w komentarzach/
 * testach) są wypisane z uzasadnieniem w scripts/flagi-dockerfile.wyjatki.json —
 * NIE dostają ARG/ENV, ale muszą być tam jawnie wymienione.
 *
 * Użycie: node scripts/check-flagi-dockerfile.mjs [--src <dir>] [--dockerfile <path>] [--wyjatki <path>]
 * Exit 0 = brak brakujących flag. Exit 1 = lista brakujących flag na stderr.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const out = {
    src: path.join(repo, 'src'),
    dockerfile: path.join(repo, 'Dockerfile.api'),
    wyjatki: path.join(repo, 'scripts', 'flagi-dockerfile.wyjatki.json'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--src') out.src = path.resolve(repo, argv[++i]);
    else if (a === '--dockerfile') out.dockerfile = path.resolve(repo, argv[++i]);
    else if (a === '--wyjatki') out.wyjatki = path.resolve(repo, argv[++i]);
  }
  return out;
}

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full, files);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function collectViteFlags(srcDir) {
  const flags = new Set();
  const files = walk(srcDir);
  const pattern = /\bVITE_[A-Z0-9_]+\b/g;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = pattern.exec(content)) !== null) {
      flags.add(m[0]);
    }
  }
  return flags;
}

function collectDockerfileArgs(dockerfilePath) {
  const args = new Set();
  const content = fs.readFileSync(dockerfilePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^ARG\s+(VITE_[A-Z0-9_]+)\b/);
    if (m) args.add(m[1]);
  }
  return args;
}

function loadWyjatki(wyjatkiPath) {
  if (!fs.existsSync(wyjatkiPath)) return {};
  const parsed = JSON.parse(fs.readFileSync(wyjatkiPath, 'utf8'));
  return parsed.wyjatki || {};
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(opts.src)) {
    console.error(`FLAGI_DOCKERFILE_GUARD_COMMAND_ERROR missing src dir: ${opts.src}`);
    process.exit(2);
  }
  if (!fs.existsSync(opts.dockerfile)) {
    console.error(`FLAGI_DOCKERFILE_GUARD_COMMAND_ERROR missing Dockerfile: ${opts.dockerfile}`);
    process.exit(2);
  }

  const srcFlags = collectViteFlags(opts.src);
  const dockerArgs = collectDockerfileArgs(opts.dockerfile);
  const wyjatki = loadWyjatki(opts.wyjatki);

  const missing = [];
  for (const flag of [...srcFlags].sort()) {
    if (dockerArgs.has(flag)) continue;
    if (Object.prototype.hasOwnProperty.call(wyjatki, flag)) continue;
    missing.push(flag);
  }

  if (missing.length > 0) {
    console.error('FLAGI_DOCKERFILE_GUARD: brakuje ARG w Dockerfile.api dla flag VITE_* czytanych w src/ (i nieobecnych w scripts/flagi-dockerfile.wyjatki.json):');
    for (const flag of missing) {
      console.error(`  - ${flag}`);
    }
    console.error('Dopisz `ARG X` + `ENV X=${X}` w Dockerfile.api (alfabetycznie, wzór commit bb6735d713) ALBO dodaj wyjątek z uzasadnieniem w scripts/flagi-dockerfile.wyjatki.json.');
    console.log(`FLAGI_DOCKERFILE_GUARD analyzedFlags=${srcFlags.size} dockerArgs=${dockerArgs.size} wyjatki=${Object.keys(wyjatki).length} brakujace=${missing.length}`);
    process.exit(1);
  }

  console.log(`FLAGI_DOCKERFILE_GUARD analyzedFlags=${srcFlags.size} dockerArgs=${dockerArgs.size} wyjatki=${Object.keys(wyjatki).length} brakujace=0`);
  process.exit(0);
}

main();
