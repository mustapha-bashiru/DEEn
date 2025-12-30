
import React, { useState, useRef, useEffect } from 'react';
import { ChatSession, Message } from '../types';
import { generateSpeech, decodeBase64ToUint8Array, decodeAudioData } from '../services/geminiService';

interface ChatInterfaceProps {
  session: ChatSession | null;
  isTyping: boolean;
  error: string | null;
  onSendMessage: (content: string) => void;
  onToggleBookmark: (messageId: string) => void;
}

type AudioState = 'stopped' | 'playing' | 'paused';
type Occasion = 'Friday' | 'Eve' | 'Ramadan' | 'Eid' | 'Ashura' | null;

const ChatInterface: React.FC<ChatInterfaceProps> = ({ session, isTyping, error, onSendMessage, onToggleBookmark }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  // TTS & Audio Controls State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioState, setAudioState] = useState<AudioState>('stopped');
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [progress, setProgress] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  
  // Sharing State
  const [shareMessage, setShareMessage] = useState<Message | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<'text' | 'link' | null>(null);

  // Occasion State
  const [showBanner, setShowBanner] = useState(false);
  const [occasionType, setOccasionType] = useState<Occasion>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();

    if (day === 4 && hour >= 17) {
      setOccasionType('Eve');
      setShowBanner(true);
    } else if (day === 5) {
      setOccasionType('Friday');
      setShowBanner(true);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages, isTyping]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;
    onSendMessage(input);
    setInput('');
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev.trim() + ' ' + transcript).trim());
    };
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  // Audio Progress Tracking
  const updateProgress = () => {
    if (!audioContextRef.current || !audioBufferRef.current || audioState !== 'playing') {
      if (audioState === 'paused' || audioState === 'stopped') {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) * playbackRate;
    const total = audioBufferRef.current.duration;
    
    if (elapsed >= total) {
      handleAudioEnded();
      return;
    }

    setCurrentTime(elapsed);
    setProgress((elapsed / total) * 100);
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const handleAudioEnded = () => {
    setPlayingId(null);
    setAudioState('stopped');
    setProgress(0);
    setCurrentTime(0);
    pausedAtRef.current = 0;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  // Audio Playback Logic
  const handlePlayAudio = async (messageId: string, text: string) => {
    if (playingId === messageId) {
      if (audioState === 'playing') pauseAudio();
      else if (audioState === 'paused') resumeAudio();
      else startNewAudio(messageId, text);
      return;
    }
    stopAudio();
    startNewAudio(messageId, text);
  };

  const startNewAudio = async (messageId: string, text: string) => {
    try {
      setPlayingId(messageId);
      setAudioState('playing');
      setProgress(0);
      setCurrentTime(0);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const base64Audio = await generateSpeech(text);
      const audioBytes = decodeBase64ToUint8Array(base64Audio);
      const audioBuffer = await decodeAudioData(audioBytes, audioContextRef.current);
      audioBufferRef.current = audioBuffer;
      setDuration(audioBuffer.duration);
      playBuffer(0);
    } catch (err) {
      setPlayingId(null);
      setAudioState('stopped');
    }
  };

  const playBuffer = (offset: number) => {
    if (!audioContextRef.current || !audioBufferRef.current) return;
    
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch(e) {}
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.playbackRate.value = playbackRate;
    source.connect(audioContextRef.current.destination);
    
    startTimeRef.current = audioContextRef.current.currentTime - (offset / playbackRate);
    source.start(0, offset);
    currentSourceRef.current = source;
    
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const pauseAudio = () => {
    if (currentSourceRef.current && audioContextRef.current) {
      pausedAtRef.current = (audioContextRef.current.currentTime - startTimeRef.current) * playbackRate;
      currentSourceRef.current.stop();
      currentSourceRef.current = null;
      setAudioState('paused');
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const resumeAudio = () => {
    if (audioBufferRef.current) {
      setAudioState('playing');
      playBuffer(pausedAtRef.current);
    }
  };

  const stopAudio = () => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch(e) {}
    }
    currentSourceRef.current = null;
    audioBufferRef.current = null;
    pausedAtRef.current = 0;
    setPlayingId(null);
    setAudioState('stopped');
    setProgress(0);
    setCurrentTime(0);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
  };

  useEffect(() => {
    if (audioState === 'playing' && currentSourceRef.current && audioContextRef.current) {
      const currentPos = (audioContextRef.current.currentTime - startTimeRef.current) * (currentSourceRef.current.playbackRate.value);
      currentSourceRef.current.stop();
      playBuffer(currentPos);
    }
  }, [playbackRate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Sharing Logic
  const handleCopyText = async () => {
    if (!shareMessage) return;
    try {
      await navigator.clipboard.writeText(shareMessage.content);
      setCopyFeedback('text');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleCopyLink = async () => {
    if (!shareMessage || !session) return;
    try {
      const link = `${window.location.origin}${window.location.pathname}?session=${session.id}#${shareMessage.id}`;
      await navigator.clipboard.writeText(link);
      setCopyFeedback('link');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  if (!session) return <div className="flex-1 flex items-center justify-center text-stone-400 italic">May you find the guidance you seek.</div>;
  const accentColor = session.sect === 'Sunni' ? 'emerald' : 'teal';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Share Dialog */}
      {shareMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-stone-950/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden border border-stone-200">
            <div className={`p-8 text-center bg-${accentColor}-900 text-white relative`}>
              <button 
                onClick={() => setShareMessage(null)}
                className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4 border border-white/20">
                <i className="fas fa-share-nodes text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold">Share Wisdom</h3>
              <p className="text-white/60 text-xs mt-1 font-medium uppercase tracking-widest">Digital Scholarly Record</p>
            </div>
            
            <div className="p-8 space-y-4">
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 mb-2">
                <p className="text-stone-500 text-xs italic line-clamp-2 leading-relaxed">
                  "{shareMessage.content}"
                </p>
              </div>

              <button 
                onClick={handleCopyText}
                className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-3 transition-all ${
                  copyFeedback === 'text' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-stone-900 text-white hover:bg-stone-800 shadow-lg'
                }`}
              >
                <i className={`fas ${copyFeedback === 'text' ? 'fa-check' : 'fa-copy'}`}></i>
                <span>{copyFeedback === 'text' ? 'Copied Content!' : 'Copy Scholar\'s Words'}</span>
              </button>

              <button 
                onClick={handleCopyLink}
                className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-3 transition-all border ${
                  copyFeedback === 'link' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <i className={`fas ${copyFeedback === 'link' ? 'fa-check' : 'fa-link'}`}></i>
                <span>{copyFeedback === 'link' ? 'Link Copied!' : 'Copy Permalink'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Occasion Banner */}
      {showBanner && session.messages.length === 0 && (
        <div className="mx-6 mt-4 animate-fade-in z-30">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
                <i className={`fas ${occasionType === 'Eve' ? 'fa-moon' : 'fa-sun'} text-xl`}></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  {occasionType === 'Eve' ? 'Evening of Jumah' : 'Blessed Friday (Jumah)'}
                </h4>
                <p className="text-xs text-amber-700 leading-relaxed max-w-md">
                  It is a sacred day. Would you like a Jumah Khutbah outline, or a breakdown of the Friday obligations with scholarly evidence?
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => {
                  onSendMessage("Draft a full spiritual Jumah Khutbah. Include a primary topic, Arabic transitions with English translations, and provide evidence from the Qur'an and Sunnah. Aim for a 15-minute delivery length.");
                  setShowBanner(false);
                }}
                className="text-[10px] font-bold bg-amber-700 text-white px-4 py-2 rounded-xl hover:bg-amber-800 transition-all shadow-md active:scale-95"
              >
                DRAFT KHUTBAH
              </button>
              <button 
                onClick={() => {
                  onSendMessage("What has Allah obliged His servants to do every Friday according to the various schools of jurisprudence (Hanafi, Maliki, Shafi'i, Hanbali) and sects (Sunni/Shia)? Provide specific evidence for each.");
                  setShowBanner(false);
                }}
                className="text-[10px] font-bold bg-white text-amber-800 border border-amber-200 px-4 py-2 rounded-xl hover:bg-amber-100 transition-all shadow-sm active:scale-95"
              >
                FRIDAY RULINGS
              </button>
              <button onClick={() => setShowBanner(false)} className="w-8 h-8 flex items-center justify-center text-amber-400 hover:text-amber-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {session.messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-12">
          <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-8 border shadow-xl ${
            session.sect === 'Sunni' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-teal-50 text-teal-700 border-teal-100'
          }`}>
            <i className={`fas ${session.sect === 'Sunni' ? 'fa-mosque' : 'fa-kaaba'} text-5xl`}></i>
          </div>
          <h2 className="text-3xl font-arabic font-bold text-stone-800 mb-3 tracking-tight">
            {session.sect === 'Shia' ? "Wisdom of the Ahl al-Bayt (as)" : "Wisdom of the Sunni Path"}
          </h2>
          <p className="text-stone-500 max-w-lg mb-10 leading-relaxed font-medium">
            {session.madhab === 'General' ? "A balanced inquiry across noble traditions." : `Seeking guidance within the ${session.madhab} school.`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
             {(session.sect === 'Sunni' ? [
               `Wudu in the ${session.madhab} tradition`,
               "Virtues of the Companions (ra)",
               "Rulings on Friday Prayer",
               "Dua for the Ummah"
             ] : [
               `Concept of Imamat in ${session.madhab}`,
               "Virtues of the Ahl al-Bayt (as)",
               "Rulings on Khums and Zakat",
               "Significance of Dua Kumayl"
             ]).map((q, i) => (
               <button key={i} onClick={() => onSendMessage(q)} className={`p-5 bg-white border border-stone-200 rounded-2xl text-left text-sm text-stone-700 hover:border-${accentColor}-400 hover:bg-${accentColor}-50/30 transition-all shadow-sm`}>
                 <span className="font-medium">{q}</span>
               </button>
             ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-8">
        {session.messages.map((m) => (
          <div key={m.id} id={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] md:max-w-[80%] rounded-3xl px-6 py-5 shadow-sm relative group ${
              m.role === 'user' 
                ? (session.sect === 'Sunni' ? 'bg-emerald-800' : 'bg-teal-800') + ' text-white rounded-tr-none' 
                : 'bg-white text-stone-800 border border-stone-200 rounded-tl-none border-l-4 border-l-' + (session.sect === 'Sunni' ? 'emerald-600' : 'teal-600')
            }`}>
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed prose prose-stone max-w-none">{m.content}</div>
              
              {m.role === 'assistant' && playingId === m.id && (
                <div className="mt-6 pt-4 border-t border-stone-100 animate-fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => handlePlayAudio(m.id, m.content)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${audioState === 'playing' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}
                      >
                        <i className={`fas ${audioState === 'playing' ? 'fa-pause' : 'fa-play'}`}></i>
                      </button>
                      <button onClick={stopAudio} className="w-8 h-8 rounded-full bg-stone-50 border border-stone-200 text-stone-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all">
                        <i className="fas fa-stop text-[10px]"></i>
                      </button>
                    </div>

                    <div className="flex items-center bg-stone-50 rounded-lg p-1 border border-stone-200">
                      {[0.75, 1, 1.25, 1.5].map(rate => (
                        <button 
                          key={rate}
                          onClick={() => changePlaybackRate(rate)}
                          className={`px-2 py-1 text-[9px] font-black rounded-md transition-all ${playbackRate === rate ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="relative w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div 
                        className="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-300 ease-linear"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[9px] font-bold text-stone-400 uppercase tracking-widest">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>
              )}

              {m.sources && m.sources.length > 0 && (
                <div className="mt-5 pt-4 border-t border-stone-100">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Sources</p>
                  <div className="flex flex-wrap gap-2">
                    {m.sources.map((s, idx) => (
                      <a key={idx} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[11px] bg-stone-50 text-stone-600 px-3 py-1 rounded-full border border-stone-200 hover:bg-stone-100">
                        {s.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {m.role === 'assistant' && (
                <div className="absolute top-0 left-full ml-3 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col space-y-2 pt-2">
                  <button onClick={() => onToggleBookmark(m.id)} className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm ${m.isBookmarked ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-white border text-stone-300 hover:text-stone-600'}`} title="Bookmark Answer">
                    <i className={`fa-bookmark ${m.isBookmarked ? 'fas' : 'far'}`}></i>
                  </button>
                  {playingId !== m.id && (
                    <button onClick={() => handlePlayAudio(m.id, m.content)} className="w-9 h-9 rounded-full bg-white border text-stone-300 hover:text-stone-600 flex items-center justify-center shadow-sm transition-all" title="Listen to Answer">
                      <i className="fas fa-volume-up"></i>
                    </button>
                  )}
                  <button onClick={() => setShareMessage(m)} className="w-9 h-9 rounded-full bg-white border text-stone-300 hover:text-stone-600 flex items-center justify-center shadow-sm transition-all" title="Share Wisdom">
                    <i className="fas fa-share-nodes"></i>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && <div className="text-sm italic text-stone-400">Consulting scholarly records...</div>}
        {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-8 bg-white border-t border-stone-100">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center space-x-4">
          <div className="flex-1 relative group">
            <input 
              type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about prayer, fasting, or scholarly biographies..."
              className={`w-full bg-stone-50 border border-stone-200 rounded-2xl px-8 py-5 pr-16 text-sm focus:outline-none focus:ring-4 focus:ring-${accentColor}-500/10 focus:border-${accentColor}-500 transition-all`}
            />
            <button 
              type="button" onClick={toggleListening}
              className={`absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${
                isListening ? 'bg-red-500 text-white animate-pulse scale-110 shadow-lg' : 'text-stone-300 hover:text-stone-600'
              }`}
              title={isListening ? "Stop listening" : "Start voice-to-text"}
            >
              <i className="fas fa-microphone text-lg"></i>
            </button>
          </div>
          <button 
            type="submit" disabled={!input.trim() || isTyping}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
              !input.trim() || isTyping ? 'bg-stone-100 text-stone-400' : (session.sect === 'Sunni' ? 'bg-emerald-800 shadow-emerald-900/20' : 'bg-teal-800 shadow-teal-900/20') + ' text-white shadow-xl transform active:scale-95'
            }`}
          >
            <i className="fas fa-paper-plane text-lg"></i>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
