
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
  onOpenMap: (query: string) => void;
  currentSect: Sect;
  currentView: string;
  onNavigate: (view: 'chat' | 'bookmarks' | 'quran' | 'arts' | 'live') => void;
  onNewInquiry: () => void;
  onUtilityAction: (action: 'notifications' | 'settings' | 'share' | 'rate') => void;
  hasNotifications: boolean;
  themeMode: 'system' | 'light' | 'dark';
  onThemeChange: (mode: 'system' | 'light' | 'dark') => void;
  onLegacyLesson: () => void;
  setLang: (l: Language) => void;
  locationName: string | null;
  onRefreshLocation: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, onClose, lang, user, progress, onLogout, onOpenAuth, onOpenNews, onOpenLive, onOpenMap, currentSect, currentView, onNavigate, onNewInquiry, onUtilityAction, hasNotifications, themeMode, onThemeChange, onLegacyLesson, setLang, locationName, onRefreshLocation
}) => {
  const t = translations[lang];

  const NavItem = ({ icon, label, onClick, active, colorClass = "" }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center space-x-4 space-x-reverse px-5 py-4 rounded-2xl transition-all group ${active ? 'bg-white/5 dark:bg-white/5 border border-scholar-gold/20' : 'hover:bg-white/5 dark:hover:bg-white/5 border border-transparent'}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-scholar-gold text-[#FAFAFA] dark:text-[#121212]' : 'bg-black/5 dark:bg-[#1F1F1F] text-scholar-muted group-hover:text-neutral-900 dark:group-hover:text-white'} ${colorClass}`}>
        <i className={`fas ${icon} text-sm`}></i>
      </div>
      <span className={`text-[11px] font-black uppercase tracking-widest ${active ? 'text-neutral-900 dark:text-white' : 'text-scholar-muted group-hover:text-neutral-900 dark:group-hover:text-white'}`}>{label}</span>
      {active && <div className={`mr-auto ml-0 w-1.5 h-1.5 bg-scholar-gold rounded-full shadow-[0_0_8px_var(--primary-color)]`}></div>}
    </button>
  );

  const UtilityItem = ({ icon, label, onClick, badge, colorClass = "" }: any) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all hover:bg-white/5 dark:hover:bg-white/5 group border border-transparent hover:border-black/5 dark:hover:border-white/5"
    >
      <div className="flex items-center space-x-4 space-x-reverse">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-black/5 dark:bg-[#1F1F1F] text-scholar-muted group-hover:text-scholar-gold ${colorClass}`}>
          <i className={`fas ${icon} text-[10px]`}></i>
        </div>
        <span className="text-[10px] font-black text-scholar-muted uppercase tracking-[0.2em] group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">{label}</span>
      </div>
      {badge && <span className="bg-scholar-gold text-white dark:text-[#1F1F1F] text-[9px] font-black px-2 py-0.5 rounded-sm">{badge}</span>}
    </button>
  );

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/70 z-[70] transition-opacity backdrop-blur-sm" onClick={onClose} />}
      
      <aside 
        className={`fixed top-0 bottom-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-80 bg-white dark:bg-[#1A1A1A] border-r border-black/5 dark:border-white/5 shadow-2xl flex flex-col z-[80] transform transition-transform duration-500 ease-in-out ${isOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')}`} 
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="p-10 flex flex-col items-center text-center space-y-5">
          {/* Location Indicator (Avatar is Red) */}
          <div 
            onClick={onRefreshLocation}
            className="flex items-center space-x-2 space-x-reverse px-4 py-1.5 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-full cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-all mb-1 group"
          >
            <i className={`fas fa-location-dot text-[9px] text-red-600 group-hover:animate-bounce`}></i>
            <span className="text-[8px] font-black uppercase tracking-widest text-scholar-muted group-hover:text-neutral-900 dark:group-hover:text-white">
              {locationName || "Ilorin, Nigeria"}
            </span>
          </div>

          <div className="relative group">
            <div className={`w-20 h-20 bg-black/5 dark:bg-[#2C2C2C] flex items-center justify-center text-scholar-gold border border-black/5 dark:border-white/10 shadow-xl rounded-[1.5rem] overflow-hidden transition-all group-hover:rotate-6 ring-2 ring-scholar-gold/20`}>
              {user ? (
                <span className="text-2xl font-black">{user.name.charAt(0).toUpperCase()}</span>
              ) : (
                <i className="fas fa-mosque text-2xl opacity-80"></i>
              )}
            </div>
          </div>
          
          <div className="space-y-1">
            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest leading-tight">
              {user ? user.name : t.studentOfKnowledge}
            </h3>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-scholar-gold">
              Level {progress.level} Scholar
            </p>
          </div>

          <div className="w-full space-y-2 pt-2">
            <div className={`flex items-center justify-between text-[9px] font-black text-scholar-muted uppercase tracking-widest`}>
              <span>Scholar XP</span>
              <span className="text-scholar-gold">{Math.floor((progress.xp % 1750) / 17.5)}%</span>
            </div>
            <div className="h-1.5 w-full bg-black/5 dark:bg-[#1F1F1F] rounded-full overflow-hidden">
              <div className="h-full bg-scholar-gold transition-all duration-1000 shadow-[0_0_8px_var(--primary-color)]" style={{ width: `${(progress.xp % 1750) / 17.5}%` }}></div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-8 custom-scrollbar">
          <section className="space-y-1">
            <div className="px-5 mb-2 text-[8px] font-black text-scholar-muted uppercase tracking-[0.3em] opacity-40">{t.sectionNavigation}</div>
            <NavItem icon="fa-feather" label={t.navInquiry} onClick={onNewInquiry} active={currentView === 'chat'} />
            <NavItem icon="fa-book-quran" label={t.navQuran} onClick={() => onNavigate('quran')} active={currentView === 'quran'} />
            <NavItem icon="fa-wand-magic-sparkles" label={t.navArts} onClick={() => onNavigate('arts')} active={currentView === 'arts'} />
            <NavItem icon="fa-pen-fancy" label={t.toolLegacy} onClick={onLegacyLesson} active={false} />
            <NavItem icon="fa-bolt" label={t.toolNews} onClick={onOpenNews} active={false} />
          </section>

          <section className="space-y-1 pt-6 border-t border-black/5 dark:border-white/5">
            <div className="px-5 mb-2 text-[8px] font-black text-scholar-muted uppercase tracking-[0.3em] opacity-40">{t.sectionNearby}</div>
            <UtilityItem icon="fa-mosque" label={t.toolMosque} onClick={() => onOpenMap("Find nearby mosques.")} />
            <UtilityItem icon="fa-utensils" label={t.toolRestaurant} onClick={() => onOpenMap("Find nearby Halal restaurants.")} />
            <UtilityItem icon="fa-tower-broadcast" label={t.toolLive} onClick={onOpenLive} colorClass="text-emerald-500" />
          </section>

          <section className="space-y-1 pt-6 border-t border-black/5 dark:border-white/5">
            <div className="px-5 mb-2 text-[8px] font-black text-scholar-muted uppercase tracking-[0.3em] opacity-40">{t.sectionSystem}</div>
            <UtilityItem icon="fa-gear" label={t.toolSettings} onClick={() => onUtilityAction('settings')} />
          </section>
        </div>

        <div className="p-8 border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-[#1F1F1F] flex flex-col space-y-4">
          {user ? (
            <button 
              onClick={onLogout}
              className="w-full flex items-center justify-center space-x-3 space-x-reverse py-3.5 bg-white dark:bg-[#262626] border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all rounded-2xl"
            >
              <i className="fas fa-door-open"></i>
              <span>{t.logout}</span>
            </button>
          ) : (
            <button 
              onClick={onOpenAuth}
              className="w-full py-4 bg-scholar-gold text-white dark:text-neutral-dark text-[10px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all rounded-2xl shadow-[0_0_15px_rgba(var(--primary-color-rgb),0.3)]"
            >
              {lang === 'ar' ? 'دخول المحراب' : 'Access Sanctuary'}
            </button>
          )}
          
          <div className="flex items-center justify-between px-2 pt-2">
            <span className="text-[9px] font-black text-scholar-muted uppercase tracking-[0.2em] opacity-40">v1.5.4 Sanctuary</span>
            <button 
              onClick={() => onThemeChange(themeMode === 'dark' ? 'light' : 'dark')}
              className="w-8 h-8 rounded-full bg-white/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-scholar-muted hover:text-scholar-gold transition-all"
            >
              <i className={`fas ${themeMode === 'dark' ? 'fa-sun' : 'fa-moon'} text-[10px]`}></i>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
