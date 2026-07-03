/**
 * BillingSettingsView - Tax information, notifications, and export settings
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BarChart3,
  Bell,
  Building2,
  Download,
  FileText,
  Globe,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { DegradedState, ReadOnlyState } from '../../components/Admin/AdminState';
import { PartnerCodeInput } from '../../components/Admin/PartnerCodeInput';
import { useAppStore } from '../../store/useAppStore';

interface TaxSettings {
  tax_id?: string;
  tax_id_type?: string;
  tax_exempt?: boolean;
  billing_name?: string;
  billing_email?: string;
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postal_code?: string;
  billing_country?: string;
  invoice_prefix?: string;
  po_number?: string;
}

interface NotificationPreferences {
  invoice_email: boolean;
  payment_success: boolean;
  payment_failed: boolean;
  usage_warning: boolean;
  renewal_reminder: boolean;
  reminder_days_before: number;
}

interface BillingContact {
  id: string;
  name: string;
  email: string;
  role: string;
  is_primary: boolean;
}

interface BillingSettingsViewProps {
  className?: string;
}

export const BillingSettingsView: React.FC<BillingSettingsViewProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();

  const [activeTab, setActiveTab] = useState<'tax' | 'notifications' | 'export' | 'partner'>('tax');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [taxSettings, setTaxSettings] = useState<TaxSettings>({});
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    invoice_email: true,
    payment_success: true,
    payment_failed: true,
    usage_warning: true,
    renewal_reminder: true,
    reminder_days_before: 7,
  });
  const [contacts, setContacts] = useState<BillingContact[]>([]);

  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', role: 'recipient' });

  const [exportYear, setExportYear] = useState(new Date().getFullYear().toString());
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [currentOrganization?.id]);

  const loadSettings = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);

    try {
      setLoadError(null);
      const response = await fetch('/api/billing/settings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setTaxSettings(data.taxSettings || {});
      setNotifications(
        data.notifications || {
          invoice_email: true,
          payment_success: true,
          payment_failed: true,
          usage_warning: true,
          renewal_reminder: true,
          reminder_days_before: 7,
        }
      );
      setContacts(data.contacts || []);
    } catch (error) {
      console.error('Error loading billing settings:', error);
      setTaxSettings({});
      setContacts([]);
      setLoadError(error instanceof Error ? error.message : 'Failed to load billing settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);

    try {
      const response = await fetch('/api/billing/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          taxSettings,
          notifications,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (type: 'invoices' | 'usage') => {
    setExporting(true);

    try {
      const response = await fetch(
        `/api/billing/export?type=${type}&format=${exportFormat}&year=${exportYear}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (exportFormat === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-${exportYear}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-${exportYear}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
      toast.success(`${type} exported successfully`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleAddContact = async () => {
    if (!newContact.name || !newContact.email) {
      toast.error('Name and email are required');
      return;
    }

    // In production, this would call an API
    const contact: BillingContact = {
      id: `contact-${Date.now()}`,
      ...newContact,
      is_primary: contacts.length === 0,
    };

    setContacts([...contacts, contact]);
    setNewContact({ name: '', email: '', role: 'recipient' });
    setShowAddContact(false);
    toast.success('Contact added');
  };

  const handleRemoveContact = (contactId: string) => {
    setContacts(contacts.filter((c) => c.id !== contactId));
    toast.success('Contact removed');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-c-text-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <FileText size={18} className="text-c-text-muted" />
            {t('admin.billing.settings', 'Billing Settings')}
          </h2>
          <p className="text-sm text-c-text-muted mt-0.5">
            Manage tax information, notifications, and data exports
          </p>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={saving || !!loadError}
          className="admin-btn admin-btn-accent flex items-center gap-2"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          Save Changes
        </button>
      </div>

      {loadError && <DegradedState title="Billing settings unavailable" description={loadError} />}

      {/* Tab Navigation */}
      <div className="flex border-b border-white/[0.08]">
        {[
          { id: 'tax', label: 'Tax Information', icon: Building2 },
          { id: 'partner', label: 'Partner & Referral', icon: UserCheck },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'export', label: 'Export Data', icon: Download },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === tab.id
                ? 'border-white text-white'
                : 'border-transparent text-c-text-muted hover:text-slate-300'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tax Information Tab */}
      {activeTab === 'tax' &&
        (loadError ? (
          <div className="admin-card p-6">
            <DegradedState title="Tax settings unavailable" description={loadError} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Company Information */}
            <div className="admin-card p-6">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Building2 size={14} className="text-c-text-muted" />
                Company Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Legal Name
                  </label>
                  <input
                    type="text"
                    value={taxSettings.billing_name || ''}
                    onChange={(e) =>
                      setTaxSettings({ ...taxSettings, billing_name: e.target.value })
                    }
                    className="admin-input w-full"
                    placeholder="Company Legal Name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={taxSettings.billing_email || ''}
                    onChange={(e) =>
                      setTaxSettings({ ...taxSettings, billing_email: e.target.value })
                    }
                    className="admin-input w-full"
                    placeholder="billing@company.com"
                  />
                </div>
              </div>
            </div>

            {/* Tax ID */}
            <div className="admin-card p-6">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Shield size={14} className="text-c-text-muted" />
                Tax Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Tax ID Type
                  </label>
                  <select
                    value={taxSettings.tax_id_type || ''}
                    onChange={(e) =>
                      setTaxSettings({ ...taxSettings, tax_id_type: e.target.value })
                    }
                    className="admin-input w-full"
                  >
                    <option value="">Select type</option>
                    <option value="eu_vat">EU VAT</option>
                    <option value="gb_vat">GB VAT</option>
                    <option value="us_ein">US EIN</option>
                    <option value="au_abn">AU ABN</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Tax ID / VAT Number
                  </label>
                  <input
                    type="text"
                    value={taxSettings.tax_id || ''}
                    onChange={(e) => setTaxSettings({ ...taxSettings, tax_id: e.target.value })}
                    className="admin-input w-full"
                    placeholder="e.g. PL1234567890"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taxSettings.tax_exempt || false}
                      onChange={(e) =>
                        setTaxSettings({ ...taxSettings, tax_exempt: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-slate-600 bg-transparent text-[var(--admin-accent)]"
                    />
                    <span className="text-sm text-slate-300">Tax Exempt</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Billing Address */}
            <div className="admin-card p-6">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Globe size={14} className="text-c-text-muted" />
                Billing Address
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={taxSettings.billing_address_line1 || ''}
                    onChange={(e) =>
                      setTaxSettings({ ...taxSettings, billing_address_line1: e.target.value })
                    }
                    className="admin-input w-full"
                    placeholder="Street address"
                  />
                </div>
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={taxSettings.billing_address_line2 || ''}
                    onChange={(e) =>
                      setTaxSettings({ ...taxSettings, billing_address_line2: e.target.value })
                    }
                    className="admin-input w-full"
                    placeholder="Apartment, suite, etc."
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      value={taxSettings.billing_city || ''}
                      onChange={(e) =>
                        setTaxSettings({ ...taxSettings, billing_city: e.target.value })
                      }
                      className="admin-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                      State/Region
                    </label>
                    <input
                      type="text"
                      value={taxSettings.billing_state || ''}
                      onChange={(e) =>
                        setTaxSettings({ ...taxSettings, billing_state: e.target.value })
                      }
                      className="admin-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={taxSettings.billing_postal_code || ''}
                      onChange={(e) =>
                        setTaxSettings({ ...taxSettings, billing_postal_code: e.target.value })
                      }
                      className="admin-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                      Country
                    </label>
                    <input
                      type="text"
                      value={taxSettings.billing_country || ''}
                      onChange={(e) =>
                        setTaxSettings({ ...taxSettings, billing_country: e.target.value })
                      }
                      className="admin-input w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Settings */}
            <div className="admin-card p-6">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <FileText size={14} className="text-c-text-muted" />
                Invoice Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Invoice Prefix
                  </label>
                  <input
                    type="text"
                    value={taxSettings.invoice_prefix || ''}
                    onChange={(e) =>
                      setTaxSettings({ ...taxSettings, invoice_prefix: e.target.value })
                    }
                    className="admin-input w-full"
                    placeholder="e.g. ACME-"
                  />
                  <p className="text-xs text-c-text-muted mt-1">
                    Prefix added to invoice numbers
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    PO Number
                  </label>
                  <input
                    type="text"
                    value={taxSettings.po_number || ''}
                    onChange={(e) => setTaxSettings({ ...taxSettings, po_number: e.target.value })}
                    className="admin-input w-full"
                    placeholder="Purchase Order Number"
                  />
                  <p className="text-xs text-c-text-muted mt-1">
                    Included on all invoices
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

      {/* Partner & Referral Tab */}
      {activeTab === 'partner' && (
        <div className="space-y-6">
          <PartnerCodeInput />

          {/* Information about Partner Program */}
          <div className="admin-card p-6">
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <UserCheck size={14} className="text-c-text-muted" />
              Partner Program Benefits
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-navy-900/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-primary-400 mb-1">15%</div>
                <div className="text-sm text-c-text-muted">
                  Standard discount for referred customers
                </div>
              </div>
              <div className="bg-navy-900/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-emerald-400 mb-1">12 mo</div>
                <div className="text-sm text-c-text-muted">
                  Typical discount duration
                </div>
              </div>
              <div className="bg-navy-900/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-400 mb-1">24/7</div>
                <div className="text-sm text-c-text-muted">
                  Priority support from partner
                </div>
              </div>
            </div>
            <p className="text-sm text-c-text-muted mt-4">
              Contact your partner representative for more information about available discounts and
              special offers.
            </p>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' &&
        (loadError ? (
          <div className="admin-card p-6">
            <DegradedState title="Notification settings unavailable" description={loadError} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Notification Preferences */}
            <div className="admin-card p-6">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Bell size={14} className="text-c-text-muted" />
                Email Notifications
              </h3>
              <div className="space-y-4">
                {[
                  {
                    key: 'invoice_email',
                    label: 'Invoice Available',
                    desc: 'Get notified when a new invoice is ready',
                  },
                  {
                    key: 'payment_success',
                    label: 'Payment Successful',
                    desc: 'Confirmation when payments are processed',
                  },
                  {
                    key: 'payment_failed',
                    label: 'Payment Failed',
                    desc: 'Alert when a payment attempt fails',
                  },
                  {
                    key: 'usage_warning',
                    label: 'Usage Warnings',
                    desc: 'Alerts when approaching usage limits',
                  },
                  {
                    key: 'renewal_reminder',
                    label: 'Renewal Reminders',
                    desc: 'Reminder before subscription renews',
                  },
                ].map((item) => (
                  <label key={item.key} className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={notifications[item.key as keyof NotificationPreferences] as boolean}
                      onChange={(e) =>
                        setNotifications({
                          ...notifications,
                          [item.key]: e.target.checked,
                        })
                      }
                      className="w-4 h-4 mt-0.5 rounded border-slate-600 bg-transparent text-[var(--admin-accent)]"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-white group-hover:text-slate-200">{item.label}</p>
                      <p className="text-xs text-c-text-muted">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.05]">
                <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                  Renewal Reminder Days
                </label>
                <select
                  value={notifications.reminder_days_before}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      reminder_days_before: parseInt(e.target.value),
                    })
                  }
                  className="admin-input w-48"
                >
                  <option value="3">3 days before</option>
                  <option value="7">7 days before</option>
                  <option value="14">14 days before</option>
                  <option value="30">30 days before</option>
                </select>
              </div>
            </div>

            {/* Billing Contacts */}
            <div className="admin-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Mail size={14} className="text-c-text-muted" />
                  Billing Contacts
                </h3>
                <button
                  onClick={() => setShowAddContact(true)}
                  disabled
                  className="admin-btn admin-btn-subtle flex items-center gap-2"
                >
                  <Plus size={14} />
                  Add Contact
                </button>
              </div>

              <ReadOnlyState
                title="Billing contacts are read-only"
                description="Billing contact persistence is not connected yet. Contacts are shown from the billing settings API when available, but add/remove actions are disabled."
                className="mb-4"
              />

              <div className="space-y-2">
                {contacts.length === 0 ? (
                  <p className="text-sm text-c-text-muted py-4 text-center">
                    No billing contacts configured. Notifications will be sent to the organization
                    owner.
                  </p>
                ) : (
                  contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 bg-c-surface/[0.02] rounded-lg border border-white/[0.05]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                          <Mail size={14} className="text-c-text-muted" />
                        </div>
                        <div>
                          <p className="text-sm text-white">
                            {contact.name}
                            {contact.is_primary && (
                              <span className="ml-2 text-xs bg-slate-200 dark:bg-slate-700 text-c-text-secondary px-1.5 py-0.5 rounded">
                                Primary
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-c-text-muted">
                            {contact.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-c-text-muted capitalize">
                          {contact.role}
                        </span>
                        <button
                          onClick={() => handleRemoveContact(contact.id)}
                          disabled
                          className="p-1 text-c-text-muted hover:text-danger-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}

      {/* Export Tab */}
      {activeTab === 'export' &&
        (loadError ? (
          <div className="admin-card p-6">
            <DegradedState title="Billing export unavailable" description={loadError} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="admin-card p-6">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Download size={14} className="text-c-text-muted" />
                Export Billing Data
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Year
                  </label>
                  <select
                    value={exportYear}
                    onChange={(e) => setExportYear(e.target.value)}
                    className="admin-input w-full"
                  >
                    {[2026, 2025, 2024, 2023].map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Format
                  </label>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
                    className="admin-input w-full"
                  >
                    <option value="csv">CSV (Excel compatible)</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-c-surface/[0.02] rounded-lg border border-white/[0.05]">
                  <div className="flex items-start gap-3">
                    <FileText size={20} className="text-c-text-muted mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white">Invoices</h4>
                      <p className="text-xs text-c-text-muted mt-1">
                        Download all invoices for the selected year including amounts, dates, and
                        status.
                      </p>
                      <button
                        onClick={() => handleExport('invoices')}
                        disabled={exporting || !!loadError}
                        className="admin-btn admin-btn-subtle mt-3 flex items-center gap-2"
                      >
                        {exporting ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                        Export Invoices
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-c-surface/[0.02] rounded-lg border border-white/[0.05]">
                  <div className="flex items-start gap-3">
                    <BarChart3 size={20} className="text-c-text-muted mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white">Usage History</h4>
                      <p className="text-xs text-c-text-muted mt-1">
                        Download daily usage data including tokens consumed, costs, and request
                        counts.
                      </p>
                      <button
                        onClick={() => handleExport('usage')}
                        disabled={exporting || !!loadError}
                        className="admin-btn admin-btn-subtle mt-3 flex items-center gap-2"
                      >
                        {exporting ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                        Export Usage
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle size={16} className="text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-200">Data Retention Notice</p>
                    <p className="text-xs text-amber-300/70 mt-1">
                      Billing data is retained for 7 years. Older data may not be available for
                      export.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

      {/* Add Contact Modal */}
      <AnimatePresence>
        {showAddContact && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="admin-card w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Add Billing Contact</h3>
                <button
                  onClick={() => setShowAddContact(false)}
                  className="text-c-text-muted hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    className="admin-input w-full"
                    placeholder="Contact name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    className="admin-input w-full"
                    placeholder="contact@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-c-text-muted uppercase tracking-wider mb-1.5">
                    Role
                  </label>
                  <select
                    value={newContact.role}
                    onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                    className="admin-input w-full"
                  >
                    <option value="recipient">Invoice Recipient</option>
                    <option value="admin">Billing Admin</option>
                    <option value="accountant">Accountant</option>
                  </select>
                </div>
              </div>

              <div className="p-6 border-t border-white/[0.05] flex justify-end gap-3 bg-c-surface/[0.02]">
                <button
                  onClick={() => setShowAddContact(false)}
                  className="admin-btn admin-btn-subtle"
                >
                  Cancel
                </button>
                <button onClick={handleAddContact} className="admin-btn admin-btn-accent">
                  Add Contact
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BillingSettingsView;
