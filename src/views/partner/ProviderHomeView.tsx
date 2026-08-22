import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileCheck2,
  Handshake,
  Landmark,
  Layers3,
  LifeBuoy,
  Route,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  COOPERATION_MODELS,
  FIRST_DEAL_STAGES,
  PARTNER_AUDIENCES,
  type PartnerAudience,
  type PartnerAudienceId,
} from './partnerProgramContent';

const audienceIcons: Record<PartnerAudienceId, React.ElementType> = {
  'consulting-owner': BriefcaseBusiness,
  'individual-consultant': UserRound,
  'software-house': Layers3,
  'system-integrator': Building2,
  'boutique-consultancy': Users,
  'financial-institution': Landmark,
};
const sectionCard = 'rounded-xl border border-c-border-subtle bg-c-surface p-5 md:p-6 shadow-sm';

const SectionHeading: React.FC<{ eyebrow?: string; title: string; description: string }> = ({
  eyebrow,
  title,
  description,
}) => (
  <div className="max-w-3xl">
    {eyebrow && (
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-c-text-muted">
        {eyebrow}
      </p>
    )}
    <h2 className="text-2xl font-semibold tracking-tight text-c-text">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-c-text-secondary">{description}</p>
  </div>
);

const StatusBadge: React.FC<{ children: React.ReactNode; tone?: 'neutral' | 'limited' }> = ({
  children,
  tone = 'neutral',
}) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
      tone === 'limited'
        ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200'
        : 'border-c-border bg-c-surface-raised text-c-text-secondary'
    )}
  >
    {children}
  </span>
);

const AudienceDetail: React.FC<{ audience: PartnerAudience }> = ({ audience }) => (
  <div
    id={`partner-path-${audience.id}`}
    className={cn(sectionCard, 'border-[var(--c-selection-border)]')}
    data-testid="partner-audience-detail"
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-c-text-muted">
          Selected path
        </p>
        <h3 className="mt-1 text-xl font-semibold text-c-text">{audience.label}</h3>
      </div>
      <StatusBadge>Program fit to discuss</StatusBadge>
    </div>
    <p className="mt-4 max-w-3xl text-base leading-7 text-c-text">{audience.outcome}</p>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">Use case</p>
        <p className="mt-2 text-sm leading-6 text-c-text-secondary">{audience.useCase}</p>
      </div>
      <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
          Recommended starting models
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {audience.recommendedModels.map((modelId) => (
            <StatusBadge key={modelId}>
              {COOPERATION_MODELS.find((model) => model.id === modelId)?.label ?? modelId}
            </StatusBadge>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">You bring</p>
        <p className="mt-2 text-sm leading-6 text-c-text-secondary">
          {audience.partnerContribution}
        </p>
      </div>
      <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
          Consultify brings
        </p>
        <p className="mt-2 text-sm leading-6 text-c-text-secondary">
          {audience.consultifyContribution}
        </p>
      </div>
    </div>
    <div className="mt-5 flex items-start gap-3 rounded-lg bg-[var(--c-selection)] p-4 text-c-text">
      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--c-selection-border)]" />
      <div>
        <p className="text-sm font-semibold">First practical step</p>
        <p className="mt-1 text-sm text-c-text-secondary">{audience.firstStep}</p>
      </div>
    </div>
  </div>
);

const ProgramHero: React.FC<{ onExplore: () => void }> = ({ onExplore }) => (
  <section className="relative overflow-hidden rounded-2xl border border-c-border-subtle bg-c-surface px-6 py-8 md:px-10 md:py-10">
    <div className="pointer-events-none absolute inset-y-0 right-0 w-2/5 bg-[radial-gradient(circle_at_center,var(--c-selection),transparent_70%)] opacity-80" />
    <div className="relative max-w-4xl">
      <StatusBadge>Consultify Partner Program</StatusBadge>
      <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-c-text md:text-4xl">
        Build the first joint client opportunity — with roles and boundaries clear from day one.
      </h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-c-text-secondary md:text-lg">
        Choose the partner path that matches your business, compare five cooperation models and see
        how a joint opportunity moves from qualification to an evidence-based expansion decision.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onExplore}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text px-5 py-2.5 text-sm font-semibold text-c-surface transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus-ring)] focus-visible:ring-offset-2"
        >
          Choose your partner path
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-xs leading-5 text-c-text-muted">
          Program fit and commercial terms are confirmed during qualification.
        </p>
      </div>
    </div>
  </section>
);

