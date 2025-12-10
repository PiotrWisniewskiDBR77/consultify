import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

interface TourStep {
    target: string;
    title: string;
    content: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
    steps: TourStep[];
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
    steps,
    isOpen,
    onClose,
    onComplete
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (!isOpen || !steps[currentStep]) return;

        const targetElement = document.querySelector(steps[currentStep].target);
        if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            const placement = steps[currentStep].placement || 'bottom';

            let top = 0, left = 0;

            switch (placement) {
                case 'bottom':
                    top = rect.bottom + 10;
                    left = rect.left + rect.width / 2;
                    break;
                case 'top':
                    top = rect.top - 10;
                    left = rect.left + rect.width / 2;
                    break;
                case 'left':
                    top = rect.top + rect.height / 2;
                    left = rect.left - 10;
                    break;
                case 'right':
                    top = rect.top + rect.height / 2;
                    left = rect.right + 10;
                    break;
            }

            setPosition({ top, left });

            // Highlight target
            targetElement.classList.add('tour-highlight');
        }

        return () => {
            const targetElement = document.querySelector(steps[currentStep]?.target);
            if (targetElement) {
                targetElement.classList.remove('tour-highlight');
            }
        };
    }, [currentStep, isOpen, steps]);

    if (!isOpen || !steps[currentStep]) return null;

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = () => {
        onComplete?.();
        onClose();
        setCurrentStep(0);
    };

    const step = steps[currentStep];

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-[9998] animate-in fade-in"
                onClick={onClose}
            />

            {/* Tour Card */}
            <div
                className="fixed z-[9999] animate-in fade-in slide-in-from-bottom-4"
                style={{
                    top: `${position.top}px`,
                    left: `${position.left}px`,
                    transform: 'translate(-50%, 0)'
                }}
            >
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl p-6 max-w-md">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                            <div className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-1">
                                Step {currentStep + 1} of {steps.length}
                            </div>
                            <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                                {step.title}
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-navy-900 dark:hover:text-white p-1"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                        {step.content}
                    </p>

                    {/* Footer */}
                    <div className="flex justify-between items-center">
                        <button
                            onClick={handlePrev}
                            disabled={currentStep === 0}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={16} />
                            Previous
                        </button>

                        <div className="flex gap-1">
                            {steps.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1.5 rounded-full transition-all ${idx === currentStep
                                            ? 'w-6 bg-purple-500'
                                            : 'w-1.5 bg-slate-300 dark:bg-slate-600'
                                        }`}
                                />
                            ))}
                        </div>

                        <button
                            onClick={handleNext}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Arrow pointer to target */}
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <div className="w-4 h-4 bg-white dark:bg-navy-900 border-l border-t border-slate-200 dark:border-white/10 rotate-45" />
                </div>
            </div>

            {/* CSS for highlight effect */}
            <style>{`
                .tour-highlight {
                    position: relative;
                    z-index: 9997;
                    box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.4), 0 0 0 9999px rgba(0, 0, 0, 0.5);
                    border-radius: 8px;
                }
            `}</style>
        </>
    );
};
