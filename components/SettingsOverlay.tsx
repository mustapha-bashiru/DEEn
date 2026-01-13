
import React from 'react';
import { Sect, Madhab } from '../types';
import { Language } from '../translations';

interface SettingsOverlayProps {
  lang: Language;
  setLang: (l: Language) => void;
  sect: Sect;
  setSect: (s: Sect) => void;
  madhab: Madhab;
  setMadhab: (m: Madhab) => void;
  onClose: () => void;
  themeMode: 'system' | 'light' | 'dark';
  onThemeChange: (mode: 'system' | 'light' | 'dark') => void;
}

const SettingsOverlay: React.FC<SettingsOverlayProps> = ({ 
  lang, setLang, sect, setSect, madhab, setMadhab, onClose, themeMode, onThemeChange 
}) => {
  const madhabOptions: Madhab[] = ['General', 'Hanafi', 'Maliki', 'Shafi\'i', 'Hanbali', 'Usuli', 'Akhbari'];

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-stone-950/80 backdrop-blur-md animate-fade-in">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl border border-stone-200 overflow-hidden">
        <div className="p-8 border-b flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600">
              <i className="fas fa-gear"></i>
            </div>
            <h2 className="text-xl font-bold text-stone-900">Sanctuary Configuration</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors text-stone-400">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Appearance Mode</h3>
            <div className="grid grid-cols-3 gap-2 bg-stone-50 p-1 rounded-2xl">
              {(['system', 'light', 'dark'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onThemeChange(mode)}
                  className={`py-2 text-[10px] font-black uppercase rounded-xl transition-all ${themeMode === mode ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Language</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setLang('en')}
                className={`py-3 rounded-2xl font-bold border transition-all ${lang === 'en' ? 'bg-stone-900 text-white border-stone-900 shadow-lg' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
              >
                English
              </button>
              <button 
                onClick={() => setLang('ar')}
                className={`py-3 rounded-2xl font-bold border transition-all font-arabic ${lang === 'ar' ? 'bg-stone-900 text-white border-stone-900 shadow-lg' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
              >
                العربية
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Scholarly Perspective</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setSect('Sunni')}
                className={`py-3 rounded-2xl font-bold border transition-all ${sect === 'Sunni' ? 'bg-emerald-800 text-white border-emerald-800 shadow-lg' : 'bg-white text-stone-600 border-stone-200 hover:bg-emerald-50'}`}
              >
                Sunni
              </button>
              <button 
                onClick={() => setSect('Shia')}
                className={`py-3 rounded-2xl font-bold border transition-all ${sect === 'Shia' ? 'bg-teal-900 text-white border-teal-900 shadow-lg' : 'bg-white text-stone-600 border-stone-200 hover:bg-teal-50'}`}
              >
                Shia
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Active Madhab</h3>
            <div className="relative">
              <select 
                value={madhab}
                onChange={(e) => setMadhab(e.target.value as Madhab)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 text-sm font-bold appearance-none focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
              >
                {madhabOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                <i className="fas fa-chevron-down text-xs"></i>
              </div>
            </div>
          </section>
        </div>

        <div className="p-8 bg-stone-50 border-t">
          <button 
            onClick={onClose}
            className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all"
          >
            Confirm Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsOverlay;
