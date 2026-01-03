/**
 * Customer Health View
 */

import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Api } from '../../../services/api';
import { toast } from 'react-hot-toast';

export const CustomerHealthView: React.FC = () => {
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [health, setHealth] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchOrganizations();
    }, []);

    useEffect(() => {
        if (selectedOrgId) {
            fetchHealth();
        }
    }, [selectedOrgId]);

    const fetchOrganizations = async () => {
        try {
            const orgs = await Api.getOrganizations();
            setOrganizations(orgs);
            if (orgs.length > 0) {
                setSelectedOrgId(orgs[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch organizations:', err);
        }
    };

    const fetchHealth = async () => {
        if (!selectedOrgId) return;
        setLoading(true);
        try {
            const data = await Api.getCustomerHealthCheck(selectedOrgId);
            setHealth(data);
        } catch (err) {
            // Health check might not exist yet
            setHealth(null);
        } finally {
            setLoading(false);
        }
    };

    const getHealthColor = (healthLevel: string) => {
        switch (healthLevel?.toLowerCase()) {
            case 'excellent': return 'text-green-400';
            case 'good': return 'text-green-300';
            case 'fair': return 'text-yellow-400';
            case 'poor': return 'text-red-400';
            default: return 'text-slate-400';
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Customer Health</h2>
                    <p className="text-slate-400 text-sm mt-1">Monitor customer health and engagement</p>
                </div>
                <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="bg-navy-800 border border-slate-700 text-white px-4 py-2 rounded-lg"
                >
                    <option value="">Select Organization</option>
                    {organizations.map(org => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading...</div>
            ) : health ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-navy-800 rounded-xl border border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-slate-400 text-sm">Overall Health</h3>
                            <Activity className="text-violet-400" size={20} />
                        </div>
                        <div className={`text-3xl font-bold ${getHealthColor(health.overall_health)}`}>
                            {health.overall_health || 'N/A'}
                        </div>
                        {health.churn_risk && (
                            <div className="mt-2 text-sm text-slate-400">
                                Churn Risk: <span className="text-yellow-400">{health.churn_risk}</span>
                            </div>
                        )}
                    </div>
                    <div className="bg-navy-800 rounded-xl border border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-slate-400 text-sm">Engagement</h3>
                            <TrendingUp className="text-green-400" size={20} />
                        </div>
                        <div className="text-3xl font-bold text-white">
                            {health.engagement_level || 'N/A'}
                        </div>
                        {health.adoption_score !== null && (
                            <div className="mt-2 text-sm text-slate-400">
                                Adoption Score: <span className="text-green-400">{health.adoption_score}%</span>
                            </div>
                        )}
                    </div>
                    <div className="bg-navy-800 rounded-xl border border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-slate-400 text-sm">Support</h3>
                            <AlertTriangle className="text-yellow-400" size={20} />
                        </div>
                        <div className="text-3xl font-bold text-white">
                            {health.open_tickets_count || 0}
                        </div>
                        <div className="mt-2 text-sm text-slate-400">
                            Open Tickets
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 text-slate-400">
                    No health data available. Health checks are calculated automatically.
                </div>
            )}
        </div>
    );
};

