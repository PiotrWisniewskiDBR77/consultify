#!/usr/bin/env node
/**
 * PMO Standards Verification Script
 * 
 * Verifies the Meta-PMO Framework implementation:
 * - Domain registry completeness
 * - Standards mapping accuracy
 * - Audit trail functionality
 * - Database schema integrity
 * 
 * Run: node verify_pmo_standards.cjs
 */

const path = require('path');
const fs = require('fs');

const rootDir = __dirname;
const serverDir = path.join(rootDir, 'server');

console.log('\n====================================================');
console.log('  SCMS Meta-PMO Framework Verification');
console.log('  Standards: ISO 21500 | PMI PMBOK 7th | PRINCE2');
console.log('====================================================\n');

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(msg) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
}

function fail(msg) {
    console.log(`  ❌ FAIL: ${msg}`);
    failed++;
}

function warn(msg) {
    console.log(`  ⚠️  WARN: ${msg}`);
    warnings++;
}

function section(title) {
    console.log(`\n📋 ${title}`);
    console.log('─'.repeat(50));
}

// ==========================================
// 1. SERVICE FILES EXISTENCE
// ==========================================
section('1. Service Files');

const requiredFiles = [
    'services/pmoDomainRegistry.js',
    'services/pmoStandardsMapping.js',
    'routes/pmoDomains.js'
];

requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, 'server', file);
    if (fs.existsSync(fullPath)) {
        pass(`${file} exists`);
    } else {
        fail(`${file} missing`);
    }
});

// ==========================================
// 2. DOMAIN REGISTRY COMPLETENESS
// ==========================================
section('2. Domain Registry');

try {
    const PMODomainRegistry = require(path.join(serverDir, 'services/pmoDomainRegistry'));

    // Check all 7 domains are defined
    const expectedDomains = [
        'GOVERNANCE_DECISION_MAKING',
        'SCOPE_CHANGE_CONTROL',
        'SCHEDULE_MILESTONES',
        'RISK_ISSUE_MANAGEMENT',
        'RESOURCE_RESPONSIBILITY',
        'PERFORMANCE_MONITORING',
        'BENEFITS_REALIZATION'
    ];

    const definedDomains = Object.values(PMODomainRegistry.PMO_DOMAIN_IDS);

    if (definedDomains.length === 7) {
        pass('7 PMO domains defined');
    } else {
        fail(`Expected 7 domains, found ${definedDomains.length}`);
    }

    expectedDomains.forEach(domainId => {
        if (definedDomains.includes(domainId)) {
            pass(`Domain ${domainId} exists`);
        } else {
            fail(`Domain ${domainId} missing`);
        }
    });

    // Check each domain has standards mapping
    PMODomainRegistry.PMO_DOMAINS.forEach(domain => {
        if (domain.iso21500Term && domain.pmbokTerm && domain.prince2Term) {
            pass(`${domain.id} has all standards terms`);
        } else {
            fail(`${domain.id} missing standards terms`);
        }

        if (domain.scmsObjects && domain.scmsObjects.length > 0) {
            pass(`${domain.id} has ${domain.scmsObjects.length} SCMS objects`);
        } else {
            warn(`${domain.id} has no SCMS objects defined`);
        }
    });

} catch (err) {
    fail(`Domain Registry load failed: ${err.message}`);
}

// ==========================================
// 3. STANDARDS MAPPING COMPLETENESS
// ==========================================
section('3. Standards Mapping');

try {
    const PMOStandardsMapping = require(path.join(serverDir, 'services/pmoStandardsMapping'));

    const mappings = PMOStandardsMapping.getAllMappings();
    const mappingKeys = Object.keys(mappings);

    console.log(`  📊 Found ${mappingKeys.length} mapped concepts`);

    const requiredConcepts = [
        'Phase', 'StageGate', 'Decision', 'Initiative',
        'Task', 'Baseline', 'ChangeRequest', 'Roadmap',
        'GovernanceSettings', 'PMOHealth', 'ValueHypothesis', 'Escalation'
    ];

    requiredConcepts.forEach(concept => {
        const mapping = PMOStandardsMapping.getMapping(concept);
        if (mapping) {
            if (mapping.iso21500 && mapping.pmbok7 && mapping.prince2) {
                pass(`${concept} → All 3 standards mapped`);
            } else {
                fail(`${concept} → Missing some standards`);
            }
        } else {
            fail(`${concept} → Not mapped`);
        }
    });

    // Check mapping table generation
    const table = PMOStandardsMapping.generateMappingTable();
    if (table.length >= 10) {
        pass(`Mapping table generates ${table.length} rows`);
    } else {
        fail(`Mapping table too small: ${table.length} rows`);
    }

    // Check neutral description availability
    const neutralDesc = PMOStandardsMapping.getNeutralDescription('Decision');
    if (neutralDesc && !neutralDesc.includes('No description')) {
        pass('Neutral descriptions available');
    } else {
        warn('Some neutral descriptions missing');
    }

} catch (err) {
    fail(`Standards Mapping load failed: ${err.message}`);
}

