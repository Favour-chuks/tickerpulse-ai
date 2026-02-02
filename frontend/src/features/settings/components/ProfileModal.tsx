
import React, { useState } from 'react';
import { X, User, Save, Loader2, Mail, Camera, Lock, Eye, EyeOff } from 'lucide-react';
import { User as UserType } from '../../../shared/types';
import { api } from '../../../shared/services/api';
import { SecurityModal } from '../../../shared/components/Shared';
import { useAuthStore } from '../../auth/store/authStore';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType;
  onUpdate: (user: UserType) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user, onUpdate }) => {
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { deleteAccount } = useAuthStore();

  // Security Modal State
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [securityModalType, setSecurityModalType] = useState<'basic' | 'sensitive' | 'delete'>('basic');
  const [securityModalAction, setSecurityModalAction] = useState<'update' | 'delete'>('update');

  if (!isOpen) return null;

  const handleInitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSecurityModalAction('update');
    if (password) {
      setSecurityModalType('sensitive');
    } else {
      setSecurityModalType('basic');
    }
    
    setSecurityModalOpen(true);
  };

  const handleInitDelete = () => {
    setError('');
    setSecurityModalAction('delete');
    setSecurityModalType('delete');
    setSecurityModalOpen(true);
  };

  const handleConfirmAction = async (currentPassword?: string) => {
    setLoading(true);
    try {
      if (securityModalAction === 'delete') {
        if (!currentPassword) throw new Error("Password required");
        await deleteAccount(currentPassword);
        // Auth store will handle logout
        setSecurityModalOpen(false);
        onClose();
        return;
      }

      const payload: any = { firstName, lastName };
      if (password) payload.password = password;
      if (avatarUrl) payload.avatarUrl = avatarUrl;
      if (currentPassword) payload.currentPassword = currentPassword;

      await api.auth.updateProfile(payload);
      onUpdate({ ...user, ...payload });
      onClose();
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to update profile");
      setSecurityModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const objectUrl = URL.createObjectURL(file);
        setAvatarUrl(objectUrl);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/20 dark:bg-black/80 backdrop-blur-sm" onClick={onClose} />
        <div className="w-full max-w-md bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#212124] rounded-2xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-100 dark:border-[#212124] flex items-center justify-between sticky top-0 bg-white dark:bg-[#121214] z-20">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-500">
                  <User size={20} />
               </div>
               <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Profile Settings</h2>
                  <p className="text-xs text-slate-500">Manage identity & security</p>
               </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleInitSubmit} className="p-6 space-y-6">
             {error && (
               <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg">
                 {error}
               </div>
             )}

             <div className="flex flex-col items-center">
                <div className="relative group cursor-pointer">
                  <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-[#212124] shadow-lg overflow-hidden flex items-center justify-center">
                     {avatarUrl || (user as any).avatarUrl ? (
                       <img src={avatarUrl || (user as any).avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                     ) : (
                       <span className="text-2xl font-bold text-slate-400">{firstName?.[0]}</span>
                     )}
                  </div>
                  <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                     <Camera size={24} />
                     <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                </div>
                <p className="text-xs text-slate-500 mt-2">Click to update photo</p>
             </div>

             <div className="space-y-4">
               <div className="space-y-1">
                 <label className="text-xs font-bold text-slate-400 uppercase">Email Address</label>
                 <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-slate-50 dark:bg-[#0a0a0b] border border-slate-200 dark:border-[#212124] text-slate-500 cursor-not-allowed">
                   <Mail size={16} />
                   <span className="text-sm">{user.email}</span>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-400 uppercase">First Name</label>
                   <input 
                     value={firstName}
                     onChange={(e) => setFirstName(e.target.value)}
                     className="w-full bg-slate-50 dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2d2d31] rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors"
                   />
                 </div>
                 <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-400 uppercase">Last Name</label>
                   <input 
                     value={lastName}
                     onChange={(e) => setLastName(e.target.value)}
                     className="w-full bg-slate-50 dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2d2d31] rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors"
                   />
                 </div>
               </div>
             </div>

             <div className="pt-4 border-t border-slate-100 dark:border-[#212124] space-y-4">
               <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                 <Lock size={14} /> Change Password
               </h3>
               <div className="space-y-4">
                  <div className="relative">
                    <input 
                       type={showPassword ? "text" : "password"}
                       placeholder="New Password"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="w-full bg-slate-50 dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2d2d31] rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors"
                     />
                     <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors z-10 p-1"
                     >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                     </button>
                  </div>
                  <div className="relative">
                     <input 
                       type={showConfirmPassword ? "text" : "password"}
                       placeholder="Confirm New Password"
                       value={confirmPassword}
                       onChange={(e) => setConfirmPassword(e.target.value)}
                       className="w-full bg-slate-50 dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2d2d31] rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors"
                     />
                     <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors z-10 p-1"
                     >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                     </button>
                  </div>
               </div>
             </div>

             <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-[#212124] text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-[#2d2d31] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-emerald-600 dark:bg-emerald-500 text-white dark:text-black font-bold rounded-xl text-sm hover:opacity-90 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Save Changes
                </button>
             </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-[#2d2d31] px-6 pb-6">
            <h3 className="text-xs font-bold text-rose-600 mb-4 uppercase tracking-wider">Danger Zone</h3>
            <div className="flex items-center justify-between p-4 border border-rose-100 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/10 rounded-xl">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Delete Account</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Permanently remove your data and access.</p>
              </div>
              <button 
                onClick={handleInitDelete} 
                className="px-3 py-1.5 bg-white dark:bg-[#18181b] border border-rose-200 dark:border-rose-900/30 text-rose-600 text-[10px] font-bold rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors shadow-sm uppercase tracking-wide"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      <SecurityModal 
        isOpen={securityModalOpen}
        type={securityModalType}
        onClose={() => { setSecurityModalOpen(false); setLoading(false); }}
        onConfirm={handleConfirmAction}
        isLoading={loading}
      />
    </>
  );
};
