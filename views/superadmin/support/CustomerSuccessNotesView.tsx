/**
 * Customer Success Notes View
 */

import { FileText, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

export const CustomerSuccessNotesView: React.FC = () => {
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [notes, setNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchOrganizations();
    }, []);

    useEffect(() => {
        if (selectedOrgId) {
            fetchNotes();
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

    const fetchNotes = async () => {
        if (!selectedOrgId) return;
        setLoading(true);
        try {
            const data = await Api.getCustomerSuccessNotes(selectedOrgId);
            setNotes(data);
        } catch (err) {
            toast.error('Failed to fetch notes');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Customer Success Notes</h2>
                    <p className="text-slate-400 text-sm mt-1">Track customer interactions and success metrics</p>
                </div>
                <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="bg-navy-800 border border-slate-700 text-white px-4 py-2 rounded-lg"
                >
                    <option value="">Select Organization</option>
                    {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                            {org.name}
                        </option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading...</div>
            ) : (
                <div className="space-y-4">
                    {notes.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">No notes found</div>
                    ) : (
                        notes.map((note) => (
                            <div key={note.id} className="bg-navy-800 rounded-xl border border-slate-700 p-6">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-white font-semibold">{note.title}</h3>
                                        <p className="text-sm text-slate-400 mt-1">{note.note_type || 'General'}</p>
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {new Date(note.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-slate-300">{note.content}</p>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};





