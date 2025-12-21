import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Key, Loader2, AlertTriangle } from 'lucide-react';

interface MFAChallengeProps {
    onVerify: (success: boolean) => void;
    onCancel?: () => void;
    trustDeviceOption?: boolean;
}

const MFAChallenge: React.FC<MFAChallengeProps> = ({
    onVerify,
    onCancel,
    trustDeviceOption = true
}) => {
    const { t } = useTranslation();
    const [mode, setMode] = useState<'totp' | 'backup'>('totp');
    const [code, setCode] = useState('');
    const [backupCode, setBackupCode] = useState('');
    const [trustDevice, setTrustDevice] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [remainingCodes, setRemainingCodes] = useState<number | null>(null);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Focus first input on mount
    useEffect(() => {
        if (mode === 'totp' && inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, [mode]);

    // Handle TOTP input (6 separate boxes)
    const handleTOTPInput = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newCode = code.split('');
        newCode[index] = value;
        setCode(newCode.join(''));
        setError(null);

        // Auto-focus next input
        if (value && index < 5 && inputRefs.current[index + 1]) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    // Handle backspace
    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    // Handle paste
    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        setCode(pasted);

        // Focus last filled or 6th input
        const focusIndex = Math.min(pasted.length, 5);
        inputRefs.current[focusIndex]?.focus();
    };

    // Generate device fingerprint (simple version)
    const getDeviceFingerprint = () => {
        const data = [
            navigator.userAgent,
            navigator.language,
            screen.width,
            screen.height,
            new Date().getTimezoneOffset()
        ].join('|');

        // Simple hash
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    };

    // Verify TOTP
    const verifyTOTP = async () => {
        if (code.length !== 6) {
            setError(t('mfa.challenge.invalidCode', 'Please enter a 6-digit code'));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/mfa/challenge', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: code,
                    trustDevice: trustDevice,
                    deviceFingerprint: trustDevice ? getDeviceFingerprint() : undefined
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.blocked) {
                    setError(t('mfa.challenge.blocked', 'Too many attempts. Please try again later.'));
                } else {
                    setError(data.error || t('mfa.challenge.failed', 'Verification failed'));
                }
                setCode('');
                inputRefs.current[0]?.focus();
                return;
            }

            onVerify(true);
        } catch (err: any) {
            setError(err.message || t('mfa.challenge.error', 'An error occurred'));
        } finally {
            setLoading(false);
        }
    };

    // Verify backup code
    const verifyBackupCode = async () => {
        if (!backupCode.trim()) {
            setError(t('mfa.challenge.enterBackupCode', 'Please enter a backup code'));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/mfa/backup-code', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code: backupCode.trim() })
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.blocked) {
                    setError(t('mfa.challenge.blocked', 'Too many attempts. Please try again later.'));
                } else {
                    setError(data.error || t('mfa.challenge.invalidBackupCode', 'Invalid backup code'));
                }
                setBackupCode('');
                return;
            }

            setRemainingCodes(data.remainingCodes);
            onVerify(true);
        } catch (err: any) {
            setError(err.message || t('mfa.challenge.error', 'An error occurred'));
        } finally {
            setLoading(false);
        }
    };

    // Auto-submit when 6 digits entered
    useEffect(() => {
        if (code.length === 6 && mode === 'totp') {
            verifyTOTP();
        }
    }, [code]);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-center">
                    <Shield className="w-10 h-10 text-white mx-auto mb-2" />
                    <h2 className="text-lg font-semibold text-white">
                        {t('mfa.challenge.title', 'Two-Factor Authentication')}
                    </h2>
                </div>

                <div className="p-6">
                    {/* Error Display */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* TOTP Mode */}
                    {mode === 'totp' && (
                        <div className="space-y-4">
                            <p className="text-gray-600 dark:text-gray-300 text-center text-sm">
                                {t('mfa.challenge.enterTotp', 'Enter the code from your authenticator app')}
                            </p>

                            {/* 6-digit input boxes */}
                            <div className="flex justify-center gap-2" onPaste={handlePaste}>
                                {[0, 1, 2, 3, 4, 5].map((index) => (
                                    <input
                                        key={index}
                                        ref={(el) => { inputRefs.current[index] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={code[index] || ''}
                                        onChange={(e) => handleTOTPInput(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        className="w-10 h-12 text-center text-xl font-mono border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:bg-gray-700 dark:text-white transition"
                                        disabled={loading}
                                    />
                                ))}
                            </div>

                            {/* Trust Device Option */}
                            {trustDeviceOption && (
                                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={trustDevice}
                                        onChange={(e) => setTrustDevice(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    {t('mfa.challenge.trustDevice', 'Trust this device for 30 days')}
                                </label>
                            )}

                            {/* Loading indicator */}
                            {loading && (
                                <div className="flex justify-center">
                                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                                </div>
                            )}

                            {/* Use backup code link */}
                            <button
                                onClick={() => setMode('backup')}
                                className="w-full text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 transition"
                            >
                                <Key className="w-4 h-4 inline mr-1" />
                                {t('mfa.challenge.useBackupCode', 'Use a backup code instead')}
                            </button>
                        </div>
                    )}

                    {/* Backup Code Mode */}
                    {mode === 'backup' && (
                        <div className="space-y-4">
                            <p className="text-gray-600 dark:text-gray-300 text-center text-sm">
                                {t('mfa.challenge.enterBackup', 'Enter one of your backup codes')}
                            </p>

                            <input
                                type="text"
                                value={backupCode}
                                onChange={(e) => {
                                    setBackupCode(e.target.value.toUpperCase());
                                    setError(null);
                                }}
                                placeholder="XXXX-XXXX"
                                className="w-full text-center text-lg font-mono px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:bg-gray-700 dark:text-white"
                                autoFocus
                                disabled={loading}
                            />

                            <button
                                onClick={verifyBackupCode}
                                disabled={loading || !backupCode.trim()}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {t('mfa.challenge.verify', 'Verify')}
                            </button>

                            <button
                                onClick={() => {
                                    setMode('totp');
                                    setBackupCode('');
                                    setError(null);
                                }}
                                className="w-full text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 transition"
                            >
                                {t('mfa.challenge.backToTotp', 'Back to authenticator code')}
                            </button>
                        </div>
                    )}

                    {/* Cancel button */}
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MFAChallenge;
