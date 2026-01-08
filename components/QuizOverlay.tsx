
import React, { useState, useEffect } from 'react';
import { QuizQuestion, Sect, Madhab } from '../types';
import { Language, translations } from '../translations';
import { getAIGradingFeedback } from '../services/geminiService';

interface QuizOverlayProps {
  questions: QuizQuestion[];
  onComplete: (score: number, total: number) => void;
  lang: Language;
  sect: Sect;
  madhab: Madhab;
  userXP: number;
}

const QUESTION_TIME_SECONDS = 20;
const XP_PER_LEVEL = 1750;

const levelBadges = [
  { icon: 'fa-feather', label: 'Novice Seeker', color: 'text-amber-600', minLevel: 1 },
  { icon: 'fa-scroll', label: 'Diligent Student', color: 'text-emerald-600', minLevel: 6 },
  { icon: 'fa-book-open', label: 'Knowledge Guardian', color: 'text-blue-600', minLevel: 11 },
  { icon: 'fa-kaaba', label: 'Scholar of Sanctuary', color: 'text-purple-600', minLevel: 21 }
];

const QuizOverlay: React.FC<QuizOverlayProps> = ({ questions, onComplete, lang, sect, madhab, userXP }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SECONDS);

  const t = translations[lang];
  const current = questions[currentIdx];

  useEffect(() => {
    if (showResult) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSelect("TIMEOUT");
          return QUESTION_TIME_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentIdx, showResult]);

  const handleSelect = (option: string) => {
    const newAnswers = [...answers, option];
    setAnswers(newAnswers);
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setTimeLeft(QUESTION_TIME_SECONDS);
    } else {
      finishQuiz(newAnswers);
    }
  };

  const finishQuiz = async (finalAnswers: string[]) => {
    setShowResult(true);
    let score = 0;
    questions.forEach((q, i) => { if (q.correctAnswer === finalAnswers[i]) score++; });
    try {
      const fb = await getAIGradingFeedback(score, questions.length, finalAnswers, questions.map(q => q.correctAnswer), sect, madhab);
      setFeedback(fb);
    } catch (e) { setFeedback("May Allah increase your knowledge."); }
  };

  const score = answers.reduce((acc, ans, i) => acc + (ans === questions[i].correctAnswer ? 1 : 0), 0);
  const currentLevel = Math.floor(userXP / XP_PER_LEVEL) + 1;
  const earnedBadge = levelBadges.slice().reverse().find(b => currentLevel >= b.minLevel) || levelBadges[0];

  const questionText = current?.text || (current as any)?.question || "Knowledge challenge loading...";

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-stone-950/90 backdrop-blur-xl animate-fade-in">
      <div className="max-w-xl w-full bg-white rounded-[3rem] shadow-2xl overflow-hidden border">
        {!showResult ? (
          <div className="p-10 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Question {currentIdx + 1} of {questions.length}</span>
                <span className="text-[10px] font-bold text-emerald-600">Level {currentLevel} • {userXP % XP_PER_LEVEL}/{XP_PER_LEVEL} XP to next level</span>
              </div>
              <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center transition-colors ${timeLeft < 5 ? 'border-red-500 text-red-500 animate-pulse' : 'border-emerald-100 text-emerald-600'}`}>
                <span className="text-sm font-black">{timeLeft}s</span>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-stone-900 leading-tight">
              {questionText}
            </h3>

            <div className="space-y-3">
              {current?.options.map((opt, i) => (
                <button key={i} onClick={() => handleSelect(opt)} className="w-full p-5 text-left bg-stone-50 border border-stone-100 rounded-2xl hover:border-emerald-600 hover:bg-emerald-50 transition-all text-sm font-medium flex items-center group">
                  <span className="w-8 h-8 rounded-lg bg-white border border-stone-200 mr-4 flex items-center justify-center text-[10px] font-bold group-hover:border-emerald-300">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center space-y-8 animate-fade-in">
            <div className={`w-28 h-28 bg-stone-50 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-xl ${earnedBadge.color}`}>
               <i className={`fas ${earnedBadge.icon} text-5xl`}></i>
            </div>
            
            <div>
              <h2 className="text-3xl font-black text-stone-900">Academic Review</h2>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-2">{earnedBadge.label} Unlocked</p>
              
              <div className="flex justify-center space-x-12 mt-8">
                <div className="text-center">
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Score</p>
                  <p className="text-3xl font-bold text-emerald-800">{score}/{questions.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">XP Reward</p>
                  <p className="text-3xl font-bold text-amber-600">+{score * 25}</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-stone-50 rounded-3xl border text-sm italic text-stone-600 leading-relaxed max-h-40 overflow-y-auto">
               {feedback || "Calculating scholarly results..."}
            </div>

            <button onClick={() => onComplete(score, questions.length)} className="w-full py-5 bg-emerald-900 text-white rounded-2xl font-bold shadow-xl hover:opacity-95 transition-all">
              Return to Sanctuary
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizOverlay;
