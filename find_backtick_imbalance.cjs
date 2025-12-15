
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server/services/aiService.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let totalBackticks = 0;
let openStartLine = -1;

lines.forEach((line, index) => {
    // Count backticks that are NOT escaped
    // Use regex to match ` not preceded by \
    // Note: checking for \\` (escaped backslash then backtick) vs \` (escaped backtick) is tricky.
    // Simplifying: just match all backticks for now, see what happens.

    const matches = line.match(/`/g);
    if (matches) {
        totalBackticks += matches.length;
    }

    // Check if we are "inside" a backtick string
    // This is naive because 3 backticks ``` is odd, but inside a string it might be just content.
    // But usually odd count means change of state.

    if (totalBackticks % 2 !== 0) {
        if (openStartLine === -1) openStartLine = index + 1;
    } else {
        if (openStartLine !== -1) {
            console.log(`Region ${openStartLine} - ${index + 1} seems to be a template string.`);
            openStartLine = -1;
        }
    }
});

if (openStartLine !== -1) {
    console.log(`FATAL: Backticks open at ${openStartLine} and never close!`);
}
