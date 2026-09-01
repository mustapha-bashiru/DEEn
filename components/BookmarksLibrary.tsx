
import React from 'react';
import { ChatSession } from '../types';
import { Language, translations } from '../translations';

interface BookmarksLibraryProps {
  lang: Language;
  sessions: ChatSession[];
  onToggleBookmark: (sessionId: string, messageId: string) => void;
  onGoToSession: (sessionId: string) => void;
  onClose: () => void;
}

const BookmarksLibrary: React.FC<BookmarksLibraryProps> = ({ sessions, onToggleBookmark, onGoToSession, onClose, lang }) => {
  const t = translations[lang];
  
  const allBookmarks = sessions.flatMap(s => 
    s.messages
      .filter(m => m.isBookmarked)
      .map(m => ({ ...m, sessionId: s.id, sessionTitle: s.title, sect: s.sect, madhab: s.madhab }))
  ).sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-50 overflow-hidden animate-fade-in">
      <header className="px-6 py-6 bg-white border-b border-stone-200 flex items-center justify-between shadow-sm">
        <div className={`flex items-center ${lang === 'ar' ? 'space-x-reverse' : ''} space-x-4`}>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shadow-sm">
            <i className="fas fa-bookmark text-xl"></i>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">{t.bookmarksTitle}</h2>
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mt-1">{t.bookmarksSub}</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-stone-600"
        >
          <i className="fas fa-times text-xl"></i>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {allBookmarks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
            <i className="fas fa-scroll text-6xl mb-6 text-stone-300"></i>
            <h3 className="text-xl font-semibold text-stone-800">{t.bookmarksEmptyTitle}</h3>
            <p className="text-sm text-stone-500 max-w-xs mt-2">{t.bookmarksEmptySub}</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {allBookmarks.map((bookmark) => (
              <div 
                key={bookmark.id} 
                className={`bg-white border border-stone-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all ${lang === 'ar' ? 'border-r-4' : 'border-l-4'} ${
                  bookmark.sect === 'Sunni' ? 'border-emerald-600' : 'border-teal-600'
                }`}
              >
                <div className={`flex items-center justify-between mb-4 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center ${lang === 'ar' ? 'space-x-reverse' : ''} space-x-2`}>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter ${
                      bookmark.sect === 'Sunni' ? 'bg-emerald-50 text-emerald-700' : 'bg-teal-50 text-teal-700'
                    }`}>
                      {bookmark.sect} • {bookmark.madhab}
                    </span>
                    <span className="text-[10px] text-stone-400 font-medium">
                      {new Date(bookmark.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={`flex items-center ${lang === 'ar' ? 'space-x-reverse' : ''} space-x-2`}>
                    <button 
                      onClick={() => onGoToSession(bookmark.sessionId)}
                      className="text-[11px] font-bold text-stone-400 hover:text-stone-700 flex items-center px-3 py-1 transition-colors"
                    >
                      <i className={`fas ${lang === 'ar' ? 'fa-arrow-left ml-2' : 'fa-arrow-right mr-2'}`}></i> {t.bookmarksViewSession}
                    </button>
                    <button 
                      onClick={() => onToggleBookmark(bookmark.sessionId, bookmark.id)}
                      className="p-2 text-amber-500 hover:bg-amber-50 rounded-full transition-colors"
                    >
                      <i className="fas fa-bookmark text-lg"></i>
                    </button>
                  </div>
                </div>
                
                <div className="prose prose-stone max-w-none text-stone-700 text-sm leading-relaxed whitespace-pre-wrap mb-4">
                  {bookmark.content}
                </div>

                {bookmark.sources && bookmark.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-stone-50">
                    {bookmark.sources.map((s, idx) => (
                      <span key={idx} className="text-[10px] bg-stone-50 text-stone-500 px-2 py-1 rounded-md border border-stone-100">
                        {s.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookmarksLibrary;
