import { ArrowRight, X } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { AppView, InitiativeStatus } from '../../types';
import { InitiativesTable } from './InitiativesTable';
import { InitiativeDetailsModal } from './modals/InitiativeDetailsModal';

type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

interface AssessmentInitiativesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  assessmentId: string | null;
  framework?: AssessmentFramework;
}

export const AssessmentInitiativesDrawer: React.FC<AssessmentInitiativesDrawerProps> = ({
  isOpen,
  onClose,
  projectId,
  assessmentId,
  framework,
}) => {
  const { setCurrentView } = useAppStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeInitiativeId, setActiveInitiativeId] = useState<string | null>(null);
  const [activeInitiativeStatus, setActiveInitiativeStatus] = useState<string | null>(null);
  const [showListView, setShowListView] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const canGoToInitiatives = activeInitiativeStatus === InitiativeStatus.PLANNING;

  const handleOpenInitiative = (initiativeId: string, _name: string, status?: string) => {
    setActiveInitiativeId(initiativeId);
    setActiveInitiativeStatus(status || null);
    setShowListView(false);
  };

  const handleCloseDetails = () => {
    setActiveInitiativeId(null);
    setActiveInitiativeStatus(null);
    setShowListView(true);
  };

  const handleEdit = (id: string) => {
    // Navigate to the full initiative document view from assessment context
    setCurrentView(AppView.FULL_STEP2_INITIATIVES);
    navigate(`/initiatives?open=${encodeURIComponent(id)}&mode=doc`);
  };

  const handleApprove = async (id: string) => {
    try {
      await Api.post(`/initiatives/${id}/submit-review`, {});
      toast.success(t('assessment.initiatives.submitted', 'Initiative submitted for review'));
      setRefreshKey((k) => k + 1);
      handleCloseDetails();
    } catch (e: any) {
      toast.error(
        e?.message || t('assessment.initiatives.approveFailed', 'Failed to approve initiative')
      );
    }
  };

  const handleAddToRoadmap = async (id: string) => {
    try {
      await Api.post(`/initiatives/${id}/transfer-to-roadmap`, {});
      toast.success(t('assessment.initiatives.addedToRoadmap', 'Added to roadmap'));
      setRefreshKey((k) => k + 1);
      handleCloseDetails();
    } catch (e: any) {
      toast.error(
        e?.message || t('assessment.initiatives.roadmapFailed', 'Failed to add to roadmap')
      );
    }
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="absolute inset-0 bg-black/20 z-20"
          onClick={onClose}
          aria-label={t('common.close', 'Close drawer')}
        />
      )}
      <div
        className={`absolute inset-y-0 right-0 z-30 w-full sm:w-1/2 bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 shadow-xl transform transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
          <div>
            <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
              {t('assessment.initiatives.title', 'Initiatives')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('assessment.initiatives.relatedHint', 'Related to the current assessment')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentView(AppView.FULL_STEP2_INITIATIVES)}
              disabled={!canGoToInitiatives}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                canGoToInitiatives
                  ? 'bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
              title={t(
                'assessment.initiatives.goAfterPlanning',
                'Go to Initiatives after PLANNING'
              )}
            >
              {t('assessment.initiatives.goTo', 'Go to Initiatives')}
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400"
              aria-label={t('common.close', 'Close drawer')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="h-full overflow-hidden">
          {activeInitiativeId && !showListView ? (
            <InitiativeDetailsModal
              initiativeId={activeInitiativeId}
              embedded={true}
              onClose={handleCloseDetails}
              onEdit={handleEdit}
              onApprove={handleApprove}
              onDelete={handleCloseDetails}
              onAddToRoadmap={handleAddToRoadmap}
            />
          ) : (
            <div className="h-full overflow-y-auto">
              <InitiativesTable
                key={refreshKey}
                projectId={projectId}
                framework={framework}
                assessmentId={assessmentId || undefined}
                onOpenInitiative={handleOpenInitiative}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};
