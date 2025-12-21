import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Users, Brain, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { AppView } from '../../types';

/**
 * TrialTransitionConfirmation — Phase C → D Gate
 * 
 * ENTERPRISE SPEC COMPLIANCE:
 * - EPIC-C3: No Opt-Out by Accident
 * - Three explicit confirmations required
 * - Communicates organizational scope
 * 
 * PURPOSE:
 * Prevent accidental organization creation.
 * Requires conscious acknowledgment of:
 * 1. Time commitment
 * 2. Multi-person nature
 * 3. Memory creation
 */

interface ConfirmationState {
    timeCommitment: boolean;
    teamScope: boolean;
    memoryAware: boolean;
    isSubmitting: boolean;
}

interface TrialTransitionConfirmationProps {
    onCancel?: () => void;
    onConfirm?: () => void;
}

export const TrialTransitionConfirmation: React.FC<TrialTransitionConfirmationProps> = ({
    onCancel,
    onConfirm
}) => {
    const { setCurrentView } = useAppStore();

    const [state, setState] = useState<ConfirmationState>({
        timeCommitment: false,
        teamScope: false,
        memoryAware: false,
        isSubmitting: false,
    });

    const allConfirmed = state.timeCommitment && state.teamScope && state.memoryAware;

    const handleProceed = async () => {
        if (!allConfirmed) return;

        setState(prev => ({ ...prev, isSubmitting: true }));

        try {
            // Record consent in audit log
            await Api.post('/trial/confirm-transition', {
                confirmations: {
                    timeCommitment: true,
                    teamScope: true,
                    memoryAware: true,
                },
                confirmedAt: new Date().toISOString(),
            });

            toast.success('Gotowe. Przejdźmy do konfiguracji organizacji.');

            if (onConfirm) {
                onConfirm();
            } else {
                setCurrentView(AppView.ORG_SETUP_WIZARD);
            }
        } catch (error: any) {
            toast.error(error.message || 'Błąd podczas przejścia');
        } finally {
            setState(prev => ({ ...prev, isSubmitting: false }));
        }
    };

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        } else {
            setCurrentView(AppView.USER_DASHBOARD);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-navy-900 rounded-2xl max-w-lg w-full shadow-2xl">

                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <AlertTriangle className="text-amber-600 dark:text-amber-400" size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                            Przed utworzeniem organizacji
                        </h2>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                        Upewnij się, że rozumiesz, co oznacza ten krok.
                    </p>
                </div>

                {/* Confirmations */}
                <div className="p-6 space-y-4">

                    {/* Time Commitment */}
                    <label className={`
                        flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${state.timeCommitment
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }
                    `}>
                        <input
                            type="checkbox"
                            checked={state.timeCommitment}
                            onChange={(e) => setState(prev => ({ ...prev, timeCommitment: e.target.checked }))}
                            className="mt-1 w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <Clock size={16} className="text-slate-500" />
                                <span className="font-semibold text-navy-900 dark:text-white">
                                    Rozumiem, że to wymaga czasu
                                </span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Praca z systemem to nie szybkie rozwiązanie. Wymaga zaangażowania
                                i regularnej pracy z zespołem.
                            </p>
                        </div>
                    </label>

                    {/* Team Scope */}
                    <label className={`
                        flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${state.teamScope
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }
                    `}>
                        <input
                            type="checkbox"
                            checked={state.teamScope}
                            onChange={(e) => setState(prev => ({ ...prev, teamScope: e.target.checked }))}
                            className="mt-1 w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <Users size={16} className="text-slate-500" />
                                <span className="font-semibold text-navy-900 dark:text-white">
                                    To narzędzie dla zespołów
                                </span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                System jest zaprojektowany dla organizacji. Największą wartość
                                przynosi, gdy pracuje z nim więcej niż jedna osoba.
                            </p>
                        </div>
                    </label>

                    {/* Memory Awareness */}
                    <label className={`
                        flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${state.memoryAware
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }
                    `}>
                        <input
                            type="checkbox"
                            checked={state.memoryAware}
                            onChange={(e) => setState(prev => ({ ...prev, memoryAware: e.target.checked }))}
                            className="mt-1 w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <Brain size={16} className="text-slate-500" />
                                <span className="font-semibold text-navy-900 dark:text-white">
                                    System będzie pamiętał naszą pracę
                                </span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Każda decyzja, dyskusja i wniosek zostanie zapisany.
                                To tworzy ciągłość, ale oznacza też odpowiedzialność.
                            </p>
                        </div>
                    </label>
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-between">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        Wróć
                    </button>

                    <button
                        onClick={handleProceed}
                        disabled={!allConfirmed || state.isSubmitting}
                        className={`
                            flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all
                            ${allConfirmed && !state.isSubmitting
                                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                            }
                        `}
                    >
                        {state.isSubmitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Przechodzę...</span>
                            </>
                        ) : (
                            <>
                                <span>Rozumiem, kontynuuj</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </div>

                {/* Confirmation Status */}
                <div className="px-6 pb-6">
                    <div className="flex items-center justify-center gap-2 text-sm">
                        {allConfirmed ? (
                            <>
                                <CheckCircle size={16} className="text-green-500" />
                                <span className="text-green-600 dark:text-green-400">
                                    Wszystkie potwierdzenia zaznaczone
                                </span>
                            </>
                        ) : (
                            <span className="text-slate-400">
                                {3 - [state.timeCommitment, state.teamScope, state.memoryAware].filter(Boolean).length} pozostało
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrialTransitionConfirmation;
