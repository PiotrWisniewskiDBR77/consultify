import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Invalid verification link.');
            return;
        }

        const verify = async () => {
            try {
                await axios.post(`${API_URL}/verify/email`, { token });
                setStatus('success');
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } catch (error: any) {
                setStatus('error');
                setMessage(error.response?.data?.error || 'Verification failed. Token may be expired.');
            }
        };

        verify();
    }, [token, navigate]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 text-center">
                {status === 'verifying' && (
                    <div>
                        <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">Verifying your email...</h2>
                        <div className="mt-4 animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
                    </div>
                )}
                {status === 'success' && (
                    <div>
                        <h2 className="mt-6 text-3xl font-bold tracking-tight text-green-600">Email Verified!</h2>
                        <p className="mt-2 text-sm text-gray-600">Thank you for verifying your email.</p>
                        <p className="mt-2 text-sm text-gray-500">Redirecting to login...</p>
                    </div>
                )}
                {status === 'error' && (
                    <div>
                        <h2 className="mt-6 text-3xl font-bold tracking-tight text-red-600">Verification Failed</h2>
                        <p className="mt-2 text-sm text-gray-600">{message}</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="mt-4 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                            Back to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
