/**
 * DiscoveryConsultantView - Main view component
 *
 * Full-width canvas view for Discovery Interview.
 * Chat is now handled by the main chat panel in MainLayout (left side).
 * This component focuses on the discovery canvas and recommendations.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDiscoveryStore } from '@/store/useDiscoveryStore';

import { DiscoveryCanvas } from './DiscoveryCanvas';
import { DiscoveryFooterActions } from './DiscoveryFooterActions';
import { DiscoveryHeader } from './DiscoveryHeader';
import { useDiscoverySync } from './hooks/useDiscoverySync';
import { ProjectConversionModal } from './ProjectConversionModal';
import { RecommendationPanel } from './RecommendationPanel';

interface DiscoveryConsultantViewProps {
  onClose?: () => void;
}

export const DiscoveryConsultantView: React.FC<DiscoveryConsultantViewProps> = ({ onClose }) => {
  const { t } = useTranslation('discovery');

  // Local state
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Store hooks
  const { createSession, reset, recommendations } = useDiscoveryStore();

  // Sync hook - syncs chat messages with canvas
  useDiscoverySync();

  // Initialize session
  useEffect(() => {
    if (!isInitialized) {
      const sessionId = createSession();
      setIsInitialized(true);
      console.log('[DiscoveryConsultantView] Initialized session:', sessionId);
    }
  }, [isInitialized, createSession]);

  // Handlers
  const handleNewSession = useCallback(() => {
    reset();
    setIsInitialized(false);
  }, [reset]);

  const handleStartProject = useCallback(() => {
    setShowConversionModal(true);
  }, []);

  const handleAttachToProject = useCallback(() => {
    console.log('[DiscoveryConsultantView] Attach to project clicked');
  }, []);

  const handleContinueChat = useCallback(() => {
    // Focus the main chat input in the MainLayout chat panel
    const chatInput = document.querySelector('[data-chat-input]') as HTMLTextAreaElement;
    chatInput?.focus();
  }, []);

  const hasRecommendations = recommendations.transformationType !== null;

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-navy-950">
      {/* Header */}
      <DiscoveryHeader onNewSession={handleNewSession} />

      {/* Main content - full width canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Canvas - takes full width now */}
        <div className="flex-1 relative">
          <DiscoveryCanvas />
        </div>

        {/* Recommendations panel (collapsible) */}
        {hasRecommendations && showRecommendations && (
          <div className="h-[280px] border-t border-slate-200 dark:border-navy-700">
            <RecommendationPanel />
          </div>
        )}
      </div>

      {/* Footer actions */}
      <DiscoveryFooterActions
        onStartProject={handleStartProject}
        onAttachToProject={handleAttachToProject}
        onContinueChat={handleContinueChat}
      />

      {/* Conversion modal */}
      {showConversionModal && (
        <ProjectConversionModal
          onClose={() => setShowConversionModal(false)}
          onSuccess={(projectId) => {
            setShowConversionModal(false);
            console.log('[DiscoveryConsultantView] Project created:', projectId);
          }}
        />
      )}
    </div>
  );
};

export default DiscoveryConsultantView;
