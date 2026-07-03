import { motion } from 'framer-motion';
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  Mail,
  MapPin,
  Send,
  Shield,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AnnaAssistantWidget } from '../../components/Landing/AnnaAssistantWidget';
import { EntryFooter } from '../../components/Landing/EntryFooter';
import { EntryTopBar } from '../../components/Landing/EntryTopBar';
import {
  clearAnnaLpCtaContext,
  readAnnaLpCtaContext,
  updateAnnaLpCtaContext,
} from '../../services/annaLpCtaContext';
import { postPublicAnnaFunnelEvent } from '../../services/publicAnnaAnalytics';

const OFFICES = {
  usa: {
    name: 'DBR77 USA Inc.',
    address: '9319 Robert D. Snyder Road',
    city: 'Charlotte, NC 28262, USA',
    flag: '🇺🇸',
  },
  germany: {
    name: 'DBR77 GmbH',
    address: 'Kurfürstendamm 194',
    city: '10707 Berlin, Germany',
    flag: '🇩🇪',
  },
};

const EMAILS = {
  general: 'contact@dbr77.com',
  sales: 'sales@dbr77.com',
  support: 'support@dbr77.com',
};

const CALENDAR_URL =
  'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017';

type ContactType = 'general' | 'sales' | 'support' | 'partnership' | 'security' | 'press';

interface FormData {
  name: string;
  email: string;
  company: string;
  type: ContactType;
  message: string;
}

const INPUT_BASE =
  'w-full px-4 h-[48px] bg-white/[0.04] border border-white/[0.10] rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-c-focus/40 focus:border-c-accent/30 transition-all';

const INPUT_CLASS = INPUT_BASE;

const SELECT_CLASS = `${INPUT_BASE} appearance-none cursor-pointer bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat`;

