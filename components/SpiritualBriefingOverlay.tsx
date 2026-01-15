
import React, { useState, useEffect, useMemo } from 'react';
import { Language, translations } from '../translations';
import { fetchSpiritualBriefingData, BriefingData } from '../services/geminiService';

interface SpiritualBriefingOverlayProps {
  lang: Language;
  setLang: (l: Language) => void;
  locationName: string | null;
  onClose: () => void;
  onNavigate: (view: any) => void;
}

const toArabicNumerals = (str: string | number): string => {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(str).replace(/[0-9]/g, (w) => arabicNumbers[parseInt(w)]);
};

const SpiritualBriefingOverlay: React.FC<SpiritualBriefingOverlayProps> = ({ lang, locationName, onClose, onNavigate }) => {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const t = translations[lang];

  const rawDate = new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const localizedDate = lang === 'ar' ? toArabicNumerals(rawDate) : rawDate;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetchSpiritualBriefingData(locationName, lang);
      setData(res);
      setLoading(false);
    };
    load();
  }, [locationName, lang]);

  const localizeNumberString = (val: string | undefined) => {
    if (!val) return '--:--';
    return lang === 'ar' ? toArabicNumerals(val) : val;
  };

  const hijriDisplay = useMemo(() => {
    if (!data?.hijriDate) return '...';
    let text = data.hijriDate;
    if (lang === 'ar') {
      text = text.replace('AH', t.hijriSuffix);
      return toArabicNumerals(text);
    }
    return text;
  }, [data?.hijriDate, lang, t.hijriSuffix]);

  return (
    <div className={`fixed inset-0 z-[260] flex items-center justify-center p-6 bg-stone-50/95 dark:bg-black/95 backdrop-blur-xl animate-fade-in overflow-y-auto ${lang === 'ar' ? 'font-arabic' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Top Controls */}
      <div className="absolute top-10 right-10 z-50">
        <button onClick={onClose} className="w-12 h-12 rounded-full bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 text-stone-400 dark:text-stone-500 flex items-center justify-center hover:text-neutral-900 dark:hover:text-white transition-all hover:bg-stone-100 dark:hover:bg-white/10">
          <i className="fas fa-times text-lg"></i>
        </button>
      </div>

      <div className="max-w-xl w-full bg-white dark:bg-[#121212] border border-stone-200 dark:border-white/5 shadow-2xl overflow-hidden flex flex-col rounded-[3.5rem] my-auto relative">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <i className="fas fa-kaaba text-[20rem] absolute -bottom-20 -right-20 rotate-12 text-stone-900 dark:text-white"></i>
        </div>

        <div className="bg-stone-50 dark:bg-[#1A1A1A] p-14 text-center border-b border-stone-200 dark:border-white/5 relative z-10">
          <div className="flex items-center justify-center space-x-2 space-x-reverse mb-6">
            <i className="fas fa-star text-xs text-stone-400 dark:text-stone-600"></i>
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-stone-400 dark:text-stone-600">{data?.specialEvent || 'NONE'}</span>
            <i className="fas fa-star text-xs text-stone-400 dark:text-stone-600"></i>
          </div>
          
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter uppercase leading-none">{t.dailyReminder}</h2>
            <div className="flex flex-col items-center space-y-2">
              <p className="text-scholar-gold text-[11px] font-black uppercase tracking-[0.6em] opacity-90">
                {localizedDate}
              </p>
              <div className="px-4 py-1.5 bg-stone-100 dark:bg-white/5 rounded-full border border-stone-200 dark:border-white/5 flex items-center space-x-2 space-x-reverse">
                <i className="fas fa-location-dot text-[10px] text-scholar-gold"></i>
                <span className="text-scholar-muted text-[9px] font-black uppercase tracking-widest">
                  {locationName ? locationName : "Resolving Location..."}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-12 space-y-10 relative z-10 bg-gradient-to-b from-white to-stone-50 dark:from-[#121212] dark:to-black">
          <div className="p-8 bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/5 rounded-[2.5rem] text-center shadow-inner group hover:border-scholar-gold/20 transition-all">
            <span className="text-[10px] font-black text-scholar-muted uppercase tracking-[0.4em] block mb-3">{t.lunarHijri}</span>
            <span className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">{hijriDisplay}</span>
          </div>

          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-scholar-muted uppercase tracking-[0.6em] text-center">{t.prayerSchedule}</h4>
            <div className="grid grid-cols-3 gap-4">
              {loading ? (
                [...Array(6)].map((_, i) => <div key={i} className="h-20 bg-stone-100 dark:bg-white/5 rounded-3xl animate-pulse border border-stone-200 dark:border-white/5"></div>)
              ) : (
                <>
                  <PrayerTimeCard label={t.prayerFajr} time={localizeNumberString(data?.prayerTimes.fajr)} icon="fa-feather" />
                  <PrayerTimeCard label={t.prayerSunrise} time={localizeNumberString(data?.prayerTimes.sunrise)} icon="fa-sun" dimmed />
                  <PrayerTimeCard label={t.prayerDhuhr} time={localizeNumberString(data?.prayerTimes.dhuhr)} icon="fa-clock" active />
                  <PrayerTimeCard label={t.prayerAsr} time={localizeNumberString(data?.prayerTimes.asr)} icon="fa-shield-halved" />
                  <PrayerTimeCard label={t.prayerMaghrib} time={localizeNumberString(data?.prayerTimes.maghrib)} icon="fa-moon" />
                  <PrayerTimeCard label={t.prayerIsha} time={localizeNumberString(data?.prayerTimes.isha)} icon="fa-star" />
                </>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-scholar-muted uppercase tracking-[0.6em] text-center">{t.spiritualFreq}</h4>
            <div className="p-10 bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/5 rounded-[3.5rem] relative overflow-hidden group hover:bg-stone-100 dark:hover:bg-white/[0.07] transition-all">
              <div className="absolute top-4 left-6 text-scholar-gold opacity-10 text-4xl">“</div>
              <p className="font-arabic text-3xl text-neutral-900 dark:text-white text-center leading-[1.8] relative z-10" dir="rtl">
                {data?.dailyVerse.arabic || "رَبِّ زِدْنِي عِلْمًا"}
              </p>
              <div className="mt-8 flex flex-col items-center relative z-10">
                <div className="h-px w-12 bg-scholar-gold/20 mb-6"></div>
                <p className="text-[14px] text-scholar-muted text-center leading-relaxed font-medium italic tracking-wide max-w-xs mx-auto">
                  "{data?.dailyVerse.translation || "My Lord, increase me in knowledge."}"
                </p>
              </div>
              <div className="absolute bottom-4 right-6 text-scholar-gold opacity-10 text-4xl rotate-180">“</div>
            </div>
          </div>

          <div className="flex flex-col space-y-4 pt-4">
            <button 
              onClick={onClose}
              className="w-full bg-scholar-gold hover:opacity-90 text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] transition-all shadow-2xl shadow-scholar-gold/20 active:scale-[0.98]"
            >
              {t.resumeJourney}
            </button>
            <button 
              onClick={() => onNavigate('quran')}
              className="w-full text-scholar-muted py-2 text-[10px] font-black hover:text-neutral-900 dark:hover:text-white transition-all flex items-center justify-center space-x-3 space-x-reverse uppercase tracking-[0.3em]"
            >
              <i className="fas fa-certificate text-scholar-gold text-[8px] animate-spin-slow"></i>
              <span>{t.gazeQuran}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PrayerTimeCard = ({ label, time, icon, dimmed = false, active = false }: { label: string, time?: string, icon: string, dimmed?: boolean, active?: boolean }) => (
  <div className={`p-5 rounded-3xl border transition-all duration-500 flex flex-col items-center justify-center space-y-2 ${
    active 
      ? 'bg-scholar-gold/10 border-scholar-gold shadow-[0_0_20px_rgba(var(--primary-color-rgb),0.2)]' 
      : dimmed 
        ? 'bg-stone-100 dark:bg-black/20 border-stone-200 dark:border-white/5 opacity-40 grayscale' 
        : 'bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 hover:border-scholar-gold/30 dark:hover:border-white/30'
  }`}>
    <div className={`text-[12px] ${active ? 'text-scholar-gold' : 'text-scholar-muted'} mb-1`}>
      <i className={`fas ${icon}`}></i>
    </div>
    <span className={`text-[8px] font-black uppercase tracking-widest block ${active ? 'text-scholar-gold' : 'text-scholar-muted'}`}>
      {label}
    </span>
    <span className={`text-sm font-bold ${active ? 'text-neutral-900 dark:text-white' : 'text-stone-500 dark:text-stone-300'}`}>
      {time || '--:--'}
    </span>
    {active && (
      <div className="w-1 h-1 bg-scholar-gold rounded-full animate-ping mt-1"></div>
    )}
  </div>
);

export default SpiritualBriefingOverlay;
