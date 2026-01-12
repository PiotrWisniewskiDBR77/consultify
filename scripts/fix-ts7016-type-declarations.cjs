#!/usr/bin/env node
/**
 * Fix TS7016: Missing type declarations
 * Creates basic .d.ts files for modules without types
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVER_DIR = path.join(__dirname, '..', 'server');
const TYPES_DIR = path.join(SERVER_DIR, 'src', 'types');

function main() {
    console.log('\n🔧 Fixing TS7016: Missing type declarations\n');
    console.log('═'.repeat(60));
    
    // Get TS7016 errors
    try {
        const result = execSync(
            `cd ${SERVER_DIR} && npm run build 2>&1 || true`,
            { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
        );
        
        const ts7016Errors = result.split('\n').filter(line => 
            line.includes('error TS7016') && line.includes('Could not find a declaration file')
        );
        
        console.log(`\n📋 Found ${ts7016Errors.length} TS7016 errors\n`);
        
        const modules = new Set();
        
        for (const errorLine of ts7016Errors) {
            // Extract module name
            const match = errorLine.match(/module '([^']+)'/);
            if (!match) continue;
            
            const moduleName = match[1];
            modules.add(moduleName);
        }
        
        console.log(`Found ${modules.size} unique modules needing type declarations\n`);
        
        // Ensure types directory exists
        if (!fs.existsSync(TYPES_DIR)) {
            fs.mkdirSync(TYPES_DIR, { recursive: true });
        }
        
        let created = 0;
        
        for (const moduleName of modules) {
            // Skip if already has declaration
            const safeName = moduleName.replace(/[^a-zA-Z0-9]/g, '_');
            const declFile = path.join(TYPES_DIR, `${safeName}.d.ts`);
            
            if (fs.existsSync(declFile)) {
                console.log(`  ⏭️  Skipping ${moduleName} (already has declaration)`);
                continue;
            }
            
            // Create basic declaration
            const declaration = `/**
 * Type declarations for module '${moduleName}'
 * Auto-generated - may need manual refinement
 */

declare module '${moduleName}' {
    const content: any;
    export default content;
    export = content;
}
`;
            
            fs.writeFileSync(declFile, declaration, 'utf8');
            created++;
            console.log(`  ✅ Created: ${safeName}.d.ts for '${moduleName}'`);
        }
        
        console.log('\n' + '═'.repeat(60));
        console.log(`\n📊 Summary:`);
        console.log(`  Modules found: ${modules.size}`);
        console.log(`  Declarations created: ${created}\n`);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();

