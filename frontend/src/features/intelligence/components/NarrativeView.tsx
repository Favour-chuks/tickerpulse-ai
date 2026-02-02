
import React, { useState, useEffect } from 'react';
import { 
  History, 
  MessageSquare, 
  ChevronRight, 
  CheckCircle2, 
  Clock,
  ExternalLink,
  Target
} from 'lucide-react';
import { Narrative } from '../../../shared/types';
import { api } from '../../../shared/services/api';

const MOCK_NARRATIVES: Narrative[] = [
  { 
    id: 1, 
    tickerSymbol: 'AAPL', 
    filingType: '10-Q', 
    filedAt: '2025-05-15', 
    summary: 'Focus shifted from hardware margins to ecosystem service growth. Heavy emphasis on AI hardware integration.',
    toneShift: 'Cautiously Bullish',
    managementConfidence: 8,
    keyChanges: ['Infrastructure CapEx +12%', 'R&D allocation for generative AI tripled', 'Supply chain pivot to Southeast Asia']
  },
];

const NarrativeView: React.FC = () => {
  const [narratives, setNarratives] = useState<Narrative[]>(MOCK_NARRATIVES);
  // Default to a major ticker for the overview, or this could come from a selected state
  const defaultTicker = 'NVDA'; 

  useEffect(() => {
    const load = async () => {
      try {
        // Backend requires a ticker symbol to fetch timeline
        const data = await api.narratives.getTimeline(defaultTicker);
        if(Array.isArray(data) && data.length > 0) setNarratives(data);
      } catch (e) {
        // Fallback to mock
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
          <History className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Narrative Timeline: {defaultTicker}</h2>
          <p className="text-sm text-slate-500">Tracking evolutions in management sentiment across SEC filings.</p>
        </div>
      </div>

      <div className="max-w-4xl space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 dark:before:from-[#212124] before:via-slate-200 dark:before:via-[#212124] before:to-transparent">
        {narratives.map((n, idx) => (
          <div key={n.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            {/* Dot */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-[#212124] bg-white dark:bg-[#0a0a0b] text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors group-hover:border-indigo-500 group-hover:text-indigo-400">
               <Clock className="w-5 h-5" />
            </div>

            {/* Card */}
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#212124] shadow-sm hover:border-indigo-500/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <time className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-tighter">
                  {new Date(n.filedAt).toLocaleDateString()}
                </time>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1c1c1f] text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#2d2d31]">
                    {n.filingType}
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{n.tickerSymbol} Ecosystem Pivot</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                {n.summary}
              </p>

              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-[#1c1c1f] p-4 rounded-lg border border-slate-100 dark:border-[#2d2d31]">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Signal: {n.toneShift}</span>
                  </div>
                  {n.keyChanges && n.keyChanges.length > 0 && (
                    <div className="space-y-2">
                      {n.keyChanges.map((change, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{change}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500">MGT_CONFIDENCE</div>
                  <div className="flex gap-1">
                    {[...Array(10)].map((_, i) => (
                      <div key={i} className={`w-3 h-1.5 rounded-sm ${i < n.managementConfidence ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-[#212124]'}`}></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NarrativeView;
