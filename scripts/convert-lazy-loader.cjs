#!/usr/bin/env node
/**
 * Convert Lazy Loaders to Direct Imports
 * 
 * Automatically converts simple lazy loader wrappers to direct imports
 * Only converts "simple" pattern lazy loaders (re-export only)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const ANALYSIS_FILE = path.join(ROOT_DIR, 'docs/LAZY_LOADER_ANALYSIS.json');

const results = {
    converted: [],
    skipped: [],
    errors: [],
    total: 0
};

function convertLazyLoader(filePath, analysis) {
    const fullPath = path.join(ROOT_DIR, filePath);
    
    if (!fs.existsSync(fullPath)) {
        results.errors.push({ file: filePath, error: 'File not found' });
        return false;
    }
    
    let content = fs.readFileSync(fullPath, 'utf-8');
    const originalContent = content;
    
    // Only convert simple patterns
    if (analysis.pattern !== 'simple') {
        results.skipped.push({ file: filePath, reason: `Pattern: ${analysis.pattern}` });
        return false;
    }
    
    // Check if legacy file exists
    const legacyPath = analysis.lazyLoaders[0];
    const legacyFullPath = path.resolve(path.dirname(fullPath), legacyPath);
    
    if (!fs.existsSync(legacyFullPath)) {
        results.skipped.push({ file: filePath, reason: `Legacy file not found: ${legacyPath}` });
        return false;
    }
    
    // Convert lazy loader to direct import
    // Pattern: import { createCachedLazyService } from '../utils/lazyServiceLoader.js';
    // const loadService = createCachedLazyService('../../services/service.js');
    // export default loadService();
    
    // To: import service from '../../services/service.js';
    // export default service;
    
    const legacyImportPath = legacyPath.replace(/\.js$/, '.js');
    
    // Remove lazy loader import
    content = content.replace(
        /import\s+\{\s*createCachedLazyService\s*\}\s+from\s+['"]\.\.\/utils\/lazyServiceLoader\.js['"];?\s*\n/g,
        ''
    );
    
    // Replace lazy loader creation and export
    const lazyLoaderRegex = /const\s+(\w+)\s*=\s*createCachedLazyService\(['"]([^'"]+)['"]\);?\s*\n\s*export\s+default\s+\1\(\);?/g;
    
    if (lazyLoaderRegex.test(content)) {
        // Get the export name
        const exportMatch = content.match(/export\s+default\s+(\w+)\(\)/);
        const exportName = exportMatch ? exportMatch[1] : 'service';
        
        // Replace with direct import and export
        content = content.replace(
            lazyLoaderRegex,
            `import service from '${legacyImportPath}';\n\nexport default service;`
        );
        
        // Also handle named exports if present
        content = content.replace(
            /export\s+default\s+(\w+)\(\);?/g,
            'export default service;'
        );
        
        // Clean up any remaining lazy loader references
        content = content.replace(/const\s+\w+\s*=\s*createCachedLazyService\([^)]+\);?\s*\n/g, '');
    } else {
        // Try alternative pattern matching
        const altPattern = /const\s+(\w+)\s*=\s*createCachedLazyService\(['"]([^'"]+)['"]\);?\s*\n([\s\S]*?)export\s+default\s+\1\(\);?/;
        const altMatch = content.match(altPattern);
        
        if (altMatch) {
            content = content.replace(
                altPattern,
                `import service from '${legacyImportPath}';\n\n$3export default service;`
            );
        } else {
            results.errors.push({ file: filePath, error: 'Could not match lazy loader pattern' });
            return false;
        }
    }
    
    // Write converted file
    if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        results.converted.push({
            file: filePath,
            legacyPath: legacyPath,
            linesBefore: originalContent.split('\n').length,
            linesAfter: content.split('\n').length
        });
        return true;
    }
    
    return false;
}

function main() {
    console.log('\n🔄 CONVERTING LAZY LOADERS\n');
    
    if (!fs.existsSync(ANALYSIS_FILE)) {
        console.error('❌ Analysis file not found. Run analyze-lazy-loaders.cjs first.');
        process.exit(1);
    }
    
    const analysis = JSON.parse(fs.readFileSync(ANALYSIS_FILE, 'utf-8'));
    
    console.log(`Found ${analysis.patterns.simple.length} simple lazy loaders to convert\n`);
    
    // Convert simple patterns
    for (const service of analysis.patterns.simple) {
        results.total++;
        convertLazyLoader(service.file, service);
    }
    
    // Summary
    console.log('═'.repeat(60));
    console.log('📊 CONVERSION RESULTS\n');
    console.log(`Total processed: ${results.total}`);
    console.log(`Converted: ${results.converted.length}`);
    console.log(`Skipped: ${results.skipped.length}`);
    console.log(`Errors: ${results.errors.length}`);
    console.log('═'.repeat(60));
    
    if (results.converted.length > 0) {
        console.log('\n✅ Converted files:');
        results.converted.slice(0, 10).forEach(c => {
            console.log(`  ✅ ${c.file}`);
        });
        if (results.converted.length > 10) {
            console.log(`  ... and ${results.converted.length - 10} more`);
        }
    }
    
    if (results.skipped.length > 0) {
        console.log('\n⏭️  Skipped files:');
        const skipReasons = {};
        results.skipped.forEach(s => {
            skipReasons[s.reason] = (skipReasons[s.reason] || 0) + 1;
        });
        Object.entries(skipReasons).forEach(([reason, count]) => {
            console.log(`  ${reason}: ${count}`);
        });
    }
    
    if (results.errors.length > 0) {
        console.log('\n❌ Errors:');
        results.errors.forEach(e => {
            console.log(`  ❌ ${e.file}: ${e.error}`);
        });
    }
    
    // Save conversion log
    const logPath = path.join(ROOT_DIR, 'docs/CONVERSION_LOG.json');
    fs.writeFileSync(logPath, JSON.stringify(results, null, 2));
    
    const logMarkdown = `# Conversion Log

**Generated:** ${new Date().toISOString()}

## Summary

- **Total processed:** ${results.total}
- **Converted:** ${results.converted.length}
- **Skipped:** ${results.skipped.length}
- **Errors:** ${results.errors.length}

## Converted Files

${results.converted.map(c => `- \`${c.file}\` → \`${c.legacyPath}\` (${c.linesBefore} → ${c.linesAfter} lines)`).join('\n')}

## Skipped Files

${results.skipped.map(s => `- \`${s.file}\`: ${s.reason}`).join('\n')}

## Errors

${results.errors.map(e => `- \`${e.file}\`: ${e.error}`).join('\n')}
`;

    const logMarkdownPath = path.join(ROOT_DIR, 'docs/CONVERSION_LOG.md');
    fs.writeFileSync(logMarkdownPath, logMarkdown);
    
    console.log(`\n📄 Conversion log saved to: docs/CONVERSION_LOG.json`);
    console.log(`📄 Conversion report saved to: docs/CONVERSION_LOG.md`);
    console.log('\n✅ Conversion complete!\n');
}

main();


