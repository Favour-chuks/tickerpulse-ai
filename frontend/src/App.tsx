import React, { useState, useEffect} from 'react';
import { 
  Routes, 
  Route, 
  Navigate, 
  useLocation,
  Outlet,
  useNavigate 
} from 'react-router-dom';
import { 
  List, 
  Bell,
  Settings,
  Menu,
  Zap,
  Search,
  MessageSquareText,
  AlertTriangle,
  LogOut,
  LayoutDashboard,
  X,
  HelpCircle,
  ChevronUp,
  User as UserIcon
} from 'lucide-react';

import DashboardView from './features/dashboard/components/DashboardView';
import WatchlistView from './features/watchlist/components/WatchlistView';
import NLPView from './features/intelligence/components/NLPView';
import AlertsView from './features/alerts/components/AlertsView';
import SettingsView from './features/settings/components/SettingsView';
import ContradictionView from './features/intelligence/components/ContradictionView';
import AuthPage from './features/auth/components/AuthPage';
import { AuthCallback } from './features/auth/components/AuthCallback';
import TickerDetail from './features/market/components/TickerDetail';
import { SearchModal } from './features/market/components/SearchModal';

import { HelpModal } from './shared/components/HelpModal';
import { ConnectionBanner } from './shared/components/ConnectionBanner';
import { useAuthStore } from './features/auth/store/authStore';
import { useConnectionStore } from './shared/store/connectionStore';
import { NotificationService } from './shared/services/notifications';
import { SyncService } from './shared/services/syncService';
import { api } from './shared/services/api';
import { alertsSocket, marketSocket } from './shared/services/websocketService';
import { User, Ticker } from './shared/types';

const useSmartNavigation = () => {
  const navigate = useNavigate();

  const navigateToSection = (path: string) => {
    navigate(path, { replace: true });
  };

  const navigateToDetail = (path: string) => {
    navigate(path);
  };

  const navigateToAuth = (path: string) => {
    navigate(path, { replace: true });
  };

  return { navigateToSection, navigateToDetail, navigateToAuth };
};

