"use client";

import { useState } from 'react';
import { Search, Edit, Calendar, User, X, Check, SearchIcon, Clock } from 'lucide-react';
import { updateUserRole, updateUserSubscription } from '@/actions/admin-actions';
import { useRouter } from 'next/navigation';

export default function AdminUserTable({ initialUsers }: { initialUsers: any[] }) {
    const [users, setUsers] = useState(initialUsers);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Modal state
    const [editRole, setEditRole] = useState('');
    const [editExpiry, setEditExpiry] = useState('');
    
    const router = useRouter();

    const filteredUsers = users.filter((u: any) => {
        const term = searchTerm.toLowerCase();
        return (u.full_name?.toLowerCase().includes(term)) ||
               (u.email?.toLowerCase().includes(term)) ||
               (u.telegram_username?.toLowerCase().includes(term));
    });

    const openEditModal = (user: any) => {
        setEditingUser(user);
        setEditRole(user.role || 'client');
        
        if (user.subscription_expires_at) {
            // Format to YYYY-MM-DD
            const d = new Date(user.subscription_expires_at);
            setEditExpiry(d.toISOString().split('T')[0]);
        } else {
            setEditExpiry('');
        }
    };

    const handleSave = async () => {
        if (!editingUser) return;
        setIsSaving(true);
        try {
            if (editRole !== editingUser.role) {
                await updateUserRole(editingUser.id, editRole);
            }
            
            // Format expiry
            const newExpiry = editExpiry ? new Date(editExpiry).toISOString() : null;
            await updateUserSubscription(editingUser.id, newExpiry);
            
            // Optimistic update
            setUsers(prev => prev.map(u => {
                if (u.id === editingUser.id) {
                    return { ...u, role: editRole, subscription_expires_at: newExpiry };
                }
                return u;
            }));
            
            setEditingUser(null);
            router.refresh();
        } catch (error) {
            console.error('Failed to save user:', error);
            alert("Ошибка при сохранении пользователя.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full">
            {/* Search Bar */}
            <div className="flex items-center gap-3 mb-6 bg-white p-3 rounded-[1.5rem] border border-brand-sage/40 shadow-sm">
                <SearchIcon size={20} className="text-brand-gray ml-2" />
                <input 
                    type="text" 
                    placeholder="Search by name, email or @username..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-brand-text placeholder-brand-gray/50"
                />
                <div className="text-xs font-bold text-brand-gray/50 mr-3">{filteredUsers.length} users</div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[1.5rem] border border-brand-sage/40 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-brand-sage/5">
                                <th className="text-[10px] font-bold text-brand-gray uppercase tracking-wider p-4 pl-6">User</th>
                                <th className="text-[10px] font-bold text-brand-gray uppercase tracking-wider p-4">Role</th>
                                <th className="text-[10px] font-bold text-brand-gray uppercase tracking-wider p-4">Subscription Expires</th>
                                <th className="text-[10px] font-bold text-brand-gray uppercase tracking-wider p-4">Balance</th>
                                <th className="text-[10px] font-bold text-brand-gray uppercase tracking-wider p-4 pr-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((u: any) => {
                                const isActive = u.subscription_expires_at && new Date(u.subscription_expires_at) > new Date();
                                return (
                                    <tr key={u.id} className="border-b border-brand-sage/10 last:border-0 hover:bg-[#FAFAFA] transition-colors">
                                        <td className="p-4 pl-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-brand-sage/20 border-2 border-white shadow-sm flex items-center justify-center text-brand-leaf font-bold">
                                                    {u.full_name?.charAt(0) || u.email?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-brand-text truncate max-w-[200px]">{u.full_name || 'No Name'}</div>
                                                    <div className="text-xs text-brand-gray flex items-center gap-2">
                                                        <span className="truncate max-w-[150px]">{u.email}</span>
                                                        {u.telegram_username && (
                                                            <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-medium">@{u.telegram_username}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                                                u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                u.role === 'specialist' ? 'bg-blue-100 text-blue-700' :
                                                u.role === 'PRO' ? 'bg-brand-leaf/10 text-brand-leaf' :
                                                'bg-slate-100 text-slate-500'
                                            }`}>
                                                {u.role?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {u.subscription_expires_at ? (
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-400'}`}></div>
                                                    <span className={`text-xs font-semibold ${isActive ? 'text-brand-text' : 'text-brand-gray line-through'}`}>
                                                        {new Date(u.subscription_expires_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-brand-gray/50 italic">None</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs font-bold text-brand-text">{Number(u.balance || 0).toFixed(0)} ₽</span>
                                        </td>
                                        <td className="p-4 pr-6 text-right">
                                            <button 
                                                onClick={() => openEditModal(u)}
                                                className="p-2 text-brand-gray hover:text-brand-leaf hover:bg-brand-sage/20 rounded-xl transition-colors"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-brand-gray text-sm">
                                        No users found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-md p-6 shadow-2xl animate-fade-in relative">
                        <button 
                            onClick={() => setEditingUser(null)}
                            className="absolute top-6 right-6 text-brand-gray hover:text-brand-text transition-colors"
                        >
                            <X size={20} />
                        </button>
                        
                        <h2 className="font-serif text-2xl text-brand-text mb-2">Edit User</h2>
                        <p className="text-sm text-brand-gray mb-6">Updating {editingUser.email}</p>
                        
                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-1.5">Role</label>
                                <select 
                                    value={editRole} 
                                    onChange={(e) => setEditRole(e.target.value)}
                                    className="w-full bg-[#FAFAFA] border border-brand-sage/40 rounded-xl p-3 text-sm text-brand-text outline-none focus:border-brand-leaf transition-colors"
                                >
                                    <option value="client">Client</option>
                                    <option value="PRO">PRO</option>
                                    <option value="specialist">Specialist</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-1.5">Subscription Expiry</label>
                                <input 
                                    type="date"
                                    value={editExpiry}
                                    onChange={(e) => setEditExpiry(e.target.value)}
                                    className="w-full bg-[#FAFAFA] border border-brand-sage/40 rounded-xl p-3 text-sm text-brand-text outline-none focus:border-brand-leaf transition-colors"
                                />
                                <div className="flex gap-2 mt-2">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            const d = new Date();
                                            d.setDate(d.getDate() + 30);
                                            setEditExpiry(d.toISOString().split('T')[0]);
                                        }}
                                        className="text-[10px] font-bold text-brand-leaf bg-brand-leaf/10 px-2 py-1 rounded"
                                    >
                                        +30 Days
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setEditExpiry('')}
                                        className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-3 justify-end">
                            <button 
                                onClick={() => setEditingUser(null)}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold text-brand-gray hover:bg-slate-50 transition-colors border border-transparent"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-leaf hover:bg-brand-leaf-light transition-colors shadow-lg shadow-brand-leaf/20 flex items-center gap-2"
                            >
                                {isSaving ? 'Saving...' : <><Check size={16} /> Save Changes</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
