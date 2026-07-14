/**
 * EvidenceSection
 * Evidence & Acceptance management for tasks
 * Tracks required evidence and sign-off status
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileCheck,
  FileText,
  Monitor,
  Plus,
  Shield,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type EvidenceType = 'DOCUMENT' | 'DATA' | 'DEMO' | 'APPROVAL';

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  urlOrFileId?: string;
  createdBy?: string;
  createdAt?: string;
  verified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
}

interface EvidenceSectionProps {
  evidenceRequired: EvidenceType[];
  evidenceItems: EvidenceItem[];
  requiresAcceptance: boolean;
  acceptanceType: 'manual' | 'automatic' | null;
  acceptorId: string | null;
  acceptorName?: string;
  signedOff: boolean;
  signedOffAt?: string;
  signedOffBy?: string;
  availableUsers: { id: string; name: string }[];
  onEvidenceRequiredChange: (types: EvidenceType[]) => void;
  onAddEvidence: (item: Omit<EvidenceItem, 'id'>) => void;
  onRemoveEvidence: (id: string) => void;
  onVerifyEvidence: (id: string) => void;
  onAcceptanceChange: (
    requires: boolean,
    type: 'manual' | 'automatic' | null,
    acceptorId: string | null
  ) => void;
  onSignOff: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  readOnly?: boolean;
}

const EVIDENCE_TYPES: Record<
  EvidenceType,
  { label: { en: string; pl: string }; icon: React.ElementType; color: string }
> = {
  DOCUMENT: {
    label: { en: 'Document', pl: 'Dokument' },
    icon: FileText,
    color: 'text-blue-500',
  },
  DATA: {
    label: { en: 'Data', pl: 'Dane' },
    icon: FileCheck,
    color: 'text-emerald-500',
  },
  DEMO: {
    label: { en: 'Demo', pl: 'Demo' },
    icon: Monitor,
    color: 'text-primary-500',
  },
  APPROVAL: {
    label: { en: 'Approval', pl: 'Zatwierdzenie' },
    icon: Shield,
    color: 'text-amber-500',
  },
};

export const EvidenceSection: React.FC<EvidenceSectionProps> = ({
  evidenceRequired,
  evidenceItems,
  requiresAcceptance,
  acceptanceType,
  acceptorId,
  acceptorName,
  signedOff,
  signedOffAt,
  signedOffBy,
  availableUsers,
  onEvidenceRequiredChange,
  onAddEvidence,
  onRemoveEvidence,
  onVerifyEvidence,
  onAcceptanceChange,
  onSignOff,
  expanded = false,
  onToggleExpand,
  readOnly = false,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [newEvidenceType, setNewEvidenceType] = useState<EvidenceType>('DOCUMENT');
  const [newEvidenceTitle, setNewEvidenceTitle] = useState('');

  const completedEvidence = evidenceItems.filter((e) => e.verified).length;
  const totalRequired = evidenceRequired.length;
  const isComplete = totalRequired === 0 || completedEvidence >= totalRequired;

  const handleAddEvidence = () => {
    if (!newEvidenceTitle.trim()) return;
    onAddEvidence({
      type: newEvidenceType,
      title: newEvidenceTitle.trim(),
      createdAt: new Date().toISOString(),
    });
    setNewEvidenceTitle('');
    setShowAddEvidence(false);
  };

  const toggleEvidenceRequired = (type: EvidenceType) => {
    if (evidenceRequired.includes(type)) {
      onEvidenceRequiredChange(evidenceRequired.filter((t) => t !== type));
    } else {
      onEvidenceRequiredChange([...evidenceRequired, type]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
    >
      {/* Collapsible Header */}
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl ${signedOff ? 'bg-emerald-500/10 dark:bg-emerald-500/20' : 'bg-amber-500/10 dark:bg-amber-500/20'}`}
          >
            <ClipboardCheck
              size={18}
              className={
                signedOff
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : 'text-amber-500 dark:text-amber-400'
              }
            />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('myWork.evidence.evidenceAcceptance', 'Evidence & Acceptance')}
          </span>
          {signedOff && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={10} />
              {t('myWork.evidence.signedOff', 'Signed off')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {evidenceItems.length > 0 && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
              {completedEvidence}/{evidenceItems.length}
            </span>
          )}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
          </motion.div>
        </div>
      </motion.button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Evidence Required */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  {t('myWork.evidence.requiredEvidence', 'Required Evidence')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(EVIDENCE_TYPES).map(([type, config]) => {
                    const Icon = config.icon;
                    const isSelected = evidenceRequired.includes(type as EvidenceType);
                    return (
                      <button
                        key={type}
                        onClick={() => !readOnly && toggleEvidenceRequired(type as EvidenceType)}
                        disabled={readOnly}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isSelected
                            ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-500/50'
                            : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-600 hover:border-primary-300 dark:hover:border-primary-500/50'
                        }`}
                      >
                        <Icon size={12} className={isSelected ? config.color : ''} />
                        {isPolish ? config.label.pl : config.label.en}
                        {isSelected && <Check size={10} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Evidence Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t('myWork.evidence.attachedEvidence', 'Attached Evidence')}
                  </label>
                  {!readOnly && (
                    <button
                      onClick={() => setShowAddEvidence(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors"
                    >
                      <Plus size={12} />
                      {t('myWork.evidence.add', 'Add')}
                    </button>
                  )}
                </div>

                {evidenceItems.length === 0 ? (
                  <div className="text-center py-4 border border-dashed border-slate-200 dark:border-navy-700 rounded-lg">
                    <Upload
                      size={20}
                      className="mx-auto mb-1 text-slate-700 dark:text-slate-400"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      {t('myWork.evidence.noEvidenceAttached', 'No evidence attached')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {evidenceItems.map((item) => {
                      const typeConfig = EVIDENCE_TYPES[item.type];
                      const Icon = typeConfig.icon;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                            item.verified
                              ? 'bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                              : 'bg-slate-50 dark:bg-navy-800/50 border-slate-200 dark:border-navy-600'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Icon size={14} className={typeConfig.color} />
                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                              {item.title}
                            </span>
                            {item.verified && (
                              <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {!item.verified && !readOnly && (
                              <button
                                onClick={() => onVerifyEvidence(item.id)}
                                className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-slate-500 dark:text-slate-400 hover:text-emerald-600 transition-colors"
                                title={t('myWork.evidence.title', 'Verify')}
                              >
                                <Check size={14} />
                              </button>
                            )}
                            {!readOnly && (
                              <button
                                onClick={() => onRemoveEvidence(item.id)}
                                className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-500/20 text-slate-500 dark:text-slate-400 hover:text-danger-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Acceptance Settings */}
              <div className="border-t border-slate-200 dark:border-navy-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t('myWork.evidence.requiresAcceptance', 'Requires Acceptance')}
                  </label>
                  <button
                    onClick={() =>
                      !readOnly &&
                      onAcceptanceChange(!requiresAcceptance, acceptanceType, acceptorId)
                    }
                    disabled={readOnly}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      requiresAcceptance ? 'bg-navy-900' : 'bg-slate-300 dark:bg-navy-600'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        requiresAcceptance ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {requiresAcceptance && (
                  <div className="space-y-3 pl-2 border-l-2 border-primary-200 dark:border-primary-500/30">
                    {/* Acceptance Type */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => !readOnly && onAcceptanceChange(true, 'manual', acceptorId)}
                        disabled={readOnly}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          acceptanceType === 'manual'
                            ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-500/50'
                            : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-600'
                        }`}
                      >
                        <User size={12} className="inline mr-1" />
                        {t('myWork.evidence.manual', 'Manual')}
                      </button>
                      <button
                        onClick={() =>
                          !readOnly && onAcceptanceChange(true, 'automatic', acceptorId)
                        }
                        disabled={readOnly}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          acceptanceType === 'automatic'
                            ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-500/50'
                            : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-600'
                        }`}
                      >
                        <Check size={12} className="inline mr-1" />
                        {t('myWork.evidence.automatic', 'Automatic')}
                      </button>
                    </div>

                    {/* Acceptor */}
                    {acceptanceType === 'manual' && (
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {t('myWork.evidence.acceptor', 'Acceptor')}
                        </label>
                        <select
                          value={acceptorId || ''}
                          onChange={(e) =>
                            !readOnly && onAcceptanceChange(true, 'manual', e.target.value || null)
                          }
                          disabled={readOnly}
                          className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-400"
                        >
                          <option value="">{t('myWork.evidence.select', 'Select...')}</option>
                          {availableUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sign Off */}
              {!readOnly && isComplete && !signedOff && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onSignOff}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-medium hover:brightness-110 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle2 size={18} />
                  <span>{t('myWork.evidence.signOff', 'Sign Off')}</span>
                </motion.button>
              )}

              {/* Sign Off Status */}
              {signedOff && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                  <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={16} />
                    <span>
                      {t('myWork.evidence.signedOffBy', 'Signed off by')} {signedOffBy || 'Unknown'}
                      {signedOffAt && (
                        <span className="text-emerald-600/70 dark:text-emerald-400/70 ml-1">
                          ({new Date(signedOffAt).toLocaleDateString()})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Evidence Modal */}
      <AnimatePresence>
        {showAddEvidence && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAddEvidence(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {t('myWork.evidence.addEvidence', 'Add Evidence')}
                </h3>
                <button
                  onClick={() => setShowAddEvidence(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 dark:text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {t('myWork.evidence.type', 'Type')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(EVIDENCE_TYPES).map(([type, config]) => {
                      const Icon = config.icon;
                      return (
                        <button
                          key={type}
                          onClick={() => setNewEvidenceType(type as EvidenceType)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            newEvidenceType === type
                              ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-500/50'
                              : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-600'
                          }`}
                        >
                          <Icon
                            size={12}
                            className={newEvidenceType === type ? config.color : ''}
                          />
                          {isPolish ? config.label.pl : config.label.en}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {t('myWork.evidence.title2', 'Title')}
                  </label>
                  <input
                    type="text"
                    value={newEvidenceTitle}
                    onChange={(e) => setNewEvidenceTitle(e.target.value)}
                    placeholder={t('myWork.evidence.placeholder', 'Evidence name...')}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-primary-400"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleAddEvidence}
                  disabled={!newEvidenceTitle.trim()}
                  className="w-full px-4 py-2.5 rounded-lg bg-c-text text-c-bg font-medium hover:bg-c-text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('myWork.evidence.add2', 'Add')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EvidenceSection;
