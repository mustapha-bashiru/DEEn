
import React from 'react';
import { User, UserProgress, Sect } from '../types';
import { Language, translations } from '../translations';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  user: User | null;
  progress: UserProgress;
  onLogout: () => void;
  onOpenAuth: () => void;
  onOpenNews: () => void;
  onOpenLive: () => void;
  onOpenMap: () => void;
  currentSect: Sect;
  currentView: string;
  onNavigate: (view: 'chat' | 'bookmarks' | 'quran' | 'arts' | 'live') => void;
  onUtilityAction: (action: 'notifications' | 'settings' | 'share' | 'rate') => void;
  hasNotifications: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, onClose, lang, user, progress, onLogout, onOpenAuth, onOpenNews, onOpenLive, onOpenMap, currentSect, currentView, onNavigate, onUtilityAction, hasNotifications 
}) => {
  const t = translations[lang];

  const brandColor = currentSect === 'Sunni' ? 'bg-emerald-800' : 'bg-teal-900';
  const xpColor = currentSect === 'Sunni' ? 'bg-emerald-500' : 'bg-teal-500';

  const NavItem = ({ icon, label, onClick, active, colorClass = "" }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center space-x-4 px-4 py-3.5 rounded-2xl transition-all group ${active ? 'bg-stone-100 shadow-sm border border-stone-200/50' : 'hover:bg-stone-50'}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active ? (currentSect === 'Sunni' ? 'bg-emerald-800 text-white shadow-lg' : 'bg-teal-900 text-white shadow-lg') : 'bg-stone-50 group-hover:bg-white text-stone-400 group-hover:text-stone-600'} ${colorClass}`}>
        <i className={`fas ${icon} text-sm ${active ? 'scale-110' : ''}`}></i>
      </div>
      <span className={`text-sm font-bold ${active ? 'text-stone-900' : 'text-stone-600'}`}>{label}</span>
      {active && <div className={`ml-auto w-1.5 h-1.5 rounded-full ${currentSect === 'Sunni' ? 'bg-emerald-500' : 'bg-teal-500'}`}></div>}
    </button>
  );

  const UtilityItem = ({ icon, label, onClick, badge, colorClass = "" }: any) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all hover:bg-stone-100 group"
    >
      <div className="flex items-center space-x-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-stone-50 group-hover:bg-white group-hover:shadow-md border border-stone-100 ${colorClass}`}>
          <i className={`fas ${icon} text-xs`}></i>
        </div>
        <span className="text-xs font-bold text-stone-700 tracking-tight group-hover:text-stone-900">{label}</span>
      </div>
      {badge && <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">{badge}</span>}
    </button>
  );

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/40 z-[70] backdrop-blur-sm transition-opacity" onClick={onClose} />}
      
      <aside className={`fixed top-0 bottom-0 left-0 w-80 bg-white shadow-2xl flex flex-col z-[80] transform transition-transform duration-500 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 border-b flex flex-col items-center text-center space-y-4">
          <div className="relative group">
            <div className={`w-20 h-20 rounded-[2rem] ${user ? brandColor : 'bg-stone-200'} flex items-center justify-center text-white border-4 border-stone-50 shadow-xl overflow-hidden transition-all group-hover:rotate-3`}>
              {user ? (
                <span className="text-2xl font-black">{user.name.charAt(0).toUpperCase()}</span>
              ) : (
                <i className="fas fa-user-secret text-2xl text-stone-400"></i>
              )}
            </div>
            {user && (
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-xl border shadow-lg flex items-center justify-center text-amber-600">
                <i className="fas fa-crown text-[10px]"></i>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-base font-black text-stone-900 leading-tight">{user ? user.name : 'Guest Seeker'}</h3>
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] mt-1 ${currentSect === 'Sunni' ? 'text-emerald-600' : 'text-teal-600'}`}>
              Level {progress.level} Student
            </p>
          </div>

          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-[9px] font-black text-stone-400 uppercase">
              <span>XP Journey</span>
              <span>{Math.floor((progress.xp % 1750) / 17.5)}%</span>
            </div>
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden border">
              <div className={`h-full ${xpColor} transition-all duration-1000`} style={{ width: `${(progress.xp % 1750) / 17.5}%` }}></div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 custom-scrollbar">
          <section className="space-y-1">
            <NavItem icon="fa-message" label="Inquiry" onClick={() => onNavigate('chat')} active={currentView === 'chat'} />
            <NavItem icon="fa-book-quran" label="Quran Explorer" onClick={() => onNavigate('quran')} active={currentView === 'quran'} />
            <NavItem icon="fa-palette" label="Sacred Arts" onClick={() => onNavigate('arts')} active={currentView === 'arts'} />
            <NavItem icon="fa-bookmark" label="Wisdom Library" onClick={() => onNavigate('bookmarks')} active={currentView === 'bookmarks'} />
          </section>

          <section className="space-y-1 pt-4 border-t border-stone-100">
            <div className="px-4 mb-2 text-[8px] font-black text-stone-400 uppercase tracking-widest">Knowledge Stream</div>
            <UtilityItem icon="fa-rss" label="Latest Muslim News" onClick={onOpenNews} colorClass="text-purple-600" />
            <UtilityItem icon="fa-tower-broadcast" label="Live Majlis" onClick={onOpenLive} colorClass="text-emerald-600" />
            <UtilityItem icon="fa-map-location-dot" label="Nearby Mosques" onClick={onOpenMap} colorClass="text-amber-600" />
          </section>

          <section className="space-y-1 pt-4 border-t border-stone-100">
            <div className="px-4 mb-2 text-[8px] font-black text-stone-400 uppercase tracking-widest">Preferences</div>
            <UtilityItem icon="fa-bell" label="Notifications" badge={hasNotifications ? "1" : undefined} onClick={() => onUtilityAction('notifications')} colorClass="text-blue-500" />
            <UtilityItem icon="fa-gear" label="Settings" onClick={() => onUtilityAction('settings')} colorClass="text-stone-500" />
            <UtilityItem icon="fa-share-nodes" label="Share App" onClick={() => onUtilityAction('share')} colorClass="text-stone-500" />
            <UtilityItem icon="fa-star" label="Rate the Sanctuary" onClick={() => onUtilityAction('rate')} colorClass="text-stone-500" />
          </section>
        </div>

        <div className="p-6 border-t bg-stone-50">
          {user ? (
            <button 
              onClick={onLogout}
              className="w-full flex items-center justify-center space-x-3 py-3 rounded-2xl bg-white border border-red-100 text-red-500 text-xs font-bold hover:bg-red-50 transition-all shadow-sm"
            >
              <i className="fas fa-sign-out-alt"></i>
              <span>{t.logout}</span>
            </button>
          ) : (
            <button 
              onClick={onOpenAuth}
              className="w-full py-3.5 rounded-2xl bg-emerald-900 text-white text-xs font-bold shadow-xl shadow-emerald-900/20 active:scale-95 transition-all"
            >
              Sign In to Sanctuary
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
