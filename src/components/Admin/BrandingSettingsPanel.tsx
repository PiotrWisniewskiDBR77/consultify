/**
 * BrandingSettingsPanel - Organization Branding & White-label Settings
 *
 * Features:
 * - Organization logo upload
 * - Primary/Secondary colors
 * - Custom login page
 * - Email template branding
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Image,
  Mail,
  Moon,
  Palette,
  RefreshCw,
  Save,
  Sun,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { InfoButton } from '../shared/InfoButton';

// Types
interface BrandingConfig {
  id?: string;
  organizationId: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  logoIconUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontHeadings: string;
  customCss: string;
  loginPageTitle: string;
  loginPageSubtitle: string;
  loginPageBackground: string;
  loginPageLogo: string;
  customDomain: string;
  emailHeaderLogo: string;
  emailFooterText: string;
  emailFromName: string;
  isActive: boolean;
}

// Default branding config
const DEFAULT_BRANDING: BrandingConfig = {
  organizationId: '',
  logoLightUrl: '',
  logoDarkUrl: '',
  logoIconUrl: '',
  faviconUrl: '',
  primaryColor: '#6366F1', // Violet
  secondaryColor: '#3B82F6', // Blue
  accentColor: '#10B981', // Emerald
  backgroundColor: '#F8FAFC', // Slate-50
  textColor: '#1E293B', // Slate-800
  fontFamily: 'Inter',
  fontHeadings: 'Inter',
  customCss: '',
  loginPageTitle: '',
  loginPageSubtitle: '',
  loginPageBackground: '',
  loginPageLogo: '',
  customDomain: '',
  emailHeaderLogo: '',
  emailFooterText: '',
  emailFromName: '',
  isActive: false,
};

// Font options
const FONT_OPTIONS = [
  { id: 'Inter', label: 'Inter' },
  { id: 'Roboto', label: 'Roboto' },
  { id: 'Open Sans', label: 'Open Sans' },
  { id: 'Lato', label: 'Lato' },
  { id: 'Poppins', label: 'Poppins' },
  { id: 'Montserrat', label: 'Montserrat' },
  { id: 'Source Sans Pro', label: 'Source Sans Pro' },
  { id: 'Nunito', label: 'Nunito' },
  { id: 'Work Sans', label: 'Work Sans' },
  { id: 'DM Sans', label: 'DM Sans' },
];

const loadedFonts = new Set<string>(['Inter']);

const loadGoogleFont = (fontFamily: string) => {
  if (!fontFamily || loadedFonts.has(fontFamily)) return;
  loadedFonts.add(fontFamily);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
};

// Preset color themes
const COLOR_PRESETS = [
  { name: 'Violet', primary: '#6366F1', secondary: '#3B82F6', accent: '#10B981' },
  { name: 'Blue', primary: '#3B82F6', secondary: '#6366F1', accent: '#F59E0B' },
  { name: 'Emerald', primary: '#10B981', secondary: '#3B82F6', accent: '#6366F1' },
  { name: 'Rose', primary: '#F43F5E', secondary: '#EC4899', accent: '#F59E0B' },
  { name: 'Orange', primary: '#F59E0B', secondary: '#FBBF24', accent: '#3B82F6' },
  { name: 'Slate', primary: '#475569', secondary: '#64748B', accent: '#3B82F6' },
];

interface BrandingSettingsPanelProps {
  className?: string;
}

export const BrandingSettingsPanel: React.FC<BrandingSettingsPanelProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [activeSection, setActiveSection] = useState<
    'logos' | 'colors' | 'typography' | 'login' | 'email'
  >('logos');
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<keyof BrandingConfig | null>(null);

  // Load branding
  const loadBranding = useCallback(async () => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/branding/${currentOrganization.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.branding) {
          const merged = {
            ...DEFAULT_BRANDING,
            ...data.branding,
            organizationId: currentOrganization.id,
          };
          setBranding(merged);
          if (merged.fontFamily) loadGoogleFont(merged.fontFamily);
          if (merged.fontHeadings) loadGoogleFont(merged.fontHeadings);
        } else {
          // No branding configured, use defaults
          setBranding({
            ...DEFAULT_BRANDING,
            ...(data.defaults || {}),
            organizationId: currentOrganization.id,
          });
        }
      } else {
        // Use defaults if fetch failed
        setBranding({
          ...DEFAULT_BRANDING,
          organizationId: currentOrganization.id,
        });
      }
    } catch (error) {
      console.error('Error loading branding:', error);
      // Use defaults if no branding exists
      setBranding({
        ...DEFAULT_BRANDING,
        organizationId: currentOrganization.id,
      });
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    loadBranding();
  }, [loadBranding]);

  // Load Google Fonts when font selection changes
  useEffect(() => {
    if (branding.fontFamily) loadGoogleFont(branding.fontFamily);
    if (branding.fontHeadings) loadGoogleFont(branding.fontHeadings);
  }, [branding.fontFamily, branding.fontHeadings]);

  // Apply fonts globally to the document
  const applyFontsGlobally = useCallback((fontFamily: string, fontHeadings: string) => {
    const root = document.documentElement;
    if (fontFamily) {
      root.style.setProperty('--font-family-base', `'${fontFamily}', sans-serif`);
      root.style.setProperty('--font-family', `'${fontFamily}', sans-serif`);
      document.body.style.fontFamily = `'${fontFamily}', sans-serif`;
    }
    if (fontHeadings) {
      root.style.setProperty('--font-family-headings', `'${fontHeadings}', sans-serif`);
    }
  }, []);

  // Update branding field
  const updateField = (field: keyof BrandingConfig, value: any) => {
    setBranding((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Save branding
  const saveBranding = async () => {
    if (!currentOrganization?.id) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/branding/${currentOrganization.id}`, {
        method: 'PATCH', // PATCH = upsert (create or update)
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(branding),
      });

      if (response.ok) {
        toast.success(t('admin.branding.saved', 'Branding settings saved'));
        setHasChanges(false);
        applyFontsGlobally(branding.fontFamily, branding.fontHeadings);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Save failed');
      }
    } catch (error) {
      console.error('Error saving branding:', error);
      toast.error(t('admin.branding.saveError', 'Failed to save branding settings'));
    } finally {
      setSaving(false);
    }
  };

  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('admin.branding.invalidFileType', 'Please select an image file'));
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('admin.branding.fileTooLarge', 'Image must be less than 2MB'));
      return;
    }

    try {
      // In a real implementation, upload to server/S3
      // For now, create a data URL
      const reader = new FileReader();
      reader.onload = (event) => {
        updateField(uploadTarget, event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error(t('admin.branding.uploadError', 'Failed to upload image'));
    }

    // Reset
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setUploadTarget(null);
  };

  // Trigger file upload
  const triggerUpload = (target: keyof BrandingConfig) => {
    setUploadTarget(target);
    fileInputRef.current?.click();
  };

  // Apply color preset
  const applyPreset = (preset: (typeof COLOR_PRESETS)[0]) => {
    setBranding((prev) => ({
      ...prev,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent,
    }));
    setHasChanges(true);
  };

  // Render logo uploader
  const renderLogoUploader = (label: string, field: keyof BrandingConfig, description: string) => {
    const value = branding[field] as string;

    return (
      <div className="p-4 bg-slate-50 dark:bg-navy-700 rounded-xl">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-medium text-slate-900 dark:text-white">{label}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          </div>
          {value && (
            <button
              onClick={() => updateField(field, '')}
              className="p-1 text-slate-400 dark:text-slate-500 hover:text-danger-500 rounded"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {value ? (
          <div className="relative group">
            <div
              className={`flex items-center justify-center p-4 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-600 ${
                field.includes('Dark') ? 'bg-slate-800' : 'bg-white'
              }`}
            >
              <img src={value} alt={label} className="max-h-16 max-w-full object-contain" />
            </div>
            <button
              onClick={() => triggerUpload(field)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity"
            >
              <span className="text-c-text text-sm font-medium">Change</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => triggerUpload(field)}
            className="w-full p-6 border-2 border-dashed border-slate-200 dark:border-navy-600 rounded-lg hover:border-primary-400 dark:hover:border-primary-500 transition-colors flex flex-col items-center gap-2"
          >
            <Upload className="text-slate-400 dark:text-slate-500" size={24} />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.branding.uploadImage', 'Upload Image')}
            </span>
          </button>
        )}
      </div>
    );
  };

  // Section navigation
  const sections = [
    { id: 'logos', label: t('admin.branding.logos', 'Logos'), icon: Image },
    { id: 'colors', label: t('admin.branding.colors', 'Colors'), icon: Palette },
    { id: 'typography', label: t('admin.branding.typography', 'Typography'), icon: Type },
    { id: 'login', label: t('admin.branding.loginPage', 'Login Page'), icon: Globe },
    { id: 'email', label: t('admin.branding.emailTemplates', 'Email'), icon: Mail },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('admin.branding.title', 'Branding')}
            </h2>
            <InfoButton cardId="admin-branding" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('admin.branding.subtitle', "Customize your organization's appearance")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadBranding}
            disabled={loading}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={saveBranding}
            disabled={!hasChanges || saving}
            className="px-4 py-2 bg-c-text text-c-bg hover:bg-c-text-secondary disabled:bg-slate-300 dark:disabled:bg-slate-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Save size={18} className={saving ? 'animate-spin' : ''} />
            {t('common.save', 'Save Changes')}
          </button>
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2"
        >
          <AlertTriangle className="text-amber-500" size={16} />
          <span className="text-sm text-amber-800 dark:text-amber-300">
            {t('admin.branding.unsavedChanges', 'You have unsaved changes')}
          </span>
        </motion.div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-primary-500" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Section Navigation */}
          <div className="space-y-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id as any)}
                  className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-medium">{section.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
            {/* Logos Section */}
            {activeSection === 'logos' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  {t('admin.branding.logosTitle', 'Logo Settings')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderLogoUploader(
                    t('admin.branding.logoLight', 'Light Mode Logo'),
                    'logoLightUrl',
                    t('admin.branding.logoLightDesc', 'Displayed on light backgrounds')
                  )}
                  {renderLogoUploader(
                    t('admin.branding.logoDark', 'Dark Mode Logo'),
                    'logoDarkUrl',
                    t('admin.branding.logoDarkDesc', 'Displayed on dark backgrounds')
                  )}
                  {renderLogoUploader(
                    t('admin.branding.logoIcon', 'Logo Icon'),
                    'logoIconUrl',
                    t('admin.branding.logoIconDesc', 'Square icon for compact spaces')
                  )}
                  {renderLogoUploader(
                    t('admin.branding.favicon', 'Favicon'),
                    'faviconUrl',
                    t('admin.branding.faviconDesc', 'Browser tab icon (32x32)')
                  )}
                </div>
              </div>
            )}

            {/* Colors Section */}
            {activeSection === 'colors' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  {t('admin.branding.colorsTitle', 'Color Settings')}
                </h3>

                {/* Presets */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t('admin.branding.colorPresets', 'Quick Presets')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => applyPreset(preset)}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-600 hover:border-primary-400 transition-colors flex items-center gap-2"
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {preset.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Colors */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    {
                      field: 'primaryColor',
                      label: t('admin.branding.primaryColor', 'Primary Color'),
                    },
                    {
                      field: 'secondaryColor',
                      label: t('admin.branding.secondaryColor', 'Secondary Color'),
                    },
                    {
                      field: 'accentColor',
                      label: t('admin.branding.accentColor', 'Accent Color'),
                    },
                    {
                      field: 'backgroundColor',
                      label: t('admin.branding.backgroundColor', 'Background Color'),
                    },
                    { field: 'textColor', label: t('admin.branding.textColor', 'Text Color') },
                  ].map(({ field, label }) => (
                    <div key={field}>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {label}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={branding[field as keyof BrandingConfig] as string}
                          onChange={(e) =>
                            updateField(field as keyof BrandingConfig, e.target.value)
                          }
                          className="w-10 h-10 rounded cursor-pointer border-0"
                        />
                        <input
                          type="text"
                          value={branding[field as keyof BrandingConfig] as string}
                          onChange={(e) =>
                            updateField(field as keyof BrandingConfig, e.target.value)
                          }
                          className="flex-1 px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white font-mono text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                <div className="mt-6 p-4 rounded-xl border border-slate-200 dark:border-navy-700">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-slate-900 dark:text-white">
                      {t('admin.branding.preview', 'Preview')}
                    </h4>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-700 rounded-lg p-1">
                      <button
                        onClick={() => setPreviewMode('light')}
                        className={`p-1.5 rounded ${previewMode === 'light' ? 'bg-white dark:bg-navy-600 shadow-sm' : ''}`}
                      >
                        <Sun size={14} />
                      </button>
                      <button
                        onClick={() => setPreviewMode('dark')}
                        className={`p-1.5 rounded ${previewMode === 'dark' ? 'bg-white dark:bg-navy-600 shadow-sm' : ''}`}
                      >
                        <Moon size={14} />
                      </button>
                    </div>
                  </div>
                  <div
                    className="p-6 rounded-lg"
                    style={{
                      backgroundColor:
                        previewMode === 'dark' ? '#1E293B' : branding.backgroundColor,
                      color: previewMode === 'dark' ? '#F8FAFC' : branding.textColor,
                    }}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <button
                        className="px-4 py-2 rounded-lg text-c-text font-medium"
                        style={{ backgroundColor: branding.primaryColor }}
                      >
                        Primary Button
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg text-c-text font-medium"
                        style={{ backgroundColor: branding.secondaryColor }}
                      >
                        Secondary
                      </button>
                      <span
                        className="px-3 py-1 rounded-full text-sm text-c-text"
                        style={{ backgroundColor: branding.accentColor }}
                      >
                        Accent Badge
                      </span>
                    </div>
                    <p className="text-sm">Sample text with your selected colors.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Typography Section */}
            {activeSection === 'typography' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  {t('admin.branding.typographyTitle', 'Typography Settings')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t('admin.branding.bodyFont', 'Body Font')}
                    </label>
                    <select
                      value={branding.fontFamily}
                      onChange={(e) => updateField('fontFamily', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t('admin.branding.headingsFont', 'Headings Font')}
                    </label>
                    <select
                      value={branding.fontHeadings}
                      onChange={(e) => updateField('fontHeadings', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('admin.branding.customCss', 'Custom CSS (Advanced)')}
                  </label>
                  <textarea
                    value={branding.customCss}
                    onChange={(e) => updateField('customCss', e.target.value)}
                    className="w-full px-3 py-2 bg-c-surface text-green-400 font-mono text-sm border border-c-border-subtle rounded-lg"
                    rows={6}
                    placeholder="/* Custom CSS overrides */"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t(
                      'admin.branding.customCssNote',
                      'Use with caution. May override default styles.'
                    )}
                  </p>
                </div>

                {/* Typography Preview */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-navy-700">
                  <h4 className="font-medium text-slate-900 dark:text-white mb-4">
                    {t('admin.branding.typographyPreview', 'Typography Preview')}
                  </h4>
                  <div className="space-y-3" style={{ fontFamily: branding.fontFamily }}>
                    <h1
                      className="text-3xl font-bold text-slate-900 dark:text-white"
                      style={{ fontFamily: branding.fontHeadings }}
                    >
                      Heading Level 1
                    </h1>
                    <h2
                      className="text-2xl font-semibold text-slate-800 dark:text-slate-200"
                      style={{ fontFamily: branding.fontHeadings }}
                    >
                      Heading Level 2
                    </h2>
                    <p className="text-base text-slate-600 dark:text-slate-400">
                      Body text example. This demonstrates how your selected fonts will appear in
                      the application.
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-500">
                      Small text for captions and secondary information.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Login Page Section */}
            {activeSection === 'login' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  {t('admin.branding.loginPageTitle', 'Login Page Customization')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t('admin.branding.loginTitle', 'Login Page Title')}
                    </label>
                    <input
                      type="text"
                      value={branding.loginPageTitle}
                      onChange={(e) => updateField('loginPageTitle', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                      placeholder={t(
                        'admin.branding.loginTitlePlaceholder',
                        'Welcome to Your Workspace'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t('admin.branding.loginSubtitle', 'Login Page Subtitle')}
                    </label>
                    <input
                      type="text"
                      value={branding.loginPageSubtitle}
                      onChange={(e) => updateField('loginPageSubtitle', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                      placeholder={t(
                        'admin.branding.loginSubtitlePlaceholder',
                        'Sign in to continue'
                      )}
                    />
                  </div>
                </div>

                {renderLogoUploader(
                  t('admin.branding.loginLogo', 'Login Page Logo'),
                  'loginPageLogo',
                  t('admin.branding.loginLogoDesc', 'Logo shown on the login page')
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('admin.branding.customDomain', 'Custom Domain')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={branding.customDomain}
                      onChange={(e) => updateField('customDomain', e.target.value)}
                      className="flex-1 px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                      placeholder="app.yourcompany.com"
                    />
                    {branding.customDomain && (
                      <a
                        href={`https://${branding.customDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary-500"
                      >
                        <ExternalLink size={18} />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t(
                      'admin.branding.customDomainNote',
                      'Contact support to configure DNS for custom domains.'
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Email Section */}
            {activeSection === 'email' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  {t('admin.branding.emailTitle', 'Email Template Branding')}
                </h3>

                {renderLogoUploader(
                  t('admin.branding.emailLogo', 'Email Header Logo'),
                  'emailHeaderLogo',
                  t('admin.branding.emailLogoDesc', 'Logo shown in email headers')
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('admin.branding.emailFromName', 'Email From Name')}
                  </label>
                  <input
                    type="text"
                    value={branding.emailFromName}
                    onChange={(e) => updateField('emailFromName', e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                    placeholder={t('admin.branding.emailFromNamePlaceholder', 'Your Company Name')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('admin.branding.emailFooter', 'Email Footer Text')}
                  </label>
                  <textarea
                    value={branding.emailFooterText}
                    onChange={(e) => updateField('emailFooterText', e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white resize-none"
                    rows={3}
                    placeholder={t(
                      'admin.branding.emailFooterPlaceholder',
                      'Company Name\n123 Street, City, Country\ncontact@company.com'
                    )}
                  />
                </div>

                {/* Email Preview */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-700">
                  <h4 className="font-medium text-slate-900 dark:text-white mb-4">
                    {t('admin.branding.emailPreview', 'Email Preview')}
                  </h4>
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-md mx-auto">
                    <div
                      className="px-6 py-4 text-center"
                      style={{ backgroundColor: branding.primaryColor }}
                    >
                      {branding.emailHeaderLogo ? (
                        <img src={branding.emailHeaderLogo} alt="Logo" className="h-8 mx-auto" />
                      ) : (
                        <span className="text-c-text font-bold">
                          {branding.emailFromName || 'Your Company'}
                        </span>
                      )}
                    </div>
                    <div className="px-6 py-8 text-center">
                      <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                        Email Subject Line
                      </h2>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">
                        This is a preview of how your branded emails will look.
                      </p>
                    </div>
                    <div className="px-6 py-4 bg-slate-50 dark:bg-navy-800/30 border-t text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-line">
                        {branding.emailFooterText || 'Your company footer text will appear here.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandingSettingsPanel;
