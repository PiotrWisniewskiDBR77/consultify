import React, { useState } from 'react';
import { Shield, Key, Lock, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Api } from '../../services/api';

/**
 * MFASetup Component
 * Allows users to enable/disable MFA via TOKP (Google Authenticator).
 */

interface MFASetupProps {
    isEnabled: boolean;
    onUpdate: () => void;
}

export const MFASetup: React.FC<MFASetupProps> = ({ isEnabled, onUpdate }) => {
    const [step, setStep] = useState<'initial' | 'setup' | 'verify' | 'backup'>('initial');
    const [qrCode, setQrCode] = useState<string>('');
    const [secret, setSecret] = useState<string>('');
    const [verificationCode, setVerificationCode] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [disableConfirm, setDisableConfirm] = useState(false);
    const [loading, setLoading] = useState(false);

    const startSetup = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await Api.post('/auth/mfa/setup', {});
            setQrCode(res.data.qrCode);
            setSecret(res.data.manualEntry);
            setStep('setup');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to start MFA setup');
        } finally {
            setLoading(false);
        }
    };

    const verifyAndEnable = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await Api.post('/auth/mfa/enable', { token: verificationCode });
            if (res.data.success) {
                setBackupCodes(res.data.backupCodes || []);
                setStep('backup');
                onUpdate();
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Invalid code');
        } finally {
            setLoading(false);
        }
    };

    const disableMFA = async () => {
        setLoading(true);
        setError(null);
        try {
            // Check if disable requires code? Usually strict security does, 
            // but for simplicity in this flow we might just ask password or code. 
            // The backend endpoint requires 'token' (TOTP) to disable.
            const res = await Api.post('/auth/mfa/disable', { token: verificationCode });
            if (res.data.success) {
                setDisableConfirm(false);
                setVerificationCode('');
                onUpdate();
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Invalid code or failure');
        } finally {
            setLoading(false);
        }
    };

    if (isEnabled && !disableConfirm) {
        return (
            <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-green-200 dark:border-green-900/30">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                        <Shield size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                            Two-Factor Authentication is Active
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Your account is secured with 2FA.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setDisableConfirm(true)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium hover:underline"
                >
                    Disable 2FA
                </button>
            </div>
        );
    }

    if (disableConfirm) {
        return (
            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-6 border border-red-200 dark:border-red-900/30">
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Disable 2FA?</h3>
                <p className="text-sm text-red-600/80 mb-4">
                    This will lower your account security. Please enter a 2FA code to confirm disabling.
                </p>
                <div className="flex gap-2 max-w-xs mb-4">
                    <input
                        type="text"
                        placeholder="123456"
                        maxLength={6}
                        className="form-input"
                        value={verificationCode}
                        onChange={e => setVerificationCode(e.target.value)}
                    />
                </div>
                {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
                <div className="flex gap-2">
                    <button
                        onClick={disableMFA}
                        disabled={loading || verificationCode.length !== 6}
                        className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                        {loading ? 'Disabling...' : 'Verify & Disable'}
                    </button>
                    <button
                        onClick={() => { setDisableConfirm(false); setVerificationCode(''); setError(null); }}
                        className="btn btn-ghost"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
            {step === 'initial' && (
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <Lock size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-1">
                            Two-Factor Authentication (2FA)
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Add an extra layer of security to your account by requiring a code from your phone when logging in.
                        </p>
                        <button
                            onClick={startSetup}
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Starting...' : 'Enable 2FA'}
                        </button>
                        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    </div>
                </div>
            )}

            {step === 'setup' && (
                <div>
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4">
                        Step 1: Scan QR Code
                    </h3>
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="bg-white p-4 rounded-lg border border-slate-200 inline-block">
                            <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
                        </div>
                        <div className="flex-1 space-y-4">
                            <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Can't scan? Enter code manually:
                                </p>
                                <code className="bg-slate-100 dark:bg-navy-900 px-3 py-1 rounded text-sm font-mono select-all">
                                    {secret}
                                </code>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-navy-700">
                                <h4 className="text-sm font-bold text-navy-900 dark:text-white mb-2">
                                    Step 2: Enter Verification Code
                                </h4>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="form-input w-32 text-center tracking-widest font-mono text-lg"
                                        placeholder="000000"
                                        maxLength={6}
                                        value={verificationCode}
                                        onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                                    />
                                    <button
                                        onClick={verifyAndEnable}
                                        disabled={loading || verificationCode.length !== 6}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                                    >
                                        {loading ? 'Verifying...' : 'Verify & Enable'}
                                    </button>
                                </div>
                                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setStep('initial')}
                        className="mt-4 text-sm text-slate-500 hover:text-slate-700"
                    >
                        Cancel Setup
                    </button>
                </div>
            )}

            {step === 'backup' && (
                <div>
                    <div className="flex items-center gap-2 mb-4 text-green-600">
                        <CheckCircle size={24} />
                        <h3 className="text-lg font-bold">2FA Enabled Successfully!</h3>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-5 mb-6">
                        <div className="flex gap-3 mb-3">
                            <AlertTriangle className="text-amber-500 shrink-0" />
                            <div>
                                <h4 className="font-bold text-amber-800 dark:text-amber-500 text-sm">
                                    Save your backup codes
                                </h4>
                                <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-1">
                                    If you lose access to your phone, these codes are the ONLY way to access your account.
                                    Save them somewhere safe. Each code can be used only once.
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-white dark:bg-navy-900 p-4 rounded-lg border border-amber-100 dark:border-navy-700">
                            {backupCodes.map((code, i) => (
                                <div key={i} className="text-slate-600 dark:text-slate-300 select-all">
                                    {code}
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => setStep('initial')}
                        className="bg-slate-900 dark:bg-white text-white dark:text-navy-900 px-6 py-2 rounded-lg font-bold"
                    >
                        I have saved my codes
                    </button>
                </div>
            )}
        </div>
    );
};
