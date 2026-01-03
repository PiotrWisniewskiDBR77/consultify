#!/usr/bin/env node
/**
 * Script to categorize wrapper services by priority
 * Analyzes usage frequency and complexity to create migration priority matrix
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const servicesDir = path.join(__dirname, '..', 'server', 'src', 'services');
const jsServicesDir = path.join(__dirname, '..', 'server', 'services');
const srcDir = path.join(__dirname, '..', 'server', 'src');

function getAllWrapperServices() {
    return fs.readdirSync(servicesDir)
        .filter(f => f.endsWith('.ts'))
        .map(f => ({
            filename: f,
            filepath: path.join(servicesDir, f),
            basename: f.replace('.ts', ''),
            jsPath: path.join(jsServicesDir, f.replace('.ts', '.js'))
        }))
        .filter(s => {
            const content = fs.readFileSync(s.filepath, 'utf-8');
            return /createRequire|require\(.*\.js\)/.test(content) && 
                   !/export class\s+\w+|export const \w+\s*=\s*new|^const \w+\s*=\s*new/.test(content);
        });
}

function countUsage(serviceName) {
    const patterns = [
        `from.*['"]${serviceName.basename}`,
        `from.*['"]${serviceName.basename.replace(/Service$/, '')}`,
        `import.*${serviceName.basename}`,
        `require.*${serviceName.basename}`
    ];
    
    let count = 0;
    for (const pattern of patterns) {
        try {
            const result = execSync(
                `grep -r "${pattern}" "${srcDir}" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' '`,
                { encoding: 'utf-8', stdio: 'pipe' }
            );
            count += parseInt(result.trim() || '0', 10);
        } catch (e) {
            // Ignore
        }
    }
    
    return count;
}

function estimateComplexity(jsPath) {
    if (!fs.existsSync(jsPath)) {
        return 'UNKNOWN';
    }
    
    const content = fs.readFileSync(jsPath, 'utf-8');
    const lines = content.split('\n').length;
    const hasCallbacks = /callback|cb\)|function.*\(.*callback/.test(content);
    const hasAsync = /async|await|Promise/.test(content);
    const hasClasses = /class\s+\w+/.test(content);
    
    if (lines < 200) {
        return 'SIMPLE';
    } else if (lines < 500) {
        return 'MEDIUM';
    } else {
        return 'COMPLEX';
    }
}

function categorizeByUsage(count) {
    if (count >= 10) {
        return 'CRITICAL';
    } else if (count >= 5) {
        return 'HIGH';
    } else if (count >= 2) {
        return 'MEDIUM';
    } else if (count === 1) {
        return 'LOW';
    } else {
        return 'UNUSED';
    }
}

function getPriority(usageCategory, complexity) {
    if (usageCategory === 'CRITICAL' && complexity === 'SIMPLE') return 'P0';
    if (usageCategory === 'CRITICAL' && complexity === 'MEDIUM') return 'P1';
    if (usageCategory === 'CRITICAL' && complexity === 'COMPLEX') return 'P1';
    if (usageCategory === 'HIGH' && complexity === 'SIMPLE') return 'P2';
    if (usageCategory === 'HIGH' && complexity === 'MEDIUM') return 'P3';
    if (usageCategory === 'HIGH' && complexity === 'COMPLEX') return 'P3';
    if (usageCategory === 'MEDIUM' && complexity === 'SIMPLE') return 'P4';
    if (usageCategory === 'MEDIUM' && complexity === 'MEDIUM') return 'P5';
    if (usageCategory === 'MEDIUM' && complexity === 'COMPLEX') return 'P5';
    if (usageCategory === 'LOW') return 'P6';
    if (usageCategory === 'UNUSED') return 'P7';
    return 'P6';
}

function analyzeServices() {
    const services = getAllWrapperServices();
    const categorized = [];
    
    console.log(`Analyzing ${services.length} wrapper services...\n`);
    
    for (const service of services) {
        const usageCount = countUsage(service);
        const usageCategory = categorizeByUsage(usageCount);
        const complexity = estimateComplexity(service.jsPath);
        const priority = getPriority(usageCategory, complexity);
        
        categorized.push({
            filename: service.filename,
            basename: service.basename,
            usageCount,
            usageCategory,
            complexity,
            priority,
            jsExists: fs.existsSync(service.jsPath),
            jsLines: fs.existsSync(service.jsPath) 
                ? fs.readFileSync(service.jsPath, 'utf-8').split('\n').length 
                : 0
        });
    }
    
    // Sort by priority
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4, P5: 5, P6: 6, P7: 7 };
    categorized.sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.usageCount - a.usageCount;
    });
    
    return categorized;
}

// Main execution
const results = analyzeServices();

// Group by priority
const byPriority = {};
results.forEach(s => {
    if (!byPriority[s.priority]) {
        byPriority[s.priority] = [];
    }
    byPriority[s.priority].push(s);
});

console.log('=== Categorization Results ===\n');

Object.keys(byPriority).sort().forEach(priority => {
    const services = byPriority[priority];
    console.log(`${priority}: ${services.length} services`);
    services.slice(0, 5).forEach(s => {
        console.log(`  - ${s.filename} (${s.usageCategory}, ${s.complexity}, ${s.usageCount} uses)`);
    });
    if (services.length > 5) {
        console.log(`  ... and ${services.length - 5} more`);
    }
    console.log('');
});

// Summary statistics
const summary = {
    byPriority: {},
    byUsageCategory: {},
    byComplexity: {}
};

results.forEach(s => {
    summary.byPriority[s.priority] = (summary.byPriority[s.priority] || 0) + 1;
    summary.byUsageCategory[s.usageCategory] = (summary.byUsageCategory[s.usageCategory] || 0) + 1;
    summary.byComplexity[s.complexity] = (summary.byComplexity[s.complexity] || 0) + 1;
});

console.log('=== Summary Statistics ===\n');
console.log('By Priority:');
Object.keys(summary.byPriority).sort().forEach(p => {
    console.log(`  ${p}: ${summary.byPriority[p]}`);
});
console.log('\nBy Usage Category:');
Object.keys(summary.byUsageCategory).sort().forEach(c => {
    console.log(`  ${c}: ${summary.byUsageCategory[c]}`);
});
console.log('\nBy Complexity:');
Object.keys(summary.byComplexity).sort().forEach(c => {
    console.log(`  ${c}: ${summary.byComplexity[c]}`);
});

// Save results
const output = {
    summary,
    services: results,
    batches: {}
};

// Create batches (10-15 services per batch)
let batchNum = 1;
let currentBatch = [];
results.forEach((service, index) => {
    if (service.priority === 'P7') return; // Skip unused
    
    currentBatch.push(service.filename);
    
    if (currentBatch.length >= 12 || index === results.length - 1) {
        output.batches[`Batch${batchNum}`] = {
            priority: service.priority,
            services: [...currentBatch],
            count: currentBatch.length
        };
        currentBatch = [];
        batchNum++;
    }
});

fs.writeFileSync(
    path.join(__dirname, '..', 'wrapper-categorization.json'),
    JSON.stringify(output, null, 2)
);

console.log(`\nResults saved to wrapper-categorization.json`);
console.log(`Created ${Object.keys(output.batches).length} batches for migration`);

