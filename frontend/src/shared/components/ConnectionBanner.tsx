import React from 'react';
import { WifiOff, ShieldAlert } from 'lucide-react';
import { useConnectionStore } from '../store/connectionStore';
import { useAuthStore } from '../../features/auth/store/authStore';

export const ConnectionBanner: React.FC = () => {
  const { isOnline, isSocketConnected } = useConnectionStore();
  const { user } = useAuthStore();

  const isJudge = user?.id === 'demo-user-1';
  
  if (!isOnline || !isSocketConnected && !isJudge) {
    return (
      <div className="w-full bg-rose-600 px-4 py-2 flex items-center justify-center gap-2 text-xs font-bold text-white uppercase">
        <WifiOff size={14} /> Offline: Data will sync when restored
      </div>
    );
  }

  if (isJudge) {
    return (
      <div className="w-full bg-indigo-600 px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-bold text-white uppercase tracking-widest shadow-lg">
        <ShieldAlert size={14} className="animate-pulse text-yellow-400" />
        <span>Judge Preview: A special preview crafted for your review. I'm excited to show you what’s under the hood.</span>
      </div>
    );
  }

  return null;
};