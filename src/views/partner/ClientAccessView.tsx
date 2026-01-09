/**
 * ClientAccessView
 *
 * Client and employee access management with PMO compliance
 * Aligned with RESOURCE_RESPONSIBILITY PMO domain
 */

import { Link2, MapPin, Plus, Shield, UserCheck, Users, UserX } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { PMODomainBadge } from '../../components/Partner/EcosystemAnalytics';
import { usePartnerEcosystem } from '../../hooks/usePartnerEcosystem';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';
import { PARTNER_PMO_MAPPING } from './types';

export const ClientAccessView: React.FC = () => {
    const { setCurrentView } = useAppStore();
    const { clients, employees, loading, requestClientAccess } = usePartnerEcosystem();
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [showAccessModal, setShowAccessModal] = useState(false);

    const handleNavigate = useCallback((view: AppView) => () => setCurrentView(view), [setCurrentView]);

    const handleRequestAccess = useCallback(
        async (clientId: string, accessLevel: string) => {
            await requestClientAccess(clientId, accessLevel);
            setShowAccessModal(false);
        },
        [requestClientAccess],
    );

    const filteredClients = selectedRegion ? clients.filter((c) => c.region === selectedRegion) : clients;

    const activeEmployees = employees.filter((e) => e.status === 'ACTIVE');
    const inactiveEmployees = employees.filter((e) => e.status === 'DEACTIVATED');

    const regions = [...new Set(clients.map((c) => c.region))];

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-950">
            <div className="space-y-6 px-6 py-4">
                {/* Header with PMO Badge */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <PMODomainBadge mapping={PARTNER_PMO_MAPPING.CLIENT_ACCESS_MANAGEMENT} />
                        <span className="text-xs text-slate-500">
                            {clients.length} clients · {employees.length} employees
                        </span>
                    </div>
                    <button
                        onClick={() => setShowAccessModal(true)}
                        className="flex items-center gap-2 rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
                    >
                        <Plus size={16} />
                        Request Access
                    </button>
                </div>

                {/* Region Filter */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedRegion(null)}
                        className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                            selectedRegion === null
                                ? 'bg-brand text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300'
                        }`}
                    >
                        All Regions
                    </button>
                    {regions.map((region) => (
                        <button
                            key={region}
                            onClick={() => setSelectedRegion(region)}
                            className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-medium transition ${
                                selectedRegion === region
                                    ? 'bg-brand text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300'
                            }`}
                        >
                            <MapPin size={12} />
                            {region}
                        </button>
                    ))}
                </div>

                {/* Clients Section */}
                <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 dark:border-white/5 dark:bg-navy-900/60">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20">
                                <Users size={20} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-navy-900 dark:text-white">Clients</h3>
                                <p className="text-xs text-slate-500">{filteredClients.length} in current view</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {filteredClients.map((client) => (
                            <ClientRow key={client.id} client={client} />
                        ))}

                        {filteredClients.length === 0 && (
                            <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-navy-950/40">
                                No clients found {selectedRegion && `in ${selectedRegion}`}
                            </div>
                        )}
                    </div>
                </section>

                {/* Employees Section */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Active Employees */}
                    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 dark:border-white/5 dark:bg-navy-900/60">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
                                <UserCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-navy-900 dark:text-white">Active Employees</h3>
                                <p className="text-xs text-slate-500">{activeEmployees.length} with access</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {activeEmployees.map((employee) => (
                                <EmployeeRow key={employee.id} employee={employee} />
                            ))}

                            {activeEmployees.length === 0 && (
                                <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-navy-950/40">
                                    No active employees
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Inactive Employees */}
                    <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-6 dark:border-white/5 dark:bg-navy-900/40">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 dark:bg-white/10">
                                <UserX size={20} className="text-slate-500 dark:text-slate-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-navy-900 dark:text-white">Deactivated</h3>
                                <p className="text-xs text-slate-500">{inactiveEmployees.length} without access</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {inactiveEmployees.map((employee) => (
                                <EmployeeRow key={employee.id} employee={employee} inactive />
                            ))}

                            {inactiveEmployees.length === 0 && (
                                <div className="rounded-2xl bg-white/50 p-4 text-center text-sm text-slate-500 dark:bg-navy-900/40">
                                    No deactivated employees
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* Access Link Generator */}
                <div className="rounded-3xl border border-brand/20 bg-gradient-to-r from-brand/5 to-purple-500/5 p-6 dark:from-brand/10 dark:to-purple-500/10">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-navy-900">
                                <Link2 size={24} className="text-brand" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-navy-900 dark:text-white">Generate Access Link</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    Create secure links for client or employee onboarding
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowAccessModal(true)}
                            className="rounded-2xl border border-brand/30 bg-white px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/5 dark:bg-navy-900"
                        >
                            Get Access Link
                        </button>
                    </div>
                </div>

                {/* PMO Compliance Info */}
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 dark:border-white/5 dark:bg-navy-900/60">
                    <div className="mb-4 flex items-center gap-3">
                        <Shield size={20} className="text-orange-500" />
                        <h3 className="font-semibold text-navy-900 dark:text-white">Access Control Compliance</h3>
                    </div>

                    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                        <p>
                            Wszystkie zmiany dostępu są logowane zgodnie z PMO domain{' '}
                            <strong>RESOURCE_RESPONSIBILITY</strong>i mapowane na ISO 21500 Resource Subject Group
                            (Clause 4.6).
                        </p>
                        <ul className="space-y-2 text-xs">
                            <li className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                                <span>Filtry ról zgodne z PRINCE2 Organization Theme</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                <span>Access requests wymagają approval od PMO_LEAD lub SPONSOR</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span>Dezaktywacje z pełnym audit trail dla PMBOK Team Performance Domain</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface ClientRowProps {
    client: {
        id: string;
        clientName: string;
        region: string;
        status: string;
        accessLevel: string;
    };
}

const ClientRow: React.FC<ClientRowProps> = ({ client }) => {
    const statusColors: Record<string, string> = {
        ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
        PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
        REVOKED: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    };

    return (
        <div className="flex items-center justify-between rounded-2xl border border-slate-100 p-4 transition hover:border-brand/30 dark:border-white/5">
            <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {client.clientName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                    <div className="font-semibold text-navy-900 dark:text-white">{client.clientName}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <MapPin size={10} />
                        {client.region}
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        {client.accessLevel}
                    </div>
                </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[client.status]}`}>
                {client.status}
            </span>
        </div>
    );
};

interface EmployeeRowProps {
    employee: {
        id: string;
        employeeName: string;
        email: string;
        accessType: string;
        clients: string[];
    };
    inactive?: boolean;
}

const EmployeeRow: React.FC<EmployeeRowProps> = ({ employee, inactive }) => (
    <div
        className={`flex items-center justify-between rounded-2xl border p-4 ${
            inactive
                ? 'border-slate-100 bg-white/50 dark:border-white/5 dark:bg-navy-900/40'
                : 'border-slate-100 dark:border-white/5'
        }`}
    >
        <div className="flex items-center gap-4">
            <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                    inactive
                        ? 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500'
                        : 'bg-brand/10 text-brand'
                }`}
            >
                {employee.employeeName.substring(0, 2).toUpperCase()}
            </div>
            <div>
                <div
                    className={
                        inactive ? 'text-slate-400 dark:text-slate-500' : 'font-semibold text-navy-900 dark:text-white'
                    }
                >
                    {employee.employeeName}
                </div>
                <div className="text-xs text-slate-500">{employee.email}</div>
            </div>
        </div>
        <div className="text-right">
            <div
                className={`text-xs font-medium ${inactive ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}
            >
                {employee.accessType.replace('_', ' ')}
            </div>
            <div className="text-xs text-slate-400">{employee.clients.length} clients</div>
        </div>
    </div>
);

export default ClientAccessView;
