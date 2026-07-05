/**
 * WebAuthn Settings Component
 *
 * Allows users to manage passkeys/security keys for passwordless authentication.
 * Supports registration, viewing, renaming, and revoking of credentials.
 */

import {
  AlertTriangle,
  Check,
  Edit2,
  Fingerprint,
  Key,
  Laptop,
  Plus,
  RefreshCw,
  Shield,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed';
import { LoadingState } from '@/components/ui/primitives';

import { api } from '../../../services/api';

interface WebAuthnCredential {
  id: string;
  deviceName: string | null;
  deviceType: 'platform' | 'cross-platform' | 'unknown';
  createdAt: string;
  lastUsedAt: string | null;
  usageCount: number;
  isActive: boolean;
  backupEligible: boolean;
  backupState: boolean;
}

const WebAuthnSettings: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);
  const [isSupported, setIsSupported] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Check WebAuthn support
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === 'function';
    setIsSupported(supported);
  }, []);

  // Fetch credentials
  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/auth/webauthn/credentials');
      setCredentials(response.data.data || []);
    } catch (err) {
      console.error('[WebAuthn] Fetch error:', err);
      setError('Failed to load passkeys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // Register new passkey
  const handleRegister = async () => {
    if (!isSupported) return;

    setRegistering(true);
    setError(null);

    try {
      // Get registration options from server
      const optionsResponse = await api.post('/auth/webauthn/register/options', {});
      const { challengeId, options } = optionsResponse.data.data;

      // Convert base64url to ArrayBuffer
      const challenge = base64URLToArrayBuffer(options.challenge);
      const userId = base64URLToArrayBuffer(options.user.id);

      // Prepare credential creation options
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: options.rp,
        user: {
          ...options.user,
          id: userId,
        },
        pubKeyCredParams: options.pubKeyCredParams,
        authenticatorSelection: options.authenticatorSelection,
        timeout: options.timeout,
        attestation: options.attestation as AttestationConveyancePreference,
      };

      if (options.excludeCredentials) {
        publicKeyCredentialCreationOptions.excludeCredentials = options.excludeCredentials.map(
          (cred: any) => ({
            ...cred,
            id: base64URLToArrayBuffer(cred.id),
          })
        );
      }

      // Create credential
      const credential = (await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      })) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      const attestationResponse = credential.response as AuthenticatorAttestationResponse;

      // Send response to server
      const verifyResponse = await api.post('/auth/webauthn/register/verify', {
        challengeId,
        response: {
          id: credential.id,
          rawId: arrayBufferToBase64URL(credential.rawId),
          type: credential.type,
          response: {
            clientDataJSON: arrayBufferToBase64URL(attestationResponse.clientDataJSON),
            attestationObject: arrayBufferToBase64URL(attestationResponse.attestationObject),
            transports: attestationResponse.getTransports?.() || [],
          },
          authenticatorAttachment: (credential as any).authenticatorAttachment,
        },
        deviceName: getDefaultDeviceName(),
      });

      if (verifyResponse.data.success) {
        fetchCredentials();
      }
    } catch (err: any) {
      console.error('[WebAuthn] Registration error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Registration was cancelled or denied');
      } else if (err.name === 'InvalidStateError') {
        setError('This authenticator is already registered');
      } else {
        setError(err.message || 'Failed to register passkey');
      }
    } finally {
      setRegistering(false);
    }
  };

  // Rename credential
  const handleRename = async (credentialId: string) => {
    if (!newName.trim()) return;

    try {
      await api.patch(`/auth/webauthn/credentials/${credentialId}`, {
        deviceName: newName,
      });
      setCredentials(
        credentials.map((c) => (c.id === credentialId ? { ...c, deviceName: newName } : c))
      );
      setEditingId(null);
      setNewName('');
    } catch (err) {
      console.error('[WebAuthn] Rename error:', err);
      setError('Failed to rename passkey');
    }
  };

  // Revoke credential
  const handleRevoke = async (credentialId: string) => {
    if (
      !confirm(
        'Are you sure you want to remove this passkey? You will need to use another authentication method.'
      )
    ) {
      return;
    }

    try {
      await api.delete(`/auth/webauthn/credentials/${credentialId}`);
      setCredentials(credentials.filter((c) => c.id !== credentialId));
    } catch (err) {
      console.error('[WebAuthn] Revoke error:', err);
      setError('Failed to remove passkey');
    }
  };

  // Helper functions
  function base64URLToArrayBuffer(base64URL: string): ArrayBuffer {
    const base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(base64 + padding);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function arrayBufferToBase64URL(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function getDefaultDeviceName(): string {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows PC';
    if (/Android/.test(ua)) return 'Android Device';
    if (/Linux/.test(ua)) return 'Linux Device';
    return 'Unknown Device';
  }

  function getDeviceIcon(deviceType: string) {
    switch (deviceType) {
      case 'platform':
        return <Laptop className="text-c-accent" size={20} />;
      case 'cross-platform':
        return <Key className="text-amber-400" size={20} />;
      default:
        return (
          <Smartphone className="text-c-text-secondary" size={20} />
        );
    }
  }

  if (!isSupported) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-medium text-amber-300">Passkeys Not Supported</h4>
            <p className="text-sm text-amber-200/70 mt-1">
              Your browser or device doesn't support passkeys (WebAuthn). Please use a modern
              browser like Chrome, Safari, Firefox, or Edge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Passkeys & Security Keys</h3>
          <p className="text-sm text-c-text-secondary mt-1">
            Use biometrics or security keys for secure passwordless login
          </p>
        </div>
        <button
          onClick={handleRegister}
          disabled={registering}
          className="flex items-center gap-2 px-4 py-2 bg-c-accent hover:bg-c-accent disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {registering ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
          {registering ? 'Registering...' : 'Add Passkey'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="text-rose-400 flex-shrink-0" size={20} />
          <p className="text-rose-300 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-rose-400 hover:text-rose-300"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-c-accent-soft border border-c-accent rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Fingerprint className="text-c-accent flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm">
            <p className="text-c-accent font-medium">What are passkeys?</p>
            <p className="text-c-text-muted mt-1">
              Passkeys are a secure replacement for passwords. They use your device's biometrics
              (Face ID, Touch ID, fingerprint) or a physical security key to verify your identity.
            </p>
          </div>
        </div>
      </div>

      {/* Credentials List */}
      {loading ? (
        <LoadingState variant="spinner" />
      ) : credentials.length === 0 ? (
        <EmptyState
          icon={<Key />}
          title="No passkeys registered"
          description="Add a passkey to enable passwordless login"
        />
      ) : (
        <div className="space-y-3">
          {credentials.map((credential) => (
            <div
              key={credential.id}
              className="bg-c-surface border border-c-border-strong rounded-xl p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-c-surface flex items-center justify-center">
                    {getDeviceIcon(credential.deviceType)}
                  </div>
                  <div>
                    {editingId === credential.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Enter new name"
                          className="px-2 py-1 bg-c-surface border border-c-border-strong rounded text-white text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRename(credential.id)}
                          className="p-1 text-green-400 hover:text-green-300"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setNewName('');
                          }}
                          className="p-1 text-c-text-secondary hover:text-c-text-muted"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h4 className="font-medium text-white">
                          {credential.deviceName || 'Unnamed Passkey'}
                        </h4>
                        <div className="flex items-center gap-3 text-sm text-c-text-secondary">
                          <span>Added {new Date(credential.createdAt).toLocaleDateString()}</span>
                          {credential.lastUsedAt && (
                            <span>
                              • Last used {new Date(credential.lastUsedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {credential.backupEligible && (
                    <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded">
                      Synced
                    </span>
                  )}
                  {editingId !== credential.id && (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(credential.id);
                          setNewName(credential.deviceName || '');
                        }}
                        className="p-2 text-c-text-secondary hover:text-white hover:bg-c-surface rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleRevoke(credential.id)}
                        className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Security Tips */}
      <div className="bg-c-surface border border-c-border-strong rounded-xl p-4">
        <h4 className="font-medium text-white mb-3">Security Tips</h4>
        <ul className="space-y-2 text-sm text-c-text-secondary">
          <li className="flex items-start gap-2">
            <Shield className="text-green-400 flex-shrink-0 mt-0.5" size={16} />
            Register passkeys on multiple devices for backup access
          </li>
          <li className="flex items-start gap-2">
            <Shield className="text-green-400 flex-shrink-0 mt-0.5" size={16} />
            Remove passkeys from devices you no longer use
          </li>
          <li className="flex items-start gap-2">
            <Shield className="text-green-400 flex-shrink-0 mt-0.5" size={16} />
            Consider using a hardware security key for high-security accounts
          </li>
        </ul>
      </div>
    </div>
  );
};

export default WebAuthnSettings;
