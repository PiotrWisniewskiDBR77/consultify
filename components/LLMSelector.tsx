import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { ChevronDown, Search, Check, Zap, Layers, Sparkles } from 'lucide-react';

interface LLMModel {
    id: string;
    name: string;
    provider: string;
    model_id: string;
}

export const LLMSelector: React.FC = () => {
    const { aiConfig, setAIConfig, currentUser } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);
    const [models, setModels] = useState<LLMModel[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchModels = async () => {
            setLoading(true);
            try {
                const data = await Api.getPublicLLMProviders();
                setModels(data);
            } catch (error) {
                console.error('Failed to fetch models', error);
            } finally {
                setLoading(false);
            }
        };

        if (isOpen && models.length === 0) {
            fetchModels();
        }
    }, [isOpen, models.length]);

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

        // Filter by user preference if defined and not empty
        // If config implies "System" provider handling, we check this. 
        // Note: Models list can come from 'ollama' or 'public' (system). 
        // 'getPublicLLMProviders' implies system models.
        // If user is in 'system' mode configuration effectively, we filter.
        // Actually, LLM Selector shows ALL models normally? Or just the available ones?
        // The requirement is "What user chooses enters their top list".
        // So we should filter by `currentUser.aiConfig.visibleModelIds` if it exists.

        const userVisibleIds = currentUser?.aiConfig?.visibleModelIds;
        const isVisibleByUser = userVisibleIds && userVisibleIds.length > 0
            ? userVisibleIds.includes(m.id)
            : true; // Show all if no preference set

        return matchesSearch && isVisibleByUser;
    });



    const handleModelSelect = (modelId: string) => {
        setAIConfig({ selectedModelId: modelId, autoMode: false });
        setIsOpen(false);
    };

    // If no model is selected, and we have models, select the first one (or system default)
    useEffect(() => {
        if (!aiConfig.selectedModelId && models.length > 0) {
            // Prefer one marked as default if possible, otherwise first
            // Since we don't have is_default property easily exposed here without looking at raw data or guessing, 
            // we'll just pick the first one to ensure "Unknown" isn't shown.
            // Ideally backend returns 'is_default' but 'models' is simplified.
            setAIConfig({ selectedModelId: models[0].id });
        }
    }, [models, aiConfig.selectedModelId, setAIConfig]);

    const getActiveLabel = () => {
        if (aiConfig.autoMode) return 'Auto';
        if (aiConfig.selectedModelId) {
            const currentModel = models.find(m => m.id === aiConfig.selectedModelId);
            return currentModel ? currentModel.name : 'Unknown Model';
        }
        return 'Select Model';
    };

    return (
        <div className="relative z-50" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 ${isOpen ? 'bg-slate-100 dark:bg-white/10 border-brand/50' : 'bg-transparent border-slate-200 dark:border-white/10 hover:border-brand/50 hover:bg-slate-50 dark:hover:bg-white/5'} text-xs font-medium text-navy-900 dark:text-white`}
            >
                <Sparkles size={14} className="text-purple-500" />
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
