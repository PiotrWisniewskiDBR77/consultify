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

    const currentProvider = currentUser?.aiConfig?.provider || 'system';
    const currentModelId = currentUser?.aiConfig?.modelId || '';

    // Composite ID for selection matching: "provider:modelId"
    // Note: For system, models have IDs like "gpt-4". For local, "llama3".
    // We'll use a getter to match.

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
            // 1. System Models
            // Assuming Api.getPublicLLMProviders returns a list of system-enabled models
            const systemProviders = await Api.getPublicLLMProviders();
            // Map standard format to our options
            // systemProviders usually has { id, name, provider: 'openai'|'anthropic' } from valid_llm_providers table
            // In our current logic, 'system' provider uses backend proxy.
            // The backend might route 'system' requests to specific models.
            // Let's assume getPublicLLMProviders returns selectable backend configurations.
            systemProviders.forEach(p => {
                newOptions.push({
                    id: `system:${p.id}`,
                    name: p.name, // e.g. "GPT-4 (System)"
                    provider: 'system',
                    modelId: p.id
                });
            });

            // 2. Local Models (Ollama)
            // Only if configured or we just try default localhost?
            // Let's use config endpoint if available, else default.
            const localEndpoint = currentUser?.aiConfig?.provider === 'ollama' && currentUser?.aiConfig?.endpoint
                ? currentUser.aiConfig.endpoint
                : 'http://localhost:11434';

            try {
                const localModels = await Api.getOllamaModels(localEndpoint);
                if (localModels && Array.isArray(localModels)) {
                    localModels.forEach((m: any) => {
                        newOptions.push({
                            id: `ollama:${m.name}`,
                            name: `${m.name} (Local)`,
                            provider: 'ollama',
                            modelId: m.name
                        });
                    });
                }
            } catch (e) {
                // Ignore local fetch error, maybe not running
            }

            // 3. Custom Configs (Placeholder for current custom setup)
            if (currentUser?.aiConfig?.apiKey && (currentUser.aiConfig.provider === 'openai' || currentUser.aiConfig.provider === 'gemini')) {
                newOptions.push({
                    id: `${currentUser.aiConfig.provider}:custom`,
                    name: `Custom ${currentUser.aiConfig.provider === 'openai' ? 'OpenAI' : 'Gemini'}`,
                    provider: currentUser.aiConfig.provider,
                    modelId: currentUser.aiConfig.modelId || 'default'
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
        // Update user config
        const newConfig = {
            ...currentUser?.aiConfig,
            provider: option.provider,
            modelId: option.modelId
        };

        // If switching to ollama, ensure endpoint exists (preserve from previous or default)
        if (option.provider === 'ollama' && !newConfig.endpoint) {
            newConfig.endpoint = 'http://localhost:11434';
        }

        // If switching to custom, ensure key exists (it should if option was shown)

        setAIConfig(newConfig);
        setIsOpen(false);
    };

    // Determine current display label
    let displayLabel = "Select AI";
    const activeIcon = PROVIDER_ICONS[currentProvider] || PROVIDER_ICONS['system'];

    if (currentProvider === 'system') {
        const found = options.find(o => o.provider === 'system' && o.modelId === currentModelId);
        // If options not loaded yet, use generic
        displayLabel = found ? found.name : "System AI";
    } else if (currentProvider === 'ollama') {
        displayLabel = `${currentModelId || 'Llama'} (Local)`;
    } else {
        displayLabel = `Custom ${currentProvider === 'gemini' ? 'Gemini' : 'OpenAI'}`;
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
                            onClick={() => { setIsOpen(false); setCurrentView('SETTINGS_PROFILE' as any); }} // Assuming shortcut to settings
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
