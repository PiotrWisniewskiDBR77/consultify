/**
 * Brand Kit Settings (T059)
 * Organization-level branding configuration for presentations.
 */

import { Check, Image, Loader2, Palette, Save, Type } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

interface BrandKit {
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_title: string;
  font_body: string;
  footer_text: string | null;
  header_text: string | null;
  show_page_numbers: boolean;
  show_confidentiality: boolean;
  confidentiality_default: string;
  disclaimer_text: string | null;
  watermark_text: string | null;
}

const SAFE_FONTS = [
  'Calibri Light',
  'Calibri',
  'Arial',
  'Segoe UI',
  'Helvetica',
  'Times New Roman',
  'Georgia',
];

export const BrandKitSettings: React.FC = () => {
  const { t } = useTranslation();
  const [kit, setKit] = useState<BrandKit>({
    name: 'Default',
    logo_url: null,
    primary_color: '003A70',
    secondary_color: '2C5F8A',
    accent_color: '00AA55',
    font_title: 'Calibri Light',
    font_body: 'Calibri',
    footer_text: null,
    header_text: null,
    show_page_numbers: true,
    show_confidentiality: true,
    confidentiality_default: 'internal',
    disclaimer_text: null,
    watermark_text: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadKit();
  }, []);

  const loadKit = async () => {
    setLoading(true);
    try {
      const res = await Api.get('/presentations/brand-kit');
      if (res.data) setKit(res.data);
    } catch {}
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.put('/presentations/brand-kit', {
        name: kit.name,
        logoUrl: kit.logo_url,
        primaryColor: kit.primary_color,
        secondaryColor: kit.secondary_color,
        accentColor: kit.accent_color,
        fontTitle: kit.font_title,
        fontBody: kit.font_body,
        footerText: kit.footer_text,
        headerText: kit.header_text,
        showPageNumbers: kit.show_page_numbers,
        showConfidentiality: kit.show_confidentiality,
        confidentialityDefault: kit.confidentiality_default,
        disclaimerText: kit.disclaimer_text,
        watermarkText: kit.watermark_text,
      });
      trackFunnelEvent('brand_kit_updated', {});
      toast.success(t('presentations.brandKit.saved', 'Brand kit saved'));
    } catch {
      toast.error(t('presentations.brandKit.saveFailed', 'Failed to save'));
    }
    setSaving(false);
  };

  const updateField = <K extends keyof BrandKit>(key: K, val: BrandKit[K]) => {
    setKit((prev) => ({ ...prev, [key]: val }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-c-info animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Palette className="w-5 h-5 text-c-info" />
          {t('presentations.brandKit.title', 'Brand Kit')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t(
            'presentations.brandKit.subtitle',
            'Configure your organization branding for presentations and reports.'
          )}
        </p>
      </div>

      {/* Colors */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('presentations.brandKit.colors', 'Colors')}
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <ColorField
            label={t('presentations.brandKit.primary', 'Primary')}
            value={kit.primary_color}
            onChange={(v) => updateField('primary_color', v)}
          />
          <ColorField
            label={t('presentations.brandKit.secondary', 'Secondary')}
            value={kit.secondary_color}
            onChange={(v) => updateField('secondary_color', v)}
          />
          <ColorField
            label={t('presentations.brandKit.accent', 'Accent')}
            value={kit.accent_color}
            onChange={(v) => updateField('accent_color', v)}
          />
        </div>
        {/* Preview swatch */}
        <div className="flex gap-2">
          <div className="w-12 h-8 rounded" style={{ backgroundColor: `#${kit.primary_color}` }} />
          <div
            className="w-12 h-8 rounded"
            style={{ backgroundColor: `#${kit.secondary_color}` }}
          />
          <div className="w-12 h-8 rounded" style={{ backgroundColor: `#${kit.accent_color}` }} />
        </div>
      </div>

      {/* Fonts */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Type size={14} /> {t('presentations.brandKit.fonts', 'Fonts')}
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              {t('presentations.brandKit.titleFont', 'Title Font')}
            </label>
            <select
              value={kit.font_title}
              onChange={(e) => updateField('font_title', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
            >
              {SAFE_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              {t('presentations.brandKit.bodyFont', 'Body Font')}
            </label>
            <select
              value={kit.font_body}
              onChange={(e) => updateField('font_body', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
            >
              {SAFE_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Footer / Header */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('presentations.brandKit.headerFooter', 'Header & Footer')}
        </h4>
        <TextField
          label={t('presentations.brandKit.headerText', 'Header text')}
          value={kit.header_text || ''}
          onChange={(v) => updateField('header_text', v || null)}
          placeholder="Nazwa organizacji"
        />
        <TextField
          label={t('presentations.brandKit.footerText', 'Footer text')}
          value={kit.footer_text || ''}
          onChange={(v) => updateField('footer_text', v || null)}
          placeholder="Poufne — tylko do użytku wewnętrznego"
        />
        <div className="flex items-center gap-6">
          <ToggleField
            label={t('presentations.brandKit.pageNumbers', 'Page numbers')}
            checked={kit.show_page_numbers}
            onChange={(v) => updateField('show_page_numbers', v)}
          />
          <ToggleField
            label={t('presentations.brandKit.confidentialityBanner', 'Confidentiality banner')}
            checked={kit.show_confidentiality}
            onChange={(v) => updateField('show_confidentiality', v)}
          />
        </div>
      </div>

      {/* Confidentiality default */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('presentations.brandKit.defaultConfidentiality', 'Default Confidentiality')}
        </label>
        <select
          value={kit.confidentiality_default}
          onChange={(e) => updateField('confidentiality_default', e.target.value)}
          className="w-full max-w-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
        >
          <option value="confidential">Poufne</option>
          <option value="internal">Wewnętrzne</option>
          <option value="public">Publiczne</option>
        </select>
      </div>

      {/* Disclaimer */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('presentations.brandKit.disclaimer', 'Disclaimer text')}
        </label>
        <textarea
          value={kit.disclaimer_text || ''}
          onChange={(e) => updateField('disclaimer_text', e.target.value || null)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
          placeholder={t(
            'presentations.brandKit.disclaimerPlaceholder',
            'Optional legal disclaimer for financial/valuation decks'
          )}
        />
      </div>

      {/* Save */}
      <div className="pt-4 border-t border-slate-200 dark:border-navy-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-navy-900 text-white dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 font-medium rounded-xl hover:bg-navy-800 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {t('common.save', 'Save')}
        </button>
      </div>
    </div>
  );
};

const ColorField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div>
    <label className="block text-xs text-slate-500 mb-1">{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={`#${value}`}
        onChange={(e) => onChange(e.target.value.replace('#', ''))}
        className="w-8 h-8 rounded border-0 cursor-pointer"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace('#', ''))}
        className="flex-1 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-xs font-mono text-slate-900 dark:text-white"
        maxLength={6}
      />
    </div>
  </div>
);

const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-xs text-slate-500 mb-1">{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
    />
  </div>
);

const ToggleField: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <div
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-navy-900' : 'bg-slate-300 dark:bg-navy-600'}`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </div>
    <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
  </label>
);

export default BrandKitSettings;
