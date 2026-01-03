/**
 * HITL Approval Pattern Learning System - Test Suite
 * 
 * Tests the approval pattern learning functionality:
 * - Signature generation
 * - Pattern matching
 * - Confidence calculation
 * - Auto-decision logic
 * - Pattern recording
 * - Voice command parsing
 * 
 * @version 1.0.0
 */

const path = require('path');

// Test Results
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function recordTest(name, passed, details = '') {
    results.tests.push({ name, passed, details });
    if (passed) results.passed++;
    else results.failed++;
    
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}${details ? ': ' + details : ''}`);
}

// ============================================================================
// Tests
// ============================================================================

async function testSignatureGeneration() {
    console.log('\n🔐 Testing Signature Generation...\n');
    
    try {
        const ApprovalPatternService = require('../../server/services/approvalPatternService');
        
        // Test 1: Same action type and similar payload should generate same signature
        const sig1 = ApprovalPatternService.generateSignature('CREATE_DRAFT_TASK', {
            title: 'Task 1',
            description: 'Test description',
            projectId: 'proj-1'
        });
        
        const sig2 = ApprovalPatternService.generateSignature('CREATE_DRAFT_TASK', {
            title: 'Different Title',
            description: 'Different description',
            projectId: 'proj-2'
        });
        
        // Signatures should be the same (based on structure, not values)
        recordTest(
            'Same structure same signature',
            sig1 === sig2,
            `sig1: ${sig1?.substring(0, 8)}... sig2: ${sig2?.substring(0, 8)}...`
        );
        
        // Test 2: Different action type should generate different signature
        const sig3 = ApprovalPatternService.generateSignature('CREATE_DRAFT_INITIATIVE', {
            title: 'Task 1',
            description: 'Test description'
        });
        
        recordTest(
            'Different action type different signature',
            sig1 !== sig3,
            `CREATE_DRAFT_TASK vs CREATE_DRAFT_INITIATIVE`
        );
        
        // Test 3: Different payload structure should generate different signature
        const sig4 = ApprovalPatternService.generateSignature('CREATE_DRAFT_TASK', {
            title: 'Task 1',
            description: 'Test description',
            projectId: 'proj-1',
            extraField: 'extra'
        });
        
        recordTest(
            'Different structure different signature',
            sig1 !== sig4,
            `With vs without extraField`
        );
        
        // Test 4: Null/undefined handling
        const sigNull = ApprovalPatternService.generateSignature(null, {});
        const sigEmpty = ApprovalPatternService.generateSignature('ACTION', null);
        
        recordTest(
            'Null action type returns null',
            sigNull === null,
            `Result: ${sigNull}`
        );
        
        recordTest(
            'Null payload generates signature',
            sigEmpty !== null && sigEmpty.length > 0,
            `Result: ${sigEmpty?.substring(0, 8)}...`
        );
        
    } catch (error) {
        recordTest('Signature generation', false, error.message);
    }
}

async function testConfidenceCalculation() {
    console.log('\n📊 Testing Confidence Calculation...\n');
    
    try {
        const ApprovalPatternService = require('../../server/services/approvalPatternService');
        
        // Test pattern with various decision counts
        const patterns = [
            { decision_count: 1, last_decision_at: new Date().toISOString() },
            { decision_count: 2, last_decision_at: new Date().toISOString() },
            { decision_count: 3, last_decision_at: new Date().toISOString() },
            { decision_count: 5, last_decision_at: new Date().toISOString() },
            { decision_count: 5, last_decision_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() }, // 100 days ago
        ];
        
        const confidences = patterns.map(p => ApprovalPatternService.calculateConfidence(p, {}));
        
        // Test 1: More decisions = higher confidence
        recordTest(
            'Decision count increases confidence',
            confidences[0] < confidences[1] && confidences[1] < confidences[2],
            `1 decision: ${confidences[0].toFixed(2)}, 2 decisions: ${confidences[1].toFixed(2)}, 3 decisions: ${confidences[2].toFixed(2)}`
        );
        
        // Test 2: 5 decisions should give high confidence
        recordTest(
            '5 decisions gives ~95% confidence',
            confidences[3] >= 0.9,
            `5 recent decisions: ${(confidences[3] * 100).toFixed(0)}%`
        );
        
        // Test 3: Old patterns should have lower confidence
        recordTest(
            'Old patterns have lower confidence',
            confidences[4] < confidences[3],
            `Recent: ${(confidences[3] * 100).toFixed(0)}%, 100 days old: ${(confidences[4] * 100).toFixed(0)}%`
        );
        
        // Test 4: Null pattern returns 0
        const nullConfidence = ApprovalPatternService.calculateConfidence(null, {});
        recordTest(
            'Null pattern returns 0 confidence',
            nullConfidence === 0,
            `Result: ${nullConfidence}`
        );
        
    } catch (error) {
        recordTest('Confidence calculation', false, error.message);
    }
}

async function testVoiceCommandParsing() {
    console.log('\n🎤 Testing Voice Command Parsing...\n');
    
    try {
        const VoiceCommandParser = require('../../server/services/voiceCommandParser');
        
        const testCases = [
            // English commands
            { input: 'approve', expectedType: 'APPROVE' },
            { input: 'reject', expectedType: 'REJECT' },
            { input: 'skip', expectedType: 'SKIP' },
            { input: 'details', expectedType: 'DETAILS' },
            { input: 'always approve this', expectedType: 'ALWAYS_APPROVE' },
            { input: 'always reject this', expectedType: 'ALWAYS_REJECT' },
            { input: 'help', expectedType: 'HELP' },
            
            // Polish commands
            { input: 'akceptuj', expectedType: 'APPROVE' },
            { input: 'odrzuć', expectedType: 'REJECT' },
            { input: 'pomiń', expectedType: 'SKIP' },
            { input: 'szczegóły', expectedType: 'DETAILS' },
            { input: 'zawsze akceptuj', expectedType: 'ALWAYS_APPROVE' },
            { input: 'zawsze odrzucaj', expectedType: 'ALWAYS_REJECT' },
            { input: 'pomoc', expectedType: 'HELP' },
            
            // Case insensitivity
            { input: 'APPROVE', expectedType: 'APPROVE' },
            { input: 'Reject', expectedType: 'REJECT' },
            
            // Unknown
            { input: 'random text', expectedType: 'UNKNOWN' },
        ];
        
        let passed = 0;
        let failed = 0;
        
        for (const tc of testCases) {
            const result = VoiceCommandParser.parse(tc.input);
            if (result.type === tc.expectedType) {
                passed++;
            } else {
                failed++;
                console.log(`  ❌ "${tc.input}" expected ${tc.expectedType} but got ${result.type}`);
            }
        }
        
        recordTest(
            'Voice command parsing',
            failed === 0,
            `${passed}/${testCases.length} commands correctly parsed`
        );
        
        // Test reject with reason extraction
        const rejectWithReason = VoiceCommandParser.parse('reject because budget too high');
        recordTest(
            'Reject reason extraction',
            rejectWithReason.type === 'REJECT' && rejectWithReason.params.reason,
            `Reason: "${rejectWithReason.params?.reason || 'not extracted'}"`
        );
        
        // Test confidence levels
        const exactMatch = VoiceCommandParser.parse('approve');
        recordTest(
            'Exact match has high confidence',
            exactMatch.confidence >= 0.9,
            `Confidence: ${(exactMatch.confidence * 100).toFixed(0)}%`
        );
        
        // Test isApprovalCommand helper
        recordTest(
            'isApprovalCommand helper',
            VoiceCommandParser.isApprovalCommand('approve') && 
            VoiceCommandParser.isApprovalCommand('reject') &&
            !VoiceCommandParser.isApprovalCommand('help'),
            'approve=true, reject=true, help=false'
        );
        
        // Test isLearningCommand helper
        recordTest(
            'isLearningCommand helper',
            VoiceCommandParser.isLearningCommand('always approve') && 
            VoiceCommandParser.isLearningCommand('zawsze odrzucaj') &&
            !VoiceCommandParser.isLearningCommand('approve'),
            '"always approve"=true, "zawsze odrzucaj"=true, "approve"=false'
        );
        
    } catch (error) {
        recordTest('Voice command parsing', false, error.message);
    }
}

async function testAutoDecisionThresholds() {
    console.log('\n🤖 Testing Auto-Decision Thresholds...\n');
    
    try {
        const ApprovalPatternService = require('../../server/services/approvalPatternService');
        
        // Test that HIGH risk never auto-decides
        const highRiskResult = await ApprovalPatternService.canAutoDecide(
            'test-user', 
            'CREATE_DRAFT_TASK', 
            {}, 
            'HIGH'
        );
        
        recordTest(
            'HIGH risk never auto-decides',
            highRiskResult.canAutoDecide === false,
            `Result: ${highRiskResult.reason}`
        );
        
        // Test that no pattern returns NO_PATTERN_FOUND
        const noPatternResult = await ApprovalPatternService.canAutoDecide(
            'nonexistent-user-xyz-123', 
            'NONEXISTENT_ACTION', 
            {}, 
            'LOW'
        );
        
        recordTest(
            'Missing pattern returns NO_PATTERN_FOUND',
            noPatternResult.canAutoDecide === false && noPatternResult.reason === 'NO_PATTERN_FOUND',
            `Reason: ${noPatternResult.reason}`
        );
        
    } catch (error) {
        recordTest('Auto-decision thresholds', false, error.message);
    }
}

async function testVoiceResponses() {
    console.log('\n🔊 Testing Voice Response Generation...\n');
    
    try {
        const VoiceCommandParser = require('../../server/services/voiceCommandParser');
        
        // Test English responses
        const approveResponseEn = VoiceCommandParser.getVoiceResponse(
            'APPROVE', 
            { success: true, patternLearned: true }, 
            'en'
        );
        recordTest(
            'English approve response',
            approveResponseEn.includes('Approved') && approveResponseEn.includes('Pattern'),
            `Response: "${approveResponseEn}"`
        );
        
        // Test Polish responses
        const approveResponsePl = VoiceCommandParser.getVoiceResponse(
            'APPROVE', 
            { success: true, patternLearned: true }, 
            'pl'
        );
        recordTest(
            'Polish approve response',
            approveResponsePl.includes('Zatwierdzono') && approveResponsePl.includes('Wzorzec'),
            `Response: "${approveResponsePl}"`
        );
        
        // Test failure response
        const failureResponse = VoiceCommandParser.getVoiceResponse(
            'APPROVE', 
            { success: false, error: 'Action not found' }, 
            'en'
        );
        recordTest(
            'Failure response includes error',
            failureResponse.includes('Could not') && failureResponse.includes('Action not found'),
            `Response: "${failureResponse}"`
        );
        
        // Test help command
        const helpEn = VoiceCommandParser.getHelp('en');
        const helpPl = VoiceCommandParser.getHelp('pl');
        
        recordTest(
            'Help available in both languages',
            helpEn.commands.length > 5 && helpPl.commands.length > 5,
            `EN: ${helpEn.commands.length} commands, PL: ${helpPl.commands.length} commands`
        );
        
    } catch (error) {
        recordTest('Voice response generation', false, error.message);
    }
}

async function testPayloadNormalization() {
    console.log('\n📋 Testing Payload Normalization...\n');
    
    try {
        const ApprovalPatternService = require('../../server/services/approvalPatternService');
        
        // Test that volatile fields are excluded
        const sig1 = ApprovalPatternService.generateSignature('TEST_ACTION', {
            id: 'unique-1',
            created_at: '2024-01-01',
            timestamp: Date.now(),
            title: 'Test',
            _internal: 'hidden'
        });
        
        const sig2 = ApprovalPatternService.generateSignature('TEST_ACTION', {
            id: 'unique-2',
            created_at: '2025-01-01',
            timestamp: Date.now() + 1000,
            title: 'Different',
            _internal: 'different'
        });
        
        recordTest(
            'Volatile fields excluded from signature',
            sig1 === sig2,
            'id, created_at, timestamp, _internal excluded'
        );
        
        // Test nested object handling
        const sig3 = ApprovalPatternService.generateSignature('TEST_ACTION', {
            data: { nested: { deep: true } },
            array: [1, 2, 3]
        });
        
        recordTest(
            'Nested objects handled',
            sig3 !== null && sig3.length > 0,
            `Signature with nested data: ${sig3?.substring(0, 8)}...`
        );
        
    } catch (error) {
        recordTest('Payload normalization', false, error.message);
    }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    console.log('='.repeat(60));
    console.log('🧪 HITL Approval Pattern Learning System - Test Suite');
    console.log('='.repeat(60));
    
    await testSignatureGeneration();
    await testConfidenceCalculation();
    await testVoiceCommandParsing();
    await testAutoDecisionThresholds();
    await testVoiceResponses();
    await testPayloadNormalization();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Pass Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});






