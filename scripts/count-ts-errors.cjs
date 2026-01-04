#!/usr/bin/env node
/**
 * Count TypeScript Errors
 * Provides detailed breakdown of TypeScript compilation errors
 */

const { execSync } = require('child_process');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..', 'server');

function main() {
    console.log('\n📊 TypeScript Error Analysis\n');
    console.log('═'.repeat(60));
    
    try {
        const result = execSync(
            `cd ${SERVER_DIR} && npm run build 2>&1 || true`,
            { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
        );
        
        const errorLines = result.split('\n').filter(line => line.includes('error TS'));
        
        // Count by error code
        const errorsByCode = {};
        const errorsByFile = {};
        
        for (const line of errorLines) {
            // Extract error code: error TS####
            const codeMatch = line.match(/error (TS\d+)/);
            if (codeMatch) {
                const code = codeMatch[1];
                errorsByCode[code] = (errorsByCode[code] || 0) + 1;
            }
            
            // Extract file
            const fileMatch = line.match(/^([^(]+)\(/);
            if (fileMatch) {
                const file = fileMatch[1];
                errorsByFile[file] = (errorsByFile[file] || 0) + 1;
            }
        }
        
        console.log(`\nTotal errors: ${errorLines.length}\n`);
        
        console.log('Errors by code:');
        Object.entries(errorsByCode)
            .sort((a, b) => b[1] - a[1])
            .forEach(([code, count]) => {
                console.log(`  ${code}: ${count}`);
            });
        
        console.log('\nTop 10 files with most errors:');
        Object.entries(errorsByFile)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([file, count]) => {
                console.log(`  ${file}: ${count}`);
            });
        
        console.log('\n');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();

