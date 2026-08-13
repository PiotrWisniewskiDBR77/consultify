/**
 * FirstRunOnboarding — polished first-run flow for new users (X4 / decision D22).
 *
 * Three steps shown once, in the user's language:
 *   1. Welcome — Teresa intro ("a consultant that talks").
 *   2. Role / primary goal — maps to an entry door (Chat, Tools, Assessment,
 *      Interview, Financial model).
 *   3. Sample vs fresh — "Explore the Atelier Toys demo" (wired to the existing
 *      `useDemo().toggleDemoMode`) or "Start fresh".
 *
 * On finish the chosen entry door is navigated to and `onboarding_completed` is
 * persisted (server + local) via {@link useFirstRunOnboarding}.
 *
 * Mounted once near the app root. It self-gates: renders nothing unless the gate
 * says a new user should see it (or it was re-launched). Re-launch is triggered
 * via `requestFirstRunRelaunch()` (see firstRunEvents).
 */
import { ArrowLeft, ArrowRight, Check, FlaskConical, Rocket, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useDemo } from '../../hooks/useDemo';
import { Button } from '../ui/primitives/Button';
import { Modal } from '../ui/primitives/Modal';
import type { FirstRunRole } from './firstRunConfig';
import { FIRST_RUN_ROLES, routeForRole } from './firstRunConfig';
import { onFirstRunRelaunch } from './firstRunEvents';
import { useFirstRunOnboarding } from './useFirstRunOnboarding';

type Step = 'welcome' | 'role' | 'sample';

const TOTAL_STEPS = 3;
const STEP_INDEX: Record<Step, number> = { welcome: 1, role: 2, sample: 3 };

