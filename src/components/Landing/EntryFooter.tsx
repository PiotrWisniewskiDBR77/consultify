import { Handshake } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { normalizeLanguageCode } from '../../i18n';
import { ROUTES } from '../../routes/routeConfig';

const DBR77_SUPPORTED_LANGS = new Set(['en', 'pl', 'de']);

function resolveDbr77Lang(currentLang: string): string {
  const base = currentLang.split('-')[0].toLowerCase();
  return DBR77_SUPPORTED_LANGS.has(base) ? base : 'en';
}

function dbr77Url(path: string, lang: string): string {
  const l = resolveDbr77Lang(lang);
  return `https://dbr77.com/${l}${path}`;
}

// Company data - DBR77 official details
const COMPANY = {
  headquarters: {
    name: 'DBR77 Robotics Sp. z o.o.',
    address: 'ul. Żółkiewskiego 31',
    city: '87-100 Toruń, Poland',
    nip: '8792725331',
    regon: '387073039',
    krs: '0000860440',
  },
  usa: {
    name: 'DBR77 USA Inc.',
    address: '9319 Robert D. Snyder Road',
    city: 'Charlotte, NC 28262, USA',
  },
  germany: {
    name: 'DBR77 GmbH',
    address: 'Kurfürstendamm 194',
    city: '10707 Berlin, Germany',
    vatId: 'DE368505344',
    hrb: '263063',
  },
  email: 'contact@dbr77.com',
  website: 'https://dbr77.com',
};

// Social media links - Official DBR77 profiles
const SOCIAL_LINKS = {
  linkedin: 'https://pl.linkedin.com/company/dbr77com',
  youtube: 'https://www.youtube.com/@dbr774',
  facebook: 'https://www.facebook.com/dbr77robotics',
  instagram: 'https://www.instagram.com/dbr77robotics',
  spotify: 'https://open.spotify.com/show/7MJjs0AJ79hfRaCrcFbs4B',
};

interface EntryFooterProps {
  onDemoClick?: () => void;
  onTrialClick?: () => void;
  hidePartnerBadges?: boolean;
}

