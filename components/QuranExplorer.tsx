
import React, { useState, useRef } from 'react';
import { QuranVerse, TafsirType } from '../types';
import { fetchQuranVerse, generateSpeech, decodeBase64ToUint8Array, decodeAudioData } from '../services/geminiService';

interface QuranExplorerProps {
  onAskAboutVerse: (verse: QuranVerse) => void;
  onClose: () => void;
}

const QuranExplorer: React.FC<QuranExplorerProps> = ({ onAskAboutVerse, onClose }) => {
  const [surahStart, setSurahStart] = useState<number>(1);
  const [surahEnd, setSurahEnd] = useState<number>(1);
  const [ayahStart, setAyahStart] = useState<number>(1);
  const [ayahEnd, setAyahEnd] = useState<number>(1);
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [tafsirType, setTafsirType] = useState<TafsirType>('General Scholarly');
  
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [playingAyahId, setPlayingAyahId] = useState<string | null>(null);
  const nativeAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setVerses([]);
    
    try {
      const results: QuranVerse[] = [];
      
      if (!isRangeMode) {
        const v = await fetchQuranVerse(surahStart, ayahStart, tafsirType);
        results.push(v);
      } else {
        // Limited multi-verse loop to prevent rate limiting (max 10 ayahs)
        const count = Math.min(ayahEnd - ayahStart + 1, 10);
        for (let i = 0; i < count; i++) {
          const v = await fetchQuranVerse(surahStart, ayahStart + i, tafsirType);
          results.push(v);
        }
      }
      
      setVerses(results);
    } catch (err) {
      setError("Unable to retrieve scholarly records for this range. Please check the Surah and Ayah numbers.");
    } finally {
      setLoading(false);
    }
  };

  const playAuthenticAudio = (verse: QuranVerse) => {
    const id = `${verse.surahNumber}:${verse.ayahNumber}`;
    if (playingAyahId === id) {
      nativeAudioRef.current?.pause();
      setPlayingAyahId(null);
      return;
    }

    if (nativeAudioRef.current) {
      nativeAudioRef.current.pause();
    }

    // Attempting to play the authentic Arabic recitation
    const audio = new Audio(verse.audioUri);
    nativeAudioRef.current = audio;
    setPlayingAyahId(id);
    audio.play();
    audio.onended = () => setPlayingAyahId(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-50 overflow-hidden animate-fade-in relative">
      <header className="px-6 py-6 bg-white border-b border-stone-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 border border-teal-100 shadow-sm">
            <i className="fas fa-book-open text-xl"></i>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">Quran Study Suite</h2>
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mt-1">Authentic Recitation & Tafsir Research</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-stone-600">
          <i className="fas fa-times text-xl"></i>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Enhanced Researcher Form */}
          <form onSubmit={handleSearch} className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Surah (1-114)</label>
                <input 
                  type="number" min="1" max="114" value={surahStart} onChange={(e) => setSurahStart(parseInt(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 text-sm focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">{isRangeMode ? 'Ayah Start' : 'Ayah'}</label>
                <input 
                  type="number" min="1" max="286" value={ayahStart} onChange={(e) => setAyahStart(parseInt(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 text-sm focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all"
                />
              </div>

              {isRangeMode && (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Ayah End</label>
                  <input 
                    type="number" min={ayahStart} max="286" value={ayahEnd} onChange={(e) => setAyahEnd(parseInt(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 text-sm focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Tafsir Method</label>
                <select 
                  value={tafsirType} onChange={(e) => setTafsirType(e.target.value as TafsirType)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 text-xs font-bold text-stone-600 focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all appearance-none"
                >
                  <option value="Ibn Kathir">Ibn Kathir (Classical)</option>
                  <option value="Al-Jalalayn">Al-Jalalayn (Concise)</option>
                  <option value="General Scholarly">General Scholarly</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-2">
              <div className="flex items-center space-x-6">
                <button 
                  type="button" 
                  onClick={() => setIsRangeMode(!isRangeMode)}
                  className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl border transition-all ${isRangeMode ? 'bg-teal-50 border-teal-200 text-teal-700 shadow-inner' : 'bg-stone-50 border-stone-200 text-stone-400 hover:text-stone-600'}`}
                >
                  <i className={`fas ${isRangeMode ? 'fa-layer-group' : 'fa-stop'} text-xs`}></i>
                  <span className="text-[10px] font-black uppercase tracking-widest">{isRangeMode ? 'Ayah Range' : 'Single Verse'}</span>
                </button>
              </div>

              <button 
                type="submit" disabled={loading}
                className="w-full md:w-auto bg-teal-800 hover:bg-teal-900 text-white rounded-2xl py-4 px-12 font-bold shadow-xl shadow-teal-900/20 active:scale-95 transition-all flex items-center justify-center space-x-3"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-eye"></i><span>View Verse(s)</span></>}
              </button>
            </div>
          </form>

          {error && <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 text-sm text-center font-bold">{error}</div>}

          {/* Verses Scroll Layout */}
          <div className="space-y-12 pb-24">
            {verses.map((v, index) => (
              <div key={index} className="bg-white rounded-[2.5rem] border border-stone-200 shadow-xl overflow-hidden animate-fade-in group hover:border-teal-200 transition-all">
                <div className="bg-teal-900 p-8 flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-teal-200 font-black border border-white/20">
                      {v.ayahNumber}
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">Surah {v.surahName}</h3>
                      <p className="text-teal-400 text-[9px] font-black uppercase tracking-[0.2em]">{v.tafsirType || tafsirType} Methodology</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => playAuthenticAudio(v)}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${playingAyahId === `${v.surahNumber}:${v.ayahNumber}` ? 'bg-amber-500 text-white animate-pulse' : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'}`}
                  >
                    <i className={`fas ${playingAyahId === `${v.surahNumber}:${v.ayahNumber}` ? 'fa-pause' : 'fa-play'} text-xl`}></i>
                  </button>
                </div>

                <div className="p-10 md:p-14 space-y-10">
                  <div className="text-right">
                    <p className="font-arabic text-4xl md:text-5xl text-stone-900 leading-[2.2] tracking-wide" dir="rtl">
                      {v.arabicText}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <div className="flex items-center space-x-2 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                         <i className="fas fa-language"></i>
                         <span>English Interpretation</span>
                       </div>
                       <p className="text-stone-800 text-lg font-medium leading-relaxed border-l-4 border-teal-100 pl-6">
                         {v.translation}
                       </p>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center space-x-2 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                         <i className="fas fa-scroll"></i>
                         <span>Scholarly Exegesis ({v.tafsirType || tafsirType})</span>
                       </div>
                       <p className="text-stone-600 text-sm leading-relaxed prose prose-stone italic bg-stone-50 p-6 rounded-2xl border border-stone-100">
                         {v.tafsirSummary}
                       </p>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-stone-100 flex justify-between items-center">
                    <span className="text-[10px] text-stone-400 italic">Authentic Audio: Sheikh Mishary Alafasy</span>
                    <button 
                      onClick={() => onAskAboutVerse(v)}
                      className="text-teal-700 text-[10px] font-black uppercase tracking-[0.2em] hover:text-teal-900 flex items-center space-x-2 group"
                    >
                      <span>Inquire Deeper</span>
                      <i className="fas fa-arrow-right transition-transform group-hover:translate-x-1"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!verses.length && !loading && !error && (
            <div className="py-32 text-center opacity-20">
               <i className="fas fa-quran text-[12rem] mb-8"></i>
               <p className="text-sm font-bold uppercase tracking-[0.5em]">Ready for Divine Guidance</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuranExplorer;
