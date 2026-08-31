/**
 * TaxSettingsForm - VAT/Tax ID and billing address configuration
 */

import {
  AlertCircle,
  Building2,
  Check,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Receipt,
  Save,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface TaxSettings {
  tax_id: string | null;
  tax_id_type: string | null;
  tax_exempt: number;
  billing_name: string | null;
  billing_email: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
  invoice_prefix: string | null;
  po_number: string | null;
}

const TAX_ID_TYPES = [
  { value: 'eu_vat', label: 'EU VAT Number' },
  { value: 'gb_vat', label: 'UK VAT Number' },
  { value: 'us_ein', label: 'US EIN' },
  { value: 'au_abn', label: 'Australian ABN' },
  { value: 'br_cnpj', label: 'Brazilian CNPJ' },
  { value: 'ca_bn', label: 'Canadian BN' },
  { value: 'ch_vat', label: 'Swiss VAT' },
  { value: 'in_gst', label: 'Indian GST' },
  { value: 'jp_cn', label: 'Japanese CN' },
  { value: 'kr_brn', label: 'Korean BRN' },
  { value: 'mx_rfc', label: 'Mexican RFC' },
  { value: 'nz_gst', label: 'New Zealand GST' },
  { value: 'sg_uen', label: 'Singapore UEN' },
  { value: 'other', label: 'Other' },
];

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'PL', name: 'Poland' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'IN', name: 'India' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
];

interface TaxSettingsFormProps {
  onSave?: () => void;
}

export const TaxSettingsForm: React.FC<TaxSettingsFormProps> = ({ onSave }) => {
  const { t, i18n } = useTranslation();
  const regionNames = new Intl.DisplayNames(i18n.language || 'pl', { type: 'region' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TaxSettings>({
    tax_id: null,
    tax_id_type: null,
    tax_exempt: 0,
    billing_name: null,
    billing_email: null,
    billing_address_line1: null,
    billing_address_line2: null,
    billing_city: null,
    billing_state: null,
    billing_postal_code: null,
    billing_country: null,
    invoice_prefix: null,
    po_number: null,
  });

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getTaxSettings();
      if (data.taxSettings) {
        setSettings(data.taxSettings);
      }
    } catch (error) {
      console.error('Failed to fetch tax settings:', error);
      toast.error(t('billing.tax.fetchError', 'Failed to load tax settings'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (field: keyof TaxSettings, value: string | number | null) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value === '' ? null : value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Api.updateTaxSettings(settings);
      toast.success(t('billing.tax.saved', 'Tax settings saved'));
      onSave?.();
    } catch (error) {
      console.error('Failed to save tax settings:', error);
      toast.error(t('billing.tax.saveError', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary-500" />
          {t('billing.tax.title', 'Tax & Invoice Settings')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t(
            'billing.tax.description',
            'Configure your tax ID and billing information for invoices'
          )}
        </p>
      </div>

      {/* Tax ID Section */}
      <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-navy-700 space-y-4">
        <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          {t('billing.tax.taxId', 'Tax ID / VAT Number')}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('billing.tax.taxIdType', 'Tax ID Type')}
            </label>
            <select
              value={settings.tax_id_type || ''}
              onChange={(e) => handleChange('tax_id_type', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">{t('billing.tax.selectType', 'Select type...')}</option>
              {TAX_ID_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {t(`billing.tax.idType.${type.value}`, type.label)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('billing.tax.taxIdNumber', 'Tax ID Number')}
            </label>
            <input
              type="text"
              value={settings.tax_id || ''}
              onChange={(e) => handleChange('tax_id', e.target.value)}
              placeholder={t('billing.tax.taxIdPlaceholder', 'np. PL1234567890')}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tax Exempt Toggle */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('billing.tax.taxExempt', 'Tax Exempt')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('billing.tax.taxExemptDesc', 'Check if your organization is tax exempt')}
            </p>
          </div>
          <button
            onClick={() => handleChange('tax_exempt', settings.tax_exempt === 1 ? 0 : 1)}
            className={`w-10 h-5 rounded-full transition-colors ${
              settings.tax_exempt ? 'bg-navy-900' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <div
              className={`w-4 h-4 bg-white dark:bg-navy-900 rounded-full transform transition-transform ${
                settings.tax_exempt ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Billing Address Section */}
      <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-navy-700 space-y-4">
        <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          {t('billing.tax.billingAddress', 'Billing Address')}
        </h4>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('billing.tax.billingName', 'Company / Name')}
              </label>
              <input
                type="text"
                value={settings.billing_name || ''}
                onChange={(e) => handleChange('billing_name', e.target.value)}
                placeholder={t('billing.tax.billingNamePlaceholder', 'np. Przykładowa Sp. z o.o.')}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('billing.tax.billingEmail', 'Billing Email')}
              </label>
              <input
                type="email"
                value={settings.billing_email || ''}
                onChange={(e) => handleChange('billing_email', e.target.value)}
                placeholder={t('billing.tax.billingEmailPlaceholder', 'np. rozliczenia@firma.pl')}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('billing.tax.addressLine1', 'Address Line 1')}
            </label>
            <input
              type="text"
              value={settings.billing_address_line1 || ''}
              onChange={(e) => handleChange('billing_address_line1', e.target.value)}
              placeholder={t('billing.tax.addressLine1Placeholder', 'np. ul. Przykładowa 12')}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('billing.tax.addressLine2', 'Address Line 2')}
            </label>
            <input
              type="text"
              value={settings.billing_address_line2 || ''}
              onChange={(e) => handleChange('billing_address_line2', e.target.value)}
              placeholder={t('billing.tax.addressLine2Placeholder', 'np. lokal 10')}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('billing.tax.city', 'City')}
              </label>
              <input
                type="text"
                value={settings.billing_city || ''}
                onChange={(e) => handleChange('billing_city', e.target.value)}
                placeholder={t('billing.tax.cityPlaceholder', 'np. Warszawa')}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('billing.tax.state', 'State / Region')}
              </label>
              <input
                type="text"
                value={settings.billing_state || ''}
                onChange={(e) => handleChange('billing_state', e.target.value)}
                placeholder={t('billing.tax.statePlaceholder', 'np. mazowieckie')}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('billing.tax.postalCode', 'Postal Code')}
              </label>
              <input
                type="text"
                value={settings.billing_postal_code || ''}
                onChange={(e) => handleChange('billing_postal_code', e.target.value)}
                placeholder="00-001"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('billing.tax.country', 'Country')}
              </label>
              <select
                value={settings.billing_country || ''}
                onChange={(e) => handleChange('billing_country', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">{t('billing.tax.selectCountry', 'Select...')}</option>
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                  {regionNames.of(country.code) || country.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Customization */}
      <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-navy-700 space-y-4">
        <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <Receipt className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          {t('billing.tax.invoiceCustomization', 'Invoice Customization')}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('billing.tax.invoicePrefix', 'Invoice Prefix')}
            </label>
            <input
              type="text"
              value={settings.invoice_prefix || ''}
              onChange={(e) => handleChange('invoice_prefix', e.target.value)}
              placeholder="INV-"
              maxLength={10}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('billing.tax.poNumber', 'Default PO Number')}
            </label>
            <input
              type="text"
              value={settings.po_number || ''}
              onChange={(e) => handleChange('po_number', e.target.value)}
              placeholder="PO-12345"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.saving', 'Saving...')}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {t('common.saveChanges', 'Save Changes')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TaxSettingsForm;
