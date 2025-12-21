import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Smartphone, Key, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react';

interface MFASetupProps {
    onComplete: () => void;
    onCancel: () => void;
}

interface SetupData {
    qrCode: string;
    manualEntry: string;
}

const MFASetup: React.FC<MFASetupProps> = ({ onComplete, onCancel }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState<'intro' | 'scan' | 'verify' | 'backup'>('intro');
    const [setupData, setSetupData] = useState<SetupData | null>(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [backupCodesCopied, setBackupCodesCopied] = useState(false);

    // Initialize MFA setup
    const initSetup = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/mfa/setup', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setSetupData(data);
            setStep('scan');
        } catch (err: any) {
            setError(err.message || 'Failed to initialize MFA setup');
        } finally {
            setLoading(false);
        }
    };

    // Verify TOTP and enable MFA
    const verifyAndEnable = async () => {
        if (verificationCode.length !== 6) {
            setError('Please enter a 6-digit code');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/mfa/verify-setup', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: verificationCode })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setBackupCodes(data.backupCodes);
            setStep('backup');
        } catch (err: any) {
            setError(err.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    // Copy secret to clipboard
    const copySecret = () => {
        if (setupData?.manualEntry) {
            navigator.clipboard.writeText(setupData.manualEntry);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Copy backup codes
    const copyBackupCodes = () => {
        navigator.clipboard.writeText(backupCodes.join('\n'));
        setBackupCodesCopied(true);
        setTimeout(() => setBackupCodesCopied(false), 2000);
    };

    // Handle code input
    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
        setVerificationCode(value);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <Shield className="w-8 h-8 text-white" />
                        <div>
                            <h2 className="text-xl font-semibold text-white">
                                {t('mfa.setup.title', 'Two-Factor Authentication')}
                            </h2>
                            <p className="text-blue-100 text-sm">
                                {t('mfa.setup.subtitle', 'Add an extra layer of security')}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {/* Error Display */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Step: Introduction */}
                    {step === 'intro' && (
                        <div className="space-y-4">
                            <p className="text-gray-600 dark:text-gray-300">
                                {t('mfa.setup.intro', 'Two-factor authentication adds an extra layer of security to your account. You\'ll need your phone to sign in.')}
                            </p>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        {t('mfa.setup.step1', '1. Download an authenticator app (Google Authenticator, Authy, etc.)')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        {t('mfa.setup.step2', '2. Scan the QR code or enter the secret manually')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        {t('mfa.setup.step3', '3. Enter the code from your app to verify')}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={onCancel}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button
                                    onClick={initSetup}
                                    disabled={loading}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    {t('mfa.setup.continue', 'Continue')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: Scan QR Code */}
                    {step === 'scan' && setupData && (
                        <div className="space-y-4">
                            <p className="text-gray-600 dark:text-gray-300 text-center">
                                {t('mfa.setup.scanQr', 'Scan this QR code with your authenticator app')}
                            </p>

                            {/* QR Code */}
                            <div className="flex justify-center">
                                <div className="bg-white p-4 rounded-lg shadow-inner">
                                    <img
                                        src={setupData.qrCode}
                                        alt="MFA QR Code"
                                        className="w-48 h-48"
                                    />
                                </div>
                            </div>

                            {/* Manual Entry */}
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                    {t('mfa.setup.manualEntry', 'Or enter this code manually:')}
                                </p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-sm bg-white dark:bg-gray-800 px-3 py-2 rounded border dark:border-gray-600 font-mono break-all">
                                        {setupData.manualEntry}
                                    </code>
                                    <button
                                        onClick={copySecret}
                                        className="p-2 text-gray-500 hover:text-blue-600 transition"
                                        title="Copy"
                                    >
                                        {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep('verify')}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                {t('mfa.setup.next', 'I\'ve scanned the code')}
                            </button>
                        </div>
                    )}

                    {/* Step: Verify Code */}
                    {step === 'verify' && (
                        <div className="space-y-4">
                            <p className="text-gray-600 dark:text-gray-300 text-center">
                                {t('mfa.setup.enterCode', 'Enter the 6-digit code from your authenticator app')}
                            </p>

                            <div className="flex justify-center">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={verificationCode}
                                    onChange={handleCodeChange}
                                    placeholder="000000"
                                    className="text-center text-3xl font-mono tracking-[0.5em] w-48 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:bg-gray-700 dark:text-white"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('scan')}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                >
                                    {t('common.back', 'Back')}
                                </button>
                                <button
                                    onClick={verifyAndEnable}
                                    disabled={loading || verificationCode.length !== 6}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    {t('mfa.setup.verify', 'Verify & Enable')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: Backup Codes */}
                    {step === 'backup' && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mb-3">
                                    <Check className="w-6 h-6 text-green-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {t('mfa.setup.enabled', 'Two-Factor Authentication Enabled!')}
                                </h3>
                            </div>

                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                            {t('mfa.setup.saveBackupCodes', 'Save your backup codes!')}
                                        </p>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                            {t('mfa.setup.backupCodesWarning', 'These codes can be used to access your account if you lose your authenticator. Each code can only be used once.')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Backup Codes Grid */}
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <div className="grid grid-cols-2 gap-2">
                                    {backupCodes.map((code, index) => (
                                        <code key={index} className="text-sm bg-white dark:bg-gray-800 px-3 py-2 rounded border dark:border-gray-600 font-mono text-center">
                                            {code}
                                        </code>
                                    ))}
                                </div>
                                <button
                                    onClick={copyBackupCodes}
                                    className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition"
                                >
                                    {backupCodesCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {backupCodesCopied ? t('common.copied', 'Copied!') : t('mfa.setup.copyAll', 'Copy all codes')}
                                </button>
                            </div>

                            <button
                                onClick={onComplete}
                                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                            >
                                {t('mfa.setup.done', 'I\'ve saved my backup codes')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MFASetup;
