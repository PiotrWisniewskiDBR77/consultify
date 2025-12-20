import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { File, Trash2, Folder, X, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface StorageModalProps {
    orgId: string;
    orgName: string;
    onClose: () => void;
    onUpdate: () => void;
}

export const SuperAdminStorageDetailModal: React.FC<StorageModalProps> = ({ orgId, orgName, onClose, onUpdate }) => {
    const [files, setFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadFiles();
    }, [orgId]);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const data = await Api.adminGetOrgFiles(orgId);
            setFiles(data);
        } catch (err: any) {
            toast.error(err.message || 'Failed to load files');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (path: string) => {
        if (!confirm(`Are you sure you want to delete "${path}"? \nThis cannot be undone.`)) return;

        try {
            await Api.adminDeleteFile(orgId, path);
            toast.success('File deleted');
            loadFiles();
            onUpdate(); // Trigger parent refresh to update totals
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete file');
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const filteredFiles = files.filter(f => (f.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-navy-900 border border-white/10 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Folder className="text-pink-500" />
                            File Browser: {orgName}
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">{files.length} files found</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 border-b border-white/10 bg-navy-950">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search files..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-pink-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-0">
                    {loading ? (
                        <div className="p-10 text-center text-slate-500">Scanning directory...</div>
                    ) : filteredFiles.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">
                            {searchTerm ? 'No matching files found' : 'No files stored for this organization'}
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-navy-950 text-slate-400 text-xs uppercase sticky top-0">
                                <tr>
                                    <th className="p-4">File Name</th>
                                    <th className="p-4">Path (Relative)</th>
                                    <th className="p-4">Size</th>
                                    <th className="p-4">Date</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                {filteredFiles.map((file) => (
                                    <tr key={file.path} className="hover:bg-white/5">
                                        <td className="p-4 font-medium text-white flex items-center gap-2">
                                            <File size={16} className="text-blue-400" />
                                            {file.name}
                                        </td>
                                        <td className="p-4 text-slate-400 font-mono text-xs">{file.path}</td>
                                        <td className="p-4 text-slate-300 whitespace-nowrap">{formatBytes(file.size)}</td>
                                        <td className="p-4 text-slate-500 whitespace-nowrap">
                                            {new Date(file.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleDelete(file.path)}
                                                className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-colors"
                                                title="Permanently Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
