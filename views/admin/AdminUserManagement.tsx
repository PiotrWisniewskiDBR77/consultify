import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../../types';
import { Api } from '../../services/api';
import { useUserCan } from '../../hooks/useUserCan';
import { Search, Plus, Trash2, Edit, X, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { InfoButton } from '../../components/shared/InfoButton';

interface AdminUserManagementProps {
    initialUsers?: User[];
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ initialUsers }) => {
    const { canDelete, canEdit } = useUserCan();
    const [users, setUsers] = useState<User[]>(initialUsers || []);
    const [userPlans, setUserPlans] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', email: '', role: UserRole.OTHER, status: 'active', licensePlanId: ''
    });

    const loadUsers = useCallback(async () => {
        try {
            const data = await Api.getUsers();
            setUsers(data);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load users');
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            if (!initialUsers) {
                await loadUsers();
            }
            try {
                const plans = await Api.getUserPlans();
                setUserPlans(plans);
            } catch (e) {
                console.error('Failed to load user plans', e);
            }
        };
        init();
    }, [initialUsers, loadUsers]);

    const handleDeleteUser = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await Api.deleteUser(id);
            toast.success('User deleted');
            loadUsers();
        } catch (e) {
            toast.error('Failed to delete user');
        }
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
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: (user.role as UserRole) || UserRole.OTHER,
            status: user.status || 'active',
            licensePlanId: user.licensePlanId || ''
        });
        setShowAddUserModal(true);
    };

    const openAddModal = () => {
        setEditingUser(null);
        setFormData({ firstName: '', lastName: '', email: '', role: UserRole.OTHER, status: 'active', licensePlanId: '' });
        setShowAddUserModal(true);
    };

    const filteredUsers = users.filter(u =>
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.firstName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleBadgeColor = (role?: string) => {
        if (role === 'SUPERADMIN') return 'bg-red-500/20 text-red-400';
        if (role === UserRole.ADMIN) return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    };

    return (
        <div className="space-y-4 relative">
            <InfoButton cardId="admin-users" position="top-right" />
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
                            <th className="px-6 py-4">License</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    No users found
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-medium">
                                                {user.firstName?.[0] || '?'}
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
                                        <span className="text-xs text-slate-400">
                                            {userPlans.find(p => p.id === user.licensePlanId)?.name || 'Standard'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`flex items-center gap-1.5 ${user.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                                            {user.status === 'active' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                            {user.status || 'active'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {canEdit && (
                                                <button 
                                                    onClick={() => openEditModal(user)} 
                                                    className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button 
                                                    onClick={() => handleDeleteUser(user.id)} 
                                                    className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit User Modal */}
            {showAddUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-8 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">{editingUser ? 'Edit User' : 'Add New User'}</h2>
                            <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveUser} className="space-y-4">
                            <input 
                                required 
                                placeholder="First Name" 
                                value={formData.firstName} 
                                onChange={e => setFormData({ ...formData, firstName: e.target.value })} 
                                className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" 
                            />
                            <input 
                                required 
                                placeholder="Last Name" 
                                value={formData.lastName} 
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })} 
                                className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" 
                            />
                            <input 
                                required 
                                type="email"
                                placeholder="Email" 
                                value={formData.email} 
                                onChange={e => setFormData({ ...formData, email: e.target.value })} 
                                className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" 
                            />
                            <select 
                                value={formData.role} 
                                onChange={e => setFormData({ ...formData, role: e.target.value as any })} 
                                className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white"
                            >
                                <option value="USER">User</option>
                                <option value="MANAGER">Manager</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                            <select 
                                value={formData.licensePlanId} 
                                onChange={e => setFormData({ ...formData, licensePlanId: e.target.value })} 
                                className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white"
                            >
                                <option value="">Select License...</option>
                                {userPlans.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} (${p.price_monthly})</option>
                                ))}
                            </select>
                            <button 
                                type="submit" 
                                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold mt-4"
                            >
                                Save
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUserManagement;

