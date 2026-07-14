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
  Blocks,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit,
  Eye,
  FileText,
  History,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  PlayCircle,
  Plus,
  Save,
  Search,
  Tag,
  TestTube,
  Trash2,
  Wand2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';
import { LoadingState } from '@/components/ui/primitives';
import { normalizeApiErrorMessage } from '@/utils/apiError';

import api from '../../../services/api';
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getObjectPayload = (value: unknown): unknown => {
  let current = value;

  for (let depth = 0; depth < 4; depth += 1) {
    if (!isRecord(current) || !('data' in current)) break;
    current = current.data;
  }

  return current;
};

const asText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toBool = (value: unknown): boolean => value === true || value === 'true' || value === 1;

const normalizeVariables = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => asText(item).trim()).filter((item) => item.length > 0)
    : [];

const normalizePrompt = (value: unknown): PromptTemplate => {
  if (!isRecord(value)) {
    throw new Error('Prompt row was not an object');
  }

  const id = asText(value.id).trim();
  if (!id) {
    throw new Error('Prompt row was missing an id');
  }

  return {
    id,
    name: asText(value.name, 'Untitled prompt'),
    category: asText(value.category, 'system'),
    description: asText(value.description),
    system_prompt: asText(value.system_prompt),
    user_prompt_template: asText(value.user_prompt_template),
    variables: normalizeVariables(value.variables),
    version: toNumber(value.version, 1),
    is_active: toBool(value.is_active),
    created_at: asText(value.created_at),
    updated_at: asText(value.updated_at),
    created_by: asText(value.created_by),
  };
};

const normalizePromptList = (value: unknown): PromptTemplate[] => {
  const payload = getObjectPayload(value);
  let rows: unknown[];

  if (Array.isArray(payload)) {
    rows = payload;
  } else if (isRecord(payload) && Array.isArray(payload.prompts)) {
    rows = payload.prompts;
  } else if (isRecord(payload) && payload.success === false) {
    throw new Error(normalizeApiErrorMessage(payload, 'Failed to fetch prompts'));
  } else {
    throw new Error('Prompts response was not a list');
  }

  return rows.map(normalizePrompt);
};

const normalizeVersion = (value: unknown): PromptVersion => {
  if (!isRecord(value)) {
    throw new Error('Prompt version row was not an object');
  }

  const id = asText(value.id).trim();
  if (!id) {
    throw new Error('Prompt version row was missing an id');
  }

  return {
    id,
    prompt_id: asText(value.prompt_id),
    version: toNumber(value.version, 1),
    system_prompt: asText(value.system_prompt),
    user_prompt_template: asText(value.user_prompt_template),
    changed_by: asText(value.changed_by),
    changed_at: asText(value.changed_at),
    change_reason: asText(value.change_reason) || undefined,
  };
};

const normalizeVersionList = (value: unknown): PromptVersion[] => {
  const payload = getObjectPayload(value);
  let rows: unknown[];

  if (Array.isArray(payload)) {
    rows = payload;
  } else if (isRecord(payload) && Array.isArray(payload.versions)) {
    rows = payload.versions;
  } else if (isRecord(payload) && payload.success === false) {
    throw new Error(normalizeApiErrorMessage(payload, 'Failed to fetch versions'));
  } else {
    throw new Error('Prompt versions response was not a list');
  }

  return rows.map(normalizeVersion);
};

