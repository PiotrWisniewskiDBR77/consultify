import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * OAuthCallback Component
 * Handles the redirect from OAuth providers (Google, LinkedIn)
 * Extracts token and user data from URL, stores them, and redirects to the app
 */
export const OAuthCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            // Check for error from OAuth provider
            const authError = searchParams.get('auth_error');
            if (authError) {
                setStatus('error');
                setError(getErrorMessage(authError));
                return;
            }

            // Get token and user from URL
            const token = searchParams.get('token');
            const userJson = searchParams.get('user');

            if (!token || !userJson) {
                setStatus('error');
                setError('Authentication failed. No token received.');
                return;
            }

            try {
                // Parse user data
                const user = JSON.parse(decodeURIComponent(userJson));

                // Store token and user in localStorage
                localStorage.setItem('authToken', token);
                localStorage.setItem('user', JSON.stringify(user));

                // Dispatch custom event for App.tsx to detect login
                window.dispatchEvent(new CustomEvent('oauth-login', { detail: { user, token } }));

                setStatus('success');

                // Redirect to main app after brief delay
                setTimeout(() => {
                    navigate('/', { replace: true });
                    // Force page reload to ensure App.tsx picks up the new auth state
                    window.location.reload();
                }, 1000);
            } catch (err) {
                console.error('OAuth callback error:', err);
                setStatus('error');
                setError('Failed to process authentication response.');
            }
        };

        handleCallback();
    }, [searchParams, navigate]);

    const getErrorMessage = (errorCode: string): string => {
        switch (errorCode) {
            case 'google_failed':
                return 'Google authentication was cancelled or failed. Please try again.';
            case 'linkedin_failed':
                return 'LinkedIn authentication was cancelled or failed. Please try again.';
            case 'token_generation_failed':
                return 'Failed to create session. Please try again.';
            default:
                return 'Authentication failed. Please try again.';
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-950">
            <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
                {status === 'loading' && (
                    <>
                        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
                        </div>
                        <h2 className="text-xl font-semibold text-navy-900 dark:text-white mb-2">
                            Completing Sign In...
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            Please wait while we set up your session.
                        </p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-navy-900 dark:text-white mb-2">
                            Sign In Successful!
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            Redirecting you to the dashboard...
                        </p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-navy-900 dark:text-white mb-2">
                            Authentication Failed
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                            {error}
                        </p>
                        <button
                            onClick={() => navigate('/', { replace: true })}
                            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
                        >
                            Back to Login
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default OAuthCallback;
