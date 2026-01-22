
import React, { useState, useMemo, useEffect } from 'react';
import { generateSacredArt, generateSacredVideo, generateDailyVersePrompt } from '../services/geminiService';
import { Language, translations } from '../translations';
import { SacredArt } from '../types';

interface SacredArtsProps {
  lang: Language;
  isPremium: boolean;
  onOpenAuth: () => void;
  onClose: () => void;
  history: SacredArt[];
  onSaveArt: (art: SacredArt) => void;
  onRemoveArt: (id: string) => void;
}

const presets = [
  { id: 'thuluth', label: 'Thuluth Calligraphy', prompt: 'Bismillah in exquisite gold Thuluth calligraphy on a deep navy textured parchment background, intricate borders' },
  { id: 'geometry', label: 'Andalusian Geometry', prompt: 'Complex Islamic geometric patterns in sapphire and emerald hues, mathematical precision, Alhambra style' },
  { id: 'landscape', label: 'Starlit Mosque', prompt: 'Silhouette of an ancient mosque dome and minarets against a vast starlit night sky, crescent moon, cinematic lighting' },
  { id: 'manuscript', label: 'Ancient Manuscript', prompt: 'Traditional Islamic manuscript page, hand-painted calligraphy with ornate floral illuminations, weathered edges' },
  { id: 'daily-verse', label: 'Verse of the Day', prompt: 'AUTO_VERSE', special: true }
];

