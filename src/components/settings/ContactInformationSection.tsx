/**
 * ContactInformationSection - Multiple Contact Methods
 *
 * Features:
 * - Multiple email addresses (work, personal, other) with verification
 * - Multiple phone numbers (work, mobile, home)
 * - Office/home addresses
 * - Emergency contacts
 * - Preferred contact method selector
 */

import {
  AlertCircle,
  CheckCircle,
  Edit2,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Save,
  Send,
  Star,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { Address, ContactEmail, ContactPhone, EmergencyContact, User } from '../../types';

interface ContactInformationSectionProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

export const ContactInformationSection: React.FC<ContactInformationSectionProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // State
  const [emails, setEmails] = useState<ContactEmail[]>([]);
  const [phones, setPhones] = useState<ContactPhone[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [preferredContactMethod, setPreferredContactMethod] = useState<
    'email' | 'phone' | 'in-app'
  >('email');

  // Edit states
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editingEmergency, setEditingEmergency] = useState<string | null>(null);

  useEffect(() => {
    loadContactInformation();
  }, [currentUser.id]);

  const loadContactInformation = async () => {
    try {
      setLoading(true);
      const data = await Api.get('/api/user/contact-information');
      if (data.success && data.data) {
        setEmails(data.data.emails || []);
        setPhones(data.data.phones || []);
        setAddresses(data.data.addresses || []);
        setEmergencyContacts(data.data.emergencyContacts || []);
        setPreferredContactMethod(data.data.preferredContactMethod || 'email');
      }
    } catch (error) {
      console.error('Failed to load contact information:', error);
      toast.error(t('settings.contact.loadError', 'Failed to load contact information'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.put('/api/user/contact-information', {
        emails,
        phones,
        addresses,
        emergencyContacts,
        preferredContactMethod,
      });
      toast.success(t('settings.contact.saved', 'Contact information saved'));
      onUpdateUser({ preferredContactMethod } as any);
    } catch (error) {
      toast.error(t('settings.contact.error', 'Failed to save contact information'));
    } finally {
      setSaving(false);
    }
  };

  const addEmail = () => {
    const newEmail: ContactEmail = {
      id: Date.now().toString(),
      email: '',
      type: 'work',
      isPrimary: emails.length === 0,
      isVerified: false,
    };
    setEmails([...emails, newEmail]);
    setEditingEmail(newEmail.id);
  };

  const updateEmail = (id: string, updates: Partial<ContactEmail>) => {
    setEmails((emails) =>
      emails.map((e) => {
        if (e.id === id) {
          const updated = { ...e, ...updates };
          // If setting as primary, unset others
          if (updates.isPrimary) {
            return updated;
          }
          return updated;
        }
        // Unset primary if another is being set as primary
        if (updates.isPrimary) {
          return { ...e, isPrimary: false };
        }
        return e;
      })
    );
  };

  const removeEmail = (id: string) => {
    setEmails((emails) => emails.filter((e) => e.id !== id));
    setEditingEmail(null);
  };

  const verifyEmail = async (id: string) => {
    try {
      await Api.post('/api/user/contact-information/verify-email', { emailId: id });
      toast.success(t('settings.contact.verificationSent', 'Verification email sent'));
    } catch (error) {
      toast.error(t('settings.contact.verificationError', 'Failed to send verification email'));
    }
  };

  const addPhone = () => {
    const newPhone: ContactPhone = {
      id: Date.now().toString(),
      phone: '',
      type: 'mobile',
      isPrimary: phones.length === 0,
      countryCode: '+1',
    };
    setPhones([...phones, newPhone]);
    setEditingPhone(newPhone.id);
  };

  const updatePhone = (id: string, updates: Partial<ContactPhone>) => {
    setPhones((phones) =>
      phones.map((p) => {
        if (p.id === id) {
          const updated = { ...p, ...updates };
          return updated;
        }
        if (updates.isPrimary) {
          return { ...p, isPrimary: false };
        }
        return p;
      })
    );
  };

  const removePhone = (id: string) => {
    setPhones((phones) => phones.filter((p) => p.id !== id));
    setEditingPhone(null);
  };

  const verifyPhone = async (id: string) => {
    try {
      await Api.post('/api/user/contact-information/verify-phone', { phoneId: id });
      toast.success(t('settings.contact.verificationSent', 'Verification code sent'));
    } catch (error) {
      toast.error(t('settings.contact.verificationError', 'Failed to send verification code'));
    }
  };

  const addAddress = () => {
    const newAddress: Address = {
      id: Date.now().toString(),
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    };
    setAddresses([...addresses, newAddress]);
    setEditingAddress(newAddress.id ?? null);
  };

  const updateAddress = (id: string, updates: Partial<Address>) => {
    setAddresses((addresses) =>
      addresses.map((a) => {
        if (a.id === id) {
          return { ...a, ...updates };
        }
        return a;
      })
    );
  };

  const removeAddress = (id: string) => {
    setAddresses((addresses) => addresses.filter((a) => a.id !== id));
    setEditingAddress(null);
  };

  const addEmergencyContact = () => {
    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: '',
      relationship: '',
      phone: '',
      email: '',
    };
    setEmergencyContacts([...emergencyContacts, newContact]);
    setEditingEmergency(newContact.id ?? null);
  };

  const updateEmergencyContact = (id: string, updates: Partial<EmergencyContact>) => {
    setEmergencyContacts((contacts) =>
      contacts.map((c) => {
        if (c.id === id) {
          return { ...c, ...updates };
        }
        return c;
      })
    );
  };

  const removeEmergencyContact = (id: string) => {
    setEmergencyContacts((contacts) => contacts.filter((c) => c.id !== id));
    setEditingEmergency(null);
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Mail size={28} className="text-c-accent" />
            {t('settings.contact.title', 'Contact Information')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t('settings.contact.description', 'Manage your contact methods and addresses')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Changes')}
        </button>
      </div>

      {/* Preferred Contact Method */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4">
          {t('settings.contact.preferredMethod', 'Preferred Contact Method')}
        </h3>
        <div className="flex gap-4">
          {(['email', 'phone', 'in-app'] as const).map((method) => (
            <button
              key={method}
              onClick={() => setPreferredContactMethod(method)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                preferredContactMethod === method
                  ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                  : 'border-c-border-subtle dark:border-navy-700 hover:border-c-accent'
              }`}
            >
              {method === 'email' && <Mail size={18} />}
              {method === 'phone' && <Phone size={18} />}
              {method === 'in-app' && <Globe size={18} />}
              <span className="text-sm font-medium">
                {t(`settings.contact.method.${method}`, method)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Email Addresses */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <Mail size={20} className="text-blue-500" />
            {t('settings.contact.emails', 'Email Addresses')}
          </h3>
          <button
            onClick={addEmail}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
          >
            <Plus size={16} />
            {t('settings.contact.addEmail', 'Add Email')}
          </button>
        </div>
        <div className="space-y-3">
          {emails.map((email) => (
            <EmailCard
              key={email.id}
              email={email}
              isEditing={editingEmail === email.id}
              onEdit={() => setEditingEmail(email.id ?? null)}
              onSave={() => setEditingEmail(null)}
              onCancel={() => {
                setEditingEmail(null);
                if (!email.email) removeEmail(email.id ?? '');
              }}
              onUpdate={(updates) => updateEmail(email.id ?? '', updates)}
              onDelete={() => removeEmail(email.id ?? '')}
              onVerify={() => verifyEmail(email.id ?? '')}
            />
          ))}
          {emails.length === 0 && (
            <p className="text-sm text-c-text-muted text-center py-4">
              {t('settings.contact.noEmails', 'No email addresses added yet')}
            </p>
          )}
        </div>
      </div>

      {/* Phone Numbers */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <Phone size={20} className="text-green-500" />
            {t('settings.contact.phones', 'Phone Numbers')}
          </h3>
          <button
            onClick={addPhone}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
          >
            <Plus size={16} />
            {t('settings.contact.addPhone', 'Add Phone')}
          </button>
        </div>
        <div className="space-y-3">
          {phones.map((phone) => (
            <PhoneCard
              key={phone.id}
              phone={phone}
              isEditing={editingPhone === phone.id}
              onEdit={() => setEditingPhone(phone.id ?? null)}
              onSave={() => setEditingPhone(null)}
              onCancel={() => {
                setEditingPhone(null);
                if (!phone.phone) removePhone(phone.id ?? '');
              }}
              onUpdate={(updates) => updatePhone(phone.id ?? '', updates)}
              onDelete={() => removePhone(phone.id ?? '')}
              onVerify={() => verifyPhone(phone.id ?? '')}
            />
          ))}
          {phones.length === 0 && (
            <p className="text-sm text-c-text-muted text-center py-4">
              {t('settings.contact.noPhones', 'No phone numbers added yet')}
            </p>
          )}
        </div>
      </div>

      {/* Addresses */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <MapPin size={20} className="text-amber-500" />
            {t('settings.contact.addresses', 'Addresses')}
          </h3>
          <button
            onClick={addAddress}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
          >
            <Plus size={16} />
            {t('settings.contact.addAddress', 'Add Address')}
          </button>
        </div>
        <div className="space-y-3">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address as Address & { id: string; type?: string; isPrimary?: boolean }}
              isEditing={editingAddress === address.id}
              onEdit={() => setEditingAddress(address.id ?? null)}
              onSave={() => setEditingAddress(null)}
              onCancel={() => {
                setEditingAddress(null);
                if (!address.street && !address.city) removeAddress(address.id ?? '');
              }}
              onUpdate={(updates) => updateAddress(address.id ?? '', updates)}
              onDelete={() => removeAddress(address.id ?? '')}
            />
          ))}
          {addresses.length === 0 && (
            <p className="text-sm text-c-text-muted text-center py-4">
              {t('settings.contact.noAddresses', 'No addresses added yet')}
            </p>
          )}
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <UserPlus size={20} className="text-danger-500" />
            {t('settings.contact.emergency', 'Emergency Contacts')}
          </h3>
          <button
            onClick={addEmergencyContact}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
          >
            <Plus size={16} />
            {t('settings.contact.addEmergency', 'Add Contact')}
          </button>
        </div>
        <div className="space-y-3">
          {emergencyContacts.map((contact) => (
            <EmergencyContactCard
              key={contact.id}
              contact={contact as EmergencyContact & { id: string }}
              isEditing={editingEmergency === contact.id}
              onEdit={() => setEditingEmergency(contact.id ?? null)}
              onSave={() => setEditingEmergency(null)}
              onCancel={() => {
                setEditingEmergency(null);
                if (!contact.name) removeEmergencyContact(contact.id ?? '');
              }}
              onUpdate={(updates) => updateEmergencyContact(contact.id ?? '', updates)}
              onDelete={() => removeEmergencyContact(contact.id ?? '')}
            />
          ))}
          {emergencyContacts.length === 0 && (
            <p className="text-sm text-c-text-muted text-center py-4">
              {t('settings.contact.noEmergency', 'No emergency contacts added yet')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Sub-components
interface EmailCardProps {
  email: ContactEmail;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdate: (updates: Partial<ContactEmail>) => void;
  onDelete: () => void;
  onVerify: () => void;
}

const EmailCard: React.FC<EmailCardProps> = ({
  email,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onUpdate,
  onDelete,
  onVerify,
}) => {
  const { t } = useTranslation();

  if (isEditing) {
    return (
      <div className="p-4 border border-c-accent dark:border-c-accent rounded-lg bg-c-accent-soft dark:bg-c-accent-soft">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="email"
            value={email.email}
            onChange={(e) => onUpdate({ email: e.target.value })}
            placeholder="email@example.com"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <select
            value={email.type}
            onChange={(e) => onUpdate({ type: e.target.value as ContactEmail['type'] })}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          >
            <option value="work">{t('settings.contact.type.work', 'Work')}</option>
            <option value="personal">{t('settings.contact.type.personal', 'Personal')}</option>
            <option value="other">{t('settings.contact.type.other', 'Other')}</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={email.isPrimary}
              onChange={(e) => onUpdate({ isPrimary: e.target.checked })}
              className="rounded"
            />
            <label className="text-sm">{t('settings.contact.primary', 'Primary')}</label>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onSave}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
          >
            {t('common.save', 'Save')}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-c-surface-raised text-c-text-secondary rounded-lg text-sm"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-danger-600 text-white rounded-lg text-sm ml-auto"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-c-border-subtle dark:border-navy-700 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-blue-500" />
            <span className="font-medium text-c-text">{email.email}</span>
            {email.isPrimary && <Star size={14} className="text-yellow-500 fill-yellow-500" />}
            {email.isVerified ? (
              <CheckCircle size={16} className="text-green-500" />
            ) : (
              <AlertCircle size={16} className="text-amber-500" />
            )}
          </div>
          <div className="flex gap-4 mt-1 text-xs text-c-text-muted">
            <span className="capitalize">{email.type}</span>
            {!email.isVerified && (
              <button
                onClick={onVerify}
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                <Send size={12} />
                {t('settings.contact.verify', 'Verify')}
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg"
        >
          <Edit2 size={16} />
        </button>
      </div>
    </div>
  );
};

interface PhoneCardProps {
  phone: ContactPhone;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdate: (updates: Partial<ContactPhone>) => void;
  onDelete: () => void;
  onVerify: () => void;
}

const PhoneCard: React.FC<PhoneCardProps> = ({
  phone,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onUpdate,
  onDelete,
  onVerify,
}) => {
  const { t } = useTranslation();

  if (isEditing) {
    return (
      <div className="p-4 border border-c-accent dark:border-c-accent rounded-lg bg-c-accent-soft dark:bg-c-accent-soft">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="tel"
            value={phone.phone}
            onChange={(e) => onUpdate({ phone: e.target.value })}
            placeholder="+1 234 567 8900"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="text"
            value={phone.countryCode || '+1'}
            onChange={(e) => onUpdate({ countryCode: e.target.value })}
            placeholder="+1"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <select
            value={phone.type}
            onChange={(e) => onUpdate({ type: e.target.value as ContactPhone['type'] })}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          >
            <option value="work">{t('settings.contact.type.work', 'Work')}</option>
            <option value="mobile">{t('settings.contact.type.mobile', 'Mobile')}</option>
            <option value="home">{t('settings.contact.type.home', 'Home')}</option>
            <option value="other">{t('settings.contact.type.other', 'Other')}</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={phone.isPrimary}
              onChange={(e) => onUpdate({ isPrimary: e.target.checked })}
              className="rounded"
            />
            <label className="text-sm">{t('settings.contact.primary', 'Primary')}</label>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onSave}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
          >
            {t('common.save', 'Save')}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-c-surface-raised text-c-text-secondary rounded-lg text-sm"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-danger-600 text-white rounded-lg text-sm ml-auto"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-c-border-subtle dark:border-navy-700 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Phone size={18} className="text-green-500" />
            <span className="font-medium text-c-text">
              {phone.countryCode} {phone.phone}
            </span>
            {phone.isPrimary && <Star size={14} className="text-yellow-500 fill-yellow-500" />}
          </div>
          <div className="flex gap-4 mt-1 text-xs text-c-text-muted">
            <span className="capitalize">{phone.type}</span>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg"
        >
          <Edit2 size={16} />
        </button>
      </div>
    </div>
  );
};

interface AddressCardProps {
  address: Address & { id: string; type?: string; isPrimary?: boolean };
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdate: (updates: Partial<Address>) => void;
  onDelete: () => void;
}

const AddressCard: React.FC<AddressCardProps> = ({
  address,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onUpdate,
  onDelete,
}) => {
  const { t } = useTranslation();

  if (isEditing) {
    return (
      <div className="p-4 border border-c-accent dark:border-c-accent rounded-lg bg-c-accent-soft dark:bg-c-accent-soft">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={address.type || 'office'}
            onChange={(e) => onUpdate({ ...address, type: e.target.value } as any)}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          >
            <option value="office">{t('settings.contact.type.office', 'Office')}</option>
            <option value="home">{t('settings.contact.type.home', 'Home')}</option>
            <option value="billing">{t('settings.contact.type.billing', 'Billing')}</option>
            <option value="shipping">{t('settings.contact.type.shipping', 'Shipping')}</option>
            <option value="other">{t('settings.contact.type.other', 'Other')}</option>
          </select>
          <input
            type="text"
            value={address.street || ''}
            onChange={(e) => onUpdate({ street: e.target.value })}
            placeholder={t('settings.contact.street', 'Street Address')}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="text"
            value={address.city || ''}
            onChange={(e) => onUpdate({ city: e.target.value })}
            placeholder={t('settings.contact.city', 'City')}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="text"
            value={address.state || ''}
            onChange={(e) => onUpdate({ state: e.target.value })}
            placeholder={t('settings.contact.state', 'State/Province')}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="text"
            value={address.postalCode || ''}
            onChange={(e) => onUpdate({ postalCode: e.target.value })}
            placeholder={t('settings.contact.postalCode', 'Postal Code')}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="text"
            value={address.country || ''}
            onChange={(e) => onUpdate({ country: e.target.value })}
            placeholder={t('settings.contact.country', 'Country')}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onSave}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
          >
            {t('common.save', 'Save')}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-c-surface-raised text-c-text-secondary rounded-lg text-sm"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-danger-600 text-white rounded-lg text-sm ml-auto"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  const formatted =
    address.formatted ||
    [
      address.street,
      address.city,
      address.state,
      (address as any).postalCode || (address as any).postal_code,
      address.country,
    ]
      .filter(Boolean)
      .join(', ');

  return (
    <div className="p-4 border border-c-border-subtle dark:border-navy-700 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-amber-500" />
            <span className="font-medium text-c-text capitalize">{address.type || 'office'}</span>
            {address.isPrimary && <Star size={14} className="text-yellow-500 fill-yellow-500" />}
          </div>
          <p className="text-sm text-c-text-secondary mt-1">
            {formatted || t('settings.contact.noAddress', 'No address details')}
          </p>
        </div>
        <button
          onClick={onEdit}
          className="p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg"
        >
          <Edit2 size={16} />
        </button>
      </div>
    </div>
  );
};

interface EmergencyContactCardProps {
  contact: EmergencyContact & { id: string };
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdate: (updates: Partial<EmergencyContact>) => void;
  onDelete: () => void;
}

const EmergencyContactCard: React.FC<EmergencyContactCardProps> = ({
  contact,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onUpdate,
  onDelete,
}) => {
  const { t } = useTranslation();

  if (isEditing) {
    return (
      <div className="p-4 border border-c-accent dark:border-c-accent rounded-lg bg-c-accent-soft dark:bg-c-accent-soft">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={contact.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={t('settings.contact.name', 'Name')}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="text"
            value={contact.relationship}
            onChange={(e) => onUpdate({ relationship: e.target.value })}
            placeholder={t('settings.contact.relationship', 'Relationship')}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="tel"
            value={contact.phone}
            onChange={(e) => onUpdate({ phone: e.target.value })}
            placeholder={t('settings.contact.phone', 'Phone')}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="email"
            value={contact.email || ''}
            onChange={(e) => onUpdate({ email: e.target.value })}
            placeholder={t('settings.contact.email', 'Email (optional)')}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onSave}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
          >
            {t('common.save', 'Save')}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-c-surface-raised text-c-text-secondary rounded-lg text-sm"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-danger-600 text-white rounded-lg text-sm ml-auto"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-c-border-subtle dark:border-navy-700 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-danger-500" />
            <span className="font-medium text-c-text">{contact.name}</span>
          </div>
          <div className="text-sm text-c-text-secondary mt-1">
            <p>{contact.relationship}</p>
            <p>{contact.phone}</p>
            {contact.email && <p>{contact.email}</p>}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg"
        >
          <Edit2 size={16} />
        </button>
      </div>
    </div>
  );
};

export default ContactInformationSection;
