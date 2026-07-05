// @ts-nocheck
/**
 * EmailConfigurationPanel - Email Configuration Management
 *
 * Features:
 * - SMTP full config (username, password, TLS)
 * - Email provider selection (SMTP, SendGrid, Mailgun)
 * - DNS verification status (SPF, DKIM)
 * - Test email button
 */

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Info,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Save,
  Send,
  Server,
  Shield,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

interface EmailConfig {
  id?: string;
  organization_id: string;
  provider: 'smtp' | 'sendgrid' | 'mailgun' | 'ses';
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password_encrypted?: string;
  smtp_use_tls?: boolean;
  from_email?: string;
  from_name?: string;
  reply_to_email?: string;
  api_key_encrypted?: string;
  domain?: string;
  region?: string;
  spf_verified: boolean;
  dkim_verified: boolean;
  dmarc_verified: boolean;
  last_verified_at?: string;
}

interface Organization {
  id: string;
  name: string;
}

const PROVIDERS = [
  { id: 'smtp', name: 'Custom SMTP', description: 'Use your own SMTP server' },
  { id: 'sendgrid', name: 'SendGrid', description: 'Twilio SendGrid email service' },
  { id: 'mailgun', name: 'Mailgun', description: 'Mailgun email delivery' },
  { id: 'ses', name: 'Amazon SES', description: 'AWS Simple Email Service' },
];

