const fs = require('fs');
const path = require('path');

const missingPath = path.join(__dirname, '../missing_en_content.json');
const enPath = path.join(__dirname, '../public/locales/en/translation.json');

const missing = JSON.parse(fs.readFileSync(missingPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

let count = 0;

function setDeepValue(obj, pathParts, value) {
    let current = obj;
    for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) current[part] = {};
        current = current[part];
    }
    current[pathParts[pathParts.length - 1]] = value;
}

for (const key in missing) {
    const item = missing[key];
    if (item.drd_value) {
        // Apply description from DRD Data
        const parts = key.split('.');
        setDeepValue(en, parts, item.drd_value);
        count++;
    }
}

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
console.log(`Applied ${count} descriptions from DRD Data to English translations.`);
