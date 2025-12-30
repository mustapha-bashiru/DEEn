
import React, { useState, useRef, useEffect } from 'react';
import { ChatSession, Message } from '../types';
import { generateSpeech, decodeBase64ToUint8Array, decodeAudioData, generateSacredArt } from '../services/geminiService';

interface ChatInterfaceProps {
  session: ChatSession | null;
  isTyping: boolean;
  typingText?: string;
  error: string | null;
  onSendMessage: (content: string, image?: { mimeType: string, data: string }) => void;
  onToggleBookmark: (messageId: string) => void;
}

type AudioState = 'stopped' | 'playing' | 'paused';
type Occasion = 'Friday' | 'Eve' | 'Ramadan' | 'Eid' | 'Ashura' | null;

const ChatInterface: React.FC<ChatInterfaceProps> = ({ session, isTyping, typingText, error, onSendMessage, onToggleBookmark }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ mimeType: string, data: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioState, setAudioState] = useState<AudioState>('stopped');
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [progress, setProgress] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  
  const [shareMessage, setShareMessage] = useState<Message | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<'text' | 'link' | 'card' | null>(null);
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsAttachmentMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    if ((!input.trim() && !selectedImage) || isTyping) return;
    onSendMessage(input, selectedImage || undefined);
    setInput('');
    setSelectedImage(null);
    setImagePreview(null);
    setIsAttachmentMenuOpen(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(',')[1];
      setSelectedImage({
        mimeType: file.type,
        data: base64Data
      });
      setImagePreview(reader.result as string);
      setIsAttachmentMenuOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraOpen(true);
        setIsAttachmentMenuOpen(false);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Unable to access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        const base64Data = dataUrl.split(',')[1];
        setSelectedImage({
          mimeType: 'image/jpeg',
          data: base64Data
        });
        setImagePreview(dataUrl);
        stopCamera();
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
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
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    
    recognitionRef.current = recognition;
    recognition.start();
  };

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

  const handlePlayAudio = async (messageId: string, text: string) => {
    setAudioError(null);
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

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const base64Audio = await generateSpeech(text);
      if (!base64Audio) throw new Error("Audio generation failed.");
      
      const audioBytes = decodeBase64ToUint8Array(base64Audio);
      const audioBuffer = await decodeAudioData(audioBytes, audioContextRef.current);
      audioBufferRef.current = audioBuffer;
      setDuration(audioBuffer.duration);
      playBuffer(0, playbackRate);
    } catch (err: any) {
      console.error("Audio playback error:", err);
      setAudioError("Unable to play scholarly audio. Please try again.");
      setPlayingId(null);
      setAudioState('stopped');
    }
  };

  const playBuffer = (offset: number, rate: number) => {
    if (!audioContextRef.current || !audioBufferRef.current) return;
    
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch(e) {}
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.playbackRate.value = rate;
    source.connect(audioContextRef.current.destination);
    
    startTimeRef.current = audioContextRef.current.currentTime - (offset / rate);
    source.start(0, offset);
    currentSourceRef.current = source;
    
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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
      playBuffer(pausedAtRef.current, playbackRate);
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
    setAudioError(null);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const changePlaybackRate = (rate: number) => {
    const oldRate = playbackRate;
    setPlaybackRate(rate);
    if (audioState === 'playing' && audioContextRef.current) {
      const currentPos = (audioContextRef.current.currentTime - startTimeRef.current) * oldRate;
      playBuffer(currentPos / rate, rate);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  const handleGenerateCard = async () => {
    if (!shareMessage) return;
    setIsGeneratingCard(true);
    setCardImage(null);
    try {
      const art = await generateSacredArt(`A beautiful background for a scholarly Islamic quote: ${shareMessage.content.substring(0, 30)}`);
      setCardImage(art);
      setCopyFeedback('card');
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingCard(false);
    }
  };

  if (!session) return <div className="flex-1 flex items-center justify-center text-stone-400 italic">May you find the guidance you seek.</div>;
  const accentColor = session.sect === 'Sunni' ? 'emerald' : 'teal';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* PROFESSIONAL SCHOLARLY CORRESPONDENT WALLPAPER */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.06] select-none" 
           style={{ 
             backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0L120 60 60 120 0 60zM60 20L100 60 60 100 20 60z' fill='%23064e3b' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
             backgroundSize: '120px 120px'
           }}>
      </div>
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40 bg-gradient-to-b from-stone-50 via-emerald-100/20 to-stone-50"></div>

      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[110] bg-black flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-lg aspect-[3/4] bg-stone-900 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center space-x-8 px-6">
              <button 
                onClick={stopCamera}
                className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full bg-white border-4 border-emerald-500 flex items-center justify-center shadow-xl active:scale-90 transition-transform"
              >
                <div className="w-16 h-16 rounded-full border-2 border-stone-200"></div>
              </button>
              <div className="w-14 h-14"></div>
            </div>
          </div>
          <p className="text-white/50 text-[10px] mt-6 uppercase tracking-[0.2em] font-black text-center max-w-xs">Align calligraphy or scholarly text within the frame</p>
        </div>
      )}

      {/* Share Dialog */}
      {shareMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-stone-950/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden border border-stone-200">
            <div className={`p-8 text-center bg-${accentColor}-900 text-white relative`}>
              <button 
                onClick={() => { setShareMessage(null); setCardImage(null); }}
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
            
            <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {cardImage ? (
                <div className="relative rounded-2xl overflow-hidden shadow-lg border border-stone-200 animate-fade-in">
                  <img src={cardImage} alt="Wisdom Card" className="w-full aspect-square object-cover" />
                  <div className="absolute inset-0 bg-black/40 p-6 flex flex-col justify-center text-center">
                    <p className="text-white text-xs font-serif leading-relaxed italic drop-shadow-md">
                      "{shareMessage.content.substring(0, 150)}{shareMessage.content.length > 150 ? '...' : ''}"
                    </p>
                    <p className="text-amber-400 text-[8px] mt-4 uppercase tracking-widest font-black">Muslimah AI Assistant</p>
                  </div>
                  <button 
                    onClick={() => {
                       const link = document.createElement('a');
                       link.href = cardImage;
                       link.download = 'WisdomCard.png';
                       link.click();
                    }}
                    className="absolute bottom-4 right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center text-stone-900 shadow-xl"
                  >
                    <i className="fas fa-download"></i>
                  </button>
                </div>
              ) : (
                <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 mb-2">
                  <p className="text-stone-500 text-xs italic line-clamp-2 leading-relaxed">
                    "{shareMessage.content}"
                  </p>
                </div>
              )}

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

              {!cardImage && (
                <button 
                  onClick={handleGenerateCard}
                  disabled={isGeneratingCard}
                  className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-3 transition-all border ${
                    isGeneratingCard ? 'opacity-50 cursor-not-allowed' : 'bg-amber-600 text-white border-amber-500 hover:bg-amber-700'
                  }`}
                >
                  <i className={`fas ${isGeneratingCard ? 'fa-spinner fa-spin' : 'fa-image'}`}></i>
                  <span>{isGeneratingCard ? 'Designing Card...' : 'Generate Wisdom Card'}</span>
                </button>
              )}

              <button 
                onClick={handleCopyLink}
                className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-3 transition-all border ${
                  copyFeedback === 'link' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
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

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-8 relative z-10">
        {session.messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-12">
            <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-8 border shadow-xl transition-all hover:scale-105 duration-500 ${
              session.sect === 'Sunni' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-teal-50 text-teal-700 border-teal-100'
            }`}>
              <i className={`fas ${session.sect === 'Sunni' ? 'fa-mosque' : 'fa-kaaba'} text-5xl`}></i>
            </div>
            <h2 className="text-4xl font-arabic font-bold text-stone-800 mb-3 tracking-tight">
              {session.sect === 'Shia' ? "Wisdom of the Ahl al-Bayt (as)" : "Wisdom of the Sunni Path"}
            </h2>
            <p className="text-stone-500 max-w-lg mb-10 leading-relaxed font-medium">
              Muslimah AI welcomes your inquiry. 
              {session.madhab === 'General' ? " Seeking balance across noble traditions." : ` Researching within the ${session.madhab} school.`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
               {(session.sect === 'Sunni' ? [
                 `Latest news from the Haramain`,
                 "Virtues of the Companions (ra)",
                 "Rulings on Friday Prayer",
                 "Latest fatwas from Al-Azhar"
               ] : [
                 `News from Najaf and the Marja'iya`,
                 "Virtues of the Ahl al-Bayt (as)",
                 "Rulings on Khums and Zakat",
                 "Latest updates from Karbala"
               ]).map((q, i) => (
                 <button key={i} onClick={() => onSendMessage(q)} className={`p-5 bg-white/80 backdrop-blur-md border border-stone-200 rounded-2xl text-left text-sm text-stone-700 hover:border-${accentColor}-400 hover:bg-${accentColor}-50/30 transition-all shadow-sm active:scale-[0.98]`}>
                   <div className="flex items-center space-x-2">
                     {q.toLowerCase().includes('news') && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>}
                     <span className="font-semibold">{q}</span>
                   </div>
                 </button>
               ))}
            </div>
          </div>
        )}

        {session.messages.map((m) => (
          <div key={m.id} id={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] md:max-w-[80%] rounded-3xl relative group transition-all duration-300 ${
              m.role === 'user' 
                ? (session.sect === 'Sunni' ? 'bg-emerald-800 shadow-emerald-900/20' : 'bg-teal-800 shadow-teal-900/20') + ' text-white rounded-tr-none px-6 py-5 shadow-xl border border-white/10' 
                : m.isNews 
                  ? 'bg-stone-950 text-stone-100 border border-stone-800 rounded-tl-none ring-1 ring-white/10 shadow-2xl overflow-hidden'
                  : 'bg-white text-stone-800 border border-stone-200 rounded-tl-none border-l-4 border-l-' + (session.sect === 'Sunni' ? 'emerald-600' : 'teal-600') + ' px-6 py-5 shadow-lg'
            }`}>
              
              {/* Specialized News Correspondent Header */}
              {m.isNews && (
                <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-3 flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center space-x-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white">Ummah Pulse Report</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-[8px] bg-white/10 text-white/70 px-2 py-0.5 rounded border border-white/10">LIVE CORRESPONDENCE</span>
                    <i className="fab fa-x-twitter text-white/50 text-xs"></i>
                  </div>
                </div>
              )}

              <div className={`${m.isNews ? 'p-8' : ''}`}>
                {m.image && (
                  <div className="mb-4 rounded-xl overflow-hidden border border-white/10 shadow-lg cursor-pointer transition-transform hover:scale-[1.01]" onClick={() => window.open(`data:${m.image?.mimeType};base64,${m.image?.data}`, '_blank')}>
                    <img src={`data:${m.image.mimeType};base64,${m.image.data}`} alt="User Attachment" className="w-full max-h-64 object-cover" />
                  </div>
                )}
                
                <div className={`whitespace-pre-wrap text-[15px] leading-relaxed prose prose-stone max-w-none ${m.isNews ? 'prose-invert text-stone-200 font-medium' : ''}`}>
                  {m.content}
                </div>
                
                {m.role === 'assistant' && (playingId === m.id || (audioError && playingId === null)) && (
                  <div className="mt-6 pt-4 border-t border-stone-100/10 animate-fade-in">
                    {audioError && !playingId && (
                      <div className="mb-3 text-[10px] font-bold text-red-500 bg-red-50 p-2 rounded-lg border border-red-100 flex items-center">
                        <i className="fas fa-exclamation-circle mr-2"></i>
                        {audioError}
                      </div>
                    )}
                    {playingId === m.id && (
                      <>
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
                        <div className="relative w-full h-1.5 bg-stone-100/10 rounded-full overflow-hidden">
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
                      </>
                    )}
                  </div>
                )}

                {m.sources && m.sources.length > 0 && (
                  <div className={`mt-5 pt-4 border-t ${m.isNews ? 'border-white/5' : 'border-stone-100'}`}>
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                      <i className="fas fa-check-double mr-2 text-emerald-500"></i>
                      Verified Sources
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {m.sources.map((s, idx) => (
                        <a 
                          key={idx} href={s.uri} target="_blank" rel="noopener noreferrer" 
                          className={`text-[11px] flex items-center px-3 py-1.5 rounded-full border transition-all ${
                            m.isNews 
                              ? 'bg-white/5 text-stone-300 border-white/10 hover:bg-white/10 hover:border-white/20' 
                              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 shadow-sm'
                          }`}
                        >
                          <span className="truncate max-w-[150px] font-medium">{s.title}</span>
                          <i className="fas fa-external-link-alt ml-2 text-[9px] opacity-40"></i>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {m.role === 'assistant' && (
                <div className="absolute top-0 left-full ml-3 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col space-y-2 pt-2">
                  <button onClick={() => onToggleBookmark(m.id)} className={`w-9 h-9 rounded-full flex items-center justify-center shadow-xl transform transition-transform hover:scale-110 ${m.isBookmarked ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-white border text-stone-300 hover:text-stone-600'}`}>
                    <i className={`fa-bookmark ${m.isBookmarked ? 'fas' : 'far'}`}></i>
                  </button>
                  <button onClick={() => setShareMessage(m)} className="w-9 h-9 rounded-full bg-white border text-stone-300 hover:text-stone-600 flex items-center justify-center shadow-xl transform transition-transform hover:scale-110 transition-all">
                    <i className="fas fa-share-nodes"></i>
                  </button>
                  {playingId !== m.id && (
                    <button onClick={() => handlePlayAudio(m.id, m.content)} className="w-9 h-9 rounded-full bg-white border text-stone-300 hover:text-stone-600 flex items-center justify-center shadow-xl transform transition-transform hover:scale-110 transition-all" title="Listen to scholarly audio">
                      <i className="fas fa-volume-up"></i>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center space-x-3 text-sm italic text-emerald-600 font-bold bg-emerald-50 px-5 py-3 rounded-full w-fit shadow-sm border border-emerald-100 animate-pulse">
            <div className="flex space-x-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></span>
            </div>
            <span className="uppercase tracking-[0.1em] text-[10px]">{typingText}</span>
          </div>
        )}
        {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 shadow-xl animate-fade-in font-bold">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-white/90 backdrop-blur-xl border-t border-stone-200 relative z-10 shadow-2xl">
        <div className="max-w-4xl mx-auto space-y-4">
          {imagePreview && (
            <div className="relative inline-block group animate-fade-in">
              <img src={imagePreview} alt="Selected" className="h-24 w-24 object-cover rounded-2xl border border-stone-200 shadow-2xl" />
              <button onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center space-x-3 relative">
            <input 
              type="file" accept="image/*" className="hidden" 
              ref={fileInputRef} onChange={handleImageSelect} 
            />
            
            <div className="relative" ref={menuRef}>
              <button 
                type="button" 
                onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                className={`flex-shrink-0 w-12 h-12 rounded-xl border transition-all flex items-center justify-center active:scale-95 shadow-sm ${
                  isAttachmentMenuOpen 
                    ? `bg-${accentColor}-800 text-white border-${accentColor}-900 shadow-inner` 
                    : 'bg-stone-50 border-stone-200 text-stone-400 hover:text-stone-600 hover:bg-stone-100'
                }`}
                title="Attachments"
              >
                <i className={`fas ${isAttachmentMenuOpen ? 'fa-minus' : 'fa-plus'} text-lg`}></i>
              </button>

              {isAttachmentMenuOpen && (
                <div className="absolute bottom-16 left-0 bg-white border border-stone-200 rounded-2xl p-2 shadow-2xl flex flex-col space-y-2 animate-fade-in z-50 min-w-[160px]">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-3 px-4 py-3 hover:bg-stone-50 rounded-xl text-stone-600 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg bg-${accentColor}-50 text-${accentColor}-600 flex items-center justify-center`}>
                      <i className="fas fa-paperclip text-sm"></i>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Attach Image</span>
                  </button>
                  <button 
                    type="button"
                    onClick={startCamera}
                    className="flex items-center space-x-3 px-4 py-3 hover:bg-stone-50 rounded-xl text-stone-600 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <i className="fas fa-camera text-sm"></i>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Take Picture</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 relative group">
              <input 
                type="text" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="Seek scholarly guidance or Ummah news..."
                className={`w-full bg-stone-50 border border-stone-200 rounded-xl px-6 py-4 pr-12 text-sm focus:outline-none focus:ring-4 focus:ring-${accentColor}-500/10 focus:border-${accentColor}-500 transition-all shadow-inner`}
              />
              <button 
                type="button" onClick={toggleListening}
                className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
                  isListening ? 'bg-red-500 text-white animate-pulse shadow-lg' : 'text-stone-300 hover:text-stone-600'
                }`}
              >
                <i className="fas fa-microphone"></i>
              </button>
            </div>

            <button 
              type="submit" disabled={(!input.trim() && !selectedImage) || isTyping}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                (!input.trim() && !selectedImage) || isTyping 
                  ? 'bg-stone-100 text-stone-300 border border-stone-200' 
                  : (session.sect === 'Sunni' ? 'bg-emerald-800' : 'bg-teal-800') + ' text-white shadow-xl active:scale-95'
              }`}
            >
              <i className="fas fa-paper-plane"></i>
            </button>
          </form>

          {/* Inspirational Quote Area */}
          <div className="pt-2 text-center">
            <p className="text-[10px] text-stone-400 font-bold italic leading-relaxed">
              "Allah will exalt in rank those of you who believe and those who have been granted knowledge."
              <span className="block mt-0.5 font-black uppercase tracking-widest opacity-50">— Surah Al-Mujadila, Ayah 11</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
