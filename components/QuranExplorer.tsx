
import React, { useState, useCallback, useMemo } from 'react';
import { QuranVerse, Qiraat } from '../types';
import { fetchQuranVerse, fetchQuranRange } from '../services/geminiService';
import { Language, translations } from '../translations';

interface QuranExplorerProps {
  lang: Language;
  onAskAboutVerse: (verse: QuranVerse) => void;
  onClose: () => void;
  isPremium: boolean;
  onOpenAuth: () => void;
}

const qiraatOptions = [
  { 
    id: 'Hafs', 
    name: 'Hafs from Asim', 
    desc: 'The global standard (Kufa). Known for its accessibility and clarity in recitation.' 
  },
  { 
    id: 'Warsh', 
    name: 'Warsh from Nafi', 
    desc: 'Common in North/West Africa (Maghreb). Features distinct long vowels and specific tajweed rules.' 
  },
  { 
    id: 'Qalun', 
    name: 'Qalun from Nafi', 
    desc: 'Prevalent in Libya and Tunisia. Unique for its specific pronunciation of the hamza and mimm.' 
  },
  { 
    id: 'Al-Duri', 
    name: 'Al-Duri from Abu Amr', 
    desc: 'Found in Sudan and East Africa. Known for its historical linguistic variations.' 
  }
];

