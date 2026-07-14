/**
 * M16/2.2 — Link Initiative to Finance modal ("Powiąż" — closes the Unlinked gap).
 *
 * Allows a finance user to attach any initiative to a finance entity (model,
 * analysis, valuation, etc.) by writing a row to v8_initiative_economics_linkages.
 * POST /api/initiatives/:initiativeId/economics-links
 */
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

interface LinkInitiativeModalProps {
  /** Pre-filled finance entity ref (model id, analysis id, etc.) */
  financeRef?: string;
  onClose: () => void;
  onLinked?: () => void;
}

const LINKAGE_TYPES = [
  'financial_model',
  'budget',
  'analysis',
  'valuation',
  'investment_case',
] as const;

export const LinkInitiativeModal: React.FC<LinkInitiativeModalProps> = ({
  financeRef = '',
  onClose,
  onLinked,
}) => {
  const { t } = useTranslation();
  const [initiativeId, setInitiativeId] = useState('');
  const [modelRef, setModelRef] = useState(financeRef);
  const [linkageType, setLinkageType] = useState<(typeof LINKAGE_TYPES)[number]>('financial_model');
  const [saving, setSaving] = useState(false);
  const initiativeInputRef = useRef<HTMLInputElement>(null);

  const handleLink = useCallback(async () => {
    const iId = initiativeId.trim();
    const ref = modelRef.trim();
    if (!iId || !ref) {
      toast.error(t('finance.link.missingFields', 'Initiative ID and Finance ref are required'));
      return;
    }
    setSaving(true);
    try {
      await Api.post(`/initiatives/${encodeURIComponent(iId)}/economics-links`, {
        financeModelRef: ref,
        linkageType,
        status: 'not_started',
      });
      toast.success(t('finance.link.success', 'Initiative linked to finance'));
      onLinked?.();
      onClose();
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        t('finance.link.failed', 'Linking failed — check initiative ID');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [initiativeId, linkageType, modelRef, onClose, onLinked, t]);

  return (
    <div className="fixed inset-0 z-overlay bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('finance.link.title', 'Link initiative to finance')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t(
            'finance.link.hint',
            'Attach an initiative to this finance entity so its economics appear in Results and the value pipeline.'
          )}
        </p>

        <div>
          <label className="text-xs text-slate-500">
            {t('finance.link.initiativeId', 'Initiative ID')}
          </label>
          <input
            ref={initiativeInputRef}
            value={initiativeId}
            onChange={(e) => setInitiativeId(e.target.value)}
            placeholder="e.g. 42 or uuid"
            autoFocus
            className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
          />
        </div>

        <div>
          <label className="text-xs text-slate-500">
            {t('finance.link.financeRef', 'Finance entity ref (model / analysis ID)')}
          </label>
          <input
            value={modelRef}
            onChange={(e) => setModelRef(e.target.value)}
            placeholder="e.g. model-uuid"
            className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
          />
        </div>

        <div>
          <label className="text-xs text-slate-500">{t('finance.link.type', 'Link type')}</label>
          <select
            value={linkageType}
            onChange={(e) => setLinkageType(e.target.value as (typeof LINKAGE_TYPES)[number])}
            className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
          >
            {LINKAGE_TYPES.map((lt) => (
              <option key={lt} value={lt}>
                {lt.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleLink}
            disabled={!initiativeId.trim() || !modelRef.trim() || saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? t('common.saving', 'Saving…') : t('finance.link.cta', 'Link initiative')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkInitiativeModal;
