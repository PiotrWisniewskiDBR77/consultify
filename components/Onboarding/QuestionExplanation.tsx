import React from 'react';
import { HelpCircle, Brain, Compass, Target, Users, Lightbulb, AlertCircle } from 'lucide-react';

/**
 * QuestionExplanation — Phase E "Why I'm Asking" Component
 * 
 * ENTERPRISE SPEC COMPLIANCE:
 * - EPIC-E2: AI Explains Every Question
 * - Each question includes visible "Why I'm asking" explanation
 * - Builds trust through transparency
 * 
 * PURPOSE:
 * Users should understand WHY each question matters,
 * not just answer mechanically.
 */

interface QuestionExplanationProps {
    questionType: 'context' | 'goals' | 'challenges' | 'stakeholders' | 'constraints' | 'success';
    expanded?: boolean;
    className?: string;
}

const QUESTION_EXPLANATIONS = {
    context: {
        icon: Brain,
        title: 'Kontekst organizacji',
        why: 'Aby zrozumieć środowisko Twoich decyzji, muszę wiedzieć, w jakiej rzeczywistości funkcjonujesz.',
        impact: 'Bez kontekstu każda rekomendacja byłaby ogólnikowa i potencjalnie nietrafiona.',
        example: 'Np. startup i korporacja mają zupełnie inne ograniczenia czasowe i zasobowe.',
    },
    goals: {
        icon: Target,
        title: 'Cele strategiczne',
        why: 'Każda decyzja powinna prowadzić do jakiegoś celu. Muszę wiedzieć, dokąd zmierzasz.',
        impact: 'Zdefiniowany cel pozwala ocenić, czy dana ścieżka przybliża Cię do sukcesu.',
        example: 'Np. "wzrost o 20% w 12 miesięcy" vs. "stabilność i redukcja ryzyka".',
    },
    challenges: {
        icon: AlertCircle,
        title: 'Wyzwania i bariery',
        why: 'Wiedza o tym, co Cię blokuje, jest równie ważna jak wiedza o tym, czego chcesz.',
        impact: 'Ignorowanie barier prowadzi do planów, które wyglądają dobrze, ale są nierealistyczne.',
        example: 'Np. "brak budżetu" vs. "opór zespołu" wymagają zupełnie innych strategii.',
    },
    stakeholders: {
        icon: Users,
        title: 'Interesariusze',
        why: 'Decyzje rzadko dotyczą tylko jednej osoby. Muszę wiedzieć, kto jeszcze jest zaangażowany.',
        impact: 'Pominięcie kluczowego interesariusza może zablokować realizację nawet najlepszego planu.',
        example: 'Np. CFO może mieć inne priorytety niż CTO, i oba głosy są ważne.',
    },
    constraints: {
        icon: Compass,
        title: 'Ograniczenia',
        why: 'Każda organizacja ma granice, których nie może przekroczyć.',
        impact: 'Plan musi mieścić się w realnych ramach — czasowych, budżetowych, regulacyjnych.',
        example: 'Np. "nie możemy zwolnić nikogo" lub "musimy być live przed 1 stycznia".',
    },
    success: {
        icon: Lightbulb,
        title: 'Definicja sukcesu',
        why: 'Muszę wiedzieć, po czym poznamy, że się udało.',
        impact: 'Bez jasnej miary sukcesu nie da się ocenić, czy warto było podjąć działanie.',
        example: 'Np. "NPS > 50" vs. "zero incydentów bezpieczeństwa przez 6 miesięcy".',
    },
};

export const QuestionExplanation: React.FC<QuestionExplanationProps> = ({
    questionType,
    expanded = false,
    className = '',
}) => {
    const [isExpanded, setIsExpanded] = React.useState(expanded);
    const content = QUESTION_EXPLANATIONS[questionType];
    const Icon = content.icon;

    return (
        <div className={`
            bg-slate-50 dark:bg-navy-900/50 
            border border-slate-200 dark:border-slate-700 
            rounded-lg overflow-hidden
            ${className}
        `}>
            {/* Header - always visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-navy-800/50 transition-colors"
            >
                <HelpCircle size={16} className="text-purple-500 shrink-0" />
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    Dlaczego o to pytam?
                </span>
                <svg
                    className={`ml-auto w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-4 pb-4 pt-0 space-y-3">
                    <div className="flex items-start gap-3 bg-white dark:bg-navy-800 rounded-lg p-3 border border-slate-100 dark:border-slate-600">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                            <Icon size={16} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-navy-900 dark:text-white text-sm mb-1">
                                {content.title}
                            </h4>
                            <p className="text-slate-600 dark:text-slate-400 text-sm">
                                {content.why}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-2 text-sm">
                        <div className="flex gap-2">
                            <span className="font-medium text-slate-700 dark:text-slate-300 shrink-0">Wpływ:</span>
                            <span className="text-slate-600 dark:text-slate-400">{content.impact}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="font-medium text-slate-700 dark:text-slate-300 shrink-0">Przykład:</span>
                            <span className="text-slate-500 dark:text-slate-500 italic">{content.example}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * QuestionWithExplanation — Full question component with built-in explanation
 */
export const QuestionWithExplanation: React.FC<{
    questionType: 'context' | 'goals' | 'challenges' | 'stakeholders' | 'constraints' | 'success';
    question: string;
    children: React.ReactNode;
    className?: string;
}> = ({ questionType, question, children, className = '' }) => {
    return (
        <div className={`space-y-3 ${className}`}>
            <div>
                <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-1">
                    {question}
                </h3>
                <QuestionExplanation questionType={questionType} />
            </div>
            {children}
        </div>
    );
};

export default QuestionExplanation;
