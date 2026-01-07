
import React, { useState } from 'react';
import { ChatSession, User, UserProgress } from '../types';
import { Language, translations } from '../translations';

interface SidebarProps {
  lang: Language;
  user: User | null;
  progress: UserProgress;
  onLogout: () => void;
  onOpenAuth: () => void;
  onOpenLegacy: () => void;
  onOpenLive: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onShowBookmarks: () => void;
  onShowQuran: () => void;
  onShowArts: () => void;
  onShowDiscovery: () => void;
  onOpenMap: () => void;
  activeView: 'chat' | 'bookmarks' | 'quran' | 'arts' | 'live';
}

const Sidebar: React.FC<SidebarProps> = ({ 
  lang, user, progress, onLogout, onOpenAuth, onOpenLegacy, onOpenLive,
  sessions, activeSessionId, onSelectSession, 
  onNewSession, onDeleteSession, onShowBookmarks, 
  onShowQuran, onShowArts, onShowDiscovery, onOpenMap, activeView 
}) => {
  const [isArchiveOpen, setIsArchiveOpen] = useState(true);
  const t = translations[lang];

  const NavItem = ({ icon, label, isActive, onClick, badge, colorClass = "", locked = false }: any) => (
    <button
      onClick={locked ? undefined : onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
        isActive 
          ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/10' 
          : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className={`w-5 h-5 flex items-center justify-center ${isActive ? 'text-emerald-400' : 'group-hover:text-emerald-400'} ${colorClass}`}>
          <i className={`fas ${icon} text-sm`}></i>
        </div>
        <span className={`text-sm font-semibold tracking-tight ${isActive ? 'font-bold' : ''}`}>{label}</span>
      </div>
      {badge && <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">{badge}</span>}
    </button>
  );

  return (
    <aside className="w-72 bg-stone-950 text-stone-300 flex flex-col h-full border-r border-stone-900 shadow-2xl relative z-[80]">
      <div className="p-6 border-b border-stone-900 bg-stone-950/50">
        <div className="flex items-center space-x-4 mb-6">
          {user ? (
            <div className="w-12 h-12 rounded-2xl bg-emerald-900 flex items-center justify-center text-white border border-emerald-500/30">
              <span className="font-bold text-lg">{user.name.charAt(0).toUpperCase()}</span>
            </div>
          ) : (
            <button onClick={onOpenAuth} className="w-12 h-12 rounded-2xl bg-stone-900 hover:bg-emerald-900 flex items-center justify-center text-white border border-white/10 transition-colors">
              <i className="fas fa-user-plus text-sm"></i>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{user ? user.name : t.studentOfKnowledge}</h3>
            <p className="text-[10px] font-black text-[#c5a059] uppercase tracking-widest mt-0.5">{user ? `Level ${progress.level}` : t.authSignIn}</p>
          </div>
        </div>
        <div className="h-1.5 w-full bg-stone-900 rounded-full overflow-hidden border border-white/5">
          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress.xp % 100}%` }}></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar space-y-8">
        <section className="space-y-1.5">
          <NavItem icon="fa-message" label={t.activeInquiries} isActive={activeView === 'chat'} onClick={onNewSession} />
          <NavItem icon="fa-tower-broadcast" label="Live Majlis" isActive={activeView === 'live'} onClick={onOpenLive} colorClass="text-emerald-400" badge="LIVE" />
          <NavItem icon="fa-map-location-dot" label="Sanctuary Map" onClick={onOpenMap} colorClass="text-blue-400" />
          <NavItem icon="fa-bookmark" label={t.wisdomLibrary} isActive={activeView === 'bookmarks'} onClick={onShowBookmarks} />
        </section>

        <section className="space-y-4">
          <div className="px-4 text-[10px] font-black text-stone-600 uppercase tracking-[0.2em]">Study Pad</div>
          <div className="space-y-1.5">
            <NavItem icon="fa-pen-fancy" label={t.legacyOfKnowledge} onClick={onOpenLegacy} colorClass="text-amber-500" />
            <NavItem icon="fa-book-quran" label={t.quranExplorer} isActive={activeView === 'quran'} onClick={onShowQuran} colorClass="text-emerald-400" />
            <NavItem icon="fa-palette" label={t.sacredArts} isActive={activeView === 'arts'} onClick={onShowArts} colorClass="text-purple-400" />
            <NavItem icon="fa-rss" label={t.scholarlyNews} onClick={onShowDiscovery} colorClass="text-blue-400" badge="NEW" />
          </div>
        </section>

        {sessions.length > 1 && (
          <section className="space-y-4">
            <div className="px-4 text-[10px] font-black text-stone-600 uppercase tracking-[0.2em]">{t.recentArchive}</div>
            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar px-1">
              {sessions.slice(0, 5).map(s => (
                <button 
                  key={s.id} 
                  onClick={() => onSelectSession(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs truncate transition-all ${activeSessionId === s.id ? 'bg-white/5 text-emerald-400' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900'}`}
                >
                  <i className="fas fa-file-invoice mr-2 opacity-30 text-[10px]"></i>
                  {s.title}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="mt-auto p-4 border-t border-stone-900 space-y-2">
        {user && <NavItem icon="fa-sign-out-alt" label={t.logout} onClick={onLogout} colorClass="text-red-400/70" />}
      </div>
    </aside>
  );
};

export default Sidebar;
