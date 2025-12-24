/**
 * Generic Reports Upload Workspace
 * Drag-and-drop file upload for ISO audits, consulting reports, compliance docs
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileText, Search, Filter, Download, Trash2, Link as LinkIcon, Calendar, User } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

interface GenericReportsWorkspaceProps {
    projectId?: string;
    organizationId: string;
}

interface Report {
    id: string;
    title: string;
    report_type: string;
    consultant_name?: string;
    report_date?: string;
    file_name: string;
    file_size: number;
    processing_status: string;
    ai_summary?: string;
    tags_json: string[];
    uploaded_at: string;
}

export const GenericReportsWorkspace: React.FC<GenericReportsWorkspaceProps> = ({
    projectId,
    organizationId
}) => {
    const { t } = useTranslation();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [uploadMetadata, setUploadMetadata] = useState({
        title: '',
        reportType: 'OTHER',
        consultantName: '',
        reportDate: '',
        tags: ''
    });

    // Fetch reports
    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/generic-reports/organization/${organizationId}`, {
                params: { search: searchQuery, type: filterType }
            });
            setReports(response.data.reports || []);
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    }, [organizationId, searchQuery, filterType]);

    React.useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // Drag-and-drop upload
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        const file = acceptedFiles[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('reportType', uploadMetadata.reportType);
        formData.append('title', uploadMetadata.title || file.name);
        formData.append('consultantName', uploadMetadata.consultantName);
        formData.append('reportDate', uploadMetadata.reportDate);
        formData.append('tags', uploadMetadata.tags);
        if (projectId) formData.append('projectId', projectId);

        setLoading(true);
        try {
            const response = await axios.post('/api/generic-reports', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Reset form
            setUploadMetadata({
                title: '',
                reportType: 'OTHER',
                consultantName: '',
                reportDate: '',
                tags: ''
            });

            // Refresh list
            fetchReports();
            alert('Report uploaded successfully!');
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [uploadMetadata, projectId, fetchReports]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/msword': ['.doc'],
            'application/vnd.ms-excel': ['.xls']
        },
        maxSize: 10 * 1024 * 1024, // 10MB
        multiple: false
    });

    const handleDelete = async (reportId: string) => {
        if (!confirm('Delete this report?')) return;

        try {
            await axios.delete(`/api/generic-reports/${reportId}`);
            fetchReports();
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    const filteredReports = reports.filter(report => {
        const matchesSearch = report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            report.consultant_name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'ALL' || report.report_type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <FileText className="w-8 h-8 text-blue-500" />
                Generic Assessment Reports
            </h2>

            {/* Upload Area */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <h3 className="text-xl font-semibold mb-4">Upload New Report</h3>

                {/* Metadata Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                        type="text"
                        placeholder="Report Title (optional)"
                        value={uploadMetadata.title}
                        onChange={e => setUploadMetadata({ ...uploadMetadata, title: e.target.value })}
                        className="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                    <select
                        value={uploadMetadata.reportType}
                        onChange={e => setUploadMetadata({ ...uploadMetadata, reportType: e.target.value })}
                        className="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    >
                        <option value="OTHER">Other</option>
                        <option value="ISO_AUDIT">ISO Audit</option>
                        <option value="CONSULTING">Consulting Report</option>
                        <option value="COMPLIANCE">Compliance Report</option>
                        <option value="LEAN">Lean Assessment</option>
                    </select>
                    <input
                        type="text"
                        placeholder="Consultant Name (optional)"
                        value={uploadMetadata.consultantName}
                        onChange={e => setUploadMetadata({ ...uploadMetadata, consultantName: e.target.value })}
                        className="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                    <input
                        type="date"
                        value={uploadMetadata.reportDate}
                        onChange={e => setUploadMetadata({ ...uploadMetadata, reportDate: e.target.value })}
                        className="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                </div>

                {/* Drag-and-Drop Zone */}
                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragActive
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                >
                    <input {...getInputProps()} />
                    <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    {isDragActive ? (
                        <p className="text-lg text-blue-500">Drop the file here...</p>
                    ) : (
                        <>
                            <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Drag & drop file here, or click to select
                            </p>
                            <p className="text-sm text-gray-500">
                                Supports: PDF, Word (.docx, .doc), Excel (.xlsx, .xls) • Max 10MB
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* Search & Filter */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-6 flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search reports..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                </div>
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                    <option value="ALL">All Types</option>
                    <option value="ISO_AUDIT">ISO Audit</option>
                    <option value="CONSULTING">Consulting</option>
                    <option value="COMPLIANCE">Compliance</option>
                    <option value="LEAN">Lean</option>
                    <option value="OTHER">Other</option>
                </select>
            </div>

            {/* Reports List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full text-center py-12">
                        <p className="text-gray-500">Loading...</p>
                    </div>
                ) : filteredReports.length === 0 ? (
                    <div className="col-span-full text-center py-12">
                        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500">No reports found</p>
                    </div>
                ) : (
                    filteredReports.map(report => (
                        <div
                            key={report.id}
                            className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow cursor-pointer"
                            onClick={() => setSelectedReport(report)}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <FileText className="w-10 h-10 text-blue-500 flex-shrink-0" />
                                <span className={`px-2 py-1 text-xs rounded ${report.processing_status === 'completed' ? 'bg-green-100 text-green-700' :
                                        report.processing_status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                    }`}>
                                    {report.processing_status}
                                </span>
                            </div>

                            <h4 className="font-semibold text-gray-800 dark:text-white mb-2 line-clamp-2">
                                {report.title}
                            </h4>

                            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                {report.consultant_name && (
                                    <p className="flex items-center gap-1">
                                        <User className="w-3 h-3" /> {report.consultant_name}
                                    </p>
                                )}
                                {report.report_date && (
                                    <p className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> {new Date(report.report_date).toLocaleDateString()}
                                    </p>
                                )}
                                <p className="text-xs text-gray-500">
                                    {(report.file_size / 1024).toFixed(0)} KB • {report.report_type}
                                </p>
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        handleDelete(report.id);
                                    }}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Report Detail Modal */}
            {selectedReport && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={() => setSelectedReport(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-blue-500 text-white p-6">
                            <h3 className="text-2xl font-bold">{selectedReport.title}</h3>
                            <p className="text-blue-100 mt-2">{selectedReport.file_name}</p>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                            {selectedReport.ai_summary && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 mb-4">
                                    <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">
                                        📄 AI Summary
                                    </h4>
                                    <p className="text-gray-700 dark:text-gray-300">
                                        {selectedReport.ai_summary}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="text-sm text-gray-500">Type</label>
                                    <p className="font-medium">{selectedReport.report_type}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">Uploaded</label>
                                    <p className="font-medium">{new Date(selectedReport.uploaded_at).toLocaleString()}</p>
                                </div>
                            </div>

                            {selectedReport.tags_json && selectedReport.tags_json.length > 0 && (
                                <div className="mb-4">
                                    <label className="text-sm text-gray-500">Tags</label>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {selectedReport.tags_json.map((tag, index) => (
                                            <span key={index} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="border-t dark:border-gray-700 p-4 flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedReport(null)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
