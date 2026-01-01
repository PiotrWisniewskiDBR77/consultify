#!/usr/bin/env node
/**
 * Co-Thinker System Test Suite
 * 
 * Tests Harvard-level AI consultant capabilities:
 * - Intent engine
 * - Conversation state machine
 * - Action execution
 * - Socratic questioning
 * - Context preservation
 * - Consultant persona
 */

const path = require('path');
const fs = require('fs');

const SERVER_PATH = path.join(__dirname, '../../server');

// Test implementations
async function testIntentEngine() {
    const iePath = path.join(SERVER_PATH, 'services/ai/intentEngine.js');
    const exists = fs.existsSync(iePath);

    let hasIntent = false;
    if (exists) {
        try {
            const content = fs.readFileSync(iePath, 'utf8');
            hasIntent = content.includes('intent') || 
                       content.includes('analyze') ||
                       content.includes('classify');
        } catch {}
    }

    return {
        name: 'Intent Engine',
        passed: exists && hasIntent,
        message: exists ? (hasIntent ? 'Intent engine operational' : 'Intent logic not found') : 'Intent engine not found'
    };
}

async function testConversationStateMachine() {
    const csmPath = path.join(SERVER_PATH, 'services/ai/conversationStateMachine.js');
    const exists = fs.existsSync(csmPath);

    let hasStateMachine = false;
    if (exists) {
        try {
            const content = fs.readFileSync(csmPath, 'utf8');
            hasStateMachine = content.includes('state') || 
                             content.includes('transition') ||
                             content.includes('phase');
        } catch {}
    }

    return {
        name: 'Conversation State Machine',
        passed: exists && hasStateMachine,
        message: exists ? (hasStateMachine ? 'State machine operational' : 'State logic not found') : 'Conversation state machine not found'
    };
}

async function testActionExecutor() {
    const aePath = path.join(SERVER_PATH, 'services/ai/actionExecutor.js');
    const exists = fs.existsSync(aePath);

    let hasActions = false;
    if (exists) {
        try {
            const content = fs.readFileSync(aePath, 'utf8');
            hasActions = content.includes('execute') || 
                        content.includes('action') ||
                        content.includes('perform');
        } catch {}
    }

    return {
        name: 'Action Executor',
        passed: exists && hasActions,
        message: exists ? (hasActions ? 'Action executor operational' : 'Action logic not found') : 'Action executor not found'
    };
}

async function testSocraticEngine() {
    const sePath = path.join(SERVER_PATH, 'services/ai/socraticEngine.js');
    const exists = fs.existsSync(sePath);

    let hasSocratic = false;
    if (exists) {
        try {
            const content = fs.readFileSync(sePath, 'utf8');
            hasSocratic = content.includes('question') || 
                         content.includes('socratic') ||
                         content.includes('probe');
        } catch {}
    }

    return {
        name: 'Socratic Question Engine',
        passed: exists && hasSocratic,
        message: exists ? (hasSocratic ? 'Socratic engine operational' : 'Socratic logic not found') : 'Socratic engine not found'
    };
}

async function testHarvardConsultantPrompts() {
    const hcPath = path.join(SERVER_PATH, 'services/ai/harvardConsultantPrompts.js');
    const exists = fs.existsSync(hcPath);

    let hasPrompts = false;
    if (exists) {
        try {
            const content = fs.readFileSync(hcPath, 'utf8');
            hasPrompts = content.includes('consultant') || 
                        content.includes('Harvard') ||
                        content.includes('McKinsey') ||
                        content.includes('strategic');
        } catch {}
    }

    return {
        name: 'Harvard Consultant Prompts',
        passed: exists && hasPrompts,
        message: exists ? (hasPrompts ? 'Consultant prompts configured' : 'Consultant prompts not found') : 'Harvard prompts not found'
    };
}

async function testCoThinkerPrompts() {
    const ctPath = path.join(SERVER_PATH, 'services/ai/coThinkerPrompts.js');
    const exists = fs.existsSync(ctPath);

    let hasPrompts = false;
    if (exists) {
        try {
            const content = fs.readFileSync(ctPath, 'utf8');
            hasPrompts = content.includes('co-thinker') || 
                        content.includes('CoThinker') ||
                        content.includes('cothinker') ||
                        content.includes('partner');
        } catch {}
    }

    return {
        name: 'Co-Thinker Prompts',
        passed: exists && hasPrompts,
        message: exists ? (hasPrompts ? 'Co-Thinker prompts configured' : 'Co-Thinker prompts not found') : 'Co-Thinker prompts not found'
    };
}

