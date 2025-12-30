
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { getSystemInstruction, MODEL_NAME } from "../constants";
import { Sect, Madhab, QuranVerse, TafsirType } from "../types";

export const queryAdDeen = async (
  prompt: string, 
  sect: Sect, 
  madhab: Madhab, 
  history: { role: 'user' | 'model', parts: { text?: string, inlineData?: { mimeType: string, data: string } }[] }[] = [],
  image?: { mimeType: string, data: string }
) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const isNewsRequest = /(news|latest|happening|update|recent posts|x\.com|twitter)/i.test(prompt);
    const optimizedPrompt = isNewsRequest 
      ? `Search X.com and official Islamic news sites for the latest verified updates regarding: ${prompt}. Summarize the posts and communal sentiment.`
      : prompt;

    const userParts: any[] = [{ text: optimizedPrompt }];
    if (image) {
      userParts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data
        }
      });
    }

    const contents = [
      ...history,
      { role: 'user', parts: userParts }
    ];

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      // @ts-ignore
      contents: contents,
      config: {
        systemInstruction: getSystemInstruction(sect, madhab),
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    const text = response.text || "I apologize, but I am unable to formulate a response at this time.";
    
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      uri: chunk.web?.uri || '',
      title: chunk.web?.title || 'Scholarly Resource'
    })).filter((s: any) => s.uri) || [];

    const hasSocialSource = sources.some(s => 
      s.uri.includes('x.com') || 
      s.uri.includes('twitter.com') || 
      s.uri.includes('instagram.com')
    );

    const isNews = isNewsRequest || hasSocialSource;

    return { text, sources, isNews };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const fetchQuranVerse = async (surah: number, ayah: number, tafsirType: TafsirType = 'General Scholarly'): Promise<QuranVerse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const tafsirInstruction = tafsirType === 'Ibn Kathir' 
    ? "Provide a summary strictly based on the methodology of Tafsir Ibn Kathir (citing relevant Hadith or related verses where appropriate)."
    : tafsirType === 'Al-Jalalayn'
    ? "Provide a concise linguistic and direct summary based on Tafsir al-Jalalayn."
    : "Provide a balanced, multi-perspective scholarly summary.";

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Fetch authoritative details for Surah ${surah}, Ayah ${ayah}. ${tafsirInstruction}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          surahNumber: { type: Type.INTEGER },
          ayahNumber: { type: Type.INTEGER },
          surahName: { type: Type.STRING },
          arabicText: { type: Type.STRING },
          transliteration: { type: Type.STRING },
          translation: { type: Type.STRING },
          tafsirSummary: { type: Type.STRING },
        },
        required: ["surahNumber", "ayahNumber", "surahName", "arabicText", "transliteration", "translation", "tafsirSummary"],
      },
    },
  });

  const baseResult = JSON.parse(response.text || '{}');
  
  // Attach authentic recitation audio link (Alafasy)
  return {
    ...baseResult,
    tafsirType,
    audioUri: `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${((surah-1)*0) + (ayah + getAyahOffset(surah))}.mp3` // Simplified logic, real implementation uses global ayah index
  };
};

// Helper for global ayah index mapping for audio APIs
const getAyahOffset = (surah: number): number => {
    const counts = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,11,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
    let offset = 0;
    for(let i=0; i < surah - 1; i++) offset += counts[i];
    return offset;
};

export const generateSacredArt = async (prompt: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `Create high-quality Islamic art. Theme: ${prompt}.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image data generated");
};

export const generateSpeech = async (text: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say in a scholarly tone: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data received");
    
    return base64Audio;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};

export function decodeBase64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
