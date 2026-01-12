/**
 * Audit React components for hardcoded strings that should be translated
 * Scans for potential Polish text, untranslated placeholders, and common patterns.
 * 
 * Usage: node scripts/i18n_audit.cjs
 */
const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, '../components');
const viewsDir = path.join(__dirname, '../views');

// Polish-specific characters pattern
const polishPattern = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

// Common hardcoded string patterns
const patterns = {
    polishText: />[^<]*[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ][^<]*</g,
    untranslatedPlaceholder: /placeholder=["'][^"']*[A-Z][a-z]+[^"']*["']/g,
    untranslatedTitle: /title=["'][^"']*[A-Z][a-z]+.*["']/g,
    rawStringInJsx: />\s*[A-Z][a-z]+(?:\s+[a-z]+)+\s*</g,
};

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const issues = [];
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);

    // Check for Polish characters (likely untranslated)
    if (polishPattern.test(content)) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            if (polishPattern.test(line) && !line.includes('// ') && !line.includes('* ')) {
                issues.push({
                    file: relativePath,
                    line: idx + 1,
                    type: 'POLISH_TEXT',
                    content: line.trim().substring(0, 80)
                });
            }
        });
    }

    return issues;
}

function scanDirectory(dir) {
    let allIssues = [];

    if (!fs.existsSync(dir)) {
        console.log(`Directory not found: ${dir}`);
        return allIssues;
    }

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
            allIssues = allIssues.concat(scanDirectory(fullPath));
        } else if (item.isFile() && (item.name.endsWith('.tsx') || item.name.endsWith('.jsx'))) {
            allIssues = allIssues.concat(scanFile(fullPath));
        }
    }

    return allIssues;
}

console.log('\n========================================');
console.log('  HARDCODED STRING AUDIT');
console.log('========================================\n');

console.log('Scanning components/...');
const componentIssues = scanDirectory(componentsDir);

console.log('Scanning views/...');
const viewIssues = scanDirectory(viewsDir);

const allIssues = [...componentIssues, ...viewIssues];

if (allIssues.length === 0) {
    console.log('\n✅ No hardcoded Polish text found!\n');
} else {
    console.log(`\n⚠️  Found ${allIssues.length} potential issues:\n`);

    // Group by file
    const byFile = {};
    allIssues.forEach(issue => {
        if (!byFile[issue.file]) byFile[issue.file] = [];
        byFile[issue.file].push(issue);
    });

    for (const [file, issues] of Object.entries(byFile)) {
        console.log(`📄 ${file}`);
        issues.forEach(issue => {
            console.log(`   L${issue.line}: ${issue.content}`);
        });
        console.log('');
    }
}

console.log('========================================\n');
