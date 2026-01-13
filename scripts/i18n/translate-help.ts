#!/usr/bin/env ts-node
/**
 * Automatic Help Translation CLI
 *
 * Usage:
 *   npm run i18n:check              - Check for missing translations
 *   npm run i18n:translate          - Translate missing keys
 *   npm run i18n:translate --force  - Force retranslate all
 *   npm run i18n:validate           - Validate JSON structure
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
interface I18nConfig {
  sourceLocale: string;
  targetLocales: string[];
  localesDir: string;
  helpPaths: string[];
  glossary: Record<string, Record<string, string>>;
  aiProvider: string;
  aiModel: string;
  batchSize: number;
  cacheFile: string;
}

interface TranslationCache {
  [hash: string]: {
    translations: Record<string, string>;
    timestamp: string;
  };
}

interface TranslationResult {
  locale: string;
  path: string;
  status: 'translated' | 'cached' | 'error';
  message?: string;
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

const log = {
  info: (msg: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  dim: (msg: string) => console.log(`${colors.dim}${msg}${colors.reset}`),
};

class TranslationCLI {
  private config: I18nConfig;
  private cache: TranslationCache = {};
  private rootDir: string;

  constructor() {
    this.rootDir = path.resolve(__dirname, '../..');
    this.config = this.loadConfig();
    this.cache = this.loadCache();
  }

  private loadConfig(): I18nConfig {
    const configPath = path.join(__dirname, 'i18n-config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config not found: ${configPath}`);
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  private loadCache(): TranslationCache {
    const cachePath = path.join(__dirname, 'translation-cache.json');
    if (fs.existsSync(cachePath)) {
      try {
        return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      } catch {
        return {};
      }
    }
    return {};
  }

  private saveCache(): void {
    const cachePath = path.join(__dirname, 'translation-cache.json');
    fs.writeFileSync(cachePath, JSON.stringify(this.cache, null, 2));
  }

  private getLocalePath(locale: string): string {
    return path.join(this.rootDir, this.config.localesDir, locale, 'translation.json');
  }

  private loadLocale(locale: string): Record<string, any> {
    const filePath = this.getLocalePath(locale);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Locale file not found: ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  private saveLocale(locale: string, data: Record<string, any>): void {
    const filePath = this.getLocalePath(locale);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: Record<string, any>, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const parent = keys.reduce((current, key) => {
      if (!(key in current)) current[key] = {};
      return current[key];
    }, obj);
    parent[lastKey] = value;
  }

  private hashContent(content: any): string {
    return crypto.createHash('md5').update(JSON.stringify(content)).digest('hex');
  }

  private findMissingKeys(source: any, target: any, basePath = ''): string[] {
    const missing: string[] = [];

    if (typeof source !== 'object' || source === null) {
      return missing;
    }

    for (const key in source) {
      const currentPath = basePath ? `${basePath}.${key}` : key;

      if (!(key in (target || {}))) {
        missing.push(currentPath);
      } else if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        missing.push(...this.findMissingKeys(source[key], target[key], currentPath));
      }
    }

    return missing;
  }

  private async translateWithAI(
    content: any,
    targetLocale: string,
    contextPath: string
  ): Promise<any> {
    // Build glossary context
    const glossaryHints = Object.entries(this.config.glossary)
      .filter(([_, translations]) => translations[targetLocale])
      .map(([term, translations]) => `"${term}" → "${translations[targetLocale]}"`)
      .join('\n');

    const languageNames: Record<string, string> = {
      pl: 'Polish',
      de: 'German',
      es: 'Spanish',
      ar: 'Arabic',
      ja: 'Japanese',
    };

    const prompt = `Translate the following JSON content to ${languageNames[targetLocale] || targetLocale}.

Context: This is help documentation for the Consultinity enterprise platform.

GLOSSARY (use exact translations):
${glossaryHints}

RULES:
1. Maintain exact JSON structure
2. Keep technical terms (API, SSO, AI, ROI, KPI, PDF) unchanged
3. Use formal/professional tone
4. For Arabic: ensure RTL-appropriate text
5. Keep placeholder syntax like {{variable}} unchanged
6. Translate array items maintaining same order

Content path: ${contextPath}

SOURCE JSON:
${JSON.stringify(content, null, 2)}

Respond with ONLY the translated JSON, no explanation.`;

    // Check if AI translation is available via environment
    const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      log.warn(`No AI API key found. Using placeholder for ${targetLocale}:${contextPath}`);
      // Return content with [TRANSLATE] prefix for manual review
      return this.addTranslatePrefix(content, targetLocale);
    }

    try {
      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.aiModel || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a professional translator for enterprise software documentation.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        }),
      });

      const data = await response.json();
      const translatedText = data.choices?.[0]?.message?.content;

      if (!translatedText) {
        throw new Error('Empty response from AI');
      }

      // Parse JSON from response (handle markdown code blocks)
      const jsonMatch = translatedText.match(/```(?:json)?\s*([\s\S]*?)```/) || [
        null,
        translatedText,
      ];
      return JSON.parse(jsonMatch[1].trim());
    } catch (error: any) {
      log.error(`AI translation failed: ${error.message}`);
      return this.addTranslatePrefix(content, targetLocale);
    }
  }

  private addTranslatePrefix(content: any, locale: string): any {
    if (typeof content === 'string') {
      return `[${locale.toUpperCase()}:TODO] ${content}`;
    }
    if (Array.isArray(content)) {
      return content.map((item) => this.addTranslatePrefix(item, locale));
    }
    if (typeof content === 'object' && content !== null) {
      const result: Record<string, any> = {};
      for (const key in content) {
        result[key] = this.addTranslatePrefix(content[key], locale);
      }
      return result;
    }
    return content;
  }

  async check(): Promise<void> {
    log.info('Checking for missing translations...\n');

    const source = this.loadLocale(this.config.sourceLocale);
    let totalMissing = 0;

    for (const locale of this.config.targetLocales) {
      const target = this.loadLocale(locale);
      const missingPaths: string[] = [];

      for (const helpPath of this.config.helpPaths) {
        const sourceContent = this.getNestedValue(source, helpPath);
        const targetContent = this.getNestedValue(target, helpPath);

        if (sourceContent && !targetContent) {
          missingPaths.push(helpPath);
        } else if (sourceContent) {
          const missing = this.findMissingKeys(sourceContent, targetContent, helpPath);
          missingPaths.push(...missing);
        }
      }

      if (missingPaths.length > 0) {
        log.warn(`${locale.toUpperCase()}: ${missingPaths.length} missing translations`);
        missingPaths.slice(0, 5).forEach((p) => log.dim(`  - ${p}`));
        if (missingPaths.length > 5) {
          log.dim(`  ... and ${missingPaths.length - 5} more`);
        }
        totalMissing += missingPaths.length;
      } else {
        log.success(`${locale.toUpperCase()}: All translations complete`);
      }
    }

    console.log();
    if (totalMissing > 0) {
      log.warn(`Total missing: ${totalMissing} translations`);
      log.info('Run "npm run i18n:translate" to translate missing keys');
      process.exit(1);
    } else {
      log.success('All translations are up to date!');
    }
  }

  async translate(force = false): Promise<void> {
    log.info(`Translating help content${force ? ' (forced)' : ''}...\n`);

    const source = this.loadLocale(this.config.sourceLocale);
    const results: TranslationResult[] = [];

    for (const locale of this.config.targetLocales) {
      const target = this.loadLocale(locale);
      let modified = false;

      for (const helpPath of this.config.helpPaths) {
        const sourceContent = this.getNestedValue(source, helpPath);
        if (!sourceContent) continue;

        const contentHash = this.hashContent(sourceContent);
        const cacheKey = `${locale}:${helpPath}`;
        const cached = this.cache[contentHash];

        // Check if cached and not forced
        if (!force && cached?.translations[locale]) {
          const targetContent = this.getNestedValue(target, helpPath);
          if (targetContent) {
            results.push({ locale, path: helpPath, status: 'cached' });
            continue;
          }
        }

        // Check if translation needed
        const targetContent = this.getNestedValue(target, helpPath);
        const missingKeys = this.findMissingKeys(sourceContent, targetContent, helpPath);

        if (!force && missingKeys.length === 0) {
          continue;
        }

        log.info(`Translating ${locale}:${helpPath}...`);

        try {
          const translated = await this.translateWithAI(sourceContent, locale, helpPath);
          this.setNestedValue(target, helpPath, translated);
          modified = true;

          // Update cache
          if (!this.cache[contentHash]) {
            this.cache[contentHash] = { translations: {}, timestamp: new Date().toISOString() };
          }
          this.cache[contentHash].translations[locale] = 'done';

          results.push({ locale, path: helpPath, status: 'translated' });
          log.success(`Translated ${locale}:${helpPath}`);
        } catch (error: any) {
          results.push({ locale, path: helpPath, status: 'error', message: error.message });
          log.error(`Failed ${locale}:${helpPath}: ${error.message}`);
        }
      }

      if (modified) {
        this.saveLocale(locale, target);
        log.success(`Saved ${locale}/translation.json`);
      }
    }

    this.saveCache();

    // Summary
    console.log('\n--- Summary ---');
    const translated = results.filter((r) => r.status === 'translated').length;
    const cached = results.filter((r) => r.status === 'cached').length;
    const errors = results.filter((r) => r.status === 'error').length;

    log.success(`Translated: ${translated}`);
    log.dim(`Cached: ${cached}`);
    if (errors > 0) log.error(`Errors: ${errors}`);
  }

  async validate(): Promise<void> {
    log.info('Validating translation files...\n');

    const allLocales = [this.config.sourceLocale, ...this.config.targetLocales];
    let hasErrors = false;

    for (const locale of allLocales) {
      const filePath = this.getLocalePath(locale);

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        JSON.parse(content);
        log.success(`${locale}: Valid JSON`);
      } catch (error: any) {
        log.error(`${locale}: Invalid JSON - ${error.message}`);
        hasErrors = true;
      }
    }

    // Check structure consistency
    console.log('\nChecking structure consistency...');
    const source = this.loadLocale(this.config.sourceLocale);

    for (const locale of this.config.targetLocales) {
      const target = this.loadLocale(locale);

      for (const helpPath of this.config.helpPaths) {
        const sourceContent = this.getNestedValue(source, helpPath);
        const targetContent = this.getNestedValue(target, helpPath);

        if (sourceContent && !targetContent) {
          log.warn(`${locale}: Missing path "${helpPath}"`);
        } else if (sourceContent && typeof sourceContent === 'object') {
          const sourceKeys = Object.keys(sourceContent).length;
          const targetKeys = Object.keys(targetContent || {}).length;

          if (sourceKeys !== targetKeys) {
            log.warn(`${locale}:${helpPath}: Key count mismatch (${targetKeys}/${sourceKeys})`);
          }
        }
      }
    }

    if (hasErrors) {
      process.exit(1);
    }

    console.log();
    log.success('Validation complete!');
  }
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);
  const cli = new TranslationCLI();

  if (args.includes('--check') || args.includes('-c')) {
    await cli.check();
  } else if (args.includes('--translate') || args.includes('-t')) {
    const force = args.includes('--force') || args.includes('-f');
    await cli.translate(force);
  } else if (args.includes('--validate') || args.includes('-v')) {
    await cli.validate();
  } else {
    console.log(`
i18n Translation CLI

Usage:
  npx ts-node scripts/i18n/translate-help.ts [command] [options]

Commands:
  --check, -c      Check for missing translations
  --translate, -t  Translate missing keys
  --validate, -v   Validate JSON structure and consistency

Options:
  --force, -f      Force retranslate all content (with --translate)

Examples:
  npm run i18n:check
  npm run i18n:translate
  npm run i18n:translate --force
  npm run i18n:validate
`);
  }
}

main().catch(console.error);