export const FirstRunOnboarding: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOpen, setRole, complete, relaunch } = useFirstRunOnboarding();
  const { toggleDemoMode, isDemoLoading } = useDemo();

  const [step, setStep] = useState<Step>('welcome');
  const [selectedRole, setSelectedRole] = useState<FirstRunRole | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Reset to the first step whenever the flow (re)opens.
  useEffect(() => {
    if (isOpen) {
      setStep('welcome');
      setSelectedRole(null);
      setFinishing(false);
    }
  }, [isOpen]);

  // Allow re-launch from elsewhere (e.g. profile menu).
  useEffect(() => onFirstRunRelaunch(relaunch), [relaunch]);

  if (!isOpen) return null;

  const finishAndGo = async (route: string) => {
    if (finishing) return;
    setFinishing(true);
    await complete(selectedRole);
    navigate(route);
  };

  // D4 (P3, 2026-08-12): "Skip for now" must only dismiss the onboarding
  // modal and record that it was skipped (so it doesn't come back) — it must
  // NOT navigate. The modal is mounted as an overlay on top of whatever
  // screen the user was already on (e.g. My Work / Ideas); the previous
  // implementation called finishAndGo(DEFAULT_ENTRY_ROUTE) (the default
  // door, '/chat'), which force-navigated away and threw away that screen.
  // `complete()` already closes the modal and persists the skip (server +
  // local) synchronously before its awaited call, so simply not navigating
  // leaves the user exactly where they were, regardless of which screen
  // that was.
  const handleSkip = () => {
    if (finishing) return;
    setFinishing(true);
    void complete(selectedRole);
  };

  const handleStartFresh = () => {
    void finishAndGo(routeForRole(selectedRole));
  };

  const handleOpenDemo = async () => {
    if (finishing || isDemoLoading) return;
    setFinishing(true);
    await complete(selectedRole);
    try {
      await toggleDemoMode(true, { source: 'onboarding_first_run' });
    } finally {
      navigate(routeForRole(selectedRole));
    }
  };

  const handleRoleContinue = () => {
    if (selectedRole) setRole(selectedRole);
    setStep('sample');
  };

  const stepLabel = t('firstRun.common.stepOf', 'Step {{current}} of {{total}}', {
    current: STEP_INDEX[step],
    total: TOTAL_STEPS,
  });

  return (
    <Modal
      open={isOpen}
      onClose={handleSkip}
      size="xl"
      showCloseButton={false}
      preventOverlayClose
      blur
      className="overflow-hidden p-0"
    >
      <div className="relative">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pt-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i + 1 === STEP_INDEX[step]
                  ? 'w-8 bg-c-text'
                  : i + 1 < STEP_INDEX[step]
                    ? 'w-3 bg-c-text'
                    : 'w-3 bg-c-surface-raised'
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-center text-xs font-medium text-c-text-secondary dark:text-c-text-muted">
          {stepLabel}
        </p>

        <div className="px-8 pb-8 pt-4">
          {step === 'welcome' && (
            <WelcomeStep onStart={() => setStep('role')} onSkip={handleSkip} t={t} />
          )}

          {step === 'role' && (
            <RoleStep
              selectedRole={selectedRole}
              onSelect={setSelectedRole}
              onBack={() => setStep('welcome')}
              onContinue={handleRoleContinue}
              t={t}
            />
          )}

          {step === 'sample' && (
            <SampleStep
              onBack={() => setStep('role')}
              onOpenDemo={handleOpenDemo}
              onStartFresh={handleStartFresh}
              busy={finishing || isDemoLoading}
              t={t}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Step 1 — Welcome
// ---------------------------------------------------------------------------
interface StepCommonProps {
  t: ReturnType<typeof useTranslation>['t'];
}

const WelcomeStep: React.FC<StepCommonProps & { onStart: () => void; onSkip: () => void }> = ({
  onStart,
  onSkip,
  t,
}) => {
  const points = [
    t('firstRun.welcome.point1', 'Ask anything — Teresa replies like a senior consultant'),
    t('firstRun.welcome.point2', 'Run assessments, interviews, and financial models for rigor'),
    t('firstRun.welcome.point3', 'Everything stays in your workspace, in your language'),
  ];

  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-c-accent-soft text-c-accent dark:bg-c-accent-soft dark:text-c-accent">
        <Sparkles size={26} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-c-accent">
        {t('firstRun.welcome.eyebrow', 'Welcome to Consultify')}
      </p>
      <h1 className="mt-2 text-2xl font-bold text-c-text">
        {t('firstRun.welcome.title', 'Meet Teresa — a consultant that talks')}
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-c-text-muted">
        {t(
          'firstRun.welcome.subtitle',
          'Teresa is your AI co-thinker. Describe a decision in plain language and she structures the thinking with you.'
        )}
      </p>

      <ul className="mx-auto mt-6 max-w-md space-y-2 text-left">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-c-text-secondary">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-c-accent-soft text-c-accent dark:bg-c-accent-soft dark:text-c-accent">
              <Check size={13} />
            </span>
            {point}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button variant="brand" size="lg" iconRight={<ArrowRight size={18} />} onClick={onStart}>
          {t('firstRun.welcome.cta', 'Get started')}
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-medium text-c-text-secondary transition-colors hover:text-c-text-secondary dark:hover:text-c-text-muted"
        >
          {t('firstRun.welcome.skip', 'Skip for now')}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step 2 — Role / primary goal
// ---------------------------------------------------------------------------
const RoleStep: React.FC<
  StepCommonProps & {
    selectedRole: FirstRunRole | null;
    onSelect: (role: FirstRunRole) => void;
    onBack: () => void;
    onContinue: () => void;
  }
> = ({ selectedRole, onSelect, onBack, onContinue, t }) => (
  <div>
    <div className="mb-6 text-center">
      <h2 className="text-xl font-bold text-c-text">
        {t('firstRun.role.title', 'What brings you here?')}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-c-text-muted">
        {t(
          'firstRun.role.subtitle',
          'Pick your main goal so we can open the right door first. You can change direction anytime.'
        )}
      </p>
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {FIRST_RUN_ROLES.map((role) => {
        const Icon = role.icon;
        const isSelected = selectedRole === role.id;
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onSelect(role.id)}
            aria-pressed={isSelected}
            className={`relative flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all duration-150 ${
              isSelected
                ? 'border-c-accent bg-c-accent-soft shadow-sm dark:border-c-accent dark:bg-c-accent-soft'
                : 'border-c-border-subtle bg-c-surface hover:border-c-border-subtle dark:bg-c-surface-raised dark:hover:border-c-border-subtle'
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isSelected
                  ? 'bg-c-accent-soft text-c-accent dark:bg-c-accent-soft dark:text-c-accent'
                  : 'bg-c-surface-raised text-c-text-secondary dark:bg-c-surface dark:text-c-text-muted'
              }`}
            >
              <Icon size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-c-text">
                {t(`firstRun.role.options.${role.i18nKey}.title`, role.title)}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-c-text-muted">
                {t(`firstRun.role.options.${role.i18nKey}.description`, role.description)}
              </span>
            </span>
            {isSelected && (
              <span className="absolute right-3 top-3 text-c-accent">
                <Check size={16} />
              </span>
            )}
          </button>
        );
      })}
    </div>

    <div className="mt-7 flex items-center justify-between">
      <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={onBack}>
        {t('firstRun.role.back', 'Back')}
      </Button>
      <Button
        variant="brand"
        iconRight={<ArrowRight size={16} />}
        disabled={!selectedRole}
        onClick={onContinue}
      >
        {t('firstRun.role.continue', 'Continue')}
      </Button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Step 3 — Sample vs fresh
// ---------------------------------------------------------------------------
const SampleStep: React.FC<
  StepCommonProps & {
    onBack: () => void;
    onOpenDemo: () => void;
    onStartFresh: () => void;
    busy: boolean;
  }
> = ({ onBack, onOpenDemo, onStartFresh, busy, t }) => (
  <div>
    <div className="mb-6 text-center">
      <h2 className="text-xl font-bold text-c-text">
        {t('firstRun.sample.title', 'Start with a sample or a clean slate?')}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-c-text-muted">
        {t(
          'firstRun.sample.subtitle',
          'Not sure where to begin? Explore the Atelier Toys demo workspace — a fully populated example you can click around safely.'
        )}
      </p>
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col rounded-2xl border-2 border-c-border-subtle bg-c-surface p-5 dark:border-c-border-subtle dark:bg-c-surface-raised">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-c-accent-soft text-c-accent dark:bg-c-accent-soft dark:text-c-accent">
          <FlaskConical size={22} />
        </span>
        <h3 className="mt-4 text-sm font-semibold text-c-text">
          {t('firstRun.sample.demo.title', 'Explore the Atelier Toys demo')}
        </h3>
        <p className="mt-1 flex-1 text-xs leading-relaxed text-c-text-muted">
          {t(
            'firstRun.sample.demo.description',
            'A read-only sample workspace with realistic data so you can see Consultify in action.'
          )}
        </p>
        <Button variant="brand" fullWidth className="mt-4" loading={busy} onClick={onOpenDemo}>
          {t('firstRun.sample.demo.cta', 'Open the demo')}
        </Button>
      </div>

      <div className="flex flex-col rounded-2xl border-2 border-c-border-subtle bg-c-surface p-5 dark:border-c-border-subtle dark:bg-c-surface-raised">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-c-surface-raised text-c-text-muted dark:bg-c-surface dark:text-c-text-muted">
          <Rocket size={22} />
        </span>
        <h3 className="mt-4 text-sm font-semibold text-c-text">
          {t('firstRun.sample.fresh.title', 'Start fresh')}
        </h3>
        <p className="mt-1 flex-1 text-xs leading-relaxed text-c-text-muted">
          {t(
            'firstRun.sample.fresh.description',
            'Go straight to your own workspace and begin with your real work.'
          )}
        </p>
        <Button
          variant="secondary"
          fullWidth
          className="mt-4"
          disabled={busy}
          onClick={onStartFresh}
        >
          {t('firstRun.sample.fresh.cta', 'Start fresh')}
        </Button>
      </div>
    </div>

    <div className="mt-7 flex items-center">
      <Button variant="ghost" icon={<ArrowLeft size={16} />} disabled={busy} onClick={onBack}>
        {t('firstRun.sample.back', 'Back')}
      </Button>
    </div>
  </div>
);

export default FirstRunOnboarding;
