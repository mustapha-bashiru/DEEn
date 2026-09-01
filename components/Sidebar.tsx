
import React from 'react';
import { User, UserProgress, Sect, AppView } from '../types';
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
  onNavigate: (view: AppView) => void;
  onNewInquiry: () => void;
  onUtilityAction: (action: string) => void;
  themeMode: 'system' | 'light' | 'dark';
  onThemeChange: (mode: 'system' | 'light' | 'dark') => void;
  onLegacyLesson: () => void;
  setLang: (l: Language) => void;
  locationName: string | null;
  onRefreshLocation: () => void;
}

const SebilLogo = ({ className = "w-6 h-6", color = "currentColor" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* The Path (Road) - Perspective tapering from bottom to top */}
    <path 
      d="M30 95C40 70 65 70 55 45C50 35 55 30 70 28" 
      stroke={color} 
      strokeWidth="14" 
      strokeLinecap="round" 
    />
    {/* Road center markings tracing the curve perfectly using dasharray */}
    <path 
      d="M30 95C40 70 65 70 55 45C50 35 55 30 70 28" 
      stroke="white" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeDasharray="4 8"
      opacity="0.6"
    />
    {/* Traditional Islamic Crescent (facing upward) */}
    <path 
      d="M70 22C61.1634 22 54 14.8366 54 6C54 4.5 54.2 3.1 54.6 1.7C50.6 3.9 48 8.1 48 13C48 20.732 54.268 27 62 27C67.3 27 71.9 24 74.2 19.6C72.9 21.1 71.3 22.3 69.5 23.1L70 22Z" 
      fill={color} 
      transform="rotate(-90 70 15) translate(0, -5)"
    />
    {/* Standard 5-pointed star */}
    <path 
      d="M70 4L71 7H74L71.5 8.5L72.5 11.5L70 9.5L67.5 11.5L68.5 8.5L66 7H69L70 4Z" 
      fill={color} 
    />
  </svg>
);

/*
 * NavItem and UtilityItem live at module scope, not inside Sidebar. Declaring a
 * component inside another component's body creates a brand-new component type
 * on every render, so React unmounts and remounts the whole subtree and any
 * state inside it is lost. Neither of these closes over Sidebar's scope, so
 * hoisting them is a straight move.
 */
interface NavItemProps {
  icon: string;
  label: string;
  onClick: () => void;
  active: boolean;
  isCore?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, onClick, active, isCore }) => (
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

interface UtilityItemProps {
  icon: string;
  label: string;
  onClick: () => void;
  badge?: string;
  isCore?: boolean;
}

const UtilityItem: React.FC<UtilityItemProps> = ({ icon, label, onClick, badge, isCore }) => (
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

const Sidebar: React.FC<SidebarProps> = ({
  isOpen, onClose, lang, user, progress, onLogout, onOpenAuth, onOpenNews, onOpenLive, onOpenMap, currentView, onNavigate, onNewInquiry, onUtilityAction, themeMode, onThemeChange, onLegacyLesson, locationName, onRefreshLocation
}) => {
  const t = translations[lang];

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/70 z-[70] backdrop-blur-sm" onClick={onClose} />}
      <aside 
        className={`fixed top-0 bottom-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-80 bg-white dark:bg-[#1A1A1A] border-r border-black/5 dark:border-white/5 shadow-2xl flex flex-col z-[80] transform transition-transform duration-500 ${isOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')}`} 
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="p-10 flex flex-col items-center text-center space-y-5">
          {/* Location Toggle Button - Now at the Top */}
          <button 
            onClick={onRefreshLocation}
            className={`mb-2 px-4 py-2 rounded-full border transition-all flex items-center space-x-2 space-x-reverse group/loc shadow-sm ${
              locationName === "Geo access blocked" 
                ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/20' 
                : 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/20'
            }`}
          >
            <i className={`fas fa-location-crosshairs text-[10px] ${
              locationName === "Geo access blocked" ? 'text-red-500' : 'text-emerald-500 animate-pulse'
            } group-hover/loc:rotate-180 transition-transform`}></i>
            <span className={`text-[9px] font-black uppercase tracking-widest ${
              locationName === "Geo access blocked" ? 'text-red-600' : 'text-emerald-600'
            }`}>
              {locationName ? locationName : "Resolving..."}
            </span>
          </button>

          <div className="w-20 h-20 bg-scholar-gold rounded-[1.5rem] flex items-center justify-center text-white shadow-xl border-4 border-white dark:border-stone-900 transition-transform hover:scale-105">
             {user ? <span className="text-2xl font-black">{user.name.charAt(0).toUpperCase()}</span> : <SebilLogo className="w-12 h-12" color="white" />}
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest leading-tight">{user ? user.name : t.studentOfKnowledge}</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-scholar-gold">Level {progress.level} Scholar</p>
          </div>
        </div>

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
        
        <div className="p-8 border-t border-black/5 bg-black/5 flex flex-col space-y-4">
          <div className="flex items-center space-x-3 space-x-reverse">
            <button 
              onClick={() => onThemeChange(themeMode === 'dark' ? 'light' : 'dark')}
              className="w-14 h-14 rounded-2xl bg-white/10 dark:bg-black/20 border border-black/5 dark:border-white/5 flex items-center justify-center text-scholar-muted hover:text-scholar-gold transition-all"
              title="Toggle Theme"
            >
               <i className={`fas ${themeMode === 'dark' ? 'fa-sun' : 'fa-moon'} text-sm`}></i>
            </button>
            {!user ? (
              <button onClick={onOpenAuth} className="flex-1 py-4 bg-scholar-gold text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg rounded-2xl hover:opacity-90 transition-all">
                Access Sanctuary
              </button>
            ) : (
              <button onClick={onLogout} className="flex-1 py-4 bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-500 hover:text-white transition-all">
                {t.logout}
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
