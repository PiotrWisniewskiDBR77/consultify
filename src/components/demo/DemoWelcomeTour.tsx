import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  FileText,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  highlight?: string;
}

interface DemoScenario {
  id: string;
  title: string;
  duration?: string;
  audience?: string;
  persona?: string;
}

interface DemoWelcomeTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  userRole?: 'CEO' | 'CTO' | 'Consultant' | 'Investor' | null;
  entrySource?: string | null;
  organizationName?: string;
  scenarios?: DemoScenario[];
}

export const DemoWelcomeTour: React.FC<DemoWelcomeTourProps> = ({
  isOpen,
  onClose,
  onComplete,
  userRole: initialRole = null,
  entrySource = null,
  organizationName = 'Atelier Toys',
  scenarios = [],
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState<string | null>(initialRole);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(scenarios[0]?.id || null);
  const [isRoleSelected, setIsRoleSelected] = useState(false);
  const canStartTour =
    Boolean(selectedRole) && (scenarios.length === 0 || Boolean(selectedScenario));
  const sourceLabel =
    entrySource === 'profile_menu'
      ? t('tour.entrySource.profile', 'Opened from your workspace menu')
      : t('tour.entrySource.landing', 'Opened from the public demo entry');

  const ROLES = [
    {
      id: 'CEO',
      label: t('tour.roles.ceo', 'CEO / Executive'),
      icon: Target,
      description: t('tour.roles.ceoDesc', 'Strategic oversight & decision making'),
    },
    {
      id: 'CTO',
      label: t('tour.roles.cto', 'CTO / Tech Lead'),
      icon: Zap,
      description: t('tour.roles.ctoDesc', 'Technology transformation'),
    },
    {
      id: 'Consultant',
      label: t('tour.roles.consultant', 'Consultant'),
      icon: Users,
      description: t('tour.roles.consultantDesc', 'Client advisory & strategy'),
    },
    {
      id: 'Investor',
      label: t('tour.roles.investor', 'Investor'),
      icon: BarChart3,
      description: t('tour.roles.investorDesc', 'Due diligence & evaluation'),
    },
  ];

  const TOUR_STEPS: TourStep[] = [
    {
      id: 'dashboard',
      title: t('tour.steps.dashboard.title', 'Your Command Center'),
      description: t(
        'tour.steps.dashboard.description',
        'Start here to understand the operating rhythm: priorities, signals, and next actions visible in one place.'
      ),
      icon: Target,
      highlight: 'dashboard',
    },
    {
      id: 'assessment',
      title: t('tour.steps.assessment.title', 'AI-Powered Assessment'),
      description: t(
        'tour.steps.assessment.description',
        'Use assessments to review maturity, identify gaps, and see how findings can feed concrete follow-up work.'
      ),
      icon: Brain,
      highlight: 'assessment',
    },
    {
      id: 'roadmap',
      title: t('tour.steps.roadmap.title', 'Strategic Roadmap'),
      description: t(
        'tour.steps.roadmap.description',
        'Roadmaps connect insight to execution: priorities, owners, and timing you can later mirror in your own workspace.'
      ),
      icon: FileText,
      highlight: 'roadmap',
    },
    {
      id: 'collaboration',
      title: t('tour.steps.collaboration.title', 'Team Collaboration'),
      description: t(
        'tour.steps.collaboration.description',
        'Tasks, decisions, and accountability stay connected so you can see how teams move from recommendation to follow-through.'
      ),
      icon: Users,
      highlight: 'mywork',
    },
    {
      id: 'complete',
      title: t('tour.steps.complete.title', "You're All Set!"),
      description: t(
        'tour.steps.complete.description',
        'Use this sample workspace as a safe reference. Once the flow is clear, return to your own workspace and repeat it on live data.'
      ),
      icon: CheckCircle2,
      highlight: undefined,
    },
  ];

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    // Track for analytics
    localStorage.setItem('demo_user_role', roleId);
  };

  const handleStartTour = () => {
    if (!canStartTour) return;
    if (selectedScenario) {
      localStorage.setItem('demo_story_scenario', selectedScenario);
    }
    setIsRoleSelected(true);
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
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

  useEffect(() => {
    if (!selectedScenario && scenarios.length > 0) {
      setSelectedScenario(scenarios[0].id);
    }
  }, [scenarios, selectedScenario]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[400] bg-slate-900/70 dark:bg-navy-950/95 backdrop-blur-xl flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-2xl"
        >
          {/* Skip Button */}
          <button
            onClick={handleSkip}
            className="absolute -top-12 right-0 text-slate-600 hover:text-slate-200 text-sm flex items-center gap-1 transition-colors duration-150"
          >
            {t('tour.skip', 'Skip tour')}
            <X size={14} />
          </button>

          {/* Card — Layer 3 (DBR77: depth by shadow, no gradients, invisible borders) */}
          <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-hig-xl overflow-hidden">
            {/* Role Selection */}
            {!isRoleSelected && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-navy-700/50 rounded-xl flex items-center justify-center mb-6">
                    <Sparkles size={32} className="text-slate-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    {t('tour.welcome.title', 'Open the sample workspace walkthrough')}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                    {t(
                      'tour.welcome.subtitle',
                      'Choose the perspective and scenario that best matches the workflow you want to understand first.'
                    )}
                  </p>
                  <div className="mt-3 inline-flex items-center rounded-full border border-slate-200 dark:border-c-border-subtle px-3 py-1 text-xs text-slate-500 dark:text-slate-400">
                    {organizationName} • {sourceLabel}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {ROLES.map((role) => (
                    <motion.button
                      key={role.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleRoleSelect(role.id)}
                      className={`p-4 rounded-xl transition-all duration-150 text-left ${
                        selectedRole === role.id
                          ? 'bg-slate-100 dark:bg-white/[0.08]'
                          : 'bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <role.icon size={24} className="text-slate-600 mb-2" />
                      <h3 className="text-slate-900 dark:text-slate-100 font-semibold text-sm">
                        {role.label}
                      </h3>
                      <p className="text-slate-500 text-xs mt-1">{role.description}</p>
                    </motion.button>
                  ))}
                </div>

                {scenarios.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500 mb-3">
                      {t('tour.scenarios.label', 'Guided scenarios')}
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      {scenarios.map((scenario) => (
                        <button
                          key={scenario.id}
                          onClick={() => setSelectedScenario(scenario.id)}
                          className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                            selectedScenario === scenario.id
                              ? 'border-slate-400 dark:border-slate-500 bg-slate-100 dark:bg-slate-700/40'
                              : 'border-slate-200 dark:border-c-border-subtle hover:border-slate-300 dark:hover:border-c-border'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {scenario.title}
                            </span>
                            {scenario.duration && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {scenario.duration}
                              </span>
                            )}
                          </div>
                          {(scenario.persona || scenario.audience) && (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {[scenario.persona, scenario.audience].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleStartTour}
                    disabled={!canStartTour}
                    className="px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl transition-all duration-150 flex items-center gap-2"
                  >
                    {t('tour.startScenario', 'Start walkthrough')}
                    <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Tour Steps */}
            {isRoleSelected && (
              <div className="p-8">
                {/* Progress — monochrome (DBR77: max 1 color = CTA) */}
                <div className="flex gap-2 mb-8">
                  {TOUR_STEPS.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1 flex-1 rounded-full transition-all duration-150 ${
                        idx <= currentStep
                          ? 'bg-slate-400 dark:bg-white/20'
                          : 'bg-slate-200 dark:bg-white/5'
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
                    transition={{ duration: 0.22 }}
                    className="text-center"
                  >
                    {(() => {
                      const step = TOUR_STEPS[currentStep];
                      const Icon = step.icon;
                      const isComplete = currentStep === TOUR_STEPS.length - 1;
                      return (
                        <>
                          <div
                            className={`w-16 h-16 mx-auto rounded-xl flex items-center justify-center mb-6 ${
                              isComplete ? 'bg-success/10' : 'bg-slate-100 dark:bg-white/[0.05]'
                            }`}
                          >
                            <Icon
                              size={32}
                              className={isComplete ? 'text-success-500' : 'text-slate-600'}
                            />
                          </div>
                          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
                            {step.title}
                          </h2>
                          <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
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
                    onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                    className={`text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm transition-colors duration-150 ${
                      currentStep === 0 ? 'invisible' : ''
                    }`}
                  >
                    {t('tour.back', 'Back')}
                  </button>

                  <button
                    onClick={currentStep === TOUR_STEPS.length - 1 ? handleComplete : handleNext}
                    className="px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-semibold rounded-xl transition-all duration-150 flex items-center gap-2"
                  >
                    {currentStep === TOUR_STEPS.length - 1
                      ? t('tour.startExploring', 'Start Exploring')
                      : t('tour.next', 'Next')}
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
