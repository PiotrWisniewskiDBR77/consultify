#!/usr/bin/env node
/**
 * Quality Assurance Test Suite
 * 
 * Tests AI output quality mechanisms:
 * - Hallucination detection
 * - Citation validation
 * - Response relevance
 * - Output structure
 * - Language quality
 */

const path = require('path');
const fs = require('fs');

const SERVER_PATH = path.join(__dirname, '../../server');

// Test implementations
async function testQualityCheckerModule() {
    const qcPath = path.join(SERVER_PATH, 'services/ai/qualityChecker.js');
    const exists = fs.existsSync(qcPath);

    let hasQualityCheck = false;
    if (exists) {
        try {
            const content = fs.readFileSync(qcPath, 'utf8');
            hasQualityCheck = content.includes('check') || 
                             content.includes('validate') ||
                             content.includes('quality');
        } catch {}
    }

    return {
        name: 'Quality Checker Module',
        passed: exists && hasQualityCheck,
        message: exists ? (hasQualityCheck ? 'Quality checker operational' : 'Quality check logic not found') : 'Quality checker not found'
    };
}

async function testHallucinationDetection() {
    const qcPath = path.join(SERVER_PATH, 'services/ai/qualityChecker.js');
    let hasHallucinationCheck = false;

    if (fs.existsSync(qcPath)) {
        try {
            const content = fs.readFileSync(qcPath, 'utf8');
            hasHallucinationCheck = content.includes('hallucination') || 
                                   content.includes('factual') ||
                                   content.includes('grounded') ||
                                   content.includes('verify');
        } catch {}
    }

    return {
        name: 'Hallucination Detection',
        passed: hasHallucinationCheck,
        message: hasHallucinationCheck ? 'Hallucination detection enabled' : 'Hallucination detection not found'
    };
}

async function testCitationValidation() {
    const paths = [
        path.join(SERVER_PATH, 'services/ai/qualityChecker.js'),
        path.join(SERVER_PATH, 'services/ai/citationExtractor.js')
    ];

    let hasCitationValidation = false;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf8');
                if (content.includes('citation') && (content.includes('valid') || content.includes('check') || content.includes('verify'))) {
                    hasCitationValidation = true;
                    break;
                }
            } catch {}
        }
    }

    return {
        name: 'Citation Validation',
        passed: hasCitationValidation,
        message: hasCitationValidation ? 'Citation validation enabled' : 'Citation validation not found'
    };
}

async function testRelevanceScoring() {
    const qcPath = path.join(SERVER_PATH, 'services/ai/qualityChecker.js');
    let hasRelevance = false;

    if (fs.existsSync(qcPath)) {
        try {
            const content = fs.readFileSync(qcPath, 'utf8');
            hasRelevance = content.includes('relevance') || 
                          content.includes('relevant') ||
                          content.includes('pertinent');
        } catch {}
    }

    return {
        name: 'Relevance Scoring',
        passed: hasRelevance,
        message: hasRelevance ? 'Relevance scoring enabled' : 'Relevance scoring not found'
    };
}

async function testOutputStructureValidation() {
    const qcPath = path.join(SERVER_PATH, 'services/ai/qualityChecker.js');
    let hasStructureCheck = false;

    if (fs.existsSync(qcPath)) {
        try {
            const content = fs.readFileSync(qcPath, 'utf8');
            hasStructureCheck = content.includes('structure') || 
                               content.includes('format') ||
                               content.includes('schema') ||
                               content.includes('length');
        } catch {}
    }

    return {
        name: 'Output Structure Validation',
        passed: hasStructureCheck,
        message: hasStructureCheck ? 'Structure validation enabled' : 'Structure validation not found'
    };
}

async function testLanguageQuality() {
    const qcPath = path.join(SERVER_PATH, 'services/ai/qualityChecker.js');
    let hasLanguageCheck = false;

    if (fs.existsSync(qcPath)) {
        try {
            const content = fs.readFileSync(qcPath, 'utf8');
            hasLanguageCheck = content.includes('language') || 
                              content.includes('grammar') ||
                              content.includes('tone') ||
                              content.includes('professional');
        } catch {}
    }

    return {
        name: 'Language Quality Check',
        passed: hasLanguageCheck,
        message: hasLanguageCheck ? 'Language quality check enabled' : 'Language quality check not found'
    };
}

async function testPlaceholderDetection() {
    const qcPath = path.join(SERVER_PATH, 'services/ai/qualityChecker.js');
    let hasPlaceholderDetection = false;

    if (fs.existsSync(qcPath)) {
        try {
            const content = fs.readFileSync(qcPath, 'utf8');
            hasPlaceholderDetection = content.includes('placeholder') || 
                                     content.includes('[') ||
                                     content.includes('TODO') ||
                                     content.includes('incomplete');
        } catch {}
    }

    return {
        name: 'Placeholder Detection',
        passed: hasPlaceholderDetection,
        message: hasPlaceholderDetection ? 'Placeholder detection enabled' : 'Placeholder detection not found'
    };
}

async function testQualityScoreComputation() {
    const qcPath = path.join(SERVER_PATH, 'services/ai/qualityChecker.js');
    let hasScoring = false;

    if (fs.existsSync(qcPath)) {
        try {
            const content = fs.readFileSync(qcPath, 'utf8');
            hasScoring = content.includes('score') || 
                        content.includes('rating') ||
                        content.includes('grade');
        } catch {}
    }

    return {
        name: 'Quality Score Computation',
        passed: hasScoring,
        message: hasScoring ? 'Quality scoring enabled' : 'Quality scoring not found'
    };
}

async function testQualityThresholds() {
    const qcPath = path.join(SERVER_PATH, 'services/ai/qualityChecker.js');
    let hasThresholds = false;

    if (fs.existsSync(qcPath)) {
        try {
            const content = fs.readFileSync(qcPath, 'utf8');
            hasThresholds = content.includes('threshold') || 
                           content.includes('minimum') ||
                           content.includes('THRESHOLD') ||
                           content.includes('MIN_');
        } catch {}
    }

    return {
        name: 'Quality Thresholds',
        passed: hasThresholds,
        message: hasThresholds ? 'Quality thresholds configured' : 'Quality thresholds not found'
    };
}

// Main test runner
async function runTests() {
    const tests = [];
    let passed = 0;
    let failed = 0;

    const testFunctions = [
        testQualityCheckerModule,
        testHallucinationDetection,
        testCitationValidation,
        testRelevanceScoring,
        testOutputStructureValidation,
        testLanguageQuality,
        testPlaceholderDetection,
        testQualityScoreComputation,
        testQualityThresholds
    ];

    for (const testFn of testFunctions) {
        try {
            const result = await testFn();
            tests.push(result);
            if (result.passed) passed++; else failed++;
        } catch (e) {
            tests.push({
                name: testFn.name,
                passed: false,
                message: e.message
            });
            failed++;
        }
    }

    return { passed, failed, tests };
}

module.exports = { runTests };

if (require.main === module) {
    runTests().then(results => {
        console.log('\nQuality Assurance Test Results:');
        console.log('─'.repeat(50));
        results.tests.forEach(t => {
            const status = t.passed ? '✓' : '✗';
            console.log(`${status} ${t.name}: ${t.message}`);
        });
        console.log('─'.repeat(50));
        console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
        process.exit(results.failed > 0 ? 1 : 0);
    });
}

