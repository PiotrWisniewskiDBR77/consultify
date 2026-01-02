#!/usr/bin/env node
/**
 * Voice System Auto-Repair Module
 * 
 * Automated repair and recovery for the Universal Voice Conversation System:
 * - API key validation and warning
 * - Provider fallback configuration
 * - Health status reset
 * - Audio cache cleanup
 * - Database settings repair
 * - Default configuration setup
 * 
 * Part of the Enterprise AI System Test Suite
 * 
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Repair Results
// ============================================================================

const repairs = {
    module: 'Voice System',
    repairs: [],
    fixed: 0,
    warnings: 0,
    errors: 0,
    startTime: Date.now()
};

function addRepair(name, status, message) {
    repairs.repairs.push({ name, status, message });
    if (status === 'fixed') repairs.fixed++;
    else if (status === 'warning') repairs.warnings++;
    else if (status === 'error') repairs.errors++;
    
    const icons = { fixed: '🔧', warning: '⚠️', error: '❌', skipped: '⏭️' };
    console.log(`  ${icons[status] || '•'} ${name}: ${message}`);
}

// ============================================================================
// Repair Functions
// ============================================================================

/**
 * Check API Keys
 */
async function checkAPIKeys() {
    try {
        const envPath = path.join(__dirname, '../../.env');
        
        if (!fs.existsSync(envPath)) {
            addRepair('API Key Check', 'error', '.env file not found');
            return;
        }

        const envContent = fs.readFileSync(envPath, 'utf-8');
        
        // Check for OpenAI key (required for Whisper and TTS)
        const hasOpenAI = envContent.includes('OPENAI_API_KEY=') && 
                          !envContent.includes('OPENAI_API_KEY=sk-xxx');
        
        // Check for Deepgram key (optional fallback)
        const hasDeepgram = envContent.includes('DEEPGRAM_API_KEY=');

        if (hasOpenAI) {
            addRepair('OpenAI API Key', 'skipped', 'Key present');
        } else {
            addRepair('OpenAI API Key', 'warning', 'Missing or placeholder - Voice STT/TTS may not work');
        }

        if (hasDeepgram) {
            addRepair('Deepgram API Key', 'skipped', 'Key present (optional)');
        } else {
            addRepair('Deepgram API Key', 'warning', 'Not configured - Fallback STT unavailable');
        }

    } catch (error) {
        addRepair('API Key Check', 'error', error.message);
    }
}

/**
 * Verify Provider Health
 */
async function verifyProviderHealth() {
    try {
        const sttPath = path.join(__dirname, '../../server/services/ai/speechToTextService.js');
        const ttsPath = path.join(__dirname, '../../server/services/ai/textToSpeechService.js');

        if (!fs.existsSync(sttPath) || !fs.existsSync(ttsPath)) {
            addRepair('Provider Health', 'error', 'Service files not found');
            return;
        }

        const { speechToTextService } = require(sttPath);
        const { textToSpeechService } = require(ttsPath);

        // Reset provider health to give them a fresh start
        if (speechToTextService?.resetProviderHealth) {
            speechToTextService.resetProviderHealth();
            addRepair('STT Provider Health', 'fixed', 'Reset all STT providers to healthy');
        }

        if (textToSpeechService?.resetProviderHealth) {
            textToSpeechService.resetProviderHealth();
            addRepair('TTS Provider Health', 'fixed', 'Reset all TTS providers to healthy');
        }

    } catch (error) {
        addRepair('Provider Health', 'error', error.message);
    }
}

/**
 * Ensure Voice Routes Mounted
 */
async function ensureVoiceRoutes() {
    try {
        const indexPath = path.join(__dirname, '../../server/index.js');
        
        if (!fs.existsSync(indexPath)) {
            addRepair('Voice Routes', 'error', 'server/index.js not found');
            return;
        }

        const content = fs.readFileSync(indexPath, 'utf-8');

        if (content.includes("app.use('/api/voice'")) {
            addRepair('Voice Routes', 'skipped', 'Routes already mounted');
        } else {
            addRepair('Voice Routes', 'warning', 'Voice routes not found in server/index.js - manual check needed');
        }

    } catch (error) {
        addRepair('Voice Routes', 'error', error.message);
    }
}

/**
 * Clean Audio Cache
 */
async function cleanAudioCache() {
    try {
        const cacheDir = path.join(__dirname, '../../temp/audio');
        
        if (!fs.existsSync(cacheDir)) {
            addRepair('Audio Cache', 'skipped', 'No cache directory exists');
            return;
        }

        const files = fs.readdirSync(cacheDir);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        let deleted = 0;

        for (const file of files) {
            const filePath = path.join(cacheDir, file);
            const stat = fs.statSync(filePath);
            
            if (now - stat.mtimeMs > maxAge) {
                fs.unlinkSync(filePath);
                deleted++;
            }
        }

        if (deleted > 0) {
            addRepair('Audio Cache', 'fixed', `Cleaned ${deleted} old audio files`);
        } else {
            addRepair('Audio Cache', 'skipped', 'No old files to clean');
        }

    } catch (error) {
        addRepair('Audio Cache', 'error', error.message);
    }
}

