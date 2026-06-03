/**
 * AddRemoveSeats - Add/remove seats with prorated billing component
 *
 * Features:
 * - Seat quantity adjustment
 * - Prorated cost preview
 * - Billing cycle information
 * - Confirmation dialog
 *
 * Design: Modal dialog with quantity picker and cost breakdown
 */

import {
  AlertCircle,
  Calculator,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  DollarSign,
  HelpCircle,
  Info,
  Loader2,
  Minus,
  Plus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Modal } from '../../ui/primitives/Modal';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Seat plan info
export interface SeatPlan {
  id: string;
  name: string;
  currentSeats: number;
  usedSeats: number;
  pricePerSeat: number;
  billingCycle: 'monthly' | 'annual';
  nextBillingDate: string;
  daysRemaining: number;
}

// Prorate calculation
export interface ProrateCalculation {
  daysRemaining: number;
  totalDays: number;
  dailyRate: number;
  proratedAmount: number;
  newMonthlyTotal: number;
  effectiveDate: string;
}

interface AddRemoveSeatsProps {
  isOpen: boolean;
  onClose: () => void;
  plan: SeatPlan;
  mode: 'add' | 'remove';
  onConfirm: (quantity: number) => Promise<void>;
  calculateProrate: (quantity: number) => ProrateCalculation;
  className?: string;
}

