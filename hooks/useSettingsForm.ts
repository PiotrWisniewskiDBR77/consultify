/**
 * useSettingsForm - Hook for managing settings form state with dirty tracking
 *
 * Features:
 * - Track form dirty state
 * - Warn on navigation with unsaved changes
 * - Auto-save option
 * - Reset to initial values
 * - Debounced auto-save
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface UseSettingsFormOptions<T> {
    /** Initial form values */
    initialValues: T;
    /** Callback when saving */
    onSave: (values: T) => Promise<void> | void;
    /** Enable auto-save (default: false) */
    autoSave?: boolean;
    /** Auto-save delay in ms (default: 2000) */
    autoSaveDelay?: number;
    /** Callback when form becomes dirty */
    onDirtyChange?: (isDirty: boolean) => void;
    /** Enable navigation warning (default: true) */
    warnOnNavigate?: boolean;
}

interface UseSettingsFormReturn<T> {
    /** Current form values */
    values: T;
    /** Whether form has unsaved changes */
    isDirty: boolean;
    /** Whether form is currently saving */
    isSaving: boolean;
    /** Any error from the last save attempt */
    error: string | null;
    /** Update a single field */
    setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void;
    /** Update multiple fields at once */
    setValues: (updates: Partial<T>) => void;
    /** Reset form to initial values */
    reset: () => void;
    /** Save the current values */
    save: () => Promise<void>;
    /** Check if a specific field has changed */
    isFieldDirty: <K extends keyof T>(field: K) => boolean;
    /** Get the original value of a field */
    getOriginalValue: <K extends keyof T>(field: K) => T[K];
}

export function useSettingsForm<T extends Record<string, unknown>>(
    options: UseSettingsFormOptions<T>,
): UseSettingsFormReturn<T> {
    const {
        initialValues,
        onSave,
        autoSave = false,
        autoSaveDelay = 2000,
        onDirtyChange,
        warnOnNavigate = true,
    } = options;

    const { t } = useTranslation();

    // State
    const [values, setValuesState] = useState<T>(initialValues);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs for tracking
    const initialValuesRef = useRef<T>(initialValues);
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedValuesRef = useRef<T>(initialValues);

    // Calculate dirty state
    const isDirty = useCallback((): boolean => {
        return JSON.stringify(values) !== JSON.stringify(lastSavedValuesRef.current);
    }, [values]);

    // Update initial values ref when they change from outside
    useEffect(() => {
        initialValuesRef.current = initialValues;
        lastSavedValuesRef.current = initialValues;
        setValuesState(initialValues);
    }, [initialValues]);

    // Notify dirty state changes
    useEffect(() => {
        onDirtyChange?.(isDirty());
    }, [isDirty, onDirtyChange]);

    // Warn on navigation with unsaved changes
    useEffect(() => {
        if (!warnOnNavigate) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty()) {
                const message = t(
                    'settings.unsavedChanges',
                    'You have unsaved changes. Are you sure you want to leave?',
                );
                e.returnValue = message;
                return message;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty, warnOnNavigate, t]);

    // Auto-save handler
    useEffect(() => {
        if (!autoSave || !isDirty()) return;

        // Clear existing timeout
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        // Set new timeout
        autoSaveTimeoutRef.current = setTimeout(async () => {
            await save();
        }, autoSaveDelay);

        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [values, autoSave, autoSaveDelay]);

    // Set single field value
    const setFieldValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
        setValuesState((prev) => ({
            ...prev,
            [field]: value,
        }));
        setError(null);
    }, []);

    // Set multiple values
    const setValues = useCallback((updates: Partial<T>) => {
        setValuesState((prev) => ({
            ...prev,
            ...updates,
        }));
        setError(null);
    }, []);

    // Reset to initial values
    const reset = useCallback(() => {
        setValuesState(lastSavedValuesRef.current);
        setError(null);
    }, []);

    // Save handler
    const save = useCallback(async () => {
        if (!isDirty()) return;

        setIsSaving(true);
        setError(null);

        try {
            await onSave(values);
            lastSavedValuesRef.current = values;
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : t('settings.saveFailed', 'Failed to save settings');
            setError(errorMessage);
            throw err;
        } finally {
            setIsSaving(false);
        }
    }, [values, isDirty, onSave, t]);

    // Check if specific field is dirty
    const isFieldDirty = useCallback(
        <K extends keyof T>(field: K): boolean => {
            return values[field] !== lastSavedValuesRef.current[field];
        },
        [values],
    );

    // Get original value of a field
    const getOriginalValue = useCallback(<K extends keyof T>(field: K): T[K] => {
        return lastSavedValuesRef.current[field];
    }, []);

    return {
        values,
        isDirty: isDirty(),
        isSaving,
        error,
        setFieldValue,
        setValues,
        reset,
        save,
        isFieldDirty,
        getOriginalValue,
    };
}

/**
 * UnsavedChangesWarning - Component to show warning dialog
 */
export interface UnsavedChangesDialogProps {
    isOpen: boolean;
    onDiscard: () => void;
    onSave: () => void;
    onCancel: () => void;
}

export default useSettingsForm;
