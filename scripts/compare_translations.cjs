const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../public/locales/en/translation.json');
const plPath = path.join(__dirname, '../public/locales/pl/translation.json');

function flattenKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(flattenKeys(obj[key], newKey));
        } else {
            keys.push(newKey);
        }
    }
    return keys;
}

try {
    const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const plData = JSON.parse(fs.readFileSync(plPath, 'utf8'));

    const enKeys = new Set(flattenKeys(enData));
    const plKeys = new Set(flattenKeys(plData));

    const missingInPl = [...enKeys].filter(k => !plKeys.has(k));
    const missingInEn = [...plKeys].filter(k => !enKeys.has(k));

    console.log('--- Missing in PL ---');
    if (missingInPl.length > 0) {
        missingInPl.forEach(k => console.log(k));
    } else {
        console.log('None');
    }

    console.log('\n--- Missing in EN ---');
    if (missingInEn.length > 0) {
        missingInEn.forEach(k => console.log(k));
    } else {
        console.log('None');
    }

    if (missingInPl.length > 0 || missingInEn.length > 0) {
        console.log(`\nFAIL: Found ${missingInPl.length} missing in PL and ${missingInEn.length} missing in EN.`);
        process.exit(1);
    } else {
        console.log("\nSUCCESS: Translations are fully synchronized.");
        process.exit(0);
    }

} catch (err) {
    console.error('Error comparing translations:', err);
    process.exit(1);
}
