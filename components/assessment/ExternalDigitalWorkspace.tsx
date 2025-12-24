/**
 * External Digital Assessment Workspace
 * Upload and manage SIRI, ADMA, CMMI assessments
 */

import React, { useState, useCallback } from 'react';
import { Upload, FileText, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

interface ExternalDigitalWorkspaceProps {
    projectId?: string;
    organizationId: string;
}

const FRAMEWORKS = [
    { id: 'SIRI', name: 'SIRI (Smart Industry Readiness Index)', color: 'blue' },
    { id: 'ADMA', name: 'ADMA (ASEAN Digital Masterplan)', color: 'purple' },
    { id: 'CMMI', name: 'CMMI (Capability Maturity Model)', color: 'green' },
    { id: 'DIGITAL_OTHER', name: 'Other Digital Framework', color: 'gray' }
];

export const ExternalDigitalWorkspace: React.FC<ExternalDigitalWorkspaceProps> = ({
    projectId,
    organizationId
}) => {
    const [selectedFramework, setSelectedFramework] = useState('SIRI');
    const [assessments, setAssessments] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [metadata, setMetadata] = useState({
        version: '',
        assessmentDate: ''
    });

    const fetchAssessments = useCallback(async () => {
        try {
            const response = await axios.get(`/api/external-assessments/organization/${organizationId}`);
            setAssessments(response.data.assessments || []);
        } catch (error) {
            console.error('Error fetching assessments:', error);
        }
    }, [organizationId]);

    React.useEffect(() => {
        fetchAssessments();
    }, [fetchAssessments]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        const file = acceptedFiles[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('frameworkType', selectedFramework);
        formData.append('frameworkVersion', metadata.version);
        formData.append('assessmentDate', metadata.assessmentDate);
        if (projectId) formData.append('projectId', projectId);

        setUploading(true);
        try {
            await axios.post('/api/external-assessments', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setMetadata({ version: '', assessmentDate: '' });
            fetchAssessments();
            alert('Assessment uploaded! Processing in background...');
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    }, [selectedFramework, metadata, projectId, fetchAssessments]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        maxSize: 10 * 1024 * 1024,
        multiple: false
    });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <Activity className="w-8 h-8 text-purple-500" />
                External Digital Assessments
            </h2>

            {/* Framework Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <h3 className="text-xl font-semibold mb-4">Select Framework</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {FRAMEWORKS.map(fw => (
                        <button
                            key={fw.id}
                            onClick={() => setSelectedFramework(fw.id)}
                            className={`p-4 rounded-lg border-2 transition-all ${selectedFramework === fw.id
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                }`}
                        >
                            <div className="font-semibold">{fw.id}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{fw.name.split('(')[1]?.replace(')', '') || fw.name}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Upload Area */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <h3 className="text-xl font-semibold mb-4">Upload Assessment Report</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                        type="text"
                        placeholder="Framework Version (e.g., SIRI 2.0)"
                        value={metadata.version}
                        onChange={e => setMetadata({ ...metadata, version: e.target.value })}
                        className="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                    <input
                        type="date"
                        value={metadata.assessmentDate}
                        onChange={e => setMetadata({ ...metadata, assessmentDate: e.target.value })}
                        className="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                </div>

                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragActive
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
                        }`}
                >
                    <input {...getInputProps()} />
                    <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Drop {selectedFramework} PDF here or click to select
                    </p>
                    <p className="text-sm text-gray-500">
                        AI will auto-extract scores and map to DRD framework
                    </p>
                </div>
            </div>

            {/* Assessments List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Uploaded Assessments</h3>

                {assessments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        No assessments uploaded yet
                    </div>
                ) : (
                    <div className="space-y-3">
                        {assessments.map(assessment => (
                            <div key={assessment.id} className="border dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-10 h-10 text-purple-500" />
                                        <div>
                                            <h4 className="font-semibold">{assessment.framework_type} {assessment.framework_version}</h4>
                                            <p className="text-sm text-gray-500">{assessment.file_name}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {assessment.processing_status === 'mapped' && (
                                            <>
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-500">Confidence</div>
                                                    <div className="font-semibold text-green-600">
                                                        {(assessment.mapping_confidence * 100).toFixed(0)}%
                                                    </div>
                                                </div>
                                                <CheckCircle className="w-6 h-6 text-green-500" />
                                            </>
                                        )}
                                        {assessment.processing_status === 'processing' && (
                                            <div className="flex items-center gap-2 text-yellow-600">
                                                <Activity className="w-5 h-5 animate-spin" />
                                                <span className="text-sm">Processing...</span>
                                            </div>
                                        )}
                                        {assessment.processing_status === 'error' && (
                                            <AlertTriangle className="w-6 h-6 text-red-500" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
