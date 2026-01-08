
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { getSystemInstruction, MODEL_NAME } from "../constants";
import { Sect, Madhab, QuranVerse, Attachment, VisualMetadata, ResourceLink, ArticleLead, QuizQuestion, GroundingLink } from "../types";

export const queryAdDeen = async (
  prompt: string, 
  sect: Sect, 
  madhab: Madhab, 
  history: { role: 'user' | 'model', parts: { text?: string, inlineData?: { mimeType: string, data: string } }[] }[] = [],
  attachment?: Attachment
) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const isNewsRequest = /(news|latest|happening|update|recent posts|x\.com|twitter|fatwa debate)/i.test(prompt);
    const isMapsRequest = /(mosque|masjid|halal|restaurant|nearby|around me|location|where is)/i.test(prompt);
    const isLegacyRequest = /(lesson|daily lesson|curriculum|legacy of knowledge)/i.test(prompt);

    let finalPrompt = prompt;
    let tools: any[] = [{ googleSearch: {} }];
    let toolConfig: any = undefined;

    if (isMapsRequest) {
      tools = [{ googleMaps: {} }, { googleSearch: {} }];
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
        toolConfig = {
          retrievalConfig: { latLng: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } }
        };
      } catch (e) { console.warn("Location denied."); }
    }

    const userParts: any[] = [{ text: finalPrompt }];
    if (attachment) userParts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });

    const response = await ai.models.generateContent({
      model: isMapsRequest ? 'gemini-2.5-flash' : MODEL_NAME,
      contents: [...history, { role: 'user', parts: userParts }],
      config: {
        systemInstruction: getSystemInstruction(sect, madhab),
        tools,
        toolConfig,
        temperature: 0.1
      },
    });

    let text = response.text || "I apologize, but I am unable to formulate a response.";
    
    // Quiz trigger strictly for legacy lessons
    let isLegacyLesson = isLegacyRequest && text.includes('[[LEGACY_COMPLETE]]');
    text = text.replace('[[LEGACY_COMPLETE]]', '');

    let suggestions: string[] = [];
    let articleLeads: ArticleLead[] = [];

    const suggestionsMatch = text.match(/\[\[SUGGESTIONS: (.*?)\]\]/);
    if (suggestionsMatch) {
      suggestions = suggestionsMatch[1].split(',').map(s => s.trim());
      text = text.replace(suggestionsMatch[0], '');
    }

    const articleMatches = text.matchAll(/\[\[ARTICLE: (.*?)\]\]/g);
    for (const match of articleMatches) {
      const parts = match[1].split('|').map(s => s.trim());
      if (parts[0]) articleLeads.push({ title: parts[0], context: parts[1] || "Deep scholarly dive." });
      text = text.replace(match[0], '');
    }

    const sources: GroundingLink[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web) sources.push({ uri: chunk.web.uri, title: chunk.web.title, type: 'web' });
      if (chunk.maps) sources.push({ uri: chunk.maps.uri, title: chunk.maps.title || "Scholarly Landmark", type: 'maps' });
    });

    return { 
      text: text.trim(), 
      sources, 
      isNews: isNewsRequest, 
      suggestions, 
      articleLeads,
      isLegacyLesson
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const fetchQuranVerse = async (surah: number, ayah: number): Promise<QuranVerse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Retrieve details for Surah ${surah}, Ayah ${ayah}. Use standard Hafs narration. Provide Arabic Uthmani text, English translation, and Ibn Kathir's classical tafsir summary.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          surahNumber: { type: Type.INTEGER },
          ayahNumber: { type: Type.INTEGER },
          surahName: { type: Type.STRING },
          arabicText: { type: Type.STRING },
          translation: { type: Type.STRING },
          tafsir: {
            type: Type.OBJECT,
            properties: { classical: { type: Type.OBJECT, properties: { ibnKathir: { type: Type.STRING } }, required: ['ibnKathir'] } },
            required: ['classical']
          },
          modernApplication: { type: Type.STRING },
          audioUri: { type: Type.STRING }
        },
        required: ['surahNumber', 'ayahNumber', 'surahName', 'arabicText', 'translation', 'tafsir', 'modernApplication', 'audioUri']
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const fetchQuranRange = async (surah: number, start: number, end: number): Promise<QuranVerse[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Retrieve details for Surah ${surah}, Ayahs ${start} to ${end}. Use Hafs narration.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            surahNumber: { type: Type.INTEGER },
            ayahNumber: { type: Type.INTEGER },
            surahName: { type: Type.STRING },
            arabicText: { type: Type.STRING },
            translation: { type: Type.STRING },
            tafsir: {
              type: Type.OBJECT,
              properties: { classical: { type: Type.OBJECT, properties: { ibnKathir: { type: Type.STRING } }, required: ['ibnKathir'] } },
              required: ['classical']
            },
            modernApplication: { type: Type.STRING },
            audioUri: { type: Type.STRING }
          },
          required: ['surahNumber', 'ayahNumber', 'surahName', 'arabicText', 'translation', 'tafsir', 'modernApplication', 'audioUri']
        }
      }
    }
  });
  return JSON.parse(response.text || '[]');
};

export const generateLessonQuiz = async (lessonContent: string, sect: Sect, madhab: Madhab): Promise<QuizQuestion[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Generate exactly 5 high-quality multiple choice questions based on this specific Islamic lesson: "${lessonContent.substring(0, 1000)}".`;
  
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { 
      systemInstruction: getSystemInstruction(sect, madhab), 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING, description: "The question text." },
            options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of 4 possible answers." },
            correctAnswer: { type: Type.STRING, description: "The string value of the correct option." },
            explanation: { type: Type.STRING, description: "Short scholarly explanation for the correct answer." }
          },
          required: ["id", "text", "options", "correctAnswer", "explanation"]
        }
      }
    },
  });
  return JSON.parse(response.text || '[]');
};

export const getAIGradingFeedback = async (score: number, total: number, studentAnswers: string[], correctAnswers: string[], sect: Sect, madhab: Madhab): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `A student scored ${score}/${total} on a quiz. Give deep scholarly feedback and encouragement.`;
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { systemInstruction: getSystemInstruction(sect, madhab) },
  });
  return response.text || "May Allah increase your wisdom.";
};

export const generateSacredArt = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
  });
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) { if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`; }
  throw new Error("Art failed.");
};
