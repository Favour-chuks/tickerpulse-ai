
import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertTriangle, Check, X, Trash2 } from 'lucide-react';

interface CardProps {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = "", onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#2d2d31] rounded-2xl p-6 shadow-sm dark:shadow-none ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:bg-[#27272a] transition-all duration-300' : ''} ${className}`}
  >
    {children}
  </div>
);

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = "default", className = "" }) => {
  const styles = {
    default: "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700",
    neutral: "bg-slate-50 text-slate-500 border border-slate-200 dark:bg-white/5 dark:text-zinc-400 dark:border-white/5",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/10",
    warning: "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/10",
    danger: "bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/10"
  };
  return <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide shadow-sm dark:shadow-none ${styles[variant]} ${className}`}>{children}</span>;
};

interface SecurityModalProps {
  isOpen: boolean;
  type: 'basic' | 'sensitive' | 'delete';
  onClose: () => void;
  onConfirm: (currentPassword?: string) => void;
  isLoading?: boolean;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({ isOpen, type, onClose, onConfirm, isLoading }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(currentPassword);
  };

  const getIcon = () => {
    if (type === 'delete') return <Trash2 size={24} />;
    if (type === 'sensitive') return <Lock size={24} />;
    return <AlertTriangle size={24} />;
  };

  const getIconBg = () => {
    if (type === 'delete') return 'bg-rose-50 text-rose-500 dark:bg-rose-500/10';
    if (type === 'sensitive') return 'bg-amber-50 text-amber-500 dark:bg-amber-500/10';
    return 'bg-brand-50 text-brand-600 dark:bg-brand-500/10';
  };

  const getTitle = () => {
    if (type === 'delete') return 'Delete Account';
    if (type === 'sensitive') return 'Security Check Required';
    return 'Confirm Profile Update';
  };

  const getDescription = () => {
    if (type === 'delete') return 'This action is permanent and cannot be undone. All your data will be erased.';
    if (type === 'sensitive') return 'To change your password, please verify your identity by entering your current password.';
    return 'Are you sure you want to update your public profile information?';
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-sm bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#2d2d31] rounded-2xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        <div className="p-6 text-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${getIconBg()}`}>
            {getIcon()}
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {getTitle()}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {getDescription()}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {(type === 'sensitive' || type === 'delete') && (
              <div className="relative text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block ml-1">Current Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0a0a0b] border border-slate-200 dark:border-[#2d2d31] rounded-xl px-4 py-3 pr-10 text-sm text-slate-900 dark:text-white focus:border-brand-500 outline-none transition-all"
                    placeholder="Enter current password"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 py-3 bg-slate-100 dark:bg-[#212124] text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-[#2d2d31] transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isLoading}
                className={`flex-1 py-3 text-white font-bold rounded-xl text-sm hover:opacity-90 transition-colors flex items-center justify-center gap-2 ${
                  type === 'delete' ? 'bg-rose-600' :
                  type === 'sensitive' ? 'bg-amber-500 text-black' : 
                  'bg-brand-600 dark:bg-brand-500 text-white dark:text-black'
                }`}
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {type === 'delete' ? <Trash2 size={16} /> : <Check size={16} />} 
                    {type === 'delete' ? 'Delete' : 'Confirm'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
