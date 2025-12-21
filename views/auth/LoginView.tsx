import React, { useState } from 'react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';

export const LoginView = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mfaToken, setMfaToken] = useState('');
    const [isMfaRequired, setIsMfaRequired] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await Api.post('/auth/login', { email, password, mfaToken });

            if (res.data.mfaRequired) {
                setIsMfaRequired(true);
                toast.success(res.data.message || 'Please enter 2FA Code');
                return;
            }

            if (res.data.token) {
                // Handle successful login (store token etc)
                // Assuming Api.login handles storage internally, but here we called post directly
                // So we need to store it manually or call existing helper if available
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('refreshToken', res.data.refreshToken);
                window.location.reload();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.error || err.message || 'Login failed');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white">
            <form onSubmit={handleLogin} className="p-8 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl w-full max-w-md shadow-xl dark:shadow-none">
                <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>

                {!isMfaRequired ? (
                    <>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full mb-4 p-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full mb-6 p-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                        />
                    </>
                ) : (
                    <>
                        <div className="mb-4 text-center text-slate-500">
                            Enter the 6-digit code from your authenticator app.
                        </div>
                        <input
                            type="text"
                            placeholder="2FA Code"
                            value={mfaToken}
                            onChange={e => setMfaToken(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                            className="w-full mb-6 p-3 text-center text-2xl tracking-widest font-mono bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                            autoFocus
                        />
                    </>
                )}

                <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold transition-colors shadow-lg shadow-blue-500/30">
                    {isMfaRequired ? 'Verify' : 'Login'}
                </button>

                {isMfaRequired && (
                    <button
                        type="button"
                        onClick={() => setIsMfaRequired(false)}
                        className="w-full mt-4 text-sm text-slate-500 hover:text-slate-700"
                    >
                        Back to Login
                    </button>
                )}
            </form>
        </div>
    );
};
