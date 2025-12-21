import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Building2, User, Briefcase, Brain, Check, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { toast } from 'react-hot-toast';
import { AppView } from '../types';

/**
 * OrgSetupWizard — Phase D: Organization Setup
 * 
 * ENTERPRISE SPEC COMPLIANCE:
 * - EPIC-D1: Organization as Decision Container
 * - EPIC-D2: Deliberate Slowness Over Convenience
 * - EPIC-D3: System Memory Activation
 * 
 * RULES:
 * - 4 steps required, no shortcuts
 * - No defaults pre-selected
 * - Memory activation requires explicit consent
 * - Language is organizational, not personal
 * 
 * OUTPUT: Organization created with memory activated
 */

type OrgType = 'OPERATING' | 'CONSULTING' | null;
type OrgUserRole = 'EXECUTIVE' | 'DIRECTOR' | 'MANAGER' | 'SPECIALIST' | 'CONSULTANT' | null;

interface OrgSetupState {
    step: 1 | 2 | 3 | 4;
    orgName: string;
    userRole: OrgUserRole;
    orgType: OrgType;
    industry: string;
    memoryConsent: boolean;
    isSubmitting: boolean;
}

const INDUSTRIES = [
    { value: 'technology', label: 'Technologia / Software' },
    { value: 'financial', label: 'Usługi finansowe' },
    { value: 'healthcare', label: 'Zdrowie / Life Sciences' },
    { value: 'manufacturing', label: 'Produkcja / Przemysł' },
    { value: 'professional', label: 'Usługi profesjonalne' },
    { value: 'other', label: 'Inna branża' },
];

const USER_ROLES = [
    {
        value: 'EXECUTIVE' as OrgUserRole,
        label: 'Zarząd / C-Suite',
        description: 'Decyzje strategiczne, alokacja zasobów'
    },
    {
        value: 'DIRECTOR' as OrgUserRole,
        label: 'Dyrektor / Senior Manager',
        description: 'Decyzje operacyjne, koordynacja zespołów'
    },
    {
        value: 'MANAGER' as OrgUserRole,
        label: 'Manager / Team Lead',
        description: 'Decyzje taktyczne, realizacja celów'
    },
    {
        value: 'SPECIALIST' as OrgUserRole,
        label: 'Specjalista / Ekspert',
        description: 'Wiedza domenowa, perspektywa merytoryczna'
    },
    {
        value: 'CONSULTANT' as OrgUserRole,
        label: 'Konsultant zewnętrzny',
        description: 'Rola doradcza, obiektywna facylitacja'
    },
];

