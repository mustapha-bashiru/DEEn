
import React, { useState } from 'react';
import { ChatSession, User } from '../types';

interface SidebarProps {
  user: User | null;
  onLogout: () => void;
  onOpenAuth: () => void;
  onOpenDiscovery: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onShowBookmarks: () => void;
  onShowQuran: () => void;
  onShowArts: () => void;
  activeView: 'chat' | 'bookmarks' | 'quran' | 'arts';
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, onOpenAuth, onOpenDiscovery, sessions, activeSessionId, onSelectSession, onNewSession, onDeleteSession, onShowBookmarks, onShowQuran, onShowArts, activeView }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getGroupedSessions = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;

    return {
      today: filteredSessions.filter(s => s.createdAt >= today),
      yesterday: filteredSessions.filter(s => s.createdAt >= yesterday && s.createdAt < today),
      earlier: filteredSessions.filter(s => s.createdAt < yesterday)
    };
  };

  const groups = getGroupedSessions();

  const SessionItem = ({ session }: { session: ChatSession; key?: string }) => (
    <div 
      className={`group flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200 mb-1 ${
        activeSessionId === session.id && activeView === 'chat'
          ? 'bg-emerald-800/20 text-emerald-100 border-l-4 border-emerald-500 ring-1 ring-white/5' 
          : 'hover:bg-stone-800/50 text-stone-400'
      }`}
      onClick={() => onSelectSession(session.id)}
    >
      <div className="flex items-center space-x-3 overflow-hidden">
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border transition-colors ${
          session.sect === 'Sunni' 
            ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50' 
            : 'bg-teal-900/30 text-teal-400 border-teal-800/50'
        }`}>
          {session.madhab === 'General' ? session.sect[0] : session.madhab.substring(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate font-medium">{session.title || 'Untitled Inquiry'}</p>
          <p className="text-[9px] opacity-50 font-bold uppercase tracking-tighter">
            {new Date(session.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onDeleteSession(session.id);
        }}
        className="opacity-0 group-hover:opacity-100 text-stone-600 hover:text-red-400 p-1.5 transition-all rounded-lg hover:bg-red-400/10"
      >
        <i className="fas fa-trash-alt text-xs"></i>
      </button>
    </div>
  );

  return (
    <aside className="w-72 bg-stone-950 text-stone-300 flex flex-col h-full border-r border-stone-800 hidden md:flex">
      {/* Top Header Section */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <button 
            onClick={onNewSession}
            className="flex-shrink-0 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl h-11 px-4 flex items-center justify-center transition-all duration-200 shadow-lg shadow-emerald-900/20 active:scale-[0.95]"
            title="New Inquiry"
          >
            <i className="fas fa-plus text-sm"></i>
          </button>
          <div className="flex-1 relative group">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-emerald-500 transition-colors text-xs"></i>
            <input 
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-9 h-11 text-xs text-stone-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <button 
            onClick={onShowQuran}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
              activeView === 'quran' 
                ? 'bg-teal-900/30 border-teal-800/50 text-teal-400 shadow-inner shadow-teal-900/40' 
                : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-200 hover:border-stone-700'
            }`}
          >
            <i className="fas fa-book-open text-sm"></i>
            <span className="font-bold text-sm">Quran Explorer</span>
          </button>

          <button 
            onClick={onShowBookmarks}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
              activeView === 'bookmarks' 
                ? 'bg-emerald-900/30 border-emerald-800/50 text-emerald-400 shadow-inner shadow-emerald-900/40' 
                : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-200 hover:border-stone-700'
            }`}
          >
            <i className="fas fa-scroll text-sm"></i>
            <span className="font-bold text-sm">Wisdom Library</span>
          </button>

          {/* Consolidated What's New Hub with both Icons */}
          <button 
            onClick={onOpenDiscovery}
            className="flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 group"
          >
            <div className="flex items-center space-x-3">
              <i className="fas fa-sparkles animate-pulse text-sm"></i>
              <span className="font-bold text-sm">What's New?</span>
            </div>
            <div className="flex items-center space-x-2">
              <i className="fas fa-palette text-[10px] opacity-60 group-hover:opacity-100 transition-opacity"></i>
              <i className="fab fa-x-twitter text-[10px] opacity-60 group-hover:opacity-100 transition-opacity"></i>
              <span className="bg-amber-500 text-stone-950 text-[7px] px-1 rounded font-black shadow-sm">PRO</span>
            </div>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
        {groups.today.length > 0 && (
          <div className="mb-6">
            <div className="px-3 py-2 text-[10px] font-black text-stone-600 uppercase tracking-[0.2em] mb-1">Today</div>
            {groups.today.map(s => <SessionItem key={s.id} session={s} />)}
          </div>
        )}
        
        {groups.yesterday.length > 0 && (
          <div className="mb-6">
            <div className="px-3 py-2 text-[10px] font-black text-stone-600 uppercase tracking-[0.2em] mb-1">Yesterday</div>
            {groups.yesterday.map(s => <SessionItem key={s.id} session={s} />)}
          </div>
        )}

        {groups.earlier.length > 0 && (
          <div className="mb-6">
            <div className="px-3 py-2 text-[10px] font-black text-stone-600 uppercase tracking-[0.2em] mb-1">Older Inquiries</div>
            {groups.earlier.map(s => <SessionItem key={s.id} session={s} />)}
          </div>
        )}

        {filteredSessions.length === 0 && (
          <div className="text-center py-10 opacity-30">
            <i className="fas fa-search mb-3 text-2xl"></i>
            <p className="text-xs font-bold uppercase tracking-widest">No history found</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-stone-900 mt-auto bg-stone-950/80 backdrop-blur-sm space-y-3">
        {user ? (
          <div className="group relative bg-stone-900/60 p-3 rounded-xl border border-stone-800 flex items-center space-x-3 transition-all">
            <div className="w-9 h-9 rounded-full bg-emerald-950 flex items-center justify-center text-emerald-400 border border-emerald-900/50 shadow-inner">
              <span className="font-bold text-xs">{user.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-stone-200 truncate">{user.name}</p>
              <div className="flex items-center space-x-2">
                 <span className="text-[9px] text-stone-500 truncate">{user.email}</span>
                 <span className="text-[7px] text-amber-500 font-black border border-amber-900/50 px-1 rounded">PRO</span>
              </div>
            </div>
            <button 
             onClick={onLogout}
             className="p-2 text-stone-600 hover:text-red-400 transition-colors"
             title="Sign Out"
            >
              <i className="fas fa-sign-out-alt text-xs"></i>
            </button>
          </div>
        ) : (
          <div className="flex flex-col space-y-2">
            <div className="bg-stone-900/40 p-3 rounded-xl border border-stone-800/50 flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center text-stone-500 border border-stone-700">
                <i className="fas fa-user text-xs"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-stone-400 truncate">Student of Knowledge</p>
                <p className="text-[9px] text-stone-600 truncate italic">Not synced</p>
              </div>
            </div>
            <button 
              onClick={onOpenAuth}
              className="w-full bg-white/5 hover:bg-white/10 text-emerald-500 border border-emerald-900/30 rounded-lg py-2 text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Sign In to Sync
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
