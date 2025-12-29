/**
 * Help System Coverage Verification Script
 * 
 * This script verifies that all modules, views, and cards have
 * corresponding help documentation.
 */

const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Load content files
function loadContent() {
    const basePath = path.join(__dirname, '../config');
    
    let moduleHelp = {};
    let cardDocs = {};
    let faqs = [];
    let videos = [];
    let viewMapping = {};
    
    try {
        // Load module help content
        const moduleHelpPath = path.join(basePath, 'moduleHelpContent.ts');
        if (fs.existsSync(moduleHelpPath)) {
            const content = fs.readFileSync(moduleHelpPath, 'utf8');
            const match = content.match(/export const MODULE_HELP_CONTENT[^=]*=\s*({[\s\S]*?});/);
            if (match) {
                // Parse module IDs from the content
                const moduleIdMatches = content.matchAll(/'([^']+)':\s*{/g);
                for (const m of moduleIdMatches) {
                    moduleHelp[m[1]] = true;
                }
            }
        }
        
        // Load card documentation
        const cardDocsPath = path.join(basePath, 'cardDocumentation.ts');
        if (fs.existsSync(cardDocsPath)) {
            const content = fs.readFileSync(cardDocsPath, 'utf8');
            const cardIdMatches = content.matchAll(/'([^']+)':\s*{[^}]*moduleId/g);
            for (const m of cardIdMatches) {
                cardDocs[m[1]] = true;
            }
        }
        
        // Load FAQs
        const faqPath = path.join(basePath, 'faqContent.ts');
        if (fs.existsSync(faqPath)) {
            const content = fs.readFileSync(faqPath, 'utf8');
            const faqIdMatches = content.matchAll(/id:\s*'([^']+)'/g);
            for (const m of faqIdMatches) {
                faqs.push(m[1]);
            }
        }
        
        // Load videos
        const videosPath = path.join(basePath, 'videoTutorialsContent.ts');
        if (fs.existsSync(videosPath)) {
            const content = fs.readFileSync(videosPath, 'utf8');
            const videoIdMatches = content.matchAll(/id:\s*'([^']+)'/g);
            for (const m of videoIdMatches) {
                videos.push(m[1]);
            }
        }
        
        // Load view mapping
        const viewMappingPath = path.join(basePath, 'viewToModuleMapping.ts');
        if (fs.existsSync(viewMappingPath)) {
            const content = fs.readFileSync(viewMappingPath, 'utf8');
            const viewMatches = content.matchAll(/\[AppView\.([^\]]+)\]:\s*{/g);
            for (const m of viewMatches) {
                viewMapping[m[1]] = true;
            }
        }
    } catch (error) {
        log('red', `Error loading content: ${error.message}`);
    }
    
    return { moduleHelp, cardDocs, faqs, videos, viewMapping };
}

// Load AppView enum from types.ts
function loadAppViews() {
    const typesPath = path.join(__dirname, '../types.ts');
    const views = [];
    
    try {
        const content = fs.readFileSync(typesPath, 'utf8');
        const enumMatch = content.match(/export enum AppView\s*{([\s\S]*?)}/);
        if (enumMatch) {
            const viewMatches = enumMatch[1].matchAll(/(\w+)\s*=/g);
            for (const m of viewMatches) {
                views.push(m[1]);
            }
        }
    } catch (error) {
        log('red', `Error loading AppViews: ${error.message}`);
    }
    
    return views;
}

// Expected modules that should have documentation
const EXPECTED_MODULES = [
    'dashboard',
    'initiatives',
    'tasks',
    'projects',
    'roadmap',
    'reports',
    'assessment',
    'ai-tools',
    'admin-users',
    'admin-billing',
    'admin-analytics',
    'admin-settings',
    'superadmin-orgs',
    'superadmin-users',
    'superadmin-billing',
    'settings-profile',
    'settings-billing',
    'settings-notifications',
    'settings-integrations'
];

// Expected cards per module
const EXPECTED_CARDS = {
    'settings-profile': ['profile-settings', 'avatar-settings', 'password-settings'],
    'settings-billing': ['subscription-info', 'payment-methods', 'usage-history'],
    'settings-notifications': ['email-notifications', 'push-notifications', 'notification-schedule'],
    'admin-users': ['user-list', 'user-invites', 'user-roles'],
    'admin-billing': ['billing-overview', 'invoices', 'subscription-management']
};

// Views that should be excluded from mapping check
const EXCLUDED_VIEWS = [
    'WELCOME',
    'AUTH',
    'ONBOARDING_WIZARD',
    'TRIAL_ENTRY'
];

