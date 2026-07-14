/**
 * Tax Settings Panel
 * Extended tax configuration with VAT validation, tax rates, and Stripe Tax integration
 */

import {
  AlertTriangle,
  Calculator,
  CheckCircle,
  Edit2,
  Globe,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../services/api';

interface TaxRate {
  id: string;
  display_name: string;
  description?: string;
  jurisdiction?: string;
  jurisdiction_level?: string;
  percentage: number;
  inclusive: boolean;
  tax_type: string;
  country?: string;
  state?: string;
  is_active: boolean;
  effective_from?: string;
  effective_until?: string;
  automatic_tax: boolean;
}

interface VATValidation {
  is_valid: boolean;
  company_name?: string;
  company_address?: string;
  error?: string;
  cached?: boolean;
  validation_source?: string;
}

interface TaxCalculation {
  taxAmount: number;
  taxRate: number;
  taxType: string;
  taxBehavior: string;
  description?: string;
  breakdown: Array<{
    name: string;
    rate: number;
    amount: number;
  }>;
}

interface TaxSettingsPanelProps {
  isAdmin?: boolean;
}

const TAX_TYPES = [
  { value: 'vat', label: 'VAT (Value Added Tax)' },
  { value: 'gst', label: 'GST (Goods and Services Tax)' },
  { value: 'hst', label: 'HST (Harmonized Sales Tax)' },
  { value: 'pst', label: 'PST (Provincial Sales Tax)' },
  { value: 'sales_tax', label: 'Sales Tax' },
  { value: 'withholding', label: 'Withholding Tax' },
  { value: 'other', label: 'Other' },
];

const COUNTRIES = [
  { code: 'PL', name: 'Poland' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'SE', name: 'Sweden' },
];

export const TaxSettingsPanel: React.FC<TaxSettingsPanelProps> = ({ isAdmin = false }) => {
  const [activeTab, setActiveTab] = useState<'rates' | 'validation' | 'calculator'>('rates');
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('');

  // VAT Validation state
  const [vatNumber, setVatNumber] = useState('');
  const [vatCountry, setVatCountry] = useState('');
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<VATValidation | null>(null);

  // Calculator state
  const [calcAmount, setCalcAmount] = useState(10000);
  const [calcCountry, setCalcCountry] = useState('');
  const [calcTaxId, setCalcTaxId] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [calcResult, setCalcResult] = useState<TaxCalculation | null>(null);

  useEffect(() => {
    fetchTaxRates();
  }, [countryFilter]);

  const fetchTaxRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (countryFilter) params.append('country', countryFilter);
      const res = await Api.get(`/billing/tax/rates?${params.toString()}`);
      setTaxRates(res.rates || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load tax rates');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateVAT = async () => {
    if (!vatNumber || !vatCountry) return;
    setValidating(true);
    setValidation(null);
    try {
      const res = await Api.post('/billing/tax/validate-vat', {
        vatNumber,
        countryCode: vatCountry,
      });
      setValidation(res.validation);
    } catch (err: any) {
      setValidation({ is_valid: false, error: err.message });
    } finally {
      setValidating(false);
    }
  };

  const handleCalculateTax = async () => {
    if (!calcAmount || !calcCountry) return;
    setCalculating(true);
    setCalcResult(null);
    try {
      const res = await Api.post('/billing/tax/calculate', {
        amount: calcAmount,
        currency: 'USD',
        country: calcCountry,
        taxIdNumber: calcTaxId || undefined,
      });
      setCalcResult(res.tax);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate tax');
    } finally {
      setCalculating(false);
    }
  };

  const handleDeleteRate = async (rateId: string) => {
    if (!window.confirm('Are you sure you want to delete this tax rate?')) return;
    try {
      await Api.delete(`/billing/admin/tax/rates/${rateId}`);
      fetchTaxRates();
    } catch (err: any) {
      setError(err.message || 'Failed to delete tax rate');
    }
  };

  const handleSaveRate = async (rate: Partial<TaxRate>) => {
    try {
      if (editingRate?.id) {
        await Api.put(`/billing/admin/tax/rates/${editingRate.id}`, rate);
      } else {
        await Api.post('/billing/admin/tax/rates', rate);
      }
      setShowEditModal(false);
      setEditingRate(null);
      fetchTaxRates();
    } catch (err: any) {
      setError(err.message || 'Failed to save tax rate');
    }
  };

  const filteredRates = taxRates.filter(
    (rate) =>
      rate.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rate.jurisdiction?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rate.country?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount / 100);
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-navy-700">
        <button
          onClick={() => setActiveTab('rates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'rates'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300'
          }`}
        >
          <Globe className="w-4 h-4 inline mr-2" />
          Tax Rates
        </button>
        <button
          onClick={() => setActiveTab('validation')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'validation'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300'
          }`}
        >
          <Shield className="w-4 h-4 inline mr-2" />
          VAT Validation
        </button>
        <button
          onClick={() => setActiveTab('calculator')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'calculator'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300'
          }`}
        >
          <Calculator className="w-4 h-4 inline mr-2" />
          Tax Calculator
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-danger-500" />
          <p className="text-danger-700 dark:text-danger-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-danger-500 hover:text-danger-700"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tax Rates Tab */}
      {activeTab === 'rates' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search tax rates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
              />
            </div>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
            >
              <option value="">All Countries</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={fetchTaxRates}
              className="p-2 rounded-lg border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  setEditingRate(null);
                  setShowEditModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800"
              >
                <Plus className="w-4 h-4" />
                Add Tax Rate
              </button>
            )}
          </div>

          {/* Tax Rates Table */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
              </div>
            ) : filteredRates.length === 0 ? (
              <div className="text-center py-12">
                <Percent className="w-12 h-12 mx-auto text-slate-600 dark:text-slate-400 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No tax rates found</p>
              </div>
            ) : (
              <table
                /* §27-exempt: panel konfiguracyjny/billingowy, mala tabela ustawien poza zakresem listowym */ className="w-full"
              >
                <thead className="bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Country
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Type
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Rate
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Status
                    </th>
                    {isAdmin && (
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {filteredRates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {rate.display_name}
                          </p>
                          {rate.jurisdiction && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {rate.jurisdiction}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {rate.country || 'Global'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {rate.tax_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {rate.percentage}%
                        </span>
                        {rate.inclusive && (
                          <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                            (incl.)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rate.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                            <XCircle className="w-3 h-3" />
                            Inactive
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingRate(rate);
                                setShowEditModal(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRate(rate.id)}
                              className="p-1.5 rounded-lg text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* VAT Validation Tab */}
      {activeTab === 'validation' && (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/20 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                VAT validation is currently not configured. Integration with VIES (EU) or Stripe Tax
                is required.
              </p>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Validate VAT/Tax ID Number
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Verify VAT numbers against official databases (VIES for EU, Stripe Tax for others).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Country
              </label>
              <select
                value={vatCountry}
                onChange={(e) => setVatCountry(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
              >
                <option value="">Select country...</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                VAT/Tax ID Number
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value.toUpperCase())}
                  placeholder="e.g., PL1234567890"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white font-mono"
                />
                <div className="relative group">
                  <button
                    disabled
                    className="px-6 py-2 rounded-lg bg-navy-900 text-white opacity-50 cursor-not-allowed"
                  >
                    Verify
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
                    VAT validation service not configured
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-700" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {validation && (
            <div
              className={`p-4 rounded-lg ${
                validation.is_valid
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800'
              }`}
            >
              <div className="flex items-start gap-3">
                {validation.is_valid ? (
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-danger-500 mt-0.5" />
                )}
                <div>
                  <p
                    className={`font-medium ${validation.is_valid ? 'text-green-700 dark:text-green-400' : 'text-danger-700 dark:text-danger-400'}`}
                  >
                    {validation.is_valid ? 'Valid VAT Number' : 'Invalid VAT Number'}
                  </p>
                  {validation.company_name && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      <strong>Company:</strong> {validation.company_name}
                    </p>
                  )}
                  {validation.company_address && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      <strong>Address:</strong> {validation.company_address}
                    </p>
                  )}
                  {validation.error && (
                    <p className="text-sm text-danger-600 dark:text-danger-400 mt-1">
                      {validation.error}
                    </p>
                  )}
                  {validation.cached && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      Result from cache • Source: {validation.validation_source}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tax Calculator Tab */}
      {activeTab === 'calculator' && (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Tax Calculator
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Calculate applicable taxes based on customer location and tax ID.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Amount (cents)
              </label>
              <input
                type="number"
                value={calcAmount}
                onChange={(e) => setCalcAmount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Customer Country
              </label>
              <select
                value={calcCountry}
                onChange={(e) => setCalcCountry(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
              >
                <option value="">Select country...</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tax ID (optional)
              </label>
              <input
                type="text"
                value={calcTaxId}
                onChange={(e) => setCalcTaxId(e.target.value)}
                placeholder="For B2B reverse charge"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCalculateTax}
                disabled={!calcAmount || !calcCountry || calculating}
                className="w-full px-6 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {calculating ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'Calculate'}
              </button>
            </div>
          </div>

          {calcResult && (
            <div className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 dark:text-white mb-3">
                Calculation Result
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Subtotal</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(calcAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tax Rate</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {calcResult.taxRate}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tax Amount</p>
                  <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                    {formatCurrency(calcResult.taxAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(calcAmount + calcResult.taxAmount)}
                  </p>
                </div>
              </div>
              {calcResult.description && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <strong>Applied:</strong> {calcResult.description}
                </p>
              )}
              {calcResult.taxBehavior === 'reverse_charge' && (
                <div className="mt-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm">
                  ℹ️ EU Reverse Charge applies - Customer is responsible for declaring VAT.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Tax Rate Modal */}
      {showEditModal && (
        <EditTaxRateModal
          rate={editingRate}
          onSave={handleSaveRate}
          onClose={() => {
            setShowEditModal(false);
            setEditingRate(null);
          }}
        />
      )}
    </div>
  );
};

// Edit Tax Rate Modal
interface EditTaxRateModalProps {
  rate: TaxRate | null;
  onSave: (rate: Partial<TaxRate>) => void;
  onClose: () => void;
}

const EditTaxRateModal: React.FC<EditTaxRateModalProps> = ({ rate, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    display_name: rate?.display_name || '',
    description: rate?.description || '',
    jurisdiction: rate?.jurisdiction || '',
    percentage: rate?.percentage || 0,
    inclusive: rate?.inclusive || false,
    tax_type: rate?.tax_type || 'vat',
    country: rate?.country || '',
    state: rate?.state || '',
    is_active: rate?.is_active !== false,
    automatic_tax: rate?.automatic_tax || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-navy-800 rounded-xl shadow-xl max-w-lg w-full p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {rate ? 'Edit Tax Rate' : 'Create Tax Rate'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Display Name *
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, display_name: e.target.value }))}
              required
              placeholder="e.g., Polish VAT 23%"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tax Type *
              </label>
              <select
                value={formData.tax_type}
                onChange={(e) => setFormData((prev) => ({ ...prev, tax_type: e.target.value }))}
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800"
              >
                {TAX_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Rate (%) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.percentage}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, percentage: parseFloat(e.target.value) || 0 }))
                }
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Country
              </label>
              <select
                value={formData.country}
                onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800"
              >
                <option value="">Global</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Jurisdiction
              </label>
              <input
                type="text"
                value={formData.jurisdiction}
                onChange={(e) => setFormData((prev) => ({ ...prev, jurisdiction: e.target.value }))}
                placeholder="e.g., Poland"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.inclusive}
                onChange={(e) => setFormData((prev) => ({ ...prev, inclusive: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Tax Inclusive</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800"
            >
              {rate ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaxSettingsPanel;
