/**
 * Evidence Panel Component
 *
 * Side panel for managing evidence attachments for digitization scores.
 * Supports adding links, notes, and uploading documents.
 */

import {
  AlertCircle,
  Check,
  CheckCircle,
  ExternalLink,
  FileText,
  Image,
  Link as LinkIcon,
  Loader2,
  Paperclip,
  Plus,
  StickyNote,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { EmptyState } from '../ui/composed/EmptyState';
import { LoadingState } from '../ui/primitives';

interface Evidence {
  id: string;
  score_id: string;
  evidence_type: 'document' | 'link' | 'screenshot' | 'note';
  title: string;
  content?: string;
  file_path?: string;
  file_size?: number;
  mime_type?: string;
  category?: string;
  uploaded_by: string;
  uploaded_by_name?: string;
  uploaded_at: string;
  is_verified?: boolean;
  verified_by?: string;
  verified_at?: string;
}

interface EvidencePanelProps {
  scoreId: string;
  axisName: string;
  areaName: string;
  onClose: () => void;
  onEvidenceChange?: () => void;
}

const EVIDENCE_TYPES = [
  { id: 'note', icon: StickyNote, label: 'Note', color: 'yellow' },
  { id: 'link', icon: LinkIcon, label: 'Link', color: 'blue' },
  { id: 'document', icon: FileText, label: 'Document', color: 'purple' },
  { id: 'screenshot', icon: Image, label: 'Screenshot', color: 'green' },
];

const CATEGORIES = [
  { id: 'policy', label: 'Policy Document' },
  { id: 'procedure', label: 'Procedure' },
  { id: 'screenshot', label: 'Screenshot' },
  { id: 'interview', label: 'Interview Notes' },
  { id: 'audit', label: 'Audit Report' },
  { id: 'metric', label: 'Metric/KPI' },
  { id: 'training', label: 'Training Material' },
  { id: 'other', label: 'Other' },
];

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  scoreId,
  axisName,
  areaName,
  onClose,
  onEvidenceChange,
}) => {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<'note' | 'link' | 'document'>('note');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const loadEvidence = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await Api.getDigitizationEvidence(scoreId);
      setEvidence(result.evidence || []);
    } catch (err) {
      toast.error('Failed to load evidence');
    } finally {
      setIsLoading(false);
    }
  }, [scoreId]);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  const handleAddEvidence = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSubmitting(true);
    try {
      if (addType === 'document' && file) {
        await Api.uploadDigitizationEvidence(scoreId, file, {
          title,
          description: content,
          category,
        });
      } else {
        await Api.addDigitizationEvidence(scoreId, {
          evidenceType: addType,
          title,
          content,
          category,
        });
      }

      toast.success('Evidence added');
      setShowAddForm(false);
      resetForm();
      loadEvidence();
      onEvidenceChange?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add evidence');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvidence = async (evidenceId: string) => {
    if (!confirm('Are you sure you want to delete this evidence?')) return;

    try {
      await Api.deleteDigitizationEvidence(evidenceId);
      toast.success('Evidence deleted');
      loadEvidence();
      onEvidenceChange?.();
    } catch (err) {
      toast.error('Failed to delete evidence');
    }
  };

  const handleVerifyEvidence = async (evidenceId: string) => {
    try {
      await Api.verifyDigitizationEvidence(evidenceId);
      toast.success('Evidence verified');
      loadEvidence();
    } catch (err) {
      toast.error('Failed to verify evidence');
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('');
    setFile(null);
  };

  const getEvidenceIcon = (type: string) => {
    const config = EVIDENCE_TYPES.find((t) => t.id === type);
    return config?.icon || FileText;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-navy-900 shadow-2xl z-overlay flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
            <Paperclip className="text-primary-500" size={20} />
          </div>
          <div>
            <h2 className="font-bold text-navy-900 dark:text-white">Evidence & Justification</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
              {axisName} › {areaName}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/30 dark:hover:bg-white/5 rounded-lg transition-colors"
        >
          <X size={20} className="text-slate-600 dark:text-slate-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <LoadingState variant="spinner" className="py-12" />
        ) : (
          <div className="space-y-4">
            {/* Evidence list */}
            {evidence.length === 0 ? (
              <EmptyState
                icon={<Paperclip />}
                title="No evidence attached"
                description="Add evidence to support the assessment"
                compact
              />
            ) : (
              evidence.map((item) => {
                const Icon = getEvidenceIcon(item.evidence_type);
                return (
                  <div key={item.id} className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 group">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white dark:bg-navy-700 flex items-center justify-center flex-shrink-0">
                        <Icon size={18} className="text-slate-500 dark:text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-navy-900 dark:text-white truncate">
                            {item.title}
                          </p>
                          {item.is_verified && (
                            <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                          )}
                        </div>
                        {item.content && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {item.evidence_type === 'link' ? (
                              <a
                                href={item.content}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline flex items-center gap-1"
                              >
                                {item.content}
                                <ExternalLink size={12} />
                              </a>
                            ) : (
                              item.content
                            )}
                          </p>
                        )}
                        {item.file_path && (
                          <a
                            href={item.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:underline flex items-center gap-1 mt-1"
                          >
                            Download file ({formatFileSize(item.file_size)})
                            <ExternalLink size={12} />
                          </a>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-500">
                          {item.category && (
                            <span className="px-2 py-0.5 bg-slate-200 dark:bg-navy-700 rounded">
                              {CATEGORIES.find((c) => c.id === item.category)?.label ||
                                item.category}
                            </span>
                          )}
                          <span>{item.uploaded_by_name || 'User'}</span>
                          <span>•</span>
                          <span>{new Date(item.uploaded_at).toLocaleDateString('en-US')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!item.is_verified && (
                          <button
                            onClick={() => handleVerifyEvidence(item.id)}
                            className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 rounded-lg text-slate-600 dark:text-slate-500 hover:text-emerald-500"
                            title="Verify"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteEvidence(item.id)}
                          className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-500/10 rounded-lg text-slate-600 dark:text-slate-500 hover:text-rose-500"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Add evidence form */}
            {showAddForm && (
              <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4 border border-emerald-200 dark:border-emerald-500/20">
                <h4 className="font-medium text-navy-900 dark:text-white mb-4">Add new evidence</h4>

                {/* Type selector */}
                <div className="flex gap-2 mb-4">
                  {(['note', 'link', 'document'] as const).map((type) => {
                    const config = EVIDENCE_TYPES.find((t) => t.id === type);
                    const Icon = config?.icon || FileText;
                    return (
                      <button
                        key={type}
                        onClick={() => setAddType(type)}
                        className={`flex-1 p-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                          addType === type
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/30'
                        }`}
                      >
                        <Icon size={14} />
                        {config?.label}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Title *"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />

                  {addType === 'link' && (
                    <input
                      type="url"
                      placeholder="https://..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  )}

                  {addType === 'note' && (
                    <textarea
                      placeholder="Note content..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    />
                  )}

                  {addType === 'document' && (
                    <div className="border-2 border-dashed border-slate-300 dark:border-white/20 rounded-lg p-4 text-center">
                      {file ? (
                        <div className="flex items-center justify-center gap-2">
                          <FileText size={16} className="text-emerald-500" />
                          <span className="text-sm text-navy-900 dark:text-white">{file.name}</span>
                          <button
                            onClick={() => setFile(null)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-navy-800/30 rounded"
                          >
                            <X size={14} className="text-slate-600 dark:text-slate-500" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                          />
                          <Upload
                            size={24}
                            className="mx-auto text-slate-600 dark:text-slate-500 mb-2"
                          />
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Click to select file
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
                            PDF, DOC, XLS, PNG, JPG (max 25MB)
                          </p>
                        </label>
                      )}
                    </div>
                  )}

                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Select category (optional)</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                    className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/30 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddEvidence}
                    disabled={isSubmitting || !title.trim()}
                    className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-lg text-sm font-medium"
                  >
                    {isSubmitting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Plus size={14} />
                    )}
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {!showAddForm && (
        <div className="p-4 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
          >
            <Plus size={18} />
            Add Evidence
          </button>
        </div>
      )}
    </div>
  );
};

export default EvidencePanel;
