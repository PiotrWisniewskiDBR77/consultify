#!/usr/bin/env node
/**
 * Analyze Lazy Loaders
 * 
 * Analyzes all lazy loader patterns in TypeScript services
 * Categorizes them and identifies conversion strategies
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVICES_DIR = path.join(ROOT_DIR, 'server/src/services');
const LEGACY_SERVICES_DIR = path.join(ROOT_DIR, 'server/services');

const results = {
    total: 0,
    patterns: {
        simple: [],      // Just re-export, no modifications
        wrapper: [],     // Wrapper with some logic
        conditional: [], // Conditional loading
        complex: []      // Complex dependencies
    },
    critical: [],
    byLegacyFile: {},
    circular: []
};

function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(ROOT_DIR, filePath);
    
    // Check if uses lazy loader
    if (!content.includes('createCachedLazyService')) {
        return null;
    }
    
    results.total++;
    
    const analysis = {
        file: relativePath,
        lines: content.split('\n').length,
        lazyLoaders: [],
        imports: [],
        exports: [],
        pattern: 'unknown'
    };
    
    // Extract lazy loader calls
    const lazyLoaderRegex = /createCachedLazyService\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = lazyLoaderRegex.exec(content)) !== null) {
        const legacyPath = match[1];
        analysis.lazyLoaders.push(legacyPath);
        
        // Track by legacy file
        const legacyFile = path.basename(legacyPath);
        if (!results.byLegacyFile[legacyFile]) {
            results.byLegacyFile[legacyFile] = [];
        }
        results.byLegacyFile[legacyFile].push(relativePath);
    }
    
    // Extract imports
    const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
    while ((match = importRegex.exec(content)) !== null) {
        analysis.imports.push(match[1]);
    }
    
    // Extract exports
    const exportRegex = /export\s+(default|const|function|class|interface|type)\s+(\w+)/g;
    while ((match = exportRegex.exec(content)) !== null) {
        analysis.exports.push(match[2]);
    }
    
    // Determine pattern
    const hasOnlyLazyLoader = analysis.lazyLoaders.length === 1 && 
                              analysis.imports.length <= 2 && 
                              analysis.exports.length <= 1;
    
    const hasConditionalLogic = /if\s*\(|switch\s*\(|ternary|&&|\|\|/.test(content);
    const hasComplexLogic = analysis.lines > 50 || 
                            analysis.imports.length > 5 ||
                            /try\s*\{|catch\s*\(/.test(content);
    
    if (hasOnlyLazyLoader && !hasConditionalLogic && !hasComplexLogic) {
        analysis.pattern = 'simple';
        results.patterns.simple.push(analysis);
    } else if (hasConditionalLogic) {
        analysis.pattern = 'conditional';
        results.patterns.conditional.push(analysis);
    } else if (hasComplexLogic) {
        analysis.pattern = 'complex';
        results.patterns.complex.push(analysis);
    } else {
        analysis.pattern = 'wrapper';
        results.patterns.wrapper.push(analysis);
    }
    
    // Check if critical service
    const criticalKeywords = ['auth', 'billing', 'database', 'payment', 'user', 'session', 'token'];
    const isCritical = criticalKeywords.some(keyword => 
        relativePath.toLowerCase().includes(keyword)
    );
    
    if (isCritical) {
        results.critical.push(analysis);
    }
    
    return analysis;
}

function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
            analyzeFile(fullPath);
        }
    }
}

console.log('\n🔍 ANALYZING LAZY LOADERS\n');
console.log('Scanning TypeScript services...\n');

walkDir(SERVICES_DIR);

// Check for circular dependencies
console.log('Checking for circular dependencies...\n');
for (const [legacyFile, tsFiles] of Object.entries(results.byLegacyFile)) {
    if (tsFiles.length > 1) {
        results.circular.push({
            legacyFile,
            tsFiles,
            count: tsFiles.length
        });
    }
}

// Summary
console.log('═'.repeat(60));
console.log('📊 ANALYSIS RESULTS\n');
console.log(`Total lazy loaders found: ${results.total}`);
console.log(`\nPatterns:`);
console.log(`  Simple (re-export only): ${results.patterns.simple.length}`);
console.log(`  Wrapper (some logic): ${results.patterns.wrapper.length}`);
console.log(`  Conditional: ${results.patterns.conditional.length}`);
console.log(`  Complex: ${results.patterns.complex.length}`);
console.log(`\nCritical services: ${results.critical.length}`);
console.log(`Circular dependencies: ${results.circular.length}`);
console.log('═'.repeat(60));

// Save results
const reportPath = path.join(ROOT_DIR, 'docs/LAZY_LOADER_ANALYSIS.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📄 Full analysis saved to: docs/LAZY_LOADER_ANALYSIS.json`);

// Generate markdown report
let markdown = `# Lazy Loader Analysis Report

**Generated:** ${new Date().toISOString()}

## Summary

- **Total lazy loaders:** ${results.total}
- **Simple patterns:** ${results.patterns.simple.length} (auto-convertible)
- **Wrapper patterns:** ${results.patterns.wrapper.length}
- **Conditional patterns:** ${results.patterns.conditional.length}
- **Complex patterns:** ${results.patterns.complex.length}
- **Critical services:** ${results.critical.length}
- **Circular dependencies:** ${results.circular.length}

## Pattern Categories

### Simple (Auto-convertible)
These are just re-exports with no logic. Can be automatically converted.

\`\`\`
${results.patterns.simple.slice(0, 10).map(a => `- ${a.file} → ${a.lazyLoaders[0]}`).join('\n')}
${results.patterns.simple.length > 10 ? `... and ${results.patterns.simple.length - 10} more` : ''}
\`\`\`

### Critical Services
These services are critical for application functionality and should be converted first.

\`\`\`
${results.critical.slice(0, 20).map(a => `- ${a.file} → ${a.lazyLoaders.join(', ')}`).join('\n')}
${results.critical.length > 20 ? `... and ${results.critical.length - 20} more` : ''}
\`\`\`

## Circular Dependencies

\`\`\`
${results.circular.slice(0, 10).map(c => `- ${c.legacyFile}: ${c.tsFiles.length} TS files`).join('\n')}
${results.circular.length > 10 ? `... and ${results.circular.length - 10} more` : ''}
\`\`\`

## Conversion Strategy

1. **Phase 1:** Convert ${results.patterns.simple.length} simple patterns automatically
2. **Phase 2:** Convert ${results.critical.length} critical services manually
3. **Phase 3:** Handle ${results.circular.length} circular dependencies
4. **Phase 4:** Convert remaining ${results.patterns.wrapper.length + results.patterns.conditional.length + results.patterns.complex.length} complex patterns
`;

const markdownPath = path.join(ROOT_DIR, 'docs/LAZY_LOADER_PATTERNS.md');
fs.writeFileSync(markdownPath, markdown);
console.log(`📄 Pattern report saved to: docs/LAZY_LOADER_PATTERNS.md`);

// Critical services list
const criticalMarkdown = `# Critical Services List

**Generated:** ${new Date().toISOString()}

These services are critical for application functionality and should be converted with priority.

## Services

${results.critical.map(a => `### ${path.basename(a.file, '.ts')}
- **File:** \`${a.file}\`
- **Legacy:** \`${a.lazyLoaders.join('`, `')}\`
- **Pattern:** ${a.pattern}
- **Lines:** ${a.lines}
`).join('\n')}

## Conversion Priority

1. Database-related services
2. Auth-related services  
3. Billing/payment services
4. User/session services
5. Other critical services
`;

const criticalPath = path.join(ROOT_DIR, 'docs/CRITICAL_SERVICES.md');
fs.writeFileSync(criticalPath, criticalMarkdown);
console.log(`📄 Critical services list saved to: docs/CRITICAL_SERVICES.md`);

console.log('\n✅ Analysis complete!\n');


