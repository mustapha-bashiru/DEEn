
import React, { useState, useCallback, useMemo } from 'react';
import { QuranVerse } from '../types';
import { fetchQuranVerse, fetchQuranRange } from '../services/geminiService';
import { Language, translations } from '../translations';

const QuranExplorer: React.FC<{ lang: Language; onClose: () => void }> = ({ onClose, lang }) => {
  const [rangeInput, setRangeInput] = useState<string>('2:255');
  const [filterText, setFilterText] = useState<string>('');
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = translations[lang];

  const performSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFilterText(''); // Clear filter on new search
    try {
      const singleMatch = rangeInput.match(/^(\d+):(\d+)$/);
      if (singleMatch) {
        const data = await fetchQuranVerse(parseInt(singleMatch[1]), parseInt(singleMatch[2]));
        setVerses([data]);
      } else {
        const rangeMatch = rangeInput.match(/^(\d+):(\d+)-(\d+)$/);
        if (rangeMatch) {
          const data = await fetchQuranRange(parseInt(rangeMatch[1]), parseInt(rangeMatch[2]), parseInt(rangeMatch[3]));
          setVerses(data);
        } else {
          throw new Error("Invalid format. Use 2:255 or 112:1-4");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to retrieve verses.");
    } finally { setLoading(false); }
  }, [rangeInput]);

  const filteredVerses = useMemo(() => {
    if (!filterText.trim()) return verses;
    return verses.filter(v => 
      v.tafsir.classical.ibnKathir.toLowerCase().includes(filterText.toLowerCase()) ||
      v.translation.toLowerCase().includes(filterText.toLowerCase())
    );
  }, [verses, filterText]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fdfbf7] overflow-hidden animate-fade-in">
      <header className="px-8 py-6 border-b flex items-center justify-between bg-white shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-[#064e3b] flex items-center justify-center text-white shadow-lg">
            <i className="fas fa-book-quran"></i>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">{t.quranTitle}</h2>
            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Narration: Hafs an 'Asim</p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-stone-100 rounded-full transition-colors text-stone-400">
          <i className="fas fa-times text-xl"></i>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl space-y-6">
            <div className="flex gap-6 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">{t.quranRefLabel}</label>
                <input 
                  type="text" value={rangeInput} onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="e.g., 2:255 or 114:1-6"
                  className="w-full bg-stone-50 border rounded-2xl py-4 px-6 text-sm focus:border-emerald-800 outline-none transition-all"
                />
              </div>
              <button onClick={performSearch} disabled={loading} className="bg-emerald-900 text-white rounded-2xl py-4 px-10 font-bold shadow-lg hover:opacity-90 transition-all min-w-[140px]">
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <span>{t.quranExploreBtn}</span>}
              </button>
            </div>

            {verses.length > 1 && (
              <div className="pt-4 border-t border-stone-100 flex items-center space-x-4">
                <div className="relative flex-1">
                  <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-stone-300"></i>
                  <input 
                    type="text" 
                    value={filterText} 
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder={t.quranSearchTafsir}
                    className="w-full bg-stone-50 border border-stone-100 rounded-xl py-3 pl-12 pr-4 text-xs focus:bg-white focus:border-amber-500 outline-none transition-all"
                  />
                </div>
                {filterText && (
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest whitespace-nowrap">
                    {filteredVerses.length} {lang === 'ar' ? 'نتائج' : 'Results'}
                  </span>
                )}
              </div>
            )}
          </div>

          {error && <div className="p-6 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-sm font-bold">{error}</div>}

          <div className="space-y-12">
            {filteredVerses.length === 0 && verses.length > 0 && (
              <div className="py-20 text-center opacity-40">
                <i className="fas fa-magnifying-glass text-4xl mb-4"></i>
                <p className="text-sm font-bold">{t.quranNoResults}</p>
              </div>
            )}

            {filteredVerses.map((v, i) => (
              <div key={i} className="bg-white rounded-[3rem] border shadow-2xl overflow-hidden animate-fade-in">
                <div className="bg-[#064e3b] p-8 text-white flex justify-between items-center">
                  <span className="font-bold text-lg">{v.surahName} {v.surahNumber}:{v.ayahNumber}</span>
                  <div className="flex space-x-2">
                    <button className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center" title="Listen">
                      <i className="fas fa-play text-xs"></i>
                    </button>
                  </div>
                </div>
                <div className="p-12 space-y-10">
                  <p className="font-arabic text-5xl text-right text-stone-800 leading-[2.2]" dir="rtl">{v.arabicText}</p>
                  <div className="border-l-4 border-amber-400 pl-8">
                    <p className="text-xl text-stone-600 italic font-medium">{v.translation}</p>
                  </div>
                  
                  <div className="pt-8 border-t grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">{t.quranClassicalTafsir}</h4>
                      <p className="text-xs text-stone-500 leading-relaxed">
                        {filterText ? (
                          v.tafsir.classical.ibnKathir.split(new RegExp(`(${filterText})`, 'gi')).map((part, index) => 
                            part.toLowerCase() === filterText.toLowerCase() 
                              ? <mark key={index} className="bg-amber-100 text-amber-900 rounded px-1">{part}</mark> 
                              : part
                          )
                        ) : v.tafsir.classical.ibnKathir}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">{t.quranModernApplication}</h4>
                      <p className="text-xs text-stone-600 leading-relaxed font-medium">
                        {v.modernApplication}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuranExplorer;
