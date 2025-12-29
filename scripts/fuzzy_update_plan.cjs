/**
 * Sync all translation files to match EN baseline
 * This script adds missing keys from English to all other language files
 * while preserving existing translations.
 * 
 * Usage: node scripts/sync_translations.cjs
 */
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../public/locales');
const languages = ['en', 'pl', 'de', 'ar', 'ja', 'es'];
const baseLanguage = 'en';

/**
 * Deep merge target with source, adding missing keys from source
 * Preserves existing values in target
 */
function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else if (!(key in result)) {
            // Only add if not already present in target
            result[key] = source[key];
        }
    }
    return result;
}

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

console.log('\n========================================');
console.log('  TRANSLATION SYNC TOOL');
console.log('========================================\n');

// Load base translation
const basePath = path.join(localesDir, baseLanguage, 'translation.json');
const baseTranslation = JSON.parse(fs.readFileSync(basePath, 'utf-8'));
const baseKeyCount = countKeys(baseTranslation);

console.log(`Base language: ${baseLanguage} (${baseKeyCount} keys)\n`);

for (const lang of languages) {
    if (lang === baseLanguage) {
        console.log(`⏭️  ${lang}: Skipped (base language)`);
        continue;
    }

    const langPath = path.join(localesDir, lang, 'translation.json');
    const langTranslation = JSON.parse(fs.readFileSync(langPath, 'utf-8'));
    const beforeCount = countKeys(langTranslation);

    // Merge: add missing keys from base to language file
    const merged = deepMerge(langTranslation, baseTranslation);

    // Strict Parity: Remove keys that are NOT in baseTranslation
    function removeOrphans(target, source) {
        const result = { ...target };
        for (const key in result) {
            if (!(key in source)) {
                delete result[key];
            } else if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = removeOrphans(result[key], source[key]);
            }
        }
        return result;
    }

    const final = removeOrphans(merged, baseTranslation);
    const afterCount = countKeys(final);
    const addedKeys = afterCount - beforeCount; // This isn't strictly accurate if we deleted more than added, but good enough for output

    // Write back
    fs.writeFileSync(langPath, JSON.stringify(final, null, 2) + '\n', 'utf-8');

    console.log(`✅ ${lang}: ${beforeCount} → ${afterCount} keys`);
}

console.log('\n========================================');
console.log('  ✅ SYNC COMPLETE');
console.log('========================================\n');
