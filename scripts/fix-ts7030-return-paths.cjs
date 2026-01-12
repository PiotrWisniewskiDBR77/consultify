#!/usr/bin/env node
/**
 * Fix TS7030: Not all code paths return a value
 * Adds return statements in missing code paths
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVER_DIR = path.join(__dirname, '..', 'server');
const SRC_DIR = path.join(SERVER_DIR, 'src');

function getAllTypeScriptFiles(dir) {
    const files = [];
    function walk(currentDir) {
        try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    if (!['node_modules', 'dist', '.git'].includes(entry.name)) {
                        walk(fullPath);
                    }
                } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Ignore
        }
    }
    walk(dir);
    return files;
}

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;
    
    try {
        const result = execSync(
            `cd ${SERVER_DIR} && npx tsc --noEmit ${filePath} 2>&1 || true`,
            { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );
        
        const ts7030Errors = result.split('\n').filter(line => 
            line.includes('error TS7030') && line.includes('Not all code paths return a value')
        );
        
        if (ts7030Errors.length === 0) {
            return false;
        }
        
        const lines = content.split('\n');
        
        for (const errorLine of ts7030Errors) {
            const match = errorLine.match(/\((\d+),(\d+)\):/);
            if (!match) continue;
            
            const lineNum = parseInt(match[1]);
            if (lineNum > lines.length) continue;
            
            const lineIndex = lineNum - 1;
            const line = lines[lineIndex];
            
            // Find the function this error is in
            // Look backwards for function declaration
            let funcStart = -1;
            let funcIsAsync = false;
            let funcReturnType = null;
            
            for (let i = lineIndex; i >= 0 && i >= lineIndex - 50; i--) {
                const prevLine = lines[i];
                
                // Check for async function
                if (prevLine.match(/async\s+(function|\(|\w+)\s*[=:]/)) {
                    funcIsAsync = true;
                }
                
                // Check for function declaration
                const funcMatch = prevLine.match(/(async\s+)?(function\s+\w+|const\s+\w+\s*[:=]\s*(async\s+)?\(|export\s+(async\s+)?function)/);
                if (funcMatch) {
                    funcStart = i;
                    
                    // Check for return type annotation
                    const returnTypeMatch = prevLine.match(/:\s*([^=]+?)(\s*[=,{])/);
                    if (returnTypeMatch) {
                        funcReturnType = returnTypeMatch[1].trim();
                    }
                    break;
                }
            }
            
            if (funcStart === -1) continue;
            
            // Find the end of the function (look for closing brace at same indentation)
            let funcEnd = -1;
            const startIndent = lines[funcStart].match(/^(\s*)/)[1].length;
            
            for (let i = funcStart + 1; i < lines.length && i < funcStart + 200; i++) {
                const currentLine = lines[i];
                const currentIndent = currentLine.match(/^(\s*)/)[1].length;
                
                // Check if we've closed the function
                if (currentIndent <= startIndent && currentLine.trim().startsWith('}')) {
                    funcEnd = i;
                    break;
                }
            }
            
            if (funcEnd === -1) continue;
            
            // Check if function already has return at the end
            let hasReturn = false;
            for (let i = funcEnd - 1; i >= funcStart; i--) {
                if (lines[i].trim().startsWith('return')) {
                    hasReturn = true;
                    break;
                }
                if (lines[i].trim().startsWith('}') && i < funcEnd - 1) {
                    break; // Hit nested block
                }
            }
            
            // Check if function has try-catch without return in catch
            const funcContent = lines.slice(funcStart, funcEnd + 1).join('\n');
            const hasTryCatch = funcContent.includes('try') && funcContent.includes('catch');
            
            if (hasTryCatch && !hasReturn) {
                // Find catch block and add return
                for (let i = funcStart; i < funcEnd; i++) {
                    if (lines[i].trim().startsWith('} catch')) {
                        // Find end of catch block
                        let catchEnd = i + 1;
                        let braceCount = 1;
                        for (let j = i + 1; j < funcEnd; j++) {
                            if (lines[j].includes('{')) braceCount++;
                            if (lines[j].includes('}')) braceCount--;
                            if (braceCount === 0) {
                                catchEnd = j;
                                break;
                            }
                        }
                        
                        // Check if catch has return
                        let catchHasReturn = false;
                        for (let j = i; j < catchEnd; j++) {
                            if (lines[j].trim().startsWith('return')) {
                                catchHasReturn = true;
                                break;
                            }
                        }
                        
                        if (!catchHasReturn) {
                            // Add return before closing brace of catch
                            const catchIndent = lines[catchEnd].match(/^(\s*)/)[1];
                            const returnValue = funcIsAsync 
                                ? (funcReturnType === 'void' || funcReturnType === 'Promise<void>' ? 'return;' : 'return undefined;')
                                : (funcReturnType === 'void' ? 'return;' : 'return undefined;');
                            
                            lines.splice(catchEnd, 0, catchIndent + returnValue);
                            modified = true;
                        }
                        break;
                    }
                }
            }
            
            // If no return at all, add one at the end
            if (!hasReturn && !hasTryCatch) {
                const endIndent = lines[funcEnd].match(/^(\s*)/)[1];
                const returnValue = funcIsAsync 
                    ? (funcReturnType === 'void' || funcReturnType === 'Promise<void>' ? 'return;' : 'return undefined;')
                    : (funcReturnType === 'void' ? 'return;' : 'return undefined;');
                
                lines.splice(funcEnd, 0, endIndent + returnValue);
                modified = true;
            }
        }
        
        if (modified) {
            content = lines.join('\n');
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        }
        
    } catch (error) {
        return false;
    }
    
    return false;
}

function main() {
    console.log('\n🔧 Fixing TS7030: Not all code paths return a value\n');
    console.log('═'.repeat(60));
    
    const files = getAllTypeScriptFiles(SRC_DIR);
    console.log(`\n📋 Found ${files.length} TypeScript files\n`);
    
    let fixed = 0;
    let processed = 0;
    
    for (const file of files) {
        processed++;
        if (processed % 50 === 0) {
            console.log(`  Processed ${processed}/${files.length} files...`);
        }
        
        try {
            if (fixFile(file)) {
                fixed++;
                const relativePath = path.relative(SERVER_DIR, file);
                console.log(`  ✅ Fixed: ${relativePath}`);
            }
        } catch (error) {
            // Ignore errors
        }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`  Files processed: ${files.length}`);
    console.log(`  Files fixed: ${fixed}\n`);
}

main();

