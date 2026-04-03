import { Handshake, Key, Lock, Server, ShieldCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '../../routes/routeConfig';

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

// Strategic Partnerships - Saudi Arabia Vision 2030
const PARTNERSHIPS = {
  futureFactory: {
    name: 'Future Factory',
    url: 'https://www.mim.gov.sa/en/initiatives-programs/industrial-sector-initiatives/future-factories-program-initiative',
    label: 'Future Factory Partner',
    enabled: true,
  },
  ampc: {
    name: 'AMPC',
    url: 'https://www.arabnews.com/node/2602503/business-economy',
    label: 'AMPC Partner',
    enabled: true,
  },
};

interface EntryFooterProps {
  onDemoClick?: () => void;
  onTrialClick?: () => void;
  hidePartnerBadges?: boolean;
}

export const EntryFooter: React.FC<EntryFooterProps> = ({ onDemoClick, onTrialClick, hidePartnerBadges = false }) => {
  const { t } = useTranslation();

  const sections = [
    {
      title: t('landing.footer.product.title', 'Product'),
      links: [
        { label: t('landing.footer.product.demo', 'Try Demo'), href: '/demo', onClick: onDemoClick },
        {
          label: t('landing.footer.product.trial', 'Start Trial'),
          href: ROUTES.TRIAL_ENTRY,
          onClick: onTrialClick,
        },
        { label: t('landing.footer.product.pricing', 'Pricing'), href: ROUTES.PRICING },
        { label: t('landing.footer.product.login', 'Log in'), href: ROUTES.LOGIN },
      ],
    },
    {
      title: t('landing.footer.resources.title', 'Resources'),
      links: [
        {
          label: t('landing.footer.resources.knowledgeBase', 'Knowledge Base'),
          href: ROUTES.KNOWLEDGE_BASE_PUBLIC,
        },
        {
          label: t('landing.footer.resources.masterclass', 'Masterclass'),
          href: 'https://masterclass.dbr77.com/?utm_source=Consultify&utm_medium=Footer&utm_campaign=landing_footer',
          external: true,
        },
        {
          label: t('landing.footer.resources.blog', 'Blog'),
          href: 'https://dbr77.com/blog/',
          external: true,
        },
        {
          label: t('landing.footer.resources.podcast', 'Factory on Air'),
          href: 'https://open.spotify.com/show/7MJjs0AJ79hfRaCrcFbs4B',
          external: true,
        },
      ],
    },
    {
      title: t('landing.footer.company.title', 'Company'),
      links: [
        { label: t('landing.footer.company.about', 'About'), href: '/about' },
        { label: t('landing.footer.company.contact', 'Contact'), href: '/contact' },
        { label: 'DBR77.com', href: 'https://dbr77.com', external: true },
      ],
    },
    {
      title: t('landing.footer.legal.title', 'Legal'),
      links: [
        { label: t('landing.footer.legal.terms', 'Terms'), href: '/terms' },
        { label: t('landing.footer.legal.privacy', 'Privacy'), href: '/privacy' },
        { label: t('landing.footer.legal.cookies', 'Cookies'), href: '/cookies' },
        { label: t('landing.footer.legal.security', 'Security'), href: '/security' },
        { label: t('landing.footer.legal.allDocuments', 'All Documents'), href: '/legal' },
      ],
    },
  ];

  return (
    <footer className="border-t border-slate-200/90 bg-slate-50/95 py-16 px-6 backdrop-blur-sm dark:border-white/[0.08] dark:bg-[#0B0A23]/95">
      <div className="max-w-7xl mx-auto">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand Column - Spans 2 on large */}
          <div className="col-span-2 space-y-6">
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

            {/* Tagline */}
            <p className="max-w-xs text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t(
                'landing.footer.tagline',
                'Consultify is the Consulting Intelligence Platform: accessible world-class knowledge, structured guidance, and execution in one working environment.'
              )}
            </p>

            {/* Trust Badges */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <ShieldCheck size={14} className="text-green-500" />
                <span>GDPR</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Lock size={14} className="text-blue-500" />
                <span>SOC2</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Server size={14} className="text-purple-500" />
                <span>EU Data</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Key size={14} className="text-amber-500" />
                <span>AES-256</span>
              </div>
            </div>

            {/* Company Info */}
            <div className="space-y-2 pt-2 text-[10px] text-slate-500 dark:text-slate-400">
              {/* HQ - Poland */}
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  {COMPANY.headquarters.name}
                </p>
                <p>
                  {COMPANY.headquarters.address}, {COMPANY.headquarters.city}
                </p>
                <p className="text-slate-400 dark:text-slate-500">
                  NIP: {COMPANY.headquarters.nip} | KRS: {COMPANY.headquarters.krs}
                </p>
              </div>
              {/* USA & Germany - compact */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-400 dark:text-slate-500">
                <span>
                  {COMPANY.usa.name} · {COMPANY.usa.city}
                </span>
                <span>
                  {COMPANY.germany.name} · {COMPANY.germany.city}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Columns */}
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link, lIdx) => (
                  <li key={lIdx}>
                    {'onClick' in link && typeof (link as any).onClick === 'function' ? (
                      <button
                        type="button"
                        onClick={(link as any).onClick}
                        className="text-sm text-slate-600 transition-colors hover:text-purple-600 dark:text-slate-300 dark:hover:text-purple-400"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <a
                        href={link.href}
                        {...((link as any).external
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                        className="text-sm text-slate-600 transition-colors hover:text-purple-600 dark:text-slate-300 dark:hover:text-purple-400"
                      >
                        {link.label}
                        {(link as any).external && (
                          <span className="ml-1 text-[10px] opacity-50">↗</span>
                        )}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Become Partner CTA */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200/90 pt-10 sm:flex-row dark:border-white/[0.08]">
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white mb-0.5">
              {t('partner.footerCta.title', 'Become a Consultify Partner')}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t('partner.footerCta.sub', 'Resell, integrate, or co-create with us globally.')}
            </p>
          </div>
          <a
            href={ROUTES.BECOME_PARTNER}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 shrink-0"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #c026d3)',
              boxShadow: '0 0 24px -8px rgba(124,58,237,0.60)',
            }}
          >
            <Handshake size={15} />
            <span>{t('partner.becomePartner', 'Become Partner')}</span>
          </a>
        </div>

        {/* Bottom Section */}
        <div className="mt-10 border-t border-slate-200/80 pt-8 dark:border-white/[0.08]">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
            {/* Copyright */}
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
              © 2025 Consultify. Powered by{' '}
              <a
                href={COMPANY.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-500 hover:text-purple-400 transition-colors"
              >
                DBR77 Robotics
              </a>
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              <a
                href={SOCIAL_LINKS.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-[#0077B5] hover:bg-[#0077B5]/80 rounded-md flex items-center justify-center transition-colors"
                title="LinkedIn"
              >
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a
                href={SOCIAL_LINKS.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-[#FF0000] hover:bg-[#FF0000]/80 rounded-md flex items-center justify-center transition-colors"
                title="YouTube"
              >
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              <a
                href={SOCIAL_LINKS.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-[#1877F2] hover:bg-[#1877F2]/80 rounded-md flex items-center justify-center transition-colors"
                title="Facebook"
              >
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                href={SOCIAL_LINKS.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-[#1DB954] hover:bg-[#1DB954]/80 rounded-md flex items-center justify-center transition-colors"
                title="Spotify Podcast"
              >
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
              </a>
              <a
                href={SOCIAL_LINKS.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-80 rounded-md flex items-center justify-center transition-opacity"
                title="Instagram"
              >
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
            </div>

            {!hidePartnerBadges && (
              <div className="flex items-center gap-4 flex-wrap justify-center lg:justify-end">
                {PARTNERSHIPS.futureFactory.enabled && (
                  <a
                    href={PARTNERSHIPS.futureFactory.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 opacity-50 hover:opacity-80 transition-opacity group"
                    title="Saudi Arabia Future Factory Program Partner"
                  >
                    <svg
                      className="w-4 h-4 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                    <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider group-hover:text-green-600 transition-colors">
                      {PARTNERSHIPS.futureFactory.label}
                    </span>
                  </a>
                )}
                {PARTNERSHIPS.ampc.enabled && (
                  <a
                    href={PARTNERSHIPS.ampc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 opacity-50 hover:opacity-80 transition-opacity group"
                    title="Advanced Manufacturing and Production Center Partner"
                  >
                    <svg
                      className="w-4 h-4 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                      />
                    </svg>
                    <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">
                      {PARTNERSHIPS.ampc.label}
                    </span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
