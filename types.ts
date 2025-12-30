
export type Sect = 'Sunni' | 'Shia';
// We use Madhab as a generic term for School of Thought/Methodology across both sects
export type Madhab = 'General' | 'Hanafi' | 'Maliki' | 'Shafi\'i' | 'Hanbali' | 'Usuli' | 'Akhbari';

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
