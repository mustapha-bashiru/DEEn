
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
  
  // Persisted state for Studio
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
  
  // Gallery Management
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [hasVeoKey, setHasVeoKey] = useState(false);

  const t = translations[lang];

  // Save state to localStorage whenever prompt or modality changes
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (url: string, title: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Sacred Art from Ask the Scholars',
          text: title,
          url: url
        });
      } catch (e) { console.warn("Share failed", e); }
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard for sharing.");
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const batchDelete = () => {
    selectedIds.forEach(id => onRemoveArt(id));
    setSelectedIds(new Set());
    setIsSelectionMode(false);
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
                    
                    {/* Modality Selector */}
                    <div className="flex items-center space-x-4 bg-stone-50 dark:bg-black/20 p-2 rounded-2xl border dark:border-white/5">
                      <button onClick={() => setModality('image')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${modality === 'image' ? 'bg-scholar-gold text-white' : 'text-scholar-muted'}`}>Static Art</button>
                      <button onClick={() => setModality('video')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${modality === 'video' ? 'bg-scholar-gold text-white' : 'text-scholar-muted'}`}>Motion Film</button>
                    </div>

                    {modality === 'video' && !hasVeoKey && (
                      <div className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-200 dark:border-amber-900/30">
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-200 leading-relaxed mb-4">
                          Educational video generation requires a paid Scholarly Key. 
                          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline ml-1">Learn about billing</a>.
                        </p>
                        <button onClick={handleOpenVeoKey} className="w-full bg-amber-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90">Select Key</button>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-scholar-muted uppercase tracking-[0.3em] ml-1">{t.artsVisionLabel}</label>
                      <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={modality === 'image' ? "e.g., A starlit mosque in the Alhambra style..." : "e.g., A cinematic educational video showing the rotation of the planets..."}
                        className="w-full bg-stone-50 dark:bg-black/20 border border-stone-200 dark:border-white/5 rounded-3xl p-8 text-base h-40 focus:outline-none focus:ring-4 focus:ring-scholar-gold/10 focus:border-scholar-gold/40 transition-all resize-none dark:text-white"
                      />
                    </div>
                    <button 
                      onClick={() => handleGenerate()}
                      disabled={loading || !prompt || (modality === 'video' && !hasVeoKey)}
                      className="w-full bg-scholar-gold text-white dark:text-neutral-dark rounded-3xl py-6 font-black uppercase tracking-[0.2em] shadow-xl shadow-scholar-gold/20 active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? <i className="fas fa-certificate fa-spin text-xl"></i> : <><i className={`fas ${modality === 'image' ? 'fa-wand-magic-sparkles' : 'fa-film'} ${lang === 'ar' ? 'ml-3' : ''}`}></i><span>{modality === 'image' ? t.artsGenerateBtn : "Generate Film"}</span></>}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-scholar-muted uppercase tracking-[0.4em] ml-1">{t.artsPresetsLabel}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {presets.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => { setPrompt(p.prompt); handleGenerate(p.prompt); }}
                          className={`p-6 bg-white dark:bg-[#1F1F1F] border border-stone-100 dark:border-white/5 rounded-[1.8rem] ${lang === 'ar' ? 'text-right' : 'text-left'} hover:border-scholar-gold dark:hover:border-scholar-gold/40 hover:bg-scholar-gold/5 transition-all group shadow-sm`}
                        >
                          <p className="text-[13px] font-bold text-stone-700 dark:text-stone-300 group-hover:text-scholar-gold transition-colors">{p.label}</p>
                          <i className={`fas ${p.special ? 'fa-star text-amber-500' : (lang === 'ar' ? 'fa-arrow-left mr-2 group-hover:-translate-x-1' : 'fa-arrow-right mt-3 group-hover:translate-x-1')} text-[10px] text-scholar-muted transition-all`}></i>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className={`aspect-square rounded-[3.5rem] border-2 border-dashed border-stone-200 dark:border-white/10 flex items-center justify-center relative overflow-hidden bg-white/50 dark:bg-black/20 shadow-2xl backdrop-blur-md ${loading ? 'animate-pulse' : ''}`}>
                    {generatedAsset ? (
                      <>
                        {generatedAsset.type === 'image' ? (
                          <img src={generatedAsset.url} alt="Sacred Art" className="w-full h-full object-cover animate-fade-in" />
                        ) : (
                          <video src={generatedAsset.url} controls autoPlay loop className="w-full h-full object-cover animate-fade-in" />
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center space-x-6 backdrop-blur-md">
                          <button onClick={() => handleShare(generatedAsset.url, prompt)} className="w-16 h-16 rounded-2xl bg-white text-stone-900 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform active:scale-95">
                            <i className="fas fa-share-nodes text-xl"></i>
                          </button>
                          <button onClick={() => setGeneratedAsset(null)} className="w-16 h-16 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform active:scale-95">
                            <i className="fas fa-trash-can text-xl"></i>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center px-8">
                         {loading ? (
                           <div className="space-y-6">
                             <div className="w-20 h-20 bg-scholar-gold/10 rounded-full flex items-center justify-center mx-auto animate-bounce border border-scholar-gold/20">
                               <i className={`fas ${modality === 'image' ? 'fa-brush' : 'fa-film'} text-3xl text-scholar-gold`}></i>
                             </div>
                             <p className="text-[11px] font-black uppercase tracking-[0.4em] text-scholar-gold">{loadingMessage}</p>
                           </div>
                         ) : (
                           <div className="space-y-6 opacity-30">
                             <div className="w-24 h-24 bg-scholar-muted/10 rounded-[2rem] flex items-center justify-center mx-auto">
                                <i className={`fas ${modality === 'image' ? 'fa-image' : 'fa-clapperboard'} text-5xl text-scholar-muted`}></i>
                             </div>
                             <p className="text-[11px] font-black uppercase tracking-[0.6em] text-scholar-muted">{modality === 'image' ? "Envisioning Canvas" : "Director's View"}</p>
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                  {error && <p className="mt-6 text-center text-red-500 text-xs font-bold bg-red-50 dark:bg-red-500/10 py-3 rounded-2xl animate-shake">{error}</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              <div className="flex flex-col md:flex-row items-center justify-between border-b dark:border-white/5 pb-8 gap-6">
                <div className="flex flex-col">
                  <h3 className="text-2xl font-black text-stone-900 dark:text-white uppercase tracking-tighter">Your Sanctuary Gallery</h3>
                  <p className="text-xs text-scholar-muted font-bold tracking-wide mt-1 italic opacity-70">"{t.artsGalleryQuote}"</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 bg-stone-100 dark:bg-black/40 p-1.5 rounded-2xl border dark:border-white/5">
                  <div className="relative">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-scholar-muted text-[10px]"></i>
                    <input 
                      type="text" 
                      placeholder="Filter records..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-white dark:bg-[#1F1F1F] border border-stone-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-scholar-gold"
                    />
                  </div>
                  <button 
                    onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                    className="px-4 py-2.5 bg-white dark:bg-[#1F1F1F] rounded-xl text-[9px] font-black uppercase tracking-widest border border-stone-200 dark:border-white/10"
                  >
                    {sortOrder === 'newest' ? t.artsGallerySortNew : t.artsGallerySortOld}
                  </button>
                  <button 
                    onClick={() => setIsSelectionMode(!isSelectionMode)}
                    className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isSelectionMode ? 'bg-scholar-gold text-white' : 'bg-white dark:bg-[#1F1F1F] text-scholar-muted border border-stone-200 dark:border-white/10'}`}
                  >
                    {isSelectionMode ? 'Cancel Selection' : 'Manage Batch'}
                  </button>
                  {isSelectionMode && selectedIds.size > 0 && (
                    <button onClick={batchDelete} className="px-4 py-2.5 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">Remove {selectedIds.size}</button>
                  )}
                </div>
              </div>

              {sortedGallery.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center text-center space-y-8 animate-fade-in opacity-40">
                  <div className="w-24 h-24 bg-stone-200 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center">
                    <i className="fas fa-feather-pointed text-4xl text-scholar-muted"></i>
                  </div>
                  <h4 className="text-xl font-black text-stone-800 dark:text-white uppercase tracking-tighter">{t.artsGalleryEmpty}</h4>
                  <button onClick={() => setActiveTab('studio')} className="px-10 py-4 bg-scholar-gold text-white rounded-full text-[10px] font-black uppercase tracking-widest">Enter Studio</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
                  {sortedGallery.map((art) => (
                    <div 
                      key={art.id} 
                      onClick={() => isSelectionMode && toggleSelection(art.id)}
                      className={`group relative bg-white dark:bg-[#1F1F1F] rounded-[2.5rem] overflow-hidden shadow-lg border-2 transition-all duration-500 ${selectedIds.has(art.id) ? 'border-scholar-gold scale-95' : 'border-transparent dark:border-white/5 hover:shadow-2xl hover:-translate-y-2'}`}
                    >
                      <div className="aspect-square overflow-hidden relative">
                        {art.url.startsWith('blob:') || art.url.includes('video') ? (
                           <video src={art.url} className="w-full h-full object-cover" muted loop onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                        ) : (
                           <img src={art.url} alt={art.prompt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        )}
                        
                        {isSelectionMode && (
                          <div className="absolute top-4 right-4 z-20">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedIds.has(art.id) ? 'bg-scholar-gold border-scholar-gold' : 'bg-white/20 border-white/50'}`}>
                              {selectedIds.has(art.id) && <i className="fas fa-check text-[10px] text-white"></i>}
                            </div>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-8 backdrop-blur-[2px]">
                          <div className="flex justify-end space-x-3">
                            <button onClick={(e) => { e.stopPropagation(); handleShare(art.url, art.prompt); }} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10"><i className="fas fa-share-nodes text-xs"></i></button>
                            {!isSelectionMode && <button onClick={(e) => { e.stopPropagation(); onRemoveArt(art.id); }} className="w-10 h-10 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-200 flex items-center justify-center backdrop-blur-md transition-all border border-red-500/20"><i className="fas fa-trash-can text-xs"></i></button>}
                          </div>
                          
                          <div className="space-y-4 animate-slide-up">
                            <p className="text-[10px] text-white/90 font-medium leading-relaxed line-clamp-3 italic">"{art.prompt}"</p>
                            <div className="flex items-center justify-between pt-2 border-t border-white/10">
                              <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">{new Date(art.timestamp).toLocaleDateString()}</span>
                              <span className="text-[8px] font-black text-scholar-gold uppercase tracking-widest">{art.url.includes('blob') ? 'MOTION' : 'STATIC'}</span>
                            </div>
                          </div>
                        </div>
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
