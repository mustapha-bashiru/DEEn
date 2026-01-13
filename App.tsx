
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
import { Language, translations } from './translations';

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

  const [currentSect, setCurrentSect] = useState<Sect>('Sunni');
  const [currentMadhab, setCurrentMadhab] = useState<Madhab>('General');
  const [lang, setLang] = useState<Language>('en');
  const [locationName, setLocationName] = useState<string | null>(null);
  
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('sanctuary_theme') as 'light' | 'dark' | 'system') || 'system';
  });

  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("Consulting records...");
  const [view, setView] = useState<'chat' | 'bookmarks' | 'quran' | 'arts' | 'live'>('chat');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBriefing, setShowBriefing] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  const [activeQuiz, setActiveQuiz] = useState<QuizQuestion[] | null>(null);
  const [activeArticlePreview, setActiveArticlePreview] = useState<ArticleLead | null>(null);
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
    const root = window.document.documentElement;
    const applyTheme = (mode: 'light' | 'dark') => {
      if (mode === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
    };

    if (themeMode === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(systemDark ? 'dark' : 'light');
      
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      applyTheme(themeMode as 'light' | 'dark');
    }
    localStorage.setItem('sanctuary_theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (currentSect === 'Shia') {
      document.documentElement.classList.add('sect-shia');
    } else {
      document.documentElement.classList.remove('sect-shia');
    }
  }, [currentSect]);

  const refreshLocation = useCallback(async () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const name = await detectLocationName(pos.coords.latitude, pos.coords.longitude);
          setLocationName(name);
        },
        () => setLocationName(null),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  useEffect(() => {
    try { 
      localStorage.setItem('sanctuary_sessions', JSON.stringify(sessions));
      localStorage.setItem('sanctuary_arts', JSON.stringify(sacredArtsHistory));
      if (activeSessionId) {
        localStorage.setItem('sanctuary_active_session_id', activeSessionId);
      }
      if (user) {
        localStorage.setItem('sanctuary_user', JSON.stringify(user));
        localStorage.setItem('user_progress_sanctuary', JSON.stringify(userProgress)); 
      }
    } catch (e) {}
  }, [userProgress, sessions, sacredArtsHistory, user, activeSessionId]);

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
    if (!initialSessionCreated.current) { 
      if (sessions.length === 0) {
        createNewSession(); 
      } else if (!activeSessionId) {
        setActiveSessionId(sessions[0].id);
      }
      initialSessionCreated.current = true; 
    }
  }, [createNewSession, sessions, activeSessionId]);

  const handleSendMessage = async (content: string, attachment?: Attachment) => {
    let activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) activeSession = createNewSession();

    const userMessage: Message = { id: generateId(), role: 'user', content: content || "", timestamp: Date.now(), attachments: attachment ? [attachment] : [] };
    const targetId = activeSession.id;
    setSessions(prev => prev.map(s => s.id === targetId ? { ...s, messages: [...s.messages, userMessage] } : s));

    setIsTyping(true);
    setTypingText(lang === 'ar' ? 'جاري استشارة السجلات...' : "Seeking wisdom...");
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

      if (res.isLegacyLesson) {
        setTypingText(lang === 'ar' ? 'جاري إعداد الاختبار...' : "Preparing knowledge challenge...");
        const quiz = await generateLessonQuiz(res.text, activeSession.sect, activeSession.madhab);
        setActiveQuiz(quiz);
      }
    } catch (err) { console.error(err); } finally { setIsTyping(false); }
  };

  const handleFeedback = (messageId: string, rating: 'up' | 'down', comment?: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id === activeSessionId) {
        return {
          ...session,
          messages: session.messages.map(m => m.id === messageId ? { ...m, feedback: { rating, comment } } : m)
        };
      }
      return session;
    }));
  };

  const handleSectChange = (s: Sect) => {
    setCurrentSect(s);
    setSessions(prev => prev.map(sess => sess.id === activeSessionId ? { ...sess, sect: s } : sess));
  };

  const handleNewInquiry = () => {
    createNewSession();
    setView('chat');
    setIsSidebarOpen(false);
  };

  const saveSacredArt = (art: SacredArt) => {
    setSacredArtsHistory(prev => [art, ...prev]);
  };

  const removeSacredArt = (id: string) => {
    setSacredArtsHistory(prev => prev.filter(a => a.id !== id));
  };

  const currentActiveSession = sessions.find(s => s.id === activeSessionId) || null;

  return (
    <div className={`flex h-screen bg-transparent overflow-hidden transition-colors ${lang === 'ar' ? 'font-arabic' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Sidebar 
        isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}
        lang={lang} user={user ? { ...user, progress: userProgress } : null} progress={userProgress} 
        onLogout={() => { setUser(null); setSessions([]); localStorage.removeItem('sanctuary_user'); localStorage.removeItem('sanctuary_sessions'); localStorage.removeItem('sanctuary_active_session_id'); createNewSession(); }} onOpenAuth={() => setShowAuthModal(true)} 
        onOpenNews={() => { setView('chat'); handleSendMessage(t.newsPrompt); setIsSidebarOpen(false); }}
        onOpenLive={() => { setView('live'); setIsSidebarOpen(false); }}
        onOpenMap={(query) => { setView('chat'); handleSendMessage(query); setIsSidebarOpen(false); }}
        currentSect={currentSect}
        currentView={view}
        onNavigate={(v) => { setView(v); setIsSidebarOpen(false); }}
        onNewInquiry={handleNewInquiry}
        onUtilityAction={(a) => {
          if (a === 'settings') setShowSettings(true);
          else if (a === 'notifications') setShowBriefing(true);
          setIsSidebarOpen(false);
        }}
        hasNotifications={hasNewNotifications}
        themeMode={themeMode}
        onThemeChange={(m) => setThemeMode(m)}
        onLegacyLesson={() => { setView('chat'); handleSendMessage(t.legacyPrompt); setIsSidebarOpen(false); }}
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
               <h1 className="font-black text-xs text-neutral-900 dark:text-white uppercase tracking-[0.2em]">Sacred Sanctuary</h1>
               <div className="flex items-center space-x-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] text-scholar-gold opacity-60">
                    {currentSect} • {currentMadhab}
                  </span>
               </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex p-1 bg-white/10 dark:bg-[#1F1F1F] rounded-xl border border-black/5 dark:border-white/5">
               <button onClick={() => handleSectChange('Sunni')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${currentSect === 'Sunni' ? 'bg-scholar-gold text-[#FAFAFA] dark:text-[#121212]' : 'text-scholar-muted hover:text-neutral-900 dark:hover:text-white'}`}>Sunni</button>
               <button onClick={() => handleSectChange('Shia')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${currentSect === 'Shia' ? 'bg-scholar-gold text-[#FAFAFA] dark:text-[#121212]' : 'text-scholar-muted hover:text-neutral-900 dark:hover:text-white'}`}>Shia</button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {view === 'chat' && (
            <ChatInterface 
              lang={lang} setLang={setLang} session={currentActiveSession} isTyping={isTyping} typingText={typingText} error={null} 
              onSendMessage={handleSendMessage} onPerspectiveChange={(s, m) => { handleSectChange(s); setCurrentMadhab(m); }} 
              onFeedback={handleFeedback}
              onStartQuiz={() => {}} onOpenLive={() => setView('live')} currentSect={currentSect} isGuest={!user}
              onPreviewArticle={setActiveArticlePreview}
            />
          )}
          {view === 'quran' && <QuranExplorer lang={lang} onClose={() => setView('chat')} />}
          {view === 'arts' && (
            <SacredArts 
              lang={lang} isPremium={true} onOpenAuth={() => setShowAuthModal(true)} onClose={() => setView('chat')} 
              history={sacredArtsHistory} onSaveArt={saveSacredArt} onRemoveArt={removeSacredArt}
            />
          )}
          {view === 'bookmarks' && <BookmarksLibrary lang={lang} sessions={sessions} onGoToSession={id => { setActiveSessionId(id); setView('chat'); }} onClose={() => setView('chat')} onToggleBookmark={() => {}} />}
          {view === 'live' && <LiveSessionOverlay lang={lang} onClose={() => setView('chat')} sect={currentSect} madhab={currentMadhab} />}
        </div>
      </main>

      {showBriefing && <SpiritualBriefingOverlay lang={lang} setLang={setLang} locationName={locationName} onClose={() => setShowBriefing(false)} onNavigate={(v) => { setView(v); setShowBriefing(false); }} />}
      {showSettings && <SettingsOverlay lang={lang} setLang={setLang} sect={currentSect} setSect={setCurrentSect} madhab={currentMadhab} setMadhab={setCurrentMadhab} themeMode={themeMode} onThemeChange={(m) => setThemeMode(m)} onClose={() => setShowSettings(false)} />}
      {activeQuiz && <QuizOverlay questions={activeQuiz} lang={lang} sect={currentSect} madhab={currentMadhab} userXP={userProgress.xp} onComplete={(s) => { setUserProgress(prev => ({ ...prev, xp: prev.xp + (s * 50) })); setActiveQuiz(null); }} />}
      {activeArticlePreview && <ArticlePreviewOverlay article={activeArticlePreview} lang={lang} onClose={() => setActiveArticlePreview(null)} onExplore={() => { handleSendMessage(activeArticlePreview.title); setActiveArticlePreview(null); }} />}
      {showAuthModal && <AuthScreen lang={lang} onLogin={u => { setUser(u); setShowAuthModal(false); }} onClose={() => setShowAuthModal(false)} />}
    </div>
  );
};

export default App;
