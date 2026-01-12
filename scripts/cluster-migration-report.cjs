#!/usr/bin/env node
/**
 * Cluster Migration Report
 *
 * Builds a dependency cluster starting from one or more JS services and
 * reports migration status for matching TS services.
 *
 * Usage:
 *   node scripts/cluster-migration-report.cjs server/services/ai/ingestionPipeline.js
 *   node scripts/cluster-migration-report.cjs server/services/ai/organizationMemoryStore.js server/services/ai/knowledgeIndexer.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SERVICES_DIR = path.join(ROOT, 'server', 'services');
const TS_SERVICES_DIR = path.join(ROOT, 'server', 'src', 'services');

function readFileSafe(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch {
        return null;
    }
}

function isWithinServicesDir(filePath) {
    return filePath.startsWith(SERVICES_DIR + path.sep);
}

function normalizePath(filePath) {
    return path.normalize(filePath);
}

function resolveServicePath(fromFile, specifier) {
    if (!specifier.startsWith('.')) {
        return null;
    }

    const basePath = path.resolve(path.dirname(fromFile), specifier);
    const candidates = [];

    if (path.extname(basePath)) {
        candidates.push(basePath);
    } else {
        candidates.push(`${basePath}.js`);
        candidates.push(path.join(basePath, 'index.js'));
    }

    for (const candidate of candidates) {
        if (fs.existsSync(candidate) && isWithinServicesDir(candidate)) {
            return normalizePath(candidate);
        }
    }

    return null;
}

function parseDependencies(content) {
    const deps = new Set();
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    const importRegex = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
    const dynamicImportRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

    let match;
    while ((match = requireRegex.exec(content)) !== null) {
        deps.add(match[1]);
    }
    while ((match = importRegex.exec(content)) !== null) {
        deps.add(match[1]);
    }
    while ((match = dynamicImportRegex.exec(content)) !== null) {
        deps.add(match[1]);
    }

    return Array.from(deps);
}

function getTsPath(jsFilePath) {
    const rel = path.relative(SERVICES_DIR, jsFilePath);
    const tsPath = path.join(TS_SERVICES_DIR, rel).replace(/\.js$/, '.ts');
    return tsPath;
}

function getMigrationStatus(tsPath) {
    if (!fs.existsSync(tsPath)) {
        return 'missing-ts';
    }
    const content = readFileSafe(tsPath);
    if (!content) {
        return 'missing-ts';
    }
    if (content.includes('createCachedLazyService')) {
        return 'wrapper';
    }
    return 'migrated';
}

function buildCluster(entryFiles) {
    const queue = entryFiles.map(file => normalizePath(path.resolve(ROOT, file)));
    const seen = new Set();
    const cluster = [];

    while (queue.length) {
        const current = queue.shift();
        if (!current || seen.has(current)) {
            continue;
        }
        seen.add(current);

        if (!fs.existsSync(current)) {
            continue;
        }

        if (!isWithinServicesDir(current)) {
            continue;
        }

        const content = readFileSafe(current);
        if (!content) {
            continue;
        }

        cluster.push(current);

        const deps = parseDependencies(content);
        for (const specifier of deps) {
            const resolved = resolveServicePath(current, specifier);
            if (resolved && !seen.has(resolved)) {
                queue.push(resolved);
            }
        }
    }

    return cluster;
}

function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Provide at least one JS service path.');
        process.exit(1);
    }

    const cluster = buildCluster(args);
    const rows = cluster.map(jsPath => {
        const relJs = path.relative(ROOT, jsPath);
        const tsPath = getTsPath(jsPath);
        const relTs = path.relative(ROOT, tsPath);
        const status = getMigrationStatus(tsPath);
        return { relJs, relTs, status };
    });

    const summary = rows.reduce(
        (acc, row) => {
            acc[row.status] = (acc[row.status] || 0) + 1;
            return acc;
        },
        {}
    );

    rows.sort((a, b) => a.status.localeCompare(b.status) || a.relJs.localeCompare(b.relJs));

    console.log('Cluster migration report:\n');
    rows.forEach(row => {
        console.log(`${row.status.padEnd(10)}  ${row.relJs}  ->  ${row.relTs}`);
    });

    console.log('\nSummary:');
    Object.keys(summary)
        .sort()
        .forEach(key => {
            console.log(`  ${key}: ${summary[key]}`);
        });
}

main();
