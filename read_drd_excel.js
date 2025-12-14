import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const filePath = '/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/knowledge/DRD 2.0/DRD_AI_Maturity_Matrix.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    console.log('Sheets:', workbook.SheetNames);

    const result = {};
    const sheetsToExtract = ['AI_MATURITY_MATRIX'];

    workbook.SheetNames.forEach(name => {
        if (sheetsToExtract.includes(name)) {
            const sheet = workbook.Sheets[name];
            result[name] = XLSX.utils.sheet_to_json(sheet);
        }
    });

    const fs = require('fs');
    fs.writeFileSync('drd_extraction.json', JSON.stringify(result, null, 2));
    console.log('Saved to drd_extraction.json');

} catch (error) {
    console.error('Error reading excel:', error);
}
