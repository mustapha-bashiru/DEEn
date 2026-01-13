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
      id: 'news',
      title: "Sanctuary Briefing",
      description: lang === 'ar' ? "أخبار علمية في الوقت الفعلي. نقوم الآن بمسح الخلاصات الموثقة لنقدم لك تحديثات مباشرة من المؤسسات الإسلامية الرائدة." : "Real-time scholarly news. We now scan verified feeds to bring you live updates from leading Islamic institutions.",
      icon: "fa-rss",
      color: "bg-blue-600",
      tag: "LIVE",
      actionLabel: lang === 'ar' ? "عرض آخر الأخبار" : "View Latest News",
      view: 'chat' as const,
      prompt: t.newsPrompt
    },
    {
      id: 'legacy',
      title: "Legacy Explorer",
      description: lang === 'ar' ? "منهج علمي مستمر. نستكشف كل يوم عمالقة العلم والفلسفة والفقه الإسلامي." : "A continuous scholarly curriculum exploring the giants of Islamic science and philosophy in a connected narrative.",
      icon: "fa-pen-fancy",
      color: "bg-amber-600",
      tag: "WISDOM",
      actionLabel: lang === 'ar' ? "ادخل السلسلة" : "Enter the Chain",
      view: 'chat' as const,
      prompt: t.legacyPrompt
    }
  ];

  const handleLaunch = () => {
    const feature = features[activeIndex];
    onNavigate(feature.view, feature.prompt);
    onClose();
  };

  const handleNext = () => {
    if (activeIndex < features.length - 1) {
      setActiveIndex(prev => prev + 1);
    } else {
      // Once we've seen everything, close discovery
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-[#121212] animate-fade-in overflow-hidden">
      <button 
        onClick={onClose}
        className="absolute top-10 right-10 w-12 h-12 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center transition-all z-50 border border-white/5"
      >
        <i className="fas fa-times"></i>
      </button>

      <div className="max-w-md w-full flex flex-col items-center">
        
        {/* Top Feature Visual Container */}
        <div className="w-full h-80 bg-[#1F1F1F] rounded-[4rem] border border-white/5 flex flex-col items-center justify-center mb-10 relative overflow-hidden group">
          <div className={`w-32 h-32 rounded-[2.5rem] ${features[activeIndex].color} shadow-[0_0_80px_-20px_rgba(37,99,235,0.4)] flex items-center justify-center mb-6 transition-transform group-hover:scale-105 duration-700`}>
            <i className={`fas ${features[activeIndex].icon} text-5xl text-white`}></i>
          </div>
          <span className="bg-white/5 text-[10px] font-black tracking-[0.5em] uppercase px-5 py-2 rounded-full text-white/40 mb-4 border border-white/5">
            {features[activeIndex].tag}
          </span>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{features[activeIndex].title}</h3>
        </div>

        {/* Content Section */}
        <div className="space-y-4 text-center animate-fade-in mb-16" key={activeIndex}>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">
            {features[activeIndex].title}
          </h2>
          <p className="text-scholar-muted text-[15px] leading-relaxed max-w-sm mx-auto font-medium opacity-80">
            {features[activeIndex].description}
          </p>
        </div>

        {/* Footer Controls */}
        <div className="w-full flex flex-col space-y-4">
          <button 
            onClick={handleLaunch}
            className="w-full bg-[#10B981] hover:bg-emerald-500 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center space-x-4"
          >
            <span>{features[activeIndex].actionLabel}</span>
            <i className="fas fa-bolt-lightning text-sm"></i>
          </button>

          <button 
            onClick={handleNext}
            className="w-full bg-transparent border-2 border-white/10 hover:border-white/20 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest transition-all active:scale-95"
          >
            {activeIndex === features.length - 1 ? "Begin Journey" : "Discover More"}
          </button>
        </div>

        {/* Pagination Dots */}
        <div className="flex space-x-3 mt-12">
          {features.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-500 ${i === activeIndex ? 'w-12 bg-[#10B981]' : 'w-1.5 bg-neutral-800'}`}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DiscoveryOverlay;