
import React, { useState, useRef, useEffect } from 'react';
import { ChatSession, Message, Madhab, Sect, Attachment, ArticleLead, GroundingLink } from '../types';
import { Language, translations } from '../translations';

interface ChatInterfaceProps {
  lang: Language;
  setLang: (l: Language) => void;
  session: ChatSession | null;
  isTyping: boolean;
  typingText: string;
  error: string | null;
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  onOpenLive: () => void;
  currentSect: Sect;
  onPerspectiveChange: (sect: Sect, madhab: Madhab) => void;
  onFeedback: (rating: 'up' | 'down', comment?: string) => void;
  isGuest: boolean;
  onPreviewArticle: (article: ArticleLead) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const PulseDots = () => (
  <div className="flex space-x-1.5 items-center px-4 py-2 bg-scholar-gold/5 rounded-full w-fit animate-fade-in mb-4">
    <div className="w-1.5 h-1.5 bg-scholar-gold rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-1.5 h-1.5 bg-scholar-gold rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-1.5 h-1.5 bg-scholar-gold rounded-full animate-bounce"></div>
  </div>
);

const QuickPrompts = ({ lang, sect, onSelect }: { lang: Language, sect: Sect, onSelect: (p: string) => void }) => {
  const t = translations[lang];
  const prompts = sect === 'Sunni' ? [
    { id: 1, icon: 'fa-faucet-drip', label: t.promptAblutionSunni, color: 'text-blue-500' },
    { id: 2, icon: 'fa-person-praying', label: t.promptSalahSunni, color: 'text-emerald-500' },
    { id: 3, icon: 'fa-coins', label: t.promptZakatSunni, color: 'text-amber-500' },
    { id: 4, icon: 'fa-microchip', label: t.promptCrypto, color: 'text-purple-500' }
  ] : [
    { id: 1, icon: 'fa-faucet-drip', label: t.promptAblutionShia, color: 'text-blue-500' },
    { id: 2, icon: 'fa-person-praying', label: t.promptSalahShia, color: 'text-emerald-500' },
    { id: 3, icon: 'fa-hand-holding-dollar', label: t.promptKhumsShia, color: 'text-teal-500' },
    { id: 4, icon: 'fa-microchip', label: t.promptCrypto, color: 'text-purple-500' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl mx-auto mt-12 animate-fade-in">
      {prompts.map(p => (
        <button 
          key={p.id} 
          onClick={() => onSelect(p.label)}
          className="bg-white dark:bg-[#1F1F1F] p-6 rounded-[2rem] border border-black/5 dark:border-white/10 shadow-xl hover:border-scholar-gold transition-all group flex items-center space-x-6 space-x-reverse"
        >
          <div className={`w-14 h-14 rounded-2xl bg-stone-50 dark:bg-black/20 flex items-center justify-center ${p.color} border border-black/5 group-hover:bg-scholar-gold group-hover:text-white transition-all`}>
            <i className={`fas ${p.icon} text-xl`}></i>
          </div>
          <div className="text-right flex-1">
            <p className="text-[13px] font-bold text-neutral-900 dark:text-white tracking-tight line-clamp-2">{p.label}</p>
          </div>
        </button>
      ))}
    </div>
  );
};

// Use React.FC to properly handle intrinsic props like 'key' when mapping
const SourceChip: React.FC<{ source: GroundingLink }> = ({ source }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative inline-block m-1">
      <button 
        onClick={() => setExpanded(!expanded)}
        className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center space-x-2 ${
          expanded 
            ? 'bg-scholar-gold text-white border-scholar-gold shadow-lg' 
            : 'bg-white/50 dark:bg-black/20 text-scholar-muted border-black/5 dark:border-white/10 hover:border-scholar-gold/40'
        }`}
      >
        <i className={`fas ${source.type === 'web' ? 'fa-globe' : 'fa-location-dot'} text-[8px]`}></i>
        <span>{source.title.length > 25 ? source.title.substring(0, 25) + '...' : source.title}</span>
        <i className={`fas ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[8px] opacity-40`}></i>
      </button>

      {expanded && (
        <div className="absolute top-full left-0 mt-3 w-72 bg-white dark:bg-[#262626] border border-black/5 dark:border-white/10 rounded-3xl p-6 shadow-2xl z-50 animate-slide-up">
           <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 rounded-xl bg-scholar-gold/10 flex items-center justify-center text-scholar-gold">
                <i className={`fas ${source.type === 'web' ? 'fa-file-lines' : 'fa-mosque'} text-xs`}></i>
              </div>
              <h4 className="text-[11px] font-black uppercase text-neutral-900 dark:text-white line-clamp-2 leading-tight">{source.title}</h4>
           </div>
           <p className="text-[10px] text-scholar-muted leading-relaxed mb-5 italic">
             {source.description || "This scholarly source provides external grounding for the verified inquiry."}
           </p>
           <div className="flex items-center justify-between pt-4 border-t dark:border-white/5">
             <span className="text-[8px] font-black text-scholar-gold/60 uppercase tracking-widest">{source.type === 'web' ? 'DIGITAL FEED' : 'MAP DATA'}</span>
             <a 
               href={source.uri} 
               target="_blank" 
               rel="noopener noreferrer" 
               className="px-4 py-2 bg-scholar-gold text-white text-[9px] font-black uppercase rounded-lg hover:opacity-90 transition-all"
             >
               Visit Site
             </a>
           </div>
        </div>
      )}
    </div>
  );
};

const renderContent = (content: string) => {
  return content.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-4" />;
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      return (
        <div key={i} className="text-scholar-gold font-black text-[14px] uppercase tracking-[0.25em] mt-10 mb-6 border-b border-scholar-gold/10 pb-2">
          {trimmed.replace(/\*\*/g, '')}
        </div>
      );
    }
    const parts = trimmed.split(/(\*\*.*?\*\*)/g);
    return (
      <p key={i} className="mb-6 text-[15px] leading-[1.8] text-neutral-800 dark:text-neutral-200">
        {parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="text-scholar-gold font-bold">{part.replace(/\*\*/g, '')}</strong>;
          }
          return part;
        })}
      </p>
    );
  });
};

const MessageBubble = React.memo(({ m, onSuggestionClick }: { m: Message, onSuggestionClick: (s: string) => void }) => (
  <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
    <div className="max-w-[90%] md:max-w-[80%] space-y-4">
      <div className={`p-8 md:p-10 rounded-[2.5rem] border shadow-lg ${
        m.role === 'user' ? 'bg-scholar-gold text-white border-scholar-gold rounded-tr-none' : 'bg-white dark:bg-[#1F1F1F] text-neutral-900 dark:text-white border-black/5 dark:border-white/5 rounded-tl-none shadow-[0_10px_40px_rgba(0,0,0,0.03)]'
      }`}>
        {m.attachments && m.attachments.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-3">
            {m.attachments.map((at, idx) => (
              at.mimeType.startsWith('image/') ? (
                <img key={idx} src={`data:${at.mimeType};base64,${at.data}`} className="h-48 rounded-2xl object-cover border border-black/10 shadow-sm" alt="Attachment" />
              ) : (
                <div key={idx} className="bg-scholar-gold/5 p-4 rounded-2xl flex items-center space-x-3 border border-scholar-gold/10">
                  <i className="fas fa-file-pdf text-scholar-gold"></i>
                  <span className="text-[11px] font-bold truncate max-w-[150px]">{at.fileName || 'Document'}</span>
                </div>
              )
            ))}
          </div>
        )}
        <div className="max-w-none text-justify space-y-2">
          {renderContent(m.content)}
        </div>
        {m.sources && m.sources.length > 0 && (
          <div className="mt-8 pt-8 border-t border-black/5 dark:border-white/5">
             <span className="text-[9px] font-black text-scholar-muted uppercase tracking-[0.3em] block mb-4">Grounding Citations</span>
             <div className="flex flex-wrap">
               {m.sources.map((s, idx) => <SourceChip key={idx} source={s} />)}
             </div>
          </div>
        )}
      </div>
      {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 px-4">
          {m.suggestions.map((suggestion, idx) => (
            <button key={idx} onClick={() => onSuggestionClick(suggestion)} className="px-5 py-2.5 bg-white/60 dark:bg-[#1F1F1F]/60 border border-black/5 dark:border-white/10 rounded-full text-[10px] font-bold text-scholar-gold hover:bg-scholar-gold hover:text-white transition-all uppercase tracking-widest shadow-sm">
              <i className="fas fa-plus mr-2 opacity-50"></i>{suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
));

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  lang, setLang, session, isTyping, typingText, error, onSendMessage, onOpenLive, currentSect
}) => {
  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isActionsExpanded, setIsActionsExpanded] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, isTyping]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    setFileError(null);
    if (files.length === 0) return;
    files.forEach(file => {
      if (file.size > MAX_FILE_SIZE) { setFileError(`File too large.`); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setPendingAttachments(prev => [...prev, { mimeType: file.type, data: base64, fileName: file.name }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSendMessage = () => {
    if (input.trim() || pendingAttachments.length > 0) {
      onSendMessage(input, pendingAttachments.length > 0 ? pendingAttachments : undefined);
      setInput('');
      setPendingAttachments([]);
      setIsActionsExpanded(false);
    }
  };

  if (!session) return null;

  return (
    <div className={`flex-1 flex flex-col h-full bg-transparent overflow-hidden relative ${lang === 'ar' ? 'font-arabic' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Dynamic Navigation Header */}
      <div className="absolute top-4 right-8 z-50 flex items-center space-x-3">
        <button 
          onClick={onOpenLive}
          className="w-10 h-10 rounded-full bg-emerald-900 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-95"
          title="Live Majlis"
        >
          <i className="fas fa-tower-broadcast text-xs"></i>
        </button>
        <div className="flex items-center bg-white/10 dark:bg-black/20 backdrop-blur-md border border-black/5 dark:border-white/10 rounded-full p-1 shadow-xl">
           <button onClick={() => setLang('ar')} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${lang === 'ar' ? 'bg-scholar-gold text-white shadow-lg' : 'text-scholar-muted hover:text-white'}`}>Ar</button>
           <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${lang === 'en' ? 'bg-scholar-gold text-white shadow-lg' : 'text-scholar-muted hover:text-white'}`}>En</button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 md:p-12 space-y-12 custom-scrollbar">
        {session.messages.length === 0 && (
          <div className="max-w-4xl mx-auto py-20 flex flex-col items-center justify-center text-center space-y-8 animate-fade-in">
             <i className="fas fa-moon text-6xl text-scholar-gold opacity-40"></i>
             <div className="space-y-2">
               <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tighter">Sanctuary</h2>
               <p className="text-xs font-black text-scholar-muted uppercase tracking-[0.4em]">Establish Prayer • Seek Knowledge</p>
             </div>
             <QuickPrompts lang={lang} sect={currentSect} onSelect={onSendMessage} />
          </div>
        )}
        <div className="max-w-5xl mx-auto space-y-10 pb-20">
          {session.messages.map((m) => <MessageBubble key={m.id} m={m} onSuggestionClick={onSendMessage} />)}
          {isTyping && (
            <div className="flex flex-col space-y-2 ml-4">
              <PulseDots />
              <span className="text-[10px] font-black text-scholar-gold uppercase tracking-widest animate-pulse ml-2">{typingText}</span>
            </div>
          )}
          {(error || fileError) && (
            <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-3xl text-red-600 dark:text-red-400 text-sm font-bold flex items-center space-x-3 animate-shake">
               <i className="fas fa-circle-exclamation text-lg"></i>
               <span>{error || fileError}</span>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <div className="px-10 pb-12 pt-4 bg-transparent">
        <div className="max-w-4xl mx-auto">
          {pendingAttachments.length > 0 && (
            <div className="mb-4 p-4 bg-white/50 dark:bg-black/40 backdrop-blur-md rounded-[2.5rem] flex flex-wrap gap-4 border border-scholar-gold/20 animate-slide-up">
              {pendingAttachments.map((at, idx) => (
                <div key={idx} className="relative group/att">
                  {at.mimeType.startsWith('image/') ? (
                    <img src={`data:${at.mimeType};base64,${at.data}`} className="w-16 h-16 rounded-xl object-cover shadow-sm" alt="Preview" />
                  ) : (
                    <div className="w-16 h-16 bg-scholar-gold/10 rounded-xl flex items-center justify-center text-scholar-gold shadow-sm"><i className="fas fa-file-pdf"></i></div>
                  )}
                  <button onClick={() => setPendingAttachments(p => p.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-lg"><i className="fas fa-times"></i></button>
                </div>
              ))}
              <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-scholar-gold/30 flex items-center justify-center text-scholar-gold/50"><i className="fas fa-plus"></i></button>
            </div>
          )}

          <div className="flex items-center space-x-4 bg-white dark:bg-[#1F1F1F] border border-black/10 dark:border-white/10 rounded-[2.5rem] p-3 shadow-2xl transition-all hover:border-scholar-gold/20 relative">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept={SUPPORTED_TYPES.join(',')} />
            <div className="flex items-center space-x-1 px-2 border-r dark:border-white/5 relative">
              <button onClick={() => setIsActionsExpanded(!isActionsExpanded)} className={`w-10 h-10 rounded-full bg-scholar-gold/5 text-scholar-gold flex items-center justify-center transition-all ${isActionsExpanded ? 'rotate-45' : ''}`}><i className="fas fa-plus"></i></button>
              <div className={`flex items-center space-x-2 absolute left-14 top-1/2 -translate-y-1/2 transition-all ${isActionsExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
                <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-stone-50 dark:bg-black/40 text-scholar-muted hover:text-scholar-gold flex items-center justify-center shadow-sm"><i className="fas fa-paperclip"></i></button>
                <button className="w-10 h-10 rounded-full bg-stone-50 dark:bg-black/40 text-scholar-muted hover:text-scholar-gold flex items-center justify-center shadow-sm"><i className="fas fa-camera"></i></button>
              </div>
            </div>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} placeholder="Consult the Sanctuary..." className={`flex-1 bg-transparent border-none py-4 px-2 text-sm focus:outline-none dark:text-white resize-none max-h-32 custom-scrollbar transition-all ${isActionsExpanded ? 'ml-24' : ''}`} rows={1} />
            {(input.trim() || pendingAttachments.length > 0) ? (
              <button onClick={handleSendMessage} className="w-12 h-12 bg-scholar-gold text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"><i className="fas fa-paper-plane text-sm"></i></button>
            ) : (
              <button className="w-12 h-12 rounded-full text-scholar-muted hover:text-scholar-gold transition-colors flex items-center justify-center"><i className="fas fa-microphone text-lg"></i></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
