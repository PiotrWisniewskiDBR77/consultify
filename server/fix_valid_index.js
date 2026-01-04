const fs = require('fs');
const path = 'server/index.cjs';
let content = fs.readFileSync(path, 'utf8');

// Remove top-level require
if (content.includes("require('./cron/scheduler.ts')")) {
    content = content.replace(/const Scheduler = require\('\.\/cron\/scheduler\.ts'\);\s*/, '');
    console.log('Removed top-level require.');
} else {
    console.log('Top-level require not found (maybe already removed).');
}

// Replace init call with dynamic import
if (content.includes('Scheduler.init();')) {
    const replacement = `    // Dynamic import for ESM compatibility
    import('./cron/scheduler.ts').then(m => (m.default || m).init()).catch(e => console.error('[Scheduler] Init failed', e));`;

    content = content.replace(/Scheduler\.init\(\);/, replacement);
    console.log('Replaced init call with dynamic import.');
} else {
    console.log('Scheduler.init() call not found.');
}

fs.writeFileSync(path, content);
console.log('Fixed server/index.cjs');