/**
 * Verify Database Tables for Voice Settings
 */
async function verifyDatabaseTables() {
    try {
        const dbPath = path.join(__dirname, '../../server/database.js');
        
        if (!fs.existsSync(dbPath)) {
            addRepair('Voice Database', 'warning', 'Database module not found');
            return;
        }

        // Check if user_preferences table exists (used for voice settings)
        const db = require(dbPath);
        
        if (db.promisify) {
            const promiseDb = db.promisify(db);
            
            // Try to create user_preferences table if it doesn't exist
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS user_preferences (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    preference_type TEXT NOT NULL,
                    settings TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, preference_type)
                )
            `;

            try {
                await promiseDb.run(createTableSQL);
                addRepair('Voice Preferences Table', 'fixed', 'Ensured user_preferences table exists');
            } catch (dbError) {
                addRepair('Voice Preferences Table', 'warning', `Could not verify: ${dbError.message}`);
            }
        } else {
            addRepair('Voice Database', 'skipped', 'Database not promisified');
        }

    } catch (error) {
        addRepair('Voice Database', 'error', error.message);
    }
}

/**
 * Verify Frontend Components
 */
async function verifyFrontendComponents() {
    try {
        const componentsToCheck = [
            { path: 'components/AIChat/VoiceIndicator.tsx', name: 'VoiceIndicator' },
            { path: 'components/AIChat/AudioPlayback.tsx', name: 'AudioPlayback' },
            { path: 'components/AIChat/EnhancedChatInput.tsx', name: 'EnhancedChatInput' },
            { path: 'components/Settings/VoiceSettingsPanel.tsx', name: 'VoiceSettingsPanel' }
        ];

        let missing = [];
        
        for (const comp of componentsToCheck) {
            const fullPath = path.join(__dirname, '../../', comp.path);
            if (!fs.existsSync(fullPath)) {
                missing.push(comp.name);
            }
        }

        if (missing.length === 0) {
            addRepair('Frontend Components', 'skipped', 'All voice components present');
        } else {
            addRepair('Frontend Components', 'warning', `Missing: ${missing.join(', ')}`);
        }

    } catch (error) {
        addRepair('Frontend Components', 'error', error.message);
    }
}

/**
 * Verify Hooks
 */
async function verifyHooks() {
    try {
        const hooksToCheck = [
            { path: 'hooks/useUniversalVoice.ts', name: 'useUniversalVoice' },
            { path: 'hooks/useSpeechToText.ts', name: 'useSpeechToText' },
            { path: 'hooks/useTextToSpeech.ts', name: 'useTextToSpeech' }
        ];

        let missing = [];
        
        for (const hook of hooksToCheck) {
            const fullPath = path.join(__dirname, '../../', hook.path);
            if (!fs.existsSync(fullPath)) {
                missing.push(hook.name);
            }
        }

        if (missing.length === 0) {
            addRepair('Voice Hooks', 'skipped', 'All voice hooks present');
        } else {
            addRepair('Voice Hooks', 'warning', `Missing: ${missing.join(', ')}`);
        }

    } catch (error) {
        addRepair('Voice Hooks', 'error', error.message);
    }
}

/**
 * Set Default Voice Settings
 */
async function setDefaultSettings() {
    try {
        const defaultSettings = {
            inputMode: 'click-to-talk',
            autoSendDelay: 1.5,
            ttsVoice: 'nova',
            ttsSpeed: 1.0,
            ttsProvider: 'openai',
            sttProvider: 'whisper',
            autoSpeakResponses: true,
            language: 'pl',
            showLiveTranscript: true
        };

        // Write default settings to a config file for reference
        const configPath = path.join(__dirname, '../../config/voice_defaults.json');
        const configDir = path.dirname(configPath);

        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        fs.writeFileSync(configPath, JSON.stringify(defaultSettings, null, 2));
        addRepair('Default Settings', 'fixed', 'Created/updated config/voice_defaults.json');

    } catch (error) {
        addRepair('Default Settings', 'error', error.message);
    }
}

// ============================================================================
// Main Runner
// ============================================================================

async function runRepairs() {
    console.log('\n🔧 Voice System Auto-Repair');
    console.log('=' .repeat(50));
    console.log('');

    // Run all repairs
    await checkAPIKeys();
    await verifyProviderHealth();
    await ensureVoiceRoutes();
    await cleanAudioCache();
    await verifyDatabaseTables();
    await verifyFrontendComponents();
    await verifyHooks();
    await setDefaultSettings();

    // Summary
    const duration = Date.now() - repairs.startTime;
    repairs.duration = duration;

    console.log('');
    console.log('=' .repeat(50));
    console.log(`📊 Repair Summary (${duration}ms)`);
    console.log(`   🔧 Fixed: ${repairs.fixed}`);
    console.log(`   ⚠️  Warnings: ${repairs.warnings}`);
    console.log(`   ❌ Errors: ${repairs.errors}`);
    console.log('');

    return repairs;
}

// Run if executed directly
if (require.main === module) {
    runRepairs()
        .then(repairs => {
            process.exit(repairs.errors > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('Repair failed:', error);
            process.exit(1);
        });
}

module.exports = { runRepairs, repairs };



