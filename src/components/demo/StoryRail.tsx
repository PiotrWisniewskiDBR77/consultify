/**
 * StoryRail — the single guided path through the demo workspace.
 *
 * Replaces the old blocking DemoWelcomeTour (persona board + 5 static slides)
 * per docs/demo/DEMO_JOURNEY_REDESIGN.md: a slim, dismissible strip that
 * navigates to REAL screens with REAL data, one line of narration per stop.
 *
 * Rules:
 *  - sales_demo: auto-opens once; ✕ dismisses forever (localStorage).
 *  - workspace_demo: never auto-opens; presenter can open it on demand.
 *  - Final stop swaps "Next" for the conversion close (book a call / trial)
 *    in sales_demo; in workspace_demo it simply finishes.
 */
import { ArrowLeft, ArrowRight, CalendarClock, Rocket, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { trackFunnelEvent } from '../../services/funnelAnalytics';
import {
  STORY_RAIL_DISMISSED_KEY,
  STORY_RAIL_STARTED_KEY,
  STORY_RAIL_STOP_KEY,
  STORY_RAIL_STOPS,
} from './storyRailStops';

const BOOK_CALL_URL =
  'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017';

interface StoryRailProps {
  isOpen: boolean;
  isSalesDemo: boolean;
  onClose: () => void;
  onStartTrial: () => void;
}

function readStoredStop(): number {
  try {
    const raw = Number(localStorage.getItem(STORY_RAIL_STOP_KEY));
    if (Number.isInteger(raw) && raw >= 0 && raw < STORY_RAIL_STOPS.length) return raw;
  } catch {
    // storage unavailable — start from the top
  }
  return 0;
}

function readStoredStarted(): boolean {
  try {
    return localStorage.getItem(STORY_RAIL_STARTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export const StoryRail: React.FC<StoryRailProps> = ({
  isOpen,
  isSalesDemo,
  onClose,
  onStartTrial,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [stopIndex, setStopIndex] = useState<number>(readStoredStop);
  const [hasStarted, setHasStarted] = useState<boolean>(readStoredStarted);
  const [isFinished, setIsFinished] = useState(false);

  const stop = STORY_RAIL_STOPS[stopIndex];
  const isLastStop = stopIndex === STORY_RAIL_STOPS.length - 1;
  const isIdeasCanvas = /^\/my-work\/ideas\/[^/]+\/workspace(?:\/|$)/.test(location.pathname);

  useEffect(() => {
    try {
      localStorage.setItem(STORY_RAIL_STOP_KEY, String(stopIndex));
    } catch {
      // non-fatal
    }
  }, [stopIndex]);

  const goToStop = useCallback(
    (index: number) => {
      const next = STORY_RAIL_STOPS[index];
      if (!next) return;
      setStopIndex(index);
      setHasStarted(true);
      try {
        localStorage.setItem(STORY_RAIL_STARTED_KEY, 'true');
      } catch {
        // non-fatal
      }
      setIsFinished(false);
      navigate(next.route);
      trackFunnelEvent('demo_story_stop_viewed', { stop: next.id, index });
    },
    [navigate]
  );

  const handleNext = useCallback(() => {
    // "Start the tour" navigates to the CURRENT stop first; only subsequent
    // clicks advance — otherwise stop 1 would never actually be visited.
    if (!hasStarted) {
      goToStop(stopIndex);
      return;
    }
    if (isLastStop) {
      setIsFinished(true);
      trackFunnelEvent('demo_story_completed', { stops: STORY_RAIL_STOPS.length });
      return;
    }
    goToStop(stopIndex + 1);
  }, [goToStop, hasStarted, isLastStop, stopIndex]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(STORY_RAIL_DISMISSED_KEY, 'true');
    } catch {
      // non-fatal
    }
    trackFunnelEvent('demo_story_dismissed', { atStop: stop?.id, finished: isFinished });
    onClose();
  }, [isFinished, onClose, stop?.id]);

  const handleBookCall = useCallback(() => {
    trackFunnelEvent('demo_cta_clicked', { location: 'story_rail_end_book_call' });
    window.open(BOOK_CALL_URL, '_blank');
  }, []);

  const handleTrial = useCallback(() => {
    trackFunnelEvent('demo_cta_clicked', { location: 'story_rail_end_trial' });
    onStartTrial();
  }, [onStartTrial]);

  if (!isOpen || !stop) return null;

  return (
    <div
      data-testid="story-rail"
      className={`fixed left-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 ${
        // Ideas owns the complete bottom canvas band (representation switcher,
        // zoom, fit, minimap). The global guided rail must yield instead of
        // guessing another offset and intercepting those controls.
        isIdeasCanvas ? 'hidden' : 'bottom-5'
      }`}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-navy-900/95">
        {isFinished ? (
          <>
            <p className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
              <span className="font-semibold">
                {t('demo.storyRail.doneTitle', "That was Atelier's transformation — end to end.")}
              </span>{' '}
              {isSalesDemo && (
                <span className="text-slate-500 dark:text-slate-400">
                  {t('demo.storyRail.doneSubtitle', 'Want this for your company?')}
                </span>
              )}
            </p>
            {isSalesDemo ? (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleBookCall}
                  className="flex items-center gap-1.5 rounded-xl bg-navy-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
                >
                  <CalendarClock size={14} />
                  {t('demo.storyRail.bookCall', 'Book 30 min')}
                </button>
                <button
                  type="button"
                  onClick={handleTrial}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  <Rocket size={14} />
                  {t('demo.storyRail.startTrial', 'Start free trial')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDismiss}
                className="shrink-0 rounded-xl bg-navy-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
              >
                {t('demo.storyRail.done', 'Done')}
              </button>
            )}
          </>
        ) : (
          <>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
              {stopIndex + 1}/{STORY_RAIL_STOPS.length}
            </span>
            <p className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
              <span className="font-semibold">{stop.title}</span>
              <span className="text-slate-500 dark:text-slate-400"> — {stop.blurb}</span>
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => goToStop(stopIndex - 1)}
                disabled={stopIndex === 0}
                aria-label={t('demo.storyRail.prev', 'Previous stop')}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:invisible dark:hover:bg-white/5 dark:hover:text-slate-300"
              >
                <ArrowLeft size={15} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 rounded-xl bg-navy-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
              >
                {!hasStarted
                  ? t('demo.storyRail.start', 'Start the tour')
                  : isLastStop
                    ? t('demo.storyRail.finish', 'Finish')
                    : t('demo.storyRail.next', 'Next')}
                <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('demo.storyRail.dismiss', 'Dismiss the tour permanently')}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-300"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

export default StoryRail;
