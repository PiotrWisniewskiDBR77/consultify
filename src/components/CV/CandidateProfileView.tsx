/**
 * CandidateProfileView (T067)
 * N-mode artifact for CV-based candidate profile with competency mapping and matching.
 * Left nav (candidates), canvas (profile detail), properties strip (actions).
 */

import {
  AlertTriangle,
  Award,
  Check,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  Search,
  Shield,
  Star,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

interface Candidate {
  id: string;
  display_name: string;
  email: string | null;
  candidate_type: string;
  user_id?: string | null;
  document_count: number;
  approved_signals: number;
  created_at: string;
}

interface Signal {
  id: string;
  capability_id: string;
  capability_name: string;
  capability_domain: string;
  inferred_level: number;
  confidence: number;
  evidence_snippets: string;
  approved: boolean;
  manual_override_level: number | null;
}

interface Document {
  id: string;
  original_filename: string;
  file_type: string;
  file_size_bytes: number;
  status: string;
  uploaded_at: string;
}

interface MatchResult {
  candidateId: string;
  displayName: string;
  matchScore: number;
  explanation: Record<string, any>;
  missingEvidence: string[];
}

interface CandidateProfileViewProps {
  organizationId: string;
  locked?: boolean;
}

type Tab = 'profile' | 'competencies' | 'matches';

export const CandidateProfileView: React.FC<CandidateProfileViewProps> = ({
  organizationId,
  locked = false,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [isUploading, setIsUploading] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newType, setNewType] = useState('internal');
  const [searchQuery, setSearchQuery] = useState('');
  const [matchInitiativeId, setMatchInitiativeId] = useState('');

  useEffect(() => {
    loadCandidates();
  }, [organizationId]);

  useEffect(() => {
    if (selectedId) {
      loadCandidateDetail(selectedId);
    }
  }, [selectedId]);

  const loadCandidates = async () => {
    try {
      const res = await Api.get('/api/cv-matching/candidates');
      if (Array.isArray(res)) setCandidates(res);
    } catch {
      /* ignore */
    }
  };

  const loadCandidateDetail = async (id: string) => {
    try {
      const [c, docs, sigs] = await Promise.all([
        Api.get(`/api/cv-matching/candidates/${id}`),
        Api.get(`/api/cv-matching/candidates/${id}/documents`),
        Api.get(`/api/cv-matching/candidates/${id}/signals`),
      ]);
      if (c?.id) setCandidate(c);
      if (Array.isArray(docs)) setDocuments(docs);
      if (Array.isArray(sigs)) setSignals(sigs);
    } catch {
      /* ignore */
    }
  };

  const handleAddCandidate = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      const res = await Api.post('/api/cv-matching/candidates', {
        displayName: newName,
        email: newEmail || undefined,
        candidateType: newType,
      });
      if (res?.id) {
        setShowAddModal(false);
        setNewName('');
        setNewEmail('');
        await loadCandidates();
        setSelectedId(res.id);
      }
    } catch {
      /* ignore */
    }
  }, [newName, newEmail, newType]);

  const handleUploadCV = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedId || !e.target.files?.[0]) return;
      setIsUploading(true);
      const formData = new FormData();
      formData.append('cv', e.target.files[0]);
      try {
        const res = await fetch(`/api/cv-matching/candidates/${selectedId}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          trackFunnelEvent('cv_uploaded');
          await loadCandidateDetail(selectedId);
        }
      } catch {
        /* ignore */
      }
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [selectedId]
  );

  const handleMapCompetencies = useCallback(
    async (documentId: string) => {
      setIsMapping(true);
      try {
        const res = await Api.post(`/api/cv-matching/documents/${documentId}/map`, {});
        if (res?.success) {
          trackFunnelEvent('cv_extracted');
          if (selectedId) await loadCandidateDetail(selectedId);
        }
      } catch {
        /* ignore */
      }
      setIsMapping(false);
    },
    [selectedId]
  );

  const handleApproveSignal = useCallback(
    async (signalId: string, overrideLevel?: number) => {
      try {
        await Api.put(`/api/cv-matching/signals/${signalId}/approve`, { overrideLevel });
        trackFunnelEvent('cv_competencies_approved');
        if (selectedId) await loadCandidateDetail(selectedId);
      } catch {
        /* ignore */
      }
    },
    [selectedId]
  );

  const handleRejectSignal = useCallback(
    async (signalId: string) => {
      try {
        await Api.delete(`/api/cv-matching/signals/${signalId}`);
        if (selectedId) await loadCandidateDetail(selectedId);
      } catch {
        /* ignore */
      }
    },
    [selectedId]
  );

  const handleMatch = useCallback(async () => {
    if (!matchInitiativeId.trim()) return;
    setIsMatching(true);
    try {
      const res = await Api.post(`/api/cv-matching/match/${matchInitiativeId}`, {});
      if (Array.isArray(res)) {
        setMatches(res);
        trackFunnelEvent('cv_match_viewed');
      }
    } catch {
      /* ignore */
    }
    setIsMatching(false);
  }, [matchInitiativeId]);

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      try {
        await Api.delete(`/api/cv-matching/documents/${documentId}`);
        if (selectedId) await loadCandidateDetail(selectedId);
      } catch {
        /* ignore */
      }
    },
    [selectedId]
  );

  const handleApplyToProfile = useCallback(async () => {
    if (!selectedId || !candidate?.user_id) return;
    try {
      const res = await Api.post(`/api/cv-matching/candidates/${selectedId}/apply-to-profile`, {
        userId: candidate.user_id,
      });
      if (res?.success) {
        trackFunnelEvent('cv_match_applied');
      }
    } catch {
      /* ignore */
    }
  }, [selectedId, candidate]);

  const filteredCandidates = useMemo(() => {
    if (!searchQuery) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter(
      (c) => c.display_name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
    );
  }, [candidates, searchQuery]);

  const confidenceColor = (c: number) => {
    if (c >= 0.7) return 'text-green-600';
    if (c >= 0.5) return 'text-yellow-600';
    return 'text-danger-600';
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      uploaded: 'bg-gray-100 text-gray-600',
      extracting: 'bg-blue-100 text-blue-600',
      extracted: 'bg-blue-100 text-blue-700',
      mapping: 'bg-yellow-100 text-yellow-700',
      mapped: 'bg-green-100 text-green-700',
      ready: 'bg-green-100 text-green-800',
      error: 'bg-danger-100 text-danger-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      {/* Left Nav — Candidate list */}
      <nav className="w-full lg:w-72 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('cv.searchCandidates', 'Search candidates...')}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800
                text-xs text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            title={t('cv.addCandidate', 'Add Candidate')}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <ul className="space-y-1 max-h-[calc(100vh-200px)] overflow-auto">
          {filteredCandidates.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(c.id);
                  setActiveTab('profile');
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all
                  ${
                    selectedId === c.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.display_name}</p>
                    <p className="text-xs text-gray-600">
                      {c.document_count} {t('cv.docs', 'docs')} · {c.approved_signals}{' '}
                      {t('cv.skills', 'skills')}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          ))}
          {filteredCandidates.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-4">
              {t('cv.noCandidates', 'No candidates yet')}
            </p>
          )}
        </ul>
      </nav>

      {/* Canvas */}
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <User className="w-12 h-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('cv.selectCandidate', 'Select a Candidate')}
            </h3>
            <p className="text-sm text-gray-500 max-w-md">
              {t(
                'cv.selectHint',
                'Choose a candidate from the list or add a new one to start CV analysis.'
              )}
            </p>
          </div>
        ) : (
          <div className="max-w-3xl">
            {/* Disclaimer */}
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t(
                  'cv.disclaimer',
                  'Assistive ranking only — not a hiring decision. All mappings require human approval.'
                )}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
              {(['profile', 'competencies', 'matches'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
                    ${
                      activeTab === tab
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {tab === 'profile' && t('cv.tabProfile', 'Profile & Documents')}
                  {tab === 'competencies' && t('cv.tabCompetencies', 'Competencies')}
                  {tab === 'matches' && t('cv.tabMatches', 'Matching')}
                </button>
              ))}
            </div>

            {/* Profile Tab */}
            {activeTab === 'profile' && candidate && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <User className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {candidate.display_name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {candidate.email || ''} · {candidate.candidate_type}
                    </p>
                  </div>
                </div>

                {/* Documents */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {t('cv.documents', 'CV Documents')}
                    </h3>
                    {!locked && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.docx,.txt"
                          onChange={handleUploadCV}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {isUploading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Upload className="w-3 h-3" />
                          )}
                          {t('cv.uploadCV', 'Upload CV')}
                        </button>
                      </>
                    )}
                  </div>

                  {documents.length === 0 ? (
                    <p className="text-sm text-gray-600">
                      {t('cv.noDocuments', 'No documents uploaded yet.')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-600" />
                            <div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {doc.original_filename}
                              </p>
                              <p className="text-xs text-gray-600">
                                {(doc.file_size_bytes / 1024).toFixed(0)} KB ·{' '}
                                <span
                                  className={`px-1.5 py-0.5 rounded text-xs ${statusBadge(doc.status)}`}
                                >
                                  {doc.status}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {doc.status === 'extracted' && !locked && (
                              <button
                                onClick={() => handleMapCompetencies(doc.id)}
                                disabled={isMapping}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                              >
                                {isMapping ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Zap className="w-3 h-3" />
                                )}
                                {t('cv.mapCompetencies', 'Map')}
                              </button>
                            )}
                            {!locked && (
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="p-1 text-danger-400 hover:text-danger-600 hover:bg-danger-50 rounded"
                                title={t('cv.deleteCV', 'Delete (right to be forgotten)')}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Competencies Tab */}
            {activeTab === 'competencies' && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  {t('cv.mappedCompetencies', 'Mapped Competencies')}
                </h3>
                {signals.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    {t('cv.noSignals', 'No competencies mapped yet. Upload a CV and run mapping.')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {signals.map((sig) => {
                      const evidences =
                        typeof sig.evidence_snippets === 'string'
                          ? JSON.parse(sig.evidence_snippets)
                          : sig.evidence_snippets || [];
                      const effectiveLevel = sig.manual_override_level || sig.inferred_level;
                      return (
                        <div
                          key={sig.id}
                          className={`p-3 rounded-lg border ${
                            sig.approved
                              ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-indigo-500" />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {sig.capability_name || sig.capability_id}
                              </span>
                              {sig.capability_domain && (
                                <span className="text-xs text-gray-600">
                                  ({sig.capability_domain})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }, (_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-3 h-3 ${i < effectiveLevel ? 'text-indigo-500 fill-indigo-500' : 'text-gray-200'}`}
                                  />
                                ))}
                              </div>
                              <span
                                className={`text-xs font-medium ${confidenceColor(sig.confidence)}`}
                              >
                                {Math.round(sig.confidence * 100)}%
                              </span>
                            </div>
                          </div>

                          {evidences.length > 0 && (
                            <div className="mt-2 pl-6">
                              {evidences.slice(0, 2).map((ev: string, i: number) => (
                                <p
                                  key={i}
                                  className="text-xs text-gray-500 dark:text-gray-400 italic mb-1"
                                >
                                  "{ev}"
                                </p>
                              ))}
                            </div>
                          )}

                          {!sig.approved && !locked && (
                            <div className="flex items-center gap-2 mt-2 pl-6">
                              <button
                                onClick={() => handleApproveSignal(sig.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100"
                              >
                                <Check className="w-3 h-3" /> {t('cv.approve', 'Approve')}
                              </button>
                              <button
                                onClick={() => handleRejectSignal(sig.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-danger-50 text-danger-700 rounded hover:bg-danger-100"
                              >
                                <X className="w-3 h-3" /> {t('cv.reject', 'Reject')}
                              </button>
                            </div>
                          )}
                          {sig.approved && (
                            <div className="flex items-center gap-1 mt-1 pl-6">
                              <UserCheck className="w-3 h-3 text-green-500" />
                              <span className="text-xs text-green-600">
                                {t('cv.approved', 'Approved')}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Matches Tab */}
            {activeTab === 'matches' && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    value={matchInitiativeId}
                    onChange={(e) => setMatchInitiativeId(e.target.value)}
                    placeholder={t('cv.initiativeIdPlaceholder', 'Initiative ID')}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800
                      text-sm text-gray-700 dark:text-gray-300"
                  />
                  <button
                    onClick={handleMatch}
                    disabled={isMatching || !matchInitiativeId.trim()}
                    className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isMatching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    {t('cv.runMatching', 'Match')}
                  </button>
                </div>

                {matches.length > 0 && (
                  <div className="space-y-3">
                    {matches.map((m, idx) => (
                      <div
                        key={m.candidateId}
                        className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              {m.displayName}
                            </span>
                          </div>
                          <span
                            className={`text-lg font-bold ${m.matchScore >= 70 ? 'text-green-600' : m.matchScore >= 40 ? 'text-yellow-600' : 'text-danger-600'}`}
                          >
                            {m.matchScore}%
                          </span>
                        </div>

                        {Object.entries(m.explanation).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {Object.entries(m.explanation).map(([cap, detail]: [string, any]) => (
                              <div key={cap} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400">{cap}</span>
                                <span
                                  className={detail.meets ? 'text-green-600' : 'text-danger-500'}
                                >
                                  {detail.actual}/{detail.required} {detail.meets ? '✓' : '✗'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {m.missingEvidence.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-amber-600">
                              {t('cv.missingEvidence', 'Missing evidence')}:{' '}
                              {m.missingEvidence.join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Properties Strip */}
      <aside className="hidden xl:block w-56 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          {t('cv.properties', 'Properties')}
        </h3>

        {candidate && (
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-600 text-xs">{t('cv.type', 'Type')}</span>
              <p className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                {candidate.candidate_type}
              </p>
            </div>
            <div>
              <span className="text-gray-600 text-xs">{t('cv.documentsCount', 'Documents')}</span>
              <p className="font-medium text-gray-700 dark:text-gray-300">{documents.length}</p>
            </div>
            <div>
              <span className="text-gray-600 text-xs">
                {t('cv.approvedSkills', 'Approved Skills')}
              </span>
              <p className="font-medium text-gray-700 dark:text-gray-300">
                {signals.filter((s) => s.approved).length} / {signals.length}
              </p>
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
              {(candidate as any).user_id && !locked && (
                <button
                  onClick={handleApplyToProfile}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium
                    bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <UserPlus className="w-3 h-3" /> {t('cv.applyToProfile', 'Apply to User Profile')}
                </button>
              )}
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-1">
                <Shield className="w-3 h-3 text-gray-600 mt-0.5" />
                <p className="text-xs text-gray-600">
                  {t(
                    'cv.privacyNote',
                    'PII is redacted from AI processing. CV data subject to retention policy.'
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Add Candidate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
              {t('cv.addCandidate', 'Add Candidate')}
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('cv.namePlaceholder', 'Full Name')}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t('cv.emailPlaceholder', 'Email (optional)')}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="internal">{t('cv.typeInternal', 'Internal')}</option>
                <option value="external">{t('cv.typeExternal', 'External')}</option>
                <option value="vendor">{t('cv.typeVendor', 'Vendor')}</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-gray-500"
              >
                {t('cv.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleAddCandidate}
                disabled={!newName.trim()}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50"
              >
                {t('cv.create', 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
