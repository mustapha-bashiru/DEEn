
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { getSystemInstruction, MODEL_NAME } from "../constants";
import { Sect, Madhab, QuranVerse, Qiraat, Attachment, VisualMetadata, ResourceLink, ArticleLead, QuizQuestion, GroundingLink } from "../types";

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
    const isDeepDiveRequest = /(deep dive|read more|article|explain further|elaborate)/i.test(prompt);

    let finalPrompt = prompt;
    let tools: any[] = [{ googleSearch: {} }];
    let toolConfig: any = undefined;

    if (isMapsRequest) {
      // Maps grounding is only supported in Gemini 2.5 series models.
      tools = [{ googleMaps: {} }, { googleSearch: {} }];
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
        toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            }
          }
        };
      } catch (e) {
        console.warn("Location denied, using general maps tool.");
      }
    }

    if (isDeepDiveRequest) {
      finalPrompt = `Execute the 'Scholarly Synthesis Protocol' for the topic: ${prompt}. Create a long-form scholarly article.`;
    }

    const userParts: any[] = [{ text: finalPrompt }];
    if (attachment) userParts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });

    const response = await ai.models.generateContent({
      // Use gemini-2.5-flash for maps grounding as it is required for this tool.
      model: isMapsRequest ? 'gemini-2.5-flash' : MODEL_NAME,
      contents: [...history, { role: 'user', parts: userParts }],
      config: {
        systemInstruction: getSystemInstruction(sect, madhab),
        tools,
        toolConfig,
        temperature: 0.1,
        thinkingConfig: isDeepDiveRequest ? { thinkingBudget: 2000 } : undefined
      },
    });

    let text = response.text || "I apologize, but I am unable to formulate a response at this time.";
    
    let isLegacyLesson = text.includes('[[LEGACY_COMPLETE]]');
    text = text.replace('[[LEGACY_COMPLETE]]', '');

    let suggestions: string[] = [];
    let resources: ResourceLink[] = [];
    let visuals: VisualMetadata[] = [];
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
      isNews: isNewsRequest || isDeepDiveRequest, 
      suggestions, 
      resources,
      visuals,
      articleLeads,
      isLegacyLesson
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const generateLessonQuiz = async (lessonContent: string, sect: Sect, madhab: Madhab): Promise<QuizQuestion[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const safeContent = (lessonContent || "").substring(0, 1000);
  const prompt = `Generate a Quiz for this lesson: "${safeContent}". Follow the QUIZ GENERATION PROTOCOL. Return ONLY JSON.`;
  
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { 
      systemInstruction: getSystemInstruction(sect, madhab),
      responseMimeType: "application/json"
    },
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    return [];
  }
};

export const getAIGradingFeedback = async (score: number, total: number, studentAnswers: string[], correctAnswers: string[], sect: Sect, madhab: Madhab): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Student scored ${score}/${total} on a quiz. Correct Answers: [${correctAnswers.join(', ')}]. Student Answers: [${studentAnswers.join(', ')}]. Give encouraging feedback.`;
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { systemInstruction: getSystemInstruction(sect, madhab) },
  });
  return response.text || "May Allah (swt) increase your knowledge.";
};

export const generateSpeech = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Narrate with professional scholarly dignity: ${text}` }] }],
    config: { 
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

export const generateSacredArt = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `${prompt}. High resolution 3D render, religious educational style.` }] },
  });
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  }
  throw new Error("Image failed.");
};

export const generateScholarlyVideo = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Educational historical reconstruction: ${prompt}`,
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
  });
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({operation: operation});
  }
  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  return `${downloadLink}&key=${process.env.API_KEY}`;
};

// Fix for missing fetchQuranVerse export
export const fetchQuranVerse = async (surah: number, ayah: number, qiraat: Qiraat): Promise<QuranVerse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Retrieve details for Surah ${surah}, Ayah ${ayah} in the ${qiraat} qira'at. Provide Arabic Uthmani text, English translation, Ibn Kathir's classical tafsir summary, and a modern spiritual application. Also provide a direct study URI (e.g., https://quran.com/${surah}/${ayah}).`,
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
            properties: {
              classical: {
                type: Type.OBJECT,
                properties: {
                  ibnKathir: { type: Type.STRING }
                },
                required: ['ibnKathir']
              }
            },
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

// Fix for missing fetchQuranRange export
export const fetchQuranRange = async (surah: number, start: number, end: number, qiraat: Qiraat): Promise<QuranVerse[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Retrieve details for Surah ${surah}, Ayahs ${start} to ${end} in the ${qiraat} qira'at. For each ayah, provide Arabic Uthmani text, English translation, Ibn Kathir's classical tafsir summary, and a modern spiritual application. Also provide a direct study URI (e.g., https://quran.com/${surah}/[ayah]).`,
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
              properties: {
                classical: {
                  type: Type.OBJECT,
                  properties: {
                    ibnKathir: { type: Type.STRING }
                  },
                  required: ['ibnKathir']
                }
              },
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

export function decodeBase64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext) {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
  return buffer;
}
