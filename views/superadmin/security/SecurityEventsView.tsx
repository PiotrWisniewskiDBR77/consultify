/**
 * Security Events View
 * Displays and manages security events and alerts
 */

import { AlertTriangle, CheckCircle, Filter } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

export const SecurityEventsView: React.FC = () => {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        organizationId: '',
        userId: '',
        eventType: '',
        severity: '',
        resolved: '',
    });

    useEffect(() => {
        fetchEvents();
    }, [filters]);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const eventList = await Api.getSecurityEvents(filters);
            setEvents(eventList);
        } catch (err) {
            toast.error('Failed to fetch security events');
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (eventId: string) => {
        try {
            await Api.resolveSecurityEvent(eventId);
            toast.success('Event resolved');
            fetchEvents();
        } catch (err: any) {
            toast.error(err.message || 'Failed to resolve event');
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'high':
                return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'medium':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'low':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default:
                return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Security Events</h2>
                    <p className="text-slate-400 text-sm mt-1">Monitor and manage security events</p>
                </div>
            </div>

            <div className="bg-navy-800 rounded-xl border border-slate-700 p-4 flex gap-4">
                <select
                    value={filters.severity}
                    onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                    className="bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
                >
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
                <select
                    value={filters.eventType}
                    onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
                    className="bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
                >
                    <option value="">All Event Types</option>
                    <option value="failed_login">Failed Login</option>
                    <option value="suspicious_activity">Suspicious Activity</option>
                    <option value="data_export">Data Export</option>
                    <option value="permission_change">Permission Change</option>
                </select>
                <select
                    value={filters.resolved}
                    onChange={(e) => setFilters({ ...filters, resolved: e.target.value })}
                    className="bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
                >
                    <option value="">All Status</option>
                    <option value="false">Unresolved</option>
                    <option value="true">Resolved</option>
                </select>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading...</div>
            ) : (
                <div className="bg-navy-800 rounded-xl border border-slate-700 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-navy-900 border-b border-slate-700">
                            <tr>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">
                                    Time
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">
                                    Event Type
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">
                                    Severity
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">
                                    IP Address
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">
                                    Location
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">
                                    Status
                                </th>
                                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {events.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                        No security events found
                                    </td>
                                </tr>
                            ) : (
                                events.map((event) => (
                                    <tr key={event.id} className="hover:bg-navy-700/50">
                                        <td className="px-6 py-4 text-slate-300">
                                            {new Date(event.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-white">{event.event_type}</td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-2 py-1 rounded text-xs border ${getSeverityColor(event.severity)}`}
                                            >
                                                {event.severity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">{event.ip_address || '-'}</td>
                                        <td className="px-6 py-4 text-slate-300">
                                            {event.location_city
                                                ? `${event.location_city}, ${event.location_country}`
                                                : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {event.resolved ? (
                                                <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">
                                                    Resolved
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400">
                                                    Open
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {!event.resolved && (
                                                <button
                                                    onClick={() => handleResolve(event.id)}
                                                    className="text-green-400 hover:text-green-300"
                                                    title="Resolve event"
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};





