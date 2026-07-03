/**
 * PartnerCodeInput - Admin Component for Partner Code Management
 *
 * Allows organization admins to:
 * - Enter a partner referral code
 * - View current partner attribution
 * - See discount information
 * - Remove partner attribution
 *
 * Used in Billing Settings page
 */

import {
  AlertTriangle,
  Check,
  ExternalLink,
  Percent,
  Shield,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { cn } from '../../utils/cn';

interface PartnerAttribution {
  id: string;
  partnerOrgId: string;
  partnerName: string;
  partnerEmail?: string;
  referralCode: string;
  attributionType: string;
  discountPercent?: number;
  discountMonths?: number;
  discountExpiresAt?: string;
  attributedAt: string;
  status: string;
}

interface PartnerCodeInputProps {
  className?: string;
}

export const PartnerCodeInput: React.FC<PartnerCodeInputProps> = ({ className }) => {
  const { t } = useTranslation();
  const [partnerCode, setPartnerCode] = useState('');
  const [attribution, setAttribution] = useState<PartnerAttribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    partnerName?: string;
    message?: string;
  } | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // Fetch current partner attribution
  const fetchAttribution = useCallback(async () => {
    try {
      setLoading(true);
      const response = await Api.get('/api/organization/partner-attribution');
      if (response?.data?.success && response?.data?.data) {
        setAttribution(response.data.data);
      } else {
        setAttribution(null);
      }
    } catch (err: any) {
      console.error('Error fetching partner attribution:', err);
      setAttribution(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttribution();
  }, [fetchAttribution]);

  // Validate partner code
  const handleValidateCode = useCallback(async () => {
    if (!partnerCode.trim()) {
      setValidationResult(null);
      return;
    }

    try {
      setValidating(true);
      const response = await Api.get(`/api/public/partner/validate-code/${partnerCode.trim()}`);
      if (response?.data?.valid) {
        setValidationResult({
          valid: true,
          partnerName: response.data.partnerName,
        });
      } else {
        setValidationResult({
          valid: false,
          message: response?.data?.error || t('admin.billing.invalidCode', 'Invalid partner code'),
        });
      }
    } catch (err: any) {
      setValidationResult({
        valid: false,
        message:
          err?.response?.data?.error ||
          t('admin.billing.validateFailed', 'Failed to validate code'),
      });
    } finally {
      setValidating(false);
    }
  }, [partnerCode, t]);

  // Debounced validation
  useEffect(() => {
    if (!partnerCode.trim()) {
      setValidationResult(null);
      return;
    }

    const timer = setTimeout(() => {
      handleValidateCode();
    }, 500);

    return () => clearTimeout(timer);
  }, [partnerCode, handleValidateCode]);

  // Apply partner code
  const handleApplyCode = useCallback(async () => {
    if (!partnerCode.trim() || !validationResult?.valid) {
      toast.error(t('admin.billing.enterValidCode', 'Please enter a valid partner code'));
      return;
    }

    try {
      setApplying(true);
      const response = await Api.post('/api/organization/partner-code', {
        partnerCode: partnerCode.trim(),
      });

      if (response?.data?.success) {
        toast.success(t('admin.billing.codeApplied', 'Partner code applied successfully!'));
        setPartnerCode('');
        setValidationResult(null);
        await fetchAttribution();
      } else {
        toast.error(
          response?.data?.error || t('admin.billing.applyFailed', 'Failed to apply code')
        );
      }
    } catch (err: any) {
      console.error('Error applying partner code:', err);
      toast.error(
        err?.response?.data?.error || t('admin.billing.applyFailed', 'Failed to apply code')
      );
    } finally {
      setApplying(false);
    }
  }, [partnerCode, validationResult, t, fetchAttribution]);

  // Remove partner code
  const handleRemoveCode = useCallback(async () => {
    try {
      setRemoving(true);
      const response = await Api.delete('/api/organization/partner-code');

      if (response?.data?.success) {
        toast.success(t('admin.billing.codeRemoved', 'Partner attribution removed'));
        setShowRemoveConfirm(false);
        await fetchAttribution();
      } else {
        toast.error(response?.data?.error || t('admin.billing.removeFailed', 'Failed to remove'));
      }
    } catch (err: any) {
      console.error('Error removing partner code:', err);
      toast.error(
        err?.response?.data?.error || t('admin.billing.removeFailed', 'Failed to remove')
      );
    } finally {
      setRemoving(false);
    }
  }, [t, fetchAttribution]);

  if (loading) {
    return (
      <div
        className={cn(
          'bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6',
          className
        )}
      >
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6',
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
          <UserCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h3 className="font-semibold text-navy-900 dark:text-white">
            {t('admin.billing.partnerCode', 'Partner & Referral')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('admin.billing.partnerCodeDesc', 'Enter a partner code to receive special benefits')}
          </p>
        </div>
      </div>

      {/* Current Attribution */}
      {attribution ? (
        <div className="space-y-4">
          {/* Partner Info Card */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
                  <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-emerald-800 dark:text-emerald-300">
                    {t('admin.billing.partnerApplied', 'Partner Applied')}
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {attribution.partnerName}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                    {t('admin.billing.code', 'Code')}: {attribution.referralCode}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRemoveConfirm(true)}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-danger-500 transition-colors"
                title={t('admin.billing.removePartner', 'Remove partner')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Discount Info */}
            {attribution.discountPercent && attribution.discountPercent > 0 && (
              <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-500/30">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <Percent className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {attribution.discountPercent}% {t('admin.billing.discount', 'discount')}
                    {attribution.discountMonths && (
                      <span className="font-normal">
                        {' '}
                        {t('admin.billing.for', 'for')} {attribution.discountMonths}{' '}
                        {t('admin.billing.months', 'months')}
                      </span>
                    )}
                  </span>
                </div>
                {attribution.discountExpiresAt && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                    {t('admin.billing.expiresOn', 'Expires')}:{' '}
                    {new Date(attribution.discountExpiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {/* Account Manager Contact */}
            {attribution.partnerEmail && (
              <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-500/30">
                <p className="text-xs text-emerald-600 dark:text-emerald-500">
                  {t('admin.billing.accountManager', 'Your Account Manager')}:
                </p>
                <a
                  href={`mailto:${attribution.partnerEmail}`}
                  className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  {attribution.partnerEmail}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Remove Confirmation */}
          {showRemoveConfirm && (
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-danger-800 dark:text-danger-300">
                    {t('admin.billing.confirmRemove', 'Remove Partner Attribution?')}
                  </p>
                  <p className="text-sm text-danger-700 dark:text-danger-400 mt-1">
                    {t(
                      'admin.billing.removeWarning',
                      'This will remove any associated discounts. This action cannot be undone.'
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleRemoveCode}
                      disabled={removing}
                      className="px-3 py-1.5 bg-danger-600 hover:bg-danger-500 disabled:bg-danger-600/50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      {removing && (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      )}
                      <Trash2 className="w-4 h-4" />
                      {t('admin.billing.confirmRemoveBtn', 'Yes, Remove')}
                    </button>
                    <button
                      onClick={() => setShowRemoveConfirm(false)}
                      className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-sm"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* No Attribution - Show Input */
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('admin.billing.enterCode', 'Partner Code')}
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                  placeholder={t('admin.billing.codePlaceholder', 'e.g., PARTNER-ABC123')}
                  className={cn(
                    'w-full px-4 py-2.5 rounded-lg border text-navy-900 dark:text-white bg-white dark:bg-navy-900',
                    'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                    validationResult?.valid === true && 'border-emerald-500',
                    validationResult?.valid === false && 'border-danger-500',
                    !validationResult && 'border-slate-200 dark:border-navy-700'
                  )}
                />
                {validating && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!validating && validationResult?.valid && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                )}
                {!validating && validationResult?.valid === false && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-5 h-5 text-danger-500" />
                  </div>
                )}
              </div>
              <button
                onClick={handleApplyCode}
                disabled={applying || !validationResult?.valid}
                className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:bg-c-text text-c-bg/50 disabled:cursor-not-allowed rounded-lg text-sm font-medium flex items-center gap-2"
              >
                {applying && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {t('admin.billing.applyCode', 'Apply Code')}
              </button>
            </div>

            {/* Validation Message */}
            {validationResult && (
              <p
                className={cn(
                  'text-sm mt-2',
                  validationResult.valid
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-danger-600 dark:text-danger-400'
                )}
              >
                {validationResult.valid
                  ? t('admin.billing.validCode', 'Valid code from {{partner}}', {
                      partner: validationResult.partnerName,
                    })
                  : validationResult.message}
              </p>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <p>
                  {t(
                    'admin.billing.codeInfo',
                    'If you were referred by a Consultify partner, enter their code to receive special benefits and discounts.'
                  )}
                </p>
                <p className="mt-2">
                  {t(
                    'admin.billing.codeInfoNote',
                    'Partner codes can be applied at any time and are typically valid for 12 months of discounts.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerCodeInput;