export const EntryFooter: React.FC<EntryFooterProps> = () => {
  const { t, i18n } = useTranslation();
  const lang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language) || 'en';
  const legalOperatorLine =
    lang === 'pl'
      ? 'Operatorem platformy Consultify jest'
      : lang === 'de'
        ? 'Betreiber der Consultify-Plattform ist'
        : 'Consultify platform operator';
  const localizedPricingLabel =
    lang === 'pl' ? 'Cennik' : lang === 'de' ? 'Preise' : t('pricing.badge', 'Pricing');
  const localizedBusinessCasesLabel =
    lang === 'pl'
      ? 'Przypadki biznesowe'
      : lang === 'de'
        ? 'Business Cases'
        : t('landing.footer.caseStudies.businessCases', 'Business Cases');

  const sections = useMemo(
    () => [
      {
        title: t('landing.footer.products.title', 'Products'),
        links: [
          { label: 'Industrial IoT', href: 'https://iot.dbr77.com', external: true },
          { label: 'Digital Twin', href: 'https://dt.dbr77.com', external: true },
          { label: 'IRIS', href: 'https://iris.dbr77.com', external: true },
          {
            label: 'Marketplace',
            href: 'https://marketplace.dbr77.com/marketplace',
            external: true,
          },
          { label: 'DBR77 Vector', href: 'https://vector.dbr77.com', external: true },
          { label: 'Consultify', href: '/' },
        ],
      },
      {
        title: t('landing.footer.knowledge.title', 'Knowledge'),
        links: [
          {
            label: t('landing.footer.knowledge.blogDbr77', 'Blog DBR77'),
            href: dbr77Url('/blog', lang),
            external: true,
          },
          {
            label: t('landing.footer.knowledge.blogConsultify', 'Blog Consultify'),
            href: '/knowledge-base',
          },
          { label: 'DBR77 at ITM', href: dbr77Url('/itm', lang), external: true },
          { label: 'DBR77 Conference', href: dbr77Url('/conference', lang), external: true },
          {
            label: t('landing.footer.knowledge.reports', 'Reports'),
            href: dbr77Url('/reports', lang),
            external: true,
          },
          {
            label: t('landing.footer.knowledge.podcasts', 'Podcasts'),
            href: 'https://open.spotify.com/show/7MJjs0AJ79hfRaCrcFbs4B',
            external: true,
          },
          {
            label: 'DBR77 Masterclass',
            href: 'https://masterclass.dbr77.com/?utm_source=Consultify&utm_medium=Footer&utm_campaign=landing_footer',
            external: true,
          },
        ],
      },
      {
        title: t('landing.footer.caseStudies.title', 'Case Studies'),
        links: [
          {
            label: localizedBusinessCasesLabel,
            href: ROUTES.CASE_STUDIES,
          },
          { label: 'Atelier Toys', href: 'https://ateliertoys.com', external: true },
        ],
      },
      {
        title: t('landing.footer.documentation.title', 'Documentation'),
        links: [
          { label: localizedPricingLabel, href: ROUTES.PRICING },
          {
            label: t('landing.footer.legal.subscription', 'Subscription Terms'),
            href: ROUTES.LEGAL.SUBSCRIPTION,
          },
          { label: t('landing.footer.legal.dpa', 'Data Processing (DPA)'), href: ROUTES.LEGAL.DPA },
          { label: t('landing.footer.legal.sla', 'Service Levels (SLA)'), href: ROUTES.LEGAL.SLA },
          { label: t('legal.centerTitle', 'Legal Center'), href: ROUTES.LEGAL.CENTER },
        ],
      },
      {
        title: t('landing.footer.company.title', 'Company'),
        links: [
          { label: t('landing.footer.company.about', 'About'), href: ROUTES.LEGAL.ABOUT },
          {
            label: t('landing.footer.company.news', 'News'),
            href: dbr77Url('/news', lang),
            external: true,
          },
          {
            label: t('landing.footer.company.events', 'Events'),
            href: dbr77Url('/events', lang),
            external: true,
          },
          { label: t('landing.footer.company.contact', 'Contact'), href: ROUTES.LEGAL.CONTACT },
        ],
      },
    ],
    [t, lang]
  );

  return (
    <footer className="border-t border-c-border bg-c-bg py-16 px-6 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[1.45fr_repeat(5,minmax(0,0.9fr))] lg:gap-8 xl:gap-10">
          {/* Brand Column */}
          <div className="max-w-[280px] space-y-5">
            {/* Logo */}
            <div className="flex items-center">
              <img
                src="/assets/logos/logo-light.svg?v=20260319"
                alt="Consultify"
                className="h-8 w-auto dark:hidden"
              />
              <img
                src="/assets/logos/logo-dark.svg?v=20260319"
                alt="Consultify"
                className="hidden h-8 w-auto dark:block"
              />
            </div>

            {/* Offices */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-c-text">
                {t('landing.footer.offices', 'Offices')}
              </h4>

              <div className="rounded-xl bg-c-surface-raised px-3.5 py-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-c-surface-raised text-sm"
                    aria-hidden="true"
                  >
                    🇺🇸
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-c-text">{COMPANY.usa.name}</p>
                    <p className="mt-0.5 text-[11px] leading-5 text-c-text-muted">
                      {COMPANY.usa.address}
                      <br />
                      {COMPANY.usa.city}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-c-surface-raised px-3.5 py-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-c-surface-raised text-sm"
                    aria-hidden="true"
                  >
                    🇩🇪
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-c-text">{COMPANY.germany.name}</p>
                    <p className="mt-0.5 text-[11px] leading-5 text-c-text-muted">
                      {COMPANY.germany.address}
                      <br />
                      {COMPANY.germany.city}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Columns */}
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-4 min-w-0">
              <h4 className="text-xs font-bold uppercase tracking-widest text-c-text">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link, lIdx) => (
                  <li key={lIdx}>
                    {'onClick' in link && typeof (link as any).onClick === 'function' ? (
                      <button
                        type="button"
                        onClick={(link as any).onClick}
                        className="text-sm text-c-text-secondary transition-colors hover:text-c-accent"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-c-text-secondary transition-colors hover:text-c-accent"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Become Partner CTA */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-c-border py-8 sm:flex-row">
          <div>
            <p className="text-sm font-black text-c-text mb-0.5">
              {t('partner.footerCta.title', 'Become a Consultify Partner')}
            </p>
            <p className="text-xs text-c-text-secondary">
              {t('partner.footerCta.sub', 'Resell, integrate, or co-create with us globally.')}
            </p>
          </div>
          <a
            href={ROUTES.BECOME_PARTNER}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 shrink-0"
            style={{
              background: 'linear-gradient(135deg, #A51C30, #651120)',
              boxShadow: '0 0 24px -8px rgba(165,28,48,0.60)',
            }}
          >
            <Handshake size={15} />
            <span>{t('partner.becomePartner', 'Become Partner')}</span>
          </a>
        </div>

        {/* Social Links Row */}
        <div className="border-t border-c-border pt-8">
          <div className="flex justify-center items-center gap-5">
            <a
              href={SOCIAL_LINKS.linkedin}
              className="w-8 h-8 bg-[#0077B5] hover:bg-[#0077B5]/80 rounded-md flex items-center justify-center transition-colors"
              title="LinkedIn"
            >
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a
              href={SOCIAL_LINKS.youtube}
              className="w-8 h-8 bg-[#FF0000] hover:bg-[#FF0000]/80 rounded-md flex items-center justify-center transition-colors"
              title="YouTube"
            >
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
            <a
              href={SOCIAL_LINKS.facebook}
              className="w-8 h-8 bg-[#1877F2] hover:bg-[#1877F2]/80 rounded-md flex items-center justify-center transition-colors"
              title="Facebook"
            >
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
            <a
              href={SOCIAL_LINKS.spotify}
              className="w-8 h-8 bg-[#1DB954] hover:bg-[#1DB954]/80 rounded-md flex items-center justify-center transition-colors"
              title="Spotify Podcast"
            >
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </a>
            <a
              href={SOCIAL_LINKS.instagram}
              className="w-8 h-8 bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-80 rounded-md flex items-center justify-center transition-opacity"
              title="Instagram"
            >
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </a>
          </div>

          {/* Legal Links Strip */}
          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              { label: t('landing.footer.legal.terms', 'Terms of Service'), href: '/legal/terms' },
              {
                label: t('landing.footer.legal.privacy', 'Privacy Policy'),
                href: '/legal/privacy',
              },
              { label: t('landing.footer.legal.cookies', 'Cookie Policy'), href: '/legal/cookies' },
              {
                label: t('landing.footer.legal.subscription', 'Subscription Terms'),
                href: ROUTES.LEGAL.SUBSCRIPTION,
              },
              { label: t('landing.footer.legal.dpa', 'DPA'), href: ROUTES.LEGAL.DPA },
              { label: t('landing.footer.legal.sla', 'SLA'), href: ROUTES.LEGAL.SLA },
              {
                label: t('landing.footer.legal.security', 'Security Overview'),
                href: '/legal/security',
              },
              {
                label: t('landing.footer.legal.consent', 'Consent & Controls'),
                href: ROUTES.LEGAL.CENTER,
              },
            ].map((link, idx) => (
              <a
                key={idx}
                href={link.href}
                className="text-[11px] text-c-text-muted hover:text-c-accent transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <p className="mt-7 text-center text-[11px] text-c-text-muted">
            {legalOperatorLine}:{' '}
            <span className="font-semibold text-c-text-secondary">{COMPANY.headquarters.name}</span>
            {` (${COMPANY.headquarters.address}, ${COMPANY.headquarters.city}, NIP ${COMPANY.headquarters.nip}, KRS ${COMPANY.headquarters.krs})`}
          </p>

          {/* Copyright */}
          <p className="mt-4 text-center text-[11px] font-medium text-c-text-muted">
            © 2026 {COMPANY.headquarters.name}{' '}
            {t('landing.footer.copyright', 'All rights reserved.')}
          </p>
        </div>
      </div>
    </footer>
  );
};
