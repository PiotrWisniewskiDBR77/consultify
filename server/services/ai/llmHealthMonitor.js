/**
 * LLM Health Monitor Service
 * 
 * Monitors all LLM providers, detects issues, and provides detailed diagnostics.
 * Runs periodic health checks and maintains status history.
 */

import https from 'https';
import http from 'http';

// Health status categories
const HealthStatus = {
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    UNHEALTHY: 'unhealthy',
    UNKNOWN: 'unknown'
};

// Error categories for user-friendly messages
const ErrorCategory = {
    AUTH_INVALID: 'auth_invalid',
    AUTH_EXPIRED: 'auth_expired',
    QUOTA_EXCEEDED: 'quota_exceeded',
    RATE_LIMITED: 'rate_limited',
    INSUFFICIENT_FUNDS: 'insufficient_funds',
    MODEL_DEPRECATED: 'model_deprecated',
    MODEL_NOT_FOUND: 'model_not_found',
    SERVICE_DOWN: 'service_down',
    TIMEOUT: 'timeout',
    NETWORK_ERROR: 'network_error',
    UNKNOWN: 'unknown'
};

// User-friendly error messages (Polish)
const ErrorMessages = {
    [ErrorCategory.AUTH_INVALID]: {
        title: 'Nieprawidłowy klucz API',
        description: 'Klucz API jest nieprawidłowy lub został unieważniony.',
        action: 'Wygeneruj nowy klucz API w panelu dostawcy i zaktualizuj go w ustawieniach.'
    },
    [ErrorCategory.AUTH_EXPIRED]: {
        title: 'Klucz API wygasł',
        description: 'Klucz API wygasł i wymaga odnowienia.',
        action: 'Odnów klucz API w panelu dostawcy.'
    },
    [ErrorCategory.QUOTA_EXCEEDED]: {
        title: 'Przekroczono limit',
        description: 'Przekroczono dzienny/miesięczny limit zapytań lub tokenów.',
        action: 'Poczekaj na reset limitu lub uaktualnij plan subskrypcji.'
    },
    [ErrorCategory.RATE_LIMITED]: {
        title: 'Zbyt wiele zapytań',
        description: 'Tymczasowe ograniczenie z powodu zbyt wielu zapytań.',
        action: 'Poczekaj kilka minut i spróbuj ponownie.'
    },
    [ErrorCategory.INSUFFICIENT_FUNDS]: {
        title: 'Brak środków',
        description: 'Konto nie ma wystarczających środków na zapytania.',
        action: 'Doładuj konto w panelu dostawcy.'
    },
    [ErrorCategory.MODEL_DEPRECATED]: {
        title: 'Model wycofany',
        description: 'Ten model został wycofany przez dostawcę.',
        action: 'Zmień model na nowszą wersję w konfiguracji.'
    },
    [ErrorCategory.MODEL_NOT_FOUND]: {
        title: 'Model nie znaleziony',
        description: 'Podany model nie istnieje lub nie jest dostępny.',
        action: 'Sprawdź nazwę modelu i dostępność w dokumentacji dostawcy.'
    },
    [ErrorCategory.SERVICE_DOWN]: {
        title: 'Usługa niedostępna',
        description: 'Serwer dostawcy jest tymczasowo niedostępny.',
        action: 'Sprawdź status usługi na stronie dostawcy.'
    },
    [ErrorCategory.TIMEOUT]: {
        title: 'Przekroczono czas oczekiwania',
        description: 'Serwer nie odpowiedział w wyznaczonym czasie.',
        action: 'Sprawdź połączenie sieciowe lub spróbuj ponownie później.'
    },
    [ErrorCategory.NETWORK_ERROR]: {
        title: 'Błąd sieci',
        description: 'Nie można nawiązać połączenia z serwerem.',
        action: 'Sprawdź połączenie internetowe i ustawienia firewall.'
    },
    [ErrorCategory.UNKNOWN]: {
        title: 'Nieznany błąd',
        description: 'Wystąpił nieoczekiwany błąd.',
        action: 'Sprawdź logi serwera i skontaktuj się z pomocą techniczną.'
    }
};

class LLMHealthMonitor {
    constructor() {
        this.healthCache = new Map();
        this.lastCheckTime = null;
        this.checkInterval = 5 * 60 * 1000; // 5 minutes
        this.listeners = [];
    }

    // Add listener for health changes
    onHealthChange(callback) {
        this.listeners.push(callback);
    }

    // Notify listeners of health changes
    notifyListeners(provider, oldStatus, newStatus) {
        this.listeners.forEach(cb => {
            try {
                cb(provider, oldStatus, newStatus);
            } catch (e) {
                console.error('[LLMHealthMonitor] Listener error:', e);
            }
        });
    }

