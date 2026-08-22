import { ArrowRight, ShieldCheck } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { MarketingLayout } from '@/components/Landing/MarketingLayout';
import { ROUTES } from '@/routes/routeConfig';
import {
  CommissionCalculatorSection,
  FAQSection,
  FooterResourcesSection,
  TierProgressionSection,
  ValueCardsSection,
} from '@/views/partner/ProviderHomeView';
import { partnerText } from '@/views/partner/partnerProgramLocale';
import { useTranslation } from 'react-i18next';

/**
 * Public, publication-safe entry to the Consultify Partner Program.
 * Commercial figures and access-dependent capabilities are intentionally not
 * repeated here; the in-product overview and executed agreement remain the
 * canonical authorities.
 */
export const BecomePartnerView: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n?.resolvedLanguage ?? i18n?.language ?? 'en';

  return (
    <MarketingLayout>
      <main className="min-h-screen bg-c-bg px-5 py-12 text-c-text md:px-8 md:py-16">
        <div className="mx-auto max-w-7xl space-y-14">
          <section className="rounded-2xl border border-c-border-subtle bg-c-surface px-6 py-10 md:px-10 md:py-14">
            <div className="max-w-4xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-c-border bg-c-surface-raised px-3 py-1 text-xs font-semibold text-c-text-secondary">
                <ShieldCheck className="h-4 w-4" />
                {partnerText('Consultify Partner Program', language)}
              </span>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
                {partnerText('Find the right model for your first joint client opportunity.', language)}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-c-text-secondary md:text-lg">
                {partnerText('Six partner paths, five cooperation models and one evidence-led journey from qualification to an informed expansion decision. Choose your path before you apply.', language)}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.PARTNER.PUBLIC_APPLY)}
                  className="inline-flex items-center gap-2 rounded-lg bg-c-text px-5 py-2.5 text-sm font-semibold text-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus-ring)]"
                >
                  {partnerText('Start application', language)}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <p className="text-xs leading-5 text-c-text-muted">
                  {partnerText('Program fit and commercial terms are confirmed during qualification.', language)}
                </p>
              </div>
            </div>
          </section>

          <ValueCardsSection />
          <CommissionCalculatorSection />
          <FooterResourcesSection />
          <TierProgressionSection />
          <FAQSection />
        </div>
      </main>
    </MarketingLayout>
  );
};

export default BecomePartnerView;
