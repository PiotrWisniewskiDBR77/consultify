const fs = require('fs');
const path = require('path');
const glob = require('glob');

const directories = [
    './',
    './components',
    './views',
    './contexts',
    './hooks',
    './services',
    './store',
    './utils',
    './src'
];

const extensions = ['.tsx', '.ts', '.jsx', '.js'];
const excludeDirs = ['node_modules', 'dist', 'scripts', 'server', 'tests', '.git', 'quarantine', 'cursor_plans', 'docs', 'Legal'];

const allFilesSet = new Set();
const ignorePatterns = excludeDirs.map(dir => `**/${dir}/**`);
ignorePatterns.push('**/*.test.*', '**/types/**', '**/translations.ts');

const globPattern = `**/*{${extensions.map(ext => ext.substring(1)).join(',')}}`;
const baseDir = path.resolve(__dirname, '../');

directories.forEach(dir => {
    const cwd = path.resolve(baseDir, dir);
    if (!fs.existsSync(cwd)) return;

    // Scan files in this directory (shallow if it's root, or deep if it's a subfolder)
    // Actually, glob '**/*' is recursive. To avoid duplicates and stay efficient:
    const filesInDir = glob.sync(globPattern, { cwd: cwd, ignore: ignorePatterns });
    filesInDir.forEach(file => {
        const fullPath = path.join(cwd, file);
        const relativePath = path.relative(baseDir, fullPath);
        allFilesSet.add(relativePath);
    });
});

const allFiles = Array.from(allFilesSet);
const potentialHardcoded = [];

// Simple regex to find text between tags: >Text<
const jsxTextRegex = />([^<>\n{}]+)</g;

// Regex for common props with hardcoded strings: label="Text", placeholder='Text', title={`Text`}
const propRegex = /(?:label|placeholder|title|description|text|alt|message)=["'`]([^"'`{}]+)["'`](?!\s*\/\/\s*i18n-ignore)/g;

allFiles.forEach(file => {
    const fullPath = path.join(baseDir, file);
    if (!fs.existsSync(fullPath) || fs.lstatSync(fullPath).isDirectory()) return;

    const content = fs.readFileSync(fullPath, 'utf-8');

    let match;

    // Check JSX Text
    while ((match = jsxTextRegex.exec(content)) !== null) {
        const text = match[1].trim();
        // Ignore numbers, symbols, and very short strings
        if (text && text.length > 1 && !/^[0-9\s.,!?-]+$/.test(text)) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            potentialHardcoded.push({ file, line: lineNum, text, type: 'JSX Text' });
        }
    }

    // Check Props
    while ((match = propRegex.exec(content)) !== null) {
        const text = match[1].trim();
        if (text && text.length > 1 && !/^[0-9\s.,!?-]+$/.test(text) && !text.includes('{{')) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            potentialHardcoded.push({ file, line: lineNum, text, type: 'Prop' });
        }
    }
});

console.log('\n========================================');
console.log('  POTENTIAL HARDCODED STRINGS SCANNER');
console.log('========================================\n');

if (potentialHardcoded.length === 0) {
    console.log('✅ No obvious hardcoded strings found.');
} else {
    console.log(`Found ${potentialHardcoded.length} potential hardcoded strings:\n`);
    potentialHardcoded.forEach(item => {
        console.log(`[${item.type}] ${item.file}:${item.line} -> "${item.text}"`);
    });
}

console.log('\n========================================');
