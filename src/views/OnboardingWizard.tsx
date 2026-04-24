import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CheckCircle,
  Loader2,
  Play,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import { PersonaPicker } from '@/components/Onboarding/PersonaPicker';
import { buildDefaultOnboardTelemetryProps } from '@/models/onboarding/OnboardTelemetry';
import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';
import { OnboardingRuntimeApi } from '@/services/api/v10/onboardingRuntime';
import {
  type OnboardingPersona,
  type PersonaConfidence,
  resolvePersonaFromProfile,
} from '@/services/onboarding/personaInference';
import {
  personaToRouteSlug,
  resolveFirstOnboardingSurface,
  resolvePersonaJourney,
  routeSlugToPersona,
} from '@/services/onboarding/personaJourneys';
import { isOnboardPersonaCaptureEnabled } from '@/utils/v10/onboardPersonaCaptureFlag';
import { isOnboardPersonaInferenceOverrideEnabled } from '@/utils/v10/onboardPersonaInferenceOverrideFlag';
import { isOnboardPersonaJourneyEnabled } from '@/utils/v10/onboardPersonaJourneyFlag';
import { emitOnboardTelemetryEvent } from '@/utils/v10/v10RuntimeTelemetry';

import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';
import {
  buildOnboardingWizardSnapshot,
  normalizeOnboardingPersona,
  type OnboardingWizardContext,
  restoreOnboardingWizardState,
} from './onboardingWizardRuntime';

const ONBOARDING_RUNTIME_STORAGE_KEY = 'consultify.onboardingWizard.runtime';

type RuntimeSessionState = {
  onboardingId: string;
  resumeToken: string;
  resumeExpiresAt: string | null;
  startedAt: string;
};

function secondsSinceRuntimeStart(session: RuntimeSessionState | null): number {
  if (!session?.startedAt) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000));
}

