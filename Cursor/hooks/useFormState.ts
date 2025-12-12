/**
 * ANTYGRACITY REFAKTORING
 * Hook do zarządzania stanem formularza
 * 
 * Wyekstrahowany wzorzec z InitiativeDetailModal i TaskDetailModal:
 * - const [entity, setEntity] = useState({ ...initialEntity });
 * - setEntity({ ...entity, [field]: value })
 * 
 * Ten hook upraszcza:
 * 1. Aktualizację pojedynczych pól
 * 2. Aktualizację pól tablicowych (add, remove, update at index)
 * 3. Reset do wartości początkowych
 */

import { useState, useCallback } from 'react';

interface UseFormStateOptions<T> {
    initialData: T;
    onSave?: (data: T) => void;
}

interface UseFormStateReturn<T> {
    /** Aktualny stan formularza */
    data: T;
    
    /** Ustaw pojedyncze pole */
    setField: <K extends keyof T>(field: K, value: T[K]) => void;
    
    /** Ustaw wiele pól naraz */
    setFields: (updates: Partial<T>) => void;
    
    /** Zresetuj do wartości początkowych */
    reset: () => void;
    
    /** Zapisz (wywołuje onSave callback) */
    save: () => void;
    
    /** Czy dane się zmieniły */
    isDirty: boolean;
    
    /** Operacje na polach tablicowych */
    arrayOps: {
        add: <K extends keyof T>(field: K, item: T[K] extends (infer U)[] ? U : never) => void;
        remove: <K extends keyof T>(field: K, index: number) => void;
        update: <K extends keyof T>(
            field: K, 
            index: number, 
            value: T[K] extends (infer U)[] ? U : never
        ) => void;
    };
}

export function useFormState<T extends object>({
    initialData,
    onSave
}: UseFormStateOptions<T>): UseFormStateReturn<T> {
    const [data, setData] = useState<T>({ ...initialData });
    const [originalData] = useState<T>({ ...initialData });

    const setField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
        setData(prev => ({ ...prev, [field]: value }));
    }, []);

    const setFields = useCallback((updates: Partial<T>) => {
        setData(prev => ({ ...prev, ...updates }));
    }, []);

    const reset = useCallback(() => {
        setData({ ...originalData });
    }, [originalData]);

    const save = useCallback(() => {
        if (onSave) {
            onSave(data);
        }
    }, [data, onSave]);

    // Sprawdź czy dane się zmieniły (prosta porównawka JSON)
    const isDirty = JSON.stringify(data) !== JSON.stringify(originalData);

    // Operacje na tablicach
    const arrayOps = {
        add: useCallback(<K extends keyof T>(
            field: K, 
            item: T[K] extends (infer U)[] ? U : never
        ) => {
            setData(prev => {
                const arr = (prev[field] as unknown[]) || [];
                return { ...prev, [field]: [...arr, item] };
            });
        }, []),

        remove: useCallback(<K extends keyof T>(field: K, index: number) => {
            setData(prev => {
                const arr = [...((prev[field] as unknown[]) || [])];
                arr.splice(index, 1);
                return { ...prev, [field]: arr };
            });
        }, []),

        update: useCallback(<K extends keyof T>(
            field: K, 
            index: number, 
            value: T[K] extends (infer U)[] ? U : never
        ) => {
            setData(prev => {
                const arr = [...((prev[field] as unknown[]) || [])];
                arr[index] = value;
                return { ...prev, [field]: arr };
            });
        }, [])
    };

    return {
        data,
        setField,
        setFields,
        reset,
        save,
        isDirty,
        arrayOps
    };
}

/**
 * Przykład użycia:
 * 
 * const { data: initiative, setField, arrayOps, save } = useFormState({
 *     initialData: initialInitiative,
 *     onSave: (data) => {
 *         onSave(data);
 *         onClose();
 *     }
 * });
 * 
 * // Zamiast:
 * // setInitiative({ ...initiative, name: e.target.value })
 * // Teraz:
 * setField('name', e.target.value);
 * 
 * // Operacje na tablicach:
 * arrayOps.add('deliverables', '');
 * arrayOps.remove('deliverables', index);
 * arrayOps.update('deliverables', index, newValue);
 */