export const OrgSetupWizard: React.FC = () => {
    const { setCurrentView } = useAppStore();

    const [state, setState] = useState<OrgSetupState>({
        step: 1,
        orgName: '',
        userRole: null,
        orgType: null,
        industry: '',
        memoryConsent: false,
        isSubmitting: false,
    });

    const updateState = (updates: Partial<OrgSetupState>) => {
        setState(prev => ({ ...prev, ...updates }));
    };

    const canProceed = (): boolean => {
        switch (state.step) {
            case 1: return state.orgName.trim().length >= 3;
            case 2: return state.userRole !== null;
            case 3: return state.orgType !== null && state.industry !== '';
            case 4: return state.memoryConsent === true;
            default: return false;
        }
    };

    const handleNext = () => {
        if (state.step < 4 && canProceed()) {
            updateState({ step: (state.step + 1) as 1 | 2 | 3 | 4 });
        }
    };

    const handleBack = () => {
        if (state.step > 1) {
            updateState({ step: (state.step - 1) as 1 | 2 | 3 | 4 });
        }
    };

    const handleCreateOrganization = async () => {
        if (!canProceed()) return;

        updateState({ isSubmitting: true });

        try {
            const response = await Api.post('/organizations', {
                name: state.orgName,
                organizationType: state.orgType,
                industry: state.industry,
                userRole: state.userRole,
                memoryActivated: true,
                memoryConsentAt: new Date().toISOString(),
            });

            if (response.data?.id) {
                toast.success('Organizacja utworzona. Pamięć systemu aktywna.');
                setCurrentView(AppView.ONBOARDING_WIZARD); // Move to Phase E
            }
        } catch (error: any) {
            toast.error(error.message || 'Nie udało się utworzyć organizacji');
        } finally {
            updateState({ isSubmitting: false });
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-navy-950 flex items-center justify-center p-6">
            <div className="w-full max-w-xl">

                {/* Progress Indicator */}
                <div className="mb-12">
                    <div className="flex items-center justify-between mb-4">
                        {[1, 2, 3, 4].map((step) => (
                            <div key={step} className="flex items-center">
                                <div className={`
                                    w-10 h-10 rounded-full flex items-center justify-center font-semibold
                                    ${state.step === step
                                        ? 'bg-purple-600 text-white'
                                        : state.step > step
                                            ? 'bg-green-500 text-white'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                    }
                                `}>
                                    {state.step > step ? <Check size={18} /> : step}
                                </div>
                                {step < 4 && (
                                    <div className={`w-16 h-1 mx-2 ${state.step > step ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                        Krok {state.step} z 4
                    </p>
                </div>

                {/* Step 1: Organization Name */}
                {state.step === 1 && (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <Building2 className="w-12 h-12 mx-auto mb-4 text-purple-600" />
                            <h1 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
                                Nazwa Twojej organizacji
                            </h1>
                            <p className="text-slate-600 dark:text-slate-400">
                                To jest nazwa przestrzeni decyzyjnej, którą tworzysz.
                                Będzie widoczna dla wszystkich członków zespołu.
                            </p>
                        </div>

                        <div>
                            <input
                                type="text"
                                value={state.orgName}
                                onChange={(e) => updateState({ orgName: e.target.value })}
                                placeholder=""
                                className="
                                    w-full px-4 py-3 text-lg
                                    border-2 border-slate-200 dark:border-slate-700
                                    rounded-lg bg-white dark:bg-navy-900
                                    text-navy-900 dark:text-white
                                    focus:border-purple-500 focus:outline-none
                                    transition-colors
                                "
                                autoFocus
                            />
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                Np. "Acme Corporation" lub "Dział Strategii — Warszawa"
                            </p>
                        </div>
                    </div>
                )}

                {/* Step 2: User Role */}
                {state.step === 2 && (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <User className="w-12 h-12 mx-auto mb-4 text-purple-600" />
                            <h1 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
                                Twoja rola w organizacji
                            </h1>
                            <p className="text-slate-600 dark:text-slate-400">
                                To, jak myślisz o decyzjach, wpływa na to,
                                jak system Cię wspiera.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {USER_ROLES.map((role) => (
                                <button
                                    key={role.value}
                                    onClick={() => updateState({ userRole: role.value })}
                                    className={`
                                        w-full p-4 text-left rounded-lg border-2 transition-all
                                        ${state.userRole === role.value
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }
                                    `}
                                >
                                    <div className="font-semibold text-navy-900 dark:text-white">
                                        {role.label}
                                    </div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        {role.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 3: Organization Context */}
                {state.step === 3 && (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <Briefcase className="w-12 h-12 mx-auto mb-4 text-purple-600" />
                            <h1 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
                                Kontekst organizacji
                            </h1>
                            <p className="text-slate-600 dark:text-slate-400">
                                To pomaga systemowi rozumieć środowisko Twoich decyzji.
                            </p>
                        </div>

                        {/* Org Type */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Typ organizacji
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => updateState({ orgType: 'OPERATING' })}
                                    className={`
                                        p-4 text-center rounded-lg border-2 transition-all
                                        ${state.orgType === 'OPERATING'
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                            : 'border-slate-200 dark:border-slate-700'
                                        }
                                    `}
                                >
                                    <div className="font-semibold text-navy-900 dark:text-white">Firma</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Podejmujemy decyzje dla siebie
                                    </div>
                                </button>
                                <button
                                    onClick={() => updateState({ orgType: 'CONSULTING' })}
                                    className={`
                                        p-4 text-center rounded-lg border-2 transition-all
                                        ${state.orgType === 'CONSULTING'
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                            : 'border-slate-200 dark:border-slate-700'
                                        }
                                    `}
                                >
                                    <div className="font-semibold text-navy-900 dark:text-white">Konsulting</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Pomagamy innym podejmować decyzje
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Industry */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Główna branża
                            </label>
                            <div className="space-y-2">
                                {INDUSTRIES.map((ind) => (
                                    <button
                                        key={ind.value}
                                        onClick={() => updateState({ industry: ind.value })}
                                        className={`
                                            w-full p-3 text-left rounded-lg border-2 transition-all
                                            ${state.industry === ind.value
                                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                                : 'border-slate-200 dark:border-slate-700'
                                            }
                                        `}
                                    >
                                        <span className="text-navy-900 dark:text-white">{ind.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 4: Memory Activation */}
                {state.step === 4 && (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <Brain className="w-12 h-12 mx-auto mb-4 text-purple-600" />
                            <h1 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
                                Aktywacja pamięci systemu
                            </h1>
                        </div>

                        <div className="bg-slate-50 dark:bg-navy-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                            <p className="text-slate-700 dark:text-slate-300 mb-4">
                                Od tego momentu system będzie pamiętał:
                            </p>
                            <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                                <li className="flex items-start gap-2">
                                    <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                    <span>Kontekst Twojej organizacji</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                    <span>Decyzje i dyskusje</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                    <span>Odkryte wnioski i wzorce</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                                    <span>Perspektywy i stanowiska zespołu</span>
                                </li>
                            </ul>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
                                Tworzy to ciągłość w procesie decyzyjnym.
                                Pamięć należy do organizacji, nie do osób.
                            </p>
                        </div>

                        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={state.memoryConsent}
                                    onChange={(e) => updateState({ memoryConsent: e.target.checked })}
                                    className="mt-1 w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-slate-700 dark:text-slate-300">
                                    Rozumiem, że system będzie pamiętał naszą pracę
                                </span>
                            </label>
                        </div>

                        {!state.memoryConsent && (
                            <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400 text-sm">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <span>Zgoda na pamięć systemu jest wymagana, aby kontynuować.</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-12">
                    {state.step > 1 ? (
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <ArrowLeft size={18} />
                            <span>Wstecz</span>
                        </button>
                    ) : (
                        <div />
                    )}

                    {state.step < 4 ? (
                        <button
                            onClick={handleNext}
                            disabled={!canProceed()}
                            className={`
                                flex items-center gap-2 px-6 py-3 rounded-lg font-semibold
                                ${canProceed()
                                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                }
                                transition-colors
                            `}
                        >
                            <span>Dalej</span>
                            <ArrowRight size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={handleCreateOrganization}
                            disabled={!canProceed() || state.isSubmitting}
                            className={`
                                flex items-center gap-2 px-6 py-3 rounded-lg font-semibold
                                ${canProceed() && !state.isSubmitting
                                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                }
                                transition-colors
                            `}
                        >
                            {state.isSubmitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Tworzenie...</span>
                                </>
                            ) : (
                                <>
                                    <span>Aktywuj organizację</span>
                                    <Check size={18} />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrgSetupWizard;
