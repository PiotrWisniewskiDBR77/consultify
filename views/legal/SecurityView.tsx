import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Lock, Server, Eye, FileCheck, AlertTriangle } from 'lucide-react';
import { LegalPageLayout } from '../../components/Legal/LegalPageLayout';

export const SecurityView: React.FC = () => {
    const { t } = useTranslation();

    return (
        <LegalPageLayout
            title={t('legal.security.title', 'Security')}
            lastUpdated="December 23, 2024"
        >
            {/* Introduction */}
            <section>
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 
                                p-8 rounded-2xl border border-purple-200 dark:border-purple-500/20 mb-12">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center shrink-0">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-2">
                                Security is Our Priority
                            </h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                At Consultinity, we understand that your strategic data is among your most valuable assets.
                                We've built our platform with enterprise-grade security from the ground up.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Security Features Grid */}
            <section>
                <h2>Our Security Measures</h2>

                <div className="grid md:grid-cols-2 gap-6 my-8">
                    {/* Encryption */}
                    <SecurityCard
                        icon={<Lock className="w-5 h-5" />}
                        title="End-to-End Encryption"
                        description="All data is encrypted at rest using AES-256 and in transit using TLS 1.3. Your strategic information is protected at every stage."
                    />

                    {/* EU Servers */}
                    <SecurityCard
                        icon={<Server className="w-5 h-5" />}
                        title="EU-Based Infrastructure"
                        description="Our primary servers are located in the European Union, ensuring GDPR compliance and data sovereignty."
                    />

                    {/* Access Control */}
                    <SecurityCard
                        icon={<Eye className="w-5 h-5" />}
                        title="Role-Based Access Control"
                        description="Granular permissions ensure users only access what they need. Full audit trail of all actions."
                    />

                    {/* Compliance */}
                    <SecurityCard
                        icon={<FileCheck className="w-5 h-5" />}
                        title="Compliance Ready"
                        description="Built to support GDPR, CCPA, and enterprise compliance requirements. Regular security audits."
                    />
                </div>
            </section>

            {/* Detailed Sections */}
            <section>
                <h2>Data Protection</h2>

                <h3>Encryption at Rest</h3>
                <p>
                    All data stored in our databases is encrypted using AES-256, the same encryption standard
                    used by governments and financial institutions worldwide. Encryption keys are managed using
                    industry-standard key management practices.
                </p>

                <h3>Encryption in Transit</h3>
                <p>
                    All communications between your browser and our servers use TLS 1.3, the latest and most
                    secure transport layer security protocol. We enforce HTTPS across all endpoints.
                </p>

                <h3>Database Security</h3>
                <ul>
                    <li>Encrypted backups with geographic redundancy</li>
                    <li>Point-in-time recovery capabilities</li>
                    <li>Regular automated security patching</li>
                    <li>Network isolation and firewalls</li>
                </ul>
            </section>

            <section>
                <h2>Authentication & Access</h2>

                <h3>Password Security</h3>
                <ul>
                    <li>Passwords are hashed using bcrypt with high cost factor</li>
                    <li>Minimum password complexity requirements</li>
                    <li>Secure password reset via email verification</li>
                </ul>

                <h3>Session Management</h3>
                <ul>
                    <li>Secure, HttpOnly session tokens</li>
                    <li>Automatic session expiration</li>
                    <li>CSRF protection on all forms</li>
                    <li>Rate limiting to prevent brute force attacks</li>
                </ul>

                <h3>OAuth Integration</h3>
                <p>
                    We support secure OAuth 2.0 authentication with Google and LinkedIn, allowing you to use
                    your existing enterprise SSO credentials.
                </p>
            </section>

            <section>
                <h2>AI Data Processing</h2>

                <h3>Third-Party AI Providers</h3>
                <p>
                    When you use AI features, your prompts are processed by third-party providers (OpenAI,
                    Anthropic, Google). We have Data Processing Agreements with all providers to ensure
                    your data is handled securely.
                </p>

                <h3>Data Handling Principles</h3>
                <ul>
                    <li><strong>Minimization:</strong> We only send the data necessary for the AI request</li>
                    <li><strong>No Training:</strong> Your data is not used to train AI models (with compliant providers)</li>
                    <li><strong>Bring Your Own Key:</strong> Use your own API keys for complete control</li>
                    <li><strong>EU Data Residency:</strong> Where available, we route requests through EU endpoints</li>
                </ul>

                <h3>Human-in-the-Loop</h3>
                <p>
                    Our platform is designed with human oversight in mind. AI-generated insights require human
                    review before implementation, ensuring you maintain control over strategic decisions.
                </p>
            </section>

            <section>
                <h2>Infrastructure Security</h2>

                <h3>Cloud Security</h3>
                <ul>
                    <li>Hosted on enterprise-grade cloud infrastructure</li>
                    <li>Virtual private networks (VPCs) with strict security groups</li>
                    <li>DDoS protection and web application firewall (WAF)</li>
                    <li>Automated vulnerability scanning</li>
                </ul>

                <h3>Monitoring & Response</h3>
                <ul>
                    <li>24/7 infrastructure monitoring</li>
                    <li>Intrusion detection systems</li>
                    <li>Automated alerting for suspicious activity</li>
                    <li>Incident response procedures</li>
                </ul>
            </section>

            <section>
                <h2>Organizational Security</h2>

                <h3>Employee Access</h3>
                <ul>
                    <li>Principle of least privilege for all staff</li>
                    <li>Background checks for employees with data access</li>
                    <li>Security awareness training</li>
                    <li>Access logging and regular audits</li>
                </ul>

                <h3>Development Practices</h3>
                <ul>
                    <li>Secure software development lifecycle (SDLC)</li>
                    <li>Code reviews and automated security testing</li>
                    <li>Dependency vulnerability scanning</li>
                    <li>Regular penetration testing</li>
                </ul>
            </section>

            {/* Vulnerability Disclosure */}
            <section>
                <h2>Vulnerability Disclosure</h2>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-xl border border-amber-200 dark:border-amber-500/20 my-6">
                    <div className="flex items-start gap-4">
                        <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                        <div>
                            <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-2">
                                Report a Security Issue
                            </h3>
                            <p className="text-slate-600 dark:text-slate-300 mb-4">
                                If you discover a security vulnerability, please report it responsibly.
                                We appreciate your help in keeping our platform secure.
                            </p>
                            <p>
                                <strong>Email:</strong>{' '}
                                <a href="mailto:security@dbr77.com" className="text-purple-600 dark:text-purple-400">
                                    security@dbr77.com
                                </a>
                            </p>
                            <p className="text-sm text-slate-500 mt-2">
                                Please include detailed steps to reproduce the vulnerability. We will respond
                                within 48 hours and work with you to address the issue.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact */}
            <section>
                <h2>Security Questions</h2>
                <p>
                    For security-related inquiries or to request our security documentation, contact us at{' '}
                    <a href="mailto:security@dbr77.com">security@dbr77.com</a>.
                </p>
                <p>
                    For general privacy questions, see our <a href="/privacy">Privacy Policy</a>.
                </p>
            </section>
        </LegalPageLayout>
    );
};

// Security Card Component
interface SecurityCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

const SecurityCard: React.FC<SecurityCardProps> = ({ icon, title, description }) => {
    return (
        <div className="p-6 rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                    {icon}
                </div>
                <div>
                    <h4 className="font-semibold text-navy-900 dark:text-white mb-1">{title}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
                </div>
            </div>
        </div>
    );
};

export default SecurityView;
