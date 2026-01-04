/**
 * StudioExportModal - Export diagram modal
 */

import { toPng, toSvg } from 'html-to-image';
import { Check, Download, FileCode, FileText, Image, Loader2, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';

interface StudioExportModalProps {
    documentId: string;
    documentName: string;
    onClose: () => void;
}

type ExportFormat = 'png' | 'svg' | 'json';

export const StudioExportModal: React.FC<StudioExportModalProps> = ({ documentId, documentName, onClose }) => {
    const [format, setFormat] = useState<ExportFormat>('png');
    const [exporting, setExporting] = useState(false);
    const [includeBackground, setIncludeBackground] = useState(true);
    const [quality, setQuality] = useState(2); // 1x, 2x, 3x

    const handleExport = useCallback(async () => {
        setExporting(true);

        try {
            // Get the React Flow viewport element
            const viewportElement = document.querySelector('.react-flow__viewport');
            if (!viewportElement) {
                throw new Error('Canvas not found');
            }

            const filename = `${documentName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`;

            if (format === 'png') {
                const dataUrl = await toPng(viewportElement as HTMLElement, {
                    backgroundColor: includeBackground ? '#020617' : 'transparent',
                    pixelRatio: quality,
                });

                // Download
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `${filename}.png`;
                link.click();

                toast.success('PNG exported');
            } else if (format === 'svg') {
                const dataUrl = await toSvg(viewportElement as HTMLElement, {
                    backgroundColor: includeBackground ? '#020617' : 'transparent',
                });

                // Download
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `${filename}.svg`;
                link.click();

                toast.success('SVG exported');
            } else if (format === 'json') {
                // Export nodes/edges as JSON
                // This would need access to the actual node/edge data
                toast.success('JSON export coming soon');
            }

            onClose();
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Export failed');
        } finally {
            setExporting(false);
        }
    }, [format, documentName, includeBackground, quality, onClose]);

    const formats: { id: ExportFormat; label: string; icon: React.ReactNode; description: string }[] = [
        { id: 'png', label: 'PNG Image', icon: <Image size={20} />, description: 'High-quality raster image' },
        { id: 'svg', label: 'SVG Vector', icon: <FileCode size={20} />, description: 'Scalable vector graphic' },
        { id: 'json', label: 'JSON Data', icon: <FileText size={20} />, description: 'Raw diagram data' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <Download size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Export Diagram</h2>
                            <p className="text-xs text-slate-500">Choose format and settings</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Format Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Format</label>
                        <div className="grid grid-cols-3 gap-2">
                            {formats.map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => setFormat(f.id)}
                                    className={`
                                        p-3 rounded-lg border-2 transition-all text-center
                                        ${
                                            format === f.id
                                                ? 'border-blue-500 bg-blue-500/10'
                                                : 'border-white/10 hover:border-white/20 bg-white/5'
                                        }
                                    `}
                                >
                                    <div
                                        className={`mx-auto mb-2 ${format === f.id ? 'text-blue-400' : 'text-slate-400'}`}
                                    >
                                        {f.icon}
                                    </div>
                                    <div
                                        className={`text-xs font-medium ${format === f.id ? 'text-white' : 'text-slate-400'}`}
                                    >
                                        {f.label}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* PNG/SVG Options */}
                    {(format === 'png' || format === 'svg') && (
                        <>
                            {/* Background */}
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-slate-400">Include background</label>
                                <button
                                    onClick={() => setIncludeBackground(!includeBackground)}
                                    className={`
                                        w-10 h-6 rounded-full transition-colors relative
                                        ${includeBackground ? 'bg-blue-500' : 'bg-slate-600'}
                                    `}
                                >
                                    <span
                                        className={`
                                        absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                                        ${includeBackground ? 'left-5' : 'left-1'}
                                    `}
                                    />
                                </button>
                            </div>

                            {/* Quality (PNG only) */}
                            {format === 'png' && (
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Quality</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3].map((q) => (
                                            <button
                                                key={q}
                                                onClick={() => setQuality(q)}
                                                className={`
                                                    flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                                                    ${
                                                        quality === q
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                                    }
                                                `}
                                            >
                                                {q}x
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {exporting ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <Download size={14} />
                                Export {format.toUpperCase()}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudioExportModal;

