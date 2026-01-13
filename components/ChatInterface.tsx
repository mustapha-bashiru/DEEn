
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChatSession, Message, Madhab, Sect, Attachment, ArticleLead, GroundingLink } from '../types';
import { Language, translations } from '../translations';

/**
 * Enhanced Markdown and Token Scrubbing
 */
const renderMarkdown = (text: string) => {
  if (!text) return '';
  
  let cleaned = text
    .replace(/(\s+)?\$\d+(\s+)?/g, ' ')
    .replace(/(\s+)?\[\d+\](\s+)?/g, ' ')
    .replace(/\s\s+/g, ' ')
    .trim();
  
  let html = cleaned
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
  
  html = html.replace(/(<li>.*<\/li>)+/gs, '<ul>$0</ul>');
  
  return html;
};

// Memoized Message Bubble with Feedback UI
const MessageBubble = React.memo(({ m, lang, onSuggestionClick, onFeedback }: { m: Message, lang: Language, onSuggestionClick: (s: string) => void, onFeedback: (id: string, rating: 'up' | 'down', comment?: string) => void }) => {
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<'up' | 'down' | null>(m.feedback?.rating || null);
  const [feedbackComment, setFeedbackComment] = useState(m.feedback?.comment || '');

  const contentHtml = useMemo(() => {
    if (m.role === 'assistant') return renderMarkdown(m.content);
    return m.content;
  }, [m.content, m.role]);

  const handleRatingClick = (rating: 'up' | 'down') => {
    setFeedbackRating(rating);
    setShowFeedbackInput(true);
  };

  const submitFeedback = () => {
    if (feedbackRating) {
      onFeedback(m.id, feedbackRating, feedbackComment);
      setShowFeedbackInput(false);
    }
  };

  const renderSources = () => {
    if (!m.sources || m.sources.length === 0) return null;

    return (
      <div className="mt-8 space-y-6">
        <div className="flex items-center space-x-3 space-x-reverse px-2">
          <div className="h-px flex-1 bg-black/5 dark:bg-white/5"></div>
          <h4 className="text-[9px] font-black text-scholar-muted uppercase tracking-[0.4em] whitespace-nowrap">
            {lang === 'ar' ? 'المواقع العلمية والخدمات' : 'Scholarly Landmarks & Services'}
          </h4>
          <div className="h-px flex-1 bg-black/5 dark:bg-white/5"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {m.sources.map((source, idx) => (
            <a 
              key={idx} 
              href={source.uri} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col p-5 bg-white dark:bg-[#1A1A1A] border border-black/5 dark:border-white/10 rounded-[1.5rem] hover:border-scholar-gold/60 hover:shadow-2xl hover:-translate-y-1 transition-all group relative overflow-hidden"
            >
              <div className="flex items-start mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mr-4 flex-shrink-0 ${source.type === 'maps' ? 'bg-red-500/10 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'bg-scholar-gold/10 text-scholar-gold shadow-[0_0_20px_rgba(var(--primary-color-rgb),0.15)]'}`}>
                  <i className={`fas ${source.type === 'maps' ? 'fa-location-dot' : 'fa-globe'} text-xl`}></i>
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-[14px] font-black text-neutral-900 dark:text-white truncate uppercase tracking-tight leading-none mb-1.5">{source.title}</p>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className="text-[9px] font-black text-scholar-gold uppercase tracking-widest bg-scholar-gold/10 px-2 py-0.5 rounded">
                      {source.type === 'maps' ? (lang === 'ar' ? 'موقع نشط' : 'Active Landmark') : (lang === 'ar' ? 'مصدر ويب' : 'Web Archive')}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 mb-6 px-1">
                {source.address && (
                  <div className="flex items-start space-x-2 space-x-reverse">
                    <i className="fas fa-map-pin text-[10px] text-scholar-muted mt-0.5"></i>
                    <p className="text-[11px] text-neutral-600 dark:text-stone-300 font-bold leading-tight">
                      {source.address}
                    </p>
                  </div>
                )}
                {source.description && (
                  <div className="bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-black/5 dark:border-white/5">
                    <p className="text-[10px] text-scholar-muted dark:text-stone-400 font-medium leading-relaxed line-clamp-3 italic">
                      {source.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-black text-scholar-muted uppercase tracking-widest group-hover:text-scholar-gold transition-colors">
                  {source.type === 'maps' ? (lang === 'ar' ? 'فتح في خرائط جوجل' : 'Open in Google Maps') : (lang === 'ar' ? 'زيارة الرابط' : 'Access Data')}
                </span>
                <i className="fas fa-arrow-up-right-from-square text-[10px] text-scholar-muted group-hover:text-scholar-gold transition-colors"></i>
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div className="max-w-[90%] md:max-w-[75%] space-y-4">
        <div className={`p-6 md:p-10 border shadow-2xl transition-all duration-300 relative ${
          m.role === 'user' 
            ? 'bg-black/10 dark:bg-[#2C2C2C] text-neutral-900 dark:text-white border-black/5 dark:border-white/10 rounded-[2.5rem] rounded-tr-none' 
            : 'bg-white/10 dark:bg-[#1F1F1F] text-neutral-800 dark:text-[#E5E5E5] border-black/5 dark:border-white/5 rounded-[3rem] rounded-tl-none'
          } backdrop-blur-md`}>
          {m.attachments?.map((att, i) => (
            <div key={i} className="mb-6 bg-black/5 dark:bg-white/5 p-4 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center space-x-3 space-x-reverse border border-black/5 dark:border-white/5 group">
              <i className="fas fa-paperclip text-scholar-gold group-hover:rotate-12 transition-transform"></i> 
              <span className="truncate">{att.fileName}</span>
              {att.mimeType.startsWith('video/') && <i className="fas fa-video ml-auto text-scholar-gold"></i>}
            </div>
          ))}
          <div 
            className="prose dark:prose-invert max-w-none text-[15px] leading-relaxed font-medium whitespace-pre-wrap"
            dangerouslySetInnerHTML={m.role === 'assistant' ? { __html: contentHtml } : undefined}
          >
            {m.role === 'user' ? m.content : null}
          </div>

          {m.role === 'assistant' && renderSources()}

          {/* Feedback Section */}
          {m.role === 'assistant' && !m.feedback && (
            <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5 flex flex-col items-start">
              {!showFeedbackInput ? (
                <div className="flex items-center space-x-4 space-x-reverse">
                  <span className="text-[9px] font-black text-scholar-muted uppercase tracking-[0.2em]">Rate this response:</span>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <button 
                      onClick={() => handleRatingClick('up')}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${feedbackRating === 'up' ? 'bg-scholar-gold text-white' : 'bg-black/5 dark:bg-white/5 text-scholar-muted hover:text-scholar-gold'}`}
                    >
                      <i className="fas fa-thumbs-up text-[10px]"></i>
                    </button>
                    <button 
                      onClick={() => handleRatingClick('down')}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${feedbackRating === 'down' ? 'bg-red-500 text-white' : 'bg-black/5 dark:bg-white/5 text-scholar-muted hover:text-red-500'}`}
                    >
                      <i className="fas fa-thumbs-down text-[10px]"></i>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-3 animate-fade-in">
                  <p className="text-[9px] font-black text-scholar-muted uppercase tracking-widest">Optional feedback to improve the scholars:</p>
                  <textarea 
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Tell us more..."
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-scholar-gold/20 resize-none"
                    rows={2}
                  />
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <button 
                      onClick={submitFeedback}
                      className="px-4 py-1.5 bg-scholar-gold text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg"
                    >
                      Submit
                    </button>
                    <button 
                      onClick={() => setShowFeedbackInput(false)}
                      className="px-4 py-1.5 bg-black/10 dark:bg-white/10 text-scholar-muted text-[9px] font-black uppercase tracking-widest rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {m.feedback && (
            <div className="mt-6 flex items-center space-x-2 space-x-reverse text-[9px] font-black text-scholar-gold uppercase tracking-[0.2em] opacity-60">
              <i className="fas fa-check-circle"></i>
              <span>Feedback Shared</span>
            </div>
          )}
        </div>

        {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {m.suggestions.map((suggestion, idx) => (
              <button 
                key={idx} 
                onClick={() => onSuggestionClick(suggestion)}
                className="px-4 py-2 bg-white/10 dark:bg-[#1F1F1F]/40 border border-black/5 dark:border-white/10 rounded-full text-[11px] font-bold text-scholar-gold hover:bg-scholar-gold hover:text-white transition-all backdrop-blur-sm shadow-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

interface ChatInterfaceProps {
  lang: Language;
  setLang: (l: Language) => void;
  session: ChatSession | null;
  isTyping: boolean;
  typingText?: string;
  error: string | null;
  onSendMessage: (content: string, attachment?: Attachment) => void;
  onPerspectiveChange: (sect: Sect, madhab: Madhab) => void;
  onFeedback: (messageId: string, rating: 'up' | 'down', comment?: string) => void;
  onStartQuiz?: (content: string) => void;
  onOpenLive: () => void;
  currentSect: Sect;
  isGuest: boolean;
  onPreviewArticle?: (article: ArticleLead) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  lang, setLang, session, isTyping, typingText, onSendMessage, onOpenLive, currentSect, onFeedback
}) => {
  const [input, setInput] = useState('');
  const [showAccessories, setShowAccessories] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  const [showCamera, setShowCamera] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const t = translations[lang];

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [session?.messages, isTyping]);

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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setShowCamera(true);
      setShowAccessories(false);
    } catch (err) {
      console.error("Camera error:", err);
      alert("Please grant camera permissions to use the Vision features.");
    }
  };

  const stopCamera = () => {
    mediaStream?.getTracks().forEach(track => track.stop());
    setMediaStream(null);
    setShowCamera(false);
    setIsRecording(false);
  };

  const takePhoto = () => {
    const canvas = document.createElement('canvas');
    if (videoRef.current) {
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setAttachment({
        mimeType: 'image/jpeg',
        data: dataUrl.split(',')[1],
        fileName: `Vision-${Date.now()}.jpg`
      });
      stopCamera();
    }
  };

  const startRecording = () => {
    if (!mediaStream) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(mediaStream);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachment({ mimeType: 'video/mp4', data: base64, fileName: `Inquiry-${Date.now()}.mp4` });
      };
      reader.readAsDataURL(blob);
    };
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    stopCamera();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) { return; }
      else {
        e.preventDefault();
        if (input.trim() || attachment) {
          onSendMessage(input, attachment || undefined);
          setInput('');
          setAttachment(null);
          setShowAccessories(false);
        }
      }
    }
  };

  const activeSect = session?.sect || currentSect;
  const activeMadhab = session?.madhab || "General";

  const quickPrompts = useMemo(() => {
    const base = activeSect === 'Sunni' ? [
      { id: 'wudu', label: t.promptAblutionSunni, icon: 'fa-droplet', iconColor: 'text-blue-400' },
      { id: 'salah', label: t.promptSalahSunni, icon: 'fa-moon', iconColor: 'text-blue-400' },
      { id: 'zakat', label: t.promptZakatSunni, icon: 'fa-coins', iconColor: 'text-amber-500' }
    ] : [
      { id: 'wudu', label: t.promptAblutionShia, icon: 'fa-bars', iconColor: 'text-amber-500' },
      { id: 'salah', label: t.promptSalahShia, icon: 'fa-star-and-crescent', iconColor: 'text-amber-500' },
      { id: 'khums', label: t.promptKhumsShia, icon: 'fa-coins', iconColor: 'text-amber-500' }
    ];
    return [...base, { id: 'crypto', label: t.promptCrypto, icon: 'fa-bitcoin-sign', iconColor: 'text-blue-500' }];
  }, [activeSect, t]);

  if (!session) return null;

  return (
    <div className={`flex-1 flex flex-col h-full bg-transparent text-neutral-900 dark:text-[#FAFAFA] overflow-hidden transition-colors relative ${lang === 'ar' ? 'font-arabic' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {isOffline && (
        <div className="absolute top-0 left-0 right-0 bg-scholar-gold/20 backdrop-blur-md py-1 px-4 text-center z-[60] border-b border-scholar-gold/30">
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-scholar-gold">
            <i className="fas fa-wifi-slash mr-2"></i> Offline Sanctuary Mode
          </span>
        </div>
      )}

      {showCamera && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-fade-in">
          <div className="relative w-full max-w-2xl aspect-video bg-black rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center space-x-12">
              <button onClick={takePhoto} disabled={isRecording} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl disabled:opacity-30">
                <i className="fas fa-camera text-xl"></i>
              </button>
              <button onClick={isRecording ? stopRecording : startRecording} className={`w-20 h-20 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl ${isRecording ? 'bg-red-500 text-white' : 'bg-white/10 text-white border border-white/20'}`} >
                <i className={`fas ${isRecording ? 'fa-stop' : 'fa-video'} text-2xl`}></i>
              </button>
              <button onClick={stopCamera} className="w-16 h-16 rounded-full bg-white/10 text-white border border-white/20 flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`absolute top-6 ${lang === 'ar' ? 'left-8' : 'right-8'} z-30 flex items-center space-x-4 space-x-reverse`}>
        <button 
          onClick={onOpenLive}
          className="flex items-center space-x-3 space-x-reverse bg-emerald-600 text-white px-5 py-2.5 rounded-full shadow-lg border border-white/10 backdrop-blur-md active:scale-95 transition-all group"
        >
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest">{t.toolLive}</span>
          <i className="fas fa-tower-broadcast text-xs"></i>
        </button>

        <div className="flex items-center bg-white/5 dark:bg-black/20 rounded-full border border-black/5 dark:border-white/5 p-1 backdrop-blur-md">
          <button onClick={() => setLang('en')} className={`px-3 py-1 text-[9px] font-black uppercase rounded-full transition-all ${lang === 'en' ? 'bg-white/10 text-white shadow-sm' : 'text-scholar-muted hover:text-white'}`}>EN</button>
          <button onClick={() => setLang('ar')} className={`px-3 py-1 text-[9px] font-black uppercase rounded-full transition-all ${lang === 'ar' ? 'bg-white/10 text-white shadow-sm' : 'text-scholar-muted hover:text-white'}`}>AR</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-12 custom-scrollbar">
        {session.messages.length === 0 && (
          <div className="max-w-4xl mx-auto py-10 space-y-10 flex flex-col items-center justify-center min-h-[70vh]">
            <div className="flex flex-col items-center text-center space-y-6 animate-fade-in">
              <div className="w-20 h-20 flex items-center justify-center mb-2">
                <i className="fas fa-star-and-crescent text-4xl text-scholar-gold drop-shadow-[0_0_15px_rgba(var(--primary-color-rgb),0.8)]"></i>
              </div>
              <div className="space-y-1">
                <h2 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">
                  {lang === 'ar' ? 'استشر العلماء' : 'Consult the Scholars'}
                </h2>
                <p className="text-[10px] font-black uppercase tracking-[0.6em] text-scholar-muted opacity-80">
                  {activeSect} • {activeMadhab} {lang === 'ar' ? 'المنهج' : 'Path'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg animate-fade-in delay-200">
              {quickPrompts.map((p) => (
                <button 
                  key={p.id} onClick={() => onSendMessage(p.label)}
                  className="px-4 py-3 bg-white/5 dark:bg-[#1F1F1F]/40 border border-black/5 dark:border-white/5 rounded-2xl hover:border-scholar-gold hover:bg-white/10 dark:hover:bg-white/5 transition-all group flex items-center space-x-4 space-x-reverse backdrop-blur-md shadow-md"
                >
                  <div className="w-8 h-8 rounded-xl bg-white/5 dark:bg-black/20 flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm flex-shrink-0">
                    <i className={`fas ${p.icon} ${p.iconColor} text-sm`}></i>
                  </div>
                  <span className="text-[11px] font-bold text-scholar-muted group-hover:text-neutral-900 dark:group-hover:text-white transition-colors leading-tight text-left">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto space-y-12">
          {session.messages.map((m) => (
            <MessageBubble key={m.id} m={m} lang={lang} onSuggestionClick={onSendMessage} onFeedback={onFeedback} />
          ))}
          {isTyping && (
            <div className="text-[11px] font-black text-scholar-gold uppercase tracking-[0.4em] animate-pulse flex items-center bg-scholar-gold/5 py-2 px-4 rounded-full w-fit">
              <i className="fas fa-certificate fa-spin mx-3"></i> {typingText}
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <div className="px-8 pb-10 pt-4 bg-transparent z-10">
        <div className="max-w-5xl mx-auto">
          {attachment && (
            <div className="mb-4 p-4 bg-white/10 dark:bg-[#1F1F1F] border border-scholar-gold/20 flex items-center justify-between rounded-3xl animate-fade-in backdrop-blur-md shadow-lg">
              <span className="text-xs font-bold text-neutral-900 dark:text-white truncate flex items-center space-x-4 space-x-reverse">
                <i className={`fas ${attachment.mimeType.startsWith('video/') ? 'fa-video' : 'fa-image'} text-scholar-gold`}></i>
                <span>{attachment.fileName}</span>
              </span>
              <button onClick={() => setAttachment(null)} className="text-red-400 px-4 hover:scale-110 transition-transform"><i className="fas fa-times"></i></button>
            </div>
          )}
          
          <div className="flex items-end justify-between space-x-4 space-x-reverse pb-2">
            <button 
              onClick={() => setShowAccessories(!showAccessories)} 
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all bg-white dark:bg-[#1F1F1F] text-scholar-muted border border-black/5 dark:border-white/5 hover:border-scholar-gold hover:text-scholar-gold shadow-lg flex-shrink-0 relative top-[1px] ${showAccessories ? 'rotate-45 text-scholar-gold' : ''}`}
            >
              <i className={`fas fa-plus text-base`}></i>
            </button>
            
            <form className="flex-1 flex items-end relative" onSubmit={(e) => { e.preventDefault(); if(input.trim() || attachment) { onSendMessage(input, attachment || undefined); setInput(''); setAttachment(null); setShowAccessories(false); } }}>
              <div className="flex-1 relative">
                <textarea 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  onKeyDown={handleKeyDown}
                  placeholder={t.inputPlaceholder} 
                  className="w-full bg-white dark:bg-[#1F1F1F] border border-black/5 dark:border-white/10 rounded-[2rem] py-4 px-6 pr-14 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-scholar-gold/20 text-neutral-900 dark:text-white placeholder:text-scholar-muted transition-all shadow-xl resize-none min-h-[56px] max-h-40 custom-scrollbar block"
                  rows={Math.min(5, input.split('\n').length || 1)}
                />
                <button type="button" className={`absolute ${lang === 'ar' ? 'left-5' : 'right-5'} bottom-4 text-scholar-muted hover:text-scholar-gold transition-colors`}>
                   <i className="fas fa-microphone"></i>
                </button>
              </div>
            </form>

            <button 
              onClick={(e) => { e.preventDefault(); if(input.trim() || attachment) { onSendMessage(input, attachment || undefined); setInput(''); setAttachment(null); setShowAccessories(false); } }}
              disabled={isOffline && !input.trim() && !attachment} 
              className="w-11 h-11 bg-scholar-gold text-white dark:text-neutral-dark rounded-full shadow-xl flex items-center justify-center hover:opacity-90 active:scale-90 transition-all flex-shrink-0 relative top-[1px] disabled:opacity-30 disabled:grayscale"
            >
              <i className={`fas ${lang === 'ar' ? 'fa-paper-plane rotate-180' : 'fa-paper-plane'} text-sm`}></i>
            </button>
          </div>
          
          {showAccessories && (
            <div className="mt-4 flex items-center space-x-3 space-x-reverse animate-fade-in absolute bottom-24 bg-white/10 dark:bg-[#121212]/80 p-4 rounded-3xl backdrop-blur-xl border border-white/5 shadow-2xl z-50">
              <button onClick={() => fileInputRef.current?.click()} className="px-6 py-4 bg-white dark:bg-[#1F1F1F] border border-black/5 dark:border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-scholar-muted hover:text-scholar-gold transition-all shadow-md">
                <i className="fas fa-file-arrow-up mx-3"></i> {lang === 'ar' ? 'وثيقة' : 'Document'}
              </button>
              <button onClick={startCamera} className="px-6 py-4 bg-white dark:bg-[#1F1F1F] border border-black/5 dark:border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-scholar-muted hover:text-scholar-gold transition-all shadow-md">
                <i className="fas fa-video mx-3"></i> {lang === 'ar' ? 'رؤية وفيديو' : 'Vision & Video'}
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
