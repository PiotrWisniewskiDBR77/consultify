import React from 'react';
import { X, Clock, Lock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ConversionModalProps {
    isOpen: boolean;
    onClose: () => void;
    triggerReason: 'time_limit' | 'action_blocked' | 'manual';
    title?: string;
    message?: string;
}

const ConversionModal: React.FC<ConversionModalProps> = ({
    isOpen,
    onClose,
    triggerReason,
    title,
    message
}) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const getContent = () => {
        if (triggerReason === 'time_limit') {
            return {
                icon: <Clock className="w-12 h-12 text-blue-500 mb-4" />,
                headline: "Demo Time Limit Reached",
                subtext: "You've been exploring for a while! Ready to start your real transformation?",
                cta: "Start Free Trial"
            };
        } else if (triggerReason === 'action_blocked') {
            return {
                icon: <Lock className="w-12 h-12 text-amber-500 mb-4" />,
                headline: title || "Feature Locked in Demo",
                subtext: message || "This action attempts to modify data. In Demo Mode, the environment is read-only to ensure a consistent experience for everyone.",
                cta: "Unlock Full Access"
            };
        } else {
            return {
                icon: <ArrowRight className="w-12 h-12 text-green-500 mb-4" />,
                headline: "Ready to Upgrade?",
                subtext: "Take your consulting practice to the next level with our full suite of tools.",
                cta: "Start Free Trial"
            };
        }
    };

    const content = getContent();

    const handlePrimaryAction = () => {
        // Navigate to Trial or Pricing
        navigate('/trial/start');
        onClose();
    };

    const handleSecondaryAction = () => {
        // Contact Sales
        navigate('/consulting');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-300">

                {/* Header Image or Pattern could go here */}

                <div className="p-8 flex flex-col items-center text-center">
                    {content.icon}

                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        {content.headline}
                    </h2>

                    <p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
                        {content.subtext}
                    </p>

                    <div className="w-full space-y-3">
                        <button
                            onClick={handlePrimaryAction}
                            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                        >
                            {content.cta} <ArrowRight size={18} />
                        </button>

                        <button
                            onClick={handleSecondaryAction}
                            className="w-full py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Talk to an Expert
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="mt-6 text-sm text-slate-400 hover:text-slate-500 underline"
                    >
                        Continue Exploring Demo
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConversionModal;
