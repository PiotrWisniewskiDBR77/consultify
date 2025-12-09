import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import { KnowledgeDoc } from '../types';
import { toast } from 'react-hot-toast';
import { BookOpen, RefreshCw, FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react';

export const AdminKnowledgeView: React.FC = () => {
    const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
    const [availableFiles, setAvailableFiles] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [indexing, setIndexing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await Api.getKnowledgeFiles();
            setDocs(data.docs);
            setAvailableFiles(data.availableFiles);
            setLoading(false);
        } catch (err) {
            toast.error('Failed to load knowledge base');
            setLoading(false);
        }
    };

    const handleIndex = async () => {
        setIndexing(true);
        try {
            const res = await Api.indexKnowledgeFiles();
            toast.success(`Indexed ${res.indexedCount} new files`);
            loadData();
        } catch (err) {
            toast.error('Indexing failed');
        } finally {
            setIndexing(false);
        }
    };

    const getStatusParams = (status: string) => {
        switch (status) {
            case 'indexed': return { icon: <CheckCircle size={14} />, color: 'text-green-400', bg: 'bg-green-500/10' };
            case 'error': return { icon: <AlertCircle size={14} />, color: 'text-red-400', bg: 'bg-red-500/10' };
            case 'indexing': return { icon: <RefreshCw size={14} className="animate-spin" />, color: 'text-blue-400', bg: 'bg-blue-500/10' };
            default: return { icon: <Clock size={14} />, color: 'text-slate-400', bg: 'bg-slate-800' };
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <BookOpen className="text-purple-500" />
                        Knowledge Base Management
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Manage documents used for AI context (RAG).</p>
                </div>
                <button
                    onClick={handleIndex}
                    disabled={indexing}
                    className={`flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium ${indexing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <RefreshCw size={16} className={indexing ? 'animate-spin' : ''} />
                    {indexing ? 'Indexing...' : 'Sync & Index Files'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-navy-900 border border-white/5 rounded-xl p-6">
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Documents</p>
                    <h3 className="text-2xl font-bold text-white">{docs.length}</h3>
                </div>
                <div className="bg-navy-900 border border-white/5 rounded-xl p-6">
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Source Directory</p>
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-mono text-slate-300">/knowledge</h3>
                        <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded">{availableFiles.length} files found</span>
                    </div>
                </div>
            </div>

            <div className="bg-navy-900 border border-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-navy-950 text-slate-400 uppercase text-xs font-semibold">
                        <tr>
                            <th className="px-6 py-4">Filename</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Indexed At</th>
                            <th className="px-6 py-4 text-right">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? <tr><td colSpan={4} className="p-8 text-center">Loading...</td></tr> :
                            availableFiles.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-slate-500">No files found in /knowledge directory</td></tr> :
                                availableFiles.map(file => {
                                    const doc = docs.find(d => d.filename === file);
                                    const status = doc?.status || 'pending';
                                    const style = getStatusParams(status);

                                    return (
                                        <tr key={file} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                                                <FileText size={16} className="text-slate-500" />
                                                {file}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium w-fit ${style.bg} ${style.color}`}>
                                                    {style.icon}
                                                    {status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-xs">
                                                {doc?.created_at ? new Date(doc.created_at).toLocaleString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-xs text-slate-600 font-mono">
                                                    {doc?.id?.split('-').pop() || 'Unindexed'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
