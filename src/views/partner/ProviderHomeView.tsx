/**
 * ProviderHomeView - Partner Program Landing Page
 *
 * Inspired by HubSpot Solutions Provider Home
 *
 * Sections:
 * 1. Welcome Hero Banner - "Be Our Partner"
 * 2. Value Cards (4) - Benefits of partnership
 * 3. Beta Partners Success Stories
 * 4. Tier Progression Visualization
 * 5. Gentle Onboarding Checklist
 * 6. Commission Calculator
 * 7. Academy Preview
 * 8. Contact Partner Manager (Bartosz Sotomski)
 * 9. FAQ with expandable answers
 * 10. Footer Resources
 */

import {
  ArrowRight,
  Award,
  BookOpen,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  HelpCircle,
  Link2,
  Linkedin,
  Mail,
  MessageCircle,
  Play,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '../../services/api';
import {
  shouldFallbackToLegacyPartner,
  V8PartnerApi,
  type V8PartnerOnboardingStatus,
} from '../../services/api/v8';
import { cn } from '../../utils/cn';

// ============================================================================
// WELCOME HERO BANNER
// ============================================================================

const WelcomeHeroBanner: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 p-8 md:p-12">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white dark:bg-navy-900 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-300 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative z-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white/90 text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          {t('partner.hero.badge', 'Partner Program')}
        </div>

        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
          {t('partner.hero.title1', 'Be Our Partner.')}
          <br />
          <span className="text-violet-200">
            {t('partner.hero.title2', "Let's Grow Together.")}
          </span>
        </h1>

        <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl">
          {t(
            'partner.hero.description',
            'Join our network of transformation experts. Earn recurring revenue, access premium tools, and help businesses achieve digital excellence.'
          )}
        </p>

        <div className="flex flex-wrap gap-4">
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-navy-900 text-violet-700 font-semibold rounded-lg hover:bg-violet-50 transition-colors">
            {t('partner.hero.getStarted', 'Get Started Now')}
            <ArrowRight className="w-5 h-5" />
          </button>
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-slate-50/50 dark:bg-navy-950/30 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors border border-white/20">
            <Play className="w-5 h-5" />
            {t('partner.hero.watchOverview', 'Watch Overview')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// VALUE CARDS
// ============================================================================

interface ValueCard {
  icon: React.ElementType;
  image: string;
  title: string;
  description: string;
  highlight: string;
}

const ValueCardsSection: React.FC = () => {
  const { t } = useTranslation();

  const cardKeys = ['revenue', 'expertise', 'tools', 'network'] as const;
  const cardIcons = [DollarSign, GraduationCap, Zap, Globe];
  const cardImages = [
    '/images/partner/partner-value-revenue.png',
    '/images/partner/partner-value-expertise.png',
    '/images/partner/partner-value-tools.png',
    '/images/partner/partner-value-network.png',
  ];

  const valueCards: ValueCard[] = cardKeys.map((key, i) => ({
    icon: cardIcons[i],
    image: cardImages[i],
    title: t(`partner.value.cards.${key}.title`),
    description: t(`partner.value.cards.${key}.description`),
    highlight: t(`partner.value.cards.${key}.highlight`),
  }));

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          {t('partner.value.title', 'Why Partner with Consultify?')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t('partner.value.subtitle', 'Everything you need to grow your transformation practice')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {valueCards.map((card, index) => (
          <div
            key={index}
            className="group bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6 hover:shadow-lg hover:border-violet-300 dark:hover:border-violet-600 transition-all duration-300"
          >
            {/* Custom illustration */}
            <div className="w-24 h-24 mb-4 rounded-xl overflow-hidden group-hover:scale-105 transition-transform">
              <img src={card.image} alt={card.title} className="w-full h-full object-contain" />
            </div>

            <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">
              {card.title}
            </h3>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{card.description}</p>

            <span className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 dark:text-violet-400">
              <Star className="w-4 h-4" />
              {card.highlight}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// BETA PARTNERS SUCCESS STORIES
// ============================================================================

const BetaSuccessStories: React.FC = () => {
  const { t } = useTranslation();

  const storyLogos = [
    '/images/partner/partner-story-nordic.png',
    '/images/partner/partner-story-transformace.png',
  ];

  const stories = [0, 1].map((i) => ({
    company: t(`partner.beta.stories.${i}.company`),
    type: t(`partner.beta.stories.${i}.type`),
    location: t(`partner.beta.stories.${i}.location`),
    quote: t(`partner.beta.stories.${i}.quote`),
    results: t(`partner.beta.stories.${i}.results`, { returnObjects: true }) as string[],
    since: t(`partner.beta.stories.${i}.since`),
    logo: storyLogos[i],
  }));

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium mb-3">
          <Clock className="w-4 h-4" />
          {t('partner.beta.badge', 'Beta Phase')}
        </div>
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          {t('partner.beta.title', 'Early Adopters Already See Results')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t(
            'partner.beta.subtitle',
            'Our beta partners are transforming how they work with clients'
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stories.map((story, index) => (
          <div
            key={index}
            className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-white dark:bg-navy-700 shadow-sm flex-shrink-0">
                <img
                  src={story.logo}
                  alt={story.company}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h3 className="font-semibold text-navy-900 dark:text-white">{story.company}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {story.type} • {story.location}
                </p>
              </div>
            </div>

            <blockquote className="text-slate-600 dark:text-slate-300 italic mb-4 border-l-2 border-violet-400 pl-4">
              "{story.quote}"
            </blockquote>

            <div className="mb-4">
              <p className="text-sm font-medium text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                {t('partner.beta.resultsLabel', 'Results in Beta Phase:')}
              </p>
              <ul className="space-y-1">
                {story.results.map((result, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {result}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
              <Clock className="w-3 h-3" />
              {t('partner.beta.partnerSince', 'Beta Partner since {{date}}', { date: story.since })}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center p-4 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
        <p className="text-sm text-violet-700 dark:text-violet-300">
          <Rocket className="w-4 h-4 inline mr-2" />
          <span
            dangerouslySetInnerHTML={{
              __html: t(
                'partner.beta.launchNotice',
                '<strong>Official Partner Program launch coming Q1 2026.</strong> Join now as an early adopter and get priority access, special commission rates, and direct input on product roadmap.'
              ),
            }}
          />
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// TIER PROGRESSION
// ============================================================================

const TierProgressionSection: React.FC = () => {
  const { t } = useTranslation();

  const tierKeys = ['registered', 'bronze', 'silver', 'gold', 'platinum'] as const;
  const tierCommissions = ['10%', '12%', '15%', '18%', '20%'];
  const tierColors = [
    'bg-slate-400',
    'bg-amber-600',
    'bg-slate-300',
    'bg-yellow-500',
    'bg-violet-600',
  ];
  const tierBadges = [
    '/images/partner/tier-registered.png',
    '/images/partner/tier-bronze.png',
    '/images/partner/tier-silver.png',
    '/images/partner/tier-gold.png',
    '/images/partner/tier-platinum.png',
  ];

  const tiers = tierKeys.map((key, i) => ({
    name: t(`partner.tiers.${key}.name`),
    commission: tierCommissions[i],
    requirement: t(`partner.tiers.${key}.requirement`),
    color: tierColors[i],
    badge: tierBadges[i],
    benefits: t(`partner.tiers.${key}.benefits`, { returnObjects: true }) as string[],
  }));

  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          {t('partner.tiers.title', 'Your Path to Partnership Success')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t(
            'partner.tiers.subtitle',
            'Progress through tiers as you grow. Higher tiers = higher rewards.'
          )}
        </p>
      </div>

      {/* Tier progression bar */}
      <div className="relative mb-8">
        <div className="absolute top-4 left-0 right-0 h-1 bg-slate-200 dark:bg-navy-700 rounded-full" />
        <div className="relative flex justify-between">
          {tiers.map((tier, index) => (
            <div key={tier.name} className="flex flex-col items-center" style={{ width: '20%' }}>
              <div className="w-12 h-12 rounded-full overflow-hidden z-10 bg-white dark:bg-navy-700 shadow-md">
                <img
                  src={tier.badge}
                  alt={`${tier.name} tier badge`}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="mt-3 text-center">
                <p className="font-semibold text-sm text-navy-900 dark:text-white">{tier.name}</p>
                <p className="text-lg font-bold text-violet-600 dark:text-violet-400">
                  {tier.commission}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {tier.requirement}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Benefits grid */}
      <div className="grid grid-cols-5 gap-2 text-center">
        {tiers.map((tier) => (
          <div key={tier.name} className="space-y-1">
            {tier.benefits.map((benefit, i) => (
              <div
                key={i}
                className="text-xs text-slate-500 dark:text-slate-400 py-1 px-2 bg-slate-50 dark:bg-navy-700/50 rounded"
              >
                {benefit}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// GENTLE ONBOARDING CHECKLIST
// ============================================================================

const OnboardingChecklistSection: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<V8PartnerOnboardingStatus>({
    termsAccepted: false,
    privacyAccepted: false,
    pricingTier: null,
    paymentSetup: false,
    completed: false,
  });

  const normalizeOnboardingStatus = useCallback(
    (payload: any): V8PartnerOnboardingStatus => ({
      termsAccepted: Boolean(payload?.termsAccepted ?? payload?.terms_accepted),
      privacyAccepted: Boolean(payload?.privacyAccepted ?? payload?.privacy_accepted),
      pricingTier:
        payload?.pricingTier === undefined ? (payload?.pricing_tier ?? null) : payload.pricingTier,
      paymentSetup: Boolean(payload?.paymentSetup ?? payload?.payment_setup),
      completed: Boolean(payload?.completed),
    }),
    []
  );

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const response = await V8PartnerApi.getOnboardingStatus();
        if (!cancelled && response?.status) {
          setStatus(normalizeOnboardingStatus(response.status));
        }
      } catch (error) {
        if (!shouldFallbackToLegacyPartner(error)) return;
        try {
          const legacy = await Api.get('/onboarding/status');
          if (!cancelled) {
            setStatus(normalizeOnboardingStatus(legacy));
          }
        } catch {
          // Keep default pending state when neither seam resolves.
        }
      }
    };

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [normalizeOnboardingStatus]);

  const goToOnboarding = useCallback(() => {
    navigate('/setup/onboarding');
  }, [navigate]);

  const steps = [0, 1, 2, 3].map((i) => ({
    id: i + 1,
    title: [
      t('partner.onboarding.termsTitle', 'Accept terms and privacy'),
      t('partner.onboarding.pricingTitle', 'Choose pricing tier'),
      t('partner.onboarding.paymentTitle', 'Set up payment'),
      t('partner.onboarding.completeTitle', 'Complete onboarding'),
    ][i],
    description: [
      t(
        'partner.onboarding.termsDescription',
        'Confirm legal acceptance so your partner workspace can start with the correct guardrails.'
      ),
      t(
        'partner.onboarding.pricingDescription',
        'Pick the pricing tier that matches your partner operating model.'
      ),
      t(
        'partner.onboarding.paymentDescription',
        'Add payment setup to unlock the full commercial onboarding path.'
      ),
      t(
        'partner.onboarding.completeDescription',
        'Finish the onboarding flow so your workspace is ready for day-to-day partner operations.'
      ),
    ][i],
    why: [
      t(
        'partner.onboarding.termsWhy',
        'This keeps your onboarding record aligned with the real workspace contract.'
      ),
      t(
        'partner.onboarding.pricingWhy',
        'The selected tier determines how the onboarding flow configures your workspace.'
      ),
      t(
        'partner.onboarding.paymentWhy',
        'Payment readiness is a real onboarding milestone, not a static checklist guess.'
      ),
      t(
        'partner.onboarding.completeWhy',
        'A completed onboarding state unlocks the intended downstream trial and workspace behavior.'
      ),
    ][i],
    time: ['1 min', '1 min', '2 min', '1 min'][i],
    completed: [
      status.termsAccepted && status.privacyAccepted,
      Boolean(status.pricingTier),
      status.paymentSetup,
      status.completed,
    ][i],
    cta: [
      t('partner.onboarding.termsCta', 'Review terms'),
      t('partner.onboarding.pricingCta', 'Choose plan'),
      t('partner.onboarding.paymentCta', 'Set up payment'),
      t('partner.onboarding.completeCta', 'Finish onboarding'),
    ][i],
    bonus:
      i === 1 && status.pricingTier
        ? t('partner.onboarding.pricingBonus', `Current tier: ${status.pricingTier}`)
        : undefined,
    secure: i === 3,
  }));

  const completedCount = steps.filter((s) => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-1">
            {t('partner.onboarding.title', 'Get Started in 10 Minutes')}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t(
              'partner.onboarding.subtitle',
              "We've made it simple. Complete these steps to unlock your partner benefits."
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
            {completedCount}/{steps.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('partner.onboarding.stepsCompleted', 'steps completed')}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-100 dark:bg-navy-700 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              'rounded-xl border p-4 transition-all',
              step.completed
                ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-50 dark:bg-navy-700/30 border-slate-200 dark:border-navy-600 hover:border-violet-300 dark:hover:border-violet-700'
            )}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  step.completed
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 dark:bg-navy-600 text-slate-500 dark:text-slate-400'
                )}
              >
                {step.completed ? <Check className="w-5 h-5" /> : step.id}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3
                    className={cn(
                      'font-semibold',
                      step.completed
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-navy-900 dark:text-white'
                    )}
                  >
                    Step {step.id}: {step.title}
                  </h3>
                  <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="w-3 h-3" />
                    {step.time}
                  </span>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  {step.description}
                </p>

                <div className="flex items-start gap-1 text-sm text-slate-500 dark:text-slate-400 mb-3">
                  <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Why?</strong> {step.why}
                  </span>
                </div>

                {step.bonus && (
                  <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400 mb-3">
                    <Sparkles className="w-4 h-4" />
                    <span>Bonus: {step.bonus}</span>
                  </div>
                )}

                {step.secure && (
                  <div className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 mb-3">
                    <Shield className="w-4 h-4" />
                    <span>Your data is encrypted and secure</span>
                  </div>
                )}

                {!step.completed && (
                  <button
                    onClick={goToOnboarding}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {step.cta}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// COMMISSION CALCULATOR
// ============================================================================

const CommissionCalculatorSection: React.FC = () => {
  const { t } = useTranslation();
  const [clientsPerMonth, setClientsPerMonth] = useState<number>(5);
  const [avgClientValue, setAvgClientValue] = useState<number>(2000);

  // Calculate based on tier
  const getTier = (clients: number) => {
    if (clients >= 50) return { name: 'Platinum', rate: 0.2 };
    if (clients >= 25) return { name: 'Gold', rate: 0.18 };
    if (clients >= 10) return { name: 'Silver', rate: 0.15 };
    if (clients >= 3) return { name: 'Bronze', rate: 0.12 };
    return { name: 'Registered', rate: 0.1 };
  };

  const annualClients = clientsPerMonth * 12;
  const tier = getTier(annualClients);
  const annualRevenue = clientsPerMonth * 12 * avgClientValue;
  const annualCommission = annualRevenue * tier.rate;

  return (
    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 rounded-xl border border-violet-200 dark:border-violet-800 p-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 text-violet-600 dark:text-violet-400 mb-2">
          <Calculator className="w-5 h-5" />
          <span className="font-semibold">Commission Calculator</span>
        </div>
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          Calculate Your Earning Potential
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          See how much you could earn as a Consultify Partner
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Clients per month */}
        <div>
          <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
            How many clients can you refer per month?
          </label>
          <div className="flex gap-2">
            {[1, 3, 5, 10, 15].map((num) => (
              <button
                key={num}
                onClick={() => setClientsPerMonth(num)}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                  clientsPerMonth === num
                    ? 'bg-violet-600 text-white'
                    : 'bg-white dark:bg-navy-700 text-slate-600 dark:text-slate-300 hover:bg-violet-100 dark:hover:bg-violet-900/30'
                )}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Avg client value */}
        <div>
          <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
            Average client value (€/month)
          </label>
          <input
            type="range"
            min="500"
            max="5000"
            step="100"
            value={avgClientValue}
            onChange={(e) => setAvgClientValue(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-violet-600"
          />
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>€500</span>
            <span className="font-semibold text-violet-600 dark:text-violet-400">
              €{avgClientValue.toLocaleString()}
            </span>
            <span>€5,000</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-navy-800 rounded-xl p-6 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
          Your tier:{' '}
          <span className="font-semibold text-violet-600 dark:text-violet-400">{tier.name}</span> (
          {Math.round(tier.rate * 100)}% commission)
        </p>

        <div className="my-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
            Your Estimated Annual Earnings
          </p>
          <p className="text-4xl font-bold text-navy-900 dark:text-white">
            €
            {annualCommission.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Based on {clientsPerMonth * 12} referrals/year at €{avgClientValue.toLocaleString()} avg
            value
          </p>
        </div>

        <button className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg transition-colors">
          <Rocket className="w-5 h-5" />
          Start Earning Now - Generate Your Code
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// ACADEMY PREVIEW
// ============================================================================

const AcademyPreviewSection: React.FC = () => {
  const { t } = useTranslation();

  const courses = [
    {
      title: 'Platform Fundamentals',
      description:
        'Learn the Consultify platform inside out. Master assessments, reporting, and client management.',
      duration: '45 min',
      certificate: true,
      free: true,
      expanded: true,
    },
    {
      title: 'How to Sell Digital Transformation',
      description: 'Proven sales methodology for transformation services.',
      duration: '60 min',
      certificate: true,
      free: true,
      expanded: false,
    },
    {
      title: 'Client Success Best Practices',
      description: 'Maximize client retention and satisfaction scores.',
      duration: '30 min',
      certificate: true,
      free: true,
      expanded: false,
    },
    {
      title: 'DRD Framework Certification',
      description: 'Deep dive into Digital Readiness Diagnostic methodology.',
      duration: '2 hours',
      certificate: true,
      advanced: true,
      expanded: false,
    },
  ];

  const [expandedCourse, setExpandedCourse] = useState<number>(0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Courses list */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          <h2 className="text-xl font-bold text-navy-900 dark:text-white">
            Sharpen Your Skills with Partner Academy
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Free courses designed to help you succeed
        </p>

        <div className="space-y-3">
          {courses.map((course, index) => (
            <div
              key={index}
              className={cn(
                'rounded-lg border transition-all cursor-pointer',
                expandedCourse === index
                  ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20'
                  : 'border-slate-200 dark:border-navy-700 hover:border-violet-200 dark:hover:border-violet-800'
              )}
              onClick={() => setExpandedCourse(index)}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={cn(
                        'w-5 h-5 text-violet-500 transition-transform',
                        expandedCourse === index ? 'rotate-0' : '-rotate-90'
                      )}
                    />
                    <div>
                      <h3 className="font-semibold text-navy-900 dark:text-white">
                        {course.title}
                      </h3>
                      {expandedCourse === index && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {course.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {course.free && !course.advanced && (
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded">
                        FREE
                      </span>
                    )}
                    {course.advanced && (
                      <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-medium rounded">
                        ADVANCED
                      </span>
                    )}
                  </div>
                </div>

                {expandedCourse === index && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {course.duration}
                      </span>
                      {course.certificate && (
                        <span className="flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          Certificate included
                        </span>
                      )}
                    </div>
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded transition-colors">
                      Start Course
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Contact section */}
      <ContactPartnerManagerSection />
    </div>
  );
};

// ============================================================================
// CONTACT PARTNER MANAGER
// ============================================================================

const ContactPartnerManagerSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-1">
          Questions? Let's Talk!
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your dedicated Partner Manager is here to help you succeed
        </p>
      </div>

      {/* Partner Manager Card */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-3xl font-bold mb-4 ring-4 ring-violet-100 dark:ring-violet-900/50">
          BS
        </div>
        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Bartosz Sotomski</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Partner Success Manager</p>
      </div>

      <blockquote className="text-sm text-slate-600 dark:text-slate-400 italic text-center mb-6 px-4">
        "I'm here to help you grow your business with Consultify. Whether you have questions about
        the program, need help with a client pitch, or want to discuss co-marketing opportunities -
        let's connect!"
      </blockquote>

      {/* Contact options */}
      <div className="space-y-3">
        <a
          href="https://calendly.com/bartosz-sotomski"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors group"
        >
          <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-navy-900 dark:text-white">Book a Call</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Schedule 15-min intro call</p>
          </div>
          <ExternalLink className="w-4 h-4 text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>

        <a
          href="mailto:bartosz.sotomski@dbr77.com"
          className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-navy-700/30 border border-slate-200 dark:border-navy-600 hover:bg-slate-100 dark:hover:bg-navy-700/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-navy-900 dark:text-white">Send Email</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">bartosz.sotomski@dbr77.com</p>
          </div>
        </a>

        <a
          href="https://www.linkedin.com/in/bartosz-sotomski/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-navy-700/30 border border-slate-200 dark:border-navy-600 hover:bg-slate-100 dark:hover:bg-navy-700/50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-full bg-[#0A66C2] flex items-center justify-center">
            <Linkedin className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-navy-900 dark:text-white">Connect on LinkedIn</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              linkedin.com/in/bartosz-sotomski
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      </div>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4 flex items-center justify-center gap-1">
        <MessageCircle className="w-3 h-3" />
        Average response time: &lt; 4 hours
      </p>
    </div>
  );
};

// ============================================================================
// FAQ SECTION
// ============================================================================

const FAQSection: React.FC = () => {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      question: 'How do I earn commissions as a partner?',
      answer:
        'You earn commissions by referring new clients to Consultify. When a client signs up using your unique referral code or link and becomes a paying customer, you receive a percentage of their subscription fee. Commission rates range from 10% to 20% depending on your partner tier.',
    },
    {
      question: 'When and how do I get paid?',
      answer:
        "Commissions are paid monthly via bank transfer or PayPal, once you reach the €100 minimum threshold. Payments are processed on the 15th of each month for the previous month's approved commissions. You can track all earnings in real-time through your Partner Dashboard.",
    },
    {
      question: 'What support do I get as a partner?',
      answer:
        'All partners receive access to Partner Academy training, marketing materials, and our partner community. Bronze tier and above get priority support and dedicated training. Gold and Platinum partners receive a dedicated Partner Manager, co-marketing opportunities, and early access to new features.',
    },
    {
      question: 'How long does it take to become certified?',
      answer:
        "The Platform Fundamentals certification takes about 45 minutes to complete. Advanced certifications like DRD Framework take 2-3 hours. All certifications are self-paced, so you can complete them whenever it's convenient for you.",
    },
    {
      question: 'Can I refer clients from any country?',
      answer:
        'Yes! Consultify operates globally, and you can refer clients from any country. Your Partner Directory listing can highlight your regional expertise, helping local clients find you. Commission payments can be made in EUR, USD, or GBP.',
    },
    {
      question: 'What happens if a referred client cancels?',
      answer:
        'If a referred client cancels within the first 30 days (cooling-off period), the commission for that client is adjusted. After 30 days, you keep all earned commissions even if the client later cancels. We believe in fair, transparent commission structures.',
    },
  ];

  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 text-violet-600 dark:text-violet-400 mb-2">
          <HelpCircle className="w-5 h-5" />
          <span className="font-semibold">FAQ</span>
        </div>
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="space-y-3 max-w-3xl mx-auto">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className={cn(
              'rounded-lg border transition-all',
              openFaq === index
                ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/10'
                : 'border-slate-200 dark:border-navy-700'
            )}
          >
            <button
              onClick={() => setOpenFaq(openFaq === index ? null : index)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-medium text-navy-900 dark:text-white pr-4">{faq.question}</span>
              <ChevronDown
                className={cn(
                  'w-5 h-5 text-violet-500 flex-shrink-0 transition-transform',
                  openFaq === index ? 'rotate-180' : ''
                )}
              />
            </button>

            {openFaq === index && (
              <div className="px-4 pb-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// FOOTER RESOURCES
// ============================================================================

const FooterResourcesSection: React.FC = () => {
  const { t } = useTranslation();

  const columns = [
    {
      title: 'Resources',
      icon: BookOpen,
      links: [
        { label: 'Partner Playbook', href: '#' },
        { label: 'Marketing Kit', href: '#' },
        { label: 'API Documentation', href: '#' },
        { label: 'Brand Guidelines', href: '#' },
      ],
    },
    {
      title: 'Community',
      icon: Users,
      links: [
        { label: 'Partner Slack', href: '#', external: true },
        { label: 'Monthly Webinars', href: '#' },
        { label: 'Success Stories', href: '#' },
        { label: 'Partner Forum', href: '#', external: true },
      ],
    },
    {
      title: 'Support',
      icon: HelpCircle,
      links: [
        { label: 'FAQ', href: '#' },
        { label: 'Help Center', href: '#' },
        { label: 'Technical Support', href: '#' },
        { label: 'Feature Requests', href: '#' },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {columns.map((column, index) => (
        <div
          key={index}
          className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <column.icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <h3 className="font-semibold text-navy-900 dark:text-white">{column.title}</h3>
          </div>

          <ul className="space-y-2">
            {column.links.map((link, i) => (
              <li key={i}>
                <a
                  href={link.href}
                  className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                >
                  {link.label}
                  {link.external && <ExternalLink className="w-3 h-3" />}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProviderHomeView: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Welcome Hero Banner */}
      <WelcomeHeroBanner />

      {/* 2. Value Cards */}
      <ValueCardsSection />

      {/* 3. Beta Success Stories */}
      <BetaSuccessStories />

      {/* 4. Tier Progression */}
      <TierProgressionSection />

      {/* 5. Onboarding Checklist */}
      <OnboardingChecklistSection />

      {/* 6. Commission Calculator */}
      <CommissionCalculatorSection />

      {/* 7 & 8. Academy Preview + Contact Section */}
      <AcademyPreviewSection />

      {/* 9. FAQ */}
      <FAQSection />

      {/* 10. Footer Resources */}
      <FooterResourcesSection />
    </div>
  );
};

export default ProviderHomeView;
