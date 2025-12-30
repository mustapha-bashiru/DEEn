
export type Sect = 'Sunni' | 'Shia';
export type Madhab = 'General' | 'Hanafi' | 'Maliki' | 'Shafi\'i' | 'Hanbali' | 'Usuli' | 'Akhbari';
export type TafsirType = 'Ibn Kathir' | 'Al-Jalalayn' | 'General Scholarly';

export interface User {
  id: string;
  name: string;
  email: string;
  joinedAt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
  isBookmarked?: boolean;
  isNews?: boolean; 
  image?: {
    mimeType: string;
    data: string; 
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
}

export interface QuranVerse {
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
  arabicText: string;
  transliteration: string;
  translation: string;
  tafsirSummary: string;
  tafsirType?: TafsirType;
  audioUri?: string; // Authentic recitation URI
}