export const AddRemoveSeats: React.FC<AddRemoveSeatsProps> = ({
  isOpen,
  onClose,
  plan,
  mode,
  onConfirm,
  calculateProrate,
  className,
}) => {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate prorate for current quantity
  const prorate = useMemo(() => {
    return calculateProrate(quantity);
  }, [quantity, calculateProrate]);

  // Max removable seats
  const maxRemovable = plan.currentSeats - plan.usedSeats;

  // Adjust quantity
  const adjustQuantity = useCallback(
    (delta: number) => {
      setQuantity((prev) => {
        const newValue = prev + delta;
        if (mode === 'add') {
          return Math.max(1, newValue);
        } else {
          return Math.max(1, Math.min(maxRemovable, newValue));
        }
      });
    },
    [mode, maxRemovable]
  );

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await onConfirm(quantity);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  }, [quantity, onConfirm, onClose]);

  // Calculate new totals
  const newTotal = mode === 'add' ? plan.currentSeats + quantity : plan.currentSeats - quantity;
  const availableAfter = newTotal - plan.usedSeats;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={
        mode === 'add'
          ? t('admin.billing.seats.addSeats', 'Add Seats')
          : t('admin.billing.seats.removeSeats', 'Remove Seats')
      }
      className={cn('max-w-md', className)}
    >
      <div className="space-y-6">
        {/* Current Plan Info */}
        <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.billing.seats.currentPlan', 'Current Plan')}
            </span>
            <span className="font-medium text-navy-900 dark:text-white">{plan.name}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.billing.seats.currentSeats', 'Current Seats')}
            </span>
            <span className="font-medium text-navy-900 dark:text-white">
              {plan.usedSeats} / {plan.currentSeats}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.billing.seats.pricePerSeat', 'Price per seat')}
            </span>
            <span className="font-medium text-navy-900 dark:text-white">
              ${plan.pricePerSeat}/{plan.billingCycle === 'monthly' ? 'mo' : 'yr'}
            </span>
          </div>
        </div>

        {/* Quantity Selector */}
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
            {mode === 'add'
              ? t('admin.billing.seats.seatsToAdd', 'Seats to add')
              : t('admin.billing.seats.seatsToRemove', 'Seats to remove')}
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => adjustQuantity(-1)}
              disabled={quantity <= 1}
              className="w-10 h-10 rounded-lg border border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700 disabled:opacity-50"
            >
              <Minus size={18} />
            </button>
            <input
              type="number"
              min="1"
              max={mode === 'remove' ? maxRemovable : undefined}
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                if (mode === 'remove') {
                  setQuantity(Math.max(1, Math.min(maxRemovable, val)));
                } else {
                  setQuantity(Math.max(1, val));
                }
              }}
              className="w-24 px-4 py-2 text-center text-xl font-bold bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
            />
            <button
              onClick={() => adjustQuantity(1)}
              disabled={mode === 'remove' && quantity >= maxRemovable}
              className="w-10 h-10 rounded-lg border border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700 disabled:opacity-50"
            >
              <Plus size={18} />
            </button>
          </div>
          {mode === 'remove' && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {t('admin.billing.seats.maxRemovable', 'Maximum removable: {{count}}', {
                count: maxRemovable,
              })}
            </p>
          )}
        </div>

        {/* After Change Preview */}
        <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-lg">
          <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
            {t('admin.billing.seats.afterChange', 'After this change')}
            {mode === 'add' ? (
              <TrendingUp size={14} className="text-emerald-500" />
            ) : (
              <TrendingDown size={14} className="text-amber-500" />
            )}
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('admin.billing.seats.totalSeats', 'Total seats')}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-500">{plan.currentSeats}</span>
                <span className="text-slate-600 dark:text-slate-500">→</span>
                <span
                  className={cn(
                    'font-medium',
                    mode === 'add'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  )}
                >
                  {newTotal}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('admin.billing.seats.availableSeats', 'Available seats')}
              </span>
              <span className="font-medium text-navy-900 dark:text-white">{availableAfter}</span>
            </div>
          </div>
        </div>

        {/* Prorate Calculation */}
        <div
          className={cn(
            'p-4 rounded-lg border',
            mode === 'add'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            <Calculator
              size={18}
              className={
                mode === 'add'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }
            />
            <h4
              className={cn(
                'font-medium',
                mode === 'add'
                  ? 'text-emerald-800 dark:text-emerald-200'
                  : 'text-amber-800 dark:text-amber-200'
              )}
            >
              {mode === 'add'
                ? t('admin.billing.seats.proratedCharge', 'Prorated charge')
                : t('admin.billing.seats.proratedCredit', 'Prorated credit')}
            </h4>
            <Tooltip
              content={t(
                'admin.billing.seats.prorateExplanation',
                'Calculated based on {{days}} days remaining in your billing cycle',
                { days: prorate.daysRemaining }
              )}
            >
              <HelpCircle size={14} className="text-slate-600 dark:text-slate-500" />
            </Tooltip>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span
                className={
                  mode === 'add'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-amber-700 dark:text-amber-300'
                }
              >
                {t('admin.billing.seats.daysRemaining', 'Days remaining')}
              </span>
              <span
                className={
                  mode === 'add'
                    ? 'text-emerald-800 dark:text-emerald-200'
                    : 'text-amber-800 dark:text-amber-200'
                }
              >
                {prorate.daysRemaining} / {prorate.totalDays}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span
                className={
                  mode === 'add'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-amber-700 dark:text-amber-300'
                }
              >
                {t('admin.billing.seats.dailyRate', 'Daily rate per seat')}
              </span>
              <span
                className={
                  mode === 'add'
                    ? 'text-emerald-800 dark:text-emerald-200'
                    : 'text-amber-800 dark:text-amber-200'
                }
              >
                ${prorate.dailyRate.toFixed(2)}
              </span>
            </div>
            <div className="pt-2 mt-2 border-t border-current/20">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'font-medium',
                    mode === 'add'
                      ? 'text-emerald-800 dark:text-emerald-200'
                      : 'text-amber-800 dark:text-amber-200'
                  )}
                >
                  {mode === 'add'
                    ? t('admin.billing.seats.chargeNow', 'Charge now')
                    : t('admin.billing.seats.creditNow', 'Credit now')}
                </span>
                <span
                  className={cn(
                    'text-xl font-bold',
                    mode === 'add'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-amber-700 dark:text-amber-300'
                  )}
                >
                  ${prorate.proratedAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* New Monthly Total */}
        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-primary-800 dark:text-primary-200">
                {t('admin.billing.seats.newMonthlyTotal', 'New monthly total')}
              </p>
              <p className="text-xs text-primary-600 dark:text-primary-400">
                {t('admin.billing.seats.startingNext', 'Starting next billing cycle')}
              </p>
            </div>
            <span className="text-2xl font-bold text-primary-700 dark:text-primary-300">
              ${prorate.newMonthlyTotal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Next Billing Date */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Calendar size={14} />
          <span>
            {t('admin.billing.seats.nextBilling', 'Next billing: {{date}}', {
              date: new Date(plan.nextBillingDate).toLocaleDateString(),
            })}
          </span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 dark:text-rose-400" />
            <span className="text-sm text-rose-700 dark:text-rose-300">{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-navy-700">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || (mode === 'remove' && quantity > maxRemovable)}
            icon={
              isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />
            }
            className={mode === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : undefined}
          >
            {isProcessing
              ? t('common.processing', 'Processing...')
              : mode === 'add'
                ? t('admin.billing.seats.confirmAdd', 'Add {{count}} Seats', {
                    count: quantity,
                  })
                : t('admin.billing.seats.confirmRemove', 'Remove {{count}} Seats', {
                    count: quantity,
                  })}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AddRemoveSeats;
