
import React, { useState, useEffect } from 'react';
import { Message, ChatSession, Sect, Madhab, User, Attachment, UserProgress, QuizQuestion } from './types';
import { queryAdDeen, generateSacredArt, generateLessonQuiz } from './services/geminiService';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import BookmarksLibrary from './components/BookmarksLibrary';
import AuthScreen from './components/AuthScreen';
import QuranExplorer from './components/QuranExplorer';
import SacredArts from './components/SacredArts';
import DiscoveryOverlay from './components/DiscoveryOverlay';
import QuizOverlay from './components/QuizOverlay';
import LiveSessionOverlay from './components/LiveSessionOverlay';
import { v4 as uuidv4 } from 'uuid';
import { Language, translations } from './translations';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('sanctuary_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentSect, setCurrentSect] = useState<Sect>('Sunni');
  const [currentMadhab, setCurrentMadhab] = useState<Madhab>('General');
  const [lang, setLang] = useState<Language>('en');
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("Consulting records...");
  const [view, setView] = useState<'chat' | 'bookmarks' | 'quran' | 'arts' | 'live'>('chat');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [activeQuiz, setActiveQuiz] = useState<QuizQuestion[] | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress>(() => {
    const saved = localStorage.getItem('user_progress_sanctuary');
    return saved ? JSON.parse(saved) : {
      xp: 0,
      level: 1,
      streak: 0,
      lastLessonDate: null,
      lastQuizDate: null,
      completedQuizzes: [],
      badges: []
    };
  });

  const t = translations[lang];

  useEffect(() => {
    localStorage.setItem('user_progress_sanctuary', JSON.stringify(userProgress));
  }, [userProgress]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('sanctuary_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('sanctuary_user');
    }
  }, [user]);

  useEffect(() => {
    const hasSeenDiscovery = sessionStorage.getItem('hasSeenDiscovery');
    if (!hasSeenDiscovery) {
      const timer = setTimeout(() => {
        setShowDiscovery(true);
        sessionStorage.setItem('hasSeenDiscovery', 'true');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const isToday = (timestamp: number | null) => {
    if (!timestamp) return false;
    const today = new Date().toDateString();
    const target = new Date(timestamp).toDateString();
    return today === target;
  };

  const createNewSession = (sect: Sect = currentSect, madhab: Madhab = currentMadhab) => {
    const newSession: ChatSession = { 
      id: uuidv4(), 
      userId: user?.id || 'guest', 
      title: lang === 'ar' ? 'استفسار جديد' : 'New Inquiry', 
      messages: [], 
      createdAt: Date.now(), 
      sect, 
      madhab 
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setIsSidebarOpen(false);
    return newSession;
  };

  useEffect(() => { 
    if (sessions.length === 0) createNewSession(); 
  }, []);

  const handleSendMessage = async (content: string, attachment?: Attachment) => {
    if (!user && content !== t.legacyPrompt) {
      setShowAuthModal(true);
      return;
    }

    if (content === t.legacyPrompt && isToday(userProgress.lastLessonDate)) {
      alert(t.dailyLessonLimit);
      return;
    }

    let activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) activeSession = createNewSession();

    const userMessage: Message = { 
      id: uuidv4(), 
      role: 'user', 
      content: content || "", 
      timestamp: Date.now(), 
      attachments: attachment ? [attachment] : [] 
    };

    const targetId = activeSession.id;
    setSessions(prev => prev.map(s => 
      s.id === targetId ? { ...s, title: s.messages.length === 0 ? content.substring(0, 40) : s.title, messages: [...s.messages, userMessage] } : s
    ));

    setIsTyping(true);
    setTypingText(lang === 'ar' ? 'جاري استشارة السجلات...' : "Consulting records...");
    try {
      const history = activeSession.messages.map(m => ({
        role: (m.role === 'user' ? 'user' : 'model') as any,
        parts: [
          ...(m.attachments || []).map(a => ({ inlineData: { mimeType: a.mimeType, data: a.data } })),
          { text: m.content || "" }
        ]
      }));
      
      const languageHint = lang === 'ar' ? "\n\nIMPORTANT: Please respond in Arabic." : "\n\nIMPORTANT: Please respond in English.";
      const res = await queryAdDeen((content || "Analyze the attached file.") + languageHint, activeSession.sect, activeSession.madhab, history, attachment);
      
      const assistantMessage: Message = { 
        id: uuidv4(), 
        role: 'assistant', 
        content: res.text || "", 
        timestamp: Date.now(), 
        sources: res.sources, 
        suggestions: res.suggestions, 
        visuals: res.visuals,
        resources: res.resources, 
        articleLeads: res.articleLeads,
        isLegacyLesson: res.isLegacyLesson
      };

      setSessions(prev => prev.map(s => s.id === targetId ? { ...s, messages: [...s.messages, assistantMessage] } : s));
      if (res.isLegacyLesson) updateProgress(10, 'lesson'); 

    } catch (err) { console.error(err); } finally { setIsTyping(false); }
  };

  const handleStartQuiz = async () => {
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;
    
    const lastLesson = session.messages.slice().reverse().find(m => m.isLegacyLesson);
    if (lastLesson) {
      setIsTyping(true);
      setTypingText(lang === 'ar' ? 'جاري تحضير الاختبار...' : "Preparing Scholarly Challenge...");
      try {
        const quiz = await generateLessonQuiz(lastLesson.content, session.sect, session.madhab);
        setActiveQuiz(quiz);
      } catch (e) {
        console.error("Quiz Error", e);
      } finally {
        setIsTyping(false);
      }
    }
  };

  const updateProgress = (xpGain: number, type?: 'lesson' | 'quiz') => {
    setUserProgress(prev => {
      const newXp = prev.xp + xpGain;
      return { ...prev, xp: newXp, level: Math.floor(newXp / 100) + 1, lastLessonDate: type === 'lesson' ? Date.now() : prev.lastLessonDate, lastQuizDate: type === 'quiz' ? Date.now() : prev.lastQuizDate };
    });
  };

  const handlePerspectiveChange = (sect: Sect, madhab: Madhab) => {
    setCurrentSect(sect);
    setCurrentMadhab(madhab);
    if (activeSessionId) {
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, sect, madhab } : s));
    }
  };

  return (
    <div className={`flex h-screen bg-stone-100 overflow-hidden ${lang === 'ar' ? 'font-arabic' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-[70] md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <Sidebar 
        lang={lang} user={user ? { ...user, progress: userProgress } : null} progress={userProgress} onLogout={() => setUser(null)}
        onOpenAuth={() => setShowAuthModal(true)} onOpenLegacy={() => { setView('chat'); handleSendMessage(t.legacyPrompt); }}
        sessions={sessions} activeSessionId={activeSessionId} 
        onSelectSession={(id) => { setActiveSessionId(id); setView('chat'); setIsSidebarOpen(false); }}
        onNewSession={() => createNewSession()} onDeleteSession={() => {}}
        onShowBookmarks={() => { setView('bookmarks'); setIsSidebarOpen(false); }}
        onShowQuran={() => { setView('quran'); setIsSidebarOpen(false); }}
        onShowArts={() => { setView('arts'); setIsSidebarOpen(false); }} 
        onOpenLive={() => setView('live')}
        onShowDiscovery={() => setShowDiscovery(true)}
        onOpenMap={() => { setView('chat'); handleSendMessage(lang === 'ar' ? "ابحث عن أقرب المساجد والمطاعم الحلال حولي" : "Find nearby mosques and halal food around me."); setIsSidebarOpen(false); }}
        activeView={view}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/90 backdrop-blur-md border-b border-stone-200 px-8 py-4 flex items-center justify-between z-40">
          <div className="flex items-center space-x-6 space-x-reverse">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2"><i className="fas fa-bars"></i></button>
            <div className="flex flex-col">
               <h1 className="font-bold text-lg leading-tight">{t.appTitle}</h1>
               <div className="flex items-center space-x-2 space-x-reverse mt-0.5">
                  <div className="flex p-0.5 bg-stone-100 rounded border border-stone-200">
                    <button onClick={() => setLang('en')} className={`px-2 py-0.5 rounded text-[8px] font-black ${lang === 'en' ? 'bg-white text-emerald-900 shadow-sm' : 'text-stone-400'}`}>EN</button>
                    <button onClick={() => setLang('ar')} className={`px-2 py-0.5 rounded text-[8px] font-black ${lang === 'ar' ? 'bg-white text-emerald-900 shadow-sm' : 'text-stone-400'}`}>AR</button>
                  </div>
                  <span className="text-[8px] font-black text-stone-300">|</span>
                  <div className="flex p-0.5 bg-stone-100 rounded border border-stone-200">
                    <button onClick={() => handlePerspectiveChange('Sunni', 'General')} className={`px-2 py-0.5 rounded text-[8px] font-black ${currentSect === 'Sunni' ? 'bg-white text-emerald-900 shadow-sm' : 'text-stone-400'}`}>{t.sunni}</button>
                    <button onClick={() => handlePerspectiveChange('Shia', 'General')} className={`px-2 py-0.5 rounded text-[8px] font-black ${currentSect === 'Shia' ? 'bg-white text-teal-900 shadow-sm' : 'text-stone-400'}`}>{t.shia}</button>
                  </div>
               </div>
            </div>
          </div>
          <button onClick={() => setView('live')} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 hover:scale-105 active:scale-95 transition-all">
            <i className={`fas fa-tower-broadcast ${lang === 'ar' ? 'ml-2' : 'mr-2'}`}></i> {t.liveJoinBtn}
          </button>
        </header>
        {view === 'chat' && (
          <ChatInterface 
            lang={lang} 
            session={sessions.find(s => s.id === activeSessionId) || null} 
            isTyping={isTyping} 
            typingText={typingText} 
            error={null} 
            onSendMessage={handleSendMessage} 
            onToggleBookmark={() => {}} 
            onPerspectiveChange={handlePerspectiveChange} 
            onStartQuiz={handleStartQuiz}
          />
        )}
        {view === 'quran' && <QuranExplorer lang={lang} onClose={() => setView('chat')} onAskAboutVerse={v => handleSendMessage(`Explain ${v.surahName} ${v.surahNumber}:${v.ayahNumber}`)} isPremium={true} onOpenAuth={() => {}} />}
        {view === 'arts' && <SacredArts lang={lang} isPremium={true} onOpenAuth={() => {}} onClose={() => setView('chat')} />}
        {view === 'bookmarks' && <BookmarksLibrary lang={lang} sessions={sessions} onToggleBookmark={() => {}} onGoToSession={id => { setActiveSessionId(id); setView('chat'); }} onClose={() => setView('chat')} />}
      </main>
      
      {view === 'live' && <LiveSessionOverlay lang={lang} onClose={() => setView('chat')} sect={currentSect} madhab={currentMadhab} />}
      {activeQuiz && <QuizOverlay questions={activeQuiz} lang={lang} sect={currentSect} madhab={currentMadhab} onComplete={(s, t) => { updateProgress(s * 20 + 50, 'quiz'); setActiveQuiz(null); }} />}
      {showDiscovery && <DiscoveryOverlay lang={lang} isPremium={true} onOpenAuth={() => {}} onNavigate={(v, p) => { setView(v); if(p) handleSendMessage(p); }} onClose={() => setShowDiscovery(false)} />}
      {showAuthModal && <AuthScreen lang={lang} onLogin={u => { setUser(u); setShowAuthModal(false); }} onClose={() => setShowAuthModal(false)} />}
    </div>
  );
};

export default App;
