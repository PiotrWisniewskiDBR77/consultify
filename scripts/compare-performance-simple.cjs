#!/usr/bin/env node
/**
 * Simple Performance Comparison
 * Measures startup time (assuming build already exists)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

async function measureStartup(command, name) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const proc = spawn('sh', ['-c', command], {
            cwd: ROOT_DIR,
            env: { ...process.env, NODE_ENV: 'production' },
            stdio: 'pipe'
        });
        
        let output = '';
        let errorOutput = '';
        
        proc.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        proc.stderr.on('data', (data) => {
            errorOutput += data.toString();
            output += data.toString();
        });
        
        // Check for server ready signal
        const checkReady = setInterval(() => {
            if (output.includes('Server running') || output.includes('listening') || output.includes('port 3001')) {
                clearInterval(checkReady);
                const endTime = Date.now();
                proc.kill();
                
                resolve({
                    name,
                    startupTime: endTime - startTime,
                    success: true
                });
            }
        }, 100);
        
        // Timeout after 45 seconds
        setTimeout(() => {
            clearInterval(checkReady);
            proc.kill();
            resolve({
                name,
                startupTime: 45000,
                success: false,
                error: 'Timeout or server not ready'
            });
        }, 45000);
    });
}

async function run() {
    console.log('\n📊 PERFORMANCE COMPARISON: tsx vs Compiled\n');
    console.log('═'.repeat(60));
    
    // Ensure build exists
    console.log('\n🔨 Ensuring build exists...');
    const buildProc = spawn('npm', ['run', 'build:backend'], {
        cwd: ROOT_DIR,
        stdio: 'pipe'
    });
    await new Promise((resolve) => {
        buildProc.on('close', resolve);
    });
    
    // Test 1: tsx runtime
    console.log('\n🔵 Testing tsx runtime...');
    const tsxResult = await measureStartup(
        'cd server && NODE_ENV=production npx tsx src/index.ts',
        'tsx'
    );
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 2: Compiled version
    console.log('🟢 Testing compiled version...');
    const compiledResult = await measureStartup(
        'cd server && NODE_ENV=production node dist/index.js',
        'compiled'
    );
    
    // Results
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESULTS\n');
    
    console.log('tsx Runtime:');
    console.log(`  Startup Time: ${tsxResult.startupTime}ms`);
    console.log(`  Status: ${tsxResult.success ? '✅ Success' : '❌ Failed'}`);
    
    console.log('\nCompiled Version:');
    console.log(`  Startup Time: ${compiledResult.startupTime}ms`);
    console.log(`  Status: ${compiledResult.success ? '✅ Success' : '❌ Failed'}`);
    
    if (tsxResult.success && compiledResult.success) {
        const timeDiff = ((compiledResult.startupTime - tsxResult.startupTime) / tsxResult.startupTime * 100).toFixed(1);
        const speedup = (tsxResult.startupTime / compiledResult.startupTime).toFixed(2);
        
        console.log('\n📈 Comparison:');
        console.log(`  Compiled is ${timeDiff > 0 ? '+' : ''}${timeDiff}% ${compiledResult.startupTime > tsxResult.startupTime ? 'slower' : 'faster'}`);
        console.log(`  Speedup factor: ${speedup}x`);
    }
    
    // Save results
    const results = {
        timestamp: new Date().toISOString(),
        tsx: tsxResult,
        compiled: compiledResult,
        note: 'Startup time comparison (time to "Server running" message)'
    };
    
    fs.writeFileSync(
        path.join(ROOT_DIR, 'docs/PERFORMANCE_COMPARISON.json'),
        JSON.stringify(results, null, 2)
    );
    
    console.log('\n✅ Results saved to docs/PERFORMANCE_COMPARISON.json\n');
}

run().catch(console.error);


