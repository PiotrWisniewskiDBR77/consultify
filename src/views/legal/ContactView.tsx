import { motion } from 'framer-motion';
import {
  Building,
  CheckCircle,
  Globe,
  Linkedin,
  Loader2,
  Mail,
  MessageSquare,
  Send,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { DemoButton } from '../../components/Landing/DemoButton';
import { EntryFooter } from '../../components/Landing/EntryFooter';
import { EntryTopBar } from '../../components/Landing/EntryTopBar';

// WhatsApp icon component
const WhatsAppIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 20,
  className,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const COMPANY = {
  name: 'DBR77 Robotics Sp. z o.o.',
  address: 'ul. Żółkiewskiego 31',
  city: '87-100 Toruń, Poland',
  email: 'contact@dbr77.com',
  salesEmail: 'sales@dbr77.com',
  supportEmail: 'support@dbr77.com',
  whatsapp: '+49 176 217 57 563',
  calendarUrl:
    'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017',
  founderLinkedIn: 'https://www.linkedin.com/in/piotrkrzysztofwisniewski/',
  website: 'https://dbr77.com',
};

type ContactType = 'general' | 'sales' | 'support' | 'partnership';

interface FormData {
  name: string;
  email: string;
  company: string;
  type: ContactType;
  message: string;
}

export const ContactView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    company: '',
    type: 'general',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contactTypes = [
    { value: 'general', label: 'General Inquiry', icon: MessageSquare },
    { value: 'sales', label: 'Sales / Demo Request', icon: Building },
    { value: 'support', label: 'Technical Support', icon: Mail },
    { value: 'partnership', label: 'Partnership', icon: Mail },
  ];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // TODO: Implement actual form submission to backend
      // For now, simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // In production, this would be:
      // await Api.submitContactForm(formData);

      setIsSubmitted(true);
    } catch (err) {
      setError('Failed to send message. Please try again or email us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
      <section className="pt-32 pb-16 px-6 bg-gradient-to-b from-purple-50 to-white dark:from-navy-900 dark:to-navy-950">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 dark:bg-purple-900/30 
                                         text-purple-600 dark:text-purple-400 text-sm font-semibold mb-6"
            >
              <Mail size={16} />
              Contact Us
            </span>

            <h1 className="text-4xl md:text-5xl font-black text-navy-950 dark:text-white mb-6 tracking-tight">
              Get in{' '}
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Touch
              </span>
            </h1>

            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Have questions about Consultinity? Want to schedule a demo? We'd love to hear from
              you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 px-6 flex-1">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-navy-950 dark:text-white mb-6">
                  Contact Information
                </h2>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building size={20} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-navy-950 dark:text-white">
                        {COMPANY.name}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">
                        {COMPANY.address}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">{COMPANY.city}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Mail size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-navy-950 dark:text-white">Email</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">
                        General:{' '}
                        <a
                          href={`mailto:${COMPANY.email}`}
                          className="text-purple-600 hover:underline"
                        >
                          {COMPANY.email}
                        </a>
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">
                        Sales:{' '}
                        <a
                          href={`mailto:${COMPANY.salesEmail}`}
                          className="text-purple-600 hover:underline"
                        >
                          {COMPANY.salesEmail}
                        </a>
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">
                        Support:{' '}
                        <a
                          href={`mailto:${COMPANY.supportEmail}`}
                          className="text-purple-600 hover:underline"
                        >
                          {COMPANY.supportEmail}
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#25D366]/10 dark:bg-[#25D366]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <WhatsAppIcon size={20} className="text-[#25D366]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-navy-950 dark:text-white">WhatsApp</h3>
                      <a
                        href={`https://wa.me/${COMPANY.whatsapp.replace(/\s+/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#25D366] hover:underline text-sm font-medium"
                      >
                        {COMPANY.whatsapp}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Globe size={20} className="text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-navy-950 dark:text-white">Web</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">
                        <a
                          href={COMPANY.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:underline"
                        >
                          dbr77.com
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#0077B5]/10 dark:bg-[#0077B5]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Linkedin size={20} className="text-[#0077B5]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-navy-950 dark:text-white">Founder</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">
                        <a
                          href={COMPANY.founderLinkedIn}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:underline"
                        >
                          Piotr Wiśniewski Ph.D.
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule Meeting CTA - Subtle & Elegant */}
              <DemoButton href={COMPANY.calendarUrl} />

              {/* Response Time */}
              <div className="p-6 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
                <h3 className="font-semibold text-navy-950 dark:text-white mb-2">Response Time</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  We typically respond to all inquiries within 24 business hours. For urgent support
                  issues, please use the chat widget or call us directly.
                </p>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              {isSubmitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 rounded-xl p-12 text-center"
                >
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-navy-950 dark:text-white mb-4">
                    Message Sent!
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300 mb-8">
                    Thank you for reaching out. We'll get back to you as soon as possible.
                  </p>
                  <button
                    onClick={() => {
                      setIsSubmitted(false);
                      setFormData({
                        name: '',
                        email: '',
                        company: '',
                        type: 'general',
                        message: '',
                      });
                    }}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors"
                  >
                    Send Another Message
                  </button>
                </motion.div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-8"
                >
                  <h2 className="text-2xl font-bold text-navy-950 dark:text-white mb-6">
                    Send us a Message
                  </h2>

                  {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-navy-950 dark:text-white mb-2">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-950 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                        placeholder="John Smith"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-navy-950 dark:text-white mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-950 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-navy-950 dark:text-white mb-2">
                        Company
                      </label>
                      <input
                        type="text"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-950 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                        placeholder="Company Inc."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-navy-950 dark:text-white mb-2">
                        Inquiry Type
                      </label>
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                      >
                        {contactTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-navy-950 dark:text-white mb-2">
                      Message *
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={6}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-950 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none"
                      placeholder="How can we help you?"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full md:w-auto px-8 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <EntryFooter />
    </div>
  );
};

export default ContactView;
