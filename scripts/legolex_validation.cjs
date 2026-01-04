/**
 * Validate all Legolex demo files contain English-only content
 * 
 * Usage: node scripts/legolex_validation.cjs
 * Exit code 0 = all match English, 1 = some differ
 */
const fs = require('fs');
const path = require('path');

const seedsDir = path.join(__dirname, '../server/seeds');
const files = [
    'demo_legolex_en.json',
    'demo_legolex_pl.json',
    'demo_legolex_de.json',
    'demo_legolex_ar.json',
    'demo_legolex_ja.json',
    'demo_legolex_es.json'
];

const englishBase = fs.readFileSync(path.join(seedsDir, 'demo_legolex_en.json'), 'utf-8');
let allMatch = true;

console.log('\n========================================');
console.log('  LEGOLEX DEMO DATA VERIFICATION');
console.log('========================================\n');

for (const file of files) {
    const filePath = path.join(seedsDir, file);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ ${file} - FILE NOT FOUND`);
        allMatch = false;
        continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const matches = content === englishBase;
    const status = matches ? '✅' : '❌';
    console.log(`${status} ${file}`);

    if (!matches) {
        allMatch = false;
    }
}

console.log('\n========================================');
if (allMatch) {
    console.log('  ✅ ALL DEMO FILES MATCH ENGLISH');
    console.log('========================================\n');
    process.exit(0);
} else {
    console.log('  ❌ SOME FILES DIFFER FROM ENGLISH');
    console.log('========================================\n');
    process.exit(1);
}
