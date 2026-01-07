
import React, { useState } from 'react';
import { generateSacredArt } from '../services/geminiService';
import { Language, translations } from '../translations';

interface SacredArtsProps {
  lang: Language;
  isPremium: boolean;
  onOpenAuth: () => void;
  onClose: () => void;
}

const presets = [
  { id: 'thuluth', label: 'Thuluth Calligraphy', prompt: 'Bismillah in exquisite gold Thuluth calligraphy on a deep navy textured parchment background, intricate borders' },
  { id: 'geometry', label: 'Andalusian Geometry', prompt: 'Complex Islamic geometric patterns in sapphire and emerald hues, mathematical precision, Alhambra style' },
  { id: 'landscape', label: 'Starlit Mosque', prompt: 'Silhouette of an ancient mosque dome and minarets against a vast starlit night sky, crescent moon, cinematic lighting' },
  { id: 'manuscript', label: 'Ancient Manuscript', prompt: 'Traditional Islamic manuscript page, hand-painted calligraphy with ornate floral illuminations, weathered edges' },
  { id: 'kufic', label: 'Modern Kufic', prompt: 'Square Kufic script, minimalist architectural style, monochromatic with silver accents' },
  { id: 'mashrabiya', label: 'Wooden Lattice', prompt: 'Detailed Mashrabiya wooden lattice window, soft morning sunlight casting geometric shadows, dust motes' }
];

const SacredArts: React.FC<SacredArtsProps> = ({ isPremium, onOpenAuth, onClose, lang }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = translations[lang];

  const handleGenerate = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt) return;

    setLoading(true);
    setError(null);
    try {
      const imageUrl = await generateSacredArt(finalPrompt);
      setGeneratedImage(imageUrl);
    } catch (err) {
      setError("The AI could not fulfill this artistic request. Please try a different theme.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `SacredArt-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-50 overflow-hidden animate-fade-in relative">
      <header className="px-6 py-6 bg-white border-b border-stone-200 flex items-center justify-between shadow-sm">
        <div className={`flex items-center ${lang === 'ar' ? 'space-x-reverse' : ''} space-x-4`}>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shadow-sm">
            <i className="fas fa-palette text-xl"></i>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">{t.artsTitle}</h2>
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mt-1">{t.artsSub}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-stone-600">
          <i className="fas fa-times text-xl"></i>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Controls */}
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-[2rem] border border-stone-200 shadow-sm space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">{t.artsVisionLabel}</label>
                  <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A starlit mosque in the Alhambra style..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-6 text-sm h-32 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all resize-none"
                  />
                </div>
                <button 
                  onClick={() => handleGenerate()}
                  disabled={loading || !prompt}
                  className="w-full bg-amber-800 hover:bg-amber-900 text-white rounded-2xl py-5 font-bold shadow-xl shadow-amber-900/20 active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : <><i className={`fas fa-wand-sparkles ${lang === 'ar' ? 'ml-3' : ''}`}></i><span>{t.artsGenerateBtn}</span></>}
                </button>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">{t.artsPresetsLabel}</h4>
                <div className="grid grid-cols-2 gap-3">
                  {presets.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => { setPrompt(p.prompt); handleGenerate(p.prompt); }}
                      className={`p-4 bg-white border border-stone-200 rounded-2xl ${lang === 'ar' ? 'text-right' : 'text-left'} hover:border-amber-400 hover:bg-amber-50/50 transition-all group`}
                    >
                      <p className="text-xs font-bold text-stone-700 group-hover:text-amber-900">{p.label}</p>
                      <i className={`fas ${lang === 'ar' ? 'fa-chevron-left mr-2 group-hover:-translate-x-1' : 'fa-chevron-right mt-2 group-hover:translate-x-1'} text-[10px] text-stone-300 transition-all`}></i>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Display */}
            <div className="flex flex-col">
              <div className={`aspect-square rounded-[3rem] border-2 border-dashed border-stone-200 flex items-center justify-center relative overflow-hidden bg-stone-100 ${loading ? 'animate-pulse' : ''}`}>
                {generatedImage ? (
                  <>
                    <img src={generatedImage} alt="Sacred Art" className="w-full h-full object-cover animate-fade-in" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center space-x-4 backdrop-blur-sm">
                      <button onClick={handleDownload} className="w-14 h-14 rounded-2xl bg-white text-stone-900 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                        <i className="fas fa-download text-xl"></i>
                      </button>
                      <button className="w-14 h-14 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                        <i className="fas fa-share-nodes text-xl"></i>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center px-8">
                     {loading ? (
                       <div className="space-y-4">
                         <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto animate-bounce">
                           <i className="fas fa-brush text-2xl text-amber-600"></i>
                         </div>
                         <p className="text-sm font-bold text-amber-900">{t.artsCrafting}</p>
                       </div>
                     ) : (
                       <div className="space-y-4 opacity-30">
                         <i className="fas fa-image text-6xl"></i>
                         <p className="text-sm font-bold uppercase tracking-widest">{t.artsVisionLabel}</p>
                       </div>
                     )}
                  </div>
                )}
              </div>
              {error && <p className="mt-4 text-center text-red-500 text-xs font-medium">{error}</p>}
              {generatedImage && (
                <div className="mt-6 flex justify-between items-center text-stone-400">
                  <p className="text-[10px] font-bold uppercase tracking-widest">{t.artsCopyright}</p>
                  <button onClick={() => setGeneratedImage(null)} className="text-[10px] font-bold uppercase tracking-widest hover:text-red-500">{t.artsReset}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SacredArts;
