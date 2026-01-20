/**
 * DiscoveryFooterActions - Footer action bar
 *
 * Contains primary actions: Start Project, Attach to Project, Save, etc.
 */

import { ChevronDown, FolderPlus, MessageSquare, Rocket, Save, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDiscoveryStore } from '@/store/useDiscoveryStore';

// Version selector dropdown
const VersionSelector: React.FC = () => {
  const { t } = useTranslation('discovery');
  const store = useDiscoveryStore();
  const getVersions = store.getVersions || (() => []);
  const loadVersion = store.loadVersion || (() => {});
  const saveVersion = store.saveVersion || (() => 0);
  const activeSessionId = store.activeSessionId;
  const [isOpen, setIsOpen] = useState(false);

  const versions = getVersions();
  const currentVersion = versions.length > 0 ? versions[versions.length - 1]?.version : 0;

  const handleSaveVersion = () => {
    const version = saveVersion();
    setIsOpen(false);
  };

  if (!activeSessionId) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-2 text-sm bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 rounded-lg transition-colors"
      >
        <span>v{currentVersion}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-700 min-w-[180px] z-20">
            <div className="p-2 border-b border-slate-100 dark:border-navy-700">
              <button
                onClick={handleSaveVersion}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
              >
                <Save size={14} />
                {t('discovery.version.save', 'Save version')}
              </button>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {versions.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400 text-center">
                  {t('discovery.version.noVersions', 'No saved versions')}
                </div>
              ) : (
                versions.map((v) => (
                  <button
                    key={v.version}
                    onClick={() => {
                      loadVersion(v.version);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
                  >
                    <span>v{v.version}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {new Date(v.createdAt).toLocaleTimeString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

interface FooterActionsProps {
  onStartProject?: () => void;
  onAttachToProject?: () => void;
  onContinueChat?: () => void;
}

export const DiscoveryFooterActions: React.FC<FooterActionsProps> = ({
  onStartProject,
  onAttachToProject,
  onContinueChat,
}) => {
  const { t } = useTranslation('discovery');
  const { saveSession, isSaving, recommendations, currentPhase } = useDiscoveryStore();

  const isDecisionPhase = currentPhase === 'decision' || currentPhase === 'recommendations';
  const hasRecommendations = recommendations.transformationType !== null;

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-navy-800 border-t border-slate-200 dark:border-navy-700">
      {/* Left: Version selector */}
      <div className="flex items-center gap-2">
        <VersionSelector />
      </div>

      {/* Right: Action buttons */}
      <div className="flex items-center gap-2">
        {/* Save button */}
        <button
          onClick={() => saveSession()}
          disabled={isSaving}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          <span className="hidden sm:inline">{t('discovery.actions.save', 'Save')}</span>
        </button>

        {/* Attach to project */}
        {hasRecommendations && (
          <button
            onClick={onAttachToProject}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 rounded-lg transition-colors"
          >
            <FolderPlus size={16} />
            <span className="hidden sm:inline">
              {t('discovery.actions.attachToProject', 'Attach to Project')}
            </span>
          </button>
        )}

        {/* Continue chat */}
        {!isDecisionPhase && (
          <button
            onClick={onContinueChat}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 rounded-lg transition-colors"
          >
            <MessageSquare size={16} />
            <span className="hidden sm:inline">
              {t('discovery.actions.continueChat', 'Continue')}
            </span>
          </button>
        )}

        {/* Start Project (primary action) */}
        {hasRecommendations && (
          <button
            onClick={onStartProject}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-all"
          >
            <Rocket size={16} />
            <span>{t('discovery.actions.startProject', 'Start Project')}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default DiscoveryFooterActions;
