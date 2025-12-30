
import React, { useState, useEffect } from 'react';
import { Message, ChatSession, Sect, Madhab, User } from './types';
import { queryAdDeen } from './services/geminiService';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import BookmarksLibrary from './components/BookmarksLibrary';
import AuthScreen from './components/AuthScreen';
import { v4 as uuidv4 } from 'uuid';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentSect, setCurrentSect] = useState<Sect>('Sunni');
  const [currentMadhab, setCurrentMadhab] = useState<Madhab>('General');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'bookmarks'>('chat');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Load User from storage
  useEffect(() => {
    const savedUser = localStorage.getItem('deeniya_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Load Sessions when user changes (Guest or Authenticated)
  useEffect(() => {
    const storageKey = user ? `deeniya_sessions_${user.id}` : 'deeniya_sessions_guest';
    const lastActiveKey = user ? `deeniya_last_active_${user.id}` : 'deeniya_last_active_guest';
    
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) {
          const lastActiveId = localStorage.getItem(lastActiveKey);
          const sessionToActivate = parsed.find((s: any) => s.id === lastActiveId) || parsed[0];
          setActiveSessionId(sessionToActivate.id);
          setCurrentSect(sessionToActivate.sect || 'Sunni');
          setCurrentMadhab(sessionToActivate.madhab || 'General');
        } else {
          createNewSession('Sunni', 'General');
        }
      } catch (e) {
        createNewSession('Sunni', 'General');
      }
    } else {
      createNewSession('Sunni', 'General');
    }
  }, [user]);

  // Persist sessions
  useEffect(() => {
    const storageKey = user ? `deeniya_sessions_${user.id}` : 'deeniya_sessions_guest';
    const lastActiveKey = user ? `deeniya_last_active_${user.id}` : 'deeniya_last_active_guest';

    if (sessions.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
    }
    if (activeSessionId) {
      localStorage.setItem(lastActiveKey, activeSessionId);
    }
  }, [sessions, activeSessionId, user]);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('deeniya_user', JSON.stringify(newUser));
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('deeniya_user');
  };

  const createNewSession = (sect: Sect = currentSect, madhab: Madhab = currentMadhab) => {
    const newSession: ChatSession = {
      id: uuidv4(),
      userId: user?.id || 'guest',
      title: 'New Inquiry',
      messages: [],
      createdAt: Date.now(),
      sect,
      madhab,
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setCurrentSect(sect);
    setCurrentMadhab(madhab);
    setView('chat');
  };

  const handleSendMessage = async (content: string) => {
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const isFirstMessage = s.messages.length === 0;
        return {
          ...s,
          title: isFirstMessage ? content.substring(0, 40).trim() + (content.length > 40 ? '...' : '') : s.title,
          messages: [...s.messages, userMessage]
        };
      }
      return s;
    }));

    setIsTyping(true);
    setError(null);

    try {
      const history = activeSession.messages.map(m => ({
        role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
        parts: [{ text: m.content }]
      })) || [];

      const { text, sources } = await queryAdDeen(content, activeSession.sect, activeSession.madhab, history);

      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: text,
        timestamp: Date.now(),
        sources,
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, assistantMessage] };
        }
        return s;
      }));
    } catch (err) {
      setError("I apologize, I encountered an error while consulting the sources.");
    } finally {
      setIsTyping(false);
    }
  };

  const deleteSession = (id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (activeSessionId === id) {
        const nextSession = filtered.length > 0 ? filtered[0] : null;
        setActiveSessionId(nextSession ? nextSession.id : null);
        if (nextSession) {
          setCurrentSect(nextSession.sect);
          setCurrentMadhab(nextSession.madhab);
        }
      }
      return filtered;
    });
    if (sessions.length === 1 && sessions[0].id === id) {
      setTimeout(() => createNewSession(), 0);
    }
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setView('chat');
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentSect(session.sect);
      setCurrentMadhab(session.madhab);
    }
  };

  const handlePerspectiveChange = (newSect: Sect, newMadhab: Madhab) => {
    setCurrentSect(newSect);
    setCurrentMadhab(newMadhab);
    
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (activeSession && activeSession.messages.length === 0) {
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, sect: newSect, madhab: newMadhab } : s));
    } else {
      createNewSession(newSect, newMadhab);
    }
  };

  const toggleBookmark = (sessionId: string, messageId: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { 
      ...s, 
      messages: s.messages.map(m => m.id === messageId ? { ...m, isBookmarked: !m.isBookmarked } : m) 
    } : s));
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const sunniSchools: Madhab[] = ['General', 'Hanafi', 'Maliki', 'Shafi\'i', 'Hanbali'];
  const shiaSchools: Madhab[] = ['General', 'Usuli', 'Akhbari'];

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden font-sans relative">
      <Sidebar 
        user={user}
        onLogout={handleLogout}
        onOpenAuth={() => setShowAuthModal(true)}
        sessions={sessions} 
        activeSessionId={activeSessionId} 
        onSelectSession={handleSelectSession} 
        onNewSession={() => createNewSession(currentSect, currentMadhab)}
        onDeleteSession={deleteSession}
        onShowBookmarks={() => setView('bookmarks')}
        activeView={view}
      />
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 md:px-8 py-4 flex flex-col lg:flex-row items-center justify-between sticky top-0 z-40 shadow-sm gap-4">
          <div className="flex items-center space-x-4 self-start lg:self-center">
            <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center text-white shadow-lg transition-all duration-500 transform hover:rotate-12 ${currentSect === 'Sunni' ? 'bg-emerald-800' : 'bg-teal-800'}`}>
              <i className={`fas ${currentSect === 'Sunni' ? 'fa-mosque' : 'fa-kaaba'} text-xl`}></i>
            </div>
            <button onClick={() => setView('chat')} className="text-left group focus:outline-none">
              <h1 className="font-black text-xl text-stone-900 leading-none group-hover:text-emerald-800 transition-colors">Deeniya al-Islam</h1>
              <p className="text-[10px] text-stone-500 font-black uppercase tracking-[0.2em] mt-1.5 opacity-70">Scholarly AI Assistant</p>
            </button>
          </div>

          {view === 'chat' && (
            <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto animate-fade-in">
              <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 w-full md:w-auto shadow-inner">
                {(['Sunni', 'Shia'] as Sect[]).map((s) => (
                  <button 
                    key={s}
                    onClick={() => handlePerspectiveChange(s, 'General')}
                    className={`flex-1 md:flex-none px-5 py-2 rounded-lg text-[10px] font-black transition-all duration-300 ${
                      currentSect === s ? 'bg-white shadow-md text-stone-900' : 'text-stone-400 hover:text-stone-600'
                    }`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className={`flex items-center p-1 rounded-xl border w-full md:w-auto transition-all duration-500 shadow-sm ${
                currentSect === 'Sunni' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-teal-50/50 border-teal-100'
              }`}>
                {(currentSect === 'Sunni' ? sunniSchools : shiaSchools).map((m) => (
                  <button 
                    key={m}
                    onClick={() => handlePerspectiveChange(currentSect, m)}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[9px] font-black transition-all duration-300 ${
                      currentMadhab === m 
                        ? (currentSect === 'Sunni' ? 'bg-emerald-800' : 'bg-teal-800') + ' text-white shadow-lg scale-105' 
                        : (currentSect === 'Sunni' ? 'text-emerald-800/60 hover:text-emerald-800 hover:bg-emerald-100/50' : 'text-teal-800/60 hover:text-teal-800 hover:bg-teal-100/50')
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        {view === 'chat' ? (
          <ChatInterface 
            session={activeSession || null}
            isTyping={isTyping}
            error={error}
            onSendMessage={handleSendMessage}
            onToggleBookmark={(mid) => activeSessionId && toggleBookmark(activeSessionId, mid)}
          />
        ) : (
          <BookmarksLibrary 
            sessions={sessions}
            onToggleBookmark={toggleBookmark}
            onGoToSession={handleSelectSession}
            onClose={() => setView('chat')}
          />
        )}
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthScreen 
          onLogin={handleLogin} 
          onClose={() => setShowAuthModal(false)} 
        />
      )}
    </div>
  );
};

export default App;
