import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Brain,
  Briefcase,
  Building2,
  Check,
  User,
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { useAppStore } from '../store/useAppStore';
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
type CompanySize = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+' | null;

interface OrgSetupState {
  step: 1 | 2 | 3 | 4;
  orgName: string;
  domain: string;
  country: string;
  vatNumber: string;
  userRole: OrgUserRole;
  userTitle: string;
  phone: string;
  orgType: OrgType;
  industry: string;
  companySize: CompanySize;
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

const COMPANY_SIZES = [
  { value: '1-10', label: '1–10' },
  { value: '11-50', label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-1000', label: '201–1000' },
  { value: '1000+', label: '1000+' },
];

const COUNTRIES = [
  { value: 'PL', label: 'Poland' },
  { value: 'DE', label: 'Germany' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'OTHER', label: 'Other' },
];

const USER_ROLES = [
  {
    value: 'EXECUTIVE' as OrgUserRole,
    label: 'Zarząd / C-Suite',
    description: 'Decyzje strategiczne, alokacja zasobów',
  },
  {
    value: 'DIRECTOR' as OrgUserRole,
    label: 'Dyrektor / Senior Manager',
    description: 'Decyzje operacyjne, koordynacja zespołów',
  },
  {
    value: 'MANAGER' as OrgUserRole,
    label: 'Manager / Team Lead',
    description: 'Decyzje taktyczne, realizacja celów',
  },
  {
    value: 'SPECIALIST' as OrgUserRole,
    label: 'Specjalista / Ekspert',
    description: 'Wiedza domenowa, perspektywa merytoryczna',
  },
  {
    value: 'CONSULTANT' as OrgUserRole,
    label: 'Konsultant zewnętrzny',
    description: 'Rola doradcza, obiektywna facylitacja',
  },
];

export const OrgSetupWizard: React.FC = () => {
  const { setCurrentView, currentUser, currentOrganization } = useAppStore();

  const handleSkipSetup = async () => {
    try {
      await Api.post('/onboarding/skip', {});
    } catch {
      // Fallback: try direct org update
      const orgId = (currentOrganization as any)?.id;
      if (orgId) {
        await Api.put(`/organizations/${orgId}`, { onboardingStatus: 'ORG_SETUP_COMPLETED' }).catch(
          () => {}
        );
      }
    }
    setCurrentView(AppView.AI_CHAT);
  };

  const [state, setState] = useState<OrgSetupState>({
    step: 1,
    orgName: '',
    domain: '',
    country: '',
    vatNumber: '',
    userRole: null,
    userTitle: '',
    phone: '',
    orgType: null,
    industry: '',
    companySize: null,
    memoryConsent: false,
    isSubmitting: false,
  });

  const updateState = (updates: Partial<OrgSetupState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const canProceed = (): boolean => {
    switch (state.step) {
      case 1:
        return (
          state.orgName.trim().length >= 3 &&
          state.country !== '' &&
          state.domain.trim().length >= 3
        );
      case 2:
        return (
          state.userRole !== null &&
          state.userTitle.trim().length >= 2 &&
          state.phone.trim().length >= 6
        );
      case 3:
        return state.orgType !== null && state.industry !== '' && state.companySize !== null;
      case 4:
        return state.memoryConsent === true;
      default:
        return false;
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
      const org = await Api.post('/organizations', {
        name: state.orgName,
        industry: state.industry,
        domain: state.domain,
        vatNumber: state.vatNumber || undefined,
        attributionData: {
          orgProfileType: state.orgType,
          userRole: state.userRole,
          companySize: state.companySize,
          country: state.country,
          memoryActivated: true,
          memoryConsentAt: new Date().toISOString(),
        },
      });

      if (org?.id) {
        // Persist required user profile info for Trial
        try {
          if (currentUser?.id) {
            await Api.put(`/users/${currentUser.id}`, {
              title: state.userTitle,
              phone: state.phone,
            });
          }
        } catch {
          // non-blocking
        }

        // Mark org setup completed (used for gating)
        try {
          await Api.put(`/organizations/${org.id}`, { onboardingStatus: 'ORG_SETUP_COMPLETED' });
        } catch {
          // non-blocking
        }

        toast.success('Organizacja utworzona. Dane Trial uzupełnione.');
        trackFunnelEvent('trial_org_setup_completed', {
          organizationId: org.id,
          industry: state.industry,
          orgProfileType: state.orgType,
          userRole: state.userRole,
          companySize: state.companySize,
          country: state.country,
        });
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
                <div
                  className={`
                                    w-10 h-10 rounded-full flex items-center justify-center font-semibold
                                    ${
                                      state.step === step
                                        ? 'bg-purple-600 text-white'
                                        : state.step > step
                                          ? 'bg-green-500 text-white'
                                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                    }
                                `}
                >
                  {state.step > step ? <Check size={18} /> : step}
                </div>
                {step < 4 && (
                  <div
                    className={`w-16 h-1 mx-2 ${state.step > step ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                  />
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
                To jest nazwa przestrzeni decyzyjnej, którą tworzysz. Będzie widoczna dla wszystkich
                członków zespołu.
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Country
                </label>
                <select
                  value={state.country}
                  onChange={(e) => updateState({ country: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-navy-900 text-navy-900 dark:text-white"
                >
                  <option value="">Select…</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Company domain / website
                </label>
                <input
                  type="text"
                  value={state.domain}
                  onChange={(e) => updateState({ domain: e.target.value })}
                  placeholder="e.g. dbr77.com"
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-navy-900 text-navy-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                VAT number (optional)
              </label>
              <input
                type="text"
                value={state.vatNumber}
                onChange={(e) => updateState({ vatNumber: e.target.value })}
                placeholder="e.g. PL1234567890"
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-navy-900 text-navy-900 dark:text-white"
              />
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
                To, jak myślisz o decyzjach, wpływa na to, jak system Cię wspiera.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Your title
                </label>
                <input
                  type="text"
                  value={state.userTitle}
                  onChange={(e) => updateState({ userTitle: e.target.value })}
                  placeholder="e.g. PMO Lead"
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-navy-900 text-navy-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={state.phone}
                  onChange={(e) => updateState({ phone: e.target.value })}
                  placeholder="+48 123 456 789"
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-navy-900 text-navy-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-3">
              {USER_ROLES.map((role) => (
                <button
                  key={role.value}
                  onClick={() => updateState({ userRole: role.value })}
                  className={`
                                        w-full p-4 text-left rounded-lg border-2 transition-all
                                        ${
                                          state.userRole === role.value
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }
                                    `}
                >
                  <div className="font-semibold text-navy-900 dark:text-white">{role.label}</div>
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
                                        ${
                                          state.orgType === 'OPERATING'
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
                                        ${
                                          state.orgType === 'CONSULTING'
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
                                            ${
                                              state.industry === ind.value
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

            {/* Company size */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Wielkość organizacji
              </label>
              <select
                value={state.companySize || ''}
                onChange={(e) =>
                  updateState({ companySize: (e.target.value as CompanySize) || null })
                }
                className="
                                    w-full px-4 py-3
                                    border-2 border-slate-200 dark:border-slate-700
                                    rounded-lg bg-white dark:bg-navy-900
                                    text-navy-900 dark:text-white
                                "
              >
                <option value="">Wybierz...</option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
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
                Tworzy to ciągłość w procesie decyzyjnym. Pamięć należy do organizacji, nie do osób.
              </p>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.memoryConsent}
                  onChange={(e) => updateState({ memoryConsent: e.target.checked })}
                  className="mt-1 w-5 h-5 rounded border-slate-300 dark:border-navy-700 text-purple-600 focus:ring-purple-500"
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
            <button
              onClick={handleSkipSetup}
              className="text-sm text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline underline-offset-2 transition-colors"
            >
              Pomiń konfigurację
            </button>
          )}

          {state.step < 4 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`
                                flex items-center gap-2 px-6 py-3 rounded-lg font-semibold
                                ${
                                  canProceed()
                                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
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
                                ${
                                  canProceed() && !state.isSubmitting
                                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
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
