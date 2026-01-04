#!/usr/bin/env node
/**
 * Fix Promise.all destructuring errors
 * Replaces ...otherModules with proper variable names
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVICES_DIR = path.join(ROOT_DIR, 'server/services');

const filesToFix = [
    'aiMemoryManager.js',
    'assessmentService.js',
    'assessmentWorkflowService.js',
    'billingService.js',
    'evidenceLedgerService.js',
    'invoiceTemplateService.js',
    'legalEventLogger.js',
    'legalService.js',
    'multiFrameworkAssessmentService.js',
    'payAsYouGoService.js',
    'subscriptionAnalyticsService.js',
    'usageService.js'
];

function fixFile(fileName) {
    const filePath = path.join(SERVICES_DIR, fileName);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${fileName}`);
        return false;
    }
    
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // Fix pattern: const [dbModule, ...otherModules] = await Promise.all([...])
    // Replace with: const [dbModule, uuidModule] = await Promise.all([...])
    content = content.replace(
        /const\s+\[dbModule,\s*\.\.\.otherModules\]\s*=\s*await\s+Promise\.all\(\[/g,
        'const [dbModule, uuidModule] = await Promise.all(['
    );
    
    // Fix indentation issues
    content = content.replace(
        /\n\s{8}const\s+\{\s*getDatabase\s*\}\s*=\s*dbModule;?\s*\n\s{8}deps\.db\s*=\s*getDatabase\(\);?/g,
        '\n    const { getDatabase } = dbModule;\n    deps.db = getDatabase();'
    );
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed: ${fileName}`);
        return true;
    }
    
    return false;
}

function main() {
    console.log('\n🔧 FIXING PROMISE.ALL DESTRUCTURING ERRORS\n');
    
    let fixed = 0;
    for (const file of filesToFix) {
        if (fixFile(file)) {
            fixed++;
        }
    }
    
    console.log(`\n✅ Fixed ${fixed} files\n`);
}

main();



