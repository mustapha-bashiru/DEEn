
import React, { useState, useRef, useEffect } from 'react';
import { ChatSession, Message, Madhab, Sect, Attachment } from '../types';
import { Language, translations } from '../translations';

interface ChatInterfaceProps {
  lang: Language;
  session: ChatSession | null;
  isTyping: boolean;
  typingText?: string;
  error: string | null;
  onSendMessage: (content: string, attachment?: Attachment) => void;
  onPerspectiveChange: (sect: Sect, madhab: Madhab) => void;
  onStartQuiz?: (content: string) => void;
  currentSect: Sect;
  isGuest: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ lang, session, isTyping, typingText, onSendMessage, onStartQuiz, currentSect, isGuest }) => {
  const [input, setInput] = useState('');
  const [showAccessories, setShowAccessories] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [session?.messages, isTyping]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = (ev.target?.result as string).split(',')[1];
        setAttachment({ mimeType: file.type, data: base64, fileName: file.name });
        setShowAccessories(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const quickPrompts = currentSect === 'Sunni' ? [
    { id: 'wudu', label: t.promptAblutionSunni, icon: 'fa-droplet', color: 'bg-emerald-50 text-emerald-600' },
    { id: 'salah', label: t.promptSalahSunni, icon: 'fa-person-praying', color: 'bg-emerald-50 text-emerald-600' },
    { id: 'zakat', label: t.promptZakatSunni, icon: 'fa-hand-holding-dollar', color: 'bg-emerald-50 text-emerald-600' },
    { id: 'nafs', label: t.promptNafasSunni, icon: 'fa-heart-pulse', color: 'bg-emerald-50 text-emerald-600' }
  ] : [
    { id: 'wudu', label: t.promptAblutionShia, icon: 'fa-faucet', color: 'bg-teal-50 text-teal-600' },
    { id: 'salah', label: t.promptSalahShia, icon: 'fa-scroll', color: 'bg-teal-50 text-teal-600' },
    { id: 'khums', label: t.promptKhumsShia, icon: 'fa-vault', color: 'bg-teal-50 text-teal-600' },
    { id: 'nafs', label: t.promptNafasShia, icon: 'fa-shield-halved', color: 'bg-teal-50 text-teal-600' }
  ];

  const brandBg = currentSect === 'Sunni' ? 'bg-emerald-900' : 'bg-teal-950';
  const brandIcon = currentSect === 'Sunni' ? 'fa-mosque' : 'fa-scroll';

  if (!session) return null;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fdfaf7] overflow-hidden pattern-bg">
      <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-12 custom-scrollbar">
        {session.messages.length === 0 && (
          <div className="max-w-4xl mx-auto py-12 space-y-12">
            <div className="text-center">
              <div className={`w-20 h-20 bg-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-xl ${currentSect === 'Sunni' ? 'text-emerald-800' : 'text-teal-800'} border animate-fade-in`}>
                <i className={`fas ${brandIcon} text-3xl`}></i>
              </div>
              <h2 className="text-2xl font-bold text-stone-800 animate-fade-in">{currentSect === 'Sunni' ? 'Sunni Sanctuary' : 'Ahlulbayt Library'}</h2>
              <p className="text-stone-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2 animate-fade-in">Perspective: {session.sect} - {session.madhab}</p>
              {isGuest && (
                <div className="mt-4 inline-flex items-center px-4 py-1.5 bg-amber-50 border border-amber-100 rounded-full text-[10px] font-bold text-amber-700 animate-fade-in delay-75">
                  <i className="fas fa-triangle-exclamation mr-2"></i> Wisdom will be lost upon departure. Sign in to save history.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in delay-100">
              {quickPrompts.map((p) => (
                <button 
                  key={p.id} onClick={() => onSendMessage(p.label)}
                  className="p-5 bg-white border border-stone-100 rounded-[2rem] shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all text-left group flex flex-col items-start min-h-[140px]"
                >
                  <div className={`w-10 h-10 ${p.color} rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:rotate-6 shadow-sm`}>
                    <i className={`fas ${p.icon} text-base`}></i>
                  </div>
                  <p className="text-[11px] font-bold text-stone-700 leading-tight flex-1">{p.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {session.messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className="max-w-[90%] md:max-w-[80%] space-y-3">
              <div className={`p-8 rounded-[2.5rem] shadow-xl ${m.role === 'user' ? brandBg + ' text-white' : 'bg-white border text-stone-900'}`}>
                {m.attachments?.map((att, i) => (
                  <div key={i} className="mb-4 bg-black/10 p-2 rounded-lg text-[10px] font-bold flex items-center">
                    <i className="fas fa-paperclip mr-2"></i> {att.fileName}
                  </div>
                ))}
                <div className="prose prose-stone max-w-none text-sm leading-relaxed font-medium whitespace-pre-wrap">{m.content}</div>
                
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-stone-100 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {m.sources.map((source, idx) => (
                        <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className={`text-[10px] bg-stone-50 ${currentSect === 'Sunni' ? 'text-emerald-700' : 'text-teal-700'} px-3 py-1 rounded-full border border-stone-100 flex items-center`}>
                          <i className={`fas ${source.type === 'maps' ? 'fa-map-marker-alt' : 'fa-link'} mr-1.5`}></i> {source.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions Rendering */}
                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-stone-100/50 space-y-3">
                    <p className={`text-[9px] font-black uppercase tracking-widest ${m.role === 'user' ? 'text-white/50' : 'text-stone-400'}`}>Follow-up Inquiries</p>
                    <div className="flex flex-wrap gap-2">
                      {m.suggestions.map((s, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => onSendMessage(s)}
                          className={`text-xs font-bold px-4 py-2 rounded-xl transition-all border ${m.role === 'user' ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-emerald-50 border-emerald-100 text-emerald-800 hover:bg-emerald-100'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isTyping && <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest animate-pulse ml-8"><i className="fas fa-scroll mr-2"></i>{typingText}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 bg-white border-t border-stone-200">
        <div className="max-w-4xl mx-auto">
          {attachment && (
            <div className={`mb-3 p-2 ${currentSect === 'Sunni' ? 'bg-emerald-50' : 'bg-teal-50'} rounded-xl flex items-center justify-between border ${currentSect === 'Sunni' ? 'border-emerald-100' : 'border-teal-100'} shadow-sm`}>
              <span className={`text-xs font-bold ${currentSect === 'Sunni' ? 'text-emerald-900' : 'text-teal-900'} truncate`}><i className="fas fa-paperclip mr-2"></i>{attachment.fileName}</span>
              <button onClick={() => setAttachment(null)} className="text-red-400"><i className="fas fa-times"></i></button>
            </div>
          )}
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <button 
                onClick={() => setShowAccessories(!showAccessories)} 
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-md ${showAccessories ? (currentSect === 'Sunni' ? 'bg-emerald-900 text-white' : 'bg-teal-900 text-white') + ' rotate-45' : 'bg-stone-100 text-stone-500 hover:bg-stone-200 border border-stone-200'}`}
              >
                <i className="fas fa-plus"></i>
              </button>
              
              {showAccessories && (
                <div className="absolute bottom-18 left-0 bg-white border rounded-[1.5rem] shadow-2xl p-2 flex flex-col space-y-1 animate-fade-in z-50 min-w-[60px]">
                  <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 rounded-xl flex items-center justify-center transition-colors">
                    <i className="fas fa-file-upload"></i>
                  </button>
                  <button className="w-12 h-12 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 rounded-xl flex items-center justify-center transition-colors">
                    <i className="fas fa-camera"></i>
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                </div>
              )}
            </div>

            <form className="flex-1 flex items-center space-x-2" onSubmit={(e) => { e.preventDefault(); if(input.trim() || attachment) { onSendMessage(input, attachment || undefined); setInput(''); setAttachment(null); } }}>
              <div className="flex-1 relative">
                <input 
                  type="text" value={input} onChange={(e) => setInput(e.target.value)} 
                  placeholder={currentSect === 'Sunni' ? "Consult the Sunni tradition..." : "Consult the Ahlulbayt tradition..."} 
                  className={`w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 text-sm font-medium focus:bg-white focus:shadow-sm ${currentSect === 'Sunni' ? 'focus:border-emerald-800' : 'focus:border-teal-800'} outline-none transition-all`} 
                />
                <button type="button" className={`absolute right-4 top-1/2 -translate-y-1/2 ${currentSect === 'Sunni' ? 'text-emerald-800' : 'text-teal-800'} opacity-30 hover:opacity-100 transition-opacity`}>
                   <i className="fas fa-microphone"></i>
                </button>
              </div>
              <button type="submit" className={`w-14 h-14 ${currentSect === 'Sunni' ? 'bg-emerald-900' : 'bg-teal-950'} text-white rounded-2xl shadow-xl flex items-center justify-center hover:opacity-90 transition-all active:scale-95`}>
                <i className="fas fa-paper-plane"></i>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