export const EmailConfigurationPanel: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const fetchOrganizations = useCallback(async () => {
    try {
      const orgs = await Api.getOrganizations();
      setOrganizations(orgs);
      if (orgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  }, [selectedOrgId]);

  const fetchConfig = useCallback(async () => {
    if (!selectedOrgId) return;

    setLoading(true);
    try {
      const result = await Api.get(`/settings/email-config?organizationId=${selectedOrgId}`);
      setConfig(
        result.config || {
          organization_id: selectedOrgId,
          provider: 'smtp',
          smtp_port: 587,
          smtp_use_tls: true,
          spf_verified: false,
          dkim_verified: false,
          dmarc_verified: false,
        }
      );
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to fetch email config:', error);
      setConfig({
        organization_id: selectedOrgId,
        provider: 'smtp',
        smtp_port: 587,
        smtp_use_tls: true,
        spf_verified: false,
        dkim_verified: false,
        dmarc_verified: false,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    if (selectedOrgId) {
      fetchConfig();
    }
  }, [selectedOrgId, fetchConfig]);

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      await Api.put(`/settings/email-config?organizationId=${selectedOrgId}`, config);
      toast.success('Email configuration saved');
      setHasChanges(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }

    setTesting(true);
    try {
      await Api.post(`/settings/email-config/test?organizationId=${selectedOrgId}`, {
        email: testEmail,
      });
      toast.success('Test email sent');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  const handleVerifyDNS = async () => {
    setVerifying(true);
    try {
      const result = await Api.post(
        `/settings/email-config/verify-dns?organizationId=${selectedOrgId}`,
        {}
      );
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              spf_verified: result.spf,
              dkim_verified: result.dkim,
              dmarc_verified: result.dmarc,
              last_verified_at: new Date().toISOString(),
            }
          : null
      );
      toast.success('DNS verification completed');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'DNS verification failed';
      toast.error(errorMessage);
    } finally {
      setVerifying(false);
    }
  };

  const updateConfig = (field: keyof EmailConfig, value: any) => {
    if (!config) return;
    setConfig((prev) => (prev ? { ...prev, [field]: value } : null));
    setHasChanges(true);
  };

  const renderSMTPConfig = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">SMTP Host</label>
          <input
            type="text"
            value={config?.smtp_host || ''}
            onChange={(e) => updateConfig('smtp_host', e.target.value)}
            placeholder="smtp.example.com"
            className="w-full px-4 py-2.5 bg-c-surface/50 border border-white/10 rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Port</label>
          <input
            type="number"
            value={config?.smtp_port || 587}
            onChange={(e) => updateConfig('smtp_port', parseInt(e.target.value))}
            className="w-full px-4 py-2.5 bg-c-surface/50 border border-white/10 rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
          <input
            type="text"
            value={config?.smtp_username || ''}
            onChange={(e) => updateConfig('smtp_username', e.target.value)}
            className="w-full px-4 py-2.5 bg-c-surface/50 border border-white/10 rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={config?.smtp_password_encrypted || ''}
              onChange={(e) => updateConfig('smtp_password_encrypted', e.target.value)}
              className="w-full px-4 py-2.5 pr-10 bg-c-surface/50 border border-white/10 rounded-lg text-c-text focus:border-primary-500/50 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-white"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={config?.smtp_use_tls || false}
          onChange={(e) => updateConfig('smtp_use_tls', e.target.checked)}
          className="w-5 h-5 rounded border-slate-600 bg-c-surface-raised text-primary-500"
        />
        <div>
          <span className="text-slate-300">Use TLS</span>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Encrypt connection with TLS/SSL
          </p>
        </div>
      </label>
    </div>
  );

  const renderAPIConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">API Key</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={config?.api_key_encrypted || ''}
            onChange={(e) => updateConfig('api_key_encrypted', e.target.value)}
            placeholder={`Your ${PROVIDERS.find((p) => p.id === config?.provider)?.name} API key`}
            className="w-full px-4 py-2.5 pr-10 bg-c-surface/50 border border-white/10 rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-white"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {config?.provider === 'mailgun' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Domain</label>
          <input
            type="text"
            value={config?.domain || ''}
            onChange={(e) => updateConfig('domain', e.target.value)}
            placeholder="mg.example.com"
            className="w-full px-4 py-2.5 bg-c-surface/50 border border-white/10 rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none"
          />
        </div>
      )}

      {config?.provider === 'ses' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">AWS Region</label>
          <select
            value={config?.region || 'us-east-1'}
            onChange={(e) => updateConfig('region', e.target.value)}
            className="w-full px-4 py-2.5 bg-c-surface/50 border border-white/10 rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          >
            <option value="us-east-1">US East (N. Virginia)</option>
            <option value="us-west-2">US West (Oregon)</option>
            <option value="eu-west-1">EU (Ireland)</option>
            <option value="eu-central-1">EU (Frankfurt)</option>
          </select>
        </div>
      )}
    </div>
  );

  const renderDNSVerification = () => (
    <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Shield size={20} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-c-text">DNS Verification</h3>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Email authentication records
            </p>
          </div>
        </div>
        <button
          onClick={handleVerifyDNS}
          disabled={verifying}
          className="flex items-center gap-2 px-3 py-2 bg-c-surface-raised hover:bg-slate-600 rounded-lg text-c-text text-sm transition-colors disabled:opacity-50"
        >
          {verifying ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Verify DNS
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { key: 'spf_verified', label: 'SPF', description: 'Sender Policy Framework' },
          { key: 'dkim_verified', label: 'DKIM', description: 'DomainKeys Identified Mail' },
          { key: 'dmarc_verified', label: 'DMARC', description: 'Domain-based Message Auth' },
        ].map(({ key, label, description }) => (
          <div
            key={key}
            className={`p-4 rounded-lg border ${
              config?.[key as keyof EmailConfig]
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-c-surface/50 border-white/[0.06]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {config?.[key as keyof EmailConfig] ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : (
                <XCircle size={16} className="text-slate-500 dark:text-slate-400" />
              )}
              <span className="font-medium text-c-text">{label}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        ))}
      </div>

      {config?.last_verified_at && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
          Last verified: {new Date(config.last_verified_at).toLocaleString()}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <select
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="px-4 py-2.5 bg-c-surface-raised border border-white/10 rounded-lg text-c-text focus:border-primary-500/50 outline-none min-w-[200px]"
        >
          <option value="" disabled>
            Select Organization
          </option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchConfig}
            className="p-2.5 bg-c-surface-raised hover:bg-c-surface-raised rounded-lg transition-colors"
          >
            <RefreshCw
              size={18}
              className={`text-slate-400 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Changes
          </button>
        </div>
      </div>

      {!selectedOrgId ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
          <Building2 size={48} className="mb-4 opacity-50" />
          <p>Select an organization to configure email</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : (
        config && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Provider Selection & Config */}
            <div className="space-y-6">
              <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                    <Server size={20} className="text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-c-text">Email Provider</h3>
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      Choose your email service
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => updateConfig('provider', provider.id)}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        config.provider === provider.id
                          ? 'bg-primary-500/20 border-primary-500/50'
                          : 'bg-c-surface/50 border-white/[0.06] hover:border-white/20'
                      }`}
                    >
                      <p
                        className={`font-medium ${config.provider === provider.id ? 'text-primary-400' : 'text-c-text'}`}
                      >
                        {provider.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {provider.description}
                      </p>
                    </button>
                  ))}
                </div>

                {config.provider === 'smtp' ? renderSMTPConfig() : renderAPIConfig()}
              </div>

              {/* From Settings */}
              <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Mail size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-c-text">Sender Settings</h3>
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      Configure email sender details
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        From Email
                      </label>
                      <input
                        type="email"
                        value={config.from_email || ''}
                        onChange={(e) => updateConfig('from_email', e.target.value)}
                        placeholder="noreply@example.com"
                        className="w-full px-4 py-2.5 bg-c-surface/50 border border-white/10 rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        From Name
                      </label>
                      <input
                        type="text"
                        value={config.from_name || ''}
                        onChange={(e) => updateConfig('from_name', e.target.value)}
                        placeholder="Consultify"
                        className="w-full px-4 py-2.5 bg-c-surface/50 border border-white/10 rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Reply-To Email (optional)
                    </label>
                    <input
                      type="email"
                      value={config.reply_to_email || ''}
                      onChange={(e) => updateConfig('reply_to_email', e.target.value)}
                      placeholder="support@example.com"
                      className="w-full px-4 py-2.5 bg-c-surface/50 border border-white/10 rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* DNS & Test */}
            <div className="space-y-6">
              {renderDNSVerification()}

              {/* Test Email */}
              <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Send size={20} className="text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-c-text">Test Configuration</h3>
                    <p className="text-sm text-slate-400 dark:text-slate-500">Send a test email</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                    className="flex-1 px-4 py-2.5 bg-c-surface/50 border border-white/10 rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none"
                  />
                  <button
                    onClick={handleTestEmail}
                    disabled={testing}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
                  >
                    {testing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    Send Test
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <Info size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-300">
                    <strong>Recommended:</strong> Set up SPF, DKIM, and DMARC records to improve
                    email deliverability and prevent spoofing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default EmailConfigurationPanel;
