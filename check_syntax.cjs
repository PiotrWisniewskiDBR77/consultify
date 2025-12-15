
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server/services/aiService.js');
const source = fs.readFileSync(filePath, 'utf8');

// Primitive check (ignores strings/comments for simplicity first, or cleans them)
// Clean strings first to avoid false positives in braces
let clean = source.replace(/`[^`]*`/g, ''); // Remove template literals
clean = clean.replace(/'[^']*'/g, ''); // Remove single quotes
clean = clean.replace(/"[^"]*"/g, ''); // Remove double quotes
clean = clean.replace(/\/\/.*/g, ''); // Remove single line comments
clean = clean.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi line comments

let curly = 0;
let paren = 0;
let square = 0;

for (const char of clean) {
    if (char === '{') curly++;
    if (char === '}') curly--;
    if (char === '(') paren++;
    if (char === ')') paren--;
    if (char === '[') square++;
    if (char === ']') square--;
}

console.log(`Curly Balance: ${curly}`);
console.log(`Paren Balance: ${paren}`);
console.log(`Square Balance: ${square}`);
