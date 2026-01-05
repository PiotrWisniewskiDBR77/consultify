/**
 * Modal Hook - Apple HIG Design System
 *
 * A hook for managing modal state and providing a unified API.
 *
 * @example
 * const { isOpen, open, close, toggle } = useModal();
 * const confirmModal = useModal<{ id: string }>();
 *
 * // Open with data
 * confirmModal.open({ id: '123' });
 * // Access data
 * confirmModal.data?.id
 */

import { useCallback, useState } from 'react';

export interface UseModalReturn<T = void> {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Data passed to the modal */
    data: T | undefined;
    /** Open the modal */
    open: T extends void ? () => void : (data: T) => void;
    /** Close the modal */
    close: () => void;
    /** Toggle the modal */
    toggle: () => void;
    /** Set data without changing open state */
    setData: (data: T | undefined) => void;
}

export function useModal<T = void>(initialOpen = false): UseModalReturn<T> {
    const [isOpen, setIsOpen] = useState(initialOpen);
    const [data, setData] = useState<T | undefined>(undefined);

    const open = useCallback((openData?: T) => {
        setData(openData);
        setIsOpen(true);
    }, []) as UseModalReturn<T>['open'];

    const close = useCallback(() => {
        setIsOpen(false);
        // Clear data after animation
        setTimeout(() => setData(undefined), 200);
    }, []);

    const toggle = useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    return {
        isOpen,
        data,
        open,
        close,
        toggle,
        setData,
    };
}

/**
 * Modal Stack Hook
 *
 * For managing multiple modals with proper stacking.
 *
 * @example
 * const modals = useModalStack();
 * modals.push('confirm', { message: 'Are you sure?' });
 * modals.pop();
 */

export interface ModalStackItem<T = unknown> {
    id: string;
    data?: T;
}

export interface UseModalStackReturn {
    /** Stack of open modals */
    stack: ModalStackItem[];
    /** Push a new modal onto the stack */
    push: <T>(id: string, data?: T) => void;
    /** Pop the top modal from the stack */
    pop: () => void;
    /** Close a specific modal by id */
    close: (id: string) => void;
    /** Close all modals */
    closeAll: () => void;
    /** Check if a modal is open */
    isOpen: (id: string) => boolean;
    /** Get data for a specific modal */
    getData: <T>(id: string) => T | undefined;
}

export function useModalStack(): UseModalStackReturn {
    const [stack, setStack] = useState<ModalStackItem[]>([]);

    const push = useCallback(<T,>(id: string, data?: T) => {
        setStack((prev) => [...prev.filter((m) => m.id !== id), { id, data }]);
    }, []);

    const pop = useCallback(() => {
        setStack((prev) => prev.slice(0, -1));
    }, []);

    const close = useCallback((id: string) => {
        setStack((prev) => prev.filter((m) => m.id !== id));
    }, []);

    const closeAll = useCallback(() => {
        setStack([]);
    }, []);

    const isOpen = useCallback((id: string) => stack.some((m) => m.id === id), [stack]);

    const getData = useCallback(
        <T,>(id: string) => {
            const modal = stack.find((m) => m.id === id);
            return modal?.data as T | undefined;
        },
        [stack],
    );

    return {
        stack,
        push,
        pop,
        close,
        closeAll,
        isOpen,
        getData,
    };
}

export default useModal;
