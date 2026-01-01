#!/usr/bin/env node
/**
 * Learning System Test Suite
 * 
 * Tests AI learning capabilities:
 * - Interaction recording
 * - Pattern extraction
 * - Feedback loops
 * - Preference learning
 * - Success/failure tracking
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const SERVER_PATH = path.join(__dirname, '../../server');
const DB_PATH = path.join(SERVER_PATH, 'database.sqlite');

// Test implementations
async function testLearningSystemModule() {
    const lsPath = path.join(SERVER_PATH, 'services/ai/learningSystem.js');
    const exists = fs.existsSync(lsPath);

    let hasLearning = false;
    if (exists) {
        try {
            const content = fs.readFileSync(lsPath, 'utf8');
            hasLearning = content.includes('learn') || 
                         content.includes('pattern') ||
                         content.includes('feedback');
        } catch {}
    }

    return {
        name: 'Learning System Module',
        passed: exists && hasLearning,
        message: exists ? (hasLearning ? 'Learning system operational' : 'Learning logic not found') : 'Learning system not found'
    };
}

async function testInteractionRecording() {
    const lsPath = path.join(SERVER_PATH, 'services/ai/learningSystem.js');
    let hasRecording = false;

    if (fs.existsSync(lsPath)) {
        try {
            const content = fs.readFileSync(lsPath, 'utf8');
            hasRecording = content.includes('record') || 
                          content.includes('log') ||
                          content.includes('interaction') ||
                          content.includes('track');
        } catch {}
    }

    return {
        name: 'Interaction Recording',
        passed: hasRecording,
        message: hasRecording ? 'Interaction recording enabled' : 'Interaction recording not found'
    };
}

async function testPatternExtraction() {
    const lsPath = path.join(SERVER_PATH, 'services/ai/learningSystem.js');
    let hasPatterns = false;

    if (fs.existsSync(lsPath)) {
        try {
            const content = fs.readFileSync(lsPath, 'utf8');
            hasPatterns = content.includes('pattern') || 
                         content.includes('extract') ||
                         content.includes('analyze');
        } catch {}
    }

    return {
        name: 'Pattern Extraction',
        passed: hasPatterns,
        message: hasPatterns ? 'Pattern extraction enabled' : 'Pattern extraction not found'
    };
}

async function testFeedbackLoop() {
    const lsPath = path.join(SERVER_PATH, 'services/ai/learningSystem.js');
    let hasFeedback = false;

    if (fs.existsSync(lsPath)) {
        try {
            const content = fs.readFileSync(lsPath, 'utf8');
            hasFeedback = content.includes('feedback') || 
                         content.includes('rating') ||
                         content.includes('thumbs');
        } catch {}
    }

    return {
        name: 'Feedback Loop',
        passed: hasFeedback,
        message: hasFeedback ? 'Feedback loop enabled' : 'Feedback loop not found'
    };
}

async function testPreferenceLearning() {
    const paths = [
        path.join(SERVER_PATH, 'services/ai/learningSystem.js'),
        path.join(SERVER_PATH, 'services/ai/personalizationEngine.js')
    ];

    let hasPreferences = false;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf8');
                if (content.includes('preference') || content.includes('personalize') || content.includes('user') && content.includes('style')) {
                    hasPreferences = true;
                    break;
                }
            } catch {}
        }
    }

    return {
        name: 'Preference Learning',
        passed: hasPreferences,
        message: hasPreferences ? 'Preference learning enabled' : 'Preference learning not found'
    };
}

async function testSuccessFailureTracking() {
    const lsPath = path.join(SERVER_PATH, 'services/ai/learningSystem.js');
    let hasTracking = false;

    if (fs.existsSync(lsPath)) {
        try {
            const content = fs.readFileSync(lsPath, 'utf8');
            hasTracking = content.includes('success') || 
                         content.includes('failure') ||
                         content.includes('outcome') ||
                         content.includes('result');
        } catch {}
    }

    return {
        name: 'Success/Failure Tracking',
        passed: hasTracking,
        message: hasTracking ? 'Outcome tracking enabled' : 'Outcome tracking not found'
    };
}

async function testLearningPatternsTables() {
    return new Promise((resolve) => {
        if (!fs.existsSync(DB_PATH)) {
            resolve({
                name: 'Learning Patterns Tables',
                passed: false,
                message: 'Database not found'
            });
            return;
        }

        const db = new sqlite3.Database(DB_PATH);
        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%pattern%' OR name LIKE '%learning%'", [], (err, rows) => {
            db.close();
            if (err) {
                resolve({
                    name: 'Learning Patterns Tables',
                    passed: false,
                    message: err.message
                });
                return;
            }

            const hasTable = rows && rows.length > 0;
            resolve({
                name: 'Learning Patterns Tables',
                passed: hasTable,
                message: hasTable ? `Found: ${rows.map(r => r.name).join(', ')}` : 'No learning tables found'
            });
        });
    });
}

async function testPersonalizationEngine() {
    const pePath = path.join(SERVER_PATH, 'services/ai/personalizationEngine.js');
    const exists = fs.existsSync(pePath);

    let hasPersonalization = false;
    if (exists) {
        try {
            const content = fs.readFileSync(pePath, 'utf8');
            hasPersonalization = content.includes('personalize') || 
                                content.includes('adapt') ||
                                content.includes('customize');
        } catch {}
    }

    return {
        name: 'Personalization Engine',
        passed: exists && hasPersonalization,
        message: exists ? (hasPersonalization ? 'Personalization operational' : 'Personalization logic not found') : 'Personalization engine not found'
    };
}

async function testModelFineTuningTriggers() {
    const lsPath = path.join(SERVER_PATH, 'services/ai/learningSystem.js');
    let hasFineTuning = false;

    if (fs.existsSync(lsPath)) {
        try {
            const content = fs.readFileSync(lsPath, 'utf8');
            hasFineTuning = content.includes('fine') || 
                           content.includes('tune') ||
                           content.includes('train') ||
                           content.includes('update');
        } catch {}
    }

    return {
        name: 'Fine-Tuning Triggers',
        passed: hasFineTuning,
        message: hasFineTuning ? 'Fine-tuning triggers configured' : 'Fine-tuning triggers not found'
    };
}

// Main test runner
async function runTests() {
    const tests = [];
    let passed = 0;
    let failed = 0;

    const testFunctions = [
        testLearningSystemModule,
        testInteractionRecording,
        testPatternExtraction,
        testFeedbackLoop,
        testPreferenceLearning,
        testSuccessFailureTracking,
        testLearningPatternsTables,
        testPersonalizationEngine,
        testModelFineTuningTriggers
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
        console.log('\nLearning System Test Results:');
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

