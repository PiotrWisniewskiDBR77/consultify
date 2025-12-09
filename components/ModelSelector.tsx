import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { ChevronDown, Cpu, Server, Cloud, Check, Sparkles } from 'lucide-react';

interface LLMProviderOption {
    id: string;
    name: string;
    provider: string;
    model_id: string;
}

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
    openai: <Sparkles size={14} className="text-green-400" />,
    anthropic: <Cpu size={14} className="text-orange-400" />,
    google: <Cloud size={14} className="text-blue-400" />,
    ollama: <Server size={14} className="text-purple-400" />,
    local: <Server size={14} className="text-purple-400" />
};

export const ModelSelector: React.FC = () => {
    const { selectedModelId, setSelectedModelId, language } = useAppStore();
    const [providers, setProviders] = useState<LLMProviderOption[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadProviders();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadProviders = async () => {
        try {
            const data = await Api.getPublicLLMProviders();
            setProviders(data);
            // Auto-select first if none selected
            if (!selectedModelId && data.length > 0) {
                setSelectedModelId(data[0].id);
            }
            setLoading(false);
        } catch (err) {
            console.error('Failed to load providers:', err);
            setLoading(false);
        }
    };

    const selectedProvider = providers.find(p => p.id === selectedModelId);

    const handleSelect = (id: string) => {
        setSelectedModelId(id);
        setIsOpen(false);
    };

    if (loading) {
        return (
            <div className="px-4 py-2 text-xs text-slate-400">
                {language === 'PL' ? 'Ładowanie modeli...' : 'Loading models...'}
            </div>
        );
    }

    if (providers.length === 0) {
        return null; // No public models available
    }

    return (
        <div className="px-4 py-3 border-b border-slate-200 dark:border-white/5" ref={dropdownRef}>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 font-medium">
                {language === 'PL' ? 'Model AI' : 'AI Model'}
            </label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-100 dark:bg-navy-900 hover:bg-slate-200 dark:hover:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm transition-colors"
            >
                <div className="flex items-center gap-2 min-w-0">
                    {selectedProvider && PROVIDER_ICONS[selectedProvider.provider]}
                    <span className="truncate font-medium text-slate-700 dark:text-white">
                        {selectedProvider?.name || (language === 'PL' ? 'Wybierz model' : 'Select model')}
                    </span>
                    {selectedProvider?.provider === 'ollama' && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold uppercase bg-purple-500/20 text-purple-400 rounded">
                            Local
                        </span>
                    )}
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 left-4 right-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden">
                    {providers.map(provider => (
                        <button
                            key={provider.id}
                            onClick={() => handleSelect(provider.id)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${provider.id === selectedModelId ? 'bg-purple-50 dark:bg-purple-500/10' : ''
                                }`}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                {PROVIDER_ICONS[provider.provider]}
                                <span className="truncate text-slate-700 dark:text-white">{provider.name}</span>
                                {(provider.provider === 'ollama' || provider.provider === 'local') && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-semibold uppercase bg-purple-500/20 text-purple-400 rounded flex-shrink-0">
                                        Local
                                    </span>
                                )}
                            </div>
                            {provider.id === selectedModelId && (
                                <Check size={14} className="text-purple-500 flex-shrink-0" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
