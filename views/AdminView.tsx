import React, { useState, useEffect } from 'react';
import { User, UserRole, Language } from '../types';

import { Api } from '../services/api';
import {
    Users,
    Search,
    MoreVertical,
    Plus,
    Trash2,
    Edit,
    Shield,
    TrendingUp,
    Activity,


    DollarSign,
    X,
    Check
} from 'lucide-react';

interface AdminViewProps {
    currentUser: User;
    onNavigate: (view: any) => void;
    language: Language;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser, onNavigate, language }) => {
    const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'USERS' | 'CODES'>('DASHBOARD');
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        companyName: '',
        role: UserRole.OTHER,
        status: 'active'
    });



    // ...

    // Refresh data on mount
    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const data = await Api.getUsers();
            setUsers(data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            await Api.deleteUser(id);
            loadUsers();
        }
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUser) {
                // Edit mode
                await Api.updateUser(editingUser.id, formData);
            } else {
                // Create mode
                await Api.addUser({
                    ...formData,
                    phone: '',
                    password: 'welcome123', // Default
                    accessLevel: 'full'
                });
            }
            // Reset and refresh
            setShowAddUserModal(false);
            setEditingUser(null);
            loadUsers();
            setFormData({
                firstName: '',
                lastName: '',
                email: '',
                companyName: '',
                role: UserRole.OTHER,
                status: 'active'
            });
        } catch (err: any) {
            alert(err.message);
        }
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormData({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            companyName: user.companyName,
            role: user.role || UserRole.OTHER,
            status: user.status || 'active'
        });
        setShowAddUserModal(true);
    };

    const openAddModal = () => {
        setEditingUser(null);
        setFormData({
            firstName: '',
            lastName: '',
            email: '',
            companyName: '',
            role: UserRole.OTHER,
            status: 'active'
        });
        setShowAddUserModal(true);
    };

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.lastName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleBadgeColor = (role?: string) => {
        if (role === UserRole.ADMIN) return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    };

    // --- SUB-COMPONENTS ---

    const StatsCard = ({ title, value, icon: Icon, color }: any) => (
        <div className="bg-navy-900 border border-white/5 rounded-xl p-6 flex items-center justify-between">
            <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-white">{value}</h3>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
                <Icon size={24} />
            </div>
        </div>
    );

    const renderDashboard = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    title="Total Users"
                    value={users.length}
                    icon={Users}
                    color="bg-blue-500/20 text-blue-400"
                />
                <StatsCard
                    title="Active Sessions"
                    value={users.filter(u => u.status === 'active').length}
                    icon={Activity}
                    color="bg-green-500/20 text-green-400"
                />
                <StatsCard
                    title="Est. Revenue"
                    value="$12.4k"
                    icon={DollarSign}
                    color="bg-purple-500/20 text-purple-400"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-navy-900 border border-white/5 rounded-xl p-6 h-64 flex flex-col justify-center items-center text-slate-500">
                    <TrendingUp size={48} className="mb-4 opacity-50" />
                    <p>Usage Analytics Graph (Coming Soon)</p>
                </div>
                <div className="bg-navy-900 border border-white/5 rounded-xl p-6">
                    <h3 className="text-white font-semibold mb-4">Recent Activity</h3>
                    <div className="space-y-4">
                        {users.slice(0, 3).map(user => (
                            <div key={user.id} className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 rounded-full bg-navy-800 flex items-center justify-center text-slate-400">
                                    {user.firstName[0]}{user.lastName[0]}
                                </div>
                                <div>
                                    <p className="text-white">{user.firstName} logged in</p>
                                    <p className="text-xs text-slate-500">{new Date(user.lastLogin || '').toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderUsers = () => (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none w-64"
                    />
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-purple-900/20"
                >
                    <Plus size={16} />
                    Add User
                </button>
            </div>

            <div className="bg-navy-900 border border-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-navy-950 text-slate-200 uppercase text-xs font-semibold">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Last Login</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-medium">
                                            {user.firstName[0]}
                                        </div>
                                        <div>
                                            <div className="text-white font-medium">{user.firstName} {user.lastName}</div>
                                            <div className="text-xs">{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs border ${getRoleBadgeColor(user.role)}`}>
                                        {user.role || 'USER'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        <span className="capitalize text-white">{user.status}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => openEditModal(user)}
                                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredUsers.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        No users found matching "{searchTerm}"
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-navy-950">
            {/* Admin Header */}
            <div className="h-20 border-b border-white/5 bg-navy-950 flex items-center justify-between px-8 shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Shield className="text-purple-500" />
                        Admin Panel
                    </h1>
                    <p className="text-xs text-slate-500">Manage users, licenses, and system settings</p>
                </div>

                <div className="flex bg-navy-900 p-1 rounded-lg border border-white/10">
                    <button
                        onClick={() => setActiveTab('DASHBOARD')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'DASHBOARD' ? 'bg-navy-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('USERS')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'USERS' ? 'bg-navy-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        User Management
                    </button>
                    <button
                        onClick={() => setActiveTab('CODES')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'CODES' ? 'bg-navy-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        Access Codes
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-8">
                {activeTab === 'DASHBOARD' && renderDashboard()}
                {activeTab === 'USERS' && renderUsers()}
                {activeTab === 'CODES' && (
                    <div className="flex items-center justify-center h-64 border border-dashed border-white/10 rounded-xl text-slate-500">
                        Access Code Management Module (Not Implemented in MVP)
                    </div>
                )}
            </div>


            {showAddUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">
                                {editingUser ? 'Edit User' : 'Add New User'}
                            </h2>
                            <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveUser} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">First Name</label>
                                    <input
                                        required
                                        value={formData.firstName}
                                        onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                        className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white text-sm focus:border-purple-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Last Name</label>
                                    <input
                                        required
                                        value={formData.lastName}
                                        onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                        className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white text-sm focus:border-purple-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-slate-400">Email</label>
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white text-sm focus:border-purple-500 outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-slate-400">Company</label>
                                <input
                                    required
                                    value={formData.companyName}
                                    onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                                    className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white text-sm focus:border-purple-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Role</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                                        className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white text-sm focus:border-purple-500 outline-none"
                                    >
                                        <option value={UserRole.OTHER}>User (Other)</option>
                                        <option value="ceo">CEO</option>
                                        <option value="manager">Manager</option>
                                        <option value={UserRole.ADMIN}>Admin</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white text-sm focus:border-purple-500 outline-none"
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold mt-4 flex items-center justify-center gap-2">
                                <Check size={18} />
                                {editingUser ? 'Save Changes' : 'Create User'}
                            </button>
                        </form>
                    </div>
                </div>
            )
            }
        </div >
    );
};
