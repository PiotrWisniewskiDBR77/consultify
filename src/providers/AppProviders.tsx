import React from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';

import { ErrorBoundary } from '../../components/ErrorBoundary';
import { TourProvider } from '../../components/Onboarding/TourProvider';
import { AccessPolicyProvider } from '../../contexts/AccessPolicyContext';
import { AIProvider } from '../../contexts/AIContext';
import { HelpProvider } from '../../contexts/HelpContext';
import { TrialProvider } from '../../contexts/TrialContext';
import { AutoSaveProvider } from '../context/AutoSaveContext';

interface AppProvidersProps {
    children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
    return (
        <ErrorBoundary>
            <BrowserRouter>
                <AutoSaveProvider>
                    <TrialProvider>
                        <AccessPolicyProvider>
                            <AIProvider>
                                <HelpProvider>
                                    <TourProvider>
                                        {children}
                                        <Toaster position="bottom-right" />
                                    </TourProvider>
                                </HelpProvider>
                            </AIProvider>
                        </AccessPolicyProvider>
                    </TrialProvider>
                </AutoSaveProvider>
            </BrowserRouter>
        </ErrorBoundary>
    );
};