// ==========================================
// 4. TYPE DEFINITIONS
// ==========================================
section('4. Type Definitions');

const typesPath = path.join(__dirname, 'types.ts');
if (fs.existsSync(typesPath)) {
    const typesContent = fs.readFileSync(typesPath, 'utf8');

    const requiredTypes = [
        'PMODomainId',
        'PMOStandardMapping',
        'PMODomain',
        'ProjectPMOConfiguration',
        'PMOAuditableObject',
        'PMOAuditEntry'
    ];

    requiredTypes.forEach(typeName => {
        if (typesContent.includes(typeName)) {
            pass(`Type ${typeName} defined`);
        } else {
            fail(`Type ${typeName} missing`);
        }
    });
} else {
    fail('types.ts not found');
}

// ==========================================
// 5. DATABASE SCHEMA
// ==========================================
section('5. Database Schema');

const dbPath = path.join(__dirname, 'server', 'database.sqlite.active.js');
if (fs.existsSync(dbPath)) {
    const dbContent = fs.readFileSync(dbPath, 'utf8');

    const requiredTables = [
        'pmo_domains',
        'project_pmo_domains',
        'pmo_audit_trail'
    ];

    requiredTables.forEach(table => {
        if (dbContent.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
            pass(`Table ${table} defined`);
        } else {
            fail(`Table ${table} missing`);
        }
    });

    // Check domain reference columns
    const requiredColumns = [
        'decisions ADD COLUMN pmo_domain_id',
        'schedule_baselines ADD COLUMN pmo_domain_id',
        'change_requests ADD COLUMN pmo_domain_id',
        'stage_gates ADD COLUMN pmo_domain_id'
    ];

    requiredColumns.forEach(col => {
        if (dbContent.includes(col)) {
            pass(`Column migration: ${col.split(' ')[0]}.pmo_domain_id`);
        } else {
            warn(`Column migration may be missing: ${col}`);
        }
    });
} else {
    fail('database.sqlite.active.js not found');
}

// ==========================================
// 6. DOCUMENTATION
// ==========================================
section('6. Documentation');

const docsPath = path.join(__dirname, 'docs', 'PMO_STANDARDS_MAPPING.md');
if (fs.existsSync(docsPath)) {
    pass('PMO_STANDARDS_MAPPING.md exists');

    const docsContent = fs.readFileSync(docsPath, 'utf8');

    const requiredSections = [
        'ISO 21500',
        'PMBOK',
        'PRINCE2',
        'Mapping Table',
        'Domain Registry',
        'Audit'
    ];

    requiredSections.forEach(section => {
        if (docsContent.toLowerCase().includes(section.toLowerCase())) {
            pass(`Documentation includes ${section}`);
        } else {
            warn(`Documentation may be missing ${section}`);
        }
    });
} else {
    fail('PMO_STANDARDS_MAPPING.md missing');
}

// ==========================================
// 7. ROUTE REGISTRATION
// ==========================================
section('7. Route Registration');

const indexPath = path.join(__dirname, 'server', 'index.js');
if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, 'utf8');

    if (indexContent.includes("require('./routes/pmoDomains')")) {
        pass('pmoDomains route imported');
    } else {
        fail('pmoDomains route not imported');
    }

    if (indexContent.includes("/api/pmo-domains")) {
        pass('pmoDomains route mounted at /api/pmo-domains');
    } else {
        fail('pmoDomains route not mounted');
    }
} else {
    fail('server/index.js not found');
}

// ==========================================
// SUMMARY
// ==========================================
console.log('\n====================================================');
console.log('  VERIFICATION SUMMARY');
console.log('====================================================');
console.log(`  ✅ Passed:   ${passed}`);
console.log(`  ❌ Failed:   ${failed}`);
console.log(`  ⚠️  Warnings: ${warnings}`);
console.log('----------------------------------------------------');

if (failed === 0) {
    console.log('  🎉 Meta-PMO Framework verification PASSED!');
    console.log('  ✓ System is standards-compatible (ISO/PMBOK/PRINCE2)');
    process.exit(0);
} else {
    console.log('  ⚠️  Some checks failed. Please review above.');
    process.exit(1);
}
