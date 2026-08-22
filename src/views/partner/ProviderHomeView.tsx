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

import { PARTNER_DOCS } from '../../config/partnerKnowledge';
import { ROUTES } from '../../routes/routeConfig';
import { Api } from '../../services/api';
import {
  shouldFallbackToLegacyPartner,
  V8PartnerApi,
  type V8PartnerOnboardingStatus,
} from '../../services/api/v8';
import { cn } from '../../utils/cn';
import { PARTNER_TIERS, resolveCalculatorTier } from './partnerPricingData';

// ============================================================================
// COMMERCIAL TERMS & CONTACT — AUDITABLE CONSTANTS
// ============================================================================
//
// These values are hard commercial content that could NOT be confirmed with
// the business at build time. They are centralized here (instead of inlined in
// JSX) so they are editable/auditable in one place before launch. Do not
// fabricate new values — confirm the real ones before going live.
//
// NOTE: commission percentages are NOT duplicated here — they come from the
// PARTNER_TIERS SSOT in partnerPricingData.ts.

// TODO(Piotr): confirm before launch — dedicated partner manager identity + links
const PARTNER_CONTACT = {
  name: 'Bartosz Sotomski',
  role: 'Partner Success Manager',
  initials: 'BS',
  calendlyUrl: 'https://calendly.com/bartosz-sotomski',
  email: 'bartosz.sotomski@dbr77.com',
  linkedinUrl: 'https://www.linkedin.com/in/bartosz-sotomski/',
  linkedinHandle: 'linkedin.com/in/bartosz-sotomski',
} as const;

// TODO(Piotr): confirm before launch — commercial program terms quoted in FAQ
// minCommissionPct / maxCommissionPct must stay in sync with PARTNER_TIERS SSOT
// (Bronze 10% … Platinum 20%).
const PARTNER_PROGRAM_TERMS = {
  minCommissionPct: PARTNER_TIERS[0].commissionRate, // SSOT — Bronze
  maxCommissionPct: PARTNER_TIERS[PARTNER_TIERS.length - 1].commissionRate, // SSOT — Platinum
  minPayoutThreshold: '€100',
  payoutDayOfMonth: 15,
  coolingOffDays: 30,
  averageResponseTime: '< 4 godziny',
} as const;

// ============================================================================
// WELCOME HERO BANNER
// ============================================================================

