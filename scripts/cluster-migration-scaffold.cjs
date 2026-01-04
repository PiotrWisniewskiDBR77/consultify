#!/usr/bin/env node
/**
 * Cluster Migration Scaffold
 *
 * Builds a dependency cluster and generates drafts for wrapper/missing TS services.
 *
 * Usage:
 *   node scripts/cluster-migration-scaffold.cjs --name ai-knowledge --entries server/services/ai/ingestionPipeline.js server/services/ai/knowledgeIndexer.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SERVICES_DIR = path.join(ROOT, 'server', 'services');
const TS_SERVICES_DIR = path.join(ROOT, 'server', 'src', 'services');
const DRAFTS_DIR = path.join(ROOT, 'scripts', 'migration-drafts');

function readFileSafe(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch {
        return null;
    }
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
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

function writeDraft(clusterName, jsPath, tsPath, status) {
    const relJs = path.relative(ROOT, jsPath);
    const relTs = path.relative(ROOT, tsPath);
    const draftPath = path.join(
        DRAFTS_DIR,
        clusterName,
        relTs
    );
    ensureDir(path.dirname(draftPath));

    const jsContent = readFileSafe(jsPath) || '';
    const header = [
        '/**',
        ' * MIGRATION DRAFT (auto-generated)',
        ` * Source: ${relJs}`,
        ` * Target: ${relTs}`,
        ` * Status: ${status}`,
        ' *',
        ' * TODO:',
        ' * - Convert require/imports to ES module imports.',
        ' * - Replace db callbacks with DbPromise/getDatabase().',
        ' * - Add types and runtime validation where needed.',
        ' */',
        ''
    ].join('\n');

    fs.writeFileSync(draftPath, `${header}\n${jsContent}`, 'utf-8');
    return draftPath;
}

function parseArgs(argv) {
    const args = { name: 'cluster', entries: [] };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--name') {
            args.name = argv[i + 1] || args.name;
            i++;
        } else if (arg === '--entries') {
            args.entries = argv.slice(i + 1);
            break;
        }
    }
    return args;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.entries.length) {
        console.error('Provide --entries with at least one JS service path.');
        process.exit(1);
    }

    const cluster = buildCluster(args.entries);
    const rows = cluster.map(jsPath => {
        const tsPath = getTsPath(jsPath);
        const status = getMigrationStatus(tsPath);
        return { jsPath, tsPath, status };
    });

    const summary = rows.reduce(
        (acc, row) => {
            acc[row.status] = (acc[row.status] || 0) + 1;
            return acc;
        },
        {}
    );

    const drafts = [];
    for (const row of rows) {
        if (row.status === 'wrapper' || row.status === 'missing-ts') {
            const draftPath = writeDraft(args.name, row.jsPath, row.tsPath, row.status);
            drafts.push(path.relative(ROOT, draftPath));
        }
    }

    const reportDir = path.join(DRAFTS_DIR, args.name);
    ensureDir(reportDir);
    fs.writeFileSync(
        path.join(reportDir, 'cluster-report.json'),
        JSON.stringify(
            {
                entries: args.entries,
                summary,
                rows: rows.map(row => ({
                    js: path.relative(ROOT, row.jsPath),
                    ts: path.relative(ROOT, row.tsPath),
                    status: row.status
                })),
                drafts
            },
            null,
            2
        ),
        'utf-8'
    );

    const readmeLines = [
        '# Migration Drafts',
        '',
        `Cluster: ${args.name}`,
        '',
        'This folder contains draft TS files copied from JS sources for faster manual migration.',
        '',
        'Summary:',
        ...Object.keys(summary)
            .sort()
            .map(key => `- ${key}: ${summary[key]}`),
        '',
        'Draft files:',
        ...drafts.map(draft => `- ${draft}`)
    ];

    fs.writeFileSync(
        path.join(reportDir, 'README.md'),
        readmeLines.join('\n'),
        'utf-8'
    );

    console.log(`Cluster processed: ${args.name}`);
    console.log(`Drafts created: ${drafts.length}`);
}

main();
