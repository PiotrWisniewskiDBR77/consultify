import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Api } from '../services/api';

export const OAuthCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = React.useState<'processing' | 'success' | 'error'>('processing');
    const [message, setMessage] = React.useState('');

    useEffect(() => {
        const processCallback = async () => {
            try {
                const code = searchParams.get('code');
                const state = searchParams.get('state');
                const error = searchParams.get('error');

                if (error) {
                    setStatus('error');
                    setMessage(error);
                    setTimeout(() => navigate('/login'), 3000);
                    return;
                }

                if (!code) {
                    setStatus('error');
                    setMessage('No authorization code received');
                    setTimeout(() => navigate('/login'), 3000);
                    return;
                }

                // Exchange code for token
                const response = await Api.post('/auth/oauth/callback', {
                    code,
                    state
                });

                if (response.token) {
                    localStorage.setItem('token', response.token);
                    setStatus('success');
                    setTimeout(() => {
                        navigate('/');
                    }, 2000);
                } else {
                    setStatus('error');
                    setMessage('Failed to authenticate');
                    setTimeout(() => navigate('/login'), 3000);
                }
            } catch (err: any) {
                setStatus('error');
                setMessage(err.message || 'Authentication failed');
                setTimeout(() => navigate('/login'), 3000);
            }
        };

        processCallback();
    }, [searchParams, navigate]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
            <div className="w-full max-w-md space-y-8 text-center">
                {status === 'processing' && (
                    <div>
                        <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
                            Processing authentication...
                        </h2>
                        <div className="mt-4 animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
                    </div>
                )}
                {status === 'success' && (
                    <div>
                        <h2 className="mt-6 text-3xl font-bold tracking-tight text-green-600">
                            Authentication Successful!
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">Redirecting...</p>
                    </div>
                )}
                {status === 'error' && (
                    <div>
                        <h2 className="mt-6 text-3xl font-bold tracking-tight text-red-600">
                            Authentication Failed
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">{message}</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="mt-4 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                        >
                            Back to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