const WelcomeHeroBanner: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden rounded-xl bg-crimson-700 dark:bg-crimson-800 p-8 md:p-12">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-c-surface rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-crimson-300 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative z-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-c-surface/20 text-white/90 text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          {t('partner.hero.badge', 'Partner Program')}
        </div>

        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
          {t('partner.hero.title1', 'Be Our Partner.')}
          <br />
          <span className="text-crimson-200">
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
          <button
            onClick={() => navigate(ROUTES.PARTNER.ONBOARDING)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-c-surface text-crimson-700 dark:text-crimson-600 font-semibold rounded-lg hover:bg-crimson-50 dark:hover:bg-c-surface/90 transition-colors"
          >
            {t('partner.hero.getStarted', 'Open onboarding')}
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate(PARTNER_DOCS.overview.href)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-c-bg/50 dark:bg-navy-950/30 text-white font-semibold rounded-lg hover:bg-c-surface/20 transition-colors border border-white/20"
          >
            <Play className="w-5 h-5" />
            {t('partner.hero.watchOverview', 'Open partner docs')}
          </button>
          <button
            onClick={() => navigate(ROUTES.LEGAL.CONTACT)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-transparent text-white font-semibold rounded-lg hover:bg-c-surface/10 transition-colors border border-white/25"
          >
            <MessageCircle className="w-5 h-5" />
            {t('partner.hero.customTerms', 'Discuss custom terms')}
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

export const ValueCardsSection: React.FC = () => {
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
        <p className="text-c-text-secondary">
          {t('partner.value.subtitle', 'Everything you need to grow your transformation practice')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {valueCards.map((card, index) => (
          <div
            key={index}
            className="group bg-c-surface rounded-xl border border-c-border-subtle p-6 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-300"
          >
            {/* Custom illustration */}
            <div className="w-24 h-24 mb-4 rounded-xl overflow-hidden group-hover:scale-105 transition-transform">
              <img src={card.image} alt={card.title} className="w-full h-full object-contain" />
            </div>

            <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">
              {card.title}
            </h3>

            <p className="text-sm text-c-text-secondary mb-3">{card.description}</p>

            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 dark:text-primary-400">
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

export const BetaSuccessStories: React.FC = () => {
  const { t } = useTranslation();

  const storyLogos = [
    '/images/partner/partner-story-nordic.png',
    '/images/partner/partner-story-transformace.png',
  ];

  const stories = [0, 1].map((i) => {
    const translatedResults = t(`partner.beta.stories.${i}.results`, { returnObjects: true });
    return {
      company: t(`partner.beta.stories.${i}.company`),
      type: t(`partner.beta.stories.${i}.type`),
      location: t(`partner.beta.stories.${i}.location`),
      quote: t(`partner.beta.stories.${i}.quote`),
      // Missing or malformed locale data must not take down the Partner home.
      results: Array.isArray(translatedResults) ? translatedResults.map(String) : [],
      since: t(`partner.beta.stories.${i}.since`),
      logo: storyLogos[i],
    };
  });

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
        <p className="text-c-text-secondary">
          {t(
            'partner.beta.subtitle',
            'Our beta partners are transforming how they work with clients'
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stories.map((story, index) => (
          <div key={index} className="bg-c-surface rounded-xl border border-c-border-subtle p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-c-surface shadow-sm flex-shrink-0">
                <img
                  src={story.logo}
                  alt={story.company}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h3 className="font-semibold text-navy-900 dark:text-white">{story.company}</h3>
                <p className="text-sm text-c-text-muted">
                  {story.type} • {story.location}
                </p>
              </div>
            </div>

            <blockquote className="text-c-text-secondary italic mb-4 border-l-2 border-primary-400 pl-4">
              "{story.quote}"
            </blockquote>

            <div className="mb-4">
              <p className="text-sm font-medium text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                {t('partner.beta.resultsLabel', 'Results in Beta Phase:')}
              </p>
              <ul className="space-y-1">
                {story.results.map((result, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-c-text-secondary">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {result}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-2 text-xs text-c-text-secondary">
              <Clock className="w-3 h-3" />
              {t('partner.beta.partnerSince', 'Beta Partner since {{date}}', { date: story.since })}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center p-4 bg-gradient-to-r from-primary-50 to-crimson-50 dark:from-primary-900/20 dark:to-crimson-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
        <p className="text-sm text-primary-700 dark:text-primary-300">
          <Rocket className="w-4 h-4 inline mr-2" />
          <span
            dangerouslySetInnerHTML={{
              __html: t(
                'partner.beta.launchNotice',
                '<strong>Partner onboarding runs in a controlled rollout.</strong> Access to onboarding, resources, and payout operations is enabled progressively after partner profile activation.'
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

export const TierProgressionSection: React.FC = () => {
  const { t } = useTranslation();

  // SSOT — tier names + commission rates come from PARTNER_TIERS
  // (partnerPricingData.ts). The 5-tier "Registered 10%" model was dropped:
  // Bronze is already 10%, so a separate Registered tier was redundant.
  const tierBadges: Record<string, string> = {
    BRONZE: '/images/partner/tier-bronze.png',
    SILVER: '/images/partner/tier-silver.png',
    GOLD: '/images/partner/tier-gold.png',
    PLATINUM: '/images/partner/tier-platinum.png',
  };

  const tiers = PARTNER_TIERS.map((tier) => ({
    id: tier.id,
    name: tier.name,
    commission: `${tier.commissionRate}%`,
    requirement: tier.requirements[0]
      ? `${tier.requirements[0].label}: ${tier.requirements[0].value}`
      : '',
    badge: tierBadges[tier.id],
    benefits: tier.features
      .filter((f) => f.included)
      .slice(0, 3)
      .map((f) => f.name),
  }));

  return (
    <div className="bg-c-surface rounded-xl border border-c-border-subtle p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          {t('partner.tiers.title', 'Your Path to Partnership Success')}
        </h2>
        <p className="text-c-text-secondary">
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
          {tiers.map((tier) => (
            <div key={tier.name} className="flex flex-col items-center" style={{ width: '25%' }}>
              <div className="w-12 h-12 rounded-full overflow-hidden z-10 bg-c-surface shadow-md">
                <img
                  src={tier.badge}
                  alt={`${tier.name} tier badge`}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="mt-3 text-center">
                <p className="font-semibold text-sm text-navy-900 dark:text-white">{tier.name}</p>
                <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
                  {tier.commission}
                </p>
                <p className="text-xs text-c-text-muted mt-1">{tier.requirement}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Benefits grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {tiers.map((tier) => (
          <div key={tier.name} className="space-y-1">
            {tier.benefits.map((benefit, i) => (
              <div
                key={i}
                className="text-xs text-c-text-muted py-1 px-2 bg-c-surface-raised/50 rounded"
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

export const OnboardingChecklistSection: React.FC = () => {
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
    navigate(ROUTES.PARTNER.ONBOARDING);
  }, [navigate]);

  const openApplicationGuide = useCallback(() => {
    navigate(PARTNER_DOCS.application.href);
  }, [navigate]);

  const openCaseStudy = useCallback(() => {
    navigate(PARTNER_DOCS.caseStudyOperations.href);
  }, [navigate]);

  const openCustomTerms = useCallback(() => {
    navigate(ROUTES.LEGAL.CONTACT);
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
        ? t('partner.onboarding.pricingBonus', {
            tier: status.pricingTier,
            defaultValue: 'Current tier: {{tier}}',
          })
        : undefined,
    secure: i === 3,
  }));

  const completedCount = steps.filter((s) => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="bg-c-surface rounded-xl border border-c-border-subtle p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-1">
            {t('partner.onboarding.title', 'Get Started in 10 Minutes')}
          </h2>
          <p className="text-sm text-c-text-secondary">
            {t(
              'partner.onboarding.subtitle',
              "We've made it simple. Complete these steps to unlock your partner benefits."
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {completedCount}/{steps.length}
          </p>
          <p className="text-xs text-c-text-muted">
            {t('partner.onboarding.stepsCompleted', 'steps completed')}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-c-surface-raised rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-crimson-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mb-6 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/80 dark:bg-primary-900/20 p-4">
        <p className="text-sm text-c-text-secondary">
          {t(
            'partner.home.onboarding.sharedFlow',
            'To ten sam wspólny proces aplikacyjny używany ze strony publicznej i z wnętrza produktu. Przejrzyj przewodnik aplikacji, sprawdź case potwierdzający lub od razu przejdź do rozmowy o niestandardowych warunkach, gdy self-serve to za mało.'
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={openApplicationGuide}
            className="inline-flex items-center gap-2 rounded-lg border border-primary-300 dark:border-primary-700 px-4 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-c-surface/70 dark:hover:bg-navy-900/40"
          >
            <FileText className="w-4 h-4" />
            {t('partner.home.onboarding.openGuide', 'Otwórz przewodnik aplikacji')}
          </button>
          <button
            onClick={openCaseStudy}
            className="inline-flex items-center gap-2 rounded-lg border border-primary-300 dark:border-primary-700 px-4 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-c-surface/70 dark:hover:bg-navy-900/40"
          >
            <BookOpen className="w-4 h-4" />
            {t('partner.home.onboarding.reviewCase', 'Zobacz case potwierdzający')}
          </button>
          <button
            onClick={openCustomTerms}
            className="inline-flex items-center gap-2 rounded-lg bg-c-text px-4 py-2 text-sm font-medium text-c-bg hover:bg-c-text-secondary"
          >
            <MessageCircle className="w-4 h-4" />
            {t('partner.home.onboarding.customTerms', 'Omów niestandardowe warunki')}
          </button>
        </div>
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
                : 'bg-c-surface-raised/30 border-c-border-subtle hover:border-primary-300 dark:hover:border-primary-700'
            )}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  step.completed
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 dark:bg-navy-600 text-c-text-muted'
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
                    {t('partner.home.onboarding.stepLabel', 'Krok {{n}}', { n: step.id })}:{' '}
                    {step.title}
                  </h3>
                  <span className="flex items-center gap-1 text-xs text-c-text-muted">
                    <Clock className="w-3 h-3" />
                    {step.time}
                  </span>
                </div>

                <p className="text-sm text-c-text-secondary mb-2">{step.description}</p>

                <div className="flex items-start gap-1 text-sm text-c-text-muted mb-3">
                  <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>{t('partner.home.onboarding.whyLabel', 'Dlaczego?')}</strong> {step.why}
                  </span>
                </div>

                {step.bonus && (
                  <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400 mb-3">
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {t('partner.home.onboarding.bonusLabel', 'Bonus')}: {step.bonus}
                    </span>
                  </div>
                )}

                {step.secure && (
                  <div className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 mb-3">
                    <Shield className="w-4 h-4" />
                    <span>
                      {t(
                        'partner.home.onboarding.secureNote',
                        'Twoje dane są szyfrowane i bezpieczne'
                      )}
                    </span>
                  </div>
                )}

                {!step.completed && (
                  <button
                    onClick={goToOnboarding}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium rounded-lg transition-colors"
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

export const CommissionCalculatorSection: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [clientsPerMonth, setClientsPerMonth] = useState<number>(5);
  const [avgClientValue, setAvgClientValue] = useState<number>(2000);

  // SSOT — tier + commission rate resolved from PARTNER_TIERS via
  // resolveCalculatorTier (partnerPricingData.ts). Never hardcode rates here.
  const annualClients = clientsPerMonth * 12;
  const tier = resolveCalculatorTier(annualClients);
  const annualRevenue = clientsPerMonth * 12 * avgClientValue;
  const annualCommission = annualRevenue * tier.rate;

  return (
    <div className="bg-gradient-to-br from-primary-50 to-crimson-50 dark:from-primary-900/20 dark:to-crimson-900/20 rounded-xl border border-primary-200 dark:border-primary-800 p-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 mb-2">
          <Calculator className="w-5 h-5" />
          <span className="font-semibold">
            {t('partner.home.calculator.badge', 'Kalkulator prowizji')}
          </span>
        </div>
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          {t('partner.home.calculator.title', 'Oblicz swój potencjał zarobkowy')}
        </h2>
        <p className="text-c-text-secondary">
          {t(
            'partner.home.calculator.subtitle',
            'Zobacz, ile możesz zarobić jako Partner Consultify'
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Clients per month */}
        <div>
          <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
            {t('partner.home.calculator.clientsLabel', 'Ilu klientów możesz polecić miesięcznie?')}
          </label>
          <div className="flex gap-2">
            {[1, 3, 5, 10, 15].map((num) => (
              <button
                key={num}
                onClick={() => setClientsPerMonth(num)}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                  clientsPerMonth === num
                    ? 'bg-navy-900 text-white'
                    : 'bg-c-surface text-c-text-secondary hover:bg-primary-100 dark:hover:bg-primary-900/30'
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
            {t('partner.home.calculator.avgValueLabel', 'Średnia wartość klienta (€/miesiąc)')}
          </label>
          <input
            type="range"
            min="500"
            max="5000"
            step="100"
            value={avgClientValue}
            onChange={(e) => setAvgClientValue(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <div className="flex justify-between text-xs text-c-text-muted mt-1">
            <span>€500</span>
            <span className="font-semibold text-primary-600 dark:text-primary-400">
              €{avgClientValue.toLocaleString()}
            </span>
            <span>€5,000</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-c-surface rounded-xl p-6 text-center">
        <p className="text-sm text-c-text-muted mb-1">
          {t('partner.home.calculator.yourTier', 'Twój poziom:')}{' '}
          <span className="font-semibold text-primary-600 dark:text-primary-400">{tier.name}</span>{' '}
          {t('partner.home.calculator.commissionSuffix', '({{rate}}% prowizji)', {
            rate: Math.round(tier.rate * 100),
          })}
        </p>

        <div className="my-4">
          <p className="text-sm text-c-text-secondary mb-1">
            {t('partner.home.calculator.estimatedAnnual', 'Szacowane roczne zarobki')}
          </p>
          <p className="text-4xl font-bold text-navy-900 dark:text-white">
            €
            {annualCommission.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </p>
          <p className="text-xs text-c-text-muted mt-1">
            {t(
              'partner.home.calculator.basis',
              'Na podstawie {{count}} poleceń rocznie przy średniej wartości €{{value}}',
              { count: clientsPerMonth * 12, value: avgClientValue.toLocaleString() }
            )}
          </p>
        </div>

        <button
          onClick={() => navigate(ROUTES.PARTNER.ONBOARDING)}
          className="inline-flex items-center gap-2 px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-semibold rounded-lg transition-colors"
        >
          <Rocket className="w-5 h-5" />
          {t('partner.home.calculator.cta', 'Zacznij zarabiać — wygeneruj swój kod')}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// ACADEMY PREVIEW
// ============================================================================

export const AcademyPreviewSection: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // TODO(Piotr): confirm before launch — static Academy catalog (course list,
  // durations) is placeholder content not yet confirmed with the business.
  const courses = [
    {
      title: t('partner.home.academy.courses.fundamentals.title', 'Podstawy platformy'),
      description: t(
        'partner.home.academy.courses.fundamentals.description',
        'Poznaj platformę Consultify od podszewki. Opanuj oceny, raportowanie i zarządzanie klientami.'
      ),
      duration: t('partner.home.academy.courses.fundamentals.duration', '45 min'),
      certificate: true,
      free: true,
      expanded: true,
    },
    {
      title: t(
        'partner.home.academy.courses.selling.title',
        'Jak sprzedawać transformację cyfrową'
      ),
      description: t(
        'partner.home.academy.courses.selling.description',
        'Sprawdzona metodologia sprzedaży usług transformacyjnych.'
      ),
      duration: t('partner.home.academy.courses.selling.duration', '60 min'),
      certificate: true,
      free: true,
      expanded: false,
    },
    {
      title: t('partner.home.academy.courses.success.title', 'Najlepsze praktyki Client Success'),
      description: t(
        'partner.home.academy.courses.success.description',
        'Maksymalizuj retencję i wskaźniki satysfakcji klientów.'
      ),
      duration: t('partner.home.academy.courses.success.duration', '30 min'),
      certificate: true,
      free: true,
      expanded: false,
    },
    {
      title: t('partner.home.academy.courses.drd.title', 'Certyfikacja frameworku DRD'),
      description: t(
        'partner.home.academy.courses.drd.description',
        'Dogłębne poznanie metodologii Digital Readiness Diagnostic.'
      ),
      duration: t('partner.home.academy.courses.drd.duration', '2 godziny'),
      certificate: true,
      advanced: true,
      expanded: false,
    },
  ];

  const [expandedCourse, setExpandedCourse] = useState<number>(0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Courses list */}
      <div className="bg-c-surface rounded-xl border border-c-border-subtle p-6">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-xl font-bold text-navy-900 dark:text-white">
            {t('partner.home.academy.title', 'Rozwijaj umiejętności z Partner Academy')}
          </h2>
        </div>
        <p className="text-sm text-c-text-secondary mb-6">
          {t(
            'partner.home.academy.subtitle',
            'Ustrukturyzowane wsparcie partnera wykraczające poza dokumentację: podstawy, ścieżki dla ról i gotowość do certyfikacji.'
          )}
        </p>
        <div className="mb-6 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/80 dark:bg-primary-900/20 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
            {t('partner.home.academy.boundaryLabel', 'Zakres Academy')}
          </div>
          <p className="mt-2 text-sm text-c-text-secondary">
            {t(
              'partner.home.academy.boundaryText',
              'Pomoc i dokumentacja partnera wyjaśniają procesy podczas pracy. Partner Academy to oddzielna warstwa szkoleniowa do ustrukturyzowanego rozwoju, powtarzalnego enablementu i sygnałów certyfikacji.'
            )}
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-c-text-secondary">
            <div className="rounded-lg bg-c-surface/80 dark:bg-navy-900/50 px-3 py-2">
              {t('partner.home.academy.pillarFoundations', 'Podstawy')}
            </div>
            <div className="rounded-lg bg-c-surface/80 dark:bg-navy-900/50 px-3 py-2">
              {t('partner.home.academy.pillarRolePath', 'Ścieżka roli')}
            </div>
            <div className="rounded-lg bg-c-surface/80 dark:bg-navy-900/50 px-3 py-2">
              {t('partner.home.academy.pillarCertification', 'Certyfikacja')}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => navigate(`${ROUTES.PARTNER.LANDING}?tab=learning-path`)}
              className="inline-flex items-center gap-2 rounded-lg bg-c-text px-4 py-2 text-sm font-medium text-c-bg hover:bg-c-text-secondary"
            >
              {t('partner.home.academy.openLearningPath', 'Otwórz ścieżkę nauki')}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(PARTNER_DOCS.certification.href)}
              className="inline-flex items-center gap-2 rounded-lg border border-primary-300 dark:border-primary-700 px-4 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-c-surface/70 dark:hover:bg-navy-900/40"
            >
              {t('partner.home.academy.openCertGuide', 'Otwórz przewodnik certyfikacji')}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {courses.map((course, index) => (
            <div
              key={index}
              className={cn(
                'rounded-lg border transition-all cursor-pointer',
                expandedCourse === index
                  ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-c-border-subtle hover:border-primary-200 dark:hover:border-primary-800'
              )}
              onClick={() => setExpandedCourse(index)}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={cn(
                        'w-5 h-5 text-primary-500 transition-transform',
                        expandedCourse === index ? 'rotate-0' : '-rotate-90'
                      )}
                    />
                    <div>
                      <h3 className="font-semibold text-navy-900 dark:text-white">
                        {course.title}
                      </h3>
                      {expandedCourse === index && (
                        <p className="text-sm text-c-text-secondary mt-1">{course.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {course.free && !course.advanced && (
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded">
                        {t('partner.home.academy.badgeFree', 'BEZPŁATNY')}
                      </span>
                    )}
                    {course.advanced && (
                      <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-medium rounded">
                        {t('partner.home.academy.badgeAdvanced', 'ZAAWANSOWANY')}
                      </span>
                    )}
                  </div>
                </div>

                {expandedCourse === index && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-c-text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {course.duration}
                      </span>
                      {course.certificate && (
                        <span className="flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          {t('partner.home.academy.certIncluded', 'Certyfikat w cenie')}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`${ROUTES.PARTNER.LANDING}?tab=learning-path`);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium rounded transition-colors"
                    >
                      {t('partner.home.academy.startCourse', 'Rozpocznij kurs')}
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

export const ContactPartnerManagerSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-c-surface rounded-xl border border-c-border-subtle p-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-1">
          {t('partner.home.contact.title', 'Masz pytania? Porozmawiajmy!')}
        </h2>
        <p className="text-sm text-c-text-secondary">
          {t(
            'partner.home.contact.subtitle',
            'Twój dedykowany Partner Manager pomoże Ci osiągnąć sukces'
          )}
        </p>
      </div>

      {/* Partner Manager Card */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-400 to-crimson-500 flex items-center justify-center text-white text-3xl font-bold mb-4 ring-4 ring-primary-100 dark:ring-primary-900/50">
          {PARTNER_CONTACT.initials}
        </div>
        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
          {PARTNER_CONTACT.name}
        </h3>
        <p className="text-sm text-c-text-muted">
          {t('partner.home.contact.role', PARTNER_CONTACT.role)}
        </p>
      </div>

      <blockquote className="text-sm text-c-text-secondary italic text-center mb-6 px-4">
        {t(
          'partner.home.contact.quote',
          'Jestem tu, aby pomóc Ci rozwijać biznes z Consultify. Niezależnie od tego, czy masz pytania o program, potrzebujesz wsparcia przy ofercie dla klienta, czy chcesz omówić możliwości co-marketingu — odezwij się!'
        )}
      </blockquote>

      {/* Contact options */}
      <div className="space-y-3">
        <a
          href={PARTNER_CONTACT.calendlyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors group"
        >
          <div className="w-10 h-10 rounded-full bg-navy-900 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-navy-900 dark:text-white">
              {t('partner.home.contact.bookCall', 'Umów rozmowę')}
            </p>
            <p className="text-xs text-c-text-muted">
              {t('partner.home.contact.bookCallSub', 'Zaplanuj 15-min rozmowę wprowadzającą')}
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>

        <a
          href={`mailto:${PARTNER_CONTACT.email}`}
          className="flex items-center gap-3 p-3 rounded-lg bg-c-surface-raised/30 border border-c-border-subtle hover:bg-c-surface-raised/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-navy-900 dark:text-white">
              {t('partner.home.contact.sendEmail', 'Wyślij e-mail')}
            </p>
            <p className="text-xs text-c-text-muted">{PARTNER_CONTACT.email}</p>
          </div>
        </a>

        <a
          href={PARTNER_CONTACT.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 rounded-lg bg-c-surface-raised/30 border border-c-border-subtle hover:bg-c-surface-raised/50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-full bg-[#0A66C2] flex items-center justify-center">
            <Linkedin className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-navy-900 dark:text-white">
              {t('partner.home.contact.linkedin', 'Połącz się na LinkedIn')}
            </p>
            <p className="text-xs text-c-text-muted">{PARTNER_CONTACT.linkedinHandle}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-c-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      </div>

      <p className="text-center text-xs text-c-text-secondary mt-4 flex items-center justify-center gap-1">
        <MessageCircle className="w-3 h-3" />
        {t('partner.home.contact.responseTime', 'Średni czas odpowiedzi: {{time}}', {
          time: PARTNER_PROGRAM_TERMS.averageResponseTime,
        })}
      </p>
    </div>
  );
};

// ============================================================================
// FAQ SECTION
// ============================================================================

export const FAQSection: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // TODO(Piotr): confirm before launch — commercial FAQ terms (commission range,
  // payout threshold/day, cooling-off period) are quoted from PARTNER_PROGRAM_TERMS
  // (top of file). The % range comes from the PARTNER_TIERS SSOT.
  const faqs = [
    {
      question: t('partner.home.faq.earn.q', 'Jak zarabiam prowizje jako partner?'),
      answer: t(
        'partner.home.faq.earn.a',
        'Zarabiasz prowizje, polecając nowych klientów Consultify. Gdy klient zarejestruje się za pomocą Twojego unikalnego kodu lub linku i zostanie płacącym klientem, otrzymujesz procent jego opłaty subskrypcyjnej. Stawki prowizji wynoszą od {{min}}% do {{max}}% w zależności od Twojego poziomu partnerskiego.',
        {
          min: PARTNER_PROGRAM_TERMS.minCommissionPct,
          max: PARTNER_PROGRAM_TERMS.maxCommissionPct,
        }
      ),
    },
    {
      question: t('partner.home.faq.payout.q', 'Kiedy i jak otrzymuję wypłatę?'),
      answer: t(
        'partner.home.faq.payout.a',
        'Prowizje są wypłacane miesięcznie przelewem bankowym lub przez PayPal, po osiągnięciu minimalnego progu {{threshold}}. Płatności są realizowane {{day}}. dnia każdego miesiąca za zatwierdzone prowizje z poprzedniego miesiąca. Wszystkie zarobki śledzisz w czasie rzeczywistym w Panelu Partnera.',
        {
          threshold: PARTNER_PROGRAM_TERMS.minPayoutThreshold,
          day: PARTNER_PROGRAM_TERMS.payoutDayOfMonth,
        }
      ),
    },
    {
      question: t('partner.home.faq.support.q', 'Jakie wsparcie otrzymuję jako partner?'),
      answer: t(
        'partner.home.faq.support.a',
        'Wszyscy partnerzy otrzymują dostęp do szkoleń Partner Academy, materiałów marketingowych i społeczności partnerskiej. Od poziomu Bronze wzwyż dostępne są priorytetowe wsparcie i dedykowane szkolenia. Partnerzy Gold i Platinum otrzymują dedykowanego Partner Managera, możliwości co-marketingu i wczesny dostęp do nowych funkcji.'
      ),
    },
    {
      question: t('partner.home.faq.certification.q', 'Ile czasu zajmuje uzyskanie certyfikatu?'),
      answer: t(
        'partner.home.faq.certification.a',
        'Certyfikacja Podstawy platformy trwa około 45 minut. Zaawansowane certyfikacje, takie jak framework DRD, zajmują 2-3 godziny. Wszystkie certyfikacje są samodzielne, więc możesz je ukończyć w dogodnym dla siebie czasie.'
      ),
    },
    {
      question: t('partner.home.faq.countries.q', 'Czy mogę polecać klientów z dowolnego kraju?'),
      answer: t(
        'partner.home.faq.countries.a',
        'Tak! Consultify działa globalnie i możesz polecać klientów z dowolnego kraju. Twój wpis w katalogu partnerów może wyróżniać Twoją wiedzę regionalną, pomagając lokalnym klientom Cię znaleźć. Wypłaty prowizji mogą być realizowane w EUR, USD lub GBP.'
      ),
    },
    {
      question: t('partner.home.faq.cancel.q', 'Co się dzieje, gdy polecony klient zrezygnuje?'),
      answer: t(
        'partner.home.faq.cancel.a',
        'Jeśli polecony klient zrezygnuje w ciągu pierwszych {{days}} dni (okres na odstąpienie), prowizja za tego klienta jest korygowana. Po {{days}} dniach zachowujesz wszystkie wypracowane prowizje, nawet jeśli klient później zrezygnuje. Wierzymy w uczciwe i przejrzyste struktury prowizji.',
        { days: PARTNER_PROGRAM_TERMS.coolingOffDays }
      ),
    },
  ];

  return (
    <div className="bg-c-surface rounded-xl border border-c-border-subtle p-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 mb-2">
          <HelpCircle className="w-5 h-5" />
          <span className="font-semibold">{t('partner.home.faq.badge', 'FAQ')}</span>
        </div>
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white">
          {t('partner.home.faq.title', 'Najczęściej zadawane pytania')}
        </h2>
      </div>

      <div className="space-y-3 max-w-3xl mx-auto">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className={cn(
              'rounded-lg border transition-all',
              openFaq === index
                ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/10'
                : 'border-c-border-subtle'
            )}
          >
            <button
              onClick={() => setOpenFaq(openFaq === index ? null : index)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-medium text-navy-900 dark:text-white pr-4">{faq.question}</span>
              <ChevronDown
                className={cn(
                  'w-5 h-5 text-primary-500 flex-shrink-0 transition-transform',
                  openFaq === index ? 'rotate-180' : ''
                )}
              />
            </button>

            {openFaq === index && (
              <div className="px-4 pb-4">
                <p className="text-sm text-c-text-secondary leading-relaxed">{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={() => navigate(PARTNER_DOCS.faq.href)}
          className="inline-flex items-center gap-2 rounded-lg border border-c-border px-4 py-2 text-sm font-medium text-c-text-secondary hover:border-primary-300 hover:text-primary-600 dark:hover:text-primary-400"
        >
          {t('partner.home.faq.openFull', 'Otwórz pełne FAQ partnera')}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// FOOTER RESOURCES
// ============================================================================

export const FooterResourcesSection: React.FC = () => {
  const navigate = useNavigate();

  const columns = [
    {
      title: 'Resources',
      icon: BookOpen,
      links: [
        { label: 'Program overview', href: PARTNER_DOCS.overview.href },
        { label: 'Application flow', href: PARTNER_DOCS.application.href },
        { label: 'Certification guide', href: PARTNER_DOCS.certification.href },
        { label: 'Operations case study', href: PARTNER_DOCS.caseStudyOperations.href },
      ],
    },
    {
      title: 'Community',
      icon: Users,
      links: [
        { label: 'Partner resources', href: `${ROUTES.PARTNER.LANDING}?tab=documentation` },
        { label: 'Learning path', href: `${ROUTES.PARTNER.LANDING}?tab=learning-path` },
        { label: 'Certificates', href: `${ROUTES.PARTNER.LANDING}?tab=certificates` },
        { label: 'Partner team contact', href: ROUTES.LEGAL.CONTACT },
      ],
    },
    {
      title: 'Support',
      icon: HelpCircle,
      links: [
        { label: 'FAQ', href: PARTNER_DOCS.faq.href },
        { label: 'Payout and activation', href: PARTNER_DOCS.payouts.href },
        { label: 'Open onboarding', href: ROUTES.PARTNER.ONBOARDING },
        { label: 'Contact support', href: ROUTES.LEGAL.CONTACT },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {columns.map((column, index) => (
        <div key={index} className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
          <div className="flex items-center gap-2 mb-4">
            <column.icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h3 className="font-semibold text-navy-900 dark:text-white">{column.title}</h3>
          </div>

          <ul className="space-y-2">
            {column.links.map((link, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => navigate(link.href)}
                  className="flex items-center gap-2 text-sm text-c-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {link.label}
                </button>
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
