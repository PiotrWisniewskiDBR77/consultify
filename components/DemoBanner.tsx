import React, { useState } from 'react';
import { Info, Eye, Database, Clock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * DemoBanner — Phase B: Demo Session
 * 
 * ENTERPRISE SPEC COMPLIANCE:
 * - EPIC-B2: Shows limitations openly
 * - EPIC-B3: Data labeled as reference
 * - No commitment risk feeling
 */

interface DemoBannerProps {
    onStartTrialClick?: () => void;
}

const DEMO_LIMITATIONS = [
    { icon: Eye, text: 'Tryb tylko do odczytu — nie można nic zapisać' },
    { icon: Database, text: 'Dane referencyjne — to nie są Twoje dane' },
    { icon: Clock, text: 'Sesja wygasa po 24h — bez historii' },
];

const DemoBanner: React.FC<DemoBannerProps> = ({ onStartTrialClick }) => {
    const navigate = useNavigate();
    const [showLimitations, setShowLimitations] = useState(false);

    const handleStartTrial = () => {
        if (onStartTrialClick) {
            onStartTrialClick();
        } else {
            navigate('/trial/start');
        }
    };

    return (
        <div
            data-tour="demo-banner"
            className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md relative z-50"
        >
            {/* Main Banner */}
            <div className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Info size={18} className="text-blue-200" />
                    <span>
                        <span className="font-bold tracking-wide uppercase text-blue-100 mr-2">Tryb Demo</span>
                        Eksplorujesz środowisko tylko do odczytu z danymi przykładowymi.
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowLimitations(!showLimitations)}
                        className="flex items-center gap-1 text-xs text-blue-200 hover:text-white transition-colors"
                    >
                        <AlertCircle size={14} />
                        <span>Ograniczenia</span>
                        {showLimitations ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <button
                        data-tour="demo-exit"
                        onClick={handleStartTrial}
                        className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded border border-white/20 transition-colors font-semibold"
                    >
                        Rozpocznij Trial
                    </button>
                </div>
            </div>

            {/* Expanded Limitations */}
            {showLimitations && (
                <div className="px-4 py-3 bg-blue-800/50 border-t border-blue-500/30">
                    <div className="flex flex-wrap items-center gap-6 text-xs text-blue-100">
                        {DEMO_LIMITATIONS.map((limitation, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <limitation.icon size={14} className="text-blue-300" />
                                <span>{limitation.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DemoBanner;