export const ValueCardsSection: React.FC = () => {
  const [selectedId, setSelectedId] = useState<PartnerAudienceId>('consulting-owner');
  const selected = PARTNER_AUDIENCES.find((audience) => audience.id === selectedId)!;
  return (
    <section id="partner-paths" className="space-y-5" aria-labelledby="partner-paths-title">
      <SectionHeading
        eyebrow="Six partner paths"
        title="Start with the way you create value"
        description="The program has one governance contract, but the first opportunity should reflect your client access, delivery model and responsibility boundary. Select a path to compare the intended fit."
      />
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        role="tablist"
        aria-label="Partner types"
      >
        {PARTNER_AUDIENCES.map((audience) => {
          const Icon = audienceIcons[audience.id];
          const selectedPath = audience.id === selectedId;
          return (
            <button
              key={audience.id}
              type="button"
              role="tab"
              aria-selected={selectedPath}
              aria-controls={`partner-path-${audience.id}`}
              onClick={() => setSelectedId(audience.id)}
              className={cn(
                'min-h-24 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus-ring)]',
                selectedPath
                  ? 'border-[var(--c-selection-border)] bg-[var(--c-selection)] shadow-[inset_3px_0_0_var(--c-selection-border)]'
                  : 'border-c-border-subtle bg-c-surface hover:border-c-border hover:bg-c-surface-hover'
              )}
            >
              <Icon className="h-5 w-5 text-c-text-secondary" />
              <span className="mt-3 block text-sm font-semibold text-c-text">{audience.label}</span>
            </button>
          );
        })}
      </div>
      <AudienceDetail key={selected.id} audience={selected} />
    </section>
  );
};

export const BetaSuccessStories: React.FC = () => (
  <section className="space-y-5" aria-labelledby="partner-proof-title">
    <SectionHeading
      eyebrow="Evidence policy"
      title="Proof must be traceable — illustrative stories are not customer evidence"
      description="No company logo, quotation or outcome is shown here without an evidence owner and publication consent. The previously displayed fictional beta companies have been removed."
    />
    <div className={cn(sectionCard, 'flex items-start gap-4')}>
      <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-c-text-secondary" />
      <div>
        <h3 id="partner-proof-title" className="text-base font-semibold text-c-text">
          Current evidence status
        </h3>
        <p className="mt-2 text-sm leading-6 text-c-text-secondary">
          There is no approved public partner testimonial in the current evidence register. Real
          cases will appear only after the source, evidence owner and consent to publish are
          recorded.
        </p>
        <div className="mt-3">
          <StatusBadge tone="limited">No publishable reference yet</StatusBadge>
        </div>
      </div>
    </div>
  </section>
);

export const CommissionCalculatorSection: React.FC = () => (
  <section className="space-y-5" aria-labelledby="partner-models-title">
    <SectionHeading
      eyebrow="Five cooperation models"
      title="Choose a responsibility model before discussing economics"
      description="These patterns explain who leads the relationship and delivery. Their availability and commercial terms are confirmed for the specific partner and opportunity."
    />
    <div className="grid gap-4 lg:grid-cols-2">
      {COOPERATION_MODELS.map((model) => (
        <article key={model.id} className={sectionCard}>
          <div className="flex items-center gap-3">
            <Handshake className="h-5 w-5 text-c-text-secondary" />
            <h3
              id={model.id === 'referral' ? 'partner-models-title' : undefined}
              className="text-base font-semibold text-c-text"
            >
              {model.label}
            </h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-c-text-secondary">{model.bestFor}</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-c-text">Partner</dt>
              <dd className="mt-1 text-c-text-secondary">{model.partnerContribution}</dd>
            </div>
            <div>
              <dt className="font-medium text-c-text">Consultify</dt>
              <dd className="mt-1 text-c-text-secondary">{model.consultifyContribution}</dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-c-border-subtle pt-4 text-xs leading-5 text-c-text-muted">
            {model.boundary}
          </p>
        </article>
      ))}
    </div>
  </section>
);

