#!/usr/bin/env node
/**
 * Replace Console with Logger
 * 
 * Automatically replaces console.log/error/warn/debug/info with Winston logger
 * Adds import statement if missing
 * Handles various console patterns
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_SRC = path.join(ROOT_DIR, 'server/src');

// Patterns to exclude
const EXCLUDE_PATTERNS = [
    /\.test\.(ts|js)$/,
    /\.spec\.(ts|js)$/,
    /test[s]?/,
    /seed/,
    /migration/,
    /\.backup\./,
    /node_modules/,
    /dist/,
    /Logger\.(ts|js)$/, // Don't modify Logger itself
];

// Console to logger mapping
const CONSOLE_MAP = {
    'console.log': 'logger.info',
    'console.error': 'logger.error',
    'console.warn': 'logger.warn',
    'console.debug': 'logger.debug',
    'console.info': 'logger.info',
};

function shouldExclude(filePath) {
    return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function findFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            findFiles(filePath, fileList);
        } else if ((file.endsWith('.ts') || file.endsWith('.js')) && !shouldExclude(filePath)) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

function calculateRelativeImportPath(fromFile, toFile) {
    const fromDir = path.dirname(fromFile);
    const toDir = path.dirname(toFile);
    
    // Calculate relative path
    let relativePath = path.relative(fromDir, toDir);
    
    // Normalize separators
    relativePath = relativePath.replace(/\\/g, '/');
    
    // Add ./ if needed
    if (!relativePath.startsWith('.')) {
        relativePath = './' + relativePath;
    }
    
    // Remove trailing slash
    if (relativePath.endsWith('/')) {
        relativePath = relativePath.slice(0, -1);
    }
    
    // Add filename without extension
    const fileName = path.basename(toFile, path.extname(toFile));
    relativePath = `${relativePath}/${fileName}`;
    
    // Normalize ././ to ./
    relativePath = relativePath.replace(/\.\/\.\//g, './');
    
    return relativePath;
}

function hasLoggerImport(content) {
    // Check for various import patterns
    const importPatterns = [
        /import\s+logger\s+from\s+['"].*Logger['"]/,
        /import\s+\{\s*logger\s*\}\s+from\s+['"].*Logger['"]/,
        /import\s+\*\s+as\s+logger\s+from\s+['"].*Logger['"]/,
        /const\s+logger\s*=\s*require\(['"].*Logger['"]\)/,
    ];
    
    return importPatterns.some(pattern => pattern.test(content));
}

function addLoggerImport(content, filePath) {
    // Find the last import statement
    const importLines = content.split('\n');
    let lastImportIndex = -1;
    
    for (let i = 0; i < importLines.length; i++) {
        if (importLines[i].trim().startsWith('import ') || importLines[i].trim().startsWith('const ') && importLines[i].includes('require')) {
            lastImportIndex = i;
        }
    }
    
    // Calculate path to Logger
    const loggerPath = path.join(SERVER_SRC, 'utils', 'Logger.ts');
    const relativePath = calculateRelativeImportPath(filePath, loggerPath);
    
    // Create import statement
    const importStatement = `import logger from '${relativePath}.js';`;
    
    // Insert after last import
    if (lastImportIndex >= 0) {
        importLines.splice(lastImportIndex + 1, 0, importStatement);
    } else {
        // No imports found, add at the top (after shebang/comments)
        let insertIndex = 0;
        while (insertIndex < importLines.length && 
               (importLines[insertIndex].trim().startsWith('#!') || 
                importLines[insertIndex].trim().startsWith('//') ||
                importLines[insertIndex].trim().startsWith('/*') ||
                importLines[insertIndex].trim() === '')) {
            insertIndex++;
        }
        importLines.splice(insertIndex, 0, importStatement);
    }
    
    return importLines.join('\n');
}

function replaceConsoleStatements(content) {
    let modified = content;
    let replacements = 0;
    
    // Replace each console type
    for (const [consoleType, loggerType] of Object.entries(CONSOLE_MAP)) {
        // Pattern: console.X(...) where X is log/error/warn/debug/info
        // We need to be careful with:
        // 1. console.log('message', variable) -> logger.info('message', { variable })
        // 2. console.error('message', error) -> logger.error('message', error, {})
        // 3. console.error(error) -> logger.error('Error', error, {})
        
        const regex = new RegExp(`(${consoleType.replace('.', '\\.')})\\s*\\(`, 'g');
        const matches = [...content.matchAll(regex)];
        
        if (matches.length > 0) {
            // For now, simple replacement - we'll handle complex cases manually
            // Replace console.X( with logger.X(
            modified = modified.replace(regex, `${loggerType}(`);
            replacements += matches.length;
        }
    }
    
    return { modified, replacements };
}

function processFile(filePath, dryRun = false) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Skip if no console statements
        if (!/console\.(log|error|warn|debug|info)\(/.test(content)) {
            return { skipped: true, reason: 'No console statements' };
        }
        
        // Check if already has logger import
        const needsImport = !hasLoggerImport(content);
        
        // Replace console statements
        const { modified, replacements } = replaceConsoleStatements(content);
        
        if (replacements === 0) {
            return { skipped: true, reason: 'No replacements made' };
        }
        
        // Add import if needed
        let finalContent = modified;
        if (needsImport) {
            finalContent = addLoggerImport(finalContent, filePath);
        }
        
        if (!dryRun) {
            fs.writeFileSync(filePath, finalContent, 'utf8');
        }
        
        return {
            processed: true,
            replacements,
            importAdded: needsImport,
            dryRun,
        };
    } catch (error) {
        return { error: error.message };
    }
}

function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const fileArg = args.find(arg => !arg.startsWith('--'));
    
    if (dryRun) {
        console.log('🔍 DRY RUN MODE - No files will be modified\n');
    }
    
    let filesToProcess = [];
    
    if (fileArg) {
        // Process single file
        const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(ROOT_DIR, fileArg);
        if (fs.existsSync(filePath)) {
            filesToProcess = [filePath];
        } else {
            console.error(`File not found: ${filePath}`);
            process.exit(1);
        }
    } else {
        // Process all files
        filesToProcess = findFiles(SERVER_SRC);
    }
    
    console.log(`Processing ${filesToProcess.length} files...\n`);
    
    const results = {
        processed: 0,
        skipped: 0,
        errors: 0,
        totalReplacements: 0,
        importsAdded: 0,
    };
    
    const processedFiles = [];
    const skippedFiles = [];
    const errorFiles = [];
    
    filesToProcess.forEach(filePath => {
        const result = processFile(filePath, dryRun);
        
        if (result.error) {
            results.errors++;
            errorFiles.push({ file: path.relative(ROOT_DIR, filePath), error: result.error });
        } else if (result.skipped) {
            results.skipped++;
            skippedFiles.push({ file: path.relative(ROOT_DIR, filePath), reason: result.reason });
        } else {
            results.processed++;
            results.totalReplacements += result.replacements;
            if (result.importAdded) {
                results.importsAdded++;
            }
            processedFiles.push({
                file: path.relative(ROOT_DIR, filePath),
                replacements: result.replacements,
                importAdded: result.importAdded,
            });
        }
    });
    
    // Print summary
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Processed: ${results.processed}`);
    console.log(`Skipped: ${results.skipped}`);
    console.log(`Errors: ${results.errors}`);
    console.log(`Total replacements: ${results.totalReplacements}`);
    console.log(`Imports added: ${results.importsAdded}`);
    console.log('');
    
    if (processedFiles.length > 0) {
        console.log('Processed files:');
        processedFiles.slice(0, 20).forEach(f => {
            const importNote = f.importAdded ? ' [+import]' : '';
            console.log(`  ✓ ${f.file} (${f.replacements} replacements${importNote})`);
        });
        if (processedFiles.length > 20) {
            console.log(`  ... and ${processedFiles.length - 20} more`);
        }
        console.log('');
    }
    
    if (errorFiles.length > 0) {
        console.log('Errors:');
        errorFiles.forEach(f => {
            console.log(`  ✗ ${f.file}: ${f.error}`);
        });
        console.log('');
    }
    
    if (dryRun) {
        console.log('💡 Run without --dry-run to apply changes');
    } else {
        console.log('✅ Changes applied!');
    }
}

if (require.main === module) {
    main();
}

module.exports = { processFile, replaceConsoleStatements, addLoggerImport };

