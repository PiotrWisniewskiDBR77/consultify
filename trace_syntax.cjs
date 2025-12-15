
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server/services/aiService.js');
const source = fs.readFileSync(filePath, 'utf8');

// Primitive clean (same as before but per line logic needs care)
// We will process char by char but keep track of lines.

let curly = 0;
let square = 0;
let lineNum = 1;

let inString = false;
let stringChar = '';

for (let i = 0; i < source.length; i++) {
    const char = source[i];

    // Handle newlines
    if (char === '\n') {
        lineNum++;
        continue;
    }

    // Handle Strings (naive)
    if (inString) {
        if (char === stringChar && source[i - 1] !== '\\') {
            inString = false;
        }
        continue;
    }

    if (char === '"' || char === '\'' || char === '`') {
        inString = true;
        stringChar = char;
        continue;
    }

    // Handle Comments (naive - ignoring // for now as logic is complex char-by-char, 
    // but assuming clean code structure mostly)
    // Real parser is hard. Let's trust previous clean logic? 
    // No, line numbers need original source.

    // Simplification: if we see / followed by / we ignore till newline.
    if (char === '/' && source[i + 1] === '/') {
        // Skip until newline
        while (source[i] !== '\n' && i < source.length) {
            i++;
        }
        lineNum++;
        continue;
    }

    if (char === '{') curly++;
    if (char === '}') {
        curly--;
        if (curly < 0) console.log(`LINE ${lineNum}: Negative Curly Balance!`);
    }

    if (char === '[') square++;
    if (char === ']') {
        square--;
        if (square < 0) console.log(`LINE ${lineNum}: Negative Square Balance!`);
    }
}

console.log(`Final Curly: ${curly}`);
console.log(`Final Square: ${square}`);