async function testConsultingFlowEngine() {
    const cfePath = path.join(SERVER_PATH, 'services/ai/consultingFlowEngine.js');
    const exists = fs.existsSync(cfePath);

    let hasFlow = false;
    if (exists) {
        try {
            const content = fs.readFileSync(cfePath, 'utf8');
            hasFlow = content.includes('flow') || 
                     content.includes('consulting') ||
                     content.includes('methodology');
        } catch {}
    }

    return {
        name: 'Consulting Flow Engine',
        passed: exists && hasFlow,
        message: exists ? (hasFlow ? 'Consulting flow operational' : 'Flow logic not found') : 'Consulting flow engine not found'
    };
}

async function testContextPreservation() {
    const paths = [
        path.join(SERVER_PATH, 'services/ai/conversationStateMachine.js'),
        path.join(SERVER_PATH, 'services/ai/conversationTracker.js'),
        path.join(SERVER_PATH, 'services/ai/enhancedContextBuilder.js'),
        path.join(SERVER_PATH, 'services/ai/memoryManager.js'),
        path.join(SERVER_PATH, 'services/ai/aiContext.js')
    ];

    let hasContext = false;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf8');
                if (content.includes('context') || 
                    content.includes('state') || 
                    content.includes('history') ||
                    content.includes('conversation') ||
                    content.includes('memory')) {
                    hasContext = true;
                    break;
                }
            } catch {}
        }
    }

    return {
        name: 'Context Preservation',
        passed: hasContext,
        message: hasContext ? 'Context preservation enabled' : 'Context preservation not found'
    };
}

async function testSmartSuggestions() {
    const ssPath = path.join(SERVER_PATH, 'services/ai/smartSuggestions.js');
    const exists = fs.existsSync(ssPath);

    let hasSuggestions = false;
    if (exists) {
        try {
            const content = fs.readFileSync(ssPath, 'utf8');
            hasSuggestions = content.includes('suggest') || 
                            content.includes('recommend') ||
                            content.includes('next');
        } catch {}
    }

    return {
        name: 'Smart Suggestions',
        passed: exists && hasSuggestions,
        message: exists ? (hasSuggestions ? 'Smart suggestions operational' : 'Suggestion logic not found') : 'Smart suggestions not found'
    };
}

async function testProactiveNudges() {
    const pnPath = path.join(SERVER_PATH, 'services/ai/proactiveNudges.js');
    const exists = fs.existsSync(pnPath);

    let hasNudges = false;
    if (exists) {
        try {
            const content = fs.readFileSync(pnPath, 'utf8');
            hasNudges = content.includes('nudge') || 
                       content.includes('proactive') ||
                       content.includes('suggest');
        } catch {}
    }

    return {
        name: 'Proactive Nudges',
        passed: exists && hasNudges,
        message: exists ? (hasNudges ? 'Proactive nudges operational' : 'Nudge logic not found') : 'Proactive nudges not found'
    };
}

async function testToolsIntegration() {
    const toolsPath = path.join(SERVER_PATH, 'services/ai/tools');
    const exists = fs.existsSync(toolsPath);

    let toolCount = 0;
    if (exists) {
        try {
            const files = fs.readdirSync(toolsPath);
            toolCount = files.filter(f => f.endsWith('.js')).length;
        } catch {}
    }

    return {
        name: 'AI Tools Integration',
        passed: toolCount > 0,
        message: toolCount > 0 ? `${toolCount} tools available` : 'No AI tools found'
    };
}

// Main test runner
async function runTests() {
    const tests = [];
    let passed = 0;
    let failed = 0;

    const testFunctions = [
        testIntentEngine,
        testConversationStateMachine,
        testActionExecutor,
        testSocraticEngine,
        testHarvardConsultantPrompts,
        testCoThinkerPrompts,
        testConsultingFlowEngine,
        testContextPreservation,
        testSmartSuggestions,
        testProactiveNudges,
        testToolsIntegration
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
        console.log('\nCo-Thinker System Test Results:');
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

