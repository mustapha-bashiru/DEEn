
import React, { useState } from 'react';
import { User } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Language, translations } from '../translations';

interface AuthScreenProps {
  lang: Language;
  onLogin: (user: User) => void;
  onClose: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onClose, lang }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const t = translations[lang];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = {
      id: uuidv4(),
      name: isLogin ? (email.split('@')[0] || 'Student') : name,
      email: email,
      joinedAt: Date.now(),
      progress: {
        xp: 0,
        level: 1,
        streak: 0,
        lastLessonDate: null,
        lastQuizDate: null,
        completedQuizzes: [],
        badges: []
      }
    };
    onLogin(newUser);
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-6 bg-stone-950/80 backdrop-blur-sm animate-fade-in ${lang === 'ar' ? 'font-arabic' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-stone-200 relative">
        <button 
          onClick={onClose}
          className={`absolute ${lang === 'ar' ? 'left-6' : 'right-6'} top-6 z-20 w-10 h-10 rounded-full bg-black/10 hover:bg-black/20 text-white flex items-center justify-center transition-all`}
        >
          <i className="fas fa-times"></i>
        </button>

        <div className="bg-emerald-900 p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
             <i className="fas fa-mosque text-[15rem] rotate-12"></i>
          </div>
          
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/20 shadow-xl transform hover:rotate-6 transition-transform">
              <i className="fas fa-kaaba text-3xl text-emerald-100"></i>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{t.appTitle}</h1>
            <p className="text-emerald-200 text-xs font-bold uppercase tracking-[0.3em] opacity-80">
              {isLogin ? t.authScholarlyEntry : t.authJoinUmmah}
            </p>
          </div>
        </div>

        <div className="p-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">{t.authFullName}</label>
                <div className="relative">
                  <i className={`far fa-user absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-stone-300`}></i>
                  <input 
                    type="text" required value={name} onChange={(e) => setName(e.target.value)}
                    placeholder={lang === 'ar' ? "مثال: أمينة منصور" : "E.g. Amina Mansour"}
                    className={`w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 ${lang === 'ar' ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'} text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all`}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">{t.authEmail}</label>
              <div className="relative">
                <i className={`far fa-envelope absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-stone-300`}></i>
                <input 
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@knowledge.com"
                  className={`w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 ${lang === 'ar' ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'} text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">{t.authPassword}</label>
              <div className="relative">
                <i className={`fas fa-lock absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-stone-300`}></i>
                <input 
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 ${lang === 'ar' ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'} text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all`}
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl py-5 font-bold shadow-xl shadow-emerald-900/20 transform active:scale-95 transition-all mt-4"
            >
              {isLogin ? t.authSignIn : t.authCreateAccount}
            </button>
          </form>

          <div className="mt-10 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-stone-400 text-sm hover:text-emerald-700 transition-colors font-medium"
            >
              {isLogin ? t.authNoAccount : t.authHasAccount}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
