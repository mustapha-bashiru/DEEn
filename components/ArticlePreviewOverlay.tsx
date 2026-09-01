
import React, { useState, useEffect } from 'react';
import { ArticleLead } from '../types';
import { Language, translations } from '../translations';
import { GoogleGenAI } from '@google/genai';
import { MODEL_NAME } from '../constants';
import { env } from '../config/env';

interface ArticlePreviewOverlayProps {
  article: ArticleLead;
  lang: Language;
  onClose: () => void;
  onExplore: () => void;
}

const ArticlePreviewOverlay: React.FC<ArticlePreviewOverlayProps> = ({ article, lang, onClose, onExplore }) => {
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const t = translations[lang];

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Provide a short, 3-paragraph executive summary for an Islamic scholarly article titled "${article.title}" based on this context: "${article.context}". Focus on key arguments and scholarly significance.`,
        });
        setPreviewContent(response.text || "Preview unavailable.");
      } catch (e) {
        setPreviewContent("Failed to generate preview. You can still explore the full article.");
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [article]);

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center p-6 bg-stone-950/80 backdrop-blur-md animate-fade-in">
      <div className="max-w-2xl w-full bg-white dark:bg-stone-900 rounded-[3rem] shadow-2xl border dark:border-stone-800 overflow-hidden flex flex-col max-h-[85vh]">
        <header className="p-8 border-b dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 shadow-sm">
              <i className="fas fa-book-open"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">{t.previewTitle}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Knowledge Synthesis</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-400">
            <i className="fas fa-times"></i>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
          <div className="space-y-6">
            <h1 className="text-3xl font-black text-stone-900 dark:text-stone-100 leading-tight">
              {article.title}
            </h1>
            
            <div className="flex items-center space-x-4">
               <div className="flex -space-x-2">
                  {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-stone-900 bg-stone-200 dark:bg-stone-800"></div>)}
               </div>
               <span className="text-[10px] font-bold text-stone-400">Cited by Sanctuary Scholars</span>
            </div>

            <div className="prose prose-stone dark:prose-invert max-w-none">
              {loading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded-full w-3/4"></div>
                  <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded-full w-full"></div>
                  <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded-full w-5/6"></div>
                  <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest text-center py-10">{t.previewLoading}</p>
                </div>
              ) : (
                <div className="text-stone-600 dark:text-stone-300 leading-relaxed text-base whitespace-pre-wrap italic">
                   {previewContent}
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="p-8 bg-stone-50 dark:bg-stone-950 border-t dark:border-stone-800 flex flex-col md:flex-row gap-4">
           <button 
             onClick={onExplore}
             className="flex-1 bg-emerald-900 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center justify-center space-x-3"
           >
              <span>{t.previewAction}</span>
              <i className="fas fa-arrow-right"></i>
           </button>
           <button 
             onClick={onClose}
             className="px-8 py-4 bg-white dark:bg-stone-900 border dark:border-stone-800 text-stone-500 rounded-2xl font-bold transition-all hover:bg-stone-100"
           >
             Close
           </button>
        </footer>
      </div>
    </div>
  );
};

export default ArticlePreviewOverlay;
