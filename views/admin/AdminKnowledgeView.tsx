import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { Lightbulb, Target, Check, X, MessageSquare, Plus, Trash2, Power, BrainCircuit, Activity, FileText, Upload, RefreshCw } from 'lucide-react';

export const AdminKnowledgeView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'candidates' | 'strategies' | 'documents' | 'observations'>('candidates');
    const [candidates, setCandidates] = useState<any[]>([]);
    const [strategies, setStrategies] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Filter State
    const [candidateFilter, setCandidateFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

    // Forms
    const [showStrategyModal, setShowStrategyModal] = useState(false);
    const [strategyForm, setStrategyForm] = useState({ title: '', description: '' });
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    useEffect(() => {
        loadData();
    }, [activeTab, candidateFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'candidates') {
                const data = await Api.getKnowledgeCandidates(candidateFilter);
                setCandidates(data);
            } else if (activeTab === 'strategies') {
                const data = await Api.getGlobalStrategies();
                setStrategies(data);
            } else {
                const data = await Api.getKnowledgeDocuments();
                setDocuments(data);
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
            setCandidates(candidates.filter(c => c.id !== id));
        } catch (err) {
            toast.error('Action failed');
        }
    };

    // Strategy Actions
    const handleAddStrategy = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await Api.createGlobalStrategy(strategyForm.title, strategyForm.description);
            toast.success('Strategy Added');
            setShowStrategyModal(false);
            setStrategyForm({ title: '', description: '' });
            loadData();
        } catch (err) {
            toast.error('Failed to add strategy');
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
            const result = await Api.uploadKnowledgeDocument(uploadFile);
            toast.success(`Uploaded & Indexed! (${result.chunkCount} chunks)`);
            setUploadFile(null);
            loadData();
        } catch (err: any) {
            toast.error(err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    // Observations State
    const [observations, setObservations] = useState<{ app_improvements: any[], content_gaps: any[] } | null>(null);

    const generateObservations = async () => {
        setLoading(true);
        try {
            const data = await Api.generateGlobalBrainObservations();
            setObservations(data);
            toast.success('Analysis Complete');
        } catch (err) {
            toast.error('Failed to generate observations');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <BrainCircuit className="text-purple-400" size={20} />
                        Global Knowledge Brain
                    </h1>
                    <p className="text-slate-400 text-xs mt-1">Manage AI Learning & Strategic Alignment</p>
                </div>

                {activeTab === 'strategies' && (
                    <button
                        onClick={() => setShowStrategyModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors font-medium text-xs">
                        <Plus size={14} /> Add Strategic Direction
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-white/5">
                <button
                    onClick={() => setActiveTab('candidates')}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'candidates' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                    <Lightbulb size={14} /> Idea Inbox
                </button>
                <button
                    onClick={() => setActiveTab('documents')}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'documents' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                    <FileText size={14} /> Documents (RAG)
                </button>
                <button
                    onClick={() => setActiveTab('strategies')}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'strategies' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'}`}
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
                                <div className="flex gap-2 mb-4">
                                    {['pending', 'approved', 'rejected'].map((f) => (
                                        <button
                                            key={f}
                                            onClick={() => setCandidateFilter(f as any)}
                                            className={`px-3 py-1 rounded-full text-xs capitalize ${candidateFilter === f ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50' : 'bg-navy-900 text-slate-400 border border-white/5'}`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>

                                {candidates.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500 bg-navy-900/50 rounded-xl border border-dashed border-white/10">
                                        No {candidateFilter} ideas found.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {candidates.map((c) => (
                                            <div key={c.id} className="bg-navy-900 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all group">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] uppercase font-bold rounded tracking-wider">
                                                            {c.source || 'Unknown'}
                                                        </span>
                                                        <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    {c.status === 'pending' && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleAction(c.id, 'rejected')}
                                                                className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                                                                title="Reject"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleAction(c.id, 'approved')}
                                                                className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500 hover:text-white transition-colors"
                                                                title="Approve & Learn"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                <h3 className="font-semibold text-white mb-2 text-lg">{c.content}</h3>
                                                <p className="text-slate-400 text-sm mb-3 bg-navy-950/50 p-3 rounded-lg flex gap-3">
                                                    <MessageSquare size={16} className="text-purple-500 shrink-0 mt-0.5" />
                                                    {c.reasoning || 'No reasoning provided.'}
                                                </p>

                                                {c.related_axis && (
                                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                                        <Activity size={12} /> Related to: <span className="text-slate-300">{c.related_axis}</span>
                                                    </div>
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
                                <form onSubmit={handleUpload} className="bg-navy-900 border border-white/10 rounded-xl p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <Upload size={18} className="text-blue-400" />
                                        Upload Knowledge Document
                                    </h3>

                                    <div className="flex gap-4 items-center">
                                        <div className="flex-1 relative">
                                            <input
                                                type="file"
                                                accept=".pdf,.txt,.md"
                                                onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                            <div className="bg-navy-950 border border-dashed border-slate-600 rounded-lg p-3 text-center transition-colors hover:bg-navy-800 hover:border-blue-500">
                                                {uploadFile ? (
                                                    <span className="text-blue-400 font-medium flex justify-center items-center gap-2">
                                                        <FileText size={16} /> {uploadFile.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-sm">Drag & drop PDF, TXT, MD here or click to select</span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={!uploadFile || uploading}
                                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2"
                                        >
                                            {uploading ? <RefreshCw className="animate-spin" size={18} /> : <Upload size={18} />}
                                            {uploading ? 'Processing...' : 'Upload & Index'}
                                        </button>
                                    </div>
                                    <p className="text-slate-500 text-xs mt-2">
                                        Files are automatically chunked, embedded, and added to the "Collective Intelligence" vector store.
                                    </p>
                                </form>

                                {/* List of Docs */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Indexed Documents</h3>

                                    {documents.length === 0 ? (
                                        <div className="text-center py-10 text-slate-500">No documents indexed yet.</div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {documents.map((doc) => (
                                                <div key={doc.id} className="bg-navy-900 border border-white/5 rounded-lg p-4 flex justify-between items-center group">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="p-2 bg-navy-950 rounded-lg">
                                                            <FileText className="text-purple-400" size={20} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="text-white text-sm font-medium truncate">{doc.filename}</h4>
                                                            <p className="text-slate-500 text-xs">{new Date(doc.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wide ${doc.status === 'indexed' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-500'
                                                            }`}>
                                                            {doc.status}
                                                        </span>
                                                        <button
                                                            className="text-slate-600 hover:text-red-400 transition-colors"
                                                            title="Delete (Pending Implementation)"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
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
                                    <div key={s.id} className={`bg-navy-900 border rounded-xl p-6 transition-all ${s.is_active ? 'border-purple-500/50 shadow-lg shadow-purple-900/10' : 'border-white/5 opacity-75'}`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 rounded-lg bg-navy-950 border border-white/5">
                                                <Target className={s.is_active ? "text-purple-400" : "text-slate-600"} size={24} />
                                            </div>
                                            <button
                                                onClick={() => handleToggleStrategy(s.id, !!s.is_active)}
                                                className={`p-2 rounded-lg transition-colors ${s.is_active ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400' : 'bg-slate-700 text-slate-400 hover:bg-green-500/20 hover:text-green-400'}`}
                                                title={s.is_active ? "Click to Deactivate" : "Click to Activate"}
                                            >
                                                <Power size={18} />
                                            </button>
                                        </div>

                                        <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed mb-4 min-h-[60px]">{s.description}</p>

                                        <div className="w-full h-1 bg-navy-950 rounded-full overflow-hidden">
                                            <div className={`h-full transition-all duration-500 ${s.is_active ? 'w-full bg-purple-500' : 'w-0'}`} />
                                        </div>
                                        <div className="mt-2 text-xs text-right text-slate-500">
                                            {s.is_active ? 'Active Direction' : 'Inactive'}
                                        </div>
                                    </div>
                                ))}

                                {/* Empty State / Add Placeholder */}
                                {strategies.length === 0 && (
                                    <div className="col-span-full py-12 text-center text-slate-500 bg-navy-900/30 border border-dashed border-white/10 rounded-xl">
                                        No active strategic directions. Add one to guide the AI.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* --- AI OBSERVATIONS --- */}
                        {activeTab === 'observations' && (
                            <div className="space-y-6">
                                <div className="bg-navy-900 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                                    <div className="p-3 bg-purple-500/10 rounded-full mb-4">
                                        <BrainCircuit size={32} className="text-purple-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">Analyze Global Interactions</h3>
                                    <p className="text-slate-400 text-sm max-w-md mb-6">
                                        The AI will analyze recent user interactions and feedback log to identify patterns, feature requests, and knowledge gaps.
                                    </p>
                                    <button
                                        onClick={generateObservations}
                                        disabled={loading}
                                        className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium shadow-lg shadow-purple-900/20 flex items-center gap-2 transition-all"
                                    >
                                        {loading ? <RefreshCw className="animate-spin" size={18} /> : <Lightbulb size={18} />}
                                        {loading ? 'Analyzing...' : 'Generate Observations'}
                                    </button>
                                </div>

                                {(observations && (observations.app_improvements?.length > 0 || observations.content_gaps?.length > 0)) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {/* App Improvements */}
                                        <div className="space-y-4">
                                            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                                                <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                                                App Improvements
                                            </h3>
                                            <div className="space-y-3">
                                                {observations.app_improvements.map((item: any, i: number) => (
                                                    <div key={i} className="bg-navy-900 border border-white/5 rounded-xl p-4 hover:border-blue-500/30 transition-colors">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wide ${item.severity === 'high' ? 'bg-red-500/10 text-red-400' :
                                                                item.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                                                                    'bg-blue-500/10 text-blue-400'
                                                                }`}>
                                                                {item.severity}
                                                            </span>
                                                        </div>
                                                        <p className="text-slate-200 text-sm font-medium mb-2">{item.description}</p>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500 bg-navy-950 p-2 rounded">
                                                            <Target size={12} className="text-blue-400" />
                                                            Recommendation: <span className="text-slate-300">{item.action_item}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {observations.app_improvements.length === 0 && (
                                                    <p className="text-slate-500 text-sm italic">No improvements detected.</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Content Gaps */}
                                        <div className="space-y-4">
                                            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                                                <div className="w-2 h-8 bg-purple-500 rounded-full"></div>
                                                Knowledge Gaps
                                            </h3>
                                            <div className="space-y-3">
                                                {observations.content_gaps.map((item: any, i: number) => (
                                                    <div key={i} className="bg-navy-900 border border-white/5 rounded-xl p-4 hover:border-purple-500/30 transition-colors">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wide ${item.severity === 'high' ? 'bg-red-500/10 text-red-400' :
                                                                item.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                                                                    'bg-purple-500/10 text-purple-400'
                                                                }`}>
                                                                {item.severity}
                                                            </span>
                                                        </div>
                                                        <p className="text-slate-200 text-sm font-medium mb-2">{item.description}</p>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500 bg-navy-950 p-2 rounded">
                                                            <Lightbulb size={12} className="text-purple-400" />
                                                            Missing Topic: <span className="text-slate-300">{item.action_item}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {observations.content_gaps.length === 0 && (
                                                    <p className="text-slate-500 text-sm italic">No knowledge gaps detected.</p>
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

            {/* Strategy Modal */}
            {showStrategyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">New Strategic Direction</h2>
                            <button onClick={() => setShowStrategyModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddStrategy} className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Strategy Title (e.g., "Digital First")</label>
                                <input
                                    required
                                    autoFocus
                                    value={strategyForm.title}
                                    onChange={e => setStrategyForm({ ...strategyForm, title: e.target.value })}
                                    className="w-full bg-navy-950 border border-white/10 rounded p-3 text-white focus:border-purple-500 outline-none transition-colors"
                                    placeholder="Enter a concise title..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Description (Instructions for AI)</label>
                                <textarea
                                    required
                                    rows={5}
                                    value={strategyForm.description}
                                    onChange={e => setStrategyForm({ ...strategyForm, description: e.target.value })}
                                    className="w-full bg-navy-950 border border-white/10 rounded p-3 text-white text-sm focus:border-purple-500 outline-none transition-colors"
                                    placeholder="Explain how the AI should behave or what it should prioritize..."
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowStrategyModal(false)} className="flex-1 py-2 bg-transparent border border-white/10 hover:bg-white/5 text-slate-300 rounded font-medium">Cancel</button>
                                <button type="submit" className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded shadow-lg shadow-purple-900/20">Add Strategy</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};
