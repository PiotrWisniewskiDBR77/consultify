import React, { useState } from 'react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';

export const LoginView = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await Api.login(email, password);
            window.location.reload();
        } catch (err: any) {
            toast.error(err.message || 'Login failed');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white">
            <form onSubmit={handleLogin} className="p-8 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl w-full max-w-md shadow-xl dark:shadow-none">
                <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>
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
                <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold transition-colors shadow-lg shadow-blue-500/30">Login</button>
            </form>
        </div>
    );
};
