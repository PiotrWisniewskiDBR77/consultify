import { motion } from 'framer-motion';
import { ArrowRight, Building2, CheckCircle2, Globe, Lock, Shield, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MarketingLayout } from '../components/Landing/MarketingLayout';

const CAPABILITY_VISUALS = [
  { icon: Zap, color: '#7c3aed' },
  { icon: Globe, color: '#06b6d4' },
  { icon: Lock, color: '#10b981' },
  { icon: Shield, color: '#f59e0b' },
  { icon: Building2, color: '#c026d3' },
  { icon: CheckCircle2, color: '#0891b2' },
];

export const EnterprisePage: React.FC = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', company: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const capabilities = CAPABILITY_VISUALS.map((v, i) => ({
    ...v,
    title: t(`pages.enterprise.capabilities.${i}.title`),
    desc: t(`pages.enterprise.capabilities.${i}.desc`),
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="relative px-6 pt-20 pb-24 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[linear-gradient(160deg,#0D0828,#0A0A1F,#12082E)]" />
          <div
            className="absolute -top-[20%] left-[20%] w-[60%] h-[60%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 65%)',
              filter: 'blur(100px)',
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-[40%] h-[40%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 65%)',
              filter: 'blur(80px)',
            }}
          />
        </div>

        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 mb-6"
          >
            <Building2 size={12} className="text-cyan-400" />
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              {t('pages.enterprise.hero.badge', 'Enterprise')}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="font-black tracking-tight text-white mb-6"
            style={{ fontSize: 'clamp(36px, 5vw, 72px)', lineHeight: 1.05 }}
          >
            {t('pages.enterprise.hero.titleLine1', 'For serious players only.')}
            <span className="block text-white/60 font-black" style={{ fontSize: '70%' }}>
              {t(
                'pages.enterprise.hero.titleLine2',
                'Consultify as the intelligence layer of your entire organization.'
              )}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.14 }}
            className="text-lg text-white/50 max-w-2xl mx-auto mb-10"
          >
            {t(
              'pages.enterprise.hero.subtitle',
              'Not another SaaS tool. A strategic operating system that sits at the center of your org — connecting every team, every decision, every outcome.'
            )}
          </motion.p>
        </div>
      </section>

      {/* Capabilities */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-5 mb-20">
          {capabilities.map((c, idx) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.07 }}
                className="p-6 rounded-2xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${c.color}18`, border: `1px solid ${c.color}30` }}
                >
                  <Icon size={20} style={{ color: c.color }} />
                </div>
                <h3 className="text-base font-black text-white mb-2">{c.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{c.desc}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Contact form */}
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(124,58,237,0.25)',
            }}
          >
            {sent ? (
              <div className="text-center py-8">
                <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
                <h2 className="text-2xl font-black text-white mb-2">
                  {t('pages.enterprise.form.successTitle', "We'll be in touch.")}
                </h2>
                <p className="text-white/50">
                  {t(
                    'pages.enterprise.form.successMessage',
                    'Our enterprise team will reach you within 24 hours.'
                  )}
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-black text-white mb-2">
                  {t('pages.enterprise.form.title', 'Talk to our team.')}
                </h2>
                <p className="text-white/45 mb-8 text-sm">
                  {t(
                    'pages.enterprise.form.subtitle',
                    "Tell us about your organization and we'll show you exactly how Consultify fits."
                  )}
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {[
                    {
                      key: 'name',
                      placeholder: t('pages.enterprise.form.placeholderName', 'Your name'),
                      type: 'text',
                    },
                    {
                      key: 'company',
                      placeholder: t('pages.enterprise.form.placeholderCompany', 'Company name'),
                      type: 'text',
                    },
                    {
                      key: 'email',
                      placeholder: t('pages.enterprise.form.placeholderEmail', 'Work email'),
                      type: 'email',
                    },
                  ].map((field) => (
                    <input
                      key={field.key}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={form[field.key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      required
                      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                      onFocus={(e) => {
                        (e.target as HTMLInputElement).style.borderColor = 'rgba(124,58,237,0.50)';
                      }}
                      onBlur={(e) => {
                        (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.10)';
                      }}
                    />
                  ))}
                  <textarea
                    placeholder={t(
                      'pages.enterprise.form.placeholderMessage',
                      'Tell us about your challenge (optional)'
                    )}
                    rows={3}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all resize-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.10)',
                    }}
                    onFocus={(e) => {
                      (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(124,58,237,0.50)';
                    }}
                    onBlur={(e) => {
                      (e.target as HTMLTextAreaElement).style.borderColor =
                        'rgba(255,255,255,0.10)';
                    }}
                  />
                  <button
                    type="submit"
                    className="w-full py-3 rounded-full text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                      boxShadow: '0 0 30px -10px rgba(124,58,237,0.55)',
                    }}
                  >
                    {t('pages.enterprise.form.submit', 'Send message')} <ArrowRight size={14} />
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
};
