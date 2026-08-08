/**
 * useDialogA11y — shared accessible-dialog behavior (CB-01).
 *
 * Extracted from the focus-trap/Escape/focus-return pattern already used by
 * Modal.tsx and NotebookLibraryContent.tsx so bespoke drawer/dialog surfaces
 * (KPITimeSeriesDrawer, ROIDetailDrawer, report/wizard overlays) can adopt
 * the same canonical contract instead of re-implementing it ad hoc:
 * Tab-trapped focus while open, Escape-to-close, and focus returned to the
 * trigger element on close.
 */
import { useCallback, useEffect, useRef } from 'react';

export interface UseDialogA11yOptions {
  /** Whether the dialog/drawer is currently open. */
  open: boolean;
  /** Called to close the dialog (Escape key). */
  onClose: () => void;
  /** Ref to the dialog/drawer container that bounds the Tab trap. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Element to focus when the dialog opens (defaults to the container). */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * Called on close ONLY when the element that had focus before the dialog
   * opened is no longer attached to the document (e.g. the host re-rendered
   * the trigger's subtree into a new DOM node while the dialog was open —
   * observed in InitiativesHub's empty-state CTA). Return a live element to
   * focus instead; return null/undefined to leave focus wherever the browser
   * puts it. Without this, focus silently falls back to <body> and keyboard
   * users lose their place.
   */
  getFallbackFocusTarget?: () => HTMLElement | null | undefined;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogA11y({
  open,
  onClose,
  containerRef,
  initialFocusRef,
  getFallbackFocusTarget,
}: UseDialogA11yOptions): void {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const getFallbackFocusTargetRef = useRef(getFallbackFocusTarget);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    getFallbackFocusTargetRef.current = getFallbackFocusTarget;
  }, [getFallbackFocusTarget]);

  const getFocusable = useCallback((): HTMLElement[] => {
    const container = containerRef.current;
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null
    );
  }, [containerRef]);

  useEffect(() => {
    if (!open) return undefined;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      const target = initialFocusRef?.current ?? getFocusable()[0] ?? containerRef.current;
      target?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      const previous = previousActiveElementRef.current;
      if (previous && document.contains(previous)) {
        previous.focus();
        return;
      }
      // The captured pre-open element is gone (its subtree was replaced
      // while the dialog was open). A live replacement — if the host
      // provided a resolver — may not exist in the DOM yet at this exact
      // instant: this cleanup runs as part of the SAME commit that closes
      // the dialog, and the host's own re-render of the trigger's region
      // (e.g. after a data effect) can land one tick later. Retry across a
      // few animation frames before giving up, so focus still lands
      // correctly without depending on cleanup/render ordering.
      let attempts = 0;
      const tryFallback = () => {
        const fallback = getFallbackFocusTargetRef.current?.();
        if (fallback) {
          fallback.focus();
          return;
        }
        attempts += 1;
        if (attempts < 5) {
          window.requestAnimationFrame(tryFallback);
        }
      };
      tryFallback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, getFocusable]);
}

export default useDialogA11y;
