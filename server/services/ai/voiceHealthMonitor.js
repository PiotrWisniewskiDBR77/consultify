/**
 * Voice Health Monitor
 * 
 * Monitors voice system health and provides:
 * - Real-time provider health tracking
 * - Automatic failover management
 * - Performance metrics collection
 * - Self-healing capabilities
 * - Alert system for critical failures
 * 
 * Part of the Universal Voice Conversation System
 * 
 * @version 1.0.0
 */

const { speechToTextService } = require('./speechToTextService');
const { textToSpeechService } = require('./textToSpeechService');

// ============================================================================
// Configuration
// ============================================================================

const HEALTH_CONFIG = {
    checkIntervalMs: 60000, // 1 minute
    alertThresholds: {
        latencyWarningMs: 2000,
        latencyCriticalMs: 5000,
        errorRateWarning: 0.1, // 10%
        errorRateCritical: 0.3 // 30%
    },
    metricsRetentionHours: 24,
    autoRepairEnabled: true
};

// ============================================================================
// Metrics Storage
// ============================================================================

const metrics = {
    stt: {
        requests: 0,
        successes: 0,
        failures: 0,
        totalLatencyMs: 0,
        lastCheck: null,
        history: [] // Last 24h of measurements
    },
    tts: {
        requests: 0,
        successes: 0,
        failures: 0,
        totalLatencyMs: 0,
        lastCheck: null,
        history: []
    }
};

// ============================================================================
// Voice Health Monitor Class
// ============================================================================

class VoiceHealthMonitor {
    constructor() {
        this.config = HEALTH_CONFIG;
        this.isRunning = false;
        this.intervalId = null;
        this.alerts = [];
        this.listeners = [];
    }

    /**
     * Start health monitoring
     */
    start() {
        if (this.isRunning) {
            console.log('[VoiceHealth] Monitor already running');
            return;
        }

        console.log('[VoiceHealth] Starting health monitor');
        this.isRunning = true;

        // Run initial check
        this._runHealthCheck();

        // Schedule periodic checks
        this.intervalId = setInterval(() => {
            this._runHealthCheck();
        }, this.config.checkIntervalMs);
    }

