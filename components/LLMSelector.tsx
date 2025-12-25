import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { ChevronDown, Search, Check, Zap, Layers, Sparkles } from 'lucide-react';

interface LLMModel {
    id: string;
    name: string;
    provider: string;
    model_id: string;
}

// Status indicator dot component
const StatusDot: React.FC<{ isConnected: boolean; isLoading?: boolean }> = ({ isConnected, isLoading }) => {
    if (isLoading) {
        return (
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" title="Sprawdzanie połączenia..." />
        );
    }
    return (
        <div
            className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
            title={isConnected ? 'Model LLM połączony' : 'Model LLM niedostępny'}
        />
    );
};

export const LLMSelector: React.FC = () => {
    const { aiConfig, setAIConfig, currentUser } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);
    const [models, setModels] = useState<LLMModel[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoadDone, setInitialLoadDone] = useState(false);
    const [llmConnected, setLlmConnected] = useState<boolean | null>(null);
    const [checkingConnection, setCheckingConnection] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // LLM Connection Health Check
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
        } finally {
            setCheckingConnection(false);
        }
    }, [aiConfig.selectedModelId]);

    // Check connection on mount and every 30 seconds
    useEffect(() => {
        checkLLMConnection();
        const interval = setInterval(checkLLMConnection, 30000);
        return () => clearInterval(interval);
    }, [checkLLMConnection]);

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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 ${isOpen ? 'bg-slate-100 dark:bg-white/10 border-brand/50' : 'bg-transparent border-slate-200 dark:border-white/10 hover:border-brand/50 hover:bg-slate-50 dark:hover:bg-white/5'} text-xs font-medium text-navy-900 dark:text-white`}
            >
                <StatusDot isConnected={llmConnected === true} isLoading={checkingConnection || llmConnected === null} />
                <span>{getActiveLabel()}</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 right-0 w-72 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header / Search */}
                    <div className="p-3 border-b border-slate-200 dark:border-white/5 space-y-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search models..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-navy-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="p-2 space-y-1 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-navy-950/30">
                        <div className="flex items-center justify-between px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg group transition-colors">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <Sparkles size={14} className="text-purple-500 dark:text-purple-400" />
                                <span>Auto</span>
                            </div>
                            <button
                                aria-label="Toggle Auto Mode"
                                onClick={() => setAIConfig({ autoMode: !aiConfig.autoMode })}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${aiConfig.autoMode ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${aiConfig.autoMode ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg group transition-colors">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <Zap size={14} className="text-amber-500 dark:text-amber-400" />
                                <span>MAX Mode</span>
                            </div>
                            <button
                                onClick={() => setAIConfig({ maxMode: !aiConfig.maxMode })}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${aiConfig.maxMode ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${aiConfig.maxMode ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg group transition-colors">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <Layers size={14} className="text-blue-500 dark:text-blue-400" />
                                <span>Use Multiple Models</span>
                            </div>
                            <button
                                onClick={() => setAIConfig({ multiModel: !aiConfig.multiModel })}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${aiConfig.multiModel ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${aiConfig.multiModel ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>

                    {/* Model List */}
                    <div className="max-h-60 overflow-y-auto py-2">
                        {loading && <div className="p-4 text-center text-xs text-slate-500">Loading models...</div>}

                        {!loading && filteredModels.length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-500">No models found</div>
                        )}

                        {filteredModels.map(model => (
                            <button
                                key={model.id}
                                onClick={() => handleModelSelect(model.id)}
                                className="w-full text-left px-4 py-2 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 group-hover:bg-purple-500 dark:group-hover:bg-purple-400 transition-colors" />
                                    <div>
                                        <div className={`text-sm font-medium ${aiConfig.selectedModelId === model.id && !aiConfig.autoMode ? 'text-purple-600 dark:text-purple-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                            {model.name}
                                        </div>
                                        <div className="text-[10px] text-slate-500 uppercase">{model.provider}</div>
                                    </div>
                                </div>
                                {aiConfig.selectedModelId === model.id && !aiConfig.autoMode && (
                                    <Check size={14} className="text-purple-600 dark:text-purple-500" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
