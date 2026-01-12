#!/usr/bin/env node
/**
 * Backup and Remove Legacy JS Files
 * 
 * This script:
 * 1. Creates a timestamped backup of legacy JS files
 * 2. Verifies that compiled TypeScript version works
 * 3. Safely removes legacy JS files from routes/ and services/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');
const BACKUP_DIR = path.join(ROOT_DIR, 'backup-legacy-js');

// Directories to clean
const LEGACY_DIRS = [
    path.join(SERVER_DIR, 'routes'),
    path.join(SERVER_DIR, 'services')
];

// Files to keep (config files, etc.)
const KEEP_PATTERNS = [
    /\.d\.ts\.map$/,
    /\.config\.js$/,
    /\.cjs$/,
    /__mocks__/,
    /webhooks\//  // Keep webhooks subdirectory structure
];

function shouldKeepFile(filePath) {
    return KEEP_PATTERNS.some(pattern => pattern.test(filePath));
}

function getAllJsFiles(dir) {
    const files = [];
    
    function walk(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            const relativePath = path.relative(SERVER_DIR, fullPath);
            
            if (entry.isDirectory()) {
                // Skip node_modules, dist, src
                if (!['node_modules', 'dist', 'src'].includes(entry.name)) {
                    walk(fullPath);
                }
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                if (!shouldKeepFile(relativePath)) {
                    files.push({
                        fullPath,
                        relativePath
                    });
                }
            }
        }
    }
    
    walk(dir);
    return files;
}

function createBackup(files) {
    console.log('\n📦 Creating backup...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `legacy-js-${timestamp}`);
    
    fs.mkdirSync(backupPath, { recursive: true });
    
    let backedUp = 0;
    for (const file of files) {
        const backupFilePath = path.join(backupPath, file.relativePath);
        const backupFileDir = path.dirname(backupFilePath);
        
        fs.mkdirSync(backupFileDir, { recursive: true });
        fs.copyFileSync(file.fullPath, backupFilePath);
        backedUp++;
    }
    
    console.log(`✅ Backed up ${backedUp} files to ${backupPath}`);
    
    // Create manifest
    const manifest = {
        timestamp: new Date().toISOString(),
        totalFiles: backedUp,
        files: files.map(f => f.relativePath)
    };
    
    fs.writeFileSync(
        path.join(backupPath, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
    );
    
    return backupPath;
}

function verifyCompiledVersion() {
    console.log('\n🔍 Verifying compiled version...');
    
    try {
        // Build first
        console.log('  Building TypeScript...');
        execSync('cd server && npm run build', {
            stdio: 'inherit',
            cwd: ROOT_DIR
        });
        
        // Check if dist/index.js exists
        const distIndex = path.join(SERVER_DIR, 'dist', 'index.js');
        if (!fs.existsSync(distIndex)) {
            throw new Error('dist/index.js does not exist after build');
        }
        
        console.log('✅ Build successful');
        return true;
    } catch (error) {
        console.error('❌ Build verification failed:', error.message);
        return false;
    }
}

function removeLegacyFiles(files) {
    console.log('\n🗑️  Removing legacy files...');
    
    let removed = 0;
    let errors = 0;
    
    for (const file of files) {
        try {
            fs.unlinkSync(file.fullPath);
            removed++;
        } catch (error) {
            console.error(`  ⚠️  Failed to remove ${file.relativePath}: ${error.message}`);
            errors++;
        }
    }
    
    console.log(`✅ Removed ${removed} files`);
    if (errors > 0) {
        console.log(`⚠️  ${errors} files could not be removed`);
    }
    
    return { removed, errors };
}

function removeEmptyDirectories(dir) {
    let removed = 0;
    
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        // First, recursively remove empty subdirectories
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subDir = path.join(dir, entry.name);
                removed += removeEmptyDirectories(subDir);
            }
        }
        
        // Check if directory is now empty (only .d.ts.map files allowed)
        const remaining = fs.readdirSync(dir);
        const hasOnlyArtifacts = remaining.every(f => f.endsWith('.d.ts.map'));
        
        if (remaining.length === 0 || hasOnlyArtifacts) {
            // Don't remove routes/ or services/ themselves, just subdirs
            const dirName = path.basename(dir);
            if (dirName !== 'routes' && dirName !== 'services') {
                fs.rmdirSync(dir);
                removed++;
            }
        }
    } catch (error) {
        // Ignore errors
    }
    
    return removed;
}

async function main() {
    console.log('\n🧹 LEGACY JS FILES CLEANUP\n');
    console.log('═'.repeat(60));
    
    // Step 1: Collect all legacy JS files
    console.log('\n📋 Collecting legacy JS files...');
    const allFiles = [];
    
    for (const dir of LEGACY_DIRS) {
        if (fs.existsSync(dir)) {
            const files = getAllJsFiles(dir);
            allFiles.push(...files);
            console.log(`  Found ${files.length} files in ${path.basename(dir)}/`);
        }
    }
    
    console.log(`\n📊 Total: ${allFiles.length} legacy JS files found`);
    
    if (allFiles.length === 0) {
        console.log('\n✅ No legacy files to remove!\n');
        return;
    }
    
    // Step 2: Verify compiled version works
    if (!verifyCompiledVersion()) {
        console.error('\n❌ Cannot proceed: Compiled version verification failed');
        console.error('   Please fix build issues before removing legacy files.\n');
        process.exit(1);
    }
    
    // Step 3: Create backup
    const backupPath = createBackup(allFiles);
    
    // Step 4: Remove files
    const { removed, errors } = removeLegacyFiles(allFiles);
    
    // Step 5: Clean up empty directories
    console.log('\n🧹 Cleaning up empty directories...');
    let dirsRemoved = 0;
    for (const dir of LEGACY_DIRS) {
        dirsRemoved += removeEmptyDirectories(dir);
    }
    console.log(`✅ Removed ${dirsRemoved} empty directories`);
    
    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 SUMMARY\n');
    console.log(`Files found:     ${allFiles.length}`);
    console.log(`Files backed up: ${allFiles.length}`);
    console.log(`Files removed:   ${removed}`);
    console.log(`Errors:          ${errors}`);
    console.log(`Empty dirs:      ${dirsRemoved}`);
    console.log(`\nBackup location: ${backupPath}`);
    console.log('\n✅ Cleanup complete!\n');
}

main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});