    /**
     * Stop health monitoring
     */
    stop() {
        if (!this.isRunning) return;

        console.log('[VoiceHealth] Stopping health monitor');
        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Run a health check cycle
     */
    async _runHealthCheck() {
        const timestamp = new Date().toISOString();
        console.log(`[VoiceHealth] Running health check at ${timestamp}`);

        try {
            // Check STT providers
            const sttHealth = await this._checkSTTHealth();
            
            // Check TTS providers
            const ttsHealth = await this._checkTTSHealth();

            // Analyze and generate alerts
            this._analyzeHealth(sttHealth, ttsHealth);

            // Auto-repair if needed
            if (this.config.autoRepairEnabled) {
                await this._attemptAutoRepair(sttHealth, ttsHealth);
            }

            // Notify listeners
            this._notifyListeners({
                timestamp,
                stt: sttHealth,
                tts: ttsHealth,
                alerts: this.alerts.slice(-10)
            });

        } catch (error) {
            console.error('[VoiceHealth] Health check failed:', error);
            this._addAlert('error', 'Health check failed', error.message);
        }
    }

    /**
     * Check STT provider health
     */
    async _checkSTTHealth() {
        const status = speechToTextService.getHealthStatus();
        
        const results = {
            healthy: status.healthyProviders.length > 0,
            primaryProvider: status.primaryProvider,
            providers: {}
        };

        // Test each provider
        for (const provider of status.providers) {
            try {
                const testResult = await speechToTextService.testProvider(provider.id);
                results.providers[provider.id] = {
                    name: provider.name,
                    healthy: testResult.success,
                    latencyMs: testResult.latencyMs || null,
                    error: testResult.error || null,
                    errorCount: provider.errorCount
                };

                // Update metrics
                metrics.stt.requests++;
                if (testResult.success) {
                    metrics.stt.successes++;
                    metrics.stt.totalLatencyMs += testResult.latencyMs || 0;
                } else {
                    metrics.stt.failures++;
                }
            } catch (error) {
                results.providers[provider.id] = {
                    name: provider.name,
                    healthy: false,
                    error: error.message
                };
                metrics.stt.failures++;
            }
        }

        metrics.stt.lastCheck = new Date().toISOString();
        this._recordHistory('stt', results);

        return results;
    }

    /**
     * Check TTS provider health
     */
    async _checkTTSHealth() {
        const status = textToSpeechService.getHealthStatus();
        
        const results = {
            healthy: status.healthyProviders.length > 0,
            primaryProvider: status.primaryProvider,
            providers: {}
        };

        // Test each provider
        for (const provider of status.providers) {
            try {
                const testResult = await textToSpeechService.testProvider(provider.id);
                results.providers[provider.id] = {
                    name: provider.name,
                    healthy: testResult.success,
                    latencyMs: testResult.latencyMs || null,
                    error: testResult.error || null,
                    errorCount: provider.errorCount
                };

                // Update metrics
                metrics.tts.requests++;
                if (testResult.success) {
                    metrics.tts.successes++;
                    metrics.tts.totalLatencyMs += testResult.latencyMs || 0;
                } else {
                    metrics.tts.failures++;
                }
            } catch (error) {
                results.providers[provider.id] = {
                    name: provider.name,
                    healthy: false,
                    error: error.message
                };
                metrics.tts.failures++;
            }
        }

        metrics.tts.lastCheck = new Date().toISOString();
        this._recordHistory('tts', results);

        return results;
    }

    /**
     * Analyze health and generate alerts
     */
    _analyzeHealth(sttHealth, ttsHealth) {
        // Check if any service is completely down
        if (!sttHealth.healthy) {
            this._addAlert('critical', 'STT Service Down', 'No healthy STT providers available');
        }

        if (!ttsHealth.healthy) {
            this._addAlert('critical', 'TTS Service Down', 'No healthy TTS providers available');
        }

        // Check latency warnings
        Object.entries(sttHealth.providers).forEach(([id, provider]) => {
            if (provider.latencyMs > this.config.alertThresholds.latencyCriticalMs) {
                this._addAlert('warning', 'High STT Latency', `${provider.name}: ${provider.latencyMs}ms`);
            }
        });

        Object.entries(ttsHealth.providers).forEach(([id, provider]) => {
            if (provider.latencyMs > this.config.alertThresholds.latencyCriticalMs) {
                this._addAlert('warning', 'High TTS Latency', `${provider.name}: ${provider.latencyMs}ms`);
            }
        });

        // Check error rates
        const sttErrorRate = metrics.stt.requests > 0 
            ? metrics.stt.failures / metrics.stt.requests 
            : 0;
        const ttsErrorRate = metrics.tts.requests > 0 
            ? metrics.tts.failures / metrics.tts.requests 
            : 0;

        if (sttErrorRate > this.config.alertThresholds.errorRateCritical) {
            this._addAlert('critical', 'High STT Error Rate', `${(sttErrorRate * 100).toFixed(1)}% failures`);
        } else if (sttErrorRate > this.config.alertThresholds.errorRateWarning) {
            this._addAlert('warning', 'Elevated STT Error Rate', `${(sttErrorRate * 100).toFixed(1)}% failures`);
        }

        if (ttsErrorRate > this.config.alertThresholds.errorRateCritical) {
            this._addAlert('critical', 'High TTS Error Rate', `${(ttsErrorRate * 100).toFixed(1)}% failures`);
        } else if (ttsErrorRate > this.config.alertThresholds.errorRateWarning) {
            this._addAlert('warning', 'Elevated TTS Error Rate', `${(ttsErrorRate * 100).toFixed(1)}% failures`);
        }
    }

    /**
     * Attempt automatic repair of unhealthy providers
     */
    async _attemptAutoRepair(sttHealth, ttsHealth) {
        // Reset providers that have been down for a while
        Object.entries(sttHealth.providers).forEach(([id, provider]) => {
            if (!provider.healthy && provider.errorCount >= 3) {
                console.log(`[VoiceHealth] Auto-resetting STT provider: ${id}`);
                speechToTextService.resetProviderHealth(id);
                this._addAlert('info', 'Auto-Repair', `Reset STT provider: ${provider.name}`);
            }
        });

        Object.entries(ttsHealth.providers).forEach(([id, provider]) => {
            if (!provider.healthy && provider.errorCount >= 3) {
                console.log(`[VoiceHealth] Auto-resetting TTS provider: ${id}`);
                textToSpeechService.resetProviderHealth(id);
                this._addAlert('info', 'Auto-Repair', `Reset TTS provider: ${provider.name}`);
            }
        });
    }

    /**
     * Record history for metrics
     */
    _recordHistory(service, results) {
        const entry = {
            timestamp: new Date().toISOString(),
            healthy: results.healthy,
            primaryProvider: results.primaryProvider,
            providerCount: Object.keys(results.providers).length,
            healthyCount: Object.values(results.providers).filter(p => p.healthy).length
        };

        metrics[service].history.push(entry);

        // Trim history to retention period
        const cutoff = Date.now() - (this.config.metricsRetentionHours * 60 * 60 * 1000);
        metrics[service].history = metrics[service].history.filter(
            h => new Date(h.timestamp).getTime() > cutoff
        );
    }

    /**
     * Add an alert
     */
    _addAlert(level, title, message) {
        const alert = {
            id: `alert-${Date.now()}`,
            timestamp: new Date().toISOString(),
            level, // 'info', 'warning', 'critical', 'error'
            title,
            message
        };

        this.alerts.push(alert);
        
        // Keep only last 100 alerts
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-100);
        }

