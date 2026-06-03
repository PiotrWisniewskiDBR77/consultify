/**
 * useFirstRunOnboarding — gate + persistence for the first-run onboarding flow
 * (X4 / decision D22).
 *
 * Persistence is two-tier:
 *  1. Server: `user_preferences.onboarding_completed` (durable, cross-device) via
 *     `Api.onboarding.markFirstRunComplete()` / `getFirstRunState()`.
 *  2. Local: `consultify_onboarding_done:{userId}` localStorage key — an instant
 *     guard so the flow never flashes on a fast reload before the server check
 *     resolves, and a graceful fallback when the preferences API is unreachable.
 *
 * The flow is shown once for a brand-new user. It can be re-launched manually
 * (e.g. from the profile menu) via `relaunch()`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import type { FirstRunRole } from './firstRunConfig';

export const doneKey = (userId: string) => `consultify_onboarding_done:${userId}`;

const readLocalDone = (userId: string): boolean => {
  try {
    return localStorage.getItem(doneKey(userId)) === 'true';
  } catch {
    return false;
  }
};

const writeLocalDone = (userId: string, value: boolean): void => {
  try {
    if (value) {
      localStorage.setItem(doneKey(userId), 'true');
    } else {
      localStorage.removeItem(doneKey(userId));
    }
  } catch {
    /* localStorage unavailable — server flag still governs */
  }
};

export interface UseFirstRunOnboardingResult {
  /** Whether the flow should currently be visible. */
  isOpen: boolean;
  /** True until the initial server/local resolution completes. */
  isChecking: boolean;
  /** Persist the chosen role (best-effort, non-blocking). */
  setRole: (role: FirstRunRole) => void;
  /** Mark the flow complete (server + local) and hide it. */
  complete: (role?: FirstRunRole | null) => Promise<void>;
  /** Re-open the flow on demand (re-launch entry point). */
  relaunch: () => void;
}

export const useFirstRunOnboarding = (): UseFirstRunOnboardingResult => {
  const userId = useAppStore((s) => s.currentUser?.id);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const resolvedForUser = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setIsChecking(true);
      setIsOpen(false);
      return;
    }

    // Never interrupt a sample/demo session with first-run onboarding.
    if (isDemoMode) {
      setIsChecking(false);
      setIsOpen(false);
      return;
    }

    // Resolve once per user id; avoids re-opening after the user dismisses it.
    if (resolvedForUser.current === userId) return;

    setIsChecking(true);

    // Instant local guard first.
    if (readLocalDone(userId)) {
      resolvedForUser.current = userId;
      setIsChecking(false);
      setIsOpen(false);
      return;
    }

    void (async () => {
      try {
        const state = await Api.onboarding.getFirstRunState();
        if (cancelled) return;
        if (state.completed) {
          writeLocalDone(userId, true);
          setIsOpen(false);
        } else {
          setIsOpen(true);
        }
      } catch {
        // On a preferences API failure we err toward NOT nagging an existing
        // user: only show the flow when we have no local record either, which
        // is the genuine first-run signal we can trust offline.
        if (!cancelled) setIsOpen(!readLocalDone(userId));
      } finally {
        if (!cancelled) {
          resolvedForUser.current = userId;
          setIsChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, isDemoMode]);

  const setRole = useCallback((role: FirstRunRole) => {
    void Api.onboarding.setFirstRunRole(role).catch(() => {
      /* best-effort — completion still records the role */
    });
  }, []);

  const complete = useCallback(
    async (role?: FirstRunRole | null) => {
      setIsOpen(false);
      if (userId) {
        writeLocalDone(userId, true);
        resolvedForUser.current = userId;
      }
      try {
        await Api.onboarding.markFirstRunComplete(role ?? undefined);
      } catch {
        /* local guard already set; server will reconcile next session */
      }
    },
    [userId]
  );

  const relaunch = useCallback(() => {
    if (userId) {
      writeLocalDone(userId, false);
      resolvedForUser.current = null;
    }
    void Api.onboarding.resetFirstRun().catch(() => {
      /* best-effort */
    });
    setIsOpen(true);
  }, [userId]);

  return { isOpen, isChecking, setRole, complete, relaunch };
};

export default useFirstRunOnboarding;
