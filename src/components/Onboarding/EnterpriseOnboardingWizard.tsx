/**
 * Enterprise Onboarding Wizard
 * 4-Step Flow: Terms → Pricing → Payment → Complete
 */

import {
  ArrowRight,
  CheckCircle,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  Shield,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyPartner,
  V8PartnerApi,
  type V8PartnerOnboardingStatus,
} from '@/services/api/v8';

type OnboardingStep = 1 | 2 | 3 | 4;
type PricingTier = 'starter' | 'professional' | 'enterprise';

export const EnterpriseOnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<V8PartnerOnboardingStatus | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);

  // Step 1: Terms
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Step 2: Pricing
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    Api.getSubscriptionPlans()
      .then((plans: any[]) => setSubscriptionPlans(Array.isArray(plans) ? plans : []))
      .catch(() => setSubscriptionPlans([]));
  }, [step]);

  const loadStatus = async () => {
    const normalizeStatus = (data: any): V8PartnerOnboardingStatus => ({
      termsAccepted: Boolean(data?.termsAccepted ?? data?.terms_accepted),
      privacyAccepted: Boolean(data?.privacyAccepted ?? data?.privacy_accepted),
      pricingTier:
        data?.pricingTier === undefined ? (data?.pricing_tier ?? null) : data.pricingTier,
      paymentSetup: Boolean(data?.paymentSetup ?? data?.payment_setup),
      completed: Boolean(data?.completed),
    });

    const applyStatus = (data: V8PartnerOnboardingStatus) => {
      setStatus(data);

      // Resume from last incomplete step
      if (data.completed) {
        navigate('/app');
      } else if (data.paymentSetup) {
        setStep(4);
      } else if (data.pricingTier) {
        setStep(3);
        setSelectedTier(data.pricingTier as PricingTier);
      } else if (data.termsAccepted) {
        setStep(2);
      }
    };

    try {
      const data = await V8PartnerApi.getOnboardingStatus();
      applyStatus(normalizeStatus(data?.status));
    } catch (error) {
      if (!shouldFallbackToLegacyPartner(error)) {
        console.error('Failed to load onboarding status:', error);
        return;
      }
      try {
        const legacy = await Api.get('/onboarding/status');
        applyStatus(normalizeStatus(legacy));
      } catch (legacyError) {
        console.error('Failed to load onboarding status:', legacyError);
      }
    }
  };

  const handleAcceptTerms = async () => {
    if (!termsAccepted || !privacyAccepted) {
      toast.error(t('onboarding.toast.acceptBoth', 'Zaakceptuj Regulamin i Politykę Prywatności'));
      return;
    }

    setLoading(true);
    try {
      try {
        await V8PartnerApi.acceptOnboardingTerms({
          termsVersion: 'v1.0',
          privacyVersion: 'v1.0',
        });
      } catch (error) {
        if (!shouldFallbackToLegacyPartner(error)) {
          throw error;
        }
        await Api.post('/onboarding/accept-terms', {
          termsVersion: 'v1.0',
          privacyVersion: 'v1.0',
        });
      }
      toast.success(t('onboarding.toast.termsAccepted', 'Regulamin zaakceptowany'));
      setStep(2);
    } catch (error) {
      toast.error(t('onboarding.toast.termsError', 'Nie udało się zaakceptować regulaminu'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTier = async () => {
    if (!selectedTier) {
      toast.error(t('onboarding.toast.selectTier', 'Wybierz plan cenowy'));
      return;
    }

    setLoading(true);
    try {
      try {
        await V8PartnerApi.selectOnboardingTier({ tier: selectedTier });
      } catch (error) {
        if (!shouldFallbackToLegacyPartner(error)) {
          throw error;
        }
        await Api.post('/onboarding/select-tier', { tier: selectedTier });
      }
      toast.success(t('onboarding.toast.tierSelected', 'Plan cenowy wybrany'));
      setStep(3);
    } catch (error) {
      toast.error(t('onboarding.toast.tierError', 'Nie udało się wybrać planu'));
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPayment = async () => {
    // Skip payment for now - directly complete onboarding
    setLoading(true);
    try {
      try {
        await V8PartnerApi.completeOnboarding();
      } catch (error) {
        if (!shouldFallbackToLegacyPartner(error)) {
          throw error;
        }
        await Api.post('/onboarding/complete', {});
      }
      toast.success(t('onboarding.toast.completed', 'Onboarding zakończony!'));
      navigate('/app');
    } catch (error) {
      toast.error(t('onboarding.toast.completeError', 'Nie udało się zakończyć onboardingu'));
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPayment = async () => {
    toast('Skontaktuj sie z zespołem partnerskim, aby uzgodnic payout i billing.', {
      icon: 'ℹ️',
    });
    navigate(ROUTES.LEGAL.CONTACT);
  };

  // Step 1: Terms & Privacy
  if (step === 1) {
    return (
      <div className="min-h-screen bg-c-bg flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-c-surface-raised rounded-xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-c-accent-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-c-accent dark:text-c-accent" />
            </div>
            <h1 className="text-3xl font-bold text-c-text mb-2">
              Start your partner application
            </h1>
            <p className="text-c-text-secondary">
              To jest ta sama sciezka aplikacyjna uruchamiana z LP i z produktu.
            </p>
          </div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-c-accent dark:text-c-accent font-medium">
                Step 1 of 4
              </span>
              <span className="text-c-text-muted">Partner agreement</span>
            </div>
            <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
              <div className="h-full bg-c-surface w-1/4 transition-all duration-300" />
            </div>
          </div>

          <div className="space-y-6">
            {/* Terms & Conditions */}
            <div className="border border-c-border-subtle rounded-xl p-6 bg-c-surface-raised dark:bg-c-surface">
              <h3 className="font-semibold text-c-text mb-3">Warunki programu</h3>
              <div className="max-h-40 overflow-y-auto text-sm text-c-text-secondary mb-4 space-y-2">
                <p>By using Consultify, you agree to our enterprise service agreement...</p>
                <p>• Professional services and AI-powered consulting tools</p>
                <p>• Data processing and privacy compliance (GDPR compliant)</p>
                <p>• Subscription terms and billing policies</p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-c-border-subtle text-c-accent focus:ring-c-focus"
                />
                <span className="text-sm text-c-text-secondary">
                  Akceptuje warunki programu partnerskiego
                </span>
              </label>
            </div>

            {/* Privacy Policy */}
            <div className="border border-c-border-subtle rounded-xl p-6 bg-c-surface-raised dark:bg-c-surface">
              <h3 className="font-semibold text-c-text mb-3">
                Polityka prywatnosci
              </h3>
              <div className="max-h-40 overflow-y-auto text-sm text-c-text-secondary mb-4 space-y-2">
                <p>We respect your privacy and protect your data...</p>
                <p>• We collect only necessary business information</p>
                <p>• Your data is encrypted and secure</p>
                <p>• You control your data - delete anytime</p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-c-border-subtle text-c-accent focus:ring-c-focus"
                />
                <span className="text-sm text-c-text-secondary">
                  Akceptuje polityke prywatnosci
                </span>
              </label>
            </div>
          </div>

          <button
            onClick={handleAcceptTerms}
            disabled={!termsAccepted || !privacyAccepted || loading}
 className="w-full mt-8 bg-c-text text-c-surface hover:opacity-90 disabled:bg-c-border dark:disabled:bg-c-surface-raised font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Potwierdz i przejdz dalej
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Pricing Selection
  if (step === 2) {
    const formatMonthlyPrice = (raw: any): string => {
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return 'Custom';
      // Heuristic: most seeded plan prices are stored in cents (e.g. 4900 = $49.00).
      const dollars = n >= 1000 ? n / 100 : n;
      return `$${dollars.toFixed(dollars % 1 === 0 ? 0 : 2)}`;
    };

    const findPlan = (tier: PricingTier) => {
      const byId = subscriptionPlans.find((p) => String(p.id).toLowerCase() === tier);
      if (byId) return byId;
      const name = subscriptionPlans.find((p) => String(p.name).toLowerCase().includes(tier));
      if (name) return name;
      if (tier === 'professional') {
        const pro = subscriptionPlans.find((p) => String(p.name).toLowerCase().includes('pro'));
        if (pro) return pro;
      }
      return null;
    };

    const tiers = [
      {
        id: 'starter' as PricingTier,
        name: findPlan('starter')?.name || 'Starter',
        price: formatMonthlyPrice(findPlan('starter')?.price_monthly),
        period: '/month',
        features: (Array.isArray(findPlan('starter')?.features) &&
          findPlan('starter')?.features) || [
          '5 users',
          'Basic reports',
          'Email support',
          '5 GB storage',
        ],
        popular: false,
      },
      {
        id: 'professional' as PricingTier,
        name: findPlan('professional')?.name || 'Professional',
        price: formatMonthlyPrice(findPlan('professional')?.price_monthly),
        period: '/month',
        features: (Array.isArray(findPlan('professional')?.features) &&
          findPlan('professional')?.features) || [
          '20 users',
          'Advanced AI features',
          'Priority support',
          '50 GB storage',
          'Custom integrations',
        ],
        popular: true,
      },
      {
        id: 'enterprise' as PricingTier,
        name: findPlan('enterprise')?.name || 'Enterprise',
        price: formatMonthlyPrice(findPlan('enterprise')?.price_monthly),
        period: '',
        features: (Array.isArray(findPlan('enterprise')?.features) &&
          findPlan('enterprise')?.features) || [
          'Unlimited users',
          'White-label',
          'Dedicated support',
          'Unlimited storage',
          'SLA guarantee',
        ],
        popular: false,
      },
    ];

    return (
      <div className="min-h-screen bg-c-bg flex items-center justify-center p-4">
        <div className="max-w-6xl w-full">
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-c-accent-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-c-accent dark:text-c-accent" />
            </div>
            <h1 className="text-3xl font-bold text-c-text mb-2">
              Choose your partner track
            </h1>
            <p className="text-c-text-secondary">
              Wybierz model wejscia, ktory najlepiej pasuje do planu wspolpracy.
            </p>
          </div>

          {/* Progress */}
          <div className="mb-12 max-w-2xl mx-auto">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-c-accent dark:text-c-accent font-medium">
                Step 2 of 4
              </span>
              <span className="text-c-text-muted">Partner track</span>
            </div>
            <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
              <div className="h-full bg-c-surface w-2/4 transition-all duration-300" />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                className={`relative bg-c-surface-raised rounded-xl p-8 cursor-pointer transition-all border-2 ${
                  selectedTier === tier.id
                    ? 'border-c-accent shadow-2xl scale-105'
                    : 'border-transparent hover:border-c-accent dark:hover:border-c-accent'
                } ${tier.popular ? 'ring-2 ring-c-accent ring-offset-4' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-c-surface text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-c-text mb-2">
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-c-accent">{tier.price}</span>
                    <span className="text-c-text-muted">{tier.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-5 h-5 text-c-success flex-shrink-0 mt-0.5" />
                      <span className="text-c-text-secondary">{feature}</span>
                    </li>
                  ))}
                </ul>

                {selectedTier === tier.id && (
                  <div className="absolute top-4 right-4 w-8 h-8 bg-c-surface rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleSelectTier}
              disabled={!selectedTier || loading}
 className="w-full bg-c-text text-c-surface hover:opacity-90 disabled:bg-c-border dark:disabled:bg-c-surface-raised font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Continue with{' '}
                  {selectedTier ? tiers.find((t) => t.id === selectedTier)?.name : 'Selected Plan'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Payout readiness
  if (step === 3) {
    return (
      <div className="min-h-screen bg-c-bg flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-c-surface-raised rounded-xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-c-accent-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-c-accent dark:text-c-accent" />
            </div>
            <h1 className="text-3xl font-bold text-c-text mb-2">
              Payout and billing readiness
            </h1>
            <p className="text-c-text-secondary">
              Ustal dane do rozliczen teraz albo przejdz dalej i dopnij je z zespołem partnerskim.
            </p>
          </div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-c-accent dark:text-c-accent font-medium">
                Step 3 of 4
              </span>
              <span className="text-c-text-muted">Payout readiness</span>
            </div>
            <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
              <div className="h-full bg-c-surface w-3/4 transition-all duration-300" />
            </div>
          </div>

          <div className="bg-[color-mix(in_srgb,var(--c-info)_10%,transparent)] border-l-2 border-c-info rounded-xl p-6 mb-8">
            <div className="flex gap-3">
              <Shield className="w-6 h-6 text-c-info flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-c-text mb-1">
                  Rozliczenia partnera
                </h3>
                <p className="text-sm text-c-text-secondary">
                  Finalne dane payout i billing mozna uzgodnic automatycznie w flow albo manualnie z
                  zespołem partnerskim dla niestandardowych warunkow.
                </p>
              </div>
            </div>
          </div>

          {/* Placeholder for Stripe Elements */}
          <div className="border-2 border-dashed border-c-border rounded-xl p-12 mb-8 text-center">
            <CreditCard className="w-16 h-16 text-c-text-secondary dark:text-c-text-muted mx-auto mb-4" />
            <p className="text-c-text-muted mb-2">Payout and billing setup</p>
            <p className="text-sm text-c-text-secondary dark:text-c-text-muted">
              (Automated payout setup can be expanded in the next rollout)
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSkipPayment}
              className="flex-1 border-2 border-c-accent text-c-accent hover:bg-c-accent-soft font-semibold py-4 rounded-xl transition-all"
            >
              Continue and finish later
            </button>
            <button
              onClick={handleSetupPayment}
              disabled={loading}
 className="flex-1 bg-c-text text-c-surface hover:opacity-90 disabled:bg-c-border dark:disabled:bg-c-surface-raised font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Contact partner team
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Completion (shouldn't normally reach here, but just in case)
  return (
    <div className="min-h-screen bg-c-bg flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-c-surface-raised rounded-xl shadow-2xl p-8 text-center">
        <div className="w-20 h-20 bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-c-success" />
        </div>
        <h1 className="text-3xl font-bold text-c-text mb-4">
          Partner application completed
        </h1>
        <p className="text-lg text-c-text-secondary mb-8">
          Twoj workspace jest gotowy do kolejnego kroku aktywacji i pracy w programie.
        </p>
        <button
          onClick={() => navigate('/app')}
 className="bg-c-text text-c-surface hover:opacity-90 font-semibold px-8 py-4 rounded-xl transition-all inline-flex items-center gap-2"
        >
          Go to workspace
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
