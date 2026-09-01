
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
  const [expandedTafsirs, setExpandedTafsirs] = useState<Record<string, boolean>>({});

  const t = translations[lang];

  const performSearch = useCallback(async (inputOverride?: string) => {
    const input = inputOverride || rangeInput;
    setLoading(true);
    setError(null);
    setFilterText('');
    try {
      const singleMatch = input.match(/^(\d+):(\d+)$/);
      if (singleMatch) {
        const data = await fetchQuranVerse(parseInt(singleMatch[1]), parseInt(singleMatch[2]));
        setVerses([data]);
      } else {
        const rangeMatch = input.match(/^(\d+):(\d+)-(\d+)$/);
        if (rangeMatch) {
          const data = await fetchQuranRange(parseInt(rangeMatch[1]), parseInt(rangeMatch[2]), parseInt(rangeMatch[3]));
          setVerses(data);
        } else {
          throw new Error("Invalid format. Use 2:255 or 112:1-4");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retrieve verses.");
    } finally { setLoading(false); }
  }, [rangeInput]);

  const navigateVerse = (offset: number) => {
    if (verses.length === 1) {
      const v = verses[0];
      const newAyah = Math.max(1, v.ayahNumber + offset);
      const newInput = `${v.surahNumber}:${newAyah}`;
      setRangeInput(newInput);
      performSearch(newInput);
    }
  };

  const toggleTafsir = (id: string) => {
    setExpandedTafsirs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredVerses = useMemo(() => {
    if (!filterText.trim()) return verses;
    return verses.filter(v => 
      v.tafsir.classical.ibnKathir.toLowerCase().includes(filterText.toLowerCase()) ||
      v.translation.toLowerCase().includes(filterText.toLowerCase())
    );
  }, [verses, filterText]);

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent pattern-dots overflow-hidden animate-fade-in transition-colors duration-300">
      <header className="px-8 py-6 border-b border-black/5 dark:border-stone-800 flex items-center justify-between bg-white/10 dark:bg-stone-900/40 backdrop-blur-md shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-scholar-gold flex items-center justify-center text-white shadow-lg">
            <i className="fas fa-book-quran"></i>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">{t.quranTitle}</h2>
            <p className="text-[9px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest">Narration: Hafs an 'Asim</p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-white/10 dark:hover:bg-stone-800/40 rounded-full transition-colors text-stone-400">
          <i className="fas fa-times text-xl"></i>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Controls */}
          <div className="bg-white/10 dark:bg-stone-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-black/5 dark:border-stone-800 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1 w-full space-y-2">
                <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">{t.quranRefLabel}</label>
                <div className="relative group">
                  <input 
                    type="text" value={rangeInput} onChange={(e) => setRangeInput(e.target.value)}
                    placeholder="e.g., 2:255 or 114:1-6"
                    className="w-full bg-white/5 dark:bg-stone-950/40 border border-black/5 dark:border-stone-800 rounded-2xl py-4 px-6 text-sm dark:text-stone-100 focus:border-scholar-gold outline-none transition-all"
                  />
                  {verses.length === 1 && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex space-x-2">
                      <button onClick={() => navigateVerse(-1)} className="p-2 bg-white/20 dark:bg-stone-800 rounded-xl border border-black/5 dark:border-stone-700 text-stone-400 hover:text-scholar-gold transition-colors shadow-sm">
                        <i className="fas fa-chevron-left"></i>
                      </button>
                      <button onClick={() => navigateVerse(1)} className="p-2 bg-white/20 dark:bg-stone-800 rounded-xl border border-black/5 dark:border-stone-700 text-stone-400 hover:text-scholar-gold transition-colors shadow-sm">
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => performSearch()} disabled={loading} className="w-full md:w-auto bg-scholar-gold text-white rounded-2xl py-4 px-10 font-bold shadow-lg hover:opacity-90 transition-all min-w-[140px]">
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <span>{t.quranExploreBtn}</span>}
              </button>
            </div>
          </div>

          {error && <div className="p-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30 text-sm font-bold">{error}</div>}

          {/* Verse Listing */}
          <div className="space-y-12">
            {filteredVerses.map((v, i) => {
              const verseId = `${v.surahNumber}_${v.ayahNumber}`;

              return (
                <div key={i} className="bg-white/10 dark:bg-stone-900/40 backdrop-blur-md rounded-[3rem] border border-black/5 dark:border-stone-800 shadow-2xl overflow-hidden animate-fade-in transition-colors">
                  <div className="bg-scholar-gold p-8 text-white flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs border border-white/20">
                        {v.ayahNumber}
                      </div>
                      <span className="font-bold text-lg">{v.surahName} {v.surahNumber}:{v.ayahNumber}</span>
                    </div>
                    <div className="flex space-x-2">
                      <button className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center" title="Listen">
                        <i className="fas fa-play text-xs"></i>
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-8 md:p-12 space-y-10">
                    <p className="font-arabic text-4xl md:text-5xl text-right text-stone-800 dark:text-stone-100 leading-[2.2]" dir="rtl">{v.arabicText}</p>
                    
                    <div className="border-l-4 border-scholar-gold/50 pl-8">
                      <p className="text-xl text-stone-600 dark:text-stone-400 italic font-medium">{v.translation}</p>
                    </div>
                    
                    <div className="pt-8 border-t border-black/5 dark:border-stone-800 space-y-8">
                      {/* Expandable Tafsir Sections */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest">Classical Exegesis (Tafsir)</h4>
                        
                        {/* Ibn Kathir Section */}
                        <div className="border border-black/5 dark:border-stone-800 rounded-3xl overflow-hidden transition-all">
                          <button 
                            onClick={() => toggleTafsir(verseId + '_ibn')}
                            className="w-full flex items-center justify-between p-6 text-left bg-white/5 dark:bg-stone-950/40 hover:bg-white/10 dark:hover:bg-stone-900 transition-colors"
                          >
                            <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Imam Ibn Kathir</span>
                            <i className={`fas ${expandedTafsirs[verseId + '_ibn'] ? 'fa-minus' : 'fa-plus'} text-[10px] text-stone-400`}></i>
                          </button>
                          {expandedTafsirs[verseId + '_ibn'] && (
                            <div className="p-8 bg-white/20 dark:bg-stone-900/60 border-t border-black/5 dark:border-stone-800 animate-fade-in">
                              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed whitespace-pre-wrap">
                                {v.tafsir.classical.ibnKathir}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Modern Application Section */}
                      <div className="space-y-4 pt-4">
                        <h4 className="text-[10px] font-black text-scholar-gold uppercase tracking-widest">{t.quranModernApplication}</h4>
                        <div className="p-8 bg-scholar-gold/5 dark:bg-scholar-gold/10 border border-scholar-gold/10 dark:border-scholar-gold/20 rounded-[2.5rem] shadow-sm">
                          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed font-medium">
                            {v.modernApplication || "Reflecting on how this verse guides our contemporary ethics, community responsibility, and individual spiritual growth in the digital age."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuranExplorer;
