import React, { useEffect, useCallback, useState } from 'react';
import { FullStep1Workspace } from '../components/FullStep1Workspace';
import { AppView, AxisId, SessionMode } from '../types';
import { translations } from '../translations';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { MaturityMatrix } from '../components/MaturityMatrix';
import { DRD_STRUCTURE } from '../services/drdStructure';

// Helper Map to get numeric ID
const AXIS_ID_MAP: Record<AxisId, number> = {
  'processes': 1,
  'digitalProducts': 2,
  'businessModels': 3,
  'dataManagement': 4,
  'culture': 5,
  'cybersecurity': 6,
  'aiMaturity': 7
};

export const FullAssessmentView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    currentView: currentAppView,
    setCurrentView: onNavigate,
    setFullSessionData: updateFullSession,
    currentProjectId
  } = useAppStore();

  const language = currentUser?.preferredLanguage || 'EN';

  // Map AppView to AxisId
  const getAxisFromView = (view: AppView): AxisId | null => {
    switch (view) {
      case AppView.FULL_STEP1_PROCESSES: return 'processes';
      case AppView.FULL_STEP1_DIGITAL: return 'digitalProducts';
      case AppView.FULL_STEP1_MODELS: return 'businessModels';
      case AppView.FULL_STEP1_DATA: return 'dataManagement';
      case AppView.FULL_STEP1_CULTURE: return 'culture';
      case AppView.FULL_STEP1_CYBERSECURITY: return 'cybersecurity';
      case AppView.FULL_STEP1_AI: return 'aiMaturity';
      default: return null;
    }
  };

  const currentAxisId = getAxisFromView(currentAppView);

  // Load Data on Mount
  useEffect(() => {
    const loadSession = async () => {
      if (!currentUser) return;
      const data = await Api.getSession(currentUser.id, SessionMode.FULL, currentProjectId || undefined);
      if (data) {
        updateFullSession(data);
      }
    };
    loadSession();
  }, [currentUser, currentProjectId, updateFullSession]);

  const handleScoreSelect = useCallback(async (axisId: AxisId, areaId: string, level: number) => {
    const currentAxisData = fullSession.assessment[axisId];
    const newAreaScores = { ...currentAxisData.areaScores, [areaId]: level };

    // Also update generic 'answers' for backward compatibility or simple averaging if needed
    // But we rely on areaScores now. 

    const updatedAssessment = { ...fullSession.assessment };
    updatedAssessment[axisId] = {
      ...currentAxisData,
      areaScores: newAreaScores,
      status: 'IN_PROGRESS'
    };

    const newSessionData = { ...fullSession, assessment: updatedAssessment };
    updateFullSession(newSessionData);

    // Save periodically/debounced usually, but here immediate for safety
    await Api.saveSession(currentUser!.id, SessionMode.FULL, newSessionData, currentProjectId || undefined);
  }, [fullSession, updateFullSession, currentUser, currentProjectId]);

  const handleAxisComplete = useCallback(async (axisId: AxisId) => {
    const currentAxisData = fullSession.assessment[axisId];
    const scores = Object.values(currentAxisData.areaScores || {});
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    const updatedAssessment = { ...fullSession.assessment };
    updatedAssessment[axisId] = {
      ...currentAxisData,
      score: avg,
      status: 'COMPLETED'
    };

    if (!updatedAssessment.completedAxes.includes(axisId)) {
      updatedAssessment.completedAxes.push(axisId);
    }

    const newSessionData = { ...fullSession, assessment: updatedAssessment };
    updateFullSession(newSessionData);
    await Api.saveSession(currentUser!.id, SessionMode.FULL, newSessionData, currentProjectId || undefined);

    // Navigate back to dashboard
    onNavigate(AppView.FULL_STEP1_ASSESSMENT);

  }, [fullSession, updateFullSession, onNavigate, currentUser, currentProjectId]);


  // If no specific axis view is selected, show the Dashboard (Step1Workspace)
  if (!currentAxisId) {
    return (
      <div className="w-full h-full flex flex-col">
        <FullStep1Workspace
          fullSession={fullSession}
          currentAxisId={undefined}
          onStartAxis={(id) => {
            const viewMap: Record<string, AppView> = {
              'processes': AppView.FULL_STEP1_PROCESSES,
              'digitalProducts': AppView.FULL_STEP1_DIGITAL,
              'businessModels': AppView.FULL_STEP1_MODELS,
              'dataManagement': AppView.FULL_STEP1_DATA,
              'culture': AppView.FULL_STEP1_CULTURE,
              'cybersecurity': AppView.FULL_STEP1_CYBERSECURITY,
              'aiMaturity': AppView.FULL_STEP1_AI
            };
            onNavigate(viewMap[id]);
          }}
          onNextStep={() => onNavigate(AppView.FULL_STEP2_INITIATIVES)}
          language={language}
        />
      </div>
    );
  }

  // If Axis is selected, show Matrix
  return (
    <div className="w-full h-full p-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <button
        onClick={() => onNavigate(AppView.FULL_STEP1_ASSESSMENT)}
        className="mb-4 flex items-center gap-2 text-slate-500 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white transition-colors"
      >
        ← Back to Assessment Dashboard
      </button>

      <MaturityMatrix
        axisId={AXIS_ID_MAP[currentAxisId]}
        axisKey={currentAxisId}
        currentScores={fullSession.assessment[currentAxisId].areaScores || {}}
        onScoreSelect={(areaId, level) => handleScoreSelect(currentAxisId, areaId, level)}
        onComplete={() => handleAxisComplete(currentAxisId)}
      />
    </div>
  );
};
