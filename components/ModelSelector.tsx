import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { ChevronDown, Cpu, Server, Cloud, Check, Sparkles, Settings } from 'lucide-react';
import { AIProviderType } from '../types';

interface ModelOption {
    id: string; // provider:model_id
    name: string;
    provider: AIProviderType; // 'system' | 'ollama' | 'openai' | 'gemini'
    modelId: string;
}

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
    openai: <Sparkles size={14} className="text-green-400" />,
    gemini: <Cloud size={14} className="text-blue-400" />,
    system: <Cpu size={14} className="text-orange-400" />,
    ollama: <Server size={14} className="text-purple-400" />
};

export const ModelSelector: React.FC = () => {
    const { currentUser, setAIConfig, language, setCurrentView } = useAppStore();
    const [options, setOptions] = useState<ModelOption[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
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

    useEffect(() => {
        if (isOpen) {
            loadOptions();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadOptions = async () => {
        setLoading(true);
        const newOptions: ModelOption[] = [];

        try {
            // 1. System Models (Filtered by User Prefs)
            const systemProviders = await Api.getPublicLLMProviders();
            const visibleIds = currentUser?.aiConfig?.visibleModelIds;

            // If user has never configured visibility, show ALL or NONE? 
            // Implementation Plan said: "default to all". 
            // AIConfigSettings logic also defaults to all if undefined.
            const isVisible = (id: string) => !visibleIds || visibleIds.includes(id);

            systemProviders.forEach(p => {
                if (isVisible(p.id)) {
                    newOptions.push({
                        id: `system:${p.id}`,
                        name: p.name,
                        provider: 'system',
                        modelId: p.id // The ID in our DB
                    });
                }
            });

            // 2. Private Models (From User Config)
            if (currentUser?.aiConfig?.privateModels) {
                currentUser.aiConfig.privateModels.forEach(pm => {
                    newOptions.push({
                        id: pm.id, // e.g. private-123
                        name: `${pm.name} (Private)`,
                        provider: pm.provider,
                        modelId: pm.modelId,
                        // We store extra data to help selection handler
                        // @ts-ignore
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
    };

    const handleSelect = (option: ModelOption) => {
        // Prepare new config
        const newConfig = {
            ...currentUser?.aiConfig,
            provider: option.provider,
            modelId: option.modelId,
        };

        // If it's a Private Model, we must inject its credentials into active config
        // (This is how the rest of the app "knows" what key to use for the current session)
        if ((option as any).sourceData) {
            const pm: any = (option as any).sourceData;
            newConfig.apiKey = pm.apiKey;
            newConfig.endpoint = pm.endpoint;
        } else if (option.provider === 'system') {
            // Clear custom credentials to ensure we use system proxy
            newConfig.apiKey = undefined;
            newConfig.endpoint = undefined;
        }

        setAIConfig(newConfig);
        setIsOpen(false);
    };

    // Determine display label
    let displayLabel = "Select AI";
    const activeIcon = PROVIDER_ICONS[currentProvider] || PROVIDER_ICONS['system'];

    // Find in options if possible (but options might not be loaded if menu closed)
    // We can try to look at current config to guess logic
    if (currentUser?.aiConfig?.privateModels) {
        // Check if current matches a private model
        const privateMatch = currentUser.aiConfig.privateModels.find(pm =>
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
                    {activeIcon}
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
                            {language === 'PL' ? 'Wybierz Dostawcę' : 'Active Provider'}
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
                                            {PROVIDER_ICONS[opt.provider]}
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
