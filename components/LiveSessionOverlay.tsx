
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Sect, Madhab } from '../types';
import { Language, translations } from '../translations';

interface LiveSessionOverlayProps {
  lang: Language;
  onClose: () => void;
  sect: Sect;
  madhab: Madhab;
}

// Robust encoding/decoding functions as per Gemini Live API specs
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const LiveSessionOverlay: React.FC<LiveSessionOverlayProps> = ({ onClose, sect, madhab, lang }) => {
  const [isActive, setIsActive] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [statusText, setStatusText] = useState('');
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const t = translations[lang];

  useEffect(() => {
    setStatusText(t.liveSeeking);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: async () => {
          setIsActive(true);
          setStatusText(t.liveConnection);
          
          // Resume contexts (browser requirement)
          await inputAudioContext.resume();
          await outputAudioContext.resume();

          // Initial Greeting to break the "stuck" silence
          sessionPromise.then(session => {
             // Send a greeting to trigger the first response
             session.sendRealtimeInput([{ 
               text: lang === 'ar' ? "السلام عليكم، كيف يمكنني مساعدتكم اليوم في طلب العلم؟" : "As-salamu alaykum. How may I assist you in your pursuit of knowledge today?" 
             }]);
          });

          // Microphone stream
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const encodedData = encode(new Uint8Array(int16.buffer));
              sessionPromise.then(s => s.sendRealtimeInput({ 
                media: { data: encodedData, mimeType: 'audio/pcm;rate=16000' } 
              }));
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          } catch (err) {
            console.error("Mic access denied", err);
            setStatusText("Microphone Access Required");
          }
        },
        onmessage: async (msg: LiveServerMessage) => {
          const audioBase64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          
          if (audioBase64) {
            setIsModelSpeaking(true);
            const audioData = decode(audioBase64);
            const buffer = await decodeAudioData(audioData, outputAudioContext);
            
            const source = outputAudioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(outputAudioContext.destination);
            
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            
            sourcesRef.current.add(source);
            source.onended = () => {
              sourcesRef.current.delete(source);
              if (sourcesRef.current.size === 0) setIsModelSpeaking(false);
            };
          }

          if (msg.serverContent?.interrupted) {
            sourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            setIsModelSpeaking(false);
          }
        },
        onerror: (e) => {
          console.error("Live API Error:", e);
          setStatusText("Connection Disrupted");
        },
        onclose: () => {
          setIsActive(false);
          setStatusText("Session Ended");
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } 
        },
        systemInstruction: `You are in a live Majlis (scholarly gathering). Be warm, authoritative, and concise. Perspective: ${sect}, Madhab: ${madhab}. Respond in ${lang === 'ar' ? 'Arabic' : 'English'}.`
      }
    });

    return () => {
      inputAudioContext.close();
      outputAudioContext.close();
      sessionPromise.then(s => s.close());
    };
  }, []);

  return (
    <div className={`fixed inset-0 z-[300] bg-stone-950/95 backdrop-blur-3xl flex flex-col items-center justify-center p-10 animate-fade-in ${lang === 'ar' ? 'font-arabic' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className={`absolute top-10 ${lang === 'ar' ? 'left-10' : 'right-10'}`}>
        <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all">
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Animated Rings */}
        <div className={`absolute inset-0 rounded-full border-4 border-emerald-500/20 transition-all duration-1000 ${isModelSpeaking ? 'scale-150 opacity-0' : 'scale-100 opacity-100'}`}></div>
        <div className={`absolute inset-0 rounded-full border-4 border-emerald-500/40 transition-all duration-700 delay-100 ${isModelSpeaking ? 'scale-125 opacity-0' : 'scale-100 opacity-100'}`}></div>
        
        <div className={`w-48 h-48 rounded-full bg-emerald-900 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.3)] z-10 transition-transform duration-300 ${isModelSpeaking ? 'scale-110' : 'scale-100'}`}>
          <i className={`fas ${isModelSpeaking ? 'fa-volume-high animate-pulse' : 'fa-microphone'} text-5xl text-emerald-400`}></i>
        </div>
      </div>

      <div className="mt-16 text-center space-y-4 max-w-md">
        <h2 className="text-3xl font-bold text-white tracking-tight">{t.liveTitle}</h2>
        <div className="flex items-center justify-center space-x-2 space-x-reverse">
           <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-stone-600'}`}></div>
           <p className="text-emerald-400 font-black uppercase tracking-[0.3em] text-[10px]">
             {statusText}
           </p>
        </div>
        <p className="text-stone-500 text-sm leading-relaxed">
          {t.liveSub}
        </p>
      </div>

      {isModelSpeaking && (
        <div className="mt-8 px-6 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
           <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Shaykh is Speaking...</span>
        </div>
      )}

      <div className={`absolute bottom-10 flex items-center ${lang === 'ar' ? 'space-x-reverse' : ''} space-x-4`}>
         <div className={`flex ${lang === 'ar' ? 'space-x-reverse' : ''} space-x-1`}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`w-1 h-4 bg-emerald-500 rounded-full animate-bounce`} style={{ animationDelay: `${i * 0.1}s` }}></div>
            ))}
         </div>
         <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{t.liveVoiceActive}</span>
      </div>
    </div>
  );
};

export default LiveSessionOverlay;
