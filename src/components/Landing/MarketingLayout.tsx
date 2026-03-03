import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EntryFooter } from './EntryFooter';
import { EntryTopBar } from './EntryTopBar';
import { DemoModeModal } from './DemoModeModal';
import { useAppStore } from '../../store/useAppStore';
import { Api } from '../../services/api';
import { AppView, SessionMode } from '../../types';

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { currentUser, setCurrentView, setSessionMode, setCurrentUser } = useAppStore();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const handleDemoStart = async () => {
    try {
      const demoUser = await Api.demoLogin();
      setCurrentUser({ ...demoUser, hasWorkspace: true } as any);
      setIsDemoModalOpen(false);
      setSessionMode(SessionMode.DEMO);
      setCurrentView(AppView.DASHBOARD);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  return (
    <div className="dark absolute inset-0 bg-[#0A0A1F] text-white overflow-y-auto overflow-x-hidden">
      <EntryTopBar
        onTrialClick={() => setIsDemoModalOpen(true)}
        onDemoClick={() => setIsDemoModalOpen(true)}
        onLoginClick={() => navigate('/login')}
        onRegisterClick={() => navigate('/register')}
        isLoggedIn={!!currentUser}
        hasWorkspace={!!currentUser?.hasWorkspace}
        forceDark
      />
      <main className="pt-14">{children}</main>
      <EntryFooter />
      <DemoModeModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onStartDemo={handleDemoStart}
        mode="trial"
      />
    </div>
  );
};
