import {
  AlertCircle,
  CheckCircle,
  Clock,
  Mail,
  RefreshCw,
  Send,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import InviteUserModal from '../../components/InviteUserModal';
import { useAppStore } from '../../store/useAppStore';
import { Invitation, InvitationEvent, InvitationStatus, InvitationType } from '../../types';

interface InvitationsManagementProps {
  organizationId?: string;
}

type TabType = 'pending' | 'accepted' | 'expired' | 'revoked' | 'all';

const API_URL = '/api';

const InvitationsManagement: React.FC<InvitationsManagementProps> = ({ organizationId }) => {
  const { currentUser } = useAppStore();
  const token = localStorage.getItem('token');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditEvents, setAuditEvents] = useState<InvitationEvent[]>([]);

  const fetchInvitations = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const statusFilter = activeTab !== 'all' ? `?status=${activeTab}` : '';
      const res = await fetch(`${API_URL}/invitations/org${statusFilter}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch invitations');
      }

      const data = await res.json();
      setInvitations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [token, activeTab]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleResend = async (invitationId: string) => {
    try {
      const res = await fetch(`${API_URL}/invitations/${invitationId}/resend`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to resend invitation');
      }

      fetchInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend');
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;

    try {
      const res = await fetch(`${API_URL}/invitations/${invitationId}/revoke`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to revoke invitation');
      }

      fetchInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke');
    }
  };

  const handleViewAudit = async (invitation: Invitation) => {
    setSelectedInvitation(invitation);

    try {
      const res = await fetch(`${API_URL}/invitations/${invitation.id}/audit`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch audit trail');
      }

      const data = await res.json();
      setAuditEvents(data);
      setShowAuditModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit trail');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'expired':
        return <AlertCircle className="w-4 h-4 text-gray-500 dark:text-gray-400" />;
      case 'revoked':
        return <XCircle className="w-4 h-4 text-danger-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300',
      accepted: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
      expired: 'bg-gray-100 dark:bg-navy-800 text-gray-800 dark:text-gray-300',
      revoked: 'bg-danger-100 text-danger-800 dark:bg-danger-500/15 dark:text-danger-300',
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}
      >
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'expired', label: 'Expired' },
    { key: 'revoked', label: 'Revoked' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Invitations
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Manage organization and project invitations
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Mail className="w-4 h-4" />
          Invite User
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 dark:bg-danger-900/30 dark:border-danger-900/60 dark:text-danger-300 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-danger-700 hover:text-danger-900"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Invitations Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading invitations...</span>
        </div>
      ) : invitations.length === 0 ? (
        <div className="text-center py-12">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No invitations</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {activeTab === 'pending'
              ? 'No pending invitations. Click "Invite User" to send one.'
              : `No ${activeTab} invitations found.`}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-navy-900 rounded-lg border border-gray-200 dark:border-navy-700 overflow-hidden">
          <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="min-w-full divide-y divide-gray-200 dark:divide-navy-700">
            <thead className="bg-gray-50 dark:bg-navy-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Account Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Invited By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-navy-900 divide-y divide-gray-200 dark:divide-navy-700">
              {invitations.map((invitation) => (
                <tr key={invitation.id} className="hover:bg-gray-50 dark:hover:bg-navy-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{invitation.email}</div>
                    {invitation.projectName && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Project: {invitation.projectName}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        invitation.invitationType === InvitationType.PROJECT
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300'
                          : 'bg-primary-100 text-primary-800 dark:bg-primary-500/15 dark:text-primary-300'
                      }`}
                    >
                      {invitation.invitationType || 'ORG'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900 dark:text-gray-100">{invitation.roleToAssign}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(invitation.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {invitation.invitedBy
                      ? `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(invitation.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleViewAudit(invitation)}
                      className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      title="View audit trail"
                    >
                      <Clock className="w-4 h-4 inline" />
                    </button>
                    {invitation.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleResend(invitation.id)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Resend invitation"
                        >
                          <Send className="w-4 h-4 inline" />
                        </button>
                        <button
                          onClick={() => handleRevoke(invitation.id)}
                          className="text-danger-600 hover:text-danger-900"
                          title="Revoke invitation"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteUserModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            fetchInvitations();
          }}
        />
      )}

      {/* Audit Trail Modal */}
      {showAuditModal && selectedInvitation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Audit Trail</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Invitation to {selectedInvitation.email}
              </p>
            </div>
            <div className="p-6 overflow-y-auto max-h-96">
              {auditEvents.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center">
                  No audit events found
                </p>
              ) : (
                <div className="space-y-4">
                  {auditEvents.map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-indigo-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {event.performedBy
                            ? `by ${event.performedBy.firstName} ${event.performedBy.lastName}`
                            : 'System'}
                          {' • '}
                          {formatDate(event.createdAt)}
                        </p>
                        {event.ipAddress && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            IP: {event.ipAddress}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-navy-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { InvitationsManagement };
