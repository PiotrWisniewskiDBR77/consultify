import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { HardDrive, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SuperAdminStorageDetailModal } from './SuperAdminStorageDetailModal';

export const SuperAdminStorageView = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // File Browser State
    const [selectedOrg, setSelectedOrg] = useState<{ id: string, name: string } | null>(null);

    const loadStats = async () => {
        setLoading(true);
        try {
            const data = await Api.adminGetStorageStats();
            setStats(data);
        } catch (err: any) {
            toast.error(err.message || 'Failed to load storage stats');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <HardDrive className="text-pink-500" size={32} />
                        Storage Management
                    </h1>
                    <p className="text-slate-400 mt-2">Monitor disk usage across organizations.</p>
                </div>
                <button
                    onClick={loadStats}
                    className="p-2 bg-navy-800 hover:bg-navy-700 rounded-lg text-slate-300 transition-colors"
                >
                    <RefreshCw size={20} />
                </button>
            </header>

            {loading ? (
                <div className="flex items-center justify-center h-64 text-slate-500">Loading storage stats...</div>
            ) : !stats ? (
                <div className="flex items-center justify-center h-64 text-slate-500">No data available</div>
            ) : (
                <div className="space-y-6">
                    {/* Total Usage Card */}
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-2">Total System Storage</h2>
                        <div className="flex items-end gap-3">
                            <span className="text-4xl font-bold text-pink-500">{formatBytes(stats.totalSize)}</span>
                            <span className="text-slate-500 mb-1">consumed</span>
                        </div>
                    </div>

                    {/* Breakdown Table */}
                    <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/10">
                            <h3 className="font-semibold text-white">Usage by Organization</h3>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-navy-950 text-slate-400 text-xs uppercase">
                                <tr>
                                    <th className="px-6 py-3">Organization / Folder</th>
                                    <th className="px-6 py-3 text-right">Size</th>
                                    <th className="px-6 py-3 w-1/3">Visual</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                {stats.breakdown.length === 0 ? (
                                    <tr><td colSpan={3} className="p-6 text-center text-slate-500">No uploads found</td></tr>
                                ) : (
                                    stats.breakdown.sort((a: any, b: any) => b.size - a.size).map((item: any) => {
                                        const percent = stats.totalSize > 0 ? (item.size / stats.totalSize) * 100 : 0;
                                        return (
                                            <tr
                                                key={item.name}
                                                className="hover:bg-white/5 cursor-pointer transition-colors"
                                                onClick={() => setSelectedOrg({ id: item.name, name: item.displayName })}
                                                title="Click to browse files"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-white">{item.displayName}</div>
                                                    <div className="text-xs text-slate-500 font-mono">{item.name}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-300 font-mono">
                                                    {formatBytes(item.size)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="w-full h-2 bg-navy-950 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-pink-500 rounded-full"
                                                            style={{ width: `${Math.max(percent, 1)}%` }}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedOrg && (
                <SuperAdminStorageDetailModal
                    orgId={selectedOrg.id}
                    orgName={selectedOrg.name}
                    onClose={() => setSelectedOrg(null)}
                    onUpdate={loadStats}
                />
            )}
        </div>
    );
};
