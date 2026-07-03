/**
 * WhitelabelStudioView - Super Admin White-label & Branding
 *
 * Enterprise branding customization:
 * - Logo and favicon uploads
 * - Color theme customization
 * - Typography settings
 * - Login page customization
 * - Custom domain configuration
 * - Email template branding
 */

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Image,
  Loader2,
  Mail,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Save,
  Settings,
  Sun,
  Trash2,
  Type,
  Upload,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';

interface BrandingConfig {
  id?: string;
  organizationId: string;
  organizationName?: string;
  // Logos
  logoLightUrl?: string;
  logoDarkUrl?: string;
  logoIconUrl?: string;
  faviconUrl?: string;
  // Colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  // Dark mode
  darkPrimaryColor: string;
  darkSecondaryColor: string;
  darkBackgroundColor: string;
  darkTextColor: string;
  // Typography
  fontFamily: string;
  headingFontFamily: string;
  // Login
  loginBackgroundUrl?: string;
  loginTagline?: string;
  loginWelcomeMessage?: string;
  // Custom domain
  customDomain?: string;
  customDomainVerified: boolean;
  customDomainSslStatus: string;
  // Features
  hidePoweredBy: boolean;
  customSupportEmail?: string;
  customTermsUrl?: string;
  customPrivacyUrl?: string;
}

interface Organization {
  id: string;
  name: string;
  hasBranding: boolean;
}

type TabType = 'brand' | 'colors' | 'typography' | 'login' | 'domain';

const FONT_OPTIONS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Poppins',
  'Montserrat',
  'Source Sans Pro',
  'Nunito',
  'Work Sans',
  'DM Sans',
  'Space Grotesk',
  'IBM Plex Sans',
];

const DEFAULT_BRANDING: BrandingConfig = {
  organizationId: '',
  primaryColor: '#6366F1',
  secondaryColor: '#3B82F6',
  accentColor: '#10B981',
  backgroundColor: '#F8FAFC',
  textColor: '#1E293B',
  darkPrimaryColor: '#A78BFA',
  darkSecondaryColor: '#60A5FA',
  darkBackgroundColor: '#0F172A',
  darkTextColor: '#F8FAFC',
  fontFamily: 'Inter',
  headingFontFamily: 'Inter',
  customDomainVerified: false,
  customDomainSslStatus: 'pending',
  hidePoweredBy: false,
};

