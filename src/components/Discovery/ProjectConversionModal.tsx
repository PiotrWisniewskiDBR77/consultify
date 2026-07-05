/**
 * ProjectConversionModal - Modal for converting discovery to project
 *
 * Allows user to create a new project from discovery session.
 */

import {
  AlertCircle,
  ArrowRight,
  Check,
  ClipboardList,
  Lightbulb,
  Loader2,
  MessageSquare,
  Rocket,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDiscoveryStore } from '@/store/useDiscoveryStore';

interface ProjectConversionModalProps {
  onClose: () => void;
  onSuccess: (projectId: string) => void;
}

export const ProjectConversionModal: React.FC<ProjectConversionModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation('discovery');

  const { convertToProject, clientContext, recommendations, painPointsCount, insightsCount } =
    useDiscoveryStore();

  const [projectName, setProjectName] = useState(
    clientContext.companyName
      ? `Discovery: ${clientContext.companyName}`
      : t('discovery.conversion.defaultName', 'Discovery Project')
  );
  const [createInitiatives, setCreateInitiatives] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = useCallback(async () => {
    if (!projectName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const projectId = await convertToProject(projectName, { createInitiatives });
      onSuccess(projectId);
    } catch (err: any) {
      setError(err?.message || t('discovery.conversion.error', 'Failed to create project'));
    } finally {
      setIsLoading(false);
    }
  }, [projectName, createInitiatives, convertToProject, onSuccess, t]);

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-navy-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
              <Rocket size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900 dark:text-white">
                {t('discovery.conversion.title', 'Create Project from Discovery')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t(
                  'discovery.actions.startProjectDesc',
                  'Create transformation project with this data'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Project name input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('discovery.conversion.projectName', 'Project name')}
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl text-navy-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nazwa projektu..."
            />
          </div>

          {/* What will be transferred */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              {t('discovery.conversion.whatWillBeTransferred', 'What will be transferred')}
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
                <AlertCircle size={18} className="text-danger-500" />
                <span className="text-sm text-danger-700 dark:text-danger-300">
                  {t('discovery.conversion.painPointsCount', '{{count}} pain points', {
                    count: painPointsCount,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <Lightbulb size={18} className="text-amber-500" />
                <span className="text-sm text-amber-700 dark:text-amber-300">
                  {t('discovery.conversion.insightsCount', '{{count}} insights', {
                    count: insightsCount,
                  })}
                </span>
              </div>
              {recommendations.transformationType && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <ArrowRight size={18} className="text-blue-500" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {t(
                      'discovery.conversion.recommendedTransformation',
                      'Recommended transformation'
                    )}
                    :{' '}
                    <strong>
                      {t(`discovery.transformationType.${recommendations.transformationType}`)}
                    </strong>
                  </span>
                </div>
              )}
              {recommendations.frameworks.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <ClipboardList size={18} className="text-blue-500" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {t(
                      'discovery.conversion.suggestedAssessments',
                      '{{count}} suggested assessments',
                      {
                        count: recommendations.frameworks.length,
                      }
                    )}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-900 rounded-lg">
                <MessageSquare size={18} className="text-slate-500 dark:text-slate-400" />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {t('discovery.conversion.conversationHistory', 'Full conversation history')}
                </span>
              </div>
            </div>
          </div>

          {/* Create initiatives checkbox */}
          {recommendations.initiatives.length > 0 && (
            <label className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors">
              <input
                type="checkbox"
                checked={createInitiatives}
                onChange={(e) => setCreateInitiatives(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 dark:border-navy-700 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  {t('discovery.conversion.createInitiatives', 'Create initiatives from ideas')}
                </span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400 ml-2">
                  ({recommendations.initiatives.length})
                </span>
              </div>
            </label>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg text-danger-600 dark:text-danger-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Anuluj
          </button>
          <button
            onClick={handleConvert}
            disabled={isLoading || !projectName.trim()}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('discovery.conversion.converting', 'Creating project...')}
              </>
            ) : (
              <>
                <Rocket size={16} />
                {t('discovery.actions.startProject', 'Start Project')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectConversionModal;
