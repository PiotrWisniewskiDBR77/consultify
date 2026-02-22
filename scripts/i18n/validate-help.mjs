import fs from 'node:fs';
import path from 'node:path';

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function getNestedValue(obj, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => current?.[key], obj);
}

function validate() {
  const rootDir = process.cwd();
  const configPath = path.join(rootDir, 'scripts/i18n/i18n-config.json');
  const config = loadJson(configPath);

  const localesDir = path.join(rootDir, config.localesDir);
  const allLocales = [config.sourceLocale, ...(config.targetLocales || [])];

  let hasErrors = false;

  console.log('ℹ Validating translation files...\n');

  for (const locale of allLocales) {
    const filePath = path.join(localesDir, locale, 'translation.json');
    try {
      loadJson(filePath);
      console.log(`✓ ${locale}: Valid JSON`);
    } catch (error) {
      hasErrors = true;
      console.log(`✗ ${locale}: Invalid JSON - ${error?.message || String(error)}`);
    }
  }

  console.log('\nChecking structure consistency...');
  const source = loadJson(path.join(localesDir, config.sourceLocale, 'translation.json'));

  for (const locale of config.targetLocales || []) {
    const target = loadJson(path.join(localesDir, locale, 'translation.json'));

    for (const helpPath of config.helpPaths || []) {
      const sourceContent = getNestedValue(source, helpPath);
      const targetContent = getNestedValue(target, helpPath);

      if (sourceContent && !targetContent) {
        console.log(`⚠ ${locale}: Missing path "${helpPath}"`);
      } else if (sourceContent && typeof sourceContent === 'object') {
        const sourceKeys = Object.keys(sourceContent).length;
        const targetKeys = Object.keys(targetContent || {}).length;

        if (sourceKeys !== targetKeys) {
          console.log(`⚠ ${locale}:${helpPath}: Key count mismatch (${targetKeys}/${sourceKeys})`);
        }
      }
    }
  }

  if (hasErrors) process.exit(1);

  console.log('\n✓ Validation complete!');
}

validate();

