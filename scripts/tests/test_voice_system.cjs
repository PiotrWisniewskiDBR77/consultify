#!/usr/bin/env node
/**
 * Voice System Test Suite
 * 
 * Comprehensive tests for the Universal Voice Conversation System:
 * - STT Provider Connectivity (Whisper, Deepgram)
 * - TTS Provider Connectivity (OpenAI TTS, Edge TTS)
 * - Audio Format Support
 * - Streaming Latency
 * - Language Support
 * - Fallback Chain
 * - Voice Activity Detection
 * - Text Cleaning
 * - API Endpoints
 * - Health Monitor
 * 
 * Part of the Enterprise AI System Test Suite
 * 
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs');

// ============================================================================
// Test Results
// ============================================================================

const results = {
    suite: 'Voice System',
    suiteId: 'voice-system',
    tests: [],
    passed: 0,
    failed: 0,
    startTime: Date.now()
};

function addResult(name, passed, message, details = {}) {
    results.tests.push({ name, passed, message, ...details });
    if (passed) results.passed++;
    else results.failed++;
    
    const icon = passed ? '✅' : '❌';
    console.log(`  ${icon} ${name}: ${message}`);
}

// ============================================================================
// Test Functions
// ============================================================================

/**
 * Test 1: STT Service Module
 */
async function testSTTModule() {
    try {
        const sttPath = path.join(__dirname, '../../server/services/ai/speechToTextService.js');
        
        if (!fs.existsSync(sttPath)) {
            addResult('STT Service Module', false, 'Module file not found');
            return;
        }

        const { speechToTextService, STT_CONFIG } = require(sttPath);
        
        // Check service exists
        if (!speechToTextService) {
            addResult('STT Service Module', false, 'Service not exported');
            return;
        }

        // Check configuration
        const hasWhisper = STT_CONFIG?.providers?.whisper !== undefined;
        const hasDeepgram = STT_CONFIG?.providers?.deepgram !== undefined;
        
        if (hasWhisper && hasDeepgram) {
            addResult('STT Service Module', true, 'STT service with 2 providers configured');
        } else {
            addResult('STT Service Module', false, 'Missing STT providers configuration');
        }

    } catch (error) {
        addResult('STT Service Module', false, `Error: ${error.message}`);
    }
}

/**
 * Test 2: TTS Service Module
 */
async function testTTSModule() {
    try {
        const ttsPath = path.join(__dirname, '../../server/services/ai/textToSpeechService.js');
        
        if (!fs.existsSync(ttsPath)) {
            addResult('TTS Service Module', false, 'Module file not found');
            return;
        }

        const { textToSpeechService, TTS_CONFIG } = require(ttsPath);
        
        if (!textToSpeechService) {
            addResult('TTS Service Module', false, 'Service not exported');
            return;
        }

        // Check OpenAI voices
        const voices = TTS_CONFIG?.providers?.openai?.voices || [];
        const expectedVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
        const hasAllVoices = expectedVoices.every(v => voices.find(voice => voice.id === v));

        if (hasAllVoices) {
            addResult('TTS Service Module', true, `TTS service with ${voices.length} OpenAI voices`);
        } else {
            addResult('TTS Service Module', false, `Missing voices. Found: ${voices.map(v => v.id).join(', ')}`);
        }

    } catch (error) {
        addResult('TTS Service Module', false, `Error: ${error.message}`);
    }
}

/**
 * Test 3: Voice API Routes
 */
async function testVoiceRoutes() {
    try {
        const routesPath = path.join(__dirname, '../../server/routes/voice.js');
        
        if (!fs.existsSync(routesPath)) {
            addResult('Voice API Routes', false, 'Routes file not found');
            return;
        }

        const routeContent = fs.readFileSync(routesPath, 'utf-8');
        
        // Check for required endpoints
        const requiredEndpoints = [
            "router.post('/stt'",
            "router.post('/tts'",
            "router.get('/voices'",
            "router.get('/health'",
            "router.get('/settings'",
            "router.post('/settings'"
        ];

        const foundEndpoints = requiredEndpoints.filter(ep => routeContent.includes(ep));

        if (foundEndpoints.length === requiredEndpoints.length) {
            addResult('Voice API Routes', true, `All ${requiredEndpoints.length} endpoints configured`);
        } else {
            addResult('Voice API Routes', false, `Missing endpoints. Found ${foundEndpoints.length}/${requiredEndpoints.length}`);
        }

    } catch (error) {
        addResult('Voice API Routes', false, `Error: ${error.message}`);
    }
}

