import React, { useState, useEffect } from 'react';
import { ReportBlock } from '../../../types';
import { Plus, Trash2, GripVertical, MoreHorizontal } from 'lucide-react';

interface TableBlockProps {
    block: ReportBlock;
    onUpdate: (updates: Partial<ReportBlock>) => void;
}

export const TableBlock: React.FC<TableBlockProps> = ({ block, onUpdate }) => {
    const [headers, setHeaders] = useState<string[]>(block.content?.headers || ['Column 1', 'Column 2']);
    const [rows, setRows] = useState<string[][]>(block.content?.rows || [['Data 1', 'Data 2']]);

    useEffect(() => {
        const newHeaders = block.content?.headers || ['Column 1', 'Column 2'];
        const newRows = block.content?.rows || [['Data 1', 'Data 2']];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (JSON.stringify(newHeaders) !== JSON.stringify(headers)) setHeaders(newHeaders);
        if (JSON.stringify(newRows) !== JSON.stringify(rows)) setRows(newRows);
    }, [block.content]);

    const save = (newHeaders: string[], newRows: string[][]) => {
        onUpdate({ content: { ...block.content, headers: newHeaders, rows: newRows } });
    };

    const updateHeader = (index: number, value: string) => {
        const newHeaders = [...headers];
        newHeaders[index] = value;
        setHeaders(newHeaders);
        save(newHeaders, rows);
    };

    const updateCell = (rowIndex: number, colIndex: number, value: string) => {
        const newRows = [...rows];
        newRows[rowIndex] = [...newRows[rowIndex]];
        newRows[rowIndex][colIndex] = value;
        setRows(newRows);
        save(headers, newRows);
    };

    const addRow = () => {
        const newRow = new Array(headers.length).fill('');
        const newRows = [...rows, newRow];
        setRows(newRows);
        save(headers, newRows);
    };

    const addColumn = () => {
        const newHeaders = [...headers, `Col ${headers.length + 1}`];
        const newRows = rows.map(r => [...r, '']);
        setHeaders(newHeaders);
        setRows(newRows);
        save(newHeaders, newRows);
    };

    const deleteRow = (index: number) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
        save(headers, newRows);
    };

    const deleteColumn = (index: number) => {
        const newHeaders = headers.filter((_, i) => i !== index);
        const newRows = rows.map(r => r.filter((_, i) => i !== index));
        setHeaders(newHeaders);
        setRows(newRows);
        save(newHeaders, newRows);
    };

    if (block.locked) {
        return (
            <div className="overflow-x-auto p-4">
                <table className="w-full border-collapse text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-white/10">
                            {headers.map((h, i) => (
                                <th key={i} className="py-2 px-3 font-bold text-slate-700 dark:text-slate-200">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rI) => (
                            <tr key={rI} className="border-b border-slate-100 dark:border-white/5 last:border-0">
                                {row.map((cell, cI) => (
                                    <td key={cI} className="py-2 px-3 text-slate-600 dark:text-slate-300">{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="p-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10">
                        {headers.map((h, i) => (
                            <th key={i} className="p-1 min-w-[120px] relative group">
                                <input
                                    className="w-full bg-slate-50 dark:bg-navy-900 border border-transparent hover:border-slate-300 rounded px-2 py-1 font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                                    value={h}
                                    onChange={(e) => updateHeader(i, e.target.value)}
                                />
                                <button
                                    onClick={() => deleteColumn(i)}
                                    className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 bg-red-100 text-red-500 rounded-full p-0.5 hover:bg-red-200"
                                    title="Delete Column"
                                >
                                    <Trash2 size={10} />
                                </button>
                            </th>
                        ))}
                        <th className="w-8">
                            <button onClick={addColumn} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                                <Plus size={14} />
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rI) => (
                        <tr key={rI} className="border-b border-slate-100 dark:border-white/5 last:border-0 group">
                            {row.map((cell, cI) => (
                                <td key={cI} className="p-1">
                                    <input
                                        className="w-full bg-transparent border border-transparent hover:border-slate-200 rounded px-2 py-1 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-navy-950"
                                        value={cell}
                                        onChange={(e) => updateCell(rI, cI, e.target.value)}
                                    />
                                </td>
                            ))}
                            <td className="w-8 text-center">
                                <button
                                    onClick={() => deleteRow(rI)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan={headers.length + 1} className="pt-2">
                            <button onClick={addRow} className="text-xs flex items-center gap-1 text-blue-500 hover:text-blue-600 font-medium">
                                <Plus size={12} /> Add Row
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};
