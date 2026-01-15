
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
  onUtilityAction: (action: string) => void;
  themeMode: 'system' | 'light' | 'dark';
  onThemeChange: (mode: 'system' | 'light' | 'dark') => void;
  onLegacyLesson: () => void;
  setLang: (l: Language) => void;
  locationName: string | null;
  onRefreshLocation: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, onClose, lang, user, progress, onLogout, onOpenAuth, onOpenNews, onOpenLive, onOpenMap, currentView, onNavigate, onNewInquiry, onUtilityAction, themeMode, onThemeChange, onLegacyLesson, locationName, onRefreshLocation
}) => {
  const t = translations[lang];

  const NavItem = ({ icon, label, onClick, active, isCore }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center space-x-4 space-x-reverse px-5 py-4 rounded-2xl transition-all group relative overflow-hidden ${
        active 
          ? 'bg-white/5 border border-scholar-gold/20' 
          : 'hover:bg-white/5'
      } ${isCore ? 'hover:shadow-[0_0_20px_rgba(var(--primary-color-rgb),0.05)]' : ''}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
        active 
          ? 'bg-scholar-gold text-white shadow-lg' 
          : 'bg-black/5 dark:bg-[#1F1F1F] text-scholar-muted group-hover:text-neutral-900 dark:group-hover:text-white'
      } ${isCore && !active ? 'border border-scholar-gold/30 group-hover:bg-scholar-gold/5' : ''}`}>
        <i className={`fas ${icon} text-sm ${isCore && !active ? 'text-scholar-gold animate-pulse' : ''}`}></i>
      </div>
      <span className={`text-[11px] font-black uppercase tracking-widest ${
        active 
          ? 'text-neutral-900 dark:text-white' 
          : 'text-scholar-muted group-hover:text-neutral-900 dark:group-hover:text-white'
      }`}>{label}</span>
      
      {isCore && !active && (
        <div className="absolute right-4 w-1.5 h-1.5 bg-scholar-gold rounded-full animate-ping"></div>
      )}
      
      {active && (
        <div className="mr-auto ml-0 w-1.5 h-1.5 bg-scholar-gold rounded-full shadow-[0_0_8px_var(--primary-color)]"></div>
      )}
    </button>
  );

  const UtilityItem = ({ icon, label, onClick, badge, isCore }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all hover:bg-white/5 group ${isCore ? 'hover:shadow-[0_0_10px_rgba(var(--primary-color-rgb),0.03)]' : ''}`}
    >
      <div className="flex items-center space-x-4 space-x-reverse">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-black/5 dark:bg-[#1F1F1F] ${isCore ? 'text-scholar-gold bg-scholar-gold/5' : 'text-scholar-muted'} group-hover:text-scholar-gold group-hover:bg-scholar-gold/10`}>
          <i className={`fas ${icon} text-[10px] ${isCore ? 'animate-bounce' : ''}`}></i>
        </div>
        <span className="text-[10px] font-black text-scholar-muted uppercase tracking-[0.2em] group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">{label}</span>
      </div>
      {badge && <span className="bg-scholar-gold text-white text-[9px] font-black px-2 py-0.5 rounded-sm">{badge}</span>}
    </button>
  );

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/70 z-[70] backdrop-blur-sm" onClick={onClose} />}
      <aside 
        className={`fixed top-0 bottom-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-80 bg-white dark:bg-[#1A1A1A] border-r border-black/5 dark:border-white/5 shadow-2xl flex flex-col z-[80] transform transition-transform duration-500 ${isOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')}`} 
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Profile & Location Header */}
        <div className="p-10 flex flex-col items-center text-center space-y-5">
          <div 
            onClick={onRefreshLocation}
            className="flex items-center space-x-2 space-x-reverse px-4 py-2 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-full cursor-pointer hover:bg-black/10 transition-all mb-1 group/loc shadow-sm"
          >
            <i className="fas fa-location-dot text-[9px] text-red-600 animate-pulse"></i>
            <span className="text-[9px] font-black uppercase tracking-widest text-scholar-muted group-hover/loc:text-neutral-900 dark:group-hover/loc:text-white">
              {locationName ? locationName : "Resolving Location..."}
            </span>
          </div>
          <div className="w-20 h-20 bg-scholar-gold rounded-[1.5rem] flex items-center justify-center text-white shadow-xl border-4 border-white dark:border-stone-900">
             {user ? <span className="text-2xl font-black">{user.name.charAt(0).toUpperCase()}</span> : <i className="fas fa-crescent text-2xl"></i>}
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest leading-tight">{user ? user.name : t.studentOfKnowledge}</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-scholar-gold">Level {progress.level} Scholar</p>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-8 custom-scrollbar">
          <section className="space-y-1">
            <NavItem icon="fa-feather" label={t.navInquiry} onClick={onNewInquiry} active={currentView === 'chat'} />
            <NavItem icon="fa-book-quran" label={t.navQuran} onClick={() => onNavigate('quran')} active={currentView === 'quran'} />
            <NavItem icon="fa-wand-magic-sparkles" label={t.navArts} onClick={() => onNavigate('arts')} active={currentView === 'arts'} />
            <NavItem icon="fa-crescent" label={t.toolLegacy} onClick={onLegacyLesson} active={false} isCore={true} />
            <NavItem icon="fa-bolt" label={t.toolNews} onClick={onOpenNews} active={false} />
          </section>
          
          <section className="space-y-1 pt-6 border-t border-black/5">
            <UtilityItem icon="fa-mosque" label={t.toolMosque} onClick={() => onOpenMap("Find nearby mosques.")} isCore={true} />
            <UtilityItem icon="fa-utensils" label={t.toolRestaurant} onClick={() => onOpenMap("Find nearby halal restaurants.")} isCore={true} />
            <UtilityItem icon="fa-tower-broadcast" label={t.toolLive} onClick={onOpenLive} />
            <UtilityItem icon="fa-gear" label={t.toolSettings} onClick={() => onUtilityAction('settings')} />
          </section>
        </div>
        
        {/* Footer Area with Theme Toggle & Version Information */}
        <div className="p-8 border-t border-black/5 bg-black/5 flex flex-col space-y-4">
          {!user && (
            <button onClick={onOpenAuth} className="w-full py-4 bg-scholar-gold text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg rounded-2xl mb-2 hover:opacity-90 transition-all">
              Access Sanctuary
            </button>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-scholar-muted uppercase tracking-[0.2em]">SebilLink Sanctuary</span>
              <span className="text-[8px] font-bold text-scholar-muted/60 uppercase tracking-widest mt-0.5">v1.2.4 Premium</span>
            </div>
            
            <button 
              onClick={() => onThemeChange(themeMode === 'dark' ? 'light' : 'dark')}
              className="w-10 h-10 rounded-xl bg-white dark:bg-[#262626] border border-black/5 text-scholar-muted flex items-center justify-center hover:text-scholar-gold transition-colors shadow-sm hover:shadow-md"
              title="Toggle Theme"
            >
              <i className={`fas ${themeMode === 'dark' ? 'fa-sun' : 'fa-moon'} text-sm`}></i>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
