/**
 * Status Page View
 *
 * Public status page showing system health, incidents, and uptime.
 * Route: /status
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  Cpu,
  Database,
  ExternalLink,
  Mail,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

// Types
interface ServiceStatus {
  service: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
  latency?: number;
  lastCheck: string;
}

interface SystemStatus {
  status: string;
  services: Record<string, ServiceStatus>;
  timestamp: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  status: string;
  createdAt: string;
  resolvedAt?: string;
  updates: Array<{ message: string; timestamp: string }>;
}

interface MaintenanceWindow {
  id: string;
  title: string;
  description: string;
  scheduledStart: string;
  scheduledEnd: string;
  affectedServices: string[];
  status: string;
}

interface UptimeStats {
  overall: number;
  services: Record<string, number>;
  period: string;
}

// Status config
const STATUS_CONFIG = {
  operational: {
    icon: CheckCircle,
    color: 'text-c-success',
    bg: 'bg-c-success/10',
    label: { en: 'Operational', pl: 'Operacyjny' },
  },
  degraded: {
    icon: AlertTriangle,
    color: 'text-c-warning',
    bg: 'bg-c-warning/10',
    label: { en: 'Degraded', pl: 'Obniżona wydajność' },
  },
  partial_outage: {
    icon: AlertTriangle,
    color: 'text-c-warning',
    bg: 'bg-c-warning/10',
    label: { en: 'Partial Outage', pl: 'Częściowa awaria' },
  },
  major_outage: {
    icon: XCircle,
    color: 'text-c-danger',
    bg: 'bg-c-danger/10',
    label: { en: 'Major Outage', pl: 'Poważna awaria' },
  },
  maintenance: {
    icon: Clock,
    color: 'text-c-info',
    bg: 'bg-c-info/10',
    label: { en: 'Maintenance', pl: 'Konserwacja' },
  },
};

const SERVICE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  api: Server,
  database: Database,
  ai: Cpu,
  storage: Cloud,
  email: Mail,
};

const SERVICE_NAMES: Record<string, { en: string; pl: string }> = {
  api: { en: 'API', pl: 'API' },
  database: { en: 'Database', pl: 'Baza danych' },
  ai: { en: 'AI Services', pl: 'Usługi AI' },
  storage: { en: 'Storage', pl: 'Przechowywanie' },
  email: { en: 'Email', pl: 'Email' },
};

export const StatusPageView: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';

  // State
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceWindow[]>([]);
  const [uptime, setUptime] = useState<UptimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const [subscribeEmail, setSubscribeEmail] = useState('');
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);

  // Fetch data
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statusRes, incidentsRes, maintenanceRes, uptimeRes] = await Promise.all([
        Api.get('/api/status'),
        Api.get('/api/status/incidents'),
        Api.get('/api/status/maintenance'),
        Api.get('/api/status/uptime'),
      ]);

      setStatus(statusRes);
      setIncidents(incidentsRes.incidents || []);
      setMaintenance(maintenanceRes.schedule || []);
      setUptime(uptimeRes);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle subscribe
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Api.post('/api/status/subscribe', { email: subscribeEmail });
      setSubscribeSuccess(true);
      setSubscribeEmail('');
      setTimeout(() => setSubscribeSuccess(false), 3000);
    } catch (error) {
      console.error('Subscribe failed:', error);
    }
  };

  // Text
  const t = {
    title: { en: 'System Status', pl: 'Status Systemu' },
    subtitle: {
      en: 'Current operational status of Consultify services',
      pl: 'Aktualny status operacyjny usług Consultify',
    },
    allOperational: { en: 'All Systems Operational', pl: 'Wszystkie systemy działają' },
    services: { en: 'Services', pl: 'Usługi' },
    uptime: { en: 'Uptime', pl: 'Dostępność' },
    incidents: { en: 'Recent Incidents', pl: 'Ostatnie incydenty' },
    noIncidents: { en: 'No recent incidents', pl: 'Brak ostatnich incydentów' },
    maintenance: { en: 'Scheduled Maintenance', pl: 'Zaplanowana konserwacja' },
    noMaintenance: { en: 'No scheduled maintenance', pl: 'Brak zaplanowanej konserwacji' },
    subscribe: { en: 'Subscribe to Updates', pl: 'Subskrybuj aktualizacje' },
    subscribeDesc: {
      en: 'Get notified about incidents and maintenance',
      pl: 'Otrzymuj powiadomienia o incydentach i konserwacji',
    },
    subscribed: { en: 'Subscribed!', pl: 'Zasubskrybowano!' },
    refresh: { en: 'Refresh', pl: 'Odśwież' },
    lastUpdated: { en: 'Last updated', pl: 'Ostatnia aktualizacja' },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-c-surface-raised flex items-center justify-center">
        <RefreshCw size={32} className="animate-spin text-c-accent" />
      </div>
    );
  }

  const overallConfig = status
    ? STATUS_CONFIG[status.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.operational
    : STATUS_CONFIG.operational;
  const OverallIcon = overallConfig.icon;

  return (
    <div className="min-h-screen bg-c-surface-raised">
      {/* Header */}
      <header className="bg-c-surface border-b border-c-border-subtle">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-c-text">{t.title[lang]}</h1>
          <p className="text-c-text-secondary mt-1">{t.subtitle[lang]}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Overall Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${overallConfig.bg} rounded-xl p-6 flex items-center justify-between`}
        >
          <div className="flex items-center gap-4">
            <OverallIcon size={32} className={overallConfig.color} />
            <div>
              <h2 className={`text-xl font-semibold ${overallConfig.color}`}>
                {status?.status === 'operational'
                  ? t.allOperational[lang]
                  : overallConfig.label[lang]}
              </h2>
              <p className="text-sm text-c-text-secondary">
                {t.lastUpdated[lang]}: {status ? new Date(status.timestamp).toLocaleString() : '-'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="p-2 hover:bg-c-surface/50 rounded-lg transition-colors"
            title={t.refresh[lang]}
          >
            <RefreshCw size={20} className="text-c-text-secondary" />
          </button>
        </motion.div>

        {/* Services */}
        <section>
          <h3 className="text-lg font-semibold text-c-text mb-4">
            {t.services[lang]}
          </h3>
          <div className="bg-c-surface rounded-xl overflow-hidden shadow-sm">
            {status &&
              Object.entries(status.services).map(([key, service], i) => {
                const ServiceIcon = SERVICE_ICONS[key] || Server;
                const serviceConfig =
                  STATUS_CONFIG[service.status as keyof typeof STATUS_CONFIG] ||
                  STATUS_CONFIG.operational;
                const StatusIcon = serviceConfig.icon;

                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between px-6 py-4 ${
                      i > 0 ? 'border-t border-c-border-subtle' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ServiceIcon size={20} className="text-c-text-muted" />
                      <span className="font-medium text-c-text">
                        {SERVICE_NAMES[key]?.[lang] || key}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {service.latency && (
                        <span className="text-sm text-c-text-muted">
                          {service.latency}ms
                        </span>
                      )}
                      <StatusIcon size={18} className={serviceConfig.color} />
                      <span className={`text-sm ${serviceConfig.color}`}>
                        {serviceConfig.label[lang]}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* Uptime */}
        {uptime && (
          <section>
            <h3 className="text-lg font-semibold text-c-text mb-4">
              {t.uptime[lang]} ({uptime.period})
            </h3>
            <div className="bg-c-surface rounded-xl p-6 shadow-sm">
              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-c-success">{uptime.overall}%</div>
                <div className="text-sm text-c-text-muted mt-1">
                  {lang === 'pl' ? 'Ogólna dostępność' : 'Overall Uptime'}
                </div>
              </div>
              <div className="grid grid-cols-5 gap-4">
                {Object.entries(uptime.services).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div className="text-lg font-semibold text-c-text">
                      {value}%
                    </div>
                    <div className="text-xs text-c-text-muted">
                      {SERVICE_NAMES[key]?.[lang] || key}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Scheduled Maintenance */}
        <section>
          <h3 className="text-lg font-semibold text-c-text mb-4">
            {t.maintenance[lang]}
          </h3>
          <div className="bg-c-surface rounded-xl shadow-sm overflow-hidden">
            {maintenance.length === 0 ? (
              <div className="px-6 py-8 text-center text-c-text-muted">
                <Clock size={32} className="mx-auto mb-2 opacity-50" />
                {t.noMaintenance[lang]}
              </div>
            ) : (
              maintenance.map((item) => (
                <div
                  key={item.id}
                  className="px-6 py-4 border-b border-c-border-subtle last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-c-text">{item.title}</h4>
                      <p className="text-sm text-c-text-secondary">
                        {item.description}
                      </p>
                    </div>
                    <div className="text-sm text-c-text-muted">
                      {new Date(item.scheduledStart).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Incidents */}
        <section>
          <h3 className="text-lg font-semibold text-c-text mb-4">
            {t.incidents[lang]}
          </h3>
          <div className="bg-c-surface rounded-xl shadow-sm overflow-hidden">
            {incidents.length === 0 ? (
              <div className="px-6 py-8 text-center text-c-text-muted">
                <CheckCircle size={32} className="mx-auto mb-2 opacity-50 text-c-success" />
                {t.noIncidents[lang]}
              </div>
            ) : (
              incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="border-b border-c-border-subtle last:border-0"
                >
                  <button
                    onClick={() =>
                      setExpandedIncident(expandedIncident === incident.id ? null : incident.id)
                    }
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-c-surface-raised"
                  >
                    <div>
                      <h4 className="font-medium text-c-text">
                        {incident.title}
                      </h4>
                      <p className="text-sm text-c-text-secondary">
                        {new Date(incident.createdAt).toLocaleDateString()} • {incident.status}
                      </p>
                    </div>
                    {expandedIncident === incident.id ? (
                      <ChevronUp size={20} className="text-c-text-muted" />
                    ) : (
                      <ChevronDown size={20} className="text-c-text-muted" />
                    )}
                  </button>
                  {expandedIncident === incident.id && (
                    <div className="px-6 pb-4">
                      <p className="text-c-text-secondary mb-4">
                        {incident.description}
                      </p>
                      <div className="space-y-2">
                        {incident.updates.map((update, i) => (
                          <div key={i} className="flex gap-3 text-sm">
                            <span className="text-c-text-muted">
                              {new Date(update.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="text-c-text-secondary">
                              {update.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Subscribe */}
        <section className="bg-c-surface rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Bell size={20} className="text-c-accent" />
            <h3 className="text-lg font-semibold text-c-text">
              {t.subscribe[lang]}
            </h3>
          </div>
          <p className="text-c-text-secondary mb-4">{t.subscribeDesc[lang]}</p>
          <form onSubmit={handleSubscribe} className="flex gap-3">
            <input
              type="email"
              value={subscribeEmail}
              onChange={(e) => setSubscribeEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 px-4 py-2 border border-c-border rounded-lg bg-c-surface text-c-text"
              required
            />
            <button
              type="submit"
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium"
            >
              {subscribeSuccess ? t.subscribed[lang] : lang === 'pl' ? 'Subskrybuj' : 'Subscribe'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default StatusPageView;
