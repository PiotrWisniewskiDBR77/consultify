import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { ChevronDown, Search, Check, Zap, Layers, Sparkles, Wifi, WifiOff, RefreshCw, Shield, AlertTriangle } from 'lucide-react';

interface LLMModel {
    id: string;
    name: string;
    provider: string;
    model_id: string;
}

interface ProviderHealth {
    available: boolean;
    latency?: number;
    error?: string;
    lastCheck?: number;
}

interface HealthStatus {
    providers: Record<string, ProviderHealth>;
    circuitBreakers: Array<{ name: string; state: string; failures: number }>;
    lastCheck: number;
}

// Status indicator dot component with enhanced states
const StatusDot: React.FC<{ 
    isConnected: boolean; 
    isLoading?: boolean;
    hasFallback?: boolean;
    latency?: number;
}> = ({ isConnected, isLoading, hasFallback, latency }) => {
    if (isLoading) {
        return (
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" title="Sprawdzanie połączenia..." />
        );
    }
    
    if (isConnected) {
        const latencyText = latency ? ` (${latency}ms)` : '';
        return (
            <div
                className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"
                title={`Model LLM połączony${latencyText}${hasFallback ? ' • Fallback aktywny' : ''}`}
            />
        );
    }
    
    if (hasFallback) {
        return (
            <div
                className="w-2.5 h-2.5 rounded-full bg-amber-500"
                title="Główny model niedostępny - automatyczne przełączenie na zapasowy"
            />
        );
    }
    
    return (
        <div
            className="w-2.5 h-2.5 rounded-full bg-red-500"
            title="Model LLM niedostępny"
        />
    );
};

// Network status indicator
const NetworkStatus: React.FC<{ healthStatus: HealthStatus | null; isChecking: boolean }> = ({ healthStatus, isChecking }) => {
    if (isChecking) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <RefreshCw size={12} className="animate-spin" />
                <span>Sprawdzanie...</span>
            </div>
        );
    }
    
    if (!healthStatus) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <WifiOff size={12} />
                <span>Brak danych</span>
            </div>
        );
    }

    const availableCount = Object.values(healthStatus.providers).filter(p => p.available).length;
    const totalCount = Object.keys(healthStatus.providers).length;
    
    if (availableCount === 0) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertTriangle size={12} />
                <span>Brak dostępnych</span>
            </div>
        );
    }
    
    return (
        <div className="flex items-center gap-1.5 text-xs text-green-500">
            <Wifi size={12} />
            <span>{availableCount}/{totalCount} online</span>
        </div>
    );
};

interface LLMSelectorProps {
    compact?: boolean;
}

