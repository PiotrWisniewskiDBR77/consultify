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
    email: 'privacy@dbr77.com',
    dpo: 'dpo@dbr77.com',
    website: 'https://consultinity.com'
};

export const PrivacyPolicyView: React.FC = () => {
    const { t } = useTranslation();

    return (
        <LegalPageLayout
            title={t('legal.privacy.title', 'Privacy Policy')}
            lastUpdated="December 23, 2024"
        >
            {/* 1. Introduction */}
            <section>
                <h2>1. Introduction</h2>
                <p>
                    Welcome to Consultinity, operated by <strong>{COMPANY.name}</strong>. We are committed to protecting
                    your personal data and respecting your privacy. This Privacy Policy explains how we collect, use,
                    store, and protect your information when you use our platform.
                </p>
                <p>
                    By using Consultinity, you agree to the collection and use of information in accordance with this policy.
                </p>
            </section>

            {/* 2. Data Controller */}
            <section>
                <h2>2. Data Controller</h2>
                <p>The data controller responsible for your personal data is:</p>
                <div className="bg-slate-50 dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/10 my-6">
                    <p className="font-semibold text-navy-900 dark:text-white mb-2">{COMPANY.name}</p>
                    <p>{COMPANY.address}</p>
                    <p>{COMPANY.city}</p>
                    <p className="mt-2">NIP: {COMPANY.nip}</p>
                    <p>KRS: {COMPANY.krs}</p>
                    <p className="mt-2">
                        Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
                    </p>
                    <p>
                        Data Protection Officer: <a href={`mailto:${COMPANY.dpo}`}>{COMPANY.dpo}</a>
                    </p>
                </div>
            </section>

            {/* 3. Data We Collect */}
            <section>
                <h2>3. Data We Collect</h2>

                <h3>3.1 Information You Provide</h3>
                <ul>
                    <li><strong>Account Information:</strong> Name, email address, company name, job title</li>
                    <li><strong>Profile Information:</strong> Avatar, preferences, language settings</li>
                    <li><strong>Organization Data:</strong> Company details, industry, size, strategic goals</li>
                    <li><strong>Content:</strong> Documents, reports, assessments, and other content you create</li>
                    <li><strong>Communications:</strong> Support requests, feedback, and correspondence</li>
                </ul>

                <h3>3.2 Information Collected Automatically</h3>
                <ul>
                    <li><strong>Usage Data:</strong> Features used, actions taken, session duration</li>
                    <li><strong>Device Information:</strong> Browser type, operating system, device identifiers</li>
                    <li><strong>Log Data:</strong> IP address, access times, pages viewed</li>
                    <li><strong>Cookies:</strong> See our <a href="/cookies">Cookie Policy</a> for details</li>
                </ul>

                <h3>3.3 AI Processing Data</h3>
                <p>
                    When you use our AI-powered features, we process the prompts and data you provide to generate
                    strategic insights. This data is processed in accordance with your selected AI provider's terms
                    and our data protection measures.
                </p>
            </section>

            {/* 4. Purpose of Processing */}
            <section>
                <h2>4. How We Use Your Data</h2>
                <p>We use your personal data for the following purposes:</p>
                <ul>
                    <li><strong>Service Delivery:</strong> To provide and maintain Consultinity's features</li>
                    <li><strong>Account Management:</strong> To manage your account and subscription</li>
                    <li><strong>AI Services:</strong> To power AI-driven strategic consulting features</li>
                    <li><strong>Communication:</strong> To send service updates, security alerts, and support messages</li>
                    <li><strong>Improvement:</strong> To analyze usage patterns and improve our platform</li>
                    <li><strong>Legal Compliance:</strong> To comply with legal obligations and protect our rights</li>
                </ul>
            </section>

            {/* 5. Legal Basis */}
            <section>
                <h2>5. Legal Basis for Processing</h2>
                <p>We process your personal data based on the following legal grounds (GDPR Article 6):</p>
                <ul>
                    <li><strong>Contract Performance (Art. 6(1)(b)):</strong> Processing necessary to provide our services</li>
                    <li><strong>Legitimate Interests (Art. 6(1)(f)):</strong> Platform improvement, fraud prevention, security</li>
                    <li><strong>Consent (Art. 6(1)(a)):</strong> Marketing communications, optional analytics</li>
                    <li><strong>Legal Obligation (Art. 6(1)(c)):</strong> Tax records, regulatory compliance</li>
                </ul>
            </section>

            {/* 6. Data Sharing */}
            <section>
                <h2>6. Data Sharing and Third Parties</h2>
                <p>We may share your data with:</p>

                <h3>6.1 Service Providers</h3>
                <ul>
                    <li><strong>Cloud Infrastructure:</strong> Secure EU-based hosting providers</li>
                    <li><strong>AI Providers:</strong> OpenAI, Anthropic, Google (based on your configuration)</li>
                    <li><strong>Payment Processors:</strong> Stripe for subscription management</li>
                    <li><strong>Analytics:</strong> Privacy-focused analytics tools</li>
                </ul>

                <h3>6.2 Legal Requirements</h3>
                <p>
                    We may disclose data if required by law, court order, or to protect our rights and safety.
                </p>

                <h3>6.3 Business Transfers</h3>
                <p>
                    In the event of a merger, acquisition, or sale, your data may be transferred as part of the business assets.
                </p>
            </section>

            {/* 7. International Transfers */}
            <section>
                <h2>7. International Data Transfers</h2>
                <p>
                    Your data is primarily stored on servers located in the European Union. When we transfer data
                    outside the EU/EEA (e.g., to AI providers), we ensure appropriate safeguards are in place:
                </p>
                <ul>
                    <li>EU Standard Contractual Clauses (SCCs)</li>
                    <li>Data Processing Agreements with all providers</li>
                    <li>Adequacy decisions where applicable</li>
                </ul>
            </section>

            {/* 8. Data Retention */}
            <section>
                <h2>8. Data Retention</h2>
                <p>We retain your personal data for as long as necessary to:</p>
                <ul>
                    <li>Provide our services while your account is active</li>
                    <li>Comply with legal obligations (typically 5-7 years for financial records)</li>
                    <li>Resolve disputes and enforce agreements</li>
                </ul>
                <p>
                    After account deletion, we anonymize or delete your data within 90 days, except where retention
                    is required by law.
                </p>
            </section>

            {/* 9. Your Rights */}
            <section>
                <h2>9. Your Rights (GDPR)</h2>
                <p>Under the General Data Protection Regulation, you have the following rights:</p>
                <ul>
                    <li><strong>Right of Access (Art. 15):</strong> Request a copy of your personal data</li>
                    <li><strong>Right to Rectification (Art. 16):</strong> Correct inaccurate or incomplete data</li>
                    <li><strong>Right to Erasure (Art. 17):</strong> Request deletion of your data ("right to be forgotten")</li>
                    <li><strong>Right to Restriction (Art. 18):</strong> Limit how we process your data</li>
                    <li><strong>Right to Data Portability (Art. 20):</strong> Receive your data in a portable format</li>
                    <li><strong>Right to Object (Art. 21):</strong> Object to processing based on legitimate interests</li>
                    <li><strong>Right to Withdraw Consent (Art. 7):</strong> Withdraw consent at any time</li>
                </ul>
                <p>
                    To exercise these rights, contact us at <a href={`mailto:${COMPANY.dpo}`}>{COMPANY.dpo}</a>.
                    We will respond within 30 days.
                </p>
            </section>

            {/* 10. Security */}
            <section>
                <h2>10. Data Security</h2>
                <p>We implement robust security measures to protect your data:</p>
                <ul>
                    <li>Encryption at rest (AES-256) and in transit (TLS 1.3)</li>
                    <li>Secure authentication with password hashing (bcrypt)</li>
                    <li>Role-based access controls</li>
                    <li>Regular security audits and penetration testing</li>
                    <li>24/7 monitoring and intrusion detection</li>
                </ul>
                <p>
                    For more information, visit our <a href="/security">Security page</a>.
                </p>
            </section>

            {/* 11. Cookies */}
            <section>
                <h2>11. Cookies and Tracking</h2>
                <p>
                    We use cookies and similar technologies to enhance your experience. For detailed information
                    about the cookies we use and how to control them, please see our{' '}
                    <a href="/cookies">Cookie Policy</a>.
                </p>
            </section>

            {/* 12. Children */}
            <section>
                <h2>12. Children's Privacy</h2>
                <p>
                    Consultinity is not intended for users under 18 years of age. We do not knowingly collect
                    data from children. If you believe a child has provided us with personal data, please
                    contact us immediately.
                </p>
            </section>

            {/* 13. Changes */}
            <section>
                <h2>13. Changes to This Policy</h2>
                <p>
                    We may update this Privacy Policy from time to time. We will notify you of significant changes
                    by email or through a notice on our platform. The "Last updated" date at the top reflects
                    the most recent revision.
                </p>
            </section>

            {/* 14. Contact */}
            <section>
                <h2>14. Contact Us</h2>
                <p>If you have questions about this Privacy Policy or wish to exercise your rights, contact us:</p>
                <div className="bg-slate-50 dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/10 my-6">
                    <p><strong>Email:</strong> <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>
                    <p><strong>DPO:</strong> <a href={`mailto:${COMPANY.dpo}`}>{COMPANY.dpo}</a></p>
                    <p className="mt-4 text-sm text-slate-500">
                        You also have the right to lodge a complaint with your local data protection authority.
                    </p>
                </div>
            </section>
        </LegalPageLayout>
    );
};

export default PrivacyPolicyView;
