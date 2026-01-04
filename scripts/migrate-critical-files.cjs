#!/usr/bin/env node
/**
 * Migrate Critical Files
 * 
 * Runs replace-console-with-logger on all critical files
 */

const { main: analyzeMain } = require('./analyze-console-usage.cjs');
const { processFile } = require('./replace-console-with-logger.cjs');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const ANALYSIS_FILE = path.join(ROOT_DIR, 'docs/CONSOLE_USAGE_ANALYSIS.json');

async function main() {
    console.log('🚀 Migrating critical files...\n');
    
    // Load analysis
    const analysis = JSON.parse(fs.readFileSync(ANALYSIS_FILE, 'utf8'));
    const criticalFiles = analysis.critical;
    
    console.log(`Found ${criticalFiles.length} critical files to migrate\n`);
    
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const fileInfo of criticalFiles) {
        const filePath = fileInfo.path;
        const relativePath = fileInfo.file;
        
        console.log(`Processing: ${relativePath}...`);
        
        const result = processFile(filePath, false);
        
        if (result.error) {
            console.error(`  ✗ Error: ${result.error}`);
            errors++;
        } else if (result.skipped) {
            console.log(`  ⊘ Skipped: ${result.reason}`);
            skipped++;
        } else {
            console.log(`  ✓ Processed: ${result.replacements} replacements${result.importAdded ? ' [+import]' : ''}`);
            processed++;
        }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Processed: ${processed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log('');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };

