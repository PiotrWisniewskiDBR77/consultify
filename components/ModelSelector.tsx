
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { ChevronDown, Check, Settings } from 'lucide-react';
import { AIProviderType } from '../types';

interface ModelOption {
    id: string; // provider:model_id
    name: string;
    provider: AIProviderType; // 'system' | 'ollama' | 'openai' | 'gemini'
    modelId: string;
}

// Status indicator dot component - similar to SystemHealth database indicator
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

export const ModelSelector: React.FC = () => {
    const { currentUser, setCurrentView } = useAppStore();
    const [options, setOptions] = useState<ModelOption[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [llmConnected, setLlmConnected] = useState<boolean | null>(null);
    const [checkingConnection, setCheckingConnection] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Current State
    // We treat 'provider' and 'modelId' as the source of truth for "Active" model for this session.
    // NOTE: If a user selects a Private model, we set provider=privateModel.provider and modelId=privateModel.modelId 
    // BUT we need to know WHICH private key to use. 
    // The current backend/frontend logic for "chat" simply looks at currentUser.aiConfig.
    // If we select a private model, we probably need to temporarily inject its key/endpoint into the active config structure?
    // OR, better, we store the *ID* of the selected private model if it is one?
    // Complex.
    // SIMPLE APPROACH: 
    // The `currentUser.aiConfig` stores the active configuration.
    // When we select a System model, we set provider=system, modelId=ID.
    // When we select a Private model, we set provider=OPTION.provider (e.g. openai), modelId=OPTION.modelId, AND we also need to set apiKey/endpoint from that private model into the active state.

    const currentProvider = currentUser?.aiConfig?.provider || 'system';
    const currentModelId = currentUser?.aiConfig?.modelId || '';

    const loadOptions = React.useCallback(async () => {
        setLoading(true);
        const newOptions: ModelOption[] = [];

        try {
            // 1. System Models (Filtered by User Prefs)
            const systemProviders = await Api.getPublicLLMProviders();
            const visibleIds = currentUser?.aiConfig?.visibleModelIds;

            const isVisible = (id: string) => !visibleIds || visibleIds.includes(id);

            systemProviders.forEach(p => {
                if (isVisible(p.id)) {
                    newOptions.push({
                        id: `system:${p.id}`,
                        name: p.name,
                        provider: 'system',
                        modelId: p.id
                    });
                }
            });

            if (currentUser?.aiConfig?.privateModels) {

                currentUser.aiConfig.privateModels.forEach((pm: any) => {
                    newOptions.push({
                        id: pm.id, // e.g. private-123
                        name: `${pm.name} (Private)`,
                        provider: pm.provider,
                        modelId: pm.modelId,
                        // @ts-expect-error: Store extra data for internal logic
                        sourceData: pm
                    });
                });
            }

            setOptions(newOptions);
        } catch (err) {
            console.error('Failed to load model options', err);
        } finally {
            setLoading(false);
        }
    }, [currentUser?.aiConfig?.visibleModelIds, currentUser?.aiConfig?.privateModels]);

    // LLM Connection Health Check
    const checkLLMConnection = useCallback(async () => {
        if (!currentModelId) {
            setLlmConnected(false);
            return;
        }

        setCheckingConnection(true);
        try {
            // For system providers, just check if the provider exists in the public list
            if (currentProvider === 'system') {
                const systemProviders = await Api.getPublicLLMProviders();
                const providerExists = systemProviders.some((p: any) => p.id === currentModelId);
                setLlmConnected(providerExists && systemProviders.length > 0);
            } else {
                // For private models, test the actual connection
                const testConfig = {
                    provider: currentProvider,
                    model_id: currentModelId,
                    endpoint: currentUser?.aiConfig?.endpoint,
                    api_key: currentUser?.aiConfig?.apiKey,
                };
                const result = await Api.testLLMConnection(testConfig as any);
                setLlmConnected(result.success);
            }
        } catch (err) {
            console.error('LLM connection check failed:', err);
            setLlmConnected(false);
        } finally {
            setCheckingConnection(false);
        }
    }, [currentProvider, currentModelId, currentUser?.aiConfig?.endpoint, currentUser?.aiConfig?.apiKey]);

    // Check connection on mount and every 30 seconds
    useEffect(() => {
        checkLLMConnection();
        const interval = setInterval(checkLLMConnection, 30000);
        return () => clearInterval(interval);
    }, [checkLLMConnection]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadOptions();
        }
    }, [isOpen, loadOptions]);

    const handleSelect = (option: ModelOption) => {
        // Prepare new config
        const newConfig = {
            ...currentUser?.aiConfig,
            provider: option.provider,
            modelId: option.modelId,
        };

        // If it's a Private Model, we must inject its credentials into active config
        // (This is how the rest of the app "knows" what key to use for the current session)
        if ((option as unknown as { sourceData?: unknown }).sourceData) {

            const pm: any = (option as unknown as { sourceData: any }).sourceData;
            newConfig.apiKey = pm.apiKey;
            newConfig.endpoint = pm.endpoint;
        } else if (option.provider === 'system') {
            // Clear custom credentials to ensure we use system proxy
            newConfig.apiKey = undefined;
            newConfig.endpoint = undefined;
        }

        // Update CURRENT USER aiConfig, not the global store aiConfig (which is for UI toggles)
        // We need a way to update currentUser.
        // Assuming we can use setCurrentUser but merging the new config.
        if (currentUser) {
            const updatedUser = {
                ...currentUser,
                aiConfig: newConfig
            };
            // We should also persist this to the backend if needed?
            // For now, let's update local state.
            // Note: useAppStore doesn't expose a dedicated 'updateUserAIConfig' action, so we use setCurrentUser.
            // AND we probably need to call the API to persist this preference?
            // "Types Check" error was strictly about type mismatch.
            // BUT setAIConfig in store expects { autoMode, ... }
            // So we MUST NOT call setAIConfig(newConfig) where newConfig is AIProviderConfig.

            // We need to access the store via useAppStore.getState() or use the hook actions.
            // Let's use the setter from the hook.
            const { setCurrentUser } = useAppStore.getState();
            setCurrentUser(updatedUser);

            // Optional: Persist to backend
            // Api.updateUser(currentUser.id, { aiConfig: newConfig }).catch(console.error);
        }

        setIsOpen(false);
    };

    // Determine display label
    let displayLabel = "Select AI";

    // Find in options if possible (but options might not be loaded if menu closed)
    // We can try to look at current config to guess logic
    if (currentUser?.aiConfig?.privateModels) {
        // Check if current matches a private model
        const privateMatch = currentUser.aiConfig.privateModels.find((pm: { provider: string; modelId: string; apiKey?: string; name: string; }) =>
            pm.provider === currentProvider &&
            pm.modelId === currentModelId &&
            (pm.apiKey === currentUser.aiConfig?.apiKey) // Loose match
        );
        if (privateMatch) {
            displayLabel = `${privateMatch.name}`;
        }
    }

    if (displayLabel === "Select AI") {
        if (currentProvider === 'system') {
            displayLabel = `System: ${currentModelId || 'Default'}`;
            // Try to find nice name from system options if loaded or we can cache? 
            // For now, if options are empty, just show ID. If options user opens menu, it re-renders.
            const found = options.find(o => o.provider === 'system' && o.modelId === currentModelId);
            if (found) displayLabel = found.name;
        } else {
            displayLabel = `${currentModelId} (${currentProvider})`;
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-navy-900 hover:bg-slate-200 dark:hover:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-full text-sm transition-colors min-w-[160px]"
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <StatusDot isConnected={llmConnected === true} isLoading={checkingConnection || llmConnected === null} />
                    <span className="truncate font-medium text-slate-700 dark:text-white text-xs">
                        {displayLabel}
                    </span>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                    <div className="p-2 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-navy-950 flex justify-between items-center">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                            Active Provider
                        </div>
                        <button

                            onClick={() => { setIsOpen(false); setCurrentView('SETTINGS_PROFILE' as any); }}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded text-slate-400"
                            title="Configure Keys"
                        >
                            <Settings size={12} />
                        </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-center text-xs text-slate-400">Loading options...</div>
                        ) : options.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">
                                No models found. Check Settings.
                            </div>
                        ) : (
                            options.map(opt => {
                                // Match logic:
                                // System: provider=system, modelId=same
                                // Private: provider=same, modelId=same
                                const isSelected = opt.provider === currentProvider && opt.modelId === currentModelId;

                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => handleSelect(opt)}
                                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${isSelected ? 'bg-purple-50 dark:bg-purple-500/10' : ''}`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-green-500' : 'bg-slate-400'}`} />
                                            <div className="flex flex-col items-start min-w-0">
                                                <span className={`truncate font-medium text-xs ${isSelected ? 'text-purple-600 dark:text-purple-300' : 'text-slate-700 dark:text-white'}`}>
                                                    {opt.name}
                                                </span>
                                            </div>
                                        </div>
                                        {isSelected && <Check size={14} className="text-purple-500 flex-shrink-0" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
