import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, 
  ChevronRight, 
  Settings, 
  Zap, 
  Newspaper, 
  AlertTriangle, 
  Activity, 
  Save, 
  X,
  TrendingUp,
  Loader2
} from 'lucide-react';
import type { WatchlistItem as ItemType } from '../../../shared/types';
import { api } from '../../../shared/services/api';

interface WatchlistItemProps {
  watchlistItem: ItemType;
  watchlistId: string;
  onRemoveSuccess?: (symbol: string) => void; 
  onUpdateSuccess?: (symbol: string, newSettings: ItemType["settings"]) => void; 
}

export const WatchlistItem: React.FC<WatchlistItemProps> = ({ 
  watchlistItem, 
  watchlistId, 
  onRemoveSuccess,
  onUpdateSuccess
}) => {
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  
  const [settings, setSettings] = useState<ItemType['settings']>(
    watchlistItem.settings || {
      news_alerts: true,
      min_severity: 'medium',
      divergence_alerts: true,
      contradiction_alerts: true
    }
  );

  const handleTickerClick = () => {
    if (!isEditing) {
      navigate(`/ticker/${watchlistItem.ticker.symbol}`);
    }
  };

  const handleToggleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(!isEditing);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    
    try {
      await api.watchlist.updateItemSettings(
        watchlistId, 
        watchlistItem.ticker.symbol, 
        settings
      );
      onUpdateSuccess?.(watchlistItem.ticker.symbol, settings);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRemoving(true);
    
    try {
      await api.watchlist.removeItem(watchlistId, watchlistItem.ticker.symbol);
      onRemoveSuccess?.(watchlistItem.ticker.symbol);
    } catch (err) {
      console.error('Failed to remove item:', err);
    } finally {
      setRemoving(false);
    }
  };

  const handleCancel = () => {
    setSettings(watchlistItem.settings || {
      news_alerts: true,
      min_severity: 'medium',
      divergence_alerts: true,
      contradiction_alerts: true
    });
    setIsEditing(false);
  };

  const toggleSetting = (key: keyof ItemType['settings']) => {
    setSettings(prev => ({ 
      ...prev, 
      [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key]
    }));
  };

  const updateSeverity = (severity: 'low' | 'medium' | 'high') => {
    setSettings(prev => ({ ...prev, min_severity: severity }));
  };

  const getSeverityColor = (sev: string) => {
    switch(sev) {
      case 'high': return 'bg-rose-500 text-white border-rose-600';
      case 'medium': return 'bg-amber-500 text-white border-amber-600';
      default: return 'bg-slate-400 text-white border-slate-500';
    }
  };

  return (
    <div 
      className={`
        group relative flex flex-col rounded-xl bg-white dark:bg-[#18181b] border transition-all duration-300 overflow-hidden
        ${isEditing 
          ? 'border-brand-500 ring-1 ring-brand-500/20 shadow-lg z-10' 
          : 'border-slate-200/50 dark:border-transparent hover:border-brand-500/30 dark:hover:border-brand-500/30 hover:shadow-sm'}
      `}
    >
      {/* Main Row */}
      <div 
        className="flex justify-between items-center p-3 cursor-pointer"
        onClick={handleTickerClick}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Ticker Icon */}
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-[#27272a] flex items-center justify-center text-slate-900 dark:text-white font-black text-sm shrink-0">
            {watchlistItem.ticker.symbol[0]}
          </div>
          
          {/* Ticker Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-lg text-slate-900 dark:text-white tracking-tight leading-none truncate">
                {watchlistItem.ticker.symbol}
              </span>
              {!isEditing && <TrendingUp size={14} className="text-emerald-500 opacity-80" />}
            </div>
            
            {/* Metadata & Badges */}
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide shrink-0">
                {watchlistItem.ticker.sector || 'Tech'}
              </span>
              
              {!isEditing && (
                <div className="flex items-center gap-1 ml-1 overflow-hidden">
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  {settings.divergence_alerts && (
                    <Zap size={10} className="text-amber-500" fill="currentColor" />
                  )}
                  {settings.contradiction_alerts && (
                    <AlertTriangle size={10} className="text-rose-500" fill="currentColor" />
                  )}
                  {settings.news_alerts && (
                    <Newspaper size={10} className="text-indigo-500" fill="currentColor" />
                  )}
                  <span className="text-[9px] px-1 rounded bg-slate-100 dark:bg-white/10 text-slate-500 font-medium capitalize ml-1">
                    {settings.min_severity}+
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons - Refactored for Hover Visibility */}
        <div className="flex items-center gap-1">
          <div className={`
            flex items-center gap-1 transition-opacity duration-200
            ${isEditing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
        `}>
          <button 
            onClick={handleToggleEdit}
            className={`p-2 rounded-lg transition-all ${
              isEditing 
                ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400' 
                : 'text-slate-300 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 dark:hover:text-brand-400'
            }`}
          >
            <Settings size={16} />
          </button>
          {!isEditing && (
            <>
              <button 
                onClick={handleRemove}
                disabled={removing}
                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all disabled:opacity-50"
              >
                {removing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
              <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-1" />
            </>
          )}
          </div>
          
          {!isEditing && <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />}
        </div>
      </div>

      {/* Configuration Panel (Expandable) */}
      {isEditing && (
        <div className="px-3 pb-3 pt-0 animate-in slide-in-from-top-2 duration-200">
          <div className="p-3 bg-slate-50 dark:bg-[#0a0a0b] rounded-lg border border-slate-200 dark:border-[#2d2d31] space-y-4">
            
            {/* Alert Type Toggles */}
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => toggleSetting('divergence_alerts')}
                className={`flex items-center gap-2 p-2 rounded-md border text-xs font-bold transition-all ${
                  settings.divergence_alerts 
                    ? 'bg-white dark:bg-[#18181b] border-amber-500/50 text-amber-600 shadow-sm' 
                    : 'border-transparent text-slate-400 hover:bg-white/50'
                }`}
              >
                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                  settings.divergence_alerts 
                    ? 'bg-amber-100 text-amber-600' 
                    : 'bg-slate-200 text-slate-400'
                }`}>
                  <Zap size={10} fill="currentColor" />
                </div>
                Volume Spikes
              </button>

              <button 
                onClick={() => toggleSetting('contradiction_alerts')}
                className={`flex items-center gap-2 p-2 rounded-md border text-xs font-bold transition-all ${
                  settings.contradiction_alerts 
                    ? 'bg-white dark:bg-[#18181b] border-rose-500/50 text-rose-600 shadow-sm' 
                    : 'border-transparent text-slate-400 hover:bg-white/50'
                }`}
              >
                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                  settings.contradiction_alerts 
                    ? 'bg-rose-100 text-rose-600' 
                    : 'bg-slate-200 text-slate-400'
                }`}>
                  <AlertTriangle size={10} fill="currentColor" />
                </div>
                Contradictions
              </button>

              <button 
                onClick={() => toggleSetting('news_alerts')}
                className={`flex items-center gap-2 p-2 rounded-md border text-xs font-bold transition-all ${
                  settings.news_alerts 
                    ? 'bg-white dark:bg-[#18181b] border-indigo-500/50 text-indigo-600 shadow-sm' 
                    : 'border-transparent text-slate-400 hover:bg-white/50'
                }`}
              >
                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                  settings.news_alerts 
                    ? 'bg-indigo-100 text-indigo-600' 
                    : 'bg-slate-200 text-slate-400'
                }`}>
                  <Newspaper size={10} fill="currentColor" />
                </div>
                News Feed
              </button>
            </div>

            {/* Severity Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                <Activity size={10} /> Minimum Severity
              </label>
              <div className="flex bg-white dark:bg-[#18181b] p-1 rounded-lg border border-slate-200 dark:border-[#2d2d31]">
                {(['low', 'medium', 'high'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => updateSeverity(sev)}
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${
                      settings.min_severity === sev 
                        ? getSeverityColor(sev) 
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={12} />
                    Save Configuration
                  </>
                )}
              </button>
              <button 
                onClick={handleCancel}
                disabled={saving}
                className="px-3 py-2 bg-slate-200 dark:bg-[#212124] text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors disabled:opacity-50"
              >
                <X size={12} />
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};