        console.log(`[VoiceHealth] Alert [${level}]: ${title} - ${message}`);
    }

    /**
     * Register a listener for health updates
     */
    addListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /**
     * Notify all listeners
     */
    _notifyListeners(data) {
        this.listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('[VoiceHealth] Listener error:', error);
            }
        });
    }

    /**
     * Get current health status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            stt: {
                ...speechToTextService.getHealthStatus(),
                metrics: {
                    requests: metrics.stt.requests,
                    successes: metrics.stt.successes,
                    failures: metrics.stt.failures,
                    avgLatencyMs: metrics.stt.successes > 0 
                        ? Math.round(metrics.stt.totalLatencyMs / metrics.stt.successes) 
                        : null,
                    lastCheck: metrics.stt.lastCheck
                }
            },
            tts: {
                ...textToSpeechService.getHealthStatus(),
                metrics: {
                    requests: metrics.tts.requests,
                    successes: metrics.tts.successes,
                    failures: metrics.tts.failures,
                    avgLatencyMs: metrics.tts.successes > 0 
                        ? Math.round(metrics.tts.totalLatencyMs / metrics.tts.successes) 
                        : null,
                    lastCheck: metrics.tts.lastCheck
                }
            },
            alerts: this.alerts.slice(-10),
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * Get historical metrics
     */
    getHistory(service = null, hoursBack = 24) {
        const cutoff = Date.now() - (hoursBack * 60 * 60 * 1000);
        
        if (service) {
            return metrics[service]?.history.filter(
                h => new Date(h.timestamp).getTime() > cutoff
            ) || [];
        }

        return {
            stt: metrics.stt.history.filter(h => new Date(h.timestamp).getTime() > cutoff),
            tts: metrics.tts.history.filter(h => new Date(h.timestamp).getTime() > cutoff)
        };
    }

    /**
     * Clear alerts
     */
    clearAlerts() {
        this.alerts = [];
    }

    /**
     * Reset all metrics
     */
    resetMetrics() {
        metrics.stt = {
            requests: 0,
            successes: 0,
            failures: 0,
            totalLatencyMs: 0,
            lastCheck: null,
            history: []
        };
        metrics.tts = {
            requests: 0,
            successes: 0,
            failures: 0,
            totalLatencyMs: 0,
            lastCheck: null,
            history: []
        };
    }

    /**
     * Force a health check now
     */
    async checkNow() {
        await this._runHealthCheck();
        return this.getStatus();
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

const voiceHealthMonitor = new VoiceHealthMonitor();

module.exports = {
    VoiceHealthMonitor,
    voiceHealthMonitor
};

