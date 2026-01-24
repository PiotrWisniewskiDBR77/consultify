/**
 * CustomerCommunicationView - Customer Communication Center
 * Connected to Backend API
 */

import { Clock, Loader2, Mail, MessageSquare, Plus, Send, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Card } from '../../../components/Admin/shared/Card';
import { InfoButton } from '../../../components/shared/InfoButton';
import Api from '../../../services/api';

interface Communication {
  id: string;
  type: 'email' | 'announcement' | 'broadcast';
  subject: string;
  content?: string;
  recipients_filter?: string;
  recipient_count?: number;
  sent_at: string | null;
  status: string;
  open_count?: number;
  click_count?: number;
  created_at: string;
}

const RECIPIENT_LABELS: Record<string, string> = {
  all: 'All Customers',
  all_active: 'All Active Users',
  enterprise: 'Enterprise Only',
  trial: 'Trial Users',
};

const CustomerCommunicationView: React.FC = () => {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState({
    type: 'email',
    subject: '',
    recipients: 'all',
    content: '',
  });

  useEffect(() => {
    fetchCommunications();
  }, []);

  const fetchCommunications = async () => {
    setLoading(true);
    try {
      const data = await Api.getCommunications();
      setCommunications(data || []);
    } catch (err) {
      console.error('Failed to fetch communications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.subject || !newMessage.content) return;

    setSending(true);
    try {
      const result = await Api.createCommunication({
        type: newMessage.type,
        subject: newMessage.subject,
        content: newMessage.content,
        recipients_filter: { audience: newMessage.recipients },
      });

      if (result.success && result.id) {
        // Immediately send it
        await Api.sendCommunication(result.id);
      }

      setShowComposeModal(false);
      setNewMessage({ type: 'email', subject: '', recipients: 'all', content: '' });
      fetchCommunications();
    } catch (err) {
      console.error('Failed to send communication:', err);
    } finally {
      setSending(false);
    }
  };

  const getOpenRate = (comm: Communication): number | null => {
    if (!comm.recipient_count || comm.recipient_count === 0) return null;
    return Math.round(((comm.open_count || 0) * 100) / comm.recipient_count);
  };

  const getRecipientsLabel = (comm: Communication): string => {
    try {
      const filter = comm.recipients_filter ? JSON.parse(comm.recipients_filter) : {};
      return RECIPIENT_LABELS[filter.audience] || 'All Customers';
    } catch {
      return 'All Customers';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Communication Center</h2>
            <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
              Send announcements and messages to customers
            </p>
          </div>
          <InfoButton cardId="superadmin-communication" />
        </div>
        <button
          onClick={() => setShowComposeModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Message
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        <Card
          className="bg-gray-800 p-4 cursor-pointer hover:bg-gray-700/80 transition-colors"
          onClick={() => {
            setNewMessage({ ...newMessage, type: 'email' });
            setShowComposeModal(true);
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-medium">Send Email</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Direct email to customers
              </span>
            </div>
          </div>
        </Card>
        <Card
          className="bg-gray-800 p-4 cursor-pointer hover:bg-gray-700/80 transition-colors"
          onClick={() => {
            setNewMessage({ ...newMessage, type: 'announcement' });
            setShowComposeModal(true);
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <MessageSquare className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-white font-medium">Announcement</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                In-app notification
              </span>
            </div>
          </div>
        </Card>
        <Card
          className="bg-gray-800 p-4 cursor-pointer hover:bg-gray-700/80 transition-colors"
          onClick={() => {
            setNewMessage({ ...newMessage, type: 'broadcast' });
            setShowComposeModal(true);
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-white font-medium">Broadcast</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                Multi-channel message
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Communications */}
      <Card className="bg-gray-800 p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Communications</h3>
        {communications.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400">
              No communications sent yet
            </p>
            <button
              onClick={() => setShowComposeModal(true)}
              className="mt-4 text-blue-400 hover:text-blue-300"
            >
              Send your first message
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {communications.map((comm) => {
              const openRate = getOpenRate(comm);
              return (
                <div
                  key={comm.id}
                  className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:bg-gray-700/80 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          comm.type === 'email'
                            ? 'bg-blue-500/20'
                            : comm.type === 'announcement'
                              ? 'bg-purple-500/20'
                              : 'bg-green-500/20'
                        }`}
                      >
                        {comm.type === 'email' && <Mail className="w-4 h-4 text-blue-400" />}
                        {comm.type === 'announcement' && (
                          <MessageSquare className="w-4 h-4 text-purple-400" />
                        )}
                        {comm.type === 'broadcast' && <Users className="w-4 h-4 text-green-400" />}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{comm.subject}</h4>
                        <p className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400">
                          {getRecipientsLabel(comm)}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {comm.sent_at ? new Date(comm.sent_at).toLocaleDateString() : 'Draft'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded ${
                              comm.status === 'sent'
                                ? 'bg-green-500/20 text-green-400'
                                : comm.status === 'draft'
                                  ? 'bg-gray-50 dark:bg-navy-8000/20 text-gray-400'
                                  : 'bg-yellow-500/20 text-yellow-400'
                            }`}
                          >
                            {comm.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    {openRate !== null && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{openRate}%</p>
                        <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">
                          Open Rate
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Compose Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold text-white mb-4">
              {newMessage.type === 'email' && 'Compose Email'}
              {newMessage.type === 'announcement' && 'Create Announcement'}
              {newMessage.type === 'broadcast' && 'Send Broadcast'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Recipients</label>
                <select
                  value={newMessage.recipients}
                  onChange={(e) => setNewMessage({ ...newMessage, recipients: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="all">All Customers</option>
                  <option value="enterprise">Enterprise Only</option>
                  <option value="trial">Trial Users</option>
                  <option value="all_active">Active Users (30d)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Subject</label>
                <input
                  type="text"
                  value={newMessage.subject}
                  onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Message subject..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Content</label>
                <textarea
                  value={newMessage.content}
                  onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  rows={5}
                  placeholder="Write your message..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowComposeModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!newMessage.subject || !newMessage.content || sending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerCommunicationView;
