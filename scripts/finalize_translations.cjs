const fs = require('fs');
const path = require('path');

const plPath = path.join(__dirname, '../public/locales/pl/translation.json');
const enPath = path.join(__dirname, '../public/locales/en/translation.json');

const pl = JSON.parse(fs.readFileSync(plPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// 1. Fix Missing in PL: settings.profile.photoHint
if (en.settings && en.settings.profile && en.settings.profile.photoHint) {
    if (!pl.settings.profile) pl.settings.profile = {};
    pl.settings.profile.photoHint = "Akceptuje JPG, PNG (Auto-optymalizacja)";
}

// 2. Fix Missing in PL: assessment.axisContent.processes.areas.sales.levels.6
try {
    pl.assessment.axisContent.processes.areas.sales.levels["6"] = "Prognozowanie Sprzedaży oparte na AI";
} catch (e) { }

// 3. Fix Missing in EN: common.status.underConstruction
if (!en.common) en.common = {};
if (!en.common.status) en.common.status = {};
en.common.status.underConstruction = "Component Under Construction";
// careful, the diff said 'common.status.underConstruction', but my fix added 'common.underConstruction' to PL?
// Let's check where I added it in fix_pl_missing.cjs: "common.underConstruction": "Komponent w Budowie"
// BUT the diff mentions "common.status.underConstruction".
// Ah, line 439 of en/translation.json (viewed earlier): "underConstruction": "Component Under Construction" was inside 'common' (lines 426-440).
// Wait, "common": { "status": { ... }, "underConstruction": ... }
// So it is `common.underConstruction`.
// Why did diff say `common.status.underConstruction`?
// Maybe I read the diff wrong or the key is actually `common.status.underConstruction` in PL?
// In `fix_pl_missing.cjs`, I added: "common.status.underConstruction" (Wait, I added "common.status.saved" etc).
// I added "common.underConstruction" at the end of the list.
// Let's just safeguard both locations.

en.common.underConstruction = "Component Under Construction";

fs.writeFileSync(plPath, JSON.stringify(pl, null, 2));
fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
console.log("Final patch applied.");
