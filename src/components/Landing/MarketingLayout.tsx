import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../routes/routeConfig';
import { EntryFooter } from './EntryFooter';
import { EntryTopBar } from './EntryTopBar';
import { DemoModeModal } from './DemoModeModal';
import { useAppStore } from '../../store/useAppStore';
import { AppView, SessionMode } from '../../types';

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { currentUser, setCurrentView, setSessionMode, setCurrentUser, setDemoMode } = useAppStore();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'demo' | 'trial'>('trial');

  useEffect(() => { window.scrollTo(0, 0); }, []);

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
        onTrialClick={() => { setModalMode('trial'); setIsDemoModalOpen(true); }}
        onDemoClick={() => { setModalMode('demo'); setIsDemoModalOpen(true); }}
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
        onSuccess={handleModalSuccess}
        mode={modalMode}
      />
    </div>
  );
};
