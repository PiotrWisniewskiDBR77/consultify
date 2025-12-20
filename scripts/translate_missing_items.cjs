const fs = require('fs');
const path = require('path');

const missingPath = path.join(__dirname, '../missing_en_content.json');
const enPath = path.join(__dirname, '../public/locales/en/translation.json');

const missing = JSON.parse(fs.readFileSync(missingPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const formulasMap = {
    "Decyzje podejmowane są wyłącznie przez ludzi, bez systemowego wsparcia.": "Decisions are made exclusively by people, without system support.",
    "Decyzje podejmowane są przez ludzi na podstawie doświadczenia.": "Decisions are made by people based on experience.",
    "Decyzje podejmowane są przez ludzi na podstawie raportów.": "Decisions are made by people based on reports.",
    "Decyzje podejmowane są na podstawie raportów.": "Decisions are made based on reports.",
    "Człowiek decyduje, system kontroluje realizację procesu.": "Human decides, system controls process execution.",
    "Człowiek decyduje, system kontroluje proces.": "Human decides, system controls the process.",
    "System wykonuje działania według reguł, człowiek nadzoruje.": "System performs actions according to rules, human supervises.",
    "System wykonuje operacje według reguł, człowiek nadzoruje.": "System performs operations according to rules, human supervises.",
    "Decyzje podejmowane są na podstawie danych operacyjnych.": "Decisions are made based on operational data.",
    "System steruje procesem, człowiek zarządza wyjątkami.": "System controls the process, human manages exceptions.",
    "System koordynuje proces, człowiek zarządza wyjątkami.": "System coordinates the process, human manages exceptions.",
    "System steruje realizacją zleceń?": "System controls order execution?",
    "AI rekomenduje i optymalizuje, człowiek nadzoruje strategię.": "AI recommends and optimizes, human supervises strategy.",
    "Wartość polega na dostarczeniu informacji.": "Value lies in delivering information.",
    "Wartość polega na jakości i atrakcyjności treści.": "Value lies in content quality and attractiveness.",
    "Wartość polega na funkcjonalności produktu.": "Value lies in product functionality.",
    "Wartość polega na doświadczeniu i interakcji.": "Value lies in experience and interaction.",
    "Wartość polega na adaptacji i inteligencji.": "Value lies in adaptation and intelligence.",
    "Wartość = zasięg i uwaga odbiorcy.": "Value = reach and audience attention.",
    "Wartość polega na jakości społeczności.": "Value lies in community quality.",
    "Minimalna ochrona": "Minimal protection",
    "Stabilność systemów": "System stability",
    "Szybka reakcja": "Rapid response",
    "Kontrola operacyjna": "Operational control",
    "Zaufanie systemowe": "System trust",
    "Ciągłość operacyjna": "Operational continuity",
    "Ochrona danych": "Data protection",
    "Dostęp kontrolowany": "Controlled access",
    "Minimalizacja ryzyka": "Risk minimization",
    "Ciągłość biznesu": "Business continuity",
    "Wczesne ostrzeganie": "Early warning",
    "Wysokie zaufanie": "High trust",
    "Wydajność": "Performance",
    "Elastyczność": "Flexibility",
    "Skala": "Scale",
    "Optymalizacja": "Optimization",
    "Stabilność": "Stability",
    "Ograniczenia": "Limitations",
    "Ewolucja": "Evolution",
    "Autonomia": "Autonomy",
    "Uczenie": "Learning",
    "Rekomendacje": "Recommendations",
    "Przewidywanie": "Prediction",
    "Zrozumienie": "Understanding",
    "Historia": "History",
    "Jednolitość": "Uniformity",
    "Kontrola": "Control",
    "Natychmiastowość": "Immediacy",
    "Bieżąca spójność": "Current consistency",
    "Okresowa spójność": "Periodic consistency",
    "Opóźnienia": "Delays",
    "Monetyzacja": "Monetization",
    "Dopasowanie": "Fit",
    "Insight": "Insight",
    "Know-how": "Know-how",
    "Dostęp": "Access",
    "Współdzielenie": "Sharing",
    "Delegacja": "Delegation",
    "Wynik": "Result",
    "Dostępność": "Availability",
    "Wygoda": "Convenience",
    "Ekosystem wiedzy": "Knowledge ecosystem",
    "Produktywność": "Productivity"
};

function setDeepValue(obj, pathParts, value) {
    let current = obj;
    for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) current[part] = {};
        current = current[part];
    }
    current[pathParts[pathParts.length - 1]] = value;
}

let countDesc = 0;
let countFormula = 0;
let countQuestions = 0;

for (const key in missing) {
    const item = missing[key];
    const parts = key.split('.');

    // Check if key already exists in EN (might have been added by previous script)
    // Actually, we are just overwriting or adding if missing.
    // But previous script only handled 'drd_value' cases.

    if (key.endsWith('Desc')) {
        // Skip if already handled by drd_data script (check if en has it? No, just check item.drd_value)
        if (!item.drd_value && item.pl_value) {
            // Missing description without DRD match - use PL with prefix
            setDeepValue(en, parts, "[TODO] " + item.pl_value);
            countDesc++;
        }
    } else if (key.endsWith('Formula')) {
        const plText = item.pl_value;
        const translated = formulasMap[plText] || ("[PL] " + plText);
        setDeepValue(en, parts, translated);
        countFormula++;
    } else if (key.endsWith('Questions')) {
        // Questions are arrays
        if (Array.isArray(item.pl_value)) {
            const qs = item.pl_value.map(q => "[PL] " + q);
            setDeepValue(en, parts, qs);
            countQuestions++;
        }
    } else {
        // Other keys
        if (!item.drd_value && item.pl_value) {
            setDeepValue(en, parts, typeof item.pl_value === 'string' ? "[PL] " + item.pl_value : item.pl_value);
        }
    }
}

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
console.log(`Updated EN translations: ${countDesc} Descs, ${countFormula} Formulas, ${countQuestions} Questions groups.`);