function readStoredRuntimeSession(): RuntimeSessionState | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_RUNTIME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RuntimeSessionState>;
    if (!parsed?.onboardingId || !parsed?.resumeToken) return null;
    return {
      onboardingId: String(parsed.onboardingId),
      resumeToken: String(parsed.resumeToken),
      resumeExpiresAt: parsed.resumeExpiresAt ? String(parsed.resumeExpiresAt) : null,
      startedAt: parsed.startedAt ? String(parsed.startedAt) : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeStoredRuntimeSession(session: RuntimeSessionState | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (!session) {
      window.localStorage.removeItem(ONBOARDING_RUNTIME_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(ONBOARDING_RUNTIME_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage failures
  }
}

export const OnboardingWizard = () => {
  const { setCurrentView, currentUser } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ persona?: string }>();
  const personaCaptureEnabled = isOnboardPersonaCaptureEnabled();
  const personaJourneyEnabled = isOnboardPersonaJourneyEnabled();
  const personaOverrideEnabled = isOnboardPersonaInferenceOverrideEnabled();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [runtimeSession, setRuntimeSession] = useState<RuntimeSessionState | null>(null);
  const [resumeBanner, setResumeBanner] = useState<string | null>(null);
  const [trustViewedAt, setTrustViewedAt] = useState<string | null>(null);
  const [trustAcknowledged, setTrustAcknowledged] = useState(false);
  const [trustMinReadSatisfied, setTrustMinReadSatisfied] = useState(false);
  const inferredPersonaEventSentRef = useRef(false);
  const adminConsoleSeenEventSentRef = useRef(false);
  const hydrationDoneRef = useRef(false);

  // Idempotency key (generated once per session)
  const [acceptKey] = useState(() => `accept-${uuidv4()}`);

  // Check if user is a consultant (read-only mode)
  const isConsultant = (currentUser?.role as string) === 'CONSULTANT';

  // Step 1: Context
  const [context, setContext] = useState<OnboardingWizardContext>({
    role: currentUser?.role || '',
    industry: '',
    problems: '',
    urgency: 'Normal',
    targets: '',
  });
  const initialInference = resolvePersonaFromProfile({ title: String(currentUser?.role || '') });
  const [selectedPersona, setSelectedPersona] = useState<OnboardingPersona | null>(
    personaCaptureEnabled ? initialInference.persona : null
  );
  const [personaConfidence, setPersonaConfidence] = useState<PersonaConfidence>(
    initialInference.confidence
  );
  const [personaConfirmed, setPersonaConfirmed] = useState<boolean>(!personaCaptureEnabled);
  const [adminConsoleAcknowledged, setAdminConsoleAcknowledged] = useState(false);

  // Step 3: Plan
  const [plan, setPlan] = useState<any>(null);
  const [selectedInitiativeIds, setSelectedInitiativeIds] = useState<string[]>([]);

  const resolvePersona = useCallback(
    () =>
      selectedPersona ||
      (normalizeOnboardingPersona(
        context.role || String(currentUser?.role || '')
      ) as OnboardingPersona),
    [context.role, currentUser?.role, selectedPersona]
  );
  const currentJourney = resolvePersonaJourney(resolvePersona());
  const routePersona = routeSlugToPersona(params.persona);
  const isAdminRoute = location.pathname === ROUTES.ONBOARDING_ADMIN;
  const isSeedRoute = location.pathname.startsWith(ROUTES.ONBOARDING_SEED_BASE);

  const emitOnboardingEvent = useCallback(
    async (
      eventName:
        | 'onboard.persona_inferred'
        | 'onboard.persona_confirmed'
        | 'onboard.admin_console_seen'
        | 'onboard.trust_banner_viewed'
        | 'onboard.artifact_first_draft_rendered'
        | 'onboard.artifact_approved'
        | 'onboard.artifact_saved'
        | 'onboard.activation_reached',
      overrides?: Partial<ReturnType<typeof buildDefaultOnboardTelemetryProps>>,
      sessionOverride?: RuntimeSessionState | null
    ) => {
      const session = sessionOverride || runtimeSession;
      if (!session?.onboardingId) return;
      const props = buildDefaultOnboardTelemetryProps({
        persona: resolvePersona(),
        sourceType: 'manual_context',
        trustMode: 'guardrailed',
        residencyRegion: 'unknown',
        artifactType: currentJourney.primaryArtifactType,
        approvalRequired: true,
        secondsSinceStart: secondsSinceRuntimeStart(session),
        validationStatus: 'passed',
        ...overrides,
      });
      emitOnboardTelemetryEvent(eventName, props);
      await OnboardingRuntimeApi.recordEvent({
        onboardingId: session.onboardingId,
        eventName,
        props,
      }).catch(() => undefined);
    },
    [currentJourney.primaryArtifactType, resolvePersona, runtimeSession]
  );

  const ensureRuntimeSession = useCallback(
    async (personaOverride?: {
      persona: OnboardingPersona;
      confidence: PersonaConfidence;
    }): Promise<RuntimeSessionState | null> => {
      if (runtimeSession && !personaOverride) return runtimeSession;
      try {
        const response = await OnboardingRuntimeApi.capturePersona({
          onboardingId: runtimeSession?.onboardingId,
          persona: personaOverride?.persona || resolvePersona(),
          personaConfidence: personaOverride?.confidence || personaConfidence || 'high',
          sourceType: 'manual_context',
          trustMode: 'guardrailed',
          residencyRegion: 'unknown',
          approvalRequired: true,
        });
        const nextSession: RuntimeSessionState = {
          onboardingId: response.onboardingId,
          resumeToken: response.resumeToken,
          resumeExpiresAt: response.resumeExpiresAt || null,
          startedAt: response.now,
        };
        setRuntimeSession(nextSession);
        writeStoredRuntimeSession(nextSession);
        return nextSession;
      } catch {
        return null;
      }
    },
    [personaConfidence, resolvePersona, runtimeSession]
  );

  useEffect(() => {
    let cancelled = false;
    const stored = readStoredRuntimeSession();
    if (!stored) {
      hydrationDoneRef.current = true;
      return () => {
        cancelled = true;
      };
    }
    setRuntimeSession(stored);
    void OnboardingRuntimeApi.resume({
      onboardingId: stored.onboardingId,
      resumeToken: stored.resumeToken,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.outcome !== 'resumed' || !result.snapshot) {
          writeStoredRuntimeSession(null);
          setRuntimeSession(null);
          return;
        }
        const restored = restoreOnboardingWizardState(result.snapshot, {
          role: String(currentUser?.role || ''),
          industry: '',
          problems: '',
          urgency: 'Normal',
          targets: '',
        });
        if (restored) {
          setContext(restored.context);
          setStep(restored.step);
          setPlan(restored.plan);
          setSelectedInitiativeIds(restored.selectedInitiativeIds);
          setTrustViewedAt(restored.trustViewedAt);
          setTrustAcknowledged(restored.trustAcknowledged);
          setSelectedPersona(restored.selectedPersona || initialInference.persona);
          setPersonaConfidence(restored.personaConfidence || initialInference.confidence);
          setPersonaConfirmed(restored.personaConfirmed || !personaCaptureEnabled);
          setAdminConsoleAcknowledged(Boolean(restored.adminConsoleAcknowledged));
        }
        setResumeBanner(result.deltaBanner || 'Recovered your previous onboarding progress.');
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) hydrationDoneRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [
    currentUser?.role,
    initialInference.confidence,
    initialInference.persona,
    personaCaptureEnabled,
  ]);

  useEffect(() => {
    if (!personaJourneyEnabled || !routePersona) return;
    setSelectedPersona(routePersona);
    setPersonaConfidence((prev) =>
      routePersona === initialInference.persona ? initialInference.confidence : prev || 'high'
    );
    if (isSeedRoute) {
      setPersonaConfirmed(true);
      setAdminConsoleAcknowledged(true);
    }
    if (isAdminRoute && routePersona === 'CISO') {
      setPersonaConfirmed(true);
      setAdminConsoleAcknowledged(false);
    }
  }, [
    initialInference.confidence,
    initialInference.persona,
    isAdminRoute,
    isSeedRoute,
    personaJourneyEnabled,
    routePersona,
  ]);

  useEffect(() => {
    if (!personaJourneyEnabled) return;
    const persona = resolvePersona();
    const shouldStayOnBase = !trustAcknowledged || !personaConfirmed;
    if (shouldStayOnBase) {
      if (location.pathname !== ROUTES.ONBOARDING) {
        navigate(ROUTES.ONBOARDING, { replace: true });
      }
      return;
    }

    const targetPath =
      resolveFirstOnboardingSurface(persona) === 'admin_console' && !adminConsoleAcknowledged
        ? ROUTES.ONBOARDING_ADMIN
        : `${ROUTES.ONBOARDING_SEED_BASE}/${personaToRouteSlug(persona)}`;

    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  }, [
    adminConsoleAcknowledged,
    location.pathname,
    navigate,
    personaConfirmed,
    personaJourneyEnabled,
    resolvePersona,
    trustAcknowledged,
  ]);

  useEffect(() => {
    if (!personaCaptureEnabled || !trustAcknowledged || inferredPersonaEventSentRef.current) return;
    inferredPersonaEventSentRef.current = true;
    void ensureRuntimeSession({
      persona: selectedPersona || initialInference.persona,
      confidence: personaConfidence,
    })
      .then((session) =>
        emitOnboardingEvent(
          'onboard.persona_inferred',
          {
            validationStatus: 'not_started',
          },
          session
        )
      )
      .catch(() => undefined);
  }, [
    emitOnboardingEvent,
    ensureRuntimeSession,
    initialInference.persona,
    personaCaptureEnabled,
    personaConfidence,
    selectedPersona,
    trustAcknowledged,
  ]);

  useEffect(() => {
    if (!hydrationDoneRef.current || !runtimeSession?.onboardingId) return;
    const timer = window.setTimeout(() => {
      void OnboardingRuntimeApi.saveSnapshot({
        onboardingId: runtimeSession.onboardingId,
        snapshot: buildOnboardingWizardSnapshot(
          {
            context,
            step,
            plan,
            selectedInitiativeIds,
            trustViewedAt,
            trustAcknowledged,
            selectedPersona,
            personaConfidence,
            personaConfirmed,
            adminConsoleAcknowledged,
          },
          resolvePersona()
        ),
        status: 'in_progress',
      }).catch(() => undefined);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [
    context,
    plan,
    resolvePersona,
    runtimeSession?.onboardingId,
    selectedInitiativeIds,
    step,
    trustAcknowledged,
    trustViewedAt,
    selectedPersona,
    personaConfidence,
    personaConfirmed,
    adminConsoleAcknowledged,
  ]);

  useEffect(() => {
    if (step !== 1 || trustAcknowledged) {
      setTrustMinReadSatisfied(true);
      return;
    }
    setTrustMinReadSatisfied(false);
    const timer = window.setTimeout(() => setTrustMinReadSatisfied(true), 3000);
    return () => window.clearTimeout(timer);
  }, [step, trustAcknowledged]);

  useEffect(() => {
    if (!hydrationDoneRef.current || step !== 1 || trustViewedAt || trustAcknowledged) return;
    const viewedAt = new Date().toISOString();
    setTrustViewedAt(viewedAt);
    void ensureRuntimeSession()
      .then((session) =>
        emitOnboardingEvent(
          'onboard.trust_banner_viewed',
          {
            approvalRequired: true,
            validationStatus: 'not_started',
          },
          session
        )
      )
      .catch(() => undefined);
  }, [emitOnboardingEvent, ensureRuntimeSession, step, trustAcknowledged, trustViewedAt]);

  useEffect(() => {
    const handlePageHide = () => {
      if (!runtimeSession?.onboardingId) return;
      void OnboardingRuntimeApi.saveSnapshot({
        onboardingId: runtimeSession.onboardingId,
        snapshot: buildOnboardingWizardSnapshot(
          {
            context,
            step,
            plan,
            selectedInitiativeIds,
            trustViewedAt,
            trustAcknowledged,
            selectedPersona,
            personaConfidence,
            personaConfirmed,
            adminConsoleAcknowledged,
          },
          resolvePersona()
        ),
        status: 'abandoned',
        reason: 'pagehide',
      }).catch(() => undefined);
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [
    context,
    plan,
    resolvePersona,
    runtimeSession?.onboardingId,
    selectedInitiativeIds,
    step,
    trustAcknowledged,
    trustViewedAt,
    selectedPersona,
    personaConfidence,
    personaConfirmed,
    adminConsoleAcknowledged,
  ]);

  const resumeNotice = resumeBanner ? (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      {resumeBanner}
    </div>
  ) : null;

  const handlePersonaConfirm = useCallback(async () => {
    if (!selectedPersona) return;
    const session = await ensureRuntimeSession({
      persona: selectedPersona,
      confidence: personaConfidence,
    });
    setPersonaConfirmed(true);
    setAdminConsoleAcknowledged(resolveFirstOnboardingSurface(selectedPersona) !== 'admin_console');
    setContext((prev) => ({
      ...prev,
      role: prev.role || selectedPersona,
    }));
    await emitOnboardingEvent(
      'onboard.persona_confirmed',
      {
        validationStatus: 'not_started',
      },
      session
    );
  }, [emitOnboardingEvent, ensureRuntimeSession, personaConfidence, selectedPersona]);

  const handlePersonaSwitch = useCallback(() => {
    setPersonaConfirmed(false);
    setAdminConsoleAcknowledged(false);
  }, []);

  const handleGeneratePlan = async () => {
    if (!context.role || !context.problems) {
      toast.error('Please fill in the required fields');
      return;
    }

    setLoading(true);
    try {
      const session = await ensureRuntimeSession();
      // Save context first
      await Api.saveOnboardingContext(context);

      // Advance to "Thinking" UI immediately while waiting
      setStep(2);

      // Generate Plan
      const response = await Api.generateFirstValuePlan();
      const generatedPlan = response.plan || response;
      setPlan(generatedPlan);

      // Auto-select all initiatives by ID
      if (generatedPlan.suggested_initiatives) {
        setSelectedInitiativeIds(generatedPlan.suggested_initiatives.map((i: any) => i.id));
      }

      setStep(3);
      await emitOnboardingEvent('onboard.artifact_first_draft_rendered', undefined, session);
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes('Rate limit')) {
        toast.error('Too many requests. Please wait before regenerating.');
      } else {
        toast.error('Failed to generate plan. Please try again.');
      }
      setStep(1); // Go back to edit
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptPlan = async () => {
    if (isConsultant) {
      toast.error('Consultants cannot accept plans. Contact an Admin.');
      return;
    }

    setLoading(true);
    try {
      const session = await ensureRuntimeSession();
      await Api.acceptFirstValuePlan(selectedInitiativeIds, acceptKey);
      await emitOnboardingEvent('onboard.artifact_approved', { ahaReached: true }, session);
      await emitOnboardingEvent('onboard.artifact_saved', { ahaReached: true }, session);
      await emitOnboardingEvent('onboard.activation_reached', { ahaReached: true }, session);
      if (session?.onboardingId) {
        await OnboardingRuntimeApi.saveSnapshot({
          onboardingId: session.onboardingId,
          snapshot: buildOnboardingWizardSnapshot(
            {
              context,
              step: 3,
              plan,
              selectedInitiativeIds,
              trustViewedAt,
              trustAcknowledged,
              selectedPersona,
              personaConfidence,
              personaConfirmed,
              adminConsoleAcknowledged,
            },
            resolvePersona()
          ),
          status: 'completed',
        }).catch(() => undefined);
      }
      writeStoredRuntimeSession(null);
      setRuntimeSession(null);

      toast.success('Plan Accepted! Initiatives created.');

      // Redirect to AI Chat welcome screen
      setCurrentView(AppView.AI_CHAT);
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes('already accepted')) {
        toast.error('This plan has already been accepted.');
      } else {
        toast.error('Failed to accept plan');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleInitiative = (id: string) => {
    if (selectedInitiativeIds.includes(id)) {
      setSelectedInitiativeIds(selectedInitiativeIds.filter((i) => i !== id));
    } else {
      setSelectedInitiativeIds([...selectedInitiativeIds, id]);
    }
  };

  // --- RENDER STEPS ---

  // STEP 1: CONTEXT INPUT
  if (step === 1) {
    if (!trustAcknowledged) {
      return (
        <div className="max-w-3xl mx-auto p-8 pt-16">
          {resumeNotice}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-navy-700 dark:bg-navy-800">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
              Trust-first onboarding
            </div>
            <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-3">
              Before we build your first value plan
            </h1>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              This onboarding should use your real context, keep learning off by default, and stay
              approval-aware before anything is launched.
            </p>
            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-navy-700 dark:bg-navy-900">
                Residency and processing defaults follow your organization settings.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-navy-700 dark:bg-navy-900">
                We do not substitute demo data for this onboarding flow.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-navy-700 dark:bg-navy-900">
                Generated plan proposals still require your acceptance before execution starts.
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {trustMinReadSatisfied
                  ? 'You can continue.'
                  : 'Please take a moment to review these onboarding guardrails.'}
              </p>
              <button
                onClick={() => setTrustAcknowledged(true)}
                disabled={!trustMinReadSatisfied}
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-full font-bold shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                I understand
              </button>
            </div>
          </div>
        </div>
      );
    }
    if (personaCaptureEnabled && !personaConfirmed) {
      return (
        <div className="max-w-5xl mx-auto p-8 pt-16">
          {resumeNotice}
          <PersonaPicker
            selectedPersona={selectedPersona}
            inferredPersona={initialInference.persona}
            confidence={personaConfidence}
            onSelect={(persona) => {
              setSelectedPersona(persona);
              setPersonaConfidence(
                persona === initialInference.persona ? initialInference.confidence : 'high'
              );
            }}
            onConfirm={() => {
              void handlePersonaConfirm();
            }}
          />
        </div>
      );
    }
    if (
      personaJourneyEnabled &&
      resolveFirstOnboardingSurface(resolvePersona()) === 'admin_console' &&
      !adminConsoleAcknowledged
    ) {
      return (
        <div className="max-w-4xl mx-auto p-8 pt-16">
          {resumeNotice}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-navy-700 dark:bg-navy-800">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
              Admin-first security surface
            </div>
            <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-3">
              {currentJourney.headline}
            </h1>
            <p className="text-slate-600 dark:text-slate-300 mb-6">{currentJourney.subheadline}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-navy-700 dark:bg-navy-900">
                Region of processing and retention defaults are acknowledged before generation.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-navy-700 dark:bg-navy-900">
                ACL inheritance and restricted workspace assumptions stay explicit.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-navy-700 dark:bg-navy-900">
                Primary artifact: {currentJourney.primaryArtifactType}.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-navy-700 dark:bg-navy-900">
                Review gate: {currentJourney.reviewGateLanguage}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                This surface is shown only for the CISO path before any generation UI.
              </p>
              <button
                onClick={() => {
                  setAdminConsoleAcknowledged(true);
                  if (!adminConsoleSeenEventSentRef.current) {
                    adminConsoleSeenEventSentRef.current = true;
                    void ensureRuntimeSession({
                      persona: resolvePersona(),
                      confidence: personaConfidence,
                    })
                      .then((session) =>
                        emitOnboardingEvent(
                          'onboard.admin_console_seen',
                          {
                            validationStatus: 'not_started',
                          },
                          session
                        )
                      )
                      .catch(() => undefined);
                  }
                }}
                className="rounded-full bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30"
              >
                Continue to secure seed
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-3xl mx-auto p-8 pt-16">
        {resumeNotice}
        <div className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
              {resolvePersona()}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
              {currentJourney.primaryArtifactType}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
              library: {currentJourney.libraryDestination}
            </span>
            {personaCaptureEnabled && personaOverrideEnabled && (
              <button
                onClick={handlePersonaSwitch}
                className="text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-300"
              >
                Not me - switch path
              </button>
            )}
          </div>
          <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-2">
            {personaJourneyEnabled ? currentJourney.headline : "Let's fast-track your success."}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            {personaJourneyEnabled
              ? currentJourney.subheadline
              : 'Tell us a bit about your situation, and our AI will build a custom "First Value" plan for you.'}
          </p>
        </div>

        <div className="bg-white dark:bg-navy-800 rounded-xl shadow-lg border border-slate-200 dark:border-navy-700 p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Your Role
              </label>
              <div className="relative">
                <Users
                  className="absolute left-3 top-3 text-slate-400 dark:text-slate-500"
                  size={18}
                />
                <input
                  type="text"
                  className="w-full pl-10 p-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  placeholder="e.g. Program Manager, CTO"
                  value={context.role}
                  onChange={(e) => setContext({ ...context, role: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Industry
              </label>
              <div className="relative">
                <Briefcase
                  className="absolute left-3 top-3 text-slate-400 dark:text-slate-500"
                  size={18}
                />
                <input
                  type="text"
                  className="w-full pl-10 p-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  placeholder="e.g. Fintech, Manufacturing"
                  value={context.industry}
                  onChange={(e) => setContext({ ...context, industry: e.target.value })}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Biggest Challenge Right Now
              </label>
              <div className="relative">
                <Zap
                  className="absolute left-3 top-3 text-slate-400 dark:text-slate-500"
                  size={18}
                />
                <textarea
                  className="w-full pl-10 p-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  placeholder="e.g. Deadlines are slipping, team communication is siloed..."
                  rows={3}
                  value={context.problems}
                  onChange={(e) => setContext({ ...context, problems: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Urgency Level
              </label>
              <select
                className="w-full p-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                value={context.urgency}
                onChange={(e) => setContext({ ...context, urgency: e.target.value })}
              >
                <option>Low</option>
                <option>Normal</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Key Goal (The "Win")
              </label>
              <div className="relative">
                <Target
                  className="absolute left-3 top-3 text-slate-400 dark:text-slate-500"
                  size={18}
                />
                <input
                  type="text"
                  className="w-full pl-10 p-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  placeholder="e.g. Launch in Q1, Reduce bugs by 50%"
                  value={context.targets}
                  onChange={(e) => setContext({ ...context, targets: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleGeneratePlan}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-purple-500/30 flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Play size={20} fill="currentColor" />
              )}
              {personaJourneyEnabled ? currentJourney.generateLabel : 'Generate My Strategy'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 2: THINKING LOADER
  if (step === 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8">
        <div className="w-full max-w-2xl">{resumeNotice}</div>
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-4 border-slate-200 dark:border-navy-700 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="text-purple-500" size={32} />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          {personaJourneyEnabled
            ? `Preparing your ${currentJourney.primaryArtifactType}...`
            : 'Analyzing your context...'}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 animate-pulse">
          Designing a high-impact intervention plan for {resolvePersona()} in{' '}
          {context.industry || 'your context'}...
        </p>
      </div>
    );
  }

  // STEP 3: PLAN REVIEW
  if (step === 3 && plan) {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-8 pt-8">
        {resumeNotice}
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
              {resolvePersona()}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
              review gate: {currentJourney.reviewGateLanguage}
            </span>
            {personaCaptureEnabled && personaOverrideEnabled && (
              <button
                onClick={handlePersonaSwitch}
                className="text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-300"
              >
                Switch path
              </button>
            )}
          </div>
          <div className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
            Recommended Strategy
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-navy-900 dark:text-white mb-4">
            {plan.plan_title}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            {plan.executive_summary}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Col: The Process Steps */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                  1
                </div>
                Strategic Roadmap
              </h3>
              <div className="space-y-4">
                {plan.steps?.map((step: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-navy-800 p-4 rounded-xl border border-slate-200 dark:border-navy-700 relative overflow-hidden group hover:border-blue-500/30 transition-colors"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 dark:bg-white/10 group-hover:bg-blue-500 transition-colors"></div>
                    <div className="pl-4">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-lg text-navy-900 dark:text-white">
                          {step.title}
                        </h4>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded">
                          {step.action_type}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mb-2">{step.description}</p>
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                        <Zap size={14} />
                        Value Add: {step.value_add}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Col: Actionable Initiatives */}
          <div className="space-y-6">
            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-6 border border-purple-100 dark:border-purple-500/20">
              <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold">
                  2
                </div>
                Suggested Initiatives
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Select the initiatives you want to launch immediately in the platform and save into{' '}
                {currentJourney.libraryDestination}.
              </p>

              <div className="space-y-3">
                {plan.suggested_initiatives?.map((init: any) => (
                  <div
                    key={init.id}
                    onClick={() => toggleInitiative(init.id)}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                      selectedInitiativeIds.includes(init.id)
                        ? 'bg-white dark:bg-navy-800 border-purple-500 shadow-md'
                        : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                          selectedInitiativeIds.includes(init.id)
                            ? 'bg-purple-500 border-purple-500'
                            : 'border-slate-300 dark:border-navy-700'
                        }`}
                      >
                        {selectedInitiativeIds.includes(init.id) && (
                          <CheckCircle size={12} className="text-white" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-navy-900 dark:text-white text-sm">
                          {init.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                          {init.summary}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-purple-200 dark:border-purple-500/20">
                <button
                  onClick={handleAcceptPlan}
                  disabled={loading || selectedInitiativeIds.length === 0 || isConsultant}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                  {isConsultant
                    ? 'Read-Only Mode'
                    : `Accept & start ${currentJourney.reviewGateLanguage.toLowerCase()}`}
                </button>
                <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-3">
                  {isConsultant
                    ? 'Viewing as Consultant — cannot create initiatives.'
                    : `Adds ${selectedInitiativeIds.length} initiatives to your workspace.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
