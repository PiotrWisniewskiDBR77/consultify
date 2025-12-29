/**
 * PromptManagementUI Component
 * 
 * Super Admin panel for managing AI system prompts with version history and testing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    FileText,
    Plus,
    Edit3,
    Trash2,
    History,
    Play,
    Save,
    X,
    Search,
    RefreshCw,
    Check,
    AlertCircle,
    ChevronDown,
    Copy,
    RotateCcw
} from 'lucide-react';
import { Button } from '../Button';
import api from '../../services/api';

interface SystemPrompt {
    id: string;
    name: string;
    category: string;
    description?: string;
    template: string;
    variables: string[];
    is_active: boolean;
    version: number;
    created_at: string;
    updated_at: string;
    versions?: PromptVersion[];
}

interface PromptVersion {
    id: string;
    version: number;
    template: string;
    created_at: string;
    created_by?: string;
}

interface TestResult {
    original: string;
    rendered: string;
    unreplacedVariables: string[];
    characterCount: number;
}

const CATEGORIES = [
    { id: 'system', label: 'System' },
    { id: 'report', label: 'Raport' },
    { id: 'initiative', label: 'Inicjatywa' },
    { id: 'assessment', label: 'Ocena' },
    { id: 'chat', label: 'Chat' },
    { id: 'analysis', label: 'Analiza' }
];

export function PromptManagementUI() {
    const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editedTemplate, setEditedTemplate] = useState('');
    const [showVersions, setShowVersions] = useState(false);
    const [showTest, setShowTest] = useState(false);
    const [testVariables, setTestVariables] = useState<Record<string, string>>({});
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    const fetchPrompts = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (filterCategory) params.append('category', filterCategory);
            if (searchQuery) params.append('search', searchQuery);

            const response = await api.get(`/ai-prompts?${params.toString()}`);
            
            if (response.data.success) {
                setPrompts(response.data.data || []);
            } else {
                setError(response.data.error || 'Failed to fetch prompts');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch prompts');
        } finally {
            setLoading(false);
        }
    }, [filterCategory, searchQuery]);

    useEffect(() => {
        fetchPrompts();
    }, [fetchPrompts]);

    const fetchPromptDetails = async (promptId: string) => {
        try {
            const response = await api.get(`/ai-prompts/${promptId}`);
            if (response.data.success) {
                setSelectedPrompt(response.data.data);
                setEditedTemplate(response.data.data.template);
                
                // Initialize test variables
                const vars: Record<string, string> = {};
                response.data.data.variables?.forEach((v: string) => {
                    vars[v] = '';
                });
                setTestVariables(vars);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleSave = async () => {
        if (!selectedPrompt) return;
        
        setSaving(true);
        try {
            const response = await api.put(`/ai-prompts/${selectedPrompt.id}`, {
                template: editedTemplate
            });

            if (response.data.success) {
                setEditMode(false);
                await fetchPromptDetails(selectedPrompt.id);
                await fetchPrompts();
            } else {
                setError(response.data.error || 'Failed to save');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!selectedPrompt) return;

        try {
            const response = await api.post(`/ai-prompts/${selectedPrompt.id}/test`, {
                variables: testVariables
            });

            if (response.data.success) {
                setTestResult(response.data.data);
            } else {
                setError(response.data.error || 'Test failed');
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleRestoreVersion = async (version: number) => {
        if (!selectedPrompt) return;

        try {
            const response = await api.post(`/ai-prompts/${selectedPrompt.id}/restore-version`, {
                version
            });

            if (response.data.success) {
                setShowVersions(false);
                await fetchPromptDetails(selectedPrompt.id);
                await fetchPrompts();
            } else {
                setError(response.data.error || 'Restore failed');
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleToggleActive = async (prompt: SystemPrompt) => {
        try {
            await api.put(`/ai-prompts/${prompt.id}`, {
                is_active: !prompt.is_active
            });
            await fetchPrompts();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const extractVariables = (template: string): string[] => {
        const matches = template.match(/\{\{\s*\w+\s*\}\}/g) || [];
        return [...new Set(matches.map(m => m.replace(/\{\{\s*|\s*\}\}/g, '')))];
    };

    const filteredPrompts = prompts.filter(p => {
        if (filterCategory && p.category !== filterCategory) return false;
        if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            {/* Left Panel - Prompt List */}
            <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-6 h-6 text-indigo-600" />
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                            Prompty AI
                        </h1>
                    </div>

                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Szukaj..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-sm"
                        />
                    </div>

                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-sm"
                    >
                        <option value="">Wszystkie kategorie</option>
                        {CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-gray-500">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
                        </div>
                    ) : filteredPrompts.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            Brak promptów
                        </div>
                    ) : (
                        filteredPrompts.map(prompt => (
                            <div
                                key={prompt.id}
                                onClick={() => fetchPromptDetails(prompt.id)}
                                className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                    selectedPrompt?.id === prompt.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">
                                            {prompt.name}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {prompt.category} • v{prompt.version}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                                        prompt.is_active 
                                            ? 'bg-green-100 text-green-700' 
                                            : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {prompt.is_active ? 'Aktywny' : 'Nieaktywny'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel - Prompt Editor */}
            <div className="flex-1 flex flex-col">
                {error && (
                    <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                        <button onClick={() => setError(null)} className="ml-auto">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {selectedPrompt ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {selectedPrompt.name}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {selectedPrompt.description || selectedPrompt.category} • Wersja {selectedPrompt.version}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowVersions(!showVersions)}
                                    >
                                        <History className="w-4 h-4 mr-1" />
                                        Historia
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowTest(!showTest)}
                                    >
                                        <Play className="w-4 h-4 mr-1" />
                                        Test
                                    </Button>
                                    {editMode ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setEditMode(false);
                                                    setEditedTemplate(selectedPrompt.template);
                                                }}
                                            >
                                                Anuluj
                                            </Button>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={handleSave}
                                                disabled={saving}
                                            >
                                                {saving ? (
                                                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                                ) : (
                                                    <Save className="w-4 h-4 mr-1" />
                                                )}
                                                Zapisz
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => setEditMode(true)}
                                        >
                                            <Edit3 className="w-4 h-4 mr-1" />
                                            Edytuj
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Variables */}
                            <div className="mt-3 flex flex-wrap gap-2">
                                {selectedPrompt.variables?.map(v => (
                                    <span
                                        key={v}
                                        className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-mono"
                                    >
                                        {`{{${v}}}`}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 overflow-hidden flex">
                            <div className="flex-1 p-4 overflow-auto">
                                {editMode ? (
                                    <textarea
                                        value={editedTemplate}
                                        onChange={(e) => setEditedTemplate(e.target.value)}
                                        className="w-full h-full p-4 font-mono text-sm bg-gray-900 text-gray-100 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        spellCheck={false}
                                    />
                                ) : (
                                    <pre className="w-full h-full p-4 font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-lg overflow-auto whitespace-pre-wrap">
                                        {selectedPrompt.template}
                                    </pre>
                                )}
                            </div>

                            {/* Side Panels */}
                            {showVersions && selectedPrompt.versions && (
                                <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
                                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                        <h3 className="font-medium text-gray-900 dark:text-white">
                                            Historia wersji
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {selectedPrompt.versions.map(ver => (
                                            <div key={ver.id} className="p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium">
                                                        Wersja {ver.version}
                                                    </span>
                                                    {ver.version !== selectedPrompt.version && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRestoreVersion(ver.version)}
                                                        >
                                                            <RotateCcw className="w-3 h-3 mr-1" />
                                                            Przywróć
                                                        </Button>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(ver.created_at).toLocaleString('pl-PL')}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {showTest && (
                                <div className="w-96 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
                                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                        <h3 className="font-medium text-gray-900 dark:text-white">
                                            Test prompta
                                        </h3>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {/* Variables Input */}
                                        <div className="space-y-3">
                                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Zmienne
                                            </h4>
                                            {Object.keys(testVariables).map(varName => (
                                                <div key={varName}>
                                                    <label className="block text-xs text-gray-500 mb-1">
                                                        {varName}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={testVariables[varName]}
                                                        onChange={(e) => setTestVariables({
                                                            ...testVariables,
                                                            [varName]: e.target.value
                                                        })}
                                                        className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-sm"
                                                        placeholder={`Wartość dla ${varName}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            variant="primary"
                                            className="w-full"
                                            onClick={handleTest}
                                        >
                                            <Play className="w-4 h-4 mr-2" />
                                            Uruchom test
                                        </Button>

                                        {/* Test Result */}
                                        {testResult && (
                                            <div className="space-y-3">
                                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Wynik
                                                </h4>
                                                
                                                {testResult.unreplacedVariables.length > 0 && (
                                                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                        <p className="text-xs text-yellow-700 font-medium mb-1">
                                                            Nieuzupełnione zmienne:
                                                        </p>
                                                        <p className="text-xs text-yellow-600">
                                                            {testResult.unreplacedVariables.join(', ')}
                                                        </p>
                                                    </div>
                                                )}

                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs text-gray-500">
                                                            Wyrenderowany prompt
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {testResult.characterCount} znaków
                                                        </span>
                                                    </div>
                                                    <pre className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                                                        {testResult.rendered}
                                                    </pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Status Bar */}
                        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between text-xs text-gray-500">
                            <span>
                                {editedTemplate.length} znaków • {extractVariables(editedTemplate).length} zmiennych
                            </span>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => handleToggleActive(selectedPrompt)}
                                    className={`flex items-center gap-1 ${
                                        selectedPrompt.is_active ? 'text-green-600' : 'text-gray-400'
                                    }`}
                                >
                                    <Check className="w-4 h-4" />
                                    {selectedPrompt.is_active ? 'Aktywny' : 'Nieaktywny'}
                                </button>
                                <span>
                                    Ostatnia modyfikacja: {new Date(selectedPrompt.updated_at).toLocaleString('pl-PL')}
                                </span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p>Wybierz prompt z listy</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PromptManagementUI;

