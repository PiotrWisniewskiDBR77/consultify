import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { Globe, Save, Info } from 'lucide-react';

interface RegionalSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

export const RegionalSettings: React.FC<RegionalSettingsProps> = ({ currentUser, onUpdateUser }) => {
    const [timezone, setTimezone] = useState(currentUser.timezone || 'UTC');
    const [units, setUnits] = useState<'metric' | 'imperial'>(currentUser.units || 'metric');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    const timezones = Intl.supportedValuesOf('timeZone');

    const handleSave = async () => {
        setIsSaving(true);
        setSaveMessage('');
        try {
            await onUpdateUser({ timezone, units });
            setSaveMessage('Settings saved successfully');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Failed to save settings:', error);
            setSaveMessage('Error saving settings');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Regionalization</h1>
                <p className="text-slate-500 dark:text-slate-400">Configure your timezone and measurement units.</p>
            </div>

            <div className="bg-white dark:bg-navy-800 rounded-xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden">
                <div className="p-6 space-y-8">
                    {/* Timezone Selection */}
                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                                <Globe size={24} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Timezone
                                </label>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                                    Set your local timezone for accurate dates and times across the platform.
                                </p>
                                <select
                                    value={timezone}
                                    onChange={(e) => setTimezone(e.target.value)}
                                    className="w-full max-w-md px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
                                >
                                    {timezones.map((tz) => (
                                        <option key={tz} value={tz}>
                                            {tz.replace(/_/g, ' ')}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-slate-200 dark:bg-white/5" />

                    {/* Measurement Units */}
                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg text-purple-600 dark:text-purple-400">
                                <Info size={24} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Measurement System
                                </label>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                                    Choose your preferred system for weights, distances, and other measurements.
                                </p>
                                <div className="flex gap-4">
                                    <label className={`flex-1 max-w-[200px] cursor-pointer relative p-4 rounded-xl border-2 transition-all ${units === 'metric' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'}`}>
                                        <input
                                            type="radio"
                                            name="units"
                                            value="metric"
                                            checked={units === 'metric'}
                                            onChange={() => setUnits('metric')}
                                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                        />
                                        <div className="text-center">
                                            <span className={`block text-lg font-semibold mb-1 ${units === 'metric' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>Metric</span>
                                            <span className={`text-xs ${units === 'metric' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>meters, kilograms, celsius</span>
                                        </div>
                                    </label>

                                    <label className={`flex-1 max-w-[200px] cursor-pointer relative p-4 rounded-xl border-2 transition-all ${units === 'imperial' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'}`}>
                                        <input
                                            type="radio"
                                            name="units"
                                            value="imperial"
                                            checked={units === 'imperial'}
                                            onChange={() => setUnits('imperial')}
                                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                        />
                                        <div className="text-center">
                                            <span className={`block text-lg font-semibold mb-1 ${units === 'imperial' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>Imperial</span>
                                            <span className={`text-xs ${units === 'imperial' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>feet, pounds, fahrenheit</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-navy-900 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                    <span className={`text-sm ${saveMessage.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                        {saveMessage}
                    </span>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
