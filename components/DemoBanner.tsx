import React from 'react';
import { Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DemoBannerProps {
    onStartTrialClick?: () => void;
}

const DemoBanner: React.FC<DemoBannerProps> = ({ onStartTrialClick }) => {
    const navigate = useNavigate();

    const handleStartTrial = () => {
        if (onStartTrialClick) {
            onStartTrialClick();
        } else {
            navigate('/trial/start');
        }
    };

    return (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-2 flex items-center justify-between shadow-md relative z-50">
            <div className="flex items-center gap-2 text-sm font-medium">
                <Info size={18} className="text-blue-200" />
                <span>
                    <span className="font-bold tracking-wide uppercase text-blue-100 mr-2">Demo Mode</span>
                    You are exploring a read-only simulation environment.
                </span>
            </div>

            <button
                onClick={handleStartTrial}
                className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded border border-white/20 transition-colors font-semibold"
            >
                Start Free Trial
            </button>
        </div>
    );
};

export default DemoBanner;
