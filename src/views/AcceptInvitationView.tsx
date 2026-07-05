import { AlertCircle, Building2, CheckCircle, Loader2, Shield, Users, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { API_URL } from '@/services/api';

import { WORK_LOCATION_COUNTRIES } from '../constants/countries';
import { useAppStore } from '../store/useAppStore';
import { InvitationType, InvitationValidation } from '../types';

interface AcceptInvitationViewProps {
  token: string;
  onAccepted?: (user: { id: string; email: string }) => void;
  onError?: (error: string) => void;
}

const INVITE_PUBLIC_ERROR_COPY = {
  invalidLink: 'Invalid invitation link',
  validateFailed: 'We could not validate this invitation. Please request a new invite link.',
  acceptFailed: 'We could not complete invitation acceptance. Please try again.',
} as const;

function mapPublicInvitationError(input: unknown, context: 'validate' | 'accept'): string {
  const payload = input as {
    message?: unknown;
    code?: unknown;
    error?: unknown;
  } | null;

  const nestedError = payload?.error as { message?: unknown; code?: unknown } | undefined;
  const codeCandidates = [payload?.code, nestedError?.code].filter(
    (candidate): candidate is string => typeof candidate === 'string'
  );
  const code = codeCandidates[0] || null;

  if (code === 'INVITATION_TOKEN_INVALID' || code === 'INVITATION_TOKEN_EXPIRED') {
    return INVITE_PUBLIC_ERROR_COPY.validateFailed;
  }
  if (code === 'INVITATION_ACCEPTANCE_FAILED') {
    return INVITE_PUBLIC_ERROR_COPY.acceptFailed;
  }

  return context === 'validate'
    ? INVITE_PUBLIC_ERROR_COPY.validateFailed
    : INVITE_PUBLIC_ERROR_COPY.acceptFailed;
}

async function readSafeResponsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const AcceptInvitationView: React.FC<AcceptInvitationViewProps> = ({
  token,
  onAccepted,
  onError,
}) => {
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const logout = useAppStore((s) => s.logout);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [invitation, setInvitation] = useState<InvitationValidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailMismatch, setEmailMismatch] = useState(false);

  // Form state
  const [enteredEmail, setEnteredEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token.trim()) {
        const message = INVITE_PUBLIC_ERROR_COPY.invalidLink;
        setError(message);
        onError?.(message);
        setValidating(false);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/invitations/validate/${token}`);
        const data = await readSafeResponsePayload(res);

        if (!res.ok) {
          const mappedMessage = mapPublicInvitationError(data, 'validate');
          throw new Error(mappedMessage);
        }

        const validated = data as InvitationValidation;
        setInvitation(validated);
        // Prefill name from the pre-created (pending) account, if the server provided it.
        if (validated.firstName) setFirstName(validated.firstName);
        if (validated.lastName) setLastName(validated.lastName);
        const loggedEmail = currentUser?.email?.trim().toLowerCase();
        const invitedEmail = (data as InvitationValidation | null)?.email?.trim().toLowerCase();
        const shouldBlockMismatch = Boolean(
          currentUser?.isAuthenticated &&
          loggedEmail &&
          invitedEmail &&
          loggedEmail !== invitedEmail
        );
        setEmailMismatch(shouldBlockMismatch);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : mapPublicInvitationError(err, 'validate');
        setError(message);
        onError?.(message);
      } finally {
        setValidating(false);
        setLoading(false);
      }
    };

    validateToken();
  }, [token, onError, currentUser?.email, currentUser?.isAuthenticated]);

  const handleSignOutAndContinue = () => {
    logout();
    navigate('/login');
  };

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

    if (invitation?.requireEmail) {
      const em = enteredEmail.trim();
      if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        setError('Please enter your work email address');
        return;
      }
    }

    const requireProfile = invitation?.requireProfile === true;
    if (requireProfile) {
      if (!jobTitle.trim() || !siteLocation.trim()) {
        setError('Please provide your job title and the country where you work');
        return;
      }
    } else if (!jobTitle.trim() || !department.trim()) {
      setError('Please provide your function and department in the organization');
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          email: invitation?.requireEmail ? enteredEmail.trim().toLowerCase() : invitation?.email,
          firstName,
          lastName,
          jobTitle: jobTitle.trim(),
          department: department.trim(),
          siteLocation: siteLocation.trim() || undefined,
          password,
        }),
      });

      const data = await readSafeResponsePayload(res);

      if (!res.ok) {
        throw new Error(mapPublicInvitationError(data, 'accept'));
      }

      setSuccess(true);
      onAccepted?.(
        (data as any)?.user || {
          id: (data as any)?.userId || '',
          email: invitation?.email || '',
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : mapPublicInvitationError(err, 'accept');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || validating) {
    return (
      <div className="min-h-screen bg-c-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-c-accent mx-auto mb-4" />
          <p className="text-c-text-secondary">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-c-bg flex items-center justify-center p-4">
        <div className="bg-c-surface rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-c-danger mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-c-text mb-2">Invalid Invitation</h1>
          <p className="text-c-text-secondary mb-6" role="alert" aria-live="assertive">
            {error}
          </p>
          <a
            href="/"
            className="inline-flex items-center px-6 py-3 bg-c-accent hover:opacity-90 text-white rounded-lg transition-opacity"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-c-bg flex items-center justify-center p-4">
        <div className="bg-c-surface rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-c-success mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-c-text mb-2">Welcome!</h1>
          <p className="text-c-text-secondary mb-6">
            Your account has been created successfully. You can now log in to access your
            organization.
          </p>
          <a
            href="/login"
            className="inline-flex items-center px-6 py-3 bg-c-accent hover:opacity-90 text-white rounded-lg transition-opacity"
          >
            Log In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-c-bg flex items-center justify-center p-4 [color-scheme:light]">
      <div className="bg-c-surface rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-c-accent text-white p-6">
          <h1 className="text-2xl font-bold mb-2">Join {invitation?.organizationName}</h1>
          <p className="text-white/80">
            You've been invited to join as a{' '}
            <span className="font-semibold">{invitation?.roleToAssign}</span>
            {invitation?.invitationType === InvitationType.PROJECT && invitation?.projectName && (
              <>
                {' '}
                on the <span className="font-semibold">{invitation.projectName}</span> project
              </>
            )}
          </p>
        </div>

        {/* Invitation Details */}
        <div className="p-6 border-b border-c-border-subtle">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-c-accent-soft rounded-lg">
                <Building2 className="w-5 h-5 text-c-accent" />
              </div>
              <div>
                <p className="text-xs text-c-text-muted">Organization</p>
                <p className="font-medium text-c-text">{invitation?.organizationName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-c-accent-soft rounded-lg">
                <Shield className="w-5 h-5 text-c-accent" />
              </div>
              <div>
                <p className="text-xs text-c-text-muted">Role</p>
                <p className="font-medium text-c-text">{invitation?.roleToAssign}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {emailMismatch && (
            <div className="bg-c-warning/10 border border-c-warning/30 text-c-warning px-4 py-3 rounded-lg text-sm">
              <p className="font-medium mb-1">Signed in with a different account</p>
              <p className="mb-3">
                This invitation is for <span className="font-semibold">{invitation?.email}</span>.
                Sign out and continue with the invited address.
              </p>
              <button
                type="button"
                onClick={handleSignOutAndContinue}
                className="inline-flex items-center px-3 py-1.5 bg-c-warning text-white rounded-md hover:opacity-90 transition-opacity"
              >
                Sign out and continue
              </button>
            </div>
          )}

          {error && (
            <div
              className="bg-c-danger/10 border border-c-danger/30 text-c-danger px-4 py-3 rounded-lg flex items-center gap-2 text-sm"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {invitation?.requireEmail ? (
            <div>
              <label
                htmlFor="enteredEmail"
                className="block text-sm font-medium text-c-text-secondary mb-1"
              >
                Your work email *
              </label>
              <input
                type="email"
                id="enteredEmail"
                value={enteredEmail}
                onChange={(e) => setEnteredEmail(e.target.value)}
                placeholder="you@vtsgroup.com"
                autoComplete="email"
                required
                className="w-full px-4 py-2 border border-c-border rounded-lg focus:ring-2 focus:ring-c-focus focus:border-transparent bg-c-surface text-c-text placeholder:text-c-text-muted"
              />
              <p className="mt-1 text-xs text-c-text-muted">
                Use the work email this invitation was sent to.
              </p>
            </div>
          ) : (
            <div className="bg-c-bg rounded-lg p-3 text-sm">
              <span className="text-c-text-secondary">Joining as:</span>{' '}
              <span className="font-medium text-c-text">{invitation?.email}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-c-text-secondary mb-1"
              >
                First Name *
              </label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2 border border-c-border rounded-lg focus:ring-2 focus:ring-c-focus focus:border-transparent bg-c-surface text-c-text placeholder:text-c-text-muted"
                required
              />
            </div>
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-c-text-secondary mb-1"
              >
                Last Name *
              </label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2 border border-c-border rounded-lg focus:ring-2 focus:ring-c-focus focus:border-transparent bg-c-surface text-c-text placeholder:text-c-text-muted"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="jobTitle"
                className="block text-sm font-medium text-c-text-secondary mb-1"
              >
                Job Title *
              </label>
              <input
                type="text"
                id="jobTitle"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Production Manager"
                className="w-full px-4 py-2 border border-c-border rounded-lg focus:ring-2 focus:ring-c-focus focus:border-transparent bg-c-surface text-c-text placeholder:text-c-text-muted"
                required
              />
            </div>
            <div>
              <label
                htmlFor="siteLocation"
                className="block text-sm font-medium text-c-text-secondary mb-1"
              >
                Country where you work{invitation?.requireProfile ? ' *' : ''}
              </label>
              <select
                id="siteLocation"
                value={siteLocation}
                onChange={(e) => setSiteLocation(e.target.value)}
                className="w-full px-4 py-2 border border-c-border rounded-lg focus:ring-2 focus:ring-c-focus focus:border-transparent bg-c-surface text-c-text placeholder:text-c-text-muted"
                required={invitation?.requireProfile === true}
              >
                <option value="">Select a country…</option>
                {WORK_LOCATION_COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!invitation?.requireProfile && (
            <div>
              <label
                htmlFor="department"
                className="block text-sm font-medium text-c-text-secondary mb-1"
              >
                Department *
              </label>
              <input
                type="text"
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Operations"
                className="w-full px-4 py-2 border border-c-border rounded-lg focus:ring-2 focus:ring-c-focus focus:border-transparent bg-c-surface text-c-text placeholder:text-c-text-muted"
                required
              />
            </div>
          )}

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-c-text-secondary mb-1"
            >
              Password *
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-2 border border-c-border rounded-lg focus:ring-2 focus:ring-c-focus focus:border-transparent bg-c-surface text-c-text placeholder:text-c-text-muted"
              required
              minLength={8}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-c-text-secondary mb-1"
            >
              Confirm Password *
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-c-border rounded-lg focus:ring-2 focus:ring-c-focus focus:border-transparent bg-c-surface text-c-text placeholder:text-c-text-muted"
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
              className="mt-1 h-4 w-4 text-c-accent focus:ring-c-focus border-c-border rounded"
            />
            <label htmlFor="terms" className="text-sm text-c-text-secondary">
              I agree to the{' '}
              <a href="/legal/terms" className="text-c-accent hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/legal/privacy" className="text-c-accent hover:underline">
                Privacy Policy
              </a>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <a
              href="/"
              className="flex-1 px-4 py-3 bg-c-surface-raised text-c-text-secondary rounded-lg hover:bg-c-border-subtle transition-colors font-medium text-center"
            >
              Decline
            </a>
            <button
              type="submit"
              disabled={
                emailMismatch ||
                submitting ||
                !firstName ||
                !lastName ||
                !jobTitle ||
                (invitation?.requireProfile ? !siteLocation : !department) ||
                !password ||
                !acceptedTerms
              }
              className="flex-1 px-4 py-3 bg-c-accent hover:opacity-90 text-white rounded-lg transition-opacity font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
