
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server/services/aiService.js');
const source = fs.readFileSync(filePath, 'utf8');

// Simplified cleanup
let cleanCode = source.replace(/\\./g, '__');
cleanCode = cleanCode.replace(/'[^'\n]*'/g, (m) => ' '.repeat(m.length));
cleanCode = cleanCode.replace(/"[^"\n]*"/g, (m) => ' '.repeat(m.length));
cleanCode = cleanCode.replace(/\/\/.*/g, '');
cleanCode = cleanCode.replace(/\/\*[\s\S]*?\*\//g, '');

const lines = cleanCode.split('\n');
let total = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let count = 0;
    for (const char of line) {
        if (char === '`') count++;
    }
    if (count > 0) {
        total += count;
        // Print relevant lines (around 1280-1330)
        if (i > 500 && i < 700) {
            if (count % 2 !== 0) {
                console.log(`Line ${i + 1}: ${count} backticks. Total: ${total}. Content: ${line.trim()}`);
            }
        }
    }
}
