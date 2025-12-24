import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket, Target, Users, Sparkles, ArrowRight, Lightbulb } from 'lucide-react';
import { EntryTopBar } from '../../components/Landing/EntryTopBar';
import { EntryFooter } from '../../components/Landing/EntryFooter';

// Company data - UPDATE THESE VALUES
const COMPANY = {
    name: 'DBR77 Sp. z o.o.',
    founded: '2020',
    location: 'Warszawa, Polska',
    website: 'https://consultinity.com'
};

export const AboutView: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

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
            <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-purple-50 to-white dark:from-navy-900 dark:to-navy-950">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 dark:bg-purple-900/30 
                                         text-purple-600 dark:text-purple-400 text-sm font-semibold mb-6">
                            <Sparkles size={16} />
                            About Consultinity
                        </span>

                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-navy-950 dark:text-white mb-6 tracking-tight">
                            AI-Powered Strategic Consulting for the{' '}
                            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                Modern Executive
                            </span>
                        </h1>

                        <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
                            We believe every leader deserves access to world-class strategic consulting.
                            Consultinity combines AI intelligence with proven frameworks to democratize
                            strategic decision-making.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Mission Section */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <h2 className="text-3xl font-bold text-navy-950 dark:text-white mb-6">
                                Our Mission
                            </h2>
                            <p className="text-lg text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                                Traditional consulting is broken. It's expensive, slow, and often delivers
                                beautiful presentations instead of actionable decisions, reliant on external
                                providers instead of building internal competencies.
                            </p>
                            <p className="text-lg text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                                <strong className="text-navy-900 dark:text-white">Consultinity changes that.</strong>{' '}
                                We've built a platform that combines the rigor of top-tier consulting
                                methodologies with the speed and accessibility of AI.
                            </p>
                            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                                The result? Strategic decisions in days, not months. At a fraction of the
                                cost. With full control staying in your hands.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="grid grid-cols-2 gap-4"
                        >
                            <StatCard number="10x" label="Faster Strategy Development" />
                            <StatCard number="80%" label="Cost Reduction vs Traditional" />
                            <StatCard number="100%" label="Human Control Maintained" />
                            <StatCard number="24/7" label="AI Partner Availability" />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Values Section */}
            <section className="py-20 px-6 bg-slate-50 dark:bg-navy-900/50">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-navy-950 dark:text-white mb-4">
                            Our Values
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                            The principles that guide everything we build
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <ValueCard
                            icon={<Target className="w-6 h-6" />}
                            title="Decisions Over Decks"
                            description="We optimize for actionable outcomes, not impressive presentations. Every feature is designed to drive real decisions."
                        />
                        <ValueCard
                            icon={<Users className="w-6 h-6" />}
                            title="Human-in-the-Loop"
                            description="AI augments human judgment, never replaces it. You maintain full control over every strategic choice."
                        />
                        <ValueCard
                            icon={<Lightbulb className="w-6 h-6" />}
                            title="Democratized Excellence"
                            description="World-class strategic frameworks should be accessible to every organization, not just Fortune 500 companies."
                        />
                    </div>
                </div>
            </section>

            {/* Team Section - Placeholder */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-navy-950 dark:text-white mb-6">
                        Built by Consultants, for Leaders
                    </h2>
                    <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
                        Consultinity is developed by {COMPANY.name}, a team of technologists and
                        strategy professionals based in {COMPANY.location}. We combine deep experience
                        in enterprise consulting with cutting-edge AI capabilities.
                    </p>

                    <div className="inline-flex items-center gap-4 px-6 py-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 
                                    border border-purple-200 dark:border-purple-500/20">
                        <Rocket className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        <div className="text-left">
                            <p className="font-semibold text-navy-900 dark:text-white">
                                Founded in {COMPANY.founded}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {COMPANY.location}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-6 bg-gradient-to-br from-purple-600 to-indigo-700">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-white mb-6">
                        Ready to Transform Your Strategy?
                    </h2>
                    <p className="text-lg text-purple-100 mb-8 max-w-2xl mx-auto">
                        Experience the future of strategic consulting. Start with a free demo
                        or begin your trial today.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => navigate('/demo')}
                            className="px-8 py-4 bg-white text-purple-600 font-semibold rounded-xl 
                                       hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                        >
                            Explore Demo
                            <ArrowRight size={18} />
                        </button>
                        <button
                            onClick={() => navigate('/trial/start')}
                            className="px-8 py-4 bg-purple-500 text-white font-semibold rounded-xl 
                                       hover:bg-purple-400 transition-colors border border-purple-400"
                        >
                            Start Free Trial
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <EntryFooter />
        </div>
    );
};

// Stat Card Component
interface StatCardProps {
    number: string;
    label: string;
}

const StatCard: React.FC<StatCardProps> = ({ number, label }) => {
    return (
        <div className="p-6 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 
                        shadow-lg text-center">
            <p className="text-3xl font-black text-purple-600 dark:text-purple-400 mb-2">{number}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        </div>
    );
};

// Value Card Component
interface ValueCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

const ValueCard: React.FC<ValueCardProps> = ({ icon, title, description }) => {
    return (
        <div className="p-8 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 
                        shadow-lg text-center">
            <div className="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center 
                            text-purple-600 dark:text-purple-400 mx-auto mb-6">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-3">{title}</h3>
            <p className="text-slate-500 dark:text-slate-400">{description}</p>
        </div>
    );
};

export default AboutView;
