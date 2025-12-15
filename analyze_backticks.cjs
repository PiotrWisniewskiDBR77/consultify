
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server/services/aiService.js');
const source = fs.readFileSync(filePath, 'utf8');

function findUnclosedBacktick(code) {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplateString = false;
    let templateStack = []; // Stack of starting positions for template strings

    // We need to track line numbers for reporting
    let line = 1;

    for (let i = 0; i < code.length; i++) {
        const char = code[i];

        if (char === '\n') {
            line++;
            continue;
        }

        // Handle escapes
        if (char === '\\') {
            i++; // Skip next char
            continue;
        }

        if (inSingleQuote) {
            if (char === "'") inSingleQuote = false;
        } else if (inDoubleQuote) {
            if (char === '"') inDoubleQuote = false;
        } else if (inTemplateString) {
            if (char === '`') {
                // Closing template string
                const start = templateStack.pop();
                if (templateStack.length === 0) inTemplateString = false;
                else {
                    // We are back in the parent template string (if nested? wait, nesting is ${})
                    // Actually, if we just toggle, we don't support nesting via ${} fully here?
                    // Nested template strings only happen via ${ `nested` }.
                    // But inside ${}, we are in "Code" mode, not "String" mode.
                    // This parser is getting complex. 
                    // Let's simplify: A ` toggles "Template Mode" UNLESS we are in ${}.
                }
            } else if (char === '$' && code[i + 1] === '{') {
                // Entering expression interpolation
                // We need to push state?
                // For valid JS, braces balance.
                // We can just rely on matching ` unless we have ` inside ${}.
            }
        } else {
            // Not in string
            if (char === "'") inSingleQuote = true;
            else if (char === '"') inDoubleQuote = true;
            else if (char === '`') {
                inTemplateString = true;
                templateStack.push({ line, index: i });
            }
        }
    }

    // BUT! This naive state machine fails on nested logic.
    // However, sticking to the main issue: 
    // We just want to find a backtick that is NOT inside ' ' or " " and has no partner.

    // Let's iterate and just filter out '...' and "..." strings first.
    // Replace content of '...' and "..." with spaces to simplify.
}

// Simplified approach: Blind Text Replacement of string literals
// This avoids parsing headaches.
let cleanCode = source;

// 1. Remove escaped chars
cleanCode = cleanCode.replace(/\\./g, '__');

// 2. Remove '...' strings (greedy? no, minimal)
// Regex for single quoted string: /'[^']*'/g 
// Be careful with newlines in strings (allowed in template, not in single/double without escape)
cleanCode = cleanCode.replace(/'[^'\n]*'/g, (match) => ' '.repeat(match.length));

// 3. Remove "..." strings
cleanCode = cleanCode.replace(/"[^"\n]*"/g, (match) => ' '.repeat(match.length));

// 4. Remove comments
cleanCode = cleanCode.replace(/\/\/.*/g, '');
cleanCode = cleanCode.replace(/\/\*[\s\S]*?\*\//g, '');

// Now we only have backticks and code.
// Count backticks.
let total = 0;
let lines = cleanCode.split('\n');
let openLine = -1;

lines.forEach((l, idx) => {
    // Count backticks
    // Note: Template literals can be multiline.
    for (let char of l) {
        if (char === '`') {
            total++;
            if (total % 2 !== 0) {
                if (openLine === -1) openLine = idx + 1;
            } else {
                openLine = -1;
            }
        }
    }
});

if (total % 2 !== 0) {
    console.log(`FATAL: Odd number of backticks (${total}). Open since line ${openLine}`);
} else {
    console.log("Success: Even number of backticks.");
}

