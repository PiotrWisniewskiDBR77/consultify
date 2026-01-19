#!/usr/bin/env node
/**
 * i18n Validation Script for CI/CD
 * 
 * Validates translation files and fails if coverage is below threshold
 * 
 * Usage:
 *   node scripts/i18n/validate-ci.cjs
 *   node scripts/i18n/validate-ci.cjs --strict   # Require 100% coverage for PL
 * 
 * Exit codes:
 *   0 - All validations passed
 *   1 - Validation failed
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../../public/locales');
const SOURCE_LOCALE = 'en';
const TARGET_LOCALES = ['pl', 'de', 'es', 'ar', 'ja'];
const NAMESPACES = ['translation', 'assessment-module', 'discovery'];

// Thresholds
const THRESHOLDS = {
  pl: { coverage: 95, strict: 100 },  // Polish should be near-complete
  de: { coverage: 50, strict: 80 },
  es: { coverage: 50, strict: 80 },
  ar: { coverage: 50, strict: 80 },
  ja: { coverage: 50, strict: 80 },
};

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
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
    return { _error: e.message };
  }
}

function getAllKeys(obj, prefix = '') {
  const keys = [];
  if (typeof obj !== 'object' || obj === null) return keys;
  
  for (const key of Object.keys(obj)) {
    if (key === '_error') continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && obj[key] !== null) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function validateLocale(locale, namespace, sourceKeys, strictMode) {
  const targetFile = path.join(LOCALES_DIR, locale, `${namespace}.json`);
  const target = loadJson(targetFile);
  
  const result = {
    locale,
    namespace,
    exists: !!target,
    valid: true,
    errors: [],
    warnings: [],
    coverage: 0,
    missingKeys: 0,
  };
  
  if (!target) {
    result.valid = false;
    result.errors.push(`File missing: ${locale}/${namespace}.json`);
    return result;
  }
  
  if (target._error) {
    result.valid = false;
    result.errors.push(`Invalid JSON: ${target._error}`);
    return result;
  }
  
  const targetKeys = getAllKeys(target);
  const missingKeys = sourceKeys.filter(k => !targetKeys.includes(k));
  
  result.missingKeys = missingKeys.length;
  result.coverage = Math.round(((sourceKeys.length - missingKeys.length) / sourceKeys.length) * 100);
  
  const threshold = strictMode ? THRESHOLDS[locale].strict : THRESHOLDS[locale].coverage;
  
  if (result.coverage < threshold) {
    result.valid = false;
    result.errors.push(
      `Coverage ${result.coverage}% is below ${strictMode ? 'strict ' : ''}threshold of ${threshold}%`
    );
  }
  
  // Check for placeholder markers
  const placeholderCount = countPlaceholders(target);
  if (placeholderCount > 0) {
    if (strictMode) {
      result.valid = false;
      result.errors.push(`Contains ${placeholderCount} untranslated placeholder(s)`);
    } else {
      result.warnings.push(`Contains ${placeholderCount} untranslated placeholder(s)`);
    }
  }
  
  return result;
}

function countPlaceholders(obj, count = 0) {
  if (typeof obj === 'string') {
    if (obj.startsWith('[PL]') || obj.startsWith('[DE]') || 
        obj.startsWith('[ES]') || obj.startsWith('[AR]') || 
        obj.startsWith('[JA]') || obj.startsWith('[TODO]')) {
      return 1;
    }
    return 0;
  }
  if (Array.isArray(obj)) {
    return obj.reduce((sum, item) => sum + countPlaceholders(item), 0);
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj).reduce((sum, val) => sum + countPlaceholders(val), 0);
  }
  return 0;
}

function main() {
  const args = process.argv.slice(2);
  const strictMode = args.includes('--strict');
  
  console.log('\n' + '='.repeat(60));
  console.log('  i18n CI VALIDATION');
  console.log('='.repeat(60));
  console.log(`Mode: ${strictMode ? 'STRICT' : 'STANDARD'}\n`);
  
  let hasErrors = false;
  const results = [];
  
  // Load source keys for each namespace
  const sourceKeysByNamespace = {};
  for (const namespace of NAMESPACES) {
    const sourceFile = path.join(LOCALES_DIR, SOURCE_LOCALE, `${namespace}.json`);
    const source = loadJson(sourceFile);
    
    if (!source) {
      log(colors.red, '✗', `Source file missing: en/${namespace}.json`);
      hasErrors = true;
      continue;
    }
    
    if (source._error) {
      log(colors.red, '✗', `Invalid source JSON: ${source._error}`);
      hasErrors = true;
      continue;
    }
    
    sourceKeysByNamespace[namespace] = getAllKeys(source);
  }
  
  // Validate each locale
  for (const locale of TARGET_LOCALES) {
    console.log(`\n${colors.cyan}[${locale.toUpperCase()}]${colors.reset}`);
    
    let localeHasErrors = false;
    
    for (const namespace of NAMESPACES) {
      const sourceKeys = sourceKeysByNamespace[namespace];
      if (!sourceKeys) continue;
      
      const result = validateLocale(locale, namespace, sourceKeys, strictMode);
      results.push(result);
      
      if (!result.valid) {
        hasErrors = true;
        localeHasErrors = true;
        log(colors.red, '✗', `${namespace}: FAILED`);
        result.errors.forEach(err => {
          console.log(`${colors.dim}   ↳ ${err}${colors.reset}`);
        });
      } else if (result.warnings.length > 0) {
        log(colors.yellow, '⚠', `${namespace}: ${result.coverage}% coverage (${result.missingKeys} missing)`);
        result.warnings.forEach(warn => {
          console.log(`${colors.dim}   ↳ ${warn}${colors.reset}`);
        });
      } else {
        log(colors.green, '✓', `${namespace}: ${result.coverage}% coverage`);
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  
  const passedLocales = TARGET_LOCALES.filter(locale => 
    results.filter(r => r.locale === locale && !r.valid).length === 0
  );
  
  console.log(`\nPassed: ${passedLocales.length}/${TARGET_LOCALES.length} locales`);
  
  if (hasErrors) {
    console.log(`\n${colors.red}VALIDATION FAILED${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}VALIDATION PASSED${colors.reset}\n`);
    process.exit(0);
  }
}

main();
