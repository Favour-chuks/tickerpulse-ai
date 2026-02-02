import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Edit2,
  X,
  Save,
  Activity,
  List,
  LayoutGrid,
} from "lucide-react";
import { Watchlist, Ticker } from "../../../shared/types";
import { api } from "../../../shared/services/api";
import { Card } from "../../../shared/components/Shared";
import { WatchlistItem } from "./WatchlistItem";

const WatchlistView = ({
  onSelectTicker,
}: {
  onSelectTicker: (t: Ticker) => void;
}) => {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newWlName, setNewWlName] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [newItemSymbol, setNewItemSymbol] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await api.watchlist.getAll();
      const list = Array.isArray(res) ? res : res.watchlists || [];
      const fullDetails = await Promise.all(
        list.map(async (wl: Watchlist) => {
          try {
            const details = await api.watchlist.getItems(wl.id);
            return { 
              ...wl, 
              items: details.tickers || [] 
            };
          } catch {
            return wl;
          }
        })
      );
      setWatchlists(fullDetails);
    } catch (e) {
      console.error('[Watchlist] Error loading watchlists:', e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWlName.trim() || submitting) return;
    
    setSubmitting(true);
    try {
      const newWatchlist = await api.watchlist.create(newWlName.trim());
      
      setWatchlists((prev) => [...prev, { ...newWatchlist, items: [] }]);
      
      setNewWlName("");
      setShowCreate(false);
      
    } catch (e: any) {
      alert(e.message || 'Failed to create watchlist. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api.watchlist.update(id, editName.trim());
      
      // Update local state immediately
      setWatchlists((prev) =>
        prev.map((w) => (w.id === id ? { ...w, name: editName.trim() } : w))
      );
      
      setEditingId(null);
    } catch (e: any) {
      alert(e.message || 'Failed to update watchlist name.');
      load(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (submitting) return;
    
    const watchlist = watchlists.find(w => w.id === id);
    const confirmMessage = watchlist?.items?.length 
      ? `Delete "${watchlist.name}" with ${watchlist.items.length} items? This action cannot be undone.`
      : `Delete "${watchlist?.name}"? This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;
    
    setSubmitting(true);
    try {
      await api.watchlist.delete(id);
      setWatchlists((prev) => prev.filter((w) => w.id !== id));
    } catch (e: any) {
      alert(e.message || 'Failed to delete watchlist.');
      load(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddItem = async (watchlistId: string) => {
    if (!newItemSymbol.trim() || submitting) return;
    
    setSubmitting(true);
    try {
      const symbol = newItemSymbol.trim().toUpperCase();
      const result = await api.watchlist.addItem(watchlistId, symbol);
      try {
        const details = await api.watchlist.getItems(watchlistId);
        setWatchlists((prev) =>
          prev.map((wl) =>
            wl.id === watchlistId
              ? { ...wl, items: details.tickers || [] }
              : wl
          )
        );
      } catch (e) {
        load(false);
      }
      
      setNewItemSymbol("");
      setAddingToId(null);
    } catch (e: any) {
      alert(e.message || 'Could not add ticker. Ensure symbol is valid.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveItem = async (watchlistId: string, symbol: string) => {
    if (submitting) return;
    
    setSubmitting(true);
    try {
      await api.watchlist.removeItem(watchlistId, symbol);
      
      // Update local state immediately
      setWatchlists((prev) =>
        prev.map((wl) => {
          if (wl.id === watchlistId) {
            return {
              ...wl,
              items: wl.items?.filter((i) => i.ticker.symbol !== symbol) || [],
            };
          }
          return wl;
        })
      );
      
    } catch (e: any) {
      alert(e.message || 'Failed to remove item.');
      load(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 pb-6 border-b border-slate-200 dark:border-[#212124] shrink-0">
        <div className="flex gap-4">
          <div className="p-3 bg-white dark:bg-[#18181b] rounded-xl shadow-sm border border-slate-200 dark:border-[#212124]">
            <List className="w-6 h-6 text-slate-900 dark:text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Watchlist Manager
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
              Organize assets into custom high-priority monitoring groups.
            </p>
          </div>
        </div>

        {watchlists.length > 0 && (
          <button
            onClick={() => setShowCreate(true)}
            disabled={submitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-600 dark:bg-white text-white dark:text-black font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-brand-600/20 dark:shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} strokeWidth={3} /> Create Watchlist
          </button>
        )}
      </header>

      {showCreate && (
        <div className="bg-white dark:bg-[#121214] border border-brand-500/30 rounded-2xl p-6 animate-in slide-in-from-top-2 shadow-xl shrink-0 mb-6">
          <h3 className="text-xs font-black text-brand-600 dark:text-brand-500 uppercase tracking-widest mb-4">
            Create New Watchlist
          </h3>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-4">
            <input
              autoFocus
              type="text"
              placeholder="E.g., 'Semiconductor Shorts' or 'AI Longs'"
              className="flex-1 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-[#212124] rounded-xl px-4 py-3 outline-none focus:border-brand-500 text-slate-900 dark:text-white text-sm font-medium"
              value={newWlName}
              onChange={(e) => setNewWlName(e.target.value)}
              disabled={submitting}
            />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting || !newWlName.trim()}
                className="flex-1 sm:flex-none px-8 py-3 bg-brand-600 dark:bg-brand-500 text-white dark:text-black font-bold rounded-xl text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {submitting ? (
                  <Loader2 className="animate-spin w-4 h-4" />
                ) : (
                  "Save"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setNewWlName("");
                }}
                disabled={submitting}
                className="flex-1 sm:flex-none px-8 py-3 bg-slate-100 dark:bg-[#212124] text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {watchlists.length === 0 && !showCreate ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500 min-h-[60vh]">
          <div className="w-20 h-20 bg-slate-100 dark:bg-[#18181b] rounded-full flex items-center justify-center mb-6 shadow-sm">
            <LayoutGrid className="w-10 h-10 text-slate-300 dark:text-slate-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            No Watchlists Yet
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8">
            Create your first watchlist to start tracking sector-specific
            narrative divergences and volume anomalies.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            disabled={submitting}
            className="flex items-center gap-2 px-8 py-4 rounded-xl bg-brand-600 dark:bg-white text-white dark:text-black font-bold text-base hover:scale-105 transition-all shadow-xl shadow-brand-600/20 dark:shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} strokeWidth={3} /> Create Watchlist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-20">
          {watchlists.map((wl) => (
            <Card
              key={wl.id}
              className="relative group flex flex-col min-h-[340px] shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Watchlist Header */}
              <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-100 dark:border-[#212124]">
                <div className="flex-1 mr-4">
                  {editingId === wl.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-[#2d2d31] rounded-lg px-2 py-1 text-slate-900 dark:text-white font-bold text-xl w-full"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        disabled={submitting}
                      />
                      <button
                        onClick={() => handleEdit(wl.id)}
                        disabled={submitting || !editName.trim()}
                        className="p-1.5 bg-brand-500 text-white dark:text-black rounded-lg hover:opacity-90 disabled:opacity-50"
                      >
                        {submitting ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Save size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        disabled={submitting}
                        className="p-1.5 bg-slate-200 dark:bg-[#212124] text-slate-500 dark:text-slate-400 rounded-lg hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="group/title flex items-center gap-3">
                      <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate">
                        {wl.name}
                      </h3>
                      <button
                        onClick={() => {
                          setEditingId(wl.id);
                          setEditName(wl.name);
                        }}
                        className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-brand-500 transition-opacity"
                        disabled={submitting}
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400">
                      {wl.items?.length || 0} Assets
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                      Updated {new Date(wl.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(wl.id)}
                  disabled={submitting}
                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 size={20} />
                </button>
              </div>

              {/* Watchlist Items */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {wl.items && wl.items.length > 0 ? (
                  wl.items.map((wlItems) => (
                    <WatchlistItem
                      key={wlItems.id}
                      watchlistItem={wlItems}
                      watchlistId={wl.id}
                    />
                  ))
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 text-xs font-medium border-2 border-dashed border-slate-100 dark:border-[#212124] rounded-2xl bg-slate-50/50 dark:bg-[#0a0a0b]/30">
                    <Activity size={24} className="mb-3 opacity-30" />
                    No assets being monitored.
                  </div>
                )}
              </div>

              {/* Add Item Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-[#212124]">
                {addingToId === wl.id ? (
                  <div className="flex items-center gap-2 animate-in fade-in">
                    <input
                      className="flex-1 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-[#2d2d31] rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-brand-500 placeholder:text-slate-400 font-medium disabled:opacity-50"
                      placeholder="Enter Symbol (e.g. AMD)"
                      autoFocus
                      value={newItemSymbol}
                      onChange={(e) =>
                        setNewItemSymbol(e.target.value.toUpperCase())
                      }
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleAddItem(wl.id)
                      }
                      disabled={submitting}
                    />
                    <button
                      onClick={() => handleAddItem(wl.id)}
                      disabled={submitting || !newItemSymbol.trim()}
                      className="px-4 py-2.5 bg-brand-600 dark:bg-brand-500 text-white dark:text-black text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
                    >
                      {submitting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        "Add"
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setAddingToId(null);
                        setNewItemSymbol("");
                      }}
                      disabled={submitting}
                      className="px-4 py-2.5 bg-slate-100 dark:bg-[#212124] text-slate-500 dark:text-slate-400 text-sm font-bold rounded-xl hover:bg-slate-200 dark:hover:text-white disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingToId(wl.id)}
                    disabled={submitting}
                    className="w-full py-3 border border-dashed border-slate-200 dark:border-[#2d2d31] rounded-xl text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-500 hover:border-brand-500/30 hover:bg-brand-50/50 dark:hover:bg-brand-500/5 transition-all flex items-center justify-center gap-2 uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} /> Add Asset to Monitor
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default WatchlistView;