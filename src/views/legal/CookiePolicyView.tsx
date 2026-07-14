import React from 'react';
import { useTranslation } from 'react-i18next';

import { LegalPageLayout } from '../../components/legal/LegalPageLayout';

const COMPANY = {
  name: 'DBR77 Robotics Sp. z o.o.',
  email: 'contact@dbr77.com',
  website: 'https://consultify.com',
};

/**
 * Simple cookie list - only essential cookies used by the application
 */
const COOKIES = {
  essential: [
    { name: 'session', purpose: 'Maintains your login session', duration: 'Session' },
    { name: 'auth_token', purpose: 'Secure authentication', duration: '7 days' },
    { name: 'csrf_token', purpose: 'Security protection', duration: 'Session' },
  ],
  functional: [
    { name: 'theme', purpose: 'Your theme preference (light/dark)', duration: '1 year' },
    { name: 'language', purpose: 'Your language preference', duration: '1 year' },
    { name: 'sidebar', purpose: 'Sidebar state', duration: '1 year' },
  ],
};

export const CookiePolicyView: React.FC = () => {
  const { t } = useTranslation();

  const renderCookieTable = (cookies: typeof COOKIES.essential) => (
    <div className="overflow-x-auto my-4">
      <table
        /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="w-full text-sm border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden"
      >
        <thead className="bg-slate-50 dark:bg-navy-900">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-navy-900 dark:text-white">
              Cookie
            </th>
            <th className="px-4 py-2 text-left font-medium text-navy-900 dark:text-white">
              Purpose
            </th>
            <th className="px-4 py-2 text-left font-medium text-navy-900 dark:text-white">
              Duration
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-white/5">
          {cookies.map((cookie, idx) => (
            <tr key={idx}>
              <td className="px-4 py-2 font-mono text-xs text-primary-600 dark:text-primary-400">
                {cookie.name}
              </td>
              <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{cookie.purpose}</td>
              <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{cookie.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <LegalPageLayout
      title={t('legal.cookies.title', 'Cookie Policy')}
      lastUpdated="January 1, 2025"
    >
      <section>
        <h2>1. What Are Cookies?</h2>
        <p>
          Cookies are small text files stored on your device when you visit our website. They help
          us provide you with a better experience by remembering your preferences.
        </p>
      </section>

      <section>
        <h2>2. Cookies We Use</h2>
        <p>
          Consultify uses only essential and functional cookies. We do not use third-party tracking
          or advertising cookies.
        </p>

        <h3>Essential Cookies</h3>
        <p>Required for the platform to function. Cannot be disabled.</p>
        {renderCookieTable(COOKIES.essential)}

        <h3>Functional Cookies</h3>
        <p>Remember your preferences for a better experience.</p>
        {renderCookieTable(COOKIES.functional)}
      </section>

      <section>
        <h2>3. Managing Cookies</h2>
        <p>
          You can control cookies through your browser settings. Note that disabling essential
          cookies will prevent you from using the platform. Links to browser cookie settings:
        </p>
        <ul>
          <li>
            <a
              href="https://support.google.com/chrome/answer/95647"
              target="_blank"
              rel="noopener noreferrer"
            >
              Chrome
            </a>
          </li>
          <li>
            <a
              href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
              target="_blank"
              rel="noopener noreferrer"
            >
              Firefox
            </a>
          </li>
          <li>
            <a
              href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac"
              target="_blank"
              rel="noopener noreferrer"
            >
              Safari
            </a>
          </li>
          <li>
            <a
              href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
              target="_blank"
              rel="noopener noreferrer"
            >
              Edge
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Contact</h2>
        <p>
          Questions? Contact us at <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        </p>
      </section>
    </LegalPageLayout>
  );
};

export default CookiePolicyView;