const QuranExplorer: React.FC<QuranExplorerProps> = ({ onClose, lang }) => {
  const [rangeInput, setRangeInput] = useState<string>('1:1');
  const [qiraat, setQiraat] = useState<Qiraat>('Hafs');
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tafsirSearch, setTafsirSearch] = useState('');

  const t = translations[lang];

  const performSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setVerses([]);
    setTafsirSearch(''); 
    
    try {
      const rangeMatch = rangeInput.match(/^(\d+):(\d+)-(\d+)$/);
      if (rangeMatch) {
        const surah = parseInt(rangeMatch[1]);
        let start = parseInt(rangeMatch[2]);
        let end = parseInt(rangeMatch[3]);
        if (start > end) [start, end] = [end, start];
        if (end - start > 10) throw new Error("Please select a range of 10 verses or fewer for optimal study.");
        const data = await fetchQuranRange(surah, start, end, qiraat);
        setVerses(data);
        return;
      }

      const surahRangeMatch = rangeInput.match(/^(\d+)-(\d+)$/);
      if (surahRangeMatch) {
        let start = parseInt(surahRangeMatch[1]);
        let end = parseInt(surahRangeMatch[2]);
        if (start > end) [start, end] = [end, start];
        if (end - start > 4) throw new Error("Please explore 5 surahs or fewer at once.");
        const results: QuranVerse[] = [];
        for (let s = start; s <= end; s++) {
          const data = await fetchQuranVerse(s, 1, qiraat);
          results.push(data);
        }
        setVerses(results);
        return;
      }

      const singleMatch = rangeInput.match(/^(\d+):(\d+)$/);
      if (singleMatch) {
        const surah = parseInt(singleMatch[1]);
        const ayah = parseInt(singleMatch[2]);
        const data = await fetchQuranVerse(surah, ayah, qiraat);
        setVerses([data]);
        return;
      }

      const surahOnlyMatch = rangeInput.match(/^(\d+)$/);
      if (surahOnlyMatch) {
        const surah = parseInt(surahOnlyMatch[1]);
        const data = await fetchQuranVerse(surah, 1, qiraat);
        setVerses([data]);
        return;
      }

      throw new Error("Format invalid. Please use '2:10-15' or '112-114'.");
    } catch (err: any) {
      setError(err.message || "The library records are temporarily unreachable.");
    } finally {
      setLoading(false);
    }
  }, [rangeInput, qiraat]);

  const filteredVerses = useMemo(() => {
    if (!tafsirSearch.trim()) return verses;
    const lowerSearch = tafsirSearch.toLowerCase();
    return verses.filter(v => 
      (v.tafsir?.classical?.ibnKathir?.toLowerCase() || '').includes(lowerSearch) ||
      (v.modernApplication?.toLowerCase() || '').includes(lowerSearch) ||
      (v.surahName?.toLowerCase() || '').includes(lowerSearch)
    );
  }, [verses, tafsirSearch]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fdfbf7] overflow-hidden animate-fade-in relative">
      <header className="px-8 py-6 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-40">
        <div className={`flex items-center ${lang === 'ar' ? 'space-x-reverse' : ''} space-x-4`}>
          <div className="w-12 h-12 rounded-2xl bg-[#064e3b] flex items-center justify-center text-white shadow-lg">
            <i className="fas fa-book-quran"></i>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">{t.quranTitle}</h2>
            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{t.quranSub}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-stone-100 rounded-full transition-colors text-stone-400">
          <i className="fas fa-times text-xl"></i>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-12">
          
          <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-xl space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest pl-1">{t.quranRefLabel}</label>
                <input 
                  type="text" value={rangeInput} onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="e.g., 2:10-15 or 112-114"
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 text-sm focus:border-[#c5a059] outline-none transition-all shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest pl-1">{t.quranQiraatLabel}</label>
                <div className="relative">
                  <select 
                    value={qiraat} 
                    onChange={(e) => setQiraat(e.target.value as Qiraat)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 text-sm focus:border-[#c5a059] outline-none transition-all appearance-none cursor-pointer shadow-sm"
                  >
                    {qiraatOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                  <i className={`fas fa-chevron-down absolute ${lang === 'ar' ? 'left-6' : 'right-6'} top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none text-xs`}></i>
                </div>
              </div>

              <button 
                onClick={performSearch} disabled={loading}
                className="bg-[#064e3b] text-white rounded-2xl py-4 px-8 font-bold shadow-lg hover:bg-[#043328] transition-all flex items-center justify-center space-x-3 self-end active:scale-95"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <><i className={`fas fa-magnifying-glass ${lang === 'ar' ? 'ml-3' : ''}`}></i><span>{t.quranExploreBtn}</span></>}
              </button>
            </div>

            <div className={`p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-start ${lang === 'ar' ? 'space-x-reverse' : ''} space-x-4`}>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 mt-1">
                <i className="fas fa-info-circle text-xs"></i>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">{t.quranQiraatContext}</h4>
                <p className="text-xs text-emerald-900/70 italic leading-relaxed">
                  {qiraatOptions.find(o => o.id === qiraat)?.desc}
                </p>
              </div>
            </div>
          </div>

          {verses.length > 0 && (
            <div className="animate-fade-in space-y-4">
               <div className="relative group">
                  <i className={`fas fa-search absolute ${lang === 'ar' ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-[#c5a059] opacity-40 group-focus-within:opacity-100 transition-opacity`}></i>
                  <input 
                    type="text"
                    value={tafsirSearch}
                    onChange={(e) => setTafsirSearch(e.target.value)}
                    placeholder={t.quranSearchTafsir}
                    className={`w-full bg-white border border-stone-200 rounded-[2rem] py-5 ${lang === 'ar' ? 'pr-14 pl-6' : 'pl-14 pr-6'} text-sm focus:border-[#064e3b] focus:ring-4 focus:ring-[#064e3b0a] outline-none shadow-xl transition-all`}
                  />
                  {tafsirSearch && (
                    <button onClick={() => setTafsirSearch('')} className={`absolute ${lang === 'ar' ? 'left-6' : 'right-6'} top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500`}>
                      <i className="fas fa-circle-xmark"></i>
                    </button>
                  )}
               </div>
            </div>
          )}

          {error && (
            <div className={`p-6 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium animate-shake flex items-center`}>
              <i className={`fas fa-exclamation-triangle ${lang === 'ar' ? 'ml-4' : 'mr-4'} text-lg`}></i>{error}
            </div>
          )}

          {filteredVerses.map((v, idx) => (
            <div key={`${v.surahNumber}-${v.ayahNumber}-${idx}`} className="animate-fade-in space-y-8 pb-10 border-b border-stone-100 last:border-0">
              <div className="bg-white rounded-[3rem] border border-stone-200 shadow-2xl overflow-hidden">
                <div className="bg-[#064e3b] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <i className="fas fa-mosque text-[10rem] -bottom-10 -left-10 rotate-12"></i>
                  </div>
                  
                  <div className={`flex items-center ${lang === 'ar' ? 'space-x-reverse' : ''} space-x-6 relative z-10`}>
                    <div className="w-14 h-14 rounded-3xl bg-[#c5a059] flex items-center justify-center text-white font-black text-xl shadow-inner border border-[#b48d48]">
                      {v.ayahNumber}
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-2xl italic tracking-tight">{v.surahName}</h3>
                      <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mt-1">Uthmani Script • {qiraat}</p>
                    </div>
                  </div>
                  <a 
                    href={v.audioUri} target="_blank" rel="noopener noreferrer"
                    className="flex items-center space-x-3 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl border border-white/10 transition-all font-bold text-[10px] uppercase tracking-widest relative z-10"
                  >
                    <i className="fas fa-external-link-alt"></i>
                    <span>{t.quranStudyLink}</span>
                  </a>
                </div>

                <div className="p-10 md:p-16 space-y-12 bg-[#fdfbf7]">
                  <p className="font-arabic text-5xl md:text-7xl text-right text-[#2d2d2d] leading-[1.8]" dir="rtl">
                    {v.arabicText}
                  </p>
                  <div className={`${lang === 'ar' ? 'border-r-8 pr-10 border-l-0 pl-0' : 'border-l-8 pl-10'} border-[#c5a05922]`}>
                    <p className="text-2xl text-stone-700 italic font-medium leading-relaxed">
                      {v.translation}
                    </p>
                  </div>
                </div>

                <div className="px-12 pb-12 grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <div className={`flex items-center ${lang === 'ar' ? 'space-x-reverse' : ''} space-x-2`}>
                       <i className="fas fa-feather-pointed text-[#c5a059] text-xs"></i>
                       <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-[0.2em]">{t.quranClassicalTafsir}</h4>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed font-medium line-clamp-4 hover:line-clamp-none transition-all cursor-pointer">
                      {v.tafsir?.classical?.ibnKathir || "Scholarly commentary unavailable for this verse."}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className={`flex items-center ${lang === 'ar' ? 'space-x-reverse' : ''} space-x-2`}>
                       <i className="fas fa-lightbulb text-[#c5a059] text-xs"></i>
                       <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-[0.2em]">{t.quranSpiritualInsight}</h4>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed font-medium">
                      {v.modernApplication}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {verses.length > 0 && filteredVerses.length === 0 && (
             <div className="py-12 text-center opacity-40">
                <i className="fas fa-search-minus text-4xl mb-4 text-[#c5a059]"></i>
                <p className="text-xs font-black uppercase tracking-widest">{t.quranNoResults}</p>
             </div>
          )}

          {!verses.length && !loading && !error && (
            <div className="py-24 text-center opacity-30 flex flex-col items-center">
               <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center mb-6">
                 <i className="fas fa-feather-pointed text-4xl text-[#c5a059]"></i>
               </div>
               <h3 className="text-lg font-bold text-stone-900 mb-2 tracking-tight">{t.quranSelectPassage}</h3>
               <p className="text-xs font-black uppercase tracking-[0.2em] max-w-xs leading-loose text-stone-500">
                 {t.quranExample}
               </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuranExplorer;
