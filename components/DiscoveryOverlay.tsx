
import React, { useState } from 'react';
import { Language, translations } from '../translations';

interface DiscoveryOverlayProps {
  lang: Language;
  onClose: () => void;
  isPremium: boolean;
  onOpenAuth: () => void;
  onNavigate: (view: 'chat' | 'bookmarks' | 'quran' | 'arts', initialPrompt?: string) => void;
}

const DiscoveryOverlay: React.FC<DiscoveryOverlayProps> = ({ onClose, isPremium, onOpenAuth, onNavigate, lang }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const t = translations[lang];

  const features = [
    {
      id: 'legacy',
      title: t.legacyOfKnowledge,
      description: lang === 'ar' ? "منهج علمي مستمر. نستكشف كل يوم عمالقة العلم والفلسفة والفقه الإسلامي في رواية متصلة." : "A continuous scholarly curriculum. Everyday, we explore the giants of Islamic science, philosophy, and jurisprudence in a connected narrative.",
      icon: "fa-pen-fancy",
      color: "bg-amber-600",
      tag: lang === 'ar' ? "متاح" : "UNLOCKED",
      actionLabel: lang === 'ar' ? "ادخل السلسلة" : "Enter the Chain",
      view: 'chat' as const,
      prompt: t.legacyPrompt
    },
    {
      id: 'news',
      title: t.scholarlyNews,
      description: lang === 'ar' ? "أخبار علمية في الوقت الفعلي. نقوم الآن بمسح الخلاصات الموثقة لنقدم لك تحديثات مباشرة من المؤسسات الإسلامية الرائدة." : "Real-time scholarly news. We now scan verified feeds to bring you live updates from leading Islamic institutions.",
      icon: "fa-rss",
      color: "bg-blue-600",
      tag: "LIVE",
      actionLabel: lang === 'ar' ? "عرض آخر الأخبار" : "View Latest News",
      view: 'chat' as const,
      prompt: t.newsPrompt
    },
    {
      id: 'arts',
      title: t.sacredArts,
      description: lang === 'ar' ? "ولد جماليات إسلامية مذهلة باستخدام نماذجنا التوليدية. من خط الثلث إلى الهندسة الأندلسية." : "Generate stunning Islamic aesthetics using our generative models. From Thuluth calligraphy to Andalusian geometry.",
      icon: "fa-palette",
      color: "bg-emerald-600",
      tag: "STUDIO",
      actionLabel: lang === 'ar' ? "افتح الاستوديو" : "Open Studio",
      view: 'arts' as const
    }
  ];

  const handleLaunch = () => {
    const feature = features[activeIndex];
    onNavigate(feature.view, feature.prompt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-stone-950/90 backdrop-blur-xl animate-fade-in">
      <div className="max-w-md w-full flex flex-col items-center text-center">
        
        {/* Card Stack Visualization */}
        <div className="relative w-64 h-80 mb-12">
          {features.map((f, i) => {
            const isTop = i === activeIndex;
            const offset = (i - activeIndex);
            
            if (offset < 0) return null;

            return (
              <div 
                key={i}
                className={`absolute inset-0 rounded-[2.5rem] border-2 shadow-2xl transition-all duration-500 flex flex-col items-center justify-center p-8 ${
                  isTop 
                    ? 'z-30 bg-white border-white scale-100 opacity-100 translate-y-0' 
                    : `z-20 bg-stone-800 border-stone-700 scale-90 opacity-40 translate-y-8`
                }`}
                style={{ 
                  transform: `translateY(${offset * 12}px) scale(${1 - (offset * 0.05)})`,
                  zIndex: 30 - i
                }}
              >
                <div className={`w-20 h-20 rounded-3xl ${f.color} text-white flex items-center justify-center mb-6 shadow-xl`}>
                  <i className={`fas ${f.icon} text-3xl`}></i>
                </div>
                <div className="flex items-center space-x-2 mb-3">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full tracking-widest ${isTop ? 'bg-stone-100 text-stone-900' : 'bg-white/10 text-white/50'}`}>
                    {f.tag}
                  </span>
                </div>
                <h3 className={`text-xl font-bold ${isTop ? 'text-stone-900' : 'text-white'}`}>{f.title}</h3>
              </div>
            );
          })}
        </div>

        {/* Content Section */}
        <div className="space-y-4 animate-fade-in" key={activeIndex}>
          <h2 className="text-3xl font-black text-white tracking-tight">
            {t.discoveryTitle}
          </h2>
          <p className="text-stone-400 text-sm leading-relaxed max-w-sm mx-auto font-medium">
            {features[activeIndex].description}
          </p>
        </div>

        {/* Footer Controls */}
        <div className="mt-12 w-full flex flex-col space-y-3">
          <button 
            onClick={handleLaunch}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-bold shadow-xl shadow-emerald-900/40 transition-all active:scale-95 flex items-center justify-center space-x-3"
          >
            <span>{features[activeIndex].actionLabel}</span>
            <i className={`fas fa-bolt ${lang === 'ar' ? 'mr-3' : 'ml-3'}`}></i>
          </button>

          {activeIndex < features.length - 1 ? (
            <button 
              onClick={() => setActiveIndex(prev => prev + 1)}
              className="w-full bg-white/5 hover:bg-white/10 text-white py-5 rounded-2xl font-bold border border-white/10 transition-all active:scale-95"
            >
              {t.discoveryMoreBtn}
            </button>
          ) : (
            <button 
              onClick={onClose}
              className="w-full bg-white text-stone-900 py-5 rounded-2xl font-bold shadow-xl transition-all active:scale-95"
            >
              {t.discoveryLaunchBtn}
            </button>
          )}
        </div>

        {/* Pagination Dots */}
        <div className="flex space-x-2 mt-8">
          {features.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-300 ${i === activeIndex ? 'w-8 bg-emerald-500' : 'w-1.5 bg-stone-700'}`}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DiscoveryOverlay;
