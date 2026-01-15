
import React, { useState } from 'react';
import { User, Sect, Madhab } from '../types';
import { Language, translations } from '../translations';

interface ProfileOverlayProps {
  user: User;
  onUpdate: (updates: Partial<User>) => void;
  onClose: () => void;
  lang: Language;
}

const ProfileOverlay: React.FC<ProfileOverlayProps> = ({ user, onUpdate, onClose, lang }) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [preferredSect, setPreferredSect] = useState<Sect>(user.preferredSect || 'Sunni');
  const [preferredMadhab, setPreferredMadhab] = useState<Madhab>(user.preferredMadhab || 'General');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const t = translations[lang];
  const madhabOptions: Madhab[] = ['General', 'Hanafi', 'Maliki', 'Shafi\'i', 'Hanbali', 'Usuli', 'Akhbari'];

  const handleSave = () => {
    setIsSaving(true);
    // Simulate API delay
    setTimeout(() => {
      onUpdate({ name, email, preferredSect, preferredMadhab });
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-stone-950/80 backdrop-blur-md animate-fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-xl w-full bg-white dark:bg-stone-900 rounded-[3rem] shadow-2xl border dark:border-stone-800 overflow-hidden flex flex-col relative">
        <button 
          onClick={onClose}
          className={`absolute ${lang === 'ar' ? 'left-8' : 'right-8'} top-8 z-20 w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-stone-500 flex items-center justify-center transition-all`}
        >
          <i className="fas fa-times"></i>
        </button>

        <div className="bg-stone-50 dark:bg-stone-950 p-12 text-center border-b dark:border-stone-800">
           <div className="w-24 h-24 bg-scholar-gold rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl border-4 border-white dark:border-stone-900 transition-transform hover:rotate-6">
              <span className="text-4xl font-black text-white">{name.charAt(0).toUpperCase()}</span>
           </div>
           <h2 className="text-2xl font-black text-stone-900 dark:text-stone-100 uppercase tracking-tighter">Seeker Profile</h2>
           <p className="text-[10px] font-black text-scholar-muted uppercase tracking-[0.4em] mt-2">Personal Sanctuary Identity</p>
        </div>

        <div className="p-10 space-y-8 overflow-y-auto max-h-[50vh] custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-scholar-muted uppercase tracking-widest px-1">Display Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-2xl py-4 px-6 text-sm font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-scholar-gold/10 focus:border-scholar-gold/40 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-scholar-muted uppercase tracking-widest px-1">Email Registry</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-2xl py-4 px-6 text-sm font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-scholar-gold/10 focus:border-scholar-gold/40 transition-all"
              />
            </div>
          </div>

          <div className="space-y-6 pt-4 border-t dark:border-stone-800">
             <div className="space-y-4">
               <h3 className="text-[10px] font-black text-scholar-muted uppercase tracking-[0.3em]">Theological Path</h3>
               <div className="grid grid-cols-2 gap-3">
                 <button 
                   onClick={() => setPreferredSect('Sunni')}
                   className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${preferredSect === 'Sunni' ? 'bg-scholar-gold text-white border-scholar-gold shadow-lg shadow-scholar-gold/20' : 'bg-stone-50 dark:bg-stone-950 text-stone-400 border-stone-200 dark:border-stone-800'}`}
                 >
                   Sunni Path
                 </button>
                 <button 
                   onClick={() => setPreferredSect('Shia')}
                   className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${preferredSect === 'Shia' ? 'bg-scholar-gold text-white border-scholar-gold shadow-lg shadow-scholar-gold/20' : 'bg-stone-50 dark:bg-stone-950 text-stone-400 border-stone-200 dark:border-stone-800'}`}
                 >
                   Shia Path
                 </button>
               </div>
             </div>

             <div className="space-y-4">
               <h3 className="text-[10px] font-black text-scholar-muted uppercase tracking-[0.3em]">Preferred Madhab</h3>
               <div className="relative">
                 <select 
                   value={preferredMadhab}
                   onChange={(e) => setPreferredMadhab(e.target.value as Madhab)}
                   className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-2xl py-4 px-6 text-sm font-bold text-stone-900 dark:text-stone-100 appearance-none focus:outline-none focus:ring-4 focus:ring-scholar-gold/10 focus:border-scholar-gold/40 transition-all"
                 >
                   {madhabOptions.map(opt => (
                     <option key={opt} value={opt}>{opt}</option>
                   ))}
                 </select>
                 <div className={`absolute ${lang === 'ar' ? 'left-6' : 'right-6'} top-1/2 -translate-y-1/2 pointer-events-none text-stone-400`}>
                   <i className="fas fa-chevron-down text-xs"></i>
                 </div>
               </div>
             </div>
          </div>
        </div>

        <div className="p-10 bg-stone-50 dark:bg-stone-950 border-t dark:border-stone-800">
           <button 
             onClick={handleSave}
             disabled={isSaving}
             className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-3 ${saveSuccess ? 'bg-emerald-600 text-white' : 'bg-scholar-gold text-white'}`}
           >
              {isSaving ? (
                <i className="fas fa-spinner fa-spin text-xl"></i>
              ) : saveSuccess ? (
                <>
                  <i className="fas fa-check-circle"></i>
                  <span>Profile Updated</span>
                </>
              ) : (
                <>
                  <i className="fas fa-floppy-disk"></i>
                  <span>Commit Changes</span>
                </>
              )}
           </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileOverlay;
