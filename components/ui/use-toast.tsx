import * as React from 'react';
import toast from 'react-hot-toast';

type ToastActionElement = React.ReactElement;

interface Toast {
    id: string;
    title?: string;
    description?: string;
    action?: ToastActionElement;
    variant?: 'default' | 'destructive';
}

interface ToasterToast extends Toast {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

function useToast() {
    const showToast = React.useCallback(
        ({
            title,
            description,
            variant = 'default',
        }: {
            title?: string;
            description?: string;
            variant?: 'default' | 'destructive';
        }) => {
            const message = title ? `${title}${description ? `: ${description}` : ''}` : description || '';

            if (variant === 'destructive') {
                toast.error(message);
            } else {
                toast.success(message);
            }

            return { id: Date.now().toString(), dismiss: () => toast.dismiss() };
        },
        [],
    );

    return {
        toast: showToast,
        toasts: [] as ToasterToast[],
        dismiss: (toastId?: string) => toast.dismiss(toastId),
    };
}

export { useToast };
export type { Toast, ToasterToast };
