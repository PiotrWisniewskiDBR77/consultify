/**
 * CompanyAddressSettings - Company address management component
 *
 * Features:
 * - Street address, city, postal code, country
 * - Tax ID / VAT Number field
 * - Address preview
 * - Form validation
 *
 * Design: Card-based form sections matching Organization Profile
 */

import { Building, Check, MapPin, Receipt, Save } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Input } from '../../ui/primitives/Input';

// Country options
const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'PL', name: 'Poland' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
];

export interface CompanyAddress {
  street: string;
  street2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  taxId?: string;
  vatNumber?: string;
}

interface CompanyAddressSettingsProps {
  address?: CompanyAddress;
  onChange: (address: CompanyAddress) => void;
  onSave?: () => Promise<void>;
  className?: string;
}

export const CompanyAddressSettings: React.FC<CompanyAddressSettingsProps> = ({
  address,
  onChange,
  onSave,
  className,
}) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CompanyAddress, string>>>({});

  const [formData, setFormData] = useState<CompanyAddress>({
    street: address?.street || '',
    street2: address?.street2 || '',
    city: address?.city || '',
    state: address?.state || '',
    postalCode: address?.postalCode || '',
    country: address?.country || 'US',
    taxId: address?.taxId || '',
    vatNumber: address?.vatNumber || '',
  });

  const updateField = useCallback(
    <K extends keyof CompanyAddress>(field: K, value: CompanyAddress[K]) => {
      setFormData((prev) => {
        const newData = { ...prev, [field]: value };
        onChange(newData);
        return newData;
      });
      // Clear error when field is updated
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [onChange, errors]
  );

  const validate = useCallback(() => {
    const newErrors: Partial<Record<keyof CompanyAddress, string>> = {};

    if (!formData.street.trim()) {
      newErrors.street = t('admin.org.address.errors.streetRequired', 'Street address is required');
    }
    if (!formData.city.trim()) {
      newErrors.city = t('admin.org.address.errors.cityRequired', 'City is required');
    }
    if (!formData.postalCode.trim()) {
      newErrors.postalCode = t(
        'admin.org.address.errors.postalCodeRequired',
        'Postal code is required'
      );
    }
    if (!formData.country) {
      newErrors.country = t('admin.org.address.errors.countryRequired', 'Country is required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, t]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    if (!onSave) return;

    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }, [validate, onSave]);

  // Format address for preview
  const formattedAddress = React.useMemo(() => {
    const parts = [];
    if (formData.street) parts.push(formData.street);
    if (formData.street2) parts.push(formData.street2);

    const cityLine = [formData.city, formData.state, formData.postalCode]
      .filter(Boolean)
      .join(', ');
    if (cityLine) parts.push(cityLine);

    const country = COUNTRIES.find((c) => c.code === formData.country)?.name || formData.country;
    if (country) parts.push(country);

    return parts;
  }, [formData]);

  const selectedCountry = COUNTRIES.find((c) => c.code === formData.country);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Company Address Card */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <MapPin size={20} className="text-primary-500" />
          {t('admin.org.address.title', 'Company Address')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {t(
            'admin.org.address.description',
            'This address will appear on invoices and official documents.'
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Street Address */}
          <div className="md:col-span-2">
            <Input
              label={t('admin.org.address.street', 'Street Address')}
              value={formData.street}
              onChange={(e) => updateField('street', e.target.value)}
              placeholder="123 Main Street"
              error={errors.street}
              icon={<Building size={16} />}
            />
          </div>

          {/* Street Address 2 */}
          <div className="md:col-span-2">
            <Input
              label={t('admin.org.address.street2', 'Street Address Line 2')}
              value={formData.street2 || ''}
              onChange={(e) => updateField('street2', e.target.value)}
              placeholder="Suite 100, Floor 5"
              helperText={t(
                'admin.org.address.street2Helper',
                'Optional: Apartment, suite, unit, building, floor, etc.'
              )}
            />
          </div>

          {/* City */}
          <div>
            <Input
              label={t('admin.org.address.city', 'City')}
              value={formData.city}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder="New York"
              error={errors.city}
            />
          </div>

          {/* State / Province */}
          <div>
            <Input
              label={t('admin.org.address.state', 'State / Province')}
              value={formData.state || ''}
              onChange={(e) => updateField('state', e.target.value)}
              placeholder="NY"
              helperText={t('admin.org.address.stateHelper', 'Optional for some countries')}
            />
          </div>

          {/* Postal Code */}
          <div>
            <Input
              label={t('admin.org.address.postalCode', 'Postal Code')}
              value={formData.postalCode}
              onChange={(e) => updateField('postalCode', e.target.value)}
              placeholder="10001"
              error={errors.postalCode}
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              {t('admin.org.address.country', 'Country')}
            </label>
            <select
              value={formData.country}
              onChange={(e) => updateField('country', e.target.value)}
              className={cn(
                'w-full px-4 py-3 bg-slate-50 dark:bg-navy-900 border rounded-xl text-navy-900 dark:text-white',
                'transition-all duration-150 ease-out outline-none focus:ring-2 focus:bg-white dark:focus:bg-navy-900',
                errors.country
                  ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
                  : 'border-transparent focus:border-c-focus-solid focus:ring-c-focus'
              )}
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            {errors.country && <p className="mt-2 text-sm text-danger-500">{errors.country}</p>}
          </div>
        </div>

        {/* Address Preview */}
        {formattedAddress.length > 0 && formattedAddress[0] && (
          <div className="mt-6 p-4 bg-slate-50 dark:bg-navy-900 rounded-lg">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {t('admin.org.address.preview', 'Address Preview')}
            </p>
            <div className="text-sm text-navy-900 dark:text-white space-y-0.5">
              {formattedAddress.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tax Information Card */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <Receipt size={20} className="text-primary-500" />
          {t('admin.org.address.taxInfo', 'Tax Information')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {t(
            'admin.org.address.taxInfoDescription',
            'Tax identification numbers for invoicing and compliance.'
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tax ID */}
          <div>
            <Input
              label={t('admin.org.address.taxId', 'Tax ID / EIN')}
              value={formData.taxId || ''}
              onChange={(e) => updateField('taxId', e.target.value)}
              placeholder="XX-XXXXXXX"
              helperText={t(
                'admin.org.address.taxIdHelper',
                'Employer Identification Number (US) or equivalent'
              )}
            />
          </div>

          {/* VAT Number */}
          <div>
            <Input
              label={t('admin.org.address.vatNumber', 'VAT Number')}
              value={formData.vatNumber || ''}
              onChange={(e) => updateField('vatNumber', e.target.value)}
              placeholder={selectedCountry?.code === 'PL' ? 'PL1234567890' : 'XX123456789'}
              helperText={t('admin.org.address.vatHelper', 'Required for EU businesses')}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      {onSave && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            icon={saving ? undefined : <Save size={16} />}
          >
            {t('common.saveChanges', 'Save Changes')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CompanyAddressSettings;
