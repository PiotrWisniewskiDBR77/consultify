/**
 * SecurityEventsSettings - Personal Security Audit Log
 *
 * Features:
 * - Personal security event history
 * - Filter by event type
 * - Export security report (PDF/CSV)
 * - Security alerts configuration
 */

import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Key,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  RefreshCw,
  Search,
  Shield,
  Smartphone,
  UserX,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed';
import { LoadingState, StatusChip } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { User } from '../../types';

interface SecurityEventsSettingsProps {
  currentUser: User;
  className?: string;
}

interface SecurityEvent {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  ip?: string;
  location?: string;
  device?: string;
  metadata?: Record<string, any>;
}

interface AlertSettings {
  emailOnSuspiciousLogin: boolean;
  emailOnNewDevice: boolean;
  emailOnPasswordChange: boolean;
  emailOnMfaChange: boolean;
  pushNotifications: boolean;
}

type EventFilter = 'all' | 'login' | 'security' | 'mfa' | 'data' | 'suspicious';

const EVENT_TYPES: { value: EventFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Events', icon: <Activity className="w-4 h-4" /> },
  { value: 'login', label: 'Login Activity', icon: <LogIn className="w-4 h-4" /> },
  { value: 'security', label: 'Security Changes', icon: <Shield className="w-4 h-4" /> },
  { value: 'mfa', label: 'MFA Events', icon: <Key className="w-4 h-4" /> },
  { value: 'data', label: 'Data Access', icon: <Eye className="w-4 h-4" /> },
  { value: 'suspicious', label: 'Suspicious', icon: <AlertTriangle className="w-4 h-4" /> },
];

const DEFAULT_ALERTS: AlertSettings = {
  emailOnSuspiciousLogin: true,
  emailOnNewDevice: true,
  emailOnPasswordChange: true,
  emailOnMfaChange: true,
  pushNotifications: true,
};

