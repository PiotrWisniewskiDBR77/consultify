import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Api } from '../../services/api';

/**
 * VerifyEmail View
 * Handles the email verification link click (from email).
 */
export const VerifyEmail: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [message, setMessage] = useState('Verifying your email...');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('No verification token provided.');
            return;
        }

        const verify = async () => {
            try {
                const res = await Api.post('/auth/verify-email', { token });
                if (res.data.success) {
                    setStatus('success');
                    setMessage('Email verified successfully! You can now access all features.');
                } else {
                    setStatus('error');
                    setMessage(res.data.error || 'Verification failed.');
                }
            } catch (err: any) {
                setStatus('error');
                setMessage(err.response?.data?.error || 'Verification failed. The token may be expired.');
            }
        };

        verify();
    }, [token]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-navy-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-navy-800 rounded-xl shadow-xl max-w-md w-full p-8 text-center border border-slate-200 dark:border-navy-700">
                {status === 'verifying' && (
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-2">Verifying...</h2>
                        <p className="text-slate-500 dark:text-slate-400">{message}</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 text-green-500">
                            <CheckCircle size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-2">Verified!</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">{message}</p>
                        <Link
                            to="/login"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                        >
                            Go to Login
                        </Link>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-500">
                            <XCircle size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-2">Verification Failed</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">{message}</p>
                        <Link
                            to="/login"
                            className="text-blue-600 hover:text-blue-500 font-medium"
                        >
                            Back to Login
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VerifyEmail;
