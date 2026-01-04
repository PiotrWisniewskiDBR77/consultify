#!/usr/bin/env node
/**
 * Performance Comparison: tsx vs Compiled
 * Measures startup time and memory usage
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');

async function measureStartup(command, name) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const startMemory = process.memoryUsage();
        
        const proc = spawn('sh', ['-c', command], {
            cwd: ROOT_DIR,
            env: { ...process.env, NODE_ENV: 'production' },
            stdio: 'pipe'
        });
        
        let output = '';
        proc.stdout.on('data', (data) => {
            output += data.toString();
            if (output.includes('Server running') || output.includes('listening')) {
                const endTime = Date.now();
                const endMemory = process.memoryUsage();
                
                proc.kill();
                
                resolve({
                    name,
                    startupTime: endTime - startTime,
                    memoryUsed: endMemory.heapUsed - startMemory.heapUsed,
                    output: output.substring(0, 500)
                });
            }
        });
        
        proc.stderr.on('data', (data) => {
            output += data.toString();
        });
        
        // Timeout after 60 seconds
        setTimeout(() => {
            proc.kill();
            resolve({
                name,
                startupTime: 60000,
                memoryUsed: 0,
                error: 'Timeout',
                output: output.substring(0, 500)
            });
        }, 60000);
    });
}

async function run() {
    console.log('\n📊 PERFORMANCE COMPARISON: tsx vs Compiled\n');
    console.log('═'.repeat(60));
    
    // Test 1: tsx runtime
    console.log('\n🔵 Testing tsx runtime...');
    const tsxResult = await measureStartup(
        'cd server && NODE_ENV=production npx tsx src/index.ts',
        'tsx'
    );
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Compiled version
    console.log('🟢 Testing compiled version...');
    const compiledResult = await measureStartup(
        'cd server && npm run build && NODE_ENV=production node dist/index.js',
        'compiled'
    );
    
    // Results
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESULTS\n');
    
    console.log('tsx Runtime:');
    console.log(`  Startup Time: ${tsxResult.startupTime}ms`);
    console.log(`  Memory Used: ${(tsxResult.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
    if (tsxResult.error) console.log(`  ⚠️  ${tsxResult.error}`);
    
    console.log('\nCompiled Version:');
    console.log(`  Startup Time: ${compiledResult.startupTime}ms`);
    console.log(`  Memory Used: ${(compiledResult.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
    if (compiledResult.error) console.log(`  ⚠️  ${compiledResult.error}`);
    
    const timeDiff = ((compiledResult.startupTime - tsxResult.startupTime) / tsxResult.startupTime * 100).toFixed(1);
    const memoryDiff = ((compiledResult.memoryUsed - tsxResult.memoryUsed) / tsxResult.memoryUsed * 100).toFixed(1);
    
    console.log('\n📈 Comparison:');
    console.log(`  Startup: ${timeDiff > 0 ? '+' : ''}${timeDiff}% (${compiledResult.startupTime > tsxResult.startupTime ? 'slower' : 'faster'})`);
    console.log(`  Memory: ${memoryDiff > 0 ? '+' : ''}${memoryDiff}% (${compiledResult.memoryUsed > tsxResult.memoryUsed ? 'more' : 'less'})`);
    
    // Save results
    const results = {
        timestamp: new Date().toISOString(),
        tsx: tsxResult,
        compiled: compiledResult,
        comparison: {
            startupTimeDiff: timeDiff,
            memoryDiff: memoryDiff
        }
    };
    
    fs.writeFileSync(
        path.join(ROOT_DIR, 'docs/PERFORMANCE_COMPARISON.json'),
        JSON.stringify(results, null, 2)
    );
    
    console.log('\n✅ Results saved to docs/PERFORMANCE_COMPARISON.json\n');
}

run().catch(console.error);


