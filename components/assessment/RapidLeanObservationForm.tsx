/**
 * RapidLean Observation Form - Mobile-Optimized
 * Production floor observation form for Gemba Walk
 * DBR77 Format - follows DRD principles
 * 
 * Mobile optimizations:
 * - Min 48px touch targets
 * - Dark mode toggle for production floors
 * - Auto-save every 10 seconds
 * - Haptic feedback on actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Camera, CheckCircle, X, MapPin, Clock, Save, ArrowLeft, ArrowRight, Sun, Moon, Wifi, WifiOff } from 'lucide-react';
import { ObservationTemplate } from '../../data/rapidLeanObservationTemplates';

interface ObservationData {
    templateId: string;
    location: string;
    timestamp: string;
    answers: Record<string, any>;
    photos: string[];
    notes: string;
}

interface RapidLeanObservationFormProps {
    template: ObservationTemplate;
    templateIndex: number;
    totalTemplates: number;
    onComplete: (observationData: ObservationData) => void;
    onCancel: () => void;
}

export const RapidLeanObservationForm: React.FC<RapidLeanObservationFormProps> = ({
    template,
    templateIndex,
    totalTemplates,
    onComplete,
    onCancel
}) => {
    const [location, setLocation] = useState('');
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [photos, setPhotos] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [forceDarkMode, setForceDarkMode] = useState(false);
    const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

    // Check online status
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Auto-save every 10 seconds (optimized for field work)
    useEffect(() => {
        const interval = setInterval(() => {
            if (Object.keys(answers).length > 0 && autoSaveStatus === 'unsaved') {
                performAutoSave();
            }
        }, 10000); // 10 seconds for faster field work

        return () => clearInterval(interval);
    }, [answers, autoSaveStatus]);

    const performAutoSave = useCallback(() => {
        setAutoSaveStatus('saving');
        // Store in localStorage for offline support
        const saveData = {
            templateId: template.id,
            location,
            answers,
            photos,
            notes,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(`rapidlean_draft_${template.id}`, JSON.stringify(saveData));
        setLastSaveTime(new Date());
        setTimeout(() => setAutoSaveStatus('saved'), 500);

        // Haptic feedback on save (if supported)
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    }, [template.id, location, answers, photos, notes]);

    // Load draft on mount
    useEffect(() => {
        const savedDraft = localStorage.getItem(`rapidlean_draft_${template.id}`);
        if (savedDraft) {
            try {
                const draft = JSON.parse(savedDraft);
                if (draft.answers) setAnswers(draft.answers);
                if (draft.location) setLocation(draft.location);
                if (draft.notes) setNotes(draft.notes);
                if (draft.photos) setPhotos(draft.photos);
            } catch (e) {
                console.warn('Failed to load draft:', e);
            }
        }
    }, [template.id]);

    const handleAnswer = (itemId: string, value: any) => {
        setAnswers(prev => ({ ...prev, [itemId]: value }));
        setAutoSaveStatus('unsaved');
    };

    const handlePhotoCapture = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.multiple = true;
        input.onchange = (e: any) => {
            const files = Array.from(e.target.files || []) as File[];
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const photoUrl = event.target?.result as string;
                    setPhotos(prev => [...prev, photoUrl]);
                };
                reader.readAsDataURL(file);
            });
        };
        input.click();
    };

    const handleRemovePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        const observationData: ObservationData = {
            templateId: template.id,
            location: location || 'Production Floor',
            timestamp: new Date().toISOString(),
            answers,
            photos,
            notes
        };
        onComplete(observationData);
    };

    const getRequiredItems = () => {
        return template.checklist.filter(item => item.required);
    };

    const getCompletedItems = () => {
        return template.checklist.filter(item => {
            const answer = answers[item.id];
            if (item.type === 'photo') {
                return photos.length > 0;
            }
            return answer !== undefined && answer !== null && answer !== '';
        });
    };

    const isTemplateComplete = () => {
        const required = getRequiredItems();
        const completed = getCompletedItems();
        return required.every(req => completed.some(comp => comp.id === req.id));
    };

    const completionPercentage = (getCompletedItems().length / template.checklist.length) * 100;

    return (
        <div className={`min-h-screen pb-24 ${forceDarkMode ? 'dark bg-gray-900' : 'bg-gray-50 dark:bg-gray-900'}`}>
            {/* Header - Mobile Optimized with Dark Mode Toggle */}
            <div className={`sticky top-0 z-10 shadow-sm border-b ${forceDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className={`text-lg font-bold ${forceDarkMode ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                            {template.name}
                        </h2>
                        <div className="flex items-center gap-2">
                            {/* Offline Indicator */}
                            {isOffline && (
                                <span className="flex items-center gap-1 text-xs text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded">
                                    <WifiOff className="w-3 h-3" />
                                    Offline
                                </span>
                            )}
                            {/* Dark Mode Toggle - 48px touch target */}
                            <button
                                onClick={() => setForceDarkMode(!forceDarkMode)}
                                className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                aria-label="Toggle dark mode"
                            >
                                {forceDarkMode ? (
                                    <Sun className="w-5 h-5 text-yellow-500" />
                                ) : (
                                    <Moon className="w-5 h-5 text-gray-500" />
                                )}
                            </button>
                            <span className={`text-sm font-medium ${forceDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                {templateIndex + 1}/{totalTemplates}
                            </span>
                        </div>
                    </div>
                    <p className={`text-sm ${forceDarkMode ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {template.description}
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-sm">
                        {/* Location Input - Larger touch target */}
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${forceDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                            <MapPin className="w-4 h-4 text-blue-500" />
                            <input
                                type="text"
                                placeholder="Location..."
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className={`border-none bg-transparent p-0 text-sm focus:outline-none w-32 ${forceDarkMode ? 'text-white placeholder-gray-400' : 'text-gray-700 dark:text-white'}`}
                            />
                        </div>
                        <div className={`flex items-center gap-1 ${forceDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <Clock className="w-4 h-4" />
                            <span className="text-sm">{new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {/* Auto-save Status */}
                        {autoSaveStatus === 'saved' && (
                            <span className="text-green-500 flex items-center gap-1 text-sm">
                                <CheckCircle className="w-4 h-4" />
                                <span className="hidden sm:inline">Saved</span>
                            </span>
                        )}
                        {autoSaveStatus === 'saving' && (
                            <span className="text-blue-500 flex items-center gap-1 text-sm animate-pulse">
                                <Save className="w-4 h-4" />
                                <span className="hidden sm:inline">Saving...</span>
                            </span>
                        )}
                    </div>
                </div>

                {/* Progress Bar - Thicker for better visibility */}
                <div className="h-2 bg-gray-200 dark:bg-gray-700">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                        style={{ width: `${completionPercentage}%` }}
                    />
                </div>
            </div>

            {/* Observation Checklist */}
            <div className="px-4 py-4 space-y-4">
                {template.checklist.map((item) => {
                    const answer = answers[item.id];
                    const isPhotoItem = item.type === 'photo';
                    const isCompleted = isPhotoItem ? photos.length > 0 : (answer !== undefined && answer !== null && answer !== '');

                    return (
                        <div
                            key={item.id}
                            className={`bg-white dark:bg-gray-800 rounded-lg p-4 border-2 ${item.required && !isCompleted
                                ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10'
                                : isCompleted
                                    ? 'border-green-300 bg-green-50 dark:bg-green-900/10'
                                    : 'border-gray-200 dark:border-gray-700'
                                }`}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <label className="font-medium text-sm flex-1">
                                    {item.text}
                                    {item.required && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                {isCompleted && (
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                )}
                            </div>

                            {item.helpText && (
                                <p className="text-xs text-gray-500 mb-3 italic">{item.helpText}</p>
                            )}

                            {/* Render input based on type */}
                            {item.type === 'yes_no' && (
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleAnswer(item.id, true)}
                                        className={`flex-1 min-h-[48px] py-3 px-4 rounded-xl font-semibold text-base transition-all active:scale-95 ${answer === true
                                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                                            : forceDarkMode
                                                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                                            }`}
                                    >
                                        ✓ Yes
                                    </button>
                                    <button
                                        onClick={() => handleAnswer(item.id, false)}
                                        className={`flex-1 min-h-[48px] py-3 px-4 rounded-xl font-semibold text-base transition-all active:scale-95 ${answer === false
                                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                                            : forceDarkMode
                                                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                                            }`}
                                    >
                                        ✗ No
                                    </button>
                                </div>
                            )}

                            {item.type === 'scale' && (
                                <div className="grid grid-cols-5 gap-2">
                                    {[1, 2, 3, 4, 5].map(value => (
                                        <button
                                            key={value}
                                            onClick={() => handleAnswer(item.id, value)}
                                            className={`min-h-[48px] py-3 px-2 rounded-xl text-base font-semibold transition-all active:scale-95 ${answer === value
                                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                                                : forceDarkMode
                                                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                                                }`}
                                        >
                                            {value}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {item.type === 'measurement' && (
                                <input
                                    type="number"
                                    placeholder="Enter value"
                                    value={answer || ''}
                                    onChange={(e) => handleAnswer(item.id, parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                                />
                            )}

                            {item.type === 'text' && (
                                <textarea
                                    placeholder="Enter observations..."
                                    value={answer || ''}
                                    onChange={(e) => handleAnswer(item.id, e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 min-h-[80px]"
                                />
                            )}

                            {item.type === 'photo' && (
                                <div>
                                    <button
                                        onClick={handlePhotoCapture}
                                        className="w-full py-3 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:border-blue-500"
                                    >
                                        <Camera className="w-5 h-5" />
                                        {photos.length > 0
                                            ? `Add Another Photo (${photos.length})`
                                            : 'Take Photo'}
                                    </button>
                                    {photos.length > 0 && (
                                        <div className="mt-2 grid grid-cols-3 gap-2">
                                            {photos.map((photo, idx) => (
                                                <div key={idx} className="relative">
                                                    <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-24 object-cover rounded" />
                                                    <button
                                                        onClick={() => handleRemovePhoto(idx)}
                                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* General Notes */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <label className="font-medium text-sm mb-2 block">
                        Additional Notes
                    </label>
                    <textarea
                        placeholder="Any additional observations..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 min-h-[100px]"
                    />
                </div>
            </div>

            {/* Fixed Footer - Mobile Optimized */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t shadow-lg p-4">
                <div className="flex items-center justify-between gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Cancel
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={!isTemplateComplete()}
                        className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {templateIndex === totalTemplates - 1 ? 'Save & Complete' : 'Save & Next'}
                    </button>
                </div>
            </div>
        </div>
    );
};

