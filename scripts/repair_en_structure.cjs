const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../public/locales/en/translation.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const axes = [
    'processes',
    'digitalProducts',
    'businessModels',
    'dataManagement',
    'culture',
    'cybersecurity',
    'aiMaturity'
];

function mergeDeep(target, source) {
    if (typeof source !== 'object' || source === null) {
        return source;
    }
    if (typeof target !== 'object' || target === null) {
        target = {};
    }

    for (const key in source) {
        if (Array.isArray(source[key])) {
            target[key] = source[key]; // Overwrite arrays
        } else if (typeof source[key] === 'object' && source[key] !== null) {
            if (!target[key]) target[key] = {};
            target[key] = mergeDeep(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

if (!en.assessment) en.assessment = {};
if (!en.assessment.axisContent) en.assessment.axisContent = {};

axes.forEach(axis => {
    if (en[axis]) {
        console.log(`Moving root key '${axis}' to 'assessment.axisContent.${axis}'...`);

        // Ensure destination exists
        if (!en.assessment.axisContent[axis]) en.assessment.axisContent[axis] = {};

        // Merge content
        en.assessment.axisContent[axis] = mergeDeep(en.assessment.axisContent[axis], en[axis]);

        // Delete root key
        delete en[axis];
    }
});

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
console.log("Repair complete.");
