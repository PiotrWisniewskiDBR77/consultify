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
        <div className="flex items-center justify-center min-h-screen bg-navy-950 text-white">
            <form onSubmit={handleLogin} className="p-8 bg-navy-900 border border-white/10 rounded-xl w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6">Login</h1>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full mb-4 p-3 bg-navy-950 border border-white/10 rounded"
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full mb-6 p-3 bg-navy-950 border border-white/10 rounded"
                />
                <button type="submit" className="w-full py-3 bg-blue-600 rounded font-bold">Login</button>
            </form>
        </div>
    );
};
