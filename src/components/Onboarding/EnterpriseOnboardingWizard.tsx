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
import { useNavigate } from 'react-router-dom';

import { Api } from '@/services/api';

type OnboardingStep = 1 | 2 | 3 | 4;
type PricingTier = 'starter' | 'professional' | 'enterprise';

interface OnboardingStatus {
  terms_accepted: boolean;
  privacy_accepted: boolean;
  pricing_tier: string | null;
  payment_setup: boolean;
  completed: boolean;
}

export const EnterpriseOnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);

  // Step 1: Terms
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Step 2: Pricing
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await Api.get('/onboarding/status');
      setStatus(data);

      // Resume from last incomplete step
      if (data.completed) {
        navigate('/app');
      } else if (data.payment_setup) {
        setStep(4);
      } else if (data.pricing_tier) {
        setStep(3);
        setSelectedTier(data.pricing_tier as PricingTier);
      } else if (data.terms_accepted) {
        setStep(2);
      }
    } catch (error) {
      console.error('Failed to load onboarding status:', error);
    }
  };

  const handleAcceptTerms = async () => {
    if (!termsAccepted || !privacyAccepted) {
      toast.error('Please accept both Terms and Privacy Policy');
      return;
    }

    setLoading(true);
    try {
      await Api.post('/onboarding/accept-terms', {
        termsVersion: 'v1.0',
        privacyVersion: 'v1.0',
      });
      toast.success('Terms accepted');
      setStep(2);
    } catch (error) {
      toast.error('Failed to accept terms');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTier = async () => {
    if (!selectedTier) {
      toast.error('Please select a pricing tier');
      return;
    }

    setLoading(true);
    try {
      await Api.post('/onboarding/select-tier', { tier: selectedTier });
      toast.success('Pricing tier selected');
      setStep(3);
    } catch (error) {
      toast.error('Failed to select tier');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPayment = async () => {
    // Skip payment for now - directly complete onboarding
    setLoading(true);
    try {
      await Api.post('/onboarding/complete', {});
      toast.success('Onboarding completed!');
      navigate('/app');
    } catch (error) {
      toast.error('Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPayment = async () => {
    // TODO: Integrate Stripe Elements here
    toast('Stripe integration coming soon');
    // For now, just skip to completion
    handleSkipPayment();
  };

  // Step 1: Terms & Privacy
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-navy-900 dark:to-navy-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white dark:bg-navy-800 rounded-xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-2">
              Welcome to Consultinity!
            </h1>
            <p className="text-slate-600 dark:text-slate-300">
              Before we begin, please review and accept our terms
            </p>
          </div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-purple-600 dark:text-purple-400 font-medium">Step 1 of 4</span>
              <span className="text-slate-500 dark:text-slate-400">Legal Agreement</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
              <div className="h-full bg-purple-600 w-1/4 transition-all duration-300" />
            </div>
          </div>

          <div className="space-y-6">
            {/* Terms & Conditions */}
            <div className="border border-slate-200 dark:border-navy-700 rounded-xl p-6 bg-slate-50 dark:bg-navy-900/50">
              <h3 className="font-semibold text-navy-900 dark:text-white mb-3">
                Terms & Conditions
              </h3>
              <div className="max-h-40 overflow-y-auto text-sm text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <p>By using Consultinity, you agree to our enterprise service agreement...</p>
                <p>• Professional services and AI-powered consulting tools</p>
                <p>• Data processing and privacy compliance (GDPR compliant)</p>
                <p>• Subscription terms and billing policies</p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-300 dark:border-navy-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  I have read and accept the Terms & Conditions
                </span>
              </label>
            </div>

            {/* Privacy Policy */}
            <div className="border border-slate-200 dark:border-navy-700 rounded-xl p-6 bg-slate-50 dark:bg-navy-900/50">
              <h3 className="font-semibold text-navy-900 dark:text-white mb-3">Privacy Policy</h3>
              <div className="max-h-40 overflow-y-auto text-sm text-slate-600 dark:text-slate-300 mb-4 space-y-2">
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
                  className="mt-1 w-5 h-5 rounded border-slate-300 dark:border-navy-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  I have read and accept the Privacy Policy
                </span>
              </label>
            </div>
          </div>

          <button
            onClick={handleAcceptTerms}
            disabled={!termsAccepted || !privacyAccepted || loading}
            className="w-full mt-8 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-navy-700 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Accept & Continue
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
    const tiers = [
      {
        id: 'starter' as PricingTier,
        name: 'Starter',
        price: '$49',
        period: '/month',
        features: ['5 users', 'Basic reports', 'Email support', '5 GB storage'],
        popular: false,
      },
      {
        id: 'professional' as PricingTier,
        name: 'Professional',
        price: '$149',
        period: '/month',
        features: [
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
        name: 'Enterprise',
        price: 'Custom',
        period: '',
        features: [
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-navy-900 dark:to-navy-800 flex items-center justify-center p-4">
        <div className="max-w-6xl w-full">
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-2">
              Choose Your Plan
            </h1>
            <p className="text-slate-600 dark:text-slate-300">
              Select the perfect tier for your organization
            </p>
          </div>

          {/* Progress */}
          <div className="mb-12 max-w-2xl mx-auto">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-purple-600 dark:text-purple-400 font-medium">Step 2 of 4</span>
              <span className="text-slate-500 dark:text-slate-400">Pricing Selection</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
              <div className="h-full bg-purple-600 w-2/4 transition-all duration-300" />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                className={`relative bg-white dark:bg-navy-800 rounded-xl p-8 cursor-pointer transition-all border-2 ${
                  selectedTier === tier.id
                    ? 'border-purple-500 shadow-2xl scale-105'
                    : 'border-transparent hover:border-purple-200 dark:hover:border-purple-900'
                } ${tier.popular ? 'ring-2 ring-purple-500 ring-offset-4' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-purple-600">{tier.price}</span>
                    <span className="text-slate-500 dark:text-slate-400">{tier.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 dark:text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {selectedTier === tier.id && (
                  <div className="absolute top-4 right-4 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
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
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-navy-700 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
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

  // Step 3: Payment Setup
  if (step === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-navy-900 dark:to-navy-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white dark:bg-navy-800 rounded-xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-2">Payment Setup</h1>
            <p className="text-slate-600 dark:text-slate-300">
              Add your payment method to continue
            </p>
          </div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-purple-600 dark:text-purple-400 font-medium">Step 3 of 4</span>
              <span className="text-slate-500 dark:text-slate-400">Payment Method</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
              <div className="h-full bg-purple-600 w-3/4 transition-all duration-300" />
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8">
            <div className="flex gap-3">
              <Shield className="w-6 h-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                  Secure Payment Processing
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Your payment information is encrypted and processed securely by Stripe. We never
                  store your full card details.
                </p>
              </div>
            </div>
          </div>

          {/* Placeholder for Stripe Elements */}
          <div className="border-2 border-dashed border-slate-300 dark:border-navy-600 rounded-xl p-12 mb-8 text-center">
            <CreditCard className="w-16 h-16 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 mb-2">Stripe Payment Form</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              (Integration with Stripe Elements pending)
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSkipPayment}
              className="flex-1 border-2 border-purple-600 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-semibold py-4 rounded-xl transition-all"
            >
              Skip for Now
            </button>
            <button
              onClick={handleSetupPayment}
              disabled={loading}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-navy-700 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Add Payment Method
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-navy-900 dark:to-navy-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-navy-800 rounded-xl shadow-2xl p-8 text-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-4">Welcome Aboard!</h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
          Your account is ready. Let's get started with Consultinity!
        </p>
        <button
          onClick={() => navigate('/app')}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 py-4 rounded-xl transition-all inline-flex items-center gap-2"
        >
          Go to Dashboard
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