    // Parse error response to determine category
    categorizeError(provider, statusCode, responseBody) {
        const body = typeof responseBody === 'string' ? responseBody.toLowerCase() : '';
        const parsed = this.tryParseJSON(responseBody);
        const errorMsg = parsed?.error?.message?.toLowerCase() || 
                         parsed?.message?.toLowerCase() || 
                         parsed?.detail?.toLowerCase() || 
                         body;

        // Check for specific error patterns
        if (statusCode === 401 || statusCode === 403) {
            if (errorMsg.includes('invalid') || errorMsg.includes('incorrect')) {
                return ErrorCategory.AUTH_INVALID;
            }
            if (errorMsg.includes('expired')) {
                return ErrorCategory.AUTH_EXPIRED;
            }
            if (errorMsg.includes('leaked') || errorMsg.includes('revoked')) {
                return ErrorCategory.AUTH_INVALID;
            }
            return ErrorCategory.AUTH_INVALID;
        }

        if (statusCode === 429) {
            if (errorMsg.includes('quota') || errorMsg.includes('limit')) {
                return ErrorCategory.QUOTA_EXCEEDED;
            }
            return ErrorCategory.RATE_LIMITED;
        }

        if (statusCode === 402) {
            return ErrorCategory.INSUFFICIENT_FUNDS;
        }

        if (statusCode === 404) {
            if (errorMsg.includes('model')) {
                return ErrorCategory.MODEL_NOT_FOUND;
            }
            return ErrorCategory.SERVICE_DOWN;
        }

        if (statusCode === 400) {
            if (errorMsg.includes('deprecated') || errorMsg.includes('removed') || errorMsg.includes('discontinued')) {
                return ErrorCategory.MODEL_DEPRECATED;
            }
            if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
                return ErrorCategory.MODEL_NOT_FOUND;
            }
        }

        if (statusCode >= 500) {
            return ErrorCategory.SERVICE_DOWN;
        }

        // Check content patterns
        if (errorMsg.includes('insufficient') && (errorMsg.includes('balance') || errorMsg.includes('fund') || errorMsg.includes('credit'))) {
            return ErrorCategory.INSUFFICIENT_FUNDS;
        }

        if (errorMsg.includes('quota') || errorMsg.includes('exceeded')) {
            return ErrorCategory.QUOTA_EXCEEDED;
        }

        if (errorMsg.includes('rate') && errorMsg.includes('limit')) {
            return ErrorCategory.RATE_LIMITED;
        }