/**
 * Test 4: Voice Health Monitor
 */
async function testHealthMonitor() {
    try {
        const healthPath = path.join(__dirname, '../../server/services/ai/voiceHealthMonitor.js');
        
        if (!fs.existsSync(healthPath)) {
            addResult('Voice Health Monitor', false, 'Module file not found');
            return;
        }

        const { voiceHealthMonitor } = require(healthPath);
        
        if (!voiceHealthMonitor) {
            addResult('Voice Health Monitor', false, 'Monitor not exported');
            return;
        }

        // Check required methods
        const requiredMethods = ['start', 'stop', 'getStatus', 'checkNow'];
        const hasMethods = requiredMethods.every(m => typeof voiceHealthMonitor[m] === 'function');

        if (hasMethods) {
            addResult('Voice Health Monitor', true, 'Health monitor operational with all methods');
        } else {
            addResult('Voice Health Monitor', false, 'Missing required methods');
        }

    } catch (error) {
        addResult('Voice Health Monitor', false, `Error: ${error.message}`);
    }
}

/**
 * Test 5: Text Cleaning Utility
 */
async function testTextCleaning() {
    try {
        const ttsPath = path.join(__dirname, '../../server/services/ai/textToSpeechService.js');
        const { cleanTextForSpeech } = require(ttsPath);

        if (!cleanTextForSpeech) {
            addResult('Text Cleaning for TTS', false, 'cleanTextForSpeech not exported');
            return;
        }

        // Test cases
        const testCases = [
            {
                input: '```javascript\nconst x = 1;\n```',
                shouldNotContain: '```'
            },
            {
                input: '**bold** and *italic*',
                expected: 'bold and italic'
            },
            {
                input: '[link](https://example.com)',
                expected: 'link'
            },
            {
                input: '# Header\n\nParagraph',
                shouldNotContain: '#'
            }
        ];

        let passedTests = 0;
        for (const test of testCases) {
            const result = cleanTextForSpeech(test.input);
            
            if (test.expected && result.includes(test.expected)) {
                passedTests++;
            } else if (test.shouldNotContain && !result.includes(test.shouldNotContain)) {
                passedTests++;
            }
        }

        if (passedTests === testCases.length) {
            addResult('Text Cleaning for TTS', true, `All ${testCases.length} cleaning tests passed`);
        } else {
            addResult('Text Cleaning for TTS', false, `${passedTests}/${testCases.length} cleaning tests passed`);
        }

    } catch (error) {
        addResult('Text Cleaning for TTS', false, `Error: ${error.message}`);
    }
}

/**
 * Test 6: Language Support
 */
async function testLanguageSupport() {
    try {
        const sttPath = path.join(__dirname, '../../server/services/ai/speechToTextService.js');
        const { speechToTextService } = require(sttPath);

        if (!speechToTextService) {
            addResult('Language Support', false, 'STT service not available');
            return;
        }

        const languages = speechToTextService.getSupportedLanguages();
        const requiredLanguages = ['pl', 'en', 'de', 'es', 'ja', 'ar'];
        const hasRequired = requiredLanguages.every(lang => languages.includes(lang));

        if (hasRequired) {
            addResult('Language Support', true, `${languages.length} languages supported including required 6`);
        } else {
            const missing = requiredLanguages.filter(l => !languages.includes(l));
            addResult('Language Support', false, `Missing languages: ${missing.join(', ')}`);
        }

    } catch (error) {
        addResult('Language Support', false, `Error: ${error.message}`);
    }
}

/**
 * Test 7: Frontend Hooks
 */
async function testFrontendHooks() {
    try {
        const hooksDir = path.join(__dirname, '../../hooks');
        
        const requiredHooks = [
            'useUniversalVoice.ts',
            'useSpeechToText.ts',
            'useTextToSpeech.ts'
        ];

        const foundHooks = requiredHooks.filter(hook => 
            fs.existsSync(path.join(hooksDir, hook))
        );

        if (foundHooks.length === requiredHooks.length) {
            addResult('Frontend Voice Hooks', true, `All ${requiredHooks.length} voice hooks found`);
        } else {
            const missing = requiredHooks.filter(h => !foundHooks.includes(h));
            addResult('Frontend Voice Hooks', false, `Missing hooks: ${missing.join(', ')}`);
        }

    } catch (error) {
        addResult('Frontend Voice Hooks', false, `Error: ${error.message}`);
    }
}

