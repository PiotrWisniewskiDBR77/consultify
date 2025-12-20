const fs = require('fs');
const path = require('path');

const plPath = path.join(__dirname, '../public/locales/pl/translation.json');
const enPath = path.join(__dirname, '../public/locales/en/translation.json');

const pl = JSON.parse(fs.readFileSync(plPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Helper to set value safely
function setDeepValue(obj, pathParts, value) {
    let current = obj;
    for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) current[part] = {};
        current = current[part];
    }
    current[pathParts[pathParts.length - 1]] = value;
}

// Keys to add
const newKeys = {
    // Assessment Workspace (AxisWorkspace)
    "assessment.workspace.axisProgress": { pl: "POSTĘP OSI", en: "AXIS PROGRESS" },
    "assessment.workspace.approved": { pl: "Zatwierdzone", en: "Approved" },
    "assessment.workspace.remaining": { pl: "Pozostało", en: "Remaining" },
    "assessment.workspace.assessmentArea": { pl: "OBSZAR OCENY", en: "ASSESSMENT AREA" },
    "assessment.workspace.functionalArea": { pl: "OBSZAR FUNKCJONALNY", en: "FUNCTIONAL AREA" },
    "assessment.workspace.selectArea": { pl: "Wybierz Obszar", en: "Select Area" },

    // Assessment Card (LevelDetailCard)
    "assessment.card.level": { pl: "POZIOM", en: "LEVEL" },
    "assessment.card.helperQuestions": { pl: "Pytania Pomocnicze", en: "Helper Questions" },
    "assessment.card.workingFormula": { pl: "Formuła Pracy (Logic)", en: "Working Formula (Logic)" },
    "assessment.card.actual": { pl: "Obecny", en: "Actual" },
    "assessment.card.target": { pl: "Docelowy", en: "Target" },
    "assessment.card.notApplicable": { pl: "Nie dotyczy", en: "Not Applicable" },
    "assessment.card.note": { pl: "Notatka", en: "Note" },
    "assessment.card.notePlaceholder": {
        pl: "Wpisz swoje spostrzeżenia... a AI pomoże Ci je rozwinąć i sformatować.",
        en: "Type your observations... AI will help you expand and format them."
    },
    "assessment.card.accuracyHint": {
        pl: "Dokładne notatki pomagają generować lepsze rekomendacje.",
        en: "Accurate notes help generate better recommendations."
    },
    "assessment.card.save": { pl: "Zapisz", en: "Save" },
    "assessment.card.ai": { pl: "AI", en: "AI" },

    // Common
    "common.level": { pl: "Poziom", en: "Level" }
};

for (const key in newKeys) {
    const parts = key.split('.');
    setDeepValue(pl, parts, newKeys[key].pl);
    setDeepValue(en, parts, newKeys[key].en);
}

fs.writeFileSync(plPath, JSON.stringify(pl, null, 2));
fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
console.log(`Added ${Object.keys(newKeys).length} new UI keys to both languages.`);