function runVerification() {
    log('cyan', '\n========================================');
    log('cyan', '  Help System Coverage Verification');
    log('cyan', '========================================\n');
    
    const content = loadContent();
    const appViews = loadAppViews();
    
    let totalChecks = 0;
    let passed = 0;
    let failed = 0;
    const issues = [];
    
    // Check 1: Module Help Content
    log('blue', '📚 Checking Module Help Content...\n');
    for (const module of EXPECTED_MODULES) {
        totalChecks++;
        if (content.moduleHelp[module]) {
            log('green', `  ✓ ${module}`);
            passed++;
        } else {
            log('red', `  ✗ ${module} - MISSING`);
            failed++;
            issues.push({ type: 'module', id: module, issue: 'Missing module documentation' });
        }
    }
    
    // Check 2: Card Documentation
    log('blue', '\n📋 Checking Card Documentation...\n');
    for (const [module, cards] of Object.entries(EXPECTED_CARDS)) {
        for (const card of cards) {
            totalChecks++;
            if (content.cardDocs[card]) {
                log('green', `  ✓ ${module}/${card}`);
                passed++;
            } else {
                log('yellow', `  ⚠ ${module}/${card} - MISSING`);
                failed++;
                issues.push({ type: 'card', id: card, module, issue: 'Missing card documentation' });
            }
        }
    }
    
    // Check 3: View Mapping
    log('blue', '\n🗺️  Checking View Mapping...\n');
    const unmappedViews = [];
    for (const view of appViews) {
        if (EXCLUDED_VIEWS.includes(view)) continue;
        
        totalChecks++;
        if (content.viewMapping[view]) {
            passed++;
        } else {
            unmappedViews.push(view);
            failed++;
        }
    }
    
    if (unmappedViews.length > 0) {
        log('yellow', `  ⚠ ${unmappedViews.length} views without help mapping:`);
        unmappedViews.slice(0, 10).forEach(v => log('yellow', `    - ${v}`));
        if (unmappedViews.length > 10) {
            log('yellow', `    ... and ${unmappedViews.length - 10} more`);
        }
        issues.push({ type: 'views', count: unmappedViews.length, issue: 'Views without help mapping' });
    } else {
        log('green', `  ✓ All ${appViews.length - EXCLUDED_VIEWS.length} views have help mapping`);
    }
    
    // Check 4: FAQ Coverage
    log('blue', '\n❓ Checking FAQ Coverage...\n');
    const faqCount = content.faqs.length;
    totalChecks++;
    if (faqCount >= 65) {
        log('green', `  ✓ ${faqCount} FAQs (target: 65+)`);
        passed++;
    } else {
        log('yellow', `  ⚠ ${faqCount} FAQs (target: 65+, need ${65 - faqCount} more)`);
        failed++;
        issues.push({ type: 'faq', count: faqCount, issue: 'Below target FAQ count' });
    }
    
    // Check 5: Video Tutorials
    log('blue', '\n🎬 Checking Video Tutorials...\n');
    const videoCount = content.videos.length;
    totalChecks++;
    if (videoCount >= 40) {
        log('green', `  ✓ ${videoCount} video tutorials (target: 40+)`);
        passed++;
    } else {
        log('yellow', `  ⚠ ${videoCount} video tutorials (target: 40+, need ${40 - videoCount} more)`);
        failed++;
        issues.push({ type: 'video', count: videoCount, issue: 'Below target video count' });
    }
    
    // Summary
    log('cyan', '\n========================================');
    log('cyan', '  Summary');
    log('cyan', '========================================\n');
    
    const percentage = Math.round((passed / totalChecks) * 100);
    
    log('blue', `  Total Checks: ${totalChecks}`);
    log('green', `  Passed: ${passed}`);
    log('red', `  Failed: ${failed}`);
    log(percentage >= 90 ? 'green' : percentage >= 70 ? 'yellow' : 'red', 
        `  Coverage: ${percentage}%`);
    
    if (issues.length > 0) {
        log('yellow', '\n  Issues to Address:');
        issues.forEach((issue, i) => {
            log('yellow', `    ${i + 1}. [${issue.type.toUpperCase()}] ${issue.issue}`);
        });
    }
    
    // Generate report file
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            totalChecks,
            passed,
            failed,
            coverage: `${percentage}%`
        },
        details: {
            modulesCovered: Object.keys(content.moduleHelp).length,
            cardsCovered: Object.keys(content.cardDocs).length,
            faqCount: faqCount,
            videoCount: videoCount,
            viewsMapped: Object.keys(content.viewMapping).length,
            viewsTotal: appViews.length - EXCLUDED_VIEWS.length
        },
        issues
    };
    
    const reportPath = path.join(__dirname, '../docs/help-coverage-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log('blue', `\n  📄 Report saved to: ${reportPath}\n`);
    
    // Exit code
    if (percentage < 70) {
        log('red', '  ❌ Coverage below 70% - FAILING\n');
        process.exit(1);
    } else if (percentage < 90) {
        log('yellow', '  ⚠️  Coverage below 90% - NEEDS IMPROVEMENT\n');
        process.exit(0);
    } else {
        log('green', '  ✅ Coverage meets target - PASSING\n');
        process.exit(0);
    }
}

// Run verification
runVerification();