export const TierProgressionSection: React.FC = () => (
  <section
    id="commercial-framework"
    className="space-y-5"
    aria-labelledby="commercial-framework-title"
  >
    <SectionHeading
      eyebrow="Commercial framework"
      title="One agreement, no provisional numbers"
      description="The visible program does not publish draft tiers, commission rates, payout rules or support promises. The applicable schedule must come from one approved agreement."
    />
    <div className={cn(sectionCard, 'grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center')}>
      <div>
        <div className="flex items-center gap-3">
          <CircleDollarSign className="h-5 w-5 text-c-text-secondary" />
          <h3 id="commercial-framework-title" className="font-semibold text-c-text">
            Commercial schedule: decision required
          </h3>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-c-text-secondary">
          Eligibility, tier, compensation, settlement timing and service levels are defined in the
          executed partner agreement. Values from draft configuration are not an offer and are not
          shown on this page.
        </p>
      </div>
      <StatusBadge tone="limited">Economics unavailable in this workspace</StatusBadge>
    </div>
  </section>
);

export const OnboardingChecklistSection: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [status, setStatus] = useState<V8PartnerOnboardingStatus | null>(null);
  const loadStatus = useCallback(async () => {
    setState('loading');
    try {
      const response = await V8PartnerApi.getOnboardingStatus();
      setStatus(response?.status ?? null);
      setState('ready');
    } catch (error) {
      if (!shouldFallbackToLegacyPartner(error)) {
        setStatus(null);
        setState('error');
        return;
      }
      try {
        const legacy = await Api.get('/onboarding/status');
        const payload = legacy?.data?.status ?? legacy?.status ?? legacy?.data ?? legacy;
        setStatus({
          termsAccepted: Boolean(payload?.termsAccepted ?? payload?.terms_accepted),
          privacyAccepted: Boolean(payload?.privacyAccepted ?? payload?.privacy_accepted),
          pricingTier: payload?.pricingTier ?? payload?.pricing_tier ?? null,
          paymentSetup: Boolean(payload?.paymentSetup ?? payload?.payment_setup),
          completed: Boolean(payload?.completed),
        } as V8PartnerOnboardingStatus);
        setState('ready');
      } catch {
        setStatus(null);
        setState('error');
      }
    }
  }, []);
  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);
  const steps = useMemo(
    () => [
      { label: 'Agreement reviewed', done: Boolean(status?.termsAccepted) },
      { label: 'Privacy terms reviewed', done: Boolean(status?.privacyAccepted) },
      { label: 'Program path recorded', done: Boolean(status?.pricingTier) },
      { label: 'Activation confirmed', done: Boolean(status?.completed) },
    ],
    [status]
  );
  const completed = steps.filter((step) => step.done).length;
  const primaryLabel = status?.completed
    ? 'Open partner workspace'
    : completed > 0
      ? 'Continue onboarding'
      : 'Start application';
  const primaryDestination = status?.completed
    ? `${ROUTES.PARTNER.LANDING}?tab=dashboard`
    : status
      ? ROUTES.PARTNER.ONBOARDING
      : ROUTES.PARTNER.PUBLIC_APPLY;
  return (
    <section className="space-y-5" aria-labelledby="partner-next-action-title">
      <SectionHeading
        eyebrow="Your next action"
        title="Continue from your verified program state"
        description="The primary action changes only after the current status is read. If status cannot be verified, the page does not infer that you are a prospect or an active partner."
      />
      <div className={sectionCard}>
        {state === 'loading' ? (
          <div className="animate-pulse space-y-3" aria-live="polite">
            <div className="h-5 w-40 rounded bg-c-surface-raised" />
            <div className="h-10 w-full rounded bg-c-surface-raised" />
          </div>
        ) : state === 'error' ? (
          <div
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
              <div>
                <h3 id="partner-next-action-title" className="font-semibold text-c-text">
                  Program status is not verified
                </h3>
                <p className="mt-1 text-sm text-c-text-secondary">
                  We will not guess whether you should apply, continue onboarding or open the
                  workspace.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="rounded-lg bg-c-text px-4 py-2 text-sm font-semibold text-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus-ring)]"
            >
              Retry status check
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 id="partner-next-action-title" className="font-semibold text-c-text">
                  {status?.completed ? 'Partner workspace ready' : 'Application and onboarding'}
                </h3>
                <p className="mt-1 text-sm text-c-text-secondary">
                  {completed}/4 verified steps
                  {status?.pricingTier ? ` · Current tier: ${status.pricingTier}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(primaryDestination)}
                className="inline-flex items-center gap-2 rounded-lg bg-c-text px-4 py-2 text-sm font-semibold text-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus-ring)]"
              >
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => (
                <div
                  key={step.label}
                  className="flex items-center gap-2 rounded-lg border border-c-border-subtle p-3 text-sm"
                >
                  <CheckCircle2
                    className={cn('h-4 w-4', step.done ? 'text-emerald-600' : 'text-c-text-muted')}
                  />
                  <span className={step.done ? 'text-c-text' : 'text-c-text-secondary'}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export const AcademyPreviewSection: React.FC = () => {
  const navigate = useNavigate();
  return (
    <section className="space-y-5" aria-labelledby="partner-enablement-title">
      <SectionHeading
        eyebrow="Enablement"
        title="Use only the resources available to your program state"
        description="Documentation and onboarding guidance are available entry points. Academy, certification and other workspace capabilities remain subject to account access and runtime status."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={sectionCard}>
          <BookOpen className="h-5 w-5 text-c-text-secondary" />
          <h3 id="partner-enablement-title" className="mt-3 font-semibold text-c-text">
            Program documentation
          </h3>
          <p className="mt-2 text-sm leading-6 text-c-text-secondary">
            Review the program model, responsibilities and working guidance.
          </p>
          <button
            type="button"
            onClick={() => navigate(PARTNER_DOCS.overview.href)}
            className="mt-4 text-sm font-semibold text-c-text underline decoration-c-border underline-offset-4"
          >
            Open documentation
          </button>
        </div>
        <div className={sectionCard}>
          <FileCheck2 className="h-5 w-5 text-c-text-secondary" />
          <h3 className="mt-3 font-semibold text-c-text">Partner Academy</h3>
          <p className="mt-2 text-sm leading-6 text-c-text-secondary">
            Structured enablement may be available after activation; access and progress are
            verified in the partner workspace.
          </p>
          <div className="mt-3">
            <StatusBadge tone="limited">Access-dependent</StatusBadge>
          </div>
        </div>
        <div className={sectionCard}>
          <LifeBuoy className="h-5 w-5 text-c-text-secondary" />
          <h3 className="mt-3 font-semibold text-c-text">Deal and operational support</h3>
          <p className="mt-2 text-sm leading-6 text-c-text-secondary">
            Support scope and response expectations follow the applicable agreement, not this
            overview.
          </p>
          <div className="mt-3">
            <StatusBadge tone="limited">Agreement-dependent</StatusBadge>
          </div>
        </div>
      </div>
    </section>
  );
};

export const ContactPartnerManagerSection: React.FC = () => {
  const navigate = useNavigate();
  return (
    <section
      className={cn(
        sectionCard,
        'flex flex-col gap-4 md:flex-row md:items-center md:justify-between'
      )}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-c-text-muted">
          Need a fit conversation?
        </p>
        <h2 className="mt-2 text-xl font-semibold text-c-text">
          Discuss the cooperation model, not provisional terms
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-c-text-secondary">
          Use the approved contact route. A named program owner will appear only after publication
          authority is confirmed.
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate(ROUTES.LEGAL.CONTACT)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-c-border px-4 py-2 text-sm font-semibold text-c-text hover:bg-c-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus-ring)]"
      >
        Contact Consultify
        <ArrowRight className="h-4 w-4" />
      </button>
    </section>
  );
};

const FAQ_ITEMS = [
  [
    'Who owns the client relationship?',
    'Ownership is agreed before the pursuit. Referral, co-sell and partner-led models do not imply the same relationship or communication rights.',
  ],
  [
    'Who is responsible for delivery?',
    'The responsibility split is written into the opportunity plan and the applicable agreement. The overview does not transfer delivery responsibility by implication.',
  ],
  [
    'How are data and confidentiality handled?',
    'Access follows the applicable agreement, product permissions and data-processing terms. A partner does not receive client data merely by joining the program.',
  ],
  [
    'Who owns IP and branding?',
    'Each model requires an explicit decision on brand use, methodology, deliverables and reusable IP before client-facing use.',
  ],
  [
    'What support is included?',
    'Support scope, channels and service expectations follow the executed agreement and current account capability. No response-time promise is made on this page.',
  ],
  [
    'How are commercial terms determined?',
    'Eligibility, compensation, settlement and tier treatment come from one approved partner agreement. Draft configuration is not a commercial offer.',
  ],
  [
    'How do I join?',
    'Select your partner path, review the models and use the state-aware action. The application is reviewed before onboarding or workspace access is granted.',
  ],
  [
    'What happens after the first deal?',
    'Both sides review the agreed evidence and decide whether to stop, repeat or expand. Expansion is not assumed before that review.',
  ],
] as const;

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <section className="space-y-5" aria-labelledby="partner-faq-title">
      <SectionHeading
        eyebrow="Safeguards and FAQ"
        title="Make the boundaries explicit before the client conversation"
        description="These answers describe the governance baseline. The executed agreement remains authoritative for a specific partnership."
      />
      <div className="overflow-hidden rounded-xl border border-c-border-subtle bg-c-surface">
        {FAQ_ITEMS.map(([question, answer], index) => {
          const open = openIndex === index;
          return (
            <div key={question} className="border-b border-c-border-subtle last:border-b-0">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`partner-faq-answer-${index}`}
                onClick={() => setOpenIndex(open ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--c-focus-ring)]"
              >
                <span
                  id={index === 0 ? 'partner-faq-title' : undefined}
                  className="text-sm font-semibold text-c-text"
                >
                  {question}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-c-text-muted transition-transform',
                    open && 'rotate-180'
                  )}
                />
              </button>
              {open && (
                <div
                  id={`partner-faq-answer-${index}`}
                  className="px-5 pb-5 text-sm leading-6 text-c-text-secondary"
                >
                  {answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const FooterResourcesSection: React.FC = () => (
  <section className="space-y-5" aria-labelledby="first-deal-title">
    <SectionHeading
      eyebrow="First joint deal"
      title="Move through six stages with an owner, output and proof at each step"
      description="This is a collaboration framework, not a promise of timing or outcome. Each stage must earn the decision to continue."
    />
    <ol className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {FIRST_DEAL_STAGES.map((stage, index) => (
        <li key={stage.id} className={sectionCard}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--c-selection)] text-xs font-semibold text-c-text">
                {index + 1}
              </span>
              <h3
                id={index === 0 ? 'first-deal-title' : undefined}
                className="font-semibold text-c-text"
              >
                {stage.label}
              </h3>
            </div>
            <Route className="h-4 w-4 text-c-text-muted" />
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-c-text">Owner</dt>
              <dd className="mt-1 text-c-text-secondary">{stage.owner}</dd>
            </div>
            <div>
              <dt className="font-medium text-c-text">Output</dt>
              <dd className="mt-1 text-c-text-secondary">{stage.output}</dd>
            </div>
            <div>
              <dt className="font-medium text-c-text">Proof to continue</dt>
              <dd className="mt-1 text-c-text-secondary">{stage.proof}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  </section>
);

export const ProviderHomeView: React.FC = () => {
  const { t } = useTranslation();
  const scrollToPaths = () =>
    document
      .getElementById('partner-paths')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="mx-auto max-w-7xl space-y-12 pb-12" data-testid="partner-program-overview">
      <ProgramHero onExplore={scrollToPaths} />
      <ValueCardsSection />
      <CommissionCalculatorSection />
      <FooterResourcesSection />
      <AcademyPreviewSection />
      <TierProgressionSection />
      <BetaSuccessStories />
      <OnboardingChecklistSection />
      <ContactPartnerManagerSection />
      <FAQSection />
      <p className="sr-only">
        {t(
          'partner.program.truthBoundary',
          'Commercial and capability statements are subject to verified program status and the applicable agreement.'
        )}
      </p>
    </div>
  );
};

export default ProviderHomeView;
