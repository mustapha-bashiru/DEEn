
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChatSession, Message, Madhab, Sect, Attachment } from '../types';
import { generateSpeech, decodeBase64ToUint8Array, decodeAudioData } from '../services/geminiService';
import { Language, translations } from '../translations';

interface ChatInterfaceProps {
  lang: Language;
  session: ChatSession | null;
  isTyping: boolean;
  typingText?: string;
  error: string | null;
  onSendMessage: (content: string, attachment?: Attachment) => void;
  onToggleBookmark: (messageId: string) => void;
  onPerspectiveChange: (sect: Sect, madhab: Madhab) => void;
  onShowArts?: () => void;
  onShowQuran?: () => void;
  onGenerateVisual?: (messageId: string, prompt: string, label: string) => void;
  onStartQuiz?: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ lang, session, isTyping, typingText, onSendMessage, onStartQuiz }) => {
  const [input, setInput] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [session?.messages, isTyping]);

  const handleNarrate = async (id: string, text: string) => {
    if (playingId === id) { setPlayingId(null); return; }
    setPlayingId(id);
    try {
      const base64 = await generateSpeech(text);
      const bytes = decodeBase64ToUint8Array(base64);
      const ctx = new AudioContext();
      const buffer = await decodeAudioData(bytes, ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
      source.onended = () => setPlayingId(null);
    } catch (e) {
      console.error("Speech Error", e);
      setPlayingId(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setAttachment({
          mimeType: file.type,
          data: base64,
          fileName: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  if (!session) return null;

  const quickPrompts = session.sect === 'Sunni' ? [
    { text: t.promptAblutionSunni, icon: 'fa-faucet-drip', color: 'bg-emerald-50 text-emerald-700' },
    { text: t.promptSalahSunni, icon: 'fa-pray', color: 'bg-blue-50 text-blue-700' },
    { text: t.promptZakatSunni, icon: 'fa-coins', color: 'bg-amber-50 text-amber-700' },
    { text: t.promptNafasSunni, icon: 'fa-heart-pulse', color: 'bg-rose-50 text-rose-700' }
  ] : [
    { text: t.promptAblutionShia, icon: 'fa-faucet-drip', color: 'bg-teal-50 text-teal-700' },
    { text: t.promptSalahShia, icon: 'fa-pray', color: 'bg-indigo-50 text-indigo-700' },
    { text: t.promptKhumsShia, icon: 'fa-money-bill-transfer', color: 'bg-amber-50 text-amber-700' },
    { text: t.promptNafasShia, icon: 'fa-heart-pulse', color: 'bg-rose-50 text-rose-700' }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f7f3f0] overflow-hidden pattern-bg">
      <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
        {session.messages.length === 0 && (
          <div className="max-w-4xl mx-auto py-12 animate-fade-in">
            <div className="text-center mb-12">
               <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl text-emerald-800">
                  <i className="fas fa-kaaba text-2xl"></i>
               </div>
               <h2 className="text-2xl font-bold text-stone-800">{t.quickConsultation}</h2>
               <p className="text-stone-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2">
                 {t.consulting.replace('{sect}', session.sect)}
               </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickPrompts.map((p, i) => (
                <button 
                  key={i} 
                  onClick={() => onSendMessage(p.text)}
                  className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex items-center text-left space-x-5 space-x-reverse"
                >
                  <div className={`w-12 h-12 rounded-2xl ${p.color} flex items-center justify-center flex-shrink-0 shadow-inner`}>
                    <i className={`fas ${p.icon} text-lg`}></i>
                  </div>
                  <span className="text-sm font-semibold text-stone-700 leading-tight">{p.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {session.messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className="max-w-[85%] space-y-3">
              <div className={`p-8 rounded-[2rem] shadow-xl ${m.role === 'user' ? 'bg-[#064e3b] text-white' : 'bg-white border border-stone-200 text-stone-900'}`}>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {m.attachments.map((att, i) => (
                      <div key={i} className="bg-black/20 p-2 rounded-lg text-[9px] font-bold flex items-center">
                        <i className="fas fa-file-alt mr-2"></i> {att.fileName || 'Attachment'}
                      </div>
                    ))}
                  </div>
                )}
                <div className="prose prose-stone max-w-none text-sm leading-relaxed font-medium whitespace-pre-wrap">{m.content}</div>
                
                {/* Scholars View / Article Leads */}
                {m.articleLeads && m.articleLeads.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-stone-100 space-y-4">
                    <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">{lang === 'ar' ? 'مقالات علمية مقترحة' : 'Scholarly Deep Dives'}</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {m.articleLeads.map((article, i) => (
                        <div key={i} className="bg-stone-50 border border-stone-100 p-4 rounded-2xl">
                          <h5 className="text-xs font-bold text-stone-800 mb-1">{article.title}</h5>
                          <p className="text-[10px] text-stone-500 leading-relaxed">{article.context}</p>
                          <button onClick={() => onSendMessage(`${lang === 'ar' ? 'حدثني أكثر عن' : 'Tell me more about'} ${article.title}`)} className="mt-3 text-[9px] font-black text-emerald-700 uppercase tracking-widest hover:underline">
                            {lang === 'ar' ? 'اقرأ المزيد' : 'Read Deep Dive'} →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {m.sources && m.sources.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-stone-100 flex flex-wrap gap-2">
                    {m.sources.map((s, i) => (
                      <a key={i} href={s.uri} target="_blank" rel="noopener" className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-all ${s.type === 'maps' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                        <i className={`fas ${s.type === 'maps' ? 'fa-map-location-dot' : 'fa-link'} mr-2`}></i> {s.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {m.role === 'assistant' && (
                <div className="flex space-x-2 space-x-reverse">
                  <button onClick={() => handleNarrate(m.id, m.content)} className="px-6 py-3 bg-white border border-stone-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-md transition-all">
                    <i className={`fas ${playingId === m.id ? 'fa-stop animate-pulse' : 'fa-volume-up'} ${lang === 'ar' ? 'ml-2' : 'mr-2'}`}></i> {playingId === m.id ? t.stop : t.narrate}
                  </button>
                  {m.isLegacyLesson && (
                    <button onClick={onStartQuiz} className="px-6 py-3 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-amber-900/20">
                      <i className={`fas fa-bolt ${lang === 'ar' ? 'ml-2' : 'mr-2'}`}></i> {t.takeQuiz}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && <div className="animate-pulse flex items-center space-x-3 space-x-reverse text-stone-400 text-[10px] font-black uppercase tracking-widest"><i className="fas fa-scroll fa-spin"></i><span>{typingText}</span></div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 glass-panel border-t border-stone-200">
        <div className="max-w-4xl mx-auto">
          {attachment && (
            <div className="mb-3 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between animate-fade-in">
               <div className="flex items-center space-x-3 space-x-reverse">
                  <i className="fas fa-paperclip text-emerald-700"></i>
                  <span className="text-xs font-bold text-emerald-900 truncate max-w-xs">{attachment.fileName}</span>
               </div>
               <button onClick={() => setAttachment(null)} className="text-emerald-300 hover:text-red-500"><i className="fas fa-times"></i></button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); if(input.trim() || attachment) { onSendMessage(input, attachment || undefined); setInput(''); setAttachment(null); } }} className="flex items-center space-x-3 space-x-reverse">
            {/* Accessory Set */}
            <div className="flex items-center p-1 bg-stone-100 rounded-2xl border border-stone-200 space-x-1 space-x-reverse">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-10 h-10 bg-white border border-stone-200 rounded-xl flex items-center justify-center text-stone-400 hover:text-emerald-700 hover:border-emerald-200 transition-all shadow-sm">
                <i className="fas fa-paperclip text-sm"></i>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              <button type="button" className="w-10 h-10 bg-white border border-stone-200 rounded-xl flex items-center justify-center text-stone-400 hover:text-emerald-700 hover:border-emerald-200 transition-all shadow-sm">
                <i className="fas fa-camera text-sm"></i>
              </button>
              <button type="button" className="w-10 h-10 bg-white border border-stone-200 rounded-xl flex items-center justify-center text-stone-400 hover:text-emerald-700 hover:border-emerald-200 transition-all shadow-sm">
                <i className="fas fa-microphone text-sm"></i>
              </button>
            </div>

            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder={t.placeholder.replace('{sect}', session.sect)} 
              className="flex-1 bg-white border border-stone-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:border-emerald-800 shadow-sm" 
            />
            <button type="submit" className="w-14 h-14 bg-[#064e3b] text-white rounded-2xl shadow-xl flex items-center justify-center hover:opacity-90 active:scale-95 transition-all">
              <i className="fas fa-paper-plane"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
