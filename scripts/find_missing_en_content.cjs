const fs = require('fs');
const path = require('path');

const plPath = path.join(__dirname, '../public/locales/pl/translation.json');
const enPath = path.join(__dirname, '../public/locales/en/translation.json');
const drdPath = path.join(__dirname, '../drd_data.json');

const pl = JSON.parse(fs.readFileSync(plPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const drd = JSON.parse(fs.readFileSync(drdPath, 'utf8'));

// Map Translation Key Segment -> DRD Data Name/ID
const dataMapping = {
    // Axis 1: Processes
    "processes": {
        "sales": { id: "1A" },
        "marketing": { id: "1B" },
        "technology": { id: "1C" }, // R&D
        "purchasing": { id: "1D" },
        "logistics": { id: "1E" },
        "production": { id: "1F" },
        "quality": { id: "1G" },
        "finance": { id: "1H" },
        "hr": { id: "1I" }
    },
    // Axis 2: Digital Products
    "digitalProducts": {
        "electronic": { id: "2A" },
        "community": { id: "2B" },
        "ict": { id: "2C" },
        "fit": { id: "2D" },
        "scalability": { id: "2E" }
    },
    // Axis 3: Business Models
    "businessModels": {
        "ecommerce": { id: "3A" },
        "platform": { id: "3B" },
        "aas": { id: "3C" },
        "sharing": { id: "3D" },
        "monetization": { id: "3E" }
    },
    // Axis 4: Data Management
    "dataManagement": {
        "collection": { id: "4A" },
        "storage": { id: "4B" },
        "communication": { id: "4C" },
        "analysis": { id: "4D" }, // Check ID 4D in drd_data
        "computing": { id: "4E" }  // Check ID 4E in drd_data
    },
    // Axis 5: Culture
    "culture": {
        "leadership": { id: "5A" },
        "readiness": { id: "5B" },
        "improvement": { id: "5C" },
        "innovation": { id: "5D" },
        "resources": { id: "5E" }
    },
    // Axis 6: Cybersecurity
    "cybersecurity": {
        "strategy": { id: "6A" },
        "network": { id: "6B" },
        "dataProtection": { id: "6C" },
        "education": { id: "6D" },
        "contingency": { id: "6E" }
    }
};

// Flatten DRD Data for easy lookup
const drdLookup = {};
drd.forEach(axis => {
    axis.areas.forEach(area => {
        area.levels.forEach(lvl => {
            drdLookup[`${area.id}.level${lvl.level}`] = lvl;
        });
    });
});

const missingInEn = {};

function traverse(plObj, enObj, pathStr = '') {
    for (const key in plObj) {
        const newPath = pathStr ? `${pathStr}.${key}` : key;
        const plVal = plObj[key];
        const enVal = enObj ? enObj[key] : undefined;

        if (enVal === undefined) {
            // Found missing key
            const info = { pl_value: plVal };

            // Try to find in DRD Data if it's a description
            // Path expected: processes.areas.sales.level1Desc
            if (newPath.endsWith('Desc')) {
                const match = newPath.match(/([^\.]+)\.areas\.([^\.]+)\.level(\d+)Desc/);
                if (match) {
                    const axisKey = match[1];
                    const areaKey = match[2];
                    const levelNum = match[3];

                    if (dataMapping[axisKey] && dataMapping[axisKey][areaKey]) {
                        const areaId = dataMapping[axisKey][areaKey].id;
                        const drdEntry = drdLookup[`${areaId}.level${levelNum}`];
                        if (drdEntry) {
                            info.drd_value = drdEntry.description;
                            info.drd_title = drdEntry.title;
                        }
                    }
                }
            }

            missingInEn[newPath] = info;
        } else if (typeof plVal === 'object' && plVal !== null && !Array.isArray(plVal)) {
            traverse(plVal, enVal, newPath);
        }
    }
}

// Start traversal at assessment.axisContent
if (pl.assessment && pl.assessment.axisContent) {
    traverse(pl.assessment.axisContent, en.assessment && en.assessment.axisContent ? en.assessment.axisContent : {});
}

// Write result
fs.writeFileSync(path.join(__dirname, '../missing_en_content.json'), JSON.stringify(missingInEn, null, 2));
console.log(`Found ${Object.keys(missingInEn).length} missing keys. Saved to missing_en_content.json`);
