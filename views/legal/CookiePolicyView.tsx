import React from 'react';
import { useTranslation } from 'react-i18next';
import { LegalPageLayout } from '../../components/legal/LegalPageLayout';

export const CookiePolicyView: React.FC = () => {
    const { t } = useTranslation();

    return (
        <LegalPageLayout
            title={t('legal.cookies.title', 'Cookie Policy')}
            lastUpdated="December 23, 2024"
        >
            {/* 1. Introduction */}
            <section>
                <h2>1. What Are Cookies?</h2>
                <p>
                    Cookies are small text files that are placed on your device when you visit a website.
                    They are widely used to make websites work more efficiently and to provide information
                    to website owners.
                </p>
                <p>
                    This Cookie Policy explains how Consultinity ("we", "us", "our") uses cookies and
                    similar technologies on our platform.
                </p>
            </section>

            {/* 2. How We Use Cookies */}
            <section>
                <h2>2. How We Use Cookies</h2>
                <p>We use cookies for the following purposes:</p>
                <ul>
                    <li><strong>Essential functionality:</strong> Enable core features like authentication and security</li>
                    <li><strong>Preferences:</strong> Remember your settings and preferences</li>
                    <li><strong>Analytics:</strong> Understand how you use our platform to improve it</li>
                    <li><strong>Performance:</strong> Optimize loading speed and user experience</li>
                </ul>
            </section>

            {/* 3. Types of Cookies */}
            <section>
                <h2>3. Types of Cookies We Use</h2>

                <h3>3.1 Strictly Necessary Cookies</h3>
                <p>
                    These cookies are essential for the platform to function. They cannot be disabled.
                </p>
                <div className="overflow-x-auto my-6">
                    <table className="min-w-full border border-slate-200 dark:border-white/10">
                        <thead className="bg-slate-50 dark:bg-navy-900">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Cookie</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Purpose</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-t border-slate-200 dark:border-white/10">
                                <td className="px-4 py-3 font-mono text-sm">token</td>
                                <td className="px-4 py-3 text-sm">Authentication session</td>
                                <td className="px-4 py-3 text-sm">Session / 7 days</td>
                            </tr>
                            <tr className="border-t border-slate-200 dark:border-white/10">
                                <td className="px-4 py-3 font-mono text-sm">cookie-consent</td>
                                <td className="px-4 py-3 text-sm">Stores your cookie preferences</td>
                                <td className="px-4 py-3 text-sm">1 year</td>
                            </tr>
                            <tr className="border-t border-slate-200 dark:border-white/10">
                                <td className="px-4 py-3 font-mono text-sm">csrf_token</td>
                                <td className="px-4 py-3 text-sm">Security - prevents cross-site attacks</td>
                                <td className="px-4 py-3 text-sm">Session</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h3>3.2 Functional Cookies</h3>
                <p>
                    These cookies enable enhanced functionality and personalization.
                </p>
                <div className="overflow-x-auto my-6">
                    <table className="min-w-full border border-slate-200 dark:border-white/10">
                        <thead className="bg-slate-50 dark:bg-navy-900">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Cookie</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Purpose</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-t border-slate-200 dark:border-white/10">
                                <td className="px-4 py-3 font-mono text-sm">theme</td>
                                <td className="px-4 py-3 text-sm">Remembers dark/light mode preference</td>
                                <td className="px-4 py-3 text-sm">1 year</td>
                            </tr>
                            <tr className="border-t border-slate-200 dark:border-white/10">
                                <td className="px-4 py-3 font-mono text-sm">i18nextLng</td>
                                <td className="px-4 py-3 text-sm">Remembers language preference</td>
                                <td className="px-4 py-3 text-sm">1 year</td>
                            </tr>
                            <tr className="border-t border-slate-200 dark:border-white/10">
                                <td className="px-4 py-3 font-mono text-sm">sidebar_collapsed</td>
                                <td className="px-4 py-3 text-sm">Remembers sidebar state</td>
                                <td className="px-4 py-3 text-sm">Persistent</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h3>3.3 Analytics Cookies</h3>
                <p>
                    These cookies help us understand how visitors interact with our platform.
                </p>
                <div className="overflow-x-auto my-6">
                    <table className="min-w-full border border-slate-200 dark:border-white/10">
                        <thead className="bg-slate-50 dark:bg-navy-900">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Cookie</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Provider</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Purpose</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-t border-slate-200 dark:border-white/10">
                                <td className="px-4 py-3 font-mono text-sm">_ga, _gid</td>
                                <td className="px-4 py-3 text-sm">Google Analytics</td>
                                <td className="px-4 py-3 text-sm">Usage analytics (if enabled)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="text-sm text-slate-500">
                    Note: Analytics cookies are only set if you consent to them.
                </p>

                <h3>3.4 Marketing Cookies</h3>
                <p>
                    We currently do not use marketing or advertising cookies. If this changes,
                    we will update this policy and request your consent.
                </p>
            </section>

            {/* 4. Third-Party Cookies */}
            <section>
                <h2>4. Third-Party Cookies</h2>
                <p>
                    Some cookies may be set by third-party services we use. These include:
                </p>
                <ul>
                    <li><strong>Stripe:</strong> Payment processing (essential for billing)</li>
                    <li><strong>Intercom/Support:</strong> Customer support chat (if applicable)</li>
                </ul>
                <p>
                    These third parties have their own privacy policies governing the use of cookies.
                </p>
            </section>

            {/* 5. Managing Cookies */}
            <section>
                <h2>5. Managing Your Cookie Preferences</h2>

                <h3>5.1 Cookie Consent Banner</h3>
                <p>
                    When you first visit our platform, you will see a cookie consent banner that allows
                    you to accept or customize your cookie preferences.
                </p>

                <h3>5.2 Browser Settings</h3>
                <p>
                    You can control cookies through your browser settings. Most browsers allow you to:
                </p>
                <ul>
                    <li>View what cookies are stored</li>
                    <li>Delete all or specific cookies</li>
                    <li>Block third-party cookies</li>
                    <li>Block cookies from specific sites</li>
                    <li>Block all cookies</li>
                </ul>
                <p>
                    Note: Blocking all cookies may prevent the platform from functioning properly.
                </p>

                <h3>5.3 Browser-Specific Instructions</h3>
                <ul>
                    <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
                    <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
                    <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
                    <li><a href="https://support.microsoft.com/en-us/windows/delete-and-manage-cookies-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
                </ul>
            </section>

            {/* 6. Local Storage */}
            <section>
                <h2>6. Local Storage</h2>
                <p>
                    In addition to cookies, we use browser local storage to store certain preferences
                    and data locally on your device. This includes:
                </p>
                <ul>
                    <li>User preferences and settings</li>
                    <li>Cached application data for performance</li>
                    <li>Session information</li>
                </ul>
                <p>
                    You can clear local storage through your browser's developer tools or settings.
                </p>
            </section>

            {/* 7. Updates */}
            <section>
                <h2>7. Changes to This Policy</h2>
                <p>
                    We may update this Cookie Policy from time to time. Changes will be reflected by
                    the "Last updated" date at the top of this page. We encourage you to review this
                    policy periodically.
                </p>
            </section>

            {/* 8. Contact */}
            <section>
                <h2>8. Contact Us</h2>
                <p>
                    If you have questions about our use of cookies, please contact us at{' '}
                    <a href="mailto:privacy@dbr77.com">privacy@dbr77.com</a>.
                </p>
                <p>
                    For more information about how we handle your personal data, please see our{' '}
                    <a href="/privacy">Privacy Policy</a>.
                </p>
            </section>
        </LegalPageLayout>
    );
};

export default CookiePolicyView;
