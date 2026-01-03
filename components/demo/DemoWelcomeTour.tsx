import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Sparkles, 
    Brain, 
    Target, 
    CheckCircle2, 
    ArrowRight, 
    X,
    BarChart3,
    Users,
    FileText,
    Zap
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TourStep {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    highlight?: string;
}

interface DemoWelcomeTourProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    userRole?: 'CEO' | 'CTO' | 'Consultant' | 'Investor' | null;
}

export const DemoWelcomeTour: React.FC<DemoWelcomeTourProps> = ({
    isOpen,
    onClose,
    onComplete,
    userRole: initialRole = null
}) => {
    const { t } = useTranslation();
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedRole, setSelectedRole] = useState<string | null>(initialRole);
    const [isRoleSelected, setIsRoleSelected] = useState(!!initialRole);

    const ROLES = [
        { id: 'CEO', label: t('tour.roles.ceo', 'CEO / Executive'), icon: Target, description: t('tour.roles.ceoDesc', 'Strategic oversight & decision making') },
        { id: 'CTO', label: t('tour.roles.cto', 'CTO / Tech Lead'), icon: Zap, description: t('tour.roles.ctoDesc', 'Technology transformation') },
        { id: 'Consultant', label: t('tour.roles.consultant', 'Consultant'), icon: Users, description: t('tour.roles.consultantDesc', 'Client advisory & strategy') },
        { id: 'Investor', label: t('tour.roles.investor', 'Investor'), icon: BarChart3, description: t('tour.roles.investorDesc', 'Due diligence & evaluation') },
    ];

    const TOUR_STEPS: TourStep[] = [
        {
            id: 'dashboard',
            title: t('tour.steps.dashboard.title', 'Your Command Center'),
            description: t('tour.steps.dashboard.description', 'Get a 360° view of your transformation progress. Real-time metrics, AI insights, and action items—all in one place.'),
            icon: Target,
            highlight: 'dashboard'
        },
        {
            id: 'assessment',
            title: t('tour.steps.assessment.title', 'AI-Powered Assessment'),
            description: t('tour.steps.assessment.description', 'Our AI analyzes your organization like a Harvard MBA graduate who\'s read every business book. Get instant maturity scores and gap analysis.'),
            icon: Brain,
            highlight: 'assessment'
        },
        {
            id: 'roadmap',
            title: t('tour.steps.roadmap.title', 'Strategic Roadmap'),
            description: t('tour.steps.roadmap.description', 'Built on McKinsey, BCG, and Bain methodologies. AI generates transformation roadmaps with clear ROI, priorities, and timelines.'),
            icon: FileText,
            highlight: 'roadmap'
        },
        {
            id: 'collaboration',
            title: t('tour.steps.collaboration.title', 'Team Collaboration'),
            description: t('tour.steps.collaboration.description', 'Tasks, decisions, and accountability—all tracked. Your team stays aligned with AI-managed workflows and reminders.'),
            icon: Users,
            highlight: 'mywork'
        },
        {
            id: 'complete',
            title: t('tour.steps.complete.title', 'You\'re All Set!'),
            description: t('tour.steps.complete.description', 'Explore freely. Remember: AI recommends, but you decide. Every strategic decision remains in your hands.'),
            icon: CheckCircle2,
            highlight: null
        }
    ];

    const handleRoleSelect = (roleId: string) => {
        setSelectedRole(roleId);
        setIsRoleSelected(true);
        // Track for analytics
        localStorage.setItem('demo_user_role', roleId);
    };

    const handleNext = () => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const handleSkip = () => {
        localStorage.setItem('demo_tour_skipped', 'true');
        onClose();
    };

    const handleComplete = useCallback(() => {
        localStorage.setItem('demo_tour_completed', 'true');
        onComplete();
    }, [onComplete]);

    // Skip if tour already completed
    useEffect(() => {
        if (isOpen && localStorage.getItem('demo_tour_completed') === 'true') {
            onClose();
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[400] bg-navy-950/95 backdrop-blur-xl flex items-center justify-center p-4"
            >
                {/* Background Effects */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />
                </div>

                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative w-full max-w-2xl"
                >
                    {/* Skip Button */}
                    <button
                        onClick={handleSkip}
                        className="absolute -top-12 right-0 text-white/50 hover:text-white text-sm flex items-center gap-1 transition-colors"
                    >
                        {t('tour.skip', 'Skip tour')}
                        <X size={14} />
                    </button>

                    {/* Card */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
                        {/* Role Selection */}
                        {!isRoleSelected && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="p-8"
                            >
                                <div className="text-center mb-8">
                                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                                        <Sparkles size={32} className="text-white" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">
                                        {t('tour.welcome.title', 'Welcome to Consultinity')}
                                    </h2>
                                    <p className="text-white/60">
                                        {t('tour.welcome.subtitle', 'What brings you here today?')}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {ROLES.map((role) => (
                                        <motion.button
                                            key={role.id}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleRoleSelect(role.id)}
                                            className={`p-4 rounded-xl border transition-all text-left ${
                                                selectedRole === role.id
                                                    ? 'border-purple-500 bg-purple-500/20'
                                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                            }`}
                                        >
                                            <role.icon size={24} className="text-purple-400 mb-2" />
                                            <h3 className="text-white font-semibold text-sm">{role.label}</h3>
                                            <p className="text-white/50 text-xs mt-1">{role.description}</p>
                                        </motion.button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Tour Steps */}
                        {isRoleSelected && (
                            <div className="p-8">
                                {/* Progress */}
                                <div className="flex gap-2 mb-8">
                                    {TOUR_STEPS.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`h-1 flex-1 rounded-full transition-all ${
                                                idx <= currentStep ? 'bg-purple-500' : 'bg-white/10'
                                            }`}
                                        />
                                    ))}
                                </div>

                                {/* Current Step */}
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentStep}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.3 }}
                                        className="text-center"
                                    >
                                        {(() => {
                                            const step = TOUR_STEPS[currentStep];
                                            const Icon = step.icon;
                                            return (
                                                <>
                                                    <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 ${
                                                        currentStep === TOUR_STEPS.length - 1
                                                            ? 'bg-emerald-500/20'
                                                            : 'bg-purple-500/20'
                                                    }`}>
                                                        <Icon size={32} className={
                                                            currentStep === TOUR_STEPS.length - 1
                                                                ? 'text-emerald-400'
                                                                : 'text-purple-400'
                                                        } />
                                                    </div>
                                                    <h2 className="text-2xl font-bold text-white mb-3">
                                                        {step.title}
                                                    </h2>
                                                    <p className="text-white/70 leading-relaxed max-w-md mx-auto">
                                                        {step.description}
                                                    </p>
                                                </>
                                            );
                                        })()}
                                    </motion.div>
                                </AnimatePresence>

                                {/* Actions */}
                                <div className="flex justify-between items-center mt-10">
                                    <button
                                        onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                                        className={`text-white/50 hover:text-white text-sm transition-colors ${
                                            currentStep === 0 ? 'invisible' : ''
                                        }`}
                                    >
                                        {t('tour.back', 'Back')}
                                    </button>

                                    <button
                                        onClick={currentStep === TOUR_STEPS.length - 1 ? handleComplete : handleNext}
                                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-indigo-500 transition-all flex items-center gap-2 shadow-lg shadow-purple-500/25"
                                    >
                                        {currentStep === TOUR_STEPS.length - 1 
                                            ? t('tour.startExploring', 'Start Exploring')
                                            : t('tour.next', 'Next')
                                        }
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};






