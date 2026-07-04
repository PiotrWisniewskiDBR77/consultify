import { ArrowRight, CheckCircle2, Handshake, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MarketingLayout } from '@/components/Landing/MarketingLayout';
import { ROUTES } from '@/routes/routeConfig';

interface ApplicationFormState {
  fullName: string;
  email: string;
  company: string;
  website: string;
  country: string;
  role: string;
  teamSize: string;
  focusArea: string;
  message: string;
}

const INITIAL_FORM: ApplicationFormState = {
  fullName: '',
  email: '',
  company: '',
  website: '',
  country: '',
  role: '',
  teamSize: '',
  focusArea: '',
  message: '',
};

export const PartnerApplicationView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState<ApplicationFormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof ApplicationFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/public/partner-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          locale: i18n.resolvedLanguage || i18n.language || 'en',
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((data as any)?.error || 'Failed to submit partner application');
      }

      setIsSubmitted(true);
      setForm(INITIAL_FORM);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to submit partner application'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden px-6 py-20">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(160deg,#0B1220,#0F172A,#0B1220)]" />
        <div className="absolute left-[10%] top-[0%] -z-10 h-80 w-80 rounded-full bg-c-accent/20 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[8%] -z-10 h-96 w-96 rounded-full bg-c-info/10 blur-[120px]" />

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="text-white">
            <div className="inline-flex items-center gap-2 rounded-full border border-c-accent/25 bg-c-accent-soft px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-c-accent">
              <Handshake size={14} />
              {t('partner.apply.badge', 'Partner qualification')}
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-tight md:text-6xl">
              {t('partner.apply.title', 'Apply to join the Consultify Partner Program')}
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
              {t(
                'partner.apply.subtitle',
                'This is a lightweight qualification step for public applicants. We review fit, business model, and rollout potential before moving you into the next onboarding stage.'
              )}
            </p>

            <div className="mt-10 space-y-4">
              {[
                'No login required for the first step',
                'Reviewed in the superadmin approval queue',
                'Built to qualify serious commercial partners quickly',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-c-border-subtle bg-white/[0.04] px-4 py-4"
                >
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-c-success" />
                  <span className="text-sm text-white/75">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-c-border-subtle bg-c-surface p-8 shadow-2xl">
            {isSubmitted ? (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-c-success/10 text-c-success">
                  <CheckCircle2 size={30} />
                </div>
                <h2 className="mt-6 text-3xl font-black text-c-text">
                  {t('partner.apply.successTitle', 'Application submitted')}
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-c-text-secondary">
                  {t(
                    'partner.apply.successBody',
                    'Your application is now in the partner review queue. We will use this information to decide whether to move you into the next onboarding step.'
                  )}
                </p>
                <a
                  href={ROUTES.BECOME_PARTNER}
                  className="mt-8 inline-flex items-center gap-2 rounded-full bg-c-accent px-6 py-3 text-sm font-black text-white transition hover:opacity-90"
                >
                  {t('partner.apply.backToProgram', 'Back to partner page')}
                  <ArrowRight size={16} />
                </a>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-c-accent-soft text-c-accent">
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-c-accent">
                      Public lead form
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-c-text">
                      Tell us how you want to grow with Consultify
                    </h2>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Full name"
                      value={form.fullName}
                      onChange={(value) => updateField('fullName', value)}
                      required
                    />
                    <Input
                      label="Business email"
                      type="email"
                      value={form.email}
                      onChange={(value) => updateField('email', value)}
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Company"
                      value={form.company}
                      onChange={(value) => updateField('company', value)}
                      required
                    />
                    <Input
                      label="Website"
                      value={form.website}
                      onChange={(value) => updateField('website', value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Country"
                      value={form.country}
                      onChange={(value) => updateField('country', value)}
                    />
                    <Input
                      label="Your role"
                      value={form.role}
                      onChange={(value) => updateField('role', value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Team size"
                      value={form.teamSize}
                      onChange={(value) => updateField('teamSize', value)}
                    />
                    <Input
                      label="Primary focus area"
                      value={form.focusArea}
                      onChange={(value) => updateField('focusArea', value)}
                    />
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-c-text-secondary">
                      Why do you want to join?
                    </span>
                    <textarea
                      value={form.message}
                      onChange={(event) => updateField('message', event.target.value)}
                      rows={5}
                      className="rounded-2xl border border-c-border bg-c-surface-raised px-4 py-3 text-sm text-c-text outline-none transition focus:border-c-focus-solid focus:bg-c-surface"
                      placeholder="Tell us about your market, clients, or rollout ambitions."
                    />
                  </label>

                  {error && (
                    <div className="rounded-2xl border border-c-danger/20 bg-c-danger/10 px-4 py-3 text-sm text-c-danger">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-c-accent px-6 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting
                      ? t('partner.apply.submitting', 'Submitting...')
                      : t('partner.apply.submit', 'Submit partner application')}
                    <ArrowRight size={16} />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

const Input: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}> = ({ label, value, onChange, type = 'text', required = false }) => (
  <label className="grid gap-2">
    <span className="text-sm font-semibold text-c-text-secondary">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      className="rounded-2xl border border-c-border bg-c-surface-raised px-4 py-3 text-sm text-c-text outline-none transition focus:border-c-focus-solid focus:bg-c-surface"
    />
  </label>
);

export default PartnerApplicationView;