export function PromptManagementUI() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [versionsError, setVersionsError] = useState<string | null>(null);
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
      const nextPrompts = normalizePromptList(response);
      setPrompts(nextPrompts);
      return nextPrompts;
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch prompts');
      setError(message);
      setPrompts([]);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const fetchVersionHistory = async (promptId: string) => {
    setVersionsError(null);
    try {
      const response = await api.get(`/ai-prompts/${promptId}/versions`);
      const nextVersions = normalizeVersionList(response);
      setVersions(nextVersions);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch versions');
      setVersionsError(message);
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
    if (!editForm.id) {
      setActionError('Creating prompts is not connected to a confirmed backend workflow yet.');
      return;
    }

    setIsSaving(true);
    setActionError(null);
    try {
      const response = await api.put(`/ai-prompts/${editForm.id}`, editForm);
      const data = getObjectPayload(response);

      if (isRecord(data) && data.success === false) {
        throw new Error(normalizeApiErrorMessage(data, 'Failed to save prompt'));
      }

      const nextPrompts = await fetchPrompts();
      const confirmedPrompt = nextPrompts?.find((prompt) => prompt.id === editForm.id);

      if (!confirmedPrompt) {
        throw new Error('Prompt save could not be confirmed after refresh');
      }

      const expectedName = asText(editForm.name, selectedPrompt?.name);
      if (expectedName && confirmedPrompt.name !== expectedName) {
        throw new Error('Prompt save refresh returned stale prompt data');
      }

      toast.success('Prompt saved successfully');
      setSelectedPrompt(confirmedPrompt);
      setIsEditing(false);
      await fetchVersionHistory(confirmedPrompt.id);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to save prompt');
      setActionError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPrompt || !confirm('Are you sure you want to delete this prompt?')) return;

    try {
      const response = await api.delete(`/ai-prompts/${selectedPrompt.id}`);
      const data = getObjectPayload(response);

      if (isRecord(data) && data.success === false) {
        throw new Error(normalizeApiErrorMessage(data, 'Failed to delete'));
      }

      const deletedId = selectedPrompt.id;
      const nextPrompts = await fetchPrompts();

      if (!nextPrompts || nextPrompts.some((prompt) => prompt.id === deletedId)) {
        throw new Error('Prompt deletion could not be confirmed after refresh');
      }

      toast.success('Prompt deleted');
      setSelectedPrompt(null);
      setVersions([]);
      setVersionsError(null);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to delete prompt');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleCreateNew = () => {
    setActionError('Creating prompts is not connected to a confirmed backend workflow yet.');
  };

  const handleTestPrompt = async () => {
    if (!selectedPrompt) return;

    setPreviewLoading(true);
    setShowPreview(true);
    setPreviewResult(null);
    setActionError(null);

    try {
      const response = await api.post(`/ai-prompts/${selectedPrompt.id}/test`, {
        variables: {},
      });
      const data = getObjectPayload(response);

      if (isRecord(data) && data.success === false) {
        throw new Error(normalizeApiErrorMessage(data, 'Test failed'));
      }

      const result = isRecord(data) ? asText(data.result, 'No response') : 'No response';
      setPreviewResult(result);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Test failed');
      setActionError(message);
      setPreviewResult(`Error: ${message}`);
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

  const handlePromptBenchResults = (results: unknown[]) => {
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
    const date = new Date(dateStr);

    if (Number.isNaN(date.getTime())) {
      return 'Unknown date';
    }

    return date.toLocaleDateString('pl-PL', {
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
              <Wand2 size={20} className="text-primary-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Prompts</h2>
            </div>
            <button
              onClick={handleCreateNew}
              className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              title="New Prompt"
            >
              <Plus size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
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
            <LoadingState variant="spinner" className="py-10" />
          ) : error ? (
            <div className="p-4">
              <DegradedState title="Prompts unavailable" description={error} />
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
                      <span className="text-xs text-slate-600 dark:text-slate-500">
                        ({category.prompts.length})
                      </span>
                    </span>
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown size={16} className="text-slate-600 dark:text-slate-500" />
                    ) : (
                      <ChevronRight size={16} className="text-slate-600 dark:text-slate-500" />
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
                              ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-primary-500'
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
          {actionError ? (
            <div
              role="alert"
              className="mx-6 mt-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/50 dark:bg-danger-900/20 dark:text-danger-200"
            >
              {actionError}
            </div>
          ) : null}
          {!selectedPrompt && !isEditing ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <div className="text-center">
                <Wand2 size={48} className="mx-auto mb-4 opacity-50" />
                <p>Select a prompt to view or edit</p>
                <button
                  onClick={handleCreateNew}
                  className="mt-4 px-4 py-2 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800 transition-colors flex items-center gap-2 mx-auto"
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
                          ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30'
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
                          className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50"
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
                              ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30'
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
                          className="p-2 text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
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
                        ? 'bg-slate-50 dark:bg-navy-900 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
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
                        ? 'bg-slate-50 dark:bg-navy-900 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
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
                        ? 'bg-slate-50 dark:bg-navy-900 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
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
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-navy-900"></div>
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
                                : 'text-slate-600 dark:text-slate-500'
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
                                className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-mono"
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
                {showVersions && versionsError ? (
                  <div className="mt-6 max-w-4xl">
                    <DegradedState
                      title="Prompt versions unavailable"
                      description={versionsError}
                    />
                  </div>
                ) : null}

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
                        <LoadingState variant="spinner" className="py-8" />
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
