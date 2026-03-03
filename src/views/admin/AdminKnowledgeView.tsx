import {
  Activity,
  BrainCircuit,
  Check,
  Edit2,
  FileText,
  Lightbulb,
  MessageSquare,
  Plus,
  Power,
  RefreshCw,
  Tag,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';

export const AdminKnowledgeView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'candidates' | 'strategies' | 'documents' | 'observations'
  >('candidates');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Filter State
  const [candidateFilter, setCandidateFilter] = useState<
    'pending' | 'approved' | 'rejected' | 'implemented' | 'all'
  >('pending');
  const [documentCategoryFilter, setDocumentCategoryFilter] = useState<string>('');
  const [ideaCategoryFilter, setIdeaCategoryFilter] = useState<string>('');
  const [showApprovedLibrary, setShowApprovedLibrary] = useState(false);

  // Forms
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [strategyForm, setStrategyForm] = useState({
    title: '',
    description: '',
    success_metrics: [] as string[],
    priority: 'medium' as 'low' | 'medium' | 'high',
    target_date: '',
    progress_percentage: 0,
  });
  const [editingStrategy, setEditingStrategy] = useState<any | null>(null);
  const [linkingStrategy, setLinkingStrategy] = useState<any | null>(null);
  const [linkType, setLinkType] = useState<'document' | 'idea'>('document');
  const [linkItemId, setLinkItemId] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>('');
  const [uploadTags, setUploadTags] = useState<string>('');
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [editDocCategory, setEditDocCategory] = useState<string>('');
  const [editDocTags, setEditDocTags] = useState<string>('');
  const [approvingIdea, setApprovingIdea] = useState<any | null>(null);
  const [approveIdeaCategory, setApproveIdeaCategory] = useState<string>('');
  const [approveIdeaTags, setApproveIdeaTags] = useState<string>('');
  const [linkingIdea, setLinkingIdea] = useState<any | null>(null);
  const [linkProjectId, setLinkProjectId] = useState<string>('');
  const [linkProjectNotes, setLinkProjectNotes] = useState<string>('');

  // Document categories
  const DOCUMENT_CATEGORIES = ['Best Practices', 'Methodology', 'Standards', 'Templates', 'Other'];
  // Idea categories
  const IDEA_CATEGORIES = [
    'Process Improvement',
    'Tool Usage',
    'Risk Mitigation',
    'Team Collaboration',
    'Other',
  ];

  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    if (activeTab === 'candidates' && linkingIdea) {
      loadProjects();
    }
  }, [activeTab, candidateFilter, showApprovedLibrary, ideaCategoryFilter]);

  const loadProjects = async () => {
    try {
      const data = await Api.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'candidates') {
        if (showApprovedLibrary) {
          const filters: any = {};
          if (ideaCategoryFilter) filters.category = ideaCategoryFilter;
          const data = await Api.getApprovedIdeas(filters);
          setCandidates(Array.isArray(data) ? data : []);
        } else if (candidateFilter === 'all') {
          // Load all statuses
          const [pending, approved, rejected, implemented] = await Promise.all([
            Api.getKnowledgeCandidates('pending'),
            Api.getKnowledgeCandidates('approved'),
            Api.getKnowledgeCandidates('rejected'),
            Api.getKnowledgeCandidates('implemented'),
          ]);
          setCandidates([...pending, ...approved, ...rejected, ...implemented]);
        } else {
          const data = await Api.getKnowledgeCandidates(candidateFilter);
          setCandidates(Array.isArray(data) ? data : []);
        }
      } else if (activeTab === 'strategies') {
        const data = await Api.getAllGlobalStrategies();
        setStrategies(Array.isArray(data) ? data : []);
      } else {
        const data = await Api.getKnowledgeDocuments();
        setDocuments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Candidates Actions
  const handleAction = async (id: string, action: 'approved' | 'rejected') => {
    try {
      await Api.updateCandidateStatus(id, action);
      toast.success(`Idea ${action}`);
      setCandidates(candidates.filter((c) => c.id !== id));
    } catch (err) {
      toast.error('Action failed');
    }
  };

  const handleApproveWithDetails = async () => {
    if (!approvingIdea) return;
    try {
      const tagsArray = approveIdeaTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      await Api.updateKnowledgeCandidate(approvingIdea.id, {
        status: 'approved',
        category: approveIdeaCategory || undefined,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
      });
      toast.success('Idea approved and added to library');
      setApprovingIdea(null);
      setApproveIdeaCategory('');
      setApproveIdeaTags('');
      loadData();
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve idea';
      toast.error(errorMessage);
    }
  };

  const handleLinkIdeaToProject = async () => {
    if (!linkingIdea || !linkProjectId) return;
    try {
      await Api.updateKnowledgeCandidate(linkingIdea.id, {
        implementation_notes: linkProjectNotes || undefined,
      });
      // Link idea to project - using updateKnowledgeCandidate with project reference
      await Api.updateKnowledgeCandidate(linkingIdea.id, {
        implementation_notes: linkProjectNotes || undefined,
      });
      toast.success('Idea linked to project');
      setLinkingIdea(null);
      setLinkProjectId('');
      setLinkProjectNotes('');
      loadData();
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to link idea';
      toast.error(errorMessage);
    }
  };

  // Strategy Actions
  const handleAddStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Api.createGlobalStrategy(strategyForm.title, strategyForm.description, {
        success_metrics: strategyForm.success_metrics,
        priority: strategyForm.priority,
        target_date: strategyForm.target_date || undefined,
        progress_percentage: strategyForm.progress_percentage,
      });
      toast.success('Strategy Added');
      setShowStrategyModal(false);
      setStrategyForm({
        title: '',
        description: '',
        success_metrics: [],
        priority: 'medium',
        target_date: '',
        progress_percentage: 0,
      });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add strategy');
    }
  };

  const handleUpdateStrategy = async (strategyId: string, updates: any) => {
    try {
      await Api.updateGlobalStrategy(strategyId, updates);
      toast.success('Strategy updated');
      setEditingStrategy(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update strategy');
    }
  };

  const handleLinkToStrategy = async () => {
    if (!linkingStrategy || !linkItemId) return;
    try {
      if (linkType === 'document') {
        await Api.linkStrategyToDocument(linkingStrategy.id, linkItemId);
      } else {
        await Api.linkStrategyToIdea(linkingStrategy.id, linkItemId);
      }
      toast.success('Linked successfully');
      setLinkingStrategy(null);
      setLinkItemId('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to link');
    }
  };

  const handleUnlinkFromStrategy = async (
    strategyId: string,
    type: 'document' | 'idea',
    itemId: string
  ) => {
    try {
      if (type === 'document') {
        await Api.unlinkStrategyFromDocument(strategyId, itemId);
      } else {
        await Api.unlinkStrategyFromIdea(strategyId, itemId);
      }
      toast.success('Unlinked successfully');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to unlink');
    }
  };

  const handleToggleStrategy = async (id: string, currentStatus: boolean) => {
    try {
      await Api.toggleGlobalStrategy(id, !currentStatus);
      toast.success('Strategy Updated');
      loadData();
    } catch (err) {
      toast.error('Update failed');
    }
  };

  // Document Actions
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    try {
      const tagsArray = uploadTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const result = await Api.uploadKnowledgeDocument(
        uploadFile,
        uploadCategory || undefined,
        tagsArray.length > 0 ? tagsArray : undefined
      );
      toast.success(`Uploaded & Indexed! (${result.chunkCount} chunks)`);
      setUploadFile(null);
      setUploadCategory('');
      setUploadTags('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateDocument = async (docId: string) => {
    try {
      const tagsArray = editDocTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      await Api.updateKnowledgeDocument(docId, {
        category: editDocCategory || undefined,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
      });
      toast.success('Document updated');
      setEditingDoc(null);
      setEditDocCategory('');
      setEditDocTags('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    }
  };

  const filteredDocuments = documentCategoryFilter
    ? documents.filter((doc) => doc.category === documentCategoryFilter)
    : documents;

  // Observations State
  const [observations, setObservations] = useState<{
    app_improvements: any[];
    content_gaps: any[];
  } | null>(null);

  const generateObservations = async () => {
    setLoading(true);
    try {
      const data = await Api.generateGlobalBrainObservations();
      setObservations(data as any);
      toast.success('Analysis Complete');
    } catch (err) {
      toast.error('Failed to generate observations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 relative text-slate-900 dark:text-slate-100">
      <InfoButton cardId="admin-knowledge" position="top-right" />
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BrainCircuit className="text-purple-600" size={20} />
            Global Knowledge Brain
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
            Manage AI Learning & Strategic Alignment
          </p>
        </div>

        {activeTab === 'strategies' && (
          <button
            onClick={() => setShowStrategyModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors font-medium text-xs"
          >
            <Plus size={14} /> Add Strategic Direction
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-navy-800">
        <button
          onClick={() => setActiveTab('candidates')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'candidates'
              ? 'border-purple-500 text-purple-700 dark:text-purple-300'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Lightbulb size={14} /> Idea Inbox
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'documents'
              ? 'border-purple-500 text-purple-700 dark:text-purple-300'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <FileText size={14} /> Documents (RAG)
        </button>
        <button
          onClick={() => setActiveTab('strategies')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'strategies'
              ? 'border-purple-500 text-purple-700 dark:text-purple-300'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Target size={14} /> Strategic Directions
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex justify-center py-20 text-slate-500 animate-pulse">Accessing Global Brain...</div>
        ) : (
          <>
            {/* --- IDEA CANDIDATES --- */}
            {activeTab === 'candidates' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex gap-2 mb-4 flex-wrap items-center">
                  <div className="flex gap-2">
                    {['pending', 'approved', 'rejected', 'implemented', 'all'].map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          setCandidateFilter(f as any);
                          setShowApprovedLibrary(false);
                        }}
                        className={`px-3 py-1 rounded-full text-xs capitalize border ${
                          candidateFilter === f
                            ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20'
                            : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-navy-900/40 dark:text-slate-200 dark:border-navy-700'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setShowApprovedLibrary(!showApprovedLibrary);
                      setCandidateFilter('all');
                    }}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      showApprovedLibrary
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
                        : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-navy-900/40 dark:text-slate-200 dark:border-navy-700'
                    }`}
                  >
                    Approved Ideas Library
                  </button>
                  {showApprovedLibrary && (
                    <select
                      value={ideaCategoryFilter}
                      onChange={(e) => setIdeaCategoryFilter(e.target.value)}
                      className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-3 py-1 text-slate-900 dark:text-white text-xs focus:border-purple-500 outline-none"
                    >
                      <option value="">All Categories</option>
                      {IDEA_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {candidates.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-navy-900/50 rounded-xl border border-dashed border-slate-200 dark:border-navy-700">
                    No {candidateFilter} ideas found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {candidates.map((c) => (
                      <div
                        key={c.id}
                        className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4 transition-colors hover:bg-slate-50 dark:hover:bg-navy-700/40 group"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] uppercase font-bold rounded tracking-wider">
                              {c.source || 'Unknown'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {new Date(c.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {c.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAction(c.id, 'rejected')}
                                className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                                title="Reject"
                              >
                                <X size={16} />
                              </button>
                              <button
                                onClick={() => handleAction(c.id, 'approved')}
                                className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                                title="Approve & Learn"
                              >
                                <Check size={16} />
                              </button>
                            </div>
                          )}
                        </div>

                        <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-lg">
                          {c.content}
                        </h3>
                        <p className="text-slate-700 dark:text-slate-200 text-sm mb-3 bg-slate-50 dark:bg-navy-900/50 p-3 rounded-lg flex gap-3">
                          <MessageSquare size={16} className="text-purple-500 shrink-0 mt-0.5" />
                          {c.reasoning || 'No reasoning provided.'}
                        </p>

                        <div className="flex flex-wrap gap-2 mb-2">
                          {c.category && (
                            <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">
                              {c.category}
                            </span>
                          )}
                          {c.tags &&
                            Array.isArray(c.tags) &&
                            c.tags.map((tag: string, idx: number) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded flex items-center gap-1"
                              >
                                <Tag size={10} /> {tag}
                              </span>
                            ))}
                          {c.impact_score && (
                            <span className="text-xs px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded">
                              Impact: {c.impact_score}/5
                            </span>
                          )}
                        </div>

                        {c.related_axis && (
                          <div className="text-xs text-slate-500 flex items-center gap-2 mb-2">
                            <Activity size={12} /> Related to:{' '}
                            <span className="text-slate-700 dark:text-slate-200">{c.related_axis}</span>
                          </div>
                        )}

                        {c.related_project_ids &&
                          Array.isArray(c.related_project_ids) &&
                          c.related_project_ids.length > 0 && (
                            <div className="text-xs text-slate-500 flex items-center gap-2 mb-2">
                              Applied in {c.related_project_ids.length} project(s)
                            </div>
                          )}

                        {c.status === 'approved' && (
                          <button
                            onClick={() => {
                              setLinkingIdea(c);
                              setLinkProjectId('');
                              setLinkProjectNotes('');
                              loadProjects();
                            }}
                            className="mt-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors text-xs"
                          >
                            Apply in Project
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* --- DOCUMENTS (RAG) --- */}
            {activeTab === 'documents' && (
              <div className="space-y-6">
                {/* Upload Box */}
                <form
                  onSubmit={handleUpload}
                  className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6"
                >
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Upload size={18} className="text-blue-600" />
                    Upload Knowledge Document
                  </h3>

                  <div className="space-y-4">
                    <div className="flex gap-4 items-center">
                      <div className="flex-1 relative">
                        <input
                          type="file"
                          accept=".pdf,.txt,.md"
                          onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="bg-slate-50 dark:bg-navy-900 border border-dashed border-slate-300 dark:border-navy-700 rounded-lg p-3 text-center transition-colors hover:bg-slate-100 dark:hover:bg-navy-800/60 hover:border-blue-500">
                          {uploadFile ? (
                            <span className="text-blue-700 font-medium flex justify-center items-center gap-2">
                              <FileText size={16} /> {uploadFile.name}
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-300 text-sm">
                              Drag & drop PDF, TXT, MD here or click to select
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={!uploadFile || uploading}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2"
                      >
                        {uploading ? (
                          <RefreshCw className="animate-spin" size={18} />
                        ) : (
                          <Upload size={18} />
                        )}
                        {uploading ? 'Processing...' : 'Upload & Index'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                          Category
                        </label>
                        <select
                          value={uploadCategory}
                          onChange={(e) => setUploadCategory(e.target.value)}
                          className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-2 text-slate-900 dark:text-white text-sm focus:border-purple-500 outline-none"
                        >
                          <option value="">Select category...</option>
                          {DOCUMENT_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                          Tags (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={uploadTags}
                          onChange={(e) => setUploadTags(e.target.value)}
                          placeholder="tag1, tag2, tag3"
                          className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-2 text-slate-900 dark:text-white text-sm focus:border-purple-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">
                    Files are automatically chunked, embedded, and added to the "Collective
                    Intelligence" vector store.
                  </p>
                </form>

                {/* List of Docs */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                      Indexed Documents
                    </h3>
                    <select
                      value={documentCategoryFilter}
                      onChange={(e) => setDocumentCategoryFilter(e.target.value)}
                      className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-3 py-1 text-slate-900 dark:text-white text-xs focus:border-purple-500 outline-none"
                    >
                      <option value="">All Categories</option>
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {filteredDocuments.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">No documents indexed yet.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4 transition-colors hover:bg-slate-50 dark:hover:bg-navy-700/40"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg shrink-0">
                                <FileText className="text-purple-600" size={20} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-slate-900 dark:text-white text-sm font-medium truncate">
                                  {doc.filename}
                                </h4>
                                <p className="text-slate-500 dark:text-slate-400 text-xs">
                                  {new Date(doc.created_at).toLocaleDateString()}
                                </p>
                                {doc.category && (
                                  <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-200 rounded">
                                    {doc.category}
                                  </span>
                                )}
                                {doc.tags && Array.isArray(doc.tags) && doc.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {doc.tags.map((tag: string, idx: number) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200 rounded flex items-center gap-1"
                                      >
                                        <Tag size={10} /> {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wide ${
                                  doc.status === 'indexed'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {doc.status}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingDoc(doc);
                                  setEditDocCategory(doc.category || '');
                                  setEditDocTags(
                                    Array.isArray(doc.tags) ? doc.tags.join(', ') : ''
                                  );
                                }}
                                className="text-slate-400 hover:text-indigo-600 transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                className="text-slate-400 hover:text-red-600 transition-colors"
                                title="Delete (Pending Implementation)"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- STRATEGIES --- */}
            {activeTab === 'strategies' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategies.map((s) => (
                  <div
                    key={s.id}
                    className={`bg-white dark:bg-navy-800 border rounded-xl p-6 transition-colors ${
                      s.is_active
                        ? 'border-purple-200 dark:border-purple-500/40 ring-1 ring-purple-200/60 dark:ring-purple-500/20'
                        : 'border-slate-200 dark:border-navy-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 rounded-lg bg-slate-100 dark:bg-navy-900">
                        <Target
                          className={s.is_active ? 'text-purple-600' : 'text-slate-400'}
                          size={24}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingStrategy(s);
                            setStrategyForm({
                              title: s.title,
                              description: s.description || '',
                              success_metrics: s.success_metrics || [],
                              priority: s.priority || 'medium',
                              target_date: s.target_date || '',
                              progress_percentage: s.progress_percentage || 0,
                            });
                          }}
                          className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleStrategy(s.id, !!s.is_active)}
                          className={`p-2 rounded-lg transition-colors ${
                            s.is_active
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-700'
                              : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700'
                          }`}
                          title={s.is_active ? 'Click to Deactivate' : 'Click to Activate'}
                        >
                          <Power size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{s.title}</h3>
                        {s.priority && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                              s.priority === 'high'
                                ? 'bg-red-100 text-red-700'
                                : s.priority === 'medium'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {s.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed mb-2">
                        {s.description}
                      </p>
                      {s.target_date && (
                        <p className="text-xs text-slate-500">
                          Target: {new Date(s.target_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-500">Progress</span>
                        <span className="text-xs text-slate-700 font-medium">
                          {s.progress_percentage || 0}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 transition-all duration-500"
                          style={{ width: `${s.progress_percentage || 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Success Metrics */}
                    {s.success_metrics &&
                      Array.isArray(s.success_metrics) &&
                      s.success_metrics.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-slate-500 mb-1">Success Metrics:</p>
                          <div className="flex flex-wrap gap-1">
                            {s.success_metrics.map((metric: string, idx: number) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded"
                              >
                                {metric}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Related Knowledge */}
                    <div className="mb-4 border-t border-slate-200 pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase">
                          Related Knowledge
                        </p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setLinkingStrategy(s);
                              setLinkType('document');
                              setLinkItemId('');
                            }}
                            className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                            title="Link Document"
                          >
                            + Doc
                          </button>
                          <button
                            onClick={() => {
                              setLinkingStrategy(s);
                              setLinkType('idea');
                              setLinkItemId('');
                            }}
                            className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
                            title="Link Idea"
                          >
                            + Idea
                          </button>
                        </div>
                      </div>
                      {s.related_document_ids &&
                        Array.isArray(s.related_document_ids) &&
                        s.related_document_ids.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs text-slate-500 mb-1">
                              Documents ({s.related_document_ids.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {documents
                                .filter((d) => s.related_document_ids.includes(d.id))
                                .map((doc: any) => (
                                  <span
                                    key={doc.id}
                                    className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded flex items-center gap-1"
                                  >
                                    <FileText size={10} /> {doc.filename}
                                    <button
                                      onClick={() =>
                                        handleUnlinkFromStrategy(s.id, 'document', doc.id)
                                      }
                                      className="hover:text-red-400"
                                    >
                                      <X size={10} />
                                    </button>
                                  </span>
                                ))}
                            </div>
                          </div>
                        )}
                      {s.related_idea_ids &&
                        Array.isArray(s.related_idea_ids) &&
                        s.related_idea_ids.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">
                              Ideas ({s.related_idea_ids.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {candidates
                                .filter((c) => s.related_idea_ids.includes(c.id))
                                .map((idea: any) => (
                                  <span
                                    key={idea.id}
                                    className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded flex items-center gap-1"
                                  >
                                    <Lightbulb size={10} /> {idea.content.substring(0, 30)}...
                                    <button
                                      onClick={() =>
                                        handleUnlinkFromStrategy(s.id, 'idea', idea.id)
                                      }
                                      className="hover:text-red-600"
                                    >
                                      <X size={10} />
                                    </button>
                                  </span>
                                ))}
                            </div>
                          </div>
                        )}
                    </div>

                    <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${s.is_active ? 'w-full bg-purple-500' : 'w-0'}`}
                      />
                    </div>
                    <div className="mt-2 text-xs text-right text-slate-500 dark:text-slate-400">
                      {s.is_active ? 'Active Direction' : 'Inactive'}
                    </div>
                  </div>
                ))}

                {/* Empty State / Add Placeholder */}
                {strategies.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-navy-900 border border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                    No active strategic directions. Add one to guide the AI.
                  </div>
                )}
              </div>
            )}

            {/* --- AI OBSERVATIONS --- */}
            {activeTab === 'observations' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-full mb-4">
                    <BrainCircuit size={32} className="text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    Analyze Global Interactions
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm max-w-md mb-6">
                    The AI will analyze recent user interactions and feedback log to identify
                    patterns, feature requests, and knowledge gaps.
                  </p>
                  <button
                    onClick={generateObservations}
                    disabled={loading}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                  >
                    {loading ? (
                      <RefreshCw className="animate-spin" size={18} />
                    ) : (
                      <Lightbulb size={18} />
                    )}
                    {loading ? 'Analyzing...' : 'Generate Observations'}
                  </button>
                </div>

                {observations &&
                  (observations.app_improvements?.length > 0 ||
                    observations.content_gaps?.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {/* App Improvements */}
                      <div className="space-y-4">
                        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                          <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                          App Improvements
                        </h3>
                        <div className="space-y-3">
                          {observations.app_improvements.map((item: any, i: number) => (
                            <div
                              key={i}
                              className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4 transition-colors hover:bg-slate-50 dark:hover:bg-navy-700/40"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wide ${
                                    item.severity === 'high'
                                      ? 'bg-red-100 text-red-700'
                                      : item.severity === 'medium'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {item.severity}
                                </span>
                              </div>
                              <p className="text-slate-900 dark:text-white text-sm font-medium mb-2">
                                {item.description}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-navy-900 p-2 rounded border border-slate-200 dark:border-navy-700">
                                <Target size={12} className="text-blue-600" />
                                Recommendation:{' '}
                                <span className="text-slate-900 dark:text-white">{item.action_item}</span>
                              </div>
                            </div>
                          ))}
                          {observations.app_improvements.length === 0 && (
                            <p className="text-slate-500 dark:text-slate-400 text-sm italic">
                              No improvements detected.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Content Gaps */}
                      <div className="space-y-4">
                        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                          <div className="w-2 h-8 bg-purple-500 rounded-full"></div>
                          Knowledge Gaps
                        </h3>
                        <div className="space-y-3">
                          {observations.content_gaps.map((item: any, i: number) => (
                            <div
                              key={i}
                              className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4 transition-colors hover:bg-slate-50 dark:hover:bg-navy-700/40"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wide ${
                                    item.severity === 'high'
                                      ? 'bg-red-100 text-red-700'
                                      : item.severity === 'medium'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-purple-100 text-purple-700'
                                  }`}
                                >
                                  {item.severity}
                                </span>
                              </div>
                              <p className="text-slate-900 dark:text-white text-sm font-medium mb-2">
                                {item.description}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-navy-900 p-2 rounded border border-slate-200 dark:border-navy-700">
                                <Lightbulb size={12} className="text-purple-600" />
                                Missing Topic:{' '}
                                <span className="text-slate-900 dark:text-white">{item.action_item}</span>
                              </div>
                            </div>
                          ))}
                          {observations.content_gaps.length === 0 && (
                            <p className="text-slate-500 dark:text-slate-400 text-sm italic">
                              No knowledge gaps detected.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Approve Idea Modal */}
      {approvingIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Approve Idea</h2>
              <button
                onClick={() => {
                  setApprovingIdea(null);
                  setApproveIdeaCategory('');
                  setApproveIdeaTags('');
                }}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-navy-900 p-4 rounded-lg border border-slate-200 dark:border-navy-700">
                <p className="text-slate-900 dark:text-white font-medium mb-2">
                  {approvingIdea.content}
                </p>
                <p className="text-slate-700 dark:text-slate-300 text-sm">{approvingIdea.reasoning}</p>
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={approveIdeaCategory}
                  onChange={(e) => setApproveIdeaCategory(e.target.value)}
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-colors"
                >
                  <option value="">Select category...</option>
                  {IDEA_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={approveIdeaTags}
                  onChange={(e) => setApproveIdeaTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-slate-900 dark:text-white text-sm focus:border-purple-500 outline-none transition-colors"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setApprovingIdea(null);
                    setApproveIdeaCategory('');
                    setApproveIdeaTags('');
                  }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-700/60 text-slate-700 dark:text-slate-200 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApproveWithDetails}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded transition-colors"
                >
                  Approve & Add to Library
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Idea to Project Modal */}
      {linkingIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Apply Idea in Project
              </h2>
              <button
                onClick={() => {
                  setLinkingIdea(null);
                  setLinkProjectId('');
                  setLinkProjectNotes('');
                }}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-navy-900 p-4 rounded-lg border border-slate-200 dark:border-navy-700">
                <p className="text-slate-900 dark:text-white font-medium">{linkingIdea.content}</p>
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Select Project
                </label>
                <select
                  value={linkProjectId}
                  onChange={(e) => setLinkProjectId(e.target.value)}
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-colors"
                >
                  <option value="">Select project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Implementation Notes (optional)
                </label>
                <textarea
                  value={linkProjectNotes}
                  onChange={(e) => setLinkProjectNotes(e.target.value)}
                  placeholder="How was this idea applied?"
                  rows={3}
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-slate-900 dark:text-white text-sm focus:border-purple-500 outline-none transition-colors"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setLinkingIdea(null);
                    setLinkProjectId('');
                    setLinkProjectNotes('');
                  }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-700/60 text-slate-700 dark:text-slate-200 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLinkIdeaToProject}
                  disabled={!linkProjectId}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded transition-colors"
                >
                  Link to Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Document Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Document</h2>
              <button
                onClick={() => {
                  setEditingDoc(null);
                  setEditDocCategory('');
                  setEditDocTags('');
                }}
                className="text-slate-400 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={editDocCategory}
                  onChange={(e) => setEditDocCategory(e.target.value)}
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-colors"
                >
                  <option value="">No category</option>
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={editDocTags}
                  onChange={(e) => setEditDocTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-slate-900 dark:text-white text-sm focus:border-purple-500 outline-none transition-colors"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDoc(null);
                    setEditDocCategory('');
                    setEditDocTags('');
                  }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-700/60 text-slate-700 dark:text-slate-200 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateDocument(editingDoc.id)}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link to Strategy Modal */}
      {linkingStrategy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Link {linkType === 'document' ? 'Document' : 'Idea'} to Strategy
              </h2>
              <button
                onClick={() => {
                  setLinkingStrategy(null);
                  setLinkItemId('');
                }}
                className="text-slate-400 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-navy-900 p-4 rounded-lg border border-slate-200 dark:border-navy-700">
                <p className="text-slate-900 dark:text-white font-medium">{linkingStrategy.title}</p>
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Select {linkType === 'document' ? 'Document' : 'Idea'}
                </label>
                <select
                  value={linkItemId}
                  onChange={(e) => setLinkItemId(e.target.value)}
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-colors"
                >
                  <option value="">
                    Select {linkType === 'document' ? 'document' : 'idea'}...
                  </option>
                  {linkType === 'document'
                    ? documents.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.filename}
                        </option>
                      ))
                    : candidates
                        .filter((c) => c.status === 'approved' || c.status === 'implemented')
                        .map((idea) => (
                          <option key={idea.id} value={idea.id}>
                            {idea.content.substring(0, 50)}...
                          </option>
                        ))}
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setLinkingStrategy(null);
                    setLinkItemId('');
                  }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-700/60 text-slate-700 dark:text-slate-200 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLinkToStrategy}
                  disabled={!linkItemId}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded transition-colors"
                >
                  Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Modal */}
      {(showStrategyModal || editingStrategy) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingStrategy ? 'Edit Strategic Direction' : 'New Strategic Direction'}
              </h2>
              <button
                onClick={() => {
                  setShowStrategyModal(false);
                  setEditingStrategy(null);
                  setStrategyForm({
                    title: '',
                    description: '',
                    success_metrics: [],
                    priority: 'medium',
                    target_date: '',
                    progress_percentage: 0,
                  });
                }}
                className="text-slate-400 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={
                editingStrategy
                  ? (e) => {
                      e.preventDefault();
                      handleUpdateStrategy(editingStrategy.id, strategyForm);
                    }
                  : handleAddStrategy
              }
              className="space-y-4"
            >
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Strategy Title (e.g., "Digital First")
                </label>
                <input
                  required
                  autoFocus
                  value={strategyForm.title}
                  onChange={(e) => setStrategyForm({ ...strategyForm, title: e.target.value })}
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-colors"
                  placeholder="Enter a concise title..."
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Description (Instructions for AI)
                </label>
                <textarea
                  required
                  rows={5}
                  value={strategyForm.description}
                  onChange={(e) =>
                    setStrategyForm({ ...strategyForm, description: e.target.value })
                  }
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-slate-900 dark:text-white text-sm focus:border-purple-500 outline-none transition-colors"
                  placeholder="Explain how the AI should behave or what it should prioritize..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={strategyForm.priority}
                    onChange={(e) =>
                      setStrategyForm({
                        ...strategyForm,
                        priority: e.target.value as 'low' | 'medium' | 'high',
                      })
                    }
                    className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-colors"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={strategyForm.target_date}
                    onChange={(e) =>
                      setStrategyForm({ ...strategyForm, target_date: e.target.value })
                    }
                    className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Success Metrics (one per line)
                </label>
                <textarea
                  rows={3}
                  value={strategyForm.success_metrics.join('\n')}
                  onChange={(e) =>
                    setStrategyForm({
                      ...strategyForm,
                      success_metrics: e.target.value.split('\n').filter((m) => m.trim()),
                    })
                  }
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-slate-900 dark:text-white text-sm focus:border-purple-500 outline-none transition-colors"
                  placeholder="Metric 1&#10;Metric 2&#10;Metric 3"
                />
              </div>
              {editingStrategy && (
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                    Progress (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={strategyForm.progress_percentage}
                    onChange={(e) =>
                      setStrategyForm({
                        ...strategyForm,
                        progress_percentage: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-colors"
                  />
                </div>
              )}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowStrategyModal(false);
                    setEditingStrategy(null);
                    setStrategyForm({
                      title: '',
                      description: '',
                      success_metrics: [],
                      priority: 'medium',
                      target_date: '',
                      progress_percentage: 0,
                    });
                  }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-navy-900 dark:hover:bg-navy-700/60 text-slate-700 dark:text-slate-200 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded transition-colors"
                >
                  {editingStrategy ? 'Update Strategy' : 'Add Strategy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
