
import React, { useState } from 'react';
import { User } from '../types';
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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const t = translations[lang];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const displayName = isLogin ? (email.split('@')[0] || 'Student') : (name || 'Seeker');
    
    const newUser: User = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7),
      name: displayName,
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
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-6 bg-stone-950/80 backdrop-blur-md animate-fade-in ${lang === 'ar' ? 'font-arabic' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
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
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-xl transform hover:rotate-6 transition-transform">
              <i className="fas fa-kaaba text-2xl text-emerald-100"></i>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">{t.appTitle}</h1>
            <p className="text-emerald-200 text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
              {isLogin ? t.authScholarlyEntry : t.authJoinUmmah}
            </p>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">{t.authFullName}</label>
                <div className="relative">
                  <i className={`far fa-user absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-stone-300`}></i>
                  <input 
                    type="text" required={!isLogin} value={name} onChange={(e) => setName(e.target.value)}
                    placeholder={lang === 'ar' ? "مثال: أمينة منصور" : "E.g. Amina Mansour"}
                    className={`w-full bg-stone-50 border border-stone-200 rounded-2xl py-3.5 ${lang === 'ar' ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'} text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all`}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">{t.authEmail}</label>
              <div className="relative">
                <i className={`far fa-envelope absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-stone-300`}></i>
                <input 
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@knowledge.com"
                  className={`w-full bg-stone-50 border border-stone-200 rounded-2xl py-3.5 ${lang === 'ar' ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'} text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">{t.authPassword}</label>
              <div className="relative">
                <i className={`fas fa-lock absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-stone-300`}></i>
                <input 
                  type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full bg-stone-50 border border-stone-200 rounded-2xl py-3.5 ${lang === 'ar' ? 'pr-12 pl-24 text-right' : 'pl-12 pr-24 text-left'} text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all`}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute ${lang === 'ar' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-800 transition-colors tracking-widest`}
                >
                  {showPassword ? t.authHidePassword : t.authShowPassword}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center space-x-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={rememberMe} 
                  onChange={(e) => setRememberMe(e.target.checked)} 
                  className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                />
                <span className={`text-xs font-medium text-stone-500 group-hover:text-stone-700 transition-colors ${lang === 'ar' ? 'mr-2' : ''}`}>
                  {t.authRememberMe}
                </span>
              </label>
            </div>

            <button 
              type="submit"
              className="w-full bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl py-4 font-bold shadow-xl shadow-emerald-900/20 transform active:scale-95 transition-all mt-4"
            >
              {isLogin ? t.authSignIn : t.authCreateAccount}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-stone-400 text-xs hover:text-emerald-700 transition-colors font-medium"
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