export const WhitelabelStudioView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('brand');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);
  const [brandingLoadError, setBrandingLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Use the branding list endpoint to get all data at once
      const result = await Api.get('/branding');
      const payload = result?.data ?? result;

      // Get all organizations
      const orgs = await Api.getOrganizations();

      // Map branding to organizations
      const brandingMap = new Map((payload.brandings || []).map((b: any) => [b.organizationId, b]));
      const orgsWithBranding = orgs.map((org: any) => ({
        ...org,
        hasBranding: brandingMap.has(org.id),
      }));

      setOrganizations(orgsWithBranding);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchBranding = async (orgId: string) => {
    setBrandingLoadError(null);
    try {
      const result = await Api.get(`/branding/${orgId}`);
      const payload = result?.data ?? result;
      if (payload.branding) {
        setBranding({ ...DEFAULT_BRANDING, ...payload.branding, organizationId: orgId });
      } else {
        setBranding({ ...DEFAULT_BRANDING, organizationId: orgId });
      }
    } catch (error: any) {
      setBranding({ ...DEFAULT_BRANDING, organizationId: orgId });
      setBrandingLoadError(error?.message || 'Failed to load branding configuration');
    }
  };

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrg(orgId);
    fetchBranding(orgId);
  };

  const handleSave = async () => {
    if (!selectedOrg) return;
    setSaving(true);
    setMessage(null);
    try {
      // Use standardized patch method
      await Api.patch(`/branding/${selectedOrg}`, branding);
      setMessage({ type: 'success', text: 'Branding saved successfully!' });
      await fetchData();
    } catch (error: any) {
      console.error('Failed to save branding:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save branding' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (orgId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to reset branding to defaults? This will remove all custom branding for this organization.'
      )
    ) {
      return;
    }

    try {
      await Api.delete(`/branding/${orgId}`);
      setMessage({ type: 'success', text: 'Branding reset to defaults' });
      if (selectedOrg === orgId) {
        setBranding({ ...DEFAULT_BRANDING, organizationId: orgId });
      }
      await fetchData();
    } catch (error: any) {
      console.error('Failed to delete branding:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to delete branding',
      });
    }
  };

  const handleClone = async (targetOrgId: string, sourceOrgId: string) => {
    if (!window.confirm(`Clone branding from the selected organization to ${targetOrgId}?`)) {
      return;
    }

    try {
      await Api.post(`/branding/${targetOrgId}/clone`, { sourceOrgId });
      setMessage({ type: 'success', text: 'Branding cloned successfully!' });
      await fetchData();
    } catch (error: any) {
      console.error('Failed to clone branding:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to clone branding',
      });
    }
  };

  const handleLogoUpload = async (type: 'light' | 'dark' | 'icon' | 'favicon', file: File) => {
    if (!selectedOrg) return;
    setUploadingLogo(type);
    try {
      const result = await Api.upload(file, { orgId: selectedOrg, type });

      // Update branding with new URL
      const urlField =
        type === 'light'
          ? 'logoLightUrl'
          : type === 'dark'
            ? 'logoDarkUrl'
            : type === 'icon'
              ? 'logoIconUrl'
              : 'faviconUrl';
      setBranding((prev) => ({ ...prev, [urlField]: result.url }));
    } catch (error) {
      console.error('Failed to upload logo:', error);
    } finally {
      setUploadingLogo(null);
    }
  };

  const updateField = (field: keyof BrandingConfig, value: any) => {
    setBranding((prev) => ({ ...prev, [field]: value }));
  };

  const ColorPicker: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
    label,
    value,
    onChange,
  }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-slate-200 dark:border-navy-700 cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white font-mono text-sm"
        />
      </div>
    </div>
  );

  const LogoUploader: React.FC<{
    label: string;
    type: 'light' | 'dark' | 'icon' | 'favicon';
    currentUrl?: string;
  }> = ({ label, type, currentUrl }) => (
    <div className="p-4 border border-dashed border-slate-300 dark:border-white/20 rounded-xl">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
        {label}
      </label>
      <div className="flex items-center gap-4">
        {currentUrl ? (
          <div className="relative">
            <img
              src={currentUrl}
              alt={label}
              className={`object-contain rounded-lg border border-slate-200 dark:border-navy-700 ${
                type === 'favicon'
                  ? 'w-8 h-8'
                  : type === 'icon'
                    ? 'w-12 h-12'
                    : 'h-12 w-auto max-w-32'
              }`}
              style={{ backgroundColor: previewMode === 'dark' ? '#0F172A' : '#F8FAFC' }}
            />
            <button
              onClick={() => {
                const urlField =
                  type === 'light'
                    ? 'logoLightUrl'
                    : type === 'dark'
                      ? 'logoDarkUrl'
                      : type === 'icon'
                        ? 'logoIconUrl'
                        : 'faviconUrl';
                updateField(urlField, undefined);
              }}
              className="absolute -top-2 -right-2 w-5 h-5 bg-danger-500 text-white rounded-full flex items-center justify-center"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ) : (
          <div
            className={`flex items-center justify-center bg-slate-100 dark:bg-navy-700 rounded-lg ${
              type === 'favicon' ? 'w-8 h-8' : type === 'icon' ? 'w-12 h-12' : 'h-12 w-32'
            }`}
          >
            <Image
              size={type === 'favicon' ? 12 : 20}
              className="text-slate-600 dark:text-slate-500"
            />
          </div>
        )}
        <div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleLogoUpload(type, e.target.files[0])}
            className="hidden"
            id={`logo-${type}`}
          />
          <label
            htmlFor={`logo-${type}`}
            className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 rounded-lg cursor-pointer flex items-center gap-2 text-slate-700 dark:text-slate-300"
          >
            {uploadingLogo === type ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            Upload
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {type === 'favicon'
              ? '32x32 ICO/PNG'
              : type === 'icon'
                ? '64x64 PNG'
                : 'SVG or PNG, max 200KB'}
          </p>
        </div>
      </div>
    </div>
  );

  const renderBrandTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <LogoUploader label="Logo (Light Mode)" type="light" currentUrl={branding.logoLightUrl} />
        <LogoUploader label="Logo (Dark Mode)" type="dark" currentUrl={branding.logoDarkUrl} />
        <LogoUploader label="Icon/Mark" type="icon" currentUrl={branding.logoIconUrl} />
        <LogoUploader label="Favicon" type="favicon" currentUrl={branding.faviconUrl} />
      </div>

      <div className="bg-slate-50 dark:bg-navy-900 rounded-xl p-6">
        <h4 className="font-medium text-slate-900 dark:text-white mb-4">Branding Options</h4>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={branding.hidePoweredBy}
              onChange={(e) => updateField('hidePoweredBy', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Hide "Powered by Consultify" branding
            </span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Support Email
              </label>
              <input
                type="email"
                value={branding.customSupportEmail || ''}
                onChange={(e) => updateField('customSupportEmail', e.target.value)}
                placeholder="support@yourcompany.com"
                className="w-full px-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Terms of Service URL
              </label>
              <input
                type="url"
                value={branding.customTermsUrl || ''}
                onChange={(e) => updateField('customTermsUrl', e.target.value)}
                placeholder="https://yourcompany.com/terms"
                className="w-full px-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderColorsTab = () => (
    <div className="space-y-6">
      {/* Preview Toggle */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setPreviewMode('light')}
          className={`p-2 rounded-lg ${previewMode === 'light' ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600' : 'text-slate-600 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800/40'}`}
        >
          <Sun size={18} />
        </button>
        <button
          onClick={() => setPreviewMode('dark')}
          className={`p-2 rounded-lg ${previewMode === 'dark' ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600' : 'text-slate-600 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800/40'}`}
        >
          <Moon size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Light Mode Colors */}
        <div className="space-y-4">
          <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Sun size={16} />
            Light Mode
          </h4>
          <ColorPicker
            label="Primary Color"
            value={branding.primaryColor}
            onChange={(v) => updateField('primaryColor', v)}
          />
          <ColorPicker
            label="Secondary Color"
            value={branding.secondaryColor}
            onChange={(v) => updateField('secondaryColor', v)}
          />
          <ColorPicker
            label="Accent Color"
            value={branding.accentColor}
            onChange={(v) => updateField('accentColor', v)}
          />
          <ColorPicker
            label="Background Color"
            value={branding.backgroundColor}
            onChange={(v) => updateField('backgroundColor', v)}
          />
          <ColorPicker
            label="Text Color"
            value={branding.textColor}
            onChange={(v) => updateField('textColor', v)}
          />
        </div>

        {/* Dark Mode Colors */}
        <div className="space-y-4">
          <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Moon size={16} />
            Dark Mode
          </h4>
          <ColorPicker
            label="Primary Color"
            value={branding.darkPrimaryColor}
            onChange={(v) => updateField('darkPrimaryColor', v)}
          />
          <ColorPicker
            label="Secondary Color"
            value={branding.darkSecondaryColor}
            onChange={(v) => updateField('darkSecondaryColor', v)}
          />
          <ColorPicker
            label="Background Color"
            value={branding.darkBackgroundColor}
            onChange={(v) => updateField('darkBackgroundColor', v)}
          />
          <ColorPicker
            label="Text Color"
            value={branding.darkTextColor}
            onChange={(v) => updateField('darkTextColor', v)}
          />
        </div>
      </div>

      {/* Preview */}
      <div
        className="rounded-xl p-6 border"
        style={{
          backgroundColor:
            previewMode === 'dark' ? branding.darkBackgroundColor : branding.backgroundColor,
          color: previewMode === 'dark' ? branding.darkTextColor : branding.textColor,
          borderColor: previewMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        }}
      >
        <h4 className="text-lg font-semibold mb-3">Preview</h4>
        <p className="mb-4">This is how your branded interface will look.</p>
        <div className="flex gap-3">
          <button
            style={{
              backgroundColor:
                previewMode === 'dark' ? branding.darkPrimaryColor : branding.primaryColor,
            }}
            className="px-4 py-2 rounded-lg text-c-text font-medium"
          >
            Primary Button
          </button>
          <button
            style={{
              backgroundColor:
                previewMode === 'dark' ? branding.darkSecondaryColor : branding.secondaryColor,
            }}
            className="px-4 py-2 rounded-lg text-c-text font-medium"
          >
            Secondary Button
          </button>
          <button
            style={{ backgroundColor: branding.accentColor }}
            className="px-4 py-2 rounded-lg text-c-text font-medium"
          >
            Accent Button
          </button>
        </div>
      </div>
    </div>
  );

  const renderTypographyTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Body Font
          </label>
          <select
            value={branding.fontFamily}
            onChange={(e) => updateField('fontFamily', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Heading Font
          </label>
          <select
            value={branding.headingFontFamily}
            onChange={(e) => updateField('headingFontFamily', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Typography Preview */}
      <div className="bg-slate-50 dark:bg-navy-900 rounded-xl p-6">
        <h4 className="font-medium text-slate-900 dark:text-white mb-4">Typography Preview</h4>
        <div className="space-y-4" style={{ fontFamily: branding.fontFamily }}>
          <h1
            style={{ fontFamily: branding.headingFontFamily }}
            className="text-3xl font-bold text-slate-900 dark:text-white"
          >
            Heading 1 - The quick brown fox
          </h1>
          <h2
            style={{ fontFamily: branding.headingFontFamily }}
            className="text-2xl font-semibold text-slate-800 dark:text-slate-200"
          >
            Heading 2 - The quick brown fox
          </h2>
          <h3
            style={{ fontFamily: branding.headingFontFamily }}
            className="text-xl font-semibold text-slate-700 dark:text-slate-300"
          >
            Heading 3 - The quick brown fox
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Body text - The quick brown fox jumps over the lazy dog. Pack my box with five dozen
            liquor jugs.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Small text - The quick brown fox jumps over the lazy dog.
          </p>
        </div>
      </div>
    </div>
  );

  const renderLoginTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tagline
            </label>
            <input
              type="text"
              value={branding.loginTagline || ''}
              onChange={(e) => updateField('loginTagline', e.target.value)}
              placeholder="Your transformation journey starts here"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Welcome Message
            </label>
            <textarea
              value={branding.loginWelcomeMessage || ''}
              onChange={(e) => updateField('loginWelcomeMessage', e.target.value)}
              placeholder="Welcome back! Sign in to continue."
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
          <LogoUploader
            label="Background Image"
            type="light"
            currentUrl={branding.loginBackgroundUrl}
          />
        </div>

        {/* Login Preview */}
        <div
          className="rounded-xl overflow-hidden border border-slate-200 dark:border-navy-700"
          style={{
            backgroundImage: branding.loginBackgroundUrl
              ? `url(${branding.loginBackgroundUrl})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="backdrop-blur-sm bg-white/90 dark:bg-navy-900/90 p-8 h-full min-h-[400px] flex flex-col justify-center items-center">
            {branding.logoLightUrl ? (
              <img src={branding.logoLightUrl} alt="Logo" className="h-12 mb-6" />
            ) : (
              <div
                className="w-12 h-12 rounded-xl mb-6"
                style={{ backgroundColor: branding.primaryColor }}
              />
            )}
            {branding.loginTagline && (
              <p className="text-slate-600 dark:text-slate-400 mb-8 text-center">
                {branding.loginTagline}
              </p>
            )}
            <div className="w-full max-w-sm space-y-4">
              <input
                type="email"
                placeholder="Email"
                className="w-full px-4 py-3 bg-slate-100 dark:bg-navy-800 rounded-lg"
                disabled
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full px-4 py-3 bg-slate-100 dark:bg-navy-800 rounded-lg"
                disabled
              />
              <button
                className="w-full py-3 rounded-lg text-c-text font-medium"
                style={{ backgroundColor: branding.primaryColor }}
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDomainTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Custom Domain</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Domain
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={branding.customDomain || ''}
                onChange={(e) => updateField('customDomain', e.target.value)}
                placeholder="app.yourcompany.com"
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
              <button
                onClick={async () => {
                  if (!selectedOrg) return;
                  if (!branding.customDomain?.trim()) return;
                  try {
                    const result = await Api.post(`/branding/${selectedOrg}/verify-domain`, {});
                    const verified = Boolean((result as any)?.verified);
                    updateField('customDomainVerified', verified);
                    setMessage({
                      type: verified ? 'success' : 'warning',
                      text: verified
                        ? 'Domain verified successfully.'
                        : `Domain not verified yet. Expected CNAME → ${(result as any)?.expectedTarget || 'app.consultify.com'}`,
                    });
                  } catch (err: any) {
                    setMessage({
                      type: 'error',
                      text: err?.message || 'Failed to verify domain',
                    });
                  }
                }}
                disabled={!selectedOrg || !branding.customDomain?.trim()}
                className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium"
              >
                Verify Domain
              </button>
            </div>
          </div>

          {branding.customDomain && (
            <div className="bg-slate-50 dark:bg-navy-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Domain Status
                </span>
                {branding.customDomainVerified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 size={12} />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600">
                    <AlertTriangle size={12} />
                    Pending Verification
                  </span>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-slate-600 dark:text-slate-400">Add the following DNS records:</p>
                <div className="bg-white dark:bg-navy-800 rounded p-3 font-mono text-xs">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-500 dark:text-slate-400">CNAME Record:</span>
                    <button
                      className="text-primary-600 hover:text-primary-700"
                      onClick={() => {
                        const text = `${branding.customDomain} → app.consultify.com`;
                        navigator.clipboard?.writeText?.(text);
                      }}
                      type="button"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  <code className="text-slate-700 dark:text-slate-300">
                    {branding.customDomain} → app.consultify.com
                  </code>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-navy-700">
            <span className="text-sm text-slate-700 dark:text-slate-300">SSL Certificate</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                branding.customDomainSslStatus === 'active'
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : branding.customDomainSslStatus === 'failed'
                    ? 'bg-danger-500/10 text-danger-600'
                    : 'bg-amber-500/10 text-amber-600'
              }`}
            >
              {branding.customDomainSslStatus === 'active'
                ? 'Active'
                : branding.customDomainSslStatus === 'failed'
                  ? 'Failed'
                  : 'Pending'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (!selectedOrg) {
    return (
      <div className="space-y-6 relative">
        <InfoButton cardId="superadmin-whitelabel" position="top-right" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              White-label Studio
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Customize branding for organizations
            </p>
          </div>
          <InfoButton
            cardId="superadmin-whitelabel"
            position="header-inline"
            size="md"
            showLabel
            label="Help"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-500/30 transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-xl">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex items-center gap-2">
                    {org.hasBranding && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(org.id);
                        }}
                        className="p-2 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg text-slate-600 dark:text-slate-500 hover:text-danger-500 transition-colors"
                        title="Reset to defaults"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleSelectOrg(org.id)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                    >
                      <ChevronRight
                        size={20}
                        className="text-slate-600 dark:text-slate-500 group-hover:text-primary-500 transition-colors"
                      />
                    </button>
                  </div>
                </div>
                <button onClick={() => handleSelectOrg(org.id)} className="text-left w-full">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{org.name}</h3>
                  <div className="mt-2">
                    {org.hasBranding ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-500/10 text-primary-600">
                        <Palette size={12} />
                        Custom Branding
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 dark:bg-navy-800/10 text-slate-600 dark:text-slate-400">
                        Default Theme
                      </span>
                    )}
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <InfoButton cardId="superadmin-whitelabel" position="top-right" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedOrg(null)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
          >
            <ChevronRight size={20} className="rotate-180 text-slate-600 dark:text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {organizations.find((o) => o.id === selectedOrg)?.name} - Branding
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Customize the look and feel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <InfoButton
            cardId="superadmin-whitelabel"
            position="header-inline"
            size="md"
            showLabel
            label="Help"
          />
          <button className="px-4 py-2 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/20 flex items-center gap-2">
            <Eye size={16} />
            Preview
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-danger-50 dark:bg-danger-500/10 border-danger-200 dark:border-danger-500/20 text-danger-700 dark:text-danger-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {message.text}
          </div>
        </div>
      )}

      {brandingLoadError && (
        <div className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300">
          <div className="flex items-center justify-between gap-3">
            <span>
              {brandingLoadError}. Showing unsaved defaults until the organization branding loads.
            </span>
            <button
              onClick={() => selectedOrg && fetchBranding(selectedOrg)}
              className="px-3 py-1.5 rounded-md bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-sm font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-lg w-fit">
        {[
          { id: 'brand', label: 'Brand Identity', icon: <Image size={16} /> },
          { id: 'colors', label: 'Colors & Theme', icon: <Palette size={16} /> },
          { id: 'typography', label: 'Typography', icon: <Type size={16} /> },
          { id: 'login', label: 'Login Page', icon: <Monitor size={16} /> },
          { id: 'domain', label: 'Custom Domain', icon: <Globe size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
        {activeTab === 'brand' && renderBrandTab()}
        {activeTab === 'colors' && renderColorsTab()}
        {activeTab === 'typography' && renderTypographyTab()}
        {activeTab === 'login' && renderLoginTab()}
        {activeTab === 'domain' && renderDomainTab()}
      </div>
    </div>
  );
};

export default WhitelabelStudioView;
