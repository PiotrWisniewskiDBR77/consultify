#!/usr/bin/env node
/**
 * Analyze Legacy JS File Usage
 * 
 * Checks which legacy JS files are still being used and how
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVICES_DIR = path.join(ROOT_DIR, 'server/services');
const SRC_SERVICES_DIR = path.join(ROOT_DIR, 'server/src/services');

const results = {
    legacyFiles: [],
    wrapperFiles: [],
    directUsage: [],
    testUsage: []
};

function findLegacyFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && file !== 'node_modules' && !file.startsWith('.')) {
            findLegacyFiles(filePath, fileList);
        } else if (file.endsWith('.js') && !file.endsWith('.map')) {
            const relativePath = path.relative(SERVICES_DIR, filePath);
            fileList.push(relativePath);
        }
    });
    
    return fileList;
}

function findWrapperFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && file !== 'node_modules' && !file.startsWith('.')) {
            findWrapperFiles(filePath, fileList);
        } else if (file.endsWith('.ts')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            // Check if it's a simple wrapper (imports from ../../services/*.js)
            if (content.includes("import") && content.includes("../../services/") && content.includes(".js")) {
                const lines = content.split('\n').length;
                if (lines < 20) {
                    const relativePath = path.relative(SRC_SERVICES_DIR, filePath);
                    fileList.push({ file: relativePath, lines });
                }
            }
        }
    });
    
    return fileList;
}

function checkDirectUsage(legacyFile) {
    const legacyPath = path.join(SERVICES_DIR, legacyFile);
    const fileName = path.basename(legacyFile, '.js');
    
    // Check if there's a wrapper in src/services
    const wrapperPath = path.join(SRC_SERVICES_DIR, `${fileName}.ts`);
    const wrapperPath2 = path.join(SRC_SERVICES_DIR, `${fileName.charAt(0).toUpperCase() + fileName.slice(1)}.ts`);
    
    const hasWrapper = fs.existsSync(wrapperPath) || fs.existsSync(wrapperPath2);
    
    return {
        legacyFile,
        hasWrapper,
        wrapperPath: hasWrapper ? (fs.existsSync(wrapperPath) ? wrapperPath : wrapperPath2) : null
    };
}

function main() {
    console.log('\n📊 ANALYZING LEGACY JS FILE USAGE\n');
    
    const legacyFiles = findLegacyFiles(SERVICES_DIR);
    console.log(`Found ${legacyFiles.length} legacy JS files\n`);
    
    const wrapperFiles = findWrapperFiles(SRC_SERVICES_DIR);
    console.log(`Found ${wrapperFiles.length} wrapper TypeScript files\n`);
    
    // Analyze usage
    const analysis = legacyFiles.map(checkDirectUsage);
    
    const withWrappers = analysis.filter(a => a.hasWrapper);
    const withoutWrappers = analysis.filter(a => !a.hasWrapper);
    
    console.log('═'.repeat(60));
    console.log('📊 ANALYSIS RESULTS\n');
    console.log(`Total legacy files: ${legacyFiles.length}`);
    console.log(`Files with TypeScript wrappers: ${withWrappers.length}`);
    console.log(`Files without wrappers: ${withoutWrappers.length}`);
    console.log('═'.repeat(60));
    
    if (withoutWrappers.length > 0) {
        console.log('\n⚠️  Files without wrappers (may still be in use):');
        withoutWrappers.slice(0, 20).forEach(f => {
            console.log(`  - ${f.legacyFile}`);
        });
        if (withoutWrappers.length > 20) {
            console.log(`  ... and ${withoutWrappers.length - 20} more`);
        }
    }
    
    // Save results
    const resultPath = path.join(ROOT_DIR, 'docs/LEGACY_USAGE_ANALYSIS.json');
    fs.writeFileSync(resultPath, JSON.stringify({
        totalLegacyFiles: legacyFiles.length,
        filesWithWrappers: withWrappers.length,
        filesWithoutWrappers: withoutWrappers.length,
        wrappers: wrapperFiles,
        analysis
    }, null, 2));
    
    console.log(`\n📄 Analysis saved to: docs/LEGACY_USAGE_ANALYSIS.json\n`);
}

main();


