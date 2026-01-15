
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Message, ChatSession, Sect, Madhab, User, Attachment, UserProgress, QuizQuestion, ArticleLead, SacredArt } from './types';
import { queryAdDeen, generateLessonQuiz, detectLocationName } from './services/geminiService';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import BookmarksLibrary from './components/BookmarksLibrary';
import AuthScreen from './components/AuthScreen';
import QuranExplorer from './components/QuranExplorer';
import SacredArts from './components/SacredArts';
import LiveSessionOverlay from './components/LiveSessionOverlay';
import QuizOverlay from './components/QuizOverlay';
import SettingsOverlay from './components/SettingsOverlay';
import SpiritualBriefingOverlay from './components/SpiritualBriefingOverlay';
import ArticlePreviewOverlay from './components/ArticlePreviewOverlay';
import ProfileOverlay from './components/ProfileOverlay';
import { Language, translations } from './translations';

const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

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
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [sacredArtsHistory, setSacredArtsHistory] = useState<SacredArt[]>(() => {
    try {
      const saved = localStorage.getItem('sanctuary_arts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem('sanctuary_active_session_id');
  });

  const [currentSect, setCurrentSect] = useState<Sect>(() => {
    const saved = localStorage.getItem('sanctuary_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.preferredSect) return parsed.preferredSect;
      } catch(e){}
    }
    return 'Sunni';
  });

  const [currentMadhab, setCurrentMadhab] = useState<Madhab>(() => {
    const saved = localStorage.getItem('sanctuary_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.preferredMadhab) return parsed.preferredMadhab;
      } catch(e){}
    }
    return 'General';
  });

  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('sanctuary_lang') as Language) || 'en';
  });
  
  const [locationName, setLocationName] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system');

  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("Loading...");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'bookmarks' | 'quran' | 'arts' | 'live'>('chat');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBriefing, setShowBriefing] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<QuizQuestion[] | null>(null);
  const [activeArticlePreview, setActiveArticlePreview] = useState<ArticleLead | null>(null);
  const initialSessionCreated = useRef(false);

  const [userProgress, setUserProgress] = useState<UserProgress>(() => {
    try {
      const saved = localStorage.getItem('sanctuary_progress');
      return saved ? JSON.parse(saved) : { 
        xp: 0, level: 1, streak: 0, lastLessonDate: null, lastQuizDate: null, completedQuizzes: [], badges: [] 
      };
    } catch(e) {
      return { xp: 0, level: 1, streak: 0, lastLessonDate: null, lastQuizDate: null, completedQuizzes: [], badges: [] };
    }
  });

  const t = translations[lang];

  const handleSectChange = useCallback((sect: Sect) => {
    setCurrentSect(sect);
    if (user) {
      const updatedUser = { ...user, preferredSect: sect };
      setUser(updatedUser);
      localStorage.setItem('sanctuary_user', JSON.stringify(updatedUser));
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('sanctuary_lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('sanctuary_progress', JSON.stringify(userProgress));
  }, [userProgress]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [themeMode]);

  useEffect(() => {
    if (currentSect === 'Shia') document.documentElement.classList.add('sect-shia');
    else document.documentElement.classList.remove('sect-shia');
  }, [currentSect]);

  const refreshLocation = useCallback(async () => {
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const name = await detectLocationName(pos.coords.latitude, pos.coords.longitude);
        setLocationName(name);
      }, (err) => {
        console.warn("Geo access blocked");
      });
    } catch (e) {}
  }, []);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  const createNewSession = useCallback((sect: Sect = currentSect, madhab: Madhab = currentMadhab) => {
    const newSession: ChatSession = { 
      id: generateId(), userId: user?.id || 'guest', title: 'New Inquiry', messages: [], createdAt: Date.now(), sect, madhab 
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    return newSession;
  }, [currentSect, currentMadhab, user?.id]);

  useEffect(() => { 
    if (!initialSessionCreated.current) { 
      if (sessions.length === 0) createNewSession(); 
      else if (!activeSessionId) setActiveSessionId(sessions[0].id);
      initialSessionCreated.current = true; 
    }
  }, [createNewSession, sessions, activeSessionId]);

  const handleSendMessage = async (content: string, attachments?: Attachment[]) => {
    setError(null);
    setView('chat'); // Force return to Sanctuary Chat
    let activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) activeSession = createNewSession();

    const isLegacyRequest = content === t.legacyPrompt;
    const todayStr = new Date().toDateString();

    if (isLegacyRequest) {
      const cachedLegacy = localStorage.getItem('sabil_daily_legacy');
      if (cachedLegacy) {
        const { date, lesson, quiz } = JSON.parse(cachedLegacy);
        if (date === todayStr) {
          const assistantMessage: Message = { 
            id: generateId(), role: 'assistant', content: lesson, timestamp: Date.now(), isLegacyLesson: true
          };
          setSessions(prev => prev.map(s => s.id === activeSession!.id ? { ...s, messages: [...s.messages, assistantMessage] } : s));
          
          if (userProgress.lastQuizDate !== todayStr) {
            setActiveQuiz(quiz);
          } else {
            setError("You have already completed today's knowledge assessment. Return tomorrow for new challenges.");
          }
          return;
        }
      }
    }

    const userMessage: Message = { id: generateId(), role: 'user', content: content || "", timestamp: Date.now(), attachments: attachments || [] };
    const updatedMessages = [...activeSession.messages, userMessage];
    const targetId = activeSession.id;
    setSessions(prev => prev.map(s => s.id === targetId ? { ...s, messages: updatedMessages } : s));

    setIsTyping(true);
    setTypingText("Consulting digital sanctuary...");
    try {
      const history = updatedMessages.map(m => ({
        role: (m.role === 'user' ? 'user' : 'model') as any,
        parts: [{ text: m.content || "" }]
      }));
      
      const res = await queryAdDeen(content, activeSession.sect, activeSession.madhab, history, attachments?.[0]);
      const assistantMessage: Message = { 
        id: generateId(), role: 'assistant', content: res.text || "", timestamp: Date.now(), 
        sources: res.sources, suggestions: res.suggestions, isLegacyLesson: res.isLegacyLesson
      };
      
      setSessions(prev => prev.map(s => s.id === targetId ? { ...s, messages: [...updatedMessages, assistantMessage] } : s));

      if (res.isLegacyLesson) {
        setTypingText("Preparing knowledge check...");
        const quiz = await generateLessonQuiz(res.text, activeSession.sect, activeSession.madhab);
        
        localStorage.setItem('sabil_daily_legacy', JSON.stringify({
          date: todayStr,
          lesson: res.text,
          quiz: quiz
        }));

        if (userProgress.lastQuizDate !== todayStr) {
          setActiveQuiz(quiz);
        }
      }
    } catch (err: any) { 
      setError("The scholarly servers are currently busy. Please try again soon.");
    } finally { setIsTyping(false); }
  };

  const handleQuizComplete = (score: number, total: number) => {
    const todayStr = new Date().toDateString();
    setUserProgress(prev => ({
      ...prev,
      xp: prev.xp + (score * 50),
      lastQuizDate: todayStr
    }));
    setActiveQuiz(null);
  };

  const handleUtilityAction = (action: string) => {
    if (action === 'settings') setShowSettings(true);
    if (action === 'profile' && user) setShowProfile(true);
    if (action === 'profile' && !user) setShowAuthModal(true);
    setIsSidebarOpen(false);
  };

  const currentActiveSession = sessions.find(s => s.id === activeSessionId) || null;

  return (
    <div className={`flex h-screen bg-transparent overflow-hidden transition-colors ${lang === 'ar' ? 'font-arabic' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Sidebar 
        isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}
        lang={lang} user={user} progress={userProgress} 
        onLogout={() => { setUser(null); setSessions([]); createNewSession(); }} onOpenAuth={() => setShowAuthModal(true)} 
        onOpenNews={() => handleSendMessage(t.newsPrompt)}
        onOpenLive={() => setView('live')}
        onOpenMap={(query) => handleSendMessage(query)}
        currentSect={currentSect}
        currentView={view}
        onNavigate={setView}
        onNewInquiry={() => { createNewSession(); setView('chat'); }}
        onUtilityAction={handleUtilityAction}
        themeMode={themeMode}
        onThemeChange={setThemeMode}
        onLegacyLesson={() => handleSendMessage(t.legacyPrompt)}
        setLang={setLang}
        locationName={locationName}
        onRefreshLocation={refreshLocation}
      />
      
      <main className="flex-1 flex flex-col min-w-0 relative bg-transparent">
        <header className="bg-transparent border-b border-black/5 dark:border-white/5 px-8 py-6 flex items-center justify-between z-40">
          <div className="flex items-center space-x-6">
            <button onClick={() => setIsSidebarOpen(true)} className="w-12 h-12 bg-white/10 dark:bg-[#1F1F1F] border border-black/5 dark:border-white/5 rounded-2xl flex items-center justify-center text-scholar-gold hover:opacity-80 transition-all">
              <i className="fas fa-bars"></i>
            </button>
            <div className="flex flex-col">
              <h1 className="font-black text-xs text-neutral-900 dark:text-white uppercase tracking-[0.2em]">SebilLink</h1>
              <span className="text-[8px] font-black uppercase tracking-widest text-scholar-gold opacity-60">Sacred Sanctuary</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
             {locationName && (
               <div className="hidden lg:flex items-center space-x-2 px-4 py-2 bg-white/5 border border-black/5 dark:border-white/5 rounded-full">
                  <i className="fas fa-location-dot text-[10px] text-red-500"></i>
                  <span className="text-[10px] font-black uppercase tracking-widest text-scholar-muted">{locationName}</span>
               </div>
             )}
             <div className="flex p-1 bg-white/10 dark:bg-[#1F1F1F] rounded-xl border border-black/5 dark:border-white/5">
                <button onClick={() => handleSectChange('Sunni')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${currentSect === 'Sunni' ? 'bg-scholar-gold text-white shadow-lg' : 'text-scholar-muted'}`}>Sunni</button>
                <button onClick={() => handleSectChange('Shia')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${currentSect === 'Shia' ? 'bg-scholar-gold text-white shadow-lg' : 'text-scholar-muted'}`}>Shia</button>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {view === 'chat' && (
            <ChatInterface 
              lang={lang} setLang={setLang} session={currentActiveSession} isTyping={isTyping} typingText={typingText} error={error} 
              onSendMessage={handleSendMessage} onPerspectiveChange={(s, m) => { handleSectChange(s); setCurrentMadhab(m); }} 
              onFeedback={() => {}} onOpenLive={() => setView('live')} currentSect={currentSect} isGuest={!user}
              onPreviewArticle={setActiveArticlePreview}
            />
          )}
          {view === 'quran' && <QuranExplorer lang={lang} onClose={() => setView('chat')} />}
          {view === 'arts' && <SacredArts lang={lang} isPremium={true} onOpenAuth={() => setShowAuthModal(true)} onClose={() => setView('chat')} history={sacredArtsHistory} onSaveArt={a => setSacredArtsHistory(p => [a, ...p])} onRemoveArt={id => setSacredArtsHistory(p => p.filter(x => x.id !== id))} />}
          {view === 'bookmarks' && <BookmarksLibrary lang={lang} sessions={sessions} onGoToSession={id => { setActiveSessionId(id); setView('chat'); }} onClose={() => setView('chat')} onToggleBookmark={() => {}} />}
          {view === 'live' && <LiveSessionOverlay lang={lang} onClose={() => setView('chat')} sect={currentSect} madhab={currentMadhab} />}
        </div>
      </main>

      {showBriefing && <SpiritualBriefingOverlay lang={lang} setLang={setLang} locationName={locationName} onClose={() => setShowBriefing(false)} onNavigate={setView} />}
      {activeQuiz && <QuizOverlay questions={activeQuiz} lang={lang} sect={currentSect} madhab={currentMadhab} userXP={userProgress.xp} onComplete={handleQuizComplete} />}
      {activeArticlePreview && <ArticlePreviewOverlay article={activeArticlePreview} lang={lang} onClose={() => setActiveArticlePreview(null)} onExplore={() => { handleSendMessage(activeArticlePreview.title); setActiveArticlePreview(null); }} />}
      {showAuthModal && <AuthScreen lang={lang} onLogin={u => { setUser(u); setShowAuthModal(false); }} onClose={() => setShowAuthModal(false)} />}
      {showSettings && <SettingsOverlay lang={lang} setLang={setLang} sect={currentSect} setSect={handleSectChange} madhab={currentMadhab} setMadhab={setCurrentMadhab} onClose={() => setShowSettings(false)} themeMode={themeMode} onThemeChange={setThemeMode} />}
      {showProfile && user && <ProfileOverlay user={user} onUpdate={() => {}} onClose={() => setShowProfile(false)} lang={lang} />}
    </div>
  );
};

export default App;
