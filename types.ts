
export type Sect = 'Sunni' | 'Shia';
export type Madhab = 'General' | 'Hanafi' | 'Maliki' | 'Shafi\'i' | 'Hanbali' | 'Usuli' | 'Akhbari';
export type TafsirType = 'Classical' | 'Contemporary' | 'Thematic';
export type Qiraat = 'Hafs' | 'Warsh' | 'Qalun' | 'Al-Duri';

export interface VisualMetadata {
  label: string;
  prompt: string;
}

export interface ResourceLink {
  label: string;
  url: string;
}

export interface ArticleLead {
  title: string;
  context: string;
}

export interface Attachment {
  mimeType: string;
  data: string;
  fileName?: string;
  label?: string;
}

export interface GroundingLink {
  uri: string;
  title: string;
  type: 'web' | 'maps';
  address?: string;
  description?: string;
}

export interface SacredArt {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

export interface LiveTranscriptItem {
  id: string;
  role: 'Scholar' | 'Seeker';
  text: string;
  timestamp: number;
}

export interface LiveSessionRecord {
  id: string;
  title: string;
  timestamp: number;
  transcript: LiveTranscriptItem[];
  audioBlobUrl?: string; // For local session playback
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: GroundingLink[];
  isBookmarked?: boolean;
  isNews?: boolean; 
  attachments?: Attachment[]; 
  suggestions?: string[];
  visuals?: VisualMetadata[]; 
  resources?: ResourceLink[]; 
  articleLeads?: ArticleLead[];
  isLegacyLesson?: boolean;
  feedback?: {
    rating: 'up' | 'down';
    comment?: string;
  };
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: number;
  sect: Sect;
  madhab: Madhab;
  isBookmarked?: boolean;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface UserProgress {
  xp: number;
  level: number;
  streak: number;
  // lastLessonDate and lastQuizDate changed to string | null to support daily marker comparisons with toDateString()
  lastLessonDate: string | null;
  lastQuizDate: string | null;
  completedQuizzes: string[];
  badges: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  joinedAt: number;
  progress: UserProgress;
  preferredSect?: Sect;
  preferredMadhab?: Madhab;
}

export interface QuranVerse {
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
  arabicText: string;
  translation: string;
  tafsir: {
    classical: { ibnKathir: string; };
  };
  modernApplication: string;
  audioUri: string;
}

/** The top-level surfaces App can switch between. */
export type AppView = 'chat' | 'bookmarks' | 'quran' | 'arts' | 'live';

/**
 * The AI Studio host bridge. Present only when the app runs inside Google AI
 * Studio, which is where users pick a key with Veo quota; `window.aistudio` is
 * undefined everywhere else, so every call site must guard on it.
 */
export interface AiStudioBridge {
  hasSelectedApiKey?: () => Promise<boolean>;
  openSelectKey?: () => Promise<void>;
}
