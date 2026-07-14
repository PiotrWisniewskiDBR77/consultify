import { AnimatePresence, motion } from 'framer-motion';
import { Brain, CheckCircle2, Sparkles, Target, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DemoLoadingOverlayProps {
  isVisible: boolean;
  onComplete?: () => void;
}

const LOADING_STEPS = [
  { key: 'environment', icon: Sparkles, delay: 0 },
  { key: 'data', icon: Brain, delay: 400 },
  { key: 'ai', icon: Zap, delay: 800 },
  { key: 'dashboard', icon: Target, delay: 1200 },
];

export const DemoLoadingOverlay: React.FC<DemoLoadingOverlayProps> = ({
  isVisible,
  onComplete,
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    if (!isVisible) {
      // Defer state reset using functional updates
      queueMicrotask(() => {
        setCurrentStep(0);
        setCompletedSteps([]);
      });
      return;
    }

    // Progress through steps
    const timers: NodeJS.Timeout[] = [];
    LOADING_STEPS.forEach((step, index) => {
      const stepTimer = setTimeout(() => {
        setCurrentStep(index);
        const completeTimer = setTimeout(() => {
          setCompletedSteps((prev) => [...prev, index]);
        }, 300);
        timers.push(completeTimer);
      }, step.delay);
      timers.push(stepTimer);
    });

    // Complete after all steps
    const totalTime = LOADING_STEPS[LOADING_STEPS.length - 1].delay + 600;
    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, totalTime);
    timers.push(completeTimer);

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [isVisible, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-context-menu bg-navy-950 flex items-center justify-center"
        >
          {/* Background Effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/20 rounded-full blur-[120px] animate-pulse" />
            <div
              className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"
              style={{ animationDelay: '500ms' }}
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-[150px]" />
          </div>

          {/* Content */}
          <div className="relative z-10 text-center px-8 max-w-md">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-12"
            >
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary-500 to-crimson-600 rounded-xl flex items-center justify-center shadow-2xl shadow-primary-500/30 mb-6">
                <img
                  src="/assets/logos/logo-icon.png"
                  alt="Consultify"
                  className="w-12 h-12 object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {t('demo.loading.title', 'Preparing Your Experience')}
              </h1>
              <p className="text-white/60 text-sm">
                {t('demo.loading.subtitle', 'Setting up your personalized demo environment')}
              </p>
            </motion.div>

            {/* Loading Steps */}
            <div className="space-y-4 mb-12">
              {LOADING_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep >= index;
                const isCompleted = completedSteps.includes(index);

                return (
                  <motion.div
                    key={step.key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{
                      opacity: isActive ? 1 : 0.3,
                      x: isActive ? 0 : -10,
                    }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                      isActive
                        ? 'bg-white/10 border border-white/20'
                        : 'bg-white/5 border border-white/5'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                        isCompleted ? 'bg-emerald-500/20' : isActive ? 'bg-white/15' : 'bg-white/5'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 size={20} className="text-emerald-400" />
                      ) : (
                        <Icon size={20} className={isActive ? 'text-white/90' : 'text-white/30'} />
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium transition-colors duration-300 ${
                        isActive ? 'text-white' : 'text-white/30'
                      }`}
                    >
                      {t(`demo.loading.steps.${step.key}`, step.key)}
                    </span>
                    {isActive && !isCompleted && (
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="ml-auto w-2 h-2 bg-primary-400 rounded-full"
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Progress Bar */}
            <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: `${(completedSteps.length / LOADING_STEPS.length) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary-500 to-crimson-500 rounded-full"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
