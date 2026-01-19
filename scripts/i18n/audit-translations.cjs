#!/usr/bin/env node
/**
 * i18n Translation Audit Script
 * 
 * Analyzes translation coverage across all locales
 * 
 * Usage:
 *   node scripts/i18n/audit-translations.cjs
 *   node scripts/i18n/audit-translations.cjs --json    # Output JSON report
 *   node scripts/i18n/audit-translations.cjs --fix     # Auto-fix missing keys with placeholders
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../../public/locales');
const SOURCE_LOCALE = 'en';
const TARGET_LOCALES = ['pl', 'de', 'es', 'ar', 'ja'];
const NAMESPACES = ['translation', 'assessment-module', 'discovery'];

// Common English words/patterns that indicate untranslated text
const ENGLISH_PATTERNS = [
  /^The\s/i,
  /^This\s/i,
  /^Your\s/i,
  /^A\s[a-z]/i,
  /^An\s[a-z]/i,
  /\s(the|and|or|is|are|was|were|have|has|been|will|would|could|should)\s/i,
  /^(Click|Select|Choose|Enter|Submit|Cancel|Save|Delete|Edit|View|Add|Remove)\s/i,
  /^(Please|You can|We will|This will)\s/i,
];

// Technical terms that should NOT be translated
const TECHNICAL_TERMS = [
  'API', 'SSO', 'AI', 'ROI', 'KPI', 'URL', 'JSON', 'PDF', 'CSV', 'XML',
  'Dashboard', 'Consultinity', 'DRD', 'SIRI', 'ADMA', 'CMMI', 'MES', 'ERP',
  'OAuth', 'JWT', 'HTTP', 'HTTPS', 'UUID', 'ID', 'CRM', 'IoT', 'ML',
];

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${colors.reset} ${message}`);
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    log(colors.red, '✗', `Failed to parse ${filePath}: ${e.message}`);
    return null;
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getAllKeys(obj, prefix = '') {
  const keys = [];
  if (typeof obj !== 'object' || obj === null) {
    return keys;
  }
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && obj[key] !== null) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const parent = keys.reduce((current, key) => {
    if (!(key in current)) current[key] = {};
    return current[key];
  }, obj);
  parent[lastKey] = value;
}

function isLikelyEnglish(text, locale) {
  if (typeof text !== 'string') return false;
  if (text.length < 10) return false; // Skip short strings
  
  // Check if text is mostly technical terms
  const words = text.split(/\s+/);
  const technicalCount = words.filter(w => 
    TECHNICAL_TERMS.some(t => w.toUpperCase().includes(t.toUpperCase()))
  ).length;
  if (technicalCount / words.length > 0.5) return false;
  
  // Check against English patterns
  for (const pattern of ENGLISH_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

function findUntranslatedStrings(obj, sourceObj, locale, prefix = '') {
  const untranslated = [];
  
  if (typeof obj !== 'object' || obj === null) return untranslated;
  
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    const sourceValue = sourceObj?.[key];
    
    if (typeof value === 'string') {
      // Check if value equals source (not translated)
      if (sourceValue && value === sourceValue && value.length > 20) {
        untranslated.push({ key: fullKey, value, reason: 'identical_to_source' });
      }
      // Check if looks like English
      else if (isLikelyEnglish(value, locale)) {
        untranslated.push({ key: fullKey, value, reason: 'looks_english' });
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        if (typeof item === 'string') {
          const sourceItem = sourceValue?.[idx];
          if (sourceItem && item === sourceItem && item.length > 20) {
            untranslated.push({ key: `${fullKey}[${idx}]`, value: item, reason: 'identical_to_source' });
          } else if (isLikelyEnglish(item, locale)) {
            untranslated.push({ key: `${fullKey}[${idx}]`, value: item, reason: 'looks_english' });
          }
        }
      });
    } else if (typeof value === 'object') {
      untranslated.push(...findUntranslatedStrings(value, sourceValue, locale, fullKey));
    }
  }
  
  return untranslated;
}

function auditLocale(locale, namespace) {
  const sourceFile = path.join(LOCALES_DIR, SOURCE_LOCALE, `${namespace}.json`);
  const targetFile = path.join(LOCALES_DIR, locale, `${namespace}.json`);
  
  const source = loadJson(sourceFile);
  const target = loadJson(targetFile);
  
  if (!source) {
    return { error: `Source file not found: ${sourceFile}` };
  }
  
  const result = {
    locale,
    namespace,
    sourceFile: path.relative(process.cwd(), sourceFile),
    targetFile: path.relative(process.cwd(), targetFile),
    exists: !!target,
    sourceKeys: 0,
    translatedKeys: 0,
    missingKeys: [],
    untranslatedStrings: [],
    coverage: 0,
  };
  
  if (!target) {
    result.sourceKeys = getAllKeys(source).length;
    result.missingKeys = getAllKeys(source);
    return result;
  }
  
  const sourceKeys = getAllKeys(source);
  const targetKeys = getAllKeys(target);
  
  result.sourceKeys = sourceKeys.length;
  
  // Find missing keys
  result.missingKeys = sourceKeys.filter(key => !targetKeys.includes(key));
  result.translatedKeys = sourceKeys.length - result.missingKeys.length;
  
  // Find untranslated strings (text that's still in English)
  result.untranslatedStrings = findUntranslatedStrings(target, source, locale);
  
  result.coverage = result.sourceKeys > 0 
    ? Math.round((result.translatedKeys / result.sourceKeys) * 100) 
    : 100;
  
  return result;
}

function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalLocales: TARGET_LOCALES.length,
      totalNamespaces: NAMESPACES.length,
      overallCoverage: 0,
    },
    locales: {},
  };
  
  let totalSourceKeys = 0;
  let totalTranslatedKeys = 0;
  
  console.log('\n' + '='.repeat(60));
  console.log('  i18n TRANSLATION AUDIT REPORT');
  console.log('='.repeat(60) + '\n');
  
  for (const locale of TARGET_LOCALES) {
    report.locales[locale] = {
      namespaces: {},
      totalSourceKeys: 0,
      totalTranslatedKeys: 0,
      totalMissing: 0,
      totalUntranslated: 0,
      coverage: 0,
    };
    
    console.log(`\n${colors.cyan}[${locale.toUpperCase()}]${colors.reset}`);
    console.log('-'.repeat(40));
    
    for (const namespace of NAMESPACES) {
      const result = auditLocale(locale, namespace);
      report.locales[locale].namespaces[namespace] = result;
      
      if (result.error) {
        log(colors.red, '✗', `${namespace}: ${result.error}`);
        continue;
      }
      
      if (!result.exists) {
        log(colors.red, '✗', `${namespace}: FILE MISSING (${result.sourceKeys} keys needed)`);
        report.locales[locale].totalMissing += result.sourceKeys;
        continue;
      }
      
      report.locales[locale].totalSourceKeys += result.sourceKeys;
      report.locales[locale].totalTranslatedKeys += result.translatedKeys;
      report.locales[locale].totalMissing += result.missingKeys.length;
      report.locales[locale].totalUntranslated += result.untranslatedStrings.length;
      
      totalSourceKeys += result.sourceKeys;
      totalTranslatedKeys += result.translatedKeys;
      
      const statusColor = result.coverage === 100 ? colors.green : 
                          result.coverage >= 90 ? colors.yellow : colors.red;
      const statusSymbol = result.coverage === 100 ? '✓' : 
                           result.coverage >= 90 ? '⚠' : '✗';
      
      log(statusColor, statusSymbol, 
        `${namespace}: ${result.coverage}% (${result.translatedKeys}/${result.sourceKeys} keys)`
      );
      
      if (result.missingKeys.length > 0) {
        console.log(`${colors.dim}   Missing: ${result.missingKeys.length} keys${colors.reset}`);
        result.missingKeys.slice(0, 3).forEach(key => {
          console.log(`${colors.dim}     - ${key}${colors.reset}`);
        });
        if (result.missingKeys.length > 3) {
          console.log(`${colors.dim}     ... and ${result.missingKeys.length - 3} more${colors.reset}`);
        }
      }
      
      if (result.untranslatedStrings.length > 0) {
        console.log(`${colors.yellow}   Untranslated text: ${result.untranslatedStrings.length} strings${colors.reset}`);
        result.untranslatedStrings.slice(0, 2).forEach(item => {
          const preview = item.value.substring(0, 50) + (item.value.length > 50 ? '...' : '');
          console.log(`${colors.dim}     - ${item.key}: "${preview}"${colors.reset}`);
        });
        if (result.untranslatedStrings.length > 2) {
          console.log(`${colors.dim}     ... and ${result.untranslatedStrings.length - 2} more${colors.reset}`);
        }
      }
    }
    
    // Calculate locale coverage
    if (report.locales[locale].totalSourceKeys > 0) {
      report.locales[locale].coverage = Math.round(
        (report.locales[locale].totalTranslatedKeys / report.locales[locale].totalSourceKeys) * 100
      );
    }
  }
  
  // Overall summary
  report.summary.overallCoverage = totalSourceKeys > 0 
    ? Math.round((totalTranslatedKeys / totalSourceKeys) * 100) 
    : 0;
  
  console.log('\n' + '='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\nCoverage by locale:');
  for (const locale of TARGET_LOCALES) {
    const data = report.locales[locale];
    const color = data.coverage === 100 ? colors.green : 
                  data.coverage >= 90 ? colors.yellow : colors.red;
    console.log(`  ${color}${locale.toUpperCase()}: ${data.coverage}%${colors.reset} ` +
                `(${data.totalTranslatedKeys}/${data.totalSourceKeys} keys, ` +
                `${data.totalUntranslated} untranslated strings)`);
  }
  
  console.log(`\n${colors.cyan}Overall coverage: ${report.summary.overallCoverage}%${colors.reset}`);
  
  // Show files that need to be created
  const missingFiles = [];
  for (const locale of TARGET_LOCALES) {
    for (const namespace of NAMESPACES) {
      const result = report.locales[locale].namespaces[namespace];
      if (result && !result.exists) {
        missingFiles.push(`${locale}/${namespace}.json`);
      }
    }
  }
  
  if (missingFiles.length > 0) {
    console.log(`\n${colors.red}Missing files (${missingFiles.length}):${colors.reset}`);
    missingFiles.forEach(f => console.log(`  - public/locales/${f}`));
  }
  
  return report;
}

function fixMissingKeys(dryRun = false) {
  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Fixing missing translation keys...\n`);
  
  let totalFixed = 0;
  
  for (const locale of TARGET_LOCALES) {
    for (const namespace of NAMESPACES) {
      const sourceFile = path.join(LOCALES_DIR, SOURCE_LOCALE, `${namespace}.json`);
      const targetFile = path.join(LOCALES_DIR, locale, `${namespace}.json`);
      
      const source = loadJson(sourceFile);
      if (!source) continue;
      
      let target = loadJson(targetFile);
      const createNew = !target;
      
      if (createNew) {
        target = {};
        log(colors.cyan, '→', `Creating ${locale}/${namespace}.json`);
      }
      
      const sourceKeys = getAllKeys(source);
      const targetKeys = target ? getAllKeys(target) : [];
      const missingKeys = sourceKeys.filter(key => !targetKeys.includes(key));
      
      if (missingKeys.length === 0 && !createNew) continue;
      
      for (const key of missingKeys) {
        const sourceValue = getNestedValue(source, key);
        let placeholder;
        
        if (typeof sourceValue === 'string') {
          placeholder = `[${locale.toUpperCase()}] ${sourceValue}`;
        } else if (Array.isArray(sourceValue)) {
          placeholder = sourceValue.map(item => 
            typeof item === 'string' ? `[${locale.toUpperCase()}] ${item}` : item
          );
        } else {
          placeholder = sourceValue;
        }
        
        setNestedValue(target, key, placeholder);
        totalFixed++;
      }
      
      if (!dryRun && (missingKeys.length > 0 || createNew)) {
        // Ensure directory exists
        const dir = path.dirname(targetFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        saveJson(targetFile, target);
        log(colors.green, '✓', `${locale}/${namespace}.json: ${missingKeys.length} keys added`);
      } else if (missingKeys.length > 0) {
        log(colors.yellow, '⚠', `${locale}/${namespace}.json: would add ${missingKeys.length} keys`);
      }
    }
  }
  
  console.log(`\n${dryRun ? 'Would fix' : 'Fixed'}: ${totalFixed} missing keys`);
}

// Main
const args = process.argv.slice(2);

if (args.includes('--fix')) {
  fixMissingKeys(args.includes('--dry-run'));
} else {
  const report = generateReport();
  
  if (args.includes('--json')) {
    const reportPath = path.join(__dirname, 'audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);
  }
  
  // Exit with error if coverage is below threshold
  if (report.summary.overallCoverage < 80) {
    process.exit(1);
  }
}
