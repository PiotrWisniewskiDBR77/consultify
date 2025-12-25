import React from 'react';
import { useTranslation } from 'react-i18next';
import { LegalPageLayout } from '../../components/legal/LegalPageLayout';

// Company data - UPDATE THESE VALUES
const COMPANY = {
    name: 'DBR77 Sp. z o.o.',
    address: '[Adres do uzupełnienia]',
    city: '[Miasto], Polska',
    nip: '[NIP do uzupełnienia]',
    krs: '[KRS do uzupełnienia]',
    email: 'legal@dbr77.com',
    website: 'https://consultinity.com'
};

export const TermsOfServiceView: React.FC = () => {
    const { t } = useTranslation();

    return (
        <LegalPageLayout
            title={t('legal.terms.title', 'Terms of Service')}
            lastUpdated="December 23, 2024"
        >
            {/* 1. Introduction */}
            <section>
                <h2>1. Introduction and Acceptance</h2>
                <p>
                    Welcome to Consultinity ("Service", "Platform"), an AI-powered strategic consulting platform
                    operated by <strong>{COMPANY.name}</strong> ("Company", "we", "us", "our").
                </p>
                <p>
                    By accessing or using our Service, you ("User", "you", "your") agree to be bound by these
                    Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service.
                </p>
                <p>
                    These Terms apply to all users, including trial users, subscribers, and enterprise customers.
                </p>
            </section>

            {/* 2. Definitions */}
            <section>
                <h2>2. Definitions</h2>
                <ul>
                    <li><strong>"Account"</strong> - Your registered user account on the Platform</li>
                    <li><strong>"Content"</strong> - All data, text, documents, and materials you create or upload</li>
                    <li><strong>"AI Services"</strong> - Artificial intelligence features powered by third-party providers</li>
                    <li><strong>"Organization"</strong> - A company or entity using the Platform with multiple users</li>
                    <li><strong>"Subscription"</strong> - Your paid access plan to the Platform</li>
                    <li><strong>"Trial Period"</strong> - A limited free access period to evaluate the Service</li>
                </ul>
            </section>

            {/* 3. Eligibility */}
            <section>
                <h2>3. Eligibility</h2>
                <p>To use Consultinity, you must:</p>
                <ul>
                    <li>Be at least 18 years of age</li>
                    <li>Have the legal capacity to enter into binding agreements</li>
                    <li>Not be prohibited from using the Service under applicable laws</li>
                    <li>Provide accurate and complete registration information</li>
                </ul>
                <p>
                    If you are using the Service on behalf of an organization, you represent that you have
                    authority to bind that organization to these Terms.
                </p>
            </section>

            {/* 4. Account Registration */}
            <section>
                <h2>4. Account Registration and Security</h2>
                <h3>4.1 Registration</h3>
                <p>
                    You must register for an account to access most features. You agree to provide accurate,
                    current, and complete information during registration and keep it updated.
                </p>

                <h3>4.2 Account Security</h3>
                <p>
                    You are responsible for maintaining the confidentiality of your account credentials and
                    for all activities that occur under your account. Notify us immediately of any unauthorized
                    access at <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
                </p>

                <h3>4.3 One Account Per User</h3>
                <p>
                    You may not share your account with others or create multiple accounts for the same person.
                </p>
            </section>

            {/* 5. Subscription and Payment */}
            <section>
                <h2>5. Subscription and Payment</h2>

                <h3>5.1 Plans and Pricing</h3>
                <p>
                    Consultinity offers various subscription plans. Current pricing is available on our website.
                    We reserve the right to modify pricing with 30 days' notice.
                </p>

                <h3>5.2 Trial Period</h3>
                <p>
                    New users may be eligible for a free trial period. Trial features and limitations are
                    specified at signup. After the trial, you must subscribe to continue using paid features.
                </p>

                <h3>5.3 Billing</h3>
                <ul>
                    <li>Subscriptions are billed in advance on a monthly or annual basis</li>
                    <li>Payment is processed through Stripe</li>
                    <li>All fees are non-refundable except as required by law</li>
                    <li>You are responsible for applicable taxes</li>
                </ul>

                <h3>5.4 Automatic Renewal</h3>
                <p>
                    Subscriptions automatically renew unless cancelled before the renewal date. You may
                    cancel at any time through your account settings.
                </p>

                <h3>5.5 Failed Payments</h3>
                <p>
                    If payment fails, we may suspend your access until payment is resolved. After 30 days
                    of non-payment, we may terminate your account.
                </p>
            </section>

            {/* 6. License */}
            <section>
                <h2>6. License and Access</h2>

                <h3>6.1 License Grant</h3>
                <p>
                    Subject to these Terms, we grant you a limited, non-exclusive, non-transferable,
                    revocable license to access and use the Platform for your internal business purposes.
                </p>

                <h3>6.2 Restrictions</h3>
                <p>You may not:</p>
                <ul>
                    <li>Copy, modify, or distribute the Platform or its content</li>
                    <li>Reverse engineer, decompile, or disassemble any software</li>
                    <li>Use the Service for illegal purposes</li>
                    <li>Resell or sublicense access to third parties</li>
                    <li>Use automated means to access the Service (bots, scrapers)</li>
                    <li>Attempt to bypass security measures or access controls</li>
                </ul>
            </section>

            {/* 7. Intellectual Property */}
            <section>
                <h2>7. Intellectual Property</h2>

                <h3>7.1 Our Intellectual Property</h3>
                <p>
                    The Platform, including its software, design, logos, and methodologies, is owned by
                    {COMPANY.name} and protected by intellectual property laws. Nothing in these Terms
                    transfers ownership to you.
                </p>

                <h3>7.2 Your Content</h3>
                <p>
                    You retain ownership of all Content you create or upload. By using the Service, you
                    grant us a limited license to process your Content solely to provide the Service.
                </p>

                <h3>7.3 AI-Generated Content</h3>
                <p>
                    Outputs generated by AI features based on your inputs belong to you, subject to the
                    terms of the underlying AI provider. You are responsible for reviewing and validating
                    all AI-generated content before use.
                </p>

                <h3>7.4 Feedback</h3>
                <p>
                    If you provide feedback or suggestions, we may use them without obligation to compensate you.
                </p>
            </section>

            {/* 8. User Conduct */}
            <section>
                <h2>8. Acceptable Use Policy</h2>
                <p>You agree not to use the Platform to:</p>
                <ul>
                    <li>Violate any laws or regulations</li>
                    <li>Infringe on intellectual property rights of others</li>
                    <li>Transmit malware, viruses, or harmful code</li>
                    <li>Harass, abuse, or harm others</li>
                    <li>Spread false or misleading information</li>
                    <li>Interfere with the Platform's operation or security</li>
                    <li>Collect data about other users without consent</li>
                    <li>Use AI features to generate harmful, illegal, or unethical content</li>
                </ul>
                <p>
                    We reserve the right to suspend or terminate accounts that violate these policies.
                </p>
            </section>

            {/* 9. AI Services */}
            <section>
                <h2>9. AI Services and Third-Party Providers</h2>

                <h3>9.1 AI Processing</h3>
                <p>
                    Consultinity uses third-party AI providers (including OpenAI, Anthropic, and Google) to
                    power certain features. By using AI features, you acknowledge that your inputs may be
                    processed by these providers subject to their terms.
                </p>

                <h3>9.2 AI Limitations</h3>
                <p>
                    AI-generated content is provided "as-is" and may contain errors or inaccuracies. You are
                    solely responsible for reviewing, validating, and appropriately using any AI outputs.
                    AI should not replace professional judgment or advice.
                </p>

                <h3>9.3 Bring Your Own Key (BYOK)</h3>
                <p>
                    If you use your own API keys for AI providers, you are responsible for compliance with
                    that provider's terms and for any associated costs.
                </p>
            </section>

            {/* 10. Data and Privacy */}
            <section>
                <h2>10. Data and Privacy</h2>
                <p>
                    Your privacy is important to us. Our <a href="/privacy">Privacy Policy</a> explains how
                    we collect, use, and protect your personal data. By using the Service, you consent to
                    our data practices as described in the Privacy Policy.
                </p>
                <p>
                    You are responsible for ensuring you have appropriate rights to upload any data to the Platform.
                </p>
            </section>

            {/* 11. Warranties */}
            <section>
                <h2>11. Disclaimer of Warranties</h2>
                <p>
                    THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
                    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
                </p>
                <ul>
                    <li>MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE</li>
                    <li>ACCURACY, RELIABILITY, or COMPLETENESS of any content</li>
                    <li>UNINTERRUPTED or ERROR-FREE operation</li>
                    <li>SECURITY from unauthorized access</li>
                </ul>
                <p>
                    We do not warrant that AI-generated insights are accurate, complete, or suitable for
                    any particular purpose. Strategic decisions should be validated independently.
                </p>
            </section>

            {/* 12. Limitation of Liability */}
            <section>
                <h2>12. Limitation of Liability</h2>
                <p>
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, {COMPANY.name.toUpperCase()} SHALL NOT BE LIABLE FOR:
                </p>
                <ul>
                    <li>INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, or PUNITIVE DAMAGES</li>
                    <li>LOSS OF PROFITS, DATA, BUSINESS OPPORTUNITIES, or GOODWILL</li>
                    <li>DAMAGES RESULTING FROM YOUR RELIANCE ON AI-GENERATED CONTENT</li>
                    <li>ACTIONS OR CONTENT OF THIRD PARTIES</li>
                </ul>
                <p>
                    OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.
                </p>
            </section>

            {/* 13. Indemnification */}
            <section>
                <h2>13. Indemnification</h2>
                <p>
                    You agree to indemnify, defend, and hold harmless {COMPANY.name}, its officers, directors,
                    employees, and agents from any claims, damages, losses, or expenses (including legal fees)
                    arising from:
                </p>
                <ul>
                    <li>Your use of the Service</li>
                    <li>Your violation of these Terms</li>
                    <li>Your Content or data</li>
                    <li>Your violation of third-party rights</li>
                </ul>
            </section>

            {/* 14. Termination */}
            <section>
                <h2>14. Termination</h2>

                <h3>14.1 By You</h3>
                <p>
                    You may cancel your subscription and close your account at any time through your settings.
                    Cancellation takes effect at the end of your current billing period.
                </p>

                <h3>14.2 By Us</h3>
                <p>
                    We may suspend or terminate your account if you violate these Terms, fail to pay,
                    or if required by law. We may also discontinue the Service with 90 days' notice.
                </p>

                <h3>14.3 Effect of Termination</h3>
                <p>
                    Upon termination, your license ends. You may export your data for 30 days after
                    termination. After that, we may delete your data in accordance with our Privacy Policy.
                </p>
            </section>

            {/* 15. Governing Law */}
            <section>
                <h2>15. Governing Law and Disputes</h2>
                <p>
                    These Terms are governed by the laws of Poland, without regard to conflict of law principles.
                </p>
                <p>
                    Any disputes shall be resolved through:
                </p>
                <ol>
                    <li>Good faith negotiation between the parties</li>
                    <li>Mediation administered by a mutually agreed mediator</li>
                    <li>Courts of competent jurisdiction in Poland</li>
                </ol>
                <p>
                    For EU consumers, nothing in these Terms affects your statutory rights or your right
                    to bring claims in your local courts.
                </p>
            </section>

            {/* 16. Changes */}
            <section>
                <h2>16. Changes to Terms</h2>
                <p>
                    We may update these Terms from time to time. We will notify you of material changes
                    by email or through the Platform at least 30 days before they take effect. Your
                    continued use after changes become effective constitutes acceptance.
                </p>
            </section>

            {/* 17. General */}
            <section>
                <h2>17. General Provisions</h2>
                <ul>
                    <li>
                        <strong>Entire Agreement:</strong> These Terms, together with the Privacy Policy and
                        any additional agreements, constitute the entire agreement between you and us.
                    </li>
                    <li>
                        <strong>Severability:</strong> If any provision is found unenforceable, the remaining
                        provisions continue in effect.
                    </li>
                    <li>
                        <strong>Waiver:</strong> Our failure to enforce any right does not constitute a waiver.
                    </li>
                    <li>
                        <strong>Assignment:</strong> You may not assign these Terms. We may assign our rights
                        in connection with a business transfer.
                    </li>
                    <li>
                        <strong>Force Majeure:</strong> We are not liable for failures due to circumstances
                        beyond our reasonable control.
                    </li>
                </ul>
            </section>

            {/* 18. Contact */}
            <section>
                <h2>18. Contact Information</h2>
                <p>For questions about these Terms, contact us:</p>
                <div className="bg-slate-50 dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/10 my-6">
                    <p className="font-semibold text-navy-900 dark:text-white mb-2">{COMPANY.name}</p>
                    <p>{COMPANY.address}</p>
                    <p>{COMPANY.city}</p>
                    <p className="mt-2">
                        Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
                    </p>
                    <p>
                        Website: <a href={COMPANY.website}>{COMPANY.website}</a>
                    </p>
                </div>
            </section>
        </LegalPageLayout>
    );
};

export default TermsOfServiceView;
