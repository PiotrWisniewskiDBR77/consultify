import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, MapPin, Phone, Send, Loader2, CheckCircle, Building2, MessageSquare } from 'lucide-react';
import { EntryTopBar } from '../../components/Landing/EntryTopBar';
import { EntryFooter } from '../../components/Landing/EntryFooter';

// Company data - UPDATE THESE VALUES
const COMPANY = {
    name: 'DBR77 Sp. z o.o.',
    address: '[Ulica do uzupełnienia]',
    city: '[Miasto], Polska',
    zip: '[Kod pocztowy]',
    email: {
        general: 'hello@dbr77.com',
        sales: 'sales@consultinity.com',
        support: 'support@consultinity.com',
        privacy: 'privacy@dbr77.com'
    },
    phone: '+48 XXX XXX XXX' // Optional
};

interface ContactFormData {
    name: string;
    email: string;
    company: string;
    subject: 'general' | 'sales' | 'support' | 'partnership';
    message: string;
}

export const ContactView: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [formData, setFormData] = useState<ContactFormData>({
        name: '',
        email: '',
        company: '',
        subject: 'general',
        message: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Simulate API call - replace with actual API
            await new Promise(resolve => setTimeout(resolve, 1500));

            // In production, you would send to your backend:
            // await Api.submitContactForm(formData);

            setIsSuccess(true);
            setFormData({
                name: '',
                email: '',
                company: '',
                subject: 'general',
                message: ''
            });
        } catch (err) {
            setError('Something went wrong. Please try again or email us directly.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const subjectOptions = [
        { value: 'general', label: 'General Inquiry' },
        { value: 'sales', label: 'Sales & Pricing' },
        { value: 'support', label: 'Technical Support' },
        { value: 'partnership', label: 'Partnership Opportunity' }
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

            {/* Main Content */}
            <main className="flex-1 pt-28 pb-20 px-6">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <h1 className="text-4xl md:text-5xl font-black text-navy-950 dark:text-white mb-4 tracking-tight">
                                Get in Touch
                            </h1>
                            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                                Have questions about Consultinity? We'd love to hear from you.
                                Send us a message and we'll respond as soon as possible.
                            </p>
                        </motion.div>
                    </div>

                    <div className="grid lg:grid-cols-5 gap-12">
                        {/* Contact Form */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="lg:col-span-3"
                        >
                            <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 
                                            shadow-xl p-8">
                                {isSuccess ? (
                                    <div className="text-center py-12">
                                        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 
                                                        flex items-center justify-center mx-auto mb-6">
                                            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-navy-900 dark:text-white mb-3">
                                            Message Sent!
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                                            Thank you for reaching out. We'll get back to you within 24-48 hours.
                                        </p>
                                        <button
                                            onClick={() => setIsSuccess(false)}
                                            className="text-purple-600 dark:text-purple-400 font-medium hover:underline"
                                        >
                                            Send another message
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            {/* Name */}
                                            <div>
                                                <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
                                                    Your Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    required
                                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-white/10 
                                                               bg-white dark:bg-navy-950 text-navy-900 dark:text-white
                                                               focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                                    placeholder="Jan Kowalski"
                                                />
                                            </div>

                                            {/* Email */}
                                            <div>
                                                <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
                                                    Email Address *
                                                </label>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    required
                                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-white/10 
                                                               bg-white dark:bg-navy-950 text-navy-900 dark:text-white
                                                               focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                                    placeholder="jan@company.com"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-6">
                                            {/* Company */}
                                            <div>
                                                <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
                                                    Company
                                                </label>
                                                <input
                                                    type="text"
                                                    name="company"
                                                    value={formData.company}
                                                    onChange={handleChange}
                                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-white/10 
                                                               bg-white dark:bg-navy-950 text-navy-900 dark:text-white
                                                               focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                                    placeholder="Your Company"
                                                />
                                            </div>

                                            {/* Subject */}
                                            <div>
                                                <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
                                                    Subject *
                                                </label>
                                                <select
                                                    name="subject"
                                                    value={formData.subject}
                                                    onChange={handleChange}
                                                    required
                                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-white/10 
                                                               bg-white dark:bg-navy-950 text-navy-900 dark:text-white
                                                               focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                                >
                                                    {subjectOptions.map(option => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Message */}
                                        <div>
                                            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
                                                Message *
                                            </label>
                                            <textarea
                                                name="message"
                                                value={formData.message}
                                                onChange={handleChange}
                                                required
                                                rows={6}
                                                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-white/10 
                                                           bg-white dark:bg-navy-950 text-navy-900 dark:text-white
                                                           focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all
                                                           resize-none"
                                                placeholder="How can we help you?"
                                            />
                                        </div>

                                        {/* Error */}
                                        {error && (
                                            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 
                                                            text-red-600 dark:text-red-400 text-sm">
                                                {error}
                                            </div>
                                        )}

                                        {/* Submit */}
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full px-6 py-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold 
                                                       rounded-xl transition-colors flex items-center justify-center gap-2
                                                       disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-5 h-5" />
                                                    Send Message
                                                </>
                                            )}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </motion.div>

                        {/* Contact Info */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="lg:col-span-2 space-y-6"
                        >
                            {/* Company Info Card */}
                            <div className="p-6 rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 
                                                    flex items-center justify-center">
                                        <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <h3 className="font-bold text-navy-900 dark:text-white">Company</h3>
                                </div>
                                <p className="text-slate-600 dark:text-slate-300">{COMPANY.name}</p>
                            </div>

                            {/* Address Card */}
                            <div className="p-6 rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 
                                                    flex items-center justify-center">
                                        <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <h3 className="font-bold text-navy-900 dark:text-white">Address</h3>
                                </div>
                                <p className="text-slate-600 dark:text-slate-300">
                                    {COMPANY.address}<br />
                                    {COMPANY.zip} {COMPANY.city}
                                </p>
                            </div>

                            {/* Email Card */}
                            <div className="p-6 rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 
                                                    flex items-center justify-center">
                                        <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <h3 className="font-bold text-navy-900 dark:text-white">Email</h3>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">General: </span>
                                        <a href={`mailto:${COMPANY.email.general}`}
                                            className="text-purple-600 dark:text-purple-400 hover:underline">
                                            {COMPANY.email.general}
                                        </a>
                                    </p>
                                    <p className="text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Sales: </span>
                                        <a href={`mailto:${COMPANY.email.sales}`}
                                            className="text-purple-600 dark:text-purple-400 hover:underline">
                                            {COMPANY.email.sales}
                                        </a>
                                    </p>
                                    <p className="text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Support: </span>
                                        <a href={`mailto:${COMPANY.email.support}`}
                                            className="text-purple-600 dark:text-purple-400 hover:underline">
                                            {COMPANY.email.support}
                                        </a>
                                    </p>
                                </div>
                            </div>

                            {/* Response Time */}
                            <div className="p-6 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-500/20">
                                <div className="flex items-center gap-3 mb-3">
                                    <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    <h3 className="font-bold text-navy-900 dark:text-white">Response Time</h3>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    We typically respond within <strong>24-48 hours</strong> during business days.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <EntryFooter />
        </div>
    );
};

export default ContactView;
