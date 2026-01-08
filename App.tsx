
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Message, ChatSession, Sect, Madhab, User, Attachment, UserProgress, QuizQuestion } from './types';
import { queryAdDeen, generateLessonQuiz } from './services/geminiService';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import BookmarksLibrary from './components/BookmarksLibrary';
import AuthScreen from './components/AuthScreen';
import QuranExplorer from './components/QuranExplorer';
import SacredArts from './components/SacredArts';
import DiscoveryOverlay from './components/DiscoveryOverlay';
import LiveSessionOverlay from './components/LiveSessionOverlay';
import QuizOverlay from './components/QuizOverlay';
import SettingsOverlay from './components/SettingsOverlay';
import { Language, translations } from './translations';

const XP_PER_LEVEL = 1750;

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch (e) {}
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('sanctuary_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('sanctuary_sessions');
      return (user && saved) ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentSect, setCurrentSect] = useState<Sect>('Sunni');
  const [currentMadhab, setCurrentMadhab] = useState<Madhab>('General');
  const [lang, setLang] = useState<Language>('en');
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("Consulting records...");
  const [view, setView] = useState<'chat' | 'bookmarks' | 'quran' | 'arts' | 'live'>('chat');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  const [activeQuiz, setActiveQuiz] = useState<QuizQuestion[] | null>(null);
  const initialSessionCreated = useRef(false);

  const [userProgress, setUserProgress] = useState<UserProgress>(() => {
    try {
      const saved = localStorage.getItem('user_progress_sanctuary');
      if (user && saved) return JSON.parse(saved);
    } catch (e) {}
    return { xp: 0, level: 1, streak: 0, lastLessonDate: null, lastQuizDate: null, completedQuizzes: [], badges: [] };
  });

  const t = translations[lang];

  useEffect(() => {
    try { 
      if (user) {
        localStorage.setItem('user_progress_sanctuary', JSON.stringify(userProgress)); 
        localStorage.setItem('sanctuary_sessions', JSON.stringify(sessions));
      }
    } catch (e) {}
  }, [userProgress, sessions, user]);

  useEffect(() => {
    try {
      if (user) { 
        localStorage.setItem('sanctuary_user', JSON.stringify(user)); 
      } else {
        localStorage.removeItem('sanctuary_user');
        localStorage.removeItem('sanctuary_sessions');
        localStorage.removeItem('user_progress_sanctuary');
      }
    } catch (e) {}
  }, [user]);

  const createNewSession = useCallback((sect: Sect = currentSect, madhab: Madhab = currentMadhab) => {
    const newSession: ChatSession = { 
      id: generateId(), 
      userId: user?.id || 'guest', 
      title: lang === 'ar' ? 'استفسار جديد' : 'New Inquiry', 
      messages: [], 
      createdAt: Date.now(), 
      sect, 
      madhab 
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    return newSession;
  }, [currentSect, currentMadhab, lang, user?.id]);

  useEffect(() => { 
    if (!initialSessionCreated.current) { createNewSession(); initialSessionCreated.current = true; }
  }, [createNewSession]);

  const handleSendMessage = async (content: string, attachment?: Attachment) => {
    const isToday = (ts: number | null) => ts ? new Date(ts).toDateString() === new Date().toDateString() : false;

    if (content === t.legacyPrompt && isToday(userProgress.lastQuizDate)) {
       handleSendMessage("System: You have completed your scholarly challenge for today. May Allah reward your diligence.");
       return;
    }

    let activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) activeSession = createNewSession();

    const userMessage: Message = { id: generateId(), role: 'user', content: content || "", timestamp: Date.now(), attachments: attachment ? [attachment] : [] };

    const targetId = activeSession.id;
    setSessions(prev => prev.map(s => s.id === targetId ? { ...s, messages: [...s.messages, userMessage] } : s));

    setIsTyping(true);
    setTypingText(lang === 'ar' ? 'جاري استشارة السجلات...' : "Consulting scholarly records...");
    try {
      const history = activeSession.messages.map(m => ({
        role: (m.role === 'user' ? 'user' : 'model') as any,
        parts: [{ text: m.content || "" }]
      }));
      
      const res = await queryAdDeen(content, activeSession.sect, activeSession.madhab, history, attachment);
      
      const assistantMessage: Message = { 
        id: generateId(), role: 'assistant', content: res.text || "", timestamp: Date.now(), 
        sources: res.sources, suggestions: res.suggestions, articleLeads: res.articleLeads, isLegacyLesson: res.isLegacyLesson
      };

      setSessions(prev => prev.map(s => s.id === targetId ? { ...s, messages: [...s.messages, assistantMessage] } : s));
      
      if (content === t.legacyPrompt) {
        setUserProgress(prev => ({ ...prev, lastLessonDate: Date.now() }));
      }
    } catch (err) { console.error(err); } finally { setIsTyping(false); }
  };

  const handleUtilityAction = (action: 'notifications' | 'settings' | 'share' | 'rate') => {
    switch(action) {
      case 'notifications':
        setHasNewNotifications(false);
        handleSendMessage("System: Display my notification summary for today.");
        setIsSidebarOpen(false);
        break;
      case 'settings':
        setShowSettings(true);
        setIsSidebarOpen(false);
        break;
      case 'share':
        if (navigator.share) {
          navigator.share({ title: 'Ask the Shaykh', text: 'Seek Islamic wisdom with me.', url: window.location.href });
        } else {
          navigator.clipboard.writeText(window.location.href);
          alert("Link copied to clipboard!");
        }
        break;
      case 'rate':
        window.open('https://ai.google.dev/gemini-api', '_blank');
        break;
    }
  };

  const startQuiz = async (content: string) => {
    if (!user) { setShowAuthModal(true); return; }
    if (new Date(userProgress.lastQuizDate || 0).toDateString() === new Date().toDateString()) {
      alert("You have already completed today's scholarly challenge.");
      return;
    }
    setIsTyping(true);
    setTypingText("Preparing academic challenge...");
    try {
      const quiz = await generateLessonQuiz(content, currentSect, currentMadhab);
      setActiveQuiz(quiz);
    } catch (e) { console.error(e); }
    finally { setIsTyping(false); }
  };

  const handleQuizComplete = (score: number, total: number) => {
    const xpEarned = score * 25;
    setUserProgress(prev => {
      const newXP = prev.xp + xpEarned;
      const newLevel = Math.floor(newXP / XP_PER_LEVEL) + 1;
      return { ...prev, xp: newXP, level: newLevel, lastQuizDate: Date.now() };
    });
    setActiveQuiz(null);
  };

  const handleLogout = () => {
    setUser(null);
    setSessions([]);
    setUserProgress({ xp: 0, level: 1, streak: 0, lastLessonDate: null, lastQuizDate: null, completedQuizzes: [], badges: [] });
    createNewSession();
  };

  const currentActiveSession = sessions.find(s => s.id === activeSessionId) || null;
  const brandTextClass = currentSect === 'Sunni' ? 'text-emerald-800' : 'text-teal-900';

  return (
    <div className={`flex h-screen bg-stone-100 overflow-hidden ${lang === 'ar' ? 'font-arabic' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Sidebar 
        isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}
        lang={lang} user={user ? { ...user, progress: userProgress } : null} progress={userProgress} 
        onLogout={handleLogout} onOpenAuth={() => setShowAuthModal(true)} 
        onOpenNews={() => { setView('chat'); handleSendMessage(t.newsPrompt); setIsSidebarOpen(false); }}
        onOpenLive={() => { setView('live'); setIsSidebarOpen(false); }}
        onOpenMap={() => { setView('chat'); handleSendMessage("Find nearby mosques."); setIsSidebarOpen(false); }}
        currentSect={currentSect}
        currentView={view}
        onNavigate={(v) => { setView(v); setIsSidebarOpen(false); }}
        onUtilityAction={handleUtilityAction}
        hasNotifications={hasNewNotifications}
      />
      
      <main className="flex-1 flex flex-col min-w-0 transition-all duration-300 relative">
        <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-6 py-4 flex items-center justify-between z-40 shadow-sm">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
              <i className={`fas fa-bars text-xl ${brandTextClass}`}></i>
            </button>
            <div className="flex flex-col">
               <h1 className="font-bold text-sm text-stone-900">Ask the Shaykh</h1>
               <div className="flex items-center space-x-2">
                  <span className={`text-[8px] font-black uppercase tracking-widest ${currentSect === 'Sunni' ? 'text-emerald-600' : 'text-teal-600'}`}>
                    {currentSect} • {lang.toUpperCase()}
                  </span>
               </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex p-0.5 bg-stone-100 rounded-lg border text-[8px] font-black uppercase">
              <button onClick={() => setCurrentSect('Sunni')} className={`px-2 py-0.5 rounded transition-all ${currentSect === 'Sunni' ? 'bg-emerald-800 text-white shadow-sm' : 'text-stone-400'}`}>Sunni</button>
              <button onClick={() => setCurrentSect('Shia')} className={`px-2 py-0.5 rounded transition-all ${currentSect === 'Shia' ? 'bg-teal-900 text-white shadow-sm' : 'text-stone-400'}`}>Shia</button>
            </div>
            {user && (
              <div className="flex items-center space-x-2 bg-stone-50 border px-3 py-1 rounded-full">
                <i className="fas fa-bolt text-amber-500 text-[10px]"></i>
                <span className="text-[10px] font-black text-stone-700">{userProgress.xp} XP</span>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {view === 'chat' && (
            <ChatInterface 
              lang={lang} session={currentActiveSession} isTyping={isTyping} typingText={typingText} error={null} 
              onSendMessage={handleSendMessage} onPerspectiveChange={(s, m) => { setCurrentSect(s); setCurrentMadhab(m); }} 
              onStartQuiz={startQuiz} currentSect={currentSect} isGuest={!user}
            />
          )}
          {view === 'quran' && <QuranExplorer lang={lang} onClose={() => setView('chat')} />}
          {view === 'arts' && <SacredArts lang={lang} isPremium={true} onOpenAuth={() => setShowAuthModal(true)} onClose={() => setView('chat')} />}
          {view === 'bookmarks' && <BookmarksLibrary lang={lang} sessions={sessions} onGoToSession={id => { setActiveSessionId(id); setView('chat'); }} onClose={() => setView('chat')} onToggleBookmark={() => {}} />}
          {view === 'live' && <LiveSessionOverlay lang={lang} onClose={() => setView('chat')} sect={currentSect} madhab={currentMadhab} />}
        </div>
      </main>

      {activeQuiz && (
        <QuizOverlay 
          questions={activeQuiz} lang={lang} sect={currentSect} madhab={currentMadhab} 
          userXP={userProgress.xp} onComplete={handleQuizComplete} 
        />
      )}

      {showSettings && (
        <SettingsOverlay 
          lang={lang} setLang={setLang} 
          sect={currentSect} setSect={setCurrentSect} 
          madhab={currentMadhab} setMadhab={setCurrentMadhab}
          onClose={() => setShowSettings(false)} 
        />
      )}

      {showDiscovery && <DiscoveryOverlay lang={lang} isPremium={true} onOpenAuth={() => setShowAuthModal(true)} onNavigate={(v, p) => { setView(v); if(p) handleSendMessage(p); }} onClose={() => setShowDiscovery(false)} />}
      {showAuthModal && <AuthScreen lang={lang} onLogin={u => { setUser(u); setShowAuthModal(false); }} onClose={() => setShowAuthModal(false)} />}
    </div>
  );
};

export default App;