export const ContactView: React.FC = () => {
  const { t, i18n } = useTranslation();
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

  useEffect(() => {
    const ctx = readAnnaLpCtaContext();
    if (!ctx || ctx.cta_type !== 'contact') return;
    if (ctx.start_recorded_at_ms) return;

    void postPublicAnnaFunnelEvent('anna_lp.cta.start', {
      session_id: ctx.session_id,
      cta_type: ctx.cta_type,
      language: ctx.language,
      channel: ctx.channel,
      turn_id: ctx.turn_id,
      source_intent: ctx.source_intent,
    });
    updateAnnaLpCtaContext({ start_recorded_at_ms: Date.now() });
  }, []);

  const contactTypes: { value: ContactType; label: string }[] = [
    { value: 'general', label: t('contact.types.general', 'General Inquiry') },
    { value: 'sales', label: t('contact.types.sales', 'Sales / Demo Request') },
    { value: 'support', label: t('contact.types.support', 'Technical Support') },
    { value: 'partnership', label: t('contact.types.partnership', 'Partnership') },
    { value: 'security', label: t('contact.types.security', 'Security & Compliance') },
    { value: 'press', label: t('contact.types.press', 'Press & Media') },
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
      const ctx = readAnnaLpCtaContext();
      if (ctx && ctx.cta_type === 'contact') {
        const nextAttempts = (ctx.submit_attempts || 0) + 1;
        void postPublicAnnaFunnelEvent('anna_lp.cta.submit_attempt', {
          session_id: ctx.session_id,
          cta_type: ctx.cta_type,
          language: ctx.language,
          channel: ctx.channel,
          turn_id: ctx.turn_id,
          source_intent: ctx.source_intent,
        });
        updateAnnaLpCtaContext({ submit_attempts: nextAttempts });
      }

      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          locale: i18n.resolvedLanguage || i18n.language || 'en',
          annaCta: ctx && ctx.cta_type === 'contact' ? ctx : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error || 'Failed to send message');
      }

      setIsSubmitted(true);

      setTimeout(() => {
        const typeLabelMap: Record<ContactType, string> = {
          general: 'general inquiry',
          sales: 'sales / demo request',
          support: 'technical support',
          partnership: 'partnership opportunity',
          security: 'security & compliance',
          press: 'press & media',
        };
        const topicLabel = typeLabelMap[formData.type] || formData.type;
        const annaPrompt = `A visitor just submitted a contact form. Their name is ${formData.name}${formData.company ? ` from ${formData.company}` : ''}. They wrote about: "${formData.message.slice(0, 200)}". The inquiry type is "${topicLabel}". Please greet them warmly, acknowledge their message, and try to help them right now with their question. If you can address their concern, do so. Otherwise, reassure them the team will follow up within 1 business day.`;

        window.dispatchEvent(new CustomEvent('anna:open', { detail: { prompt: annaPrompt } }));
      }, 1500);

      if (ctx && ctx.cta_type === 'contact') {
        void postPublicAnnaFunnelEvent('anna_lp.cta.submit_success', {
          session_id: ctx.session_id,
          cta_type: ctx.cta_type,
          language: ctx.language,
          channel: ctx.channel,
          turn_id: ctx.turn_id,
          source_intent: ctx.source_intent,
        });
        updateAnnaLpCtaContext({ submit_success_at_ms: Date.now() });
        clearAnnaLpCtaContext();
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to send message. Please try again or email us directly.';
      setError(message);

      const ctx = readAnnaLpCtaContext();
      if (ctx && ctx.cta_type === 'contact') {
        void postPublicAnnaFunnelEvent('anna_lp.cta.submit_error', {
          session_id: ctx.session_id,
          cta_type: ctx.cta_type,
          language: ctx.language,
          channel: ctx.channel,
          turn_id: ctx.turn_id,
          source_intent: ctx.source_intent,
        });
        const updated = updateAnnaLpCtaContext({ last_submit_error_at_ms: Date.now() });
        if ((updated?.submit_attempts || 0) >= 2) {
          void postPublicAnnaFunnelEvent('anna_lp.cta.fallback_used', {
            session_id: ctx.session_id,
            cta_type: ctx.cta_type,
            language: ctx.language,
            channel: ctx.channel,
            turn_id: ctx.turn_id,
            source_intent: ctx.source_intent,
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrialClick = () => navigate('/trial/start');
  const handleDemoClick = () => navigate('/demo');
  const handleContactClick = () => navigate('/contact');

  return (
    <div className="min-h-screen flex flex-col bg-[#0F172A]">
      <EntryTopBar
        onTrialClick={handleTrialClick}
        onDemoClick={handleDemoClick}
        onLoginClick={() => navigate('/login')}
        isLoggedIn={false}
        hasWorkspace={false}
      />

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#0B1220_0%,#0F172A_45%,#0B1220_100%)]" />
        <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(109,40,217,0.18)_0%,transparent_65%)] blur-[80px]" />
        <div className="absolute bottom-[-10%] right-[5%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(0,210,255,0.08)_0%,transparent_65%)] blur-[90px]" />

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-c-accent/30 bg-c-accent/10 backdrop-blur-sm text-xs font-bold text-c-accent tracking-wide mb-8">
              <Mail size={14} />
              <span>{t('contact.badge', 'Get in touch')}</span>
            </div>

            <h1
              className="font-black tracking-tight text-white leading-[1.05]"
              style={{ fontSize: 'clamp(32px, 5vw, 64px)' }}
            >
              {t('contact.hero.title1', "Let's talk about")}{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #A51C30, #D42B3D, #67e8f9)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {t('contact.hero.title2', 'your next step')}
              </span>
            </h1>

            <p className="mt-6 text-lg text-white/50 font-medium leading-relaxed max-w-2xl mx-auto">
              {t(
                'contact.hero.subtitle',
                'Whether you need a demo, want to discuss enterprise deployment, or have a question — we are here to help.'
              )}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main content */}
      <section className="relative flex-1 px-4 sm:px-6 pb-16 -mt-2">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_1.8fr] gap-8 lg:gap-12">
            {/* Left column — info */}
            <div className="space-y-6">
              {/* Offices */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-6">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/30 mb-5">
                  {t('contact.offices', 'Offices')}
                </h3>
                <div className="space-y-5">
                  {[OFFICES.usa, OFFICES.germany].map((office) => (
                    <div key={office.name} className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-c-accent/10 border border-c-accent/20 text-lg shrink-0">
                        {office.flag}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{office.name}</p>
                        <p className="text-xs text-white/40 mt-0.5">{office.address}</p>
                        <p className="text-xs text-white/40">{office.city}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Email */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-6">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/30 mb-5">
                  {t('contact.email', 'Email')}
                </h3>
                <div className="space-y-3">
                  {[
                    { label: t('contact.emailGeneral', 'General'), email: EMAILS.general },
                    { label: t('contact.emailSales', 'Sales'), email: EMAILS.sales },
                    { label: t('contact.emailSupport', 'Support'), email: EMAILS.support },
                  ].map((item) => (
                    <div key={item.email} className="flex items-center gap-3">
                      <MapPin size={12} className="text-white/20 shrink-0" />
                      <span className="text-xs text-white/40 w-16 shrink-0">{item.label}</span>
                      <a
                        href={`mailto:${item.email}`}
                        className="text-sm font-medium text-c-accent hover:text-c-accent/80 transition-colors"
                      >
                        {item.email}
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Book a call */}
              <a
                href={CALENDAR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition-all hover:bg-white/[0.04] hover:border-white/[0.12] group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                  <Calendar size={16} className="text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    {t('contact.bookDemo', 'Book a 30-min call')}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {t('contact.bookDemoSub', 'Free consultation. See Consultify in action.')}
                  </p>
                </div>
                <ArrowRight
                  size={14}
                  className="text-white/20 group-hover:text-white/40 transition-colors"
                />
              </a>

              {/* SLA */}
              <div className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
                <Clock size={14} className="text-white/20 mt-0.5 shrink-0" />
                <p className="text-xs text-white/35 leading-relaxed">
                  {t(
                    'contact.sla',
                    'We respond within 1 business day. Existing customers get faster resolution through in-app support.'
                  )}
                </p>
              </div>
            </div>

            {/* Right column — form */}
            <div>
              {isSubmitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-12 text-center"
                >
                  <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={32} className="text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-black text-white mb-3">
                    {t('contact.success.title', 'Message sent')}
                  </h2>
                  <p className="text-white/50 mb-8 max-w-md mx-auto">
                    {t(
                      'contact.success.subtitle',
                      "Thank you for reaching out. We'll get back to you within 1 business day."
                    )}
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
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #A51C30 0%, #851627 50%, #651120 100%)',
                      boxShadow: '0 0 30px -8px rgba(165,28,48,0.50)',
                    }}
                  >
                    {t('contact.success.another', 'Send another message')}
                  </button>
                </motion.div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-6 sm:p-8"
                >
                  <div className="flex items-center gap-3 mb-8">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-c-accent to-c-info text-white shadow-lg shadow-c-accent/20">
                      <Send size={18} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white">
                        {t('contact.form.title', 'Send us a message')}
                      </h2>
                      <p className="text-xs text-white/35">
                        {t('contact.form.subtitle', 'All fields marked with * are required')}
                      </p>
                    </div>
                  </div>

                  {error && (
                    <div className="mb-6 p-4 rounded-xl border border-danger-500/20 bg-danger-500/[0.08] text-danger-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-5 mb-5">
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">
                        {t('contact.form.name', 'Your Name')} *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className={INPUT_CLASS}
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">
                        {t('contact.form.email', 'Email Address')} *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className={INPUT_CLASS}
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5 mb-5">
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">
                        {t('contact.form.company', 'Company')}
                      </label>
                      <input
                        type="text"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        className={INPUT_CLASS}
                        placeholder="Company Inc."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">
                        {t('contact.form.inquiryType', 'Inquiry Type')}
                      </label>
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleChange}
                        className={SELECT_CLASS}
                        style={{
                          backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.35)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                        }}
                      >
                        {contactTypes.map((ct) => (
                          <option key={ct.value} value={ct.value}>
                            {ct.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">
                      {t('contact.form.message', 'Message')} *
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.10] rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-c-focus/40 focus:border-c-accent/30 transition-all resize-none"
                      placeholder={t('contact.form.messagePlaceholder', 'How can we help you?')}
                    />
                  </div>

                  {/* Security note */}
                  <div className="flex items-center gap-2 mb-6 text-[10px] text-white/25">
                    <Shield size={11} />
                    <span>
                      {t(
                        'contact.form.securityNote',
                        'Your data is encrypted and processed in accordance with our Privacy Policy.'
                      )}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold text-white transition-all duration-300 active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #A51C30 0%, #851627 50%, #651120 100%)',
                      boxShadow: '0 0 40px -10px rgba(165,28,48,0.60), 0 3px 16px rgba(0,0,0,0.35)',
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {t('contact.form.sending', 'Sending...')}
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        {t('contact.form.send', 'Send Message')}
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <EntryFooter />
      <AnnaAssistantWidget
        onDemoClick={handleDemoClick}
        onTrialClick={handleTrialClick}
        onContactClick={handleContactClick}
      />
    </div>
  );
};

export default ContactView;
