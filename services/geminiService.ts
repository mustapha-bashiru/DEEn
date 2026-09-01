import { GoogleGenAI, Type } from "@google/genai";
import { getSystemInstruction, MODEL_NAME } from "../constants";
import { env } from "../config/env";
import { STORAGE_KEYS } from "../config/storage";
import { Sect, Madhab, QuranVerse, Attachment, QuizQuestion, GroundingLink } from "../types";

/**
 * Exponential Backoff Utility for Scholarly Resilience
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 2000; 
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const errorStr = JSON.stringify(error).toLowerCase();
      const isQuotaError = 
        error?.status === 429 || 
        error?.code === 429 ||
        errorStr.includes('429') || 
        errorStr.includes('quota') ||
        errorStr.includes('resource_exhausted');
        
      if (isQuotaError && i < maxRetries - 1) {
        console.warn(`Scholarly quota reached. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2.5; 
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

export interface BriefingData {
  prayerTimes: {
    fajr: string;
    sunrise: string;
    dhuhr: string;
    asr: string;
    maghrib: string;
    isha: string;
  };
  hijriDate: string;
  specialEvent: string | null;
  dailyVerse: {
    arabic: string;
    translation: string;
  };
}

const BRIEFING_CACHE_KEY = STORAGE_KEYS.briefingCachePrefix;

export const fetchSpiritualBriefingData = async (location: string | null, lang: string): Promise<BriefingData> => {
  const now = Date.now();
  const cacheKey = `${BRIEFING_CACHE_KEY}_${lang}_${(location || 'global').replace(/\s/g, '_')}`;
  
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { timestamp, data } = JSON.parse(cached);
      if (now - timestamp < 12 * 60 * 60 * 1000) {
        return data;
      }
    }
  } catch {
    // A corrupt or unparseable cache entry is not worth surfacing: fall through
    // and fetch a fresh briefing, which overwrites it.
  }

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    const prompt = `Provide a spiritual briefing for today in ${location || 'a general global context'}. 
      1. Calculate approximate prayer times for this location today.
      2. Identify the current Hijri date.
      3. Check for any special Islamic events.
      4. Provide a beautiful short Quranic verse in Arabic and ${lang === 'ar' ? 'Arabic' : 'English'} translation.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prayerTimes: {
              type: Type.OBJECT,
              properties: {
                fajr: { type: Type.STRING },
                sunrise: { type: Type.STRING },
                dhuhr: { type: Type.STRING },
                asr: { type: Type.STRING },
                maghrib: { type: Type.STRING },
                isha: { type: Type.STRING },
              },
              required: ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]
            },
            hijriDate: { type: Type.STRING },
            specialEvent: { type: Type.STRING, nullable: true },
            dailyVerse: {
              type: Type.OBJECT,
              properties: {
                arabic: { type: Type.STRING },
                translation: { type: Type.STRING }
              },
              required: ["arabic", "translation"]
            }
          },
          required: ["prayerTimes", "hijriDate", "dailyVerse", "specialEvent"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
    return data;
  }).catch(() => {
    // Offline or quota-exhausted: the briefing is decorative enough that a
    // static fallback beats an error state. Times are placeholders, not
    // calculated — plan step 10 replaces them with mosque-provided schedules.
    return {
      prayerTimes: { fajr: '05:30', sunrise: '06:45', dhuhr: '12:30', asr: '15:45', maghrib: '18:15', isha: '19:45' },
      hijriDate: lang === 'ar' ? '٢١ رجب ١٤٤٧ هـ' : '21 Rajab 1447 AH',
      specialEvent: null,
      dailyVerse: { arabic: 'رَبِّ زِدْنِي عِلْمًا', translation: 'My Lord, increase me in knowledge.' }
    };
  });
};

export const queryAdDeen = async (
  prompt: string, 
  sect: Sect, 
  madhab: Madhab, 
  history: { role: 'user' | 'model', parts: { text?: string, inlineData?: { mimeType: string, data: string } }[] }[] = [],
  attachment?: Attachment
) => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    const isMapsRequest = /(mosque|masjid|halal|restaurant|nearby|around me|location|where is|navigate|address of|places)/i.test(prompt);
    const isNewsRequest = /(news|latest|happening|update|recent posts|fatwa debate)/i.test(prompt);
    const isLegacyRequest = /(lesson|daily lesson|curriculum|legacy of knowledge)/i.test(prompt);

    let finalPrompt = prompt;
    const tools: any[] = [];
    let toolConfig: any = undefined;
    const activeModel = isMapsRequest ? 'gemini-2.5-flash' : MODEL_NAME;

    if (isLegacyRequest) {
      finalPrompt = `STRICT REQUIREMENT: Provide a DEEP-DIVE, LONG-FORM scholarly article for today's 'Legacy of Knowledge' lesson. 
      The content should be extensive (at least 1500 words), highly detailed, and formatted as a professional long-read. 
      Cover historical foundations, major scholarly debates, comparative Fiqh if applicable, and contemporary relevance. 
      Organize it with descriptive headers. Conclude with [[LEGACY_COMPLETE]]. 
      Topic: ${prompt}`;
    }

    if (isMapsRequest) {
      tools.push({ googleMaps: {} });
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
        );
        toolConfig = { retrievalConfig: { latLng: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } } };
        finalPrompt += ` [Context: Lat ${pos.coords.latitude}, Lng ${pos.coords.longitude}]`;
      } catch {
        // The user denied geolocation or the fix timed out. Maps grounding still
        // works from the prompt text alone, just without a location bias.
      }
    } else if (isNewsRequest) {
      tools.push({ googleSearch: {} });
    }

    const userParts: any[] = [{ text: finalPrompt }];
    if (attachment) userParts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });

    const response = await ai.models.generateContent({
      model: activeModel,
      contents: [...history, { role: 'user', parts: userParts }],
      config: {
        systemInstruction: getSystemInstruction(sect, madhab),
        tools: tools.length > 0 ? tools : undefined,
        toolConfig,
        temperature: 0.5
      },
    });

    const rawText = response.text || "Scholarly servers are currently silent.";
    const isLegacyLesson = isLegacyRequest && rawText.includes('[[LEGACY_COMPLETE]]');
    let text = rawText.replace('[[LEGACY_COMPLETE]]', '').trim();
    
    // Clean citation artifacts
    text = text.replace(/\[\d+\]/g, '').replace(/\$\d+/g, '').replace(/\s\s+/g, ' ').trim();

    let suggestions: string[] = [];
    const suggestionsMatch = text.match(/\[\[SUGGESTIONS: (.*?)\]\]/);
    if (suggestionsMatch) {
      suggestions = suggestionsMatch[1].split(',').map(s => s.trim());
      text = text.replace(suggestionsMatch[0], '');
    }

    const sources: GroundingLink[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web) sources.push({ uri: chunk.web.uri, title: chunk.web.title, type: 'web' });
      else if (chunk.maps) sources.push({ uri: chunk.maps.uri, title: chunk.maps.title || "Sacred Landmark", type: 'maps' });
    });

    return { text, sources, suggestions, isLegacyLesson };
  });
};

export const detectLocationName = async (lat: number, lng: number): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: `Based on coordinates ${lat}, ${lng}, return ONLY the name of the City and Country. Format exactly as "City, Country". No extra text or periods.` }] }],
    });
    return response.text?.trim() || "Local Sanctuary";
  }).catch(() => "Local Sanctuary");
};

export const generateLessonQuiz = async (lessonText: string, sect: Sect, madhab: Madhab): Promise<QuizQuestion[]> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: `Based on this lesson: "${lessonText.substring(0, 3000)}", generate EXACTLY 5 challenging multiple choice questions for a ${sect} student of the ${madhab} madhab.` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ['id', 'text', 'options', 'correctAnswer', 'explanation']
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  });
};

// `_userAnswers` and `_correctAnswers` are accepted but not yet sent to the
// model, so feedback is score-based only. Callers already pass them; wiring them
// into the prompt is a feature change, not a stabilization one.
export const getAIGradingFeedback = async (score: number, total: number, _userAnswers: string[], _correctAnswers: string[], sect: Sect, madhab: Madhab): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: `The student scored ${score}/${total} on an Islamic quiz (${sect}/${madhab}). Provide scholarly feedback and encouragement.` }] }],
    });
    return response.text || "May Allah increase you in beneficial knowledge.";
  });
};

export const generateSacredArt = async (prompt: string): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
    });
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) { if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`; }
    throw new Error("Art failed.");
  });
};

export const generateSacredVideo = async (prompt: string): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `${prompt}, cinematic Islamic aesthetic`,
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
    });
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video failed.");
    const response = await fetch(`${downloadLink}&key=${env.geminiApiKey}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  });
};

export const generateDailyVersePrompt = async (): Promise<{ prompt: string, verseInfo: string }> => {
  const verse = await fetchQuranVerse(2, 255); 
  return {
    prompt: `Abstract cinematic visual of Ayah: "${verse.translation}". Islamic geometry and light.`,
    verseInfo: `${verse.surahName} ${verse.surahNumber}:${verse.ayahNumber}`
  };
};

export const fetchQuranVerse = async (surah: number, ayah: number): Promise<QuranVerse> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: `Retrieve Surah ${surah}, Ayah ${ayah}.` }] }],
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
            tafsir: { type: Type.OBJECT, properties: { classical: { type: Type.OBJECT, properties: { ibnKathir: { type: Type.STRING } }, required: ['ibnKathir'] } }, required: ['classical'] },
            modernApplication: { type: Type.STRING },
            audioUri: { type: Type.STRING }
          },
          required: ['surahNumber', 'ayahNumber', 'surahName', 'arabicText', 'translation', 'tafsir', 'modernApplication', 'audioUri']
        }
      }
    });
    return JSON.parse(response.text || '{}');
  });
};

export const fetchQuranRange = async (surah: number, startAyah: number, endAyah: number): Promise<QuranVerse[]> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: `Retrieve Surah ${surah}, Ayah ${startAyah} to ${endAyah}.` }] }],
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
              tafsir: { type: Type.OBJECT, properties: { classical: { type: Type.OBJECT, properties: { ibnKathir: { type: Type.STRING } }, required: ['ibnKathir'] } }, required: ['classical'] },
              modernApplication: { type: Type.STRING },
              audioUri: { type: Type.STRING }
            },
            required: ['surahNumber', 'ayahNumber', 'surahName', 'arabicText', 'translation', 'tafsir', 'modernApplication', 'audioUri']
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  });
};