import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { AutoSaveProvider } from '../context/AutoSaveContext';
import { AIProvider } from '../../contexts/AIContext';
import { HelpProvider } from '../../contexts/HelpContext';
import { TrialProvider } from '../../contexts/TrialContext';
import { AccessPolicyProvider } from '../../contexts/AccessPolicyContext';
import { TourProvider } from '../../components/Onboarding/TourProvider';

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
