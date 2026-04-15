#!/usr/bin/env ts-node
/**
 * DeepL Translation CLI for Consultify i18n
 *
 * Alternative to the OpenAI-based translate-help.ts.
 * Uses DeepL API for high-quality translations with glossary support.
 *
 * Setup:
 *   1. Get a DeepL API key (free or pro) from https://www.deepl.com/pro-api
 *   2. Set DEEPL_API_KEY environment variable
 *
 * Usage:
 *   npx ts-node scripts/i18n/translate-deepl.ts --check     Check for missing keys
 *   npx ts-node scripts/i18n/translate-deepl.ts --translate  Translate missing keys
 *   npx ts-node scripts/i18n/translate-deepl.ts --paths "landing,pricing,about"  Translate specific paths
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load local env overrides (ignored by git) if present.
// We intentionally do NOT print any env values.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false });

const DEEPL_API_KEY = process.env.DEEPL_API_KEY || '';
const DEEPL_API_URL = DEEPL_API_KEY.endsWith(':fx')
  ? 'https://api-free.deepl.com/v2'
  : 'https://api.deepl.com/v2';

const LOCALE_DIR = path.resolve(__dirname, '../../public/locales');
const SOURCE_LOCALE = 'en';

const DEEPL_LANG_MAP: Record<string, string> = {
  pl: 'PL',
  de: 'DE',
  es: 'ES',
  ar: 'AR',
  ja: 'JA',
};

const TARGET_LOCALES = Object.keys(DEEPL_LANG_MAP);

const GLOSSARY_TERMS: Record<string, Record<string, string>> = {
  Consultify: { pl: 'Consultify', de: 'Consultify', es: 'Consultify', ar: 'Consultify', ja: 'Consultify' },
  'DBR77': { pl: 'DBR77', de: 'DBR77', es: 'DBR77', ar: 'DBR77', ja: 'DBR77' },
  AI: { pl: 'AI', de: 'KI', es: 'IA', ar: 'الذكاء الاصطناعي', ja: 'AI' },
  SSO: { pl: 'SSO', de: 'SSO', es: 'SSO', ar: 'SSO', ja: 'SSO' },
  API: { pl: 'API', de: 'API', es: 'API', ar: 'API', ja: 'API' },
  MCP: { pl: 'MCP', de: 'MCP', es: 'MCP', ar: 'MCP', ja: 'MCP' },
  SLA: { pl: 'SLA', de: 'SLA', es: 'SLA', ar: 'SLA', ja: 'SLA' },
  DPA: { pl: 'DPA', de: 'DPA', es: 'DPA', ar: 'DPA', ja: 'DPA' },
  ROI: { pl: 'ROI', de: 'ROI', es: 'ROI', ar: 'ROI', ja: 'ROI' },
};

function loadJson(filePath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
  }
}

function saveJson(filePath: string, data: Record<string, unknown>): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        if (typeof item === 'string') {
          result[`${fullKey}.${idx}`] = item;
        } else if (typeof item === 'object' && item !== null) {
          Object.assign(result, flattenObject(item as Record<string, unknown>, `${fullKey}.${idx}`));
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    }
  }
  return result;
}

function setNestedKey(obj: Record<string, unknown>, keyPath: string, value: string): void {
  const parts = keyPath.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    if (!(part in current)) {
      current[part] = /^\d+$/.test(nextPart) ? [] : {};
    }
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = parts[parts.length - 1];
  if (Array.isArray(current)) {
    current[parseInt(lastPart, 10)] = value;
  } else {
    current[lastPart] = value;
  }
}

function findMissingKeys(
  sourceFlat: Record<string, string>,
  targetFlat: Record<string, string>,
  pathFilters?: string[]
): string[] {
  return Object.keys(sourceFlat).filter((key) => {
    if (pathFilters && pathFilters.length > 0) {
      if (!pathFilters.some((p) => key.startsWith(p))) return false;
    }
    return !(key in targetFlat);
  });
}

async function translateBatch(
  texts: string[],
  targetLang: string
): Promise<string[]> {
  if (!DEEPL_API_KEY) {
    console.error('DEEPL_API_KEY not set. Set it to use DeepL translations.');
    return texts;
  }

  const deeplLang = DEEPL_LANG_MAP[targetLang];
  if (!deeplLang) {
    console.error(`No DeepL language mapping for: ${targetLang}`);
    return texts;
  }

  const response = await fetch(`${DEEPL_API_URL}/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: texts,
      source_lang: 'EN',
      target_lang: deeplLang,
      preserve_formatting: true,
      tag_handling: 'html',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepL API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as { translations: { text: string }[] };
  let results = data.translations.map((t) => t.text);

  const glossary = GLOSSARY_TERMS;
  results = results.map((text) => {
    let result = text;
    for (const [term, translations] of Object.entries(glossary)) {
      if (translations[targetLang]) {
        const regex = new RegExp(term, 'gi');
        result = result.replace(regex, translations[targetLang]);
      }
    }
    return result;
  });

  return results;
}

async function checkMissing(pathFilters?: string[]): Promise<void> {
  const sourceFile = path.join(LOCALE_DIR, SOURCE_LOCALE, 'translation.json');
  const source = loadJson(sourceFile);
  const sourceFlat = flattenObject(source);

  console.log(`\nSource: ${SOURCE_LOCALE} (${Object.keys(sourceFlat).length} keys)\n`);

  for (const locale of TARGET_LOCALES) {
    const targetFile = path.join(LOCALE_DIR, locale, 'translation.json');
    const target = loadJson(targetFile);
    const targetFlat = flattenObject(target);
    const missing = findMissingKeys(sourceFlat, targetFlat, pathFilters);

    if (missing.length > 0) {
      console.log(`  ${locale}: ${missing.length} missing keys`);
      missing.slice(0, 5).forEach((k) => console.log(`    - ${k}`));
      if (missing.length > 5) console.log(`    ... and ${missing.length - 5} more`);
    } else {
      console.log(`  ${locale}: all keys present`);
    }
  }
}

async function translateMissing(pathFilters?: string[]): Promise<void> {
  const sourceFile = path.join(LOCALE_DIR, SOURCE_LOCALE, 'translation.json');
  const source = loadJson(sourceFile);
  const sourceFlat = flattenObject(source);

  console.log(`\nSource: ${SOURCE_LOCALE} (${Object.keys(sourceFlat).length} keys)\n`);

  const BATCH_SIZE = 25;

  for (const locale of TARGET_LOCALES) {
    const targetFile = path.join(LOCALE_DIR, locale, 'translation.json');
    const target = loadJson(targetFile);
    const targetFlat = flattenObject(target);
    const missing = findMissingKeys(sourceFlat, targetFlat, pathFilters);

    if (missing.length === 0) {
      console.log(`  ${locale}: no missing keys, skipping`);
      continue;
    }

    console.log(`  ${locale}: translating ${missing.length} keys...`);

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      const textsToTranslate = batch.map((key) => sourceFlat[key]);

      try {
        const translated = await translateBatch(textsToTranslate, locale);
        for (let j = 0; j < batch.length; j++) {
          setNestedKey(target as Record<string, unknown>, batch[j], translated[j]);
        }
        console.log(`    batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} keys done`);
      } catch (err) {
        console.error(`    batch ${Math.floor(i / BATCH_SIZE) + 1}: FAILED`, err);
      }

      if (i + BATCH_SIZE < missing.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    saveJson(targetFile, target as Record<string, unknown>);
    console.log(`  ${locale}: saved ${missing.length} translations\n`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const hasCheck = args.includes('--check');
  const hasTranslate = args.includes('--translate');
  const pathsIdx = args.indexOf('--paths');
  const pathFilters = pathsIdx >= 0 && args[pathsIdx + 1]
    ? args[pathsIdx + 1].split(',').map((p) => p.trim())
    : undefined;

  if (hasCheck) {
    await checkMissing(pathFilters);
  } else if (hasTranslate) {
    if (!DEEPL_API_KEY) {
      console.error('Set DEEPL_API_KEY to use DeepL translations.');
      process.exit(1);
    }
    await translateMissing(pathFilters);
  } else {
    console.log('Usage:');
    console.log('  --check                     Check for missing translations');
    console.log('  --translate                  Translate missing keys via DeepL');
    console.log('  --paths "landing,pricing"    Limit to specific key prefixes');
  }
}

main().catch(console.error);
