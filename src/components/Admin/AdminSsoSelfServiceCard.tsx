/**
 * HP-24 — SSO self-service: org-admin configures their OWN organization's
 * SAML/OIDC IdP metadata, without superadmin involvement.
 *
 * Dobudowane do istniejącego `AdminSecurityPolicyPanel` (karta "SSO posture"
 * tam już pozwala włączyć/wyłączyć SSO i nazwać providera — ale nie ma pól
 * na faktyczne metadane IdP, więc login SSO nigdy nie działał dla
 * self-service org). Ten komponent dobudowuje właśnie te pola, czytając/
 * zapisując `/api/admin/sso-self` (org-scoped, zob. adminP32.routes.ts).
 *
 * Za flagą `ssoSelfServiceFlag` (default OFF) — patrz src/utils/ssoSelfServiceFlag.ts.
 */
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { DegradedState } from './AdminState';

type SsoSelfConfig = {
  organizationId: string;
  configured: boolean;
  isEnabled: boolean;
  protocol: 'saml' | 'oidc';
  providerName: string;
  providerType: string;
  domains: string[];
  saml: {
    entityId: string;
    ssoUrl: string;
    sloUrl: string;
    nameIdFormat: string;
    certificateSet: boolean;
  };
  oidc: {
    issuer: string;
    clientId: string;
    clientSecretSet: boolean;
    authorizationUrl: string;
    tokenUrl: string;
    userinfoUrl: string;
    scopes: string;
  };
  updatedAt: string | null;
};

const EMPTY_CONFIG: SsoSelfConfig = {
  organizationId: '',
  configured: false,
  isEnabled: false,
  protocol: 'saml',
  providerName: '',
  providerType: 'custom',
  domains: [],
  saml: {
    entityId: '',
    ssoUrl: '',
    sloUrl: '',
    nameIdFormat: 'emailAddress',
    certificateSet: false,
  },
  oidc: {
    issuer: '',
    clientId: '',
    clientSecretSet: false,
    authorizationUrl: '',
    tokenUrl: '',
    userinfoUrl: '',
    scopes: 'openid profile email',
  },
  updatedAt: null,
};

const inputClass =
  'w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text';

