
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server/services/aiService.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all variations of data cleaning regex
// Pattern: .replace(/```json/g, '')
// And: .replace(/```/g, '')
// And variations with spaces if any

// We want: .replaceAll('```json', '').replaceAll('```', '')

// Naive replacement of specific known patterns
content = content.replace(/\.replace\(\/```json\/ ?g, ''\)/g, ".replaceAll('```json', '')");
content = content.replace(/\.replace\(\/```json \/ g, ''\)/g, ".replaceAll('```json', '')");
content = content.replace(/\.replace\(\/```json\/ g, ''\)/g, ".replaceAll('```json', '')");

content = content.replace(/\.replace\(\/```\/g, ''\)/g, ".replaceAll('```', '')");

// Also handle the case where they are chained:
// We just replaced the individual .replace calls.

console.log('Fixed regex in aiService.js');

fs.writeFileSync(filePath, content, 'utf8');
