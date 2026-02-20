import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useModuleVideoHelp } from '../../hooks/useModuleVideoHelp';
import { MicroVideoHelpModal } from './MicroVideoHelpModal';

/**
 * Maps URL path segments to module IDs used in the video registry.
 * Only modules with registered tutorial videos will trigger the modal.
 */
function pathToModuleId(pathname: string): string | null {
  const p = pathname.toLowerCase().replace(/^\/+|\/+$/g, '');
  const first = p.split('/')[0] || '';

  const map: Record<string, string> = {
    dashboard: 'dashboard',
    assessment: 'assessment',
    initiatives: 'initiatives',
    roadmap: 'roadmap',
    reports: 'reports',
    chat: 'ai_chat',
    'ai-chat': 'ai_chat',
    execution: 'execution',
    portfolio: 'portfolio',
    interview: 'interview',
    'my-work': 'my-work',
    mywork: 'my-work',
  };

  return map[first] || null;
}

export const MicroVideoHelpTrigger: React.FC = () => {
  const location = useLocation();
  const moduleId = pathToModuleId(location.pathname);

  const { shouldShow, video, dismiss, trackEvent, loading } = useModuleVideoHelp(moduleId);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading && shouldShow && video) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
    setVisible(false);
    return undefined;
  }, [loading, shouldShow, video]);

  const handleWatch = useCallback(async () => {
    await trackEvent('view_started');
  }, [trackEvent]);

  const handleSkip = useCallback(async () => {
    await trackEvent('view_skipped');
    await dismiss('skipped');
    setVisible(false);
  }, [dismiss, trackEvent]);

  const handleDontShow = useCallback(async () => {
    await trackEvent('dont_show_again');
    await dismiss('dont_show_again');
    setVisible(false);
  }, [dismiss, trackEvent]);

  const handleClose = useCallback(async () => {
    await dismiss('skipped');
    setVisible(false);
  }, [dismiss]);

  if (!visible || !video) return null;

  return (
    <MicroVideoHelpModal
      video={video}
      onWatch={handleWatch}
      onSkip={handleSkip}
      onDontShowAgain={handleDontShow}
      onClose={handleClose}
    />
  );
};

export default MicroVideoHelpTrigger;
