import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../routes/routeConfig';
import { useAppStore } from '../../store/useAppStore';
import { AppView, SessionMode } from '../../types';
import { DemoModeModal } from './DemoModeModal';
import { AnnaAssistantWidget } from './AnnaAssistantWidget';
import { EntryFooter } from './EntryFooter';
import { EntryTopBar } from './EntryTopBar';

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { currentUser, setCurrentView, setSessionMode, setCurrentUser, setDemoMode } =
    useAppStore();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'demo' | 'trial'>('trial');

  const handleTrialClick = () => {
    setModalMode('trial');
    setIsDemoModalOpen(true);
  };

  const handleDemoClick = () => {
    setModalMode('demo');
    setIsDemoModalOpen(true);
  };

  const handleContactClick = () => {
    navigate(ROUTES.LEGAL.CONTACT);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleModalSuccess = (user: any, mode: 'demo' | 'trial') => {
    setCurrentUser({ ...user, hasWorkspace: true } as any);
    setIsDemoModalOpen(false);
    setSessionMode(mode === 'demo' ? SessionMode.DEMO : SessionMode.FULL);
    if (mode === 'demo') setDemoMode(true);
    else setDemoMode(false);
    setCurrentView(AppView.DASHBOARD);
    navigate(ROUTES.AI_CHAT);
  };

  return (
    <div className="dark absolute inset-0 bg-[#0A0A1F] text-white overflow-y-auto overflow-x-hidden">
      <EntryTopBar
        onTrialClick={handleTrialClick}
        onDemoClick={handleDemoClick}
        onLoginClick={() => navigate('/login')}
        onRegisterClick={() => navigate('/register')}
        isLoggedIn={!!currentUser}
        hasWorkspace={!!currentUser?.hasWorkspace}
        forceDark
      />
      <main className="pt-14">{children}</main>
      <EntryFooter />
      <AnnaAssistantWidget
        onDemoClick={handleDemoClick}
        onTrialClick={handleTrialClick}
        onContactClick={handleContactClick}
      />
      <DemoModeModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onSuccess={handleModalSuccess}
        mode={modalMode}
      />
    </div>
  );
};
