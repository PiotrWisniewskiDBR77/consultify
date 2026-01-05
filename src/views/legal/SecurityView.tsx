import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Eye, Key, Lock, Server, Shield, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EntryFooter } from '../../components/Landing/EntryFooter';
import { EntryTopBar } from '../../components/Landing/EntryTopBar';

// Company data - UPDATE THESE VALUES
const COMPANY = {
    name: 'DBR77 Sp. z o.o.',
    securityEmail: 'security@dbr77.com',
    website: 'https://consultinity.com',
};

export const SecurityView: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const securityFeatures = [
        {
            icon: Lock,
            title: 'Encryption',
            description: 'All data is encrypted at rest using AES-256 and in transit using TLS 1.3.',
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
        },
        {
            icon: Server,
            title: 'EU Data Residency',
            description: 'Your data is stored exclusively in EU-based data centers, ensuring GDPR compliance.',
            color: 'text-purple-500',
            bgColor: 'bg-purple-500/10',
        },
        {
            icon: Shield,
            title: 'SOC2 Type II',
            description: 'Our infrastructure follows SOC2 Type II security controls and undergoes regular audits.',
            color: 'text-green-500',
            bgColor: 'bg-green-500/10',
        },
        {
            icon: Key,
            title: 'Access Control',
            description: 'Role-based access control (RBAC) with multi-factor authentication support.',
            color: 'text-amber-500',
            bgColor: 'bg-amber-500/10',
        },
        {
            icon: Eye,
            title: 'Audit Logging',
            description: 'Complete audit trail of all actions for compliance and security monitoring.',
            color: 'text-indigo-500',
            bgColor: 'bg-indigo-500/10',
        },
        {
            icon: Users,
            title: 'SSO Integration',
            description: 'Enterprise Single Sign-On via SAML 2.0 and OAuth 2.0 protocols.',
            color: 'text-pink-500',
            bgColor: 'bg-pink-500/10',
        },
    ];

    const complianceItems = [
        'GDPR (General Data Protection Regulation)',
        'ISO 27001 aligned practices',
        'SOC2 Type II controls',
        'CCPA compliant',
        'Data Processing Agreements (DPA) available',
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-navy-950 flex flex-col">
            {/* Header */}
            <EntryTopBar
                onTrialClick={() => navigate('/trial/start')}
                onDemoClick={() => navigate('/demo')}
                onLoginClick={() => navigate('/login')}
                isLoggedIn={false}
                hasWorkspace={false}
            />

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-slate-50 to-white dark:from-navy-900 dark:to-navy-950">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <span
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 
                                         text-green-600 dark:text-green-400 text-sm font-semibold mb-6"
                        >
                            <Shield size={16} />
                            Security & Compliance
                        </span>

                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-navy-950 dark:text-white mb-6 tracking-tight">
                            Enterprise-Grade{' '}
                            <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                Security
                            </span>
                        </h1>

                        <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
                            Consultinity is built with security at its core. We protect your strategic data with
                            industry-leading security practices and compliance standards.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Security Features Grid */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-navy-950 dark:text-white mb-12 text-center">
                        Security Infrastructure
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {securityFeatures.map((feature, idx) => {
                            const Icon = feature.icon;
                            return (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.1, duration: 0.5 }}
                                    className="p-6 bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-lg transition-shadow"
                                >
                                    <div
                                        className={`w-12 h-12 ${feature.bgColor} rounded-xl flex items-center justify-center mb-4`}
                                    >
                                        <Icon size={24} className={feature.color} />
                                    </div>
                                    <h3 className="text-lg font-bold text-navy-950 dark:text-white mb-2">
                                        {feature.title}
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                        {feature.description}
                                    </p>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Compliance Section */}
            <section className="py-20 px-6 bg-slate-50 dark:bg-navy-900/50">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold text-navy-950 dark:text-white mb-8 text-center">
                        Compliance & Certifications
                    </h2>
                    <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 p-8">
                        <ul className="space-y-4">
                            {complianceItems.map((item, idx) => (
                                <li key={idx} className="flex items-center gap-4 text-slate-700 dark:text-slate-300">
                                    <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                        <CheckCircle size={14} className="text-green-600 dark:text-green-400" />
                                    </div>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* Data Protection */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold text-navy-950 dark:text-white mb-8">Data Protection Measures</h2>

                    <div className="prose prose-slate dark:prose-invert max-w-none">
                        <h3>Encryption</h3>
                        <p>
                            All customer data is encrypted at rest using AES-256 encryption. Data in transit is
                            protected using TLS 1.3 with perfect forward secrecy. Encryption keys are managed using
                            industry-standard key management practices with regular rotation.
                        </p>

                        <h3>Access Controls</h3>
                        <p>
                            We implement strict role-based access control (RBAC) throughout our platform. Access to
                            production systems is limited to authorized personnel only, with all access logged and
                            regularly audited. Multi-factor authentication (MFA) is mandatory for all administrative
                            access.
                        </p>

                        <h3>Data Isolation</h3>
                        <p>
                            Each organization's data is logically isolated using tenant-level encryption keys. This
                            ensures that your strategic data remains completely separate from other customers' data.
                        </p>

                        <h3>Backup & Recovery</h3>
                        <p>
                            We perform daily encrypted backups with point-in-time recovery capabilities. Backups are
                            stored in geographically separate EU data centers to ensure business continuity.
                        </p>
                    </div>
                </div>
            </section>

            {/* Responsible Disclosure */}
            <section className="py-20 px-6 bg-slate-50 dark:bg-navy-900/50">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-8">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-navy-950 dark:text-white mb-2">
                                    Responsible Disclosure
                                </h3>
                                <p className="text-slate-600 dark:text-slate-300 mb-4">
                                    We take security vulnerabilities seriously. If you discover a security issue, please
                                    report it to us responsibly. We commit to:
                                </p>
                                <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-1 mb-4">
                                    <li>Acknowledge receipt within 24 hours</li>
                                    <li>Provide regular updates on our investigation</li>
                                    <li>Credit researchers who follow responsible disclosure</li>
                                    <li>Not pursue legal action against good-faith researchers</li>
                                </ul>
                                <p className="text-slate-600 dark:text-slate-300">
                                    Report security issues to:{' '}
                                    <a
                                        href={`mailto:${COMPANY.securityEmail}`}
                                        className="text-purple-600 dark:text-purple-400 font-semibold"
                                    >
                                        {COMPANY.securityEmail}
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-2xl font-bold text-navy-950 dark:text-white mb-4">Need More Information?</h2>
                    <p className="text-slate-600 dark:text-slate-300 mb-8">
                        For detailed security documentation or to request our SOC2 report, please contact us.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <a
                            href={`mailto:${COMPANY.securityEmail}`}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors"
                        >
                            Contact Security Team
                        </a>
                        <a
                            href="/privacy"
                            className="px-6 py-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 text-navy-950 dark:text-white font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                            View Privacy Policy
                        </a>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <EntryFooter />
        </div>
    );
};

export default SecurityView;