export const AdminSsoSelfServiceCard: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<SsoSelfConfig>(EMPTY_CONFIG);
  const [domainsInput, setDomainsInput] = useState('');
  const [samlCertificate, setSamlCertificate] = useState('');
  const [oidcClientSecret, setOidcClientSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; errors: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await Api.getAdminSsoSelfConfig();
      const next: SsoSelfConfig = { ...EMPTY_CONFIG, ...(response?.config || {}) };
      setConfig(next);
      setDomainsInput((next.domains || []).join(', '));
      setSamlCertificate('');
      setOidcClientSecret('');
      setTestResult(null);
    } catch (error: any) {
      setLoadError(
        error?.message || t('ssoSelfService.errors.load', 'Failed to load SSO configuration')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const buildPayload = () => ({
    protocol: config.protocol,
    providerName: config.providerName || 'Custom SSO',
    providerType: config.providerType || 'custom',
    isEnabled: config.isEnabled,
    domains: domainsInput
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean),
    saml: {
      entityId: config.saml.entityId,
      ssoUrl: config.saml.ssoUrl,
      sloUrl: config.saml.sloUrl,
      nameIdFormat: config.saml.nameIdFormat,
      ...(samlCertificate.trim() ? { certificate: samlCertificate.trim() } : {}),
    },
    oidc: {
      issuer: config.oidc.issuer,
      clientId: config.oidc.clientId,
      authorizationUrl: config.oidc.authorizationUrl,
      tokenUrl: config.oidc.tokenUrl,
      userinfoUrl: config.oidc.userinfoUrl,
      scopes: config.oidc.scopes,
      ...(oidcClientSecret.trim() ? { clientSecret: oidcClientSecret.trim() } : {}),
    },
  });

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await Api.validateAdminSsoSelfConfig(buildPayload());
      setTestResult({ valid: Boolean(result?.valid), errors: result?.errors || [] });
      if (result?.valid) {
        toast.success(t('ssoSelfService.toasts.validConfig', 'Configuration looks complete'));
      }
    } catch (error: any) {
      toast.error(
        error?.message || t('ssoSelfService.errors.test', 'Failed to validate SSO configuration')
      );
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.updateAdminSsoSelfConfig(buildPayload());
      toast.success(t('ssoSelfService.toasts.saved', 'SSO configuration saved'));
      await load();
    } catch (error: any) {
      toast.error(
        error?.message || t('ssoSelfService.errors.save', 'Failed to save SSO configuration')
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-c-border bg-c-surface p-5">
        <div className="flex items-center gap-2 text-sm text-c-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('ssoSelfService.loading', 'Loading SSO configuration…')}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-c-border bg-c-surface p-5">
        <DegradedState
          title={t('ssoSelfService.errors.loadTitle', 'SSO configuration unavailable')}
          description={loadError}
        />
        <button
          onClick={() => void load()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          {t('ssoSelfService.actions.retry', 'Retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-c-border bg-c-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-c-text">
            <ShieldCheck className="h-4 w-4 text-primary-500" />
            {t('ssoSelfService.title', 'SSO configuration (SAML / OIDC)')}
          </div>
          <p className="mt-1 text-sm text-c-text-secondary">
            {t(
              'ssoSelfService.description',
              'Connect your own identity provider. This writes the metadata the login flow actually reads — separate from the toggle above.'
            )}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            config.configured
              ? 'bg-c-surface-raised text-c-success'
              : 'bg-c-surface-raised text-c-text-secondary'
          }`}
        >
          {config.configured
            ? t('ssoSelfService.status.configured', 'Configured')
            : t('ssoSelfService.status.notConfigured', 'Not configured')}
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-c-text-secondary">
          {t('ssoSelfService.fields.protocol', 'Protocol')}
          <select
            value={config.protocol}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                protocol: event.target.value === 'oidc' ? 'oidc' : 'saml',
              }))
            }
            className={`${inputClass} mt-1`}
          >
            <option value="saml">SAML 2.0</option>
            <option value="oidc">OIDC</option>
          </select>
        </label>
        <label className="block text-sm text-c-text-secondary">
          {t('ssoSelfService.fields.providerName', 'Provider name')}
          <input
            type="text"
            value={config.providerName}
            onChange={(event) =>
              setConfig((prev) => ({ ...prev, providerName: event.target.value }))
            }
            placeholder="Okta"
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="block text-sm text-c-text-secondary md:col-span-2">
          {t('ssoSelfService.fields.domains', 'Mapped domains (comma-separated)')}
          <input
            type="text"
            value={domainsInput}
            onChange={(event) => setDomainsInput(event.target.value)}
            placeholder="acme.com, acme.io"
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>

      {config.protocol === 'saml' ? (
        <div className="mt-4 space-y-3 rounded-lg border border-c-border p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
            {t('ssoSelfService.saml.heading', 'Identity provider (SAML)')}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-c-text-secondary">
              {t('ssoSelfService.saml.entityId', 'IdP entity ID')}
              <input
                type="text"
                value={config.saml.entityId}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    saml: { ...prev.saml, entityId: event.target.value },
                  }))
                }
                placeholder="urn:idp:example"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-sm text-c-text-secondary">
              {t('ssoSelfService.saml.ssoUrl', 'SSO URL')}
              <input
                type="text"
                value={config.saml.ssoUrl}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    saml: { ...prev.saml, ssoUrl: event.target.value },
                  }))
                }
                placeholder="https://idp.example.com/sso"
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>
          <label className="block text-sm text-c-text-secondary">
            {t('ssoSelfService.saml.certificate', 'X.509 certificate')}
            <textarea
              rows={4}
              value={samlCertificate}
              onChange={(event) => setSamlCertificate(event.target.value)}
              placeholder={
                config.saml.certificateSet
                  ? t(
                      'ssoSelfService.saml.certificatePlaceholderSet',
                      'Certificate on file — paste a new one to replace it'
                    )
                  : '-----BEGIN CERTIFICATE-----'
              }
              className={`${inputClass} mt-1 font-mono text-xs`}
            />
          </label>
        </div>
      ) : (
        <div className="mt-4 space-y-3 rounded-lg border border-c-border p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
            {t('ssoSelfService.oidc.heading', 'Identity provider (OIDC)')}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-c-text-secondary">
              {t('ssoSelfService.oidc.issuer', 'Issuer URL')}
              <input
                type="text"
                value={config.oidc.issuer}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    oidc: { ...prev.oidc, issuer: event.target.value },
                  }))
                }
                placeholder="https://idp.example.com"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-sm text-c-text-secondary">
              {t('ssoSelfService.oidc.clientId', 'Client ID')}
              <input
                type="text"
                value={config.oidc.clientId}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    oidc: { ...prev.oidc, clientId: event.target.value },
                  }))
                }
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>
          <label className="block text-sm text-c-text-secondary">
            {t('ssoSelfService.oidc.clientSecret', 'Client secret')}
            <input
              type="password"
              value={oidcClientSecret}
              onChange={(event) => setOidcClientSecret(event.target.value)}
              placeholder={
                config.oidc.clientSecretSet
                  ? t(
                      'ssoSelfService.oidc.clientSecretPlaceholderSet',
                      'Secret on file — enter a new one to replace it'
                    )
                  : t('ssoSelfService.oidc.clientSecretPlaceholder', 'Enter client secret')
              }
              className={`${inputClass} mt-1`}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-c-text-secondary">
              {t('ssoSelfService.oidc.authorizationUrl', 'Authorization URL (optional)')}
              <input
                type="text"
                value={config.oidc.authorizationUrl}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    oidc: { ...prev.oidc, authorizationUrl: event.target.value },
                  }))
                }
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-sm text-c-text-secondary">
              {t('ssoSelfService.oidc.tokenUrl', 'Token URL (optional)')}
              <input
                type="text"
                value={config.oidc.tokenUrl}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    oidc: { ...prev.oidc, tokenUrl: event.target.value },
                  }))
                }
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>
        </div>
      )}

      <label className="mt-4 flex items-center justify-between text-sm text-c-text-secondary">
        <span>{t('ssoSelfService.fields.isEnabled', 'Enable this configuration')}</span>
        <input
          type="checkbox"
          checked={config.isEnabled}
          onChange={(event) => setConfig((prev) => ({ ...prev, isEnabled: event.target.checked }))}
        />
      </label>

      {testResult && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm ${
            testResult.valid
              ? 'bg-c-surface-raised text-c-success'
              : 'bg-c-surface-raised text-c-warning'
          }`}
        >
          {testResult.valid ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            {testResult.valid ? (
              t('ssoSelfService.test.valid', 'Configuration is complete and ready to enable.')
            ) : (
              <ul className="list-disc space-y-0.5 pl-4">
                {testResult.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button
          onClick={() => void handleTestConnection()}
          disabled={testing}
          className="inline-flex items-center gap-2 rounded-lg border border-c-border px-4 py-2 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-50"
        >
          {testing && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('ssoSelfService.actions.testConnection', 'Test connection')}
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text text-c-bg px-4 py-2 text-sm font-medium hover:bg-c-text-secondary disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('ssoSelfService.actions.save', 'Save SSO configuration')}
        </button>
      </div>
    </div>
  );
};

export default AdminSsoSelfServiceCard;
