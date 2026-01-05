import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error);
        console.error('[ErrorBoundary] Error info:', errorInfo);
        console.error('[ErrorBoundary] Error stack:', error.stack);

        // Try to send error to backend if available
        if (typeof window !== 'undefined' && window.fetch) {
            fetch('/api/errors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: error.message,
                    stack: error.stack,
                    componentStack: errorInfo.componentStack,
                }),
            }).catch(() => {
                // Ignore fetch errors
            });
        }
    }

    private handleReset = () => {
        localStorage.clear();
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
                    <div className="max-w-md w-full bg-slate-800 p-8 rounded-xl border border-red-500/30 shadow-2xl">
                        <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h1>
                        <p className="text-slate-300 mb-6">
                            The application encountered an unexpected error. This usually happens due to corrupted local
                            data or a temporary glitch.
                        </p>
                        <div className="bg-slate-950 p-4 rounded-lg mb-6 overflow-auto max-h-40 text-xs font-mono text-red-400">
                            {this.state.error?.message}
                        </div>
                        <button
                            onClick={this.handleReset}
                            className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors"
                        >
                            Reset Application Data (Fix)
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
