/**
 * StudioSidebar - Documents list sidebar
 */

import { Clock, FileText, FolderOpen, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

interface StudioDocument {
  id: string;
  name: string;
  type: string;
  updatedAt: string;
}

interface StudioSidebarProps {
  currentDocumentId?: string;
  onSelectDocument: (id: string) => void;
  onClose: () => void;
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  currentDocumentId,
  onSelectDocument,
  onClose,
}) => {
  const [documents, setDocuments] = useState<StudioDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Load documents
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await Api.get('/api/studio/documents');
        setDocuments(response.data || response || []);
      } catch (error) {
        console.error('Failed to load documents:', error);
        toast.error('Failed to load documents');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  // Filter documents
  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  // Get type color
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      process_flow: 'text-blue-400 bg-blue-500/20',
      org_chart: 'text-purple-400 bg-purple-500/20',
      mindmap: 'text-pink-400 bg-pink-500/20',
      raci: 'text-amber-400 bg-amber-500/20',
      swimlane: 'text-cyan-400 bg-cyan-500/20',
    };
    return colors[type] || 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-navy-800/300/20';
  };

  return (
    <div className="w-64 shrink-0 flex flex-col bg-white dark:bg-navy-900 shadow-sm">
      {/* Header */}
      <div className="shrink-0 p-4 flex items-center justify-between border-b border-slate-100 dark:border-navy-800">
        <div className="flex items-center gap-2">
          <FolderOpen size={18} className="text-slate-400 dark:text-slate-500" />
          <span className="font-medium text-white">Documents</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-500 dark:text-slate-400 hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-white/5">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* New Document Button */}
      <div className="p-3">
        <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors text-sm">
          <Plus size={14} />
          New Document
        </button>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="text-slate-500 dark:text-slate-400 animate-spin" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={24} className="text-slate-600 dark:text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {searchQuery ? 'No documents found' : 'No documents yet'}
            </p>
          </div>
        ) : (
          filteredDocuments.map((doc) => (
            <button
              key={doc.id}
              onClick={() => onSelectDocument(doc.id)}
              className={`
                                w-full text-left p-3 rounded-lg transition-colors
                                ${
                                  doc.id === currentDocumentId
                                    ? 'bg-blue-500/20 border border-blue-500/30'
                                    : 'hover:bg-white/5 border border-transparent'
                                }
                            `}
            >
              <div className="flex items-start gap-3">
                <FileText
                  size={16}
                  className={
                    doc.id === currentDocumentId
                      ? 'text-blue-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-white truncate">{doc.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${getTypeColor(doc.type)}`}>
                      {doc.type.replace('_', ' ')}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                      <Clock size={10} />
                      {formatDate(doc.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default StudioSidebar;
