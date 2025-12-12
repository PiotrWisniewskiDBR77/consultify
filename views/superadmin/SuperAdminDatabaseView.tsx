import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { Database, Table, RefreshCw, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const SuperAdminDatabaseView = () => {
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadTables();
    }, []);

    useEffect(() => {
        if (selectedTable) {
            loadRows(selectedTable);
        }
    }, [selectedTable]);

    const loadTables = async () => {
        try {
            const data = await Api.adminGetDatabaseTables();
            setTables(data);
            if (data.length > 0 && !selectedTable) {
                setSelectedTable(data[0]);
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to load tables');
        }
    };

    const loadRows = async (tableName: string) => {
        setLoading(true);
        try {
            const data = await Api.adminGetTableRows(tableName);
            setRows(data);
        } catch (err: any) {
            toast.error(err.message || 'Failed to load rows');
        } finally {
            setLoading(false);
        }
    };

    const filteredRows = rows.filter(row =>
        JSON.stringify(row).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Database className="text-blue-500" size={32} />
                        Database Explorer
                    </h1>
                    <p className="text-slate-400 mt-2">Direct access to raw database tables</p>
                </div>
                <button
                    onClick={() => selectedTable && loadRows(selectedTable)}
                    className="p-2 bg-navy-800 hover:bg-navy-700 rounded-lg text-slate-300 transition-colors"
                >
                    <RefreshCw size={20} />
                </button>
            </header>

            <div className="grid grid-cols-12 gap-6">
                {/* Sidebar: Table List */}
                <div className="col-span-3 bg-navy-900 border border-white/10 rounded-xl p-4 h-[calc(100vh-200px)] overflow-y-auto">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Table size={16} /> Tables ({tables.length})
                    </h2>
                    <div className="space-y-1">
                        {tables.map(table => (
                            <button
                                key={table}
                                onClick={() => setSelectedTable(table)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTable === table
                                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                        : 'text-slate-400 hover:bg-white/5'
                                    }`}
                            >
                                {table}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content: Data Table */}
                <div className="col-span-9 space-y-4">
                    <div className="flex items-center gap-4 bg-navy-900 border border-white/10 p-2 rounded-lg">
                        <Search className="text-slate-500 ml-2" size={20} />
                        <input
                            type="text"
                            placeholder="Search in current table..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent border-none text-white focus:ring-0 flex-1 placeholder:text-slate-600"
                        />
                    </div>

                    <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden shadow-xl">
                        {loading ? (
                            <div className="p-12 text-center text-slate-400">Loading data...</div>
                        ) : rows.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">No rows found in {selectedTable}</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-navy-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-white/10">
                                        <tr>
                                            {columns.map(col => (
                                                <th key={col} className="px-6 py-4 whitespace-nowrap">{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredRows.map((row, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                {columns.map(col => (
                                                    <td key={`${i}-${col}`} className="px-6 py-4 text-slate-300 whitespace-nowrap max-w-xs truncate">
                                                        {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="p-4 border-t border-white/10 text-xs text-slate-500 text-right">
                            Showing last {filteredRows.length} rows
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
