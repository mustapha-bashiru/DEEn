
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { getSystemInstruction, MODEL_NAME } from "../constants";
import { Sect, Madhab, QuranVerse, Attachment, VisualMetadata, ResourceLink, ArticleLead, QuizQuestion, GroundingLink } from "../types";

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

export const fetchSpiritualBriefingData = async (location: string | null, lang: string): Promise<BriefingData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Provide a spiritual briefing for today in ${location || 'a general global context'}. 
    1. Calculate approximate prayer times for this location today.
    2. Identify the current Hijri date.
    3. Check for any special Islamic events.
    4. Provide a beautiful short Quranic verse in Arabic and ${lang === 'ar' ? 'Arabic' : 'English'} translation.`;

  try {
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

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Briefing Data Error:", error);
    return {
      prayerTimes: { fajr: '05:30', sunrise: '06:45', dhuhr: '12:30', asr: '15:45', maghrib: '18:15', isha: '19:45' },
      hijriDate: lang === 'ar' ? '٢١ رجب ١٤٤٧ هـ' : '21 Rajab 1447 AH',
      specialEvent: null,
      dailyVerse: { arabic: 'رَبِّ زِدْنِي عِلْمًا', translation: 'My Lord, increase me in knowledge.' }
    };
  }
};

export const queryAdDeen = async (
  prompt: string, 
  sect: Sect, 
  madhab: Madhab, 
  history: { role: 'user' | 'model', parts: { text?: string, inlineData?: { mimeType: string, data: string } }[] }[] = [],
  attachment?: Attachment
) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const isMapsRequest = /(mosque|masjid|halal|restaurant|nearby|around me|location|where is|navigate|address of)/i.test(prompt);
    const isNewsRequest = /(news|latest|happening|update|recent posts|fatwa debate)/i.test(prompt);
    const isLegacyRequest = /(lesson|daily lesson|curriculum|legacy of knowledge)/i.test(prompt);

    let finalPrompt = prompt;
    let tools: any[] = [];
    let toolConfig: any = undefined;

    // Maps grounding is only supported in Gemini 2.5 series.
    // googleSearch is supported in Gemini 3 series.
    const activeModel = isMapsRequest ? 'gemini-2.5-flash' : MODEL_NAME;

    if (isMapsRequest) {
      tools.push({ googleMaps: {} });
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        toolConfig = {
          retrievalConfig: { 
            latLng: { 
              latitude: pos.coords.latitude, 
              longitude: pos.coords.longitude 
            } 
          }
        };
        finalPrompt = `STRICT GPS CONTEXT: User current location is [Lat: ${pos.coords.latitude}, Lng: ${pos.coords.longitude}]. MANDATORY: You MUST provide the full street address and calculate the estimated distance in meters/kilometers for EVERY landmark/location you mention. Do NOT use placeholders. Query: ${prompt}`;
      } catch (e) {
        finalPrompt = `LOCATION CONTEXT: Exact coordinates unavailable, search based on general vicinity. Query: ${prompt}`;
      }
    } else if (isNewsRequest || prompt.length > 50) {
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
        temperature: 0.1
      },
    });

    let text = response.text || "I apologize, the scholars are currently in deep reflection. Please rephrase your inquiry.";
    
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
      if (parts[0]) articleLeads.push({ title: parts[0], context: parts[1] || "Scholarly insight." });
      text = text.replace(match[0], '');
    }

    const sources: GroundingLink[] = [];
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web) {
        sources.push({ uri: chunk.web.uri, title: chunk.web.title, type: 'web' });
      } else if (chunk.maps) {
        const place = chunk.maps.placeAnswerSources?.[0];
        sources.push({ 
          uri: chunk.maps.uri, 
          title: chunk.maps.title || "Sacred Landmark", 
          type: 'maps',
          address: place?.address,
          description: place?.reviewSnippets?.join(' ')
        });
      }
    });

    return { 
      text: text.trim(), 
      sources, 
      isNews: isNewsRequest, 
      suggestions, 
      articleLeads,
      isLegacyLesson
    };
  } catch (error: any) {
    console.error("Gemini Error:", error);
    // Handle 404/NOT_FOUND errors which may happen if the key is restricted or the model is unavailable
    if (error.message?.includes("entity was not found") || error.message?.includes("404")) {
      throw new Error("SCHOLARLY_KEY_ERROR");
    }
    throw error;
  }
};

export const detectLocationName = async (lat: number, lng: number): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: `Based on coordinates ${lat}, ${lng}, return ONLY the name of the City and Country. Format: "City, Country".` }] }],
    });
    return response.text?.trim() || "Local Sanctuary";
  } catch (e) {
    return "Local Sanctuary";
  }
};

export const fetchQuranVerse = async (surah: number, ayah: number): Promise<QuranVerse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [{ role: 'user', parts: [{ text: `Retrieve Surah ${surah}, Ayah ${ayah}. Include Arabic text, translation, Ibn Kathir summary, and modern application.` }] }],
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

export const fetchQuranRange = async (surah: number, startAyah: number, endAyah: number): Promise<QuranVerse[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

export const generateLessonQuiz = async (lessonText: string, sect: Sect, madhab: Madhab): Promise<QuizQuestion[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [{ role: 'user', parts: [{ text: `Generate 3 multiple choice questions for this Islamic lesson (${sect}/${madhab}): ${lessonText}` }] }],
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
};

export const getAIGradingFeedback = async (score: number, total: number, userAnswers: string[], correctAnswers: string[], sect: Sect, madhab: Madhab): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [{ role: 'user', parts: [{ text: `Provide scholarly encouragement for score ${score}/${total} (${sect}/${madhab}).` }] }],
  });
  return response.text || "May Allah increase you in beneficial knowledge.";
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

export const generateSacredVideo = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `${prompt}, cinematic Islamic aesthetic, educational`,
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video failed.");
  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const generateDailyVersePrompt = async (): Promise<{ prompt: string, verseInfo: string }> => {
  const verse = await fetchQuranVerse(2, 255); // Ayatul Kursi as default
  return {
    prompt: `An abstract cinematic visual of the Ayah: "${verse.translation}". Islamic geometry and light.`,
    verseInfo: `${verse.surahName} ${verse.surahNumber}:${verse.ayahNumber}`
  };
};
