import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { AppView, UserRole } from '../types';

const OAuthCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setCurrentUser, setCurrentView } = useAppStore();
    const [status, setStatus] = React.useState<'processing' | 'success' | 'error'>('processing');
    const [message, setMessage] = React.useState('');

    useEffect(() => {
        const processCallback = async () => {
            try {
                // Backend redirects with token and user in URL query params
                const token = searchParams.get('token');
                const userParam = searchParams.get('user');
                const error = searchParams.get('auth_error');

                if (error) {
                    setStatus('error');
                    let errorMessage = 'Authentication failed';
                    if (error === 'google_failed') {
                        errorMessage = 'Google authentication failed';
                    } else if (error === 'linkedin_failed') {
                        errorMessage = 'LinkedIn authentication failed';
                    } else if (error === 'token_generation_failed') {
                        errorMessage = 'Token generation failed. Please try again.';
                    }
                    setMessage(errorMessage);
                    setTimeout(() => navigate('/'), 3000);
                    return;
                }

                if (!token) {
                    setStatus('error');
                    setMessage('No authentication token received');
                    setTimeout(() => navigate('/'), 3000);
                    return;
                }

                // Save token to localStorage
                localStorage.setItem('token', token);

                // Parse user data if provided
                let user = null;
                if (userParam) {
                    try {
                        user = JSON.parse(decodeURIComponent(userParam));
                    } catch (e) {
                        console.error('Failed to parse user data:', e);
                    }
                }

                // If user data is provided, use it; otherwise fetch from API
                if (user && user.id && user.email) {
                    // Add isAuthenticated flag
                    const authenticatedUser = {
                        ...user,
                        isAuthenticated: true
                    };
                    setCurrentUser(authenticatedUser);

                    // Redirect based on user role
                    if (authenticatedUser.role === 'SUPERADMIN') {
                        setCurrentView(AppView.ADMIN_DASHBOARD);
                    } else if (authenticatedUser.role === UserRole.ADMIN) {
                        setCurrentView(AppView.ADMIN_DASHBOARD);
                    } else {
                        setCurrentView(AppView.USER_DASHBOARD);
                    }

                    setStatus('success');
                    setTimeout(() => {
                        navigate('/');
                    }, 1000);
                } else {
                    // If no user data, try to fetch from API
                    try {
                        const { Api } = await import('../services/api');
                        const userData = await Api.get('/auth/me');
                        if (userData && userData.user) {
                            const authenticatedUser = {
                                ...userData.user,
                                isAuthenticated: true
                            };
                            setCurrentUser(authenticatedUser);

                            if (authenticatedUser.role === 'SUPERADMIN') {
                                setCurrentView(AppView.ADMIN_DASHBOARD);
                            } else if (authenticatedUser.role === UserRole.ADMIN) {
                                setCurrentView(AppView.ADMIN_DASHBOARD);
                            } else {
                                setCurrentView(AppView.USER_DASHBOARD);
                            }

                            setStatus('success');
                            setTimeout(() => {
                                navigate('/');
                            }, 1000);
                        } else {
                            throw new Error('Failed to fetch user data');
                        }
                    } catch (err: any) {
                        setStatus('error');
                        setMessage(err.message || 'Failed to authenticate');
                        setTimeout(() => navigate('/'), 3000);
                    }
                }
            } catch (err: any) {
                setStatus('error');
                setMessage(err.message || 'Authentication failed');
                setTimeout(() => navigate('/'), 3000);
            }
        };

        processCallback();
    }, [searchParams, navigate, setCurrentUser, setCurrentView]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-navy-950 px-4 py-12">
            <div className="w-full max-w-md space-y-8 text-center">
                {status === 'processing' && (
                    <div>
                        <h2 className="mt-6 text-3xl font-bold tracking-tight text-navy-900 dark:text-white">
                            Processing authentication...
                        </h2>
                        <div className="mt-4 animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
                    </div>
                )}
                {status === 'success' && (
                    <div>
                        <h2 className="mt-6 text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">
                            Authentication Successful!
                        </h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Redirecting...</p>
                    </div>
                )}
                {status === 'error' && (
                    <div>
                        <h2 className="mt-6 text-3xl font-bold tracking-tight text-red-600 dark:text-red-400">
                            Authentication Failed
                        </h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-4 rounded-md bg-purple-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 transition-colors"
                        >
                            Back to Home
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OAuthCallback;
