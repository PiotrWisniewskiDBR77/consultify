import fs from 'node:fs';
import path from 'node:path';

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function getNestedValue(obj, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => current?.[key], obj);
}

function findMissingKeys(source, target, basePath = '') {
  const missing = [];
  if (typeof source !== 'object' || source === null) return missing;

  for (const key of Object.keys(source)) {
    const currentPath = basePath ? `${basePath}.${key}` : key;

    if (!target || !(key in target)) {
      missing.push(currentPath);
      continue;
    }

    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      missing.push(...findMissingKeys(source[key], target[key], currentPath));
    }
  }

  return missing;
}

function check() {
  const rootDir = process.cwd();
  const configPath = path.join(rootDir, 'scripts/i18n/i18n-config.json');
  const config = loadJson(configPath);

  const localesDir = path.join(rootDir, config.localesDir);
  const source = loadJson(path.join(localesDir, config.sourceLocale, 'translation.json'));

  console.log('ℹ Checking for missing translations...\n');

  let totalMissing = 0;

  for (const locale of config.targetLocales || []) {
    const target = loadJson(path.join(localesDir, locale, 'translation.json'));
    const missingPaths = [];

    for (const helpPath of config.helpPaths || []) {
      const sourceContent = getNestedValue(source, helpPath);
      const targetContent = getNestedValue(target, helpPath);

      if (sourceContent && !targetContent) {
        missingPaths.push(helpPath);
      } else if (sourceContent) {
        missingPaths.push(...findMissingKeys(sourceContent, targetContent, helpPath));
      }
    }

    if (missingPaths.length > 0) {
      console.log(`⚠ ${locale.toUpperCase()}: ${missingPaths.length} missing translations`);
      for (const p of missingPaths.slice(0, 5)) console.log(`  - ${p}`);
      if (missingPaths.length > 5) console.log(`  ... and ${missingPaths.length - 5} more`);
      totalMissing += missingPaths.length;
    } else {
      console.log(`✓ ${locale.toUpperCase()}: All translations complete`);
    }
  }

  console.log();
  if (totalMissing > 0) {
    console.log(`⚠ Total missing: ${totalMissing} translations`);
    console.log('ℹ Run "npm run i18n:translate" to translate missing keys');
    process.exit(1);
  } else {
    console.log('✓ All translations are up to date!');
  }
}

check();

