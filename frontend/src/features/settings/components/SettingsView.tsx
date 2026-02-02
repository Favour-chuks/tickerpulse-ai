
import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap, Settings, Loader2, LogOut, ArrowLeft, User, Mail, Camera, Lock, Save, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Card, Badge, SecurityModal } from '../../../shared/components/Shared';
import { api } from '../../../shared/services/api';
import { NotificationService } from '../../../shared/services/notifications';
import { User as UserType } from '../../../shared/types';
import { useAuthStore } from '../../auth/store/authStore';

interface SettingsViewProps {
  user: UserType;
  onLogout: () => void;
  section: 'main' | 'profile';
  onSectionChange: (section: 'main' | 'profile') => void;
  onUpdateProfile: (user: UserType) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user, onLogout, section, onSectionChange, onUpdateProfile }) => {
  const [simulating, setSimulating] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const { deleteAccount } = useAuthStore();

  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState((user as any).avatarUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Security Modal State
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [securityModalType, setSecurityModalType] = useState<'basic' | 'sensitive' | 'delete'>('basic');
  const [securityModalAction, setSecurityModalAction] = useState<'update' | 'delete'>('update');

  useEffect(() => {
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setAvatarUrl((user as any).avatarUrl || '');
  }, [user]);

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const demoAlert = await api.alerts.triggerDemoSignal();

     NotificationService.sendNotification(
        `TickerPulseAI Signal: ${demoAlert.symbol}`,
        {
          body: demoAlert.message,
          icon: '/logo192.png', 
          badge: '/badge-icon.png', 
          tag: 'simulated-alert', 
          data: { url: `/ticker/${demoAlert.symbol}` }
        }
      );
    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
    }
  };

  const handleInitSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

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
        setSecurityModalOpen(false);
        return;
      }

      const payload: any = { firstName, lastName };
      if (password) payload.password = password;
      if (avatarUrl) payload.avatarUrl = avatarUrl;
      if (currentPassword) payload.currentPassword = currentPassword;

      await api.auth.updateProfile(payload);
      onUpdateProfile({ ...user, ...payload });
      setSuccessMsg("Profile updated successfully");
      setPassword('');
      setConfirmPassword('');
      setSecurityModalOpen(false);
      
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to perform action");
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

  if (section === 'profile') {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20">
        <SecurityModal 
          isOpen={securityModalOpen}
          type={securityModalType}
          onClose={() => { setSecurityModalOpen(false); setLoading(false); }}
          onConfirm={handleConfirmAction}
          isLoading={loading}
        />

        <button
          onClick={() => onSectionChange('main')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-bold group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Settings
        </button>

        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Edit Profile</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Update your personal information and security credentials.</p>
        </header>

        <Card className="max-w-3xl">
          <form onSubmit={handleInitSave} className="space-y-8 p-2">
             {error && (
               <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-bold rounded-xl flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-rose-500" />
                 {error}
               </div>
             )}
             
             {successMsg && (
               <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold rounded-xl flex items-center gap-2">
                 <CheckCircle2 size={18} />
                 {successMsg}
               </div>
             )}

             <div className="flex flex-col md:flex-row gap-8">
               <div className="flex flex-col items-center space-y-4">
                  <div className="relative group cursor-pointer">
                    <div className="w-32 h-32 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-[#212124] shadow-xl overflow-hidden flex items-center justify-center">
                       {avatarUrl ? (
                         <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                       ) : (
                         <span className="text-4xl font-bold text-slate-300 dark:text-slate-600">{firstName?.[0]}</span>
                       )}
                    </div>
                    <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                       <Camera size={28} />
                       <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </label>
                  </div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Profile Photo</p>
               </div>

               <div className="flex-1 space-y-6">
                 <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                     <Mail size={14} /> Email Address
                   </label>
                   <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0a0a0b] border border-slate-200 dark:border-[#2d2d31] text-slate-500 cursor-not-allowed">
                     <span className="text-sm font-medium">{user.email}</span>
                   </div>
                   <p className="text-[10px] text-slate-400">Email cannot be changed manually. Contact support.</p>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                       <User size={14} /> First Name
                     </label>
                     <input 
                       value={firstName}
                       onChange={(e) => setFirstName(e.target.value)}
                       className="w-full bg-white dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2d2d31] rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 outline-none transition-all font-medium"
                     />
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                       <User size={14} /> Last Name
                     </label>
                     <input 
                       value={lastName}
                       onChange={(e) => setLastName(e.target.value)}
                       className="w-full bg-white dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2d2d31] rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 outline-none transition-all font-medium"
                     />
                   </div>
                 </div>

                 <div className="pt-6 border-t border-slate-100 dark:border-[#212124] space-y-6">
                   <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                     <Lock size={16} className="text-brand-500" /> Security
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 relative">
                         <label className="text-xs font-bold text-slate-400 uppercase">New Password</label>
                         <div className="relative">
                           <input 
                             type={showPassword ? "text" : "password"}
                             value={password}
                             onChange={(e) => setPassword(e.target.value)}
                             placeholder="••••••••"
                             className="w-full bg-white dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2d2d31] rounded-xl px-4 py-3 pr-10 text-sm text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 outline-none transition-all"
                           />
                           <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors z-10 p-1"
                           >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                           </button>
                         </div>
                      </div>
                      <div className="space-y-2 relative">
                         <label className="text-xs font-bold text-slate-400 uppercase">Confirm Password</label>
                         <div className="relative">
                           <input 
                             type={showConfirmPassword ? "text" : "password"}
                             value={confirmPassword}
                             onChange={(e) => setConfirmPassword(e.target.value)}
                             placeholder="••••••••"
                             className="w-full bg-white dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2d2d31] rounded-xl px-4 py-3 pr-10 text-sm text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 outline-none transition-all"
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
                 </div>
               </div>
             </div>

             <div className="pt-6 border-t border-slate-100 dark:border-[#212124] flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => onSectionChange('main')}
                  className="px-6 py-3 bg-slate-100 dark:bg-[#212124] text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-[#2d2d31] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-brand-600 dark:bg-brand-500 text-white dark:text-black font-bold rounded-xl text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20 dark:shadow-brand-500/10"
                >
                  <Save size={18} /> Save Changes
                </button>
             </div>
          </form>

          {/* Danger Zone */}
          <div className="mt-12 pt-8 border-t border-slate-200 dark:border-[#2d2d31]">
            <h3 className="text-sm font-bold text-rose-600 mb-4">Danger Zone</h3>
            <div className="flex items-center justify-between p-4 border border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/10 rounded-xl">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Delete Account</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Permanently remove your data and access.</p>
              </div>
              <button 
                onClick={handleInitDelete} 
                className="px-4 py-2 bg-white dark:bg-[#18181b] border border-rose-200 dark:border-rose-900/30 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors shadow-sm"
              >
                Delete Account
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Terminal Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Configure your signal engine, notification parameters, and terminal connection.</p>
      </header>

      <div className="max-w-2xl space-y-6">
        <Card className="border-brand-500/20 bg-brand-50 dark:bg-brand-500/5">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-brand-700 dark:text-brand-500"><RefreshCw size={18} /> Signal Simulation Engine</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            Test your connection to the SignalHub detection engine. Triggering a simulation will bypass normal market filtering to demonstrate the alert protocol.
          </p>
          <button 
            onClick={handleSimulate}
            disabled={simulating}
            className="w-full py-4 bg-brand-600 dark:bg-brand-500 text-white dark:text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-xl shadow-brand-500/10"
          >
            {simulating ? <Loader2 className="animate-spin" size={18} /> : <><Zap size={18} fill="currentColor" /> Trigger Live Signal Simulation</>}
          </button>
        </Card>

        <Card>
          <h3 className="font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white"><Settings size={18} className="text-slate-400" /> Connection Preferences</h3>
          <div className="space-y-6">
             <div className="flex items-center justify-between">
                <div>
                   <p className="text-sm font-bold text-slate-900 dark:text-white">Auto-Scan Filings</p>
                   <p className="text-xs text-slate-500">Automatically extract narratives from SEC Edgar real-time feed.</p>
                </div>
                <button 
                  onClick={() => setAutoScan(!autoScan)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${autoScan ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoScan ? 'left-6' : 'left-1'}`} />
                </button>
             </div>
             <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-[#212124]">
                <div>
                   <p className="text-sm font-bold text-slate-900 dark:text-white">Latency Mode</p>
                   <p className="text-xs text-slate-500">Prioritize orderbook speed over historical backtesting depth.</p>
                </div>
                <Badge variant="success">Low Latency</Badge>
             </div>
          </div>
        </Card>

        <Card className="border-rose-500/20 hover:border-rose-500/40 transition-colors p-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center justify-between p-6 gap-6">
            <div 
              className="flex items-center gap-4 cursor-pointer flex-1 group"
              onClick={() => onSectionChange('profile')}
            >
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-white font-bold group-hover:border-brand-500/50 transition-colors">
                 {avatarUrl ? (
                   <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                 ) : (
                   user.firstName?.[0] || user.email[0]
                 )}
              </div>
              <div>
                 <p className="font-bold text-base text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{user.firstName} {user.lastName}</p>
                 <p className="text-xs text-slate-500">{user.email}</p>
                 <p className="text-[10px] text-brand-500 mt-1 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Edit Profile</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="w-full sm:w-auto px-8 py-3 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-500 border border-rose-100 dark:border-rose-500/20 rounded-xl text-sm font-bold hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500 dark:hover:text-white transition-all shadow-sm hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] flex items-center justify-center gap-2"
            >
              <LogOut size={16} /> Log Out
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SettingsView;
