/**
 * Feedback Collector
 *
 * Public entry point. Call `installFeedbackCollector()` once at app bootstrap
 * and later use `buildFeedbackDossier()` inside the report dialog to produce
 * a payload ready for POST /api/feedback.
 */

import type { AppUserContext } from './AppContext';
import { installAppContext, snapshotAppContext } from './AppContext';
import type { BreadcrumbEntry } from './BreadcrumbBuffer';
import {
  addBreadcrumb,
  installBreadcrumbBuffer,
  snapshotBreadcrumbs,
} from './BreadcrumbBuffer';
import type { CaptureResult } from './captureScreenshot';
import { captureScreenshot } from './captureScreenshot';
import type { ConsoleEntry } from './ConsoleBuffer';
import { installConsoleBuffer, snapshotConsoleBuffer } from './ConsoleBuffer';
import type { NetworkEntry } from './NetworkBuffer';
import {
  installNetworkBuffer,
  snapshotNetworkBuffer,
  snapshotNetworkErrors,
} from './NetworkBuffer';
import type { SignatureInput } from './signatureHash';
import { computeSignatureHash } from './signatureHash';

export type { BreadcrumbEntry, CaptureResult, ConsoleEntry, NetworkEntry };

export interface InstallOptions {
  appEnv?: string | null;
  attachGlobalErrorHandlers?: boolean;
  onGlobalError?: (error: { message: string; stack?: string }) => void;
}

interface UncaughtErrorRecord {
  at: string;
  message: string;
  stack?: string;
  source?: string;
}

let lastUncaughtError: UncaughtErrorRecord | null = null;

let collectorReady = false;

export function installFeedbackCollector(options: InstallOptions = {}): void {
  if (collectorReady) return;
  collectorReady = true;
  installConsoleBuffer();
  installNetworkBuffer();
  installBreadcrumbBuffer();
  installAppContext({ appEnv: options.appEnv });

  if (options.attachGlobalErrorHandlers !== false && typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      const err = event.error;
      const message = (err && err.message) || event.message || 'Uncaught error';
      const stack = err && err.stack ? String(err.stack) : undefined;
      lastUncaughtError = {
        at: new Date().toISOString(),
        message: String(message).slice(0, 1000),
        stack: stack?.slice(0, 4000),
        source: event.filename,
      };
      addBreadcrumb({ kind: 'custom', label: `error: ${message}`.slice(0, 120) });
      options.onGlobalError?.({ message: String(message), stack });
    });
    window.addEventListener('unhandledrejection', (event) => {
      const reason = (event.reason && (event.reason.message || event.reason)) || 'Unhandled rejection';
      const stack = (event.reason && event.reason.stack) || undefined;
      lastUncaughtError = {
        at: new Date().toISOString(),
        message: String(reason).slice(0, 1000),
        stack: stack ? String(stack).slice(0, 4000) : undefined,
        source: 'unhandledrejection',
      };
      addBreadcrumb({ kind: 'custom', label: `rejection: ${reason}`.slice(0, 120) });
      options.onGlobalError?.({ message: String(reason), stack });
    });
  }
}

export interface FeedbackDossier {
  appContext: ReturnType<typeof snapshotAppContext>;
  consoleLogs: ConsoleEntry[];
  networkEntries: NetworkEntry[];
  networkErrors: NetworkEntry[];
  breadcrumbs: BreadcrumbEntry[];
  screenshot: CaptureResult | null;
  lastUncaughtError: UncaughtErrorRecord | null;
  signatureHash: string;
  capturedAt: string;
}

export async function buildFeedbackDossier(options: {
  user?: AppUserContext;
  includeScreenshot?: boolean;
  screenshotTarget?: HTMLElement;
  forSignature?: SignatureInput;
}): Promise<FeedbackDossier> {
  const appContext = snapshotAppContext(options.user);
  const consoleLogs = snapshotConsoleBuffer(50);
  const networkEntries = snapshotNetworkBuffer(30);
  const networkErrors = snapshotNetworkErrors(20);
  const breadcrumbs = snapshotBreadcrumbs(30);

  const screenshot = options.includeScreenshot !== false
    ? await captureScreenshot(options.screenshotTarget)
    : null;

  const topConsoleError = [...consoleLogs].reverse().find((e) => e.level === 'error');
  const signatureHash = computeSignatureHash({
    message:
      options.forSignature?.message ||
      lastUncaughtError?.message ||
      topConsoleError?.message ||
      null,
    stack: options.forSignature?.stack || lastUncaughtError?.stack || null,
    route: options.forSignature?.route || appContext.route.pathname,
  });

  return {
    appContext,
    consoleLogs,
    networkEntries,
    networkErrors,
    breadcrumbs,
    screenshot,
    lastUncaughtError,
    signatureHash,
    capturedAt: new Date().toISOString(),
  };
}

export function getLastUncaughtError() {
  return lastUncaughtError;
}

export function addFeedbackBreadcrumb(
  entry: Omit<BreadcrumbEntry, 'at'> & { at?: string }
): void {
  addBreadcrumb(entry);
}

export function isFeedbackCollectorReady(): boolean {
  return collectorReady;
}
