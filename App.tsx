
import React, { useState, useEffect, useCallback } from 'react';
import { Message, ChatSession, Sect, Madhab, User, Attachment, UserProgress, QuizQuestion, ArticleLead, SacredArt, AppView } from './types';
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
import { STORAGE_KEYS, readJson, writeJson } from './config/storage';
import { isAiConfigured } from './config/env';

const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

/**
 * The stored user shape, read once at startup by several state initializers.
 * Only the fields those initializers need are relied on; the rest is whatever an
 * earlier build wrote.
 */
type StoredUser = Partial<User> & { preferredSect?: Sect; preferredMadhab?: Madhab };

const readStoredUser = (): StoredUser | null => readJson<StoredUser | null>(STORAGE_KEYS.user, null);

const makeSession = (userId: string, sect: Sect, madhab: Madhab): ChatSession => ({
  id: generateId(),
  userId,
  title: 'New Inquiry',
  messages: [],
  createdAt: Date.now(),
  sect,
  madhab,
});

/**
 * SebilLogo: "The Path to Enlightenment"
 * Refined design based on user concept:
 * - "Chubbier" road with perspective narrowing.
 * - Markings that follow the curve.
 * - Traditional upward-facing Crescent and Star.
 */
const SebilLogo = ({ className = "w-6 h-6", color = "currentColor" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* The Path (Road) - Perspective tapering from bottom to top */}
    <path 
      d="M30 95C40 70 65 70 55 45C50 35 55 30 70 28" 
      stroke={color} 
      strokeWidth="14" 
      strokeLinecap="round" 
    />
    {/* Road center markings tracing the curve perfectly using dasharray */}
    <path 
      d="M30 95C40 70 65 70 55 45C50 35 55 30 70 28" 
      stroke="white" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeDasharray="4 8"
      opacity="0.6"
    />
    {/* Traditional Islamic Crescent (facing upward) */}
    <path 
      d="M60 16C60 21.5228 64.4772 26 70 26C75.5228 26 80 21.5228 80 16C80 14.2 79.5 12.5 78.6 11.1C79.5 12.5 80 14.2 80 16C80 21.5228 75.5228 26 70 26C64.4772 26 60 21.5228 60 16C60 14.2 60.5 12.5 61.4 11.1C60.5 12.5 60 14.2 60 16ZM70 4C70 4 67 9 67 13C67 14.6569 68.3431 16 70 16C71.6569 16 73 14.6569 73 13C73 9 70 4 70 4Z" 
      fill={color} 
      style={{ transform: 'translateY(-2px)' }}
    />
    <path 
      d="M70 22C61.1634 22 54 14.8366 54 6C54 4.5 54.2 3.1 54.6 1.7C50.6 3.9 48 8.1 48 13C48 20.732 54.268 27 62 27C67.3 27 71.9 24 74.2 19.6C72.9 21.1 71.3 22.3 69.5 23.1L70 22Z" 
      fill={color} 
      transform="rotate(-90 70 15) translate(0, -5)"
    />
    {/* Standard 5-pointed star */}
    <path 
      d="M70 4L71 7H74L71.5 8.5L72.5 11.5L70 9.5L67.5 11.5L68.5 8.5L66 7H69L70 4Z" 
      fill={color} 
    />
  </svg>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => readJson<User | null>(STORAGE_KEYS.user, null));

  /*
   * Seeded with a session rather than an empty array. The old code started empty
   * and created the first session from an effect, which meant an extra render
   * pass on every cold start and a setState-inside-effect cascade. Deriving it
   * here means the app is never in a "no session" state.
   */
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const stored = readJson<ChatSession[]>(STORAGE_KEYS.sessions, []);
    if (Array.isArray(stored) && stored.length > 0) return stored;
    const storedUser = readStoredUser();
    return [
      makeSession(
        storedUser?.id ?? 'guest',
        storedUser?.preferredSect ?? 'Sunni',
        storedUser?.preferredMadhab ?? 'General',
      ),
    ];
  });

  const [sacredArtsHistory, setSacredArtsHistory] = useState<SacredArt[]>(() =>
    readJson<SacredArt[]>(STORAGE_KEYS.arts, []),
  );

  // Depends on `sessions` above: state initializers run in declaration order on
  // the first render, so `sessions` is already populated here. A stored id that
  // no longer matches a session is discarded rather than left dangling.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.activeSessionId);
    if (stored && sessions.some((s) => s.id === stored)) return stored;
    return sessions[0]?.id ?? null;
  });

  const [currentSect, setCurrentSect] = useState<Sect>(
    () => readStoredUser()?.preferredSect ?? 'Sunni',
  );

  const [currentMadhab, setCurrentMadhab] = useState<Madhab>(
    () => readStoredUser()?.preferredMadhab ?? 'General',
  );

  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem(STORAGE_KEYS.lang) as Language) || 'en';
  });
  
  // Seeded from capability detection so refreshLocation never has to report the
  // "geolocation missing entirely" case with a synchronous setState.
  const [locationName, setLocationName] = useState<string | null>(() =>
    'geolocation' in navigator ? null : 'Geo access blocked',
  );
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  });

  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("Loading...");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('chat');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBriefing, setShowBriefing] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<QuizQuestion[] | null>(null);
  const [activeArticlePreview, setActiveArticlePreview] = useState<ArticleLead | null>(null);

  const DEFAULT_PROGRESS: UserProgress = {
    xp: 0, level: 1, streak: 0, lastLessonDate: null, lastQuizDate: null, completedQuizzes: [], badges: []
  };
  const [userProgress, setUserProgress] = useState<UserProgress>(() =>
    readJson<UserProgress>(STORAGE_KEYS.progress, DEFAULT_PROGRESS),
  );

  const t = translations[lang];

  // Read once per render: the value is a build-time constant, not reactive state.
  const aiConfigured = isAiConfigured();

  const handleSectChange = useCallback((sect: Sect) => {
    setCurrentSect(sect);
    if (user) {
      const updatedUser = { ...user, preferredSect: sect };
      setUser(updatedUser);
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updatedUser));
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.lang, lang);
  }, [lang]);

  // These three were read on startup but never written, so chats, generated art,
  // and the selected session were silently lost on every reload.
  useEffect(() => {
    writeJson(STORAGE_KEYS.sessions, sessions);
  }, [sessions]);

  useEffect(() => {
    writeJson(STORAGE_KEYS.arts, sacredArtsHistory);
  }, [sacredArtsHistory]);

  useEffect(() => {
    if (activeSessionId) localStorage.setItem(STORAGE_KEYS.activeSessionId, activeSessionId);
    else localStorage.removeItem(STORAGE_KEYS.activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(userProgress));
  }, [userProgress]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.theme, themeMode);
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

  /*
   * Every state write below happens in one of getCurrentPosition's callbacks, so
   * the effect that calls this never sets state synchronously. The "no API at
   * all" case is folded into locationName's initial value instead.
   */
  const refreshLocation = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const name = await detectLocationName(pos.coords.latitude, pos.coords.longitude);
        setLocationName(name);
      },
      (error) => {
        // Covers permission denied, position unavailable, and timeout.
        console.warn('SebilLink: could not resolve location.', error.message);
        setLocationName("Geo access blocked");
      },
      { timeout: 10_000 },
    );
  }, []);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  const createNewSession = useCallback((sect: Sect = currentSect, madhab: Madhab = currentMadhab) => {
    const newSession = makeSession(user?.id || 'guest', sect, madhab);
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    return newSession;
  }, [currentSect, currentMadhab, user?.id]);

  const handleSendMessage = async (content: string, attachments?: Attachment[]) => {
    setError(null);
    setView('chat'); 
    let activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) activeSession = createNewSession();

    const isLegacyRequest = content === t.legacyPrompt;
    const todayStr = new Date().toDateString();

    if (isLegacyRequest) {
      const cachedLegacy = localStorage.getItem(STORAGE_KEYS.dailyLegacy);
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
    
    const history = activeSession.messages.map(m => ({
      role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
      parts: [{ text: m.content || "" }]
    }));

    setSessions(prev => prev.map(s => s.id === targetId ? { ...s, messages: updatedMessages } : s));

    setIsTyping(true);
    setTypingText("Consulting digital sanctuary...");
    try {
      const res = await queryAdDeen(content, activeSession.sect, activeSession.madhab, history, attachments?.[0]);
      const assistantMessage: Message = { 
        id: generateId(), role: 'assistant', content: res.text || "", timestamp: Date.now(), 
        sources: res.sources, suggestions: res.suggestions, isLegacyLesson: res.isLegacyLesson
      };
      
      setSessions(prev => prev.map(s => s.id === targetId ? { ...s, messages: [...updatedMessages, assistantMessage] } : s));

      if (res.isLegacyLesson) {
        setTypingText("Preparing knowledge check...");
        const quiz = await generateLessonQuiz(res.text, activeSession.sect, activeSession.madhab);
        
        localStorage.setItem(STORAGE_KEYS.dailyLegacy, JSON.stringify({
          date: todayStr,
          lesson: res.text,
          quiz: quiz
        }));

        if (userProgress.lastQuizDate !== todayStr) {
          setActiveQuiz(quiz);
        }
      }
    } catch (err) {
      console.error('SebilLink: inquiry failed.', err);
      setError("The scholarly servers are currently busy. Please try again soon.");
    } finally { setIsTyping(false); }
  };

  // `_total` is part of QuizOverlay's callback contract; XP is awarded per correct
  // answer, so the question count is not needed here.
  const handleQuizComplete = (score: number, _total: number) => {
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
            <div className="flex items-center space-x-3">
              <SebilLogo className="w-8 h-8" color="var(--primary-color)" />
              <div className="flex flex-col">
                <h1 className="font-black text-xs text-neutral-900 dark:text-white uppercase tracking-[0.2em]">SebilLink</h1>
                <span className="text-[8px] font-black uppercase tracking-widest text-scholar-gold opacity-60">Sacred Sanctuary</span>
              </div>
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

        {!aiConfigured && (
          <div
            role="alert"
            className="mx-8 mt-4 flex items-center gap-3 px-5 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl"
          >
            <i className="fas fa-triangle-exclamation text-amber-500" aria-hidden="true" />
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
              GEMINI_API_KEY is not set — AI features are unavailable. Add it to .env.local.
            </p>
          </div>
        )}

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
