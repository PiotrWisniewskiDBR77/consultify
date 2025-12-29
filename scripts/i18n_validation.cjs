/**
 * Validate language completeness across all locales
 * Checks that all translation files have the same key structure as English base.
 * 
 * Usage: node scripts/i18n_validation.cjs
 * Exit code 0 = all pass, 1 = failures found
 */
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../public/locales');
const languages = ['en', 'pl', 'de', 'ar', 'ja', 'es'];
const baseLanguage = 'en';

/**
 * Count keys recursively in an object
 */
function countKeys(obj) {
    let count = 0;
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            count += countKeys(obj[key]);
        } else {
            count++;
        }
    }
    return count;
}

/**
 * Get all keys as flat array of dot-notation paths
 */
function getKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(getKeys(obj[key], fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

// Load base translation
const basePath = path.join(localesDir, baseLanguage, 'translation.json');
const baseTranslation = JSON.parse(fs.readFileSync(basePath, 'utf-8'));
const baseKeys = new Set(getKeys(baseTranslation));
const baseCount = baseKeys.size;

console.log('\n========================================');
console.log('  LANGUAGE COMPLETENESS VERIFICATION');
console.log('========================================\n');
console.log(`Base language: ${baseLanguage} (${baseCount} keys)\n`);

let allPass = true;

for (const lang of languages) {
    const langPath = path.join(localesDir, lang, 'translation.json');
    const langTranslation = JSON.parse(fs.readFileSync(langPath, 'utf-8'));
    const langKeys = new Set(getKeys(langTranslation));
    const langCount = langKeys.size;

    // Find missing keys (in base but not in lang)
    const missingKeys = [...baseKeys].filter(k => !langKeys.has(k));

    // Find extra keys (in lang but not in base)
    const extraKeys = [...langKeys].filter(k => !baseKeys.has(k));

    const status = missingKeys.length === 0 ? '✅' : '❌';
    console.log(`${status} ${lang}: ${langCount} keys`);

    if (missingKeys.length > 0) {
        allPass = false;
        console.log(`   ⚠️  Missing: ${missingKeys.length} keys`);
        missingKeys.slice(0, 5).forEach(k => console.log(`      - ${k}`));
        if (missingKeys.length > 5) console.log(`      ...and ${missingKeys.length - 5} more`);
    }

    if (extraKeys.length > 0) {
        console.log(`   ℹ️  Extra: ${extraKeys.length} keys (not in base)`);
    }
}

console.log('\n========================================');
if (allPass) {
    console.log('  ✅ ALL LANGUAGES HAVE COMPLETE KEY STRUCTURE');
    console.log('========================================\n');
    process.exit(0);
} else {
    console.log('  ❌ SOME LANGUAGES ARE MISSING KEYS');
    console.log('========================================\n');
    process.exit(1);
}
