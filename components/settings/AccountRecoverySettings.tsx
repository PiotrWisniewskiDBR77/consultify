/**
 * AccountRecoverySettings - Account recovery options
 * 
 * Features:
 * - Backup email
 * - Phone number verification
 * - Recovery codes
 * - Trusted devices
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Mail, Phone, Key, Smartphone, Shield, Loader2,
    Check, AlertTriangle, Copy, RefreshCw, Trash2
} from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { User } from '../../types';

interface RecoverySettings {
    backup_email: string | null;
    backup_email_verified: boolean;
    phone_number: string | null;
    phone_verified: boolean;
    recovery_codes_generated: boolean;
    recovery_codes_remaining: number;
    trusted_devices: TrustedDevice[];
}

interface TrustedDevice {
    id: string;
    name: string;
    browser: string;
    last_used: string;
    is_current: boolean;
}

interface AccountRecoverySettingsProps {
    currentUser: User;
}

export const AccountRecoverySettings: React.FC<AccountRecoverySettingsProps> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [backupEmail, setBackupEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
    const [generatingCodes, setGeneratingCodes] = useState(false);
    const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([
        { id: '1', name: 'Chrome on MacOS', browser: 'Chrome 120', last_used: '2 hours ago', is_current: true },
        { id: '2', name: 'Safari on iPhone', browser: 'Safari 17', last_used: '1 day ago', is_current: false },
    ]);
    const [verifyingEmail, setVerifyingEmail] = useState(false);
    const [verifyingPhone, setVerifyingPhone] = useState(false);

    const handleSaveBackupEmail = async () => {
        if (!backupEmail || backupEmail === currentUser.email) {
            toast.error(t('settings.recovery.differentEmail', 'Please use a different email address'));
            return;
        }

        try {
            setVerifyingEmail(true);
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated
            toast.success(t('settings.recovery.emailSaved', 'Verification email sent'));
        } catch (error) {
            toast.error(t('settings.recovery.emailError', 'Failed to save backup email'));
        } finally {
            setVerifyingEmail(false);
        }
    };

    const handleSavePhone = async () => {
        if (!phoneNumber || phoneNumber.length < 10) {
            toast.error(t('settings.recovery.validPhone', 'Please enter a valid phone number'));
            return;
        }

        try {
            setVerifyingPhone(true);
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated
            toast.success(t('settings.recovery.phoneSaved', 'Verification code sent'));
        } catch (error) {
            toast.error(t('settings.recovery.phoneError', 'Failed to save phone number'));
        } finally {
            setVerifyingPhone(false);
        }
    };

    const handleGenerateRecoveryCodes = async () => {
        try {
            setGeneratingCodes(true);
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated
            const codes = [
                'XXXX-XXXX-XXXX',
                'YYYY-YYYY-YYYY',
                'ZZZZ-ZZZZ-ZZZZ',
                'AAAA-AAAA-AAAA',
                'BBBB-BBBB-BBBB',
                'CCCC-CCCC-CCCC',
                'DDDD-DDDD-DDDD',
                'EEEE-EEEE-EEEE'
            ].map(() => {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                let code = '';
                for (let i = 0; i < 12; i++) {
                    if (i > 0 && i % 4 === 0) code += '-';
                    code += chars[Math.floor(Math.random() * chars.length)];
                }
                return code;
            });
            setRecoveryCodes(codes);
            setShowRecoveryCodes(true);
            toast.success(t('settings.recovery.codesGenerated', 'Recovery codes generated'));
        } catch (error) {
            toast.error(t('settings.recovery.codesError', 'Failed to generate codes'));
        } finally {
            setGeneratingCodes(false);
        }
    };

    const handleCopyCodes = () => {
        navigator.clipboard.writeText(recoveryCodes.join('\n'));
        toast.success(t('settings.recovery.codesCopied', 'Recovery codes copied to clipboard'));
    };

    const handleRemoveTrustedDevice = async (deviceId: string) => {
        try {
            // API call would go here
            setTrustedDevices(prev => prev.filter(d => d.id !== deviceId));
            toast.success(t('settings.recovery.deviceRemoved', 'Device removed'));
        } catch (error) {
            toast.error(t('settings.recovery.deviceRemoveError', 'Failed to remove device'));
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-500" />
                    {t('settings.recovery.title', 'Account Recovery')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('settings.recovery.description', 'Set up backup options to recover your account if you lose access')}
                </p>
            </div>

            {/* Backup Email */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-medium text-slate-900 dark:text-white">
                            {t('settings.recovery.backupEmail', 'Backup Email')}
                        </h4>
                        <p className="text-sm text-slate-500">
                            {t('settings.recovery.backupEmailDesc', 'Use to recover your account if you lose access')}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <input
                        type="email"
                        value={backupEmail}
                        onChange={(e) => setBackupEmail(e.target.value)}
                        placeholder={t('settings.recovery.enterBackupEmail', 'Enter backup email address')}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                        onClick={handleSaveBackupEmail}
                        disabled={verifyingEmail || !backupEmail}
                        className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                        {verifyingEmail ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        {t('common.verify', 'Verify')}
                    </button>
                </div>
            </div>

            {/* Phone Number */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                        <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-medium text-slate-900 dark:text-white">
                            {t('settings.recovery.phone', 'Phone Number')}
                        </h4>
                        <p className="text-sm text-slate-500">
                            {t('settings.recovery.phoneDesc', 'Receive SMS codes for account recovery')}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder={t('settings.recovery.enterPhone', '+1 (555) 123-4567')}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                        onClick={handleSavePhone}
                        disabled={verifyingPhone || !phoneNumber}
                        className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                        {verifyingPhone ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        {t('common.verify', 'Verify')}
                    </button>
                </div>
            </div>

            {/* Recovery Codes */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                            <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h4 className="font-medium text-slate-900 dark:text-white">
                                {t('settings.recovery.recoveryCodes', 'Recovery Codes')}
                            </h4>
                            <p className="text-sm text-slate-500">
                                {t('settings.recovery.recoveryCodesDesc', 'One-time use codes for emergency access')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleGenerateRecoveryCodes}
                        disabled={generatingCodes}
                        className="px-4 py-2 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg font-medium hover:bg-amber-200 dark:hover:bg-amber-500/30 disabled:opacity-50 flex items-center gap-2"
                    >
                        {generatingCodes ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4" />
                        )}
                        {t('settings.recovery.generateCodes', 'Generate New Codes')}
                    </button>
                </div>

                {showRecoveryCodes && recoveryCodes.length > 0 && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.recovery.saveThese', 'Save these codes in a secure place')}
                            </p>
                            <button
                                onClick={handleCopyCodes}
                                className="flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:underline"
                            >
                                <Copy className="w-4 h-4" />
                                {t('common.copy', 'Copy')}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {recoveryCodes.map((code, index) => (
                                <code key={index} className="px-3 py-2 bg-white dark:bg-white/5 rounded text-sm font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                                    {code}
                                </code>
                            ))}
                        </div>
                        <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/20">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                                {t('settings.recovery.codesWarning', 'Each code can only be used once. Store them securely and do not share them.')}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Trusted Devices */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h4 className="font-medium text-slate-900 dark:text-white">
                            {t('settings.recovery.trustedDevices', 'Trusted Devices')}
                        </h4>
                        <p className="text-sm text-slate-500">
                            {t('settings.recovery.trustedDevicesDesc', 'Devices that can access your account without additional verification')}
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    {trustedDevices.map(device => (
                        <div
                            key={device.id}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg"
                        >
                            <div className="flex items-center gap-3">
                                <Smartphone className="w-5 h-5 text-slate-400" />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-slate-900 dark:text-white">{device.name}</p>
                                        {device.is_current && (
                                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 text-xs rounded-full">
                                                {t('settings.recovery.current', 'This device')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500">{device.browser} • {device.last_used}</p>
                                </div>
                            </div>
                            {!device.is_current && (
                                <button
                                    onClick={() => handleRemoveTrustedDevice(device.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AccountRecoverySettings;


