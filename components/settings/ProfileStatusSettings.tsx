/**
 * ProfileStatusSettings - User availability status and status message
 * 
 * Features:
 * - Set availability status (online, away, busy, dnd)
 * - Custom status message
 * - Real-time status updates
 */

import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { useTranslation } from 'react-i18next';
import { 
    Circle, 
    Clock, 
    Moon, 
    Zap,
    Save,
    Loader2,
    CheckCircle,
    AlertCircle
} from 'lucide-react';
import { Api } from '../../services/api';
import toast from 'react-hot-toast';

interface ProfileStatusSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

const STATUS_OPTIONS = [
    { value: 'online', label: 'Online', icon: Circle, color: 'text-green-500' },
    { value: 'away', label: 'Away', icon: Clock, color: 'text-yellow-500' },
    { value: 'busy', label: 'Busy', icon: Zap, color: 'text-orange-500' },
    { value: 'dnd', label: 'Do Not Disturb', icon: Moon, color: 'text-red-500' },
] as const;

export const ProfileStatusSettings: React.FC<ProfileStatusSettingsProps> = ({ 
    currentUser, 
    onUpdateUser 
}) => {
    const { t } = useTranslation();
    const [status, setStatus] = useState<'online' | 'away' | 'busy' | 'dnd'>(
        currentUser.availabilityStatus || 'online'
    );
    const [statusMessage, setStatusMessage] = useState(currentUser.statusMessage || '');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        setStatus(currentUser.availabilityStatus || 'online');
        setStatusMessage(currentUser.statusMessage || '');
    }, [currentUser]);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus('idle');
        
        try {
            await Api.updateUserStatus(currentUser.id, {
                availabilityStatus: status,
                statusMessage: statusMessage.trim() || undefined
            });
            
            onUpdateUser({
                availabilityStatus: status,
                statusMessage: statusMessage.trim() || undefined
            });
            
            setSaveStatus('success');
            toast.success(t('settings.profile.status.saved', 'Status updated successfully'));
            
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error: any) {
            setSaveStatus('error');
            toast.error(error.message || t('settings.profile.status.error', 'Failed to update status'));
        } finally {
            setIsSaving(false);
        }
    };

    const selectedStatus = STATUS_OPTIONS.find(opt => opt.value === status);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {t('settings.profile.status.title', 'Availability Status')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('settings.profile.status.subtitle', 'Let others know your current availability')}
                </p>
            </div>

            {/* Status Selection */}
            <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('settings.profile.status.currentStatus', 'Current Status')}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {STATUS_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const isSelected = status === option.value;
                        
                        return (
                            <button
                                key={option.value}
                                onClick={() => setStatus(option.value)}
                                className={`
                                    flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                                    ${isSelected 
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20' 
                                        : 'border-slate-200 dark:border-white/10 hover:border-purple-300'
                                    }
                                `}
                            >
                                <Icon 
                                    size={24} 
                                    className={isSelected ? option.color : 'text-slate-400'} 
                                />
                                <span className={`text-sm font-medium ${
                                    isSelected 
                                        ? 'text-purple-700 dark:text-purple-300' 
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}>
                                    {option.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Status Message */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('settings.profile.status.message', 'Status Message')} 
                    <span className="text-slate-400 text-xs ml-1">({t('common.optional', 'Optional')})</span>
                </label>
                <input
                    type="text"
                    value={statusMessage}
                    onChange={(e) => setStatusMessage(e.target.value)}
                    placeholder={t('settings.profile.status.messagePlaceholder', 'e.g., In a meeting until 3 PM')}
                    maxLength={100}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                />
                <p className="text-xs text-slate-400">
                    {statusMessage.length}/100 {t('common.characters', 'characters')}
                </p>
            </div>

            {/* Preview */}
            <div className="p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-white/10">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    {t('settings.profile.status.preview', 'Preview')}:
                </p>
                <div className="flex items-center gap-2">
                    {selectedStatus && (
                        <>
                            <selectedStatus.icon 
                                size={16} 
                                className={selectedStatus.color} 
                            />
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                                {selectedStatus.label}
                            </span>
                            {statusMessage && (
                                <>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                        {statusMessage}
                                    </span>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            {t('common.saving', 'Saving...')}
                        </>
                    ) : (
                        <>
                            <Save size={16} />
                            {t('common.save', 'Save')}
                        </>
                    )}
                </button>
            </div>

            {/* Success/Error Messages */}
            {saveStatus === 'success' && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                    <CheckCircle size={16} />
                    {t('settings.profile.status.saved', 'Status updated successfully')}
                </div>
            )}
            {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle size={16} />
                    {t('settings.profile.status.error', 'Failed to update status')}
                </div>
            )}
        </div>
    );
};

export default ProfileStatusSettings;






