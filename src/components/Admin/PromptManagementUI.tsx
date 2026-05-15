/**
 * Prompt Management UI Component
 *
 * Super Admin interface for managing AI prompts and templates.
 * Features:
 * - CRUD operations for prompts
 * - Version history
 * - Live preview/testing
 * - Category organization
 * - Variables/placeholders management
 */

import {
  AlertTriangle,
  Blocks,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit,
  Eye,
  FileText,
  History,
  Languages,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Tag,
  TestTube,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import api from '../../services/api';
import { PromptAssistantPanel } from './PromptAssistantPanel';
import { PromptBlockBuilder } from './PromptBlockBuilder';
import { PromptTestBench } from './PromptTestBench';

interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  system_prompt: string;
  user_prompt_template: string;
  variables: string[];
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface PromptVersion {
  id: string;
  prompt_id: string;
  version: number;
  system_prompt: string;
  user_prompt_template: string;
  changed_by: string;
  changed_at: string;
  change_reason?: string;
}

const PROMPT_CATEGORIES = [
  { id: 'chat', name: 'Chat Assistant', icon: '💬' },
  { id: 'analysis', name: 'Analysis & Reports', icon: '📊' },
  { id: 'generation', name: 'Content Generation', icon: '✨' },
  { id: 'assessment', name: 'Assessment AI', icon: '🎯' },
  { id: 'initiative', name: 'Initiative Generator', icon: '🚀' },
  { id: 'task', name: 'Task Advisor', icon: '📋' },
  { id: 'system', name: 'System Prompts', icon: '⚙️' },
];

export function PromptManagementUI() {
  const { t } = useTranslation();
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PromptTemplate>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['chat', 'analysis'])
  );

  // New states for enhanced features
  const [showAssistant, setShowAssistant] = useState(true);
  const [activeTab, setActiveTab] = useState<'editor' | 'blocks' | 'test'>('editor');
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/ai-prompts');
      const data = (response as any)?.data ?? response;

      if (data?.success) {
        setPrompts(data.prompts || []);
      } else if (data?.prompts) {
        // Handle case where success flag is missing but data exists
        setPrompts(data.prompts);
      } else if (Array.isArray(data)) {
        // Handle case where backend returns array directly
        setPrompts(data);
      } else {
        throw new Error(data?.error || 'Failed to fetch prompts');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch prompts');
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const fetchVersionHistory = async (promptId: string) => {
    try {
      const response = await api.get(`/ai-prompts/${promptId}/versions`);
      const data = (response as any)?.data ?? response;
      if (data?.success || data?.versions) {
        setVersions(data.versions || []);
      } else if (Array.isArray(data)) {
        setVersions(data);
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
      setVersions([]);
    }
  };

  const handleSelectPrompt = async (prompt: PromptTemplate) => {
    setSelectedPrompt(prompt);
    setIsEditing(false);
    setShowVersions(false);
    setShowPreview(false);
    await fetchVersionHistory(prompt.id);
  };

  const handleEdit = () => {
    if (selectedPrompt) {
      setEditForm({
        ...selectedPrompt,
      });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!editForm.id) return;

    setIsSaving(true);
    try {
      const response = await api.put(`/ai-prompts/${editForm.id}`, editForm);
      const data = (response as any)?.data ?? response;

      if (data?.success !== false) {
        toast.success('Prompt saved successfully');
        setIsEditing(false);
        await fetchPrompts();
        if (selectedPrompt) {
          await handleSelectPrompt({ ...selectedPrompt, ...editForm } as PromptTemplate);
        }
      } else {
        throw new Error(data?.error || 'Failed to save prompt');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save prompt');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPrompt || !confirm('Are you sure you want to delete this prompt?')) return;

    try {
      const response = await api.delete(`/ai-prompts/${selectedPrompt.id}`);
      const data = (response as any)?.data ?? response;

      if (data?.success !== false) {
        toast.success('Prompt deleted');
        setSelectedPrompt(null);
        await fetchPrompts();
      } else {
        throw new Error(data?.error || 'Failed to delete');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete prompt');
    }
  };

  const handleCreateNew = () => {
    setEditForm({
      name: 'New Prompt',
      category: 'chat',
      description: '',
      system_prompt: '',
      user_prompt_template: '',
      variables: [],
      is_active: true,
    });
    setSelectedPrompt(null);
    setIsEditing(true);
  };

  const handleTestPrompt = async () => {
    if (!selectedPrompt) return;

    setPreviewLoading(true);
    setShowPreview(true);
    setPreviewResult(null);

    try {
      const response = await api.post(`/ai-prompts/${selectedPrompt.id}/test`, {
        variables: {},
      });
      const data = (response as any)?.data ?? response;

      if (data?.success !== false) {
        setPreviewResult(data?.result || 'No response');
      } else {
        setPreviewResult(`Error: ${data?.error || 'Test failed'}`);
      }
    } catch (err: any) {
      setPreviewResult(`Error: ${err?.message || 'Test failed'}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleBlockPreview = (preview: string) => {
    setShowPreview(true);
    setPreviewLoading(false);
    setPreviewResult(preview);
    toast.success('Preview generated');
  };

  const handlePromptBenchResults = (results: any[]) => {
    setShowPreview(true);
    setPreviewLoading(false);
    setPreviewResult(JSON.stringify(results, null, 2));
    toast.success(`Completed ${results.length} prompt tests`);
  };

  const handleCopyPrompt = () => {
    if (selectedPrompt) {
      navigator.clipboard.writeText(selectedPrompt.system_prompt);
      toast.success('Prompt copied to clipboard');
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const filteredPrompts = prompts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const promptsByCategory = PROMPT_CATEGORIES.map((cat) => ({
    ...cat,
    prompts: filteredPrompts.filter((p) => p.category === cat.id),
  })).filter((cat) => cat.prompts.length > 0 || selectedCategory === cat.id);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-900 flex">
      {/* Sidebar - Prompt List */}
      <div className="w-80  border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wand2 size={20} className="text-purple-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Prompts</h2>
            </div>
            <button
              onClick={handleCreateNew}
              className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
              title="New Prompt"
            >
              <Plus size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="p-2 border-b border-slate-200 dark:border-navy-700">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white"
          >
            <option value="all">All Categories</option>
            {PROMPT_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Prompt List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-purple-500" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">
              <AlertTriangle size={24} className="mx-auto mb-2" />
              <p className="text-sm">{error}</p>
            </div>
          ) : promptsByCategory.length === 0 ? (
            <div className="p-4 text-center text-slate-500 dark:text-slate-400">
              <FileText size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No prompts found</p>
            </div>
          ) : (
            <div className="py-2">
              {promptsByCategory.map((category) => (
                <div key={category.id}>
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                      <span>{category.icon}</span>
                      {category.name}
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        ({category.prompts.length})
                      </span>
                    </span>
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown size={16} className="text-slate-400 dark:text-slate-500" />
                    ) : (
                      <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
                    )}
                  </button>
                  {expandedCategories.has(category.id) && (
                    <div className="py-1">
                      {category.prompts.map((prompt) => (
                        <button
                          key={prompt.id}
                          onClick={() => handleSelectPrompt(prompt)}
                          className={`w-full px-4 py-2 text-left transition-colors ${
                            selectedPrompt?.id === prompt.id
                              ? 'bg-purple-50 dark:bg-purple-900/20 border-l-2 border-purple-500'
                              : 'hover:bg-slate-50 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${prompt.is_active ? 'bg-green-500' : 'bg-slate-300'}`}
                            />
                            <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {prompt.name}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1 pl-4">
                            {prompt.description || 'No description'}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex ${showAssistant ? '' : ''}`}>
        {/* Editor/Blocks/Test Area */}
        <div className={`flex-1 flex flex-col ${showAssistant ? 'lg:w-3/5' : 'w-full'}`}>
          {!selectedPrompt && !isEditing ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <div className="text-center">
                <Wand2 size={48} className="mx-auto mb-4 opacity-50" />
                <p>Select a prompt to view or edit</p>
                <button
                  onClick={handleCreateNew}
                  className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <Plus size={16} />
                  Create New Prompt
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {isEditing
                        ? editForm.id
                          ? 'Edit Prompt'
                          : 'New Prompt'
                        : selectedPrompt?.name}
                    </h2>
                    {selectedPrompt && !isEditing && (
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        v{selectedPrompt.version}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Assistant Toggle */}
                    <button
                      onClick={() => setShowAssistant(!showAssistant)}
                      className={`p-2 rounded-lg transition-colors ${
                        showAssistant
                          ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                      }`}
                      title={showAssistant ? 'Hide AI Assistant' : 'Show AI Assistant'}
                    >
                      {showAssistant ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                    </button>
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => {
                            setIsEditing(false);
                            if (!editForm.id) setSelectedPrompt(null);
                          }}
                          className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                          {isSaving ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Save size={16} />
                          )}
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleCopyPrompt}
                          className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                          title="Copy to clipboard"
                        >
                          <Copy size={18} />
                        </button>
                        <button
                          onClick={() => setShowVersions(!showVersions)}
                          className={`p-2 rounded-lg transition-colors ${
                            showVersions
                              ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                          }`}
                          title="Version history"
                        >
                          <History size={18} />
                        </button>
                        <button
                          onClick={handleTestPrompt}
                          className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                          title="Test prompt"
                        >
                          <PlayCircle size={18} />
                        </button>
                        <button
                          onClick={handleEdit}
                          className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={handleDelete}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-1 border-t border-slate-200 dark:border-navy-700 pt-3 -mb-4 -mx-6 px-6">
                  <button
                    onClick={() => setActiveTab('editor')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      activeTab === 'editor'
                        ? 'bg-slate-50 dark:bg-navy-900 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Edit size={16} />
                    Editor
                  </button>
                  <button
                    onClick={() => setActiveTab('blocks')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      activeTab === 'blocks'
                        ? 'bg-slate-50 dark:bg-navy-900 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Blocks size={16} />
                    Block Builder
                  </button>
                  <button
                    onClick={() => setActiveTab('test')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      activeTab === 'test'
                        ? 'bg-slate-50 dark:bg-navy-900 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <TestTube size={16} />
                    Test Bench
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Block Builder Tab */}
                {activeTab === 'blocks' && (
                  <PromptBlockBuilder
                    selectedBlocks={selectedBlocks}
                    onBlocksChange={setSelectedBlocks}
                    onPreview={handleBlockPreview}
                  />
                )}

                {/* Test Bench Tab */}
                {activeTab === 'test' && (
                  <PromptTestBench
                    templateCode={selectedPrompt?.name || editForm.name}
                    onTestComplete={handlePromptBenchResults}
                  />
                )}

                {/* Editor Tab */}
                {activeTab === 'editor' && isEditing ? (
                  <div className="max-w-4xl space-y-6">
                    {/* Name & Category */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Name
                        </label>
                        <input
                          type="text"
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Category
                        </label>
                        <select
                          value={editForm.category || 'chat'}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="w-full px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                        >
                          {PROMPT_CATEGORIES.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.icon} {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Description
                      </label>
                      <input
                        type="text"
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Brief description of this prompt..."
                        className="w-full px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* System Prompt */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        System Prompt
                      </label>
                      <textarea
                        value={editForm.system_prompt || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, system_prompt: e.target.value })
                        }
                        rows={8}
                        placeholder="Enter the system prompt..."
                        className="w-full px-4 py-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white font-mono text-sm resize-y"
                      />
                    </div>

                    {/* User Prompt Template */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        User Prompt Template
                      </label>
                      <textarea
                        value={editForm.user_prompt_template || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, user_prompt_template: e.target.value })
                        }
                        rows={4}
                        placeholder="Enter the user prompt template with {{variables}}..."
                        className="w-full px-4 py-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white font-mono text-sm resize-y"
                      />
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Use {'{{variable_name}}'} for dynamic content
                      </p>
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.is_active}
                          onChange={(e) =>
                            setEditForm({ ...editForm, is_active: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                      </label>
                      <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
                    </div>
                  </div>
                ) : (
                  activeTab === 'editor' &&
                  selectedPrompt && (
                    <div className="max-w-4xl space-y-6">
                      {/* Metadata */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Category</p>
                          <p className="text-slate-900 dark:text-white font-medium flex items-center gap-2">
                            <Tag size={14} />
                            {PROMPT_CATEGORIES.find((c) => c.id === selectedPrompt.category)
                              ?.name || selectedPrompt.category}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Created</p>
                          <p className="text-slate-900 dark:text-white font-medium">
                            {formatDate(selectedPrompt.created_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Status</p>
                          <p
                            className={`font-medium flex items-center gap-2 ${
                              selectedPrompt.is_active
                                ? 'text-green-600'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {selectedPrompt.is_active ? (
                              <>
                                <CheckCircle size={14} />
                                Active
                              </>
                            ) : (
                              'Inactive'
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      {selectedPrompt.description && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Description
                          </h3>
                          <p className="text-slate-600 dark:text-slate-400">
                            {selectedPrompt.description}
                          </p>
                        </div>
                      )}

                      {/* System Prompt */}
                      <div>
                        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          System Prompt
                        </h3>
                        <div className="p-4 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg">
                          <pre className="text-sm text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap">
                            {selectedPrompt.system_prompt}
                          </pre>
                        </div>
                      </div>

                      {/* User Prompt Template */}
                      {selectedPrompt.user_prompt_template && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            User Prompt Template
                          </h3>
                          <div className="p-4 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg">
                            <pre className="text-sm text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap">
                              {selectedPrompt.user_prompt_template}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Variables */}
                      {selectedPrompt.variables && selectedPrompt.variables.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Variables
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedPrompt.variables.map((v) => (
                              <span
                                key={v}
                                className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-mono"
                              >
                                {'{{'}
                                {v}
                                {'}}'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* Version History Panel */}
                {showVersions && versions.length > 0 && (
                  <div className="mt-6 max-w-4xl">
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                      <History size={16} />
                      Version History
                    </h3>
                    <div className="space-y-3">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className="p-4 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-slate-900 dark:text-white">
                              Version {version.version}
                            </span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                              {formatDate(version.changed_at)}
                            </span>
                          </div>
                          {version.change_reason && (
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {version.change_reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview Panel */}
                {showPreview && (
                  <div className="mt-6 max-w-4xl">
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                      <Eye size={16} />
                      Test Result
                    </h3>
                    <div className="p-4 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg">
                      {previewLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 size={24} className="animate-spin text-purple-500" />
                        </div>
                      ) : (
                        <pre className="text-sm text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap">
                          {previewResult || 'No result'}
                        </pre>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* AI Assistant Panel */}
        {showAssistant && (
          <div className="hidden lg:block w-2/5 border-l border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800">
            <PromptAssistantPanel
              promptId={selectedPrompt?.id}
              promptContent={isEditing ? editForm.system_prompt : selectedPrompt?.system_prompt}
              templateCode={selectedPrompt?.name}
              onSuggestionApply={(improved) => {
                if (isEditing) {
                  setEditForm({ ...editForm, system_prompt: improved });
                }
                toast.success('Suggestion applied to editor');
              }}
              className="h-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default PromptManagementUI;
