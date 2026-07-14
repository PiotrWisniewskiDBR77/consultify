import { ArrowLeft, Code2, ExternalLink } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { EmptyStateInline } from '@/components/shared/NModeBlocks/EmptyStateInline';

export function DocsApiReferenceView() {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <nav className="flex items-center gap-2 text-sm text-c-text-muted mb-6">
        <Link to="/docs" className="hover:text-c-accent">
          {t('docs.common.docs', 'Docs')}
        </Link>
        <span>/</span>
        <span className="text-c-text font-medium">{t('docs.api.title', 'API Reference')}</span>
      </nav>

      <div className="rounded-2xl border border-c-border bg-c-surface p-6 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-c-accent-soft flex items-center justify-center">
            <Code2 size={24} className="text-c-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-c-text">
              {t('docs.api.title', 'API Reference')}
            </h1>
            <p className="text-sm text-c-text-secondary">
              {t(
                'docs.api.subtitle',
                'This surface is not yet a live OpenAPI explorer. We only expose an honest placeholder until the real reference is published.'
              )}
            </p>
          </div>
        </div>

        <EmptyStateInline
          icon={Code2}
          message={t(
            'docs.api.placeholder.message',
            'Interactive API reference is not published yet.'
          )}
          hint={t(
            'docs.api.placeholder.hint',
            'Do not treat this page as an authoritative endpoint catalog. Use product docs and shipped integrations until the real API reference is available.'
          )}
          dashed={false}
          className="bg-c-surface-raised"
        />

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-c-border text-sm font-medium text-c-text hover:bg-c-surface-raised dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={16} />
            {t('docs.api.backToDocs', 'Back to Documentation')}
          </Link>
          <a
            href="mailto:support@consultify.ai?subject=API%20Reference%20Access"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium hover:bg-navy-800 transition-colors"
          >
            <ExternalLink size={16} />
            {t('docs.api.contactSupport', 'Contact support')}
          </a>
        </div>
      </div>
    </div>
  );
}

export default DocsApiReferenceView;
