
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { api } from '../../../shared/services/api';
import { Message } from '../../../shared/types';
import { useAuthStore } from '@/store/authStore';

interface NLPVIEWPROPS {
  userAvatar: string;
}
const NLPView: React.FC<NLPVIEWPROPS> = ({ userAvatar }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', role: 'model', text: 'Hi I’m Aura your TickerPulse analyst. I can help you break down ticker performance, compare market trends, or dig into why a specific stock is acting up right now. What are we looking at today?', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const historyForApi = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      const response = await api.analyse.sendMessage(userMsg.text, historyForApi as any);
      
      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.response || 'Analysis complete.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, modelMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: 'Connection to neural engine failed. Please try again.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#18181b] md:rounded-2xl rounded-none overflow-hidden animate-in fade-in duration-500 shadow-sm md:border border-slate-200 dark:border-[#2d2d31]">
      <div className="px-4 md:px-6 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-[#18181b] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Narrative Engine</h3>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              <span className="text-xs text-slate-500 dark:text-zinc-500">Online</span>
            </div>
          </div>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 scroll-smooth"
      >
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`
              max-w-[90%] md:max-w-[75%] flex items-start gap-3
              ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}
            `}>
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                ${msg.role === 'user' ? 'bg-slate-200 dark:bg-zinc-700' : 'bg-indigo-50 dark:bg-indigo-500/10'}
              `}>
                {msg.role === 'user' ? (
                  userAvatar ? (
                    <img 
                      src={userAvatar} 
                      alt="Avatar" 
                      className="w-full h-full rounded-full object-cover" 
                    />
                  ) : (
                    <User className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
                  )
                ) : (
                  <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
              <div className={`
                px-5 py-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm
                ${msg.role === 'user' 
                  ? 'bg-slate-100 dark:bg-zinc-700 text-slate-900 dark:text-white rounded-tr-sm' 
                  : 'bg-white dark:bg-[#27272a] border border-slate-100 dark:border-none text-slate-700 dark:text-zinc-200 rounded-tl-sm'}
              `}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="ml-11 bg-white dark:bg-[#27272a] px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2 shadow-sm border border-slate-100 dark:border-none">
               <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
               <span className="text-xs text-slate-500 dark:text-zinc-500">Thinking...</span>
             </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white dark:bg-[#18181b] border-t border-slate-200 dark:border-white/5 shrink-0 pb-safe">
        <div className="bg-slate-100 dark:bg-[#27272a] rounded-xl p-2 flex items-center gap-2 transition-colors">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Analyze volume spikes, contradictions..." 
            className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-zinc-500 px-3 h-10"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 bg-white dark:bg-zinc-100 hover:bg-slate-50 dark:hover:bg-white text-slate-900 dark:text-black p-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NLPView;