const SacredArts: React.FC<SacredArtsProps> = ({ isPremium, onOpenAuth, onClose, lang, history, onSaveArt, onRemoveArt }) => {
  const [activeTab, setActiveTab] = useState<'studio' | 'gallery'>('studio');
  
  const [modality, setModality] = useState<'image' | 'video'>(() => {
    return (localStorage.getItem('sanctuary_arts_modality') as 'image' | 'video') || 'image';
  });
  const [prompt, setPrompt] = useState(() => {
    return localStorage.getItem('sanctuary_arts_prompt') || '';
  });

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedAsset, setGeneratedAsset] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasVeoKey, setHasVeoKey] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    localStorage.setItem('sanctuary_arts_modality', modality);
    localStorage.setItem('sanctuary_arts_prompt', prompt);
  }, [modality, prompt]);

  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        const has = await (window as any).aistudio.hasSelectedApiKey();
        setHasVeoKey(has);
      }
    };
    checkKey();
  }, [modality]);

  const handleOpenVeoKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setHasVeoKey(true);
    }
  };

  const handleGenerate = async (customPrompt?: string) => {
    let finalPrompt = customPrompt || prompt;
    let label = finalPrompt;

    if (finalPrompt === 'AUTO_VERSE') {
      setLoading(true);
      setLoadingMessage("Selecting a blessed verse...");
      try {
        const { prompt: versePrompt, verseInfo } = await generateDailyVersePrompt();
        finalPrompt = versePrompt;
        label = `Verse Illustration: ${verseInfo}`;
      } catch (e) {
        setError("Could not reach the Quran pad. Please try a different theme.");
        setLoading(false);
        return;
      }
    }

    if (!finalPrompt) return;

    setLoading(true);
    setError(null);
    setLoadingMessage(modality === 'image' ? "AI is crafting your vision..." : "Synthesizing cinematic motion... This may take a few minutes.");
    
    try {
      let assetUrl = '';
      if (modality === 'image') {
        assetUrl = await generateSacredArt(finalPrompt);
      } else {
        assetUrl = await generateSacredVideo(finalPrompt);
      }

      setGeneratedAsset({ url: assetUrl, type: modality });
      onSaveArt({
        id: Math.random().toString(36).substr(2, 9),
        url: assetUrl,
        prompt: label,
        timestamp: Date.now()
      });
    } catch (err: any) {
      if (err.message?.includes("entity was not found")) {
         setError("API Key verification failed. Please re-select your scholarly key.");
         setHasVeoKey(false);
      } else {
         setError("The AI could not fulfill this artistic request. Please refine your vision.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sortedGallery = useMemo(() => {
    return [...history]
      .filter(a => a.prompt.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        return sortOrder === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
      });
  }, [history, sortOrder, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-50 dark:bg-[#121212] overflow-hidden animate-fade-in relative transition-colors duration-300">
      <header className="px-8 py-6 bg-white dark:bg-[#1A1A1A] border-b border-stone-200 dark:border-white/5 flex items-center justify-between shadow-sm z-20">
        <div className={`flex items-center ${lang === 'ar' ? 'space-x-reverse' : ''} space-x-4`}>
          <div className="w-12 h-12 rounded-2xl bg-scholar-gold/10 flex items-center justify-center text-scholar-gold border border-scholar-gold/20 shadow-sm">
            <i className={`fas ${modality === 'image' ? 'fa-palette' : 'fa-film'} text-xl`}></i>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-white tracking-tight">{modality === 'image' ? t.artsTitle : "Sacred Cinema"}</h2>
            <p className="text-[10px] text-scholar-muted font-black uppercase tracking-[0.2em] mt-1">{t.artsSub}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 bg-stone-100 dark:bg-black/40 p-1.5 rounded-2xl border dark:border-white/5">
          <button 
            onClick={() => setActiveTab('studio')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'studio' ? 'bg-white dark:bg-[#262626] text-scholar-gold shadow-sm border dark:border-white/10' : 'text-scholar-muted hover:text-stone-900 dark:hover:text-white'}`}
          >
            {t.artsTabStudio}
          </button>
          <button 
            onClick={() => setActiveTab('gallery')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'gallery' ? 'bg-white dark:bg-[#262626] text-scholar-gold shadow-sm border dark:border-white/10' : 'text-scholar-muted hover:text-stone-900 dark:hover:text-white'}`}
          >
            {t.artsTabGallery}
            {history.length > 0 && <span className="ml-2 bg-scholar-gold/20 text-scholar-gold px-1.5 py-0.5 rounded text-[8px]">{history.length}</span>}
          </button>
        </div>

        <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-white/5 rounded-full transition-colors text-stone-400">
          <i className="fas fa-times text-xl"></i>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar relative z-10">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'studio' ? (
            <div className="space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-10">
                  <div className="bg-white dark:bg-[#1F1F1F] p-10 rounded-[2.5rem] border dark:border-white/5 shadow-xl space-y-8">
                    <div className="flex items-center space-x-4 bg-stone-50 dark:bg-black/20 p-2 rounded-2xl border dark:border-white/5">
                      <button onClick={() => setModality('image')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${modality === 'image' ? 'bg-scholar-gold text-white' : 'text-scholar-muted'}`}>Static Art</button>
                      <button onClick={() => setModality('video')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${modality === 'video' ? 'bg-scholar-gold text-white' : 'text-scholar-muted'}`}>Motion Film</button>
                    </div>

                    {modality === 'video' && !hasVeoKey && (
                      <div className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-200 dark:border-amber-900/30">
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-200 leading-relaxed mb-4">
                          Educational video generation requires a paid Scholarly Key. 
                        </p>
                        <button onClick={handleOpenVeoKey} className="w-full bg-amber-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90">Select Key</button>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-scholar-muted uppercase tracking-[0.3em] ml-1">{t.artsVisionLabel}</label>
                      <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={modality === 'image' ? "e.g., A starlit mosque in the Alhambra style..." : "e.g., Cinematic slow motion of sand dunes in the Arabian desert..."}
                        className="w-full bg-stone-50 dark:bg-black/20 border border-stone-200 dark:border-white/5 rounded-3xl p-8 text-base h-40 focus:outline-none focus:ring-4 focus:ring-scholar-gold/10 focus:border-scholar-gold/40 transition-all resize-none dark:text-white"
                      />
                    </div>
                    
                    {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold">{error}</div>}

                    <button 
                      onClick={() => handleGenerate()}
                      disabled={loading || !prompt || (modality === 'video' && !hasVeoKey)}
                      className="w-full bg-scholar-gold text-white rounded-3xl py-6 font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-50"
                    >
                      {loading ? <i className="fas fa-certificate fa-spin text-xl"></i> : <><i className={`fas ${modality === 'image' ? 'fa-wand-magic-sparkles' : 'fa-film'}`}></i><span>{modality === 'image' ? t.artsGenerateBtn : "Generate Film"}</span></>}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-scholar-muted uppercase tracking-[0.4em] ml-1">{t.artsPresetsLabel}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {presets.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => { setPrompt(p.prompt); handleGenerate(p.prompt); }}
                          className={`p-6 bg-white dark:bg-[#1F1F1F] border border-stone-100 dark:border-white/5 rounded-[1.8rem] text-left hover:border-scholar-gold transition-all group shadow-sm`}
                        >
                          <p className="text-[13px] font-bold text-stone-700 dark:text-stone-300 group-hover:text-scholar-gold">{p.label}</p>
                          <i className={`fas ${p.special ? 'fa-star text-amber-500' : 'fa-arrow-right mt-3'} text-[10px] text-scholar-muted`}></i>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  {loading ? (
                    <div className="w-full aspect-[3/2] bg-white dark:bg-[#1F1F1F] rounded-[3rem] border-2 border-dashed border-scholar-gold/20 flex flex-col items-center justify-center space-y-6 animate-pulse">
                      <div className="w-20 h-20 rounded-full bg-scholar-gold/10 flex items-center justify-center">
                        <i className="fas fa-palette text-scholar-gold text-3xl animate-bounce"></i>
                      </div>
                      <p className="text-xs font-black uppercase tracking-[0.3em] text-scholar-gold animate-pulse">{loadingMessage}</p>
                    </div>
                  ) : generatedAsset ? (
                    <div className="group relative w-full aspect-[3/2] bg-black rounded-[3rem] overflow-hidden shadow-2xl animate-fade-in border-4 border-white dark:border-stone-800">
                      {generatedAsset.type === 'image' ? (
                        <img src={generatedAsset.url} className="w-full h-full object-cover" alt="Generated" />
                      ) : (
                        <video src={generatedAsset.url} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                        <button onClick={() => handleDownload(generatedAsset.url, `sacred-${Date.now()}`)} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-stone-900 shadow-xl hover:scale-110 transition-all"><i className="fas fa-download"></i></button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-[3/2] bg-stone-100 dark:bg-black/20 rounded-[3rem] border-2 border-dashed border-stone-200 dark:border-white/5 flex flex-col items-center justify-center space-y-4 opacity-50">
                      <i className="fas fa-image text-5xl text-stone-300"></i>
                      <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Canvas Awaiting Vision</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-10 animate-fade-in">
              {history.length === 0 ? (
                <div className="py-40 text-center space-y-6 opacity-30">
                  <i className="fas fa-box-open text-6xl"></i>
                  <p className="text-sm font-bold uppercase tracking-widest">No artifacts in this collection yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {sortedGallery.map((art) => (
                    <div key={art.id} className="group bg-white dark:bg-[#1F1F1F] rounded-[2.5rem] overflow-hidden border dark:border-white/5 shadow-md hover:shadow-2xl transition-all">
                      <div className="aspect-[3/2] overflow-hidden relative">
                        <img src={art.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Artifact" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                          <button onClick={() => handleDownload(art.url, `art-${art.id}`)} className="w-10 h-10 bg-white text-stone-900 rounded-full flex items-center justify-center"><i className="fas fa-download text-xs"></i></button>
                          <button onClick={() => onRemoveArt(art.id)} className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center"><i className="fas fa-trash text-xs"></i></button>
                        </div>
                      </div>
                      <div className="p-6">
                        <p className="text-[11px] font-bold text-stone-600 dark:text-stone-300 line-clamp-2 leading-relaxed">{art.prompt}</p>
                        <span className="text-[8px] font-black text-scholar-muted uppercase tracking-widest mt-4 block">{new Date(art.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SacredArts;
