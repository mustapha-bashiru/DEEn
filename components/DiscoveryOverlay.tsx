
import React, { useState } from 'react';

interface DiscoveryOverlayProps {
  onClose: () => void;
  isPremium: boolean;
  onOpenAuth: () => void;
  onNavigate: (view: 'chat' | 'bookmarks' | 'quran' | 'arts', initialPrompt?: string) => void;
}

const features = [
  {
    id: 'news',
    title: "Pulse of the Ummah",
    description: "Real-time scholarly news. We now scan verified X (Twitter) feeds to bring you live updates from the world's leading Islamic institutions.",
    icon: "fab fa-x-twitter",
    color: "bg-stone-900",
    tag: "LIVE",
    actionLabel: "Try Pulse News",
    view: 'chat' as const,
    prompt: "What is the latest scholarly news on X today?"
  },
  {
    id: 'arts',
    title: "Sacred Arts AI",
    description: "Generate stunning Islamic calligraphy and geometric patterns using our advanced image model. Exclusive for Students of Knowledge.",
    icon: "fa-palette",
    color: "bg-amber-600",
    tag: "PRO",
    actionLabel: "Open Studio",
    view: 'arts' as const
  },
  {
    id: 'voice',
    title: "Voice of Knowledge",
    description: "Listen to scholarly responses with our new high-fidelity text-to-speech engine. Perfect for learning on the go.",
    icon: "fa-volume-up",
    color: "bg-teal-600",
    tag: "NEW",
    actionLabel: "Try it in Chat",
    view: 'chat' as const
  }
];

const DiscoveryOverlay: React.FC<DiscoveryOverlayProps> = ({ onClose, isPremium, onOpenAuth, onNavigate }) => {
  const [activeIndex, setActiveIndex] = useState(0);

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
            
            if (offset < 0) return null; // Simple carousel logic

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
                  <i className={`${f.icon} text-3xl`}></i>
                </div>
                <div className="flex items-center space-x-2 mb-3">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full tracking-widest ${isTop ? 'bg-stone-100 text-stone-900' : 'bg-white/10 text-white/50'}`}>
                    {f.tag}
                  </span>
                  {f.tag === 'PRO' && <i className="fas fa-crown text-[10px] text-amber-500"></i>}
                </div>
                <h3 className={`text-xl font-bold ${isTop ? 'text-stone-900' : 'text-white'}`}>{f.title}</h3>
              </div>
            );
          })}
        </div>

        {/* Content Section */}
        <div className="space-y-4 animate-fade-in" key={activeIndex}>
          <h2 className="text-3xl font-black text-white tracking-tight">
            Discovery Hub
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
            <i className="fas fa-bolt"></i>
          </button>

          {activeIndex < features.length - 1 ? (
            <button 
              onClick={() => setActiveIndex(prev => prev + 1)}
              className="w-full bg-white/5 hover:bg-white/10 text-white py-5 rounded-2xl font-bold border border-white/10 transition-all active:scale-95"
            >
              Next Update
            </button>
          ) : (
            <button 
              onClick={onClose}
              className="w-full bg-white text-stone-900 py-5 rounded-2xl font-bold shadow-xl transition-all active:scale-95"
            >
              Return to Inquiry
            </button>
          )}

          {!isPremium && (
            <button 
              onClick={onOpenAuth}
              className="text-stone-500 text-xs font-bold uppercase tracking-widest hover:text-amber-500 transition-colors py-2"
            >
              Unlock Pro Features
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