export const SecurityEventsSettings: React.FC<SecurityEventsSettingsProps> = ({
  currentUser,
  className = '',
}) => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<EventFilter>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(DEFAULT_ALERTS);
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchEvents();
    fetchAlertSettings();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await Api.get('/api/security/events?limit=50');
      if (response?.events) {
        setEvents(response.events);
      }
    } catch (error) {
      console.error('Failed to fetch security events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertSettings = async () => {
    try {
      const response = await Api.get('/api/security/alert-settings');
      if (response?.settings) {
        setAlertSettings(response.settings);
      }
    } catch (error) {
      // Use defaults
    }
  };

  const handleSaveAlertSettings = async () => {
    setSavingAlerts(true);
    try {
      await Api.put('/api/security/alert-settings', alertSettings);
      toast.success(t('security.events.alertsSaved', 'Alert settings saved'));
      setShowAlertSettings(false);
    } catch (error) {
      toast.error(t('security.events.alertsError', 'Failed to save alert settings'));
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'csv') => {
    setExporting(true);
    try {
      const response = await Api.post('/api/security/report', { format });
      if (response?.downloadUrl) {
        window.open(response.downloadUrl, '_blank');
      } else {
        // Fallback: create local export
        const data = events.map((e) => ({
          date: new Date(e.timestamp).toISOString(),
          type: e.type,
          severity: e.severity,
          title: e.title,
          description: e.description,
          ip: e.ip || '',
          location: e.location || '',
        }));

        if (format === 'csv') {
          const headers = Object.keys(data[0]).join(',');
          const rows = data.map((d) => Object.values(d).join(',')).join('\n');
          const csv = `${headers}\n${rows}`;
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `security-report-${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
      toast.success(t('security.events.exportSuccess', 'Security report exported'));
    } catch (error) {
      toast.error(t('security.events.exportError', 'Failed to export report'));
    } finally {
      setExporting(false);
    }
  };

  const getEventIcon = (type: string, severity: string) => {
    const iconClass =
      severity === 'critical'
        ? 'text-rose-500'
        : severity === 'warning'
          ? 'text-amber-500'
          : 'text-slate-500 dark:text-slate-400';

    switch (type) {
      case 'login':
        return <LogIn className={`w-5 h-5 ${iconClass}`} />;
      case 'logout':
        return <LogOut className={`w-5 h-5 ${iconClass}`} />;
      case 'security':
        return <Shield className={`w-5 h-5 ${iconClass}`} />;
      case 'mfa':
        return <Key className={`w-5 h-5 ${iconClass}`} />;
      case 'data':
        return <Eye className={`w-5 h-5 ${iconClass}`} />;
      case 'suspicious':
        return <AlertTriangle className={`w-5 h-5 ${iconClass}`} />;
      default:
        return <Activity className={`w-5 h-5 ${iconClass}`} />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <StatusChip tone="danger" label={t('security.events.severityCritical', 'Critical')} />
        );
      case 'warning':
        return (
          <StatusChip tone="warning" label={t('security.events.severityWarning', 'Warning')} />
        );
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredEvents = events.filter((event) => {
    if (filter !== 'all' && event.type !== filter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        event.ip?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-crimson-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
            <Activity className="w-6 h-6 text-slate-900 dark:text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('security.events.title', 'Security Events')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('security.events.description', 'Your personal security audit log')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAlertSettings(!showAlertSettings)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <Bell className="w-4 h-4" />
            {t('security.events.alerts', 'Alerts')}
          </button>
          <div className="relative">
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {t('security.events.export', 'Export')}
            </button>
          </div>
        </div>
      </div>

      {/* Alert Settings Panel */}
      {showAlertSettings && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary-500" />
              {t('security.events.alertSettings', 'Security Alert Settings')}
            </h4>
            <button
              onClick={() => setShowAlertSettings(false)}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4">
            <AlertToggle
              icon={<AlertTriangle className="w-5 h-5" />}
              title={t('security.events.alertSuspicious', 'Suspicious Login Alerts')}
              description={t(
                'security.events.alertSuspiciousDesc',
                'Get notified when unusual login activity is detected'
              )}
              checked={alertSettings.emailOnSuspiciousLogin}
              onChange={(checked) =>
                setAlertSettings({ ...alertSettings, emailOnSuspiciousLogin: checked })
              }
            />
            <AlertToggle
              icon={<Smartphone className="w-5 h-5" />}
              title={t('security.events.alertNewDevice', 'New Device Login')}
              description={t(
                'security.events.alertNewDeviceDesc',
                'Get notified when you log in from a new device'
              )}
              checked={alertSettings.emailOnNewDevice}
              onChange={(checked) =>
                setAlertSettings({ ...alertSettings, emailOnNewDevice: checked })
              }
            />
            <AlertToggle
              icon={<Lock className="w-5 h-5" />}
              title={t('security.events.alertPassword', 'Password Changes')}
              description={t(
                'security.events.alertPasswordDesc',
                'Get notified when your password is changed'
              )}
              checked={alertSettings.emailOnPasswordChange}
              onChange={(checked) =>
                setAlertSettings({ ...alertSettings, emailOnPasswordChange: checked })
              }
            />
            <AlertToggle
              icon={<Key className="w-5 h-5" />}
              title={t('security.events.alertMfa', 'MFA Changes')}
              description={t(
                'security.events.alertMfaDesc',
                'Get notified when 2FA settings are modified'
              )}
              checked={alertSettings.emailOnMfaChange}
              onChange={(checked) =>
                setAlertSettings({ ...alertSettings, emailOnMfaChange: checked })
              }
            />
          </div>
          <div className="flex justify-end mt-6">
            <button
              onClick={handleSaveAlertSettings}
              disabled={savingAlerts}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {savingAlerts ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {t('common.save', 'Save')}
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('security.events.search', 'Search events...')}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-500/50 transition-colors"
          >
            <Filter className="w-4 h-4 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {EVENT_TYPES.find((t) => t.value === filter)?.label}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
          </button>
          {showFilterDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-lg z-10">
              {EVENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => {
                    setFilter(type.value);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    filter === type.value
                      ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {type.icon}
                  {type.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={fetchEvents}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Events List */}
      {loading ? (
        <LoadingState variant="spinner" />
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          icon={<Activity />}
          title={
            searchQuery || filter !== 'all'
              ? t('security.events.noResults', 'No matching events')
              : t('security.events.noEvents', 'No Security Events')
          }
          description={
            searchQuery || filter !== 'all'
              ? t('security.events.noResultsDesc', 'Try adjusting your search or filters')
              : t('security.events.noEventsDesc', 'Security events will appear here as they occur')
          }
        />
      ) : (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="divide-y divide-slate-200 dark:divide-white/5">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className={`p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                  event.severity === 'critical'
                    ? 'bg-rose-50/50 dark:bg-rose-500/5'
                    : event.severity === 'warning'
                      ? 'bg-amber-50/50 dark:bg-amber-500/5'
                      : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      event.severity === 'critical'
                        ? 'bg-rose-100 dark:bg-rose-500/20'
                        : event.severity === 'warning'
                          ? 'bg-amber-100 dark:bg-amber-500/20'
                          : 'bg-slate-100 dark:bg-white/10'
                    }`}
                  >
                    {getEventIcon(event.type, event.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-slate-900 dark:text-white">{event.title}</h4>
                      {getSeverityBadge(event.severity)}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      {event.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(event.timestamp)}
                      </span>
                      {event.ip && (
                        <span className="flex items-center gap-1">
                          <Monitor className="w-3 h-3" />
                          {event.ip}
                        </span>
                      )}
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Load More */}
      {filteredEvents.length >= 50 && (
        <div className="text-center">
          <button className="px-6 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors">
            {t('common.loadMore', 'Load More')}
          </button>
        </div>
      )}
    </div>
  );
};

// Alert Toggle Component
interface AlertToggleProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const AlertToggle: React.FC<AlertToggleProps> = ({
  icon,
  title,
  description,
  checked,
  onChange,
}) => {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="text-slate-500 dark:text-slate-400">{icon}</div>
        <div>
          <p className="font-medium text-slate-900 dark:text-white text-sm">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
        }`}
      >
        <span
          className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform`}
        />
      </button>
    </div>
  );
};

export default SecurityEventsSettings;
