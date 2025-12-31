/**
 * InvoiceCenterView - Super Admin Invoice & Billing Management
 * 
 * Enterprise billing management:
 * - Invoice generation and management
 * - Credit notes
 * - Tax configuration
 * - Usage-based billing
 * - Subscription management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Receipt,
    Download,
    Send,
    RefreshCw,
    Loader2,
    Search,
    Filter,
    Calendar,
    DollarSign,
    CreditCard,
    FileText,
    Building2,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    Plus,
    Eye,
    MoreVertical,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    Printer
} from 'lucide-react';
import { Api } from '../../services/api';
import { InfoButton } from '../../components/shared/InfoButton';

interface Invoice {
    id: string;
    invoiceNumber: string;
    organizationId: string;
    organizationName: string;
    status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
    amount: number;
    currency: string;
    tax: number;
    total: number;
    dueDate: string;
    paidAt?: string;
    createdAt: string;
    items: {
        description: string;
        quantity: number;
        unitPrice: number;
        amount: number;
    }[];
    stripeInvoiceId?: string;
}

interface BillingStats {
    totalRevenue: number;
    paidInvoices: number;
    pendingInvoices: number;
    overdueInvoices: number;
    overdueAmount: number;
    monthlyGrowth: number;
}

type TabType = 'invoices' | 'credits' | 'tax' | 'usage';
type DateFilter = '7d' | '30d' | '90d' | '1y' | 'all';

export const InvoiceCenterView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('invoices');
    const [loading, setLoading] = useState(true);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [stats, setStats] = useState<BillingStats | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [invoicesResult, statsResult] = await Promise.all([
                Api.get(`/api/superadmin/invoices?period=${dateFilter}`),
                Api.get('/api/superadmin/invoices/stats'),
            ]);
            setInvoices(invoicesResult.invoices || []);
            setStats(statsResult);
        } catch (error) {
            console.error('Failed to fetch invoices:', error);
        } finally {
            setLoading(false);
        }
    }, [dateFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredInvoices = invoices.filter(invoice => {
        const matchesSearch = 
            invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            invoice.organizationName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleSendReminder = async (invoiceId: string) => {
        try {
            await Api.post(`/api/superadmin/invoices/${invoiceId}/remind`);
            // Show success toast
        } catch (error) {
            console.error('Failed to send reminder:', error);
        }
    };

    const handleMarkPaid = async (invoiceId: string) => {
        try {
            await Api.post(`/api/superadmin/invoices/${invoiceId}/mark-paid`);
            fetchData();
        } catch (error) {
            console.error('Failed to mark as paid:', error);
        }
    };

    const handleDownloadPdf = async (invoiceId: string) => {
        try {
            const response = await Api.get(`/api/superadmin/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
            // Download logic
        } catch (error) {
            console.error('Failed to download PDF:', error);
        }
    };

    const formatCurrency = (amount: number, currency: string = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
        }).format(amount);
    };

    const getStatusBadge = (status: Invoice['status']) => {
        const styles = {
            draft: 'bg-slate-500/10 text-slate-600',
            pending: 'bg-amber-500/10 text-amber-600',
            paid: 'bg-emerald-500/10 text-emerald-600',
            overdue: 'bg-red-500/10 text-red-600',
            cancelled: 'bg-slate-500/10 text-slate-500',
            refunded: 'bg-blue-500/10 text-blue-600',
        };
        const icons = {
            draft: <FileText size={12} />,
            pending: <Clock size={12} />,
            paid: <CheckCircle2 size={12} />,
            overdue: <AlertTriangle size={12} />,
            cancelled: <XCircle size={12} />,
            refunded: <ArrowDownRight size={12} />,
        };
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
                {icons[status]}
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    const renderInvoicesTab = () => (
        <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-navy-800 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-slate-500">Total Revenue</span>
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <DollarSign className="text-emerald-500" size={20} />
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {formatCurrency(stats.totalRevenue)}
                        </div>
                        <div className={`mt-1 text-sm flex items-center gap-1 ${stats.monthlyGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {stats.monthlyGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {Math.abs(stats.monthlyGrowth)}% vs last month
                        </div>
                    </div>

                    <div className="bg-white dark:bg-navy-800 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-slate-500">Paid Invoices</span>
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <CheckCircle2 className="text-blue-500" size={20} />
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {stats.paidInvoices}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">This period</div>
                    </div>

                    <div className="bg-white dark:bg-navy-800 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-slate-500">Pending</span>
                            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Clock className="text-amber-500" size={20} />
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {stats.pendingInvoices}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">Awaiting payment</div>
                    </div>

                    <div className="bg-white dark:bg-navy-800 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-slate-500">Overdue</span>
                            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                                <AlertTriangle className="text-red-500" size={20} />
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-red-600">
                            {stats.overdueInvoices}
                        </div>
                        <div className="mt-1 text-sm text-red-500">
                            {formatCurrency(stats.overdueAmount)} outstanding
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search invoices..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg"
                >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                    className="px-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg"
                >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="1y">Last year</option>
                    <option value="all">All time</option>
                </select>
                <button className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center gap-2">
                    <Plus size={18} />
                    Create Invoice
                </button>
            </div>

            {/* Invoices Table */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-white/10">
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Invoice</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Organization</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Date</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Due Date</th>
                            <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {filteredInvoices.map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-900 dark:text-white font-mono">
                                        {invoice.invoiceNumber}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                            {invoice.organizationName.charAt(0)}
                                        </div>
                                        <span className="text-slate-700 dark:text-slate-300">{invoice.organizationName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-slate-900 dark:text-white">
                                        {formatCurrency(invoice.total, invoice.currency)}
                                    </div>
                                    {invoice.tax > 0 && (
                                        <div className="text-xs text-slate-500">
                                            incl. {formatCurrency(invoice.tax, invoice.currency)} tax
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {getStatusBadge(invoice.status)}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                    {new Date(invoice.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-sm ${
                                        invoice.status === 'overdue' ? 'text-red-600 font-medium' : 'text-slate-500'
                                    }`}>
                                        {new Date(invoice.dueDate).toLocaleDateString()}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => setSelectedInvoice(invoice)}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                                            title="View"
                                        >
                                            <Eye size={16} className="text-slate-400" />
                                        </button>
                                        <button
                                            onClick={() => handleDownloadPdf(invoice.id)}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                                            title="Download PDF"
                                        >
                                            <Download size={16} className="text-slate-400" />
                                        </button>
                                        {(invoice.status === 'pending' || invoice.status === 'overdue') && (
                                            <button
                                                onClick={() => handleSendReminder(invoice.id)}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                                                title="Send Reminder"
                                            >
                                                <Send size={16} className="text-slate-400" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredInvoices.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center">
                                    <Receipt size={40} className="mx-auto mb-3 text-slate-300" />
                                    <p className="text-slate-500 font-medium">No invoices found</p>
                                    <p className="text-sm text-slate-400">Invoices will appear here once created</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderCreditsTab = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-end">
                <button className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center gap-2">
                    <Plus size={18} />
                    Issue Credit Note
                </button>
            </div>

            <div className="bg-white dark:bg-navy-800 rounded-xl p-12 border border-slate-200 dark:border-white/10 text-center">
                <CreditCard size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 font-medium">No credit notes</p>
                <p className="text-sm text-slate-400">Credit notes will appear here when issued</p>
            </div>
        </div>
    );

    const renderTaxTab = () => (
        <div className="space-y-6">
            <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Tax Configuration</h3>
                
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Default Tax Rate (%)
                            </label>
                            <input
                                type="number"
                                defaultValue={0}
                                min={0}
                                max={100}
                                step={0.01}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Tax ID / VAT Number
                            </label>
                            <input
                                type="text"
                                placeholder="Enter tax ID"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-violet-600" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                                Enable Stripe Tax for automatic tax calculation
                            </span>
                        </label>
                    </div>

                    <div className="flex justify-end">
                        <button className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium">
                            Save Tax Settings
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Tax Rates by Country</h3>
                <p className="text-slate-500 text-sm">Configure country-specific tax rates for accurate billing.</p>
                
                <button className="mt-4 px-4 py-2 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Plus size={16} />
                    Add Tax Rate
                </button>
            </div>
        </div>
    );

    const renderUsageTab = () => (
        <div className="space-y-6">
            <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Usage-Based Billing</h3>
                
                <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-800 dark:text-blue-400">
                        Usage-based billing reconciliation runs automatically at the end of each billing period.
                        Overages are calculated based on token consumption above the plan limits.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                        <div>
                            <div className="font-medium text-slate-900 dark:text-white">Token Overage Rate</div>
                            <div className="text-sm text-slate-500">Cost per 1,000 tokens above plan limit</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-slate-900 dark:text-white">$0.002</span>
                            <button className="text-violet-600 hover:text-violet-700 text-sm">Edit</button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                        <div>
                            <div className="font-medium text-slate-900 dark:text-white">Storage Overage Rate</div>
                            <div className="text-sm text-slate-500">Cost per GB above plan limit</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-slate-900 dark:text-white">$0.10</span>
                            <button className="text-violet-600 hover:text-violet-700 text-sm">Edit</button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between py-3">
                        <div>
                            <div className="font-medium text-slate-900 dark:text-white">User Overage Rate</div>
                            <div className="text-sm text-slate-500">Cost per additional user above plan limit</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-slate-900 dark:text-white">$5.00</span>
                            <button className="text-violet-600 hover:text-violet-700 text-sm">Edit</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Usage Alerts</h3>
                
                <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-violet-600" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                        Send email alerts when organizations reach 80% of their usage limits
                    </span>
                </label>
            </div>
        </div>
    );

    // Invoice Detail Modal
    const renderInvoiceModal = () => {
        if (!selectedInvoice) return null;

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Invoice {selectedInvoice.invoiceNumber}
                            </h2>
                            <p className="text-slate-500 mt-1">{selectedInvoice.organizationName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg">
                                <Printer size={20} className="text-slate-400" />
                            </button>
                            <button className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg">
                                <Download size={20} className="text-slate-400" />
                            </button>
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                            >
                                <XCircle size={20} className="text-slate-400" />
                            </button>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="flex justify-between mb-6">
                            <div>
                                <div className="text-sm text-slate-500">Issue Date</div>
                                <div className="font-medium text-slate-900 dark:text-white">
                                    {new Date(selectedInvoice.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-slate-500">Due Date</div>
                                <div className="font-medium text-slate-900 dark:text-white">
                                    {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-slate-500">Status</div>
                                <div className="mt-1">{getStatusBadge(selectedInvoice.status)}</div>
                            </div>
                        </div>

                        <table className="w-full mb-6">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-white/10">
                                    <th className="text-left py-3 text-sm text-slate-500">Description</th>
                                    <th className="text-right py-3 text-sm text-slate-500">Qty</th>
                                    <th className="text-right py-3 text-sm text-slate-500">Price</th>
                                    <th className="text-right py-3 text-sm text-slate-500">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedInvoice.items.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 dark:border-white/5">
                                        <td className="py-3 text-slate-900 dark:text-white">{item.description}</td>
                                        <td className="py-3 text-right text-slate-600 dark:text-slate-400">{item.quantity}</td>
                                        <td className="py-3 text-right text-slate-600 dark:text-slate-400">
                                            {formatCurrency(item.unitPrice, selectedInvoice.currency)}
                                        </td>
                                        <td className="py-3 text-right font-medium text-slate-900 dark:text-white">
                                            {formatCurrency(item.amount, selectedInvoice.currency)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="space-y-2 border-t border-slate-200 dark:border-white/10 pt-4">
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Subtotal</span>
                                <span>{formatCurrency(selectedInvoice.amount, selectedInvoice.currency)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Tax</span>
                                <span>{formatCurrency(selectedInvoice.tax, selectedInvoice.currency)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-white/10">
                                <span>Total</span>
                                <span>{formatCurrency(selectedInvoice.total, selectedInvoice.currency)}</span>
                            </div>
                        </div>
                    </div>

                    {(selectedInvoice.status === 'pending' || selectedInvoice.status === 'overdue') && (
                        <div className="p-6 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3">
                            <button
                                onClick={() => handleSendReminder(selectedInvoice.id)}
                                className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                            >
                                <Send size={16} />
                                Send Reminder
                            </button>
                            <button
                                onClick={() => { handleMarkPaid(selectedInvoice.id); setSelectedInvoice(null); }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center gap-2"
                            >
                                <CheckCircle2 size={16} />
                                Mark as Paid
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 relative">
            <InfoButton cardId="superadmin-invoices" position="top-right" />
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoice Center</h1>
                    <p className="text-slate-500 mt-1">Manage invoices and billing</p>
                </div>
                <div className="flex items-center gap-2">
                    <InfoButton cardId="superadmin-invoices" position="header-inline" size="md" showLabel label="Help" />
                    <button
                        onClick={fetchData}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                    >
                        <RefreshCw size={18} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-lg w-fit">
                {[
                    { id: 'invoices', label: 'Invoices', icon: <Receipt size={16} /> },
                    { id: 'credits', label: 'Credit Notes', icon: <CreditCard size={16} /> },
                    { id: 'tax', label: 'Tax Settings', icon: <FileText size={16} /> },
                    { id: 'usage', label: 'Usage Billing', icon: <TrendingUp size={16} /> },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-navy-800 text-violet-600 dark:text-violet-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-violet-500" />
                </div>
            ) : (
                <>
                    {activeTab === 'invoices' && renderInvoicesTab()}
                    {activeTab === 'credits' && renderCreditsTab()}
                    {activeTab === 'tax' && renderTaxTab()}
                    {activeTab === 'usage' && renderUsageTab()}
                </>
            )}

            {/* Invoice Modal */}
            {renderInvoiceModal()}
        </div>
    );
};

export default InvoiceCenterView;