// --- PROTECTED ROUTE WRAPPER ---

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { isAuthenticated, isInitialized } = useAuthStore();
  
  if (!isInitialized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-[#09090b]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

// --- LAYOUT COMPONENT ---
const AppLayout = () => {
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  const location = useLocation();
  const { navigateToSection, navigateToDetail } = useSmartNavigation();

  const handleAddTicker = async (t: { id: number, symbol: string }) => {
    try {
      const { watchlists } = await api.watchlist.getAll();
      if (watchlists.length > 0) {
        await api.watchlist.addItem(watchlists[0].id, t.symbol);
      }
    } catch (e) { 
      console.error(e); 
    }
    
    navigateToDetail(`/ticker/${t.symbol}`);
    setIsSearchOpen(false);
  };

  const handleTickerSelect = (t: Ticker) => {
    navigateToDetail(`/ticker/${t.symbol}`);
  };

  const handleLogoClick = () => {
    navigateToSection('/');
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
  };

  const NavItem = ({ to, label, icon: Icon }: { to: string, label: string, icon: any }) => {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      setSidebarOpen(false);
      navigateToSection(to);
    };

    return (
      <a
        href={to}
        onClick={handleClick}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          location.pathname === to
            ? 'bg-brand-50/50 dark:bg-brand-900/10 text-brand-700 dark:text-brand-300 shadow-sm border border-brand-100 dark:border-brand-500/10' 
            : 'text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-800/50'
        }`}
      >
        <Icon size={18} className={location.pathname === to ? 'text-brand-600 dark:text-brand-400' : 'opacity-70'} />
        {label}
      </a>
    );
  };

  const isChatView = location.pathname === '/narratives';

  return (
    <div className="h-screen w-full flex flex-col bg-transparent text-slate-900 dark:text-zinc-200 font-sans overflow-hidden transition-colors duration-200 selection:bg-brand-500/20">
      <ConnectionBanner />
      
      <div className="flex-1 flex overflow-hidden">
        <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onAdd={handleAddTicker} />
        <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

        {/* Mobile Top Nav */}
        <div className="md:hidden fixed top-0 w-full flex items-center justify-between p-4 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 z-50 mt-[32px] md:mt-0">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleLogoClick}>
            <Zap size={20} className="text-brand-600 dark:text-brand-500 fill-brand-600 dark:fill-brand-500" />
            <span className="font-bold text-lg text-slate-900 dark:text-white">TickerPulse</span>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setIsSearchOpen(true)} className="p-2 text-slate-500 dark:text-zinc-400">
               <Search size={20} />
             </button>
             <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-500 dark:text-zinc-400">
               {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
             </button>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <aside className={`
          fixed inset-y-0 left-0 w-72 bg-white/50 dark:bg-[#09090b] backdrop-blur-xl border-r border-slate-200 dark:border-[#212124] flex flex-col z-[60] transition-transform duration-300 md:relative md:translate-x-0 md:h-full overflow-y-auto custom-scrollbar
          ${sidebarOpen ? 'translate-x-0 shadow-2xl shadow-black/20' : '-translate-x-full'}
        `}>
          <div className="p-6">
            <div className="hidden md:flex items-center gap-3 mb-8 cursor-pointer pl-2 group" onClick={handleLogoClick}>
               <div className="w-8 h-8 rounded-lg bg-brand-600 dark:bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
                 <Zap size={16} className="text-white fill-white" />
               </div>
               <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">TickerPulse</span>
            </div>

            <div className="mb-4 px-2 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Platform</div>
            <nav className="space-y-1">
              <NavItem to="/" label="Dashboard" icon={LayoutDashboard} />
              <NavItem to="/watchlist" label="Watchlists" icon={List} />
              <NavItem to="/alerts" label="Alerts" icon={Bell} />
            </nav>

            <div className="mt-8 mb-4 px-2 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Intelligence</div>
            <nav className="space-y-1">
              <NavItem to="/contradictions" label="Contradictions" icon={AlertTriangle} />
              <NavItem to="/narratives" label="Narrative Engine" icon={MessageSquareText} />
            </nav>
          </div>

          <div className="mt-auto p-4 border-t border-slate-200 dark:border-white/5 bg-white/50 dark:bg-transparent relative">
             {isUserMenuOpen && (
               <div className="absolute bottom-[130px] left-4 right-4 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
                 <button 
                   onClick={() => { 
                     navigateToSection('/settings'); 
                     setIsUserMenuOpen(false); 
                   }}
                   className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                 >
                   <UserIcon size={16} className="text-slate-400" /> Edit Profile
                 </button>
                 <div className="h-px bg-slate-100 dark:bg-white/5 mx-2" />
                 <button 
                   onClick={handleLogout}
                   className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                 >
                   <LogOut size={16} /> Log Out
                 </button>
               </div>
             )}

             <div 
               onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
               className={`
                 flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 group border border-transparent 
                 ${isUserMenuOpen ? 'bg-white dark:bg-[#18181b] shadow-md border-slate-200 dark:border-white/10' : 'hover:bg-white dark:hover:bg-zinc-800/50 hover:border-slate-200 dark:hover:border-white/5 shadow-sm hover:shadow-md'}
               `}
             >
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center font-medium text-sm text-slate-600 dark:text-zinc-300 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">
                   {user.avatarUrl ? (
                     <img src={user.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                   ) : (
                     user?.firstName?.[0] || 'U'
                   )}
                </div>
                <div className="flex-1 min-w-0">
                   <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.firstName || 'User'} {user?.lastName}</div>
                   <div className="text-xs text-slate-500 dark:text-zinc-500 truncate">{user?.email}</div>
                </div>
                <ChevronUp size={16} className={`text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180 text-brand-600 dark:text-brand-400' : ''}`} />
             </div>
             
             <div className="flex items-center gap-1 mt-2">
               <button 
                 onClick={() => navigateToSection('/settings')}
                 className="flex-1 flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-300 transition-colors"
               >
                 <Settings size={14} /> Settings
               </button>
               <div className="w-px h-4 bg-slate-200 dark:bg-zinc-800"></div>
               <button 
                 onClick={() => setIsHelpOpen(true)}
                 className="flex-1 flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-300 transition-colors"
               >
                 <HelpCircle size={14} /> Help
               </button>
             </div>
          </div>
        </aside>

        {/* Content Canvas */}
        <main className="flex-1 h-full overflow-hidden flex flex-col relative pt-16 md:pt-0">
          <div className={`flex-1 ${isChatView ? 'p-0 md:p-6 lg:p-8 overflow-hidden' : 'p-4 md:p-6 lg:p-8 overflow-y-auto custom-scrollbar'}`}>
            <div className="max-w-[1600px] mx-auto h-full flex flex-col">
              <Outlet context={{ handleTickerSelect }} />
            </div>
          </div>
        </main>

        {/* Desktop Search FAB */}
        {!isChatView && (
          <div className="hidden md:block fixed bottom-8 right-8 z-[70]">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="w-12 h-12 rounded-2xl bg-brand-600 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all ring-4 ring-white dark:ring-[#09090b]"
            >
              <Search size={20} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
  const { user, isAuthenticated, isInitialized, initialize, setUser, token } = useAuthStore();
  
  const { setOnline, setSocketConnected } = useConnectionStore();
  const [settingsSection, setSettingsSection] = useState<'main' | 'profile'>('main');

  useEffect(() => {
    initialize();

    const handleOnline = () => {
      setOnline(true);
      SyncService.processQueue().then(() => {
        NotificationService.sendNotification('Connection Restored', 'Offline changes have been synced to the cloud.');
      });
    };
    
    const handleOffline = () => {
      setOnline(false);
      setSocketConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if (!navigator.onLine) setOnline(false);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  useEffect(() => {
    if (user) {
      NotificationService.requestPermission();
      NotificationService.simulateBackgroundAlerts();
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated && user && token) {
      alertsSocket.connect(token);
      marketSocket.connect(token);
    } else {
      alertsSocket.disconnect();
      marketSocket.disconnect();
    }
    
    return () => {
      alertsSocket.disconnect();
      marketSocket.disconnect();
    };
  }, [isAuthenticated, user, token]);

  const handleUpdateProfile = (updatedUser: User) => {
    setUser(updatedUser); 
  };

  if (!isInitialized) return null;

  const TickerHandlerWrapper = ({ children }: { children: (handler: (t: Ticker) => void) => React.ReactNode }) => {
    const { navigateToDetail } = useSmartNavigation();
    const handleSelect = (t: Ticker) => navigateToDetail(`/ticker/${t.symbol}`);
    return <>{children(handleSelect)}</>;
  };

  return (
    <Routes>
      <Route path="/auth" element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/auth-success" element={<AuthCallback />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Protected Routes */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={
          <TickerHandlerWrapper>
            {(handleSelect) => <DashboardView onSelectTicker={handleSelect} onOpenSearch={() => {}} />}
          </TickerHandlerWrapper>
        } />
        <Route path="/watchlist" element={
          <TickerHandlerWrapper>
            {(handleSelect) => <WatchlistView onSelectTicker={handleSelect} />}
          </TickerHandlerWrapper>
        } />
        <Route path="/alerts" element={
          <TickerHandlerWrapper>
           {(handleSelect) =>  <AlertsView onSelectTicker={handleSelect}/>}
          </TickerHandlerWrapper>
          } />
        <Route path="/contradictions" element={<ContradictionView onAddToWatchlist={() => {}} />} />
        <Route path="/narratives" element={<NLPView userAvatar={user?.avatarUrl}/>} />
        <Route path="/ticker/:symbol" element={<TickerDetail />} />
        <Route path="/settings" element={
          <SettingsView 
            user={user as User} 
            onLogout={() => useAuthStore.getState().logout()} 
            section={settingsSection}
            onSectionChange={setSettingsSection}
            onUpdateProfile={handleUpdateProfile}
          />
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;