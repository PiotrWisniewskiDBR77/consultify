#!/usr/bin/env node
/**
 * Analyze Circular Dependencies
 * 
 * Maps circular dependencies between TypeScript and legacy JavaScript files
 * Identifies break points for circular dependency chains
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVICES_DIR = path.join(ROOT_DIR, 'server/src/services');
const LEGACY_SERVICES_DIR = path.join(ROOT_DIR, 'server/services');
const ROUTES_DIR = path.join(ROOT_DIR, 'server/src/routes');
const LEGACY_ROUTES_DIR = path.join(ROOT_DIR, 'server/routes');

const dependencyGraph = new Map();
const circularDeps = [];

function extractImports(content, filePath) {
    const imports = [];
    const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        
        // Resolve relative paths
        if (importPath.startsWith('.')) {
            const resolved = path.resolve(path.dirname(filePath), importPath);
            const relative = path.relative(ROOT_DIR, resolved);
            imports.push(relative);
        } else if (!importPath.startsWith('@')) {
            // External dependency, skip
            continue;
        } else {
            imports.push(importPath);
        }
    }
    
    return imports;
}

function analyzeFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(ROOT_DIR, filePath);
    
    if (!dependencyGraph.has(relativePath)) {
        dependencyGraph.set(relativePath, {
            file: relativePath,
            imports: [],
            importedBy: [],
            isLegacy: filePath.includes('/services/') && !filePath.includes('/src/'),
            isTypeScript: filePath.endsWith('.ts')
        });
    }
    
    const imports = extractImports(content, filePath);
    const node = dependencyGraph.get(relativePath);
    node.imports = imports;
    
    // Track reverse dependencies
    imports.forEach(imp => {
        if (!dependencyGraph.has(imp)) {
            dependencyGraph.set(imp, {
                file: imp,
                imports: [],
                importedBy: [],
                isLegacy: false,
                isTypeScript: false
            });
        }
        dependencyGraph.get(imp).importedBy.push(relativePath);
    });
}

function findCircularDeps() {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];
    
    function dfs(node, path) {
        if (recursionStack.has(node)) {
            // Found cycle
            const cycleStart = path.indexOf(node);
            const cycle = path.slice(cycleStart);
            cycles.push([...cycle, node]);
            return;
        }
        
        if (visited.has(node)) {
            return;
        }
        
        visited.add(node);
        recursionStack.add(node);
        
        const nodeData = dependencyGraph.get(node);
        if (nodeData) {
            nodeData.imports.forEach(imp => {
                if (dependencyGraph.has(imp)) {
                    dfs(imp, [...path, node]);
                }
            });
        }
        
        recursionStack.delete(node);
    }
    
    for (const [file] of dependencyGraph) {
        if (!visited.has(file)) {
            dfs(file, []);
        }
    }
    
    return cycles;
}

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            walkDir(fullPath, callback);
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            if (!file.endsWith('.d.ts') && !file.endsWith('.min.js')) {
                callback(fullPath);
            }
        }
    }
}

console.log('\n🔍 ANALYZING CIRCULAR DEPENDENCIES\n');

// Analyze TypeScript files
console.log('Scanning TypeScript files...');
walkDir(SERVICES_DIR, analyzeFile);
walkDir(ROUTES_DIR, analyzeFile);

// Analyze legacy JavaScript files
console.log('Scanning legacy JavaScript files...');
walkDir(LEGACY_SERVICES_DIR, analyzeFile);
walkDir(LEGACY_ROUTES_DIR, analyzeFile);

console.log(`\nAnalyzed ${dependencyGraph.size} files`);

// Find circular dependencies
console.log('Finding circular dependencies...\n');
const cycles = findCircularDeps();

// Filter cycles involving both TS and JS
const tsJsCycles = cycles.filter(cycle => {
    const hasTS = cycle.some(f => dependencyGraph.get(f)?.isTypeScript);
    const hasLegacy = cycle.some(f => dependencyGraph.get(f)?.isLegacy);
    return hasTS && hasLegacy;
});

console.log('═'.repeat(60));
console.log('📊 CIRCULAR DEPENDENCY ANALYSIS\n');
console.log(`Total files analyzed: ${dependencyGraph.size}`);
console.log(`Total cycles found: ${cycles.length}`);
console.log(`TS-JS cycles: ${tsJsCycles.length}`);
console.log('═'.repeat(60));

// Identify break points
const breakPoints = new Map();

tsJsCycles.forEach((cycle, idx) => {
    console.log(`\nCycle ${idx + 1}:`);
    cycle.forEach((file, i) => {
        const node = dependencyGraph.get(file);
        const marker = i === cycle.length - 1 ? '└─' : '├─';
        const type = node?.isTypeScript ? '[TS]' : node?.isLegacy ? '[JS]' : '[?]';
        console.log(`  ${marker} ${type} ${file}`);
    });
    
    // Find best break point (prefer breaking at legacy JS files)
    const legacyFiles = cycle.filter(f => dependencyGraph.get(f)?.isLegacy);
    if (legacyFiles.length > 0) {
        breakPoints.set(cycle.join(' → '), {
            cycle,
            breakPoint: legacyFiles[0],
            reason: 'Legacy JS file - convert to TypeScript'
        });
    }
});

// Generate report
const report = {
    totalFiles: dependencyGraph.size,
    totalCycles: cycles.length,
    tsJsCycles: tsJsCycles.length,
    cycles: tsJsCycles.map(cycle => ({
        files: cycle,
        hasTS: cycle.some(f => dependencyGraph.get(f)?.isTypeScript),
        hasLegacy: cycle.some(f => dependencyGraph.get(f)?.isLegacy),
        breakPoints: cycle.filter(f => dependencyGraph.get(f)?.isLegacy)
    })),
    breakPoints: Array.from(breakPoints.values())
};

const reportPath = path.join(ROOT_DIR, 'docs/DEPENDENCY_MAP.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

let markdown = `# Dependency Map Report

**Generated:** ${new Date().toISOString()}

## Summary

- **Total files analyzed:** ${dependencyGraph.size}
- **Total cycles:** ${cycles.length}
- **TS-JS cycles:** ${tsJsCycles.length}

## Circular Dependencies (TS ↔ JS)

${tsJsCycles.map((cycle, idx) => `
### Cycle ${idx + 1}

\`\`\`
${cycle.map((file, i) => {
    const node = dependencyGraph.get(file);
    const type = node?.isTypeScript ? '[TS]' : node?.isLegacy ? '[JS]' : '[?]';
    return `${i + 1}. ${type} ${file}`;
}).join('\n')}
\`\`\`

**Break Point:** ${breakPoints.get(cycle.join(' → '))?.breakPoint || 'TBD'}
**Strategy:** ${breakPoints.get(cycle.join(' → '))?.reason || 'Convert legacy JS to TypeScript'}
`).join('\n')}

## Break Point Strategy

1. Convert legacy JS files in cycles to TypeScript
2. Update imports to use TypeScript versions
3. Remove circular dependencies

## Recommendations

${tsJsCycles.length === 0 ? '✅ No circular dependencies found!' : `
- **Priority 1:** Convert ${tsJsCycles.length} legacy JS files involved in cycles
- **Priority 2:** Update all imports to use TypeScript versions
- **Priority 3:** Verify no new cycles are created
`}
`;

const markdownPath = path.join(ROOT_DIR, 'docs/DEPENDENCY_MAP.md');
fs.writeFileSync(markdownPath, markdown);

console.log(`\n📄 Dependency map saved to: docs/DEPENDENCY_MAP.json`);
console.log(`📄 Dependency report saved to: docs/DEPENDENCY_MAP.md`);
console.log('\n✅ Analysis complete!\n');


