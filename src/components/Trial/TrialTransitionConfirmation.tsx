import { AlertTriangle, ArrowRight, Brain, CheckCircle, Clock, Users } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

/**
 * TrialTransitionConfirmation — Phase C → D Gate
 *
 * ENTERPRISE SPEC COMPLIANCE:
 * - EPIC-C3: No Opt-Out by Accident
 * - Three explicit confirmations required
 * - Communicates organizational scope
 *
 * PURPOSE:
 * Prevent accidental organization creation.
 * Requires conscious acknowledgment of:
 * 1. Time commitment
 * 2. Multi-person nature
 * 3. Memory creation
 */

interface ConfirmationState {
  timeCommitment: boolean;
  teamScope: boolean;
  memoryAware: boolean;
  isSubmitting: boolean;
}

interface TrialTransitionConfirmationProps {
  onCancel?: () => void;
  onConfirm?: () => void;
}

export const TrialTransitionConfirmation: React.FC<TrialTransitionConfirmationProps> = ({
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { setCurrentView } = useAppStore();

  const [state, setState] = useState<ConfirmationState>({
    timeCommitment: false,
    teamScope: false,
    memoryAware: false,
    isSubmitting: false,
  });

  const allConfirmed = state.timeCommitment && state.teamScope && state.memoryAware;

  const handleProceed = async () => {
    if (!allConfirmed) return;

    setState((prev) => ({ ...prev, isSubmitting: true }));

    try {
      // Record consent in audit log
      await Api.post('/trial/confirm-transition', {
        confirmations: {
          timeCommitment: true,
          teamScope: true,
          memoryAware: true,
        },
        confirmedAt: new Date().toISOString(),
      });

      toast.success(
        t('trial.transition.proceedSuccess', 'Done. Let us move on to setting up the organization.')
      );

      if (onConfirm) {
        onConfirm();
      } else {
        setCurrentView(AppView.ORG_SETUP_WIZARD);
      }
    } catch (error: any) {
      toast.error(
        error.message || t('trial.transition.proceedFailed', 'The transition could not be completed')
      );
    } finally {
      setState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      setCurrentView(AppView.AI_CHAT);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-navy-900 rounded-xl max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="text-amber-600 dark:text-amber-400" size={20} />
            </div>
            <h2 className="text-xl font-bold text-navy-900 dark:text-white">
              {t('trial.transition.title', 'Before you create an organization')}
            </h2>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            {t('trial.transition.subtitle', 'Make sure you understand what this step means.')}
          </p>
        </div>

        {/* Confirmations */}
        <div className="p-6 space-y-4">
          {/* Time Commitment */}
          <label
            className={`
                        flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${
                          state.timeCommitment
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }
                    `}
          >
            <input
              type="checkbox"
              checked={state.timeCommitment}
              onChange={(e) => setState((prev) => ({ ...prev, timeCommitment: e.target.checked }))}
              className="mt-1 w-5 h-5 rounded border-slate-300 dark:border-navy-700 text-green-600 focus:ring-green-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="font-semibold text-navy-900 dark:text-white">
                  {t('trial.transition.time.title', 'I understand this takes time')}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t(
                  'trial.transition.time.body',
                  'Working with the system is not a quick fix. It takes commitment and regular work with your team.'
                )}
              </p>
            </div>
          </label>

          {/* Team Scope */}
          <label
            className={`
                        flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${
                          state.teamScope
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }
                    `}
          >
            <input
              type="checkbox"
              checked={state.teamScope}
              onChange={(e) => setState((prev) => ({ ...prev, teamScope: e.target.checked }))}
              className="mt-1 w-5 h-5 rounded border-slate-300 dark:border-navy-700 text-green-600 focus:ring-green-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Users size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="font-semibold text-navy-900 dark:text-white">
                  {t('trial.transition.team.title', 'This is a tool for teams')}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t(
                  'trial.transition.team.body',
                  'The system is designed for organizations. It is worth the most when more than one person works in it.'
                )}
              </p>
            </div>
          </label>

          {/* Memory Awareness */}
          <label
            className={`
                        flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${
                          state.memoryAware
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }
                    `}
          >
            <input
              type="checkbox"
              checked={state.memoryAware}
              onChange={(e) => setState((prev) => ({ ...prev, memoryAware: e.target.checked }))}
              className="mt-1 w-5 h-5 rounded border-slate-300 dark:border-navy-700 text-green-600 focus:ring-green-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Brain size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="font-semibold text-navy-900 dark:text-white">
                  {t('trial.transition.memory.title', 'The system will remember our work')}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t(
                  'trial.transition.memory.body',
                  'Every decision, discussion and conclusion is recorded. That creates continuity, but it also creates responsibility.'
                )}
              </p>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-between">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {t('trial.transition.back', 'Back')}
          </button>

          <button
            onClick={handleProceed}
            disabled={!allConfirmed || state.isSubmitting}
            className={`
                            flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all
                            ${
                              allConfirmed && !state.isSubmitting
                                ? 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] shadow-lg shadow-primary-500/20'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-500 cursor-not-allowed'
                            }
                        `}
          >
            {state.isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('trial.transition.inProgress', 'Continuing…')}</span>
              </>
            ) : (
              <>
                <span>{t('trial.transition.confirm', 'I understand, continue')}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>

        {/* Confirmation Status */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-center gap-2 text-sm">
            {allConfirmed ? (
              <>
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-green-600 dark:text-green-400">
                  {t('trial.transition.allConfirmed', 'All confirmations are ticked')}
                </span>
              </>
            ) : (
              <span className="text-slate-600 dark:text-slate-500">
                {t('trial.transition.remaining', '{{count}} left', {
                  count:
                    3 -
                    [state.timeCommitment, state.teamScope, state.memoryAware].filter(Boolean)
                      .length,
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialTransitionConfirmation;
