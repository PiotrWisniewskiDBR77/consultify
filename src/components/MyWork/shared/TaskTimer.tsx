/**
 * TaskTimer
 * Timer component for tracking time spent on tasks
 * ClickUp-style design following Golden Standard
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Pause, Play, RotateCcw, Square, Timer } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface TimeEntry {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  description?: string;
}

interface TaskTimerProps {
  taskId: string;
  taskTitle?: string;
  initialTime?: number; // in seconds
  onTimeUpdate?: (totalSeconds: number) => void;
  onTimerStart?: () => void;
  onTimerStop?: (duration: number) => void;
  compact?: boolean;
  showHistory?: boolean;
}

export const TaskTimer: React.FC<TaskTimerProps> = ({
  taskId,
  taskTitle,
  initialTime = 0,
  onTimeUpdate,
  onTimerStart,
  onTimerStop,
  compact = false,
  showHistory = true,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(initialTime);
  const [sessionTime, setSessionTime] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [showEntries, setShowEntries] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Format time as HH:MM:SS
  const formatTime = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Format duration for display
  const formatDuration = useCallback(
    (seconds: number) => {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);

      if (hrs > 0) {
        return isPolish ? `${hrs}h ${mins}min` : `${hrs}h ${mins}m`;
      }
      if (mins > 0) {
        return isPolish ? `${mins}min` : `${mins}m`;
      }
      return isPolish ? `<1min` : `<1m`;
    },
    [isPolish]
  );

  // Start timer
  const startTimer = useCallback(() => {
    if (isRunning) return;

    setIsRunning(true);
    startTimeRef.current = new Date();
    onTimerStart?.();

    intervalRef.current = setInterval(() => {
      setSessionTime((prev) => prev + 1);
      setElapsedTime((prev) => {
        const newTime = prev + 1;
        onTimeUpdate?.(newTime);
        return newTime;
      });
    }, 1000);

    toast.success(t('myWork.taskTimer.toastSuccess', '⏱️ Timer started'), { duration: 2000 });
  }, [isRunning, isPolish, onTimerStart, onTimeUpdate]);

  // Pause timer
  const pauseTimer = useCallback(() => {
    if (!isRunning) return;

    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    toast.success(t('myWork.taskTimer.toastSuccess2', '⏸️ Timer paused'), { duration: 2000 });
  }, [isRunning, isPolish]);

  // Stop timer and save entry
  const stopTimer = useCallback(() => {
    if (!startTimeRef.current) return;

    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const endTime = new Date();
    const entry: TimeEntry = {
      id: Math.random().toString(36).substr(2, 9),
      startTime: startTimeRef.current,
      endTime,
      duration: sessionTime,
    };

    setEntries((prev) => [entry, ...prev]);
    onTimerStop?.(sessionTime);

    toast.success(
      isPolish
        ? `⏱️ Zapisano ${formatDuration(sessionTime)}`
        : `⏱️ Logged ${formatDuration(sessionTime)}`,
      { duration: 3000 }
    );

    setSessionTime(0);
    startTimeRef.current = null;
  }, [sessionTime, formatDuration, isPolish, onTimerStop]);

  // Reset timer
  const resetTimer = useCallback(() => {
    if (isRunning) {
      pauseTimer();
    }
    setSessionTime(0);
    startTimeRef.current = null;

    toast.success(t('myWork.taskTimer.toastSuccess3', '🔄 Timer reset'), { duration: 2000 });
  }, [isRunning, pauseTimer, isPolish]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Compact timer (for table rows)
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={isRunning ? pauseTimer : startTimer}
          className={`
            p-1.5 rounded-lg transition-all
            ${
              isRunning
                ? 'bg-primary-500/20 text-primary-500 hover:bg-primary-500/30'
                : 'text-slate-600 hover:text-primary-500 hover:bg-primary-500/10'
            }
          `}
          title={
            isRunning ? t('myWork.taskTimer.pause', 'Pause') : t('myWork.taskTimer.start', 'Start')
          }
        >
          {isRunning ? <Pause size={14} /> : <Play size={14} />}
        </button>

        {(isRunning || sessionTime > 0) && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`
              text-xs font-mono
              ${isRunning ? 'text-primary-500' : 'text-slate-500 dark:text-slate-400'}
            `}
          >
            {formatTime(sessionTime)}
          </motion.span>
        )}

        {sessionTime > 0 && (
          <button
            onClick={stopTimer}
            className="p-1 rounded text-slate-600 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
            title={t('myWork.taskTimer.title', 'Log time')}
          >
            <Square size={12} />
          </button>
        )}
      </div>
    );
  }

  // Full timer component
  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Timer size={16} />
          <span className="text-sm font-medium">
            {t('myWork.taskTimer.timeTracking', 'Time Tracking')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('myWork.taskTimer.total', 'Total:')} {formatDuration(elapsedTime)}
          </span>
        </div>
      </div>

      {/* Timer Display */}
      <div className="flex flex-col items-center py-6">
        <motion.div
          className={`
            text-4xl font-mono font-bold
            ${isRunning ? 'text-primary-500' : 'text-slate-700 dark:text-slate-300'}
          `}
          animate={isRunning ? { scale: [1, 1.02, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          {formatTime(sessionTime)}
        </motion.div>

        {taskTitle && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center truncate max-w-full">
            {taskTitle}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {!isRunning && sessionTime === 0 && (
          <button
            onClick={startTimer}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-c-text text-c-bg font-medium hover:bg-c-text-secondary transition-colors"
          >
            <Play size={18} />
            <span>{t('myWork.taskTimer.start2', 'Start')}</span>
          </button>
        )}

        {isRunning && (
          <>
            <button
              onClick={pauseTimer}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium hover:bg-amber-500/30 transition-colors"
            >
              <Pause size={18} />
              <span>{t('myWork.taskTimer.pause2', 'Pause')}</span>
            </button>
            <button
              onClick={stopTimer}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-500/30 transition-colors"
            >
              <Square size={18} />
              <span>{t('myWork.taskTimer.log', 'Log')}</span>
            </button>
          </>
        )}

        {!isRunning && sessionTime > 0 && (
          <>
            <button
              onClick={startTimer}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-c-text text-c-bg font-medium hover:bg-c-text-secondary transition-colors"
            >
              <Play size={18} />
              <span>{t('myWork.taskTimer.resume', 'Resume')}</span>
            </button>
            <button
              onClick={stopTimer}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-500/30 transition-colors"
            >
              <Square size={18} />
              <span>{t('myWork.taskTimer.log2', 'Log')}</span>
            </button>
            <button
              onClick={resetTimer}
              className="p-2.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
              title={t('myWork.taskTimer.title2', 'Reset')}
            >
              <RotateCcw size={18} />
            </button>
          </>
        )}
      </div>

      {/* Time Entries History */}
      {showHistory && entries.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={() => setShowEntries(!showEntries)}
            className="flex items-center justify-between w-full text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <span className="flex items-center gap-2">
              <Clock size={14} />
              {t('myWork.taskTimer.history', 'History')} ({entries.length})
            </span>
            <motion.span animate={{ rotate: showEntries ? 180 : 0 }} className="text-slate-600">
              ▼
            </motion.span>
          </button>

          <AnimatePresence>
            {showEntries && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-navy-800"
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-slate-600" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {entry.startTime.toLocaleTimeString(
                            t('myWork.taskTimer.entryStartTimeToLocaleTimeString', 'en-US'),
                            {
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                          {entry.endTime && (
                            <>
                              {' → '}
                              {entry.endTime.toLocaleTimeString(
                                t('myWork.taskTimer.entryEndTimeToLocaleTimeString', 'en-US'),
                                {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )}
                            </>
                          )}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {formatDuration(entry.duration)}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default TaskTimer;
