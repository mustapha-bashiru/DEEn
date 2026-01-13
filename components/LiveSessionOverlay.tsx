
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Sect, Madhab, LiveTranscriptItem, LiveSessionRecord } from '../types';
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
  const [isRecording, setIsRecording] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [transcript, setTranscript] = useState<LiveTranscriptItem[]>([]);
  const [currentInputText, setCurrentInputText] = useState('');
  const [currentOutputText, setCurrentOutputText] = useState('');

  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const t = translations[lang];

  // Participants (Simulated for visualization)
  const participants = [
    { id: '1', name: 'Shaykh Al-Sanctuary', role: 'Scholar', isActive: isModelSpeaking },
    { id: '2', name: 'You', role: 'Seeker', isActive: !isModelSpeaking && isActive, isHandRaised },
    { id: '3', name: 'Student Ahmed', role: 'Seeker', isActive: false },
    { id: '4', name: 'Zaynab', role: 'Seeker', isActive: false },
  ];

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
          
          await inputAudioContext.resume();
          await outputAudioContext.resume();

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
          // Handle Audio Data
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

          // Handle Transcriptions
          if (msg.serverContent?.inputTranscription) {
            setCurrentInputText(prev => prev + msg.serverContent!.inputTranscription!.text);
          }
          if (msg.serverContent?.outputTranscription) {
            setCurrentOutputText(prev => prev + msg.serverContent!.outputTranscription!.text);
          }
          if (msg.serverContent?.turnComplete) {
            setTranscript(prev => [
              ...prev,
              { id: Date.now().toString() + '-in', role: 'Seeker', text: currentInputText, timestamp: Date.now() },
              { id: Date.now().toString() + '-out', role: 'Scholar', text: currentOutputText, timestamp: Date.now() }
            ]);
            setCurrentInputText('');
            setCurrentOutputText('');
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
          saveTranscriptToLocalStorage();
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
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

  const saveTranscriptToLocalStorage = () => {
    if (transcript.length === 0) return;
    const record: LiveSessionRecord = {
      id: Date.now().toString(),
      title: `Majlis: ${new Date().toLocaleDateString()}`,
      timestamp: Date.now(),
      transcript: transcript
    };
    const saved = JSON.parse(localStorage.getItem('sanctuary_live_records') || '[]');
    localStorage.setItem('sanctuary_live_records', JSON.stringify([record, ...saved]));
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      // Consent placeholder: in a real app, show a modal
      const consent = confirm("Do you consent to recording this scholarly gathering for your personal offline review?");
      if (!consent) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log("Audio recording saved locally", blob);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (err) {
        alert("Recording failed: Check permissions.");
      }
    }
  };

  return (
    <div className={`fixed inset-0 z-[300] bg-stone-950/98 backdrop-blur-3xl flex items-center justify-center animate-fade-in ${lang === 'ar' ? 'font-arabic' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Sidebar Overlay (Participants & Transcript) */}
      <aside className={`fixed top-0 bottom-0 ${lang === 'ar' ? 'left-0' : 'right-0'} w-80 bg-white/5 border-${lang === 'ar' ? 'r' : 'l'} border-white/10 backdrop-blur-2xl z-[310] transition-transform duration-500 transform ${isSidebarOpen ? 'translate-x-0' : (lang === 'ar' ? '-translate-x-full' : 'translate-x-full')}`}>
        <div className="flex flex-col h-full p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">{t.liveParticipants}</h3>
            <button onClick={() => setIsSidebarOpen(false)} className="text-white/40 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
          </div>
          <div className="space-y-4 mb-10">
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${p.role === 'Scholar' ? 'bg-scholar-gold text-white' : 'bg-white/10 text-white/50'}`}>
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white">{p.name}</p>
                    <p className="text-[9px] text-white/40 uppercase tracking-widest">{p.role}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {p.isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>}
                  {p.isHandRaised && <i className="fas fa-hand text-[10px] text-scholar-gold animate-bounce"></i>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Real-time Transcript</h3>
            <div className="space-y-4">
              {transcript.map(item => (
                <div key={item.id} className="text-sm">
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${item.role === 'Scholar' ? 'text-scholar-gold' : 'text-white/40'}`}>{item.role}</p>
                  <p className="text-white/80 leading-relaxed italic">"{item.text}"</p>
                </div>
              ))}
              {(currentInputText || currentOutputText) && (
                 <div className="flex items-center space-x-2 text-[10px] text-scholar-gold font-bold italic animate-pulse">
                    <i className="fas fa-keyboard"></i>
                    <span>Shaykh is formulating a response...</span>
                 </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className={`absolute top-10 ${lang === 'ar' ? 'left-10' : 'right-10'} flex items-center space-x-4 space-x-reverse`}>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all border border-white/5 shadow-xl"
        >
          <i className="fas fa-users-viewfinder"></i>
        </button>
        <button onClick={onClose} className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500/40 transition-all border border-red-500/20">
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative w-64 h-64 flex items-center justify-center">
          <div className={`absolute inset-0 rounded-full border-4 border-emerald-500/20 transition-all duration-1000 ${isModelSpeaking ? 'scale-150 opacity-0' : 'scale-100 opacity-100'}`}></div>
          <div className={`absolute inset-0 rounded-full border-4 border-emerald-500/40 transition-all duration-700 delay-100 ${isModelSpeaking ? 'scale-125 opacity-0' : 'scale-100 opacity-100'}`}></div>
          <div className={`w-48 h-48 rounded-full bg-emerald-900 flex items-center justify-center shadow-[0_0_80px_rgba(16,185,129,0.3)] z-10 transition-transform duration-300 ${isModelSpeaking ? 'scale-110' : 'scale-100'}`}>
            <i className={`fas ${isModelSpeaking ? 'fa-volume-high' : 'fa-microphone'} text-5xl text-emerald-400`}></i>
          </div>
          {isRecording && (
            <div className="absolute -top-4 -right-4 bg-red-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center space-x-2 shadow-xl animate-pulse">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              <span>REC</span>
            </div>
          )}
        </div>

        <div className="mt-16 text-center space-y-4 max-w-md">
          <h2 className="text-3xl font-bold text-white tracking-tight">{t.liveTitle}</h2>
          <div className="flex items-center justify-center space-x-2 space-x-reverse">
             <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-stone-600'}`}></div>
             <p className="text-emerald-400 font-black uppercase tracking-[0.3em] text-[10px]">
               {statusText}
             </p>
          </div>
          <p className="text-stone-500 text-sm leading-relaxed px-10">
            {t.liveSub}
          </p>
        </div>

        <div className="mt-12 flex items-center space-x-6 space-x-reverse">
          <button 
            onClick={toggleRecording}
            className={`flex flex-col items-center space-y-2 group`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border ${isRecording ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/20' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'}`}>
              <i className={`fas ${isRecording ? 'fa-stop' : 'fa-circle-dot'} text-lg`}></i>
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/30 group-hover:text-white/60">{isRecording ? t.liveStopRecord : t.liveRecord}</span>
          </button>

          <button 
            onClick={() => setIsHandRaised(!isHandRaised)}
            className={`flex flex-col items-center space-y-2 group`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border ${isHandRaised ? 'bg-scholar-gold border-scholar-gold text-white shadow-lg' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'}`}>
              <i className={`fas fa-hand text-lg`}></i>
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/30 group-hover:text-white/60">{isHandRaised ? t.liveHandRaised : t.liveRaiseHand}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveSessionOverlay;