        return ErrorCategory.UNKNOWN;
    }

    tryParseJSON(str) {
        try {
            return JSON.parse(str);
        } catch {
            return null;
        }
    }

    // Test a specific provider
    async testProvider(providerConfig) {
        const { provider, api_key, endpoint, model_id, name } = providerConfig;
        const startTime = Date.now();

        if (!api_key || api_key.includes('placeholder')) {
            return {
                provider: name || provider,
                providerId: provider,
                status: HealthStatus.UNHEALTHY,
                errorCategory: ErrorCategory.AUTH_INVALID,
                error: ErrorMessages[ErrorCategory.AUTH_INVALID],
                rawError: 'No API key configured',
                responseTime: 0,
                lastCheck: new Date().toISOString()
            };
        }

        try {
            const result = await this.makeTestRequest(provider, api_key, model_id);
            const responseTime = Date.now() - startTime;

            if (result.success) {
                return {
                    provider: name || provider,
                    providerId: provider,
                    status: responseTime > 5000 ? HealthStatus.DEGRADED : HealthStatus.HEALTHY,
                    errorCategory: null,
                    error: null,
                    rawError: null,
                    responseTime,
                    lastCheck: new Date().toISOString(),
                    modelInfo: result.modelInfo
                };
            } else {
                const category = this.categorizeError(provider, result.statusCode, result.body);
                return {
                    provider: name || provider,
                    providerId: provider,
                    status: HealthStatus.UNHEALTHY,
                    errorCategory: category,
                    error: ErrorMessages[category],
                    rawError: result.body?.substring?.(0, 200) || result.error,
                    statusCode: result.statusCode,
                    responseTime,
                    lastCheck: new Date().toISOString()
                };
            }
        } catch (error) {
            const responseTime = Date.now() - startTime;
            let category = ErrorCategory.UNKNOWN;

            if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
                category = ErrorCategory.TIMEOUT;
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                category = ErrorCategory.NETWORK_ERROR;
            }

            return {
                provider: name || provider,
                providerId: provider,
                status: HealthStatus.UNHEALTHY,
                errorCategory: category,
                error: ErrorMessages[category],
                rawError: error.message,
                responseTime,
                lastCheck: new Date().toISOString()
            };
        }
    }

    // Make test request to provider
    async makeTestRequest(provider, apiKey, modelId) {
        return new Promise((resolve) => {
            let options;
            let data;
            let useHttps = true;

            switch (provider.toLowerCase()) {
                case 'openai':
                    options = {
                        hostname: 'api.openai.com',
                        path: '/v1/chat/completions',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        timeout: 15000
                    };
                    data = JSON.stringify({
                        model: modelId || 'gpt-4o-mini',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 5
                    });
                    break;

                case 'google':
                    options = {
                        hostname: 'generativelanguage.googleapis.com',
                        path: `/v1beta/models/${modelId || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`,
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 15000
                    };
                    data = JSON.stringify({
                        contents: [{ parts: [{ text: 'Hi' }] }]
                    });
                    break;

                case 'deepseek':
                    options = {
                        hostname: 'api.deepseek.com',
                        path: '/chat/completions',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        timeout: 15000
                    };
                    data = JSON.stringify({
                        model: modelId || 'deepseek-chat',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 5
                    });
                    break;

                case 'qwen':
                    options = {
                        hostname: 'dashscope-intl.aliyuncs.com',
                        path: '/compatible-mode/v1/chat/completions',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        timeout: 15000
                    };
                    data = JSON.stringify({
                        model: modelId || 'qwen-turbo',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 5
                    });
                    break;

                case 'zai':
                    options = {
                        hostname: 'open.bigmodel.cn',
                        path: '/api/paas/v4/chat/completions',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        timeout: 15000
                    };
                    data = JSON.stringify({
                        model: modelId || 'glm-4-plus',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 5
                    });
                    break;

                case 'cohere':
                    options = {
                        hostname: 'api.cohere.ai',
                        path: '/v1/chat',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        timeout: 15000
                    };
                    data = JSON.stringify({
                        model: modelId || 'command-r-plus-08-2024',
                        message: 'Hi'
                    });
                    break;

                case 'nvidia':
                    options = {
                        hostname: 'integrate.api.nvidia.com',
                        path: '/v1/chat/completions',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        timeout: 20000
                    };
                    data = JSON.stringify({
                        model: modelId || 'meta/llama-3.1-8b-instruct',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 5
                    });
                    break;

                case 'ollama':
                    const ollamaUrl = new URL(endpoint || 'http://localhost:11434');
                    useHttps = ollamaUrl.protocol === 'https:';
                    options = {
                        hostname: ollamaUrl.hostname,
                        port: ollamaUrl.port || (useHttps ? 443 : 80),
                        path: '/api/tags',
                        method: 'GET',
                        timeout: 5000
                    };
                    data = null;
                    break;

                default:
                    resolve({ success: false, error: 'Unknown provider', statusCode: 0 });
                    return;
            }

            const protocol = useHttps ? https : http;
            const req = protocol.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ success: true, statusCode: res.statusCode, body });
                    } else {
                        resolve({ success: false, statusCode: res.statusCode, body });
                    }
                });
            });

            req.on('error', (e) => resolve({ success: false, error: e.message, statusCode: 0 }));
            req.on('timeout', () => { 
                req.destroy(); 
                resolve({ success: false, error: 'Timeout', statusCode: 0 }); 
            });

            if (data) req.write(data);
            req.end();
        });
    }

    // Check all providers
    async checkAllProviders(providers) {
        const results = [];

        for (const provider of providers) {
            const result = await this.testProvider(provider);
            
            // Check for status change
            const oldStatus = this.healthCache.get(provider.id);
            if (oldStatus && oldStatus.status !== result.status) {
                this.notifyListeners(provider, oldStatus, result);
            }

            this.healthCache.set(provider.id, result);
            results.push({ ...result, id: provider.id });
        }

        this.lastCheckTime = new Date().toISOString();
        return results;
    }

    // Get cached health status
    getCachedStatus(providerId) {
        return this.healthCache.get(providerId);
    }

    // Get all cached statuses
    getAllCachedStatuses() {
        return Array.from(this.healthCache.entries()).map(([id, status]) => ({
            id,
            ...status
        }));
    }

    // Get summary statistics
    getSummary() {
        const statuses = this.getAllCachedStatuses();
        return {
            total: statuses.length,
            healthy: statuses.filter(s => s.status === HealthStatus.HEALTHY).length,
            degraded: statuses.filter(s => s.status === HealthStatus.DEGRADED).length,
            unhealthy: statuses.filter(s => s.status === HealthStatus.UNHEALTHY).length,
            lastCheck: this.lastCheckTime
        };
    }
}

// Singleton instance
const llmHealthMonitor = new LLMHealthMonitor();

export {
llmHealthMonitor,
    LLMHealthMonitor,
    HealthStatus,
    ErrorCategory,
    ErrorMessages
};

export default {
    llmHealthMonitor,
    LLMHealthMonitor,
    HealthStatus,
    ErrorCategory,
    ErrorMessages
};

