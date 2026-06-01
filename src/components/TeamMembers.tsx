import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Plus, X, Trash2, Shield, UserCog, UserCheck, Eye, Mail, Key, ChevronDown } from 'lucide-react';
import axios from 'axios';

interface TeamMember {
  id: string;
  adminId: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'agent' | 'viewer';
  isActive: boolean;
  createdAt: string;
  passwordHash?: string;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  admin: { label: 'Admin', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400', icon: Shield },
  manager: { label: 'Manager', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400', icon: UserCog },
  agent: { label: 'Agent', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400', icon: UserCheck },
  viewer: { label: 'Viewer', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400', icon: Eye },
};

export default function TeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'agent' as TeamMember['role'], password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [passwordModal, setPasswordModal] = useState<{ memberId: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await axios.get('/api/team');
      setMembers(res.data);
    } catch {
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    setError('');
    try {
      const body: any = { name: form.name, email: form.email, role: form.role };
      if (form.password) body.password = form.password;
      const res = await axios.post('/api/team', body);
      setMembers(prev => [...prev, res.data]);
      setShowModal(false);
      setForm({ name: '', email: '', role: 'agent', password: '' });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      await axios.delete(`/api/team/${memberId}`);
      setMembers(prev => prev.filter(m => m.id !== memberId));
      setConfirmDelete(null);
    } catch {
      setError('Failed to remove member');
    }
  };

  const handleSetPassword = async () => {
    if (!passwordModal || !newPassword || newPassword.length < 6) return;
    setPasswordSaving(true);
    setError('');
    try {
      await axios.post(`/api/team/${passwordModal.memberId}/set-password`, { password: newPassword });
      setPasswordModal(null);
      setNewPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to set password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleToggleActive = async (member: TeamMember) => {
    try {
      const res = await axios.patch(`/api/team/${member.id}`, { isActive: !member.isActive });
      setMembers(prev => prev.map(m => m.id === member.id ? res.data : m));
    } catch {
      setError('Failed to update member');
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-64 text-zinc-400 text-sm font-medium">Loading team members...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-500" /> Team Members
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage who has access to your dashboard</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowModal(true)}
          className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Member
        </motion.button>
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-500 text-sm font-bold bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 py-3 px-4 rounded-2xl mb-4"
        >
          {error}
        </motion.p>
      )}

      {members.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-12 text-center">
          <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-1">No team members yet</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Add your first team member to get started</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {['Name', 'Email', 'Role', 'Status', 'Password', ''].map(h => (
                  <th key={h} className="text-left px-5 py-4 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((member, i) => {
                const roleCfg = ROLE_CONFIG[member.role] || ROLE_CONFIG.viewer;
                const RoleIcon = roleCfg.icon;
                return (
                  <motion.tr
                    key={member.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${roleCfg.color}`}>
                          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-500 dark:text-zinc-400">{member.email}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold ${roleCfg.color}`}>
                        <RoleIcon className="w-3 h-3" />
                        {roleCfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggleActive(member)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                          member.isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${member.isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        {member.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setPasswordModal({ memberId: member.id, name: member.name })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-800 transition-colors"
                      >
                        <Key className="w-3 h-3" />
                        {member.passwordHash ? 'Reset' : 'Set'}
                      </motion.button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {confirmDelete === member.id ? (
                          <div className="flex items-center gap-1">
                            <motion.button
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              onClick={() => handleRemove(member.id)}
                              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-[10px] font-bold hover:bg-red-600 transition-colors"
                            >
                              Confirm
                            </motion.button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-lg text-[10px] font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setConfirmDelete(member.id)}
                            className="p-2 text-zinc-400 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Member Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-700"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Add Team Member</h3>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[2px] ml-1">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Ahmed Khan"
                    className="w-full mt-1 px-4 py-3 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[2px] ml-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="ahmed@example.com"
                    className="w-full mt-1 px-4 py-3 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[2px] ml-1">Password <span className="text-zinc-400 font-normal normal-case tracking-normal">(optional, min 6 chars)</span></label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Set initial password"
                    className="w-full mt-1 px-4 py-3 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[2px] ml-1">Role</label>
                  <div className="relative mt-1">
                    <select
                      value={form.role}
                      onChange={e => setForm(prev => ({ ...prev, role: e.target.value as TeamMember['role'] }))}
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 appearance-none"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="agent">Agent</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAdd}
                  disabled={saving || !form.name.trim() || !form.email.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? 'Adding...' : 'Add Member'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Set Password Modal */}
      <AnimatePresence>
        {passwordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-700"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Set Password</h3>
                <button onClick={() => { setPasswordModal(null); setNewPassword(''); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 font-medium">
                Set or reset password for <strong className="text-zinc-800 dark:text-zinc-200">{passwordModal.name}</strong>
              </p>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[2px] ml-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full mt-1 px-4 py-3 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-violet-400 rounded-xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setPasswordModal(null); setNewPassword(''); }}
                  className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSetPassword}
                  disabled={passwordSaving || newPassword.length < 6}
                  className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-violet-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {passwordSaving ? 'Saving...' : 'Set Password'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
