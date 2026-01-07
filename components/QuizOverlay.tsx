
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
}

const QUESTION_TIME_SECONDS = 30;

const QuizOverlay: React.FC<QuizOverlayProps> = ({ questions, onComplete, lang, sect, madhab }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SECONDS);

  const t = translations[lang];
  const current = questions[currentIdx];

  // Global Timer logic
  useEffect(() => {
    if (showResult) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Force advance on timeout
          handleSelect("TIMEOUT_NO_ANSWER");
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
    questions.forEach((q, i) => {
      if (q.correctAnswer === finalAnswers[i]) score++;
    });

    setLoadingFeedback(true);
    try {
      const fb = await getAIGradingFeedback(
        score, 
        questions.length, 
        finalAnswers, 
        questions.map(q => q.correctAnswer),
        sect,
        madhab
      );
      setFeedback(fb);
    } catch (e) {
      setFeedback("Excellent persistence in your studies.");
    } finally {
      setLoadingFeedback(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-stone-950/90 backdrop-blur-xl animate-fade-in">
      <div className="max-w-lg w-full bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-stone-200">
        {!showResult ? (
          <div className="p-10 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Question {currentIdx + 1} of {questions.length}</span>
                <div className={`mt-1 flex items-center space-x-2 ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-emerald-600'}`}>
                  <i className="fas fa-clock text-xs"></i>
                  <span className="text-xs font-black tracking-widest">{timeLeft}s</span>
                </div>
              </div>
              <div className="h-1.5 w-32 bg-stone-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-600 transition-all duration-500" 
                  style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <h3 className="text-xl font-bold text-stone-900 leading-relaxed">{current.text}</h3>

            <div className="space-y-3">
              {current.options.map((opt, i) => (
                <button 
                  key={i} 
                  onClick={() => handleSelect(opt)}
                  className="w-full p-5 text-left bg-stone-50 border border-stone-200 rounded-2xl hover:border-emerald-600 hover:bg-emerald-50 transition-all font-medium text-stone-700 text-sm group"
                >
                  <span className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-white border border-stone-200 mr-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors">{String.fromCharCode(65 + i)}</span>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-10 text-center space-y-8 animate-fade-in">
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
               <i className="fas fa-scroll text-3xl text-emerald-800"></i>
            </div>
            
            <div>
              <h2 className="text-3xl font-black text-stone-900">{t.quizCompleted}</h2>
              <p className="text-stone-500 font-medium mt-2">{t.score}: {answers.reduce((acc, ans, i) => acc + (ans === questions[i].correctAnswer ? 1 : 0), 0)} / {questions.length}</p>
            </div>

            <div className="p-6 bg-stone-50 rounded-3xl border border-stone-100 text-sm italic text-stone-600 leading-relaxed min-h-[80px]">
               {loadingFeedback ? (
                 <div className="flex items-center justify-center space-x-2 py-4">
                   <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce"></div>
                   <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce delay-100"></div>
                   <span className="text-[10px] font-black uppercase tracking-widest ml-2">Assembling Scholarly Feedback...</span>
                 </div>
               ) : feedback}
            </div>

            <button 
              onClick={() => onComplete(answers.reduce((acc, ans, i) => acc + (ans === questions[i].correctAnswer ? 1 : 0), 0), questions.length)}
              className="w-full py-5 bg-stone-900 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-all"
            >
              Continue Journey
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizOverlay;
