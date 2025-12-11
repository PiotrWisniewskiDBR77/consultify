import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { User, UserRole, Language, AppView } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import {
    Users, Search, Layers, Plus, Trash2, Edit, Shield, TrendingUp, Activity,
    DollarSign, X, Check, Briefcase
} from 'lucide-react';
import { AdminLLMView } from './AdminLLMView';
import { AdminKnowledgeView } from './AdminKnowledgeView';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { toast } from 'react-hot-toast';

interface AdminViewProps {
    currentUser: User;
    onNavigate: (view: any) => void;
    language: Language;
}

interface Project {
    id: string;
    name: string;
    status: string;
    owner_first_name?: string;
    owner_last_name?: string;
    created_at: string;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser, onNavigate, language }) => {
    const { currentView } = useAppStore();
    // const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'USERS' | 'PROJECTS'>('DASHBOARD'); // Removed internal state
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [showAddProjectModal, setShowAddProjectModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    // User Form State
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', email: '', role: UserRole.OTHER, status: 'active'
    });

    useEffect(() => {
        loadUsers();
        loadProjects();
    }, []);

    const loadUsers = async () => {
        try {
            const data = await Api.getUsers();
            setUsers(data);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load users');
        }
    };

    const loadProjects = async () => {
        try {
            const data = await Api.getProjects();
            setProjects(data);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load projects');
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            try {
                await Api.deleteUser(id);
                toast.success('User deleted');
                loadUsers();
            } catch (e) { toast.error('Failed to delete user'); }
        }
    };

    const handleDeleteProject = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this project?')) {
            try {
                await Api.deleteProject(id);
                toast.success('Project deleted');
                loadProjects();
            } catch (e) { toast.error('Failed to delete project'); }
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await Api.createProject({ name: newProjectName });
            toast.success('Project created');
            setNewProjectName('');
            setShowAddProjectModal(false);
            loadProjects();
        } catch (e) { toast.error('Failed to create project'); }
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await Api.updateUser(editingUser.id, formData);
                toast.success('User updated');
            } else {
                await Api.addUser({ ...formData, password: 'welcome123' });
                toast.success('User created');
            }
            setShowAddUserModal(false);
            setEditingUser(null);
            loadUsers();
        } catch (err: any) {
            toast.error(err.message || 'Error saving user');
        }
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormData({
            firstName: user.firstName, lastName: user.lastName, email: user.email,
            role: (user.role as UserRole) || UserRole.OTHER, status: user.status || 'active'
        });
        setShowAddUserModal(true);
    };

    const openAddModal = () => {
        setEditingUser(null);
        setFormData({ firstName: '', lastName: '', email: '', role: UserRole.OTHER, status: 'active' });
        setShowAddUserModal(true);
    };

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.lastName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleBadgeColor = (role?: string) => {
        if (role === UserRole.ADMIN) return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    };

    // --- RENDERERS ---

    const renderDashboard = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-navy-900 border border-white/5 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Users</p>
                        <h3 className="text-2xl font-bold text-white">{users.length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-500/20 text-blue-400"><Users size={24} /></div>
                </div>
                <div className="bg-navy-900 border border-white/5 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Active Projects</p>
                        <h3 className="text-2xl font-bold text-white">{projects.length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-500/20 text-green-400"><Briefcase size={24} /></div>
                </div>
                <div className="bg-navy-900 border border-white/5 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Est. Revenue</p>
                        <h3 className="text-2xl font-bold text-white">$0.00</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-500/20 text-purple-400"><DollarSign size={24} /></div>
                </div>
            </div>
        </div>
    );

    const renderProjects = () => (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-white">Active Projects</h2>
                <button
                    onClick={() => setShowAddProjectModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    <Plus size={16} /> New Project
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(p => (
                    <div key={p.id} className="bg-navy-900 border border-white/5 rounded-xl p-6 hover:bg-navy-800 transition-colors group relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <Layers size={20} />
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleDeleteProject(p.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={16} /></button>
                            </div>
                        </div>
                        <h3 className="font-semibold text-white mb-1">{p.name}</h3>
                        <p className="text-xs text-slate-400 mb-4">Owner: {p.owner_first_name || 'Unknown'} {p.owner_last_name || ''}</p>
                        <div className="flex justify-between items-center text-xs">
                            <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded capitalize">{p.status}</span>
                            <span className="text-slate-600">{new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                ))}
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
                    <Plus size={16} /> Add User
                </button>
            </div>

            <div className="bg-navy-900 border border-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-navy-950 text-slate-200 uppercase text-xs font-semibold">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Status</th>
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
                                    <span className={`capitalize ${user.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>{user.status}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => openEditModal(user)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"><Edit size={16} /></button>
                                        <button onClick={() => handleDeleteUser(user.id)} className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-navy-950">
            {/* Admin Header */}
            <div className="h-14 border-b border-white/5 bg-navy-950 flex items-center justify-between px-6 shrink-0">
                <div>
                    <h1 className="text-sm font-bold text-white flex items-center gap-2">
                        <Shield className="text-purple-500" size={18} />
                        Admin Panel: {currentUser.companyName}
                    </h1>
                </div>

            </div>

            <div className="flex-1 overflow-auto p-6">
                {currentView === AppView.ADMIN_DASHBOARD && renderDashboard()}
                {currentView === AppView.ADMIN_USERS && renderUsers()}
                {currentView === AppView.ADMIN_PROJECTS && renderProjects()}
                {currentView === AppView.ADMIN_LLM && <AdminLLMView />}
                {currentView === AppView.ADMIN_KNOWLEDGE && <AdminKnowledgeView />}
                {currentView === AppView.ADMIN_ANALYTICS && <AdminAnalyticsView />}
            </div>

            {/* Add User Modal */}
            {showAddUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-8 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">{editingUser ? 'Edit User' : 'Add New User'}</h2>
                            <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveUser} className="space-y-4">
                            <input required placeholder="First Name" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" />
                            <input required placeholder="Last Name" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" />
                            <input required placeholder="Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" />
                            <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as any })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white">
                                <option value="USER">User</option>
                                <option value="MANAGER">Manager</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                            <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold mt-4">Save</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Project Modal */}
            {showAddProjectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-8 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Create New Project</h2>
                            <button onClick={() => setShowAddProjectModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Project Name (e.g. "Digital Transformation 2025")</label>
                                <input required value={newProjectName} onChange={e => setNewProjectName(e.target.value)} className="w-full bg-navy-950 border border-white/10 rounded p-3 text-white focus:border-purple-500 outline-none" placeholder="Enter project name..." />
                            </div>
                            <button type="submit" className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold mt-4">Create Project</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
