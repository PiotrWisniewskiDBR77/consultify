import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader2, Building2, Users, Shield, LogOut, LogIn } from 'lucide-react';
import { InvitationValidation, InvitationType } from '../types';
import { useStore } from '../store';

interface AcceptInvitationViewProps {
    token: string;
    onAccepted?: (user: { id: string; email: string }) => void;
    onError?: (error: string) => void;
}

const API_URL = '/api';

const AcceptInvitationView: React.FC<AcceptInvitationViewProps> = ({ token, onAccepted, onError }) => {
    const { currentUser } = useStore();
    const [loading, setLoading] = useState(true);
    const [validating, setValidating] = useState(true);
    const [invitation, setInvitation] = useState<InvitationValidation | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [emailMismatch, setEmailMismatch] = useState(false);

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Validate token on mount
    useEffect(() => {
        const validateToken = async () => {
            try {
                const res = await fetch(`${API_URL}/invitations/validate/${token}`);
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'Invalid invitation');
                }

                setInvitation(data);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to validate invitation';
                setError(message);
                onError?.(message);
            } finally {
                setValidating(false);
                setLoading(false);
            }
        };

        validateToken();
    }, [token, onError]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (!acceptedTerms) {
            setError('You must accept the terms and conditions');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/invitations/accept`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token,
                    email: invitation?.email,
                    firstName,
                    lastName,
                    password
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to accept invitation');
            }

            setSuccess(true);
            onAccepted?.(data.user);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to accept invitation';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || validating) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-gray-600">Validating invitation...</p>
                </div>
            </div>
        );
    }

    if (error && !invitation) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <a
                        href="/"
                        className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Go to Home
                    </a>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h1>
                    <p className="text-gray-600 mb-6">
                        Your account has been created successfully. You can now log in to access your organization.
                    </p>
                    <a
                        href="/login"
                        className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Log In
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
                {/* Header */}
                <div className="bg-indigo-600 text-white p-6">
                    <h1 className="text-2xl font-bold mb-2">Join {invitation?.organizationName}</h1>
                    <p className="text-indigo-100">
                        You've been invited to join as a{' '}
                        <span className="font-semibold">{invitation?.roleToAssign}</span>
                        {invitation?.invitationType === InvitationType.PROJECT && invitation?.projectName && (
                            <> on the <span className="font-semibold">{invitation.projectName}</span> project</>
                        )}
                    </p>
                </div>

                {/* Invitation Details */}
                <div className="p-6 border-b border-gray-100">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 rounded-lg">
                                <Building2 className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Organization</p>
                                <p className="font-medium text-gray-900">{invitation?.organizationName}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 rounded-lg">
                                <Shield className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Role</p>
                                <p className="font-medium text-gray-900">{invitation?.roleToAssign}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                        <span className="text-gray-500">Joining as:</span>{' '}
                        <span className="font-medium text-gray-900">{invitation?.email}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                                First Name *
                            </label>
                            <input
                                type="text"
                                id="firstName"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                                Last Name *
                            </label>
                            <input
                                type="text"
                                id="lastName"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                            Password *
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                            minLength={8}
                        />
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                            Confirm Password *
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Terms Checkbox */}
                    <div className="flex items-start gap-2">
                        <input
                            type="checkbox"
                            id="terms"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="terms" className="text-sm text-gray-600">
                            I agree to the{' '}
                            <a href="/legal/terms" className="text-indigo-600 hover:underline">Terms of Service</a>
                            {' '}and{' '}
                            <a href="/legal/privacy" className="text-indigo-600 hover:underline">Privacy Policy</a>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <a
                            href="/"
                            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-center"
                        >
                            Decline
                        </a>
                        <button
                            type="submit"
                            disabled={submitting || !firstName || !lastName || !password || !acceptedTerms}
                            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Joining...
                                </>
                            ) : (
                                <>
                                    <Users className="w-4 h-4" />
                                    Accept & Join
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AcceptInvitationView;
