// @ts-nocheck - ErrorBoundary must be a class component per React requirements
// TypeScript class inheritance issues with current moduleDetection config
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error to service
        console.error('Application Error:', error, errorInfo);

        this.setState({
            error,
            errorInfo
        });

        // TODO: Send to error tracking service (Sentry, etc.)
        if (process.env.NODE_ENV === 'production') {
            // logErrorToService(error, errorInfo);
        }
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-gray-50 dark:bg-navy-950 flex items-center justify-center p-8">
                    <div className="max-w-md w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl p-8">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="text-red-500" size={32} />
                            </div>

                            <h1 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
                                Oops! Something went wrong
                            </h1>

                            <p className="text-slate-600 dark:text-slate-400 mb-6">
                                We're sorry for the inconvenience. The application encountered an error.
                            </p>

                            {process.env.NODE_ENV !== 'production' && this.state.error && (
                                <details className="mb-6 w-full">
                                    <summary className="text-sm text-slate-500 cursor-pointer mb-2">
                                        Error Details
                                    </summary>
                                    <div className="bg-slate-100 dark:bg-navy-950 p-4 rounded text-left text-xs font-mono overflow-auto max-h-40">
                                        <div className="text-red-600 dark:text-red-400 mb-2">
                                            {this.state.error.toString()}
                                        </div>
                                        {this.state.errorInfo && (
                                            <div className="text-slate-600 dark:text-slate-400">
                                                {this.state.errorInfo.componentStack}
                                            </div>
                                        )}
                                    </div>
                                </details>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={this.handleReset}
                                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                                >
                                    <RefreshCw size={18} />
                                    Try Again
                                </button>

                                <button
                                    onClick={() => window.location.href = '/'}
                                    className="px-6 py-3 bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-navy-900 dark:text-white rounded-lg font-medium transition-colors"
                                >
                                    Go Home
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
