
import React, { useState } from 'react'
import { X, Zap, AlertTriangle, Activity, BarChart2, BookOpen, ShieldAlert, MessageSquareText, List, CheckCircle2, TrendingUp, Search, Target, History } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'icons' | 'nav'>('metrics');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#2d2d31] rounded-2xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-[#2d2d31] flex items-center justify-between bg-white dark:bg-[#18181b]">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <BookOpen size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">System Guide</h2>
                <p className="text-xs text-slate-500">Platform Glossary & Workflows</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-[#2d2d31] bg-slate-50/50 dark:bg-white/5">
          <button 
            onClick={() => setActiveTab('metrics')}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'metrics' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#18181b]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Metrics & Data
          </button>
          <button 
            onClick={() => setActiveTab('icons')}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'icons' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#18181b]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Icon Legend
          </button>
          <button 
            onClick={() => setActiveTab('nav')}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'nav' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#18181b]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Core Workflows
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-[#18181b]">
          {activeTab === 'metrics' && (
            <div className="space-y-8">
              <section>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Volume & Price Analysis</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                      <BarChart2 size={16} className="text-indigo-500" /> Deviation Multiple
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                      Represents the magnitude of current volume relative to the 20-day simple moving average. A multiple of <span className="font-mono bg-slate-100 dark:bg-zinc-800 px-1 rounded text-xs">2.0x</span> indicates volume is double the norm. High deviation (&gt;3.0x) without public news is a primary divergence signal.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                      <Activity size={16} className="text-indigo-500" /> Z-Score
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                      A statistical measurement of a value's relationship to the mean of a group of values. A Z-score of <span className="font-mono bg-slate-100 dark:bg-zinc-800 px-1 rounded text-xs">3.0</span> indicates the event is 3 standard deviations from the mean (statistically significant anomaly).
                    </p>
                  </div>
                </div>
              </section>

              <div className="h-px bg-slate-100 dark:bg-[#2d2d31]" />

              <section>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Narrative Intelligence</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                      <Target size={16} className="text-rose-500" /> Management Confidence Score
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                      An AI-derived metric (1-10) gauging the certainty of executive language in SEC filings. Low scores (1-4) often precede guidance cuts or negative revisions.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                      <AlertTriangle size={16} className="text-amber-500" /> Contradiction Severity
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                      Classifies the semantic distance between two statements. "Critical" implies a direct logical conflict (e.g., promising growth then cutting guidance). "Medium" implies a subtle pivot or change in emphasis.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                      <TrendingUp size={16} className="text-emerald-500" /> Tone Shift
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                      The directional change in sentiment between sequential filings (e.g., 10-Q vs previous 10-Q). Detects when management becomes "Cautiously Bullish" vs "Defensive".
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                      <History size={16} className="text-blue-500" /> Guidance Fulfillment
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                      Tracks specific quantitative promises made by management (e.g., "Margins &gt; 20%") against subsequent reality. Statuses include <span className="font-mono bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1 rounded text-xs">KEPT</span>, <span className="font-mono bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 px-1 rounded text-xs">BROKEN</span>, or <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs">PENDING</span>.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'icons' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: Zap, label: "Volume Spike", desc: "Abnormal trading volume >2SD.", color: "text-amber-500" },
                { icon: AlertTriangle, label: "Contradiction", desc: "Logical inconsistency detected.", color: "text-rose-500" },
                { icon: ShieldAlert, label: "Risk Factor", desc: "High probability downside risk.", color: "text-indigo-500" },
                { icon: MessageSquareText, label: "Narrative", desc: "NLP-derived insight.", color: "text-emerald-500" },
                { icon: CheckCircle2, label: "Validated", desc: "Confirmed by human or market action.", color: "text-emerald-500" },
                { icon: List, label: "Watchlist", desc: "Custom asset monitoring group.", color: "text-slate-500" },
                { icon: Activity, label: "Volatility", desc: "Price variance detected.", color: "text-indigo-500" },
                { icon: Search, label: "Search", desc: "Global asset lookup.", color: "text-slate-500" },
                { icon: History, label: "History", desc: "Guidance and Promise tracking.", color: "text-blue-500" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 hover:border-slate-200 transition-colors">
                  <item.icon className={`shrink-0 ${item.color}`} size={20} />
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{item.label}</div>
                    <div className="text-xs text-slate-500 leading-tight mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'nav' && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-slate-500 text-sm">1</div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Signal Dashboard</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Your command center. The <strong>Feed</strong> (left) shows real-time volume anomalies. Click any signal to open the <strong>Deep Dive</strong> (right), where AI generates hypotheses and analyzes risk factors.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                 <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-slate-500 text-sm">2</div>
                 <div>
                   <h4 className="font-bold text-slate-900 dark:text-white text-sm">Watchlist Manager</h4>
                   <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                     Create custom lists to track specific sectors (e.g., "Semiconductors"). Use the global <strong>Search</strong> (bottom right) to quickly add assets to your active watchlist.
                   </p>
                 </div>
               </div>

               <div className="flex gap-4">
                 <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-slate-500 text-sm">3</div>
                 <div>
                   <h4 className="font-bold text-slate-900 dark:text-white text-sm">Contradiction Engine</h4>
                   <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                     A timeline of broken promises. This view compares statements from 10-Qs, 8-Ks, and earnings calls to highlight logical inconsistencies. Use the <strong>Validate</strong> button to confirm findings.
                   </p>
                 </div>
               </div>

               <div className="flex gap-4">
                 <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-slate-500 text-sm">4</div>
                 <div>
                   <h4 className="font-bold text-slate-900 dark:text-white text-sm">Narrative Engine (Chat)</h4>
                   <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                     Direct interface to the LLM. Ask complex queries like <em>"Analyze the tone shift in NVDA's last 10-K vs the previous year"</em> or <em>"Why is TSLA volume spiking today?"</em>.
                   </p>
                 </div>
               </div>

               <div className="flex gap-4">
                 <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-slate-500 text-sm">5</div>
                 <div>
                   <h4 className="font-bold text-slate-900 dark:text-white text-sm">Ticker Deep Dive</h4>
                   <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                     Accessible by clicking any ticker in Dashboard or Watchlist. Contains the <strong>Guidance Ledger</strong> (tracking broken/kept promises), <strong>Contradiction History</strong>, and real-time <strong>Order Flow Anomaly Scans</strong>.
                   </p>
                 </div>
               </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-[#2d2d31] bg-slate-50 dark:bg-[#121214] shrink-0">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-black font-bold rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
