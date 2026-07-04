/**
 * SecurityPanel - Security & Compliance Management
 */

import { AlertTriangle, CheckCircle, Filter, Loader2, Shield, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

export const SecurityPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'events' | 'compliance'>('events');
  const [events, setEvents] = useState<any[]>([]);
  const [complianceRecords, setComplianceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'events') {
        const data = await (Api as any).getSecurityEvents();
        setEvents(data);
      } else {
        const data = await (Api as any).getComplianceReport();
        setComplianceRecords(data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveEvent = async (id: string) => {
    try {
      await Api.resolveSecurityEvent(id);
      toast.success('Security event resolved');
      fetchData();
    } catch (error) {
      console.error('Failed to resolve event:', error);
      toast.error('Failed to resolve security event');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text mb-2">Security & Compliance</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            Monitor security events and compliance status
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-c-border-subtle">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'events'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 dark:text-slate-500 hover:text-white'
          }`}
        >
          Security Events
        </button>
        <button
          onClick={() => setActiveTab('compliance')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'compliance'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 dark:text-slate-500 hover:text-white'
          }`}
        >
          Compliance
        </button>
      </div>

      {activeTab === 'events' ? (
        <div className="space-y-4">
          {stats && (
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-c-border-subtle">
                <div className="text-sm text-slate-400 dark:text-slate-500">Total Events</div>
                <div className="text-2xl font-bold text-c-text">{stats.total || 0}</div>
              </div>
              <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-c-border-subtle">
                <div className="text-sm text-slate-400 dark:text-slate-500">Critical</div>
                <div className="text-2xl font-bold text-danger-400">{stats.critical || 0}</div>
              </div>
              <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-c-border-subtle">
                <div className="text-sm text-slate-400 dark:text-slate-500">High</div>
                <div className="text-2xl font-bold text-amber-400">{stats.high || 0}</div>
              </div>
              <div className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-c-border-subtle">
                <div className="text-sm text-slate-400 dark:text-slate-500">Unresolved</div>
                <div className="text-2xl font-bold text-yellow-400">{stats.unresolved || 0}</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {events.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                No security events
              </div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-c-border-subtle"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            event.severity === 'CRITICAL'
                              ? 'bg-danger-500/20 text-danger-400'
                              : event.severity === 'HIGH'
                                ? 'bg-amber-500/20 text-amber-400'
                                : event.severity === 'MEDIUM'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-green-500/20 text-green-400'
                          }`}
                        >
                          {event.severity}
                        </span>
                        <span className="text-c-text font-medium">{event.event_type}</span>
                        {event.resolved ? (
                          <CheckCircle size={16} className="text-green-400" />
                        ) : (
                          <XCircle size={16} className="text-danger-400" />
                        )}
                      </div>
                      <p className="text-sm text-slate-400 dark:text-slate-500">
                        {new Date(event.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!event.resolved && (
                      <button
                        onClick={() => handleResolveEvent(event.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-c-text">Compliance Records</h3>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
              Add Record
            </button>
          </div>
          <div className="space-y-2">
            {complianceRecords.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                No compliance records
              </div>
            ) : (
              complianceRecords.map((record) => (
                <div
                  key={record.id}
                  className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-c-border-subtle"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-c-text font-medium">{record.framework}</span>
                        <span
                          className="px-2 py-1 text-xs rounded ${
                                                    record.status === 'compliant' ? 'bg-green-500/20 text-green-400' :
                                                    record.status === 'non_compliant' ? 'bg-danger-500/20 text-danger-400' :
                                                    'bg-slate-500/20 text-slate-400 dark:text-slate-500'
                                                }"
                        >
                          {record.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 dark:text-slate-500">
                        {record.control_name}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityPanel;
