import React, { useState } from 'react';
import { FullSession } from '../types';
import { Users, Briefcase, Plus, Trash2, UserPlus, Mail } from 'lucide-react';

interface RolloutTeamsTabProps {
    data: FullSession['rollout'];
    onUpdate: (data: FullSession['rollout']) => void;
}

export const RolloutTeamsTab: React.FC<RolloutTeamsTabProps> = ({ data, onUpdate }) => {

    // Default roles if none exist
    const defaultRoles = [
        { role: 'Program Sponsor', responsibilities: 'Budget approval, strategic alignment, conflict resolution.' },
        { role: 'Program Manager', responsibilities: 'Day-to-day execution, risk management, reporting.' },
        { role: 'PMO Lead', responsibilities: 'Standards, tools, reporting, administrative support.' },
        { role: 'Change Manager', responsibilities: 'Communication, training, stakeholder engagement.' }
    ];

    const roles = data?.governance?.roles && data.governance.roles.length > 0 ? data.governance.roles : defaultRoles;
    const workstreams = data?.governance?.workstreams || [];

    const handleUpdateRoles = (newRoles: any[]) => {
        onUpdate({
            ...data,
            governance: {
                ...data?.governance,
                roles: newRoles,
                workstreams: data?.governance?.workstreams || []
            }
        });
    };

    const handleUpdateWorkstreams = (newWorkstreams: any[]) => {
        onUpdate({
            ...data,
            governance: {
                ...data?.governance,
                roles: data?.governance?.roles || defaultRoles,
                workstreams: newWorkstreams
            }
        });
    };

    const addWorkstream = () => {
        const id = Date.now().toString();
        handleUpdateWorkstreams([...workstreams, { id, name: 'New Workstream', members: [] }]);
    };

    return (
        <div className="space-y-6">
            <div className="mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Users className="text-blue-500" />
                    Program Governance & Teams
                </h2>
                <p className="text-slate-500">Define the organizational structure, roles, and workstreams.</p>
            </div>

            {/* 1. Governance Roles */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-navy-800/50 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <Briefcase size={18} className="text-blue-400" /> Key Roles
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left hidden md:table">
                        <thead className="bg-slate-50 dark:bg-navy-950 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="p-4 w-1/4">Role</th>
                                <th className="p-4 w-1/4">Assigned To</th>
                                <th className="p-4 w-1/2">Responsibilities</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {roles.map((item, i) => (
                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                    <td className="p-4 font-medium text-slate-700 dark:text-slate-200">{item.role}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-slate-400 text-sm italic cursor-not-allowed">
                                            <UserPlus size={14} /> Assign Person
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-slate-500">{item.responsibilities}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {/* Mobile friendly list */}
                    <div className="md:hidden divide-y divide-slate-100 dark:divide-white/5">
                        {roles.map((item, i) => (
                            <div key={i} className="p-4">
                                <div className="font-bold text-slate-700 dark:text-slate-200">{item.role}</div>
                                <div className="text-xs text-slate-400 mt-1 mb-2">{item.responsibilities}</div>
                                <div className="text-sm text-blue-500 flex items-center gap-1"><UserPlus size={14} /> Unassigned</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. Workstreams */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/5 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <Users size={18} className="text-green-400" /> Workstreams
                    </h3>
                    <button
                        onClick={addWorkstream}
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                        <Plus size={16} /> Add Workstream
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workstreams.map((ws, i) => (
                        <div key={ws.id} className="border border-slate-200 dark:border-white/10 rounded-lg p-4 hover:border-blue-500/50 transition-colors bg-slate-50 dark:bg-navy-950">
                            <div className="flex justify-between items-start mb-3">
                                <input
                                    value={ws.name}
                                    onChange={(e) => {
                                        const updated = [...workstreams];
                                        updated[i].name = e.target.value;
                                        handleUpdateWorkstreams(updated);
                                    }}
                                    className="font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-full mr-2"
                                />
                                <button
                                    onClick={() => handleUpdateWorkstreams(workstreams.filter(x => x.id !== ws.id))}
                                    className="text-slate-400 hover:text-red-500"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="text-xs text-slate-500 uppercase font-semibold">Members</div>
                                {ws.members.length === 0 ? (
                                    <div className="text-sm text-slate-400 italic">No members assigned</div>
                                ) : (
                                    <div>{/* Member list */}</div>
                                )}
                                <button className="w-full py-2 border border-dashed border-slate-300 dark:border-white/20 rounded text-slate-500 hover:text-blue-500 hover:border-blue-500 text-xs font-bold transition-colors flex items-center justify-center gap-1">
                                    <Plus size={14} /> Add Member
                                </button>
                            </div>
                        </div>
                    ))}

                    {workstreams.length === 0 && (
                        <div className="col-span-full py-8 text-center text-slate-400 italic border border-dashed border-slate-200 dark:border-white/10 rounded-lg">
                            No workstreams defined. Click "Add Workstream" to start.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
