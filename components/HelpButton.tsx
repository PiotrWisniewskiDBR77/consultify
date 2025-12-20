/**
 * Help Button Component
 * 
 * Global floating help button that opens the HelpPanel.
 * Shows badge with count of available playbooks.
 * 
 * Step 6: Enterprise+ Ready
 */

import React from 'react';
import { useHelp } from '../contexts/HelpContext';
import { HelpCircle } from 'lucide-react';

interface HelpButtonProps {
    onClick: () => void;
}

const HelpButton: React.FC<HelpButtonProps> = ({ onClick }) => {
    const { playbooks, loading } = useHelp();

    // Count available (not completed/dismissed) playbooks
    const availableCount = playbooks.filter(p => p.status === 'AVAILABLE').length;

    return (
        <button
            onClick={onClick}
            className="fixed bottom-6 right-6 z-30 flex items-center justify-center w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800"
            title="Help & Training"
            aria-label="Open Help Panel"
        >
            <HelpCircle className="w-6 h-6" />

            {/* Badge */}
            {availableCount > 0 && !loading && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full">
                    {availableCount > 9 ? '9+' : availableCount}
                </span>
            )}
        </button>
    );
};

export default HelpButton;