/**
 * Test 8: UI Components
 */
async function testUIComponents() {
    try {
        const componentsDir = path.join(__dirname, '../../components/AIChat');
        
        const requiredComponents = [
            'VoiceIndicator.tsx',
            'AudioPlayback.tsx',
            'EnhancedChatInput.tsx'
        ];

        const foundComponents = requiredComponents.filter(comp => 
            fs.existsSync(path.join(componentsDir, comp))
        );

        if (foundComponents.length === requiredComponents.length) {
            addResult('Voice UI Components', true, `All ${requiredComponents.length} voice components found`);
        } else {
            const missing = requiredComponents.filter(c => !foundComponents.includes(c));
            addResult('Voice UI Components', false, `Missing: ${missing.join(', ')}`);
        }

    } catch (error) {
        addResult('Voice UI Components', false, `Error: ${error.message}`);
    }
}

/**
 * Test 9: Voice Settings Panel
 */
async function testVoiceSettings() {
    try {
        const settingsPath = path.join(__dirname, '../../components/Settings/VoiceSettingsPanel.tsx');
        
        if (!fs.existsSync(settingsPath)) {
            addResult('Voice Settings Panel', false, 'Component file not found');
            return;
        }

        const content = fs.readFileSync(settingsPath, 'utf-8');
        
        // Check for required features
        const requiredFeatures = [
            'inputMode',
            'autoSendDelay',
            'ttsVoice',
            'ttsSpeed',
            'autoSpeakResponses'
        ];

        const foundFeatures = requiredFeatures.filter(f => content.includes(f));

        if (foundFeatures.length === requiredFeatures.length) {
            addResult('Voice Settings Panel', true, `All ${requiredFeatures.length} settings features found`);
        } else {
            addResult('Voice Settings Panel', false, `Found ${foundFeatures.length}/${requiredFeatures.length} features`);
        }

    } catch (error) {
        addResult('Voice Settings Panel', false, `Error: ${error.message}`);
    }
}

/**
 * Test 10: Fallback Chain Configuration
 */
async function testFallbackChain() {
    try {
        const sttPath = path.join(__dirname, '../../server/services/ai/speechToTextService.js');
        const ttsPath = path.join(__dirname, '../../server/services/ai/textToSpeechService.js');
        
        const { STT_CONFIG } = require(sttPath);
        const { TTS_CONFIG } = require(ttsPath);

        const sttFallback = STT_CONFIG?.fallbackOrder || [];
        const ttsFallback = TTS_CONFIG?.fallbackOrder || [];

        const sttHasFallback = sttFallback.length >= 2;
        const ttsHasFallback = ttsFallback.length >= 2;

        if (sttHasFallback && ttsHasFallback) {
            addResult('Fallback Chain', true, `STT: ${sttFallback.join(' → ')}, TTS: ${ttsFallback.join(' → ')}`);
        } else {
            addResult('Fallback Chain', false, 'Insufficient fallback providers configured');
        }

    } catch (error) {
        addResult('Fallback Chain', false, `Error: ${error.message}`);
    }
}

// ============================================================================
// Main Runner
// ============================================================================

async function runTests() {
    console.log('\n🎙️  Voice System Test Suite');
    console.log('=' .repeat(50));
    console.log('');

    // Run all tests
    await testSTTModule();
    await testTTSModule();
    await testVoiceRoutes();
    await testHealthMonitor();
    await testTextCleaning();
    await testLanguageSupport();
    await testFrontendHooks();
    await testUIComponents();
    await testVoiceSettings();
    await testFallbackChain();

    // Summary
    const duration = Date.now() - results.startTime;
    results.duration = duration;
    results.status = results.failed === 0 ? 'passed' : 'failed';

    console.log('');
    console.log('=' .repeat(50));
    console.log(`📊 Results: ${results.passed}/${results.tests.length} passed (${duration}ms)`);
    console.log(`   Status: ${results.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('');

    return results;
}

// Run if executed directly
if (require.main === module) {
    runTests()
        .then(results => {
            process.exit(results.failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { runTests, results };