export const LLMSelector: React.FC<LLMSelectorProps> = ({ compact = false }) => {
    const { aiConfig, setAIConfig, currentUser } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);
    const [models, setModels] = useState<LLMModel[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoadDone, setInitialLoadDone] = useState(false);
    const [llmConnected, setLlmConnected] = useState<boolean | null>(null);
    const [checkingConnection, setCheckingConnection] = useState(false);
    const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
    const [checkingHealth, setCheckingHealth] = useState(false);
    const [fallbackAvailable, setFallbackAvailable] = useState(false);
    const [latency, setLatency] = useState<number | undefined>(undefined);
    const menuRef = useRef<HTMLDivElement>(null);

    // Comprehensive Health Check - checks all providers
    const checkProvidersHealth = useCallback(async () => {
        setCheckingHealth(true);
        try {
            const result = await Api.checkLLMProvidersHealth();
            setHealthStatus(result);
            
            // Check if current provider is available
            if (aiConfig.selectedModelId && result.providers) {
                const currentModel = models.find(m => m.id === aiConfig.selectedModelId);
                const providerKey = currentModel?.provider;
                if (providerKey && result.providers[providerKey]) {
                    const providerHealth = result.providers[providerKey];
                    setLlmConnected(providerHealth.available);
                    setLatency(providerHealth.latency);
                    
                    // Check if fallback is available when primary fails
                    if (!providerHealth.available) {
                        const availableProviders = Object.entries(result.providers)
                            .filter(([_, h]) => h.available);
                        setFallbackAvailable(availableProviders.length > 0);
                    } else {
                        setFallbackAvailable(false);
                    }
                }
            }
        } catch (err) {
            console.error('Health check failed:', err);
        } finally {
            setCheckingHealth(false);
        }
    }, [aiConfig.selectedModelId, models]);

    // LLM Connection Health Check (single model)
    const checkLLMConnection = useCallback(async () => {
        if (!aiConfig.selectedModelId) {
            setLlmConnected(false);
            return;
        }

        setCheckingConnection(true);
        try {
            const testConfig = {
                provider: 'system',
                model_id: aiConfig.selectedModelId,
            };
            const result = await Api.testLLMConnection(testConfig as any);
            setLlmConnected(result.success);
        } catch (err) {
            console.error('LLM connection check failed:', err);
            setLlmConnected(false);
            
            // If connection failed, check if fallback is available
            if (aiConfig.autoMode) {
                try {
                    const health = await Api.checkLLMProvidersHealth();
                    const availableCount = Object.values(health.providers).filter(p => p.available).length;
                    setFallbackAvailable(availableCount > 0);
                } catch (e) {
                    // Ignore
                }
            }
        } finally {
            setCheckingConnection(false);
        }
    }, [aiConfig.selectedModelId, aiConfig.autoMode]);

    // Check connection on mount and every 30 seconds
    useEffect(() => {
        checkLLMConnection();
        const interval = setInterval(checkLLMConnection, 30000);
        return () => clearInterval(interval);
    }, [checkLLMConnection]);

    // Check full health when dropdown opens
    useEffect(() => {
        if (isOpen) {
            checkProvidersHealth();
        }
    }, [isOpen, checkProvidersHealth]);

    useEffect(() => {
        const fetchModels = async () => {
            setLoading(true);
            try {
                let data = await Api.getPublicLLMProviders();

                // Auto-diagnose: If no providers, trigger self-repair and retry
                if (!data || data.length === 0) {
                    console.log('[LLMSelector] No providers found, running auto-diagnose...');
                    const diagnosis = await Api.diagnoseLLM();
                    console.log('[LLMSelector] Diagnosis result:', diagnosis);

                    // Retry fetching after repair
                    if (diagnosis.status === 'REPAIRED' || diagnosis.repairs.length > 0) {
                        data = await Api.getPublicLLMProviders();
                    }
                }

                setModels(data || []);
            } catch (error) {
                console.error('Failed to fetch models:', error);
                // Try auto-diagnose on error too
                try {
                    await Api.diagnoseLLM();
                } catch (diagError) {
                    console.error('Diagnose also failed:', diagError);
                }
            } finally {
                setLoading(false);
            }
        };

        // Always fetch on mount, and also when opening dropdown if empty
        if (!initialLoadDone || (isOpen && models.length === 0)) {
            fetchModels();
            setInitialLoadDone(true);
        }
    }, [isOpen, models.length, initialLoadDone]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredModels = models.filter(m => {
        const matchesSearch = (m.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (m.provider?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        const userVisibleIds = currentUser?.aiConfig?.visibleModelIds;
        const isVisibleByUser = userVisibleIds && userVisibleIds.length > 0
            ? userVisibleIds.includes(m.id)
            : true;
        return matchesSearch && isVisibleByUser;
    });

    const handleModelSelect = (modelId: string) => {
        setAIConfig({ selectedModelId: modelId, autoMode: false });
        setIsOpen(false);
        // Re-check connection after model change
        setTimeout(checkLLMConnection, 500);
    };

    useEffect(() => {
        if (!aiConfig.selectedModelId && models.length > 0) {
            setAIConfig({ selectedModelId: models[0].id });
        }
    }, [models, aiConfig.selectedModelId, setAIConfig]);

    const getActiveLabel = () => {
        if (aiConfig.autoMode) return 'Auto';
        if (loading && models.length === 0) return 'Loading...';
        if (aiConfig.selectedModelId) {
            const currentModel = models.find(m => m.id === aiConfig.selectedModelId);
            if (currentModel) return currentModel.name;
            // If model not found but models are loading/empty, show loading
            if (models.length === 0) return 'Loading...';
            return 'Select Model';
        }
        return models.length === 0 ? 'Loading...' : 'Select Model';
    };

    return (
        <div className="relative z-50" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} rounded-lg border transition-all duration-200 ${isOpen ? 'bg-slate-100 dark:bg-white/10 border-brand/50' : 'bg-transparent border-slate-200 dark:border-white/10 hover:border-brand/50 hover:bg-slate-50 dark:hover:bg-white/5'} text-xs font-medium text-navy-900 dark:text-white`}
            >
                <StatusDot 
                    isConnected={llmConnected === true} 
                    isLoading={checkingConnection || llmConnected === null}
                    hasFallback={fallbackAvailable && aiConfig.autoMode}
                    latency={latency}
                />
                {!compact && <span>{getActiveLabel()}</span>}
                {compact && <span className="max-w-[60px] truncate">{getActiveLabel()}</span>}
                {aiConfig.autoMode && !compact && (
                    <Shield size={10} className="text-green-500" title="Auto-fallback aktywny" />
                )}
                <ChevronDown size={compact ? 10 : 12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 right-0 w-80 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header / Search */}
                    <div className="p-3 border-b border-slate-200 dark:border-white/5 space-y-3">
                        {/* Network Status */}
                        <div className="flex items-center justify-between">
                            <NetworkStatus healthStatus={healthStatus} isChecking={checkingHealth} />
                            <button
                                onClick={() => checkProvidersHealth()}
                                disabled={checkingHealth}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                                title="Odśwież status"
                            >
                                <RefreshCw size={12} className={checkingHealth ? 'animate-spin' : ''} />
                            </button>
                        </div>
                        
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Szukaj modeli..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-navy-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Mode Toggles */}
                    <div className="p-2 space-y-1 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-navy-950/30">
                        {/* Auto Mode - z automatycznym fallbackiem */}
                        <div className="flex items-center justify-between px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg group transition-colors">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <Sparkles size={14} className="text-purple-500 dark:text-purple-400" />
                                <div>
                                    <span>Auto</span>
                                    <p className="text-[10px] text-slate-400">Automatyczne przełączanie dostawców</p>
                                </div>
                            </div>
                            <button
                                aria-label="Toggle Auto Mode"
                                onClick={() => setAIConfig({ autoMode: !aiConfig.autoMode })}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${aiConfig.autoMode ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${aiConfig.autoMode ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* MAX Mode - Deep Reasoning */}
                        <div className="flex items-center justify-between px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg group transition-colors">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <Zap size={14} className="text-amber-500 dark:text-amber-400" />
                                <div>
                                    <span>MAX Mode</span>
                                    <p className="text-[10px] text-slate-400">Głębokie rozumowanie (o1)</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setAIConfig({ maxMode: !aiConfig.maxMode })}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${aiConfig.maxMode ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${aiConfig.maxMode ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Multi-Model - Use Multiple */}
                        <div className="flex items-center justify-between px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg group transition-colors">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <Layers size={14} className="text-blue-500 dark:text-blue-400" />
                                <div>
                                    <span>Multi-Model</span>
                                    <p className="text-[10px] text-slate-400">Łączenie wielu modeli</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setAIConfig({ multiModel: !aiConfig.multiModel })}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${aiConfig.multiModel ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${aiConfig.multiModel ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Network/Fallback Status Indicator */}
                        {aiConfig.autoMode && (
                            <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
                                    <Shield size={12} />
                                    <span>Automatyczne przełączanie dostawców włączone</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Model List */}
                    <div className="max-h-60 overflow-y-auto py-2">
                        {loading && <div className="p-4 text-center text-xs text-slate-500">Ładowanie modeli...</div>}

                        {!loading && filteredModels.length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-500">Nie znaleziono modeli</div>
                        )}

                        {filteredModels.map(model => {
                            // Get provider health status
                            const providerHealth = healthStatus?.providers?.[model.provider];
                            const isProviderOnline = providerHealth?.available ?? true;
                            const providerLatency = providerHealth?.latency;
                            
                            return (
                                <button
                                    key={model.id}
                                    onClick={() => handleModelSelect(model.id)}
                                    className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group ${!isProviderOnline ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full transition-colors ${
                                            !isProviderOnline 
                                                ? 'bg-red-400' 
                                                : aiConfig.selectedModelId === model.id 
                                                    ? 'bg-purple-500' 
                                                    : 'bg-slate-400 dark:bg-slate-500 group-hover:bg-purple-500 dark:group-hover:bg-purple-400'
                                        }`} />
                                        <div>
                                            <div className={`text-sm font-medium ${aiConfig.selectedModelId === model.id && !aiConfig.autoMode ? 'text-purple-600 dark:text-purple-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                                {model.name}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-500 uppercase">{model.provider}</span>
                                                {providerLatency && (
                                                    <span className="text-[10px] text-slate-400">{providerLatency}ms</span>
                                                )}
                                                {!isProviderOnline && (
                                                    <span className="text-[10px] text-red-500">offline</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!isProviderOnline && aiConfig.autoMode && (
                                            <span className="text-[9px] text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                                                fallback
                                            </span>
                                        )}
                                        {aiConfig.selectedModelId === model.id && !aiConfig.autoMode && (
                                            <Check size={14} className="text-purple-600 dark:text-purple-500" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
